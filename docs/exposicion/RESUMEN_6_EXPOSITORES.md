# Guion para 6 Expositores y Comandos de Arranque — SIGD

**Versión base:** rama `B_GERIC`, commit `3e652ead`.
**Documentos de apoyo:** [GUIA_FRONTEND.md](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/docs/exposicion/GUIA_FRONTEND.md), [GUIA_BACKEND.md](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/docs/exposicion/GUIA_BACKEND.md), [CONSULTAS_SIGD_EXPOSICION.sql](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/docs/exposicion/CONSULTAS_SIGD_EXPOSICION.sql), [GUIA_DEMOSTRACION.md](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/docs/exposicion/GUIA_DEMOSTRACION.md) y [PREGUNTAS_DEFENSA.md](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/docs/exposicion/PREGUNTAS_DEFENSA.md).

---

## Expositor 1 — Arquitectura Fullstack, Rutas, Contextos y Seguridad Base

- **Qué debe explicar:** Separación entre rutas públicas y privadas en React, almacenamiento de sesión (`PERSONAL` vs. `INSTITUCIONAL`), construcción modular del servidor Express, validación JWT HS256 y motor de autorización fail-closed en tiempo real.
- **Archivos que debe abrir:**
  - [AppRouter.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/routes/AppRouter.tsx)
  - [ProtectedRoute.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/routes/ProtectedRoute.tsx)
  - [authStore.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/stores/authStore.ts)
  - [app.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/app.ts)
  - [authorization.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/core/auth/authorization.service.ts)
- **Función concreta que debe mostrar:** `ProtectedRoute` (`ProtectedRoute.tsx`), `construirApp` (`app.ts`) y `AuthorizationService.autorizar` (`authorization.service.ts`).
- **Consulta SQL relacionada:** Consultas `2.1` y `2.2` de [CONSULTAS_SIGD_EXPOSICION.sql](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/docs/exposicion/CONSULTAS_SIGD_EXPOSICION.sql) (`sigd_auth.cuenta_usuario`, `sigd_org.usuario_rol`, `sigd_org.asignacion_perfil_operativo`, `sigd_org.area`).
- **Preguntas probables y respuestas:**
  1. *¿Qué ocurre si un funcionario con sesión institucional intenta abrir `/tramite`?* `RutaTramiteCompatible` en `AppRouter.tsx` detecta el contexto `INSTITUCIONAL` y redirige a `/acceso-denegado`, manteniendo aislados los trámites personales.
  2. *¿Cómo evitan depender solo de lo guardado en el navegador?* `verificarTokenAcceso` (`jwt.service.ts`) valida la firma HMAC con `crypto.timingSafeEqual` en cada solicitud HTTP, y `AuthorizationService` consulta cuenta, vigencia laboral y perfiles reales en PostgreSQL.

---

## Expositor 2 — Radicación TUPA (`p1-fila-06`) y Módulo de Tesorería

- **Qué debe explicar:** Doble representación del TUPA, radicación presencial/digital de *Certificado de Inglés* (`p1-fila-06`, arancel `S/ 100.00`), bloqueo automático previo al pago (`PENDIENTE_PAGO` → `REGISTRADO`), confirmación de pago en Tesorería con emisión de recibo `REC-...` y configuración del modo Demo QR.
- **Archivos que debe abrir:**
  - [ventanillaPresencial.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/tramicore/ventanillaPresencial.service.ts)
  - [tesoreria.router.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/tesoreria/tesoreria.router.ts)
  - [tesoreria.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/tesoreria/tesoreria.service.ts)
  - [TesoreriaPage.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/pages/tesoreria/TesoreriaPage.tsx)
  - [tesoreria.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/services/tesoreria.service.ts)
- **Función concreta que debe mostrar:** `VentanillaPresencialService.registrarExpedienteVentanilla`, `TesoreriaService.obtenerConfiguracionDemoQr` y `tesoreriaService.obtenerConfiguracionDemoQr` (`GET /api/v1/tesoreria/demo-qr/config`).
- **Consulta SQL relacionada:** Consultas `1.2` (`tupa_procedimiento` `p1-fila-06`) y `3.1` (`sigd_tra.orden_pago` y recibos) en [CONSULTAS_SIGD_EXPOSICION.sql](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/docs/exposicion/CONSULTAS_SIGD_EXPOSICION.sql).
- **Preguntas probables y respuestas:**
  1. *¿Puede Mesa de Partes derivar un Certificado de Inglés sin que pague el ciudadano?* No. `registrarExpedienteVentanilla` fija estado `PENDIENTE_PAGO` cuando `costoOficial > 0`, y `evaluarElegibilidadDerivacion` bloquea la derivación hasta existir una fila `CONFIRMADO` en `sigd_tra.orden_pago`.
  2. *¿Por qué Tesorería no tiene botones de derivar expedientes?* `evaluarCapacidadesExpediente` excluye explícitamente roles financieros puros (`esSoloTesoreria`, código `ROL_FINANCIERO_SIN_FACULTAD_DOCUMENTAL`) y la UI oculta los controles de flujo.

---

## Expositor 3 — Motor RutaDoc: FSM, Derivaciones, Custodia y Asignación

- **Qué debe explicar:** Los 10 estados congelados de la FSM, inmutabilidad WORM en `sigd_rut.movimiento_tramite`, regla de evaluación técnica obligatoria para `p1-fila-06` (`DIR → SDA → DIR`), validación de facultad de derivación para especialistas y privacidad de nombres asignados.
- **Archivos que debe abrir:**
  - [rutadoc.fsm.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/rutadoc.fsm.ts)
  - [derivaciones.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/derivaciones.service.ts)
  - [derivaciones.controller.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/derivaciones.controller.ts)
  - [expedienteAsignacion.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/rutadoc/expedienteAsignacion.service.ts)
- **Función concreta que debe mostrar:** `puedeTransicionar` (`rutadoc.fsm.ts`), `evaluarCapacidadesExpediente` y `verificarFacultadDerivacion` (`derivaciones.service.ts`), y `ExpedienteAsignacionService.obtenerAsignacionActiva`.
- **Consulta SQL relacionada:** Consultas `4.1` (`movimiento_tramite` WORM de `EXP-2026-000149`) y `5.1` (`expediente_asignacion`) en [CONSULTAS_SIGD_EXPOSICION.sql](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/docs/exposicion/CONSULTAS_SIGD_EXPOSICION.sql).
- **Preguntas probables y respuestas:**
  1. *¿Qué impide que Secretaría eleve a firma antes de que el especialista de Inglés dicte informe?* `enviarAFirmaExpediente` consulta `consultarEstadoEtapaTecnicaTupa` y exige asignación activa más dictamen técnico válido; antes de eso devuelve conflicto y mantiene bloqueado el botón en React.
  2. *¿Por qué un especialista de otra área o no asignado no puede atender el expediente?* El backend verifica custodia (`tieneCustodiaEfectiva`) y coincidencia de asignación activa en `sigd_rut.expediente_asignacion`; si no coincide, responde `403`.

---

## Expositor 4 — Interfaz Operativa React: Hooks, Modales y Permisos Coherentes

- **Qué debe explicar:** Cómo `ExpedienteDetallePage` sincroniza las capacidades del backend (`accionesPermitidas`) con botones, motivos de bloqueo y modales (`DerivacionModal`, `AsignacionModal`, `AtencionModal`, `EnviarAFirmaModal`, `ArchivadoModal`), y cómo `useExpedienteActions` evita dobles envíos e invalida caché selectivamente.
- **Archivos que debe abrir:**
  - [useExpedienteActions.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/hooks/useExpedienteActions.ts)
  - [expedienteActions.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/api/expedienteActions.ts)
  - [ExpedienteDetallePage.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/pages/expedientes/ExpedienteDetallePage.tsx)
  - [AtencionModal.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/components/expedientes/AtencionModal.tsx)
- **Función concreta que debe mostrar:** `useExpedienteActions` / `useAccion` (`useExpedienteActions.ts`) y `crearServicioExpedienteActions` (`expedienteActions.ts`).
- **Consulta SQL relacionada:** Consultas `1.1` (ficha de `EXP-2026-000149` con estado/custodia) y `4.1` en [CONSULTAS_SIGD_EXPOSICION.sql](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/docs/exposicion/CONSULTAS_SIGD_EXPOSICION.sql).
- **Preguntas probables y respuestas:**
  1. *¿Qué sucede si el usuario hace doble clic rápido en Confirmar?* `useExpedienteActions` usa un `WeakMap` (`bloqueos`) indexado por `QueryClient` para ignorar reentradas simultáneas sobre el mismo expediente mientras `mutacion.isPending` está activo.
  2. *¿Qué pasa si la mutación tuvo éxito en PostgreSQL pero falla la recarga visual posterior?* El bloque `onSuccess` distingue la escritura confirmada del fallo de invalidación y muestra un aviso preventivo sin indicar error de envío para evitar duplicar operaciones.

---

## Expositor 5 — DocuCore: PDF Institucional A4, MinIO, SHA-256, Firma DNIe y CVD

- **Qué debe explicar:** Generación del PDF A4 con escudo auténtico del IESTP Suiza y bloques `VISTO/CONSIDERANDO/SE RESUELVE`, estampa QR/CVD sin recorte de márgenes, verificación criptográfica en `MockDniProvider` (modo laboratorio), almacenamiento físico en MinIO, detección de artefactos históricos vacíos (`EXP-2026-000150`) y validación pública en `/validador-cvd`.
- **Archivos que debe abrir:**
  - [a4Generator.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/docucore/a4Generator.service.ts)
  - [cvdStamp.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/docucore/cvdStamp.service.ts)
  - [resoluciones.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/docucore/resoluciones.service.ts)
  - [validadorCvd.controller.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/docucore/validadorCvd.controller.ts)
  - [ResolverModal.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/components/expedientes/ResolverModal.tsx)
  - [CvdIntegrityReport.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/components/cvd/CvdIntegrityReport.tsx)
- **Función concreta que debe mostrar:** `A4GeneratorService.generar`, `CvdStampService.estampar`, `generarActoResolutivoInstitucional` (`resoluciones.service.ts`) y `crearVerificadorCvd` (`validadorCvd.controller.ts`).
- **Consulta SQL relacionada:** Consulta `6.1` de [CONSULTAS_SIGD_EXPOSICION.sql](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/docs/exposicion/CONSULTAS_SIGD_EXPOSICION.sql) (cotejo de `RD-2026-000451` de `EXP-2026-000149` frente a `EXP-2026-000150`).
- **Preguntas probables y respuestas:**
  1. *¿Cómo detectan un PDF vacío o perdido en MinIO como ocurrió históricamente en `EXP-2026-000150`?* `resoluciones.service.ts` exige magic bytes `%PDF-` y prohíbe `SHA256_CONTENIDO_VACIO` (`e3b0c44...`); además `crearVerificadorCvd` ejecuta `headObject` en MinIO y responde `valido: false` con `integridadArchivo: 'ARTEFACTO_INEXISTENTE_O_VACIO'`.
  2. *¿Por qué el validador público devuelve `documento: null`?* Por protección de datos (Ley N.° 29733): la ruta pública confirma validez criptográfica, hash SHA-256, firmante, naturaleza (`FIRMA_LABORATORIO` vs `FIRMA_DIGITAL_OFICIAL`) y sellado TSA sin exponer el contenido completo ni claves internas `s3_key`.

---

## Expositor 6 — Notificaciones Outbox, Casilla BOLA, Tablero Directivo MGD y Pruebas

- **Qué debe explicar:** Despacho asíncrono vía `sigd_audit.evento_outbox`, política anti-BOLA para ciudadanos sin cuenta vinculada, trazabilidad de acuses (`PUESTA_A_DISPOSICION` → `LEIDA` → `ACUSE_GENERADO`), métricas reales en vistas materializadas del tablero directivo y aislamiento de pruebas con `ROLLBACK`.
- **Archivos que debe abrir:**
  - [despachador-notificaciones.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/audit/despachador-notificaciones.ts)
  - [casilla.router.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/identicore/casilla.router.ts)
  - [mgdAnalytics.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/corelink/mgdAnalytics.service.ts)
  - [reportes.controller.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/backend/src/domains/corelink/reportes.controller.ts)
  - [DashboardEjecutivoPage.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/pages/reportes/DashboardEjecutivoPage.tsx)
- **Función concreta que debe mostrar:** `DestinoCasilla.despachar`, `ServicioMgdAnalytics.tendencias` y `crearControladorReportes` (`resumen`).
- **Consulta SQL relacionada:** Consultas `7.1`, `7.2` y `8.1` de [CONSULTAS_SIGD_EXPOSICION.sql](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/docs/exposicion/CONSULTAS_SIGD_EXPOSICION.sql).
- **Preguntas probables y respuestas:**
  1. *¿Por qué el sistema no vincula automáticamente un expediente presencial si alguien crea una cuenta con el mismo DNI?* Para impedir suplantación previa a la acreditación documental: `DestinoCasilla` exige `id_usuario_creador` o una solicitud `APROBADA` en `sigd_tra.solicitud_vinculacion_expediente` revisada por Mesa de Partes.
  2. *¿Qué corrigieron en el Tablero Directivo?* Se refrescaron las vistas materializadas (`mv_kpis_mgd_mensual`, `mv_tiempos_retencion_area`), se sumaron contadores multiárea en `tendencias(anio)`, se añadió fallback a `sigd_org.area`, se expuso `estados` en el controlador y se redondeó la suma porcentual en React.

---

## Comandos Verificados de Arranque y Comprobación (Configuración Existente)

*(Ejecutar desde la raíz `SIGD` en PowerShell; no ejecuta seeds ni altera datos).*

1. **Infraestructura base (PostgreSQL, MinIO, Redis con `docker-compose.yml`):**
   ```powershell
   docker compose --profile object-storage up -d postgres minio redis
   ```
2. **Comprobación de salud de PostgreSQL y MinIO:**
   ```powershell
   docker exec sigd_postgres pg_isready -U postgres -d sigd_prueba
   Invoke-WebRequest -Uri "http://127.0.0.1:9000/minio/health/live" -UseBasicParsing | Select-Object -ExpandProperty StatusCode
   ```
3. **Arranque del Backend (puerto `3000`) y comprobación de sondas:**
   ```powershell
   Set-Location backend; npm run dev
   ```
   En otra terminal:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/health" | ConvertTo-Json -Compress
   Invoke-RestMethod -Uri "http://localhost:3000/ready" | ConvertTo-Json -Compress
   ```
4. **Arranque del Frontend (Vite dev server) y acceso en navegador:**
   ```powershell
   Set-Location frontend; npm run dev
   ```
5. **Comprobación de compilación (sin modificar datos ni ejecutar seeds):**
   ```powershell
   npm --prefix backend run typecheck
   npm --prefix backend run build
   npm --prefix frontend run build
   ```
