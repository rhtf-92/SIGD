| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-REPORTES-TABLEROS-CONTROL-06 |
| **Módulo** | reportes-tableros-control / Reportes y Tableros de Control |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Clider Lex Urquia López, Lloner Vargas Huayunga, Jennifer Gatica Saavedra, Barbarán Gonzales |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 06. Arquitectura Frontend del Dashboard y Plan de Pruebas

## 1. Arquitectura Técnica del Frontend

El desarrollo del panel analítico del SIGD se fundamenta en una arquitectura por capas desacoplada y orientada al rendimiento:

* **React 19:** Primitivas de renderizado reactivo con gestión de transiciones concurrentes (`useTransition`) para evitar que el recálculo de gráficos bloquee la interacción del usuario.
* **TypeScript 5.9:** Tipado estricto para todas las cargas útiles de métricas, filtros y respuestas analíticas.
* **Vite 6:** Empaquetador modular que genera chunks independientes para las bibliotecas pesadas de gráficos, optimizando el tiempo de carga inicial (*First Contentful Paint* < 1.2s).
* **TanStack Query 5:** Gestión del ciclo de vida asíncrono, cacheo inteligente de consultas con tiempo de vida configurable (`staleTime: 60_000` ms) y revalidación en segundo plano al recuperar el foco de la ventana.
* **Axios 1.x:** Módulo HTTP con inyección de cabeceras de correlación (`X-Correlation-ID`) y normalización de errores tipados RFC 7807.

---

## 2. Diagrama de Flujo de Datos Analíticos

```text
[ Usuario Directivo ]
         │ Interactúa con Filtro de Fecha / Área
         ▼
[ DashboardView (React 19) ]
         │ Ejecuta Hook useDashboardData(filtros)
         ▼
[ TanStack Query v5 ]
         │ Verifica si los datos existen en caché
         ├── (Caché Válida) ──────────────► Renderizado Inmediato (< 50ms)
         └── (Caché Expirada / Nueva)
                     │
                     ▼
         [ Módulo HTTP Axios (X-Correlation-ID) ]
                     │ GET /api/v1/reportes/dashboard/resumen
                     ▼
         [ Backend SIGD Analítico ]
                     │ Consulta SQL agregada sobre histórico
                     ▼
         [ Base de Datos PostgreSQL ]
```

---

## 3. Plan Integral de Pruebas de Calidad (Test Plan)

Para asegurar la robustez, estabilidad y precisión del tablero ejecutivo frente a cargas masivas de datos documentarios, se define la siguiente batería formal de pruebas:

### CP-DASH-01: Carga Dinámica y Actualización Reactiva de Filtros
* **Objetivo:** Verificar que la modificación de los filtros de fecha o área actualice instantáneamente todos los gráficos y tarjetas sin recarga de página.
* **Procedimiento:**
  1. Ingresar al Dashboard como Administrador.
  2. Cambiar el filtro temporal de "Mes Actual" a "Semestre 2026-I".
  3. Comprobar que TanStack Query dispara la petición correspondiente y muestra el skeleton loader transitorio.
* **Criterio de Aceptación:** Los gráficos `LineChart` y `DoughnutChart` se actualizan con las nuevas coordenadas en menos de 500 ms y la URL refleja los parámetros de consulta.

### CP-DASH-02: Adaptabilidad Responsiva Multi-Dispositivo
* **Objetivo:** Comprobar la reorganización fluida de la interfaz en los distintos puntos de quiebre (*breakpoints*).
* **Procedimiento:**
  1. Emular resolución Desktop (1920x1080 px): Constatar cuadrícula de 4 columnas de KPIs y gráficos en paralelo.
  2. Redimensionar a Tablet (768x1024 px): Constatar reorganización en bloques de 2x2 columnas.
  3. Redimensionar a Mobile (375x667 px): Constatar apilamiento vertical a 1 columna y tabla de cuellos de botella con desplazamiento horizontal fluido.
* **Criterio de Aceptación:** Ningún componente genera desbordamiento horizontal en el viewport del navegador ni superposición de textos.

### CP-DASH-03: Activación de Umbrales Críticos de Alerta Semafórica
* **Objetivo:** Validar que cuando un indicador sobrepasa el umbral de tolerancia, el componente conmuta automáticamente su estado visual a rojo.
* **Procedimiento:**
  1. Inyectar en el mock de pruebas un dataset donde el área de Secretaría Académica posea un TPR de 56 horas (umbral crítico: > 48 hrs) y un 12% de expedientes atrasados (umbral crítico: > 10%).
  2. Cargar el Dashboard.
* **Criterio de Aceptación:** La tarjeta de KPI-04 conmuta a fondo rojo tenue (`bg-red-50 text-red-700`), la barra de alerta emite icono de advertencia y la Secretaría Académica encabeza el listado de cuellos de botella.

### CP-DASH-04: Degradación Elegante ante Datos Vacíos o División por Cero
* **Objetivo:** Asegurar que el sistema no presente pantallas en blanco (*White Screen of Death*) ante períodos sin actividad.
* **Procedimiento:**
  1. Seleccionar un rango de fechas futuro donde no existan expedientes registrados.
* **Criterio de Aceptación:** El porcentaje de eficiencia muestra `0%`, las tarjetas numéricas presentan el símbolo `--` y los gráficos despliegan la tarjeta amigable de "Sin datos disponibles".

### CP-DASH-05: Navegación por Teclado y Compatibilidad con Lectores de Pantalla
* **Objetivo:** Verificar la conformidad con las directivas de accesibilidad WCAG 2.1 AA.
* **Procedimiento:**
  1. Navegar por toda la consola del dashboard exclusivamente con la tecla `Tab` y barra espaciadora.
  2. Ejecutar lector de pantalla (NVDA / VoiceOver).
* **Criterio de Aceptación:** El foco visible bordea nítidamente cada selector interactivo y el lector anuncia los valores de los KPIs mediante sus atributos `aria-label`.
