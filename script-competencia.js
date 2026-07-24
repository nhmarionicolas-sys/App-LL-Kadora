(function () {
// ---------------------------------------------------------------------------
// Configuración: endpoint del Apps Script Web App de Competencia (proyecto
// separado del de Kadora, ver CLAUDE.md). Agrega los anuncios de todas las
// pestañas semanales del Sheet de Competencia en un único JSON. Todo este
// archivo va envuelto en un IIFE para no chocar con los nombres globales
// (CONFIG, rawAds, normalize...) que ya usa script.js en la misma página.
// ---------------------------------------------------------------------------
const CONFIG = {
  DATA_URL: 'https://script.google.com/macros/s/AKfycbyujZIz-ozW1IpsbKG68SGZbHVuh5uyrpQQfXOKD3jOJlfKkUmhVQP09toaepvmit4X/exec',
  PRICING_URL: 'precios-competencia.json',
  AUTO_REFRESH_MS: 5 * 60 * 1000,
};

const CIUDADES = ['Granada', 'Sevilla', 'Barcelona', 'Zaragoza', 'Portugal'];

const COMPETIDOR_COLORS = {
  'xior granada': '#2a9d8f',
  'livensa fuentenueva': '#307FE2',
  'livensa living cartuja': '#9c5fd6',
};
const FALLBACK_PALETTE = ['#d1495b', '#118ab2', '#ef8354', '#2ec4b6', '#ff6b6b', '#7048e8'];

let rawAds = [];
let pricingData = {};
let activeCiudad = 'Granada';
let activeCompetidor = 'all';
let selectedWeek = null;
let availableWeeks = [];

const DIACRITICS_RE = /[\u0300-\u036f]/g;

function normalize(str) {
  return (str || '').normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase().trim();
}

function competidorColor(nombre) {
  const key = normalize(nombre);
  if (COMPETIDOR_COLORS[key]) return COMPETIDOR_COLORS[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(date) {
  if (!date) return '—';
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonthYear(value) {
  const d = parseDate(value);
  if (!d) return '';
  return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
}

// Misma función que usa script.js de Kadora para su desplegable de semana.
function weekKey(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Tarifas: datos que Mario copia a mano del Excel de precios de la jefa (sin
// acceso de edición al original), en un JSON aparte del pipeline de anuncios
// porque cambian por meses, no por semanas, y no vienen de la Ad Library.
// ---------------------------------------------------------------------------
async function loadPricing() {
  try {
    const res = await fetch(CONFIG.PRICING_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    pricingData = await res.json();
  } catch (err) {
    console.error(err);
    pricingData = {};
  }
  renderChips();
  renderPricing();
}

// Solo se muestra con un competidor concreto seleccionado (no con "Todos"),
// para no mezclar tarifas de varias residencias en la misma vista.
function renderPricing() {
  const container = document.getElementById('pricingSection');
  if (!container) return;

  if (activeCompetidor === 'all') {
    container.innerHTML = '';
    return;
  }

  const entries = (pricingData[activeCiudad] || []).filter(comp => comp.competidor === activeCompetidor);

  if (!entries.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = entries.map(comp => `
    <article class="pricing-card" style="--accent:${competidorColor(comp.competidor)}">
      <div class="pricing-head">
        <h3>💰 Tarifas · ${escapeHtml(comp.competidor)}</h3>
        <span class="pricing-updated">Actualizado ${formatMonthYear(comp.actualizado)}</span>
      </div>
      ${comp.habitaciones.map(h => `
        <div class="pricing-row">
          <span class="pricing-room">${escapeHtml(h.tipo)}</span>
          <span class="pricing-values">${h.precios.map(p => p.periodo
            ? `<span class="pricing-tier"><b>${p.valor} €</b><small>${escapeHtml(p.periodo)}</small></span>`
            : `<span class="pricing-tier"><b>${p.valor} €/mes</b></span>`
          ).join('')}</span>
        </div>
      `).join('')}
    </article>
  `).join('');
}

// ---------------------------------------------------------------------------
// Carga y transformación de datos
// ---------------------------------------------------------------------------
async function loadData() {
  setSyncStatus('loading', 'Sincronizando con el Sheet…');
  if (!rawAds.length) renderSkeletonCards();
  try {
    const res = await fetch(CONFIG.DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const items = Array.isArray(json.data) ? json.data : [];
    const semanas = Array.isArray(json.semanas) ? json.semanas : [];

    rawAds = items
      .filter(item => item.texto && String(item.texto).trim())
      .map(item => ({
        fechaExtraccion: parseDate(item.fecha_extraccion),
        ciudad: (item.ciudad || 'General').trim(),
        competidor: (item.competidor || 'Desconocido').trim(),
        texto: String(item.texto).trim(),
        fechaInicio: parseDate(item.fecha_inicio),
        url: item.url || null,
      }));

    // Las semanas disponibles salen de "semanas" (cada pestaña del Sheet,
    // tenga o no anuncios) y no solo de las fechas de los anuncios de
    // rawAds -- si no, una semana con 0 anuncios de la competencia no
    // dejaría ninguna fila en "data" y desaparecería del desplegable,
    // dejando la web anclada en la última semana que sí tuvo anuncios.
    const weekSet = new Set(semanas.map(s => weekKey(parseDate(s))).filter(Boolean));
    rawAds.forEach(a => { const k = weekKey(a.fechaExtraccion); if (k) weekSet.add(k); });
    availableWeeks = [...weekSet].sort().reverse();

    populateWeekSelect();

    const masReciente = availableWeeks.length ? parseDate(availableWeeks[0]) : null;
    setSyncStatus('ok', masReciente ? `Datos actualizados el ${formatDate(masReciente)}` : 'Sincronizado');

    renderCityTabs();
    renderAll();
  } catch (err) {
    console.error(err);
    setSyncStatus('err', 'No se pudo conectar con el origen de datos. Reintentando…');
  }
}

function setSyncStatus(state, label) {
  const dot = document.getElementById('syncDotComp');
  const text = document.getElementById('syncLabelComp');
  dot.className = 'sync-dot' + (state === 'ok' ? ' ok' : state === 'err' ? ' err' : '');
  text.textContent = label;
}

function populateWeekSelect() {
  const select = document.getElementById('weekSelectComp');
  if (!select) return;
  if (!availableWeeks.length) { select.innerHTML = ''; return; }

  if (!selectedWeek || !availableWeeks.includes(selectedWeek)) selectedWeek = availableWeeks[0];

  select.innerHTML = availableWeeks.map((w, idx) => {
    const label = formatDate(new Date(w)) + (idx === 0 ? ' (más reciente)' : '');
    return `<option value="${w}" ${w === selectedWeek ? 'selected' : ''}>${label}</option>`;
  }).join('');
}

// Anuncios de la semana elegida en el desplegable (puede ser un array
// vacío si esa semana no tuvo ningún anuncio de la competencia).
function getSelectedWeekAds() {
  if (!selectedWeek) return [];
  return rawAds.filter(a => a.fechaExtraccion && weekKey(a.fechaExtraccion) === selectedWeek);
}

function renderCityTabs() {
  const container = document.getElementById('cityTabs');
  const disponibles = new Set(rawAds.map(a => a.ciudad));

  container.innerHTML = CIUDADES.map(ciudad => {
    const tieneDatos = disponibles.has(ciudad);
    const activa = ciudad === activeCiudad;
    return `<button class="city-tab ${activa ? 'active' : ''} ${tieneDatos ? '' : 'disabled'}" data-ciudad="${ciudad}" ${tieneDatos ? '' : 'disabled'}>
      ${ciudad}${tieneDatos ? '' : ' (próximamente)'}
    </button>`;
  }).join('');

  container.querySelectorAll('.city-tab:not(.disabled)').forEach(tab => {
    tab.addEventListener('click', () => {
      activeCiudad = tab.dataset.ciudad;
      activeCompetidor = 'all';
      renderCityTabs();
      renderAll();
    });
  });
}

function renderAll() {
  renderKpis();
  renderPricing();
  renderChips();
  renderCards();
}

function getCityAds() {
  return getSelectedWeekAds().filter(a => a.ciudad === activeCiudad);
}

function renderKpis() {
  const ads = getCityAds();
  const competidores = new Set(ads.map(a => a.competidor));
  const masReciente = ads.reduce((max, a) => (a.fechaInicio && (!max || a.fechaInicio > max) ? a.fechaInicio : max), null);

  const referencia = ads.reduce((max, a) => (a.fechaExtraccion && (!max || a.fechaExtraccion > max) ? a.fechaExtraccion : max), null);
  const validos = ads.filter(a => a.fechaInicio);
  const antiguedad = (referencia && validos.length)
    ? Math.round(validos.reduce((sum, a) => sum + Math.max(0, Math.round((referencia - a.fechaInicio) / 86400000)), 0) / validos.length)
    : null;

  const counts = {};
  ads.forEach(a => { counts[a.competidor] = (counts[a.competidor] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('kpiTotalComp').textContent = ads.length;
  document.getElementById('kpiCompetidores').textContent = competidores.size;
  document.getElementById('kpiRecienteComp').textContent = formatDate(masReciente);
  document.getElementById('kpiTopComp').textContent = top ? `${top[0]} (${top[1]})` : '—';
  document.getElementById('kpiAntiguedadComp').textContent = antiguedad !== null ? `${antiguedad} días` : '—';
}

function renderChips() {
  const container = document.getElementById('competidorChips');
  const ads = getCityAds();
  // Incluye también competidores que solo tienen tarifas y ningún anuncio
  // activo todavía (como Livensa ahora mismo) — si no, su chip nunca
  // aparecería y no habría forma de pinchar para ver su tarjeta de precios.
  const pricingCompetidores = (pricingData[activeCiudad] || []).map(c => c.competidor);
  const competidores = [...new Set([...ads.map(a => a.competidor), ...pricingCompetidores])].sort();

  const chipsHtml = [`<button class="chip ${activeCompetidor === 'all' ? 'active' : ''}" data-competidor="all">
      <span class="dot"></span>Todos (${ads.length})
    </button>`];

  competidores.forEach(comp => {
    const count = ads.filter(a => a.competidor === comp).length;
    const color = competidorColor(comp);
    chipsHtml.push(`<button class="chip ${activeCompetidor === comp ? 'active' : ''}" data-competidor="${comp}" style="--accent:${color}">
        <span class="dot"></span>${comp} (${count})
      </button>`);
  });

  container.innerHTML = chipsHtml.join('');
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      activeCompetidor = chip.dataset.competidor;
      renderChips();
      renderPricing();
      renderCards();
    });
  });
}

function getFilteredAds() {
  const search = normalize(document.getElementById('searchInputComp').value);
  return getCityAds().filter(a => {
    const matchesCompetidor = activeCompetidor === 'all' || a.competidor === activeCompetidor;
    const matchesSearch = !search || normalize(a.texto).includes(search);
    return matchesCompetidor && matchesSearch;
  }).sort((a, b) => (b.fechaInicio || 0) - (a.fechaInicio || 0));
}

function renderSkeletonCards(count = 3) {
  const grid = document.getElementById('cardsGridComp');
  document.getElementById('emptyStateComp').hidden = true;
  grid.innerHTML = Array.from({ length: count }, () => `
    <article class="card skeleton-card">
      <div class="card-top">
        <div class="skeleton skeleton-badge"></div>
      </div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line short"></div>
      <div class="skeleton skeleton-line shorter"></div>
      <div class="skeleton-bottom">
        <div class="skeleton skeleton-line short" style="height:22px; width:60%;"></div>
        <div class="skeleton skeleton-pill"></div>
      </div>
    </article>
  `).join('');
}

function renderCards() {
  const grid = document.getElementById('cardsGridComp');
  const empty = document.getElementById('emptyStateComp');
  const ads = getFilteredAds();

  if (!ads.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = ads.map((ad, idx) => {
    const color = competidorColor(ad.competidor);
    return `
      <article class="card" style="--accent:${color}">
        <div class="card-top">
          <span class="badge">${escapeHtml(ad.competidor)}</span>
        </div>
        <p class="card-text" id="text-comp-${idx}">${escapeHtml(ad.texto)}</p>
        <button class="card-more" data-target="text-comp-${idx}">Ver más</button>
        <div class="card-bottom">
          <div class="card-dates">
            <strong>Activo desde:</strong> ${formatDate(ad.fechaInicio)}<br>
            <strong>Última detección:</strong> ${formatDate(ad.fechaExtraccion)}
          </div>
          ${ad.url
            ? `<a class="card-link" href="${ad.url}" target="_blank" rel="noopener noreferrer">Ver anuncio</a>`
            : `<span class="card-link disabled">Sin enlace</span>`}
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.card-more').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.target);
      el.classList.toggle('expanded');
      btn.textContent = el.classList.contains('expanded') ? 'Ver menos' : 'Ver más';
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
document.getElementById('searchInputComp').addEventListener('input', renderCards);
document.getElementById('refreshBtnComp').addEventListener('click', loadData);
document.getElementById('exportPdfBtnComp').addEventListener('click', () => window.print());
document.getElementById('weekSelectComp').addEventListener('change', (e) => {
  selectedWeek = e.target.value;
  activeCompetidor = 'all';
  renderCityTabs();
  renderAll();
});

loadData();
loadPricing();
setInterval(loadData, CONFIG.AUTO_REFRESH_MS);

})();
