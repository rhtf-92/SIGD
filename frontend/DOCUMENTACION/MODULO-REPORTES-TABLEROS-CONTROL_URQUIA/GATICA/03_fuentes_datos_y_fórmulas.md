# Fuentes de Datos, Endpoints y Fórmulas Matemáticas

## 1. Mapeo de Endpoints (Consumo de API)

| Indicador / Gráfico | Endpoint Frontend | Método | Estructura de Respuesta (JSON) |
| :--- | :--- | :--- | :--- |
| Tarjetas KPI | `/api/v1/reportes/dashboard/resumen` | GET | `{ total: number, pendientes: number, efectividad: number }` |
| Gráfico de Tendencias | `/api/v1/reportes/dashboard/tendencia` | GET | `[{ fecha: string, cantidad: number }]` |
| Gráfico de Estados | `/api/v1/reportes/dashboard/estados` | GET | `[{ estado: string, total: number }]` |

---

## 2. Fórmulas Matemáticas de los Indicadores

### 1. Tiempo Promedio de Respuesta (TPR)
$$\text{TPR} = \frac{\sum_{i=1}^{n} (\text{Fecha Finalización}_i - \text{Fecha Inicio}_i)}{N}$$
* **Donde:**
  * $n = N$: Cantidad total de solicitudes completadas en el rango de tiempo.
  * $(\text{Fecha Finalización} - \text{Fecha Inicio})$: Tiempo de resolución de cada ítem en horas.

### 2. Tasa de Eficiencia / Cumplimiento (%)
$$\text{Tasa de Cumplimiento} = \left( \frac{\text{Solicitudes Resueltas en Plazo}}{\text{Total de Solicitudes Recibidas}} \right) \times 100$$

### 3. Porcentaje de Variación de Período (Tendencia)
$$\Delta \% = \left( \frac{\text{Valor Período Actual} - \text{Valor Período Anterior}}{\text{Valor Período Anterior}} \right) \times 100$$

---

## 3. Manejo de Datos Especiales y Excepciones
* **Valores Nulos o Vacíos (`null`/`undefined`):** Se renderizan como `0` en gráficos de barras/líneas o `--` en las tarjetas KPI.
* **División por Cero:** Si el denominador es 0 (ej. sin registros recibidos), el resultado mostrado será `0%` para evitar fallos de renderizado (`NaN`).
* **Filtros de Entrada:** Todos los endpoints aceptan los parámetros `fecha_inicio` y `fecha_fin` para recalcular las métricas.