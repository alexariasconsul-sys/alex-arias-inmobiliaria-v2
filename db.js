const Datastore = require('@seald-io/nedb');
const path = require('path');

const db = new Datastore({
  filename: path.join(__dirname, 'properties.db'),
  autoload: true
});

function getDB() { return db; }

// Mapear _id a id para respuestas API
function mapDoc(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function mapDocs(docs) { return docs.map(mapDoc); }

// Generar ID para imágenes embebidas
function genId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

async function initDB() {
  const count = await db.countAsync({});
  if (count === 0) await seedData();
}

async function seedData() {
  const now = new Date().toISOString();

  const properties = [
    {
      title: 'Apartamento en Vivaré Plaza Residencial',
      tipo: 'arriendo',
      municipio: 'Sabaneta',
      barrio: 'Vivaré Plaza Residencial',
      sector: 'Av. Las Vegas / Metro La Estrella',
      direccion: 'Calle 78cSur # 47G - 10',
      piso: '8',
      precio: 3500000,
      area: 87,
      habitaciones: 3,
      banos: 2.5,
      parqueadero: 1,
      cuarto_util: 1,
      estudio: 1,
      descripcion: 'Si buscas comodidad, modernidad y zonas comunes tipo club, este apartamento es ideal. 87 m² bien distribuidos con persianas blackout y panel en japonés. Ubicación estratégica cerca a vías principales, comercio y servicios. Perfecto para vivir cómodo en una de las mejores zonas de Sabaneta.',
      amenidades: ['Persianas blackout', 'Panel en japonés', 'Cocina integral', 'Sala comedor', 'Zona de ropas', 'Piscina', 'Seguridad 24h'],
      estado: 'libre',
      lat: 6.1510, lng: -75.6190,
      likes: 0,
      created_at: now,
      images: [
        { id: genId(), filename: 'assets/Arriendo en Vivaré Plaza Residencial  (1).jpeg', order_index: 0 },
        { id: genId(), filename: 'assets/Arriendo en Vivaré Plaza Residencial  (2).jpeg', order_index: 1 },
        { id: genId(), filename: 'assets/Arriendo en Vivaré Plaza Residencial  (3).jpeg', order_index: 2 },
        { id: genId(), filename: 'assets/Arriendo en Vivaré Plaza Residencial  (4).jpeg', order_index: 3 },
        { id: genId(), filename: 'assets/Arriendo en Vivaré Plaza Residencial  (5).jpeg', order_index: 4 }
      ]
    },
    {
      title: 'Apartamento en Terrazas del Rio',
      tipo: 'arriendo',
      municipio: 'Envigado',
      barrio: 'Terrazas del Rio',
      sector: 'Viva de Envigado',
      direccion: 'Calle 30 Sur # 48-170',
      piso: '8',
      precio: 3750000,
      area: 77,
      habitaciones: 3,
      banos: 2,
      parqueadero: 1,
      cuarto_util: 1,
      estudio: 0,
      descripcion: 'Si buscas comodidad, modernidad y zonas comunes tipo club, este apartamento es ideal. 77 m² bien distribuidos. Ubicación estratégica cerca a todo. Perfecto para vivir cómodo en una de las mejores zonas de Envigado.',
      amenidades: ['Cocina integral', 'Sala comedor', 'Zona de ropas', 'Piscina', 'Seguridad 24h'],
      estado: 'libre',
      lat: 6.1704, lng: -75.5906,
      likes: 0,
      created_at: now,
      images: [
        { id: genId(), filename: 'assets/Arriendo en Terrazas del Rio- sector Viva de Envigado (1).jpeg', order_index: 0 },
        { id: genId(), filename: 'assets/Arriendo en Terrazas del Rio- sector Viva de Envigado (2).jpeg', order_index: 1 },
        { id: genId(), filename: 'assets/Arriendo en Terrazas del Rio- sector Viva de Envigado (3).jpeg', order_index: 2 },
        { id: genId(), filename: 'assets/Arriendo en Terrazas del Rio- sector Viva de Envigado (4).jpeg', order_index: 3 },
        { id: genId(), filename: 'assets/Arriendo en Terrazas del Rio- sector Viva de Envigado (5).jpeg', order_index: 4 }
      ]
    },
    {
      title: 'Apartamento Para Estrenar en Farum',
      tipo: 'arriendo',
      municipio: 'Sabaneta',
      barrio: 'Farum',
      sector: 'Las Lomitas',
      direccion: 'Calle 72Sur # 34-99',
      piso: '22',
      precio: 3200000,
      area: 87,
      habitaciones: 3,
      banos: 2,
      parqueadero: 1,
      cuarto_util: 1,
      estudio: 1,
      descripcion: 'Hermoso Apartamento Para Estrenar en Farum. Excelente distribución y espacios. 3 closets, vestier, nicho de estudio y 2 balcones. Zonas comunes en construcción.',
      amenidades: ['3 Clósets', 'Vestier', 'Nicho de Estudio', '2 Balcones', 'Cocina integral', 'Zona de ropas', 'Sala comedor'],
      estado: 'libre',
      lat: 6.1480, lng: -75.6210,
      likes: 0,
      created_at: now,
      images: [
        { id: genId(), filename: 'assets/arriendo apartamento en forum (1).jpeg', order_index: 0 },
        { id: genId(), filename: 'assets/arriendo apartamento en forum (2).jpeg', order_index: 1 },
        { id: genId(), filename: 'assets/arriendo apartamento en forum (3).jpeg', order_index: 2 },
        { id: genId(), filename: 'assets/arriendo apartamento en forum (4).jpeg', order_index: 3 },
        { id: genId(), filename: 'assets/arriendo apartamento en forum (5).jpeg', order_index: 4 }
      ]
    },
    {
      title: 'Apartamento Río Secreto - Piso 24',
      tipo: 'arriendo',
      municipio: 'Sabaneta',
      barrio: 'Río Secreto',
      sector: 'Sabaneta Sur',
      direccion: 'Calle 78E sur # 47c - 80',
      piso: '24',
      precio: 3200000,
      area: 88,
      habitaciones: 3,
      banos: 2.5,
      parqueadero: 1,
      cuarto_util: 1,
      estudio: 1,
      descripcion: 'Excelente ubicación, espacio y distribución. Piso 24 con 88 m². 3 closets, zona de ropas con calentador y estudio. Excelentes zonas comunes.',
      amenidades: ['3 Closets', 'Zona ropas con calentador', 'Estudio', 'Cocina integral', 'Sala comedor', 'Zonas Comunes'],
      estado: 'libre',
      lat: 6.1529, lng: -75.6174,
      likes: 0,
      created_at: now,
      images: [
        { id: genId(), filename: 'assets/Apartamento en  Sabaneta Río Secreto  (1).jpeg', order_index: 0 },
        { id: genId(), filename: 'assets/Apartamento en  Sabaneta Río Secreto  (2).jpeg', order_index: 1 },
        { id: genId(), filename: 'assets/Apartamento en  Sabaneta Río Secreto  (3).jpeg', order_index: 2 },
        { id: genId(), filename: 'assets/Apartamento en  Sabaneta Río Secreto  (4).jpeg', order_index: 3 },
        { id: genId(), filename: 'assets/Apartamento en  Sabaneta Río Secreto  (5).jpeg', order_index: 4 },
        { id: genId(), filename: 'assets/Apartamento en  Sabaneta Río Secreto  (6).jpeg', order_index: 5 }
      ]
    }
  ];

  for (const prop of properties) {
    await db.insertAsync(prop);
  }
  console.log('✅ 4 inmuebles de prueba insertados');
}

module.exports = { getDB, initDB, mapDoc, mapDocs, genId };
