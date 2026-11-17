# Mini Shiny app that redirects the old address https://ginius.shinyapps.io/Ginius/
# to the new Quarto website. Deploy it with the SAME name as the old app:
#   rsconnect::deployApp("tools/redirect_app", appName = "Ginius")
library(shiny)
nueva <- "https://jfmunozrosas.github.io/ginius/"   # <- cambiar por la URL definitiva

ui <- fluidPage(
  tags$head(
    tags$script(HTML(sprintf("window.top.location.replace('%s');", nueva))),
    tags$meta(`http-equiv` = "refresh", content = paste0("0; url=", nueva))
  ),
  h3("GiniUs has moved"),
  p("If you are not redirected automatically, go to ",
    a(nueva, href = nueva, target = "_top"))
)
server <- function(input, output, session) {}
shinyApp(ui, server)
