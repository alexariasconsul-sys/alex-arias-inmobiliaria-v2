require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Datastore = require('@seald-io/nedb');
const { initDB, getDB, mapDoc, mapDocs, genId } = require('./db');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Base de datos de vistas (IP + 24h deduplicación)
const viewsDB = new Datastore({ filename: path.join(__dirname, 'views.db'), autoload: true });

// Base de datos del blog
const blogDB = new Datastore({ filename: path.join(__dirname, 'blog.db'), autoload: true });

// Base de datos de búsquedas (tracking de queries)
const searchesDB = new Datastore({ filename: path.join(__dirname, 'searches.db'), autoload: true });

// Base de datos de leads (tracking de contactos)
const leadsDB = new Datastore({ filename: path.join(__dirname, 'leads.db'), autoload: true });

// Base de datos de eventos Pixel/CAPI — debug y auditoría (máx 500 entradas)
const pixelEventsDB = new Datastore({ filename: path.join(__dirname, 'pixel_events.db'), autoload: true });

// Base de datos de reseñas Google
let _reviewsDB = null;
function getReviewsDB() {
  if (!_reviewsDB) {
    _reviewsDB = new Datastore({ filename: path.join(__dirname, 'reviews.db'), autoload: true });
    _reviewsDB.ensureIndexAsync({ fieldName: 'googleId', unique: true }).catch(() => {});
  }
  return _reviewsDB;
}

const app = express();
app.set('trust proxy', 1); // Necesario para rate-limit detrás de Nginx en VPS
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Asegurar carpeta uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer — usa memoria para procesar con Sharp antes de guardar
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    /image\/(jpeg|jpg|png|webp|gif|heic|heif)/.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Solo imágenes'));
  }
});

// Optimizar imagen: redimensionar + convertir a WebP + comprimir
async function saveOptimizedImage(buffer) {
  const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}.webp`;
  const filepath = path.join(uploadsDir, filename);
  await sharp(buffer)
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(filepath);
  return filename;
}

// ── SEGURIDAD ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Desactivado para no romper scripts inline del frontend
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false // Permitir que Meta/Google descarguen imágenes
}));

// Rate limiting global (100 peticiones por 15 min por IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }, // Nginx envía X-Forwarded-For, suprimir falso positivo
  message: { error: 'Demasiadas peticiones, intenta en 15 minutos.' }
});

// Rate limiting estricto para login/auth (10 intentos por 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: 'Demasiados intentos de acceso, intenta en 15 minutos.' }
});

app.use('/api/verify-password', authLimiter);
app.use('/auth/google', authLimiter);
// Eximir endpoints de feed del rate limiter — Meta crawlea ~56 imágenes en ráfaga
app.use('/api/', (req, res, next) => {
  // req.url = parte DESPUÉS de /api/, ej: "/feed/facebook.csv"
  if (req.url.startsWith('/feed/') || req.url === '/feed') return next();
  return globalLimiter(req, res, next);
});

// Middleware
// Compresión Brotli si está disponible, sino Gzip
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6 // Nivel de compresión: 1-6 (más alto = más lento)
}));
app.use(cors());

// ── OPTIMIZACIÓN: Headers de rendimiento ─────────────────────
app.use((req, res, next) => {
  // Preload recursos críticos
  res.set('Link', '</styles.css>; rel=preload; as=style, </app.js>; rel=preload; as=script');

  // Security headers
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');

  // Performance hints
  res.set('X-UA-Compatible', 'IE=edge');
  res.set('X-DNS-Prefetch-Control', 'on');

  next();
});
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  SESSION_SECRET no definido, usando valor de fallback inseguro');
}
app.use(session({
  secret: process.env.SESSION_SECRET || 'alex-arias-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS-only en producción
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// ── HELPER: leer AggregateRating desde reseñas ───────────────
async function getAggregateRating() {
  try {
    const reviews = await getReviewsDB().findAsync({ rating: { $exists: true } });
    if (!reviews.length) return null;
    const total = reviews.length;
    const avg   = reviews.reduce((s, r) => s + (r.rating || 0), 0) / total;
    return { ratingValue: Math.round(avg * 10) / 10, reviewCount: total };
  } catch { return null; }
}

// ── HELPER: obtener reseñas individuales para schema Review ─────
async function getTopReviews(limit = 5) {
  try {
    const reviews = await getReviewsDB().findAsync({ rating: { $gte: 4 }, comment: { $exists: true } });
    return reviews
      .sort((a, b) => (b.rating - a.rating) || (new Date(b.createdAt) - new Date(a.createdAt)))
      .slice(0, limit)
      .map(r => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.name || 'Cliente' },
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
        reviewBody: (r.comment || '').slice(0, 300),
        datePublished: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : undefined
      }));
  } catch { return []; }
}

// ── HELPER: servir index.html con SSR completo ─────────────────
async function serveIndex(req, res, overrides = {}) {
  try {
    const baseUrl   = process.env.SITE_URL || 'https://alexariasc.com';
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const {
      pageTitle = 'Alex Arias · Consultor Inmobiliario | Apartamentos en Medellín',
      metaDesc  = 'Portafolio inmobiliario de Alexander Arias — Arriendo y venta de apartamentos en Sabaneta, Envigado y Medellín. Asesoría inmobiliaria especializada.',
      ogTitle   = 'Alex Arias · Consultor Inmobiliario',
      ogDesc    = metaDesc,
      ogImage   = `${baseUrl}/assets/logo/Logo.png`,
      ogUrl     = baseUrl,
      ogType    = 'website',
      extraSchema = '',
      cityFilter  = null,
      tipoFilter  = null,
      pixelId     = ''
    } = overrides;

    const injectedTags = `
  <meta property="og:type"         content="${esc(ogType)}" />
  <meta property="og:site_name"    content="Alex Arias · Consultor Inmobiliario" />
  <meta property="og:title"        content="${esc(ogTitle)}" />
  <meta property="og:description"  content="${esc(ogDesc)}" />
  <meta property="og:image"        content="${esc(ogImage)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type"   content="image/jpeg" />
  <meta property="og:url"          content="${esc(ogUrl)}" />
  <meta property="og:locale"       content="es_CO" />${pixelId ? `\n  <meta property="fb:app_id" content="${esc(pixelId)}" />` : ''}
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:site"        content="@alexariasconsul" />
  <meta name="twitter:creator"     content="@alexariasconsul" />
  <meta name="twitter:title"       content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDesc)}" />
  <meta name="twitter:image"       content="${esc(ogImage)}" />
  ${extraSchema}
  ${cityFilter ? `<script>window._cityFilter=${JSON.stringify(cityFilter)};</script>` : ''}
  ${tipoFilter ? `<script>window._tipoFilter=${JSON.stringify(tipoFilter)};</script>` : ''}`;

    html = html.replace(/id="pageTitle">([^<]*)<\/title>/,   `id="pageTitle">${esc(pageTitle)}</title>`);
    html = html.replace(/id="metaDesc" name="description" content="([^"]*)"/, `id="metaDesc" name="description" content="${esc(metaDesc)}"`);
    html = html.replace('id="canonicalUrl" rel="canonical" href="https://alexariasc.com/"', `id="canonicalUrl" rel="canonical" href="${esc(ogUrl)}"`);
    html = html.replace('</head>', injectedTags + '\n</head>');
    res.send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
}

// ── PÁGINAS DE ATERRIZAJE POR CIUDAD ─────────────────────────
// /sabaneta, /envigado, /medellin — SEO específico por ciudad
const CITY_PAGES = [
  {
    route: '/sabaneta',
    municipio: 'Sabaneta',
    slug: 'sabaneta',
    desc: 'Apartamentos en arriendo y venta en Sabaneta, Antioquia. Los mejores conjuntos cerrados del sur del Área Metropolitana de Medellín. Asesoría gratuita con Alex Arias.'
  },
  {
    route: '/envigado',
    municipio: 'Envigado',
    slug: 'envigado',
    desc: 'Apartamentos en arriendo y venta en Envigado, Antioquia. Excelentes opciones en uno de los municipios con mejor calidad de vida de Colombia. Asesoría con Alex Arias.'
  },
  {
    route: '/medellin',
    municipio: 'Medellín',
    slug: 'medellin',
    desc: 'Apartamentos en arriendo y venta en Medellín. Encuentra tu hogar ideal en la ciudad de la eterna primavera con asesoría personalizada de Alex Arias, consultor inmobiliario.'
  }
];

CITY_PAGES.forEach(({ route, municipio, slug, desc }) => {
  app.get(route, async (req, res) => {
    try {
      const baseUrl = process.env.SITE_URL || 'https://alexariasc.com';
      const db      = getDB();
      const props   = await db.findAsync({ municipio });
      const count   = props.length;
      const arriendo = props.filter(p => p.tipo === 'arriendo' || p.tipo === 'combinado').length;
      const venta    = props.filter(p => p.tipo === 'venta'    || p.tipo === 'combinado').length;
      const rating   = await getAggregateRating();

      const pageTitle = `Apartamentos en ${municipio} · ${count} disponibles | Alex Arias Inmobiliaria`;
      const metaDesc  = `${count} apartamentos en ${municipio}: ${arriendo} en arriendo y ${venta} en venta. ${desc}`;
      const ogUrl     = `${baseUrl}/${slug}`;

      const breadcrumb = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio',     item: baseUrl },
          { '@type': 'ListItem', position: 2, name: municipio,    item: ogUrl }
        ]
      };

      const agentSchema = {
        '@context': 'https://schema.org',
        '@type': 'RealEstateAgent',
        name: 'Alex Arias · Consultor Inmobiliario',
        url: baseUrl,
        telephone: '+573122588521',
        areaServed: municipio,
        ...(rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.ratingValue, reviewCount: rating.reviewCount, bestRating: 5, worstRating: 1 } } : {})
      };

      const extraSchema = `
  <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
  <script type="application/ld+json">${JSON.stringify(agentSchema)}</script>`;

      const settings = readSettings();
      await serveIndex(req, res, {
        pageTitle, metaDesc, ogTitle: pageTitle, ogDesc: metaDesc, ogUrl,
        extraSchema, cityFilter: municipio,
        pixelId: (settings.facebookPixelId || '').trim()
      });
    } catch (err) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
});

// ── PÁGINAS DE TIPO: /arriendo y /venta ─────────────────────
const TIPO_PAGES = [
  {
    route: '/arriendo',
    tipo: 'arriendo',
    label: 'Arriendo',
    title: 'Apartamentos en Arriendo · Sabaneta, Envigado y Medellín | Alex Arias',
    desc:  'Encuentra apartamentos en arriendo en Sabaneta, Envigado y Medellín. Asesoría inmobiliaria gratuita con Alexander Arias, consultor certificado del Área Metropolitana.'
  },
  {
    route: '/venta',
    tipo: 'venta',
    label: 'Venta',
    title: 'Apartamentos en Venta · Sabaneta, Envigado y Medellín | Alex Arias',
    desc:  'Compra tu apartamento en Sabaneta, Envigado o Medellín. Asesoría personalizada sin costo para el comprador. Alex Arias, tu consultor inmobiliario de confianza.'
  }
];

TIPO_PAGES.forEach(({ route, tipo, label, title, desc }) => {
  app.get(route, async (req, res) => {
    try {
      const baseUrl = process.env.SITE_URL || 'https://alexariasc.com';
      const db      = getDB();
      const props   = await db.findAsync({ tipo: { $in: [tipo, 'combinado'] } });
      const count   = props.length;
      const rating  = await getAggregateRating();
      const ogUrl   = `${baseUrl}${route}`;

      const pageTitle = `${count} Apartamentos en ${label} · Sabaneta, Envigado y Medellín | Alex Arias`;
      const metaDesc  = `${count} apartamentos en ${label.toLowerCase()} disponibles en Sabaneta, Envigado y Medellín. ${desc}`;

      const breadcrumb = {
        '@context':'https://schema.org','@type':'BreadcrumbList',
        itemListElement: [
          { '@type':'ListItem', position:1, name:'Inicio',    item: baseUrl },
          { '@type':'ListItem', position:2, name: label,      item: ogUrl }
        ]
      };
      const agentSchema = {
        '@context':'https://schema.org','@type':'RealEstateAgent',
        name:'Alexander Arias', url: baseUrl, telephone:'+573122588521',
        ...(rating ? { aggregateRating:{ '@type':'AggregateRating', ratingValue: rating.ratingValue, reviewCount: rating.reviewCount, bestRating:5, worstRating:1 } } : {})
      };
      const extraSchema = [breadcrumb, agentSchema]
        .map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n  ');

      const settings = readSettings();
      await serveIndex(req, res, {
        pageTitle, metaDesc, ogTitle: pageTitle, ogDesc: metaDesc, ogUrl,
        extraSchema, tipoFilter: tipo,
        pixelId: (settings.facebookPixelId || '').trim()
      });
    } catch (err) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
});

// ── PÁGINAS TIPO+CIUDAD: /sabaneta/arriendo, /envigado/venta, etc.
const TIPO_CIUDAD_PAGES = [];
[
  { municipio:'Sabaneta', slug:'sabaneta', lat:'6.151389', lon:'-75.616389' },
  { municipio:'Envigado', slug:'envigado', lat:'6.175556', lon:'-75.591667' },
  { municipio:'Medellín', slug:'medellin', lat:'6.230833', lon:'-75.590553' }
].forEach(city => {
  [
    { tipo:'arriendo', label:'Arriendo' },
    { tipo:'venta',    label:'Venta' }
  ].forEach(({ tipo, label }) => {
    TIPO_CIUDAD_PAGES.push({
      route: `/${city.slug}/${tipo}`,
      municipio: city.municipio, slug: city.slug,
      tipo, label, lat: city.lat, lon: city.lon
    });
  });
});

TIPO_CIUDAD_PAGES.forEach(({ route, municipio, slug, tipo, label, lat, lon }) => {
  app.get(route, async (req, res) => {
    try {
      const baseUrl = process.env.SITE_URL || 'https://alexariasc.com';
      const db      = getDB();
      const props   = await db.findAsync({ municipio, tipo: { $in: [tipo, 'combinado'] } });
      const count   = props.length;
      const rating  = await getAggregateRating();
      const ogUrl   = `${baseUrl}${route}`;

      const pageTitle = `Apartamentos en ${label} en ${municipio} · ${count} disponibles | Alex Arias`;
      const metaDesc  = `${count} apartamentos en ${label.toLowerCase()} en ${municipio}, Antioquia. Asesoría inmobiliaria gratuita con Alexander Arias — encuentra tu hogar ideal en ${municipio} hoy.`;

      const breadcrumb = {
        '@context':'https://schema.org','@type':'BreadcrumbList',
        itemListElement: [
          { '@type':'ListItem', position:1, name:'Inicio',            item: baseUrl },
          { '@type':'ListItem', position:2, name: municipio,          item: `${baseUrl}/${slug}` },
          { '@type':'ListItem', position:3, name: `En ${label}`,      item: ogUrl }
        ]
      };
      const agentSchema = {
        '@context':'https://schema.org','@type':'RealEstateAgent',
        name:'Alexander Arias', url: baseUrl, telephone:'+573122588521',
        areaServed: { '@type':'City', name: municipio },
        geo: { '@type':'GeoCoordinates', latitude: lat, longitude: lon },
        ...(rating ? { aggregateRating:{ '@type':'AggregateRating', ratingValue: rating.ratingValue, reviewCount: rating.reviewCount, bestRating:5, worstRating:1 } } : {})
      };
      const extraSchema = [breadcrumb, agentSchema]
        .map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n  ');

      const settings = readSettings();
      await serveIndex(req, res, {
        pageTitle, metaDesc, ogTitle: pageTitle, ogDesc: metaDesc, ogUrl,
        extraSchema, cityFilter: municipio, tipoFilter: tipo,
        pixelId: (settings.facebookPixelId || '').trim()
      });
    } catch (err) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
});

// ── RUTA / CON OG TAGS DINÁMICOS + SEO COMPLETO ─────────────
app.get('/', async (req, res) => {
  try {
    const propId  = req.query.id;
    const baseUrl = process.env.SITE_URL || 'https://alexariasc.com';
    const esc     = s => String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fmtP    = n => n ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n) : '';

    const settings = readSettings();
    const pixelId  = (settings.facebookPixelId || '').trim();
    const [rating, topReviews] = await Promise.all([getAggregateRating(), getTopReviews(5)]);
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');

    let pageTitle = 'Alex Arias · Consultor Inmobiliario | Apartamentos en Medellín';
    let metaDesc  = 'Portafolio inmobiliario de Alexander Arias — Arriendo y venta de apartamentos en Sabaneta, Envigado y Medellín. Asesoría inmobiliaria especializada.';
    let ogTitle   = 'Alex Arias · Consultor Inmobiliario';
    let ogDesc    = metaDesc;
    let ogImage   = `${baseUrl}/assets/logo/Logo.png`;
    let ogUrl     = baseUrl;
    let ogType    = 'website';
    let extraSchemas = '';

    // ── Schema WebSite + SearchAction ───────────────────────────
    const websiteSchema = { '@context':'https://schema.org','@type':'WebSite',name:'Alex Arias · Consultor Inmobiliario',url:baseUrl,potentialAction:{'@type':'SearchAction',target:`${baseUrl}/?q={search_term_string}`,'query-input':'required name=search_term_string'}};

    // ── Schema RealEstateAgent + AggregateRating + Reviews individuales
    const agentSchema = {
      '@context':'https://schema.org','@type':'RealEstateAgent',
      '@id': `${baseUrl}/#agent`,
      name:'Alexander Arias',url:baseUrl,telephone:'+573122588521',
      image: `${baseUrl}/assets/logo/Logo.png`,
      sameAs: [
        'https://www.instagram.com/alexariasconsul',
        'https://wa.me/573122588521'
      ],
      areaServed: ['Sabaneta','Envigado','Medellín'].map(n => ({ '@type':'City', name: n })),
      ...(rating ? { aggregateRating:{'@type':'AggregateRating',ratingValue:rating.ratingValue,reviewCount:rating.reviewCount,bestRating:5,worstRating:1} } : {}),
      ...(topReviews.length ? { review: topReviews } : {})
    };

    // ── Schema ItemList — listado de propiedades activas ─────────
    const db = getDB();
    const activeProps = await db.findAsync({ estado: { $ne: 'ocupado' } });
    const itemListSchema = {
      '@context':'https://schema.org','@type':'ItemList',
      name:'Propiedades disponibles · Alex Arias Consultor Inmobiliario',
      description:'Apartamentos en arriendo y venta en Sabaneta, Envigado y Medellín',
      numberOfItems: activeProps.length,
      itemListElement: activeProps.slice(0,12).map((p, i) => ({
        '@type':'ListItem', position: i+1,
        url: `${baseUrl}/?id=${p._id}`,
        name: p.title || 'Propiedad'
      }))
    };

    // ── Schema Service — servicios ofrecidos ─────────────────────
    const serviceSchema = {
      '@context':'https://schema.org','@type':'Service',
      name:'Asesoría Inmobiliaria en Sabaneta, Envigado y Medellín',
      description:'Servicio gratuito de asesoría para arrendar o comprar apartamentos en el Área Metropolitana de Medellín. Acompañamiento en visitas, negociación y trámites.',
      provider: { '@type':'RealEstateAgent', '@id': `${baseUrl}/#agent` },
      areaServed: ['Sabaneta','Envigado','Medellín'].map(n => ({ '@type':'City', name: n })),
      serviceType: 'Consultoría Inmobiliaria',
      offers: [
        { '@type':'Offer', name:'Asesoría en Arriendo', price:'0', priceCurrency:'COP', description:'Sin costo para el arrendatario' },
        { '@type':'Offer', name:'Asesoría en Compra',   price:'0', priceCurrency:'COP', description:'Sin costo para el comprador' }
      ]
    };

    extraSchemas = [websiteSchema, agentSchema, itemListSchema, serviceSchema]
      .map(s => `<script type="application/ld+json">${JSON.stringify(s,(k,v)=>v===undefined?undefined:v)}</script>`)
      .join('\n  ');

    // ── ?reviews=open ────────────────────────────────────────────
    if (req.query.reviews === 'open') {
      pageTitle = 'Deja tu reseña · Alex Arias Consultor Inmobiliario';
      ogTitle   = '⭐ Deja tu opinión · Alex Arias';
      metaDesc  = '¿Trabajaste con Alex Arias? Tu reseña nos ayuda a seguir mejorando y a que más familias encuentren su hogar ideal. ¡Solo toma 2 minutos!';
      ogDesc    = metaDesc;
      ogUrl     = `${baseUrl}/?reviews=open`;
    }

    // ── ?id= → propiedad específica ─────────────────────────────
    if (propId) {
      try {
        const db = getDB();
        const prop = await db.findOneAsync({ _id: propId });
        if (prop) {
          const isComb    = prop.tipo === 'combinado';
          const rawP      = isComb ? (prop.precioArriendo || prop.precio) : prop.precio;
          const precio    = fmtP(rawP);
          const tipoLabel = isComb ? 'En arriendo y venta' : prop.tipo === 'arriendo' ? 'En arriendo' : prop.tipo === 'venta' ? 'En venta' : '';
          const citySlug  = prop.municipio === 'Sabaneta' ? 'sabaneta' : prop.municipio === 'Envigado' ? 'envigado' : prop.municipio === 'Medellín' ? 'medellin' : null;

          pageTitle = `${prop.title}${prop.municipio ? ` · ${prop.municipio}` : ''} | Alex Arias Inmobiliaria`;
          const detalles = [tipoLabel, precio ? `${precio}${prop.tipo==='arriendo'?'/mes':''}` : '', prop.area?`${prop.area} m²`:'', prop.habitaciones?`${prop.habitaciones} habitaciones`:'', prop.banos?`${prop.banos} baños`:'', prop.parqueadero?'parqueadero incluido':'', prop.barrio?`en ${prop.barrio}`:'' ].filter(Boolean).join(' · ');
          const descExtra = prop.descripcion ? ` ${prop.descripcion.slice(0,80).replace(/\s+$/,'')}…` : '';
          metaDesc  = `${detalles}.${descExtra} Consulta con Alex Arias, tu asesor inmobiliario en ${prop.municipio||'Medellín'}.`;
          ogTitle   = `${prop.title} — ${prop.municipio||''}`;
          ogDesc    = metaDesc;
          ogType    = 'product';
          ogUrl     = `${baseUrl}/?id=${propId}`;
          if (prop.images?.length) ogImage = `${baseUrl}/${prop.images[0].filename}`;

          // Breadcrumb: Inicio > Ciudad > Inmueble
          const breadcrumbItems = [
            { '@type':'ListItem', position:1, name:'Inicio', item:baseUrl }
          ];
          if (citySlug && prop.municipio) breadcrumbItems.push({ '@type':'ListItem', position:2, name:prop.municipio, item:`${baseUrl}/${citySlug}` });
          breadcrumbItems.push({ '@type':'ListItem', position: breadcrumbItems.length+1, name:prop.title, item:ogUrl });
          const breadcrumb = { '@context':'https://schema.org','@type':'BreadcrumbList', itemListElement: breadcrumbItems };

          // RealEstateListing schema
          const amenidades = [];
          if (prop.parqueadero) amenidades.push({'@type':'LocationFeatureSpecification',name:'Parqueadero',value:true});
          if (prop.cuarto_util) amenidades.push({'@type':'LocationFeatureSpecification',name:'Cuarto útil',value:true});
          if (prop.estudio)     amenidades.push({'@type':'LocationFeatureSpecification',name:'Estudio',value:true});
          prop.amenidades?.forEach(a => amenidades.push({'@type':'LocationFeatureSpecification',name:a,value:true}));

          const listingSchema = {
            '@context':'https://schema.org','@type':'RealEstateListing',
            name:prop.title, description:prop.descripcion||metaDesc, url:ogUrl,
            datePosted: prop.created_at ? new Date(prop.created_at).toISOString() : undefined,
            image: prop.images?.map(img=>`${baseUrl}/${img.filename}`) || [],
            address: {'@type':'PostalAddress', streetAddress:prop.direccion||undefined, addressLocality:prop.municipio||'Medellín', addressRegion:'Antioquia', addressCountry:'CO', ...(prop.barrio?{neighborhood:prop.barrio}:{})},
            ...(prop.area          ? {floorSize:{'@type':'QuantitativeValue',value:prop.area,unitCode:'MTK'}} : {}),
            ...(prop.habitaciones  ? {numberOfRooms:prop.habitaciones} : {}),
            ...(prop.banos         ? {numberOfBathroomsTotal:prop.banos} : {}),
            ...(amenidades.length  ? {amenityFeature:amenidades} : {}),
            offers: {'@type':'Offer', priceCurrency:'COP', price:rawP||prop.precio||0, availability: prop.estado==='ocupado'?'https://schema.org/SoldOut':'https://schema.org/InStock', businessFunction: prop.tipo==='venta'?'https://schema.org/Sell':'https://schema.org/LeaseOut'},
            broker: {'@type':'RealEstateAgent', name:'Alexander Arias', url:baseUrl, telephone:'+573122588521', ...(rating?{aggregateRating:{'@type':'AggregateRating',ratingValue:rating.ratingValue,reviewCount:rating.reviewCount}}:{})}
          };

          extraSchemas += `\n  <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>\n  <script type="application/ld+json">${JSON.stringify(listingSchema,(k,v)=>v===undefined?undefined:v)}</script>`;
          if (pixelId) extraSchemas += `\n  <meta property="product:price:amount" content="${prop.precio||''}" />\n  <meta property="product:price:currency" content="COP" />`;
        }
      } catch (_) {}
    }

    const injected = `
  <meta property="og:type"         content="${esc(ogType)}" />
  <meta property="og:site_name"    content="Alex Arias · Consultor Inmobiliario" />
  <meta property="og:title"        content="${esc(ogTitle)}" />
  <meta property="og:description"  content="${esc(ogDesc)}" />
  <meta property="og:image"        content="${esc(ogImage)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type"   content="image/jpeg" />
  <meta property="og:url"          content="${esc(ogUrl)}" />
  <meta property="og:locale"       content="es_CO" />${pixelId ? `\n  <meta property="fb:app_id" content="${esc(pixelId)}" />` : ''}
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDesc)}" />
  <meta name="twitter:image"       content="${esc(ogImage)}" />
  ${extraSchemas}`;

    html = html.replace(/id="pageTitle">([^<]*)<\/title>/,                        `id="pageTitle">${esc(pageTitle)}</title>`);
    html = html.replace(/id="metaDesc" name="description" content="([^"]*)"/,    `id="metaDesc" name="description" content="${esc(metaDesc)}"`);
    html = html.replace('id="canonicalUrl" rel="canonical" href="https://alexariasc.com/"', `id="canonicalUrl" rel="canonical" href="${esc(ogUrl)}"`);
    html = html.replace('</head>', injected + '\n</head>');
    res.send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// JS y CSS: sin caché para que el browser siempre pida la versión más reciente
// ── CACHÉING OPTIMIZADO PARA VELOCIDAD ──────────────────────
// HTML: Sin caché (cambios frecuentes)
// Rutas SSR — 1 hora de caché (HTML dinámico con meta tags, schemas, etc.)
const SSR_PATHS = ['/', '/sabaneta', '/envigado', '/medellin',
  '/arriendo', '/venta',
  '/sabaneta/arriendo', '/sabaneta/venta',
  '/envigado/arriendo', '/envigado/venta',
  '/medellin/arriendo', '/medellin/venta'];
app.use((req, res, next) => {
  const p = req.path;
  if (p.endsWith('.html') || SSR_PATHS.includes(p)) {
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  }
  next();
});

// ── RUTA /post.html CON OG TAGS DINÁMICOS (SSR para bots) ────
// Debe ir ANTES de express.static para interceptar GET /post.html
app.get('/post.html', async (req, res) => {
  const slug    = req.query.slug || '';
  const baseUrl = process.env.SITE_URL || 'https://alexariasc.com';
  const postPath = path.join(__dirname, 'public', 'post.html');

  if (!slug) return res.sendFile(postPath);

  try {
    const post = await blogDB.findOneAsync({ slug, status: 'published' });
    if (!post) return res.sendFile(postPath);

    const esc = s => String(s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const ogTitle = post.seo?.metaTitle || post.metaTitle || post.title || 'Alex Arias · Blog Inmobiliario';
    const ogDesc  = post.seo?.metaDescription || post.metaDescription || post.excerpt || '';
    // Si la imagen es externa (Unsplash, etc.) los scrapers de WhatsApp/FB la bloquean.
    // Usamos proxy local /api/og-image/:slug que reenvía la imagen desde el servidor.
    const rawCover = post.cover || '';
    const ogImage  = rawCover
      ? (rawCover.startsWith('http') ? `${baseUrl}/api/og-image/${encodeURIComponent(slug)}` : `${baseUrl}/${rawCover}`)
      : `${baseUrl}/assets/logo/Logo.png`;
    const ogUrl   = `${baseUrl}/post.html?slug=${encodeURIComponent(slug)}`;

    let html = fs.readFileSync(postPath, 'utf8');

    // Rellenar título
    html = html.replace(
      '>Artículo · Alex Arias Blog<',
      `>${esc(ogTitle)}<`
    );
    // Rellenar meta description
    html = html.replace(
      'id="metaDesc" content=""',
      `id="metaDesc" content="${esc(ogDesc)}"`
    );
    // Rellenar canonical
    html = html.replace(
      'id="canonicalUrl" href="/blog"',
      `id="canonicalUrl" href="${esc(ogUrl)}"`
    );
    // Rellenar OG tags
    html = html.replace('id="ogTitle" content=""',  `id="ogTitle" content="${esc(ogTitle)}"`);
    html = html.replace('id="ogDesc" content=""',   `id="ogDesc" content="${esc(ogDesc)}"`);
    html = html.replace('id="ogImage" content=""',  `id="ogImage" content="${esc(ogImage)}"`);
    html = html.replace('id="ogUrl" content=""',    `id="ogUrl" content="${esc(ogUrl)}"`);
    // Rellenar Twitter Card tags
    html = html.replace('id="twTitle" content=""',  `id="twTitle" content="${esc(ogTitle)}"`);
    html = html.replace('id="twDesc" content=""',   `id="twDesc" content="${esc(ogDesc)}"`);
    html = html.replace('id="twImage" content=""',  `id="twImage" content="${esc(ogImage)}"`);

    // ── Schema.org BlogPosting ───────────────────────────────────
    const pubDate  = post.publishedAt ? new Date(post.publishedAt).toISOString()
                   : post.createdAt   ? new Date(post.createdAt).toISOString()
                   : new Date().toISOString();
    const modDate  = post.updatedAt   ? new Date(post.updatedAt).toISOString() : pubDate;
    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      'headline': ogTitle,
      'description': ogDesc,
      'image': ogImage,
      'url': ogUrl,
      'datePublished': pubDate,
      'dateModified': modDate,
      'inLanguage': 'es-CO',
      'author': {
        '@type': 'Person',
        'name': 'Alexander Arias',
        'url': baseUrl,
        'jobTitle': 'Consultor Inmobiliario'
      },
      'publisher': {
        '@type': 'Organization',
        'name': 'Alex Arias - Consultor Inmobiliario',
        'url': baseUrl,
        'logo': {
          '@type': 'ImageObject',
          'url': `${baseUrl}/assets/logo/Logo.png`
        }
      },
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': ogUrl
      },
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': baseUrl },
          { '@type': 'ListItem', 'position': 2, 'name': 'Blog',   'item': `${baseUrl}/blog` },
          { '@type': 'ListItem', 'position': 3, 'name': ogTitle,  'item': ogUrl }
        ]
      }
    };
    html = html.replace(
      'id="articleSchema"></script>',
      `id="articleSchema">${JSON.stringify(articleSchema)}</script>`
    );

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.sendFile(postPath);
  }
});

// Static files con caché de 7 días
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

// Assets (logo, fuentes) con caché de 30 días
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  maxAge: '30d',
  immutable: true
}));

// Uploads (propiedades) con caché de 365 días
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadsDir, { maxAge: '365d', immutable: true }));

// Endpoint para convertir WebP → JPEG al vuelo (necesario para Meta Catalog)
// URLs terminan en .jpg para que Meta acepte el formato (valida la extensión)
app.get('/api/feed/img/:filename', async (req, res) => {
  try {
    let filename = path.basename(req.params.filename); // evitar path traversal
    // Soportar URLs .jpg que mapean a archivos .webp reales
    const actualFilename = filename.replace(/\.jpg$/i, '.webp');
    const filepath = path.join(uploadsDir, actualFilename);
    if (!fs.existsSync(filepath)) return res.status(404).end();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Servir a 1200px (Meta recomienda mínimo 600px; sin agrandar si ya es grande)
    const buf = await sharp(filepath)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    res.send(buf);
  } catch (err) { res.status(500).end(); }
});

// ── GOOGLE OAUTH ──────────────────────────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'alexariasconsul@gmail.com';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails?.[0]?.value || '';
  if (email !== ADMIN_EMAIL) {
    return done(null, false, { message: 'Email no autorizado' });
  }
  return done(null, { id: profile.id, email, name: profile.displayName, photo: profile.photos?.[0]?.value });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Rutas de autenticación Google
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=unauthorized' }),
  (req, res) => res.redirect('/admin.html')
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/admin.html'));
});

app.get('/auth/status', (req, res) => {
  res.json({
    loggedIn: req.isAuthenticated(),
    user: req.user || null
  });
});

// Auth middleware — acepta sesión Google O contraseña clásica
function requireAdmin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  const pwd = req.headers['x-admin-password'] || req.body?.adminPassword || req.body?.password;
  if (pwd === ADMIN_PASSWORD) return next();
  return res.status(401).json({ error: 'No autorizado' });
}

// ─── PERFIL DEL CONSULTOR ─────────────────────────────────────
const PROFILE_PATH = path.join(__dirname, 'profile.json');

function readProfile() {
  try { return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8')); }
  catch { return {}; }
}

app.get('/api/profile', (req, res) => {
  res.json(readProfile());
});

app.put('/api/profile', requireAdmin, upload.single('avatar'), async (req, res) => {
  try {
    const current = readProfile();
    const fields = ['name','role','zone','bio','phone','phone_link','email','whatsapp','whatsapp_msg','instagram','linkedin','experience_years','license','languages'];
    const updated = { ...current };
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        // Guard against multer returning arrays when a field is submitted multiple times
        updated[f] = Array.isArray(req.body[f]) ? req.body[f][0] : req.body[f];
      }
    });
    if (req.file) {
      const filename = await saveOptimizedImage(req.file.buffer);
      updated.avatar = `uploads/${filename}`;
      // Eliminar avatar anterior si era un upload local
      if (current.avatar?.startsWith('uploads/')) {
        const oldPath = path.join(__dirname, current.avatar);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(updated, null, 2));
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── STATS GLOBALES ───────────────────────────────────────────
app.get('/api/stats', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const props = await db.findAsync({});
    const posts = await blogDB.findAsync({});
    const totalViews = props.reduce((s, p) => s + (p.views || 0), 0)
                     + posts.reduce((s, p) => s + (p.views || 0), 0);
    const totalLikes = props.reduce((s, p) => s + (p.likes || 0), 0)
                     + posts.reduce((s, p) => s + (p.likes || 0), 0);
    const propsByType = props.reduce((acc, p) => {
      acc[p.tipo] = (acc[p.tipo] || 0) + 1; return acc;
    }, {});
    const propsByStatus = props.reduce((acc, p) => {
      acc[p.estado] = (acc[p.estado] || 0) + 1; return acc;
    }, {});
    const topProps = [...props].sort((a,b) => (b.views||0)-(a.views||0)).slice(0,5).map(p => ({
      id: p._id, title: p.title, views: p.views||0, likes: p.likes||0, tipo: p.tipo, estado: p.estado
    }));
    const topPosts = [...posts].sort((a,b) => (b.views||0)-(a.views||0)).slice(0,5).map(p => ({
      slug: p.slug, title: p.title, views: p.views||0, likes: p.likes||0, status: p.status
    }));
    const recentProps = [...props].sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).slice(0,5).map(p => ({
      id: p._id, title: p.title, created_at: p.created_at, tipo: p.tipo, precio: p.precio
    }));
    const recentPosts = [...posts].sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).slice(0,5).map(p => ({
      slug: p.slug, title: p.title, created_at: p.created_at, status: p.status
    }));
    res.json({
      totals: {
        properties: props.length,
        posts: posts.length,
        publishedPosts: posts.filter(p => p.status === 'published').length,
        views: totalViews,
        likes: totalLikes
      },
      propsByType,
      propsByStatus,
      topProps,
      topPosts,
      recentProps,
      recentPosts
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── LOGGING DE BÚSQUEDAS ─────────────────────────────────────
app.post('/api/searches/log', async (req, res) => {
  try {
    const { filters, resultsCount } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await searchesDB.insertAsync({
      ip,
      userAgent,
      filters: filters || {},
      resultsCount: resultsCount || 0,
      ts: new Date()
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error logging search:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── LOGGING DE LEADS ──────────────────────────────────────────
app.post('/api/leads/log', async (req, res) => {
  try {
    const { propId, propTitle, propPrice, contactChannel, source } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

    await leadsDB.insertAsync({
      propId: propId || '',
      propTitle: propTitle || '',
      propPrice: propPrice || 0,
      ip,
      contactChannel: contactChannel || 'unknown',
      source: source || 'unknown',
      ts: new Date()
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error logging lead:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── ESTADÍSTICAS DE BÚSQUEDAS ────────────────────────────────
app.get('/api/stats/searches', requireAdmin, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const searches = await searchesDB.findAsync({ ts: { $gte: dateThreshold } });

    // Estadísticas por municipio
    const municipios = {};
    searches.forEach(s => {
      const m = s.filters?.municipio || 'sin filtro';
      municipios[m] = (municipios[m] || 0) + 1;
    });

    // Estadísticas por barrio
    const barrios = {};
    searches.forEach(s => {
      const b = s.filters?.barrio || 'sin filtro';
      barrios[b] = (barrios[b] || 0) + 1;
    });

    // Estadísticas por tipo
    const tipos = {};
    searches.forEach(s => {
      const t = s.filters?.tipo || 'todos';
      tipos[t] = (tipos[t] || 0) + 1;
    });

    // Búsquedas por día
    const searchesByDay = {};
    searches.forEach(s => {
      const day = s.ts.toISOString().split('T')[0];
      searchesByDay[day] = (searchesByDay[day] || 0) + 1;
    });

    res.json({
      total: searches.length,
      byMunicipio: Object.entries(municipios).sort((a,b) => b[1]-a[1]).slice(0,10),
      byBarrio: Object.entries(barrios).sort((a,b) => b[1]-a[1]).slice(0,10),
      byTipo: tipos,
      byDay: Object.entries(searchesByDay).sort(),
      recent: searches.slice(-20).reverse()
    });
  } catch (err) {
    console.error('Error getting search stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── ESTADÍSTICAS DE LEADS ────────────────────────────────────
app.get('/api/stats/leads', requireAdmin, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const leads = await leadsDB.findAsync({ ts: { $gte: dateThreshold } });

    // Estadísticas por canal
    const byChannel = {};
    leads.forEach(l => {
      const c = l.contactChannel || 'unknown';
      byChannel[c] = (byChannel[c] || 0) + 1;
    });

    // Estadísticas por source
    const bySource = {};
    leads.forEach(l => {
      const s = l.source || 'unknown';
      bySource[s] = (bySource[s] || 0) + 1;
    });

    // Leads por día
    const leadsByDay = {};
    leads.forEach(l => {
      const day = l.ts.toISOString().split('T')[0];
      leadsByDay[day] = (leadsByDay[day] || 0) + 1;
    });

    res.json({
      total: leads.length,
      byChannel,
      bySource,
      byDay: Object.entries(leadsByDay).sort(),
      recent: leads.slice(-50).reverse()
    });
  } catch (err) {
    console.error('Error getting lead stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── ESTADÍSTICAS DE CONVERSIÓN ────────────────────────────────
app.get('/api/stats/conversion', requireAdmin, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const searches = await searchesDB.findAsync({ ts: { $gte: dateThreshold } });
    const leads = await leadsDB.findAsync({ ts: { $gte: dateThreshold } });
    const views = await viewsDB.findAsync({ ts: { $gte: dateThreshold } });

    const totalSearches = searches.length;
    const totalViews = views.length;
    const totalLeads = leads.length;

    res.json({
      totalSearches,
      totalViews,
      totalLeads,
      conversionSearchToView: totalSearches > 0 ? ((totalViews / totalSearches) * 100).toFixed(2) + '%' : '0%',
      conversionViewToLead: totalViews > 0 ? ((totalLeads / totalViews) * 100).toFixed(2) + '%' : '0%',
      conversionSearchToLead: totalSearches > 0 ? ((totalLeads / totalSearches) * 100).toFixed(2) + '%' : '0%'
    });
  } catch (err) {
    console.error('Error getting conversion stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── RUTAS DE PÁGINAS ────────────────────────────────────────
app.get('/privacidad', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacidad.html')));
app.get('/blog', (req, res) => res.sendFile(path.join(__dirname, 'public', 'blog.html')));
app.get('/blog/:slug', (req, res) => res.redirect(`/post.html?slug=${req.params.slug}`));
app.get('/admin-blog', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-blog.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ─── VERIFICAR CONTRASEÑA ─────────────────────────────────────
app.post('/api/verify-password', (req, res) => {
  const { password } = req.body;
  password === ADMIN_PASSWORD
    ? res.json({ ok: true })
    : res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
});

// ─── LISTAR PROPIEDADES ───────────────────────────────────────
app.get('/api/properties', async (req, res) => {
  try {
    const db = getDB();
    const { tipo, municipio, barrio, search, minPrecio, maxPrecio, minHab, minBanos, parqueadero, amenidades, estado, orderBy } = req.query;

    const query = {};
    if (tipo && tipo !== 'todos') query.tipo = { $in: [tipo, 'combinado'] };
    if (estado && estado !== '') query.estado = estado;
    if (municipio) query.municipio = new RegExp(municipio, 'i');
    if (barrio) query.barrio = new RegExp(barrio, 'i');
    if (search) {
      const re = new RegExp(search, 'i');
      query.$or = [{ title: re }, { barrio: re }, { municipio: re }, { descripcion: re }, { direccion: re }];
    }
    if (minPrecio || maxPrecio) {
      query.precio = {};
      if (minPrecio) query.precio.$gte = Number(minPrecio);
      if (maxPrecio) query.precio.$lte = Number(maxPrecio);
    }
    if (minHab) query.habitaciones = { $gte: Number(minHab) };
    if (minBanos) query.banos = { $gte: Number(minBanos) };
    if (parqueadero === '1') query.parqueadero = 1;

    let docs = await db.findAsync(query);
    // Filtro amenidades (post-query, NeDB no soporta $all en arrays)
    if (amenidades) {
      const required = amenidades.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
      if (required.length) {
        docs = docs.filter(d => {
          const dAmen = (Array.isArray(d.amenidades) ? d.amenidades : []).map(a => a.toLowerCase());
          return required.every(r => dAmen.some(a => a.includes(r)));
        });
      }
    }

    // Sorting logic basado en orderBy
    const sortFns = {
      'vistas-desc': (a, b) => (b.views || 0) - (a.views || 0),
      'vistas-asc': (a, b) => (a.views || 0) - (b.views || 0),
      'likes-desc': (a, b) => (b.likes || 0) - (a.likes || 0),
      'likes-asc': (a, b) => (a.likes || 0) - (b.likes || 0),
      'precio-asc': (a, b) => (a.precio || 0) - (b.precio || 0),
      'precio-desc': (a, b) => (b.precio || 0) - (a.precio || 0),
      'fecha-desc': (a, b) => (new Date(b.created_at)||0) - (new Date(a.created_at)||0),
      'fecha-asc': (a, b) => (new Date(a.created_at)||0) - (new Date(b.created_at)||0),
    };

    const sortFn = sortFns[orderBy] || sortFns['fecha-desc'];
    docs.sort(sortFn);

    res.json(mapDocs(docs));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── OBTENER UNA PROPIEDAD ────────────────────────────────────
app.get('/api/properties/:id', async (req, res) => {
  try {
    const db = getDB();
    const doc = await db.findOneAsync({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(mapDoc(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SITEMAP.XML (SEO) ────────────────────────────────────────
app.get('/sitemap.xml', async (req, res) => {
  try {
    const db   = getDB();
    const docs = await db.findAsync({});
    const posts = await blogDB.findAsync({ status: 'published' });
    const today = new Date().toISOString().split('T')[0];

    const getDate = doc => {
      for (const f of ['updated_at', 'created_at']) {
        if (doc[f]) { const d = new Date(doc[f]); if (!isNaN(d)) return d.toISOString().split('T')[0]; }
      }
      return today;
    };

    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    // Home
    xml += `  <url>\n    <loc>https://alexariasc.com/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    // Blog listing
    xml += `  <url>\n    <loc>https://alexariasc.com/blog</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;

    // Páginas de ciudad
    ['sabaneta','envigado','medellin'].forEach(slug => {
      xml += `  <url>\n    <loc>https://alexariasc.com/${slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n  </url>\n`;
    });

    // Páginas de tipo
    ['arriendo','venta'].forEach(tipo => {
      xml += `  <url>\n    <loc>https://alexariasc.com/${tipo}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n  </url>\n`;
    });

    // Páginas tipo+ciudad
    [['sabaneta','arriendo'],['sabaneta','venta'],['envigado','arriendo'],['envigado','venta'],['medellin','arriendo'],['medellin','venta']].forEach(([slug,tipo]) => {
      xml += `  <url>\n    <loc>https://alexariasc.com/${slug}/${tipo}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
    });

    // Propiedades — con image sitemap
    docs.forEach(doc => {
      xml += `  <url>\n    <loc>https://alexariasc.com/?id=${doc._id}</loc>\n    <lastmod>${getDate(doc)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n`;
      if (Array.isArray(doc.images) && doc.images.length) {
        const titleEsc = esc(`${doc.title||'Propiedad'}${doc.municipio ? ` en ${doc.municipio}` : ''}`);
        const captEsc  = esc(`${doc.tipo === 'arriendo' ? 'En arriendo' : doc.tipo === 'venta' ? 'En venta' : 'Inmueble'} — ${doc.title||''} · Alex Arias`);
        doc.images.slice(0,5).forEach(img => {
          if (!img.filename) return;
          xml += `    <image:image>\n      <image:loc>https://alexariasc.com/${img.filename}</image:loc>\n      <image:title>${titleEsc}</image:title>\n      <image:caption>${captEsc}</image:caption>\n    </image:image>\n`;
        });
      }
      xml += `  </url>\n`;
    });

    // Artículos del blog publicados
    posts.forEach(post => {
      xml += `  <url>\n    <loc>https://alexariasc.com/post.html?slug=${encodeURIComponent(post.slug)}</loc>\n    <lastmod>${getDate(post)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    });

    xml += '</urlset>';
    res.type('application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Error generating sitemap:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── LLMS.TXT — Guía para IAs (ChatGPT, Gemini, Claude) ─────
app.get('/llms.txt', async (req, res) => {
  try {
    const db    = getDB();
    const docs  = await db.findAsync({ estado: { $ne: 'ocupado' } });
    const posts = await blogDB.findAsync({ status: 'published' });
    const base  = process.env.SITE_URL || 'https://alexariasc.com';

    const fmtP = n => n
      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
      : '';

    let txt = `# Alex Arias · Consultor Inmobiliario

> Alexander Arias es un consultor inmobiliario certificado especializado en arriendo y venta de apartamentos en Sabaneta, Envigado y Medellín, Colombia. Ofrece asesoría personalizada, acompañamiento jurídico y gestión completa del proceso inmobiliario.

Sitio web: ${base}
Contacto WhatsApp: +57 312 2588521
Email: alexariasconsul@gmail.com
Zona de servicio: Sabaneta · Envigado · Medellín (Área Metropolitana)

---

## Inmuebles disponibles (${docs.length} propiedades)

`;

    docs.forEach(p => {
      const isComb  = p.tipo === 'combinado';
      const rawP    = isComb ? (p.precioArriendo || p.precio) : p.precio;
      const precio  = fmtP(rawP);
      const tipo    = isComb ? 'Arriendo y Venta' : p.tipo === 'arriendo' ? 'En arriendo' : 'En venta';
      const detalles = [
        tipo,
        precio ? `${precio}${p.tipo === 'arriendo' ? '/mes' : ''}` : '',
        p.area          ? `${p.area} m²`           : '',
        p.habitaciones  ? `${p.habitaciones} hab`  : '',
        p.banos         ? `${p.banos} baños`        : '',
        p.parqueadero   ? 'Parqueadero'             : '',
        p.cuarto_util   ? 'Cuarto útil'             : '',
      ].filter(Boolean).join(' · ');

      txt += `- [${p.title}](${base}/?id=${p._id}): ${detalles}`;
      if (p.barrio || p.municipio) txt += ` — ${[p.barrio, p.municipio].filter(Boolean).join(', ')}`;
      txt += '\n';
    });

    txt += `
---

## Servicios

- Arriendo de apartamentos en Sabaneta, Envigado y Medellín
- Venta de apartamentos y propiedades residenciales
- Asesoría inmobiliaria personalizada sin costo para el comprador/arrendatario
- Acompañamiento en visitas, negociación y trámites legales
- Gestión de contratos de arrendamiento
- Inversión inmobiliaria en el Área Metropolitana de Medellín

---

## Preguntas frecuentes

**¿Cuánto cuesta el servicio de asesoría?**
Para arrendatarios y compradores el servicio es completamente gratuito. Alex Arias cobra únicamente al propietario del inmueble.

**¿En qué zonas trabaja Alex Arias?**
Principalmente en Sabaneta, Envigado y el sur de Medellín, aunque atiende consultas de todo el Área Metropolitana.

**¿Cómo puedo agendar una visita?**
Contacta directamente por WhatsApp al +57 312 2588521 o a través del sitio web ${base}.

**¿Cuál es el precio promedio de arriendo en Sabaneta?**
Los apartamentos en Sabaneta oscilan entre $2.000.000 y $4.500.000 COP mensuales dependiendo del tamaño, piso y conjunto.

**¿Qué documentos se necesitan para arrendar?**
Generalmente: cédula de ciudadanía, certificado laboral o declaración de renta, referencias personales y codeudor si se requiere.

---

## Blog — Artículos sobre el mercado inmobiliario
`;

    posts.forEach(post => {
      txt += `- [${post.title}](${base}/post.html?slug=${encodeURIComponent(post.slug)})\n`;
    });

    txt += `
---

## Información de contacto

- **WhatsApp**: +57 312 2588521
- **Email**: alexariasconsul@gmail.com
- **Sitio web**: ${base}
- **Instagram**: @alexariasconsul
- **Ubicación**: Sabaneta, Antioquia, Colombia
`;

    res.type('text/plain; charset=utf-8');
    res.send(txt);
  } catch (err) {
    res.status(500).send('Error generando llms.txt');
  }
});

// ─── CREAR PROPIEDAD ──────────────────────────────────────────
app.post('/api/properties', requireAdmin, upload.array('images', 15), async (req, res) => {
  try {
    const db = getDB();
    const {
      title, tipo, municipio, barrio, sector, direccion, piso,
      precio, precioArriendo, precioVenta,
      area, habitaciones, banos, parqueadero, cuarto_util, estudio,
      descripcion, amenidades, estado, lat, lng
    } = req.body;

    const amenArr = (() => {
      try { return JSON.parse(amenidades); }
      catch { return amenidades ? amenidades.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : []; }
    })();

    const files = req.files || [];
    const imageFilenames = await Promise.all(files.map(f => saveOptimizedImage(f.buffer)));
    const images = imageFilenames.map((filename, i) => ({
      id: genId(),
      filename: `uploads/${filename}`,
      order_index: i
    }));

    const doc = await db.insertAsync({
      title: title || 'Sin título',
      tipo: tipo || 'arriendo',
      municipio: municipio || '', barrio: barrio || '',
      sector: sector || '', direccion: direccion || '', piso: piso || '',
      precio: Number(precio) || 0, area: Number(area) || 0,
      precioArriendo: Number(precioArriendo) || 0,
      precioVenta: Number(precioVenta) || 0,
      habitaciones: Number(habitaciones) || 0, banos: Number(banos) || 0,
      parqueadero: parqueadero === '1' || parqueadero === true ? 1 : 0,
      cuarto_util: cuarto_util === '1' || cuarto_util === true ? 1 : 0,
      estudio: estudio === '1' || estudio === true ? 1 : 0,
      descripcion: descripcion || '',
      amenidades: amenArr,
      estado: estado || 'libre',
      lat: Number(lat) || 6.15, lng: Number(lng) || -75.62,
      likes: 0,
      images,
      created_at: new Date().toISOString()
    });

    const result = mapDoc(doc);
    io.emit('new-property', result);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── ACTUALIZAR PROPIEDAD ─────────────────────────────────────
app.put('/api/properties/:id', requireAdmin, upload.array('images', 15), async (req, res) => {
  try {
    const db = getDB();
    const {
      title, tipo, municipio, barrio, sector, direccion, piso,
      precio, precioArriendo, precioVenta,
      area, habitaciones, banos, parqueadero, cuarto_util, estudio,
      descripcion, amenidades, estado, lat, lng
    } = req.body;

    const amenArr = (() => {
      try { return JSON.parse(amenidades); }
      catch { return amenidades ? amenidades.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : []; }
    })();

    // Get existing images
    const existing = await db.findOneAsync({ _id: req.params.id });
    const currentImages = existing?.images || [];

    const newFiles = req.files || [];
    const newFilenames = await Promise.all(newFiles.map(f => saveOptimizedImage(f.buffer)));
    const newImages = newFilenames.map((filename, i) => ({
      id: genId(),
      filename: `uploads/${filename}`,
      order_index: currentImages.length + i
    }));

    const allImages = [...currentImages, ...newImages];

    // Construir el update solo con los campos enviados (evitar sobreescribir con undefined)
    const updateFields = {};
    if (title     !== undefined) updateFields.title     = title;
    if (tipo      !== undefined) updateFields.tipo      = tipo;
    if (municipio !== undefined) updateFields.municipio = municipio;
    if (barrio    !== undefined) updateFields.barrio    = barrio;
    if (sector    !== undefined) updateFields.sector    = sector;
    if (direccion !== undefined) updateFields.direccion = direccion;
    if (piso      !== undefined) updateFields.piso      = piso;
    if (precio    !== undefined) updateFields.precio    = Number(precio);
    if (precioArriendo !== undefined) updateFields.precioArriendo = Number(precioArriendo);
    if (precioVenta    !== undefined) updateFields.precioVenta    = Number(precioVenta);
    if (area      !== undefined) updateFields.area      = Number(area);
    if (habitaciones !== undefined) updateFields.habitaciones = Number(habitaciones);
    if (banos     !== undefined) updateFields.banos     = Number(banos);
    if (parqueadero !== undefined) updateFields.parqueadero = (parqueadero === '1' || parqueadero === true || parqueadero === 'true') ? 1 : 0;
    if (cuarto_util !== undefined) updateFields.cuarto_util = (cuarto_util === '1' || cuarto_util === true || cuarto_util === 'true') ? 1 : 0;
    if (estudio   !== undefined) updateFields.estudio   = (estudio === '1' || estudio === true || estudio === 'true') ? 1 : 0;
    if (descripcion !== undefined) updateFields.descripcion = descripcion;
    if (amenidades !== undefined) updateFields.amenidades = amenArr;
    if (estado    !== undefined) updateFields.estado    = estado;
    if (lat       !== undefined) updateFields.lat       = Number(lat);
    if (lng       !== undefined) updateFields.lng       = Number(lng);

    await db.updateAsync({ _id: req.params.id }, {
      $set: {
        ...updateFields,
        images: allImages
      }
    });

    const updated = mapDoc(await db.findOneAsync({ _id: req.params.id }));
    io.emit('property-updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ELIMINAR PROPIEDAD ───────────────────────────────────────
app.delete('/api/properties/:id', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const doc = await db.findOneAsync({ _id: req.params.id });
    if (doc?.images) {
      doc.images.forEach(img => {
        if (img.filename?.startsWith('uploads/')) {
          const fp = path.join(__dirname, img.filename);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
      });
    }
    await db.removeAsync({ _id: req.params.id });
    io.emit('property-deleted', { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TOGGLE LIKE ──────────────────────────────────────────────
app.post('/api/properties/:id/like', async (req, res) => {
  try {
    const db = getDB();
    const { action } = req.body;
    const doc = await db.findOneAsync({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    const newLikes = Math.max(0, (doc.likes || 0) + (action === 'remove' ? -1 : 1));
    await db.updateAsync({ _id: req.params.id }, { $set: { likes: newLikes } });
    io.emit('likes-update', { id: req.params.id, likes: newLikes });
    res.json({ likes: newLikes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REGISTRAR VISTA ─────────────────────────────────────────
app.post('/api/properties/:id/view', async (req, res) => {
  try {
    const db = getDB();
    const propId = req.params.id;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - TWENTY_FOUR_H);

    // Verificar si ya contó esta IP en las últimas 24h
    const existing = await viewsDB.findOneAsync({ propId, ip, ts: { $gt: cutoff } });
    if (existing) {
      // Ya contada — devolver el count actual sin modificar
      const doc = await db.findOneAsync({ _id: propId });
      return res.json({ views: doc?.views || 0, counted: false });
    }

    // Registrar nueva vista
    await viewsDB.insertAsync({ propId, ip, ts: new Date() });

    // Incrementar contador en la propiedad
    const doc = await db.findOneAsync({ _id: propId });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    const newViews = (doc.views || 0) + 1;
    await db.updateAsync({ _id: propId }, { $set: { views: newViews } });

    // Limpiar registros viejos de vez en cuando (no bloquear)
    viewsDB.removeAsync({ ts: { $lt: cutoff } }, { multi: true }).catch(() => {});

    io.emit('views-update', { id: propId, views: newViews });
    res.json({ views: newViews, counted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── CAMBIAR ESTADO ───────────────────────────────────────────
app.patch('/api/properties/:id/estado', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { estado } = req.body;
    await db.updateAsync({ _id: req.params.id }, { $set: { estado } });
    io.emit('property-updated', { id: req.params.id, estado });
    res.json({ ok: true, estado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ACTUALIZAR COORDENADAS ───────────────────────────────────
app.patch('/api/properties/:id/coordinates', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { lat, lng } = req.body;
    await db.updateAsync({ _id: req.params.id }, { $set: { lat: Number(lat), lng: Number(lng) } });
    io.emit('coordinates-updated', { id: req.params.id, lat: Number(lat), lng: Number(lng) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ELIMINAR IMAGEN ──────────────────────────────────────────
app.delete('/api/properties/:id/images/:imgId', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const doc = await db.findOneAsync({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });

    const img = doc.images?.find(i => i.id === req.params.imgId);
    if (img?.filename?.startsWith('uploads/')) {
      const fp = path.join(__dirname, img.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }

    const updatedImages = (doc.images || []).filter(i => i.id !== req.params.imgId);
    await db.updateAsync({ _id: req.params.id }, { $set: { images: updatedImages } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FILTROS DISPONIBLES ──────────────────────────────────────
app.get('/api/filters', async (req, res) => {
  try {
    const db = getDB();
    const all = await db.findAsync({});
    const municipios = [...new Set(all.map(p => p.municipio?.trim()).filter(Boolean))].sort();
    const barrios    = [...new Set(all.map(p => p.barrio?.trim()).filter(Boolean))].sort();
    res.json({ municipios, barrios });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HELPERS BLOG ────────────────────────────────────────────
function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

function readTime(content) {
  const words = (content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ─── OG IMAGE PROXY (evita bloqueo de Unsplash/externas en WhatsApp/FB) ──
app.get('/api/og-image/:slug', async (req, res) => {
  try {
    const post = await blogDB.findOneAsync({ slug: req.params.slug });
    if (!post?.cover?.startsWith('http')) return res.status(404).end();
    const upstream = await fetch(post.cover, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; alexariasc-bot/1.0)' }
    });
    if (!upstream.ok) return res.status(502).end();
    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', ct);
    res.set('Cache-Control', 'public, max-age=86400');
    const buf = await upstream.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch { res.status(500).end(); }
});

// ─── BLOG: LISTAR POSTS ──────────────────────────────────────
app.get('/api/blog', async (req, res) => {
  try {
    const { status, category, search, limit, offset } = req.query;
    const isAdmin = req.headers['x-admin-password'] === ADMIN_PASSWORD;
    const query = {};
    if (status === 'all' && isAdmin) { /* sin filtro de status */ }
    else if (status && status !== 'all') query.status = status;
    else query.status = 'published';
    if (category) query.category = category;
    if (search) {
      const re = new RegExp(search, 'i');
      query.$or = [{ title: re }, { excerpt: re }, { content: re }, { tags: re }];
    }
    let docs = await blogDB.findAsync(query);
    docs.sort((a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at));
    const total = docs.length;
    const skip = Number(offset) || 0;
    const take = Number(limit) || 20;
    docs = docs.slice(skip, skip + take);
    res.json({ posts: docs.map(d => { const { _id, ...r } = d; return { id: _id, ...r }; }), total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BLOG: OBTENER CATEGORÍAS ─────────────────────────────────
app.get('/api/blog/categories', async (req, res) => {
  try {
    const docs = await blogDB.findAsync({ status: 'published' });
    const cats = [...new Set(docs.map(d => d.category).filter(Boolean))].sort();
    res.json(cats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BLOG: OBTENER POST POR SLUG ──────────────────────────────
app.get('/api/blog/:slug', async (req, res) => {
  try {
    const doc = await blogDB.findOneAsync({ slug: req.params.slug });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    const { _id, ...rest } = doc;
    res.json({ id: _id, ...rest });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BLOG: CREAR POST ─────────────────────────────────────────
app.post('/api/blog', requireAdmin, upload.single('cover'), async (req, res) => {
  try {
    const { title, excerpt, content, category, tags, status, metaTitle, metaDescription, metaKeywords } = req.body;
    let slug = slugify(title || 'sin-titulo');
    // Verificar unicidad del slug
    const existing = await blogDB.findOneAsync({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;

    const cover = req.file ? `uploads/${await saveOptimizedImage(req.file.buffer)}` : (req.body.cover || '');
    const tagsArr = (() => {
      try { return JSON.parse(tags); }
      catch { return tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : []; }
    })();

    const now = new Date().toISOString();
    const doc = await blogDB.insertAsync({
      title: title || 'Sin título',
      slug,
      excerpt: excerpt || '',
      content: content || '',
      cover,
      category: category || 'General',
      tags: tagsArr,
      status: status || 'draft',
      readTime: readTime(content),
      author: 'Alex Arias',
      seo: { metaTitle: metaTitle || title || '', metaDescription: metaDescription || excerpt || '', metaKeywords: metaKeywords || '' },
      views: 0,
      likes: 0,
      created_at: now,
      updated_at: now,
      published_at: (status === 'published') ? now : null
    });
    const { _id, ...rest } = doc;
    io.emit('blog-new', { id: _id, ...rest });
    res.status(201).json({ id: _id, ...rest });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── BLOG: ACTUALIZAR POST ────────────────────────────────────
app.put('/api/blog/:slug', requireAdmin, upload.single('cover'), async (req, res) => {
  try {
    const { title, excerpt, content, category, tags, status, metaTitle, metaDescription, metaKeywords } = req.body;
    const existing = await blogDB.findOneAsync({ slug: req.params.slug });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });

    const tagsArr = (() => {
      try { return JSON.parse(tags); }
      catch { return tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : []; }
    })();

    const cover = req.file ? `uploads/${await saveOptimizedImage(req.file.buffer)}` : (req.body.cover || existing.cover || '');
    const wasPublished = existing.status === 'published';
    const nowPublishing = status === 'published' && !wasPublished;

    const update = {
      title: title || existing.title,
      excerpt: excerpt !== undefined ? excerpt : existing.excerpt,
      content: content !== undefined ? content : existing.content,
      cover,
      category: category || existing.category,
      tags: tags !== undefined ? tagsArr : existing.tags,
      status: status || existing.status,
      readTime: readTime(content || existing.content),
      seo: {
        metaTitle: metaTitle || title || existing.seo?.metaTitle || '',
        metaDescription: metaDescription || excerpt || existing.seo?.metaDescription || '',
        metaKeywords: metaKeywords || existing.seo?.metaKeywords || ''
      },
      updated_at: new Date().toISOString(),
      published_at: nowPublishing ? new Date().toISOString() : (existing.published_at || null)
    };

    await blogDB.updateAsync({ slug: req.params.slug }, { $set: update });
    const updated = await blogDB.findOneAsync({ slug: req.params.slug });
    const { _id, ...rest } = updated;
    io.emit('blog-updated', { id: _id, ...rest });
    res.json({ id: _id, ...rest });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BLOG: ELIMINAR POST ──────────────────────────────────────
app.delete('/api/blog/:slug', requireAdmin, async (req, res) => {
  try {
    const doc = await blogDB.findOneAsync({ slug: req.params.slug });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    if (doc.cover?.startsWith('uploads/')) {
      const fp = path.join(__dirname, doc.cover);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await blogDB.removeAsync({ slug: req.params.slug });
    io.emit('blog-deleted', { slug: req.params.slug });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BLOG: REGISTRAR VISTA ───────────────────────────────────
app.post('/api/blog/:slug/view', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const seen = await viewsDB.findOneAsync({ propId: `blog:${req.params.slug}`, ip, ts: { $gt: cutoff } });
    const doc = await blogDB.findOneAsync({ slug: req.params.slug });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    if (seen) return res.json({ views: doc.views || 0, counted: false });
    await viewsDB.insertAsync({ propId: `blog:${req.params.slug}`, ip, ts: new Date() });
    const newViews = (doc.views || 0) + 1;
    await blogDB.updateAsync({ slug: req.params.slug }, { $set: { views: newViews } });
    res.json({ views: newViews, counted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BLOG: LIKE ──────────────────────────────────────────────
app.post('/api/blog/:slug/like', async (req, res) => {
  try {
    const { action } = req.body;
    const doc = await blogDB.findOneAsync({ slug: req.params.slug });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    const newLikes = Math.max(0, (doc.likes || 0) + (action === 'remove' ? -1 : 1));
    await blogDB.updateAsync({ slug: req.params.slug }, { $set: { likes: newLikes } });
    res.json({ likes: newLikes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── INTEGRACIONES: SETTINGS & API KEYS ──────────────────────
const SETTINGS_PATH = path.join(__dirname, 'integrations.json');
const APIKEYS_PATH  = path.join(__dirname, 'api_keys.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); }
  catch {
    return {
      webhookUrl: '', webhookEvents: ['new_lead'],
      facebookPixelId: '', gtmId: '', customHeadCode: '',
      anthropicApiKey: '', chatEnabled: false,
      chatGreeting: 'Hola 👋 ¿En qué puedo ayudarte? Soy el asistente de Alex Arias.',
      chatSystemPrompt: '',
      googleClientId: ''
    };
  }
}
function writeSettings(data) { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2)); }

function readApiKeys() {
  try { return JSON.parse(fs.readFileSync(APIKEYS_PATH, 'utf8')); }
  catch { return []; }
}
function writeApiKeys(keys) { fs.writeFileSync(APIKEYS_PATH, JSON.stringify(keys, null, 2)); }

function genApiKey() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = 'sk_live_';
  for (let i = 0; i < 32; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) return res.status(401).json({ error: 'API key requerida' });
  const keys = readApiKeys();
  const found = keys.find(k => k.key === key);
  if (!found) return res.status(403).json({ error: 'API key inválida' });
  found.lastUsed = new Date().toISOString();
  writeApiKeys(keys);
  next();
}

async function sendWebhook(event, data) {
  try {
    const settings = readSettings();
    if (!settings.webhookUrl || !(settings.webhookEvents || []).includes(event)) return;
    const url = new URL(settings.webhookUrl);
    const body = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    const mod = url.protocol === 'https:' ? require('https') : require('http');
    await new Promise((resolve) => {
      const opts = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Webhook-Source': 'alexarias-inmobiliario'
        }
      };
      const r = mod.request(opts, res2 => { res2.resume(); res2.on('end', resolve); });
      r.on('error', resolve);
      r.write(body); r.end();
    });
  } catch (_) {}
}

// Settings
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const s = readSettings();
  res.json({ ...s, anthropicApiKey: s.anthropicApiKey ? '••••' + s.anthropicApiKey.slice(-4) : '' });
});

// Public config for frontend
app.get('/api/config', (req, res) => {
  const s = readSettings();
  res.json({ googleClientId: s.googleClientId || '' });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const current = readSettings();
    const updated = { ...current };
    ['webhookUrl', 'webhookEvents', 'chatEnabled', 'chatGreeting', 'chatSystemPrompt', 'facebookPixelId', 'gtmId', 'customHeadCode', 'googleClientId'].forEach(f => {
      if (req.body[f] !== undefined) updated[f] = req.body[f];
    });
    if (req.body.anthropicApiKey && !req.body.anthropicApiKey.includes('•')) {
      updated.anthropicApiKey = req.body.anthropicApiKey;
    }
    writeSettings(updated);
    res.json({ ok: true, settings: { ...updated, anthropicApiKey: updated.anthropicApiKey ? '••••' + updated.anthropicApiKey.slice(-4) : '' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// API Keys
app.get('/api/admin/api-keys', requireAdmin, (req, res) => {
  res.json(readApiKeys().map(k => ({ ...k, key: k.key.slice(0, 9) + '••••••••' + k.key.slice(-4) })));
});

app.post('/api/admin/api-keys', requireAdmin, (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const keys = readApiKeys();
    const newKey = { id: genId(), name: name.trim(), key: genApiKey(), created: new Date().toISOString(), lastUsed: null };
    keys.push(newKey);
    writeApiKeys(keys);
    res.status(201).json(newKey); // full key shown once
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/api-keys/:id', requireAdmin, (req, res) => {
  try {
    writeApiKeys(readApiKeys().filter(k => k.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/webhook-test', requireAdmin, async (req, res) => {
  const s = readSettings();
  if (!s.webhookUrl) return res.status(400).json({ error: 'Sin webhook URL configurada' });
  await sendWebhook('test', { message: 'Webhook de prueba desde Alex Arias Inmobiliario' });
  res.json({ ok: true });
});

// ─── API PÚBLICA v1 ───────────────────────────────────────────
app.get('/api/v1/properties', requireApiKey, async (req, res) => {
  try {
    const db = getDB();
    const docs = await db.findAsync({});
    docs.sort((a, b) => (new Date(b.created_at) || 0) - (new Date(a.created_at) || 0));
    res.json({ ok: true, count: docs.length, properties: mapDocs(docs) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/v1/properties/:id', requireApiKey, async (req, res) => {
  try {
    const db = getDB();
    const doc = await db.findOneAsync({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true, property: mapDoc(doc) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CHAT IA ─────────────────────────────────────────────────
app.get('/api/chat/config', (req, res) => {
  const s = readSettings();
  res.json({ enabled: !!(s.chatEnabled && s.anthropicApiKey), greeting: s.chatGreeting || 'Hola 👋 ¿En qué puedo ayudarte?' });
});

app.post('/api/chat', async (req, res) => {
  const s = readSettings();
  if (!s.chatEnabled) return res.status(403).json({ error: 'Chat no habilitado' });
  if (!s.anthropicApiKey) return res.status(503).json({ error: 'API key no configurada' });
  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Mensajes requeridos' });
  try {
    const profile = readProfile();
    const db = getDB();
    const props = await db.findAsync({});
    const propsSummary = props.slice(0, 20).map(p =>
      `- ${p.title} | ${p.tipo} | $${Number(p.precio || 0).toLocaleString('es-CO')} | ${p.municipio || ''}`
    ).join('\n');
    const sys = s.chatSystemPrompt ||
      `Eres el asistente virtual de ${profile.name || 'Alex Arias'}, consultor inmobiliario especializado en ${profile.zone || 'Medellín y área metropolitana'}.
Ayudas a los visitantes del portafolio con consultas sobre inmuebles, precios y citas. Sé amable, profesional y breve. Habla en español colombiano informal pero respetuoso. No inventes precios ni datos.

Inmuebles disponibles:
${propsSummary}`;

    const msgBody = JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: sys,
      messages: messages.slice(-10)
    });
    const https = require('https');
    const result = await new Promise((resolve, reject) => {
      const req2 = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': s.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(msgBody)
        }
      }, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
      });
      req2.on('error', reject);
      req2.write(msgBody);
      req2.end();
    });
    if (result.error) return res.status(500).json({ error: result.error.message });
    res.json({ reply: result.content?.[0]?.text || '' });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Error procesando chat' });
  }
});

// ─── CONVERSIONS API (CAPI) — server-side Meta events ────────
// Recibe eventos del cliente → los valida → los hashea → los envía a Meta
// Requiere FB_ACCESS_TOKEN en .env (opcional — falla silenciosamente)
// Eventos permitidos (estándar Meta + custom WA)
const FB_VALID_EVENTS = new Set([
  'ViewContent','Search','Lead','AddToWishlist','Purchase','Contact',
  'InitiateCheckout','CompleteRegistration','FindLocation','Schedule',
  'PageView','ContactWhatsApp'
]);

app.post('/api/track', async (req, res) => {
  const t0 = Date.now();
  const logEntry = {
    createdAt: new Date(), eventName: req.body?.eventName || '?',
    eventId: req.body?.eventId || '', status: 'pending',
    reason: null, capiResponse: null, customData: {}, hasUserData: false, ms: 0
  };

  try {
    const s           = readSettings();
    const pixelId     = (s.facebookPixelId || '').trim();
    const accessToken = (process.env.FB_ACCESS_TOKEN || '').trim();

    if (!pixelId || !accessToken) {
      logEntry.status = 'skipped'; logEntry.reason = 'no_config';
      _logPixelEvent(logEntry);
      return res.json({ ok: false, reason: 'no_config' });
    }

    const { eventName, eventId, customData, fbp, fbc, userAgent, pageUrl, userEmail } = req.body;

    // ── Validación básica ─────────────────────────────────────
    if (!eventName) {
      logEntry.status = 'error'; logEntry.reason = 'no_event';
      _logPixelEvent(logEntry);
      return res.status(400).json({ ok: false, reason: 'no_event' });
    }

    // Sanitizar custom_data
    const cd = { ...(customData || {}) };
    if (cd.value !== undefined)  cd.value    = Math.max(0, Math.round(Number(cd.value) || 0));
    if (!cd.currency)            cd.currency = 'COP';
    if (cd.content_ids && !Array.isArray(cd.content_ids)) cd.content_ids = [String(cd.content_ids)];

    logEntry.eventName  = eventName;
    logEntry.eventId    = eventId || '';
    logEntry.customData = cd;

    // ── User Data con hashing SHA-256 (estándar Meta) ─────────
    const sha256 = v => crypto.createHash('sha256').update(String(v).toLowerCase().trim()).digest('hex');
    const ud = {
      client_ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '',
      client_user_agent: userAgent || req.headers['user-agent'] || '',
      ...(fbp && { fbp }),
      ...(fbc && { fbc })
    };
    // Hash email: cliente lo puede pasar, o lo obtenemos de la sesión admin
    const emailRaw = userEmail || req.user?.email || '';
    if (emailRaw && emailRaw.includes('@')) {
      ud.em = sha256(emailRaw);
      logEntry.hasUserData = true;
    }

    // ── Payload CAPI ──────────────────────────────────────────
    const payload = {
      data: [{
        event_name:       eventName,
        event_time:       Math.floor(Date.now() / 1000),
        event_id:         eventId || `capi_${Date.now()}`,
        action_source:    'website',
        event_source_url: pageUrl || req.headers.referer || '',
        user_data:        ud,
        custom_data:      cd
      }]
    };
    if (process.env.FB_TEST_EVENT_CODE) payload.test_event_code = process.env.FB_TEST_EVENT_CODE;

    // ── Envío con retry (3 intentos, back-off exponencial) ────
    let fbData = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const fbRes = await fetch(
          `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        fbData = await fbRes.json();
        if (!fbData.error) break; // éxito
        if (attempt < 2) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 300));
      } catch (_e) {
        if (attempt < 2) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 300));
      }
    }

    logEntry.capiResponse = fbData;
    logEntry.status = (fbData?.events_received > 0) ? 'success' : (fbData?.error ? 'error' : 'sent');
    logEntry.reason = fbData?.error?.message || null;
    logEntry.ms     = Date.now() - t0;
    _logPixelEvent(logEntry);

    res.json({ ok: true, fb: fbData });
  } catch (err) {
    logEntry.status = 'error'; logEntry.reason = err.message;
    logEntry.ms = Date.now() - t0;
    _logPixelEvent(logEntry);
    res.json({ ok: false, error: err.message });
  }
});

// Helper interno: inserta evento en DB y recorta si supera 500
function _logPixelEvent(entry) {
  pixelEventsDB.insertAsync(entry).then(() => {
    pixelEventsDB.countAsync({}).then(count => {
      if (count > 500) {
        pixelEventsDB.findAsync({}).sort({ createdAt: 1 }).limit(count - 500).then(old => {
          old.forEach(d => pixelEventsDB.removeAsync({ _id: d._id }, {}));
        }).catch(() => {});
      }
    }).catch(() => {});
  }).catch(() => {});
}

// ─── PIXEL: HEALTH CHECK ──────────────────────────────────────
app.get('/api/pixel-health', (req, res) => {
  const s       = readSettings();
  const pixelId = (s.facebookPixelId || '').trim();
  const hasToken = !!(process.env.FB_ACCESS_TOKEN || '').trim();
  const hasTest  = !!(process.env.FB_TEST_EVENT_CODE || '').trim();
  res.json({
    ok:       !!(pixelId && hasToken),
    pixel:    { configured: !!pixelId, id: pixelId ? pixelId.slice(0,4)+'…'+pixelId.slice(-4) : null },
    capi:     { configured: hasToken },
    testMode: hasTest
  });
});

// ─── PIXEL: ADMIN — consultar logs ───────────────────────────
app.get('/api/admin/pixel-events', requireAdmin, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 100, 500);
    const query  = {};
    if (req.query.event)  query.eventName = req.query.event;
    if (req.query.status) query.status    = req.query.status;
    const events = await pixelEventsDB.findAsync(query).sort({ createdAt: -1 }).limit(limit);
    const total  = await pixelEventsDB.countAsync({});
    res.json({ ok: true, events, total });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ─── PIXEL: ADMIN — limpiar logs ─────────────────────────────
app.delete('/api/admin/pixel-events', requireAdmin, async (req, res) => {
  try {
    await pixelEventsDB.removeAsync({}, { multi: true });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ─── PIXEL: ADMIN — disparar evento de prueba ────────────────
app.post('/api/admin/test-event', requireAdmin, async (req, res) => {
  try {
    const s           = readSettings();
    const pixelId     = (s.facebookPixelId || '').trim();
    const accessToken = (process.env.FB_ACCESS_TOKEN || '').trim();
    if (!pixelId || !accessToken) return res.json({ ok: false, reason: 'no_config' });

    const eventName = req.body.eventName || 'ViewContent';
    const payload = {
      data: [{
        event_name:       eventName,
        event_time:       Math.floor(Date.now() / 1000),
        event_id:         `test_${Date.now()}`,
        action_source:    'website',
        event_source_url: process.env.SITE_URL || 'https://alexariasc.com',
        user_data:        { client_ip_address: req.ip || '127.0.0.1', client_user_agent: req.headers['user-agent'] || 'test' },
        custom_data:      { content_type: 'home_listing', content_ids: ['test_prop'], value: 3500000, currency: 'COP' }
      }]
    };
    if (process.env.FB_TEST_EVENT_CODE) payload.test_event_code = process.env.FB_TEST_EVENT_CODE;

    const fbRes  = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );
    const fbData = await fbRes.json();

    _logPixelEvent({
      createdAt: new Date(), eventName: `[TEST] ${eventName}`, eventId: payload.data[0].event_id,
      status: (fbData?.events_received > 0) ? 'success' : 'error',
      reason: fbData?.error?.message || null, capiResponse: fbData,
      customData: payload.data[0].custom_data, hasUserData: false, ms: 0
    });

    res.json({ ok: true, fb: fbData });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ─── TRACKING.JS (Pixel FB + código personalizado) ───────────
// Todas las páginas incluyen <script src="/tracking.js"> en el <head>
// Este endpoint genera el JS dinámicamente según la config guardada
app.get('/tracking.js', (req, res) => {
  const s = readSettings();
  const pixelId    = (s.facebookPixelId || '').trim();
  const gtmId      = (s.gtmId           || '').trim();
  const customCode = (s.customHeadCode  || '').trim();

  let js = '/* Alex Arias · Tracking */\n';

  // ── Google Tag Manager ─────────────────────────────────────────
  if (gtmId) {
    const gid = gtmId.replace(/'/g, "\\'").replace(/`/g, '\\`');
    js += `
// ── Google Tag Manager (${gid}) ───────────────────────────────
(function(w,d,s,l,i){
  w[l]=w[l]||[];
  w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
  var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),
      dl=l!='dataLayer'?'&l='+l:'';
  j.async=true;
  j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
  f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gid}');
// GTM noscript fallback
(function(){
  var ns=document.createElement('noscript');
  var fr=document.createElement('iframe');
  fr.src='https://www.googletagmanager.com/ns.html?id=${gid}';
  fr.height=0; fr.width=0;
  fr.style.cssText='display:none;visibility:hidden';
  ns.appendChild(fr);
  var b=document.body||document.documentElement;
  b.insertBefore(ns, b.firstChild);
})();
`;
  }

  // ── Facebook / Meta Pixel ──────────────────────────────────────
  if (pixelId) {
    const pid = pixelId.replace(/'/g, "\\'").replace(/`/g, '\\`');
    js += `
// ── Facebook / Meta Pixel ─────────────────────────────────────
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pid}');
fbq('track', 'PageView');
(function(){
  var ns=document.createElement('noscript');
  var img=document.createElement('img');
  img.height=1;img.width=1;img.style.cssText='display:none';
  img.src='https://www.facebook.com/tr?id=${pid}&ev=PageView&noscript=1';
  ns.appendChild(img);
  (document.body||document.documentElement).appendChild(ns);
})();
`;
  }

  if (customCode) {
    js += '\n// ── Código personalizado ─────────────────────────────────\n';
    js += customCode + '\n';
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(js);
});

// ─── FEED FACEBOOK CATALOG (Real Estate) ─────────────────────
// Genera una entrada por propiedad; para "combinado" genera DOS entradas
// (una for_rent con precio arriendo + una for_sale con precio venta)
// para que aparezca en ambos tipos de catálogo de Meta.
app.get('/api/feed/facebook', (req, res) => {
  res.redirect(301, '/api/feed/facebook.csv');
});

app.get('/api/feed/facebook.json', async (req, res) => {
  try {
    const db      = getDB();
    const profile = readProfile();
    const docs    = await db.findAsync({});
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Mapea property_type al enum válido de Meta Real Estate Catalog
    const propTypeMap = {
      apartamento: 'apartment', apto: 'apartment', casa: 'house',
      local: 'commercial_space', bodega: 'warehouse', oficina: 'commercial_space',
      lote: 'land', finca: 'house', penthouse: 'apartment',
      townhouse: 'townhouse', studio: 'apartment', estudio: 'apartment'
    };
    const getType = p => {
      const raw = (p.tipo_inmueble || '').toLowerCase();
      return propTypeMap[raw] || 'apartment';
    };

    const brandName = profile.name || 'Alex Arias Consultor Inmobiliario';

    function buildEntry(p, variant = 'default') {
      const allImgs = (p.images || [])
        .filter(i => i.filename)
        .map(i => `${baseUrl}/${i.filename}`);
      const imgUrl  = allImgs[0] || '';

      const isComb  = p.tipo === 'combinado';
      const useRent = variant === 'rent' || (!isComb && p.tipo !== 'venta');

      const rawPrice = useRent
        ? (p.precioArriendo || p.precio || 0)
        : (p.precioVenta    || p.precio || 0);
      const price       = `${Number(rawPrice).toFixed(0)} COP`;
      const listingType = useRent ? 'for_rent' : 'for_sale';
      const avail       = p.estado === 'ocupado' ? 'recently_sold' : listingType;

      const listingId   = isComb
        ? `${p._id}_${useRent ? 'arr' : 'vta'}`
        : p._id;

      const descBase = p.descripcion
        || `${useRent ? 'En arriendo' : 'En venta'} en ${p.municipio || 'Antioquia'}. ${p.area ? p.area + ' m². ' : ''}${p.habitaciones ? p.habitaciones + ' hab. ' : ''}${p.banos ? p.banos + ' baños.' : ''}`;

      return {
        home_listing_id:  listingId,
        name:             p.title || 'Inmueble',
        description:      descBase.slice(0, 5000),
        price,
        listing_type:     listingType,
        availability:     avail,
        url:              `${baseUrl}/?prop=${p._id}`,
        image_url:        imgUrl,
        image_cdn_urls:   allImgs,          // todas las fotos para el carrusel del anuncio
        address: {
          addr1:       p.direccion || '',
          city:        p.municipio || 'Sabaneta',
          region:      'Antioquia',
          country:     'CO',
          postal_code: ''
        },
        latitude:         p.lat   ? Number(p.lat)   : null,
        longitude:        p.lng   ? Number(p.lng)   : null,
        num_baths:        p.banos       ? Number(p.banos)       : null,
        num_rooms:        p.habitaciones? Number(p.habitaciones): null,
        area_size:        p.area        ? Number(p.area)        : null,
        area_size_unit:   'square_meters',   // campo correcto según spec Meta
        property_type:    getType(p),
        year_built:       p.anio_construccion ? Number(p.anio_construccion) : null,
        brand:            brandName,
        neighborhood:     p.barrio || '',
        applink:          { web_url: `${baseUrl}/?prop=${p._id}` }
      };
    }

    const items = [];
    for (const p of docs) {
      if (p.tipo === 'combinado') {
        items.push(buildEntry(p, 'rent'));   // entrada arriendo
        items.push(buildEntry(p, 'sale'));   // entrada venta
      } else {
        items.push(buildEntry(p));
      }
    }

    res.json({ data: items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Feed XML — mismo catálogo pero en formato RSS para Meta Business
// También genera doble entrada para propiedades "combinado"
app.get('/api/feed/facebook.xml', async (req, res) => {
  try {
    const db      = getDB();
    const profile = readProfile();
    const docs    = await db.findAsync({});
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const esc = v => String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const brandName = profile.name || 'Alex Arias Consultor Inmobiliario';

    function xmlEntry(p, variant = 'default') {
      const isComb   = p.tipo === 'combinado';
      const useRent  = variant === 'rent' || (!isComb && p.tipo !== 'venta');
      const rawPrice = useRent
        ? (p.precioArriendo || p.precio || 0)
        : (p.precioVenta    || p.precio || 0);
      const price       = `${Number(rawPrice).toFixed(0)} COP`;
      const listingType = useRent ? 'for_rent' : 'for_sale';
      const avail       = p.estado === 'ocupado' ? 'recently_sold' : listingType;
      const listingId   = isComb ? `${p._id}_${useRent ? 'arr' : 'vta'}` : p._id;

      const allImgs = (p.images || []).filter(i => i.filename).map(i => `${baseUrl}/${i.filename}`);
      const mainImg = allImgs[0] || '';
      const extraImgs = allImgs.slice(1).map(u => `      <additional_image_url>${esc(u)}</additional_image_url>`).join('\n');

      const desc = esc((p.descripcion || `${useRent ? 'En arriendo' : 'En venta'} en ${p.municipio || 'Antioquia'}`).slice(0, 500));

      return `
    <item>
      <id>${esc(listingId)}</id>
      <home_listing_id>${esc(listingId)}</home_listing_id>
      <title>${esc(p.title || 'Inmueble')}</title>
      <description>${desc}</description>
      <listing_type>${listingType}</listing_type>
      <availability>${avail}</availability>
      <price>${esc(price)}</price>
      <url>${esc(`${baseUrl}/?prop=${p._id}`)}</url>
      <image_url>${esc(mainImg)}</image_url>
${extraImgs}
      <address>${esc([p.direccion, p.barrio, p.municipio].filter(Boolean).join(', '))}</address>
      <city>${esc(p.municipio || 'Sabaneta')}</city>
      <region>Antioquia</region>
      <country>CO</country>
      <postal_code></postal_code>
      <neighborhood>${esc(p.barrio || '')}</neighborhood>
      <num_baths>${p.banos || ''}</num_baths>
      <num_rooms>${p.habitaciones || ''}</num_rooms>
      <area_size>${p.area || ''}</area_size>
      <area_size_unit>square_meters</area_size_unit>
      <latitude>${p.lat || ''}</latitude>
      <longitude>${p.lng || ''}</longitude>
      <brand>${esc(brandName)}</brand>
    </item>`;
    }

    const itemParts = [];
    for (const p of docs) {
      if (p.tipo === 'combinado') {
        itemParts.push(xmlEntry(p, 'rent'));
        itemParts.push(xmlEntry(p, 'sale'));
      } else {
        itemParts.push(xmlEntry(p));
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<listings>
  <platform_store_id>alexarias_inmobiliario</platform_store_id>
${itemParts.join('\n')}
</listings>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── FEED CSV — formato oficial Meta Business para Home Listings ──
// URL para Facebook: https://alexariasc.com/api/feed/facebook.csv
app.get('/api/feed/facebook.csv', async (req, res) => {
  try {
    const db      = getDB();
    const profile = readProfile();
    const docs    = await db.findAsync({});
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Envuelve en comillas dobles y escapa comillas internas
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';

    // Columnas exactas según documentación oficial de Meta Home Listings
    // price = "XXXXXX COP" (número + moneda en mismo campo)
    // image = URL directa (campo obligatorio con ese nombre exacto)
    const HEADERS = [
      'home_listing_id', 'name', 'availability', 'description',
      'image', 'additional_image_link',
      'listing_type', 'price', 'url',
      'address', 'city', 'region', 'country', 'postal_code',
      'latitude', 'longitude',
      'num_baths', 'num_rooms', 'area_size', 'area_size_unit',
      'property_type'
    ];

    const rows = [HEADERS.join(',')];

    // Pre-convertir TODAS las imágenes WebP a JPEG en disco antes de generar el CSV.
    // Así cuando Meta crawlee las URLs de imagen ya serán archivos estáticos
    // servidos por Nginx directamente, sin pasar por Node.js.
    for (const p of docs) {
      for (const img of (p.images || [])) {
        if (!img.filename) continue;
        // img.filename puede ser "uploads/file.webp" — usar basename para evitar ruta doble
        const baseName = path.basename(img.filename);
        if (!baseName.endsWith('.webp')) continue;
        const webpPath = path.join(uploadsDir, baseName);
        const jpgName  = baseName.replace(/\.webp$/i, '.jpg');
        const jpgPath  = path.join(uploadsDir, jpgName);
        if (fs.existsSync(webpPath) && !fs.existsSync(jpgPath)) {
          try {
            const buf = await sharp(webpPath)
              .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 90 })
              .toBuffer();
            fs.writeFileSync(jpgPath, buf);
          } catch (_) {}
        }
      }
    }

    for (const p of docs) {
      const variants = p.tipo === 'combinado' ? ['rent', 'sale'] : [p.tipo === 'venta' ? 'sale' : 'rent'];

      for (const variant of variants) {
        const isComb   = p.tipo === 'combinado';
        const useRent  = variant === 'rent';
        const rawPrice = useRent
          ? (p.precioArriendo || p.precio || 0)
          : (p.precioVenta    || p.precio || 0);

        const listingId   = isComb ? `${p._id}_${useRent ? 'arr' : 'vta'}` : p._id;
        const availability = p.estado === 'ocupado' ? 'off_market' : (useRent ? 'for_rent' : 'for_sale');
        const listingType  = useRent ? 'for_rent_by_agent' : 'for_sale_by_agent';

        const imgs = (p.images || []).filter(i => i.filename)
                       .map(i => `${baseUrl}/${encodeURI(i.filename)}`);
        const mainImg  = imgs[0] || '';
        const extraImg = imgs.slice(1, 4).join(','); // hasta 3 adicionales separadas por coma

        // Saltar propiedades sin imagen — Meta requiere URL válida en campo "image"
        if (!mainImg) continue;

        // Convertir URL de WebP a JPEG para Meta.
        // Si ya existe el JPEG en disco (pre-convertido arriba), sirve directamente
        // desde /uploads/ via Nginx (sin pasar por Node). Si no, usa el endpoint
        // dinámico como fallback.
        const toMetaImg = url => {
          if (!url) return '';
          if (url.endsWith('.webp')) {
            const fname   = url.split('/').pop().replace(/\.webp$/i, '.jpg');
            const cached  = path.join(uploadsDir, fname);
            if (fs.existsSync(cached)) return `${baseUrl}/uploads/${encodeURI(fname)}`;
            return `${baseUrl}/api/feed/img/${encodeURI(fname)}`;
          }
          return url;
        };
        const metaMainImg  = toMetaImg(mainImg);
        const metaExtraImg = imgs.slice(1, 4).map(toMetaImg).filter(Boolean).join(',');

        // Eliminar saltos de línea que rompen el parser CSV de Meta
        const rawDesc = (p.descripcion || `${useRent ? 'En arriendo' : 'En venta'}, ${p.habitaciones || ''} habitaciones, ${p.area || ''}m² en ${p.municipio || 'Antioquia'}`);
        const desc    = rawDesc.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 500);
        // Código postal colombiano por municipio
        const postalCodes = {
          'sabaneta':  '055450',
          'envigado':  '055421',
          'medellín':  '050001',
          'medellin':  '050001',
          'bello':     '051050',
          'itagüí':    '055411',
          'itagui':    '055411',
          'la estrella': '055830',
          'caldas':    '055600',
          'rionegro':  '054040',
          'copacabana': '051030',
          'girardota': '051010',
        };
        const cityName   = (p.municipio || 'Sabaneta').trim();
        const postalCode = postalCodes[cityName.toLowerCase()] || '';
        // address = solo el municipio — city/region/country ya están en columnas separadas.
        // Poner ciudad+país dentro de address causa conflicto al geocodificar en Meta.
        const address = cityName;
        const price   = `${Number(rawPrice || 0).toFixed(2)} COP`; // Meta requiere 2 decimales

        rows.push([
          q(listingId),
          q(p.title || 'Inmueble'),
          q(availability),
          q(desc),
          q(metaMainImg),             // campo "image" (obligatorio, JPEG para Meta)
          q(metaExtraImg),            // additional_image_link (opcional)
          q(listingType),
          q(price),                   // "3500000 COP"
          q(`${baseUrl}/?prop=${p._id}`),
          q(address),
          q(cityName),
          q('Antioquia'),
          'CO',
          q(postalCode),
          p.lat  || '',
          p.lng  || '',
          p.banos        || '',
          p.habitaciones || '',
          p.area         || '',
          p.area ? 'square_meters' : '',
          'apartment'
        ].join(','));
      }
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="meta_feed.csv"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.send(rows.join('\r\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── VERIFICADOR TOKEN GOOGLE ─────────────────────────────────
function verifyGoogleToken(idToken) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    https.get(url, res2 => {
      let data = '';
      res2.on('data', c => data += c);
      res2.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.error) reject(new Error(p.error_description || 'Token inválido'));
          else resolve(p);
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ─── RESEÑAS ─────────────────────────────────────────────────
app.get('/api/reviews', async (req, res) => {
  try {
    const db = getReviewsDB();
    const reviews = await db.findAsync({});
    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = reviews.length;
    const avg = total ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10 : 0;
    const distribution = [5, 4, 3, 2, 1].map(n => ({
      stars: n,
      count: reviews.filter(r => r.rating === n).length
    }));
    res.json({ reviews, stats: { avg, total, distribution } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { credential, rating, comment } = req.body;
    if (!credential) return res.status(400).json({ error: 'Se requiere autenticación con Google' });
    const r = Number(rating);
    if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'Calificación inválida (1–5)' });

    const payload = await verifyGoogleToken(credential);
    const settings = readSettings();
    if (settings.googleClientId && payload.aud !== settings.googleClientId) {
      return res.status(401).json({ error: 'Token no autorizado para este sitio' });
    }

    const db = getReviewsDB();
    const existing = await db.findOneAsync({ googleId: payload.sub });
    const now = new Date().toISOString();
    const reviewData = {
      googleId: payload.sub,
      name: payload.name || 'Usuario',
      email: payload.email || '',
      photo: payload.picture || '',
      rating: r,
      comment: (comment || '').trim().slice(0, 1000),
      updatedAt: now
    };
    if (existing) {
      await db.updateAsync({ googleId: payload.sub }, { $set: reviewData });
    } else {
      reviewData.createdAt = now;
      await db.insertAsync(reviewData);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/reviews/:id', requireAdmin, async (req, res) => {
  try {
    const db = getReviewsDB();
    await db.removeAsync({ _id: req.params.id }, {});
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── RESPONDER RESEÑAS ───────────────────────────────────────
app.post('/api/reviews/:id/reply', requireAdmin, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'La respuesta no puede estar vacía' });
    if (text.length > 500) return res.status(400).json({ error: 'La respuesta no puede exceder 500 caracteres' });

    const db = getReviewsDB();
    const review = await db.findOneAsync({ _id: req.params.id });
    if (!review) return res.status(404).json({ error: 'Reseña no encontrada' });

    const reply = {
      text: text.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.updateAsync({ _id: req.params.id }, { $set: { reply } });
    res.json({ ok: true, reply });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/reviews/:id/reply', requireAdmin, async (req, res) => {
  try {
    const db = getReviewsDB();
    const review = await db.findOneAsync({ _id: req.params.id });
    if (!review) return res.status(404).json({ error: 'Reseña no encontrada' });

    await db.updateAsync({ _id: req.params.id }, { $unset: { reply: true } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Socket.io ────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  socket.on('disconnect', () => console.log('Desconectado:', socket.id));
});

// ─── Arrancar servidor ────────────────────────────────────────
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n✅ Alex Arias Inmobiliaria → http://localhost:${PORT}`);
    console.log(`   Contraseña admin: ${ADMIN_PASSWORD}`);
    console.log(`   Presiona Ctrl+C para detener\n`);
  });
}).catch(err => {
  console.error('Error iniciando:', err);
  process.exit(1);
});
