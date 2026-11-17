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
