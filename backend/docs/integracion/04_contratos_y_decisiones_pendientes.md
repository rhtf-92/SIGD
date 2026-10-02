# Contratos, decisiones pendientes y revisión de CoreLink

**Proyecto:** SIGD — IESTP Suiza  
**Responsable de coordinación:** Ricardo Arévalo (`B_AREVALO`)  
**Estado:** consolidación de referencia; requiere confirmación bilateral de los grupos propietarios.  
**Actualizado:** 30 de septiembre de 2026

## Propósito y ubicación de los entregables

Este documento satisface el punto de entrada solicitado por el plan del Grupo 6 y evita mantener copias divergentes de los entregables extensos. Los documentos técnicos existentes siguen siendo la fuente de detalle:

| Entregable | Documento de referencia | Revisión de coordinación |
|---|---|---|
| Convenciones API | [`00_corelink/01_convenciones_api_backend.md`](../00_corelink/01_convenciones_api_backend.md) | Incluye reglas de rutas, JSON, HTTP, paginación y correlación. Las decisiones que allí figuran como propuesta o pendientes siguen sin aprobación institucional. |
| Errores y contexto | [`00_corelink/01_especificacion_middleware_rfc7807.md`](../00_corelink/01_especificacion_middleware_rfc7807.md) | Contrastar la forma y casing del error documentado con `src/middleware/error-middleware.ts` y los clientes que consumen `correlation_id`. La especificación no equivale a una aprobación de todos los módulos. |
| Auditoría y Outbox | [`00_corelink/02_arquitectura_auditoria_contexto_asynclocalstorage.md`](../00_corelink/02_arquitectura_auditoria_contexto_asynclocalstorage.md) | Comparar estados, garantías de entrega, campos y roles de BD con `src/audit/` y `migraciones/01_sigd_audit.sql`. Las garantías de atomicidad e inmutabilidad requieren evidencia E2E y aprobación del propietario. |
| Pruebas de integración | [`00_corelink/03_suite_pruebas_testcontainers_k6.md`](../00_corelink/03_suite_pruebas_testcontainers_k6.md) | Distinguir el plan de escenarios de las pruebas ejecutables; revisar dependencias y criterios de entrada/salida antes de declarar la integración cerrada. |
| Contratos entre módulos | [`00_corelink/04_contratos_intermodulares_unificados.md`](../00_corelink/04_contratos_intermodulares_unificados.md) | Mantiene la matriz ampliada, eventos, riesgos, checklist y registro de aprobaciones. Usar este documento como fuente de detalle contractual. |

## Matriz resumida de contratos

| Productor | Consumidor | Dato o servicio | Validación mínima | Estado actual |
|---|---|---|---|---|
| CoreLink | Todos | `correlation_id` por solicitud y formato común de errores | Propagar contexto de extremo a extremo; sanitizar detalles internos; validar contrato en cada consumidor | Parcialmente implementado en CoreLink; aprobación cruzada pendiente |
| TramiCore | RutaDoc | Expediente radicado y evento inicial | Identificador estable, existencia del tipo documental, creación y movimiento inicial coherentes | Pendiente de confirmación bilateral |
| IdentiCore | Todos | Identidad de persona, cuenta y operador | Acordar identificador canónico y reglas de vigencia; no asumir nombres de columnas entre esquemas | Pendiente de confirmación bilateral |
| OrganiCore | TramiCore, RutaDoc y Firma | Áreas, roles, permisos y facultades | Verificar área vigente y autorización para el alcance de la operación | Pendiente de confirmación bilateral |
| DocuCore | TramiCore y Firma | Tipos, requisitos, formularios y referencias S3 | Acordar versión documental, metadatos y propiedad de los objetos | Pendiente de confirmación bilateral |
| RutaDoc | TramiCore, OrganiCore y notificaciones | Movimientos, derivaciones, atención y estado | Validar transición permitida, operador, área y clave de idempotencia | Pendiente de confirmación bilateral |
| CoreLink / Outbox | Consumidores de eventos | Persistencia y despacho de eventos | Acordar esquema/versionado, idempotencia, reintentos y cuándo marcar procesado | Propuesto; garantías sujetas a pruebas y acuerdo de consumidores |

## Decisiones y pendientes

### Inventario estático del catálogo de endpoints

Comparé el catálogo de la sección 7.5 del plan con las declaraciones de rutas montadas en `src/app.ts` y sus routers. Este inventario es estático; no sustituye pruebas HTTP ni demuestra autorización correcta.

| Endpoints del plan | Estado observado en el árbol de rutas | Evidencia / nota |
|---|---|---|
| #1–13 Identidad y casilla | No encontrados | No hay router canónico de `auth`, `usuarios` o `casilla` montado en `src/app.ts`. |
| #14–20 Trámites y almacenamiento | No encontrados | No hay router canónico de radicación, trámites o presigned uploads montado. |
| #21–31 Expedientes y RutaDoc | No encontrados como conjunto canónico | `src/referencia/expediente.router.ts` expone rutas de demostración, entre ellas `POST /api/v1/expedientes` y `POST /api/v1/expedientes/derivar`; no implementa las rutas del catálogo para bandeja, detalle, trazabilidad y acciones. |
| #32–37 Resoluciones, firma y CVD | Parcial | Existe `GET /api/v1/firma/pendientes` (#56); no se encontraron las rutas #32–37 de este grupo. |
| #38–49 Administración y organización | No encontrados | No hay router canónico de administración/organigrama montado. |
| #50–54 Reportes | Encontrados | Dashboard, refresh, tiempos de atención y exportadores PDF/Excel están declarados en `src/modules/reportes/reportes.routes.ts`. |
| #55 Tiempo real SSE | Encontrado | `GET /api/v1/realtime/stream` está montado en `src/modules/corelink/realtime.routes.ts`. |
| #56 Cola de firma | Encontrado | `GET /api/v1/firma/pendientes` está montado en `src/modules/firma/firma.routes.ts`. |

**Resultado:** 7 de los 56 endpoints del catálogo aparecen implementados con su ruta canónica en esta rama; 49 no se encontraron como rutas canónicas. Hay además dos sondas operativas (`/health` y `/ready`) fuera del catálogo. Las rutas del router de referencia no se cuentan como implementación canónica de los endpoints que solo se parecen por nombre.

### Decisiones técnicas observables en esta rama

- El backend monta la API bajo `/api/v1`; las rutas de referencia legadas permanecen disponibles.
- El middleware de contexto crea un identificador de correlación y lo propaga mediante `AsyncLocalStorage`.
- El worker Outbox selecciona eventos pendientes con bloqueo de filas y reintentos.
- La actualización de vistas materializadas se expone como `POST /api/v1/reportes/vistas-materializadas/refresh` porque ejecuta una operación con efectos en el estado del sistema.

Estas observaciones describen código en la rama; no sustituyen revisión funcional, prueba de despliegue ni aprobación del Product Owner.

### Pendientes que bloquean declarar conformidad completa

1. Obtener aprobación registrada de cada grupo propietario para los contratos cruzados de identidad, organización, documentos, trámites y RutaDoc.
2. Confirmar el identificador de usuario canónico y las claves foráneas entre esquemas; los documentos existentes registran discrepancias aún abiertas.
3. Confirmar el contrato de eventos de RutaDoc y los consumidores responsables de idempotencia.
4. Ejecutar y adjuntar evidencia reproducible de migraciones, pruebas E2E, fallos/reintentos del worker y autorización por endpoint.
5. Comparar cada ruta del catálogo maestro con una ruta realmente montada y con una prueba que cubra autenticación, permisos, validación y respuesta.
6. Alinear el inventario oficial de migraciones: el repositorio contiene `01`–`07`, aunque partes del plan todavía describen seis scripts.
7. Resolver la atribución de `07_sigd_reportes.sql` y los servicios de reportes: los comentarios de los archivos atribuyen trabajo a Ricardo (`B_AREVALO`), mientras que el plan asigna la analítica a Reátegui y las exportaciones a Zevallos. La rama compartida no basta para determinar la autoría funcional individual; registrar la confirmación de los integrantes antes de cerrar créditos y RACI.

## Riesgos, responsables y evidencia de cierre

| Riesgo | Responsable de resolver | Evidencia necesaria | Estado |
|---|---|---|---|
| Identificadores de usuario y relaciones FK no coinciden entre módulos | IdentiCore y CoreLink | Decisión aprobada, DDL final y prueba de integración | Abierto |
| Evento Outbox se consume más de una vez o se marca procesado antes de completar | CoreLink y cada consumidor | Prueba con fallo/reintento, clave de idempotencia y resultado persistido | Abierto hasta evidencia reproducible |
| Contrato de transición/movimiento incompleto entre TramiCore y RutaDoc | TramiCore y RutaDoc | Aprobación bilateral y prueba del flujo radicación-derivación | Abierto |
| Inventario de endpoints y migraciones no coincide con el código | Sublíderes de dominio / integración | Matriz catálogo→ruta→prueba y secuencia DDL aprobada | Abierto |
| Autoría de la migración 07 y código de reportes difiere entre comentarios y plan RACI | Sublíderes CoreLink | Confirmación de autores y corrección del RACI o de metadatos del código | Abierto |
| Documento del Grupo 6 se confunde con aprobación de todos los equipos | B_AREVALO y líderes de módulo | Acta o registro de aprobación por contrato, con autor y fecha | Abierto |

## Lista de revisión de los entregables del Grupo 6

- [x] Los documentos de convenciones, errores, pruebas y contratos están presentes en `docs/00_corelink/`.
- [x] Se conserva la autoría declarada dentro de cada documento; la consolidación no cambia sus responsables.
- [x] Las matrices diferencian propuestas/pendientes de contratos confirmados y enumeran responsables y riesgos.
- [ ] Confirmar con cada autor y líder la versión que debe considerarse vigente; el registro de contratos todavía muestra aprobaciones pendientes.
- [ ] Adjuntar resultados actuales de ejecución de pruebas y despliegue; la presencia de pruebas escritas no demuestra que hayan pasado en esta revisión.
- [ ] Recibir revisión final de Geric y aprobación del Product Owner antes de declarar cierre institucional.

## Registro de revisión

### Ejecución local del 30 de septiembre de 2026

- `npm run typecheck`: aprobado.
- `npm run build`: aprobado.
- Pruebas unitarias sin dependencias externas: 28 aprobadas.
- Cobertura unitaria: 22.60% de líneas, 27.81% de funciones y 72.89% de ramas sobre todo `src/`; falló los umbrales globales configurados de 85% (líneas/funciones) y 80% (ramas).
- Pruebas de migración y Outbox con PostgreSQL: no ejecutadas; requieren Testcontainers y runtime Docker.
- E2E: no ejecutadas; en este entorno Testcontainers no encontró un runtime de contenedores.

### Evidencia histórica encontrada en el repositorio

- El 9 de septiembre de 2026 se registraron 12 archivos E2E y 23 casos aprobados (`docs/00_corelink/logs_pruebas/e2e-20260909-204737/`). Ese reporte declara que usó PostgreSQL 16 local, DDL real de auditoría y fixtures provisionales para los otros módulos. No acredita la ejecución actual sobre PostgreSQL 18 con migraciones canónicas `01`–`07` ni cubre las 15 suites actuales.
- Los logs k6 del mismo día registran P95 de 150.96 ms en radicación y 144.64 ms en derivación, 0% de errores y exit code 0 (`docs/00_corelink/logs_pruebas/k6-20260909-145820/`). La propia evidencia limita los resultados a una ejecución local en la misma máquina que PostgreSQL 16; no son una medición de producción ni UAT.

Las pruebas de migración/Outbox se separaron en `npm run test:db` para que no queden omitidas dentro de la suite unitaria normal. La suite `test:unit` queda libre de la inicialización de Docker. Los scripts Vitest usan el cargador `runner` para evitar el fallo de bundle de esbuild en esta ruta de OneDrive.

| Fecha | Revisor | Observación | Resultado |
|---|---|---|---|
| 2026-09-30 | B_AREVALO | Se localizaron los cuatro entregables del Grupo 6 bajo `docs/00_corelink/`; se consolidan aquí los enlaces y el estado de contratos. Los documentos registran aprobaciones bilaterales pendientes. | Revisión documental completada; cierre técnico/institucional pendiente |
| 2026-09-30 | B_AREVALO | La operación de refresco de vistas materializadas estaba publicada con método `GET`. Se cambió a `POST` en la implementación y el catálogo maestro para respetar la semántica de la operación. | Cambio aplicado; falta verificación automatizada |
