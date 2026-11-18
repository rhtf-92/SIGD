# Guía Técnica del Backend (Node.js + Express + PostgreSQL + MinIO) — SIGD

**Versión base:** rama `B_GERIC`, commit `3e652ead`.

---

## 1. Arquitectura Modular y Composición HTTP

El servidor backend está organizado por dominios acotados en `backend/src/domains/` sobre núcleo transversal (`backend/src/core/` y `backend/src/middleware/`):

- **Core:** `core/auth` (`jwt.service.ts`, `authorization.service.ts`), `core/storage` (`s3-storage.service.ts`, `storage.router.ts`).
- **Dominios:**
  - `tramicore`: radicación virtual y presencial (`mesaPartesDigital.service.ts`, `ventanillaPresencial.service.ts`, `tupaVersion.repository.ts`, `vinculacionHistorica.service.ts`, `tramites.controller.ts`).
  - `tesoreria`: órdenes de cobro, recibos, devoluciones y webhook Demo QR (`tesoreria.router.ts`, `tesoreria.service.ts`, `tesoreria.repository.ts`).
  - `rutadoc`: máquina de estados FSM, derivaciones, recepciones, asignaciones, dictámenes y archivado (`rutadoc.fsm.ts`, `derivaciones.controller.ts`, `derivaciones.service.ts`, `expedienteAsignacion.service.ts`, `rutadoc.controller.ts`).
  - `docucore`: generación PDF A4, estampa QR+CVD, firma DNIe y validador público (`a4Generator.service.ts`, `cvdStamp.service.ts`, `resoluciones.service.ts`, `dnieFirma.service.ts`, `validadorCvd.controller.ts`).
  - `identicore`: login, rotación de sesiones, contextos y Casilla Electrónica (`auth.router.ts`, `casilla.router.ts`).
  - `organicore`: áreas jerárquicas `ltree`, roles, perfiles y usuarios admin.
  - `corelink`: analítica MGD, vistas materializadas y SSE (`mgdAnalytics.service.ts`, `mgdAnalytics.repository.ts`, `reportes.controller.ts`).
- **Ensamblaje central:** `construirApp(pool, opciones)` en [app.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/app.ts) registra seguridad (`corsMiddleware`, `securityHeadersMiddleware`), parsers segmentados (`50mb` para ingesta documental/firma, `2mb` estándar), `contextMiddleware`, sondas `/health` y `/ready`, todos los routers bajo `/api/v1` y `errorMiddleware`.

---

## 2. JWT, Contextos y Autorización por Rol, Custodia y Asignación

1. **Autenticación JWT HS256:** [jwt.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/core/auth/jwt.service.ts) firma y verifica tokens (`firmarTokenAcceso`, `verificarTokenAcceso` usando `crypto.timingSafeEqual`). Los middlewares en [app.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/app.ts) (`requireInstitutionalRole`, `requireAdminRole`, `requireSuperAdminRole`) rechazan sin token (`401`) o sin rol (`403`).
2. **Motor contextual fail-closed:** [authorization.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/core/auth/authorization.service.ts) resuelve cuenta, persona, vínculos laborales, asignaciones, responsabilidades temporales y perfiles operativos en tiempo real (`resolverContextoAutorizacion`, `autorizar`), separando contexto `PERSONAL` de `INSTITUCIONAL`.
3. **Evaluación de capacidades y guardas de RutaDoc:**
   - `evaluarCapacidadesExpediente` en [derivaciones.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/derivaciones.service.ts) calcula `accionesPermitidas` comprobando: contexto no personal, anti-autoatención (`esTitular`), exclusión de `ADMINISTRADOR` técnico puro y `TESORERIA`, custodia física del área (`tieneCustodiaArea` o encargatura vigente en `sigd_org.responsabilidad_temporal`), estado FSM, pago confirmado y requisitos TUPA.
   - `verificarFacultadDerivacion` en [derivaciones.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/derivaciones.service.ts) concede derivación por rol a `DIRECTOR`, `SECRETARIO` y `MESA_PARTES`, mientras exige a `ESPECIALISTA` tener permiso explícito `EXPEDIENTE_DERIVAR` en `sigd_org.asignacion_perfil_operativo` o delegación activa en `responsabilidad_temporal`.
   - En `GET /api/v1/expedientes/:id/asignacion` ([derivaciones.controller.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/derivaciones.controller.ts)), solo personal institucional autorizado en contexto `INSTITUCIONAL` (sin conflicto de autoatención) recibe el `nombreCompleto` del especialista asignado; de lo contrario se sanitiza.

---

## 3. FSM, TUPA, Derivaciones, Asignaciones y Dictámenes

- **FSM congelada ([rutadoc.fsm.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/rutadoc.fsm.ts)):** Define 10 estados (`REGISTRADO` → `RECEPCIONADO` → `EN_CALIFICACION` → `DERIVADO` → `EN_REVISION` ↔ `OBSERVADO`/`SUBSANADO` → `EN_FIRMA` → `RESUELTO` → `ARCHIVADO`). Todas las transiciones se registran de forma inmutable en `sigd_rut.movimiento_tramite` (protegida por el trigger WORM `tr_bloquear_mutacion_movimiento`) y se proyectan automáticamente a `sigd_rut.estado_actual_expediente`.
- **Vínculo TUPA y etapa técnica obligatoria:** Procedimientos como `p1-fila-06` (*Certificado de Inglés*) tienen `unidad_receptora_id = DIR`, `unidad_responsable_id = SDA` y `unidad_resolutiva_id = DIR`. `consultarEstadoEtapaTecnicaTupa` en [derivaciones.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/derivaciones.service.ts) impide usar derivaciones ordinarias para saltarse `SDA`, y `enviarAFirmaExpediente` bloquea la elevación a firma si falta asignación activa y dictamen técnico registrado.
- **Asignaciones ([expedienteAsignacion.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/expedienteAsignacion.service.ts)):** `asignarExpediente` valida vigencia de la cuenta en `SDA`, desactiva asignaciones previas y emite el evento Outbox `ExpedienteAsignado`; `obtenerAsignacionActiva` une `sigd_auth.persona_natural` para resolver el nombre del especialista.

```ts
// Ejemplo real: backend/src/domains/rutadoc/rutadoc.fsm.ts
export function puedeTransicionar(estadoActual: unknown, evento: unknown): boolean {
  return (
    esEstadoRutaDoc(estadoActual) &&
    esEventoRutaDoc(evento) &&
    TRANSICIONES_RUTADOC[estadoActual][evento] !== undefined
  );
}
```

---

## 4. Tesorería, PDF Institucional A4, MinIO y Validador CVD

1. **Tesorería ([tesoreria.router.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/tesoreria/tesoreria.router.ts), [tesoreria.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/tesoreria/tesoreria.service.ts)):** Cuando un trámite TUPA tiene costo (`monto = 100.00` en `p1-fila-06`), el expediente se radica en `PENDIENTE_PAGO`. Al confirmar el pago en Tesorería se genera `codigo_recibo` (`REC-YYYY-...`) y el expediente transiciona a `REGISTRADO`, desbloqueando la derivación. El router expone `GET /api/v1/tesoreria/demo-qr/config` para consultar el modo Sandbox Demo QR.
2. **Generación PDF A4 y Estampa CVD ([a4Generator.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/docucore/a4Generator.service.ts), [cvdStamp.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/docucore/cvdStamp.service.ts), [resoluciones.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/docucore/resoluciones.service.ts)):**
   - `generarActoResolutivoInstitucional` arma el contenido administrativo (`VISTO`, `CONSIDERANDO`, `SE RESUELVE`), carga el escudo auténtico `backend/assets/logo-suiza.png` en `MembreteInstitucional.logoPng`, genera bytes PDF A4 reales (`pdf-lib`), estampa código QR y banda marginal CVD sin invadir el margen útil (`width - 64`), valida cabecera `%PDF-` y `hashSha256 !== SHA256_CONTENIDO_VACIO`, y sube los bytes reales a MinIO (`resoluciones/<id>.pdf`).
3. **Firma DNIe y Validador Público CVD ([dnieFirma.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/docucore/dnieFirma.service.ts), [validadorCvd.controller.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/docucore/validadorCvd.controller.ts)):**
   - `verificarYRegistrarFirmaDnie` valida la firma RSA-SHA256 sobre el hash binario, guarda el registro en `sigd_doc.firma_digital_documento` (`cvd`, `sha256_firmado`, `proveedor_firma`, `certificado_emisor`) y copia el artefacto bajo `firmados/<id>.pdf` en MinIO.
   - `crearVerificadorCvd` verifica en tiempo real que el hash no sea vacío (`e3b0c44...`) y que el objeto exista en MinIO (`headObject`); además clasifica `naturalezaFirma` en `FIRMA_LABORATORIO`, `FIRMA_DIGITAL_OFICIAL` o `EVIDENCIA_INCOMPLETA`, devolviendo `documento: null` y `descarga_copia_certificada: null` para preservar privacidad pública.
4. **Notificación Outbox ([despachador-notificaciones.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/audit/despachador-notificaciones.ts), [casilla.router.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/identicore/casilla.router.ts)):**
   - `DestinoCasilla` deposita la notificación con clave idempotente `notif:<id_evento>:casilla` en estado `PUESTA_A_DISPOSICION`. En expedientes sin `id_usuario_creador`, solo asigna `usuario_id` si existe vinculación formal `APROBADA` en `solicitud_vinculacion_expediente` (prohibida la autovinculación por DNI). Al leer o descargar en Casilla autenticada se registra `LEIDA` y se genera la cédula PDF de `ACUSE_GENERADO`.
5. **Analítica MGD ([mgdAnalytics.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/corelink/mgdAnalytics.service.ts), [reportes.controller.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/corelink/reportes.controller.ts)):** Suma contadores multiárea por período en `tendencias(anio)`, calcula distribución `estados` sobre `sigd_tra.mv_kpis_mgd_mensual` y resuelve nombres de área con fallback a `sigd_org.area`.
