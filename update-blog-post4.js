/**
 * Actualiza el excerpt y metaDescription del blog post 4
 * Uso: node update-blog-post4.js
 */

const TARGET = 'https://alexariasc.com';
const ADMIN_PASSWORD = '50AlexArias_*#';
const SLUG = 'arriendo-en-medellin-2026-guia-completa-para-inquilinos';

async function updatePost() {
  const fd = new FormData();
  fd.append('excerpt',
    'Encontrar apartamento en arriendo en Medellín en 2026 es más difícil que nunca: vacancia del 0,6% y precios subiendo al 7,08% anual. Esta guía te explica los precios reales por zona, el tope legal de incremento del 5,10%, los documentos que te van a pedir, tus derechos como inquilino y todo lo que debes revisar antes de firmar el contrato.'
  );
  fd.append('metaDescription',
    'Guía completa de arriendo en Medellín 2026: precios reales por zona, tope legal de incremento (5,10%), documentos requeridos, derechos del inquilino según la Ley 820 y checklist antes de firmar. Actualizado a mayo 2026.'
  );

  // Obtener el post actual para no perder los otros campos
  const current = await fetch(`${TARGET}/api/blog/${SLUG}`).then(r => r.json());

  // Re-enviar todos los campos necesarios para no sobrescribir con vacío
  fd.append('title',           current.title || '');
  fd.append('content',         current.content || '');
  fd.append('category',        current.category || 'Arriendo');
  fd.append('tags',            JSON.stringify(current.tags || []));
  fd.append('status',          current.status || 'published');
  fd.append('metaTitle',       current.seo?.metaTitle || current.metaTitle || '');
  fd.append('metaKeywords',    current.seo?.metaKeywords || current.metaKeywords || '');
  fd.append('cover',           current.cover || '');

  console.log('📤 Actualizando post...');
  const r = await fetch(`${TARGET}/api/blog/${SLUG}`, {
    method: 'PUT',
    headers: { 'x-admin-password': ADMIN_PASSWORD },
    body: fd
  });

  const result = await r.json();
  if (r.ok) {
    console.log('✅ Post actualizado correctamente');
    console.log('📝 Nuevo excerpt:', result.excerpt?.slice(0, 80) + '...');
  } else {
    console.error('❌ Error:', result);
  }
}

updatePost().catch(console.error);
