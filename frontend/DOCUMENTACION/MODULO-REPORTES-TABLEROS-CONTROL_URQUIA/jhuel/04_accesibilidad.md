# 04. Criterios de Accesibilidad - Visualización de Reportes

## Estándares de Diseño Accesible
* **Contraste de Colores:** Los gráficos de rendimiento y las alertas de cuellos de botella (por ejemplo, uso de rojo para retrasos críticos y verde para tiempos óptimos) deben cumplir con la normativa de contraste WCAG AA para asegurar legibilidad a personas con daltonismo.
* **Navegación por Teclado:** Todos los filtros de fecha, selectores de área y elementos interactivos del dashboard deben ser accesibles utilizando la tecla Tab y comandos de teclado.
* **Etiquetas ARIA:** Los componentes gráficos y tablas de datos contarán con descripciones alternativas (`aria-label`) para que los lectores de pantalla puedan interpretar las métricas de tiempo y los volúmenes de trámites retrasados.