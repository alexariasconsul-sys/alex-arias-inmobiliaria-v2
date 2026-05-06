/* ═══════════════════════════════════════════════════════════════
   ALEX ARIAS · CONSULTOR INMOBILIARIO
   Frontend principal
═══════════════════════════════════════════════════════════════ */

// ─── Estado global ─────────────────────────────────────────────
const state = {
  properties: [],
  filtered: [],
  currentView: 'grid',   // 'grid' | 'map'
  tipo: 'todos',
  search: '',
  municipio: '',
  barrio: '',
  minPrecio: 0,
  maxPrecio: 0,
  minHab: 0,
  minBanos: 0,
  filterParqueadero: false,
  filterAmenidades: [],
  filterEstado: '',      // '' | 'libre' | 'ocupado'
  orderBy: '',           // '' | 'vistas-desc' | 'vistas-asc' | 'likes-desc' | 'precio-asc' | 'precio-desc' | 'fecha-desc' | 'fecha-asc'
  isAdmin: false,
  adminPassword: '',
  likedIds: new Set(),
  shareTargetId: null,
  editingId: null,
  leafletMap: null,
  markerClusterGroup: null,
  mapMarkers: [],
  mapTileLayers: {},    // Tile layers para cambiar entre street/sat
  currentMapType: 'street-light',  // Tipo de mapa actual
  mapDarkMode: false,   // Dark mode para el mapa
  pendingImages: [],    // File objects para upload
  pendingEditProp: null, // prop a editar cuando el modal aún está autenticando
};

// ─── Utilidades ────────────────────────────────────────────────
function formatPrice(price) {
  if (!price) return 'Precio a consultar';
  return '$' + Number(price).toLocaleString('es-CO');
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff) || diff < 0) return '';
  const mins  = Math.floor(diff / 60000);
  const hrs   = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  if (mins < 60)   return 'hace unos minutos';
  if (hrs  < 24)   return `hace ${hrs} ${hrs  === 1 ? 'hora'   : 'horas'}`;
  if (days <  7)   return `hace ${days} ${days === 1 ? 'día'   : 'días'}`;
  if (weeks < 5)   return `hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

function encodeImgPath(filepath) {
  if (!filepath) return '';
  return filepath.split('/').map(s => encodeURIComponent(s)).join('/');
}

// ─── FACEBOOK / META HELPERS ───────────────────────────────────
// Precio numérico para eventos Meta (nunca string, nunca NaN)
function _fbPrice(val) { return Math.round(Number(val) || 0); }

// Lee cookie por nombre (para _fbp / _fbc que Meta genera)
function _getCookie(name) {
  return document.cookie.split(';').map(c => c.trim())
    .find(c => c.startsWith(name + '='))?.split('=')[1] || undefined;
}

// ID único para deduplicación Pixel ↔ CAPI
function _fbEventId(name) {
  return `${name}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

// Precio principal de una propiedad (maneja combinado)
function _propNumPrice(p) {
  if (!p) return 0;
  return _fbPrice(p.tipo === 'combinado'
    ? (p.precioArriendo || p.precio)
    : p.precio);
}

// Validación client-side del evento antes de enviarlo
// Evita mandar basura a Meta y activa logs de error
function _validateFbEvent(eventName, customData) {
  if (!eventName || typeof eventName !== 'string') return false;
  const d = customData || {};
  // Precio debe ser número positivo razonable (hasta 10 mil millones COP)
  if (d.value !== undefined && (isNaN(d.value) || d.value < 0 || d.value > 1e10)) return false;
  // Moneda debe ser código ISO 3 letras
  if (d.currency && !/^[A-Z]{3}$/.test(d.currency)) return false;
  // content_ids debe ser array
  if (d.content_ids !== undefined && !Array.isArray(d.content_ids)) return false;
  return true;
}

// Envía evento al CAPI server-side (duplica el Pixel para blindar iOS 14+)
// — Valida antes de enviar
// — Incluye email del usuario si disponible (mejora attribution EM en Meta)
// — Retry hasta 3 intentos con back-off exponencial (300ms, 600ms, 1200ms)
// — Si no hay FB_ACCESS_TOKEN en el servidor, falla silenciosamente
async function _sendCAPI(eventName, customData, eventId) {
  if (!_validateFbEvent(eventName, customData)) return; // skip eventos inválidos

  const body = JSON.stringify({
    eventName,
    eventId,
    customData,
    fbp:       _getCookie('_fbp'),
    fbc:       _getCookie('_fbc') || new URLSearchParams(location.search).get('fbclid') || undefined,
    userAgent: navigator.userAgent,
    pageUrl:   location.href,
    userEmail: window._fbUserEmail || undefined   // seteado cuando usuario hace login con Google
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      const d = await r.json();
      if (d.ok || d.reason === 'no_config') return; // éxito o sin config → no reintentar
      if (attempt < 2) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 300));
    } catch (_) {
      if (attempt < 2) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 300));
    }
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// BUG FIX #1: escHtml no estaba definida en app.js (solo en admin.html)
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, duration = 2200) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── URL SYNC ─────────────────────────────────────────────────
function pushFilterState() {
  const p = new URLSearchParams();
  if (state.tipo && state.tipo !== 'todos') p.set('tipo', state.tipo);
  if (state.municipio) p.set('municipio', state.municipio);
  if (state.barrio) p.set('barrio', state.barrio);
  if (state.search) p.set('q', state.search);
  if (state.minPrecio) p.set('min', state.minPrecio);
  if (state.maxPrecio) p.set('max', state.maxPrecio);
  if (state.minHab) p.set('hab', state.minHab);
  if (state.minBanos) p.set('ban', state.minBanos);
  if (state.filterParqueadero) p.set('pq', '1');
  if (state.filterAmenidades.length) p.set('amen', state.filterAmenidades.join(','));
  if (state.filterEstado) p.set('est', state.filterEstado);
  if (state.orderBy) p.set('ord', state.orderBy);
  const qs = p.toString();
  history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  renderActiveFilterTags();
}

function readURLParams() {
  const p = new URLSearchParams(location.search);
  if (p.get('tipo')) state.tipo = p.get('tipo');
  if (p.get('municipio')) state.municipio = p.get('municipio');
  if (p.get('barrio')) state.barrio = p.get('barrio');
  if (p.get('q')) state.search = p.get('q');
  if (p.get('min')) state.minPrecio = Number(p.get('min'));
  if (p.get('max')) state.maxPrecio = Number(p.get('max'));
  if (p.get('hab')) state.minHab = Number(p.get('hab'));
  if (p.get('ban')) state.minBanos = Number(p.get('ban'));
  if (p.get('pq') === '1') state.filterParqueadero = true;
  if (p.get('amen')) state.filterAmenidades = p.get('amen').split(',').filter(Boolean);
  if (p.get('est')) state.filterEstado = p.get('est');
  if (p.get('ord')) state.orderBy = p.get('ord');
}

function syncUIFromState() {
  // Tipo pills desktop
  document.querySelectorAll('.pill-btn[data-tipo]').forEach(b => {
    b.classList.toggle('active', b.dataset.tipo === state.tipo);
  });
  // Municipio/Barrio selects
  const mSel = document.getElementById('filterMunicipio');
  const bSel = document.getElementById('filterBarrio');
  if (mSel) mSel.value = state.municipio;
  if (bSel) bSel.value = state.barrio;
  // Search input
  const sIn = document.getElementById('searchInput');
  const clr = document.getElementById('clearSearch');
  if (sIn) sIn.value = state.search;
  if (clr) clr.style.display = state.search ? 'flex' : 'none';
  // Filter modal fields
  const fMin = document.getElementById('fMinPrecio');
  const fMax = document.getElementById('fMaxPrecio');
  if (fMin) fMin.value = state.minPrecio || '';
  if (fMax) fMax.value = state.maxPrecio || '';
  // Hab buttons
  document.querySelectorAll('.hab-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.hab) === state.minHab);
  });
  // Ban buttons
  document.querySelectorAll('.ban-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.ban) === state.minBanos);
  });
  // Parqueadero toggle
  const pq = document.getElementById('fFilterParqueadero');
  if (pq) pq.checked = state.filterParqueadero;
  // Amenidades checkboxes
  document.querySelectorAll('.amenity-check input').forEach(cb => {
    cb.checked = state.filterAmenidades.includes(cb.value);
  });
  // Estado buttons (desktop)
  document.querySelectorAll('.filter-state-btn[data-state]').forEach(b => {
    b.classList.toggle('active', b.dataset.state === state.filterEstado);
  });
  // Ordenamiento select (desktop)
  const fOrderBy = document.getElementById('fOrderBy');
  if (fOrderBy) fOrderBy.value = state.orderBy || '';
  // Filter badge
  const count = [state.minPrecio||state.maxPrecio, state.minHab, state.minBanos, state.filterParqueadero, state.filterAmenidades.length, state.filterEstado, state.orderBy].filter(Boolean).length;
  const badge = document.getElementById('filterBadge');
  if (badge) { badge.style.display = count ? 'flex' : 'none'; badge.textContent = count; }

  // precio label
  const lbl = document.getElementById('precioRangeLabel');
  if (lbl) {
    const fmt = v => '$' + (v/1000000).toFixed(v%1000000===0?0:1) + 'M';
    if (!state.minPrecio && !state.maxPrecio) lbl.textContent = 'Cualquier precio';
    else if (!state.minPrecio) lbl.textContent = `Hasta ${fmt(state.maxPrecio)}`;
    else if (!state.maxPrecio) lbl.textContent = `Desde ${fmt(state.minPrecio)}`;
    else lbl.textContent = `${fmt(state.minPrecio)} – ${fmt(state.maxPrecio)}`;
  }
}

// ─── ACTIVE FILTER TAGS ───────────────────────────────────────
function renderActiveFilterTags() {
  const bar = document.getElementById('activeFiltersBar');
  const inner = document.getElementById('activeFiltersInner');
  const shell = document.querySelector('.app-shell');
  if (!bar || !inner) return;

  const tags = [];

  if (state.tipo && state.tipo !== 'todos') {
    tags.push({ label: state.tipo === 'arriendo' ? 'Arriendo' : 'Compra', clear: () => {
      state.tipo = 'todos';
      document.querySelectorAll('.pill-btn[data-tipo]').forEach(b => b.classList.toggle('active', b.dataset.tipo === 'todos'));
    }});
  }
  if (state.municipio) {
    tags.push({ label: state.municipio, clear: () => {
      state.municipio = ''; state.barrio = '';
      const s = document.getElementById('filterMunicipio'); if(s) s.value='';
      const b = document.getElementById('filterBarrio'); if(b) b.value='';
    }});
  }
  if (state.barrio) {
    tags.push({ label: state.barrio, clear: () => {
      state.barrio = '';
      const b = document.getElementById('filterBarrio'); if(b) b.value='';
    }});
  }
  if (state.search) {
    tags.push({ label: `"${state.search}"`, clear: () => {
      state.search = '';
      const i = document.getElementById('searchInput'); if(i) i.value='';
      const c = document.getElementById('clearSearch'); if(c) c.style.display='none';
    }});
  }
  if (state.minPrecio || state.maxPrecio) {
    const fmt = v => '$' + (v/1000000).toFixed(v%1000000===0?0:1) + 'M';
    let label = state.minPrecio && state.maxPrecio
      ? `${fmt(state.minPrecio)}–${fmt(state.maxPrecio)}`
      : state.minPrecio ? `Desde ${fmt(state.minPrecio)}` : `Hasta ${fmt(state.maxPrecio)}`;
    tags.push({ label, clear: () => {
      state.minPrecio = 0; state.maxPrecio = 0;
      const mn=document.getElementById('fMinPrecio'); const mx=document.getElementById('fMaxPrecio');
      if(mn) mn.value=''; if(mx) mx.value='';
      const lbl=document.getElementById('precioRangeLabel'); if(lbl) lbl.textContent='Cualquier precio';
      document.querySelectorAll('.filter-preset').forEach(b=>b.classList.remove('active'));
    }});
  }
  if (state.minHab) {
    tags.push({ label: `${state.minHab}+ hab`, clear: () => {
      state.minHab = 0;
      document.querySelectorAll('.hab-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
    }});
  }
  if (state.minBanos) {
    tags.push({ label: `${state.minBanos}+ baños`, clear: () => {
      state.minBanos = 0;
      document.querySelectorAll('.ban-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
    }});
  }
  if (state.filterParqueadero) {
    tags.push({ label: 'Parqueadero', clear: () => {
      state.filterParqueadero = false;
      const pq=document.getElementById('fFilterParqueadero'); if(pq) pq.checked=false;
    }});
  }
  state.filterAmenidades.forEach(a => {
    tags.push({ label: a, clear: () => {
      state.filterAmenidades = state.filterAmenidades.filter(x=>x!==a);
      document.querySelectorAll('.amenity-check input').forEach(cb=>{ if(cb.value===a) cb.checked=false; });
    }});
  });
  if (state.filterEstado) {
    const estadoLabel = state.filterEstado === 'libre' ? '🟢 Libre' : '🔴 Ocupada';
    tags.push({ label: estadoLabel, clear: () => {
      state.filterEstado = '';
      document.querySelectorAll('.filter-state-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
    }});
  }
  if (state.orderBy) {
    const orderLabels = {
      'vistas-desc': '👀 Más vistas',
      'vistas-asc': '👀 Menos vistas',
      'likes-desc': '❤️ Más favoritos',
      'likes-asc': '❤️ Menos favoritos',
      'precio-desc': '💰 Precio mayor',
      'precio-asc': '💰 Precio menor',
      'fecha-desc': '📅 Más recientes',
      'fecha-asc': '📅 Más antiguos'
    };
    tags.push({ label: orderLabels[state.orderBy] || state.orderBy, clear: () => {
      state.orderBy = '';
      const sel = document.getElementById('fOrderBy'); if(sel) sel.value='';
      const selM = document.getElementById('fOrderByMobile'); if(selM) selM.value='';
    }});
  }

  if (!tags.length) {
    bar.style.display = 'none';
    shell?.classList.remove('has-active-filters');
    document.documentElement.style.removeProperty('--filters-offset');
    return;
  }

  // Pre-setear offset estimado ANTES de mostrar la barra para evitar
  // que el contenido quede tapado durante el primer frame
  const topBarH = document.querySelector('.top-bar')?.getBoundingClientRect().height || 72;
  document.documentElement.style.setProperty('--filters-offset', Math.ceil(topBarH + 44) + 'px');

  bar.style.display = 'block';
  shell?.classList.add('has-active-filters');

  inner.innerHTML = tags.map((t, i) => `
    <button class="filter-tag" data-tag-idx="${i}">
      ${t.label}<span class="filter-tag-x">✕</span>
    </button>`).join('') +
    `<button class="filter-tag-clear-all" id="clearAllTags">Limpiar todo</button>`;

  inner.querySelectorAll('.filter-tag').forEach(el => {
    el.addEventListener('click', () => {
      const idx = Number(el.dataset.tagIdx);
      tags[idx].clear();
      pushFilterState();
      loadProperties();
    });
  });
  inner.querySelector('#clearAllTags')?.addEventListener('click', () => {
    clearAllFilters();
    loadProperties();
  });

  // Doble RAF: el primero espera que el DOM pinte, el segundo mide ya con layout completo
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const barH = bar.getBoundingClientRect().height;
    const topH  = document.querySelector('.top-bar')?.getBoundingClientRect().height || 72;
    const offset = Math.ceil(topH + barH);
    document.documentElement.style.setProperty('--filters-offset', offset + 'px');
    if (state.currentView === 'map') state.leafletMap?.invalidateSize();
  }));
}

function clearAllFilters() {
  state.tipo = 'todos'; state.municipio = ''; state.barrio = '';
  state.search = ''; state.minPrecio = 0; state.maxPrecio = 0;
  state.minHab = 0; state.minBanos = 0;
  state.filterParqueadero = false; state.filterAmenidades = [];
  syncUIFromState();
  pushFilterState();
  // Recalcular tamaño del mapa tras quitar la barra de filtros
  if (state.currentView === 'map') {
    requestAnimationFrame(() => state.leafletMap?.invalidateSize());
  }
}

// ─── SAVED SEARCHES ───────────────────────────────────────────
const SAVED_KEY = 'alexarias_saved_searches';

function getSavedSearches() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
}

function saveSavedSearches(arr) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(arr));
}

function saveCurrentSearch(name) {
  if (!name.trim()) return;
  const searches = getSavedSearches();
  searches.unshift({
    id: Date.now().toString(36),
    name: name.trim(),
    filters: {
      tipo: state.tipo, municipio: state.municipio, barrio: state.barrio,
      search: state.search, minPrecio: state.minPrecio, maxPrecio: state.maxPrecio,
      minHab: state.minHab, minBanos: state.minBanos,
      filterParqueadero: state.filterParqueadero, filterAmenidades: [...state.filterAmenidades]
    },
    savedAt: new Date().toISOString()
  });
  saveSavedSearches(searches.slice(0, 10));
  renderSavedSearches();
  showToast(`Búsqueda "${name.trim()}" guardada ✓`);
}

function deleteSavedSearch(id) {
  saveSavedSearches(getSavedSearches().filter(s => s.id !== id));
  renderSavedSearches();
}

function applySavedSearch(id) {
  const s = getSavedSearches().find(x => x.id === id);
  if (!s) return;
  const f = s.filters;
  state.tipo = f.tipo || 'todos';
  state.municipio = f.municipio || '';
  state.barrio = f.barrio || '';
  state.search = f.search || '';
  state.minPrecio = f.minPrecio || 0;
  state.maxPrecio = f.maxPrecio || 0;
  state.minHab = f.minHab || 0;
  state.minBanos = f.minBanos || 0;
  state.filterParqueadero = f.filterParqueadero || false;
  state.filterAmenidades = f.filterAmenidades || [];
  syncUIFromState();
  pushFilterState();
  if (window.closeFiltersModal) window.closeFiltersModal();
  else document.getElementById('filtersModal').style.display = 'none';
  loadProperties();
  showToast(`Búsqueda "${s.name}" aplicada`);
}

function renderSavedSearches() {
  const searches = getSavedSearches();
  const renderInto = (sectionId, chipsId) => {
    const section = document.getElementById(sectionId);
    const chipsEl = document.getElementById(chipsId);
    if (!section || !chipsEl) return;
    if (!searches.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    chipsEl.innerHTML = searches.map(s => `
      <div class="saved-search-chip" data-id="${s.id}">
        <span class="saved-chip-label">${s.name}</span>
        <button class="saved-search-chip-del" data-del="${s.id}" title="Eliminar">✕</button>
      </div>`).join('');
    chipsEl.querySelectorAll('.saved-search-chip').forEach(el => {
      el.querySelector('.saved-chip-label').addEventListener('click', () => applySavedSearch(el.dataset.id));
    });
    chipsEl.querySelectorAll('.saved-search-chip-del').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); deleteSavedSearch(btn.dataset.del); });
    });
  };
  renderInto('savedSearchesSection', 'savedSearchChips');
  renderInto('mobileSavedSearchesSection', 'mobileSavedSearchChips');
}

// ─── API ──────────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  // Contraseña clásica solo si NO usamos sesión Google
  if (state.isAdmin && state.adminPassword && state.adminPassword !== '__google__') {
    headers['x-admin-password'] = state.adminPassword;
  }
  const res = await fetch(url, {
    ...opts,
    credentials: 'same-origin', // envía cookie de sesión Google
    headers
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Error del servidor');
  }
  return res.json();
}

// AbortController para cancelar peticiones anteriores de propiedades (race condition)
let _propertiesAbort = null;

async function loadProperties() {
  // Cancelar la petición anterior si todavía está en vuelo
  if (_propertiesAbort) { _propertiesAbort.abort(); }
  _propertiesAbort = new AbortController();
  const signal = _propertiesAbort.signal;

  pushFilterState();
  const params = new URLSearchParams();
  if (state.tipo !== 'todos') params.set('tipo', state.tipo);
  if (state.municipio) params.set('municipio', state.municipio);
  if (state.barrio) params.set('barrio', state.barrio);
  if (state.search) params.set('search', state.search);
  if (state.minPrecio) params.set('minPrecio', state.minPrecio);
  if (state.maxPrecio) params.set('maxPrecio', state.maxPrecio);
  if (state.minHab) params.set('minHab', state.minHab);
  if (state.minBanos) params.set('minBanos', state.minBanos);
  if (state.filterParqueadero) params.set('parqueadero', '1');
  if (state.filterAmenidades.length) params.set('amenidades', state.filterAmenidades.join(','));
  if (state.filterEstado) params.set('estado', state.filterEstado);
  if (state.orderBy) params.set('orderBy', state.orderBy);

  try {
    const res = await fetch('/api/properties?' + params.toString(), {
      signal,
      credentials: 'same-origin'
    });
    if (!res.ok) throw new Error('Error del servidor');
    state.properties = await res.json();
    state.filtered = state.properties;
    clearFavoritesFilter(); // nueva búsqueda → salir del modo favoritos
    logSearch(state.properties.length); // Log de búsqueda

    // ── Facebook Pixel: Search ──────────────────────────────────
    // Dispara DESPUÉS de tener resultados para incluir content_ids reales
    if (typeof fbq === 'function' && (state.search || state.tipo !== 'todos' || state.municipio || state.barrio)) {
      const searchStr = state.search || [state.tipo, state.municipio, state.barrio].filter(Boolean).join(', ');
      const topIds    = state.properties.slice(0, 10).map(p => String(p.id));
      const eid       = _fbEventId('Search');
      fbq('track', 'Search', {
        search_string:  searchStr,
        content_type:   'home_listing',
        content_ids:    topIds,
        num_items:      state.properties.length,
        eventID:        eid
      });
      _sendCAPI('Search', {
        search_string: searchStr,
        content_type:  'home_listing',
        content_ids:   topIds,
        num_items:     state.properties.length
      }, eid);
    }
    renderGrid();
    updateFilterDropdowns();
    updateDynamicFilterRanges(); // Actualiza rangos dinámicamente
    if (state.leafletMap) updateMapMarkers();
  } catch (err) {
    if (err.name === 'AbortError') return; // petición cancelada — ignorar
    console.error('Error cargando propiedades:', err);
    const loadEl = document.getElementById('loadingState');
    if (loadEl) loadEl.innerHTML = `<p style="color:#ef4444;padding:40px;text-align:center">Error al cargar inmuebles. Verifica que el servidor esté corriendo.</p>`;
    else document.getElementById('propertiesGrid').innerHTML = `<div class="empty-state"><p style="color:#ef4444">Error al cargar inmuebles. Verifica que el servidor esté corriendo.</p></div>`;
  }
}

async function loadFiltersData() {
  try {
    const data = await apiFetch('/api/filters');
    window._filtersData = data;
    populateSelect('filterMunicipio', data.municipios, 'Municipio');
    populateSelect('filterBarrio', data.barrios, 'Barrio');
  } catch (_) {}
}

function populateSelect(id, options, placeholder) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt; o.textContent = opt;
    if (opt === current) o.selected = true;
    sel.appendChild(o);
  });
}

function updateFilterDropdowns() {
  const municipios = [...new Set(state.properties.map(p => p.municipio).filter(Boolean))].sort();
  populateSelect('filterMunicipio', municipios, 'Municipio');

  const municipio = document.getElementById('filterMunicipio')?.value || '';
  const barriosFiltrados = [...new Set(state.properties
    .filter(p => !municipio || p.municipio === municipio)
    .map(p => p.barrio).filter(Boolean))].sort();
  populateSelect('filterBarrio', barriosFiltrados, 'Barrio');

  // Sincronizar selectores del panel móvil
  const mMunicipio = document.getElementById('filterMunicipioMobile');
  const mBarrio    = document.getElementById('filterBarrioMobile');
  if (mMunicipio) {
    const curM = mMunicipio.value;
    mMunicipio.innerHTML = '<option value="">Todos los municipios</option>';
    municipios.forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = m;
      if (m === curM) o.selected = true;
      mMunicipio.appendChild(o);
    });
  }
  if (mBarrio) {
    const selectedMunicipio = mMunicipio ? mMunicipio.value : '';
    const barriosMobile = [...new Set(state.properties
      .filter(p => !selectedMunicipio || p.municipio === selectedMunicipio)
      .map(p => p.barrio).filter(Boolean))].sort();
    const curB = mBarrio.value;
    mBarrio.innerHTML = '<option value="">Todos los barrios</option>';
    barriosMobile.forEach(b => {
      const o = document.createElement('option');
      o.value = b; o.textContent = b;
      if (b === curB) o.selected = true;
      mBarrio.appendChild(o);
    });
  }
}

function updateDynamicFilterRanges() {
  const props = state.properties;
  if (!props.length) return;

  // Calcular rangos reales
  const habitaciones = props.map(p => Number(p.habitaciones) || 0).filter(Boolean);
  const banos = props.map(p => Number(p.banos) || 0).filter(Boolean);
  const precios = props.map(p => Number(p.precio) || 0).filter(Boolean);

  const maxHab = Math.max(...habitaciones, 3);
  const maxBan = Math.max(...banos, 3);
  const minPrecio = Math.min(...precios);
  const maxPrecio = Math.max(...precios);

  // Actualizar pills de habitaciones dinámicamente
  const habContainer = document.querySelector('.filter-section:nth-of-type(1) .hab-options');
  if (habContainer) {
    const habOptions = [0];
    for (let i = 1; i <= Math.min(maxHab, 5); i++) {
      habOptions.push(i);
    }
    const currentActive = document.querySelector('.hab-btn.active')?.dataset.hab;
    const habIcons = {
      0: '🏠', 1: '🛏️', 2: '🛏️🛏️', 3: '🛏️🛏️🛏️', 4: '🏘️', 5: '🏘️'
    };
    habContainer.innerHTML = habOptions.map(h =>
      `<button class="hab-btn${currentActive == h ? ' active' : ''}" data-hab="${h}" title="${h === 0 ? 'Todas las habitaciones' : h + ' o más habitaciones'}">
        <span class="filter-icon">${habIcons[h] || '🏠'}</span>
        <span>${h === 0 ? 'Todos' : h + '+'}</span>
      </button>`
    ).join('');

    // Re-setup event listeners para los nuevos botones
    habContainer.querySelectorAll('.hab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        habContainer.querySelectorAll('.hab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // Actualizar pills de baños dinámicamente
  const banContainer = document.querySelector('.filter-section:nth-of-type(2) .hab-options');
  if (banContainer) {
    const banOptions = [0];
    for (let i = 1; i <= Math.min(maxBan, 5); i++) {
      banOptions.push(i);
    }
    const currentActive = document.querySelector('.ban-btn.active')?.dataset.ban;
    const banIcons = {
      0: '🚿', 1: '🚿', 2: '🚿🚿', 3: '🚿🚿🚿', 4: '🏢', 5: '🏢'
    };
    banContainer.innerHTML = banOptions.map(b =>
      `<button class="ban-btn${currentActive == b ? ' active' : ''}" data-ban="${b}" title="${b === 0 ? 'Todos los baños' : b + ' o más baños'}">
        <span class="filter-icon">${banIcons[b] || '🚿'}</span>
        <span>${b === 0 ? 'Todos' : b + '+'}</span>
      </button>`
    ).join('');

    // Re-setup event listeners para los nuevos botones
    banContainer.querySelectorAll('.ban-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        banContainer.querySelectorAll('.ban-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // Actualizar rango de precios sugeridos
  const pricePresetsContainer = document.querySelector('.filter-price-presets');
  if (pricePresetsContainer) {
    const mid = Math.round((minPrecio + maxPrecio) / 2);
    const mid1 = Math.round(minPrecio + (maxPrecio - minPrecio) / 3);
    const mid2 = Math.round(minPrecio + (maxPrecio - minPrecio) * 2 / 3);

    const presets = [
      { min: minPrecio, max: mid1, label: `Hasta ${formatPrecioSimple(mid1)}` },
      { min: mid1, max: mid2, label: `${formatPrecioSimple(mid1)} - ${formatPrecioSimple(mid2)}` },
      { min: mid2, max: maxPrecio, label: `Desde ${formatPrecioSimple(mid2)}` }
    ];

    pricePresetsContainer.innerHTML = presets.map((p, i) =>
      `<button class="filter-preset" data-min="${p.min}" data-max="${p.max}">${p.label}</button>`
    ).join('');

    // Re-setup presets listeners
    pricePresetsContainer.querySelectorAll('.filter-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        pricePresetsContainer.querySelectorAll('.filter-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('fMinPrecio').value = btn.dataset.min || '';
        document.getElementById('fMaxPrecio').value = btn.dataset.max || '';
        updatePrecioLabel();
      });
    });
  }

  // Actualizar amenidades: solo mostrar las que existan
  const amenitiesSet = new Set();
  props.forEach(p => {
    if (p.amenidades && Array.isArray(p.amenidades)) {
      p.amenidades.forEach(a => amenitiesSet.add(a));
    }
  });

  const amenitiesContainers = document.querySelectorAll('.filter-amenidades');
  if (amenitiesContainers.length > 0 && amenitiesSet.size > 0) {
    const existingAmenities = Array.from(amenitiesSet).sort();
    const AMENITY_ICONS = {
      'Piscina':         `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="5" r="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 7v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
      'Gimnasio':        `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M6 12h12M4 9v6M8 6v12M16 6v12M20 9v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
      'Zona BBQ':        `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M6 8h12l-2 5H8L6 8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 13v5M9 18h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 5c0-1 .5-2 1-2s1 1 1 1 .5-1 1-1 1 1 1 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      'Portería 24h':    `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M12 2L3 6.5v5c0 5.25 3.75 10.15 9 11.35C17.25 21.65 21 16.75 21 11.5v-5L12 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'Seguridad 24h':   `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M12 2L3 6.5v5c0 5.25 3.75 10.15 9 11.35C17.25 21.65 21 16.75 21 11.5v-5L12 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'Ascensor':        `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 10l2.5-3 2.5 3M9.5 14l2.5 3 2.5-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'Terraza':         `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M3 21h18M5 21V9l7-6 7 6v12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 21v-5h6v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'Depósito':        `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.27 6.96L12 12l8.73-5.04M12 22V12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
      'Estudio':         `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5V4.5A2.5 2.5 0 016.5 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 7h8M8 11h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      'Cocina integral': `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M2 9h20" stroke="currentColor" stroke-width="1.8"/><circle cx="7" cy="6" r="1.2" fill="currentColor"/><circle cx="12" cy="6" r="1.2" fill="currentColor"/><circle cx="17" cy="6" r="1.2" fill="currentColor"/><rect x="6" y="12" width="12" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>`,
      'Cocina Integral': `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M2 9h20" stroke="currentColor" stroke-width="1.8"/><circle cx="7" cy="6" r="1.2" fill="currentColor"/><circle cx="12" cy="6" r="1.2" fill="currentColor"/><circle cx="17" cy="6" r="1.2" fill="currentColor"/><rect x="6" y="12" width="12" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>`,
    };
    const GENERIC_ICON = `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

    const checkedAmenities = new Set([...document.querySelectorAll('.amenity-check input:checked')].map(cb => cb.value));
    const amenityHTML = existingAmenities.map(amenity => {
      const icon = AMENITY_ICONS[amenity] || GENERIC_ICON;
      return `<label class="amenity-check">
        <input type="checkbox" value="${amenity}"${checkedAmenities.has(amenity) ? ' checked' : ''}/>
        <span class="amenity-card">
          <span class="amenity-icon-wrap">${icon}</span>
          <span class="amenity-label">${amenity}</span>
        </span>
      </label>`;
    }).join('');

    for (const container of amenitiesContainers) {
      container.innerHTML = amenityHTML;
    }
  }
}

function formatPrecioSimple(price) {
  if (price >= 1000000) return '$' + (price / 1000000).toFixed(0) + 'M';
  if (price >= 1000) return '$' + (price / 1000).toFixed(0) + 'K';
  return '$' + price;
}

// Filtra barrios al cambiar municipio en el panel móvil
function setupMobileBarrioFilter() {
  const mMunicipio = document.getElementById('filterMunicipioMobile');
  const mBarrio    = document.getElementById('filterBarrioMobile');
  if (!mMunicipio || !mBarrio) return;
  mMunicipio.addEventListener('change', () => {
    const m = mMunicipio.value;
    const barrios = [...new Set(state.properties
      .filter(p => !m || p.municipio === m)
      .map(p => p.barrio).filter(Boolean))].sort();
    mBarrio.innerHTML = '<option value="">Todos los barrios</option>';
    barrios.forEach(b => {
      const o = document.createElement('option');
      o.value = b; o.textContent = b;
      mBarrio.appendChild(o);
    });
    mBarrio.value = '';
  });
}

// ─── RENDER GRID ──────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('propertiesGrid');
  const countEl = document.getElementById('resultsCount');
  const props = state.filtered;

  countEl.textContent = props.length
    ? `${props.length} inmueble${props.length !== 1 ? 's' : ''}`
    : '';

  if (!props.length) {
    grid.innerHTML = `<div class="empty-state"><p>No se encontraron inmuebles con los filtros aplicados.</p></div>`;
    return;
  }

  // Calcular top 3 con más likes (de TODAS las propiedades, no solo filtered)
  const top3Ids = new Set(
    [...state.properties]
      .filter(p => (p.likes || 0) > 0)
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 3)
      .map(p => String(p.id))
  );
  state._top3LikeIds = top3Ids;

  grid.innerHTML = props.map(p => cardHTML(p)).join('') +
    '<div class="grid-bottom-spacer" aria-hidden="true"></div>';

  // Animación de entrada (se agrega después de insertar en DOM)
  requestAnimationFrame(() => {
    grid.querySelectorAll('.property-card').forEach(card => card.classList.add('card-animate'));
  });

  // Setup interactions
  grid.querySelectorAll('.property-card').forEach(card => {
    setupExpand(card);
    setupSlider(card);
    setupLikeBtn(card);
    setupShareBtn(card);
    setupContactBtn(card);
    if (state.isAdmin) setupAdminActions(card);
  });

  // Handle URL param ?id=
  const urlId = new URLSearchParams(window.location.search).get('id');
  if (urlId) {
    const targetCard = grid.querySelector(`[data-card-id="${urlId}"]`);
    if (targetCard) {
      setTimeout(() => {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        openCard(targetCard);
      }, 300);
    }
  }
}

// ─── CARD HTML ────────────────────────────────────────────────
function cardHTML(p) {
  const images = p.images || [];
  let amenidades = [];
  try { amenidades = Array.isArray(p.amenidades) ? p.amenidades : JSON.parse(p.amenidades || '[]'); } catch { amenidades = []; }
  // Normalizar: dividir strings largos que contengan varias amenidades pegadas
  amenidades = amenidades.flatMap(a => {
    if (typeof a !== 'string' || a.length <= 20) return [a];
    const rx = /(?=\b(?:\d+\s+[A-ZÁÉÍÓÚÑ]|Piscina|Gimnasio|Zona|Sala|Cuarto|Terraza|Ascensor|Portería|Porteria|Depósito|Deposito|Estudio|Cocina|Balcón|Balcon|Nicho|Vestier|Clósets?|Closets?|BBQ|Parqueadero|Seguridad|Vigilancia|Cancha|Lavandería|Lavanderia|Sotano|Sótano|Vista|Patio|Jardín|Jardin|Bikeroom|Coworking)\b)/i;
    const parts = a.split(rx).map(s => s.trim()).filter(Boolean);
    return parts.length > 1 ? parts : [a];
  });
  const isLiked = state.likedIds.has(String(p.id));
  const isCombinado = p.tipo === 'combinado';
  const price = isCombinado ? formatPrice(p.precioArriendo || p.precio) : formatPrice(p.precio);
  const statusClass = p.estado === 'ocupado' ? 'status-ocupado' : 'status-libre';
  const statusLabel = p.estado === 'ocupado' ? 'Ocupado' : 'Libre';

  // Badge esquina superior derecha: top 3 de likes
  const isTopLikes = (state._top3LikeIds || new Set()).has(String(p.id));
  const topBadgeHtml = isTopLikes
    ? '<span class="prop-corner-badge">Muy buscado</span>'
    : '';

  // Badge inline (al lado de Arriendo/Venta): "Nuevo" si < 50 vistas
  const isNuevo = (p.views || 0) < 50;
  const nuevoBadgeHtml = isNuevo
    ? '<span class="tipo-badge tipo-badge--nuevo">Nuevo</span>'
    : '';

  const slides = images.length
    ? images.map((img, i) => `
        <div class="property-slide ${i === 0 ? 'is-active' : ''}">
          <img ${i === 0
            ? `src="/${encodeImgPath(img.filename)}"`
            : `data-src="/${encodeImgPath(img.filename)}" src=""`
          } alt="${p.title} foto ${i + 1}" loading="lazy" decoding="async" class="lazy-img" />
        </div>`).join('')
    : `<div class="property-slide is-active"><div class="no-photo-placeholder"><svg viewBox="0 0 64 64" fill="none" width="44" height="44"><path d="M8 28L32 8l24 20v28H8V28z" fill="rgba(148,163,184,.25)" stroke="rgba(148,163,184,.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 56V38h16v18" stroke="rgba(148,163,184,.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Sin fotografía</span></div></div>`;

  const stripEmoji = s => s.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();
  const amenidadesHTML = [...amenidades]
    .sort((a, b) => stripEmoji(a).localeCompare(stripEmoji(b), 'es'))
    .map(a => `<span class="amenity-chip">${stripEmoji(a)}</span>`)
    .join('');

  const stats = [];
  if (p.area) stats.push(`<div class="stat-item"><p>${p.area}</p><span>m²</span></div>`);
  if (p.habitaciones) stats.push(`<div class="stat-item ${p.area ? 'with-border' : ''}"><p>${p.habitaciones}</p><span>Hab</span></div>`);
  if (p.banos) stats.push(`<div class="stat-item with-border"><p>${p.banos}</p><span>Baños</span></div>`);

  const adminActions = state.isAdmin ? `
    <div class="admin-actions">
      <button class="admin-btn edit-btn" data-id="${p.id}">
        <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        Editar
      </button>
      <button class="admin-btn danger delete-btn" data-id="${p.id}">
        <svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Eliminar
      </button>
    </div>` : '';

  return `
    <article class="property-card" data-card-id="${p.id}">
      <div class="property-card-inner">
        <div class="property-media">
          <div class="property-slider" data-slider>
            <div class="property-slides">${slides}</div>
            <button class="slider-arrow prev" type="button" data-prev aria-label="Anterior">
              <svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="slider-arrow next" type="button" data-next aria-label="Siguiente">
              <svg viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <div class="slider-dots" data-dots></div>
            ${images.length ? `<button class="lightbox-trigger" type="button" data-lightbox aria-label="Ver galería completa">
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>` : ''}
          </div>
          <div class="media-overlay">
            <div class="media-overlay-top">
              <button class="status-btn ${statusClass}" data-id="${p.id}" data-estado="${p.estado}" type="button">
                <span class="status-dot"></span>${statusLabel}
              </button>
              ${topBadgeHtml}
            </div>
            <div class="media-overlay-bottom">
              <div class="media-location">
                <p class="location-municipio">${p.municipio || ''}</p>
                <h2 class="location-barrio">${p.barrio || p.title}</h2>
                <span class="tipo-overlay-badge">${isCombinado ? 'Arriendo · Venta' : (p.tipo === 'venta' ? 'Venta' : 'Arriendo')}</span>
              </div>
              <div class="card-price-wrap">
                <div class="card-price">${price}${isCombinado ? '<span class="price-sublabel">/mes</span>' : ''}</div>
                ${isCombinado && p.precioVenta ? `<div class="card-price-secondary">Venta: ${formatPrice(p.precioVenta)}</div>` : ''}
              </div>
            </div>
          </div>
        </div>

        <div class="card-actions-bar">
          <button class="like-btn ${isLiked ? 'is-liked' : ''}" data-id="${p.id}" type="button" aria-label="Me gusta">
            <svg viewBox="0 0 24 24" fill="${isLiked ? '#ef4444' : 'none'}" stroke="${isLiked ? '#ef4444' : 'currentColor'}" stroke-width="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            <span class="like-count">${p.likes || 0}</span>
          </button>
          <div class="views-btn" aria-label="Vistas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="views-count" data-id="${p.id}">${p.views || 0}</span>
          </div>
          <span class="tipo-badge tipo-badge--${isCombinado ? 'combinado' : (p.tipo === 'venta' ? 'venta' : 'arriendo')}">${isCombinado ? 'Arr · Venta' : (p.tipo === 'venta' ? 'Venta' : 'Arriendo')}</span>
          ${nuevoBadgeHtml}
          <button class="expand-toggle" type="button" aria-expanded="false" aria-label="Ver detalles">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <div class="property-details">
          <div class="property-details-scroll custom-scrollbar">
            <div class="detail-header">
              <h3>${p.title}</h3>
              <p class="detail-address">${[p.direccion, p.piso ? `Piso ${p.piso}` : '', p.sector].filter(Boolean).join(' · ')}</p>
              ${timeAgo(p.created_at) ? `<span class="detail-date">Publicado ${timeAgo(p.created_at)}</span>` : ''}
            </div>

            ${isCombinado ? `
            <div class="dual-price-section">
              <div class="dual-price-item">
                <span class="dual-price-label">🔑 Arriendo / mes</span>
                <span class="dual-price-value">${formatPrice(p.precioArriendo || p.precio)}</span>
              </div>
              <div class="dual-price-item">
                <span class="dual-price-label">💰 Precio de Venta</span>
                <span class="dual-price-value">${formatPrice(p.precioVenta)}</span>
              </div>
            </div>` : ''}

            ${stats.length ? `<div class="property-stats">${stats.join('')}</div>` : ''}

            ${amenidades.length ? `
            <div class="property-amenities">
              <p class="section-label">Características</p>
              <div class="amenities-list">${amenidadesHTML}</div>
            </div>` : ''}

            ${p.descripcion ? (() => {
              const MAX = 130;
              const long = p.descripcion.length > MAX;
              return `<div class="property-description">
                <p>${long
                  ? `<span class="desc-truncated">${p.descripcion.slice(0, MAX)}…</span><span class="desc-full" hidden>${p.descripcion}</span>`
                  : p.descripcion}
                </p>
                ${long ? `<button class="desc-toggle" type="button">Ver más</button>` : ''}
              </div>`;
            })() : ''}

            <div class="detail-actions">
              <button class="share-btn" data-id="${p.id}" type="button">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Compartir
              </button>
              <button class="contact-btn" type="button"
                data-contact-id="${p.id}"
                data-contact-title="${(p.title||'').replace(/"/g,'&quot;')}"
                data-contact-price="${price}"
                data-contact-img="${images[0] ? '/' + encodeImgPath(images[0].filename) : ''}"
                data-contact-address="${[p.direccion, p.piso ? `Piso ${p.piso}` : '', p.sector].filter(Boolean).join(', ').replace(/"/g,'&quot;')}"
                data-contact-municipio="${(p.municipio||'').replace(/"/g,'&quot;')}"
                data-contact-barrio="${(p.barrio||'').replace(/"/g,'&quot;')}"
                data-contact-area="${p.area||''}"
                data-contact-beds="${p.habitaciones||''}"
                data-contact-baths="${p.banos||''}"
                data-contact-amenities="${JSON.stringify(amenidades.slice(0,8)).replace(/"/g,'&quot;')}">
                <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Contactar
              </button>
            </div>
            ${adminActions}
          </div>
        </div>
      </div>
    </article>`;
}

// ─── EXPAND / COLLAPSE ────────────────────────────────────────
function setupExpand(card) {
  const toggle = card.querySelector('.expand-toggle');
  const media  = card.querySelector('.property-media');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    card.classList.contains('is-open') ? closeCard(card) : openCard(card);
  });
  if (media) {
    media.addEventListener('click', (e) => {
      if (e.target.closest('.slider-arrow') || e.target.closest('.slider-dots') || e.target.closest('.status-btn') || e.target.closest('[data-lightbox]')) return;
      if (card.classList.contains('is-open') && e.target.tagName === 'IMG') {
        const slider = card.querySelector('[data-slider]');
        const current = Array.from(slider?.querySelectorAll('.property-slide') || []).findIndex(s => s.classList.contains('is-active'));
        const srcs = Array.from(card.querySelectorAll('.property-slide img')).map(img => img.src || img.dataset.src).filter(Boolean);
        if (srcs.length) { openLightbox(srcs, Math.max(0, current)); return; }
      }
      card.classList.contains('is-open') ? closeCard(card) : openCard(card);
    });
  }

  // Fix #5: swipe-down para cerrar la tarjeta en móvil
  const scrollEl = card.querySelector('.property-details-scroll');
  if (scrollEl) {
    let _touchStartY = 0;
    let _touchStartScroll = 0;
    scrollEl.addEventListener('touchstart', (e) => {
      _touchStartY = e.touches[0].clientY;
      _touchStartScroll = scrollEl.scrollTop;
    }, { passive: true });
    scrollEl.addEventListener('touchend', (e) => {
      if (!card.classList.contains('is-open')) return;
      const diffY = e.changedTouches[0].clientY - _touchStartY;
      // Cerrar si: deslizó hacia abajo > 80px Y estaba al tope del scroll
      if (diffY > 80 && _touchStartScroll <= 4) {
        closeCard(card);
      }
    }, { passive: true });
  }
}

// ─── CLOSE HINT TOOLTIP ──────────────────────────────────────
const CLOSE_HINT_KEY = 'closeHintSeen_v1';
let _closeHintTimer = null;
let _activeHintEl   = null;

function showCloseHint(card) {
  // Solo la primera vez que el usuario abre una tarjeta
  if (localStorage.getItem(CLOSE_HINT_KEY)) return;
  localStorage.setItem(CLOSE_HINT_KEY, '1');

  const toggle = card.querySelector('.expand-toggle');
  if (!toggle) return;

  // Crear tooltip
  const tip = document.createElement('div');
  tip.className = 'close-hint-tooltip';
  tip.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M18 15l-6-6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Toca aquí para cerrar`;
  tip.style.opacity = '0';
  document.body.appendChild(tip);
  _activeHintEl = tip;

  // Posicionar encima del botón
  function positionTip() {
    const rect = toggle.getBoundingClientRect();
    const tw   = tip.offsetWidth;
    const th   = tip.offsetHeight;
    let left = rect.left + rect.width / 2 - tw / 2;
    let top  = rect.top - th - 10;
    // No salir por la izquierda/derecha
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    // Si no cabe arriba, mostrar abajo (invertir flecha)
    if (top < 8) {
      top = rect.bottom + 10;
      tip.style.setProperty('--arrow-top', 'auto');
    }
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
    tip.style.opacity = '';
  }

  requestAnimationFrame(() => {
    positionTip();
    // Reposicionar si el card animó (delay del expand)
    setTimeout(positionTip, 360);
  });

  function dismissHint() {
    if (!_activeHintEl) return;
    clearTimeout(_closeHintTimer);
    _activeHintEl.classList.add('hint-out');
    const el = _activeHintEl;
    _activeHintEl = null;
    setTimeout(() => el.remove(), 300);
    toggle.removeEventListener('click', dismissHint);
  }

  // Auto-cerrar a los 4.5s
  _closeHintTimer = setTimeout(dismissHint, 4500);

  // Cerrar también cuando el usuario toca el botón
  toggle.addEventListener('click', dismissHint, { once: true });

  // Cerrar si el usuario hace scroll o toca en otro lado
  document.addEventListener('scroll', dismissHint, { once: true, passive: true });
  document.addEventListener('touchstart', dismissHint, { once: true, passive: true });
}

// ── Muestra/oculta la floating-bar según si hay tarjetas cerca del menú ──
function updateBarVisibility() {
  const isMobile = window.innerWidth <= 767;
  if (isMobile) return;

  const bar = document.querySelector('.floating-bar');
  if (!bar) return;

  const barTop     = bar.getBoundingClientRect().top;
  // Altura expandida de una tarjeta desktop (variable CSS)
  const expandedH  = parseInt(
    getComputedStyle(document.documentElement)
      .getPropertyValue('--card-expanded-height-desktop')
  ) || 690;

  // Para cada tarjeta abierta, usamos el mayor valor entre:
  // • Su borde inferior actual (post-transición)
  // • Su borde superior + altura expandida (predicción pre-transición)
  const anyNear = Array.from(document.querySelectorAll('.property-card.is-open'))
    .some(c => {
      const r = c.getBoundingClientRect();
      return Math.max(r.bottom, r.top + expandedH) > barTop - 10;
    });

  bar.classList.toggle('bar-hidden', anyNear);
}

function openCard(card) {
  // Cerrar overlay del mapa si está abierto (fix conflicto #3)
  if (typeof closeMapOverlay === 'function') closeMapOverlay();

  const isMobile = window.innerWidth <= 767;

  // ── Scroll desktop: el CSS scroll-margin-bottom guarda espacio sobre el menú ──
  function scrollDesktopCardIntoView() {
    card.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  // ── Scroll mobile: ajuste manual para esquivar la tab bar ──
  function scrollMobileCardAboveBar() {
    const floatingBar = document.querySelector('.floating-bar');
    const barH      = floatingBar ? floatingBar.offsetHeight : 60;
    const barBottom = floatingBar ? parseFloat(getComputedStyle(floatingBar).bottom) || 0 : 0;
    const gap       = 16;
    const clearance = window.innerHeight - barH - barBottom - gap;
    const cardRect  = card.getBoundingClientRect();
    if (cardRect.bottom > clearance) {
      const extra = cardRect.bottom - clearance;
      window.scrollBy({ top: extra, behavior: 'smooth' });
    }
  }

  if (!isMobile) {
    document.querySelectorAll('.property-card.is-open').forEach(c => {
      if (c !== card) c.style.zIndex = '10';
    });
    card.classList.add('is-open');
    card.style.zIndex = '20';
    // Detección inmediata: antes de cualquier scroll, predecir si la tarjeta
    // expandida llegará al menú y ocultarlo si es necesario
    updateBarVisibility();
    // Scroll después de que la transición termine (340ms + buffer)
    setTimeout(scrollDesktopCardIntoView, 380);
  } else {
    document.querySelectorAll('.property-card.is-open').forEach(c => closeCard(c));
    card.classList.add('is-open');
    card.style.zIndex = '10';
    syncMobileHeight(card);

    requestAnimationFrame(() => {
      const headerH = document.querySelector('.top-bar')?.offsetHeight ?? 72;
      const cardRect = card.getBoundingClientRect();
      const scrollTarget = window.scrollY + cardRect.top - headerH - 10;
      window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
    });
    setTimeout(scrollMobileCardAboveBar, 700);

    // Fix #4: expandir sidebar del mapa para que botones no queden enterrados
    const sidebar = document.getElementById('mapSidebar');
    if (sidebar) {
      sidebar.classList.remove('sheet-hidden');
      sidebar.classList.add('sheet-expanded');
    }
  }
  // ── Facebook Pixel: ViewContent ────────────────────────────────
  if (typeof fbq === 'function') {
    const propId = card.dataset.cardId || card.dataset.mapCardId || '';
    const prop   = state.properties.find(p => String(p.id) === propId);
    const eid    = _fbEventId('ViewContent');
    const vcData = {
      content_ids:      [propId],
      content_type:     'home_listing',
      content_name:     prop?.title   || '',
      content_category: [prop?.municipio, prop?.barrio].filter(Boolean).join(', '),
      value:            _propNumPrice(prop),
      currency:         'COP',
      eventID:          eid
    };
    fbq('track', 'ViewContent', vcData);
    _sendCAPI('ViewContent', {
      content_ids:      [propId],
      content_type:     'home_listing',
      content_name:     prop?.title || '',
      value:            _propNumPrice(prop),
      currency:         'COP'
    }, eid);
  }
  card.querySelector('.expand-toggle')?.setAttribute('aria-expanded', 'true');
  card.querySelector('.property-details-scroll')?.scrollTo(0, 0);
  // Mostrar tooltip de cierre (solo la primera vez que abre una tarjeta)
  setTimeout(() => showCloseHint(card), 420);

  // Registrar vista
  const propId = card.dataset.cardId;
  if (propId) trackView(propId);
}

function closeCard(card) {
  // Animación slide-down antes de cerrar (fix #5)
  card.classList.add('is-closing');
  setTimeout(() => card.classList.remove('is-closing'), 200);
  card.classList.remove('is-open');
  card.style.zIndex = '1';
  card.style.height = '';
  card.querySelector('.expand-toggle')?.setAttribute('aria-expanded', 'false');
  // Si en mapa, colapsar sidebar al estado normal
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('mapSidebar');
    if (sidebar) sidebar.classList.remove('sheet-expanded');
  }
  // Al cerrar, re-evaluar si el menú puede volver a mostrarse
  updateBarVisibility();
}

// ─── FACEBOOK PIXEL: LEAD ────────────────────────────────────
// Se dispara cada vez que alguien hace clic en un botón de contacto
// o en un enlace de WhatsApp. Permite a Facebook optimizar anuncios
// para personas que realmente contactan (CBO, Leads, ROAS).
function trackLead(source, propTitle, propId, propPrice) {
  // Log del lead en base de datos (siempre, con o sin Pixel)
  const channel = source?.includes('whatsapp') || source?.includes('wa') ? 'whatsapp' : 'contact';
  logLead(propId, propTitle, propPrice, channel, source);

  if (typeof fbq !== 'function') return;

  const numPrice = _fbPrice(propPrice);
  const ids      = propId ? [String(propId)] : [];
  const eid      = _fbEventId('Lead');

  // Evento Lead estándar — optimización de conversiones
  fbq('track', 'Lead', {
    content_ids:      ids,
    content_type:     'home_listing',
    content_name:     propTitle || 'Consulta general',
    content_category: 'inmobiliaria',
    value:            numPrice,
    currency:         'COP',
    eventID:          eid
  });

  // Evento personalizado para WhatsApp — segmentación granular
  if (source?.includes('wa') || source?.includes('whatsapp')) {
    fbq('trackCustom', 'ContactWhatsApp', {
      content_ids:  ids,
      content_name: propTitle || '',
      value:        numPrice,
      currency:     'COP'
    });
  }

  // CAPI duplicado server-side (blinda iOS 14+ / navegadores sin cookies)
  _sendCAPI('Lead', {
    content_ids:      ids,
    content_type:     'home_listing',
    content_name:     propTitle || 'Consulta general',
    value:            numPrice,
    currency:         'COP'
  }, eid);
}


function syncMobileHeight(card) {
  card.style.height = window.innerWidth <= 479
    ? '740px'
    : 'var(--card-expanded-height-mobile)';
}

// ─── VIEWS ────────────────────────────────────────────────────
async function trackView(propId) {
  const KEY = `viewed_${propId}`;
  const now = Date.now();
  const last = Number(localStorage.getItem(KEY) || 0);
  const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;
  if (now - last < TWENTY_FOUR_H) return; // ya contada en las últimas 24h

  try {
    const data = await apiFetch(`/api/properties/${propId}/view`, { method: 'POST' });
    if (data && typeof data.views === 'number') {
      updateViewCount(propId, data.views);
      localStorage.setItem(KEY, String(now));
    }
  } catch (_) {}
}

function updateViewCount(id, count) {
  document.querySelectorAll(`.views-count[data-id="${id}"]`).forEach(el => {
    el.textContent = count;
    el.style.animation = 'none';
    setTimeout(() => { el.style.animation = 'countUp .35s ease-out'; }, 10);
  });
}

// ─── LOGGING DE BÚSQUEDAS ─────────────────────────────────────
async function logSearch(resultsCount) {
  try {
    await fetch('/api/searches/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: {
          tipo: state.tipo,
          municipio: state.municipio,
          barrio: state.barrio,
          search: state.search,
          minPrecio: state.minPrecio,
          maxPrecio: state.maxPrecio,
          minHab: state.minHab,
          minBanos: state.minBanos,
          estado: state.filterEstado,
          orderBy: state.orderBy
        },
        resultsCount: resultsCount || state.filtered.length
      }),
      credentials: 'same-origin'
    });
  } catch (_) {
    // Silent fail - logging errors no deben afectar UX
  }
}

// ─── LOGGING DE LEADS ─────────────────────────────────────────
async function logLead(propId, propTitle, propPrice, contactChannel, source) {
  try {
    await fetch('/api/leads/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propId: propId || '',
        propTitle: propTitle || '',
        propPrice: propPrice || 0,
        contactChannel: contactChannel || 'unknown',
        source: source || 'unknown'
      }),
      credentials: 'same-origin'
    });
  } catch (_) {
    // Silent fail - logging errors no deben afectar UX
  }
}

// ─── LAZY LOADING (IntersectionObserver) ──────────────────────
const _lazyObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const img = entry.target;
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
    }
    img.addEventListener('load', () => img.classList.add('img-loaded'), { once: true });
    img.addEventListener('error', () => img.classList.add('img-loaded'), { once: true });
    _lazyObserver.unobserve(img);
  });
}, { rootMargin: '200px' });

function initSliderLazy(card) {
  // Primera imagen: marcar como cargada cuando termine
  card.querySelectorAll('.property-slide:first-child img.lazy-img').forEach(img => {
    if (img.complete) img.classList.add('img-loaded');
    else img.addEventListener('load', () => img.classList.add('img-loaded'), { once: true });
  });
  // Resto: observar con IntersectionObserver
  card.querySelectorAll('.property-slide:not(:first-child) img.lazy-img[data-src]').forEach(img => {
    _lazyObserver.observe(img);
  });
}

// ─── LIGHTBOX ─────────────────────────────────────────────────
let _lbSrcs = [], _lbIdx = 0, _lbZoomed = false;
let _lbPanX = 0, _lbPanY = 0, _lbDragStartX = 0, _lbDragStartY = 0, _lbDragging = false;
let _lbLastTap = 0, _lbKH = null;

function openLightbox(srcs, startIdx) {
  _lbSrcs = srcs.filter(Boolean);
  if (!_lbSrcs.length) return;
  _lbIdx = Math.max(0, Math.min(startIdx, _lbSrcs.length - 1));
  _lbZoomed = false; _lbPanX = 0; _lbPanY = 0;

  const overlay = document.getElementById('lightboxOverlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  lbRender();

  // Keyboard
  if (_lbKH) document.removeEventListener('keydown', _lbKH);
  _lbKH = (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft')  lbGo(-1);
    if (e.key === 'ArrowRight') lbGo(1);
  };
  document.addEventListener('keydown', _lbKH);
}

function closeLightbox() {
  const overlay = document.getElementById('lightboxOverlay');
  if (!overlay) return;
  overlay.style.display = 'none';
  document.body.style.overflow = '';
  lbResetZoom();
  if (_lbKH) { document.removeEventListener('keydown', _lbKH); _lbKH = null; }
}

function lbRender() {
  const img    = document.getElementById('lightboxImg');
  const ctr    = document.getElementById('lightboxCounter');
  const thumbs = document.getElementById('lightboxThumbs');
  const prev   = document.getElementById('lightboxPrev');
  const next   = document.getElementById('lightboxNext');
  const spinner = document.getElementById('lightboxSpinner');
  if (!img) return;

  // Mostrar spinner mientras carga
  if (spinner) spinner.style.display = 'flex';

  // Fade swap
  img.style.opacity = '0';
  img.src = _lbSrcs[_lbIdx];
  img.onload = () => {
    img.style.opacity = '1';
    if (spinner) spinner.style.display = 'none';
  };
  img.style.transition = 'opacity .18s ease, transform .25s ease';

  lbResetZoom(false); // reset zoom sin redibujar transform

  ctr.textContent = `${_lbIdx + 1} / ${_lbSrcs.length}`;

  const multi = _lbSrcs.length > 1;
  prev.style.display = multi ? 'flex' : 'none';
  next.style.display = multi ? 'flex' : 'none';

  // Miniaturas
  if (thumbs) {
    thumbs.innerHTML = _lbSrcs.map((src, i) => `
      <img class="lightbox-thumb${i === _lbIdx ? ' is-active' : ''}" src="${src}" data-lb-idx="${i}" alt="Foto ${i+1}" loading="lazy" />`).join('');
    thumbs.querySelectorAll('.lightbox-thumb').forEach(t => {
      t.addEventListener('click', () => lbGoTo(Number(t.dataset.lbIdx)));
    });
    // Scroll thumb activo a la vista
    const active = thumbs.querySelector('.lightbox-thumb.is-active');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Precargar siguiente y anterior imagen
  lbPreloadAdjacentImages();
}

function lbPreloadAdjacentImages() {
  if (_lbSrcs.length <= 1) return;

  const nextIdx = (_lbIdx + 1) % _lbSrcs.length;
  const prevIdx = (_lbIdx - 1 + _lbSrcs.length) % _lbSrcs.length;

  // Precargar siguiente
  const imgNext = new Image();
  imgNext.src = _lbSrcs[nextIdx];

  // Precargar anterior
  const imgPrev = new Image();
  imgPrev.src = _lbSrcs[prevIdx];
}

function lbGo(dir) {
  if (_lbZoomed) return;
  _lbIdx = ((_lbIdx + dir + _lbSrcs.length) % _lbSrcs.length);
  lbRender();
}

function lbGoTo(idx) {
  _lbIdx = idx;
  lbRender();
}

function lbResetZoom(updateTransform = true) {
  _lbZoomed = false; _lbPanX = 0; _lbPanY = 0;
  if (updateTransform) {
    const img = document.getElementById('lightboxImg');
    if (img) { img.style.transform = 'scale(1)'; img.style.cursor = 'zoom-in'; }
  }
}

function lbSetZoom(on) {
  const img = document.getElementById('lightboxImg');
  if (!img) return;
  _lbZoomed = on;
  if (on) {
    img.style.transform = `scale(2.6) translate(0px, 0px)`;
    img.style.cursor = 'grab';
  } else {
    lbResetZoom();
  }
}

function setupLightbox() {
  const overlay = document.getElementById('lightboxOverlay');
  const img     = document.getElementById('lightboxImg');
  const wrap    = document.getElementById('lightboxImgWrap');
  if (!overlay) return;

  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  document.getElementById('lightboxPrev').addEventListener('click', (e) => { e.stopPropagation(); lbGo(-1); });
  document.getElementById('lightboxNext').addEventListener('click', (e) => { e.stopPropagation(); lbGo(1); });

  // Clic en fondo → cerrar
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === wrap) closeLightbox();
  });

  // Doble clic → zoom toggle
  img.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    lbSetZoom(!_lbZoomed);
  });

  // Doble tap en móvil
  img.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - _lbLastTap < 280) { lbSetZoom(!_lbZoomed); e.preventDefault(); }
    _lbLastTap = now;
  }, { passive: false });

  // Pan con mouse cuando está zoomado
  img.addEventListener('mousedown', (e) => {
    if (!_lbZoomed) return;
    _lbDragging = true;
    _lbDragStartX = e.clientX - _lbPanX;
    _lbDragStartY = e.clientY - _lbPanY;
    img.classList.add('is-dragging');
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!_lbDragging || !_lbZoomed) return;
    _lbPanX = e.clientX - _lbDragStartX;
    _lbPanY = e.clientY - _lbDragStartY;
    img.style.transform = `scale(2.6) translate(${_lbPanX / 2.6}px, ${_lbPanY / 2.6}px)`;
  });
  document.addEventListener('mouseup', () => {
    if (_lbDragging) { _lbDragging = false; img.classList.remove('is-dragging'); }
  });

  // Wheel zoom (desktop)
  img.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!wrap) return;
    const scrollDir = e.deltaY < 0 ? 1 : -1;
    if (_lbZoomed) {
      // Si ya está zoomado, permitir zoom in/out adicional
      const currentScale = parseFloat(img.style.transform.match(/scale\(([\d.]+)\)/)?.[1] || 2.6);
      const newScale = Math.max(2.0, Math.min(4.5, currentScale + scrollDir * 0.4));
      img.style.transform = `scale(${newScale}) translate(${_lbPanX / newScale}px, ${_lbPanY / newScale}px)`;
    } else {
      // Si no está zoomado, el primer scroll activa zoom
      if (scrollDir > 0) lbSetZoom(true);
    }
  }, { passive: false });

  // Swipe izq/der en móvil para navegar
  let swX = 0, swY = 0;
  overlay.addEventListener('touchstart', (e) => {
    swX = e.touches[0].clientX; swY = e.touches[0].clientY;
  }, { passive: true });
  overlay.addEventListener('touchend', (e) => {
    if (_lbZoomed) return;
    const dx = e.changedTouches[0].clientX - swX;
    const dy = e.changedTouches[0].clientY - swY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 44) lbGo(dx > 0 ? -1 : 1);
  }, { passive: true });
}

// ─── SLIDER ───────────────────────────────────────────────────
function setupSlider(card) {
  const slider = card.querySelector('[data-slider]');
  if (!slider) return;

  const slides = Array.from(slider.querySelectorAll('.property-slide'));
  const dotsWrap = slider.querySelector('[data-dots]');
  let current = 0;

  if (dotsWrap && slides.length > 1) {
    dotsWrap.innerHTML = '';
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `slider-dot ${i === 0 ? 'is-active' : ''}`;
      dot.setAttribute('aria-label', `Foto ${i + 1}`);
      dot.addEventListener('click', e => { e.stopPropagation(); go(i); });
      dotsWrap.appendChild(dot);
    });
  }

  const dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll('.slider-dot')) : [];

  function go(idx) {
    current = ((idx % slides.length) + slides.length) % slides.length;
    slides.forEach((s, i) => {
      s.classList.toggle('is-active', i === current);
      // Cargar lazy img al activar slide
      const lazyImg = s.querySelector('img.lazy-img[data-src]');
      if (lazyImg && i === current) {
        lazyImg.src = lazyImg.dataset.src;
        lazyImg.removeAttribute('data-src');
        lazyImg.addEventListener('load', () => lazyImg.classList.add('img-loaded'), { once: true });
      }
    });
    dots.forEach((d, i) => d.classList.toggle('is-active', i === current));
  }

  slider.querySelector('[data-prev]')?.addEventListener('click', e => { e.stopPropagation(); go(current - 1); });
  slider.querySelector('[data-next]')?.addEventListener('click', e => { e.stopPropagation(); go(current + 1); });

  let tx = 0;
  slider.addEventListener('touchstart', e => { tx = e.changedTouches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientX - tx;
    if (Math.abs(diff) > 40) go(diff > 0 ? current - 1 : current + 1);
  }, { passive: true });

  // Botón lightbox trigger
  slider.querySelector('[data-lightbox]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const srcs = Array.from(slider.querySelectorAll('.property-slide img')).map(img => img.src || img.dataset.src).filter(Boolean);
    openLightbox(srcs, current);
  });

  // Inicializar lazy loading
  initSliderLazy(card);

  go(0);
}

// ─── LIKE ─────────────────────────────────────────────────────
function setupLikeBtn(card) {
  const btn = card.querySelector('.like-btn');
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const id = String(btn.dataset.id);
    const isLiked = state.likedIds.has(id);
    const action = isLiked ? 'remove' : 'add';

    // Optimistic update
    toggleLikeUI(id, !isLiked);
    if (isLiked) state.likedIds.delete(id); else state.likedIds.add(id);
    saveLikedIds();

    // ── Facebook Pixel: AddToWishlist (solo al agregar, no al quitar) ─
    if (!isLiked && typeof fbq === 'function') {
      const prop  = state.properties.find(p => String(p.id) === id);
      const price = _propNumPrice(prop);
      const eid   = _fbEventId('AddToWishlist');
      fbq('track', 'AddToWishlist', {
        content_ids:  [id],
        content_type: 'home_listing',
        content_name: prop?.title || '',
        value:        price,
        currency:     'COP',
        eventID:      eid
      });
      _sendCAPI('AddToWishlist', {
        content_ids:  [id],
        content_type: 'home_listing',
        content_name: prop?.title || '',
        value:        price,
        currency:     'COP'
      }, eid);
    }

    try {
      const res = await apiFetch(`/api/properties/${id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      updateLikeCount(id, res.likes);
    } catch (err) {
      // Revert on error
      if (isLiked) state.likedIds.add(id); else state.likedIds.delete(id);
      toggleLikeUI(id, isLiked);
      saveLikedIds();
    }
  });
}

function toggleLikeUI(id, isLiked) {
  document.querySelectorAll(`.like-btn[data-id="${id}"]`).forEach(btn => {
    btn.classList.toggle('is-liked', isLiked);
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.setAttribute('fill', isLiked ? '#ef4444' : 'none');
      svg.setAttribute('stroke', isLiked ? '#ef4444' : 'currentColor');
    }
  });
}

function updateLikeCount(id, count) {
  document.querySelectorAll(`.like-btn[data-id="${id}"] .like-count`).forEach(el => {
    el.textContent = count;
    el.style.animation = 'none';
    setTimeout(() => { el.style.animation = 'countUp .35s ease-out'; }, 10);
  });
}

function saveLikedIds() {
  localStorage.setItem('likedProperties', JSON.stringify([...state.likedIds]));
  updateFavBadge();
}

function loadLikedIds() {
  try {
    const saved = JSON.parse(localStorage.getItem('likedProperties') || '[]');
    state.likedIds = new Set(saved.map(String));
  } catch (_) { state.likedIds = new Set(); }
  updateFavBadge();
}

function updateFavBadge() {
  const badge = document.getElementById('favCountBadge');
  if (!badge) return;
  const count = state.likedIds.size;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ─── SHARE ───────────────────────────────────────────────────
function setupShareBtn(card) {
  card.querySelector('.share-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.shareTargetId = card.dataset.cardId;
    showShareSheet();
  });
}

// ─── CONTACT BTN ──────────────────────────────────────────────
// Construye mensaje con datos del inmueble y abre WhatsApp directo

let _cachedWaNum = null; // caché del número WhatsApp del consultor

async function getWaNum() {
  if (_cachedWaNum) return _cachedWaNum;
  try {
    const p = await fetch('/api/profile').then(r => r.json());
    _cachedWaNum = (p.whatsapp || '573122588521').replace(/\D/g, '');
    return _cachedWaNum;
  } catch {
    return '573122588521';
  }
}

function buildPropertyWhatsAppMessage(data) {
  const lines = [];
  lines.push('Hola Alex 👋');
  lines.push('');
  lines.push('Estoy interesado en esta propiedad:');
  lines.push('');
  if (data.title)    lines.push(`🏠 *${data.title}*`);
  const loc = [data.barrio, data.municipio].filter(Boolean).join(', ');
  if (loc)           lines.push(`📍 ${loc}`);
  if (data.address)  lines.push(`🏢 ${data.address}`);
  if (data.price)    lines.push(`💰 ${data.price}`);

  const specs = [];
  if (data.area)  specs.push(`📐 ${data.area} m²`);
  if (data.beds)  specs.push(`🛏️ ${data.beds} hab`);
  if (data.baths) specs.push(`🚿 ${data.baths} baños`);
  if (specs.length) lines.push(specs.join('  ·  '));

  try {
    const ams = Array.isArray(data.amenities)
      ? data.amenities
      : JSON.parse(data.amenities || '[]');
    if (ams.length) {
      lines.push('');
      lines.push('✨ *Características:*');
      ams.slice(0, 6).forEach(a => lines.push(`• ${a}`));
    }
  } catch (_) {}

  lines.push('');
  lines.push('¿Puedes brindarme más información? 🙏');
  lines.push('');
  lines.push('_Enviado desde alexariasc.com_');

  return lines.join('\n');
}

function setupContactBtn(card) {
  card.querySelector('.contact-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = card.querySelector('.contact-btn');
    const data = {
      id:        btn.dataset.contactId        || '',
      title:     btn.dataset.contactTitle     || '',
      price:     btn.dataset.contactPrice     || '',
      address:   btn.dataset.contactAddress   || '',
      municipio: btn.dataset.contactMunicipio || '',
      barrio:    btn.dataset.contactBarrio    || '',
      area:      btn.dataset.contactArea      || '',
      beds:      btn.dataset.contactBeds      || '',
      baths:     btn.dataset.contactBaths     || '',
      amenities: btn.dataset.contactAmenities || '[]'
    };

    trackLead('tarjeta_contactar', data.title, data.id, data.price);

    const waNum = await getWaNum();
    const msg   = buildPropertyWhatsAppMessage(data);
    const url   = `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  });
}

function showShareSheet() {
  document.getElementById('shareOverlay').style.display = 'flex';
}

function hideShareSheet() {
  document.getElementById('shareOverlay').style.display = 'none';
  state.shareTargetId = null;
}

function setupShareSheet() {
  const overlay = document.getElementById('shareOverlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) hideShareSheet(); });
  document.getElementById('closeShare').addEventListener('click', hideShareSheet);

  document.getElementById('shareWhatsApp').addEventListener('click', () => {
    const prop = state.properties.find(p => String(p.id) === String(state.shareTargetId));
    if (!prop) return;
    const url = `${window.location.origin}/?id=${prop.id}`;
    const tipo = prop.tipo === 'arriendo' ? '🔑 Arriendo' : prop.tipo === 'venta' ? '🏷️ Venta' : prop.tipo === 'combinado' ? '🔑🏷️ Arriendo y Venta' : '';
    const precioLines = prop.tipo === 'combinado'
      ? [`🔑 Arriendo: ${formatPrice(prop.precioArriendo || prop.precio)}/mes`, `💰 Venta: ${formatPrice(prop.precioVenta)}`]
      : [`💰 ${formatPrice(prop.precio)}`];
    const lines = [
      `🏠 *${prop.title}*`,
      `📍 ${[prop.municipio, prop.barrio].filter(Boolean).join(', ')}`,
      tipo ? tipo : '',
      ...precioLines,
      prop.area        ? `📐 ${prop.area} m²`                       : '',
      prop.habitaciones? `🛏️ ${prop.habitaciones} habitaciones`     : '',
      prop.banos       ? `🚿 ${prop.banos} baños`                   : '',
      prop.parqueadero ? `🚗 Parqueadero incluido`                   : '',
      '',
      `🔗 Ver propiedad: ${url}`
    ].filter(s => s !== null && s !== undefined);
    const text = lines.join('\n');
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    hideShareSheet();
  });

  document.getElementById('shareFacebook').addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}?id=${state.shareTargetId}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    hideShareSheet();
  });

  document.getElementById('copyLink').addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}?id=${state.shareTargetId}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('¡Enlace copiado!');
      hideShareSheet();
    }).catch(() => {
      prompt('Copia este enlace:', url);
      hideShareSheet();
    });
  });
}

// ─── STATUS TOGGLE (admin) ───────────────────────────────────
function setupAdminActions(card) {
  // Status toggle
  card.querySelector('.status-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!state.isAdmin) return;
    const btn = e.currentTarget;
    const id = btn.dataset.id;
    const current = btn.dataset.estado;
    const newEstado = current === 'libre' ? 'ocupado' : 'libre';
    try {
      await apiFetch(`/api/properties/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: newEstado })
      });
      btn.dataset.estado = newEstado;
      btn.className = `status-btn status-${newEstado}`;
      btn.innerHTML = `<span class="status-dot"></span>${newEstado === 'libre' ? 'Libre' : 'Ocupado'}`;
      showToast(`Estado cambiado a: ${newEstado}`);
    } catch (err) {
      showToast('Error al cambiar estado');
    }
  });

  // Edit button
  card.querySelector('.edit-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    const prop = state.properties.find(p => String(p.id) === String(id));
    if (prop) openUploadModal(prop);
  });

  // Delete button
  card.querySelector('.delete-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    if (!confirm('¿Eliminar este inmueble? Esta acción no se puede deshacer.')) return;
    try {
      await apiFetch(`/api/properties/${id}`, { method: 'DELETE' });
      showToast('Inmueble eliminado');
      await loadProperties();
    } catch (err) {
      showToast('Error al eliminar: ' + err.message);
    }
  });
}

// ─── FILTROS ──────────────────────────────────────────────────
function setupFilters() {
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearch');
  const municSel = document.getElementById('filterMunicipio');
  const barrioSel = document.getElementById('filterBarrio');

  // Flag: solo procesar búsqueda si el usuario realmente escribió con teclado.
  // Chrome autofill dispara 'input' pero NO dispara 'keydown' antes — así lo filtramos.
  let _searchKeyPressed = false;
  searchInput.addEventListener('keydown', () => { _searchKeyPressed = true; });
  searchInput.addEventListener('blur',    () => { _searchKeyPressed = false; });

  const doSearch = debounce(async () => {
    // Ignorar si fue autocomplete del navegador (no hubo keydown previo)
    if (!_searchKeyPressed) {
      searchInput.value = state.search || '';
      return;
    }
    state.search = searchInput.value.trim();
    clearBtn.style.display = state.search ? 'flex' : 'none';
    await loadProperties();
  }, 350);

  searchInput.addEventListener('input', doSearch);

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.search = '';
    clearBtn.style.display = 'none';
    loadProperties();
  });

  municSel.addEventListener('change', () => {
    state.municipio = municSel.value;
    state.barrio = '';
    barrioSel.value = '';
    // Actualizar barrios disponibles de inmediato en el mega-buscador
    updateMegaBarrioSelect();
    loadProperties();
  });

  barrioSel.addEventListener('change', () => {
    state.barrio = barrioSel.value;
    loadProperties();
  });

  function updateMegaBarrioSelect() {
    const selectedMunicipio = document.getElementById('filterMunicipio').value;
    const barrios = [...new Set(state.properties
      .filter(p => !selectedMunicipio || p.municipio === selectedMunicipio)
      .map(p => p.barrio).filter(Boolean))].sort();

    barrioSel.innerHTML = '<option value="">Barrio</option>';
    barrios.forEach(b => {
      const o = document.createElement('option');
      o.value = b;
      o.textContent = b;
      barrioSel.appendChild(o);
    });

    if (barrios.length === 0 && selectedMunicipio) {
      showToast(`⚠️ No hay inmuebles disponibles en ${selectedMunicipio}`);
    }
  }


  // Tipo pills
  document.querySelectorAll('.pill-btn[data-tipo]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn[data-tipo]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.tipo = btn.dataset.tipo;
      loadProperties();
    });
  });

  // Advanced filters modal
  window.closeFiltersModal = () => {
    const overlay = document.getElementById('filtersModal');
    if (!overlay || overlay.classList.contains('is-closing')) return;
    overlay.classList.add('is-closing');
    setTimeout(() => {
      overlay.classList.remove('is-closing');
      overlay.style.display = 'none';
    }, 200);
  };

  const openFiltersHandler = () => {
    document.getElementById('filtersModal').style.display = 'flex';
    renderSavedSearches();
  };
  document.getElementById('openFilters').addEventListener('click', openFiltersHandler);

  document.getElementById('closeFilters').addEventListener('click', window.closeFiltersModal);
  document.getElementById('filtersModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('filtersModal')) window.closeFiltersModal();
  });

  // Price inputs — actualizar label en tiempo real (manejado por updatePrecioLabel)

  // Hab buttons — usar event delegation para que funcione con botones dinámicos
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('hab-btn')) {
      const container = e.target.closest('.hab-options');
      container.querySelectorAll('.hab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    }
  });

  // Ver más / Ver menos en descripción
  document.addEventListener('click', (e) => {
    if (!e.target.classList.contains('desc-toggle')) return;
    const desc = e.target.closest('.property-description');
    const truncated = desc.querySelector('.desc-truncated');
    const full      = desc.querySelector('.desc-full');
    const expanded  = !full.hidden;
    truncated.hidden = !expanded;
    full.hidden      =  expanded;
    e.target.textContent = expanded ? 'Ver más' : 'Ver menos';
  });

  // Baños pills — usar event delegation
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('ban-btn')) {
      const container = e.target.closest('.hab-options');
      container.querySelectorAll('.ban-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    }
  });

  // Presets de precio — usar event delegation
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-preset')) {
      const container = e.target.closest('.filter-price-presets');
      container.querySelectorAll('.filter-preset').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      document.getElementById('fMinPrecio').value = e.target.dataset.min || '';
      document.getElementById('fMaxPrecio').value = e.target.dataset.max || '';
      updatePrecioLabel();
    }
  });

  // Actualizar label precio en tiempo real
  ['fMinPrecio','fMaxPrecio'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        document.querySelectorAll('.filter-preset').forEach(b => b.classList.remove('active'));
        updatePrecioLabel();
        validatePriceRange(); // Validar que los rangos sean coherentes
      });
    }
  });

  function updatePrecioLabel() {
    const min = Number(document.getElementById('fMinPrecio').value) || 0;
    const max = Number(document.getElementById('fMaxPrecio').value) || 0;
    const fmt = v => '$' + (v/1000000).toFixed(v%1000000===0?0:1) + 'M';
    const lbl = document.getElementById('precioRangeLabel');
    if (!lbl) return;
    if (!min && !max) lbl.textContent = 'Cualquier precio';
    else if (!min) lbl.textContent = `Hasta ${fmt(max)}`;
    else if (!max) lbl.textContent = `Desde ${fmt(min)}`;
    else lbl.textContent = `${fmt(min)} – ${fmt(max)}`;
  }

  function validatePriceRange() {
    const minInput = document.getElementById('fMinPrecio');
    const maxInput = document.getElementById('fMaxPrecio');
    if (!minInput || !maxInput) return;

    const min = Number(minInput.value) || 0;
    const max = Number(maxInput.value) || 0;

    // Si min > max, swapear valores
    if (min > max && max > 0) {
      minInput.value = max;
      maxInput.value = min;
      updatePrecioLabel();
    }
  }

  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('fMinPrecio').value = '';
    document.getElementById('fMaxPrecio').value = '';
    document.getElementById('precioRangeLabel').textContent = 'Cualquier precio';
    document.querySelectorAll('.filter-preset').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.hab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    document.querySelectorAll('.ban-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    document.querySelectorAll('.filter-state-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    document.querySelectorAll('.amenity-check input').forEach(cb => cb.checked = false);
    document.getElementById('fFilterParqueadero').checked = false;
    document.getElementById('fOrderBy').value = '';
    state.minPrecio = 0; state.maxPrecio = 0;
    state.minHab = 0; state.minBanos = 0;
    state.filterParqueadero = false; state.filterAmenidades = [];
    state.filterEstado = ''; state.orderBy = '';
    document.getElementById('filterBadge').style.display = 'none';
    loadProperties();
    window.closeFiltersModal();
  });

  // Estado filter buttons (desktop)
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-state-btn') && e.target.dataset.state !== undefined) {
      const container = e.target.closest('.filter-state-group');
      container.querySelectorAll('.filter-state-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    }
  });

  // Estado filter buttons (mobile)
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-state-btn') && e.target.dataset.stateM !== undefined) {
      const container = e.target.closest('.filter-state-group');
      container.querySelectorAll('.filter-state-btn[data-state-m]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    }
  });

  // Orden select (desktop)
  document.getElementById('fOrderBy')?.addEventListener('change', (e) => {
    state.orderBy = e.target.value;
  });

  // Orden select (mobile)
  document.getElementById('fOrderByMobile')?.addEventListener('change', (e) => {
    // Mobile select changes are captured in applyMobileSearch
  });

  document.getElementById('applyFilters').addEventListener('click', () => {
    let minPrecio = Number(document.getElementById('fMinPrecio').value) || 0;
    let maxPrecio = Number(document.getElementById('fMaxPrecio').value) || 0;

    // Validar y corregir rangos de precio
    if (minPrecio > maxPrecio && maxPrecio > 0) {
      [minPrecio, maxPrecio] = [maxPrecio, minPrecio];
    }

    // Validar contra los rangos reales
    const props = state.properties;
    if (props.length > 0) {
      const precios = props.map(p => Number(p.precio) || 0).filter(Boolean);
      const realMin = Math.min(...precios);
      const realMax = Math.max(...precios);

      if (minPrecio > 0 && minPrecio < realMin) {
        showToast(`⚠️ El precio mínimo está por debajo del menor disponible ($${formatPrice(realMin)})`);
      }
      if (maxPrecio > 0 && maxPrecio > realMax) {
        showToast(`⚠️ El precio máximo está por encima del mayor disponible ($${formatPrice(realMax)})`);
      }
    }

    state.minPrecio = minPrecio;
    state.maxPrecio = maxPrecio;
    const habActive = document.querySelector('.hab-btn.active');
    state.minHab = habActive ? Number(habActive.dataset.hab) : 0;
    const banActive = document.querySelector('.ban-btn.active');
    state.minBanos = banActive ? Number(banActive.dataset.ban) : 0;
    state.filterParqueadero = document.getElementById('fFilterParqueadero').checked;
    state.filterAmenidades = [...document.querySelectorAll('.amenity-check input:checked')].map(cb => cb.value);
    const stateActive = document.querySelector('.filter-state-btn.active');
    state.filterEstado = stateActive ? stateActive.dataset.state : '';
    state.orderBy = document.getElementById('fOrderBy')?.value || '';

    const count = [state.minPrecio||state.maxPrecio, state.minHab, state.minBanos, state.filterParqueadero, state.filterAmenidades.length, state.filterEstado, state.orderBy].filter(Boolean).length;
    const badge = document.getElementById('filterBadge');
    badge.style.display = count ? 'flex' : 'none';
    badge.textContent = count;

    loadProperties();
    window.closeFiltersModal();
  });

  // Save search button wiring
  document.getElementById('saveSearchBtn')?.addEventListener('click', () => {
    const inline = document.getElementById('savedSearchInline');
    inline?.classList.toggle('is-open');
    if (inline?.classList.contains('is-open')) {
      document.getElementById('savedSearchNameInput')?.focus();
    }
  });
  document.getElementById('savedSearchConfirm')?.addEventListener('click', () => {
    const name = document.getElementById('savedSearchNameInput')?.value || '';
    saveCurrentSearch(name);
    document.getElementById('savedSearchNameInput').value = '';
    document.getElementById('savedSearchInline')?.classList.remove('is-open');
  });
  document.getElementById('savedSearchNameInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('savedSearchConfirm')?.click();
    if (e.key === 'Escape') document.getElementById('savedSearchInline')?.classList.remove('is-open');
  });

  // ── GUARDAR BÚSQUEDA — MOBILE ─────────────────────────────────
  document.getElementById('saveSearchBtnMobile')?.addEventListener('click', () => {
    const inline = document.getElementById('savedSearchInlineMobile');
    inline?.classList.toggle('is-open');
    if (inline?.classList.contains('is-open')) {
      document.getElementById('savedSearchNameInputMobile')?.focus();
    }
  });
  document.getElementById('savedSearchConfirmMobile')?.addEventListener('click', () => {
    const name = document.getElementById('savedSearchNameInputMobile')?.value || '';
    saveCurrentSearch(name);
    document.getElementById('savedSearchNameInputMobile').value = '';
    document.getElementById('savedSearchInlineMobile')?.classList.remove('is-open');
    renderSavedSearches();
  });
  document.getElementById('savedSearchNameInputMobile')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('savedSearchConfirmMobile')?.click();
    if (e.key === 'Escape') document.getElementById('savedSearchInlineMobile')?.classList.remove('is-open');
  });

  // ── PANEL MÓVIL MEGAFILTRO ────────────────────────────────────
  const mobileOverlay = document.getElementById('mobileSearchOverlay');
  const openMobileBtn = document.getElementById('openMobileSearch');
  const closeMobileBtn = document.getElementById('closeMobileSearch');
  const municipioMobile = document.getElementById('filterMunicipioMobile');
  const barrioMobile = document.getElementById('filterBarrioMobile');
  const searchMobile = document.getElementById('searchInputMobile');
  const hintEl = document.getElementById('mobileSearchHint');

  function syncMobileSelects() {
    const mData = window._filtersData;
    if (!mData) return;
    // Municipios
    municipioMobile.innerHTML = '<option value="">Todos los municipios</option>';
    mData.municipios.forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = m;
      if (m === state.municipio) o.selected = true;
      municipioMobile.appendChild(o);
    });
    // Barrios
    barrioMobile.innerHTML = '<option value="">Todos los barrios</option>';
    mData.barrios.forEach(b => {
      const o = document.createElement('option');
      o.value = b; o.textContent = b;
      if (b === state.barrio) o.selected = true;
      barrioMobile.appendChild(o);
    });
    // Tipo
    document.querySelectorAll('.mobile-tipo-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tipoM === state.tipo);
    });
    // Precio
    document.getElementById('fMinPrecioMobile').value = state.minPrecio || '';
    document.getElementById('fMaxPrecioMobile').value = state.maxPrecio || '';
    document.querySelectorAll('.filter-preset[data-min-m]').forEach(b => {
      const min = Number(b.dataset.minM) || 0;
      const max = Number(b.dataset.maxM) || 0;
      b.classList.toggle('active', (min || max) && state.minPrecio === min && state.maxPrecio === max);
    });
    // Habitaciones
    document.querySelectorAll('.hab-btn-m').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.habM) === state.minHab);
    });
    // Baños
    document.querySelectorAll('.ban-btn-m').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.banM) === state.minBanos);
    });
    // Amenidades
    document.querySelectorAll('#mobileAmenitiesContainer .amenity-check input').forEach(cb => {
      cb.checked = state.filterAmenidades.includes(cb.value);
    });
    // Parqueadero
    const pqm = document.getElementById('fParqueaderoMobile');
    if (pqm) pqm.checked = state.filterParqueadero;
    // Estado (mobile)
    document.querySelectorAll('.filter-state-btn[data-state-m]').forEach(b => {
      b.classList.toggle('active', b.dataset.stateM === state.filterEstado);
    });
    // Ordenamiento (mobile)
    const fOrderByMobile = document.getElementById('fOrderByMobile');
    if (fOrderByMobile) fOrderByMobile.value = state.orderBy || '';
    searchMobile.value = state.search;
    // Búsquedas guardadas
    renderSavedSearches();
  }

  function updateMobileHint() {
    const tipo = state.tipo === 'todos' ? 'Todo' : state.tipo.charAt(0).toUpperCase() + state.tipo.slice(1);
    const loc = state.municipio || 'Todos los municipios';
    if (hintEl) hintEl.textContent = `${tipo} · ${loc}`;
  }

  setupMobileBarrioFilter();

  if (openMobileBtn) {
    openMobileBtn.addEventListener('click', () => {
      syncMobileSelects();
      mobileOverlay.classList.remove('is-closing');
      mobileOverlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      setTimeout(() => document.getElementById('searchInputMobile')?.focus(), 100);
    });
  }

  function closeMobilePanel() {
    if (mobileOverlay.classList.contains('is-closing')) return;
    mobileOverlay.classList.add('is-closing');
    setTimeout(() => {
      mobileOverlay.classList.remove('is-closing');
      mobileOverlay.style.display = 'none';
      document.body.style.overflow = '';
    }, 320); // coincide con duración de panelCollapse (.3s) + pequeño margen
  }

  if (closeMobileBtn) closeMobileBtn.addEventListener('click', closeMobilePanel);

  mobileOverlay.addEventListener('click', (e) => {
    if (e.target === mobileOverlay) closeMobilePanel();
  });

  // Tipo mobile
  document.querySelectorAll('.mobile-tipo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mobile-tipo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Hab/Ban pills mobile
  document.querySelectorAll('.hab-btn-m').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hab-btn-m').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelectorAll('.ban-btn-m').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ban-btn-m').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Presets precio móvil
  document.querySelectorAll('.filter-preset[data-min-m]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-preset[data-min-m]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('fMinPrecioMobile').value = btn.dataset.minM || '';
      document.getElementById('fMaxPrecioMobile').value = btn.dataset.maxM || '';
    });
  });

  // Aplicar filtros móvil
  document.getElementById('applyMobileSearch').addEventListener('click', () => {
    const activeTipoBtn = document.querySelector('.mobile-tipo-btn.active');
    if (activeTipoBtn) {
      state.tipo = activeTipoBtn.dataset.tipoM;
      document.querySelectorAll('.pill-btn[data-tipo]').forEach(b => {
        b.classList.toggle('active', b.dataset.tipo === state.tipo);
      });
    }
    state.municipio = municipioMobile.value;
    state.barrio = barrioMobile.value;
    state.search = searchMobile.value.trim();
    state.minPrecio = Number(document.getElementById('fMinPrecioMobile')?.value) || 0;
    state.maxPrecio = Number(document.getElementById('fMaxPrecioMobile')?.value) || 0;
    const habM = document.querySelector('.hab-btn-m.active');
    state.minHab = habM ? Number(habM.dataset.habM) : 0;
    const banM = document.querySelector('.ban-btn-m.active');
    state.minBanos = banM ? Number(banM.dataset.banM) : 0;
    state.filterParqueadero = document.getElementById('fParqueaderoMobile')?.checked || false;
    // Capturar Amenidades (mobile)
    state.filterAmenidades = [...document.querySelectorAll('#mobileAmenitiesContainer .amenity-check input:checked')].map(cb => cb.value);
    // Capturar Estado (mobile)
    const stateActiveMobile = document.querySelector('.filter-state-btn.active[data-state-m]');
    state.filterEstado = stateActiveMobile ? stateActiveMobile.dataset.stateM : '';
    // Capturar Ordenamiento (mobile)
    state.orderBy = document.getElementById('fOrderByMobile')?.value || '';

    document.getElementById('filterMunicipio').value = state.municipio;
    document.getElementById('filterBarrio').value = state.barrio;
    document.getElementById('searchInput').value = state.search;

    const count = [state.minPrecio||state.maxPrecio, state.minHab, state.minBanos, state.filterParqueadero, state.filterEstado, state.orderBy].filter(Boolean).length;
    const badge = document.getElementById('filterBadge');
    badge.style.display = count ? 'flex' : 'none';
    badge.textContent = count;

    updateMobileHint();
    closeMobilePanel();
    loadProperties();
  });

  // Limpiar todo móvil — resetea UI Y estado global
  document.getElementById('clearMobileSearch').addEventListener('click', () => {
    document.querySelectorAll('.mobile-tipo-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    municipioMobile.value = '';
    barrioMobile.value = '';
    searchMobile.value = '';
    document.getElementById('fMinPrecioMobile').value = '';
    document.getElementById('fMaxPrecioMobile').value = '';
    document.querySelectorAll('.filter-preset[data-min-m]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.hab-btn-m').forEach((b, i) => b.classList.toggle('active', i === 0));
    document.querySelectorAll('.ban-btn-m').forEach((b, i) => b.classList.toggle('active', i === 0));
    const pqm = document.getElementById('fParqueaderoMobile');
    if (pqm) pqm.checked = false;
    // Resetear Amenidades (mobile)
    document.querySelectorAll('#mobileAmenitiesContainer .amenity-check input').forEach(cb => cb.checked = false);
    // Resetear Estado (mobile)
    document.querySelectorAll('.filter-state-btn[data-state-m]').forEach((b, i) => b.classList.toggle('active', i === 0));
    // Resetear Ordenamiento (mobile)
    document.getElementById('fOrderByMobile').value = '';
    // Resetear estado global
    state.tipo = 'todos'; state.municipio = ''; state.barrio = '';
    state.search = ''; state.minPrecio = 0; state.maxPrecio = 0;
    state.minHab = 0; state.minBanos = 0;
    state.filterParqueadero = false; state.filterAmenidades = [];
    state.filterEstado = ''; state.orderBy = '';
    document.getElementById('filterBadge').style.display = 'none';
    // Sincronizar desktop
    document.querySelectorAll('.pill-btn[data-tipo]').forEach((b, i) => b.classList.toggle('active', i === 0));
    document.getElementById('filterMunicipio').value = '';
    document.getElementById('filterBarrio').value = '';
    document.getElementById('searchInput').value = '';
    // BUG FIX #9: recargar propiedades y cerrar panel después de limpiar
    loadProperties();
    closeMobilePanel();
  });

  // ── MODAL PERFIL ──────────────────────────────────────────────
  const profileOverlay = document.getElementById('profileOverlay');
  let profileData = {};
  let profileAvatarFile = null;

  async function loadProfile() {
    try {
      const res = await fetch('/api/profile');
      profileData = await res.json();
      renderProfile(profileData);
    } catch (_) {}
  }

  function renderProfile(p) {
    // Avatar
    const img = document.getElementById('profileAvatarImg');
    const initials = document.getElementById('profileInitials');
    if (p.avatar) {
      img.src = '/' + p.avatar;
      img.style.display = 'block';
      initials.style.display = 'none';
    } else {
      img.style.display = 'none';
      initials.style.display = 'flex';
      const parts = (p.name || 'AA').split(' ');
      initials.textContent = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
    }
    // Info
    document.getElementById('profileName').textContent = p.name || '';
    document.getElementById('profileRole').textContent = p.role || '';
    document.getElementById('profileZoneText').textContent = p.zone || '';
    document.getElementById('profileBio').textContent = p.bio || '';
    // Stats
    document.getElementById('statExp').textContent = p.experience_years || '—';
    const langCode = (p.languages || 'ES').split(',')[0].trim().slice(0,2).toUpperCase();
    document.getElementById('statLang').textContent = langCode;
    // Props count
    fetch('/api/properties').then(r => r.json()).then(props => {
      document.getElementById('statProps').textContent = props.length || '—';
    }).catch(() => {});
    // Licencia
    if (p.license) {
      document.getElementById('profileLicenseText').textContent = p.license;
      document.getElementById('profileLicenseWrap').style.display = 'flex';
    } else {
      document.getElementById('profileLicenseWrap').style.display = 'none';
    }
    // Contactos
    const phone = p.phone || '—';
    const phoneLink = p.phone_link || p.phone?.replace(/\D/g,'') || '';
    document.getElementById('profilePhoneText').textContent = phone;
    document.getElementById('profilePhoneLink').href = `tel:+${phoneLink}`;
    document.getElementById('profileEmailText').textContent = p.email || '—';
    document.getElementById('profileEmailLink').href = `mailto:${p.email || ''}`;
    // WhatsApp
    const waNum = p.whatsapp || '';
    const waMsg = encodeURIComponent(p.whatsapp_msg || '');
    const waLinkEl  = document.getElementById('profileWaLink');
    const waBtnEl   = document.getElementById('profileWaBtn');
    waLinkEl.href = `https://wa.me/${waNum}?text=${waMsg}`;
    waBtnEl.href  = `https://wa.me/${waNum}?text=${waMsg}`;
    // Facebook Pixel: Lead al hacer clic en WhatsApp del perfil
    [waLinkEl, waBtnEl].forEach(el => {
      el.onclick = () => trackLead('perfil_whatsapp', 'Consulta por perfil');
    });
    document.getElementById('profileCallBtn').href = `tel:+${phoneLink}`;
    // Instagram
    const ig = p.instagram || '';
    if (ig) {
      const igUrl = ig.startsWith('http') ? ig : `https://instagram.com/${ig.replace('@','')}`;
      document.getElementById('profileIgLink').href = igUrl;
      document.getElementById('profileIgText').textContent = ig.startsWith('@') ? ig : `@${ig}`;
      document.getElementById('profileIgLink').style.display = 'flex';
    } else {
      document.getElementById('profileIgLink').style.display = 'none';
    }
  }

  function openEditMode() {
    const p = profileData;
    document.getElementById('pefName').value      = p.name || '';
    document.getElementById('pefRole').value      = p.role || '';
    document.getElementById('pefZone').value      = p.zone || '';
    document.getElementById('pefBio').value       = p.bio || '';
    document.getElementById('pefPhone').value     = p.phone || '';
    document.getElementById('pefPhoneLink').value = p.phone_link || '';
    document.getElementById('pefEmail').value     = p.email || '';
    document.getElementById('pefWhatsapp').value  = p.whatsapp || '';
    document.getElementById('pefWaMsg').value     = p.whatsapp_msg || '';
    document.getElementById('pefInstagram').value = p.instagram || '';
    document.getElementById('pefLicense').value   = p.license || '';
    document.getElementById('pefLanguages').value = p.languages || '';
    document.getElementById('pefExp').value       = p.experience_years || '';
    document.getElementById('pefError').style.display = 'none';
    // Avatar preview en edición
    const editImg = document.getElementById('profileEditAvatarImg');
    const editInitials = document.getElementById('profileEditInitials');
    if (p.avatar) {
      editImg.src = '/' + p.avatar;
      editImg.style.display = 'block';
      editInitials.style.display = 'none';
    } else {
      editImg.style.display = 'none';
      editInitials.style.display = 'flex';
      const parts = (p.name || 'AA').split(' ');
      editInitials.textContent = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
    }
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('profileEdit').style.display = 'block';
  }

  function closeEditMode() {
    document.getElementById('profileView').style.display = 'block';
    document.getElementById('profileEdit').style.display = 'none';
    profileAvatarFile = null;
  }

  document.getElementById('openProfile').addEventListener('click', () => {
    // Asegurar que abre en modo vista, no edición
    document.getElementById('profileView').style.display = 'block';
    document.getElementById('profileEdit').style.display = 'none';
    profileOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    loadProfile();
  });

  function closeProfile() {
    profileOverlay.classList.add('is-closing');
    setTimeout(() => {
      profileOverlay.classList.remove('is-closing');
      profileOverlay.style.display = 'none';
      document.body.style.overflow = '';
      closeEditMode();
    }, 260);
  }

  document.getElementById('closeProfile').addEventListener('click', closeProfile);
  profileOverlay.addEventListener('click', (e) => {
    if (e.target === profileOverlay) closeProfile();
  });

  document.getElementById('profileEditBtn').addEventListener('click', () => {
    if (state.isAdmin) openEditMode();
    else window.location.href = '/auth/google';
  });
  document.getElementById('pefCancel').addEventListener('click', closeEditMode);
  document.getElementById('profileLogoutBtn')?.addEventListener('click', globalLogout);

  // Avatar upload en edición
  document.getElementById('profileAvatarUploadBtn').addEventListener('click', () => {
    document.getElementById('profileAvatarInput').click();
  });
  document.getElementById('profileAvatarInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    profileAvatarFile = file;
    const url = URL.createObjectURL(file);
    const editImg = document.getElementById('profileEditAvatarImg');
    editImg.src = url;
    editImg.style.display = 'block';
    document.getElementById('profileEditInitials').style.display = 'none';
  });

  // Guardar perfil (usa sesión Google — no requiere contraseña)
  document.getElementById('pefSave').addEventListener('click', async () => {
    const errEl = document.getElementById('pefError');
    errEl.style.display = 'none';

    const fd = new FormData();
    fd.append('name',             document.getElementById('pefName').value);
    fd.append('role',             document.getElementById('pefRole').value);
    fd.append('zone',             document.getElementById('pefZone').value);
    fd.append('bio',              document.getElementById('pefBio').value);
    fd.append('phone',            document.getElementById('pefPhone').value);
    fd.append('phone_link',       document.getElementById('pefPhoneLink').value);
    fd.append('email',            document.getElementById('pefEmail').value);
    fd.append('whatsapp',         document.getElementById('pefWhatsapp').value);
    fd.append('whatsapp_msg',     document.getElementById('pefWaMsg').value);
    fd.append('instagram',        document.getElementById('pefInstagram').value);
    fd.append('license',          document.getElementById('pefLicense').value);
    fd.append('languages',        document.getElementById('pefLanguages').value);
    fd.append('experience_years', document.getElementById('pefExp').value);
    if (profileAvatarFile) fd.append('avatar', profileAvatarFile);

    const saveBtn = document.getElementById('pefSave');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'same-origin',
        body: fd
      });
      if (!res.ok) {
        errEl.textContent = 'Error al guardar. Verifica tu sesión.';
        errEl.style.display = 'block';
        return;
      }
      profileData = await res.json();
      renderProfile(profileData);
      closeEditMode();
    } catch (err) {
      errEl.textContent = 'Error al guardar';
      errEl.style.display = 'block';
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Guardar';
    }
  });
}

// ─── MAP ──────────────────────────────────────────────────────
// ── Formatea precio corto para marcadores ─────────────────────
function formatPriceShort(price) {
  if (!price) return '?';
  const n = Number(price);
  if (n >= 1_000_000_000) return '$' + (n / 1_000_000_000).toFixed(1).replace('.0','') + 'B';
  if (n >= 1_000_000)     return '$' + (n / 1_000_000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1_000)         return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + n;
}

// ── HTML de tarjeta para el sidebar del mapa ──────────────────
function mapCardHTML(prop) {
  const firstImg = prop.images?.[0]?.filename;
  const imgSrc   = firstImg ? `/${encodeImgPath(firstImg)}` : '';
  const isCombinadoMap = prop.tipo === 'combinado';
  const price    = isCombinadoMap ? formatPrice(prop.precioArriendo || prop.precio) : formatPrice(prop.precio);
  const tipoLbl  = isCombinadoMap ? 'Arr · Venta' : (prop.tipo === 'venta' ? 'Venta' : 'Arriendo');
  const tipoClass= isCombinadoMap ? 'combinado'   : (prop.tipo === 'venta' ? 'venta' : 'arriendo');
  const statCls  = prop.estado === 'ocupado' ? 'ocupado' : 'libre';
  const statLbl  = prop.estado === 'ocupado' ? 'Ocupado' : 'Libre';

  const hab = prop.habitaciones ? `<span class="map-card-stat"><svg viewBox="0 0 24 24" fill="none"><path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>${prop.habitaciones} hab</span>` : '';
  const ban = prop.banos        ? `<span class="map-card-stat"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12h16v4a4 4 0 01-4 4H8a4 4 0 01-4-4v-4zm0 0V6a2 2 0 012-2h2a2 2 0 012 2v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${prop.banos} baños</span>` : '';
  const m2  = prop.area         ? `<span class="map-card-stat"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/></svg>${prop.area} m²</span>` : '';

  const waText = encodeURIComponent(`Hola Alex, me interesa: ${prop.title} - ${price}`);

  return `
  <div class="map-card" data-map-card-id="${prop.id}">
    <div class="map-card-img">
      ${imgSrc ? `<img src="${imgSrc}" alt="${prop.title}" loading="lazy"/>` : '<div style="width:100%;height:100%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#ccc"><svg viewBox="0 0 24 24" fill="none" width="32" height="32"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" stroke-width="1.5"/></svg></div>'}
      <div class="map-card-img-overlay">
        <div class="map-card-top">
          <span class="map-card-status ${statCls}"><span class="map-card-status-dot"></span>${statLbl}</span>
          <span class="map-card-tipo ${tipoClass}">${tipoLbl}</span>
        </div>
        <div class="map-card-bottom">
          <div class="map-card-location">
            <span class="map-card-muni">${prop.municipio || ''}</span>
            <span class="map-card-barrio">${prop.barrio || prop.title}</span>
          </div>
          <span class="map-card-price">${price}</span>
        </div>
      </div>
    </div>
    <div class="map-card-body">
      <p class="map-card-title">${prop.title}</p>
      ${(hab || ban || m2) ? `<div class="map-card-stats">${hab}${ban}${m2}</div>` : ''}
    </div>
    <div class="map-card-detail">
      <div class="map-card-actions">
        <button class="map-card-btn-share" data-id="${prop.id}">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Compartir
        </button>
        <a class="map-card-btn-wa" href="https://api.whatsapp.com/send?phone=573122588521&text=${waText}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Contactar
        </a>
      </div>
    </div>
  </div>`;
}

// ── Renderiza sidebar según propiedades visibles en el mapa ───
function renderMapSidebar(props) {
  const list  = document.getElementById('mapCardsList');
  const count = document.getElementById('mapSidebarCount');
  if (!list) return;

  if (count) count.textContent = `${props.length} inmueble${props.length !== 1 ? 's' : ''} en esta zona`;
  // Actualizar también el FAB
  const fab = document.getElementById('mapListFab');
  const fabCount = document.getElementById('mapListFabCount');
  if (fabCount) fabCount.textContent = `${props.length} ${props.length !== 1 ? 'propiedades' : 'propiedad'}`;
  if (fab && window.innerWidth <= 768) fab.style.display = 'flex';

  if (!props.length) {
    list.innerHTML = '<p style="padding:24px 12px;color:#aaa;font-size:13px;text-align:center;grid-column:1/-1">Sin inmuebles en esta área</p>';
    return;
  }

  // Usar exactamente las mismas tarjetas que el grid principal
  list.innerHTML = props.map(p => cardHTML(p)).join('');

  // Inicializar exactamente igual que renderGrid
  list.querySelectorAll('.property-card').forEach(card => {
    setupExpand(card);
    setupSlider(card);
    setupLikeBtn(card);
    setupShareBtn(card);
    setupContactBtn(card);
    if (state.isAdmin) setupAdminActions(card);

    // Además: al hacer clic activa el marcador en el mapa
    const id = card.dataset.cardId;
    card.addEventListener('click', () => {
      list.querySelectorAll('.property-card').forEach(c => c.classList.remove('is-map-active'));
      card.classList.add('is-map-active');
      activateMapMarker(id);
    });

    // Hover card → resalta pin del mapa
    card.addEventListener('mouseenter', () => {
      state.mapMarkers.forEach(({ marker, prop: p }) => {
        const pill = marker.getElement()?.querySelector('.map-price-marker');
        if (!pill) return;
        pill.classList.toggle('hovered', String(p.id) === String(id));
      });
    });
    card.addEventListener('mouseleave', () => {
      state.mapMarkers.forEach(({ marker }) => {
        marker.getElement()?.querySelector('.map-price-marker')?.classList.remove('hovered');
      });
    });
  });
}

// ── Activa/desactiva marcadores ───────────────────────────────
function activateMapMarker(id) {
  state.mapMarkers.forEach(({ marker, prop }) => {
    const el = marker.getElement();
    if (!el) return;
    const pill = el.querySelector('.map-price-marker');
    if (!pill) return;
    if (String(prop.id) === String(id)) {
      pill.classList.add('active');
      // Flag para que moveend no re-renderice el sidebar
      state.mapPanningToMarker = true;
      state.leafletMap.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });
    } else {
      pill.classList.remove('active');
    }
  });
}

function deactivateAllMarkers() {
  state.mapMarkers.forEach(({ marker }) => {
    marker.getElement()?.querySelector('.map-price-marker')?.classList.remove('active');
  });
}

function getVisibleProperties() {
  if (!state.leafletMap) return state.properties;
  const bounds = state.leafletMap.getBounds();
  const withCoords = state.properties.filter(p => p.lat && p.lng);
  if (!withCoords.length) return state.properties;
  const visible = withCoords.filter(p => bounds.contains([p.lat, p.lng]));
  return visible.length ? visible : state.properties.filter(p => p.lat && p.lng);
}

function initMap() {
  if (state.leafletMap) return;

  const mapEl = document.getElementById('leafletMap');
  const map = L.map(mapEl, {
    zoomControl: false,
    attributionControl: true
  }).setView([6.15, -75.62], 13);

  state.leafletMap = map;

  // Tile layers
  const streetLightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
    name: 'street-light'
  });

  const streetDarkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
    name: 'street-dark'
  });

  const satTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
    name: 'satellite'
  });

  // Store in state for toggling
  state.mapTileLayers = { 'street-light': streetLightLayer, 'street-dark': streetDarkLayer, satellite: satTileLayer };
  const mapType = localStorage.getItem('mapType') || 'street-light';
  const isDarkMode = localStorage.getItem('mapDarkMode') === 'true';
  state.currentMapType = isDarkMode && mapType.startsWith('street') ? 'street-dark' : mapType;
  state.mapDarkMode = isDarkMode;

  state.mapTileLayers[state.currentMapType].addTo(map);


  // Al mover → colapsar sheet a hidden (usuario navega el mapa)
  map.on('movestart', () => {
    if (!state.mapPanningToMarker) {
      closeMapOverlay();
      if (window.innerWidth <= 768) {
        document.querySelectorAll('.property-card.is-open').forEach(c => closeCard(c));
        window._snapMapSheet?.('hidden');
      }
    }
  });
  map.on('moveend zoomend', () => {
    if (state.mapPanningToMarker) {
      state.mapPanningToMarker = false;
      return;
    }
    // Actualizar tarjetas en segundo plano pero NO subir el sidebar
    // El usuario lo abre manualmente tocando el handle cuando quiera
    renderMapSidebar(getVisibleProperties());
  });

  updateMapMarkers();
}

// ─── CUSTOM OVERLAY POPUP ────────────────────────────────────
let _overlayEl = null;
let _currentOverlayPropIdx = -1;  // índice del property actual en el overlay

function closeMapOverlay() {
  if (_overlayEl) { _overlayEl.remove(); _overlayEl = null; }
  _currentOverlayPropIdx = -1;
}

// Helper: genera el HTML del contenido del overlay para una propiedad
function _getOverlayCardHTML(prop) {
  const firstImg   = prop.images?.[0]?.filename;
  const imgSrc     = firstImg ? `/${encodeImgPath(firstImg)}` : '';
  const waPhone    = (window._profileData?.whatsapp || '573122588521').replace(/\D/g, '');
  const waText     = encodeURIComponent(`Hola, me interesa: ${prop.title} - ${formatPrice(prop.precio)}`);
  const tipoLbl    = prop.tipo === 'venta' ? 'VENTA' : 'ARRIENDO';
  const tipoClass  = prop.tipo === 'venta' ? 'venta' : 'arriendo';
  const isOccupied = prop.estado === 'ocupado';
  const statusLbl  = isOccupied ? 'OCUPADO' : 'LIBRE';
  const loc        = [prop.municipio, prop.barrio].filter(Boolean).join(' · ');
  const stats      = [
    prop.habitaciones ? `${prop.habitaciones} hab` : '',
    prop.banos        ? `${prop.banos} baños`      : '',
    prop.area         ? `${prop.area} m²`          : '',
  ].filter(Boolean);

  return `
    <div class="map-overlay-card">
      <!-- Imagen principal -->
      <div class="map-overlay-media">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${prop.title}" loading="lazy">`
          : `<div class="map-overlay-no-img"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`}

        <!-- Botón cerrar -->
        <button class="map-overlay-close" id="overlayCloseBtn" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <!-- Badge LIBRE / OCUPADO -->
        <div class="map-overlay-status ${isOccupied ? 'occupied' : 'libre'}">
          <span class="map-overlay-status-dot"></span>${statusLbl}
        </div>

        <!-- Contador (visible en móvil) -->
        <div class="map-overlay-counter" id="overlayCounter"></div>

        <!-- Footer de imagen: location + nombre + precio -->
        <div class="map-overlay-media-footer">
          ${loc ? `<span class="map-overlay-loc">${loc}</span>` : ''}
          <div class="map-overlay-name-price">
            <span class="map-overlay-name">${prop.title}</span>
            <span class="map-overlay-price">${formatPrice(prop.precio)}</span>
          </div>
        </div>
      </div>

      <!-- Cuerpo -->
      <div class="map-overlay-body">
        <!-- Stats + tipo en una fila -->
        <div class="map-overlay-footer-row">
          <div class="map-overlay-stats">
            ${stats.map(s => `<span class="map-overlay-stat">${s}</span>`).join('')}
          </div>
          <span class="map-overlay-tipo-badge ${tipoClass}">${tipoLbl}</span>
        </div>

        <!-- Ver detalles -->
        <button class="map-overlay-detail-btn" data-prop-id="${prop.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Ver detalles
        </button>
      </div>
    </div>`;
}

// Variables para swipe detection
let _swipeStartX = 0;
let _swipeStartY = 0;

function showMapOverlay(prop, markerEl) {
  // Fix #3: cerrar cualquier tarjeta expandida antes de mostrar overlay
  document.querySelectorAll('.property-card.is-open').forEach(c => closeCard(c));
  closeMapOverlay();

  // Encontrar el índice de esta propiedad en la lista filtrada
  const propIdx = state.filtered.findIndex(p => p.id === prop.id);
  if (propIdx < 0) return; // no encontrada, algo raro
  _currentOverlayPropIdx = propIdx;

  const div = document.createElement('div');
  div.className = 'map-overlay-popup';
  div.innerHTML = _getOverlayCardHTML(prop);

  // Actualizar contador
  const totalProps = state.filtered.length;
  div.querySelector('#overlayCounter').textContent = `${propIdx + 1} de ${totalProps}`;

  // Posicionar sobre el marcador
  const mapPane = document.getElementById('mapPane');
  if (!mapPane) return;
  mapPane.style.position = 'relative';
  mapPane.appendChild(div);

  // Calcular posición relativa al marcador dentro del pane
  const paneRect   = mapPane.getBoundingClientRect();
  const markerRect = markerEl ? markerEl.getBoundingClientRect() : paneRect;
  const cardW = 272;
  let left = markerRect.left - paneRect.left + markerRect.width / 2 - cardW / 2;
  let top  = markerRect.top  - paneRect.top  - 400; // encima del marcador
  // Evitar salirse por los bordes
  left = Math.max(8, Math.min(left, paneRect.width - cardW - 8));
  if (top < 8) top = markerRect.top - paneRect.top + 40; // si no hay espacio arriba, va abajo
  div.style.left = left + 'px';
  div.style.top  = top  + 'px';

  _overlayEl = div;

  // Close button
  div.querySelector('#overlayCloseBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    closeMapOverlay();
    deactivateAllMarkers();
  });

  // Fix #2: "Ver detalles" → abre la tarjeta completa del sidebar
  div.querySelector('.map-overlay-detail-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMapOverlay();
    deactivateAllMarkers();
    // Buscar la tarjeta en el sidebar del mapa
    const list = document.getElementById('mapCardsList');
    let card = list?.querySelector(`[data-card-id="${prop.id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => openCard(card), 200);
    }
  });

  // Swipe detection para navegación entre propiedades
  div.addEventListener('touchstart', (e) => {
    _swipeStartX = e.touches[0].clientX;
    _swipeStartY = e.touches[0].clientY;
  }, false);

  div.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - _swipeStartX;
    const diffY = endY - _swipeStartY;

    // Solo detectar swipe horizontal (ignorar swipes verticales)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swipe derecha → anterior
        if (propIdx > 0) showMapOverlay(state.filtered[propIdx - 1], null);
      } else {
        // Swipe izquierda → siguiente
        if (propIdx < totalProps - 1) showMapOverlay(state.filtered[propIdx + 1], null);
      }
    }
  }, false);
}

// ─── PIN TOOLTIP LIGERO ───────────────────────────────────────
let _pinTooltipEl = null;

function _showPinTooltip(markerEl, title) {
  _hidePinTooltip();
  const tt = document.createElement('div');
  tt.className = 'pin-tooltip';
  tt.textContent = title;
  document.body.appendChild(tt);
  _pinTooltipEl = tt;

  const rect = markerEl.getBoundingClientRect();
  tt.style.left = (rect.left + rect.width / 2) + 'px';
  tt.style.top  = (rect.top - 10) + 'px';
}

function _hidePinTooltip() {
  if (_pinTooltipEl) { _pinTooltipEl.remove(); _pinTooltipEl = null; }
}

function updateMapMarkers() {
  if (!state.leafletMap) return;

  // Limpiar marcadores previos
  if (state.markerClusterGroup) {
    state.leafletMap.removeLayer(state.markerClusterGroup);
  }
  state.mapMarkers.forEach(({ marker }) => marker.remove());
  state.mapMarkers = [];
  closeMapOverlay();

  // Crear nuevo cluster group
  state.markerClusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    showCoverageOnHover: false,   // no mostrar el polígono azul al hover
    iconCreateFunction: (cluster) => {
      const count = cluster.getChildCount();
      let sizeClass = 'cluster-small';
      if (count > 100) sizeClass = 'cluster-large';
      else if (count > 20) sizeClass = 'cluster-medium';

      return L.divIcon({
        html: `<div class="cluster-marker ${sizeClass}" title="${count} propiedades en esta zona"><span>${count}</span></div>`,
        className: 'cluster-icon',
        iconSize: [40, 40]
      });
    }
  });

  // Cerrar overlay al hacer click en el mapa — usar referencia para poder remover
  state.leafletMap.off('click', closeMapOverlay);
  state.leafletMap.on('click', closeMapOverlay);

  state.properties.forEach(prop => {
    if (!prop.lat || !prop.lng) return;

    const isOccupied = prop.estado === 'ocupado';
    const priceLabel = formatPriceShort(prop.precio);

    const icon = L.divIcon({
      html: `<div class="map-price-marker${isOccupied ? ' occupied' : ''}">${priceLabel}</div>`,
      className: 'map-marker-wrap',
      iconSize:   [80, 32],
      iconAnchor: [40, 16]
    });

    const marker = L.marker([prop.lat, prop.lng], { icon, draggable: state.isAdmin });
    state.markerClusterGroup.addLayer(marker);

    // Click en marcador → overlay custom + activa tarjeta en sidebar
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      const markerEl = marker.getElement();
      deactivateAllMarkers();
      markerEl?.querySelector('.map-price-marker')?.classList.add('active');

      const isMobile = window.innerWidth <= 768;

      if (isMobile) {
        // En móvil: subir sheet a peek y centrar tarjeta en carousel
        closeMapOverlay();
        window._snapMapSheet?.('peek');
        const list = document.getElementById('mapCardsList');
        if (list) {
          list.querySelectorAll('.property-card').forEach(c => c.classList.remove('is-map-active'));
          const card = list.querySelector(`[data-card-id="${prop.id}"]`);
          if (card) {
            card.classList.add('is-map-active');
            // Centrar en el carousel horizontal con scroll smooth
            setTimeout(() => {
              const listRect = list.getBoundingClientRect();
              const cardRect = card.getBoundingClientRect();
              const scrollLeft = list.scrollLeft + cardRect.left - listRect.left
                                - (listRect.width - cardRect.width) / 2;
              list.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }, 320); // esperar a que el peek animation termine
          }
        }
      } else {
        // En desktop: overlay popup como antes
        showMapOverlay(prop, markerEl);
        const list = document.getElementById('mapCardsList');
        if (list) {
          list.querySelectorAll('.property-card').forEach(c => c.classList.remove('is-map-active'));
          const card = list.querySelector(`[data-card-id="${prop.id}"]`);
          if (card) {
            card.classList.add('is-map-active');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }
    });

    // Hover pin → solo en desktop (touch no tiene hover real)
    if (!('ontouchstart' in window)) {
      marker.on('mouseover', () => {
        // Solo mostrar tooltip si el marker es visible (no está dentro de un cluster)
        const markerEl = marker.getElement();
        if (!markerEl) return;

        const list = document.getElementById('mapCardsList');
        if (list) {
          list.querySelectorAll('.property-card').forEach(c => {
            c.classList.toggle('is-map-hovered', String(c.dataset.cardId) === String(prop.id));
          });
          const card = list.querySelector(`[data-card-id="${prop.id}"]`);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        _showPinTooltip(markerEl, prop.title);
      });
      marker.on('mouseout', () => {
        document.getElementById('mapCardsList')
          ?.querySelectorAll('.property-card')
          .forEach(c => c.classList.remove('is-map-hovered'));
        _hidePinTooltip();
      });
    }

    if (state.isAdmin) {
      marker.on('dragend', async (e) => {
        const latlng = e.target.getLatLng();
        try {
          await apiFetch(`/api/properties/${prop.id}/coordinates`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: latlng.lat, lng: latlng.lng })
          });
          showToast('Coordenadas actualizadas');
        } catch (err) {
          showToast('Error al actualizar coordenadas');
        }
      });
    }

    state.mapMarkers.push({ marker, prop });
  });

  // Agregar cluster group al mapa
  state.leafletMap.addLayer(state.markerClusterGroup);

  // Ajusta vista al conjunto de marcadores
  if (state.mapMarkers.length > 0) {
    state.leafletMap.fitBounds(state.markerClusterGroup.getBounds().pad(0.18));
  }

  // Renderiza sidebar inicial
  renderMapSidebar(getVisibleProperties());
}

// ─── BOTTOM SHEET MÓVIL — 3 SNAP POINTS AIRBNB ──────────────
// Snap 1: hidden   (72px)  — solo handle, usuario navega mapa
// Snap 2: peek    (310px)  — carousel horizontal, 1 tarjeta visible
// Snap 3: expanded (88vh)  — lista completa vertical

const SHEET_H = { hidden: 72, peek: 310, expanded: 0 };

function initBottomSheet() {
  if (window.innerWidth > 768) return;
  const sidebar = document.getElementById('mapSidebar');
  const header  = document.getElementById('mapSheetHandle');
  const list    = document.getElementById('mapCardsList');
  const fab     = document.getElementById('mapListFab');
  if (!sidebar || !header || sidebar._sheetInit) return;
  sidebar._sheetInit = true;

  SHEET_H.expanded = Math.floor(window.innerHeight * 0.88);

  // ── Funciones de snap ─────────────────────────────────────
  function snapTo(snap, animate = true) {
    if (!animate) sidebar.style.transition = 'none';
    sidebar.classList.remove('sheet-hidden', 'sheet-peek', 'sheet-expanded', 'sheet-dragging');

    if (snap === 'hidden') {
      sidebar.classList.add('sheet-hidden');
      sidebar.style.height = SHEET_H.hidden + 'px';
      if (fab) fab.style.display = 'flex';
    } else if (snap === 'peek') {
      sidebar.classList.add('sheet-peek');
      sidebar.style.height = SHEET_H.peek + 'px';
      if (fab) fab.style.display = 'none';
    } else {
      sidebar.classList.add('sheet-expanded');
      sidebar.style.height = SHEET_H.expanded + 'px';
      if (fab) fab.style.display = 'none';
    }

    setTimeout(() => {
      if (!animate) sidebar.style.transition = '';
      state.leafletMap?.invalidateSize();
    }, animate ? 400 : 0);
  }

  // Estado inicial: hidden
  snapTo('hidden', false);

  // ── Botón FAB "Ver lista" ─────────────────────────────────
  if (fab) {
    fab.addEventListener('click', () => snapTo('peek'));
  }

  // ── TAP en handle: toggle hidden ↔ peek ↔ expanded ───────
  let _tapMoved = false;
  header.addEventListener('touchstart', () => { _tapMoved = false; }, { passive: true });
  header.addEventListener('touchmove', () => { _tapMoved = true; }, { passive: true });
  header.addEventListener('click', () => {
    if (_tapMoved) return;
    const cur = sidebar.classList.contains('sheet-expanded') ? 'expanded'
              : sidebar.classList.contains('sheet-peek')     ? 'peek'
              : 'hidden';
    if (cur === 'hidden')    snapTo('peek');
    else if (cur === 'peek') snapTo('expanded');
    else                     snapTo('hidden');
  });

  // ── DRAG en header ────────────────────────────────────────
  let startY = 0, startH = 0, isDragging = false;

  header.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    startH = sidebar.getBoundingClientRect().height;
    isDragging = false;
    sidebar.style.transition = 'none';
  }, { passive: true });

  header.addEventListener('touchmove', (e) => {
    const dy = startY - e.touches[0].clientY;
    if (Math.abs(dy) < 5) return;
    isDragging = true;
    sidebar.classList.add('sheet-dragging');
    const newH = Math.max(SHEET_H.hidden, Math.min(SHEET_H.expanded, startH + dy));
    sidebar.style.height = newH + 'px';
    // Actualizar clase dinámica para el chevron
    sidebar.classList.remove('sheet-hidden', 'sheet-peek', 'sheet-expanded');
    if (newH < 180)            sidebar.classList.add('sheet-hidden');
    else if (newH < SHEET_H.expanded * 0.6) sidebar.classList.add('sheet-peek');
    else                       sidebar.classList.add('sheet-expanded');
  }, { passive: true });

  header.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    sidebar.classList.remove('sheet-dragging');
    sidebar.style.transition = '';
    const h    = sidebar.getBoundingClientRect().height;
    const winH = window.innerHeight;
    // Snap al punto más cercano de los 3
    const dHidden   = Math.abs(h - SHEET_H.hidden);
    const dPeek     = Math.abs(h - SHEET_H.peek);
    const dExpanded = Math.abs(h - SHEET_H.expanded);
    if (dHidden <= dPeek && dHidden <= dExpanded) snapTo('hidden');
    else if (dPeek <= dExpanded)                  snapTo('peek');
    else                                           snapTo('expanded');
  });

  // ── Scroll vertical en expanded → si llega al top vuelve a peek
  if (list) {
    let lastST = 0;
    list.addEventListener('scroll', () => {
      if (isDragging || !sidebar.classList.contains('sheet-expanded')) return;
      if (list.scrollTop < lastST && list.scrollTop === 0) snapTo('peek');
      lastST = list.scrollTop;
    }, { passive: true });
  }

  // ── Click en mapa → collapsar a hidden ───────────────────
  state.leafletMap?.on('click', () => {
    if (window.innerWidth > 768) return;
    snapTo('hidden');
  });

  // Exponer snapTo globalmente para usarla al tocar pins
  window._snapMapSheet = snapTo;
}

// ─── VISTA GRID / MAPA ────────────────────────────────────────
// Desactiva el modo favoritos: quita clase, restaura filtered, re-renderiza
function clearFavoritesFilter() {
  const btnFav = document.getElementById('btnFavorites');
  if (!btnFav?.classList.contains('active')) return; // ya estaba inactivo
  btnFav.classList.remove('active');
  state.filtered = [...state.properties];
  renderGrid();
}

function switchView(view) {
  state.currentView = view;
  clearFavoritesFilter(); // limpia favoritos (restaura estado + re-renderiza grid si era necesario)
  const gridView = document.getElementById('gridView');
  const mapView  = document.getElementById('mapView');
  const btnGrid  = document.getElementById('btnViewGrid');
  const btnMap   = document.getElementById('btnViewMap');

  if (view === 'map') {
    btnGrid.classList.remove('active');
    btnMap.classList.add('active');

    // Grid sale: escala y sube
    gridView.classList.add('view-exit');

    setTimeout(() => {
      gridView.style.display = 'none';
      gridView.classList.remove('view-exit');

      // Mapa entra desde abajo
      mapView.style.display = 'flex';
      mapView.classList.add('view-enter');
      document.querySelector('.app-shell').style.paddingBottom = '0';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          mapView.classList.add('view-enter-active');
          mapView.classList.remove('view-enter');
        });
      });

      initMap();
      setTimeout(() => {
        state.leafletMap?.invalidateSize();
        renderMapSidebar(getVisibleProperties());
        initBottomSheet();
        mapView.classList.remove('view-enter-active');
      }, 350);
    }, 280);

  } else {
    btnMap.classList.remove('active');
    btnGrid.classList.add('active');

    // Mapa sale
    mapView.classList.add('view-enter'); // reutilizo la clase (opacidad 0)
    setTimeout(() => {
      mapView.style.display = 'none';
      mapView.classList.remove('view-enter');

      // Grid regresa desde abajo
      gridView.style.display = 'block';
      gridView.classList.add('view-exit');
      document.querySelector('.app-shell').style.paddingBottom = '';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          gridView.classList.remove('view-exit');
        });
      });
    }, 260);
  }
}

// ─── FAVORITES TOGGLE ────────────────────────────────────────
function toggleFavoritesFilter() {
  const btnFav = document.getElementById('btnFavorites');
  if (!btnFav) return;

  if (btnFav.classList.contains('active')) {
    // Desactivar: clearFavoritesFilter ya hace todo (quita clase, restaura filtered, renderiza)
    clearFavoritesFilter();
    return;
  }

  // ── Activar favoritos ─────────────────────────────────────
  // 1. Cambiar a vista grid sin usar switchView (evita conflicto con clearFavoritesFilter)
  if (state.currentView !== 'grid') {
    state.currentView = 'grid';
    const gridView = document.getElementById('gridView');
    const mapView  = document.getElementById('mapView');
    mapView.style.display  = 'none';
    gridView.style.display = 'block';
    document.getElementById('btnViewGrid').classList.add('active');
    document.getElementById('btnViewMap').classList.remove('active');
    document.querySelector('.app-shell').style.paddingBottom = '';
  }

  // 2. Marcar botón activo
  btnFav.classList.add('active');

  // 3. Filtrar propiedades liked
  const likedArr = [...state.likedIds].map(String);
  const filtered  = state.properties.filter(p => likedArr.includes(String(p.id)));
  state.filtered  = filtered;

  // 4. Renderizar
  if (!filtered.length) {
    const grid    = document.getElementById('propertiesGrid');
    const countEl = document.getElementById('resultsCount');
    if (countEl) countEl.textContent = '';
    if (grid) grid.innerHTML = `
      <div class="empty-state fav-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" width="48" height="48" style="color:#ddd;margin-bottom:12px">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p style="font-weight:700;margin:0 0 6px;color:#444">Aún no tienes guardados</p>
        <p style="font-size:13px;color:#888;margin:0">Toca el ❤️ en cualquier inmueble para guardarlo aquí</p>
      </div>`;
  } else {
    renderGrid();
  }
}

// ─── AMENIDADES TAG INPUT ──────────────────────────────────────
let _amenidadesTags = [];

function initTagsInput() {
  const input = document.getElementById('amenidadesInput');
  const wrap  = document.getElementById('amenidadesTagsWrap');
  if (!input || !wrap) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.value.trim().replace(/,$/, '');
      if (val) { addAmenidadTag(val); input.value = ''; }
    } else if (e.key === 'Backspace' && !input.value && _amenidadesTags.length) {
      removeAmenidadTag(_amenidadesTags.length - 1);
    }
  });

  // Pegar desde portapapeles: soporta listas separadas por coma o salto de línea
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean).forEach(addAmenidadTag);
    input.value = '';
  });

  // Click en el contenedor enfoca el input
  wrap.addEventListener('click', () => input.focus());

  // Chips de sugerencias rápidas
  document.querySelectorAll('.caract-sug-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const sug = btn.dataset.sug;
      if (!sug) return;
      addAmenidadTag(sug);
      // Feedback visual: marcar el chip como ya agregado
      btn.classList.add('sug-added');
      btn.disabled = true;
    });
  });
}

function addAmenidadTag(text) {
  text = text.trim();
  if (!text || _amenidadesTags.includes(text)) return;
  _amenidadesTags.push(text);
  _renderAmenidadesTags();
  _syncAmenidadesHidden();
}

function removeAmenidadTag(index) {
  _amenidadesTags.splice(index, 1);
  _renderAmenidadesTags();
  _syncAmenidadesHidden();
}

function setAmenidadesTags(arr) {
  _amenidadesTags = Array.isArray(arr) ? [...arr] : [];
  _renderAmenidadesTags();
  _syncAmenidadesHidden();
}

function _renderAmenidadesTags() {
  const list = document.getElementById('amenidadesList');
  if (!list) return;
  list.innerHTML = _amenidadesTags.map((tag, i) => `
    <span class="amenidad-tag">
      <span class="amenidad-tag-text">${tag}</span>
      <button type="button" class="amenidad-tag-remove" data-idx="${i}" aria-label="Eliminar">×</button>
    </span>`).join('');
  list.querySelectorAll('.amenidad-tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeAmenidadTag(Number(btn.dataset.idx));
    });
  });
  // Sincronizar estado de chips de sugerencias (habilitar/deshabilitar según tags activos)
  _syncSugChips();
}

function _syncSugChips() {
  document.querySelectorAll('.caract-sug-pill').forEach(btn => {
    const already = _amenidadesTags.includes(btn.dataset.sug);
    btn.classList.toggle('sug-added', already);
    btn.disabled = already;
  });
}

function _syncAmenidadesHidden() {
  const hidden = document.getElementById('fAmenidades');
  if (hidden) hidden.value = JSON.stringify(_amenidadesTags);
}

// ─── UPLOAD MODAL ─────────────────────────────────────────────
function setupUploadModal() {
  const modal = document.getElementById('uploadModal');
  const btnUpload = document.getElementById('btnUpload');
  const closeBtn = document.getElementById('closeUpload');
  const cancelBtn = document.getElementById('cancelUpload');

  btnUpload.addEventListener('click', () => openUploadModal());
  closeBtn.addEventListener('click', closeUploadModal);
  cancelBtn?.addEventListener('click', closeUploadModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeUploadModal(); });

  // Inicializar tag input de amenidades
  initTagsInput();

  // Parse toggle
  document.getElementById('parseToggleBtn').addEventListener('click', () => {
    const area = document.getElementById('parseArea');
    const btn  = document.getElementById('parseToggleBtn');
    const isOpen = area.style.display !== 'none';
    area.style.display = isOpen ? 'none' : 'flex';
    btn.classList.toggle('active', !isOpen);
  });

  // Parse text
  document.getElementById('parseTextBtn').addEventListener('click', () => {
    const text = document.getElementById('rawTextInput').value;
    if (!text.trim()) return;
    const parsed = parsePropertyText(text);
    fillFormFromParsed(parsed);
    showToast('Información parseada. Revisa y ajusta los campos.');
  });

  // Tipo / Estado visual buttons
  document.querySelectorAll('.tipo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.value;
      document.getElementById('fTipo').value = val;
      // Mostrar/ocultar campos de precio según tipo
      const isCombinado = val === 'combinado';
      const precioSimple = document.getElementById('precioSimple');
      const precioCombinado = document.getElementById('precioCombinado');
      if (precioSimple)    precioSimple.style.display    = isCombinado ? 'none' : '';
      if (precioCombinado) precioCombinado.style.display = isCombinado ? ''     : 'none';
    });
  });
  document.querySelectorAll('.estado-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.estado-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('fEstado').value = btn.dataset.value;
    });
  });

  // Counter buttons (+/-)
  document.querySelectorAll('.counter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.for);
      if (!input) return;
      const step = parseFloat(btn.dataset.step) || 1;
      const dir  = parseFloat(btn.dataset.dir)  || 1;
      const min  = parseFloat(input.min) || 0;
      const max  = parseFloat(input.max) || 99;
      const cur  = parseFloat(input.value) || 0;
      const next = Math.min(max, Math.max(min, cur + step * dir));
      input.value = Number.isInteger(next) ? next : next.toFixed(1);
    });
  });

  // Image upload
  const imgInput = document.getElementById('fImages');
  document.getElementById('triggerImages').addEventListener('click', e => { e.stopPropagation(); imgInput.click(); });
  document.getElementById('imageUploadArea').addEventListener('click', () => imgInput.click());
  imgInput.addEventListener('change', handleImageSelect);

  // Drag & drop on upload area
  const uploadArea = document.getElementById('imageUploadArea');
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = '#000'; });
  uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    addImages(files);
  });

  // Locate me
  document.getElementById('btnLocateMe').addEventListener('click', () => {
    if (!navigator.geolocation) { showToast('Geolocalización no disponible'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        updateFormCoords(lat, lng);
        setFormMapLocation(lat, lng, 17);
        showToast('Ubicación obtenida');
      },
      () => showToast('No se pudo obtener la ubicación')
    );
  });

  // Geocode address
  document.getElementById('btnGeocode').addEventListener('click', async () => {
    const parts = [
      document.getElementById('fDireccion').value,
      document.getElementById('fBarrio').value,
      document.getElementById('fMunicipio').value,
      'Colombia'
    ].filter(Boolean);
    if (parts.length < 2) { showToast('Ingresa al menos municipio o dirección'); return; }
    const query = parts.join(', ');
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
      const data = await res.json();
      if (data[0]) {
        const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
        updateFormCoords(lat, lng);
        setFormMapLocation(lat, lng, 16);
        showToast('Ubicación encontrada');
      } else {
        showToast('No se encontró la dirección, ajusta manualmente');
      }
    } catch { showToast('Error al buscar la dirección'); }
  });

  // Sync coord inputs → map
  document.getElementById('fLat').addEventListener('change', syncMapFromInputs);
  document.getElementById('fLng').addEventListener('change', syncMapFromInputs);

  // Form submit
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitProperty();
  });
}

// ─── FORM MAP ─────────────────────────────────────────────────
let formMapInstance  = null;
let formMarkInstance = null;

function initFormMap(lat, lng) {
  const defaultLat = lat || parseFloat(document.getElementById('fLat').value) || 6.1510;
  const defaultLng = lng || parseFloat(document.getElementById('fLng').value) || -75.6190;

  if (formMapInstance) {
    setTimeout(() => {
      formMapInstance.invalidateSize();
      setFormMapLocation(defaultLat, defaultLng);
    }, 80);
    return;
  }

  formMapInstance = L.map('formMap', { zoomControl: true, attributionControl: false })
    .setView([defaultLat, defaultLng], 15);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(formMapInstance);

  const pinIcon = L.divIcon({
    className: '',
    html: `<div class="form-map-pin"><svg viewBox="0 0 24 24" width="36" height="36"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#E71433"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36]
  });

  formMarkInstance = L.marker([defaultLat, defaultLng], { icon: pinIcon, draggable: true })
    .addTo(formMapInstance);

  formMarkInstance.on('dragend', () => {
    const p = formMarkInstance.getLatLng();
    updateFormCoords(p.lat, p.lng);
  });

  formMapInstance.on('click', e => {
    formMarkInstance.setLatLng(e.latlng);
    updateFormCoords(e.latlng.lat, e.latlng.lng);
  });

  setTimeout(() => formMapInstance.invalidateSize(), 100);
}

function updateFormCoords(lat, lng) {
  document.getElementById('fLat').value = parseFloat(lat).toFixed(6);
  document.getElementById('fLng').value = parseFloat(lng).toFixed(6);
}

function syncMapFromInputs() {
  if (!formMapInstance || !formMarkInstance) return;
  const lat = parseFloat(document.getElementById('fLat').value);
  const lng = parseFloat(document.getElementById('fLng').value);
  if (!isNaN(lat) && !isNaN(lng)) {
    formMarkInstance.setLatLng([lat, lng]);
    formMapInstance.panTo([lat, lng]);
  }
}

function setFormMapLocation(lat, lng, zoom) {
  if (!formMapInstance || !formMarkInstance) return;
  formMarkInstance.setLatLng([lat, lng]);
  formMapInstance.setView([lat, lng], zoom || formMapInstance.getZoom());
}

function openUploadModal(prop = null) {
  if (!state.isAdmin) {
    // Sin sesión admin → redirigir a Google OAuth
    window.location.href = '/auth/google';
    return;
  }
  const modal = document.getElementById('uploadModal');
  modal.style.display = 'flex';
  if (prop) openEditModal(prop);
  else resetForm();
  setTimeout(() => initFormMap(), 80);
}

function openEditModal(prop) {
  state.editingId = prop.id;
  document.getElementById('uploadFormTitle').textContent = 'Editar Inmueble';
  document.getElementById('editingId').value = prop.id;
  document.getElementById('submitLabel').textContent = 'Guardar Cambios';

  const tipo   = prop.tipo   || 'arriendo';
  const estado = prop.estado || 'libre';
  document.getElementById('fTipo').value   = tipo;
  document.getElementById('fEstado').value = estado;

  // Sync visual tipo/estado buttons
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.toggle('active', b.dataset.value === tipo));
  document.querySelectorAll('.estado-btn').forEach(b => b.classList.toggle('active', b.dataset.value === estado));

  // Mostrar/ocultar precio según tipo
  const isCombinado = tipo === 'combinado';
  const precioSimpleEl    = document.getElementById('precioSimple');
  const precioCombinadoEl = document.getElementById('precioCombinado');
  if (precioSimpleEl)    precioSimpleEl.style.display    = isCombinado ? 'none' : '';
  if (precioCombinadoEl) precioCombinadoEl.style.display = isCombinado ? ''     : 'none';

  document.getElementById('fTitle').value = prop.title || '';
  document.getElementById('fMunicipio').value = prop.municipio || '';
  document.getElementById('fBarrio').value = prop.barrio || '';
  document.getElementById('fSector').value = prop.sector || '';
  document.getElementById('fDireccion').value = prop.direccion || '';
  document.getElementById('fPiso').value = prop.piso || '';
  document.getElementById('fPrecio').value         = prop.precio         || '';
  document.getElementById('fPrecioArriendo').value = prop.precioArriendo || '';
  document.getElementById('fPrecioVenta').value    = prop.precioVenta    || '';
  document.getElementById('fArea').value = prop.area || '';
  document.getElementById('fHab').value = prop.habitaciones || '';
  document.getElementById('fBanos').value = prop.banos || '';
  document.getElementById('fParqueadero').checked = !!prop.parqueadero;
  document.getElementById('fCuartoUtil').checked = !!prop.cuarto_util;
  document.getElementById('fEstudio').checked = !!prop.estudio;
  const propLat = parseFloat(prop.lat) || 6.1510;
  const propLng = parseFloat(prop.lng) || -75.6190;
  document.getElementById('fLat').value = prop.lat || '';
  document.getElementById('fLng').value = prop.lng || '';
  // Update map to property location
  setTimeout(() => setFormMapLocation(propLat, propLng, 16), 120);

  const amenidades = Array.isArray(prop.amenidades) ? prop.amenidades : JSON.parse(prop.amenidades || '[]');
  setAmenidadesTags(amenidades);
  document.getElementById('fDescripcion').value = prop.descripcion || '';

  // Existing images
  const existingImgs = document.getElementById('existingImages');
  const existingGrid = document.getElementById('existingImagesGrid');
  if (prop.images && prop.images.length) {
    existingImgs.style.display = 'block';
    existingGrid.innerHTML = prop.images.map(img => `
      <div class="existing-img-item" data-img-id="${img.id}">
        <img src="/${encodeImgPath(img.filename)}" alt="foto" />
        <button class="existing-img-remove" data-img-id="${img.id}" data-prop-id="${prop.id}" type="button">×</button>
      </div>`).join('');

    existingGrid.querySelectorAll('.existing-img-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar esta foto?')) return;
        try {
          await apiFetch(`/api/properties/${btn.dataset.propId}/images/${btn.dataset.imgId}`, { method: 'DELETE' });
          btn.parentElement.remove();
          showToast('Foto eliminada');
        } catch (_) { showToast('Error al eliminar foto'); }
      });
    });
  } else {
    existingImgs.style.display = 'none';
  }

  state.pendingImages = [];
  renderImagePreviews();
}

function closeUploadModal() {
  document.getElementById('uploadModal').style.display = 'none';
  state.pendingEditProp = null;
  resetForm();
}

function resetForm() {
  state.editingId = null;
  document.getElementById('uploadFormTitle').textContent = 'Publicar Inmueble';
  document.getElementById('submitLabel').textContent = 'Publicar Inmueble';
  document.getElementById('editingId').value = '';
  document.getElementById('uploadForm').reset();
  document.getElementById('rawTextInput').value = '';
  state.pendingImages = [];
  renderImagePreviews();
  document.getElementById('existingImages').style.display = 'none';

  // Reset tipo/estado visual buttons
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.toggle('active', b.dataset.value === 'arriendo'));
  document.querySelectorAll('.estado-btn').forEach(b => b.classList.toggle('active', b.dataset.value === 'libre'));

  // Mostrar precio simple, ocultar combinado
  const precioSimpleEl    = document.getElementById('precioSimple');
  const precioCombinadoEl = document.getElementById('precioCombinado');
  if (precioSimpleEl)    precioSimpleEl.style.display    = '';
  if (precioCombinadoEl) precioCombinadoEl.style.display = 'none';

  // Limpiar tags de amenidades
  setAmenidadesTags([]);

  // Reset map to default location
  setTimeout(() => setFormMapLocation(6.1510, -75.6190, 14), 80);

  // Collapse parse area
  const parseArea = document.getElementById('parseArea');
  if (parseArea) parseArea.style.display = 'none';
  const parseBtn = document.getElementById('parseToggleBtn');
  if (parseBtn) parseBtn.classList.remove('active');
}

function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  addImages(files);
  e.target.value = '';
}

// ─── COMPRESIÓN DE IMÁGENES (Canvas) ─────────────────────────
async function compressImage(file, maxW = 1920, quality = 0.82) {
  // Saltar si ya es pequeña o no es JPEG/PNG
  if (file.size < 350 * 1024 && !file.name.match(/\.png$/i)) return file;
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const image = new Image();
      image.onload = () => {
        let w = image.width, h = image.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(image, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          const name = file.name.replace(/\.[^.]+$/, '') + '_c.jpg';
          resolve(new File([blob], name, { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      image.onerror = () => resolve(file);
      image.src = ev.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function addImages(files) {
  const allowed = files.filter(f => f.type.startsWith('image/'));
  const remaining = 15 - state.pendingImages.length;
  const toAdd = allowed.slice(0, remaining);
  if (!toAdd.length) return;

  // Feedback visual de compresión
  const hint = document.querySelector('#imageUploadArea .upload-hint');
  if (hint) hint.textContent = `Optimizando ${toAdd.length} imagen${toAdd.length > 1 ? 'es' : ''}…`;

  const compressed = await Promise.all(toAdd.map(f => compressImage(f)));
  state.pendingImages.push(...compressed);

  if (hint) hint.textContent = 'JPG, PNG, WEBP · Máx 10MB por foto';
  renderImagePreviews();
}

function renderImagePreviews() {
  const list = document.getElementById('imagePreviewList');
  list.innerHTML = state.pendingImages.map((file, i) => `
    <div class="image-preview-item">
      <img src="${URL.createObjectURL(file)}" alt="preview ${i}" />
      <button class="image-preview-remove" data-index="${i}" type="button">×</button>
    </div>`).join('');

  list.querySelectorAll('.image-preview-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.pendingImages.splice(Number(btn.dataset.index), 1);
      renderImagePreviews();
    });
  });
}

async function submitProperty() {
  const submitBtn = document.getElementById('submitProperty');
  const spinner = document.getElementById('submitSpinner');
  const label = document.getElementById('submitLabel');

  submitBtn.disabled = true;
  spinner.style.display = 'block';
  label.style.display = 'none';

  try {
    // Amenidades desde el sistema de tags
    const amenHidden = document.getElementById('fAmenidades').value;
    let amenidades = [];
    try { amenidades = JSON.parse(amenHidden); } catch { amenidades = []; }

    const tipo = document.getElementById('fTipo').value;
    const isCombinado = tipo === 'combinado';

    const formData = new FormData();
    formData.append('adminPassword', state.adminPassword);
    formData.append('title', document.getElementById('fTitle').value);
    formData.append('tipo', tipo);
    formData.append('estado', document.getElementById('fEstado').value);
    formData.append('municipio', document.getElementById('fMunicipio').value);
    formData.append('barrio', document.getElementById('fBarrio').value);
    formData.append('sector', document.getElementById('fSector').value);
    formData.append('direccion', document.getElementById('fDireccion').value);
    formData.append('piso', document.getElementById('fPiso').value);
    if (isCombinado) {
      const pArr = document.getElementById('fPrecioArriendo').value;
      const pVta = document.getElementById('fPrecioVenta').value;
      formData.append('precio',         pArr);   // precio principal = arriendo (para filtros)
      formData.append('precioArriendo', pArr);
      formData.append('precioVenta',    pVta);
    } else {
      formData.append('precio', document.getElementById('fPrecio').value);
      formData.append('precioArriendo', '');
      formData.append('precioVenta',    '');
    }
    formData.append('area', document.getElementById('fArea').value);
    formData.append('habitaciones', document.getElementById('fHab').value);
    formData.append('banos', document.getElementById('fBanos').value);
    formData.append('parqueadero', document.getElementById('fParqueadero').checked ? '1' : '0');
    formData.append('cuarto_util', document.getElementById('fCuartoUtil').checked ? '1' : '0');
    formData.append('estudio', document.getElementById('fEstudio').checked ? '1' : '0');
    formData.append('descripcion', document.getElementById('fDescripcion').value);
    formData.append('amenidades', JSON.stringify(amenidades));
    formData.append('lat', document.getElementById('fLat').value || '6.15');
    formData.append('lng', document.getElementById('fLng').value || '-75.62');

    state.pendingImages.forEach(file => formData.append('images', file));

    const editingId = document.getElementById('editingId').value;
    const url = editingId ? `/api/properties/${editingId}` : '/api/properties';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }

    showToast(editingId ? '¡Inmueble actualizado!' : '¡Inmueble publicado!');
    closeUploadModal();
    await loadProperties();
    await loadFiltersData();
  } catch (err) {
    showToast('Error: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    spinner.style.display = 'none';
    label.style.display = 'block';
  }
}

// ─── TEXT PARSER ──────────────────────────────────────────────
function parsePropertyText(text) {
  const r = {
    title: '', tipo: 'arriendo',
    municipio: '', barrio: '', sector: '',
    direccion: '', piso: '', precio: 0,
    area: 0, habitaciones: 0, banos: 0,
    parqueadero: false, cuarto_util: false, estudio: false,
    descripcion: '', amenidades: []
  };

  // Tipo
  if (/arriendo/i.test(text)) r.tipo = 'arriendo';
  else if (/venta|vende/i.test(text)) r.tipo = 'venta';

  // Municipio
  const municipios = ['Sabaneta','Envigado','Medellín','Itagüí','Bello','La Estrella','Caldas','Copacabana','Rionegro','Girardota'];
  for (const m of municipios) {
    if (new RegExp(m, 'i').test(text)) { r.municipio = m; break; }
  }

  // Barrio (after "en " keyword)
  const barrioMatch = text.match(/en\s+([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s]+?)(?:\s*[-–—|·]|\s*\n)/);
  if (barrioMatch) r.barrio = barrioMatch[1].trim().replace(/\s+en\s+.+$/i, '').trim();

  // Precio
  const precioMatch = text.match(/\$\s*([0-9][0-9.,]*)/);
  if (precioMatch) {
    r.precio = Number(precioMatch[1].replace(/\./g, '').replace(',', '.'));
  }

  // Área
  const areaMatch = text.match(/(\d+)\s*(?:m[²2]|mts?\.?2?)/i);
  if (areaMatch) r.area = Number(areaMatch[1]);

  // Habitaciones
  const habMatch = text.match(/(\d+)\s*habitaciones?/i) || text.match(/[Hh]abitaciones?\s*(\d+)/);
  if (habMatch) r.habitaciones = Number(habMatch[1]);

  // Baños
  const banosMatch = text.match(/(\d+\.?\d*)\s*ba[ñn]os?/i);
  if (banosMatch) r.banos = Number(banosMatch[1]);

  // Dirección
  const dirMatch = text.match(/Direcci[oó]n\s*:?\s*([^\n]+)/i);
  if (dirMatch) r.direccion = dirMatch[1].trim();

  // Piso
  const pisoMatch = text.match(/[Pp]iso\s*(\d+)/);
  if (pisoMatch) r.piso = pisoMatch[1];

  // Booleanos
  r.parqueadero = /parqueadero/i.test(text);
  r.cuarto_util = /cuarto\s*[uú]til/i.test(text);
  r.estudio = /estudio/i.test(text);

  // Sector
  const sectorMatch = text.match(/[Ss]ector\s+([^\n|·\-]+)/);
  if (sectorMatch) r.sector = sectorMatch[1].trim();

  // Amenidades (líneas con emoji o bullet)
  const amenLines = text.split('\n').filter(line => {
    const t = line.trim();
    return t.length > 2 && t.length < 70 &&
      (/(✨|🛏|🛁|📚|🍳|🛋|👕|🚗|📦|🏊|🛡|🪟|🏢|◾|•)/.test(t)) &&
      !/\$|💰|📱|☑|🔥|🤩|💥|📍|dirección|piso/i.test(t);
  });
  r.amenidades = amenLines.map(l =>
    l.replace(/^[✨🛏️🛁📚🍳🛋️👕🚗📦🏊🛡️🪟◾•·\-]\s*/u, '').trim()
  ).filter(a => a.length > 2 && a.length < 60);

  // Title (primera línea limpia)
  const firstLine = text.split('\n').find(l => l.trim().length > 5);
  if (firstLine) {
    r.title = firstLine.trim()
      .replace(/^[💥✨🔥]+\s*/u, '')
      .replace(/\s*\|.+$/, '')
      .substring(0, 100);
  }

  return r;
}

function fillFormFromParsed(p) {
  if (p.tipo) {
    document.getElementById('fTipo').value = p.tipo;
    document.querySelectorAll('.tipo-btn').forEach(b => b.classList.toggle('active', b.dataset.value === p.tipo));
  }
  if (p.title)        document.getElementById('fTitle').value       = p.title;
  if (p.municipio)    document.getElementById('fMunicipio').value   = p.municipio;
  if (p.barrio)       document.getElementById('fBarrio').value      = p.barrio;
  if (p.sector)       document.getElementById('fSector').value      = p.sector;
  if (p.direccion)    document.getElementById('fDireccion').value   = p.direccion;
  if (p.piso)         document.getElementById('fPiso').value        = p.piso;
  if (p.precio)       document.getElementById('fPrecio').value      = p.precio;
  if (p.area)         document.getElementById('fArea').value        = p.area;
  if (p.habitaciones) document.getElementById('fHab').value         = p.habitaciones;
  if (p.banos)        document.getElementById('fBanos').value       = p.banos;
  document.getElementById('fParqueadero').checked = !!p.parqueadero;
  document.getElementById('fCuartoUtil').checked  = !!p.cuarto_util;
  document.getElementById('fEstudio').checked     = !!p.estudio;
  if (p.amenidades?.length) setAmenidadesTags(p.amenidades);
}

// ─── ADMIN UI REFRESH ─────────────────────────────────────────
function refreshAdminUI() {
  if (state.isAdmin) renderGrid();
  const logoutBtn = document.getElementById('profileLogoutBtn');
  const editBtn   = document.getElementById('profileEditBtn');
  // "Salir" solo visible cuando está logueado
  if (logoutBtn) logoutBtn.style.display = state.isAdmin ? 'inline-flex' : 'none';
  // El botón siempre visible: cuando admin → "Editar perfil", cuando no → "Admin" (login)
  if (editBtn) {
    editBtn.style.display = 'inline-flex';
    if (state.isAdmin) {
      editBtn.setAttribute('aria-label', 'Editar perfil');
      editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Editar`;
    } else {
      editBtn.setAttribute('aria-label', 'Acceso Admin');
      editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Admin`;
    }
  }
}

// ─── LOGOUT UNIFICADO ────────────────────────────────────────
async function globalLogout() {
  if (!confirm('¿Cerrar sesión de administrador?')) return;
  // Limpiar estado local
  state.isAdmin = false;
  state.adminPassword = '';
  // Cerrar sesión en servidor (Google) y recargar
  try { await fetch('/auth/logout', { credentials: 'same-origin', redirect: 'manual' }); } catch (_) {}
  renderGrid();
  refreshAdminUI();
  // Notificar
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 20px;border-radius:999px;font-size:13px;font-weight:600;z-index:9999;';
  t.textContent = 'Sesión cerrada';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ─── SOCKET.IO ────────────────────────────────────────────────
function setupSocket() {
  try {
    const socket = io();

    socket.on('likes-update', ({ id, likes }) => {
      updateLikeCount(id, likes);
      const prop = state.properties.find(p => p.id === id);
      if (prop) prop.likes = likes;
    });

    socket.on('views-update', ({ id, views }) => {
      updateViewCount(id, views);
      const prop = state.properties.find(p => p.id === id);
      if (prop) prop.views = views;
    });

    socket.on('new-property', async () => {
      await loadProperties();
      await loadFiltersData();
    });

    socket.on('property-updated', async () => {
      await loadProperties();
    });

    socket.on('property-deleted', async () => {
      await loadProperties();
      await loadFiltersData();
    });

    socket.on('coordinates-updated', ({ id, lat, lng }) => {
      const prop = state.properties.find(p => p.id === id);
      if (prop) { prop.lat = lat; prop.lng = lng; }
    });

  } catch (_) {
    // Socket.io not available (static file serving)
    console.log('Socket.io no disponible, modo sin tiempo real');
  }
}

// ─── FLOATING BAR ─────────────────────────────────────────────
function setupFloatingBar() {
  document.getElementById('btnViewGrid').addEventListener('click', () => switchView('grid'));
  document.getElementById('btnViewMap').addEventListener('click', () => switchView('map'));
  document.getElementById('btnFavorites')?.addEventListener('click', toggleFavoritesFilter);
  document.getElementById('btnUpload').addEventListener('click', () => openUploadModal());
}


// ─── PANEL INTEGRACIONES ──────────────────────────────────────
function setupIntegracionesPanel() {
  const overlay = document.getElementById('integOverlay');
  if (!overlay) return;
  let _integSettings = {};

  async function openIntegPanel() {
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    await loadIntegData();
  }
  function closeIntegPanel() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  document.getElementById('btnIntegraciones')?.addEventListener('click', openIntegPanel);
  document.getElementById('closeInteg')?.addEventListener('click', closeIntegPanel);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeIntegPanel(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.style.display !== 'none') closeIntegPanel();
  });

  // Tabs
  document.querySelectorAll('.integ-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.integ-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.integ-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('itab-' + tab.dataset.tab)?.classList.add('active');
    });
  });

  async function loadIntegData() {
    try {
      const [settingsRes, keysRes] = await Promise.all([
        fetch('/api/admin/settings', { headers: { 'x-admin-password': state.adminPassword } }),
        fetch('/api/admin/api-keys',  { headers: { 'x-admin-password': state.adminPassword } })
      ]);
      _integSettings = await settingsRes.json();
      const keys = await keysRes.json();
      populateSettings(_integSettings);
      renderApiKeys(keys);
    } catch (_) {}
  }

  function populateSettings(s) {
    const el = id => document.getElementById(id);
    if (el('webhookUrl'))       el('webhookUrl').value          = s.webhookUrl || '';
    if (el('wevNewLead'))       el('wevNewLead').checked        = (s.webhookEvents || []).includes('new_lead');
    if (el('wevNewProp'))       el('wevNewProp').checked        = (s.webhookEvents || []).includes('new_property');
    if (el('anthropicKey'))     el('anthropicKey').placeholder  = s.anthropicApiKey ? 'Clave guardada (' + s.anthropicApiKey + ')' : 'sk-ant-...';
    if (el('chatEnabled'))      { el('chatEnabled').checked     = !!s.chatEnabled; updateChatToggleLabel(); }
    if (el('chatGreeting'))     el('chatGreeting').value        = s.chatGreeting || '';
    if (el('chatSystemPrompt')) el('chatSystemPrompt').value    = s.chatSystemPrompt || '';
  }

  function updateChatToggleLabel() {
    const enabled = document.getElementById('chatEnabled')?.checked;
    const label   = document.getElementById('chatEnabledLabel');
    if (label) label.textContent = enabled ? 'Activado' : 'Desactivado';
  }
  document.getElementById('chatEnabled')?.addEventListener('change', updateChatToggleLabel);

  function renderApiKeys(keys) {
    const list = document.getElementById('apiKeysList');
    if (!list) return;
    if (!keys.length) {
      list.innerHTML = '<p style="font-size:.8rem;color:#888;margin:8px 0">No hay claves creadas aún.</p>';
      return;
    }
    list.innerHTML = keys.map(k => `
      <div class="integ-key-item" data-id="${escHtml(k.id)}">
        <div class="integ-key-item-left">
          <div class="integ-key-item-name">${escHtml(k.name)}</div>
          <div class="integ-key-item-meta">${escHtml(k.key)} · Creada ${new Date(k.created).toLocaleDateString('es-CO')}</div>
        </div>
        <button class="integ-key-del" data-id="${escHtml(k.id)}" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>`).join('');
    list.querySelectorAll('.integ-key-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar esta API key?')) return;
        await fetch('/api/admin/api-keys/' + btn.dataset.id, {
          method: 'DELETE',
          headers: { 'x-admin-password': state.adminPassword }
        });
        await loadIntegData();
      });
    });
  }

  // Crear API key
  document.getElementById('btnCreateKey')?.addEventListener('click', async () => {
    const name = document.getElementById('newKeyName')?.value.trim();
    if (!name) return showToast('Ingresa un nombre para la clave');
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': state.adminPassword },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || 'Error al crear clave');
      document.getElementById('newKeyName').value = '';
      const box = document.getElementById('newKeyBox');
      const val = document.getElementById('newKeyValue');
      if (box && val) { val.textContent = data.key; box.style.display = 'block'; }
      await loadIntegData();
    } catch (_) { showToast('Error al crear clave'); }
  });

  document.getElementById('copyNewKey')?.addEventListener('click', () => {
    const val = document.getElementById('newKeyValue')?.textContent;
    if (val) navigator.clipboard.writeText(val).then(() => showToast('✓ Clave copiada'));
  });

  // Guardar webhooks
  document.getElementById('btnSaveWebhook')?.addEventListener('click', async () => {
    const events = [];
    if (document.getElementById('wevNewLead')?.checked) events.push('new_lead');
    if (document.getElementById('wevNewProp')?.checked) events.push('new_property');
    const body = { webhookUrl: document.getElementById('webhookUrl')?.value || '', webhookEvents: events };
    const st = document.getElementById('webhookStatus');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': state.adminPassword },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error();
      if (st) { st.textContent = '✓ Webhook guardado correctamente'; st.className = 'integ-status-msg ok'; setTimeout(() => { st.className = 'integ-status-msg'; }, 3000); }
    } catch { if (st) { st.textContent = 'Error al guardar'; st.className = 'integ-status-msg err'; } }
  });

  document.getElementById('btnTestWebhook')?.addEventListener('click', async () => {
    const st = document.getElementById('webhookStatus');
    if (st) { st.textContent = 'Enviando prueba…'; st.className = 'integ-status-msg ok'; }
    try {
      const res = await fetch('/api/admin/webhook-test', {
        method: 'POST',
        headers: { 'x-admin-password': state.adminPassword }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      if (st) { st.textContent = '✓ Webhook de prueba enviado'; st.className = 'integ-status-msg ok'; setTimeout(() => { st.className = 'integ-status-msg'; }, 3500); }
    } catch (err) {
      if (st) { st.textContent = '✗ ' + (err.message || 'Error'); st.className = 'integ-status-msg err'; }
    }
  });

  // Guardar servicios (Anthropic key)
  document.getElementById('btnSaveServicios')?.addEventListener('click', async () => {
    const key = document.getElementById('anthropicKey')?.value.trim();
    const st = document.getElementById('serviciosStatus');
    const body = {};
    if (key) body.anthropicApiKey = key;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': state.adminPassword },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error();
      if (document.getElementById('anthropicKey')) document.getElementById('anthropicKey').value = '';
      await loadIntegData();
      if (st) { st.textContent = '✓ Credenciales guardadas'; st.className = 'integ-status-msg ok'; setTimeout(() => { st.className = 'integ-status-msg'; }, 3000); }
      await initChatWidget();
    } catch { if (st) { st.textContent = 'Error al guardar'; st.className = 'integ-status-msg err'; } }
  });

  // Guardar config chat
  document.getElementById('btnSaveChat')?.addEventListener('click', async () => {
    const body = {
      chatEnabled:      document.getElementById('chatEnabled')?.checked || false,
      chatGreeting:     document.getElementById('chatGreeting')?.value || '',
      chatSystemPrompt: document.getElementById('chatSystemPrompt')?.value || ''
    };
    const st = document.getElementById('chatConfigStatus');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': state.adminPassword },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error();
      if (st) { st.textContent = '✓ Configuración guardada'; st.className = 'integ-status-msg ok'; setTimeout(() => { st.className = 'integ-status-msg'; }, 3000); }
      await initChatWidget();
    } catch { if (st) { st.textContent = 'Error al guardar'; st.className = 'integ-status-msg err'; } }
  });
}

// ─── CHAT IA WIDGET ───────────────────────────────────────────
let _chatMessages = [];
let _chatOpen = false;

async function initChatWidget() {
  try {
    const res = await fetch('/api/chat/config');
    const config = await res.json();
    const widget = document.getElementById('chatWidget');
    if (!widget) return;
    if (config.enabled) {
      widget.style.display = 'block';
      if (_chatMessages.length === 0) {
        _chatMessages = [{ role: 'assistant', content: config.greeting }];
        renderChatMessages();
        if (!_chatOpen) {
          const badge = document.getElementById('chatFabBadge');
          if (badge) badge.style.display = 'flex';
        }
      }
    } else {
      widget.style.display = 'none';
    }
  } catch (_) {}
}

function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  container.innerHTML = _chatMessages.map(m =>
    `<div class="chat-msg ${m.role === 'user' ? 'user' : 'bot'}">${escHtml(m.content)}</div>`
  ).join('');
  container.scrollTop = container.scrollHeight;
}

function setupAIChat() {
  const fab     = document.getElementById('chatFab');
  const box     = document.getElementById('chatBox');
  const closeBtn = document.getElementById('chatBoxClose');
  const input   = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  if (!fab) return;

  fab.addEventListener('click', () => {
    _chatOpen = !_chatOpen;
    box.style.display = _chatOpen ? 'flex' : 'none';
    if (_chatOpen) {
      const badge = document.getElementById('chatFabBadge');
      if (badge) badge.style.display = 'none';
      renderChatMessages();
      input?.focus();
    }
  });

  closeBtn?.addEventListener('click', () => {
    _chatOpen = false;
    box.style.display = 'none';
  });

  async function sendMessage() {
    const text = input?.value.trim();
    if (!text || sendBtn?.disabled) return;
    input.value = '';
    _chatMessages.push({ role: 'user', content: text });
    renderChatMessages();
    sendBtn.disabled = true;

    // Typing indicator
    const container = document.getElementById('chatMessages');
    const typing = document.createElement('div');
    typing.className = 'chat-msg typing';
    typing.textContent = 'Escribiendo…';
    container?.appendChild(typing);
    if (container) container.scrollTop = container.scrollHeight;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: _chatMessages.map(m => ({ role: m.role, content: m.content })) })
      });
      const data = await res.json();
      typing.remove();
      if (res.ok && data.reply) {
        _chatMessages.push({ role: 'assistant', content: data.reply });
      } else {
        _chatMessages.push({ role: 'assistant', content: 'Lo siento, hubo un error. Por favor escríbeme por WhatsApp.' });
      }
      renderChatMessages();
    } catch (_) {
      typing.remove();
      _chatMessages.push({ role: 'assistant', content: 'Error de conexión. Por favor intenta nuevamente.' });
      renderChatMessages();
    } finally {
      sendBtn.disabled = false;
      input?.focus();
    }
  }

  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Init widget al cargar
  initChatWidget();
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Forzar limpieza del input de búsqueda. Chrome autofill puede dispararse
  // después de DOMContentLoaded, por eso limpiamos en múltiples momentos.
  const _si = document.getElementById('searchInput');
  const _hasQParam = !!new URLSearchParams(location.search).get('q');
  if (_si && !_hasQParam) {
    _si.value = '';
    [50, 150, 400, 800].forEach(ms => setTimeout(() => { if (!_si.matches(':focus')) _si.value = ''; }, ms));
  }

  loadLikedIds();

  // Medir la altura real del top-bar y setear variable CSS global
  function updateTopBarHeight() {
    const h = document.querySelector('.top-bar')?.getBoundingClientRect().height || 72;
    document.documentElement.style.setProperty('--top-bar-h', Math.ceil(h) + 'px');
    // Si hay filtros activos, recalcular offset total
    const bar = document.getElementById('activeFiltersBar');
    if (bar && bar.style.display !== 'none') {
      const barH = bar.getBoundingClientRect().height;
      const offset = Math.ceil(h + barH);
      document.documentElement.style.setProperty('--filters-offset', offset + 'px');
    }
  }
  updateTopBarHeight();
  window.addEventListener('resize', updateTopBarHeight);

  // Check sesión admin — solo Google OAuth
  try {
    const authRes = await fetch('/auth/status', { credentials: 'same-origin' });
    const { loggedIn } = await authRes.json();
    if (loggedIn) {
      state.isAdmin = true;
      state.adminPassword = '__google__';
    }
  } catch (_) {}
  // Limpiar contraseñas guardadas de versiones anteriores
  localStorage.removeItem('adminPwd');
  sessionStorage.removeItem('adm_pwd_v2');

  readURLParams();
  setupFilters();
  syncUIFromState();
  refreshAdminUI(); // mostrar/ocultar botones admin según sesión
  setupFloatingBar();
  setupUploadModal();
  setupShareSheet();
  setupLightbox();
  setupIntegracionesPanel();
  setupAIChat();
  setupReviewsPanel();

  // Cargar perfil del consultor para que el número de WhatsApp esté disponible
  // antes de que el usuario abra el modal de contacto
  fetch('/api/profile')
    .then(r => r.json())
    .then(p => { window._profileData = p; })
    .catch(() => {});

  await loadProperties();
  await loadFiltersData();
  renderSavedSearches();
  setupSocket();

  // ── Facebook Pixel: Lead en botones de WhatsApp del mapa ─────
  // Event delegation global para capturar clics en elementos
  // generados dinámicamente (mapa, sidebar, overlay)
  document.body.addEventListener('click', (e) => {
    const waMapCard = e.target.closest('.map-card-btn-wa');
    const waOverlay = e.target.closest('.map-overlay-wa');
    if (waMapCard) {
      const cardContainer = waMapCard.closest('[data-card-id]') || waMapCard.closest('.map-card');
      const cardId = cardContainer?.getAttribute('data-card-id');
      const cardTitle = cardContainer?.querySelector('.property-title')?.textContent
                      || cardContainer?.querySelector('.map-card-title')?.textContent
                      || 'Inmueble mapa';
      const prop = state.properties.find(p => String(p.id) === String(cardId));
      trackLead('mapa_tarjeta_wa', cardTitle, cardId, prop?.precio);
    }
    if (waOverlay) {
      trackLead('mapa_overlay_wa', 'Inmueble overlay');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// PANEL DE RESEÑAS
// ═══════════════════════════════════════════════════════════════
function setupReviewsPanel() {
  const panel     = document.getElementById('reviewsPanel');
  const overlay   = document.getElementById('reviewsOverlay');
  const btnOpen   = document.getElementById('btnReviews');
  const btnClose  = document.getElementById('reviewsPanelClose');
  if (!panel || !btnOpen) return;

  let _gCredential = null;  // current user's Google JWT
  let _gUser = null;        // { name, email, photo }
  let _selectedRating = 0;
  let _reviews = [];
  let _stats = { avg: 0, total: 0, distribution: [] };
  let _gsiLoaded = false;
  let _clientId = '';

  // ── Open / Close ──────────────────────────────────────────────
  function openPanel() {
    panel.style.display = 'flex';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    loadReviews();
    ensureGSI();
  }
  function closePanel() {
    panel.style.display = 'none';
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  btnOpen.addEventListener('click', openPanel);
  btnClose.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

  // ── Load Google GSI dynamically ───────────────────────────────
  async function ensureGSI() {
    if (_gsiLoaded) return;
    try {
      const cfg = await fetch('/api/config').then(r => r.json());
      _clientId = cfg.googleClientId || '';
    } catch (_) { _clientId = ''; }

    if (!_clientId) {
      // Sin clientId configurado: ocultar sección de escritura
      document.getElementById('reviewsGoogleSignIn').innerHTML =
        '<p class="reviews-cta-text" style="color:#aaa;font-size:.8rem">Las reseñas requieren Google Client ID configurado en Admin → Integraciones → API Keys.</p>';
      return;
    }

    if (!document.getElementById('gsi-script')) {
      const s = document.createElement('script');
      s.id = 'gsi-script';
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => { _gsiLoaded = true; initGSI(); };
      document.head.appendChild(s);
    } else if (window.google?.accounts) {
      _gsiLoaded = true;
      initGSI();
    }
  }

  function initGSI() {
    if (!_clientId || !window.google?.accounts?.id) return;
    google.accounts.id.initialize({
      client_id: _clientId,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true
    });
  }

  // ── Google Sign-In ─────────────────────────────────────────────
  document.getElementById('reviewsSignInBtn').addEventListener('click', () => {
    if (!_gsiLoaded || !_clientId) return;
    google.accounts.id.prompt(notification => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: render button in a popup-like way
        google.accounts.id.renderButton(
          document.getElementById('reviewsGoogleSignIn'),
          { theme: 'outline', size: 'large', text: 'signin_with', width: 300 }
        );
      }
    });
  });

  document.getElementById('reviewsSignOut').addEventListener('click', () => {
    _gCredential = null; _gUser = null; _selectedRating = 0;
    renderFormState();
  });

  function handleGoogleCredential(response) {
    _gCredential = response.credential;
    // Decode JWT payload (base64)
    try {
      const parts = _gCredential.split('.');
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      _gUser = { name: payload.name, email: payload.email, photo: payload.picture };
      // Exponer email globalmente para que CAPI lo hashee server-side y mejore la atribución
      if (payload.email) window._fbUserEmail = payload.email;
    } catch (_) { _gUser = { name: 'Usuario', email: '', photo: '' }; }
    renderFormState();
  }

  function renderFormState() {
    const signInDiv = document.getElementById('reviewsGoogleSignIn');
    const formDiv   = document.getElementById('reviewsForm');
    if (_gCredential && _gUser) {
      signInDiv.style.display = 'none';
      formDiv.style.display = 'block';
      document.getElementById('reviewsUserName').textContent = _gUser.name;
      const photo = document.getElementById('reviewsUserPhoto');
      if (_gUser.photo) { photo.src = _gUser.photo; photo.style.display = 'block'; }
      else { photo.style.display = 'none'; }
      // Check if user already has a review
      const existing = _reviews.find(r => r.email === _gUser.email);
      if (existing) {
        setRating(existing.rating);
        document.getElementById('reviewsComment').value = existing.comment || '';
        document.getElementById('reviewsSubmitBtn').textContent = 'Actualizar reseña';
      }
    } else {
      signInDiv.style.display = 'block';
      formDiv.style.display = 'none';
    }
  }

  // ── Star picker ───────────────────────────────────────────────
  function setRating(val) {
    _selectedRating = val;
    document.querySelectorAll('.rsp-star').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.val) <= val);
    });
    document.getElementById('reviewsSubmitBtn').disabled = val === 0;
  }

  document.querySelectorAll('.rsp-star').forEach(btn => {
    btn.addEventListener('click', () => setRating(Number(btn.dataset.val)));
    btn.addEventListener('mouseenter', () => {
      document.querySelectorAll('.rsp-star').forEach(b => {
        b.style.color = Number(b.dataset.val) <= Number(btn.dataset.val) ? '#fbbc04' : '#ddd';
      });
    });
  });
  document.getElementById('reviewsStarPicker').addEventListener('mouseleave', () => {
    document.querySelectorAll('.rsp-star').forEach(b => {
      b.style.color = '';
      b.classList.toggle('active', Number(b.dataset.val) <= _selectedRating);
    });
  });

  // ── Emoji bar ─────────────────────────────────────────────────
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ta = document.getElementById('reviewsComment');
      const emoji = btn.dataset.emoji;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      ta.value = ta.value.slice(0, start) + emoji + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + emoji.length;
      ta.focus();
    });
  });

  // ── Submit review ─────────────────────────────────────────────
  document.getElementById('reviewsSubmitBtn').addEventListener('click', async () => {
    if (!_gCredential || _selectedRating === 0) return;
    const btn = document.getElementById('reviewsSubmitBtn');
    const msg = document.getElementById('reviewsFormMsg');
    btn.disabled = true;
    btn.textContent = 'Publicando…';
    msg.textContent = '';
    msg.className = 'reviews-form-msg';
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: _gCredential,
          rating: _selectedRating,
          comment: document.getElementById('reviewsComment').value.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al publicar');
      msg.textContent = '¡Reseña publicada! Gracias.';
      msg.className = 'reviews-form-msg ok';
      btn.textContent = 'Actualizar reseña';
      btn.disabled = false;
      await loadReviews();
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
      btn.textContent = _reviews.some(r => r.email === _gUser?.email) ? 'Actualizar reseña' : 'Publicar reseña';
    }
  });

  // ── Load & render reviews ─────────────────────────────────────
  async function loadReviews() {
    try {
      const data = await fetch('/api/reviews').then(r => r.json());
      _reviews = data.reviews || [];
      _stats = data.stats || { avg: 0, total: 0, distribution: [] };
      renderStats();
      renderList();
      updateBadge();
    } catch (_) {}
  }

  function renderStats() {
    const avgNum   = document.getElementById('reviewsAvgNum');
    const avgStars = document.getElementById('reviewsAvgStars');
    const avgTotal = document.getElementById('reviewsAvgTotal');
    const dist     = document.getElementById('reviewsDist');

    avgNum.textContent = _stats.total ? (_stats.avg || 0).toFixed(1) : '—';
    avgTotal.textContent = _stats.total
      ? `${_stats.total} reseña${_stats.total !== 1 ? 's' : ''}`
      : 'sin reseñas';

    // Avg stars
    avgStars.innerHTML = [1,2,3,4,5].map(i =>
      `<span class="reviews-avg-star ${i <= Math.round(_stats.avg) ? '' : 'empty'}">★</span>`
    ).join('');

    // Distribution bars
    dist.innerHTML = (_stats.distribution || []).map(d => {
      const pct = _stats.total ? Math.round((d.count / _stats.total) * 100) : 0;
      return `<div class="reviews-dist-row">
        <span class="reviews-dist-label">${d.stars}</span>
        <div class="reviews-dist-bar-wrap">
          <div class="reviews-dist-bar" style="width:${pct}%"></div>
        </div>
        <span class="reviews-dist-count">${d.count}</span>
      </div>`;
    }).join('');
  }

  function starsHtml(n) {
    return [1,2,3,4,5].map(i =>
      `<span class="review-star ${i <= n ? '' : 'empty'}">★</span>`
    ).join('');
  }

  function renderList() {
    const list = document.getElementById('reviewsList');
    if (!_reviews.length) {
      list.innerHTML = '<div class="reviews-empty">Sé el primero en dejar una reseña.</div>';
      return;
    }
    const isAdmin = state.isAdmin;
    list.innerHTML = _reviews.map(r => {
      const date = new Date(r.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
      const initials = (r.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const avatarHtml = r.photo
        ? `<img class="review-avatar" src="${r.photo}" alt="${r.name}" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><span class="review-avatar-initials" style="display:none">${initials}</span>`
        : `<span class="review-avatar-initials">${initials}</span>`;

      // Reply section HTML
      const replyHtml = r.reply ? `
        <div class="review-reply-section">
          <div class="reply-header">
            <span class="reply-label">✓ Respuesta del Consultor</span>
          </div>
          <div class="reply-content">${r.reply.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          <div class="reply-footer">
            <span class="reply-date">${new Date(r.reply.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            ${isAdmin ? `<div class="reply-actions">
              <button class="reply-edit-btn" onclick="openReplyPanel('${r._id}')" title="Editar respuesta">Editar</button>
              <button class="reply-del-btn" onclick="deleteReply('${r._id}')" title="Eliminar respuesta">Eliminar</button>
            </div>` : ''}
          </div>
        </div>
      ` : (isAdmin ? `
        <div class="review-reply-section review-reply-empty">
          <button class="reply-btn" onclick="openReplyPanel('${r._id}')">Responder</button>
        </div>
      ` : '');

      return `<div class="review-card" data-id="${r._id}">
        <div class="review-card-header">
          ${avatarHtml}
          <div class="review-meta">
            <span class="review-name">${r.name}</span>
            <span class="review-date">${date}</span>
          </div>
          ${isAdmin ? `<button class="review-del-btn" onclick="deleteReview('${r._id}')" title="Eliminar">✕</button>` : ''}
        </div>
        <div class="review-stars">${starsHtml(r.rating)}</div>
        ${r.comment ? `<div class="review-comment">${r.comment.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>` : ''}
        ${replyHtml}
      </div>`;
    }).join('');
  }

  function updateBadge() {
    const badge = document.getElementById('reviewsRatingBadge');
    if (!badge) return;
    if (_stats.total > 0) {
      badge.textContent = _stats.avg.toFixed(1) + '★';
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // Expose for admin delete button (global)
  window.deleteReview = async (id) => {
    if (!state.isAdmin || !confirm('¿Eliminar esta reseña?')) return;
    try {
      await fetch(`/api/reviews/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': state.adminPassword }
      });
      await loadReviews();
    } catch (err) { alert('Error al eliminar: ' + err.message); }
  };

  // Open reply panel modal
  window.openReplyPanel = (reviewId) => {
    if (!state.isAdmin) return;

    const review = _reviews.find(r => r._id === reviewId);
    if (!review) return;

    // Create modal
    let modal = document.getElementById('replyModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'replyModal';
      modal.className = 'reply-modal';
      modal.innerHTML = `
        <div class="reply-modal-content">
          <div class="reply-modal-header">
            <h3>Responder Reseña</h3>
            <button class="reply-modal-close" onclick="closeReplyPanel()">✕</button>
          </div>
          <div class="reply-modal-body">
            <textarea id="replyText" class="reply-textarea" placeholder="Escribe tu respuesta (máximo 500 caracteres)..." maxlength="500"></textarea>
            <div class="reply-char-count">
              <span id="replyCharCount">0</span>/500
            </div>
          </div>
          <div class="reply-modal-footer">
            <button class="reply-modal-cancel" onclick="closeReplyPanel()">Cancelar</button>
            <button class="reply-modal-submit" onclick="submitReply('${reviewId}')">Responder</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Character counter
      const textarea = modal.querySelector('#replyText');
      const counter = modal.querySelector('#replyCharCount');
      textarea.addEventListener('input', () => {
        counter.textContent = textarea.value.length;
      });
    } else {
      document.getElementById('replyText').value = review.reply?.text || '';
      const counter = document.getElementById('replyCharCount');
      counter.textContent = review.reply?.text?.length || 0;
      // BUG FIX #4: actualizar el onclick para que apunte a la reseña correcta
      modal.querySelector('.reply-modal-submit').setAttribute('onclick', `submitReply('${reviewId}')`);
    }

    modal.style.display = 'flex';
    document.getElementById('replyText').focus();
  };

  // Close reply panel
  window.closeReplyPanel = () => {
    const modal = document.getElementById('replyModal');
    if (!modal) return;
    modal.classList.add('is-closing');
    setTimeout(() => {
      modal.classList.remove('is-closing');
      modal.style.display = 'none';
      document.getElementById('replyText').value = '';
      document.getElementById('replyCharCount').textContent = '0';
    }, 240);
  };

  // Submit reply
  window.submitReply = async (reviewId) => {
    if (!state.isAdmin) return;

    const textarea = document.getElementById('replyText');
    const text = textarea.value.trim();

    if (!text) {
      alert('La respuesta no puede estar vacía');
      return;
    }

    if (text.length > 500) {
      alert('La respuesta no puede exceder 500 caracteres');
      return;
    }

    try {
      const response = await fetch(`/api/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': state.adminPassword
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar respuesta');
      }

      closeReplyPanel();
      await loadReviews();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Delete reply
  window.deleteReply = async (reviewId) => {
    if (!state.isAdmin || !confirm('¿Eliminar esta respuesta?')) return;

    try {
      const response = await fetch(`/api/reviews/${reviewId}/reply`, {
        method: 'DELETE',
        headers: { 'x-admin-password': state.adminPassword }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar respuesta');
      }

      await loadReviews();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Load on startup (for badge)
  loadReviews();
}
