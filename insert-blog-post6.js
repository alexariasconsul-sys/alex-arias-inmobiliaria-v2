/**
 * Script para insertar el sexto blog post en alexariasc.com
 * Uso: node insert-blog-post6.js
 */

const TARGET = 'https://alexariasc.com';
const ADMIN_PASSWORD = '50AlexArias_*#';

const COVER_URL = 'https://images.unsplash.com/photo-1560184897-ae75f418493e?w=1200&q=80&auto=format&fit=crop';

const content = `
<p class="post-intro">Hay dos tipos de colombianos: los que creen que <strong>"el arriendo es tirar plata"</strong> y los que creen que comprar con crédito al 13% es la trampa más cara del mercado. Ambos tienen parte de razón. En 2026, con Mi Casa Ya suspendido, tasas hipotecarias en máximos y por primera vez más arrendatarios que propietarios en el país, esta decisión merece números reales — no intuición ni consejos de abuelos.</p>

<nav class="post-toc" aria-label="Tabla de contenidos">
  <h2 class="post-toc-title">📋 Contenido</h2>
  <ol class="post-toc-list">
    <li><a href="#mito">"El arriendo es tirar plata": el mito que hay que enterrar</a></li>
    <li><a href="#credito">Lo que realmente cuesta un crédito hipotecario hoy</a></li>
    <li><a href="#micasaya">Mi Casa Ya en 2026: la realidad que nadie dice</a></li>
    <li><a href="#subsidios">Subsidios que SÍ están disponibles en 2026</a></li>
    <li><a href="#calculadora">La calculadora: ¿cuándo conviene cada opción?</a></li>
    <li><a href="#factores">Los factores que los números no miden</a></li>
    <li><a href="#veredicto">El veredicto: quién debería comprar y quién arrendar</a></li>
    <li><a href="#faq">Preguntas frecuentes</a></li>
  </ol>
</nav>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="mito">"El arriendo es tirar plata": el mito que hay que enterrar</h2>

<p>Esta frase la ha dicho casi todo papá colombiano en algún almuerzo familiar. Y es comprensible — viene de una época en que los créditos eran más baratos, los inmuebles más accesibles y la inflación más predecible. Pero en 2026, repitirla sin hacer los números es un error.</p>

<h3>Lo que el argumento ignora</h3>
<ul>
  <li>💸 <strong>Los intereses del crédito también son "plata tirada":</strong> En un crédito de $200 millones a 20 años al 13% E.A., pagas aproximadamente <strong>$280 millones en intereses</strong> — además del capital. ¿Eso no es también "tirar plata"?</li>
  <li>🔧 <strong>Los costos ocultos de ser propietario:</strong> Predial, administración, mantenimiento, seguros — suman entre el 1,5% y el 2,5% del valor del inmueble anual. El arrendatario no paga nada de eso.</li>
  <li>📈 <strong>El costo de oportunidad:</strong> La cuota inicial que metes al apartamento podría estar generando rendimientos en otros instrumentos. Ese dinero tiene un costo aunque no lo sientas.</li>
  <li>🔑 <strong>La libertad tiene valor:</strong> El arrendatario puede cambiar de ciudad, de barrio, de estilo de vida. El propietario con crédito tiene una hipoteca atada a un lugar específico por 15-20 años.</li>
</ul>

<blockquote class="post-tip">
  <strong>📊 Dato que sorprende:</strong> En Colombia, por primera vez en la historia, hay más hogares viviendo en arriendo (7,3 millones) que en vivienda propia (7,1 millones). No es que todos estén "tirando plata" — muchos han hecho los números y decidieron que arrendar es la mejor decisión financiera para su momento de vida.
</blockquote>

<figure>
  <img src="https://images.unsplash.com/photo-1582407947304-fd86f28f1e34?w=800&q=75&auto=format&fit=crop" alt="Familia colombiana evaluando opciones de vivienda entre comprar y arrendar" loading="lazy" class="post-img" />
  <figcaption>La decisión entre comprar y arrendar debe basarse en números reales, no en mitos heredados</figcaption>
</figure>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="credito">Lo que realmente cuesta un crédito hipotecario en 2026</h2>

<p>Las tasas hipotecarias actuales están entre las más altas de los últimos años. Esto cambia radicalmente el análisis de "mejor comprar".</p>

<h3>Ejemplo real: apartamento de $300 millones en Sabaneta</h3>

<div class="post-table-wrap">
<table class="post-table">
  <thead>
    <tr>
      <th>Concepto</th>
      <th>Valor</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Precio del inmueble</td>
      <td>$300.000.000</td>
    </tr>
    <tr>
      <td>Cuota inicial (30%)</td>
      <td>$90.000.000</td>
    </tr>
    <tr>
      <td>Monto financiado (70%)</td>
      <td>$210.000.000</td>
    </tr>
    <tr>
      <td>Tasa de interés referencia</td>
      <td>13% E.A.</td>
    </tr>
    <tr>
      <td>Plazo</td>
      <td>20 años (240 cuotas)</td>
    </tr>
    <tr>
      <td><strong>Cuota mensual aprox.</strong></td>
      <td><strong>$2.460.000</strong></td>
    </tr>
    <tr>
      <td>Total pagado en 20 años</td>
      <td>$590.400.000</td>
    </tr>
    <tr>
      <td>Total intereses pagados</td>
      <td><strong>$290.400.000</strong></td>
    </tr>
  </tbody>
</table>
</div>

<p>Ese apartamento de $300 millones termina costándote <strong>$590 millones</strong> al cabo de 20 años (cuota inicial + crédito completo). Mientras tanto, arrendar un inmueble equivalente en Sabaneta cuesta hoy alrededor de $1.700.000 mensuales.</p>

<blockquote class="post-tip">
  <strong>🧮 La comparación directa:</strong> Cuota mensual crédito = $2.460.000 / Arriendo equivalente = $1.700.000. <strong>Diferencia mensual: $760.000</strong> que el arrendatario puede invertir o ahorrar cada mes durante esos 20 años. A una tasa conservadora del 8% anual, esos $760.000 mensuales se convierten en aproximadamente <strong>$455 millones</strong> al final del período.
</blockquote>

<h3>¿Entonces comprar no conviene?</h3>
<p>No es eso. El propietario al final de 20 años tiene un activo que se valorizó. Si el apartamento creció al 8% anual, ese bien que compró en $300 millones hoy vale aproximadamente <strong>$1.400 millones</strong>. El arrendatario tiene $455 millones en inversiones pero no tiene el inmueble. La finca raíz gana — pero la diferencia es mucho menor de lo que la gente cree, y el camino es más costoso de lo que parece.</p>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="micasaya">Mi Casa Ya en 2026: la realidad que nadie te dice</h2>

<p>Si estabas esperando el subsidio de Mi Casa Ya para comprar tu apartamento, esta es la noticia que debes conocer: <strong>el programa está suspendido en 2026.</strong></p>

<h3>¿Qué pasó con Mi Casa Ya?</h3>
<ul>
  <li>❌ El Gobierno Nacional confirmó que <strong>no hay presupuesto asignado</strong> para Mi Casa Ya en la vigencia 2026</li>
  <li>⏸️ No se están abriendo nuevas inscripciones ni asignando nuevos cupos</li>
  <li>📋 Los beneficiarios que ya tenían cupo asignado pueden continuar su proceso, pero no hay nuevos beneficiarios</li>
  <li>🗳️ El tema se convirtió en uno de los ejes del debate presidencial — varios candidatos proponen reactivarlo o reemplazarlo</li>
</ul>

<blockquote class="post-tip">
  <strong>⚠️ Importante:</strong> Si alguien te ofrece "gestionar" un cupo de Mi Casa Ya en 2026 a cambio de dinero, es una estafa. No hay cupos disponibles. Verifica siempre en el sitio oficial del Ministerio de Vivienda: <strong>minvivienda.gov.co</strong>
</blockquote>

<figure>
  <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=75&auto=format&fit=crop" alt="Edificios de vivienda de interés social VIS en Colombia" loading="lazy" class="post-img" />
  <figcaption>Los programas de subsidio de vivienda VIS han sufrido cambios significativos en 2026</figcaption>
</figure>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="subsidios">Subsidios de vivienda que SÍ están disponibles en 2026</h2>

<p>Mi Casa Ya no es la única opción. Estos programas sí están activos:</p>

<div class="post-zones-grid">

  <div class="post-zone-card">
    <h3>🏦 Cajas de Compensación</h3>
    <p>Disponible para trabajadores formales afiliados con ingresos <strong>hasta 4 SMMLV ($7.003.620)</strong>. Aplican para compra, construcción o mejora. Consulta en tu caja: Comfama, Confama, Comfenalco Antioquia.</p>
  </div>

  <div class="post-zone-card">
    <h3>📋 Fondo Nacional del Ahorro (FNA)</h3>
    <p>Si tienes <strong>cesantías en el FNA</strong>, puedes usarlas como cuota inicial y acceder a crédito hipotecario con tasas preferenciales. Actualmente entre las más bajas del mercado (~10,9% E.A.).</p>
  </div>

  <div class="post-zone-card">
    <h3>🏠 Cobertura a la tasa (Frech)</h3>
    <p>Para VIS (hasta $262M) puede aplicar cobertura que reduce la tasa efectiva del crédito. Pregunta en tu banco si el proyecto que te interesa está vinculado a esta cobertura.</p>
  </div>

  <div class="post-zone-card">
    <h3>🌿 Mi Casa Ya Departamental</h3>
    <p>Algunos departamentos y municipios tienen programas propios de subsidio. En Antioquia, consulta la Gobernación y el ISVIMED para subsidios complementarios disponibles.</p>
  </div>

</div>

<h3>Requisitos generales para subsidios de cajas (2026)</h3>
<ul>
  <li>☑️ Estar afiliado a una caja de compensación familiar</li>
  <li>☑️ Ingresos familiares no superiores a 4 SMMLV</li>
  <li>☑️ No ser propietario de vivienda en Colombia</li>
  <li>☑️ No haber sido beneficiario de subsidio de vivienda antes</li>
  <li>☑️ Tener capacidad de pago demostrable para el crédito hipotecario</li>
</ul>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="calculadora">La calculadora: ¿cuándo conviene cada opción?</h2>

<p>No hay una respuesta universal. Pero hay condiciones claras que hacen que una opción gane sobre la otra.</p>

<h3>Comprar conviene más cuando...</h3>
<ul>
  <li>✅ <strong>Tienes la cuota inicial completa sin endeudarte</strong> (mínimo 30% del valor)</li>
  <li>✅ <strong>Vas a vivir en esa ciudad por más de 7 años</strong> — el break-even financiero suele estar entre 5 y 8 años</li>
  <li>✅ <strong>Puedes financiar máximo el 50-60%</strong> con las tasas actuales</li>
  <li>✅ <strong>La cuota del crédito no supera el 30% de tus ingresos netos</strong></li>
  <li>✅ <strong>Compras en zona con demanda de arriendo probada</strong> — si un día no puedes pagar, lo arriendas</li>
  <li>✅ <strong>Tienes estabilidad laboral y familiar</strong> — familia en crecimiento, trabajo estable en la ciudad</li>
</ul>

<h3>Arrendar conviene más cuando...</h3>
<ul>
  <li>✅ <strong>No tienes cuota inicial disponible</strong> sin comprometer tu fondo de emergencia</li>
  <li>✅ <strong>Tu trabajo puede implicar cambio de ciudad</strong> en los próximos años</li>
  <li>✅ <strong>Puedes invertir la diferencia entre el arriendo y lo que sería la cuota del crédito</strong> con disciplina real</li>
  <li>✅ <strong>Estás en una etapa de definición</strong> — pareja, familia, carrera aún en construcción</li>
  <li>✅ <strong>El arriendo del inmueble que necesitas es significativamente más barato que la cuota hipotecaria equivalente</strong></li>
</ul>

<blockquote class="post-tip">
  <strong>📐 La regla de los 200:</strong> Divide el precio del inmueble por el canon mensual de arriendo equivalente. Si el resultado es menor a 200, comprar es más eficiente. Si es mayor a 200, arrendar y en invertir la diferencia puede ser mejor estrategia. Ejemplo: apartamento $300M / canon $1.700.000 = 176. En este caso, la compra tiene sentido financiero si te quedas el tiempo suficiente.
</blockquote>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="factores">Los factores que los números no miden</h2>

<p>La decisión de comprar vivienda no es solo financiera. Hay elementos que ninguna calculadora captura:</p>

<ul>
  <li>🏡 <strong>Estabilidad y arraigo:</strong> Tener casa propia da una sensación de permanencia y seguridad que para muchas familias vale más que cualquier rendimiento financiero.</li>
  <li>🎨 <strong>Libertad de modificación:</strong> ¿Quieres pintar las paredes, remodelar la cocina, poner pisos nuevos? Solo puedes hacerlo libremente si eres propietario.</li>
  <li>👶 <strong>Estabilidad familiar:</strong> Tener hijos en edad escolar en un colegio fijo, vecindario conocido y red de apoyo cercana tiene un valor inmenso que el análisis financiero no captura.</li>
  <li>😰 <strong>El riesgo del arrendatario:</strong> El propietario puede pedirte el inmueble con 3 meses de preaviso. El propietario no tiene esa incertidumbre.</li>
  <li>🧓 <strong>La vejez y el patrimonio:</strong> Llegar a los 65 años sin pagar arriendo — solo administración y predial — cambia radicalmente la calidad de vida en la jubilación.</li>
</ul>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="veredicto">El veredicto: quién debería comprar y quién debería arrendar</h2>

<div class="post-zones-grid">

  <div class="post-zone-card">
    <h3>🏠 Deberías comprar si...</h3>
    <p>Tienes 30+ años, familia establecida, trabajo estable en la ciudad, cuota inicial disponible, y planeas quedarte mínimo 7 años. En ese escenario, comprar es la decisión correcta aunque las tasas estén altas.</p>
  </div>

  <div class="post-zone-card">
    <h3>🔑 Deberías arrendar si...</h3>
    <p>Tienes menos de 30 años, estás en etapa de crecimiento profesional, no tienes cuota inicial sin endeudarte, o hay posibilidad de cambio de ciudad. Arrendar + invertir la diferencia puede ser igual o más rentable.</p>
  </div>

  <div class="post-zone-card">
    <h3>💼 Deberías comprar para invertir si...</h3>
    <p>Tienes capital disponible para cuota inicial, no necesitas vivir en el inmueble, y la zona tiene demanda de arriendo probada. La rentabilidad combinada (valorización + renta) suele superar otras alternativas a largo plazo.</p>
  </div>

  <div class="post-zone-card">
    <h3>⏳ Deberías esperar si...</h3>
    <p>Las tasas actuales hacen tu cuota inviable, no tienes cuota inicial completa, o el mercado de la zona que te interesa tiene sobreoferta. Mejor prepararse bien y entrar cuando las condiciones mejoren.</p>
  </div>

</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="faq">Preguntas frecuentes</h2>

<div class="post-faq">

  <details class="post-faq-item" open>
    <summary class="post-faq-q">¿Cuándo volverá Mi Casa Ya?</summary>
    <div class="post-faq-a">
      <p>No hay fecha confirmada de reapertura para 2026. El programa quedó como tema central del debate presidencial y la posibilidad de que regrese o sea reemplazado depende del próximo gobierno (elecciones 2026). Por ahora, la recomendación es explorar las alternativas disponibles: cajas de compensación, FNA y coberturas de tasa.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Puedo comprar vivienda VIS sin Mi Casa Ya en 2026?</summary>
    <div class="post-faq-a">
      <p>Sí. La vivienda VIS sigue existiendo — lo que está suspendido es el subsidio gubernamental de Mi Casa Ya. Puedes comprar VIS con crédito hipotecario normal, usando cesantías del FNA, o aplicando al subsidio de tu caja de compensación familiar si eres trabajador formal con ingresos hasta 4 SMMLV.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Cuánta cuota inicial necesito para comprar en 2026?</summary>
    <div class="post-faq-a">
      <p>Los bancos financian máximo el <strong>70% del valor</strong> para vivienda No VIS y hasta el <strong>80% para VIS</strong>. Eso significa que necesitas tener disponibles entre el 20% y el 30% del precio del inmueble como cuota inicial, más los gastos de escrituración y registro (2–3% adicional). Para un apartamento de $300M en Sabaneta, necesitas tener listos entre $90M y $99M antes de empezar el proceso.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Conviene comprar en planos para ahorrar en la cuota inicial?</summary>
    <div class="post-faq-a">
      <p>Sí, es una estrategia válida. En proyectos en planos pagas la cuota inicial en cuotas durante la construcción (18-36 meses), lo que te da tiempo de acumular. Además, el precio de lanzamiento suele ser 10-20% más bajo que al entregar. El riesgo es que la constructora tenga problemas o el proyecto se retrase — por eso es crítico verificar la trayectoria de la constructora y el estado de la licencia antes de comprometerte.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Es verdad que arrendar es siempre más barato que pagar un crédito?</summary>
    <div class="post-faq-a">
      <p>En la mayoría de casos en 2026, sí: la cuota del crédito hipotecario equivalente suele ser entre un 30% y un 60% más alta que el canon de arriendo. Sin embargo, esa diferencia hay que analizarla junto con la valorización del activo y el efecto a largo plazo. Arrendar puede ser más barato mes a mes, pero comprar construye patrimonio. La clave está en qué haces con la diferencia de dinero mensual.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Cómo sé si un proyecto VIS califica para cobertura de tasa?</summary>
    <div class="post-faq-a">
      <p>Pregunta directamente al banco o al promotor del proyecto si está vinculado al programa FRECH (Fondo de Reserva para la Estabilización de Cartera Hipotecaria). Normalmente los proyectos VIS certificados y registrados ante el Ministerio de Vivienda tienen acceso. La cobertura puede reducir la tasa efectiva entre 2 y 5 puntos porcentuales, lo que cambia significativamente el costo del crédito.</p>
    </div>
  </details>

</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2>Conclusión: no hay respuesta única, hay la respuesta correcta para tu momento</h2>

<p>El error más grande al tomar esta decisión es hacerla con base en lo que hizo tu papá, lo que dice tu cuñado o lo que está de moda en redes sociales. <strong>La decisión correcta depende de tu situación específica</strong>: tus ingresos, tu capital disponible, tu horizonte de tiempo y tu momento de vida.</p>

<p>Lo que sí es claro en 2026:</p>
<ul>
  <li>📌 Comprar con tasas al 13% es costoso — los números deben cerrar antes de firmar</li>
  <li>📌 Arrendar no es "tirar plata" si inviertes la diferencia con disciplina</li>
  <li>📌 Mi Casa Ya está suspendido — explora las alternativas disponibles</li>
  <li>📌 La finca raíz sigue siendo el mejor vehículo de construcción de patrimonio a largo plazo en Colombia</li>
  <li>📌 La zona correcta sigue siendo más importante que cualquier otra variable</li>
</ul>

<div class="post-cta-box">
  <h3>¿Necesitas que alguien te ayude a hacer los números por tu caso específico?</h3>
  <p>Soy <strong>Alexander Arias</strong>, consultor inmobiliario en Sabaneta, Envigado y Medellín. Te ayudo a analizar si comprar o seguir arrendando es la mejor decisión para tu momento actual — con números reales, sin presión de venta.</p>
  <a href="https://wa.me/573122588521?text=Hola%20Alex%2C%20leí%20tu%20artículo%20sobre%20comprar%20vs%20arrendar%20en%202026%20y%20quiero%20analizar%20mi%20caso" class="post-cta-btn" target="_blank" rel="noopener">
    📲 Analizar mi caso con Alex
  </a>
</div>
`;

const postData = {
  title: '¿Comprar o Arrendar en Colombia en 2026? La Guía con Números Reales',
  excerpt: 'Mi Casa Ya está suspendido, las tasas hipotecarias están al 13% y por primera vez hay más arrendatarios que propietarios en Colombia. ¿Sigue siendo mejor comprar? Te damos los números reales para que decidas sin mitos.',
  content,
  cover: COVER_URL,
  category: 'Consejos',
  tags: JSON.stringify(['comprar o arrendar', 'mi casa ya 2026', 'subsidio vivienda colombia', 'crédito hipotecario', 'VIS 2026', 'vivienda colombia']),
  status: 'published',
  metaTitle: '¿Comprar o Arrendar en Colombia en 2026? Guía con Números Reales | Alex Arias',
  metaDescription: 'Mi Casa Ya suspendido, tasas al 13% y más arrendatarios que propietarios en Colombia. Analizamos cuándo conviene comprar y cuándo es mejor arrendar en 2026 con números reales.',
  metaKeywords: 'comprar o arrendar colombia 2026, mi casa ya suspendido 2026, subsidio vivienda 2026, credito hipotecario colombia, VIS 2026 requisitos'
};

async function insertPost() {
  const formData = new FormData();
  for (const [key, value] of Object.entries(postData)) {
    formData.append(key, value);
  }
  console.log('📤 Enviando post al servidor...');
  try {
    const response = await fetch(`${TARGET}/api/blog`, {
      method: 'POST',
      headers: { 'x-admin-password': ADMIN_PASSWORD },
      body: formData
    });
    const result = await response.json();
    if (response.ok) {
      console.log('\n✅ Post creado exitosamente!');
      console.log(`📖 Título: ${result.title}`);
      console.log(`🔗 Slug: ${result.slug}`);
      console.log(`\n🌐 Ver en: ${TARGET}/post.html?slug=${result.slug}`);
    } else {
      console.error('\n❌ Error:', result);
    }
  } catch (err) {
    console.error('\n❌ Error de conexión:', err.message);
  }
}

insertPost();
