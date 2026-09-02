# Catálogo de Indicadores y KPIs - Módulo de Reportes y Tableros de Control

## 1. Introducción
El presente documento define los Indicadores Clave de Rendimiento (KPIs) e indicadores operativos implementados en el Módulo de Reportes y Tableros de Control del sistema SIGD.

## 2. Matriz General de KPIs

| Código | Nombre del Indicador | Categoría | Tipo de Métrica | Frecuencia de Actualización | Meta / Umbral |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **KPI-01** | Total de Documentos Procesados | Operativo | Total Acumulado | Tiempo Real | >= 95% del total asignado |
| **KPI-02** | Tiempo Promedio de Respuesta | Rendimiento | Promedio (Horas) | Diario | <= 24 horas |
| **KPI-03** | Tasa de Solicitudes Completadas | Eficiencia | Porcentaje (%) | Semanal | >= 90% |
| **KPI-04** | Documentos Pendientes / Atrasados | Alerta | Conteo actual | Tiempo Real | <= 5% |

---

## 3. Detalle de los Indicadores

### KPI-01: Total de Documentos Procesados
* **Descripción:** Mide el volumen total de documentos o tramitaciones procesadas con éxito en un período seleccionado.
* **Objetivo:** Monitorear el flujo total de trabajo y volumen operativo del sistema.
* **Niveles de Alerta:**
  * **Verde (Óptimo):** Cumple o supera el volumen esperado según la carga histórica.
  * **Amarillo (Atención):** Desviación del 10% por debajo del rango esperado.
  * **Rojo (Crítico):** Caída de más del 20% en el procesamiento habitual.

### KPI-02: Tiempo Promedio de Respuesta
* **Descripción:** Calcula el tiempo medio (en horas o días) desde que un registro/documento ingresa al sistema hasta su cierre o resolución.
* **Objetivo:** Reducir los cuellos de botella e incrementar la agilidad administrativa.
* **Niveles de Alerta:**
  * **Verde:** < 24 Horas.
  * **Amarillo:** Entre 24 y 48 Horas.
  * **Rojo:** > 48 Horas.

### KPI-03: Tasa de Solicitudes Completadas
* **Descripción:** Proporción de solicitudes resueltas satisfactoriamente frente al total de solicitudes recibidas.
* **Objetivo:** Evaluar la efectividad en la atención de tramitaciones.

### KPI-04: Documentos Pendientes / Atrasados
* **Descripción:** Mide la cantidad de elementos que han sobrepasado su tiempo máximo de atención definido por las normas del sistema.
* **Objetivo:** Identificar áreas críticas que requieran reasignación de recursos.