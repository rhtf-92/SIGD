| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-REPORTES-TABLEROS-CONTROL-05 |
| **Módulo** | reportes-tableros-control / Reportes y Tableros de Control |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Jhuel, Lloner, Clider Urquia |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 05. Navegación, Filtros Avanzados y Accesibilidad Universal (UX)

## 1. Navegación Institucional y Segmentación por Roles (RBAC)

El acceso al Módulo de Reportes y Tableros de Control está gobernado por el modelo de seguridad RBAC del SIGD, garantizando que cada usuario visualice únicamente los datos autorizados según su investidura institucional:

1. **Directores y Administradores del Sistema (`admin`, Dirección General):**
   - **Alcance Global:** Visibilidad completa e irrestricta de todas las dependencias, carreras profesionales, mesas de partes y despachos del instituto.
   - **Capacidades Exclusivas:** Comparativa cruzada de rendimiento interdepartamental, auditoría de cuellos de botella y exportación de padrones generales a MINEDU/DREU.
2. **Jefes de Unidad y Coordinadores de Carrera (`responsable`):**
   - **Alcance Restringido a su Dependencia:** La interfaz bloquea el selector global y fija automáticamente el filtro en su propia área (por ejemplo, el Jefe de Secretaría Académica solo visualiza expedientes académicos).
   - **Propósito:** Supervisar la carga de trabajo de sus propios operadores sin acceder a información sensible de otras jefaturas.

---

## 2. Barra de Filtros Avanzados y Validaciones de Entrada

La cabecera del Dashboard incorpora un panel de filtrado multidimensional con validación reactiva en tiempo de ejecución:

* **Selector de Rango de Fechas:**
  - *Validación Cruzada:* Impide programáticamente que la fecha de inicio sea cronológicamente posterior a la fecha de fin (`fechaInicio <= fechaFin`). En caso de error, el campo se resalta en borde rojo y despliega el mensaje accesible: *"La fecha inicial no puede ser posterior a la fecha de término"*.
  - *Atajos Rápidos (Presets):* Botones de un solo clic para `[Hoy]`, `[Últimos 7 Días]`, `[Mes Actual]`, `[Semestre 2026-I]` y `[Año Fiscal 2026]`.
* **Filtro Jerárquico por Dependencia:** Menú desplegable dinámico vinculado a las unidades activas del organigrama institucional (Secretaría Académica, Mesa de Partes, etc.).
* **Selector de Tipo de Procedimiento:** Permite aislar los indicadores de Solicitudes de Título, Actas Semestrales, Resoluciones o Trámites Generales.

---

## 3. Manejo de Estados Asíncronos, Pantallas Vacías y Errores

Para preservar la confianza del usuario y evitar interfaces congeladas:

1. **Indicadores de Carga (Skeleton Loaders):**
   Durante la invocación asíncrona a los endpoints analíticos, las tarjetas y contenedores de gráficos presentan estructuras esqueleto con gradiente animado (`animate-pulse bg-slate-200 rounded-lg`), preservando la geometría del diseño sin saltos visuales (*Layout Shifts*).
2. **Estados Vacíos Amigables (Empty States):**
   Si una búsqueda filtrada no arroja registros (por ejemplo, un área recién creada sin trámites radicados), el componente gráfico es sustituido por una tarjeta limpia con ilustración institucional y el mensaje: *"No se registran trámites para los criterios seleccionados"*, sugiriendo restablecer los filtros.
3. **Manejo de Errores Tipados (RFC 7807):**
   Si el backend experimenta una indisponibilidad temporal, el dashboard presenta un banner de contingencia con botón de reintento manual (`[Reintentar Consulta]`).

---

## 4. Directivas de Accesibilidad Universal (WCAG 2.1 Nivel AA)

El dashboard cumple rigurosamente con los lineamientos internacionales de accesibilidad web:

* **No Dependencia Exclusiva del Color (Diseño para Daltonismo):**
  Las alertas de retraso no se comunican únicamente con color rojo o verde. Cada estado semafórico va acompañado de iconografía distintiva (icono de exclamación `⚠` para alerta crítica, icono de verificación `✓` para meta cumplida) y texto explicativo.
* **Relación de Contraste Cromático:** Todos los textos principales cumplen un ratio de contraste mínimo de `4.5:1` sobre sus fondos, y los elementos gráficos interactivos un ratio mínimo de `3:1`.
* **Navegación Asistida por Teclado:**
  - Orden lógico de tabulación (`Tab` / `Shift+Tab`) a través de los filtros, tarjetas interactivas y botones de exportación.
  - Indicador visible de foco (`focus:ring-2 focus:ring-blue-600 focus:outline-none`).
* **Soporte para Lectores de Pantalla (ARIA):**
  - Cada gráfico estadístico incluye la propiedad `role="img"` con una descripción alternativa (`aria-label`) que sintetiza verbalmente el dato clave (ej. `aria-label="Gráfico de distribución: 85% completados, 10% en proceso, 5% atrasados"`).
  - Las regiones dinámicas que se actualizan al aplicar filtros están marcadas con `aria-live="polite"` para notificar las nuevas cifras sin interrumpir la navegación del usuario con discapacidad visual.
