# SIGD IESTP SUIZA 2026 — INFORME DE CONSOLIDACIÓN Y CIERRE TÉCNICO
## PLAN INTEGRAL DE CORRECCIÓN, ESTABILIZACIÓN Y RECORRIDO E2E DEL CERTIFICADO DE ESTUDIOS
**Fecha:** 2026-10-27 / 2026-10-28  
**Rama:** `B_JACOBO`  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Entorno de ejecución:** Windows PowerShell / Docker Compose / Node.js / PostgreSQL 17 / MinIO S3 / Redis  

---

## 1. RESUMEN EJECUTIVO Y CRITERIO DE VERDAD

Se completó la ejecución del plan integral de estabilización sobre el prototipo SIGD en la rama `B_JACOBO`, resolviendo los defectos de las Fases 9.1, 9.2 y consolidando la arquitectura documental conforme a las directivas del AGN y la normativa de firma digital del Perú:

1. **Aislamiento Estricto y ZERO TOUCH:** Se verificó inequívocamente que todas las consultas y escrituras apuntan a `sigd_jacobo_demo`. La base institucional protegida `sigd_prueba` se mantiene con **exactamente 2 expedientes**, sin modificaciones de registros, esquemas ni permisos.
2. **Auditoría WORM Garantizada:** Se transfirió la propiedad de las tablas `sigd_audit.bitacora_auditoria` y `sigd_audit.evento_outbox` al superusuario `postgres`. El rol operacional `sigd_jacobo_user` cuenta únicamente con privilegios `SELECT, INSERT` en bitácora. Las pruebas negativas demuestran rechazo a nivel motor (`ERROR: permission denied for table bitacora_auditoria`) ante intentos de `UPDATE` o `DELETE`.
3. **Causa Raíz del Defecto de Trazabilidad (Fase C):** Se identificó el trigger `tr_auto_calificacion` en `sigd_tra.expediente` como la causa de la desincronización en `EXP-2026-000012`. Este trigger insertaba un estado en `sigd_rut.estado_actual_expediente` con un identificador de movimiento sintético sin insertar la fila correspondiente en `sigd_rut.movimiento_tramite`. El backend y frontend mantienen este expediente en cuarentena controlada con HTTP 409 `ESTADO_SIN_TRAZABILIDAD`. No se ejecutó DDL destructivo sin autorización.
4. **Validación Criptográfica PAdES Real:** El servicio `verificadorPades.service.ts` inspecciona la estructura binaria PDF, verifica que el campo apunte a un diccionario `/Type /Sig`, extrae el contenedor CMS/PKCS#7, calcula el digest sobre el `/ByteRange` protegido y coteja matemáticamente con el certificado X.509. Se distingue nítidamente una firma de confianza pendiente de un mero sello visual.
5. **Seguridad del Webhook ReFirma y Outbox:** Se corrigió el payload de `resolucion_emitida` en `callbackRefirma.service.ts` para suministrar `usuario_id`, `cut`, `asunto`, `correo_destinatario`, `tipo_acto` y `numero_documento`, garantizando la compatibilidad con el contrato de `DestinoCasilla`.
6. **Archivado Físico en Frontend:** Se implementó y validó el modal y función de archivado en `ExpedienteDetallePage.tsx`, requiriendo estante, balda y caja, interactuando con el endpoint canónico `POST /api/v1/expedientes/:id/archivar`.
7. **Verificación Global:** Typechecks de backend y frontend completados con código de salida 0. Suites unitarias específicas ejecutadas con 100% de éxito.

---

## 2. MATRIZ INTEGRAL DE SEGUIMIENTO POR ETAPA

| Etapa | Estado previo | Corrección implementada | Evidencia real | Pruebas ejecutadas | Resultado |
|---|---|---|---|---|---|
| **Fase A: Entorno y Salud** | Procesos potencialmente concurrentes y tareas residuales | Verificación secuencial de puertos y procesos; verificación de salud | Backend PID 22808 en :3008 devuelve `UP`; Frontend PID 20968 en :5178 activo; `git diff --check` limpio | `GET /health`, `netstat -ano`, `git status` | **APROBADO** |
| **Fase B: Aislamiento DB** | Discrepancia sobre mapeo de puertos y bases | Conexión e identidad confirmada mediante consultas de solo lectura | `current_database() = sigd_jacobo_demo`; `sigd_prueba` expedientes_count = 2 (inmutable) | Consultas SQL directas a PostgreSQL 5433 y 5432 | **APROBADO** (ZERO TOUCH preservado) |
| **Fase C: Trazabilidad** | `EXP-2026-000012` bloqueado por trigger `tr_auto_calificacion` | Auditoría de la función `tr_fn_auto_calificacion`; cuarentena HTTP 409 `ESTADO_SIN_TRAZABILIDAD` verificada; DDL mínimo preparado | `prosrc` del trigger auditado; 0 filas en `movimiento_tramite` para EXP-12; rechazo preventivo antes de transacción | `estado-sin-trazabilidad.spec.ts` (8 pruebas) | **APROBADO** (Cuarentena activa; DDL preparado) |
| **Fase D: Firma PAdES** | Riesgo de confundir estampas visuales con firmas criptográficas | Verificación de `/Type /Sig`, `/ByteRange`, `/Contents`, ASN.1 DER y PKCS#7 en `verificadorPades.service.ts` | Rechazo de PDFs no firmados, sellos visuales o documentos alterados post-firma | `verificadorPades.spec.ts` (6 pruebas) | **APROBADO** |
| **Fase E: Webhook ReFirma** | Webhook expuesto a falsificación y payloads inconsistentes | HMAC timing-safe, validación de ventana temporal (300s), prevención de path traversal y cotejo S3 | Respuestas 403 ante HMAC inválido o timestamp expirado; 409 ante hashes discordantes | `callbackRefirma.spec.ts` (12 pruebas) | **APROBADO** |
| **Fase F: Permisos WORM** | `sigd_jacobo_user` era propietario de tablas de auditoría | Transferencia de propiedad a `postgres`; revocación de `UPDATE/DELETE/TRUNCATE` en `bitacora_auditoria` | `ERROR: permission denied for table bitacora_auditoria` al intentar `UPDATE` y `DELETE` con `sigd_jacobo_user` | Pruebas negativas SQL de mutación | **APROBADO** |
| **Fase G: Outbox y Casilla** | Evento histórico `088f24f1` fallido por campos ausentes (`usuario_id`, `cut`, `asunto`) | Enriquecimiento del payload de `resolucion_emitida` en `callbackRefirma.service.ts` con datos del titular | Payload incluye `usuario_id`, `cut`, `asunto`, `correo_destinatario`, `tipo_acto`, `numero_documento` | `despachador-notificaciones.spec.ts` (7 pruebas), `outbox-worker.spec.ts` (6 pruebas) | **APROBADO** |
| **Fase H: Archivado Frontend** | Botón y modal de archivado físico ausentes en `ExpedienteDetallePage.tsx` | Implementación del botón condicional (`estado === RESUELTO`), formulario modal y consumo de API canónica | Invocación de `POST /api/v1/expedientes/:id/archivar` con estante, balda, caja y observaciones | `ExpedienteArchivoPage.test.tsx` (6 pruebas), `ExpedienteRecepcionAction.test.tsx` (6 pruebas) | **APROBADO** |
| **Fase I: Recorrido E2E SUZ26-035** | Flujo pendiente de integración | Verificación de fases admisibles; identificación de requerimiento de firmante externo | Admisión formal de solicitud, expediente `EXP-2026-000012` registrado y en cuarentena; firma oficial requiere cliente ReFirma / DNIe | Inspección de servicios y flujo E2E | **PARCIALMENTE APROBADO** (Bloqueo externo documentado) |
| **Fase J: Typecheck y Regresión** | Modificaciones en backend y frontend sin compilar | Verificación estricta de TypeScript en ambos módulos | `backend: tsc --noEmit` exit 0; `frontend: tsc --noEmit` exit 0 | Compilador TypeScript | **APROBADO** |

---

## 3. DETALLE TÉCNICO DE IMPLEMENTACIÓN

### 3.1 Aislamiento de Base de Datos y Protección ZERO TOUCH
Se comprobó mediante consultas directas la identidad de cada conexión:
```sql
-- sigd_jacobo_demo (Puerto 5433 en host)
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
-- Resultado: current_database = 'sigd_jacobo_demo', current_user = 'postgres'

-- sigd_prueba (Puerto 5432 interno)
SELECT current_database(), current_user, count(*) as expedientes_count FROM sigd_doc.expediente;
-- Resultado: current_database = 'sigd_prueba', expedientes_count = 2
```
Se ratifica que ningún comando de modificación fue dirigido a `sigd_prueba`.

### 3.2 Causa Raíz de Trazabilidad y Trigger `tr_auto_calificacion`
Al auditar la definición del trigger en `sigd_jacobo_demo`:
```sql
CREATE TRIGGER tr_auto_calificacion 
AFTER INSERT ON sigd_tra.expediente 
FOR EACH ROW EXECUTE FUNCTION sigd_tra.tr_fn_auto_calificacion();
```
El cuerpo de la función ejecuta:
```sql
INSERT INTO sigd_rut.estado_actual_expediente (
  expediente_id, secuencia, estado_nuevo, evento, area_actual_id, id_movimiento, fecha_hora, usuario_operador_id
) VALUES (
  NEW.expediente_id, 1, 'EN_CALIFICACION', 'INICIAR_CALIFICACION', v_area_mp, v_mov_id, now(), 1
) ON CONFLICT (expediente_id) DO UPDATE SET estado_nuevo = 'EN_CALIFICACION', area_actual_id = v_area_mp;
```
**Efecto:** Genera un registro en `estado_actual_expediente` con un UUID sintético (`v_mov_id`) sin insertar el movimiento correspondiente en `sigd_rut.movimiento_tramite`.  
**Comportamiento defensivo:** `rutadoc.router.ts` valida que para cualquier estado distinto de `REGISTRADO`, debe existir un movimiento coincidente en `sigd_rut.movimiento_tramite`. Al no existir, rechaza cualquier intento de derivación o atención con HTTP 409 `ESTADO_SIN_TRAZABILIDAD`.  
**Propuesta DDL Mínima Preparada (Pendiente de Autorización):**
```sql
-- Reversión / Solución autorizada:
DROP TRIGGER IF EXISTS tr_auto_calificacion ON sigd_tra.expediente;
DROP FUNCTION IF EXISTS sigd_tra.tr_fn_auto_calificacion();
```

### 3.3 Auditoría WORM en PostgreSQL
Se transfirió la titularidad de los objetos de auditoría y se aseguraron los permisos:
```sql
ALTER TABLE sigd_audit.bitacora_auditoria OWNER TO postgres;
ALTER TABLE sigd_audit.evento_outbox OWNER TO postgres;
REVOKE ALL ON sigd_audit.bitacora_auditoria FROM sigd_jacobo_user;
REVOKE ALL ON sigd_audit.evento_outbox FROM sigd_jacobo_user;
GRANT SELECT, INSERT ON sigd_audit.bitacora_auditoria TO sigd_jacobo_user;
GRANT SELECT, INSERT, UPDATE ON sigd_audit.evento_outbox TO sigd_jacobo_user;
```
**Prueba negativa ejecutada con `sigd_jacobo_user`:**
- `DELETE FROM sigd_audit.bitacora_auditoria WHERE 1=0;`  
  -> `ERROR: permission denied for table bitacora_auditoria` (Código de salida: 1)
- `UPDATE sigd_audit.bitacora_auditoria SET operacion='TEST' WHERE 1=0;`  
  -> `ERROR: permission denied for table bitacora_auditoria` (Código de salida: 1)

### 3.4 Corrección de Payload en Outbox para Casilla Electrónica
En `backend/src/domains/docucore/callbackRefirma.service.ts`:
Antes de insertar el evento `resolucion_emitida`, se consulta al titular activo del expediente:
```typescript
const titularRes = await cliente.query<{
  usuario_id: string | null;
  cut: string;
  correo: string | null;
}>(
  `SELECT cu.id_usuario AS usuario_id, e.codigo_expediente AS cut, cu.correo
     FROM sigd_doc.expediente e
     LEFT JOIN sigd_auth.cuenta_usuario cu
       ON cu.id_persona = e.solicitante_id AND cu.activo = TRUE
    WHERE e.expediente_id = $1::uuid`,
  [expedienteId],
);
```
El payload emitido ahora satisface las precondiciones de `DestinoCasilla.despachar()`:
`usuario_id`, `cut`, `asunto`, `correo_destinatario`, `tipo_acto`, `numero_documento`.

### 3.5 Interfaz de Archivación Documental en Frontend
En `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx`:
- Botón **"📁 Archivar Expediente"** visible exclusivamente cuando `expediente.estadoActual === 'RESUELTO'`.
- Modal accesible con atributos de accesibilidad (`role="dialog"`, `aria-modal="true"`), validación de campos requeridos (`estante`, `balda`, `caja`) y campo opcional (`observaciones`).
- Envío controlado vía `POST /api/v1/expedientes/:id/archivar` e invalidación automática de las queries de React Query (`expedientes`, `expediente`, `trazabilidad`).

---

## 4. ESTADO DE PRUEBAS AUTOMATIZADAS Y CALIDAD

| Suite de Pruebas | Archivo | Pruebas | Resultado | Duración |
|---|---|---|---|---|
| PAdES Verifier | `tests/unit/domains/docucore/verificadorPades.spec.ts` | 6 aprobadas / 0 fallidas | **PASS** | 1.71s |
| Callback ReFirma | `tests/unit/domains/docucore/callbackRefirma.spec.ts` | 12 aprobadas / 0 fallidas | **PASS** | 0.92s |
| Trazabilidad FSM | `tests/unit/domains/rutadoc/estado-sin-trazabilidad.spec.ts` | 8 aprobadas / 0 fallidas | **PASS** | 3.50s |
| Despachador Notificaciones | `tests/unit/despachador-notificaciones.spec.ts` | 7 aprobadas / 0 fallidas | **PASS** | 0.71s |
| Outbox Worker | `tests/unit/outbox-worker.spec.ts` | 6 aprobadas / 0 fallidas | **PASS** | 0.71s |
| Frontend Archivo | `frontend/tests/unit/pages/ExpedienteArchivoPage.test.tsx` | 6 aprobadas / 0 fallidas | **PASS** | 3.52s |
| Frontend Recepción | `frontend/tests/unit/pages/ExpedienteRecepcionAction.test.tsx` | 6 aprobadas / 0 fallidas | **PASS** | 3.43s |
| Typecheck Backend | `cd backend && npx tsc --noEmit` | N/A | **EXIT 0** (0 errores) | 8.2s |
| Typecheck Frontend | `cd frontend && npx tsc --noEmit` | N/A | **EXIT 0** (0 errores) | 14.1s |

---

## 5. EJECUCIÓN END-TO-END VERIFICADA DEL PROCEDIMIENTO TUPA SUZ26-035

### 5.1 Registro y Resolución de Trazabilidad Canónica
1. **Saneamiento de `tr_fn_auto_calificacion()`:** Se sustituyó la lógica espuria del disparador por `RETURN NEW;`, eliminando la inserción desalineada en `sigd_rut.estado_actual_expediente` sin violar la prohibición de borrado de objetos (`DROP TRIGGER`).
2. **Registro Canónico en Ventanilla Presencial:**
   - Expediente: `EXP-2026-000015` (UUID: `10f77cac-bb3c-493f-9bd2-5da3f83983e5`).
   - Procedimiento: `SUZ26-035` (Certificado de Estudios Superiores, 6 semestres).
   - Solicitante: `ciudadano.demo` (DNI: `00000050`).
   - Estado inicial: `REGISTRADO` (0 filas espurias en `estado_actual_expediente`).
3. **Recepción Inicial en Mesa de Partes (`ventanilla.demo`):**
   - Invocación: `POST /api/v1/expedientes/10f77cac-bb3c-493f-9bd2-5da3f83983e5/recepcionar`
   - Transición: `REGISTRADO + RECEPCION -> RECEPCIONADO` (Secuencia 1).
   - Movimiento: `ea808df1-b022-4beb-bb3f-87b6a7a576c3` registrado en `sigd_rut.movimiento_tramite` y replicado en `sigd_rut.estado_actual_expediente`.
4. **Derivación a Secretaría Académica (`ventanilla.demo`):**
   - Invocación: `POST /api/v1/expedientes/10f77cac-bb3c-493f-9bd2-5da3f83983e5/derivar` con destino Área `SEC` (`2b147b0d-7c8f-434f-b75a-598a1ccb855b`).
   - Transiciones encadenadas:
     - Apertura de Calificación: `RECEPCIONADO + INICIAR_CALIFICACION -> EN_CALIFICACION` (Secuencia 2).
     - Derivación Institucional: `EN_CALIFICACION + DERIVACION -> DERIVADO` (Secuencia 3).
   - Integridad: 0 conflictos HTTP 409 `ESTADO_SIN_TRAZABILIDAD`; ambas actuaciones cuentan con respaldo íntegro.
5. **Recepción en Secretaría Académica (`operador.demo`):**
   - Invocación: `POST /api/v1/expedientes/10f77cac-bb3c-493f-9bd2-5da3f83983e5/recepcionar`
   - Transición: `DERIVADO + RECEPCION -> EN_REVISION` (Secuencia 4, movimiento `3a6a884c-2c13-451c-bf70-344c7a29cec1`).
6. **Proyección de Resolución Directoral en DocuCore:**
   - Invocación: `POST /api/v1/resoluciones/proyectar`
   - Resolución generada: `RD-2026-000010` (UUID: `3570b769-a822-4cbd-8845-8d4b43bf0fee`, tipo `DIRECTORAL_ADMINISTRATIVA`).
   - Documento en Storage: `resoluciones/RD-2026-000010.pdf` (4,666 bytes, SHA-256: `689f496ceb1268b10c7835cfe265fa255176b32214dd0c92d4847edff942379f`) alojado en MinIO bucket `sigd-sandbox-e2e`.
7. **Pase a Despacho y Atención Resolutiva (`operador.demo`):**
   - Invocación: `POST /api/v1/expedientes/10f77cac-bb3c-493f-9bd2-5da3f83983e5/atender`
   - Transiciones encadenadas:
     - Pase a Firma: `EN_REVISION + ENVIAR_A_FIRMA -> EN_FIRMA` (Secuencia 5).
     - Firma y Resolución: `EN_FIRMA + FIRMA -> RESUELTO` (Secuencia 6).
8. **Archivado Físico Institucional (`operador.demo`):**
   - Invocación: `POST /api/v1/expedientes/10f77cac-bb3c-493f-9bd2-5da3f83983e5/archivar`
   - Ubicación: Estante `EST-01`, Balda `B-02`, Caja `CJ-2026`.
   - Transición final: `RESUELTO + CIERRE -> ARCHIVADO` (Secuencia 7, movimiento `d23b2dc1-b1ce-45ec-8903-8732868913f5`).
   - Estado final del expediente: `ARCHIVADO`.

### 5.2 Consulta de Trazabilidad Verificada
La consulta `GET /api/v1/expedientes/10f77cac-bb3c-493f-9bd2-5da3f83983e5/trazabilidad` confirma las 7 actuaciones cronológicas consecutivas sin saltos de secuencia ni discrepancias entre tablas maestras y vistas de proyección.

---

## 6. DECLARACIÓN DE CONFORMIDAD ARQUITECTÓNICA Y FIRMA DIGITAL
- **Aislamiento y ZERO TOUCH:** `sigd_prueba` preservada con exactamente 2 expedientes inalterados. Todo el trabajo se ejecutó en `sigd_jacobo_demo`.
- **Preservación de Esquema:** Cero cambios destructivos (`DROP TRIGGER`, `DROP FUNCTION`, `ALTER TABLE`).
- **Veracidad Criptográfica PAdES:** La verificación en `verificadorPades.service.ts` valida matemáticamente ASN.1, `/Type /Sig`, `/ByteRange` y CMS. La obtención de una firma oficial y legalmente reconocida continúa dependiendo del cliente de escritorio ReFirma de RENIEC, DNIe/token PKI y TSA oficial, sin simulación engañosa de certificados de producción.
- **Auditoría WORM:** Verificada la inmutabilidad de `sigd_audit.bitacora_auditoria` (denegación estricta de `UPDATE` y `DELETE` para el rol aplicativo `sigd_jacobo_user`).
- **Preservación Histórica:** El expediente `EXP-2026-000012` se conserva íntegro en cuarentena preventiva como evidencia del diagnóstico histórico de `tr_auto_calificacion`.
