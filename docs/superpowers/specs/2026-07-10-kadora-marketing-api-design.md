# Migración de la pestaña "Anuncios KADORA" a Marketing API

## Contexto y problema

Hoy la pestaña "Anuncios KADORA" se alimenta de dos APIs distintas de Meta:

1. **Ad Library** (`ads_archive`, token `META_ACCESS_TOKEN`) da el texto, la fecha de inicio y el link de cada anuncio activo de la página `100149119120066`.
2. **Marketing API** (`/act_{id}/ads`, token `ADS_READ_TOKEN`) se consulta aparte, sobre las cuentas publicitarias reales de Kadora, solo para intentar sacar una imagen — cruzando por texto normalizado, porque el id de la Ad Library y el id interno de Marketing API son namespaces incompatibles.

Ese cruce por texto es la causa raíz de dos problemas que reporta Mario:

- Muchas imágenes no cargan.
- Cuando cargan, a menudo no corresponden al anuncio real (el cruce empareja mal, sobre todo con textos cortos o genéricos).

La jefa (Carol) ya resolvió esto por su cuenta con un script en Python/Google Colab que **solo** usa Marketing API: pide anuncio e imagen en la misma llamada, así que no hay cruce que pueda fallar. Ese script no pasa por Google Sheets ni guarda historial — genera un HTML estático de un solo vistazo. Sirve de referencia, no de plantilla a seguir al pie de la letra (ver decisiones abajo).

## Objetivo

Migrar `obtenerAnunciosKadora()` (Apps Script) para que se alimente **exclusivamente** de Marketing API, eliminando el cruce por texto, conservando la arquitectura de pestañas semanales + `doGet()` que ya tiene el resto del sistema (historial, detección de nuevos/bajas, selector de semana).

## Fuera de alcance

- Preview de vídeo reproducible (se mantiene imagen/thumbnail estática también para anuncios en vídeo; ver Decisiones).
- KADORA Portugal: vive en **otra cuenta de Ads Manager**, todavía sin identificar — Mario lo confirmó en esta conversación. Cuando se aborde esa tarea, seguirá el mismo patrón de mapeo `account_id → residencia` que se introduce aquí, pero no se toca en esta migración.
- La pestaña Competencia no se toca — sigue dependiendo de Ad Library (`META_ACCESS_TOKEN`) porque no hay acceso de Marketing API a cuentas de terceros.
- Formato "Collage" y contenido nativo de Instagram: siguen sin imagen a propósito, igual que ahora (no se investiga su estructura en esta migración).

## Arquitectura nueva

**Antes:** dos llamadas independientes (Ad Library para datos, Marketing API para imagen) + cruce por texto normalizado como puente entre ambas.

**Después:** una sola llamada por cuenta publicitaria a Marketing API, iterando las cuentas de Kadora. Cada anuncio trae en la misma respuesta: id, texto, fecha, imagen y link al post real. No hace falta cruzar nada.

Como consecuencia, `META_ACCESS_TOKEN` deja de usarlo el proyecto Kadora — solo lo seguirá usando el Apps Script de Competencia. Esto reduce el mantenimiento manual de tokens para este proyecto (el de renovación cada ~60 días documentado en el CLAUDE.md pasa a afectar únicamente a Competencia).

## Cuentas publicitarias y mapeo de residencia

Mario confirmó el mapeo `account_id → residencia`, y que la clasificación por cuenta sustituye por completo a la detección por texto (`detectarResidencia`/`buscarCiudad` se eliminan):

| account_id | Residencia |
|---|---|
| `1309925056255281` | Granada |
| `1060996941437123` | Barcelona (22@) |
| `1674463280079393` | Barcelona (Sarrià) |
| `550388136263110` | Sevilla |
| `841600361572302` | Zaragoza |
| `655249645959790` | *(se excluye — no se consulta)* |

Las dos cuentas de Barcelona se unifican bajo la misma etiqueta "Barcelona". Cada anuncio hereda la residencia de la cuenta desde la que se obtuvo — sin excepciones ni casos ambiguos, porque la pertenencia a una cuenta es un hecho estructural, no una inferencia.

## Qué se elimina del Apps Script

- `construirIndiceImagenes` (la llamada secundaria a Marketing API para el índice de imágenes).
- `buscarImagenPorTexto`, `normalizarTexto`, `LONGITUD_MINIMA_CRUCE` (todo el mecanismo de cruce por texto).
- `detectarResidencia`, `buscarCiudad` (detección de ciudad por palabras clave en el texto).
- La llamada a `ads_archive` (Ad Library) dentro de `obtenerAnunciosKadora`.

Se conservan adaptados: `extraerTextosCreative`, `extraerImagenCreativo`, `obtenerImagenDePost` (fallback vía `full_picture` del post), `colorPorResidencia` (cosmético, para el Sheet).

## Datos por anuncio (Sheet y JSON)

Cada fila/entrada pasa a tener estos campos, todos obtenidos de la misma llamada a `/act_{id}/ads`:

- **id**: id real del anuncio en Marketing API. Campo nuevo — hoy el "id" para detectar nuevos/bajas se extrae a mano del parámetro `?id=` de la URL de Ad Library (`adId()` en `script.js`); con Marketing API la URL cambia de forma, así que hace falta guardarlo de forma explícita en vez de parsearlo de la URL.
- **residencia**: por mapeo de cuenta (tabla arriba), no por texto.
- **texto**: `creative.body`, con la misma cadena de fallbacks que ya usa el índice actual (`object_story_spec.link_data.message`, `video_data.message`, `asset_feed_spec.bodies[0]`), y si ninguno da resultado, el literal `"Anuncio en circulación"`. Este último fallback es obligatorio, no cosmético: `script.js` descarta silenciosamente cualquier entrada con `texto` vacío (línea ~93, filtro `item.texto && String(item.texto).trim()`), y eso rompería el invariante de que el total siempre cuadra con el nº de anuncios activos reales.
- **fecha_inicio**: `created_time` del anuncio.
- **url** ("Ver anuncio"): enlace directo a `facebook.com/{effective_object_story_id}` cuando existe. Si no (formatos Advantage+ sin post único), fallback a una búsqueda en la Ad Library pública filtrada por esa cuenta — igual que hace el script de Carol. Ya no lleva token incrustado, así que `doGet()` no necesita limpiarlo.
- **imagen**: `image_url` / `thumbnail_url` / `full_picture` del post, con el mismo criterio ya validado de omitir thumbnails 64×64 en vez de mostrar una imagen mala.

### Qué cuenta como "anuncio activo"

Filtro doble, como en el script de Carol (más fiable que solo `effective_status`, que a veces va con retraso):

1. `effective_status = ACTIVE` en la llamada a la API.
2. Comprobación adicional: `campaign.status == ACTIVE`, `adset.status == ACTIVE`, y que `stop_time`/`end_time` (si existen) no hayan pasado ya.

Incluye stories de Instagram si Marketing API las devuelve como anuncios activos — se listan igual que el resto, sin filtrarlas.

## Cambios en `script.js`

- `adId(url)` desaparece; donde se usaba (`getWeekAds`, `getBajasIds`, `getBajasAds`) pasa a leerse directamente `item.id` del JSON.
- `cleanAdLibraryUrl` deja de ser necesaria (no hay token que limpiar); el campo `url` del JSON se usa tal cual llega.
- Se añade `onerror` al `<img>` de cada tarjeta (`renderCards`, hoy en torno a la línea 651) para ocultar limpiamente una imagen que falle al cargar, en vez de mostrar el icono de imagen rota del navegador. Detalle adicional encontrado durante el diseño: las URLs de imagen de Marketing API son enlaces firmados de la CDN de Meta que se guardan una sola vez (el lunes) y se sirven durante toda la semana — si alguno caduca a mitad de semana, con este cambio la tarjeta simplemente se queda sin imagen en vez de romperse visualmente. No se investiga más a fondo la caducidad en esta migración (riesgo conocido, se revisa si se observa en producción).

## Detección de nuevos/bajas — sin cambios de criterio

Se mantiene exactamente la misma lógica ya validada (comparar el conjunto de `id` de la semana seleccionada contra la semana anterior, nunca por texto ni por fecha). Lo único que cambia es de dónde sale el `id`: antes se parseaba de la URL de Ad Library, ahora viene explícito del Marketing API.

**Semana de transición:** la primera semana tras el despliegue, el `id` cambia de namespace (de id de Ad Library a id de Marketing API), así que comparar contra la última pestaña antigua va a dar números sin sentido en "nuevos"/"bajas" (prácticamente todos los anuncios parecerán alta y baja a la vez). Es un problema de una sola semana, autoexplicativo por lo desproporcionado del número, y no se repite — no se añade lógica especial para detectarlo. Se avisa a Mario y a la jefa el día del despliegue para que lo tengan en cuenta esa semana concreta.

## Testing / rollout

No hay entorno de test automatizado en este proyecto (ver CLAUDE.md). Verificación manual:

1. Ejecutar `obtenerAnunciosKadora()` a mano desde el editor de Apps Script contra una pestaña de prueba, revisar el log (nº de anuncios por cuenta, nº con imagen encontrada).
2. Confirmar visualmente en el Sheet que las 5 cuentas aparecen con su residencia correcta y que no aparece nada de la cuenta excluida.
3. Publicar `doGet()` y comprobar el JSON crudo del endpoint (id, residencia, imagen, url por entrada).
4. Cargar la web en local (`python3 -m http.server 8931`) y comprobar: las imágenes cargan y corresponden al anuncio correcto al pinchar "Ver anuncio"; los KPIs de nuevos/bajas siguen cuadrando semana a semana (excepto la semana de transición, ver arriba).
