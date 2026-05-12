/**
 * Script para insertar el cuarto blog post en alexariasc.com
 * Uso: node insert-blog-post4.js
 *
 * Requiere Node.js 18+ (usa fetch nativo)
 * Apunta directamente al servidor en producción
 */

const TARGET = 'https://alexariasc.com'; // <-- cambia a http://localhost:3000 si corres en local
const ADMIN_PASSWORD = '50AlexArias_*#';

// ─── COVER ────────────────────────────────────────────────────────────────
// Imagen principal del post (Unsplash - Libre de derechos)
const COVER_URL = 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80&auto=format&fit=crop';

// ─── CONTENIDO HTML ───────────────────────────────────────────────────────
const content = `
<p class="post-intro">Los arriendos en Medellín <strong>subieron 7,08% en el último año</strong>, el incremento más alto del país, y la vacancia de inmuebles es apenas del 0,6%. Si estás buscando apartamento en arriendo en 2026, esta guía te explica todo: precios reales por zona, tus derechos legales, los documentos que te van a pedir y los errores que te pueden costar caro.</p>

<nav class="post-toc" aria-label="Tabla de contenidos">
  <h2 class="post-toc-title">📋 Contenido</h2>
  <ol class="post-toc-list">
    <li><a href="#mercado">¿Por qué está tan difícil arrendar en Medellín?</a></li>
    <li><a href="#precios">Precios de arriendo por zona en 2026</a></li>
    <li><a href="#incremento">Incremento legal 2026: ¿cuánto pueden subirte?</a></li>
    <li><a href="#barrios">Barrios según tu presupuesto</a></li>
    <li><a href="#requisitos">Documentos y requisitos para arrendar</a></li>
    <li><a href="#checklist">Checklist antes de firmar el contrato</a></li>
    <li><a href="#derechos">Tus derechos como inquilino</a></li>
    <li><a href="#tendencias">Tendencia: el auge del micro-living</a></li>
    <li><a href="#faq">Preguntas frecuentes</a></li>
  </ol>
</nav>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="mercado">¿Por qué está tan difícil arrendar en Medellín en 2026?</h2>

<p>El mercado de arriendo en Medellín vive una <strong>tormenta perfecta</strong>: alta demanda + poca oferta = precios al alza. Estos son los factores que explican la situación actual:</p>

<ul>
  <li>🏗️ <strong>Escasez de vivienda usada disponible:</strong> La vacancia en Medellín está en apenas el <strong>0,6%</strong>, lo que significa que de cada 1.000 apartamentos, solo 6 están disponibles para arrendar.</li>
  <li>📈 <strong>Presión migratoria:</strong> El atractivo de Medellín como ciudad de trabajadores remotos y nómadas digitales aumenta la competencia por los mejores inmuebles.</li>
  <li>💰 <strong>Inflación acumulada:</strong> Medellín acumuló un aumento del <strong>3,24% solo en los primeros 4 meses de 2026</strong>, y un 7,08% en los últimos 12 meses, el mayor del país.</li>
  <li>🏦 <strong>Acceso al crédito difícil:</strong> Con tasas hipotecarias alrededor del 13%, muchas familias prefieren arrendar en lugar de comprar, aumentando la demanda.</li>
</ul>

<blockquote class="post-tip">
  <strong>📊 Dato clave:</strong> Medellín tiene el incremento de arriendo más alto de Colombia en 2026 (7,08% anual), por encima de Bogotá (5,9%) y Cali (4,2%).
</blockquote>

<figure>
  <img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=75&auto=format&fit=crop" alt="Edificios residenciales de apartamentos en Medellín Colombia" loading="lazy" class="post-img" />
  <figcaption>El mercado de arriendo en Medellín enfrenta alta demanda y muy poca oferta disponible en 2026</figcaption>
</figure>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="precios">Precios de arriendo por zona en Medellín 2026</h2>

<p>Los precios varían enormemente según la zona. Esta es la referencia actualizada a mayo 2026:</p>

<div class="post-table-wrap">
<table class="post-table">
  <thead>
    <tr>
      <th>Zona</th>
      <th>Estudio / 1 hab.</th>
      <th>2 habitaciones</th>
      <th>3 habitaciones</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>El Poblado</strong></td>
      <td>$1.800.000 – $3.500.000</td>
      <td>$3.500.000 – $6.000.000</td>
      <td>$6.000.000 – $10.000.000+</td>
    </tr>
    <tr>
      <td><strong>Laureles – Estadio</strong></td>
      <td>$1.200.000 – $2.200.000</td>
      <td>$2.200.000 – $4.500.000</td>
      <td>$4.000.000 – $7.000.000</td>
    </tr>
    <tr>
      <td><strong>Envigado</strong></td>
      <td>$1.000.000 – $1.800.000</td>
      <td>$1.800.000 – $3.500.000</td>
      <td>$3.000.000 – $5.500.000</td>
    </tr>
    <tr>
      <td><strong>Sabaneta</strong></td>
      <td>$900.000 – $1.600.000</td>
      <td>$1.600.000 – $3.000.000</td>
      <td>$2.800.000 – $4.500.000</td>
    </tr>
    <tr>
      <td><strong>Belén – La América</strong></td>
      <td>$700.000 – $1.200.000</td>
      <td>$1.200.000 – $2.200.000</td>
      <td>$2.000.000 – $3.500.000</td>
    </tr>
    <tr>
      <td><strong>Robledo – Castilla</strong></td>
      <td>$500.000 – $900.000</td>
      <td>$800.000 – $1.600.000</td>
      <td>$1.400.000 – $2.500.000</td>
    </tr>
  </tbody>
</table>
</div>

<p><small>* Rangos de referencia a mayo 2026. Los precios varían según acabados, piso, parqueadero y antigüedad del inmueble.</small></p>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="incremento">Incremento legal de arriendo en 2026: ¿cuánto pueden subirte?</h2>

<p>Si ya tienes contrato de arriendo, esto te interesa muchísimo. La ley colombiana regula cuánto puede subir el canon cada año.</p>

<h3>El tope para 2026 es del 5,10%</h3>

<p>El incremento máximo permitido para 2026 corresponde al <strong>IPC certificado por el DANE para 2025 (5,10%)</strong>. Esto significa que si tu arriendo es de $1.500.000, lo máximo que te pueden subir es:</p>

<blockquote class="post-tip">
  <strong>🧮 Cálculo:</strong> $1.500.000 × 5,10% = $76.500 de aumento máximo → nuevo canon: <strong>$1.576.500</strong>
</blockquote>

<h3>Reglas importantes que debes conocer</h3>

<ul>
  <li>📅 El incremento <strong>solo aplica cuando el contrato cumple 12 meses</strong> desde su inicio o desde el último aumento, no antes.</li>
  <li>❌ El arrendador <strong>no puede subir el arriendo en enero automáticamente</strong> solo porque cambió el año.</li>
  <li>📝 Si el contrato no especifica la fecha de ajuste, el arrendador debe <strong>notificarte por escrito con al menos 3 meses de anticipación</strong> si quiere no renovar o cambiar condiciones.</li>
  <li>⚖️ Cualquier aumento por encima del IPC es ilegal según la <strong>Ley 820 de 2003</strong>.</li>
</ul>

<blockquote class="post-tip">
  <strong>⚠️ Ojo:</strong> Si tu arrendador te sube el canon por encima del 5,10% o antes de cumplirse el año, puedes reportarlo a la Secretaría de Gobierno Municipal. Tienes respaldo legal.
</blockquote>

<figure>
  <img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=75&auto=format&fit=crop" alt="Persona revisando contrato de arriendo en Colombia" loading="lazy" class="post-img" />
  <figcaption>Conocer la Ley 820 de 2003 te protege de incrementos ilegales en tu canon de arrendamiento</figcaption>
</figure>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="barrios">Barrios de Medellín según tu presupuesto</h2>

<p>¿Cuánto tienes disponible para el arriendo? Aquí te orientamos por rango de presupuesto:</p>

<div class="post-zones-grid">

  <div class="post-zone-card">
    <h3>💸 Hasta $1.200.000</h3>
    <p><strong>Zonas:</strong> Robledo, Castilla, Aranjuez, Manrique<br/>
    <strong>Tipo:</strong> Apartaestudio o apartamento pequeño<br/>
    <strong>Ideal para:</strong> Estudiantes, personas solas, presupuesto ajustado</p>
  </div>

  <div class="post-zone-card">
    <h3>🏘️ $1.200.000 – $2.500.000</h3>
    <p><strong>Zonas:</strong> Belén, La América, Itagüí, San Antonio de Prado<br/>
    <strong>Tipo:</strong> Apartamento 2 habitaciones<br/>
    <strong>Ideal para:</strong> Parejas, familias pequeñas, clase media</p>
  </div>

  <div class="post-zone-card">
    <h3>🏢 $2.500.000 – $4.000.000</h3>
    <p><strong>Zonas:</strong> Sabaneta, Envigado, El Estadio, Calasanz<br/>
    <strong>Tipo:</strong> Apartamento 2-3 habitaciones<br/>
    <strong>Ideal para:</strong> Familias, buena relación calidad-precio</p>
  </div>

  <div class="post-zone-card">
    <h3>✨ Más de $4.000.000</h3>
    <p><strong>Zonas:</strong> El Poblado, Laureles, El Tesoro, Ciudad del Río<br/>
    <strong>Tipo:</strong> Apartamento 2-4 habitaciones, acabados premium<br/>
    <strong>Ideal para:</strong> Ejecutivos, familias con alto poder adquisitivo</p>
  </div>

</div>

<blockquote class="post-tip">
  <strong>💡 Consejo:</strong> Sabaneta y Envigado ofrecen hoy la mejor relación calidad-precio del área metropolitana: zonas seguras, bien dotadas de servicios, con acceso al metro y precios hasta un 30% más bajos que El Poblado.
</blockquote>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="requisitos">Documentos y requisitos para arrendar en Medellín</h2>

<p>Antes de aplicar a un inmueble, ten estos documentos listos. Los arrendadores y las inmobiliarias los exigen de forma estándar:</p>

<h3>Si eres empleado</h3>
<ul>
  <li>☑️ Cédula de ciudadanía</li>
  <li>☑️ Certificación laboral reciente (con cargo, antigüedad, salario y tipo de contrato)</li>
  <li>☑️ Últimos 3 desprendibles de pago o colillas de nómina</li>
  <li>☑️ Últimos 3 extractos bancarios</li>
  <li>☑️ Declaración de renta (si estás obligado a declarar)</li>
</ul>

<h3>Si eres independiente o trabajas por cuenta propia</h3>
<ul>
  <li>☑️ Cédula de ciudadanía y RUT</li>
  <li>☑️ Últimos 3 extractos bancarios (que demuestren ingresos estables)</li>
  <li>☑️ Declaración de renta de los últimos 2 años</li>
  <li>☑️ Referencias comerciales de clientes o proveedores</li>
</ul>

<h3>Garantía del contrato (elige una)</h3>
<p>Para que el arrendador acepte, debes presentar una de estas dos opciones:</p>
<ul>
  <li>👤 <strong>Codeudor:</strong> Una persona con finca raíz en Colombia o con ingresos suficientes que responde solidariamente por el contrato.</li>
  <li>📋 <strong>Póliza de arrendamiento:</strong> Una aseguradora garantiza el pago del canon. Generalmente cuesta entre el 3% y el 5% del canon mensual como prima.</li>
</ul>

<blockquote class="post-tip">
  <strong>🎯 Tip práctico:</strong> Si no tienes codeudor y no quieres pagar póliza, algunos propietarios aceptan un depósito equivalente a 1-2 meses de canon. Negócialo directamente con el arrendador, no con la inmobiliaria.
</blockquote>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="checklist">Checklist antes de firmar el contrato de arriendo</h2>

<p>No firmes ningún contrato sin revisar estos puntos. Una vez firmado, tienes poca capacidad de reclamar los defectos que no notificaste al inicio:</p>

<h3>Del inmueble</h3>
<ul>
  <li>☑️ Verifica que todos los grifos, duchas y sanitarios funcionen correctamente</li>
  <li>☑️ Prueba todas las tomas eléctricas y los breakers del tablero</li>
  <li>☑️ Busca manchas de humedad en paredes, techos y esquinas (especialmente baños y cocina)</li>
  <li>☑️ Revisa que ventanas, puertas y cerraduras abran y cierren bien</li>
  <li>☑️ Verifica presión de agua en todos los puntos</li>
  <li>☑️ Anota los daños existentes en el inventario del contrato</li>
</ul>

<h3>Del contrato</h3>
<ul>
  <li>☑️ Canon mensual exacto y fecha de pago</li>
  <li>☑️ Duración del contrato y condiciones de renovación</li>
  <li>☑️ Quién paga las reparaciones locativas (tu responsabilidad) vs. las mayores (del propietario)</li>
  <li>☑️ Cláusula de incremento de arriendo (no puede superar el IPC)</li>
  <li>☑️ Qué incluye el inmueble (parqueadero, depósito, electrodomésticos)</li>
  <li>☑️ Cuota de administración: ¿quién la paga tú o el propietario?</li>
  <li>☑️ Penalidades por terminación anticipada del contrato</li>
</ul>

<blockquote class="post-tip">
  <strong>📸 Importante:</strong> Toma fotos y video del estado del inmueble el día que recibes las llaves, con fecha y hora. Esto te protege cuando entregues el inmueble al final del contrato.
</blockquote>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="derechos">Tus derechos como inquilino en Colombia</h2>

<p>La <strong>Ley 820 de 2003</strong> protege al inquilino. Estos son los derechos más importantes que debes conocer:</p>

<ol>
  <li>
    <h3>Derecho a un inmueble habitable</h3>
    <p>El inmueble debe cumplir condiciones mínimas de seguridad, salubridad y confort. Si el propietario no atiende problemas estructurales graves, puedes exigirlo legalmente.</p>
  </li>
  <li>
    <h3>Derecho a la privacidad</h3>
    <p>El propietario <strong>no puede ingresar al inmueble sin tu autorización</strong>, salvo emergencias. Cualquier visita de inspección debe acordarse previamente contigo.</p>
  </li>
  <li>
    <h3>Derecho a un incremento limitado</h3>
    <p>El canon solo puede aumentar una vez al año y nunca más del IPC del año anterior (5,10% para 2026). Ninguna cláusula contractual puede saltarse esta protección legal.</p>
  </li>
  <li>
    <h3>Derecho a terminar el contrato con preaviso</h3>
    <p>Si el contrato no tiene plazo determinado, puedes darte por terminado notificando con <strong>3 meses de anticipación</strong>. Si el propietario quiere darte el apartamento, también debe notificarte con ese tiempo.</p>
  </li>
  <li>
    <h3>Derecho a la devolución de la garantía</h3>
    <p>Al terminar el contrato, si entregaste el inmueble en buen estado, tienes derecho a que te devuelvan el depósito o garantía que entregaste al inicio.</p>
  </li>
</ol>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="tendencias">Tendencia 2026: el auge del micro-living en Medellín</h2>

<p>Una de las transformaciones más marcadas del mercado de arriendo medellín 2026 es el <strong>boom de los apartaestudios y unidades compactas</strong>. La demanda de este tipo de inmueble se <strong>duplicó</strong> en el último año, pasando del 2,8% al 5,7% del total de búsquedas.</p>

<h3>¿Por qué crece el micro-living?</h3>
<ul>
  <li>💻 <strong>Teletrabajo:</strong> Los nómadas digitales y trabajadores remotos priorizan ubicación sobre tamaño</li>
  <li>💰 <strong>Precios más accesibles:</strong> Un apartaestudio bien ubicado en Laureles puede ser más económico que un apartamento de 2 hab. en Robledo</li>
  <li>🌍 <strong>Extranjeros:</strong> La llegada de trabajadores remotos internacionales impulsa la demanda de unidades compactas pero bien equipadas</li>
  <li>👤 <strong>Hogares unipersonales:</strong> El número de personas que viven solas en Medellín creció un 18% en los últimos 5 años</li>
</ul>

<figure>
  <img src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=75&auto=format&fit=crop" alt="Apartaestudio moderno y bien diseñado en Medellín" loading="lazy" class="post-img" />
  <figcaption>Los apartaestudios modernos en zonas estratégicas son la opción con mayor demanda en 2026</figcaption>
</figure>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="faq">Preguntas frecuentes sobre arriendo en Medellín 2026</h2>

<div class="post-faq">

  <details class="post-faq-item" open>
    <summary class="post-faq-q">¿Cuánto es lo máximo que me pueden subir el arriendo en 2026?</summary>
    <div class="post-faq-a">
      <p>El máximo permitido por ley es el <strong>5,10%</strong> (IPC 2025 certificado por el DANE). Este aumento solo puede aplicarse una vez por año, cuando el contrato cumple 12 meses. Si ya te lo aumentaron hace menos de un año, el arrendador no puede volver a hacerlo.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Puedo arrendar sin codeudor?</summary>
    <div class="post-faq-a">
      <p>Sí. Puedes presentar una <strong>póliza de arrendamiento</strong> emitida por una aseguradora como garantía. También algunos propietarios aceptan un depósito en efectivo (1-3 meses de canon). Esto depende de cada arrendador, por lo que vale la pena negociar directamente.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Qué pasa si el propietario no me quiere devolver el depósito?</summary>
    <div class="post-faq-a">
      <p>Si entregaste el inmueble en buen estado y tienes el acta de entrega firmada por ambas partes, tienes derecho legal a que te devuelvan el depósito. Puedes acudir a la <strong>Secretaría de Gobierno Municipal</strong> o a un Centro de Conciliación para resolverlo sin necesidad de ir a juicio.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Cuánto tiempo de anticipación necesito dar para irme?</summary>
    <div class="post-faq-a">
      <p>Si el contrato es a término indefinido o ya venció y se renueva automáticamente, debes dar un <strong>preaviso mínimo de 3 meses</strong>. Si el contrato tiene fecha fija (por ejemplo, 1 año), debes notificar antes de que venza si no quieres renovar. Si terminas el contrato antes de la fecha, pueden cobrarte penalidad.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Es legal que me cobren la cuota de administración a mí como inquilino?</summary>
    <div class="post-faq-a">
      <p>Depende de lo pactado en el contrato. Por ley, la obligación de pagar administración es del propietario, pero es legal acordar contractualmente que la pague el inquilino. Revisa tu contrato antes de firmar para saber qué está incluido en el canon y qué no.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Cuál es el barrio más económico para arrendar en Medellín?</summary>
    <div class="post-faq-a">
      <p>Dentro del perímetro urbano de Medellín, <strong>Robledo, Castilla y Aranjuez</strong> tienen los cánones más bajos. Si amplías la búsqueda al área metropolitana, <strong>Itagüí y San Antonio de Prado</strong> ofrecen buenas opciones por debajo de $1.200.000 mensuales para apartamentos de 2 habitaciones.</p>
    </div>
  </details>

</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2>Conclusión: Arrienda inteligente en Medellín</h2>

<p>El mercado de arriendo en Medellín en 2026 es exigente: precios en alza, poca oferta y mucha competencia. Pero con la información correcta, puedes encontrar el inmueble ideal sin sobrepagar ni firmar contratos que te perjudiquen.</p>

<p>Los puntos clave:</p>
<ul>
  <li>✅ Ten todos los documentos listos antes de buscar (no después)</li>
  <li>✅ El incremento máximo legal en 2026 es del 5,10%</li>
  <li>✅ Sabaneta y Envigado ofrecen la mejor relación precio/calidad del área metro</li>
  <li>✅ Toma fotos del estado del inmueble el día que recibes las llaves</li>
  <li>✅ Lee el contrato completo antes de firmar, especialmente las penalidades</li>
  <li>✅ La Ley 820 de 2003 te protege — úsala a tu favor</li>
</ul>

<div class="post-cta-box">
  <h3>¿Buscas apartamento en arriendo en el sur del área metropolitana?</h3>
  <p>Soy <strong>Alexander Arias</strong>, consultor inmobiliario con amplia experiencia en Sabaneta, Envigado y Medellín. Te ayudo a encontrar el inmueble ideal según tu presupuesto, con todo el respaldo legal y sin complicaciones.</p>
  <a href="https://wa.me/573122588521?text=Hola%20Alex%2C%20leí%20tu%20guía%20de%20arriendo%20en%20Medellín%202026%20y%20necesito%20ayuda%20para%20encontrar%20apartamento" class="post-cta-btn" target="_blank" rel="noopener">
    📲 Hablar con Alex en WhatsApp
  </a>
</div>
`;

// ─── DATOS DEL POST ───────────────────────────────────────────────────────
const postData = {
  title: 'Arriendo en Medellín 2026: Guía Completa para Inquilinos',
  excerpt: 'Precios reales por zona, el incremento máximo legal (5,10%), requisitos, tus derechos y todo lo que debes saber antes de firmar un contrato de arriendo en Medellín este año.',
  content,
  cover: COVER_URL,
  category: 'Arriendo',
  tags: JSON.stringify(['arriendo medellín', 'arrendar apartamento', 'inquilinos colombia', 'precios arriendo 2026', 'ley 820', 'barrios medellín']),
  status: 'published',
  metaTitle: 'Arriendo en Medellín 2026: Precios, Requisitos y Derechos del Inquilino | Alex Arias',
  metaDescription: 'Guía completa de arriendo en Medellín 2026: precios por zona, incremento legal máximo (5,10%), documentos requeridos y derechos del inquilino según la Ley 820.',
  metaKeywords: 'arriendo medellín 2026, precios arriendo medellín, requisitos arrendar medellín, derechos inquilinos colombia, barrios arriendo económico medellín'
};

// ─── ENVIAR A LA API ──────────────────────────────────────────────────────
async function insertPost() {
  const formData = new FormData();
  for (const [key, value] of Object.entries(postData)) {
    formData.append(key, value);
  }

  console.log('📤 Enviando post al servidor...');
  console.log(`🌐 Destino: ${TARGET}`);

  try {
    const response = await fetch(`${TARGET}/api/blog`, {
      method: 'POST',
      headers: {
        'x-admin-password': ADMIN_PASSWORD,
      },
      body: formData
    });

    const result = await response.json();

    if (response.ok) {
      console.log('\n✅ Post creado exitosamente!');
      console.log(`📖 Título: ${result.title}`);
      console.log(`🔗 Slug: ${result.slug}`);
      console.log(`🆔 ID: ${result.id || result._id}`);
      console.log(`\n🌐 Ver en: ${TARGET}/post.html?slug=${result.slug}`);
      console.log(`📝 Ver blog: ${TARGET}/blog`);
    } else {
      console.error('\n❌ Error al crear el post:');
      console.error(result);
    }
  } catch (err) {
    console.error('\n❌ Error de conexión:');
    console.error(err.message);
    console.log('\n💡 Asegúrate de que el servidor esté corriendo en:', TARGET);
  }
}

insertPost();
