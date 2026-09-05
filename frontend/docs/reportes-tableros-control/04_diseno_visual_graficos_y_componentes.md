| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-REPORTES-TABLEROS-CONTROL-04 |
| **Módulo** | reportes-tableros-control / Reportes y Tableros de Control |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Gatica, Jhuel, Lloner |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 04. Diseño Visual, Gráficos Estadísticos y Componentes UI

## 1. Lineamientos de Diseño y Tokens Institucionales

El diseño visual del Dashboard del SIGD se basa en la identidad corporativa del IESTP "Suiza" combinada con los estándares de diseño gubernamental de la Plataforma Digital Única del Estado Peruano (GOB.PE). El sistema implementa la paleta de colores de **Tailwind CSS 4**:

* **Azul Institucional Primario (`#1E40AF` - `blue-800`):** Utilizado para cabeceras principales, líneas maestras de tendencia y botones de acción principal.
* **Azul Claro Secundario (`#3B82F6` - `blue-500`):** Indicador de trámites en proceso de evaluación ordinaria.
* **Verde Éxito (`#10B981` - `emerald-500`):** Representa expedientes resueltos satisfactoriamente, cumplimiento de metas y variaciones positivas ($\Delta\% \uparrow$).
* **Ámbar Advertencia (`#F59E0B` - `amber-500`):** Trámites próximos a vencer o unidades con retrasos incipientes.
* **Rojo Alerta Crítica (`#EF4444` - `red-500`):** Expedientes atrasados fuera de plazo normativo, cuellos de botella severos y caídas operativas.

---

## 2. Configuración Técnica de Gráficos Estadísticos

Los componentes de gráficos se integran utilizando bibliotecas optimizadas para React 19 (Chart.js con `react-chartjs-2` o Recharts) con renderizado vectorial responsivo:

### 2.1. Gráfico 1: Tendencia Temporal de Expedientes (`LineChart`)
* **Propósito:** Visualizar la evolución cronológica del ingreso y resolución de trámites a lo largo de las semanas o meses del año académico.
* **Ejes:**
  - *Eje Horizontal (X):* Semanas o meses del año académico (Ene - Dic).
  - *Eje Vertical (Y):* Cantidad de expedientes procesados (escala entera continua).
* **Parámetros de Estilo:**
  - Línea de Radicados: Color `#1E40AF`, grosor `2.5px`, relleno `rgba(30, 64, 175, 0.08)`.
  - Línea de Resueltos: Color `#10B981`, grosor `2.5px`, trazo continuo.
  - Curvatura suave: Tensión cúbica bézier `tension: 0.35`.

### 2.2. Gráfico 2: Distribución de Expedientes por Estado (`DoughnutChart`)
* **Propósito:** Mostrar instantáneamente la proporción global del archivo documental activo.
* **Segmentación y Paleta Oficial:**
  - `Completado / Resuelto`: `#10B981` (Verde Esmeralda).
  - `En Proceso / Trámite`: `#3B82F6` (Azul Cielo).
  - `Pendiente / Observado`: `#F59E0B` (Ámbar Dorado).
  - `Rechazado / Desestimado`: `#EF4444` (Rojo Carmesí).
* **Corte Central:** Radio interno del anillo `cutout: '70%'`, dejando espacio central para el valor total acumulado en tipografía destacada.

### 2.3. Gráfico 3: Desempeño y Retención por Dependencia (`BarChart` Horizontal)
* **Propósito:** Comparar visualmente la celeridad y volumen de expedientes retenidos entre las unidades orgánicas (Secretaría Académica, Mesa de Partes, Administración, Jefaturas de Carrera).
* **Ejes:**
  - *Eje X:* Tiempo promedio de atención (en horas hábiles) o porcentaje de eficacia (0% a 100%).
  - *Eje Y:* Unidades orgánicas del organigrama institucional.
* **Interacción:** Al hacer clic sobre una barra, el dashboard filtra automáticamente la tabla inferior para listar los expedientes de dicha área.

---

## 3. Especificación de Tarjetas de Métricas (Metric KPI Cards)

Cada tarjeta resumen (`MetricCard.tsx`) se estructura formalmente para brindar claridad visual inmediata:

```text
┌──────────────────────────────────────────────────────────────────┐
│ TIEMPO PROMEDIO DE RESPUESTA (TPR)                         [ ⏱ ] │
│                                                                  │
│   18.4 hrs                                  +12% vs mes anterior │
│   [████████░░░░░░░░░░] Meta: <= 24 hrs           ▲ En meta (Verde)│
│                                                                  │
│   Tendencia últimos 7 días: ╭─-─-─╮                              │
│                             │     │ Sparkline SVG                │
└──────────────────────────────────────────────────────────────────┘
```

1. **Título de la Métrica:** Tipografía `text-xs font-semibold text-slate-500 uppercase tracking-wide`.
2. **Valor Numérico Principal:** Tipografía `text-3xl font-bold text-slate-900` con su unidad de medida explícita (hrs, %, expedientes).
3. **Indicador de Tendencia ($\Delta\%$):** Chip verde con flecha ascendente (`+12% ↑`) o rojo con flecha descendente (`-5% ↓`).
4. **Mini-Gráfico Vectorial (Sparkline):** Gráfico SVG ligero de 7 puntos sin ejes que ilustra la trayectoria semanal sin sobrecargar el DOM.
5. **Barra de Progreso frente a Meta:** Micro-barra horizontal mostrando el porcentaje alcanzado respecto al umbral objetivo institucional.
