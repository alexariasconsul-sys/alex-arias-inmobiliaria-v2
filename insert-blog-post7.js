/**
 * Script para insertar el séptimo blog post en alexariasc.com
 * Uso: node insert-blog-post7.js
 */

const TARGET = 'https://alexariasc.com';
const ADMIN_PASSWORD = '50AlexArias_*#';

const COVER_URL = 'https://images.unsplash.com/photo-1599940778173-e276d4acb2bb?w=1200&q=80&auto=format&fit=crop';

const content = `
<p class="post-intro">Medellín recibe más de <strong>8.000 nómadas digitales al mes</strong>. Los arriendos en algunas zonas subieron hasta un <strong>81%</strong> en los últimos años. Y por primera vez, Medellín superó a Bogotá como la ciudad más costosa del país para arrendar vivienda. ¿Son los extranjeros los culpables? ¿O hay algo más detrás? Este es el análisis que nadie quiere dar porque incomoda a todos los lados.</p>

<nav class="post-toc" aria-label="Tabla de contenidos">
  <h2 class="post-toc-title">📋 Contenido</h2>
  <ol class="post-toc-list">
    <li><a href="#fenomeno">El fenómeno: Medellín como destino global</a></li>
    <li><a href="#numeros">Los números que duelen</a></li>
    <li><a href="#airbnb">El efecto Airbnb: el elefante en la habitación</a></li>
    <li><a href="#culpables">¿Quién tiene la culpa realmente?</a></li>
    <li><a href="#zonas">Las zonas más afectadas y las que aún resisten</a></li>
    <li><a href="#locales">¿Qué pueden hacer los residentes locales?</a></li>
    <li><a href="#oportunidad">La otra cara: la oportunidad para propietarios</a></li>
    <li><a href="#faq">Preguntas frecuentes</a></li>
  </ol>
</nav>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="fenomeno">El fenómeno: Medellín como destino global</h2>

<p>En menos de una década, Medellín pasó de ser una ciudad que el mundo miraba con miedo a convertirse en <strong>uno de los destinos más deseados del planeta para trabajar de forma remota</strong>. El clima eterno de primavera, el costo de vida (comparado con Europa o EE.UU.), la gastronomía, la cultura y la conectividad crearon la tormenta perfecta.</p>

<ul>
  <li>🌍 <strong>8.000+ nómadas digitales al mes</strong> llegan a Medellín, según cifras de gremios de hospitalidad</li>
  <li>💵 <strong>Ingresos en dólares, gastos en pesos:</strong> un nómada digital que gana $3.000 USD puede pagar fácilmente $4.000.000 de arriendo mensual — lo que para él es el 20% de su salario</li>
  <li>✈️ <strong>Vuelos directos desde más de 40 ciudades</strong> del mundo facilitan la llegada</li>
  <li>📱 <strong>Comunidades globales activas:</strong> grupos de Nomad List, Reddit y Facebook con miles de miembros recomiendan Medellín como destino top</li>
  <li>🏙️ <strong>Infraestructura digital:</strong> coworkings, internet de fibra, cafés con buena conexión hacen viable el trabajo remoto</li>
</ul>

<p>El resultado: una presión de demanda sobre el mercado de vivienda que la ciudad no estaba preparada para absorber.</p>

<figure>
  <img src="https://images.unsplash.com/photo-1527030280862-64139fba04ca?w=800&q=75&auto=format&fit=crop" alt="Nómada digital trabajando en un café de Medellín Colombia con laptop" loading="lazy" class="post-img" />
  <figcaption>Medellín se consolidó como uno de los destinos preferidos del mundo para el trabajo remoto</figcaption>
</figure>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="numeros">Los números que duelen</h2>

<p>Los datos hablan por sí solos y son difíciles de ignorar:</p>

<div class="post-table-wrap">
<table class="post-table">
  <thead>
    <tr>
      <th>Indicador</th>
      <th>Dato</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Aumento de arriendos en zonas de alta demanda</td>
      <td><strong>Hasta 81%</strong> en los últimos 4 años</td>
    </tr>
    <tr>
      <td>Inflación acumulada Medellín (4 años)</td>
      <td><strong>36,7%</strong></td>
    </tr>
    <tr>
      <td>Incremento real de arriendos (por encima de inflación)</td>
      <td><strong>+44 puntos</strong> en zonas calientes</td>
    </tr>
    <tr>
      <td>Crecimiento de propiedades Airbnb (2020–2023)</td>
      <td><strong>+66%</strong></td>
    </tr>
    <tr>
      <td>Nómadas digitales mensuales estimados</td>
      <td><strong>8.000+</strong></td>
    </tr>
    <tr>
      <td>Déficit habitacional en Medellín</td>
      <td><strong>37.000 familias</strong> sin vivienda adecuada</td>
    </tr>
    <tr>
      <td>Ranking costo de arriendo en Colombia</td>
      <td><strong>#1 Medellín</strong> (superó a Bogotá)</td>
    </tr>
  </tbody>
</table>
</div>

<blockquote class="post-tip">
  <strong>💥 El dato que más impacta:</strong> La inflación acumulada en Medellín en 4 años fue del 36,7%. Los arriendos en zonas como El Poblado y Laureles subieron hasta el 81%. Eso significa que los arriendos subieron el <strong>doble de la inflación</strong> en esas zonas. Algo estructural está pasando.
</blockquote>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="airbnb">El efecto Airbnb: el elefante en la habitación</h2>

<p>Mientras los nómadas digitales son visibles y fáciles de señalar, hay un fenómeno más silencioso pero igual de poderoso: <strong>la conversión masiva de apartamentos residenciales en alojamientos turísticos de corto plazo</strong>.</p>

<h3>¿Qué está pasando?</h3>
<ul>
  <li>🏠 <strong>Propietarios que retiran sus inmuebles del mercado de arriendo</strong> para ponerlos en Airbnb, donde pueden cobrar entre 3 y 6 veces más por el mismo inmueble</li>
  <li>📉 <strong>Esto reduce la oferta de arriendo residencial</strong> disponible para familias locales</li>
  <li>💸 <strong>Un apartamento en El Poblado</strong> que arrienda por $3.500.000 mensuales puede generar $6.000.000–$9.000.000 en Airbnb con buena ocupación</li>
  <li>🔄 <strong>La competencia sube los precios para todos:</strong> los residentes locales compiten con turistas que pagan en dólares</li>
</ul>

<h3>Los números del fenómeno Airbnb en Medellín</h3>
<ul>
  <li>📊 Las propiedades listadas en Airbnb crecieron un <strong>66% entre 2020 y 2023</strong></li>
  <li>🗺️ <strong>El Poblado concentra la mayoría</strong> de unidades turísticas, pero Laureles y el centro histórico están siguiendo la misma tendencia</li>
  <li>⚖️ Actualmente no existe regulación municipal efectiva que limite la cantidad de unidades residenciales que pueden operar como alojamiento turístico</li>
</ul>

<blockquote class="post-tip">
  <strong>🤔 La paradoja del propietario:</strong> No se puede culpar al propietario por maximizar su rentabilidad. Pero el efecto agregado de miles de propietarios tomando esa misma decisión transforma el mercado residencial. Esto ya ocurrió en ciudades como Barcelona, Lisboa y Ciudad de México — Medellín está siguiendo el mismo camino.
</blockquote>

<figure>
  <img src="https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&q=75&auto=format&fit=crop" alt="Apartamento moderno en El Poblado Medellín disponible en plataformas de renta corta" loading="lazy" class="post-img" />
  <figcaption>La conversión de apartamentos residenciales en alojamientos turísticos reduce la oferta disponible para familias locales</figcaption>
</figure>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="culpables">¿Quién tiene la culpa realmente?</h2>

<p>Esta es la pregunta que divide opiniones. La respuesta incómoda es que <strong>no hay un solo culpable — hay un sistema completo que está fallando</strong>.</p>

<h3>Lo que sí hacen los nómadas y el turismo</h3>
<ul>
  <li>⬆️ Aumentan la demanda de vivienda de corto plazo en zonas específicas</li>
  <li>⬆️ Tienen mayor capacidad de pago que los residentes locales</li>
  <li>⬆️ Incentivan la conversión de unidades residenciales a turísticas</li>
  <li>⬆️ Elevan el "precio de referencia" que los propietarios esperan cobrar</li>
</ul>

<h3>Lo que NO es culpa de los extranjeros</h3>
<ul>
  <li>❌ El <strong>déficit habitacional previo</strong> de 37.000 familias — ese problema existía antes de que llegara el primer nómada digital</li>
  <li>❌ La <strong>escasa construcción de VIS</strong> en zonas céntricas por falta de suelo disponible</li>
  <li>❌ La <strong>ausencia de regulación</strong> municipal sobre alojamientos turísticos</li>
  <li>❌ La <strong>especulación inmobiliaria local</strong> — muchos propietarios colombianos suben precios independientemente de los extranjeros</li>
  <li>❌ El <strong>rezago histórico en política de vivienda</strong> social en Colombia</li>
</ul>

<blockquote class="post-tip">
  <strong>📢 Lo que dijo el Alcalde de Medellín:</strong> Las autoridades municipales reconocieron que la gentrificación es un fenómeno complejo que no puede atribuirse solo a los nómadas digitales. El presidente Petro también señaló el problema, responsabilizando tanto a los constructores como a la falta de regulación. El consenso técnico: los extranjeros son un <em>acelerador</em>, no la causa raíz.
</blockquote>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="zonas">Las zonas más afectadas y las que aún resisten</h2>

<p>La gentrificación no afecta a Medellín de forma uniforme. Hay zonas en crisis y zonas que aún ofrecen opciones razonables para residentes locales:</p>

<div class="post-zones-grid">

  <div class="post-zone-card">
    <h3>🔴 El Poblado – Máxima presión</h3>
    <p>Epicentro del turismo y los nómadas. Arriendos para extranjeros en dólares. Apartamentos de 2 hab. superan los $5.000.000 mensuales fácilmente. Para residentes locales de ingresos medios: prácticamente inaccesible.</p>
  </div>

  <div class="post-zone-card">
    <h3>🟠 Laureles / Estadio – Presión alta</h3>
    <p>Segunda zona más afectada. El mercado de nómadas se expande desde El Poblado hacia aquí. Arriendos subieron 50–60% en 3 años. Aún hay oferta para locales, pero el margen se cierra.</p>
  </div>

  <div class="post-zone-card">
    <h3>🟡 Sabaneta / Envigado – Presión media</h3>
    <p>El impacto llega con menor intensidad. Siguen siendo opciones viables para familias locales. El efecto spillover del Poblado empuja algunos nómadas hacia acá, pero el volumen es manejable.</p>
  </div>

  <div class="post-zone-card">
    <h3>🟢 Belén / Robledo / Castilla – Resistencia alta</h3>
    <p>Menor presencia turística. Precios más estables y accesibles para residentes locales. El nómada digital raramente busca estas zonas. Son el refugio real para quienes necesitan opciones razonables.</p>
  </div>

</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="locales">¿Qué pueden hacer los residentes locales?</h2>

<p>Si eres residente de Medellín buscando apartamento en un mercado cada vez más difícil, estas son estrategias concretas:</p>

<ol>
  <li>
    <h3>Amplía el radio de búsqueda</h3>
    <p>El área metropolitana ofrece municipios con muy buena calidad de vida y precios hasta un 40% más bajos que El Poblado o Laureles: <strong>Sabaneta, Envigado, La Estrella e Itagüí</strong> tienen conexión de metro, servicios completos y menor presión de nómadas.</p>
  </li>
  <li>
    <h3>Busca directamente con propietarios</h3>
    <p>Los propietarios que arriendan directamente, sin inmobiliaria y sin enfocarse en el mercado turístico, suelen tener precios más razonables. Grupos de Facebook locales, voz a voz y avisos en edificios son mejores opciones que los portales donde compites con turistas.</p>
  </li>
  <li>
    <h3>Firma contratos de largo plazo</h3>
    <p>Un propietario que quiere estabilidad puede preferir un contrato de 2 años a buen precio en lugar de la inestabilidad del turismo de corto plazo. El arriendo residencial tiene menos desgaste del inmueble y más certeza de ingresos. Eso tiene valor y puedes negociarlo.</p>
  </li>
  <li>
    <h3>Considera zonas en desarrollo</h3>
    <p>Barrios en transformación — como algunos sectores de Aranjuez, Manrique o la zona de influencia del tranvía — pueden tener precios accesibles hoy y mejorar en calidad en los próximos años.</p>
  </li>
</ol>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="oportunidad">La otra cara: la oportunidad para propietarios</h2>

<p>El mismo fenómeno que complica la vida del arrendatario crea una oportunidad real para el propietario o inversor inmobiliario que sabe posicionarse:</p>

<ul>
  <li>💰 <strong>Arriendo de corto plazo:</strong> Un apartamento bien ubicado en Laureles puede generar el doble por Airbnb que por arriendo tradicional — si tienes el capital y la disposición para administrarlo</li>
  <li>📈 <strong>Valorización acelerada:</strong> Las zonas con alta demanda turística se valorizan más rápido. Comprar hoy en una zona que está en proceso de "turistificación" puede ser muy rentable a 5 años</li>
  <li>🏢 <strong>Coliving y arriendo por habitaciones:</strong> El modelo de coliving (arrendar habitaciones individuales a nómadas) puede multiplicar la renta de un inmueble x2 o x3 frente al arriendo familiar tradicional</li>
  <li>🔄 <strong>Gestión mixta:</strong> Algunos propietarios combinan temporadas altas en Airbnb con arriendo de largo plazo en temporadas bajas, optimizando la ocupación y el ingreso</li>
</ul>

<blockquote class="post-tip">
  <strong>⚖️ El dilema ético del propietario:</strong> Maximizar rentabilidad vs contribuir al problema de acceso a vivienda. No hay respuesta fácil. Pero conocer el fenómeno permite tomar decisiones informadas — y si decides hacer arriendo tradicional, saber que tu precio de referencia ha cambiado.
</blockquote>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="faq">Preguntas frecuentes</h2>

<div class="post-faq">

  <details class="post-faq-item" open>
    <summary class="post-faq-q">¿Es ilegal arrendar un apartamento en Airbnb en Medellín?</summary>
    <div class="post-faq-a">
      <p>No es ilegal, pero hay restricciones. Muchos reglamentos de propiedad horizontal <strong>prohíben expresamente</strong> el arriendo turístico de corto plazo. Si el reglamento de tu edificio lo prohíbe y lo haces igual, el conjunto puede sancionarte. Adicionalmente, la actividad puede generar obligaciones tributarias (IVA, declaración de renta). Antes de poner tu apartamento en Airbnb, revisa el reglamento de propiedad horizontal y consulta con un contador.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Medellín va a regular los alojamientos turísticos como Barcelona o Lisboa?</summary>
    <div class="post-faq-a">
      <p>Está en debate. El Concejo de Medellín ha discutido proyectos de acuerdo para regular el alojamiento turístico, pero a mayo de 2026 no existe aún una norma municipal efectiva que limite la cantidad de unidades o su operación. La presión ciudadana y la crisis de vivienda hacen probable que alguna regulación llegue en los próximos años.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Los nómadas digitales pagan impuestos en Colombia?</summary>
    <div class="post-faq-a">
      <p>Depende de cuánto tiempo permanezcan. Quien pasa más de <strong>183 días en Colombia en un período de 365</strong> se convierte en residente fiscal y debe declarar renta sobre sus ingresos globales. Muchos nómadas hacen "visa runs" o rotan entre países precisamente para evitar esto. El gobierno colombiano ha discutido una visa de nómada digital específica con condiciones tributarias claras, pero a 2026 no existe aún.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Conviene arrendar mi apartamento en Airbnb en lugar de arriendo tradicional?</summary>
    <div class="post-faq-a">
      <p>Los ingresos pueden ser 2-3 veces mayores, pero los costos y el esfuerzo también aumentan: limpieza frecuente, desgaste del inmueble, atención a huéspedes, gestión de plataforma, temporadas bajas. La rentabilidad neta real suele ser entre 30% y 60% más alta que el arriendo tradicional — no el triple. Además, si el reglamento de tu edificio lo prohíbe, el riesgo legal puede neutralizar la ventaja financiera.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿En qué zonas de Medellín puedo encontrar arriendo accesible en 2026?</summary>
    <div class="post-faq-a">
      <p>Para presupuestos ajustados, las mejores opciones siguen siendo <strong>Belén, La América, Robledo, Castilla y Aranjuez</strong> dentro de Medellín. En el área metropolitana, <strong>Itagüí, La Estrella y San Antonio de Prado</strong> ofrecen buena calidad de vida a precios significativamente más bajos que las zonas afectadas por el turismo. La clave: alejarse del corredor El Poblado–Laureles donde se concentra la presión de nómadas.</p>
    </div>
  </details>

</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2>El fondo del asunto</h2>

<p>Medellín tiene un problema de vivienda que viene de décadas atrás. Los nómadas digitales y el turismo lo aceleraron, lo hicieron visible y lo pusieron en los titulares. Pero el déficit habitacional, la falta de regulación del suelo urbano y la ausencia de política de vivienda asequible son problemas que existían antes y que seguirán existiendo si no se abordan de raíz.</p>

<p>Mientras eso no cambie, la realidad del mercado de arriendo en Medellín es esta:</p>
<ul>
  <li>📌 Las zonas más deseadas seguirán subiendo de precio</li>
  <li>📌 El arrendatario local necesita ampliar su radio de búsqueda o su presupuesto</li>
  <li>📌 El propietario en zona estratégica tiene una oportunidad de rentabilidad alta</li>
  <li>📌 El inversor que compra hoy en zona con creciente demanda turística probablemente gane</li>
</ul>

<div class="post-cta-box">
  <h3>¿Buscas apartamento en arriendo en el área metropolitana de Medellín?</h3>
  <p>Soy <strong>Alexander Arias</strong>, consultor inmobiliario. Conozco zona por zona cuáles siguen siendo accesibles, cuáles tienen mejor relación calidad-precio y cómo navegar este mercado sin pagar de más. Te ayudo a encontrar la opción correcta para tu presupuesto.</p>
  <a href="https://wa.me/573122588521?text=Hola%20Alex%2C%20leí%20tu%20artículo%20sobre%20nómadas%20digitales%20y%20arriendos%20en%20Medellín%20y%20necesito%20ayuda%20para%20encontrar%20apartamento" class="post-cta-btn" target="_blank" rel="noopener">
    📲 Hablar con Alex en WhatsApp
  </a>
</div>
`;

const postData = {
  title: 'Nómadas Digitales y Airbnb: ¿Por Qué Suben los Arriendos en Medellín?',
  excerpt: 'Medellín recibe 8.000 nómadas digitales al mes, los arriendos subieron hasta 81% en algunas zonas y la ciudad ya es más cara que Bogotá para arrendar. ¿Son los extranjeros los culpables? El análisis completo del fenómeno que está transformando la ciudad.',
  content,
  cover: COVER_URL,
  category: 'Mercado Inmobiliario',
  tags: JSON.stringify(['nómadas digitales medellín', 'gentrificación medellín', 'airbnb medellín', 'arriendos medellín 2026', 'vivienda medellín', 'alquiler turístico']),
  status: 'published',
  metaTitle: 'Nómadas Digitales y Airbnb: ¿Por Qué Suben los Arriendos en Medellín? | Alex Arias',
  metaDescription: '8.000 nómadas digitales al mes y Airbnb creciendo 66%: ¿son los culpables de que Medellín sea la ciudad más cara para arrendar en Colombia? Analizamos el fenómeno con datos reales.',
  metaKeywords: 'nómadas digitales medellín, gentrificación medellín 2026, airbnb medellín arriendos, por qué suben arriendos medellín, alquiler turístico medellín'
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
