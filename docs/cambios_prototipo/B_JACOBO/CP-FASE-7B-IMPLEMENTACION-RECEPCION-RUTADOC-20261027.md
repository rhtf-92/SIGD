# SIGD IESTP SUIZA 2026 — FASE 7B
## IMPLEMENTACIÓN CORRECTIVA Y VALIDACIÓN E2E DE LA RECEPCIÓN EN RUTADOC
### Informe Pericial de Implementación, Integración Frontend-Backend y Validación E2E

- **Fecha:** 27 de octubre de 2026
- **Entorno de Trabajo:** `C:\Users\Liz\Desktop\SIGD\SIGD`
- **Rama de Trabajo:** `B_JACOBO`
- **HEAD de Referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`
- **Base de Datos Prototipo:** `sigd_jacobo_demo` (PostgreSQL 18.6, puerto 5433)
- **Base Institucional Protegida:** `sigd_prueba` (puerto 5432, Inmutable — ZERO TOUCH)
- **Expediente Validado:** `EXP-2026-000011` (`9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca`)
- **Área Receptora:** Secretaría Académica (`SEC`, UUID `2b147b0d-7c8f-434f-b75a-598a1ccb855b`)
- **Operador Auténtico:** `operador.demo` (UUID `00000000-0000-0000-0000-000000000030`, Identificador numérico: `990000003`)
- **Transición Ejecutada:** `DERIVADO` + `RECEPCION` → `EN_REVISION` (Secuencia 2 → 3)

---

## 1. DIAGNÓSTICO INICIAL Y CAUSA RAÍZ

Durante la Fase 7A se constató que la Máquina de Estados Finitos (`backend/src/domains/rutadoc/rutadoc.fsm.ts`) y la tabla relacional `sigd_rut.transicion_estado_tramite` definían formalmente la transición canónica:
```
('DERIVADO', 'RECEPCION', 'EN_REVISION')
```
Sin embargo, en el router Express (`rutadoc.router.ts`) y en el controlador de movimientos (`derivaciones.controller.ts`), **no existía ningún endpoint HTTP** expuesto para que los operadores de las áreas de destino pudieran recepcionar expedientes derivados. El catálogo de endpoints solo contemplaba derivar, atender, archivar, acumular, observar y subsanar.

Asimismo, la interfaz de usuario en `ExpedienteDetallePage.tsx` no contaba con el botón ni con la acción conectada para recepcionar expedientes cuando su estado era `DERIVADO`, impidiendo que los usuarios de Secretaría Académica recepcionaran formalmente los expedientes que les eran derivados desde Mesa de Partes u otras dependencias.

---

## 2. MODIFICACIONES IMPLEMENTADAS

En estricto cumplimiento de las directivas institucionales de preservación arquitectónica, se implementó la solución mediante extensiones quirúrgicas y compatibles:

### Backend
1. **Nuevo DTO de Validación:**
   - Archivo: `backend/src/domains/rutadoc/dto/recepcionarExpediente.dto.ts`
   - Esquema: `RecepcionarExpedienteSchema` (Zod). Valida `observaciones` opcionales (máx. 1000 caracteres) en modo estricto.
   - Seguridad: Se rechaza deliberadamente inyectar `unidad_organica_id` o `usuario_id` desde el cliente para prevenir escalación de privilegios (*Broken Access Control*).

2. **Servicio Institucional de Recepción:**
   - Archivo: `backend/src/domains/rutadoc/derivaciones.service.ts`
   - Función: `recepcionarExpediente(cliente, expedienteId, datos)`
   - Bloqueo pesimista: `SELECT ... FROM sigd_tra.expediente ... FOR UPDATE OF e`.
   - Validación FSM: Verifica que el estado actual sea `DERIVADO`. Si es `EN_REVISION`, rechaza con `409 Conflict` (`EXPEDIENTE_YA_RECEPCIONADO`). Si es otro estado, rechaza con `409 Conflict` (`ESTADO_NO_RECEPCIONABLE`).
   - Validación de Área: Comprueba que el usuario pertenezca a la misma área institucional del expediente derivado (`area_actual_id`).
   - Mapeo de Identidad: Resuelve el identificador del operador institucional (`sigd_auth.operador_identidad` → `990000003`).
   - Inserción Transaccional: Inserta en `sigd_rut.movimiento_tramite` delegando la asignación de secuencia al trigger institucional `tr_registrar_movimiento_identidad` y la actualización del estado al trigger `tr_estado_actual_movimiento`.
   - Outbox Transaccional: Inserta atómicamente el evento `ExpedienteRecepcionado` en `sigd_audit.evento_outbox`.

3. **Controlador REST y Rutas:**
   - Archivo: `backend/src/domains/rutadoc/derivaciones.controller.ts`
   - Endpoints montados:
     - `POST /api/v1/expedientes/:id/recepcionar`
     - `POST /api/v1/expedientes/:id/movimientos/recepcionar` (alias)
   - Transaccionalidad: Bloque explícito `BEGIN` / `COMMIT` / `ROLLBACK`.

4. **Middleware RBAC de Ámbito:**
   - Archivo: `backend/src/domains/rutadoc/rutadoc.router.ts`
   - Autorización: Admite tanto `EXPEDIENTE_DERIVAR` como `EXPEDIENTE_RESOLVER`, comprobando que el área del token coincida con el área del expediente en `sigd_rut.estado_actual_expediente`.

### Frontend
1. **Contratos y Tipos:**
   - Archivo: `frontend/src/types/expedienteActions.ts`
   - Se incorporaron las interfaces `SolicitudRecepcion` y `ResultadoRecepcion`, y se extendió `ServicioExpedienteActions` con `recepcionar`.

2. **Cliente de Acciones:**
   - Archivo: `frontend/src/api/expedienteActions.ts`
   - Soporte para la acción `recepcionar`, invocando `/api/v1/expedientes/:id/movimientos/recepcionar` y validando la respuesta confirmada del servidor.

3. **Página de Detalle de Expediente:**
   - Archivo: `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx`
   - Botón: "✓ Recepcionar Expediente" (verde esmeralda), visible únicamente cuando `expediente.estadoActual === 'DERIVADO'`.
   - Control de Concurrencia: Estado `recepcionando` que desactiva el botón y muestra "Recepcionando…" para evitar envíos múltiples.
   - Refresco Automático: Tras respuesta confirmada del servidor, invalida queries de React Query (`["expedientes"]`, `["expediente", id]`, `["trazabilidad", id]`) y despliega banner informativo de éxito.
   - Tratamiento de Errores: Captura y adapta errores HTTP (401, 403, 404, 409) mediante `adaptarErrorAccion`.

---

## 3. CONTRATO DE LA API

### Endpoint: `POST /api/v1/expedientes/:id/recepcionar`
- **Encabezados:**
  - `Authorization: Bearer <JWT>` (Requerido)
  - `Content-Type: application/json`
- **Parámetros de Ruta:**
  - `id`: UUID del expediente (ej. `9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca`)
- **Cuerpo de Solicitud (Opcional):**
  ```json
  {
    "observaciones": "Recepción formal en Secretaría Académica para revisión y proyección de resolución"
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "ok": true,
    "mensaje": "Recepción formal registrada exitosamente.",
    "expediente_id": "9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca",
    "movimientoId": "9d5ee8b4-b474-4def-99f4-868a7ec5e3f3",
    "nuevoEstado": "EN_REVISION",
    "secuencia": "3"
  }
  ```
- **Respuestas de Error:**
  - `401 Unauthorized`: Token ausente, expirado o malformado.
  - `403 Forbidden`: Operador sin permisos (`EXPEDIENTE_DERIVAR` / `EXPEDIENTE_RESOLVER`) o perteneciente a una unidad orgánica distinta al área actual del expediente.
  - `404 Not Found`: El expediente no existe en el sistema.
  - `409 Conflict`:
    - `EXPEDIENTE_YA_RECEPCIONADO`: El expediente ya se encuentra en `EN_REVISION`.
    - `ESTADO_NO_RECEPCIONABLE`: El expediente no está en estado `DERIVADO`.

---

## 4. PRUEBAS AUTOMATIZADAS Y REGRESIONES GLOBALES

Se ejecutaron las suites de pruebas automatizadas y typechecks para certificar la integridad del sistema:

### Backend
1. **Pruebas Unitarias de Derivaciones y Recepción:**
   - Archivo: `backend/tests/unit/domains/rutadoc/derivaciones.spec.ts`
   - Resultado: **21 pruebas aprobadas** (14 existentes + 7 nuevas específicas de `recepcionarExpediente`).
2. **Pruebas de Integración HTTP de Recepción:**
   - Archivo: `backend/tests/unit/domains/rutadoc/recepcion-http.spec.ts`
   - Resultado: **6 pruebas aprobadas** (200 OK, alias de ruta, 401 Unauthorized, 403 Forbidden, 409 Conflict por duplicidad, 404 Not Found).
3. **Suite Completa de RutaDoc:**
   - Archivos: 15 suites en `tests/unit/domains/rutadoc/`
   - Resultado: **170 pruebas aprobadas, 0 fallidas**.
4. **Regresión Global de Backend:**
   - Comando: `npm run test:unit`
   - Resultado: **69 suites aprobadas, 1 omitida (70 suites en total). 1199 pruebas aprobadas, 10 omitidas, 0 falladas**.
5. **Typecheck Backend:**
   - Comando: `tsc --noEmit`
   - Resultado: **0 errores**.

### Frontend
1. **Pruebas Unitarias de Acción de Recepción:**
   - Archivo: `frontend/tests/unit/pages/ExpedienteRecepcionAction.test.tsx`
   - Resultado: **4 pruebas aprobadas** (visibilidad en DERIVADO, ocultamiento en EN_REVISION, envío y éxito, captura de error 409).
2. **Pruebas de Bandeja y Trazabilidad:**
   - Archivos: `BandejaExpedientesPage.test.tsx`, `ExpedienteTimeline.test.tsx`
   - Resultado: **40 pruebas aprobadas**.
3. **Regresión Global de Frontend:**
   - Comando: `npm test` (`vitest run`)
   - Resultado: **63 suites aprobadas (63 totales). 708 pruebas aprobadas, 1 omitida, 0 falladas**.
4. **Typecheck Frontend:**
   - Comando: `tsc --noEmit`
   - Resultado: **0 errores**.

### Formato y Sintaxis
- `git diff --check`: **0 errores de sintaxis o espacios en blanco**.

---

## 5. VALIDACIÓN E2E CONTROLADA Y EVIDENCIA DE PERSISTENCIA

Con los servicios locales activos (Backend en puerto 3008 y Frontend en puerto 5178), se ejecutó la prueba E2E autorizada sobre el expediente de prueba:

### Ejecución E2E
1. **Autenticación Institucional:**
   - Solicitud: `POST /api/v1/auth/login` con credenciales de `operador.demo`.
   - Respuesta: 200 OK. Usuario: `Lic. Operador Académico Demo`, Roles: `ESPECIALISTA, SECRETARIO`, Área: `2b147b0d-7c8f-434f-b75a-598a1ccb855b` (`SEC`).
2. **Consulta Previa:**
   - `GET /api/v1/expedientes/9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca`
   - CUT: `EXP-2026-000011` | Estado: `DERIVADO` | Área: `2b147b0d-7c8f-434f-b75a-598a1ccb855b` | Secuencia: `2`.
3. **Ejecución de Recepción:**
   - Solicitud: `POST /api/v1/expedientes/9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca/recepcionar`
   - Cuerpo: `{"observaciones":"Recepción formal en Secretaría Académica para revisión y proyección de resolución"}`
   - Respuesta: **HTTP 200 OK**
   - Payload:
     ```json
     {
       "ok": true,
       "mensaje": "Recepción formal registrada exitosamente.",
       "expediente_id": "9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca",
       "movimientoId": "9d5ee8b4-b474-4def-99f4-868a7ec5e3f3",
       "nuevoEstado": "EN_REVISION",
       "secuencia": "3"
     }
     ```
4. **Verificación de Idempotencia y Rechazo de Duplicados:**
   - Segunda llamada inmediata con el mismo payload: **HTTP 409 Conflict** (`EXPEDIENTE_YA_RECEPCIONADO`).

### Evidencia en PostgreSQL (`sigd_jacobo_demo`)
Consultas directas de solo lectura en el motor de base de datos confirmaron:

1. **Estado Actual (`sigd_rut.estado_actual_expediente`):**
   ```
   expediente_id       : 9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca
   secuencia           : 3
   estado_nuevo        : EN_REVISION
   evento              : RECEPCION
   area_actual_id      : 2b147b0d-7c8f-434f-b75a-598a1ccb855b (SEC)
   id_movimiento       : 9d5ee8b4-b474-4def-99f4-868a7ec5e3f3
   fecha_hora          : 2026-10-27 20:46:49.244+00
   usuario_operador_id : 990000003
   ```
2. **Historial de Movimientos (`sigd_rut.movimiento_tramite`):**
   - Secuencia 2: `EN_CALIFICACION` + `DERIVACION` → `DERIVADO` | Operador: `990000000` (Mesa de Partes).
   - Secuencia 3: `DERIVADO` + `RECEPCION` → `EN_REVISION` | Operador: `990000003` (Secretaría Académica).
3. **Trazabilidad HTTP (`GET /api/v1/expedientes/:id/trazabilidad`):**
   - Refleja ambas actuaciones con su orden cronológico y transicional exacto.
4. **Bandeja de Trabajo:**
   - En la pestaña `EN_TRAMITE` ("En trámite"), aparece el expediente `EXP-2026-000011` en estado `EN_REVISION`.
   - En la pestaña `DERIVADOS`, el expediente ya no figura, confirmando la concordancia de la UI.
5. **Evento Outbox (`sigd_audit.evento_outbox`):**
   - Evento: `ExpedienteRecepcionado` (`7616b31d-afa3-465c-9b80-fed25e622b1e`) registrado en la misma transacción y procesado exitosamente (`PROCESADO`) por el worker.

---

## 6. VERIFICACIÓN DE PROTECCIÓN INSTITUCIONAL Y CORRELATIVOS

1. **Base de Datos Protegida (`sigd_prueba` - puerto 5432):**
   - Conteo en `sigd_tra.expediente`: **2 registros** (Totalmente inmutable — ZERO TOUCH).
2. **Base de Demostración (`sigd_jacobo_demo` - puerto 5433):**
   - Conteo en `sigd_tra.expediente`: **11 registros** (Sin duplicación de expedientes).
   - Correlativo anual CUT (`sigd_tra.secuencia_anual_cut` para año 2026): **11** (Sin consumo ajeno).
   - Secuencia de asiento (`sigd_tra.seq_asiento_numero_registro`): **10010** (Sin alteración).
   - Resoluciones en `sigd_doc.resolucion`: **4 registros** (Intactas para la siguiente fase).

---

## 7. DICTAMEN FINAL Y CONCLUSIÓN

La **Fase 7B queda declarada como COMPLETADA y EXITOSA**:
- La brecha funcional de recepción documentaria en RutaDoc ha sido resuelta en su totalidad.
- El backend expone el endpoint oficial y seguro `POST /api/v1/expedientes/:id/recepcionar`.
- El frontend integra la acción dentro del flujo institucional de `ExpedienteDetallePage`.
- El RBAC y la restricción por área operan efectivamente a nivel de servidor.
- La persistencia transaccional y el Outbox quedaron verificados en PostgreSQL.
- El expediente `EXP-2026-000011` se encuentra formalmente en estado `EN_REVISION` en Secretaría Académica.

El prototipo SIGD se encuentra técnica y operativamente listo para proseguir con la **siguiente fase: Proyección de la Resolución Directoral Administrativa en DocuCore** (`POST /api/v1/resoluciones/proyectar`).
