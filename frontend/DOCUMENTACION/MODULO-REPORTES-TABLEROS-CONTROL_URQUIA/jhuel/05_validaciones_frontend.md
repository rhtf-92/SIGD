# 05. Validaciones de Frontend - Filtros y Rangos

## Filtros de Entrada
* **Selector de Rango de Fechas:** Validación para impedir que la fecha de inicio sea posterior a la fecha final al consultar el tiempo promedio de respuesta.
* **Filtro por Dependencia / Área:** Lista desplegable dinámica que permite aislar los datos de una oficina específica para evaluar su cuelo de botella de manera independiente.

## Manejo de Estados Vacíos y Errores
* **Sin Datos en el Rango:** Si una oficina no registra trámites en el periodo seleccionado, el componente gráfico mostrará un mensaje amigable ("No hay registros para este periodo") en lugar de romperse.
* **Tiempos de Carga:** Indicadores de carga (*spinners*) en los contenedores de los gráficos mientras el backend procesa las consultas masivas de métricas.