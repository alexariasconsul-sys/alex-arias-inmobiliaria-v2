/**
 * Script para insertar el quinto blog post en alexariasc.com
 * Uso: node insert-blog-post5.js
 */

const TARGET = 'https://alexariasc.com';
const ADMIN_PASSWORD = '50AlexArias_*#';

const COVER_URL = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=1200&q=80&auto=format&fit=crop';

const content = `
<p class="post-intro">Por primera vez en la historia de Colombia, hay más hogares viviendo en arriendo que en vivienda propia. <strong>7,3 millones de familias arriendan. 7,1 millones son propietarias.</strong> Ese dato cambió algo en la cabeza de mucha gente: ¿comprar sigue siendo la meta, o ya no tiene tanto sentido? Esta guía te da los números reales para que decidas con información, no con intuición.</p>

<nav class="post-toc" aria-label="Tabla de contenidos">
  <h2 class="post-toc-title">📋 Contenido</h2>
  <ol class="post-toc-list">
    <li><a href="#panorama">El panorama real en 2026</a></li>
    <li><a href="#valorizacion">¿Cuánto se valoriza un apartamento?</a></li>
    <li><a href="#rendimiento">El rendimiento del arriendo: los números reales</a></li>
    <li><a href="#comparativa">Finca raíz vs CDT vs dólar: comparativa honesta</a></li>
    <li><a href="#zonas">Las zonas que más se valorizan en el área metro</a></li>
    <li><a href="#no-comprar">Qué NO debes comprar como inversión</a></li>
    <li><a href="#cuanto">¿Cuánto capital necesitas para empezar?</a></li>
    <li><a href="#reforma">Reforma tributaria: lo que te afecta como inversionista</a></li>
    <li><a href="#faq">Preguntas frecuentes</a></li>
  </ol>
</nav>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="panorama">El panorama real en 2026</h2>

<p>El mercado inmobiliario colombiano vive un momento contradictorio: <strong>difícil de acceder pero muy rentable si ya entraste</strong>. Estos son los datos que definen el año:</p>

<ul>
  <li>📈 <strong>Valorización:</strong> El Índice de Precios de Vivienda Nueva (IPVN del DANE) subió <strong>9,17% anual</strong> al cierre de 2025 — muy por encima de la inflación (5,1%)</li>
  <li>🏠 <strong>Ventas en alza:</strong> Las ventas de vivienda nueva crecieron <strong>11,7%</strong> a marzo de 2026, recuperando niveles prepandemia</li>
  <li>📦 <strong>Inventario escaso:</strong> El stock disponible cayó <strong>3,7%</strong> porque los nuevos lanzamientos no alcanzan a cubrir el ritmo de ventas</li>
  <li>💸 <strong>Tasas altas:</strong> El crédito hipotecario ronda el <strong>12–14% E.A.</strong>, lo que encarece el acceso para compradores financiados</li>
  <li>🔄 <strong>Giro histórico:</strong> Por primera vez, Colombia tiene más hogares en arriendo (7,3M) que en propiedad (7,1M)</li>
</ul>

<blockquote class="post-tip">
  <strong>💡 Lo que dicen estos datos:</strong> El que ya tiene finca raíz está ganando. El que quiere entrar encuentra barreras más altas. Pero las barreras no significan que no valga la pena — significan que hay que entrar con más estrategia.
</blockquote>

<figure>
  <img src="https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=800&q=75&auto=format&fit=crop" alt="Edificios modernos de apartamentos en Medellín Colombia como inversión inmobiliaria" loading="lazy" class="post-img" />
  <figcaption>El mercado de vivienda en el área metropolitana de Medellín registra valorización sostenida por encima de la inflación</figcaption>
</figure>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="valorizacion">¿Cuánto se valoriza realmente un apartamento?</h2>

<p>El DANE reportó una valorización promedio del <strong>9,17% anual para apartamentos nuevos</strong> en Colombia al cierre de 2025. Pero eso es el promedio nacional. En el área metropolitana de Medellín los números son distintos según la zona:</p>

<div class="post-table-wrap">
<table class="post-table">
  <thead>
    <tr>
      <th>Zona</th>
      <th>Valorización anual est.</th>
      <th>Perfil</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Sabaneta</strong></td>
      <td>8% – 12%</td>
      <td>Alta demanda, nuevo desarrollo urbano</td>
    </tr>
    <tr>
      <td><strong>Envigado</strong></td>
      <td>7% – 10%</td>
      <td>Consolidado, familias, seguridad</td>
    </tr>
    <tr>
      <td><strong>El Poblado</strong></td>
      <td>6% – 9%</td>
      <td>Premium, saturado, mercado maduro</td>
    </tr>
    <tr>
      <td><strong>Laureles</strong></td>
      <td>6% – 8%</td>
      <td>Residencial consolidado</td>
    </tr>
    <tr>
      <td><strong>Itagüí / La Estrella</strong></td>
      <td>9% – 14%</td>
      <td>Emergente, proyectos nuevos, más riesgo</td>
    </tr>
  </tbody>
</table>
</div>

<p><small>* Estimaciones basadas en datos de mercado a 2025-2026. La valorización real depende del inmueble específico, sus acabados y la gestión del activo.</small></p>

<h3>¿Valorización real vs inflación?</h3>
<p>Si un apartamento se valoriza al 9% anual y la inflación es del 5%, la <strong>ganancia real es del 4% anual</strong>. Eso es dinero que tu patrimonio gana "gratis" — sin que hagas nada — solo por ser propietario en la zona correcta.</p>

<blockquote class="post-tip">
  <strong>📐 Ejemplo concreto:</strong> Compraste en Sabaneta en 2020 por $250 millones. Hoy, con valorización promedio del 10% anual durante 5 años, ese apartamento vale aproximadamente <strong>$402 millones</strong>. Ganaste $152 millones sin venderlo — y mientras tanto cobrabas arriendo.
</blockquote>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="rendimiento">El rendimiento del arriendo: los números reales</h2>

<p>La finca raíz en Colombia genera dinero de dos formas: <strong>valorización del capital + ingresos por arriendo</strong>. Muchos solo calculan la valorización y se olvidan del flujo mensual.</p>

<h3>Tasa de capitalización (cap rate) en Medellín 2026</h3>
<p>El <strong>cap rate</strong> es el rendimiento anual del arriendo como porcentaje del valor del inmueble. En Medellín:</p>

<div class="post-table-wrap">
<table class="post-table">
  <thead>
    <tr>
      <th>Tipo de inmueble</th>
      <th>Canon mensual ref.</th>
      <th>Valor inmueble ref.</th>
      <th>Cap Rate bruto</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Apartaestudio – Laureles</strong></td>
      <td>$1.500.000</td>
      <td>$220.000.000</td>
      <td>8,2%</td>
    </tr>
    <tr>
      <td><strong>Apto 2 hab. – Sabaneta</strong></td>
      <td>$1.800.000</td>
      <td>$300.000.000</td>
      <td>7,2%</td>
    </tr>
    <tr>
      <td><strong>Apto 2 hab. – El Poblado</strong></td>
      <td>$3.500.000</td>
      <td>$650.000.000</td>
      <td>6,5%</td>
    </tr>
    <tr>
      <td><strong>Apto 3 hab. – Envigado</strong></td>
      <td>$2.800.000</td>
      <td>$480.000.000</td>
      <td>7,0%</td>
    </tr>
  </tbody>
</table>
</div>

<h3>Rendimiento neto: lo que realmente te queda</h3>
<p>Del cap rate bruto hay que descontar los costos reales de ser propietario:</p>
<ul>
  <li>🔧 <strong>Mantenimiento y reparaciones:</strong> ~1% del valor anual</li>
  <li>🏢 <strong>Administración inmobiliaria (si la usas):</strong> 8-10% del canon</li>
  <li>📋 <strong>Predial:</strong> Variable según estrato y avalúo catastral</li>
  <li>🕐 <strong>Vacancia promedio:</strong> ~1 mes al año (equivale a 8% del ingreso)</li>
</ul>

<blockquote class="post-tip">
  <strong>🧮 Rentabilidad neta estimada:</strong> Restando todos los costos, el rendimiento neto por arriendo suele quedar entre el <strong>4,5% y el 6,5% anual</strong> sobre el valor del inmueble. Súmale la valorización y el retorno total puede superar el 12–15% anual.
</blockquote>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="comparativa">Finca raíz vs CDT vs dólar: comparativa honesta</h2>

<p>La pregunta que más genera debate en grupos de inversión: <strong>¿es mejor finca raíz, CDT o dólar?</strong> Acá los números sin adornos:</p>

<div class="post-table-wrap">
<table class="post-table">
  <thead>
    <tr>
      <th>Instrumento</th>
      <th>Rendimiento anual</th>
      <th>Liquidez</th>
      <th>Riesgo</th>
      <th>Esfuerzo</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Finca raíz (total)</strong></td>
      <td>12% – 18%*</td>
      <td>Muy baja</td>
      <td>Bajo</td>
      <td>Medio</td>
    </tr>
    <tr>
      <td><strong>CDT (2026)</strong></td>
      <td>10% – 11,5%</td>
      <td>Media</td>
      <td>Muy bajo</td>
      <td>Muy bajo</td>
    </tr>
    <tr>
      <td><strong>Dólar (TRM)</strong></td>
      <td>Variable (-5% a +20%)</td>
      <td>Alta</td>
      <td>Alto</td>
      <td>Bajo</td>
    </tr>
    <tr>
      <td><strong>Acciones (colcap)</strong></td>
      <td>Variable</td>
      <td>Alta</td>
      <td>Alto</td>
      <td>Alto</td>
    </tr>
    <tr>
      <td><strong>Fondos de inversión</strong></td>
      <td>8% – 13%</td>
      <td>Media</td>
      <td>Medio</td>
      <td>Muy bajo</td>
    </tr>
  </tbody>
</table>
</div>

<p><small>* Rendimiento total finca raíz = valorización + rendimiento por arriendo neto. No garantizado, depende de zona y gestión.</small></p>

<h3>¿Entonces cuál es mejor?</h3>
<p>Depende de tu perfil. Pero hay algo que los CDTs y el dólar no hacen: <strong>dejarte dormir con un activo físico que se valoriza, que puedes habitar si lo necesitas, y que puedes dejarle a tus hijos</strong>. El CDT te paga bien, pero en 20 años tienes los mismos pesos devaluados. El apartamento, en 20 años, puede valer tres veces más.</p>

<figure>
  <img src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=75&auto=format&fit=crop" alt="Análisis financiero de inversión inmobiliaria con gráficas de rendimiento" loading="lazy" class="post-img" />
  <figcaption>La rentabilidad total de la finca raíz combina valorización de capital más flujo de caja por arriendo</figcaption>
</figure>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="zonas">Las zonas que más se valorizan en el área metropolitana</h2>

<p>No todas las zonas son iguales. La clave para una buena inversión es <strong>comprar en el lugar correcto antes de que explote</strong>. Estas son las zonas con mejor potencial en 2026:</p>

<div class="post-zones-grid">

  <div class="post-zone-card">
    <h3>🚀 Sabaneta – Alto potencial</h3>
    <p><strong>Por qué:</strong> Municipio con mayor crecimiento industrial del área metro, proyectos de renovación urbana activos, acceso directo al metro.<br/>
    <strong>Perfil inversor:</strong> Compra para arrendar o valorizar a 5+ años.<br/>
    <strong>Precio m² aprox.:</strong> $4,5M – $7M</p>
  </div>

  <div class="post-zone-card">
    <h3>📈 Itagüí Centro – Emergente</h3>
    <p><strong>Por qué:</strong> Renovación urbana acelerada, precios aún bajos, demanda creciente de trabajadores de la zona industrial.<br/>
    <strong>Perfil inversor:</strong> Largo plazo, mayor riesgo/mayor ganancia.<br/>
    <strong>Precio m² aprox.:</strong> $3M – $5M</p>
  </div>

  <div class="post-zone-card">
    <h3>🏡 Envigado – Consolidado seguro</h3>
    <p><strong>Por qué:</strong> Municipio más seguro de Colombia (índice de crimen), demanda residencial constante, colegios y servicios de primer nivel.<br/>
    <strong>Perfil inversor:</strong> Patrimonio familiar, estabilidad.<br/>
    <strong>Precio m² aprox.:</strong> $5M – $9M</p>
  </div>

  <div class="post-zone-card">
    <h3>💼 Laureles – Renta alta</h3>
    <p><strong>Por qué:</strong> Alta demanda de profesionales y nómadas digitales, cap rate alto en apartaestudios, zona muy consolidada.<br/>
    <strong>Perfil inversor:</strong> Flujo de caja inmediato, arriendo fácil.<br/>
    <strong>Precio m² aprox.:</strong> $5,5M – $9,5M</p>
  </div>

</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="no-comprar">Qué NO debes comprar como inversión en 2026</h2>

<p>Tan importante como saber dónde comprar es saber qué evitar. Estas son las trampas más comunes que destruyen rentabilidad:</p>

<ol>
  <li>
    <h3>❌ Apartamentos sin ascensor (4+ pisos)</h3>
    <p>Son difíciles de arrendar, difíciles de vender, y su valorización es significativamente menor. En el mercado de 2026, el comprador e inquilino joven los rechaza de entrada.</p>
  </li>
  <li>
    <h3>❌ Inmuebles con administración mayor al 20% del canon</h3>
    <p>Si el arriendo potencial es $1.800.000 y la administración es $400.000, tu flujo neto parte en un -22%. La ecuación se rompe.</p>
  </li>
  <li>
    <h3>❌ Apartamentos con más de 25–30 años sin remodelar</h3>
    <p>El costo de puesta a punto puede comerse 2-3 años de rentabilidad. Si compras viejo, que sea muy barato y que el sector justifique la inversión.</p>
  </li>
  <li>
    <h3>❌ Zonas con proyectos viales o de obras prolongadas</h3>
    <p>Las obras largas deprimen el valor y hacen casi imposible arrendar a buen precio durante el período de construcción.</p>
  </li>
  <li>
    <h3>❌ Comprar financiado al 70% con tasas actuales</h3>
    <p>Con crédito al 13% E.A., el costo financiero puede superar el rendimiento del arriendo. Haz los números antes: si la cuota mensual del crédito supera el canon potencial, estás pagando por tener el activo, no ganando.</p>
  </li>
</ol>

<blockquote class="post-tip">
  <strong>⚠️ Regla de oro:</strong> Una buena inversión inmobiliaria debe poder sostenerse sola — el arriendo debe cubrir crédito (si hay), administración, predial y tener margen. Si el número no cierra desde el inicio, no cierres el negocio.
</blockquote>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="cuanto">¿Cuánto capital necesitas para empezar a invertir?</h2>

<p>La barrera más común que escucha un asesor inmobiliario: <em>"es que yo no tengo suficiente plata"</em>. La realidad es que existen puntos de entrada para distintos capitales:</p>

<div class="post-zones-grid">

  <div class="post-zone-card">
    <h3>💰 Capital disponible: $30M – $80M</h3>
    <p><strong>Opción:</strong> Cuota inicial para inmueble en planos (30% del valor). Compras a hoy, pagas en cuotas durante construcción (18-36 meses) y recibes un inmueble valorizado.<br/>
    <strong>Zona sugerida:</strong> Sabaneta, Itagüí, proyectos nuevos</p>
  </div>

  <div class="post-zone-card">
    <h3>💰 Capital disponible: $80M – $200M</h3>
    <p><strong>Opción A:</strong> Cuota inicial de inmueble usado + crédito moderado.<br/>
    <strong>Opción B:</strong> Apartaestudio de contado en zona de alta renta.<br/>
    <strong>Zona sugerida:</strong> Laureles, Belén, Sabaneta</p>
  </div>

  <div class="post-zone-card">
    <h3>💰 Capital disponible: $200M – $400M</h3>
    <p><strong>Opción:</strong> Compra de contado o con crédito mínimo. Flujo de caja positivo desde el primer mes.<br/>
    <strong>Zona sugerida:</strong> Envigado, Sabaneta, Laureles</p>
  </div>

  <div class="post-zone-card">
    <h3>💰 Capital disponible: +$400M</h3>
    <p><strong>Opción:</strong> Inmueble premium para arriendo, diversificación en 2 apartaestudios, o entrada a proyectos comerciales.<br/>
    <strong>Zona sugerida:</strong> El Poblado, Envigado top, multiactivos</p>
  </div>

</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="reforma">Reforma tributaria 2026: lo que debes saber como inversionista</h2>

<p>La reforma tributaria vigente trae cambios que <strong>afectan directamente a los propietarios de inmuebles como inversión</strong>. Los puntos más relevantes:</p>

<ul>
  <li>📊 <strong>Renta presuntiva:</strong> Si tienes inmuebles que no generan ingresos declarados, el fisco puede presumir una renta mínima sobre su avalúo</li>
  <li>💹 <strong>Ganancia ocasional:</strong> Al vender un inmueble, pagas entre el 10% y 15% sobre la utilidad (diferencia entre precio de compra y precio de venta)</li>
  <li>🏦 <strong>Límite de deducción de intereses:</strong> Los intereses del crédito hipotecario solo son deducibles hasta cierto tope en la declaración de renta</li>
  <li>📋 <strong>Normalización tributaria:</strong> Declarar correctamente los inmuebles es hoy más importante que antes — el cruce IGAC-DIAN es más riguroso</li>
</ul>

<blockquote class="post-tip">
  <strong>💼 Consejo:</strong> Antes de comprar un inmueble como inversión, consulta con tu contador el impacto en tu declaración de renta. Una buena estructura puede reducir significativamente la carga fiscal.
</blockquote>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="faq">Preguntas frecuentes sobre invertir en finca raíz en 2026</h2>

<div class="post-faq">

  <details class="post-faq-item" open>
    <summary class="post-faq-q">¿Es mejor comprar en planos o inmueble usado?</summary>
    <div class="post-faq-a">
      <p>Depende del capital y el horizonte de tiempo. <strong>En planos:</strong> pagas menos, valorizas más durante la construcción, pero sin flujo de caja por 18-36 meses. <strong>Usado:</strong> flujo inmediato, puedes verificar el inmueble real, pero el precio ya tiene valorización incorporada. Para inversión a corto-mediano plazo, los planos suelen ganar. Para flujo de caja inmediato, el usado.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Cuánto tiempo tarda en "pagarse" un apartamento con el arriendo?</summary>
    <div class="post-faq-a">
      <p>Con una rentabilidad neta del 5% anual, el arriendo "paga" el inmueble en 20 años. Pero ese cálculo ignora la valorización. Si el inmueble se valoriza al 9% adicional, en términos de patrimonio el retorno total es mucho más rápido. La finca raíz no se evalúa solo por flujo de caja sino por creación de patrimonio.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Vale la pena comprar con crédito hipotecario en 2026 con tasas al 13%?</summary>
    <div class="post-faq-a">
      <p>Con tasas al 13%, comprar financiado al 70% es costoso. La cuota del crédito generalmente supera el canon de arriendo, lo que genera flujo negativo mensual. Sin embargo, si tienes la capacidad de cubrir ese diferencial mensual, sigues construyendo patrimonio a través de la valorización. La estrategia cambia: no es para flujo de caja sino para patrimonio a largo plazo. <strong>Recomendación:</strong> financia máximo el 50% si las tasas están altas.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Un apartaestudio es mejor inversión que uno de 2 habitaciones?</summary>
    <div class="post-faq-a">
      <p>Para <strong>cap rate (rentabilidad por arriendo)</strong>, los apartaestudios suelen ganar: mayor canon relativo al precio, menor costo de administración, alta demanda de profesionales y nómadas. Para <strong>valorización</strong>, los de 2 habitaciones tienden a ser más estables y tienen mercado más amplio en la reventa. La decisión ideal: apartaestudio en zona de alta demanda laboral o estudiantil.</p>
    </div>
  </details>

  <details class="post-faq-item">
    <summary class="post-faq-q">¿Puedo invertir en finca raíz si soy empleado con ingreso medio?</summary>
    <div class="post-faq-a">
      <p>Sí, pero con estrategia. La ruta más común: ahorrar la cuota inicial (30% del valor), comprar en planos un inmueble de precio accesible ($200M-$280M en zonas emergentes), pagar cuotas durante la construcción, y al recibir el inmueble arrendarlo. Con disciplina de ahorro y un ingreso de $4M-$6M mensuales, es perfectamente viable en 3-5 años de preparación.</p>
    </div>
  </details>

</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2>Conclusión: ¿Vale la pena o no?</h2>

<p>La respuesta honesta es: <strong>sí vale la pena, pero no para todo el mundo ni en cualquier inmueble</strong>.</p>

<p>Vale la pena si:</p>
<ul>
  <li>✅ Tienes capital para la cuota inicial sin comprometer tu liquidez</li>
  <li>✅ Tu horizonte de inversión es de 5 años o más</li>
  <li>✅ Eliges zona con demanda de arriendo probada</li>
  <li>✅ Los números cierran sin depender de la valorización futura</li>
  <li>✅ Entiendes que es un activo ilíquido — no lo verás como efectivo rápido</li>
</ul>

<p>No vale la pena si:</p>
<ul>
  <li>❌ Necesitas el dinero disponible en menos de 2 años</li>
  <li>❌ Vas a financiar más del 60–70% con tasas actuales</li>
  <li>❌ Compras sin analizar el mercado de arriendo de la zona específica</li>
  <li>❌ No tienes reserva para mantenimiento y vacancia</li>
</ul>

<div class="post-cta-box">
  <h3>¿Quieres saber si un inmueble específico es buena inversión?</h3>
  <p>Soy <strong>Alexander Arias</strong>, consultor inmobiliario en el área metropolitana de Medellín. Analizo contigo los números reales de cualquier inmueble que estés considerando: cap rate, valorización esperada, riesgos y alternativas. Sin compromiso.</p>
  <a href="https://wa.me/573122588521?text=Hola%20Alex%2C%20leí%20tu%20artículo%20sobre%20invertir%20en%20finca%20raíz%20en%202026%20y%20quiero%20analizar%20una%20inversión" class="post-cta-btn" target="_blank" rel="noopener">
    📲 Analizar mi inversión con Alex
  </a>
</div>
`;

const postData = {
  title: '¿Vale la Pena Invertir en Finca Raíz en Colombia en 2026? Los Números Reales',
  excerpt: 'Por primera vez Colombia tiene más hogares en arriendo que en propiedad. ¿Sigue valiendo la pena comprar? Te damos los números reales: valorización del 9,17%, rentabilidades por zona, comparativa con CDTs y qué errores evitar antes de invertir.',
  content,
  cover: COVER_URL,
  category: 'Inversión',
  tags: JSON.stringify(['inversión inmobiliaria', 'finca raíz colombia 2026', 'comprar apartamento', 'rentabilidad arriendo', 'valorización medellín', 'cdt vs finca raíz']),
  status: 'published',
  metaTitle: '¿Vale la Pena Invertir en Finca Raíz en Colombia en 2026? | Alex Arias',
  metaDescription: 'Análisis completo: valorización 9,17% anual, rentabilidad por arriendo 5–7% neto, comparativa finca raíz vs CDT, zonas que más se valorizan en Medellín y qué NO comprar en 2026.',
  metaKeywords: 'invertir finca raíz colombia 2026, valorización apartamentos medellín, rentabilidad arriendo colombia, cdt vs finca raíz, inversión inmobiliaria sabaneta'
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
