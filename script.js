// ---------------------------------------------------------------------------
// Configuración: endpoint del Apps Script Web App (función doGet), que agrega
// los anuncios de todas las pestañas semanales del Sheet en un único JSON.
// ---------------------------------------------------------------------------
const CONFIG = {
  DATA_URL: 'https://script.google.com/macros/s/AKfycbyo1RZpEf9csEmcrxpLDIKumlYqb7stqULRzwxuEfPLwJ0Y00j3hsy1vJgTYKFla8ZQ/exec',
  AUTO_REFRESH_MS: 5 * 60 * 1000,
};

const RESIDENCIA_COLORS = {
  granada: '#279989',
  barcelona: '#E56A54',
  general: '#6b7385',
  sevilla: '#307FE2',
  zaragoza: '#9c5fd6',
  madrid: '#c2185b',
  valencia: '#0C2340',
};
const FALLBACK_PALETTE = ['#d1495b', '#118ab2', '#ef8354', '#2ec4b6', '#ff6b6b', '#7048e8'];

const PIN_ICON = `<svg class="badge-icon" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.86 2 4.5 5.36 4.5 9.5c0 5.25 6.19 11.62 6.46 11.89a1.4 1.4 0 0 0 2.08 0c.27-.27 6.46-6.64 6.46-11.89C19.5 5.36 16.14 2 12 2zm0 10.25a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5z"/></svg>`;

let rawAds = [];
let selectedWeek = null;
let activeResidencia = 'all';

function normalize(str) {
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function residenciaColor(residencia) {
  const key = normalize(residencia);
  if (RESIDENCIA_COLORS[key]) return RESIDENCIA_COLORS[key];
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

function weekKey(date) {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

// El ad_snapshot_url que da la API de Meta lleva el access_token incrustado.
// Reconstruimos el enlace público de la Biblioteca de Anuncios solo con el id,
// para no exponer el token en una web de cara al cliente.
function cleanAdLibraryUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const id = new URL(rawUrl).searchParams.get('id');
    return id ? `https://www.facebook.com/ads/library/?id=${id}` : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Carga y transformación de datos
// ---------------------------------------------------------------------------
async function loadData() {
  setSyncStatus('loading', 'Sincronizando con el Sheet…');
  try {
    const res = await fetch(CONFIG.DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const items = Array.isArray(json.data) ? json.data : [];

    rawAds = items
      .filter(item => item.texto && String(item.texto).trim())
      .map(item => ({
        fechaExtraccion: parseDate(item.fecha_extraccion),
        residencia: (item.residencia || 'General').trim(),
        texto: String(item.texto).trim(),
        fechaInicio: parseDate(item.fecha_inicio),
        url: cleanAdLibraryUrl(item.url),
      }));

    const masReciente = rawAds.reduce((max, a) => (a.fechaExtraccion && (!max || a.fechaExtraccion > max) ? a.fechaExtraccion : max), null);
    setSyncStatus('ok', masReciente ? `Datos actualizados el ${formatDate(masReciente)}` : 'Sincronizado');

    populateWeekSelect();
    renderAll();
  } catch (err) {
    console.error(err);
    setSyncStatus('err', 'No se pudo conectar con el origen de datos. Reintentando…');
  }
}

function setSyncStatus(state, label) {
  const dot = document.getElementById('syncDot');
  const text = document.getElementById('syncLabel');
  dot.className = 'sync-dot' + (state === 'ok' ? ' ok' : state === 'err' ? ' err' : '');
  text.textContent = label;
}

// ---------------------------------------------------------------------------
// Semanas disponibles (cada pestaña del Sheet = una extracción semanal)
// ---------------------------------------------------------------------------
function getAvailableWeeks() {
  const weeks = new Set(rawAds.map(a => weekKey(a.fechaExtraccion)).filter(Boolean));
  return [...weeks].sort().reverse();
}

function populateWeekSelect() {
  const select = document.getElementById('weekSelect');
  const weeks = getAvailableWeeks();
  if (!weeks.length) return;

  if (!selectedWeek || !weeks.includes(selectedWeek)) selectedWeek = weeks[0];

  select.innerHTML = weeks.map((w, idx) => {
    const label = formatDate(new Date(w)) + (idx === 0 ? ' (más reciente)' : '');
    return `<option value="${w}" ${w === selectedWeek ? 'selected' : ''}>${label}</option>`;
  }).join('');
}

function contentKey(ad) {
  return normalize(ad.residencia) + '|' + normalize(ad.texto);
}

// Numera cada anuncio dentro de su residencia (orden estable por fecha de
// inicio) y marca si su texto no aparecía en la semana anterior disponible.
function getWeekAds() {
  const weekAds = rawAds.filter(a => weekKey(a.fechaExtraccion) === selectedWeek);

  const weeks = getAvailableWeeks();
  const idx = weeks.indexOf(selectedWeek);
  const prevWeek = idx > -1 && idx < weeks.length - 1 ? weeks[idx + 1] : null;
  const prevKeys = new Set(
    rawAds.filter(a => weekKey(a.fechaExtraccion) === prevWeek).map(contentKey)
  );

  const ordenado = [...weekAds].sort((a, b) => (a.fechaInicio || 0) - (b.fechaInicio || 0));
  const contadores = {};
  const numeroPorAd = new Map();
  ordenado.forEach(a => {
    const n = (contadores[a.residencia] || 0) + 1;
    contadores[a.residencia] = n;
    numeroPorAd.set(a, n);
  });

  return weekAds.map(a => ({
    ...a,
    numero: numeroPorAd.get(a),
    isNew: prevWeek ? !prevKeys.has(contentKey(a)) : false,
  }));
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function renderAll() {
  renderKpis();
  renderChips();
  renderCards();
}

function renderKpis() {
  const weekAds = getWeekAds();
  const weeks = getAvailableWeeks();
  const total = weekAds.length;
  const residencias = new Set(weekAds.map(a => normalize(a.residencia)));
  const masReciente = weekAds.reduce((max, a) => (a.fechaInicio && (!max || a.fechaInicio > max) ? a.fechaInicio : max), null);

  const counts = {};
  weekAds.forEach(a => { counts[a.residencia] = (counts[a.residencia] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('kpiTotal').textContent = total;
  document.getElementById('kpiResidencias').textContent = residencias.size;
  document.getElementById('kpiReciente').textContent = formatDate(masReciente);
  document.getElementById('kpiTop').textContent = top ? `${top[0]} (${top[1]})` : '—';

  const idx = weeks.indexOf(selectedWeek);
  const kpiVariacion = document.getElementById('kpiVariacion');
  const kpiVariacionDetalle = document.getElementById('kpiVariacionDetalle');
  if (idx > -1 && idx < weeks.length - 1) {
    const prevCount = rawAds.filter(a => weekKey(a.fechaExtraccion) === weeks[idx + 1]).length;
    const delta = total - prevCount;
    kpiVariacion.textContent = (delta > 0 ? '+' : '') + delta;
    kpiVariacion.className = 'kpi-value' + (delta > 0 ? ' up' : delta < 0 ? ' down' : '');

    const nuevos = weekAds.filter(a => a.isNew).length;
    const resto = delta - nuevos;
    const partes = [];
    if (nuevos) partes.push(`${nuevos} nuevos`);
    if (resto) partes.push(`${resto > 0 ? '+' : ''}${resto} en anuncios ya existentes`);
    kpiVariacionDetalle.textContent = partes.length ? `(${partes.join(', ')})` : '';
  } else {
    kpiVariacion.textContent = '—';
    kpiVariacion.className = 'kpi-value';
    kpiVariacionDetalle.textContent = '';
  }
}

function renderChips() {
  const container = document.getElementById('residenciaChips');
  const weekAds = getWeekAds();
  const residencias = [...new Set(weekAds.map(a => a.residencia))].sort();

  const chipsHtml = [`<button class="chip ${activeResidencia === 'all' ? 'active' : ''}" data-residencia="all">
      <span class="dot"></span>Todas (${weekAds.length})
    </button>`];

  residencias.forEach(res => {
    const count = weekAds.filter(a => a.residencia === res).length;
    const color = residenciaColor(res);
    chipsHtml.push(`<button class="chip ${activeResidencia === res ? 'active' : ''}" data-residencia="${res}" style="--accent:${color}">
        <span class="dot"></span>${res} (${count})
      </button>`);
  });

  container.innerHTML = chipsHtml.join('');
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      activeResidencia = chip.dataset.residencia;
      renderChips();
      renderCards();
    });
  });
}

function getFilteredAds() {
  const search = normalize(document.getElementById('searchInput').value);
  const newOnly = document.getElementById('newOnlyToggle').checked;
  let ads = getWeekAds().filter(a => {
    const matchesResidencia = activeResidencia === 'all' || a.residencia === activeResidencia;
    const matchesSearch = !search || normalize(a.texto).includes(search);
    const matchesNew = !newOnly || a.isNew;
    return matchesResidencia && matchesSearch && matchesNew;
  });

  const grouped = document.getElementById('groupToggle').checked;
  if (grouped) {
    const groups = new Map();
    ads.forEach(a => {
      const key = contentKey(a);
      if (!groups.has(key)) {
        groups.set(key, { ...a, count: 1, urls: a.url ? [a.url] : [null] });
      } else {
        const g = groups.get(key);
        g.count += 1;
        g.urls.push(a.url || null);
        if (a.fechaInicio && (!g.fechaInicio || a.fechaInicio < g.fechaInicio)) g.fechaInicio = a.fechaInicio;
        if (a.fechaExtraccion && (!g.fechaExtraccion || a.fechaExtraccion > g.fechaExtraccion)) g.fechaExtraccion = a.fechaExtraccion;
      }
    });
    ads = [...groups.values()];
  } else {
    ads = ads.map(a => ({ ...a, count: 1, urls: [a.url] }));
  }

  const sort = document.getElementById('sortSelect').value;
  ads.sort((a, b) => {
    if (sort === 'recent') return (b.fechaInicio || 0) - (a.fechaInicio || 0);
    if (sort === 'old') return (a.fechaInicio || 0) - (b.fechaInicio || 0);
    if (sort === 'residencia') return a.residencia.localeCompare(b.residencia);
    return 0;
  });

  return ads;
}

function renderCards() {
  const grid = document.getElementById('cardsGrid');
  const empty = document.getElementById('emptyState');
  const ads = getFilteredAds();

  if (!ads.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = ads.map((ad, idx) => {
    const color = residenciaColor(ad.residencia);
    const countBadge = ad.count > 1 ? `<span class="dup-count">${ad.count} anuncios activos</span>` : '';
    const adNumber = ad.count === 1 ? `<span class="ad-number">Anuncio ${ad.numero}</span>` : '';
    const newBadge = ad.isNew ? `<span class="new-badge">🆕 Nuevo</span>` : '';

    const linkSection = ad.count > 1
      ? `<div class="group-links">${ad.urls.map((u, i) => u
          ? `<a class="group-link" href="${u}" target="_blank" rel="noopener noreferrer">Anuncio ${i + 1}</a>`
          : `<span class="group-link disabled">Anuncio ${i + 1}</span>`
        ).join('')}</div>`
      : (ad.url
          ? `<a class="card-link" href="${ad.url}" target="_blank" rel="noopener noreferrer">Ver anuncio</a>`
          : `<span class="card-link disabled">Sin enlace</span>`);

    return `
      <article class="card">
        <div class="card-top">
          <span class="badge" style="--accent:${color}">${PIN_ICON}${ad.residencia}</span>
          ${adNumber}
          <div class="card-top-right">${newBadge}${countBadge}</div>
        </div>
        <p class="card-text" id="text-${idx}">${escapeHtml(ad.texto)}</p>
        <button class="card-more" data-target="text-${idx}">Ver más</button>
        <div class="card-bottom">
          <div class="card-dates">
            <strong>Activo desde:</strong> ${formatDate(ad.fechaInicio)}<br>
            <strong>Última detección:</strong> ${formatDate(ad.fechaExtraccion)}
          </div>
          ${ad.count === 1 ? linkSection : ''}
        </div>
        ${ad.count > 1 ? linkSection : ''}
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
document.getElementById('searchInput').addEventListener('input', renderCards);
document.getElementById('sortSelect').addEventListener('change', renderCards);
document.getElementById('groupToggle').addEventListener('change', renderCards);
document.getElementById('newOnlyToggle').addEventListener('change', renderCards);
document.getElementById('refreshBtn').addEventListener('click', loadData);
document.getElementById('weekSelect').addEventListener('change', (e) => {
  selectedWeek = e.target.value;
  activeResidencia = 'all';
  renderAll();
});

loadData();
setInterval(loadData, CONFIG.AUTO_REFRESH_MS);
