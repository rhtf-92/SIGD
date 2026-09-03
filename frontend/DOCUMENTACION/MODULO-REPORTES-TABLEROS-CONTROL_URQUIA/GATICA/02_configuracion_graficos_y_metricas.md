# Configuración Técnica de Gráficos y Métricas Visuales

## 1. Tecnologías y Librerías Utilizadas
* **Librería de Gráficos:** Chart.js / Recharts / ApexCharts (Adaptar según la librería de su proyecto)
* **Framework Frontend:** React / Angular / Vue
* **Estilos:** Tailwind CSS / CSS Modules

---

## 2. Definición de Gráficos del Dashboard

### Gráfico 1: Tendencia de Procesamiento Mensual
* **Tipo de Gráfico:** Líneas / Área (`LineChart`)
* **Propósito:** Mostrar la evolución temporal del volumen de datos/documentos.
* **Ejes:**
  * **Eje X (Horizontal):** Meses / Días del período seleccionado.
  * **Eje Y (Vertical):** Cantidad de documentos procesados.
* **Paleta de Colores:**
  * Línea principal: `#1E40AF` (Azul primario).
  * Área de relleno: `rgba(30, 64, 175, 0.1)`.

### Gráfico 2: Distribución de Documentos por Estado
* **Tipo de Gráfico:** Anillo / Pastel (`DoughnutChart`)
* **Propósito:** Visualizar la proporción de elementos según su estado actual (Completado, En Proceso, Pendiente, Rechazado).
* **Leyenda y Colores:**
  * **Completado:** `#10B981` (Verde)
  * **En Proceso:** `#3B82F6` (Azul)
  * **Pendiente:** `#F59E0B` (Amarillo)
  * **Rechazado / Cancelado:** `#EF4444` (Rojo)

### Gráfico 3: Rendimiento por Categoría / Departamento
* **Tipo de Gráfico:** Barras Horizontales (`BarChart`)
* **Propósito:** Comparar el volumen o efectividad entre distintas áreas organizacionales.
* **Ejes:**
  * **Eje X:** Porcentaje de cumplimiento (0% - 100%).
  * **Eje Y:** Nombre del departamento o categoría.

---

## 3. Especificaciones de Componentes Visuales (KPI Cards)

Cada tarjeta resumen (Metric Card) debe incluir:
1. **Título de la métrica.**
2. **Valor numérico principal:** Fuente de tamaño `24px` a `32px`, negrita.
3. **Indicador de tendencia:** Porcentaje de incremento o decremento respecto al periodo anterior (+12% ↑ en verde, -5% ↓ en rojo).
4. **Mini-gráfico (Sparkline):** Tendencia rápida de los últimos 7 días.