| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-REPORTES-TABLEROS-CONTROL-02 |
| **Módulo** | reportes-tableros-control / Reportes y Tableros de Control |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Gatica, Clider Urquia |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 02. Catálogo Oficial de Indicadores Clave de Rendimiento (KPIs)

## 1. Introducción y Marco de Medición

El Catálogo de Indicadores del SIGD formaliza los parámetros cuantitativos y cualitativos empleados por el IESTP "Suiza" para medir la eficiencia administrativa, el cumplimiento de los plazos normativos (SLA) de la Ley N° 27444 y la capacidad de respuesta de las distintas áreas operativas.

Los indicadores se agrupan en cuatro indicadores clave (KPI-01 a KPI-04) complementados con métricas secundarias de cuellos de botella y dispersión de carga de trabajo.

---

## 2. Matriz Maestra de KPIs Institucionales

| Código | Denominación del Indicador | Categoría | Tipo de Métrica | Frecuencia de Actualización | Meta Institucional |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **KPI-01** | Total de Documentos Procesados | Operatividad | Volumen Acumulado | Tiempo Real | $\ge 95\%$ del total radicado |
| **KPI-02** | Tiempo Promedio de Respuesta (TPR) | Celeridad | Horas / Días Hábiles | Diaria / Continua | $\le 24\text{ horas}$ por instancia |
| **KPI-03** | Tasa de Solicitudes Completadas | Eficiencia | Porcentaje $(\%)$ | Semanal / Mensual | $\ge 90\%$ de expedientes resueltos |
| **KPI-04** | Documentos Atrasados / Críticos | Alerta de Riesgo | Conteo de Expedientes | Tiempo Real | $\le 5\%$ del total en trámite |

---

## 3. Especificación Detallada y Umbrales Semafóricos

### 3.1. KPI-01: Total de Documentos Procesados
* **Descripción:** Cuantifica el volumen neto de trámites, proveídos, decretos y resoluciones gestionados exitosamente en el período seleccionado.
* **Objetivo:** Monitorear la capacidad de absorción operativa frente a los picos de matrícula semestral y campañas de titulación.
* **Umbrales Semafóricos:**
  - **Verde (Óptimo):** Despacho $\ge 95\%$ de la carga histórica esperada.
  - **Ámbar (Atención):** Desviación entre $10\%$ y $20\%$ por debajo de la media histórica.
  - **Rojo (Crítico):** Descenso $> 20\%$ en la productividad habitual del personal.

### 3.2. KPI-02: Tiempo Promedio de Respuesta (TPR)
* **Descripción:** Promedio aritmético de las horas hábiles transcurridas desde la recepción del expediente en un área hasta su derivación o resolución definitiva.
* **Objetivo:** Prevenir el vencimiento de términos procesales e identificar demoras injustificadas en la evaluación de expedientes.
* **Umbrales Semafóricos:**
  - **Verde (En Meta):** $\text{TPR} \le 24\text{ horas hábiles}$.
  - **Ámbar (Precaución):** Entre $24$ y $48\text{ horas hábiles}$.
  - **Rojo (Retraso Severo):** $> 48\text{ horas hábiles}$ (incurre en riesgo de apercibimiento administrativo).

### 3.3. KPI-03: Tasa de Solicitudes Completadas (Eficiencia)
* **Descripción:** Proporción porcentual de expedientes que alcanzan el estado `RESUELTO` satisfactoriamente dentro del plazo máximo normativo del TUPA institucional.
* **Objetivo:** Evaluar la tasa de éxito final del trámite frente a la ciudadanía y egresados.
* **Umbrales Semafóricos:**
  - **Verde:** $\ge 90\%$.
  - **Ámbar:** Entre $75\%$ y $89.9\%$.
  - **Rojo:** $< 75\%$.

### 3.4. KPI-04: Documentos Pendientes / Atrasados (Alerta de Cuellos de Botella)
* **Descripción:** Conteo instantáneo de expedientes que superan la fecha límite máxima calculada por el motor de calendario laboral del SIGD.
* **Objetivo:** Disparar notificaciones y alertas directas a los directivos para redistribución de personal o priorización urgente.
* **Umbrales Semafóricos:**
  - **Verde:** $\le 5\%$ de expedientes en mora.
  - **Ámbar:** Entre $5.1\%$ y $10\%$.
  - **Rojo:** $> 10\%$ de expedientes estancados (alerta roja institucional).

---

## 4. Detección de Cuellos de Botella por Dependencia

El sistema complementa los KPIs con un ranking automatizado de unidades orgánicas ordenado de mayor a menor retención de expedientes:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ CLASIFICACIÓN DE CUELLOS DE BOTELLA INSTITUCIONALES (TIEMPO REAL)      │
├───────┬──────────────────────────┬──────────────┬──────────┬───────────┤
│ Puesto│ Dependencia Orgánica     │ Trámites Ret.│ Promedio │ Estado    │
├───────┼──────────────────────────┼──────────────┼──────────┼───────────┤
│ 1     │ Secretaría Académica     │ 38 trámites  │ 54.2 hrs │ [ CRÍTICO ]│
│ 2     │ Unidad de Administración │ 14 trámites  │ 31.0 hrs │ [ ALERTA  ]│
│ 3     │ Mesa de Partes Central   │ 3 trámites   │  6.5 hrs │ [ ÓPTIMO  ]│
│ 4     │ Dirección General        │ 2 trámites   │ 11.2 hrs │ [ ÓPTIMO  ]│
└───────┴──────────────────────────┴──────────────┴──────────┴───────────┘
```

Esta matriz orienta las acciones preventivas antes de que se configuren causales de silencio administrativo o quejas por retardo injustificado.
