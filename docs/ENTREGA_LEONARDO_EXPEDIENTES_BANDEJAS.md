# Entrega de revisión: Expedientes y Bandejas

**Responsable:** Leonardo
**Fecha:** 18 de octubre de 2026
**Rama:** `codex/leonardo-expedientes-bandejas`
**Base:** `origin/main`

## Funcionalidades verificadas

- RutaDoc expone `GET /api/v1/expedientes` con `pestana` obligatoria, `limite`, `terminoBusqueda`, `fechaDesde`, `fechaHasta` y paginación por `cursor`. Su respuesta contiene `elementos`, `siguienteCursor`, `tieneMas` y `contadores`.
- Las seis bandejas reales del backend son Pendientes, En trámite, Derivados, Por firmar, Atendidos y Archivados. El frontend anterior usaba estados incompatibles y suponía un arreglo plano de expedientes.
- `GET /api/v1/expedientes/:id` entrega un detalle reducido: CUT, asunto, estado, fecha, área, resumen de documentos y último movimiento. No entrega nombre de solicitante, clasificación CCD, imágenes de folios ni fecha límite de SLA.
- La búsqueda actual del backend cubre CUT y asunto. No cubre solicitante. Los filtros de fecha están disponibles. El área se filtra mediante `areaId` UUID, pero la nueva vista no lo presenta mientras no exista un catálogo autorizado de áreas.
- El resultado vacío se representa en la vista. Los errores de red o permiso muestran mensaje y opción de reintento.

## Cambios realizados

- Se añadió un hook tipado para las lecturas de RutaDoc con parámetros reales y caché separada para listado y detalle.
- La bandeja conectada consulta una sola página por cursor, muestra los contadores del servidor y permite buscar por CUT/asunto y filtrar por fechas. Al cambiar filtros vuelve a la primera página; un rango de fechas inválido no inicia una consulta.
- El detalle conectado consulta por ID y muestra solamente campos presentes en el contrato. También consulta la trazabilidad completa y reutiliza la vista conectada de CCD/foliación. Se retiraron de esta vista las acciones que no se pueden validar con el estado actual del backend.
- Las fechas de radicación se muestran en UTC, igual que los filtros por día del backend.
- Las páginas anteriores se conservan para el modo de demostración `VITE_ENABLE_MOCKS=true`; los componentes CCD, foliación y modales de otros responsables no se modificaron.

## Hallazgos pendientes que requieren coordinación

1. **Acceso privado (prioridad alta):** en `backend/src/app.ts`, el proveedor JWT predeterminado declara `puedeVerExpediente: () => true`. El servicio de detalle confía en esa función; el listado comprueba rol, pero no filtra la visibilidad por expediente. La corrección requiere acordar con Bartra la política de roles, pertenencia a área y autorización para cada expediente. No debe considerarse seguro publicar esta bandeja hasta cerrarla.
2. **Operaciones de escritura (prioridad alta):** la vista anterior ofrecía derivar, observar y acumular con IDs de áreas de demostración. Los endpoints de `derivaciones.controller.ts` usan contratos/esquemas distintos a los de las lecturas canónicas y no validan `puedeVerExpediente` en cada operación. No se habilitaron desde la vista conectada. Se requiere definir la autorización y probar las transiciones reales con base de datos antes de reactivarlas.
3. **Búsqueda por solicitante:** el contrato de listado sólo dispone del identificador del remitente. Incorporar el nombre requiere integrar la fuente autorizada de IdentiCore y definir qué usuarios pueden verlo.
4. **CCD, foliado y SLA:** se reutiliza la vista conectada de CCD/foliación de Bartra. El endpoint no entrega imágenes de páginas ni el detalle entrega SLA; esas prestaciones siguen pendientes.

## Archivos de esta rama

- `frontend/src/hooks/useRutaDocExpedientes.ts` y su prueba.
- `frontend/src/pages/expedientes/BandejaExpedientesPage.tsx`.
- `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx`.
- `frontend/src/pages/expedientes/BandejaExpedientesMockPage.tsx` y `ExpedienteDetalleMockPage.tsx` (preservación de la demostración).
- `frontend/src/pages/expedientes/RutaDocPages.test.tsx`.
- Este informe.

## Pruebas

- `npm run typecheck` en frontend y backend: sin errores.
- `npm test` en frontend: 49 archivos, 425 pruebas aprobadas.
- `npm test -- --run src/hooks/useRutaDocExpedientes.test.tsx src/pages/expedientes/RutaDocPages.test.tsx`: 2 archivos, 8 pruebas aprobadas.
- `npm run build` en frontend: construcción completada; Rollup reporta aviso de tamaño de bundle y anotaciones de Zod.
- `eslint` sobre los siete archivos TypeScript modificados: sin errores. El lint global del frontend termina con 12 errores y 3 advertencias en archivos fuera de esta entrega.
- No se ejecutaron pruebas de integración con PostgreSQL ni verificación de permisos con usuarios reales. El riesgo de autorización señalado sigue abierto.

## Texto propuesto para el PR

**Título:** `fix(expedientes): conectar bandejas y detalle al contrato RutaDoc`

**Descripción:** Se corrigen listado, detalle, seis bandejas, búsqueda CUT/asunto, fechas y paginación por cursor en la interfaz conectada. La demostración anterior permanece disponible con mocks. Incluye pruebas de contrato HTTP y de vista. Solicito revisión de Bartra sobre el riesgo de autorización del proveedor JWT y las operaciones de escritura; esos cambios no están incluidos en este PR. No integrar hasta cerrar los hallazgos de seguridad.
