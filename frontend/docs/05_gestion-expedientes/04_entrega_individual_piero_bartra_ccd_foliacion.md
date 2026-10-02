# Entrega individual — Piero Bartra Montalvo — F_BARTRA
ENT-M03-04: CCD. ENT-M03-05: visor y validador de foliación.

## Implementación
Selector CCD jerárquico accesible, visor F. [0001], cálculo estricto de rangos a partir del último folio, bloqueo de rangos incorrectos y modal con sugerencia. Consultas HTTP reales a /api/v1/expedientes/clasificador-ccd y /api/v1/expedientes/:id/foliacion. La vista conectada muestra series/subseries entregadas por el servidor sin inventar fondo ni secciones, valida la respuesta, cancela consultas al cambiar de expediente y muestra errores de acceso o contrato.

## Revisión
Con las dependencias del ZIP F_BARTRA: npm run build y npm test. 107 pruebas aprobadas. Construcción de la página independiente: npx vite build --config vite.ccd.config.ts. Para abrir en desarrollo: npm run dev y navegar a /ccd-individual.html, con VITE_API_BASE_URL configurada y sesión válida.

## Bloqueos comprobados en el backend del ZIP main
construirApp en backend/src/app.ts no monta crearRouterRutaDoc ni crearRouterDocuCore. Sus rutas de consulta y de escritura existen en código pero no se publican desde esa aplicación. El catálogo predeterminado del backend es explícitamente de ejemplo, no oficial, y ofrece series/subseries sin fondo ni secciones. El endpoint de foliación no entrega imágenes o URL de páginas. La confirmación de escritura permanece deshabilitada en la vista conectada. No se simula registro ni se garantiza persistencia de extremo a extremo.
La compilación completa de main tiene 48 errores previos; la primera comparación con la entrega no añadió errores. La rama F_BARTRA del navegador figura 153 commits detrás de main. Entregar por Pull Request; no sustituir el proyecto completo ni fusionar main sin revisión del ingeniero.

## Validación manual pendiente
Acceso al servidor desplegado con usuario autorizado, catálogo oficial, visualización de imágenes reales y persistencia. Las pruebas HTTP verifican contratos con respuestas de prueba, no una base de datos en producción.
