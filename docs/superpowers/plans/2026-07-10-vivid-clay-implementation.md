# Rediseño "Vivid Clay" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskinear el dashboard de Kadora (`index.html` / `style.css` / partes puntuales de `script.js`) al sistema visual "Vivid Clay" acordado en `docs/superpowers/specs/2026-07-10-vivid-clay-redesign-design.md` — superficies "moldeadas" con doble sombra, esferas de gradiente en vez de iconos emoji, y una variante clara (Kadora) / oscura con resplandor (Competencia) del mismo sistema de color.

**Architecture:** Es un re-skin CSS-first sobre un sitio estático sin build. Se introduce un pequeño juego de custom properties en `:root` que representan superficie/sombra/texto, y se sobrescriben bajo `body.competencia-active` (mecanismo que ya existe hoy) para que **todos** los componentes cambien de claro a oscuro con una sola fuente de verdad, sin duplicar reglas por vista. Los componentes (`.kpi-card`, `.card`, `.chip`, `.trend-card`, `.pricing-card`, `.city-tab`, controles) consumen esas variables en vez de fijar colores propios.

**Tech Stack:** HTML/CSS/JS plano, sin frameworks ni build. Verificación manual en navegador (`python3 -m http.server 8931`), ya que el repo no tiene test runner ni dependencias — así se prueban los cambios hoy (ver `CLAUDE.md`).

## Global Constraints

- No añadir build, framework, dependencia ni preprocesador CSS (el proyecto es HTML/CSS/JS plano — ver `CLAUDE.md`).
- No tocar lógica de datos: `RESIDENCIA_COLORS`, `competidorColor`, criterio de "nuevo/baja" por `id`, cruce de imágenes — todo eso permanece intacto en `script.js`/`script-competencia.js`.
- Colores de marca sin cambios: `--navy:#0C2340`, `--coral:#E56A54`, `--blue:#307FE2`, `--teal:#279989`.
- Cada tarea termina con una verificación manual en `http://localhost:8931` (Kadora y, si aplica, Competencia) en vez de un test automatizado — no existe suite de tests en este repo y no se va a introducir una para un cambio puramente visual.
- Commits frecuentes, uno por tarea, seleccionando solo los archivos tocados en esa tarea (no `git add -A`).
- Servidor local: si no está corriendo, arrancarlo en background con `python3 -m http.server 8931` desde la raíz del repo antes de verificar cada tarea.

---

### Task 1: Tokens de diseño (color, sombra, superficie) + fondo mesh

**Files:**
- Modify: `style.css:1-46`

**Interfaces:**
- Produces: custom properties `--surface-a`, `--surface-b`, `--shadow-hi`, `--shadow-lo`, `--ink`, `--text`, `--muted`, `--muted-2`, `--radius-lg` (22px), `--radius-md` (14px) — usadas por todas las tareas siguientes. `body.competencia-active` sobrescribe las mismas variables con los valores oscuros.

- [ ] **Step 1: Reemplazar el bloque `:root` y el fondo del `body`**

Sustituir las líneas 1-46 actuales de `style.css` (el `:root` original y las reglas `body` / `body.competencia-active`) por:

```css
:root {
  --navy: #0C2340;
  --navy-2: #17325a;
  --coral: #E56A54;
  --blue: #307FE2;
  --teal: #279989;

  --surface-a: #eef1f6;
  --surface-b: #e6eaf1;
  --shadow-hi: rgba(255, 255, 255, .85);
  --shadow-lo: rgba(28, 60, 110, .16);
  --ink: #0c2340;
  --text: #243252;
  --muted: #5c6a86;
  --muted-2: #7a87a1;
  --border: #e6e9f2;

  --radius-lg: 22px;
  --radius-md: 14px;
}

/* Competencia reutiliza el mismo sistema de tokens en su variante oscura
   ("Glow Clay") — ningún componente de abajo necesita reglas duplicadas
   por vista, solo lee estas variables. */
body.competencia-active {
  --surface-a: #132444;
  --surface-b: #0d1c36;
  --shadow-hi: rgba(255, 255, 255, .035);
  --shadow-lo: rgba(0, 0, 0, .55);
  --ink: #ffffff;
  --text: rgba(255, 255, 255, .86);
  --muted: rgba(255, 255, 255, .5);
  --muted-2: rgba(255, 255, 255, .4);
  --border: rgba(255, 255, 255, .1);
}

* { box-sizing: border-box; }

[hidden] { display: none !important; }

body {
  margin: 0;
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--text);
  background:
    radial-gradient(560px 380px at 8% 0%, rgba(48, 127, 226, .18), transparent 62%),
    radial-gradient(520px 420px at 95% 8%, rgba(39, 153, 137, .16), transparent 60%),
    radial-gradient(600px 460px at 40% 110%, rgba(229, 106, 84, .14), transparent 65%),
    linear-gradient(160deg, var(--surface-a), var(--surface-b));
  background-attachment: fixed, fixed, fixed, fixed;
  transition: background 0.3s ease;
}

/* Competencia: mismo mesh, mucho más saturado/oscuro (Glow Clay) — es lo
   que hace que se note de un vistazo que estás en la otra vista. */
body.competencia-active {
  background:
    radial-gradient(650px 460px at 6% -10%, rgba(48, 127, 226, .5), transparent 60%),
    radial-gradient(600px 460px at 100% 0%, rgba(39, 153, 137, .45), transparent 58%),
    radial-gradient(650px 520px at 45% 115%, rgba(229, 106, 84, .4), transparent 62%),
    #0a1526;
  background-attachment: fixed, fixed, fixed, fixed;
}
```

- [ ] **Step 2: Verificar visualmente**

Arrancar el servidor si no está corriendo:

```bash
cd ~/Desktop/kadora-dashboard && python3 -m http.server 8931 &
```

Abrir `http://localhost:8931`. Esperado: el fondo ya muestra el mesh claro (manchas azul/teal/coral muy sutiles) aunque el resto de la web todavía se vea con el estilo antiguo (las tareas siguientes lo actualizan). Cambiar a la pestaña "Competencia" y confirmar que el fondo pasa a oscuro con el mesh mucho más intenso.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "Sustituir tokens de color/sombra por el sistema Vivid Clay / Glow Clay"
```

---

### Task 2: Topbar flotante

**Files:**
- Modify: `style.css:48-73` (bloque `.topbar` / `.topbar::after`)

**Interfaces:**
- Consumes: ninguno nuevo (usa `--navy`, `--navy-2`, `--radius-lg` de Task 1).

- [ ] **Step 1: Reemplazar el bloque `.topbar` / `.topbar::after`**

```css
.topbar {
  background: linear-gradient(135deg, var(--navy), var(--navy-2));
  color: #fff;
  padding: 16px 0;
  position: sticky;
  top: 12px;
  z-index: 10;
  max-width: 1180px;
  margin: 12px auto 24px;
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 0 rgba(255, 255, 255, .08) inset, 10px 14px 26px -10px rgba(12, 35, 64, .55);
}

.topbar::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 24px;
  right: 24px;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--blue);
  transition: background 0.25s ease;
}

body.competencia-active .topbar::after {
  background: var(--coral);
}
```

Nota: `.topbar` pasa de franja a todo lo ancho a barra centrada de máximo 1180px — `.topbar-inner` (líneas 75-84 actuales) no necesita cambios, ya tenía su propio `max-width`/`margin auto`, ahora simplemente coincide con el del padre.

- [ ] **Step 2: Verificar visualmente**

Recargar `http://localhost:8931`. Esperado: la cabecera navy ahora es una barra flotante con esquinas redondeadas y una sombra que la separa del fondo, con margen alrededor en vez de ir de borde a borde. Al hacer scroll, debe seguir pegada arriba (sticky) con un pequeño hueco de 12px. Confirmar en ambas pestañas (la línea inferior de acento cambia de azul a coral).

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "Convertir la topbar en una barra flotante con esquinas redondeadas"
```

---

### Task 3: KPI cards — superficie clay + esferas de gradiente (sin emoji)

**Files:**
- Modify: `style.css:271-344` (bloque `.kpis` / `.kpi-card` / `.kpi-icon` / `.kpi-value` / `.kpi-label`)
- Modify: `index.html:51-86` (7 KPIs de Kadora)
- Modify: `index.html:143-168` (5 KPIs de Competencia)

**Interfaces:**
- Produces: clases `.orb`, `.orb--navy`, `.orb--blue`, `.orb--teal`, `.orb--coral` — reutilizables por cualquier icono futuro, no solo KPIs.

- [ ] **Step 1: Reemplazar el bloque de KPIs en `style.css`**

```css
.kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 28px;
}

.kpi-value.up { color: var(--teal); }
.kpi-value.down { color: var(--coral); }

.kpi-card {
  position: relative;
  flex: 1 1 190px;
  background: linear-gradient(160deg, var(--surface-a), var(--surface-b));
  border-radius: var(--radius-lg);
  padding: 16px 18px 15px;
  display: flex;
  align-items: center;
  gap: 13px;
  box-shadow: -6px -6px 13px var(--shadow-hi), 8px 8px 18px var(--shadow-lo);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: -8px -8px 16px var(--shadow-hi), 10px 10px 22px var(--shadow-lo);
}

.orb {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: -3px -3px 6px rgba(255, 255, 255, .5), 4px 5px 9px rgba(12, 35, 64, .28);
}

.orb--navy  { background: radial-gradient(circle at 32% 28%, #6f8fc7, #0C2340 60%, #060f1f 100%); }
.orb--blue  { background: radial-gradient(circle at 32% 28%, #6fb0ff, #307FE2 55%, #1b4f96 100%); }
.orb--teal  { background: radial-gradient(circle at 32% 28%, #5fd8c4, #279989 55%, #17564c 100%); }
.orb--coral { background: radial-gradient(circle at 32% 28%, #ff9d87, #E56A54 55%, #a8412c 100%); }

/* Competencia: las esferas emiten resplandor propio además del volumen. */
body.competencia-active .orb--navy  { box-shadow: 0 0 18px -2px rgba(111, 143, 199, .7); }
body.competencia-active .orb--blue  { box-shadow: 0 0 18px -2px rgba(48, 127, 226, .75); }
body.competencia-active .orb--teal  { box-shadow: 0 0 18px -2px rgba(39, 153, 137, .75); }
body.competencia-active .orb--coral { box-shadow: 0 0 18px -2px rgba(229, 106, 84, .75); }

.kpi-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--ink);
  line-height: 1.15;
  display: block;
  font-variant-numeric: tabular-nums;
}

.kpi-label {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
  line-height: 1.3;
}
```

- [ ] **Step 2: Actualizar los 7 KPIs de Kadora en `index.html`**

Reemplazar cada `<div class="kpi-card" style="--kpi-accent: var(--X)">` + su `<span class="kpi-icon">EMOJI</span>` (líneas 51-85) por, respectivamente:

```html
<div class="kpi-card">
  <span class="orb orb--navy"></span>
  <div><span class="kpi-value" id="kpiTotal">–</span><span class="kpi-label">Anuncios activos esta semana</span></div>
</div>
<div class="kpi-card">
  <span class="orb orb--teal"></span>
  <div><span class="kpi-value" id="kpiNuevos">–</span><span class="kpi-label">Anuncios nuevos esta semana</span></div>
</div>
<div class="kpi-card">
  <span class="orb orb--coral"></span>
  <div><span class="kpi-value" id="kpiBajas">–</span><span class="kpi-label">Anuncios dados de baja</span></div>
</div>
<div class="kpi-card">
  <span class="orb orb--blue"></span>
  <div><span class="kpi-value" id="kpiResidencias">–</span><span class="kpi-label">Residencias con campaña activa</span></div>
</div>
<div class="kpi-card">
  <span class="orb orb--navy"></span>
  <div><span class="kpi-value" id="kpiReciente">–</span><span class="kpi-label">Anuncio más reciente</span></div>
</div>
<div class="kpi-card">
  <span class="orb orb--teal"></span>
  <div><span class="kpi-value" id="kpiTop">–</span><span class="kpi-label">Residencia con más actividad</span></div>
</div>
<div class="kpi-card">
  <span class="orb orb--blue"></span>
  <div><span class="kpi-value" id="kpiAntiguedad">–</span><span class="kpi-label">Antigüedad media de los anuncios</span></div>
</div>
```

(El color de cada esfera es el mismo que ya tenía cada tarjeta vía `--kpi-accent`, solo cambia el mecanismo: antes una variable CSS + icono emoji con fondo `color-mix`, ahora una clase de esfera fija.)

- [ ] **Step 3: Actualizar los 5 KPIs de Competencia en `index.html`**

Mismo patrón sobre las líneas 143-167, usando la clase de orbe que corresponde a cada `--kpi-accent` actual: `kpiTotalComp`→`orb--navy`, `kpiCompetidores`→`orb--teal`, `kpiRecienteComp`→`orb--blue`, `kpiTopComp`→`orb--teal`, `kpiAntiguedadComp`→`orb--coral`.

- [ ] **Step 4: Verificar visualmente**

Recargar. Esperado: los 7 KPIs de Kadora muestran una esfera de gradiente (no emoji) con el volumen "clay", y la tarjeta entera tiene la sombra doble. Cambiar a Competencia y confirmar lo mismo ahí, con las esferas ahora brillando ligeramente (glow) sobre fondo oscuro. Revisar la consola del navegador por si algún `id` dejó de coincidir con lo que usa `script.js`/`script-competencia.js` (no debería, no se tocaron los `id`).

- [ ] **Step 5: Commit**

```bash
git add style.css index.html
git commit -m "Sustituir iconos emoji de los KPI por esferas de gradiente clay"
```

---

### Task 4: Panel del gráfico de evolución

**Files:**
- Modify: `style.css:346-449` (bloque `.trend-card` y relacionados)
- Modify: `script.js:415-426` (relleno del gráfico de barras, vista "día")

**Interfaces:**
- Consumes: `--surface-a/-b`, `--shadow-hi/-lo`, `--radius-lg` de Task 1.

- [ ] **Step 1: Actualizar el panel en `style.css`**

Reemplazar el bloque `.trend-card` (y dejar el resto de reglas de `.trend-*` como están, solo cambia el contenedor):

```css
.trend-card {
  background: linear-gradient(160deg, var(--surface-a), var(--surface-b));
  border-radius: var(--radius-lg);
  padding: 20px 20px 10px;
  box-shadow: -6px -6px 13px var(--shadow-hi), 8px 8px 18px var(--shadow-lo);
  margin-bottom: 28px;
}
```

En `.trend-head h2`, `.trend-tooltip-label` y demás reglas que referencian `var(--muted)`/`var(--navy)`/`var(--border)`, no hace falta tocarlas: ya heredan los tokens actualizados en Task 1.

`.trend-tooltip` sí hay que tocarla: usaba `box-shadow: var(--shadow-hover)`, variable que Task 1 elimina. Reemplazar esa única propiedad:

```css
.trend-tooltip {
  box-shadow: -4px -4px 9px var(--shadow-hi), 6px 8px 16px var(--shadow-lo);
}
```

(El resto de propiedades de `.trend-tooltip` — `position`, `background: var(--navy)`, `color`, `padding`, etc. — se quedan igual, no dependen de ningún token eliminado.)

- [ ] **Step 2: Dar relleno degradado a las barras de la vista "día" en `script.js`**

Es la única vista que dibuja barras reales (`data.mode === 'bar'`); las vistas "total"/"nuevos" son líneas y no llevan relleno de barra. Modificar el bloque `if (data.mode === 'bar') { ... }` (líneas 415-426) para inyectar un degradado SVG una sola vez y usarlo como `fill`:

```javascript
  if (data.mode === 'bar') {
    const bandWidth = (xRight - xLeft) / n;
    const barWidth = Math.min(28, bandWidth * 0.5);
    svgHtml += `
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#6fb0ff" />
          <stop offset="100%" stop-color="#307FE2" />
        </linearGradient>
      </defs>
    `;
    data.categories.forEach((label, i) => {
      const cx = xLeft + bandWidth * (i + 0.5);
      const v = data.series[0].values[i];
      const y = yFor(v);
      svgHtml += `
        <rect class="bar-mark" data-idx="${i}" x="${(cx - barWidth / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(yBottom - y, 0).toFixed(1)}" rx="6" fill="url(#barGrad)" />
        <text x="${cx.toFixed(1)}" y="${height - 6}" font-size="11" fill="var(--muted)" text-anchor="middle">${label}</text>
      `;
    });
  } else {
```

- [ ] **Step 3: Verificar visualmente**

Recargar, abrir el desplegable "Evolución de anuncios" y seleccionar "Anuncios nuevos por día de la semana" (es la vista `dia`, la única con barras). Esperado: barras con degradado azul vertical y esquinas más redondeadas (`rx="6"`), dentro de un panel con la misma sombra clay que los KPIs. Probar también "Total de anuncios activos" y "Evolución por residencia": deben seguir dibujándose como línea/multilínea igual que antes (sin errores en consola), solo con el panel contenedor rediseñado.

- [ ] **Step 4: Commit**

```bash
git add style.css script.js
git commit -m "Aplicar superficie clay al panel de tendencia y degradado a las barras"
```

---

### Task 5: Controles — chips, switches y campos

**Files:**
- Modify: `style.css:207-230` (`.week-bar`, `.btn-export`)
- Modify: `style.css:452-541` (`.controls`, `.chip`, `.group-toggle`, `.select`, `.search`)

**Interfaces:**
- Consumes: tokens de Task 1. No cambia ningún `id`/`data-*` usado por `script.js`.

- [ ] **Step 1: Botones de la barra de semana**

Reemplazar `.btn-export`:

```css
.btn-export {
  border: none;
  background: linear-gradient(160deg, var(--surface-a), var(--surface-b));
  color: var(--navy);
  font-weight: 700;
  font-size: 13px;
  font-family: inherit;
  padding: 9px 16px;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: -4px -4px 9px var(--shadow-hi), 5px 5px 12px var(--shadow-lo);
  transition: box-shadow 0.15s ease;
}

.btn-export:first-of-type { margin-left: auto; }

.btn-export:active {
  box-shadow: inset -2px -2px 5px var(--shadow-hi), inset 3px 3px 7px var(--shadow-lo);
}
```

Esto sustituye por completo el bloque original `.btn-export` / `.btn-export:first-of-type` / `.btn-export:hover` (el `:hover` con `background: var(--bg)` desaparece — `--bg` ya no existe tras Task 1 — y su feedback pasa a ser el nuevo estado `:active` de arriba).

- [ ] **Step 2: Chips de residencia/competidor**

Reemplazar `.chip`, `.chip .dot`, `.chip:hover`, `.chip.active`, `.chip.active .dot`:

```css
.chip {
  border: none;
  background: linear-gradient(160deg, var(--surface-a), var(--surface-b));
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 7px;
  box-shadow: -4px -4px 9px var(--shadow-hi), 5px 5px 12px var(--shadow-lo);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.chip .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent, var(--muted));
}

.chip:hover { transform: translateY(-1px); }

.chip.active {
  background: linear-gradient(150deg, color-mix(in srgb, var(--accent, var(--blue)) 70%, white), var(--accent, var(--blue)));
  color: #fff;
  box-shadow: -2px -2px 5px rgba(255, 255, 255, .25) inset, 4px 6px 14px -3px color-mix(in srgb, var(--accent, var(--blue)) 55%, transparent);
}

.chip.active .dot { background: #fff; }
```

- [ ] **Step 3: Switch para los toggles ("Solo nuevos", "Solo bajas", "Agrupar por texto")**

Reemplazar `.group-toggle` y añadir el estilo del `<input type="checkbox">` como switch (sin tocar el HTML — sigue siendo un checkbox real y accesible, el switch es puramente CSS sobre el propio input):

```css
.group-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.group-toggle input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 32px;
  height: 18px;
  border-radius: 999px;
  background: var(--surface-b);
  box-shadow: inset 2px 2px 4px var(--shadow-lo), inset -1px -1px 2px var(--shadow-hi);
  position: relative;
  cursor: pointer;
  margin: 0;
  flex-shrink: 0;
}

.group-toggle input[type="checkbox"]::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 1px 1px 3px rgba(0, 0, 0, .3);
  transition: left 0.15s ease;
}

.group-toggle input[type="checkbox"]:checked {
  background: linear-gradient(150deg, #6fb0ff, var(--blue));
}

.group-toggle input[type="checkbox"]:checked::after { left: 16px; }

.group-toggle input[type="checkbox"]:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
```

- [ ] **Step 4: `.select` y `.search`**

```css
.select, .search {
  border: none;
  background: linear-gradient(160deg, var(--surface-a), var(--surface-b));
  border-radius: 12px;
  padding: 9px 14px;
  font-size: 13px;
  font-family: inherit;
  color: var(--text);
  box-shadow: -4px -4px 9px var(--shadow-hi), 5px 5px 12px var(--shadow-lo);
}

.search { min-width: 240px; }

.select:focus, .search:focus {
  outline: none;
  box-shadow: -4px -4px 9px var(--shadow-hi), 5px 5px 12px var(--shadow-lo), 0 0 0 2px var(--blue);
}
```

- [ ] **Step 5: Verificar visualmente**

Recargar. Probar: click en un chip de residencia (debe pasar a estado activo con degradado de su color de identidad), activar "Solo nuevos esta semana" (el switch debe deslizar y ponerse azul), usar el buscador y el selector de orden. Todo debe seguir filtrando exactamente igual que antes — solo cambia el aspecto. Repetir en Competencia (chips de competidor, sin toggles ahí).

- [ ] **Step 6: Commit**

```bash
git add style.css
git commit -m "Rediseñar chips, switches, selects y botones de exportación en clay"
```

---

### Task 6: Tarjetas de anuncio y de tarifa — clay + badges semánticos

**Files:**
- Modify: `style.css:543-855` (`.pricing-card` y `.card` y sus elementos internos)
- Modify: `script.js:641-642` (texto de `new-badge` / `baja-badge`, quitar emoji)

**Interfaces:**
- Consumes: tokens de Task 1. `--accent` sigue viniendo de `residenciaColor()`/`competidorColor()` sin cambios — es el color de identidad (§1b de la spec), no se toca esa lógica.

- [ ] **Step 1: Tarjetas de tarifa (Competencia) — `.pricing-card`**

Reemplazar el bloque (quitar el `::before` de la barra superior, pasar a superficie clay):

```css
.pricing-card {
  --accent: var(--teal);
  position: relative;
  background: linear-gradient(160deg, var(--surface-a), var(--surface-b));
  border-radius: var(--radius-lg);
  padding: 18px 18px 14px;
  box-shadow: -6px -6px 13px var(--shadow-hi), 8px 8px 18px var(--shadow-lo);
}
```

(Eliminar la regla `.pricing-card::before` completa — el corte de color ya no forma parte del lenguaje visual.)

- [ ] **Step 2: Tarjeta de anuncio — `.card`**

Reemplazar el bloque `.card` / `.card::before` / `.card:hover`:

```css
.card {
  --accent: var(--muted);
  position: relative;
  background: linear-gradient(160deg, var(--surface-a), var(--surface-b));
  border-radius: var(--radius-lg);
  padding: 18px 16px 16px;
  box-shadow: -6px -6px 13px var(--shadow-hi), 8px 8px 20px var(--shadow-lo);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: -8px -8px 16px var(--shadow-hi), 10px 10px 24px var(--shadow-lo);
}
```

(Eliminar `.card::before` — sin barra de acento arriba.)

- [ ] **Step 3: Badge de residencia/competidor (`.badge`) y estado (`.new-badge`, `.baja-badge`)**

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: color-mix(in srgb, var(--accent, var(--muted)) 20%, var(--surface-a));
  color: var(--accent, var(--muted));
  font-weight: 700;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 8px;
}

.new-badge {
  font-size: 11px;
  font-weight: 800;
  color: #0a1526;
  padding: 5px 11px;
  border-radius: 999px;
  white-space: nowrap;
  background: linear-gradient(160deg, #5fd8c4, var(--teal));
  box-shadow: -2px -2px 4px rgba(255, 255, 255, .3) inset, 2px 4px 9px -2px rgba(39, 153, 137, .5);
}

.baja-badge {
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  padding: 5px 11px;
  border-radius: 999px;
  white-space: nowrap;
  background: linear-gradient(160deg, #ff9d87, var(--coral));
  box-shadow: -2px -2px 4px rgba(255, 255, 255, .3) inset, 2px 4px 9px -2px rgba(229, 106, 84, .5);
}

body.competencia-active .new-badge {
  box-shadow: 0 0 14px -1px rgba(39, 153, 137, .8);
}
body.competencia-active .baja-badge {
  box-shadow: 0 0 14px -1px rgba(229, 106, 84, .8);
}
```

De paso, eliminar la regla `.badge .dot { ... background: var(--accent, var(--accent-default)); }`: es CSS muerto ya hoy (ningún `.badge` genera un `<span class="dot">` dentro — ese patrón solo lo usan `.chip`), y referencia `--accent-default`, variable que Task 1 elimina.

`.pricing-tier` también usaba una variable eliminada (`background: var(--bg)`) — actualizar solo esa propiedad:

```css
.pricing-tier {
  background: var(--surface-b);
}
```

(El resto de propiedades de `.pricing-tier` — tamaño, color, padding, `border-radius` — se quedan igual.)

- [ ] **Step 4: Quitar el emoji del texto de los badges en `script.js`**

En las líneas 641-642, cambiar:

```javascript
const newBadge = ad.isNew ? `<span class="new-badge">🆕 Nuevo</span>` : '';
const bajaBadge = ad.isBaja ? `<span class="baja-badge">🔻 De baja</span>` : '';
```

por:

```javascript
const newBadge = ad.isNew ? `<span class="new-badge">Nuevo</span>` : '';
const bajaBadge = ad.isBaja ? `<span class="baja-badge">De baja</span>` : '';
```

El color (teal/coral) ya comunica el estado — el pill ya no necesita el emoji para destacar, igual que se validó en la maqueta aprobada por Mario.

- [ ] **Step 5: Imagen del anuncio, texto, y pie de tarjeta**

Reemplazar `.card-image`, `.card-text`, `.card-bottom`, `.card-link`, `.dup-count`, `.group-link`:

```css
.card-image {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: var(--radius-md);
  display: block;
  box-shadow: inset 0 0 0 1px rgba(12, 35, 64, .06);
}

.card-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-text.expanded { -webkit-line-clamp: unset; }

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.card-dates { font-size: 11.5px; color: var(--muted-2); line-height: 1.5; }
.card-dates strong { color: var(--text); }

.dup-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  background: var(--surface-b);
  padding: 4px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.group-link {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink);
  background: var(--surface-b);
  padding: 4px 9px;
  border-radius: 6px;
  text-decoration: none;
  white-space: nowrap;
}
.group-link:hover { filter: brightness(0.95); }
.group-link.disabled { color: var(--muted); pointer-events: none; opacity: 0.6; }

.card-link {
  font-size: 12.5px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(160deg, color-mix(in srgb, var(--navy) 60%, var(--blue)), var(--navy));
  padding: 8px 14px;
  border-radius: 10px;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: 0 1px 0 rgba(255, 255, 255, .12) inset, 3px 5px 11px -3px rgba(12, 35, 64, .5);
  transition: filter 0.15s ease;
}
.card-link:hover { filter: brightness(1.08); }
.card-link.disabled { background: var(--surface-b); color: var(--muted); box-shadow: none; pointer-events: none; }

.card.is-baja { opacity: 0.72; }
```

- [ ] **Step 6: Quitar el emoji de los toggles en `index.html`**

Líneas 113 y 117, quitar el emoji del texto visible (el switch de Task 5 ya comunica el estado):

```html
<span>Solo nuevos esta semana</span>
```
```html
<span>Solo bajas esta semana</span>
```

- [ ] **Step 7: Verificar visualmente**

Recargar. Esperado en la rejilla de Kadora: tarjetas moldeadas sin barra de color arriba, badge "Nuevo"/"De baja" como pill de degradado sin emoji, imagen del anuncio con esquina ligeramente redondeada. Repetir en Competencia con `.pricing-card` y confirmar que ahí el badge de estado no aplica (Competencia no tiene nuevo/baja) pero sí `.badge` de competidor y el glow de fondo oscuro.

- [ ] **Step 8: Commit**

```bash
git add style.css script.js index.html
git commit -m "Rediseñar tarjetas de anuncio/tarifa y badges de estado en clay"
```

---

### Task 7: City tabs de Competencia

**Files:**
- Modify: `style.css:232-269` (`.city-tabs`, `.city-tab`)

**Interfaces:**
- Consumes: tokens de Task 1 (ya en modo oscuro porque `.city-tabs` solo vive en la vista Competencia).

- [ ] **Step 1: Reemplazar `.city-tab` / `.city-tab:hover` / `.city-tab.active` / `.city-tab.disabled`**

```css
.city-tab {
  border: none;
  background: linear-gradient(160deg, var(--surface-a), var(--surface-b));
  padding: 10px 20px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  color: var(--text);
  cursor: pointer;
  box-shadow: -4px -4px 9px var(--shadow-hi), 5px 5px 12px var(--shadow-lo);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.city-tab:hover:not(.disabled) { transform: translateY(-1px); }

.city-tab.active {
  background: linear-gradient(150deg, color-mix(in srgb, var(--coral) 75%, white), var(--coral));
  color: #fff;
  box-shadow: -2px -2px 5px rgba(255, 255, 255, .2) inset, 4px 6px 14px -3px rgba(229, 106, 84, .55);
}

.city-tab.disabled {
  color: var(--muted);
  cursor: not-allowed;
  opacity: 0.55;
  box-shadow: none;
}
```

- [ ] **Step 2: Verificar visualmente**

En la vista Competencia, comprobar que las pestañas de ciudad (Granada activa, resto deshabilitadas) tienen el mismo lenguaje clay oscuro que el resto de la vista, con la activa en coral.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "Aplicar estilo clay a las pestañas de ciudad de Competencia"
```

---

### Task 8: Skeleton de carga

**Files:**
- Modify: `style.css:885-937` (`.skeleton*`)

**Interfaces:**
- Ninguna nueva — solo ajusta el contenedor para que anticipe la superficie clay final.

- [ ] **Step 1: Ajustar el contenedor del skeleton**

`.skeleton-card` ya hereda de `.card` (mismo `class="card skeleton-card"` en el HTML generado por `script.js:609`), así que automáticamente adopta la superficie clay de Task 6. Solo hay que quitar la regla que anulaba la barra superior, que ya no existe:

Eliminar esta regla (ya no aplica, `.card::before` fue eliminado en Task 6):

```css
.skeleton-card::before {
  display: none;
}
```

El resto de `.skeleton`, `.skeleton-badge`, `.skeleton-image`, `.skeleton-line`, `.skeleton-pill`, `@keyframes shimmer` se dejan tal cual — el shimmer sigue funcionando igual sobre el nuevo fondo clay.

- [ ] **Step 2: Verificar visualmente**

Recargar con conexión lenta simulada (DevTools → Network → Slow 3G) o simplemente observar el primer instante de carga. Esperado: las tarjetas esqueleto tienen ya el relieve clay y el shimmer se sigue viendo con normalidad encima.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "Limpiar regla de skeleton obsoleta tras quitar la barra de acento"
```

---

### Task 9: Impresión / exportar a PDF siempre en claro

**Files:**
- Modify: `style.css:959-975` (`@media print`)

**Interfaces:**
- Ninguna nueva.

- [ ] **Step 1: Reforzar el `@media print` para neutralizar sombras y forzar la variante clara**

Reemplazar el bloque completo:

```css
@media print {
  .sync-status,
  .btn-export,
  .controls-right,
  .card-more,
  .footer {
    display: none !important;
  }

  :root, body.competencia-active {
    --surface-a: #ffffff;
    --surface-b: #ffffff;
    --shadow-hi: transparent;
    --shadow-lo: transparent;
    --ink: #0c2340;
    --text: #243252;
    --muted: #5c6a86;
    --muted-2: #7a87a1;
    --border: #e6e9f2;
  }

  body, body.competencia-active { background: #fff; }
  .topbar { position: static; box-shadow: none; margin: 0 auto 16px; }
  .trend-tooltip { display: none !important; }
  .card, .kpi-card, .pricing-card, .city-tab, .chip, .trend-card {
    box-shadow: none !important;
    border: 1px solid var(--border);
  }
  .card-text { -webkit-line-clamp: unset !important; }
}
```

Justificación: aunque se esté en la vista Competencia (oscura en pantalla), al exportar a PDF siempre debe verse como la variante clara — imprimir fondo oscuro gastaría tinta y sería difícil de leer en papel. Se fuerzan los mismos tokens a blanco/claro independientemente de qué vista esté activa, y se sustituye la sombra clay (invisible en impresión) por un borde fino de 1px para que las tarjetas se distingan sobre papel.

- [ ] **Step 2: Verificar**

Desde ambas vistas (Kadora y Competencia), usar "Exportar PDF" o la vista previa de impresión del navegador (Cmd+P). Esperado: en los dos casos el documento se ve en claro, con bordes finos en vez de sombras, sin fondo oscuro de Competencia.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "Forzar variante clara sin sombras al imprimir/exportar PDF"
```

---

### Task 10: Regresión manual completa

**Files:**
- Ninguno (solo verificación).

- [ ] **Step 1: Repasar Kadora**

En `http://localhost:8931`: cambiar de semana, copiar enlace, exportar PDF, cambiar las 4 vistas del gráfico de tendencia, activar/desactivar los tres toggles, buscar texto, cambiar orden, hacer click en varios chips de residencia, expandir "Ver más" en una tarjeta con texto largo, y comprobar que una tarjeta agrupada (mismo texto, `count > 1`) sigue mostrando todos sus `.group-link` individuales.

- [ ] **Step 2: Repasar Competencia**

Cambiar a la pestaña Competencia y confirmar el cambio inmediato a la variante oscura (fondo, topbar underline coral, chips, city-tabs, pricing-cards). Repetir: buscador, chips de competidor, y comprobar que las tarjetas de tarifa muestran bien los tramos de precio.

- [ ] **Step 3: Comprobar consola**

Abrir la consola de DevTools en ambas vistas y confirmar que no hay errores nuevos (nada referente a `id`s que ya no existan, por ejemplo por los cambios de Task 3).

- [ ] **Step 4: Commit (si se corrigió algo durante la regresión)**

Si el repaso no encontró nada que corregir, no hay commit en esta tarea. Si se ajustó algo puntual, commitear con un mensaje descriptivo del arreglo concreto.
