# GiniUs website

Website of the research project **GiniUs** (PID2022-136235NB-I00): *Challenges for the analysis of inequality with applications in the Social Sciences: using new methodological developments to avoid biases and errors in the Gini index*. Funded by MICIU/AEI/10.13039/501100011033 and by ERDF/EU.

Built with [Quarto](https://quarto.org) and published with GitHub Pages from the `docs/` folder.

## Pasos para publicarla (resumen)

1. Abrir `ginius.Rproj` en RStudio.
2. En la pestaña *Terminal*: `quarto render` (descarga los datos del Banco Mundial y del INE y genera `docs/`).
3. Crear el repositorio `ginius` en GitHub y subir todo:
   `git init`, `git add .`, `git commit -m "GiniUs website"`, `git branch -M main`,
   `git remote add origin https://github.com/jfmunozrosas/ginius.git`, `git push -u origin main`.
4. En GitHub: *Settings → Pages → Branch: main, folder: /docs*.
5. Cambiar `site-url` y el enlace de GitHub en `_quarto.yml` si la dirección es otra.
6. Contador de visitas: crear una cuenta en <https://www.goatcounter.com> con el código `ginius` y activar *Allow adding visitor counts on your website* (si el código no está libre, cambiarlo en `_goatcounter.html` y `_survey.qmd`).
7. Redirigir la web antigua: desplegar `tools/redirect_app/app.R` con el nombre `Ginius` en shinyapps.io (`rsconnect::deployApp("tools/redirect_app", appName = "Ginius")`). Guardar antes una copia del código de la app antigua.

## Dónde se edita cada cosa

| Qué | Fichero |
|---|---|
| Estado del proyecto (barra de progreso) | `_status.md` |
| Noticias | `news.qmd` |
| Publicaciones | `publications.qmd` |
| Seminarios y congresos | `dissemination.qmd` |
| Equipo | `team.qmd` |
| Objetivos y plan de trabajo | `project.qmd`, `results.qmd` |
| Herramientas interactivas (motor de cálculo) | `js/gini-sim.js` |
| Calculadora | `calculator.qmd`, `js/calculator-ui.js`, `js/csv-parse.js` |
| Colores y estilos | `styles.scss` |
| Encuesta de satisfacción y suscripción | `_survey.qmd`, `_subscribe.qmd` (opcional: Formspree, Buttondown) |

## Requisitos

R (paquetes base) para descargar los datos del observatorio al renderizar. Las herramientas interactivas se ejecutan en el navegador (Observable JS, webR) y no necesitan servidor.

## Vídeos de un minuto ("Our research in one minute")

Los textos de cada vídeo están en `tools/videos.json`. Para crear o actualizar vídeos (requiere Python con Pillow y ffmpeg):
`python3 tools/make_paper_videos.py render <slug>` (o sin slug para todos). Se guardan en `media/videos/` (MP4 y portada JPG). Después hay que añadir la tarjeta en `videos.qmd`, una entrada en el blog y el enlace "▶ 1-min video" en la columna `video` de `data/publications.csv`.

## Página "Impact" y datos de publicaciones (útil para sexenios e informes)

- `data/publications.csv`: una fila por artículo (año, temas `ineq;water;tour;firm`, título, revista, miembros, JCR, ABS, **DOI**, **enlace en acceso abierto** (DIGIBUG/Zenodo), vídeo). La tabla de Publicaciones y la página Impact se generan a partir de este fichero: basta con completar DOIs y enlaces de acceso abierto y volver a renderizar.
- `data/impact_log.csv`: una fila por actividad de difusión (fecha, tipo, actividad, miembros, enlace): seminarios, congresos, prensa, The Conversation, charlas, colaboración con instituciones, uso en docencia…
- `data/training.csv`: tesis, TFM, contratos predoctorales, estancias, etc. La sección solo aparece cuando tiene alguna fila.
- Las citas (Dimensions) y la atención online (Altmetric) se actualizan solas a partir del DOI. Las visitas, usos de la calculadora, ejercicios R y reproducciones de vídeos se cuentan con GoatCounter.
- Botón "Print or save this page as a PDF report" en la página Impact: guardar una copia fechada para cada evaluación.
