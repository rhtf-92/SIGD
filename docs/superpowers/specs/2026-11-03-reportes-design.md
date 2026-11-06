# Diseño: Reportes y tableros SIGD

**Fecha:** 2026-11-03  
**Rama objetivo:** `F_BARTRA`  
**Fuente funcional:** `frontend/docs/06_reportes-tableros-control/00_plan_de_trabajo_y_evaluacion_docente.md`

## Intención

Completar la pestaña Reportes para que sus filtros, métricas, visualizaciones y exportaciones reflejen los datos del SIGD y funcionen con estados claros de carga, vacío y error. El usuario principal es Dirección, jefaturas y control institucional.

## Objetivos

- Respetar las rutas canónicas `/api/v1/reportes/...` y alinear los filtros enviados con la selección visible.
- Presentar VTEP, TPR, TRO y TEO con las fórmulas del documento M06, valores neutros ante denominadores cero y sin `NaN`/`Infinity`.
- Hacer utilizables el tablero y sus filtros en móvil, tablet y escritorio.
- Hacer accesibles por teclado y lector de pantalla los gráficos y el análisis de cuellos de botella; identificar riesgo con texto o iconos además del color.
- Entregar exportaciones locales desde los datos ya consultados: PDF vectorial A4 y Excel `.xlsx`, incluyendo período/filtros y fecha de emisión, con caracteres españoles legibles.
- Mantener contratos TypeScript estrictos y manejo comprensible de errores.

## Fuera de alcance

- Cambiar el modelo institucional MGD o inventar datos/endpoints.
- Modificar módulos distintos de Reportes, salvo integración necesaria de navegación.
- Declarar métricas ficticias como datos reales cuando el backend no las proporcione.

## Restricciones y criterios de aceptación

- Stack y patrones existentes: React 19, TypeScript, Vite, Vitest y cliente HTTP actual.
- El tablero consume handlers activos de `F_BARTRA`: `GET /api/v1/reportes/dashboard/resumen`, `/tendencias`, `/cuellos-botella` y `/tiempos-atencion`. La exportación activa del frontend se genera localmente a partir de datos ya cargados; esta rama no monta los handlers heredados de exportación del backend.
- Fórmulas exactas y criterios de borde establecidos en la guía M06; horas hábiles excluyen fines de semana y feriados cuando la fuente los permita.
- WCAG 2.1 AA: contraste de texto 4.5:1, interacción por teclado y semántica accesible.
- No usar datos de demostración como sustituto silencioso de respuestas fallidas del backend.

## Enfoques considerados

1. Completar la interfaz y las integraciones existentes, ampliando backend solo donde el contrato documentado no exista. **Recomendado:** conserva el diseño actual y hace demostrable cada función con datos reales.
2. Reemplazar Reportes por una solución nueva: duplicaría componentes y elevaría el riesgo de regresiones.
3. Conservar únicamente el tablero actual: no cubriría las funciones descritas por la asignación.

## Decisión propuesta

Seguir el enfoque 1. Mantener la página y servicios actuales donde sean correctos; integrar con las rutas que efectivamente registra el backend de `F_BARTRA`, completar filtros, accesibilidad, exportación local y errores. No se agregarán alias duplicados solo para reflejar rutas antiguas de la guía, salvo que otra parte del sistema dependa de ellas. Si falta un dato/operación requerido, documentar la brecha y agregar la capacidad en la capa SIGD existente en vez de simular éxito en el navegador.

## Trabajo pendiente para implementación

Auditar cada endpoint, fórmula, exportador, breakpoint y flujo accesible en `F_BARTRA`; acordar cualquier discrepancia entre contrato documental y backend antes de escoger un contrato nuevo. Dividir el plan de implementación en tareas independientes para Reportes y Administración.

