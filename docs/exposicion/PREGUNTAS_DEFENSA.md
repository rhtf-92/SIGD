# Preguntas Probables de Defensa y Respuestas Técnicas — SIGD

**Versión base:** rama `B_GERIC`, commit `3e652ead`.

---

### 1. ¿Cómo garantizan que un usuario no ejecute una acción solo ocultando un botón en React?
**Respuesta:** La interfaz usa `accionesPermitidas` del endpoint `/api/v1/expedientes/:id/resumen` solo como guía visual, pero la autoridad definitiva está en el backend: cada endpoint mutante (`derivar`, `recepcionar`, `asignar`, `atender`, `enviar-a-firma`, `resolver`, `archivar`) valida JWT (`verificarTokenAcceso`), contexto (`INSTITUCIONAL` vs `PERSONAL`), rol, custodia (`tieneCustodiaEfectiva`) y transición FSM en servidor, devolviendo HTTP `403` o `422` ante cualquier intento directo por API.
**Código real:** `evaluarCapacidadesExpediente` en [derivaciones.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/derivaciones.service.ts) y middlewares en [derivaciones.controller.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/derivaciones.controller.ts).

---

### 2. ¿Por qué `responsable_ingles_demo` sí puede ver `Derivar` pero `especialista_demo` no?
**Respuesta:** Pertenecer al área `SDA` no otorga facultad de derivación. La función `verificarFacultadDerivacion` exige que el rol `ESPECIALISTA` posea un perfil operativo activo con permiso `EXPEDIENTE_DERIVAR` o una delegación vigente en `sigd_org.responsabilidad_temporal`. En laboratorio, `responsable_ingles_demo` tiene perfil `GESTOR_AREA_ACADEMICA` con `EXPEDIENTE_DERIVAR`, mientras `especialista_demo` carece de ese permiso.
**Código real:** `verificarFacultadDerivacion` en [derivaciones.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/derivaciones.service.ts).

---

### 3. ¿Cómo evitan que un Director emita resolución saltándose la evaluación académica del Certificado de Inglés?
**Respuesta:** Para procedimientos TUPA con unidad responsable técnica (`p1-fila-06` define `DIR` receptora, `SDA` responsable técnica y `DIR` resolutiva), `consultarEstadoEtapaTecnicaTupa` bloquea tanto derivaciones ordinarias que pretendan omitir `SDA` como `enviarAFirmaExpediente` / `resolverExpedienteConFirma` si no existe asignación activa y dictamen técnico registrado en `sigd_rut.movimiento_tramite`.

---

### 4. ¿Cómo funciona la integridad documental entre PostgreSQL, MinIO y el Validador CVD?
**Respuesta:** Al preparar o emitir una resolución, `resoluciones.service.ts` genera los bytes PDF A4 reales con `a4GeneratorService` (`pdf-lib`), estampa el QR y la banda CVD con `CvdStampService`, calcula el SHA-256 sobre los bytes estampados (`crypto.createHash('sha256')`), verifica `%PDF-` y hash no vacío, y los sube a MinIO (`resoluciones/<id>.pdf`). Luego `validadorCvd.controller.ts` valida el registro en `sigd_doc.firma_digital_documento`, comprueba existencia real en MinIO mediante `headObject` y clasifica la firma (`FIRMA_LABORATORIO` vs `FIRMA_DIGITAL_OFICIAL`).

---

### 5. ¿La firma DNIe mostrada en el demo tiene valor legal ante RENIEC o INDECOPI?
**Respuesta:** No en este entorno de laboratorio. Se utiliza `MockDniProvider` y un certificado emitido por `IESTP SUIZA LAB / SIGD TEST ROOT CA` (`proveedor_firma = 'MOCK_TEST'`). Tanto la API (`/api/v1/validador/cvd/:cvd`) como la interfaz ([CvdIntegrityReport.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/components/cvd/CvdIntegrityReport.tsx)) distinguen explícitamente este dictamen como *"Firma de laboratorio verificada (pruebas / demo)"* para evitar suplantar valor legal oficial.

---

### 6. ¿Qué pasa con la trazabilidad si alguien intenta borrar o alterar un movimiento en PostgreSQL?
**Respuesta:** La tabla `sigd_rut.movimiento_tramite` es WORM (*Write-Once-Read-Many*). Posee el trigger `tr_bloquear_mutacion_movimiento` (`BEFORE DELETE OR UPDATE`) y `tr_bloquear_truncate_movimiento`, de modo que PostgreSQL rechaza cualquier modificación o eliminación histórica, mientras `tr_estado_actual_movimiento` actualiza automáticamente la proyección `sigd_rut.estado_actual_expediente`.

---

### 7. ¿Cómo se notifica a un ciudadano que inició su trámite presencialmente sin cuenta?
**Respuesta:** Por privacidad y prevención BOLA, `DestinoCasilla` ([despachador-notificaciones.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/audit/despachador-notificaciones.ts)) **nunca autovincula una cuenta por coincidencia de DNI**. Deposita el registro en `sigd_auth.notificacion_casilla` con `usuario_id = NULL` y estado `PUESTA_A_DISPOSICION`. El ciudadano puede consultar el estado público vía `/consulta` (sin documentos privados ni rutas S3), y solo obtiene acceso completo y descarga con cédula `ACUSE_GENERADO` cuando registra su cuenta y Mesa de Partes aprueba su solicitud en `sigd_tra.solicitud_vinculacion_expediente`.

---

### 8. ¿Por qué el tablero directivo mostraba ceros inicialmente y cómo se calculan los KPIs?
**Respuesta:** El tablero consulta las vistas materializadas `sigd_tra.mv_kpis_mgd_mensual` y `sigd_tra.mv_tiempos_retencion_area`, que no se habían refrescado tras la carga de expedientes; además `tendencias(anio)` sobrescribía las áreas del mismo mes en vez de sumarlas. Tras ejecutar `REFRESH MATERIALIZED VIEW CONCURRENTLY`, sumar los contadores multiárea en [mgdAnalytics.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/corelink/mgdAnalytics.service.ts) y exponer `estados` en [reportes.controller.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/corelink/reportes.controller.ts), los KPIs reflejan los registros reales de PostgreSQL.

---

### 9. ¿Cómo evitan que las pruebas de integración contaminen la base de datos de laboratorio?
**Respuesta:** Tanto [circuito-bloque3-completo.spec.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/tests/integration/rutadoc/circuito-bloque3-completo.spec.ts), [circuito-bloque4-completo.spec.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/tests/integration/rutadoc/circuito-bloque4-completo.spec.ts) como [circuito-completo-certificado-ingles-e2e.spec.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/tests/integration/rutadoc/circuito-completo-certificado-ingles-e2e.spec.ts) envuelven toda la ejecución en una transacción PostgreSQL (`BEGIN` → `SAVEPOINT` para subtransacciones → `ROLLBACK` en `afterAll`) y limpian objetos S3 creados en MinIO.
