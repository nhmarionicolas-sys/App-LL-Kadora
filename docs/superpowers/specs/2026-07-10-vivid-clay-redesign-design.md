# Rediseño visual "Vivid Clay" — Monitor de Anuncios Kadora

## Contexto

El dashboard actual (`index.html` / `style.css`) usa un lenguaje visual que Mario describe como "genérico, muy IA": iconos emoji, pills redondeadas en todo, degradados pastel suaves y sombras difusas, con una barra de acento de color arriba de cada tarjeta. Se exploraron 9 direcciones en tres rondas (ver artifacts de la conversación) y Mario eligió **Vivid Clay**: tarjetas "moldeadas" con doble sombra (neumorfismo actualizado con color saturado) sobre un fondo con manchas de color de marca difuminadas (mesh gradient), con esferas de gradiente en vez de iconos/emoji.

Este documento fija cómo se traduce esa dirección a los componentes reales del dashboard, con dos condiciones explícitas de Mario:

1. **Los colores deben tener sentido, no ponerse porque sí.** Se formaliza abajo un sistema de significado que ya existía implícito en el código (`RESIDENCIA_COLORS`, `new-badge`/`baja-badge`) en vez de inventar uno nuevo.
2. **Kadora y Competencia deben notarse a la primera pestañada como vistas distintas.** Se resuelve con una variante clara (Kadora) y una variante oscura (Competencia) del mismo sistema — nunca invirtiendo/negativizando colores, porque eso rompería el sistema de sentido del punto 1.

## Alcance

Rediseño visual (CSS + estructura mínima de HTML) de:
- Vista **Anuncios Kadora**: topbar, week-bar, KPIs (7), gráfico de evolución, controles/chips, rejilla de tarjetas de anuncio, footer, estados vacío/skeleton.
- Vista **Competencia**: mismo inventario de componentes + city-tabs + tarjetas de tarifa (`pricing-card`).

**Fuera de alcance:** lógica de datos, Apps Script, definición de "nuevo/baja", cruce de imágenes por texto — nada de eso cambia. Es un re-skin, no un cambio de arquitectura ni de información mostrada. Tampoco se introduce build ni dependencias nuevas (sigue siendo HTML/CSS/JS plano).

## 1. Sistema de color (con sentido)

Dos sistemas de color independientes conviven hoy en el código y se mantienen — solo se formalizan:

### 1a. Color semántico (estado / dirección)

| Rol | Color | Dónde se aplica |
|---|---|---|
| Positivo / incremento | **Teal** `#279989` | Badge "Nuevo", indicador de tendencia al alza en el gráfico |
| Negativo / decremento | **Coral** `#E56A54` | Badge "Baja", indicador de tendencia a la baja |
| Neutral / informativo (sin dirección) | **Navy** `#0C2340` y **Azul** `#307FE2`, alternados | KPIs que no suben ni bajan: activos totales, residencias activas, anuncio más reciente, antigüedad media |

Regla de aplicación: un KPI o badge que representa un cambio (nuevo/baja) usa siempre teal/coral. Un KPI que representa una foto fija (total, promedio, recuento) usa navy/azul. Nunca se usa teal/coral para decorar un KPI neutral solo por variar el color.

### 1b. Color de identidad (residencia / competidor)

Ya existe en `script.js` (`RESIDENCIA_COLORS`) y `script-competencia.js` (`competidorColor`) — **no se toca**. Es un sistema aparte: identifica de un vistazo a qué residencia/competidor pertenece un chip o una tarjeta, y puede usar tonos fuera de los 4 colores de marca (morado para Zaragoza, magenta para Madrid) porque su función es distinguir entidades, no comunicar estado. Convive con 1a sin conflicto porque nunca aparecen en el mismo elemento: la identidad va en el pin/dot junto al nombre y en el chip de filtro; el estado va en el badge "Nuevo"/"Baja" de la tarjeta.

### 1c. Color estructural (marca)

**Navy** es siempre el color de la topbar (franja/bar flotante) y del texto principal, en ambas vistas — es el ancla de marca que no cambia nunca, ni siquiera al entrar en Competencia.

## 2. Kadora (claro) vs Competencia (oscuro)

Mismo sistema de color y de componentes; cambia la superficie y el modo de sombra — nunca el significado de un color.

| | Kadora | Competencia |
|---|---|---|
| Fondo | Claro, mesh de manchas de marca a baja opacidad (10-25%) sobre `#eef1f6 → #e6eaf1` | Oscuro, mismo mesh a mayor opacidad (40-55%) sobre `#0a1526` |
| Sombra "clay" | Doble sombra clara: luz blanca arriba-izq + sombra navy difusa abajo-der | Doble sombra oscura: luz blanca casi imperceptible arriba-izq + sombra negra abajo-der, **más** resplandor de color (`box-shadow` de glow) en esferas y bordes de tarjeta activa |
| Texto | Navy sobre superficie clara | Blanco/gris claro sobre superficie oscura |
| Topbar | Navy (igual en las dos vistas) | Navy (igual) — solo cambia el color de la pestaña activa (azul en Kadora, coral en Competencia, como ya ocurre hoy) |

Esto reutiliza exactamente los tokens ya validados como "Vivid Clay" (H, claro) y "Glow Clay" (G, oscuro) de la ronda 3 — son la misma familia, no dos sistemas distintos.

## 3. Tokens de diseño

```css
:root {
  /* marca (sin cambios respecto a hoy) */
  --navy: #0C2340;
  --coral: #E56A54;
  --blue: #307FE2;
  --teal: #279989;

  /* superficie clara (Kadora) */
  --clay-bg-a: #eef1f6;
  --clay-bg-b: #e6eaf1;
  --clay-shadow-light: rgba(255,255,255,.85);
  --clay-shadow-dark: rgba(28,60,110,.16);
  --clay-ink: #0c2340;
  --clay-text: #243252;
  --clay-muted: #5c6a86;

  /* superficie oscura (Competencia) */
  --glow-bg: #0a1526;
  --glow-surface: linear-gradient(160deg,#132444,#0d1c36);
  --glow-shadow-light: rgba(255,255,255,.035);
  --glow-shadow-dark: rgba(0,0,0,.55);
  --glow-text: rgba(255,255,255,.86);
  --glow-muted: rgba(255,255,255,.5);

  --radius-lg: 22px;   /* tarjetas, KPIs, topbar */
  --radius-md: 14px;   /* imagen del anuncio, thumbs */
  --radius-full: 999px; /* chips, badges, pills */
}
```

**Fórmula de sombra clay** (se repite igual en todo componente "elevado", solo cambian los colores de la tabla anterior):

```css
/* claro */
box-shadow: -6px -6px 13px var(--clay-shadow-light), 8px 8px 18px var(--clay-shadow-dark);
/* oscuro */
box-shadow: -6px -6px 14px var(--glow-shadow-light), 8px 8px 20px var(--glow-shadow-dark);
```

Elementos pequeños (badges, botones) usan un radio de sombra menor (`-3px/-3px 7px`, `4px/5px 10px`) para no verse tan "hundidos" como una tarjeta grande.

**Esferas de acento** (sustituyen los emoji-icono de KPI y el estado nuevo/baja en la vista completa "Glow Orbs"; en KPIs se usan siempre, en tarjetas de anuncio solo si se decide simplificar el badge de texto — ver componente 6):

```css
.orb--blue  { background: radial-gradient(circle at 32% 28%, #6fb0ff, #307FE2 55%, #1b4f96 100%); }
.orb--teal  { background: radial-gradient(circle at 32% 28%, #5fd8c4, #279989 55%, #17564c 100%); }
.orb--coral { background: radial-gradient(circle at 32% 28%, #ff9d87, #E56A54 55%, #a8412c 100%); }
.orb--navy  { background: radial-gradient(circle at 32% 28%, #6f8fc7, #0C2340 60%, #060f1f 100%); }
```

En Competencia, añadir a la esfera un glow a juego: `box-shadow: 0 0 18px -2px <color al 75% opacidad>` (además de la sombra clay del propio elemento contenedor).

**Tipografía:** sin cambios — sigue siendo Outfit para todo. La dirección elegida pone el peso visual en color/forma/relieve, no en la tipografía.

## 4. Componentes (mapeo 1:1 con el código actual)

| Componente actual | Tratamiento nuevo |
|---|---|
| `.topbar` (franja navy a toda anchura, `position: sticky`) | Pasa a ser una barra flotante con esquinas redondeadas (`--radius-lg`) y margen alrededor, con la sombra clay oscura de marca (siempre navy, en ambas vistas) — deja de ser una franja edge-to-edge |
| `.kpi-card` + `.kpi-icon` (emoji) | `.kpi` con esfera de acento (`.orb--*` según la tabla semántica §1a) + valor + label. Se elimina `::before` (la barra de acento arriba) — el volumen ya lo da la sombra clay, no hace falta una barra de color aparte |
| `.trend-card` / `.bar-mark` | Panel clay igual que un KPI; las barras del gráfico usan relleno degradado (`linear-gradient` vertical azul→teal alternado, no un color plano) con una sombra interior sutil para dar volumen |
| `.chip` | Clay pequeño: sombra clay reducida, `--accent` (color de identidad, sistema §1b) solo en el `.dot` y en el estado activo (fondo degradado del color de identidad) |
| `.group-toggle` (checkbox nativo) | Se sustituye visualmente por un switch clay (pista hundida + pestaña con sombra), manteniendo el `<input type="checkbox">` real por accesibilidad — el switch es solo el `::before`/`::after` sobre el input, no un componente nuevo desde cero |
| `.select`, `.search`, `.btn-export` | Clay plano (sombra clay, sin borde), mismo texto/iconos que hoy |
| `.card` (anuncio) | Clay grande. Se elimina la barra `::before`. La imagen real del anuncio (`.card-image`, ya existente) se mantiene igual — el color/gradiente de los mockups era un *placeholder* porque no había fotos reales en la maqueta; en producción ahí sigue la foto real recortada, ahora dentro de un contenedor con esquina `--radius-md` y una sombra interior sutil para que no "flote" desconectada de la tarjeta clay |
| `.new-badge` / `.baja-badge` | Pill clay pequeña con el color semántico (§1a) — teal/coral respectivamente, gradiente sutil + sombra reducida (glow solo en Competencia) |
| `.dup-count`, `.group-link`, `.ad-number` | Sin cambio de comportamiento; se actualiza solo el estilo de superficie (clay en vez de plano) para que no desentonen dentro de la tarjeta |
| `.pricing-card` (Competencia) | Mismo tratamiento que `.card`, con `--accent` = color de identidad del competidor (ya existente en `competidorColor`) |
| `.city-tab` (Competencia) | Mismo tratamiento que `.chip`, con la variante oscura de Competencia por defecto (ya que solo vive en esa vista) |
| `.skeleton*` (loading) | El shimmer se mantiene; el contenedor pasa a ser clay (mismo `--radius-lg`) en vez de plano, para que el estado de carga ya anticipe la superficie final |
| `.empty-state`, `.footer` | Solo tipografía/color, sin tratamiento de superficie (son texto suelto, no tarjetas) |
| `@media print` | Se fuerza **siempre** la variante clara de Kadora al imprimir/exportar PDF, sin sombras (`box-shadow: none`), igual que hoy fuerza fondo blanco — imprimir la variante oscura de Competencia gastaría tinta y perdería legibilidad en papel |

## 5. Accesibilidad (riesgo conocido del neumorfismo)

El neumorfismo clásico tiene fama de bajo contraste (sombra sobre sombra, texto gris sobre gris). Se mitiga así:
- El texto nunca depende del relieve para leerse: `--clay-ink`/`--clay-text` sobre `--clay-bg-a` cumplen contraste AA por sí solos, sin contar la sombra.
- Todo elemento interactivo (chip, botón, toggle, select, tarjeta con enlace) mantiene un estado `:focus-visible` con contorno visible (2px, color de acento) — el relieve clay no sustituye el foco de teclado.
- Los botones/enlaces de acción (`.card-link`, `.btn-export`) llevan además texto blanco sobre degradado saturado (no solo relieve), para no depender únicamente de la sombra para distinguirse del fondo.

## 6. Decisión abierta menor (a confirmar durante la implementación, no bloquea la spec)

En la tarjeta de anuncio, el estado "nuevo"/"baja" puede resolverse como badge de texto (como hoy, más fiel al layout real con mucha info por tarjeta) o como esfera de color pequeña junto al ID (más "Glow Orbs", más minimal pero dice menos con una rejilla de 60+ tarjetas reales). Se implementará como **badge de texto** (opción A) por defecto, ya que con el volumen real de anuncios (60+) el texto explícito escanea mejor que un punto de color — se puede revisar con capturas reales si Mario lo pide.

## No objetivos

- No se cambia ninguna definición de negocio (nuevo/baja, agrupación por texto, cruce de imágenes).
- No se añade build, framework ni dependencia nueva.
- No se toca `script.js`/`script-competencia.js` salvo el HTML que generan las plantillas de string (para ajustar clases/estructura al nuevo marcado), y `RESIDENCIA_COLORS`/`competidorColor` se mantienen intactos.
