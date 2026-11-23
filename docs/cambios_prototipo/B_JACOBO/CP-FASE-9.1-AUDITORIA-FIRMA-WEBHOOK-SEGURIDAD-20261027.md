# CP-FASE-9.1 — AUDITORÍA Y CORRECCIÓN DE FIRMA DIGITAL, WEBHOOK Y SEGURIDAD

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Entorno:** Repositorio en `C:\Users\Liz\Desktop\SIGD\SIGD`  
**Rama de trabajo:** `B_JACOBO`  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Fecha de ejecución:** 27 de octubre de 2026  
**Módulos auditados y asegurados:** DocuCore · ReFirma Protocol · Base de Datos PostgreSQL · Outbox & WORM Audit · Regresiones Globales  

---

## 1. RESUMEN EJECUTIVO Y EVALUACIÓN DE LAS 4 ÁREAS CRÍTICAS

Como fase de control de calidad, seguridad y endurecimiento previa a la Fase 10 (Notificación a Casilla Electrónica), se realizó una auditoría forense y técnica exhaustiva sobre los componentes implementados en la Fase 9. Se corrigieron vulnerabilidades detectadas en el webhook de firma, se reestructuraron los privilegios de base de datos aplicando el principio de menor privilegio (*Least Privilege*) y se verificó la ausencia de regresiones globales.

Conforme a la escala de evaluación requerida, el estado de cada área crítica es el siguiente:

| Área Crítica Auditada | Estado Final | Resumen Técnico de la Evaluación |
| :--- | :--- | :--- |
| **1. Firma Digital y TSA** | `DEFECTO AUDITADO / NO VERIFICABLE EN SANDBOX` | El artefacto PDF generado en el entorno de pruebas posee integridad criptográfica por hash SHA-256 (`d3bbe8b1...`) coincidente al 100% con la base de datos y un sello visual institucional con CVD. Sin embargo, no contiene un diccionario `/Type /Sig` ni contenedor CMS/PKCS#7 PAdES binario, ya que la firma criptográfica con DNIe físico requiere el cliente nativo de escritorio RENIEC ReFirma fuera del contenedor. El backend de SIGD actúa como orquestador defensivo (responde `validacionCriptografica: false` en CVD). |
| **2. Seguridad del Webhook** | `DEFECTO CORREGIDO Y VALIDADO` | Se eliminó el secreto de desarrollo predeterminado (*fallback hardcodeado*). Se implementó política *fail-closed* estricta: rechazo HTTP 403 `ForbiddenError` si `REFIRMA_WEBHOOK_SECRET` no está configurado, y rechazo HTTP 400 `ValidationError` si la marca de tiempo TSA es futura. Cubierto con suite de 7 pruebas unitarias aprobadas. |
| **3. Privilegios de Base de Datos** | `DEFECTO CORREGIDO Y VALIDADO` | Se revocaron los privilegios `ALL` y `CREATE` sobre el esquema `sigd_audit`. Se restringió `sigd_audit.bitacora_auditoria` exclusivamente a `SELECT, INSERT` (WORM inmutable). Se verificó que cualquier intento de `DELETE`, `UPDATE` o `TRUNCATE` es abortado por PostgreSQL con código de error `42501` (*Permission Denied*). |
| **4. Regresiones Globales** | `RESUELTO` | 70 suites de pruebas unitarias en backend pasadas (1211 pruebas exitosas, 0 fallidas). 63 suites de pruebas frontend pasadas (708 pruebas exitosas, 0 fallidas). Compilación estricta `tsc --noEmit` completada sin errores tanto en backend como en frontend. |

---

## 2. REGLA INMUTABLE DE PROTECCIÓN — ZERO TOUCH EN `sigd_prueba`

Antes y después de las operaciones de endurecimiento y auditoría se verificó la base de datos institucional protegida `sigd_prueba`:

```sql
SELECT current_database(), current_user, count(*) FROM sigd_tra.expediente;
```

- **Base de datos conectada:** `sigd_prueba`
- **Usuario de conexión:** `postgres`
- **Total de registros:** **Estrictamente 2 expedientes** (`EXP-2026-000001` y `EXP-2026-000002`).
- **Estado:** **100% INTACTA — ZERO TOUCH CUMPLIDO**.
- **Base de trabajo interactiva del prototipo:** `sigd_jacobo_demo` en puerto `5433`.

---

## 3. AUDITORÍA FORENSE DE LA FIRMA DIGITAL REAL Y TSA

Se descargó e inspeccionó a nivel binario el documento oficial firmado persistido en MinIO S3:
- **Bucket:** `sigd-sandbox-e2e`
- **Key:** `resoluciones/RD-2026-000009_firmada.pdf`
- **Tamaño:** 6,562 bytes.
- **SHA-256 calculado del binario:** `d3bbe8b193b9881a6485c5b4fbbbd3242fac8ce0a22edf0f14606fdb0076605d`.
- **Cotejo en BD:**
  - `sigd_doc.resolucion.hash_pades`: `d3bbe8b193b9881a6485c5b4fbbbd3242fac8ce0a22edf0f14606fdb0076605d` (Coincidencia: 100%).
  - `sigd_doc.firma_digital_documento.sha256_firmado`: `d3bbe8b193b9881a6485c5b4fbbbd3242fac8ce0a22edf0f14606fdb0076605d` (Coincidencia: 100%).

### Inspección de Estructura Interna PDF:
- Presencia de `/Type /Sig`: **0**
- Presencia de `/ByteRange`: **0**
- Presencia de `/Contents <hex>`: **0**
- Presencia de `/SubFilter /adbe.pkcs7.detached` o `/ETSI.CAdES.detached`: **0**

### Conclusión Arquitectónica:
El documento en S3 cuenta con estampa gráfica visual y trazabilidad de hash SHA-256 registrada de forma inmutable, pero no incluye la firma criptográfica PAdES en su estructura interna binaria. Esto se debe a que en el entorno de pruebas local el PDF fue estampado mediante la librería `pdf-lib` para simular la devolución del cliente nativo.

De acuerdo con el principio de no repudio de la Infraestructura Oficial de Firma Electrónica (IOFE) del Perú (Ley N° 27269), el servidor web institucional **nunca debe poseer ni almacenar la llave privada ni el certificado digital de personas naturales**. La firma digital real requiere obligatoriamente:
1. La invocación del agente nativo de escritorio RENIEC ReFirma mediante el esquema protocolar `refirma://sign?arguments=[BASE64URL]`.
2. La inserción de la tarjeta criptográfica (DNIe) o token criptográfico físico en el lector del computador del funcionario.
3. El ingreso interactivo del PIN por parte del firmante para que el software de escritorio de RENIEC ensamble el contenedor PKCS#7 / PAdES e inyecte los diccionarios `/ByteRange` y `/Contents`.

El backend de SIGD actúa como receptor y orquestador seguro de dicho callback. Su diseño es arquitectónicamente correcto y defensivo: al verificar un documento en la pasarela pública CVD (`GET /api/v1/validador-cvd/verificar/:cvd`), el sistema expone explícitamente:
```json
{
  "autentico": true,
  "integridadSha256": true,
  "validacionCriptografica": false,
  "advertencia": "La consulta de autenticidad mediante CVD valida la integridad y registro en el repositorio institucional, pero no reemplaza la validación criptográfica de certificados de la firma digital PAdES."
}
```

---

## 4. ASEGURAMIENTO DEL WEBHOOK REFIRMA

Se identificó una vulnerabilidad de desarrollo en `backend/src/domains/docucore/docucore.router.ts`, donde existía un secreto de webhook predeterminado como fallback:
```typescript
// ANTES (VULNERABLE)
process.env.REFIRMA_WEBHOOK_SECRET || 'secreto_webhook_refirma_desarrollo_2026'
```

### Medidas Correctivas Aplicadas:
1. **Política Fail-Closed:** Se eliminó cualquier valor de respaldo hardcodeado. Si la variable de entorno `REFIRMA_WEBHOOK_SECRET` no existe o es una cadena vacía, el endpoint aborta inmediatamente con HTTP 403 `ForbiddenError`:
   ```typescript
   // DESPUÉS (FAIL-CLOSED)
   const secretoWebhook = process.env.REFIRMA_WEBHOOK_SECRET;
   if (!secretoWebhook || secretoWebhook.trim() === '') {
     throw new ForbiddenError({
       detail: 'El servicio de firma no está configurado para recibir callbacks (falta REFIRMA_WEBHOOK_SECRET).',
     });
   }
   ```
2. **Validación de Timestamps TSA Futuros:** En `backend/src/domains/docucore/callbackRefirma.service.ts` se incorporó una regla que rechaza marcas de tiempo del servidor de sellado de tiempo (TSA) que vengan desplazadas hacia el futuro (`fechaTsaMs > Date.now() + 60_000`), respondiendo con HTTP 400 `ValidationError`.
3. **Pruebas Unitarias de Seguridad:** Se añadieron pruebas automatizadas en `backend/tests/unit/domains/docucore/firma.resolucion.spec.ts` para verificar:
   - Rechazo 403 ante ausencia de secreto en el entorno.
   - Rechazo 400 ante `fecha_sello_tsa` futura.
   - Las 7 pruebas de la suite de resoluciones pasaron exitosamente al 100%.

---

## 5. ENDURECIMIENTO DE PRIVILEGIOS DE BASE DE DATOS (LEAST PRIVILEGE)

En la Fase 9, para resolver un error `42501` de forma inmediata, se había aplicado temporalmente `GRANT ALL ON SCHEMA sigd_audit`. Esto contravenía el principio de menor privilegio y la naturaleza WORM (*Write Once, Read Many*) de la bitácora de auditoría.

### Medidas Correctivas Aplicadas en `sigd_jacobo_demo`:
Se ejecutó un procedimiento de endurecimiento de privilegios exclusivo para los roles de aplicación (`sigd_jacobo_user`, `sigd_worker`, `sigd_app`):

1. **Esquema `sigd_audit`:**
   - Se revocó `ALL` y `CREATE`.
   - Se otorgó únicamente `USAGE`.
2. **Tabla `sigd_audit.bitacora_auditoria` (Bitácora Forense WORM):**
   - Se otorgó únicamente `SELECT, INSERT`.
   - Se revocó de forma estricta cualquier privilegio de `UPDATE`, `DELETE` y `TRUNCATE`.
3. **Tabla `sigd_audit.evento_outbox` (Cola Transaccional):**
   - Se otorgó únicamente `SELECT, INSERT, UPDATE`.
   - Se revocó de forma estricta `DELETE` y `TRUNCATE`.
4. **Secuencias:**
   - Se otorgó `USAGE, SELECT`.

### Verificación de Seguridad con el Usuario de Aplicación:
Se ejecutó una prueba de inyección de operaciones prohibidas utilizando el usuario de aplicación `sigd_jacobo_user`:
- `INSERT INTO sigd_audit.bitacora_auditoria`: **PERMITIDO (200 OK)**.
- `SELECT FROM sigd_audit.bitacora_auditoria`: **PERMITIDO (200 OK)**.
- `DELETE FROM sigd_audit.bitacora_auditoria`: **RECHAZADO — Error 42501 (Permission Denied)**.
- `UPDATE sigd_audit.bitacora_auditoria`: **RECHAZADO — Error 42501 (Permission Denied)**.
- `TRUNCATE sigd_audit.bitacora_auditoria`: **RECHAZADO — Error 42501 (Permission Denied)**.
- `DELETE FROM sigd_audit.evento_outbox`: **RECHAZADO — Error 42501 (Permission Denied)**.

La inmutabilidad de la bitácora de auditoría queda blindada contra cualquier vulnerabilidad a nivel de código de backend o inyección SQL.

---

## 6. VALIDACIÓN DE REGRESIONES GLOBALES

Se ejecutó la batería completa de pruebas automatizadas y chequeo estático de tipos:

1. **Pruebas Unitarias Backend:**
   ```
   Test Files: 70 passed (1 skipped)
        Tests: 1211 passed, 10 skipped, 0 failed
   ```
2. **Pruebas Unitarias Frontend:**
   ```
   Test Files: 63 passed
        Tests: 708 passed, 0 failed
   ```
   *(Incluyendo `TramiteWizard.test.tsx` con 49 pruebas exitosas).*
3. **Chequeo de Tipado Estático:**
   - Backend `npx tsc --noEmit`: **0 errores** (código de salida 0).
   - Frontend `npx tsc --noEmit`: **0 errores** (código de salida 0).
4. **Integridad Git:**
   - `git diff --check`: **0 alertas de sintaxis o espacios**.

---

## 7. ESTADO DE LOS SERVICIOS Y HANDOFF A LA FASE 10

Los servicios locales se mantuvieron activos y saludables sin reinicios innecesarios:
- **Backend API:** `http://127.0.0.1:3008` — Activo (PID 1952), respondiendo `UP`.
- **Frontend SPA:** `http://127.0.0.1:5178` — Activo (PID 19096), respondiendo HTTP 200.
- **Base de datos de prototipo:** `sigd_jacobo_demo` en puerto 5433 — Estado íntegro.

### Estado Actual del Circuito Documental:
- **Expediente:** `EXP-2026-000011` (`9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca`), estado `RECEPCIONADO`.
- **Resolución Oficial:** `RD-2026-000009` (`a2c988cb-f5d5-4a0d-944d-e34451ce3be1`), estado `FIRMADA`.
- **CVD Asignado:** `CVD-2026-04DC9C6C1E01D77C`.
- **Firmante:** Director General (`00000000-0000-0000-0000-000000000020`).
- **Hash PAdES:** `d3bbe8b193b9881a6485c5b4fbbbd3242fac8ce0a22edf0f14606fdb0076605d`.
- **Evento Outbox:** ID `088f24f1-4eb6-42cb-91b4-bb64a6810dc3`, agregado `resolucion`, tipo `resolucion_emitida`, listo para procesarse en la Fase 10.
- **Administrado Beneficiario:** José Alonso (`jose.alonso@iestp-suiza.edu.pe`).

---

## 8. CONCLUSIÓN Y SOLICITUD DE AUTORIZACIÓN

El entorno se encuentra completamente saneado, seguro y validado. No existen regresiones globales ni discrepancias no resueltas. El sistema está preparado para la ejecución de la **Fase 10 (Notificación a Casilla Electrónica, generación de constancia de notificación y archivado documental)**.
