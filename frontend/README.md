# Frontend del SIGD

Este directorio contiene la estructura preliminar del frontend del Sistema Integral de Gestión Documentaria (SIGD) del Instituto Suiza. El proyecto tiene un propósito académico y servirá como base para construir la interfaz de usuario que consumirá la API del backend una vez definidas las capacidades de gestión documentaria requeridas por la institución.

## Arquitectura basada en componentes

React organiza la interfaz en componentes reutilizables e independientes. En el SIGD, esta organización se complementa con una separación de responsabilidades: las páginas representan las pantallas de la aplicación; las rutas centralizan la navegación y permitirán proteger el acceso a pantallas privadas; los servicios concentrarán el consumo de la API; y TanStack Query administrará el estado asíncrono con almacenamiento en caché.

Esta estructura no define todavía los módulos ni los flujos de la aplicación y no implementa funcionalidades de negocio.

## Tecnologías previstas

| N.° | Tecnología | Versión objetivo | Uso dentro del SIGD |
|-----|------------|------------------|----------------------|
| 1 | React | 19.x | Biblioteca principal basada en componentes para la interfaz de usuario. |
| 2 | TypeScript | 5.x | Lenguaje principal del frontend con tipado estático. |
| 3 | Vite | 6.x | Herramienta de construcción, empaquetado y servidor de desarrollo rápido. |
| 4 | Tailwind CSS | 4.x | Framework de estilos por clases de utilidad para el diseño adaptable. |
| 5 | React Router DOM | 7.x | Gestión de enrutamiento, navegación entre pantallas y protección de rutas. |
| 6 | Axios | 1.x | Cliente HTTP para realizar peticiones y consumir la API del backend. |
| 7 | TanStack Query | 5.x | Gestión de estado asíncrono, almacenamiento en caché y sincronización de datos. |

## Estructura

- `index.html`: documento HTML único que sirve de punto de montaje de la aplicación.
- `vite.config.ts`: configuración de Vite con los plugins de React y Tailwind CSS, y el alias `@` hacia `src`.
- `src/main.tsx`: punto de entrada; monta la aplicación y provee los contextos de React Router y TanStack Query.
- `src/App.tsx`: componente raíz que compone la estructura general.
- `src/api`: cliente HTTP de Axios configurado para comunicarse con el backend.
- `src/assets`: recursos estáticos importables (imágenes, fuentes).
- `src/components`: componentes reutilizables de interfaz compartidos entre pantallas.
- `src/config`: lectura y validación de las variables de entorno de la aplicación.
- `src/hooks`: hooks personalizados de React, incluidos los de consumo de datos con TanStack Query.
- `src/layouts`: estructuras de página compartidas (encabezado, navegación, pie).
- `src/pages`: pantallas de la aplicación asociadas a una ruta.
- `src/routes`: definición centralizada de rutas y futura protección de acceso.
- `src/types`: tipos e interfaces compartidos de TypeScript.
- `src/utils`: utilidades técnicas reutilizables.
- `public`: archivos estáticos servidos tal cual (favicon).

## Alcance actual

Esta etapa contiene solamente una base técnica extensible: la pantalla inicial de muestra, los proveedores de enrutamiento y de estado asíncrono configurados, y un cliente HTTP sin endpoints. No incluye módulos de negocio, autenticación ni protección de rutas.

La definición de áreas, roles, permisos, módulos y flujos documentarios depende todavía del levantamiento institucional. No se asumirán estas definiciones antes de contar con información validada.

La estructura es preliminar y puede modificarse después de la revisión y validación del profesor responsable del proyecto.

## Configuración local futura

El archivo `.env.example` documenta variables de entorno de ejemplo sin credenciales reales. Cuando se habilite el entorno de desarrollo, deberá copiarse como `.env` y adaptarse localmente; `VITE_API_BASE_URL` debe apuntar a la URL base de la API del backend.

Las dependencias están declaradas en `package.json`, pero no se instalan como parte de esta primera etapa. Para habilitar el entorno de desarrollo será necesario ejecutar `npm install` y luego utilizar `npm run dev`.