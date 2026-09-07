| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-REPORTES-TABLEROS-CONTROL-03 |
| **Módulo** | reportes-tableros-control / Reportes y Tableros de Control |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Clider Lex Urquia López, Lloner Vargas Huayunga, Jennifer Gatica Saavedra, Barbarán Gonzales |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 03. Fuentes de Datos, Endpoints y Fórmulas Matemáticas

## 1. Mapeo de Endpoints REST del Dashboard

La capa de visualización frontend consume datos analíticos agregados a través de la API REST del backend (`/api/v1/reportes/dashboard/...`), diseñada para retornar respuestas serializadas de alto rendimiento con tiempos de latencia inferiores a 200 milisegundos:

| Indicador / Componente | Endpoint Backend | Método | Parámetros Query | Payload JSON de Respuesta |
| :--- | :--- | :---: | :--- | :--- |
| **Tarjetas Maestras KPI** | `/api/v1/reportes/dashboard/resumen` | `GET` | `fechaInicio`, `fechaFin`, `areaId` | `{ totalProcesados: number, tprHoras: number, tasaCompletitud: number, atrasadosCriticos: number, deltaMensual: number }` |
| **Gráfico de Tendencias** | `/api/v1/reportes/dashboard/tendencia` | `GET` | `periodo` (`semanal`\|`mensual`), `anio` | `Array<{ fecha: string, radicados: number, resueltos: number }>` |
| **Distribución por Estados** | `/api/v1/reportes/dashboard/estados` | `GET` | `fechaInicio`, `fechaFin` | `Array<{ estado: string, total: number, porcentaje: number }>` |
| **Cuellos de Botella** | `/api/v1/reportes/dashboard/cuellos-botella`| `GET` | `limite` (default 5) | `Array<{ areaId: number, nombreArea: string, estancados: number, tprPromedio: number, nivelAlerta: string }>` |

---

## 2. Formalización de Fórmulas Matemáticas

Para garantizar la reproducibilidad y rigor analítico de las métricas presentadas, se definen los siguientes modelos matemáticos formales:

### 2.1. Tiempo Promedio de Respuesta (TPR)
Calcula el promedio de permanencia de los expedientes atendidos dentro del rango temporal seleccionado:

$$\text{TPR} = \frac{1}{N} \sum_{i=1}^{N} \Delta t_i = \frac{1}{N} \sum_{i=1}^{N} \left( t_{\text{cierre}, i} - t_{\text{ingreso}, i} \right)$$

*Donde:*
* $N$: Número total de expedientes culminados o despachados en el período.
* $t_{\text{ingreso}, i}$: Marca temporal oficial de recepción del expediente $i$.
* $t_{\text{cierre}, i}$: Marca temporal de resolución o derivación formal del expediente $i$.
* $\Delta t_i$: Tiempo neto de atención contabilizado en horas hábiles institucionales (excluyendo horario inhábil y feriados).

### 2.2. Tasa de Eficiencia y Completitud (\%)
Proporción porcentual de requerimientos resueltos favorablemente dentro de los plazos normativos del TUPA institucional:

$$\text{Eficiencia} = \left( \frac{\text{Total de Expedientes Resueltos en Plazo}}{\text{Total de Expedientes Recibidos en el Período}} \right) \times 100$$

### 2.3. Porcentaje de Variación de Período ($\Delta\%$)
Determina la tasa de crecimiento o reducción de un indicador en relación con el ciclo temporal precedente (semana anterior, mes anterior o año fiscal previo):

$$\Delta\% = \left( \frac{\text{Valor Periodo Actual} - \text{Valor Periodo Anterior}}{\text{Valor Periodo Anterior}} \right) \times 100$$

---

## 3. Tratamiento de Casos de Borde y Excepciones Numéricas

El código frontend implementa protecciones rigurosas para evitar fallos de renderizado (`NaN`, `Infinity` o desbordamientos visuales):

1. **División por Cero:**
   Si el denominador en cualquiera de las fórmulas resulta ser $0$ (por ejemplo, inicio de año sin expedientes aún radicados o ausencia de trámites en un área), la función de cómputo intercepta la operación y retorna de forma segura `0%` o `0.00`:
   ```typescript
   export function calcularTasaEficiencia(resueltos: number, recibidos: number): number {
     if (!recibidos || recibidos <= 0) return 0;
     return Math.round((resueltos / recibidos) * 100 * 100) / 100;
   }
   ```
2. **Valores Nulos o Indefinidos (`null` / `undefined`):**
   - En gráficos vectoriales (Chart.js / Recharts): Los puntos sin valor se renderizan como cero (`0`) continuo para no interrumpir el trazado de la línea.
   - En tarjetas de KPIs (`StatCard`): Si el valor no ha sido calculado, se muestra el marcador formal de doble guión institucional (`--`), indicando disponibilidad pendiente de datos.
3. **Validación de Filtros Cronológicos:**
   La interfaz inhabilita la ejecución de la consulta si `fechaInicio > fechaFin`, emitiendo una advertencia inline de corrección.

---

## 4. Estructura de Datos Analítica (DBML)

El backend soporta estas consultas mediante un esquema analítico optimizado formalizado en `diagrama_metricas_dashboard.dbml`, el cual pre-calcula los agregados diarios en la tabla `historico_metricas_diarias` y categoriza los expedientes en `registros_reportes` para evitar bloqueos por consultas pesadas sobre las tablas transaccionales de expedientes.
