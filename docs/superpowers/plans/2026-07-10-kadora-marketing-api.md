# Migración de Anuncios KADORA a Marketing API — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la fuente de datos de la pestaña "Anuncios KADORA" (Ad Library + cruce por texto) por Marketing API pura, para que la imagen y el enlace de cada anuncio sean siempre los del anuncio real.

**Architecture:** El Apps Script (`Code.gs`, fuera de este repo) se reescribe para leer directamente de Marketing API, una cuenta publicitaria a la vez, escribiendo `id`/`residencia`/`texto`/`fecha`/`url`/`imagen` en la pestaña semanal del Sheet. `doGet()` expone `id` explícito en el JSON. `script.js` deja de derivar el id desde la URL (`adId()`) y lo lee directo del JSON.

**Tech Stack:** Google Apps Script (V8), Meta Marketing API v25.0, HTML/CSS/JS vanilla sin build.

**Spec:** `docs/superpowers/specs/2026-07-10-kadora-marketing-api-design.md`

## Nota sobre quién ejecuta cada tarea

La Tarea 1 vive en Apps Script, fuera de este repo — no hay forma de ejecutarla ni verificarla mediante herramientas de este entorno. Mario tiene que pegar el código y ejecutarlo a mano en script.google.com. Las Tareas 2-4 sí son ejecutables/verificables directamente (edición de archivos + servidor local).

## Global Constraints

- El `access_token` de Meta (`ADS_READ_TOKEN`) nunca sale del Apps Script — el JSON público solo expone `id`/`residencia`/`texto`/`fecha`/`url`/`imagen`, ninguno con el token incrustado. (spec: "Fuera de alcance" / arquitectura ya documentada en CLAUDE.md)
- **No hacer `git push` de los cambios de `script.js` (Tareas 2 y 3) hasta confirmar que `doGet()` en producción ya devuelve el nuevo formato con `id`.** Evita una ventana en la que el frontend nuevo lea temporalmente el JSON con la forma antigua. Commits locales sí, push solo en la Tarea 4.
- Sin build ni dependencias nuevas — sigue siendo HTML/CSS/JS plano (CLAUDE.md, "Cómo probar cambios").
- El `Code.gs` no vive en este repo — se entrega como archivo completo para pegar a mano en el proyecto Apps Script "Kadora" (memoria: código completo, no fragmentos, y decir en qué proyecto pegarlo).
- Cuentas y mapeo de residencia fijos, confirmados por Mario: `1309925056255281`=Granada, `1060996941437123`=Barcelona, `1674463280079393`=Barcelona, `550388136263110`=Sevilla, `841600361572302`=Zaragoza. La cuenta `655249645959790` se excluye por completo.
- Fallback de texto obligatorio: `"Anuncio en circulación"` si no hay ningún texto extraíble — si no, `script.js` descarta la entrada silenciosamente y el total deja de cuadrar.

---

### Task 1: Reescribir `Code.gs` — Marketing API como única fuente

**Files:**
- Externo (fuera de este repo): `Code.gs` del proyecto Apps Script "Kadora" en script.google.com.

**Interfaces:**
- Produces: pestaña semanal del Sheet con columnas A–H (`fecha_extracción`, `residencia`, `texto`, `fecha_inicio`, "Ver anuncio" [rich text], `id`, `url` plano, `imagen`) y `doGet()` devolviendo `{ data: [{ fecha_extraccion, residencia, texto, fecha_inicio, id, url, imagen }, ...] }` — este JSON es lo que consume la Task 2.

- [x] **Step 1: Escribir el `Code.gs` completo**

```javascript
const AD_ACCOUNTS = {
  '1309925056255281': 'Granada',
  '1060996941437123': 'Barcelona',
  '1674463280079393': 'Barcelona',
  '550388136263110': 'Sevilla',
  '841600361572302': 'Zaragoza',
};

const VERSION = 'v25.0';

function obtenerAnunciosKadora() {
  const props = PropertiesService.getScriptProperties();
  const ADS_READ_TOKEN = props.getProperty('ADS_READ_TOKEN');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fechaNombre = new Date().toLocaleDateString("es-ES").replace(/\//g, "-");
  let sheet = ss.getSheetByName(fechaNombre);
  if (!sheet) {
    sheet = ss.insertSheet(fechaNombre);
  } else {
    sheet.clear();
  }
  sheet.activate();

  sheet.getRange("A1:E1").merge();
  sheet.getRange("A1").setValue("KADORA — Monitor de Anuncios Activos Meta");
  sheet.getRange("A1").setFontSize(14).setFontWeight("bold").setFontColor("#FFFFFF")
    .setBackground("#1a1a2e").setHorizontalAlignment("center");
  sheet.setRowHeight(1, 40);

  sheet.getRange("A2:E2").merge();
  sheet.getRange("A2").setValue("Última actualización: " + new Date().toLocaleString("es-ES"));
  sheet.getRange("A2").setFontSize(10).setFontColor("#666666")
    .setBackground("#f5f5f5").setHorizontalAlignment("center").setFontStyle("italic");
  sheet.setRowHeight(2, 25);

  sheet.setRowHeight(3, 10);

  const cabeceras = ["Fecha extracción", "Residencia", "Texto anuncio", "Fecha inicio", "Ver anuncio"];
  const rangoCabeceras = sheet.getRange("A4:E4");
  rangoCabeceras.setValues([cabeceras]);
  rangoCabeceras.setFontWeight("bold").setFontColor("#FFFFFF")
    .setBackground("#16213e").setHorizontalAlignment("center");
  sheet.setRowHeight(4, 30);

  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 130);
  sheet.setColumnWidth(3, 450);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 130);

  const fechaHoy = new Date().toLocaleDateString("es-ES");
  let fila = 5;
  let totalAnuncios = 0;
  let conImagen = 0;

  Object.keys(AD_ACCOUNTS).forEach(accountId => {
    const residencia = AD_ACCOUNTS[accountId];
    let anuncios = [];
    try {
      anuncios = obtenerAnunciosDeCuenta(accountId, ADS_READ_TOKEN);
    } catch (e) {
      Logger.log("Excepción leyendo cuenta " + accountId + ": " + e);
    }
    Logger.log("Cuenta " + accountId + " (" + residencia + "): " + anuncios.length + " anuncios activos");

    anuncios.forEach(anuncio => {
      const colorFondo = fila % 2 === 0 ? "#f0f4ff" : "#ffffff";
      const colorResidencia = colorPorResidencia(residencia);

      const rango = sheet.getRange(fila, 1, 1, 4);
      rango.setValues([[fechaHoy, residencia, anuncio.texto, anuncio.fechaInicio]]);
      rango.setBackground(colorFondo).setVerticalAlignment("middle");
      sheet.setRowHeight(fila, 60);

      sheet.getRange(fila, 2).setBackground(colorResidencia).setFontWeight("bold").setFontColor("#ffffff").setHorizontalAlignment("center");

      const richText = SpreadsheetApp.newRichTextValue()
        .setText("Ver anuncio")
        .setLinkUrl(anuncio.url)
        .build();
      sheet.getRange(fila, 5).setRichTextValue(richText);
      sheet.getRange(fila, 5).setFontColor("#1a73e8").setHorizontalAlignment("center").setBackground(colorFondo);

      sheet.getRange(fila, 3).setWrap(true).setFontSize(9);

      sheet.getRange(fila, 6).setValue(anuncio.id);
      sheet.getRange(fila, 7).setValue(anuncio.url);
      sheet.getRange(fila, 8).setValue(anuncio.imagen || "");

      totalAnuncios++;
      if (anuncio.imagen) conImagen++;
      fila++;
    });
  });

  if (fila > 5) {
    sheet.getRange(4, 1, fila - 4, 5).setBorder(true, true, true, true, true, true, "#cccccc", SpreadsheetApp.BorderStyle.SOLID);
  }

  Logger.log("TOTAL anuncios: " + totalAnuncios + " | Con imagen: " + conImagen);
}

function obtenerAnunciosDeCuenta(accountId, adsReadToken) {
  const resultado = [];
  const ahoraUtc = new Date();

  const fields = 'created_time,effective_status,campaign{status,stop_time},adset{status,end_time},' +
    'creative{body,image_url,thumbnail_url,effective_object_story_id,' +
    'object_story_spec{link_data{message,picture,child_attachments{picture}},video_data{message,image_url}},' +
    'asset_feed_spec{bodies,images{url}}}';

  let nextUrl = 'https://graph.facebook.com/' + VERSION + '/act_' + accountId + '/ads' +
    '?access_token=' + adsReadToken +
    '&effective_status=' + encodeURIComponent(JSON.stringify(["ACTIVE"])) +
    '&fields=' + encodeURIComponent(fields) +
    '&thumbnail_width=600&thumbnail_height=600&limit=200';

  while (nextUrl) {
    const response = UrlFetchApp.fetch(nextUrl, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    if (data.error) {
      Logger.log("Error leyendo cuenta " + accountId + ": " + JSON.stringify(data.error));
      break;
    }

    (data.data || []).forEach(ad => {
      if (!estaRealmenteActivo(ad, ahoraUtc)) return;

      const creative = ad.creative || {};
      resultado.push({
        id: ad.id,
        texto: extraerTexto(creative),
        fechaInicio: ad.created_time ? new Date(ad.created_time) : "",
        imagen: extraerImagenCreativo(creative, adsReadToken),
        url: extraerUrlAnuncio(creative, accountId),
      });
    });

    nextUrl = data.paging && data.paging.next ? data.paging.next : null;
  }

  return resultado;
}

function estaRealmenteActivo(ad, ahoraUtc) {
  if (ad.effective_status !== 'ACTIVE') return false;
  const camp = ad.campaign || {};
  const adset = ad.adset || {};
  if (camp.status !== 'ACTIVE' || adset.status !== 'ACTIVE') return false;
  if (camp.stop_time && new Date(camp.stop_time) < ahoraUtc) return false;
  if (adset.end_time && new Date(adset.end_time) < ahoraUtc) return false;
  return true;
}

function extraerTexto(creative) {
  if (creative.body) return creative.body;
  const spec = creative.object_story_spec || {};
  if (spec.link_data && spec.link_data.message) return spec.link_data.message;
  if (spec.video_data && spec.video_data.message) return spec.video_data.message;
  const feed = creative.asset_feed_spec || {};
  if (Array.isArray(feed.bodies) && feed.bodies[0] && feed.bodies[0].text) return feed.bodies[0].text;
  return "Anuncio en circulación";
}

function extraerImagenCreativo(creative, adsReadToken) {
  if (creative.image_url) return creative.image_url;
  const spec = creative.object_story_spec || {};
  if (spec.video_data && spec.video_data.image_url) return spec.video_data.image_url;
  if (spec.link_data && spec.link_data.picture) return spec.link_data.picture;
  const primeraTarjeta = spec.link_data && spec.link_data.child_attachments && spec.link_data.child_attachments[0];
  if (primeraTarjeta && primeraTarjeta.picture) return primeraTarjeta.picture;
  const feed = creative.asset_feed_spec || {};
  if (Array.isArray(feed.images) && feed.images[0] && feed.images[0].url) return feed.images[0].url;

  if (creative.effective_object_story_id) {
    const imagenPost = obtenerImagenDePost(creative.effective_object_story_id, adsReadToken);
    if (imagenPost) return imagenPost;
  }

  const thumb = creative.thumbnail_url;
  if (thumb && !/p(32|64)x(32|64)/.test(thumb)) return thumb;
  return null;
}

function obtenerImagenDePost(postId, adsReadToken) {
  try {
    const url = 'https://graph.facebook.com/' + VERSION + '/' + postId + '?fields=full_picture&access_token=' + adsReadToken;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    return data.full_picture || null;
  } catch (e) {
    return null;
  }
}

function extraerUrlAnuncio(creative, accountId) {
  if (creative.effective_object_story_id) {
    return "https://www.facebook.com/" + creative.effective_object_story_id;
  }
  const residencia = AD_ACCOUNTS[accountId] || "";
  return "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ES&q=" + encodeURIComponent("Kadora " + residencia);
}

function colorPorResidencia(residencia) {
  const colores = {
    "Zaragoza": "#e63946",
    "Granada": "#2a9d8f",
    "Barcelona": "#e76f51",
    "Sevilla": "#f4a261",
  };
  return colores[residencia] || "#6c757d";
}

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const allData = [];

  sheets.forEach(sheet => {
    const nombre = sheet.getName();
    if (nombre === 'Hoja 1' || nombre === 'Sheet1') return;
    const rows = sheet.getDataRange().getValues();
    if (rows.length < 5) return;
    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      if (!row[2]) continue;

      // Pestañas de antes de esta migración: la columna F llevaba la
      // ad_snapshot_url cruda de Ad Library (con el access_token incrustado),
      // no un id. Se reconoce porque empieza por "http" — en el formato nuevo
      // esa columna es siempre un id numérico de Marketing API. Sin esta
      // rama, el token de esas semanas antiguas se filtraría tal cual en el
      // JSON público.
      const colF = row[5];
      if (typeof colF === 'string' && colF.indexOf('http') === 0) {
        allData.push({
          fecha_extraccion: row[0],
          residencia: row[1],
          texto: row[2],
          fecha_inicio: row[3],
          id: extraerIdDeSnapshotUrl(colF),
          url: limpiarUrlAnuncio(colF),
          imagen: row[6] || null
        });
      } else {
        allData.push({
          fecha_extraccion: row[0],
          residencia: row[1],
          texto: row[2],
          fecha_inicio: row[3],
          id: colF,
          url: row[6] || null,
          imagen: row[7] || null
        });
      }
    }
  });

  return ContentService
    .createTextOutput(JSON.stringify({ data: allData }))
    .setMimeType(ContentService.MimeType.JSON);
}

function extraerIdDeSnapshotUrl(url) {
  const match = String(url).match(/[?&]id=([^&]+)/);
  return match ? match[1] : null;
}

function limpiarUrlAnuncio(url) {
  const id = extraerIdDeSnapshotUrl(url);
  return id ? "https://www.facebook.com/ads/library/?id=" + id : null;
}
```

Respecto al `Code.gs` actual, este archivo **elimina** por completo: `construirIndiceImagenes`, `buscarImagenPorTexto`, `normalizarTexto`, `LONGITUD_MINIMA_CRUCE`, `detectarResidencia`, `buscarCiudad`, `limpiarUrlAnuncio`, y la llamada a `ads_archive` (Ad Library). Ya no se usa `META_ACCESS_TOKEN` ni `PAGE_ID` en este script.

- [x] **Step 2: Pegar en Apps Script**

Mario: abrir [script.google.com](https://script.google.com), proyecto **Kadora** (no el de Competencia), abrir `Code.gs`, seleccionar todo el contenido actual y sustituirlo por el bloque de arriba completo. Guardar (⌘S).

- [x] **Step 3: Ejecutar manualmente y revisar el log**

⚠️ Este paso escribe directamente en el Sheet de producción (crea o sobrescribe la pestaña de hoy). Si prefieres que la jefa no vea un estado a medio probar, hazlo en un momento en que no vaya a abrir el dashboard — no hace falta un Sheet de pruebas aparte para esto.

En el editor de Apps Script: seleccionar `obtenerAnunciosKadora` en el desplegable de funciones, pulsar ▶ Ejecutar. Autorizar permisos si los pide.

Ir a Ver > Registro de ejecución. Se espera algo así (ajustado a datos reales del momento):
```
Cuenta 1309925056255281 (Granada): N anuncios activos
Cuenta 1060996941437123 (Barcelona): N anuncios activos
Cuenta 1674463280079393 (Barcelona): N anuncios activos
Cuenta 550388136263110 (Sevilla): N anuncios activos
Cuenta 841600361572302 (Zaragoza): N anuncios activos
TOTAL anuncios: N | Con imagen: N
```
Si alguna cuenta da 0 anuncios o un error, revisar el mensaje de `Logger.log("Error leyendo cuenta...")` — normalmente es un problema de permisos del token sobre esa cuenta en Ads Manager.

- [x] **Step 4: Revisar la pestaña del Sheet generada**

Abrir el Google Sheet, ir a la pestaña con la fecha de hoy. Comprobar:
- Las 5 residencias aparecen (Granada, Barcelona ×2 cuentas pero mismo texto, Sevilla, Zaragoza) — nada de la cuenta `655249645959790`.
- Columna F tiene un id numérico largo en cada fila (no vacío).
- Columna H tiene una URL de imagen en la mayoría de filas (no en el 100%, hay formatos sin imagen a propósito).
- El link de la columna E ("Ver anuncio") abre un post real de Facebook, no una página de error.

- [x] **Step 5: Publicar nueva versión del Web App**

Importante: guardar el script NO actualiza la URL pública de `doGet()` — hace falta una nueva versión de la implementación. Y es fácil confundir el botón correcto: **no** uses "Implementar > Nueva implementación" (eso crea una URL distinta, nueva, que nada usa todavía). Usa: Implementar > **Administrar implementaciones** > busca la implementación cuya URL empieza por `AKfycbyo1RZpEf9c...` (es la que ya tiene `CONFIG.DATA_URL` en `script.js` y la que lleva usando la web todo este tiempo) > ✏️ editar esa implementación > Versión: Nueva versión > Implementar. La URL no cambia, solo el código que sirve.

Si por error ya creaste una implementación nueva con otra URL (`AKfycbxL...`), no pasa nada — actualízala también con este mismo código (así queda con el fallo de la Task 1 corregido) o simplemente no la uses ni la compartas más; lo importante es que la que usa `script.js` sea la que quede al día.

- [x] **Step 6: Probar el endpoint público**

Abrir en el navegador la URL del Web App (la que ya usa `script.js` en `CONFIG.DATA_URL`). Comprobar que el JSON crudo trae `id`, `residencia`, `url` e `imagen` en las entradas de la pestaña de hoy — y que ningún valor de `url` o `imagen` contiene la cadena `access_token=`.

No hay commit en este repo para esta tarea — nada de esto vive aquí.

---

### Task 2: `script.js` — usar el `id` explícito del JSON

**Files:**
- Modify: `script.js:59-79` (elimina `cleanAdLibraryUrl` y `adId`)
- Modify: `script.js:83-112` (`loadData`)
- Modify: `script.js:185-209` (`getWeekAds`)
- Modify: `script.js:219-232` (`getBajasIds`)
- Modify: `script.js:237-245` (`getBajasAds`)
- Modify: `script.js:311-373` (`buildChartDataset`)

**Interfaces:**
- Consumes: JSON de `doGet()` con `id` explícito por entrada (producido por Task 1).
- Produces: cada objeto de `rawAds` incluye `id` (string o `null`); todas las comparaciones de nuevos/bajas pasan a usar `a.id` en vez de `adId(a.url)`.

- [x] **Step 1: Eliminar `cleanAdLibraryUrl` y `adId`**

En `script.js`, sustituir el bloque entre `weekKey` y el comentario "Carga y transformación de datos" (líneas 59-79):

```javascript
function weekKey(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Carga y transformación de datos
// ---------------------------------------------------------------------------
async function loadData() {
```

(Es decir: desaparecen por completo `cleanAdLibraryUrl`, su comentario sobre el token incrustado, `adId` y su comentario sobre estabilidad del id — ya no aplican, el id ya no se saca de la URL.)

- [x] **Step 2: `loadData` — añadir `id`, simplificar `url`**

Reemplazar la función completa (líneas 83-112 del archivo original):

```javascript
async function loadData() {
  setSyncStatus('loading', 'Sincronizando con el Sheet…');
  if (!rawAds.length) renderSkeletonCards();
  try {
    const res = await fetch(CONFIG.DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const items = Array.isArray(json.data) ? json.data : [];

    rawAds = items
      .filter(item => item.texto && String(item.texto).trim())
      .map(item => ({
        id: item.id || null,
        fechaExtraccion: parseDate(item.fecha_extraccion),
        residencia: (item.residencia || 'General').trim(),
        texto: String(item.texto).trim(),
        fechaInicio: parseDate(item.fecha_inicio),
        url: item.url || null,
        imagen: item.imagen || null,
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
```

- [x] **Step 3: `getWeekAds` — usar `a.id`**

```javascript
function getWeekAds() {
  const weekAds = rawAds.filter(a => weekKey(a.fechaExtraccion) === selectedWeek);

  const weeks = getAvailableWeeks();
  const idx = weeks.indexOf(selectedWeek);
  const prevWeek = idx > -1 && idx < weeks.length - 1 ? weeks[idx + 1] : null;
  const prevIds = prevWeek
    ? new Set(rawAds.filter(a => weekKey(a.fechaExtraccion) === prevWeek).map(a => a.id).filter(Boolean))
    : null;

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
    isNew: prevIds ? !prevIds.has(a.id) : false,
  }));
}
```

- [x] **Step 4: `getBajasIds` y `getBajasAds` — usar `a.id`**

```javascript
function getBajasIds() {
  const weeks = getAvailableWeeks();
  const idx = weeks.indexOf(selectedWeek);
  if (idx < 0 || idx >= weeks.length - 1) return [];

  const prevWeek = weeks[idx + 1];
  const idsOf = w => new Set(
    rawAds.filter(a => weekKey(a.fechaExtraccion) === w).map(a => a.id).filter(Boolean)
  );
  const prevIds = idsOf(prevWeek);
  const currentIds = idsOf(selectedWeek);

  return [...prevIds].filter(id => !currentIds.has(id));
}

function getBajasAds() {
  const weeks = getAvailableWeeks();
  const idx = weeks.indexOf(selectedWeek);
  if (idx < 0 || idx >= weeks.length - 1) return [];

  const prevWeek = weeks[idx + 1];
  const bajaIds = new Set(getBajasIds());
  return rawAds.filter(a => weekKey(a.fechaExtraccion) === prevWeek && bajaIds.has(a.id));
}
```

- [x] **Step 5: `buildChartDataset` — usar `a.id` en las vistas 'nuevos' y 'dia'**

```javascript
function buildChartDataset(view) {
  const weeks = getAvailableWeeks().slice().reverse(); // ascendente: más antigua primero
  const categories = weeks.map(w => formatShort(new Date(w)));

  if (view === 'nuevos') {
    const usable = weeks.slice(1);
    return {
      mode: 'line',
      categories: usable.map(w => formatShort(new Date(w))),
      series: [{
        name: 'Anuncios nuevos',
        color: 'var(--teal)',
        values: usable.map(w => {
          const prevWeek = weeks[weeks.indexOf(w) - 1];
          const idsPrev = new Set(rawAds.filter(a => weekKey(a.fechaExtraccion) === prevWeek).map(a => a.id).filter(Boolean));
          return rawAds.filter(a => weekKey(a.fechaExtraccion) === w && !idsPrev.has(a.id)).length;
        }),
      }],
    };
  }

  if (view === 'residencia') {
    const residencias = [...new Set(rawAds.map(a => a.residencia))].sort();
    return {
      mode: 'multiline',
      categories,
      series: residencias.map(res => ({
        name: res,
        color: residenciaColor(res),
        values: weeks.map(w => rawAds.filter(a => weekKey(a.fechaExtraccion) === w && a.residencia === res).length),
      })),
    };
  }

  if (view === 'dia') {
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const counts = new Array(7).fill(0);
    const vistos = new Set();
    rawAds.forEach(a => {
      if (!a.fechaInicio) return;
      const id = a.id || `${a.residencia}|${a.texto}|${a.fechaInicio.getTime()}`;
      if (vistos.has(id)) return;
      vistos.add(id);
      counts[(a.fechaInicio.getDay() + 6) % 7]++; // getDay(): 0=domingo → reindexa a lunes=0
    });
    return {
      mode: 'bar',
      categories: dias.map(d => d.slice(0, 3)),
      series: [{ name: 'Anuncios nuevos', color: 'var(--blue)', values: counts }],
    };
  }

  // 'total' (por defecto)
  return {
    mode: 'line',
    categories,
    series: [{
      name: 'Anuncios activos',
      color: 'var(--blue)',
      values: weeks.map(w => rawAds.filter(a => weekKey(a.fechaExtraccion) === w).length),
    }],
  };
}
```

- [x] **Step 6: Verificar que no queda ninguna referencia suelta**

Run: `grep -n "adId(\|cleanAdLibraryUrl" script.js`
Expected: sin resultados (ninguna coincidencia).

- [x] **Step 7: Verificación visual local**

Run: `cd ~/Desktop/kadora-dashboard && python3 -m http.server 8931`

Abrir `http://localhost:8931` en el navegador y comprobar en la consola de DevTools que no hay errores de JavaScript. Nota: hasta que la Task 1 esté publicada en producción, el JSON en vivo todavía no trae `id`, así que "nuevos"/"bajas" van a salir degradados (todos nuevos, cero bajas) — es esperado, es el mismo efecto que la "semana de transición" ya aceptada en el spec. Lo que este paso valida es que el código no rompe con el JSON antiguo, no la exactitud de los números.

- [x] **Step 8: Commit (sin push)**

```bash
git add script.js
git commit -m "$(cat <<'EOF'
Usar id explícito del JSON en vez de parsear la URL de Ad Library

Prepara el frontend para el nuevo doGet() basado en Marketing API
(ver docs/superpowers/specs/2026-07-10-kadora-marketing-api-design.md).
No hacer push hasta confirmar que el Apps Script ya está desplegado.
EOF
)"
```

No hacer `git push` todavía (Global Constraints).

---

### Task 3: `script.js` — imagen rota no rompe la tarjeta

**Files:**
- Modify: `script.js:651` (`renderCards`)

**Interfaces:**
- Consumes: `ad.imagen` (sin cambios de tipo, sigue siendo string o `null`).
- Produces: ninguna interfaz nueva — cambio puramente de robustez visual.

- [x] **Step 1: Añadir `onerror` al `<img>`**

En `renderCards`, sustituir la línea:

```javascript
    const imagenHtml = ad.imagen ? `<img class="card-image" src="${ad.imagen}" alt="" loading="lazy">` : '';
```

por:

```javascript
    const imagenHtml = ad.imagen ? `<img class="card-image" src="${ad.imagen}" alt="" loading="lazy" onerror="this.remove()">` : '';
```

`this.remove()` saca el `<img>` del DOM si la carga falla, dejando la tarjeta exactamente igual que cuando no hay `imagen` en absoluto (mismo layout que ya existe para ese caso, sin icono de imagen rota).

- [x] **Step 2: Verificación visual local**

Con el servidor local ya arrancado (`http://localhost:8931`), en DevTools > Network, sobre alguna tarjeta con imagen, forzar un fallo de carga (bloquear la URL de la imagen con el botón derecho > Block request URL, o simular offline) y recargar. Confirmar que la tarjeta se queda sin imagen, sin icono roto ni hueco vacío.

- [x] **Step 3: Commit (sin push)**

```bash
git add script.js
git commit -m "$(cat <<'EOF'
Ocultar imagen de tarjeta si falla la carga

Las URLs de imagen de Marketing API pueden caducar antes de que
pase la semana completa que se guardan en el Sheet.
EOF
)"
```

No hacer `git push` todavía (Global Constraints).

---

### Task 4: Desplegar y verificar de extremo a extremo

**Files:**
- Ninguno nuevo — este task solo publica lo ya commiteado y verifica.

**Interfaces:**
- Consumes: Task 1 desplegada en producción (JSON real con `id`), commits locales de Task 2 y Task 3.

- [x] **Step 1: Confirmar que Task 1 está realmente en producción**

Repetir el Step 6 de la Task 1 (abrir la URL del Web App en el navegador) y confirmar que el JSON sigue trayendo `id` — si Mario aún no ha hecho el Step 5 (nueva versión de la implementación) de la Task 1, parar aquí y esperar.

- [x] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Verificar en producción (Netlify)**

Esperar ~1 minuto (CLAUDE.md: Netlify auto-deploy), abrir `https://splendid-longma-5ecf40.netlify.app`, y comprobar:
- Las imágenes cargan y, al pinchar "Ver anuncio", el post real que se abre coincide con la imagen mostrada.
- Los KPIs "🆕 Anuncios nuevos esta semana" y bajas se calculan sin errores en consola.
- El selector de semana sigue mostrando solo la semana elegida (no se suman semanas).
- Los chips de residencia muestran Granada/Barcelona/Sevilla/Zaragoza (no debería aparecer "General" salvo que algún anuncio no tenga cuenta reconocida, lo cual no debería pasar con el mapeo fijo).

- [x] **Step 4: Avisar de la semana de transición**

Mandar a Mario y a la jefa un aviso de que, en la primera comparación semana-a-semana tras este despliegue, los números de "nuevos"/"bajas" van a salir anormalmente altos (justificado en el spec: el id cambia de espacio de nombres una única vez) — para que no lo interpreten como un bug la semana en que ocurra.
