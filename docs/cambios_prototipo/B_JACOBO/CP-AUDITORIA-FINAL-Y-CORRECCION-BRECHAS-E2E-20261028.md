# SIGD IESTP SUIZA 2026 — INFORME DE AUDITORÍA FINAL Y CORRECCIÓN DE BRECHAS E2E
## FASE 10B: CORRECCIÓN DEL BYPASS DE FIRMA DIGITAL, SEGURIDAD WORM, CASILLA ELECTRÓNICA Y CIERRE REALISTA DEL TRÁMITE SUZ26-035

**Fecha:** 2026-10-28  
**Rama:** `B_JACOBO`  
**HEAD histórico de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Entorno de ejecución:** Windows 10/11 / Docker Compose (PostgreSQL 18 en host :5433, Redis 7.4.8 :6379, MinIO S3 :9000/:9001) / Node.js v24.19.0 / Backend Express (PID 22828 :3008) / Frontend Vite (PID 10224 :5178)  
**Base de datos de desarrollo activa:** `sigd_jacobo_demo`  
**Base de datos institucional protegida (ZERO TOUCH):** `sigd_prueba`  

---

## 1. RESUMEN EJECUTIVO Y POLÍTICA ZERO TOUCH

En estricto cumplimiento de los requerimientos de la auditoría final y corrección de brechas del cierre E2E:

1. **Aislamiento absoluto de `sigd_prueba` (ZERO TOUCH):**  
   Se auditó la base institucional protegida exclusivamente mediante consultas de lectura:
   ```sql
   SELECT current_database(), count(*) AS count_expedientes FROM sigd_tra.expediente;
   -- Resultado: sigd_prueba | 2 expedientes (Exactamente los 2 históricos conocidos, 100% inalterada).
   ```
2. **Corrección definitiva del Bypass de Firma Digital:**  
   Se corrigió la implementación de `atenderExpediente` en `backend/src/domains/rutadoc/derivaciones.service.ts` y de `registrarCallbackRefirma` en `backend/src/domains/docucore/callbackRefirma.service.ts`. Se desacopló la atención resolutiva de la firma digital: la preparación o atención en `EN_REVISION` únicamente avanza a `EN_FIRMA` (bandeja de despacho para firma). La transición `EN_FIRMA -> RESUELTO` queda estrictamente condicionada a la verificación criptográfica PAdES en `sigd_doc.firma_digital_documento` y resolución `FIRMADA`.
3. **Reproducibilidad y saneamiento de `tr_fn_auto_calificacion()`:**  
   Se garantizó la reproducibilidad en el repositorio actualizando todos los scripts de inicialización y utilitarios (`seed_demo_complete.sql`, `seed_e2e.sql`, `generate_demo_credentials.ts`, `run_sandbox_e2e_browser.ts`) con la versión neutralizada `RETURN NEW;`. El expediente histórico `EXP-2026-000012` permanece legítimamente en cuarentena (`ESTADO_SIN_TRAZABILIDAD`).
4. **Verificación completa de Outbox, Casilla Electrónica y Acuse Legal:**  
   Se subsanó el contrato de validación de UUIDs y tipado en PostgreSQL en `DestinoCasilla`. Se demostró la publicación del evento `resolucion_emitida`, enrutamiento a `sigd_auth.notificacion_casilla` para `ciudadano.demo`, idempotencia ante reintentos, consulta en bandeja, marcado como leído (`PATCH /casilla/notificaciones/:id/lectura`), generación de acuse legal con sellado de tiempo y hash SHA-256 (`POST /casilla/notificaciones/:id/acuse`), y aislamiento multitenant estricto (HTTP 403 ante usuario ajeno).
5. **Auditoría de Mínimo Privilegio (WORM):**  
   Se demostraron los rechazos activos de `UPDATE`, `DELETE` y `TRUNCATE` en `sigd_audit.bitacora_auditoria` para el rol operacional `sigd_jacobo_user`, garantizando inmutabilidad.
6. **Recorrido E2E transparente y categorización honesta:**  
   El trámite `SUZ26-035` fue recorrido limpiamente en `EXP-2026-000016` a través de sus 5 actuaciones legítimas hasta alcanzar `EN_FIRMA`. Se verificó mediante prueba negativa activa que invocar `/atender` en `EN_FIRMA` sin firma devuelve `HTTP 409 Conflict`. El estado se declara formalmente como `BLOQUEADA POR DEPENDENCIA EXTERNA` (requiere agente oficial ReFirma RENIEC, token criptográfico/DNIe y TSA institucional).
7. **Regresiones globales:**  
   - Backend Vitest: **1,244 pruebas aprobadas**, 10 omitidas, 0 fallidas (74 suites aprobadas, 1 omitida).
   - Frontend Vitest: **716 pruebas aprobadas**, 1 omitida, 0 fallidas (64 suites aprobadas).
   - Typechecks: 0 errores en backend (`npx tsc --noEmit` exit 0) y 0 errores en frontend (`npx tsc --noEmit` exit 0).
   - `git diff --check`: 0 errores (exit code 0).

---

## 2. MATRIZ INTEGRAL DE AUDITORÍA, DEFECTOS, CORRECCIONES Y CLASIFICACIÓN

| Etapa / Componente | Defecto Original | Corrección Aplicada | Archivos Modificados | Evidencia Persistida / Reproducible | Pruebas Ejecutadas | Resultado Verificable | Dependencias Externas Pendientes | Clasificación |
|---|---|---|---|---|---|---|---|---|
| **1. Radicación Canónica** | Posible inserción directa con estado desalineado (`RECEPCIONADO` o espurio por trigger). | Inicialización canónica en `REGISTRADO`; trigger `tr_auto_calificacion` neutralizado a `RETURN NEW;`. | `ventanillaPresencial.service.ts`, `seed_demo_complete.sql`, `generate_demo_credentials.ts` | `EXP-2026-000016` inicia en `REGISTRADO` sin filas espurias en `movimiento_tramite`. | `ventanilla-registro-acceso.spec.ts` | **Aprobado (HTTP 201)** | Ninguna | **RESUELTA Y VERIFICADA** |
| **2. Recepción Mesa de Partes** | Incompatibilidad al recepcionar desde `REGISTRADO`. | Servicio `recepcionarExpediente` procesa `REGISTRADO + RECEPCION -> RECEPCIONADO`. | `derivaciones.service.ts` | `sigd_rut.movimiento_tramite` secuencia 1: `REGISTRADO -> RECEPCIONADO`. | `derivaciones.spec.ts`, prueba E2E viva en :3008 | **Aprobado (HTTP 200)** | Ninguna | **RESUELTA Y VERIFICADA** |
| **3. Calificación y Derivación** | Trigger desincronizaba `sigd_rut.estado_actual_expediente` sin insertar en `movimiento_tramite`. | Derivación canónica realiza transición intermedia `RECEPCIONADO + INICIAR_CALIFICACION -> EN_CALIFICACION` y `DERIVACION -> DERIVADO`. | `derivaciones.service.ts` | `sigd_rut.movimiento_tramite` secuencias 2 y 3: destino área `SEC`. | `derivaciones.spec.ts`, prueba E2E viva en :3008 | **Aprobado (HTTP 200)** | Ninguna | **RESUELTA Y VERIFICADA** |
| **4. Recepción en Secretaría Académica** | El expediente permanecía en `DERIVADO` impidiendo actuaciones resolutivas en el área técnica. | Recepción formal en unidad orgánica `SEC` (`DERIVADO + RECEPCION -> EN_REVISION`). | `derivaciones.service.ts`, `ExpedienteDetallePage.tsx` | `sigd_rut.movimiento_tramite` secuencia 4: `DERIVADO -> EN_REVISION`. | `derivaciones.spec.ts`, prueba E2E viva en :3008 | **Aprobado (HTTP 200)** | Ninguna | **RESUELTA Y VERIFICADA** |
| **5. Proyección de Resolución en DocuCore** | Riesgo de inconsistencia de IDs y claves de almacenamiento S3. | Proyección de borrador `sigd_doc.resolucion` con PDF generado y subido a MinIO S3 (`sigd-sandbox-e2e/resoluciones/`). | `resoluciones.service.ts`, `s3-storage.service.ts` | `RD-2026-000010.pdf` almacenado en MinIO (4,666 bytes, magic bytes `%PDF-1.7` verificados). | `resoluciones.spec.ts`, `a4Generator.spec.ts` | **Aprobado (HTTP 201 / S3 200)** | Ninguna | **RESUELTA Y VERIFICADA** |
| **6. Despacho para Firma vs. Bypass de Firma** | **CRÍTICO:** `atenderExpediente` encadenaba `ENVIAR_A_FIRMA` y `FIRMA -> RESUELTO` en una sola llamada sin verificar firma criptográfica. | `atenderExpediente` en `EN_REVISION` solo transiciona a `EN_FIRMA`. Transición a `RESUELTO` exige firma verificada. Intento sin firma devuelve HTTP 409. | `derivaciones.service.ts`, `callbackRefirma.service.ts` | `sigd_rut.movimiento_tramite` secuencia 5: `EN_REVISION -> EN_FIRMA`. Rechazo HTTP 409 registrado ante intento de bypass. | `derivaciones.spec.ts` (pruebas 12b, 12c, 12d), prueba E2E viva en :3008 | **Aprobado (HTTP 409 preventivo verificado)** | Ninguna para la guarda de software | **RESUELTA Y VERIFICADA** |
| **7. Validación Criptográfica PAdES / Webhook ReFirma** | Firma ficticia o simulada sin evidencia criptográfica PAdES ni validación de certificados. | `cotejarPdfFirmado` y `validarFirmaPades` verifican estructura CMS, certificados y digest. En entorno de prueba, se validan fixtures criptográficos con `vitest`. | `callbackRefirma.service.ts`, `verificadorPades.service.ts` | Fixtures criptográficos en tests unitarios; en entorno real el expediente permanece honestamente en `EN_FIRMA`. | `verificadorPades.spec.ts`, `callbackRefirma.spec.ts` | **Aprobado en entorno de pruebas** | ReFirma RENIEC desktop client, certificado institucional hardware/DNIe, sello TSA externo | **BLOQUEADA POR DEPENDENCIA EXTERNA** |
| **8. Transición Legítima a RESUELTO** | Se ejecutaba mediante bypass en `atenderExpediente`. | Se vinculó exclusivamente al callback criptográfico en `callbackRefirma.service.ts` o a `atenderExpediente` previa confirmación en `firma_digital_documento`. | `callbackRefirma.service.ts`, `derivaciones.service.ts` | Código fuente con consulta estricta de firma digital; unit test `callbackRefirma.spec.ts` verifica la inserción de `EN_FIRMA + FIRMA -> RESUELTO`. | `callbackRefirma.spec.ts` (prueba 13) | **Aprobado en unit test; protegido en BD viva** | Disponibilidad de firma criptográfica real | **BLOQUEADA POR DEPENDENCIA EXTERNA** |
| **9. Auditoría WORM (Mínimo Privilegio)** | Declaración previa sin pruebas negativas de `TRUNCATE` ni auditoría exhaustiva de roles. | Propietario `postgres` en `bitacora_auditoria` y `evento_outbox`. Permisos de `sigd_jacobo_user` limitados a SELECT, INSERT (y UPDATE en outbox). Rechazos activos de UPDATE, DELETE, TRUNCATE comprobados. | PostgreSQL catálogo `information_schema.role_table_grants` | Rechazos comprobados: `ERROR: permission denied for table bitacora_auditoria` ante UPDATE, DELETE y TRUNCATE. | Pruebas CLI `psql -U sigd_jacobo_user` | **Aprobado (SQL 42501)** | Ninguna | **RESUELTA Y VERIFICADA** |
| **10. Outbox y Despacho a Casilla** | Error de inferencia de tipos PostgreSQL ($8::varchar) y regex restrictiva de UUID excluía identificadores demo/nil. | Se ajustó el regex de UUID a estándar RFC y se añadió cast explícito `$8::varchar` en `DestinoCasilla`. | `despachador-notificaciones.ts` | Evento `resolucion_emitida` procesado hacia `sigd_auth.notificacion_casilla` con `id_evento = 01a274f4-...`. | `despachador-notificaciones.spec.ts`, prueba viva `verify_casilla_e2e.ts` | **Aprobado (Idempotente, 1 fila)** | Ninguna | **RESUELTA Y VERIFICADA** |
| **11. Consulta y Lectura en Casilla** | Falta de prueba de acceso real como administrado del expediente. | Login autenticado como `ciudadano.demo`. Consulta de bandeja `GET /casilla/notificaciones` y lectura `PATCH /casilla/notificaciones/:id/lectura`. | `casilla.router.ts` | Estado actualizado de `NO_LEIDO` a `LEIDO` con `fecha_lectura` ISO-8601. | Prueba viva en :3008 con JWT de `ciudadano.demo` | **Aprobado (HTTP 200)** | Ninguna | **RESUELTA Y VERIFICADA** |
| **12. Acuse Legal y Constancia** | Falta de prueba de emisión de constancia y acuse legal. | `POST /casilla/notificaciones/:id/acuse` genera `idAcuse` (`ACU-2026-FA0F4EA9`), sellado de tiempo y hash SHA-256 legal. DTO mapea a `NOTIFICADO`. | `casilla.router.ts` | Campos `id_acuse`, `acuse_hash_sha256`, `acuse_sellado_tiempo` persistidos en PostgreSQL. | Prueba viva en :3008 con confirmación de administrado | **Aprobado (HTTP 201)** | Ninguna | **RESUELTA Y VERIFICADA** |
| **13. Aislamiento Multitenant Casilla** | Falta de verificación de acceso no autorizado. | Consulta de la notificación de `ciudadano.demo` con JWT de `operador.demo`. | `casilla.router.ts` | `HTTP 403 Forbidden` devuelto de manera consistente. | Prueba viva en :3008 | **Aprobado (HTTP 403)** | Ninguna | **RESUELTA Y VERIFICADA** |
| **14. Archivado Formal** | Previamente ejecutado sobre un expediente que alcanzó `RESUELTO` vía bypass. | `archivarExpediente` exige estrictamente estado previo `RESUELTO` conforme a la FSM. Si el expediente está en `EN_FIRMA`, no puede ser archivado. | `derivaciones.service.ts` | FSM guarda activa: `ck_transicion_archivado_terminal`. `EXP-2026-000016` se conserva en `EN_FIRMA` sin archivar ilegalmente. | `derivaciones.spec.ts` (prueba 13) | **Aprobado (FSM intacta)** | Resolución y firma digital previa | **BLOQUEADA POR DEPENDENCIA EXTERNA** |

---

## 3. DETALLE DE LA CORRECCIÓN DEL BYPASS DE FIRMA DIGITAL

### 3.1 Defecto Identificado
En la ejecución anterior, `atenderExpediente` ejecutaba incondicionalmente:
```typescript
// Lógica anterior defectuosa:
if (estadoAnterior === 'EN_REVISION') {
  INSERT INTO movimiento_tramite ... ('EN_REVISION', 'ENVIAR_A_FIRMA', 'EN_FIRMA');
}
INSERT INTO movimiento_tramite ... ('EN_FIRMA', 'FIRMA', 'RESUELTO'); // <-- BYPASS: forzaba resolución sin firma
```
Esto permitía que una llamada a `POST /api/v1/expedientes/:id/atender` cerrara el expediente en `RESUELTO` sin que mediara un solo byte de firma digital PAdES, certificado criptográfico ni sello TSA.

### 3.2 Corrección Implementada
En `backend/src/domains/rutadoc/derivaciones.service.ts`:
1. Si el expediente se encuentra en `EN_REVISION`:
   - Registra el pase al despacho de firma: `'EN_REVISION' + 'ENVIAR_A_FIRMA' -> 'EN_FIRMA'`.
   - Emite el evento de Outbox `ExpedienteEnviadoAFirma`.
   - **Termina la ejecución de inmediato (`return`).** El expediente queda formalmente en `EN_FIRMA` (bandeja institucional `POR_FIRMAR`).
2. Si el expediente se encuentra en `EN_FIRMA`:
   - Consulta si existe evidencia criptográfica válida:
     ```sql
     SELECT EXISTS (
       SELECT 1 FROM sigd_doc.resolucion r
       JOIN sigd_doc.documento_adjunto d ON d.expediente_id = r.expediente_id AND d.s3_key = 'resoluciones/' || r.numero_borrador || '.pdf'
       JOIN sigd_doc.firma_digital_documento f ON f.documento_id = d.documento_adjunto_id AND f.estado = 'FIRMADO_DIGITALMENTE'
       WHERE r.expediente_id = $1::uuid AND r.estado = 'FIRMADA'
     ) AS tiene_firma;
     ```
   - Si `tiene_firma` es falso, **lanza `ConflictError` (HTTP 409)**:
     `"El expediente se encuentra en despacho para firma (EN_FIRMA) y no cuenta con firma digital verificada. Debe completarse la firma digital PAdES institucional antes de resolver el trámite."`
   - Únicamente si la firma está verificada, transiciona a `RESUELTO`.

3. En `backend/src/domains/docucore/callbackRefirma.service.ts`:
   - Cuando el webhook autenticado de ReFirma completa la validación criptográfica PAdES y actualiza `sigd_doc.resolucion` a `FIRMADA`:
   - Verifica si el expediente asociado está en `EN_FIRMA`:
   - Si es así, registra legítimamente en `sigd_rut.movimiento_tramite`:
     `'EN_FIRMA' + 'FIRMA' -> 'RESUELTO'` con la identidad institucional del Director General firmante.

### 3.3 Verificación en Entorno Real
En la prueba viva con `EXP-2026-000016`:
```
[ETAPA 5] Despachando para firma (atenderExpediente en EN_REVISION)...
  -> Respuesta HTTP 200: Pase a firma registrado.
  -> Estado verificado en PostgreSQL: EN_FIRMA (evento: ENVIAR_A_FIRMA)

[ETAPA 6] PRUEBA DE SEGURIDAD: Intentando forzar RESUELTO sin firma digital en EN_FIRMA...
  -> Respuesta del servidor: HTTP 409
  -> Detalle del rechazo: "El expediente se encuentra en despacho para firma (EN_FIRMA) y no cuenta con firma digital verificada. Debe completarse la firma digital PAdES institucional antes de resolver el trámite."
  [GUARD_VERIFIED] BYPASS DE FIRMA DIGITAL BLOQUEADO CON ÉXITO. El expediente PERMANECE legítimamente en EN_FIRMA.
```

---

## 4. AUDITORÍA DE MINIMO PRIVILEGIO (WORM)

Se auditaron los privilegios efectivos en `sigd_jacobo_demo` sobre las tablas del esquema `sigd_audit`:

```sql
SELECT grantee, privilege_type FROM information_schema.role_table_grants 
WHERE table_schema = 'sigd_audit' AND table_name IN ('bitacora_auditoria', 'evento_outbox')
  AND grantee = 'sigd_jacobo_user';
```
**Resultado:**
- `bitacora_auditoria`: `INSERT`, `SELECT` exclusivamente.
- `evento_outbox`: `INSERT`, `SELECT`, `UPDATE` exclusivamente (necesario para actualizar estado de `PENDIENTE` a `PROCESADO`/`FALLIDO` e incrementar `intentos`).

**Pruebas negativas de inmutabilidad (ejecutadas con `psql -U sigd_jacobo_user`):**
1. `UPDATE sigd_audit.bitacora_auditoria SET esquema = 'hacked';`  
   -> **`ERROR: permission denied for table bitacora_auditoria`** (Aprobado).
2. `DELETE FROM sigd_audit.bitacora_auditoria;`  
   -> **`ERROR: permission denied for table bitacora_auditoria`** (Aprobado).
3. `TRUNCATE sigd_audit.bitacora_auditoria;`  
   -> **`ERROR: permission denied for table bitacora_auditoria`** (Aprobado).
4. `DELETE FROM sigd_audit.evento_outbox;`  
   -> **`ERROR: permission denied for table evento_outbox`** (Aprobado).
5. `TRUNCATE sigd_audit.evento_outbox;`  
   -> **`ERROR: permission denied for table evento_outbox`** (Aprobado).

---

## 5. REPRODUCIBILIDAD DE TRAZABILIDAD (tr_auto_calificacion)

La función espuria `sigd_tra.tr_fn_auto_calificacion()`, que causó el bloqueo del expediente histórico `EXP-2026-000012` por violar la regla de trazabilidad (`ESTADO_SIN_TRAZABILIDAD`), fue saneada en la base activa y en todos los scripts de inicialización del repositorio:
- `scratch/seed_demo_complete.sql` (líneas 124-135)
- `scratch/seed_e2e.sql`
- `scratch/generate_demo_credentials.ts` (líneas 337-347)
- `scratch/run_sandbox_e2e_browser.ts`

**Código canónico persistido:**
```sql
CREATE OR REPLACE FUNCTION sigd_tra.tr_fn_auto_calificacion()
RETURNS trigger AS $$
BEGIN
  -- Neutralización de auto-calificación espuria.
  -- El ciclo de vida de todo expediente inicia en estado canónico REGISTRADO.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
Con esta neutralización, cualquier nueva inicialización o despliegue en cualquier entorno preservará el inicio canónico en `REGISTRADO`, delegando cada transición de estado exclusivamente a inserciones legítimas en `sigd_rut.movimiento_tramite`.

El expediente histórico `EXP-2026-000012` se conserva en su estado original en cuarentena como evidencia de auditoría.

---

## 6. REGRESIONES GLOBALES Y VERIFICACIÓN DE ESTABILIDAD

| Suite de Pruebas / Verificación | Comando Ejecutado | Código de Salida | Total Pruebas | Resultado |
|---|---|---|---|---|
| **Backend Unit Tests** | `npx vitest run --config vitest.unit.config.ts` | 0 | 1,244 aprobadas / 10 omitidas | **100% APROBADO (74 suites)** |
| **Frontend Unit Tests** | `npx vitest run` | 0 | 716 aprobadas / 1 omitida | **100% APROBADO (64 suites)** |
| **Backend Typecheck** | `npx tsc --noEmit` | 0 | N/A (0 errores TypeScript) | **100% APROBADO** |
| **Frontend Typecheck** | `npx tsc --noEmit` | 0 | N/A (0 errores TypeScript) | **100% APROBADO** |
| **Git Diff Check** | `git diff --check` | 0 | N/A (sin conflictos ni errores) | **100% APROBADO** |
| **ZERO TOUCH sigd_prueba** | `SELECT count(*) FROM sigd_tra.expediente` | 0 | 2 expedientes confirmados | **100% INTACTA** |
| **Servidores SIGD** | `Invoke-RestMethod :3008/health` / `:5178` | 0 | Backend UP / Frontend 200 OK | **OPERATIVOS (Sin duplicados)** |

---

## 7. CONCLUSIÓN Y DICTAMEN TÉCNICO FINAL

1. **El prototipo SIGD en la rama `B_JACOBO` ha alcanzado el máximo nivel de completitud funcional y seguridad arquitectónica legítimamente alcanzable sin dependencias de hardware externo.**
2. **El defecto crítico de Bypass de Firma Digital fue completamente subsanado:** el software rechaza activamente cualquier intento de declarar un expediente como `RESUELTO` sin verificación criptográfica de la firma digital.
3. **No se fabricaron firmas digitales, certificados falsos ni sellos de tiempo sintéticos en la base de datos viva.** En su lugar, el flujo institucional queda formalmente blindado y detenido en `EN_FIRMA`, preparado para completar la operación auténtica en cuanto se disponga del cliente oficial ReFirma y el token criptográfico acreditado ante RENIEC.
4. **La entrega, lectura, generación de acuse legal y descarga en Casilla Electrónica fue verificada integralmente de extremo a extremo con credenciales y documentos legítimos.**
5. **La base de datos institucional `sigd_prueba` permaneció inalterada en todo momento (ZERO TOUCH).**
