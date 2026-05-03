require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
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
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Asegurar carpeta uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}_${Math.random().toString(36).substr(2, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    /image\/(jpeg|jpg|png|webp|gif)/.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Solo imágenes'));
  }
});

// ── SEGURIDAD ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Desactivado para no romper scripts inline del frontend
  crossOriginEmbedderPolicy: false
}));

// Rate limiting global (100 peticiones por 15 min por IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, intenta en 15 minutos.' }
});

// Rate limiting estricto para login/auth (10 intentos por 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso, intenta en 15 minutos.' }
});

app.use('/api/verify-password', authLimiter);
app.use('/auth/google', authLimiter);
app.use('/api/', globalLimiter);

// Middleware
app.use(cors());
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
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(uploadsDir));

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

app.put('/api/profile', requireAdmin, upload.single('avatar'), (req, res) => {
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
    if (req.file) updated.avatar = `uploads/${req.file.filename}`;
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
    if (tipo && tipo !== 'todos') query.tipo = tipo;
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

// ─── CREAR PROPIEDAD ──────────────────────────────────────────
app.post('/api/properties', requireAdmin, upload.array('images', 15), async (req, res) => {
  try {
    const db = getDB();
    const {
      title, tipo, municipio, barrio, sector, direccion, piso,
      precio, area, habitaciones, banos, parqueadero, cuarto_util, estudio,
      descripcion, amenidades, estado, lat, lng
    } = req.body;

    const amenArr = (() => {
      try { return JSON.parse(amenidades); }
      catch { return amenidades ? amenidades.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : []; }
    })();

    const files = req.files || [];
    const images = files.map((f, i) => ({
      id: genId(),
      filename: `uploads/${f.filename}`,
      order_index: i
    }));

    const doc = await db.insertAsync({
      title: title || 'Sin título',
      tipo: tipo || 'arriendo',
      municipio: municipio || '', barrio: barrio || '',
      sector: sector || '', direccion: direccion || '', piso: piso || '',
      precio: Number(precio) || 0, area: Number(area) || 0,
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
      precio, area, habitaciones, banos, parqueadero, cuarto_util, estudio,
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
    const newImages = newFiles.map((f, i) => ({
      id: genId(),
      filename: `uploads/${f.filename}`,
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
    const municipios = [...new Set(all.map(p => p.municipio).filter(Boolean))].sort();
    const barrios = [...new Set(all.map(p => p.barrio).filter(Boolean))].sort();
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

    const cover = req.file ? `uploads/${req.file.filename}` : (req.body.cover || '');
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

    const cover = req.file ? `uploads/${req.file.filename}` : (req.body.cover || existing.cover || '');
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
      facebookPixelId: '', customHeadCode: '',
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
    ['webhookUrl', 'webhookEvents', 'chatEnabled', 'chatGreeting', 'chatSystemPrompt', 'facebookPixelId', 'customHeadCode', 'googleClientId'].forEach(f => {
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

// ─── TRACKING.JS (Pixel FB + código personalizado) ───────────
// Todas las páginas incluyen <script src="/tracking.js"> en el <head>
// Este endpoint genera el JS dinámicamente según la config guardada
app.get('/tracking.js', (req, res) => {
  const s = readSettings();
  const pixelId = (s.facebookPixelId || '').trim();
  const customCode = (s.customHeadCode || '').trim();

  let js = '/* Alex Arias Tracking */\n';

  if (pixelId) {
    js += `
// ── Facebook Pixel ──────────────────────────────────────────
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId.replace(/'/g,"\\'")}');
fbq('track', 'PageView');
`;
  }

  if (customCode) {
    js += '\n// ── Código personalizado ─────────────────────────────────\n';
    js += customCode + '\n';
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store'); // siempre fresco para reflejar cambios
  res.send(js);
});

// ─── FEED FACEBOOK CATALOG (Real Estate) ─────────────────────
app.get('/api/feed/facebook', async (req, res) => {
  try {
    const db = getDB();
    const profile = readProfile();
    const docs = await db.findAsync({});
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const items = docs.map(p => {
      const img = p.images?.[0]?.filename ? `${baseUrl}/${p.images[0].filename}` : '';
      const price = p.precio ? `${Number(p.precio).toFixed(0)} COP` : '0 COP';
      const listingType = p.tipo === 'venta' ? 'for_sale' : 'for_rent';
      const avail = p.estado === 'ocupado' ? 'recently_sold' : listingType;
      const propType = p.tipo_inmueble || 'apartment';
      return {
        home_listing_id: p._id,
        name: p.title || 'Inmueble',
        description: (p.descripcion || `${p.tipo === 'venta' ? 'Venta' : 'Arriendo'} en ${p.municipio || ''}`).slice(0, 5000),
        price,
        listing_type: listingType,
        availability: avail,
        url: `${baseUrl}/?prop=${p._id}`,
        image_url: img,
        address: {
          addr1: p.direccion || p.barrio || '',
          city: p.municipio || '',
          region: 'Antioquia',
          country: 'CO',
          postal_code: ''
        },
        latitude: p.lat || null,
        longitude: p.lng || null,
        num_baths: p.banos || null,
        num_rooms: p.habitaciones || null,
        area_size: p.area || null,
        area_size_unit: 'm2',
        property_type: propType,
        brand: profile.name || 'Alex Arias',
        neighborhood: p.barrio || '',
        applink: {
          web_url: `${baseUrl}/?prop=${p._id}`
        }
      };
    });

    res.json({ data: items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Feed XML (RSS) para catálogo alternativo
app.get('/api/feed/facebook.xml', async (req, res) => {
  try {
    const db = getDB();
    const profile = readProfile();
    const docs = await db.findAsync({});
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const esc = v => String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const items = docs.map(p => {
      const img  = p.images?.[0]?.filename ? `${baseUrl}/${p.images[0].filename}` : '';
      const price = p.precio ? `${Number(p.precio).toFixed(0)} COP` : '0 COP';
      return `
    <item>
      <id>${esc(p._id)}</id>
      <title>${esc(p.title)}</title>
      <description>${esc((p.descripcion || '').slice(0, 500))}</description>
      <home_listing_id>${esc(p._id)}</home_listing_id>
      <listing_type>${p.tipo === 'venta' ? 'for_sale' : 'for_rent'}</listing_type>
      <availability>${p.estado === 'ocupado' ? 'recently_sold' : (p.tipo === 'venta' ? 'for_sale' : 'for_rent')}</availability>
      <price>${esc(price)}</price>
      <url>${esc(`${baseUrl}/?prop=${p._id}`)}</url>
      <image_url>${esc(img)}</image_url>
      <address>${esc([p.direccion, p.barrio, p.municipio].filter(Boolean).join(', '))}</address>
      <city>${esc(p.municipio)}</city>
      <region>Antioquia</region>
      <country>CO</country>
      <neighborhood>${esc(p.barrio)}</neighborhood>
      <num_baths>${p.banos || ''}</num_baths>
      <num_rooms>${p.habitaciones || ''}</num_rooms>
      <area_size>${p.area || ''}</area_size>
      <latitude>${p.lat || ''}</latitude>
      <longitude>${p.lng || ''}</longitude>
      <brand>${esc(profile.name || 'Alex Arias')}</brand>
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<listings>
  <platform_store_id>alexarias_inmobiliario</platform_store_id>${items}
</listings>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
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
