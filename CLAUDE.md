# Kadora — Monitor de Anuncios Activos (Meta Ads)

Dashboard web que visualiza los anuncios activos en Meta de Kadora (cadena de residencias universitarias: Granada, Barcelona, Sevilla, Zaragoza, General), pensado para compartir con el cliente/jefa de Mario. Sustituye una tabla plana de Google Sheets por una web visual y filtrable.

## Arquitectura (tres capas independientes)

1. **Fuente de datos (no tocar sin cuidado, es lo esencial):** un Google Sheet recibe una pestaña nueva cada lunes, escrita por un Apps Script (`obtenerAnunciosKadora`) que llama a la Meta Graph API (`ads_archive`) para el page id `100149119120066`. Un Web App `doGet()` en ese mismo Apps Script agrega **todas** las pestañas semanales en un único JSON:
   `https://script.google.com/macros/s/AKfycbyo1RZpEf9csEmcrxpLDIKumlYqb7stqULRzwxuEfPLwJ0Y00j3hsy1vJgTYKFla8ZQ/exec`
   Este endpoint es la fuente de datos en vivo — la web lo consulta en cada carga, no hay ninguna copia estática de los anuncios en este repo.
2. **Frontend:** HTML/CSS/JS sin framework (`index.html`, `style.css`, `script.js`, carpeta `assets/`). Colores y tipografía son los reales de la marca (sacados de kadora.es): navy `#0C2340`, coral `#E56A54`, azul `#307FE2`, verde azulado `#279989`, fuente "Outfit".
3. **Despliegue:** repo de GitHub `nhmarionicolas-sys/kadora-dashboard` (rama `main`) conectado a Netlify para auto-deploy → `https://splendid-longma-5ecf40.netlify.app` (este es el link que ya tiene la jefa de Mario). Cualquier `git push` a `main` se publica solo en ese link, normalmente en menos de un minuto. La credencial de GitHub está guardada en el llavero de macOS (`credential.helper=osxkeychain`), así que `git push` no debería pedir usuario/token.

## Decisiones clave (no obvias por el código)

- **"Anuncio nuevo esta semana"** se define ÚNICAMENTE como `fecha_inicio` posterior a la extracción de la semana anterior — nunca comparando el texto del anuncio entre semanas. Esto es a propósito: una primera versión comparaba por texto y daba un número distinto al de la variación total, lo cual confundió a Mario dos veces seguidas. El KPI "🆕 Anuncios nuevos esta semana" y el filtro "Solo nuevos esta semana" DEBEN seguir usando la misma definición para no romper esa coherencia.
- **Nunca colapsar/ocultar anuncios con el mismo texto como si fueran "duplicados".** Se comprobó con datos reales que cada fila con texto idéntico tiene un ID de anuncio de Meta distinto — son anuncios activos genuinamente diferentes (mismo copy, distinta creatividad/audiencia/ubicación). El toggle "Agrupar por texto compartido" es opcional y, aun agrupando, debe conservar el conteo real y el enlace de cada anuncio individual.
- **El `access_token` de Meta nunca debe salir del Apps Script.** `ad_snapshot_url` de la API de Meta lleva el token incrustado; `doGet()` lo limpia server-side (función `limpiarUrlAnuncio`) reconstruyendo un enlace público `https://www.facebook.com/ads/library/?id=...`. No basta con limpiarlo solo en el frontend, porque el JSON crudo del endpoint es público.
- El selector de semana muestra **solo** los datos de la semana elegida — nunca se suman varias semanas por defecto (un bug anterior sumaba todas las pestañas y daba 117 en vez de los ~63 activos reales de esa semana).

## Pendiente / a vigilar

- El `access_token` de Meta de Mario estuvo expuesto en texto plano (en el script y en chat) y brevemente en el JSON público antes del fix. Debe rotarlo, e idealmente sustituirlo por un token de **"Usuario del sistema" (System User)** desde el Business Manager de Meta, que no caduca cada ~60 días como un token de usuario/página normal. También convendría mover el token a `PropertiesService` de Apps Script en vez de tenerlo hardcodeado en el script.
- No se muestran imágenes/miniaturas reales del anuncio: Mario no tiene acceso actualmente a la cuenta publicitaria de Kadora en Ads Manager (haría falta la Marketing API con permisos `ads_read`). Revisar si recupera el acceso.

## Cómo probar cambios

No hay build ni dependencias. Para ver cambios en local:
```
cd ~/Documents/kadora-dashboard && python3 -m http.server 8931
```
y abrir `http://localhost:8931`. Para publicarlos: `git add -A && git commit -m "..." && git push` (Netlify despliega solo).
