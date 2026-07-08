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

// El id de Meta identifica de forma estable un mismo anuncio a través de
// semanas distintas — se usa para detectar altas/bajas comparando extracciones.
function adId(url) {
  if (!url) return null;
  const match = url.match(/[?&]id=([^&]+)/);
  return match ? match[1] : null;
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
// inicio) y marca como "nuevo" el que empezó a correr después de la última
// comprobación (fecha_inicio posterior a la extracción anterior) — es la
// única definición de "nuevo" en toda la web, para que el KPI y el filtro
// siempre coincidan en el mismo número.
function getWeekAds() {
  const weekAds = rawAds.filter(a => weekKey(a.fechaExtraccion) === selectedWeek);

  const weeks = getAvailableWeeks();
  const idx = weeks.indexOf(selectedWeek);
  const prevWeek = idx > -1 && idx < weeks.length - 1 ? weeks[idx + 1] : null;

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
    isNew: prevWeek ? !!(a.fechaInicio && weekKey(a.fechaInicio) > prevWeek) : false,
  }));
}

// Total de anuncios activos por cada extracción semanal, ordenado de más
// antigua a más reciente — es la serie que alimenta el gráfico de evolución.
function getWeeklyTotals() {
  return getAvailableWeeks()
    .slice()
    .reverse()
    .map(w => ({
      week: w,
      date: new Date(w),
      total: rawAds.filter(a => weekKey(a.fechaExtraccion) === w).length,
    }));
}

// Ids de anuncios que estaban activos la semana anterior a la seleccionada
// y ya no aparecen en la seleccionada — misma lógica que "nuevos" pero a la
// inversa, comparando por id de Meta en vez de por fecha_inicio.
function getBajasIds() {
  const weeks = getAvailableWeeks();
  const idx = weeks.indexOf(selectedWeek);
  if (idx < 0 || idx >= weeks.length - 1) return [];

  const prevWeek = weeks[idx + 1];
  const idsOf = w => new Set(
    rawAds.filter(a => weekKey(a.fechaExtraccion) === w).map(a => adId(a.url)).filter(Boolean)
  );
  const prevIds = idsOf(prevWeek);
  const currentIds = idsOf(selectedWeek);

  return [...prevIds].filter(id => !currentIds.has(id));
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function renderAll() {
  renderKpis();
  renderTrendChart();
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
  const kpiNuevos = document.getElementById('kpiNuevos');
  const kpiBajas = document.getElementById('kpiBajas');
  if (idx > -1 && idx < weeks.length - 1) {
    const nuevos = weekAds.filter(a => a.isNew).length;
    kpiNuevos.textContent = nuevos;
    kpiBajas.textContent = getBajasIds().length;
  } else {
    kpiNuevos.textContent = '—';
    kpiBajas.textContent = '—';
  }
}

// ---------------------------------------------------------------------------
// Gráfico de evolución semanal (SVG, sin librerías)
// ---------------------------------------------------------------------------
function renderTrendChart() {
  const card = document.getElementById('trendCard');
  const wrap = document.getElementById('trendChartWrap');
  const svg = document.getElementById('trendChart');
  const totals = getWeeklyTotals();

  if (totals.length < 2) {
    card.hidden = true;
    return;
  }
  card.hidden = false;

  const width = wrap.clientWidth;
  const height = 200;
  const pad = { top: 26, right: 16, bottom: 26, left: 16 };
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const values = totals.map(t => t.total);
  const maxV = Math.max(...values);
  const minV = Math.min(...values);
  const range = maxV - minV || 1;
  const xLeft = pad.left;
  const xRight = width - pad.right;
  const yTop = pad.top;
  const yBottom = height - pad.bottom;

  const xFor = i => totals.length === 1 ? (xLeft + xRight) / 2 : xLeft + (i / (totals.length - 1)) * (xRight - xLeft);
  const yFor = v => yBottom - ((v - minV) / range) * (yBottom - yTop);
  const points = totals.map((t, i) => [xFor(i), yFor(t.total)]);

  const gridValues = [...new Set([minV, maxV])];
  const gridLines = gridValues.map(v => `
    <line x1="${xLeft}" y1="${yFor(v).toFixed(1)}" x2="${xRight}" y2="${yFor(v).toFixed(1)}" stroke="var(--border)" stroke-width="1" />
    <text x="${xLeft}" y="${(yFor(v) - 6).toFixed(1)}" font-size="11" fill="var(--muted)">${v}</text>
  `).join('');

  const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${yBottom} L${points[0][0].toFixed(1)},${yBottom} Z`;

  const dots = points.map(([x, y], i) => `
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="var(--blue)" stroke="#fff" stroke-width="2" />
  `).join('');

  const xLabels = totals.map((t, i) => `
    <text x="${xFor(i).toFixed(1)}" y="${height - 6}" font-size="11" fill="var(--muted)" text-anchor="middle">${formatDate(t.date).replace(/ de \d{4}$/, '')}</text>
  `).join('');

  const last = points[points.length - 1];
  const endLabel = `<text x="${last[0].toFixed(1)}" y="${(last[1] - 12).toFixed(1)}" font-size="12" font-weight="700" fill="var(--navy)" text-anchor="middle">${totals[totals.length - 1].total}</text>`;

  svg.innerHTML = `
    ${gridLines}
    <path d="${areaPath}" fill="var(--blue)" fill-opacity="0.1" stroke="none" />
    <path d="${linePath}" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    ${dots}
    ${xLabels}
    ${endLabel}
    <line id="trendCrosshair" x1="0" y1="${yTop}" x2="0" y2="${yBottom}" stroke="var(--navy)" stroke-width="1" opacity="0" />
  `;

  setupTrendHover(svg, wrap, totals, points);
}

function setupTrendHover(svg, wrap, totals, points) {
  const tooltip = document.getElementById('trendTooltip');
  const tooltipValue = document.getElementById('trendTooltipValue');
  const tooltipLabel = document.getElementById('trendTooltipLabel');
  const crosshair = document.getElementById('trendCrosshair');

  svg.onpointermove = (evt) => {
    const rect = svg.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    let nearest = 0;
    let minDist = Infinity;
    points.forEach(([px], i) => {
      const d = Math.abs(px - x);
      if (d < minDist) { minDist = d; nearest = i; }
    });

    const [px, py] = points[nearest];
    crosshair.setAttribute('x1', px);
    crosshair.setAttribute('x2', px);
    crosshair.setAttribute('opacity', '1');

    tooltipValue.textContent = `${totals[nearest].total} anuncios activos`;
    tooltipLabel.textContent = formatDate(totals[nearest].date);
    tooltip.hidden = false;

    const wrapWidth = wrap.clientWidth;
    tooltip.style.left = Math.min(Math.max(px - 60, 0), wrapWidth - 140) + 'px';
    tooltip.style.top = Math.max(py - 14, 0) + 'px';
  };

  svg.onpointerleave = () => {
    crosshair.setAttribute('opacity', '0');
    tooltip.hidden = true;
  };
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
document.getElementById('exportPdfBtn').addEventListener('click', () => window.print());
document.getElementById('weekSelect').addEventListener('change', (e) => {
  selectedWeek = e.target.value;
  activeResidencia = 'all';
  renderAll();
});

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderTrendChart, 150);
});

loadData();
setInterval(loadData, CONFIG.AUTO_REFRESH_MS);
