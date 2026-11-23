# SIGD IESTP SUIZA 2026 — INFORME DE DIAGNÓSTICO Y PROPUESTA DE AUTORIZACIÓN
## CORRECCIÓN DE TRAZABILIDAD (tr_auto_calificacion) Y ESTADO DEL RECORRIDO E2E (SUZ26-035)

**Fecha:** 2026-10-27 / 2026-10-28  
**Rama:** `B_JACOBO`  
**HEAD histórico:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Entorno de ejecución:** Windows PowerShell / Docker Compose / Node.js / PostgreSQL 17 / MinIO S3 / Redis  

---

## 1. RESUMEN EJECUTIVO Y ESTADO DE REGRESIONES

Se completó la verificación integral de regresiones globales, auditoría de la causa raíz de trazabilidad y validación de componentes del prototipo `B_JACOBO`:

- **Backend Unit Tests:** **1,240 pruebas aprobadas**, 10 omitidas, 0 fallidas (74 suites passed, 1 skipped).
- **Frontend Unit Tests:** **716 pruebas aprobadas**, 1 omitida, 0 fallidas (64 suites passed).
- **Typechecks TypeScript:** 0 errores en backend (`tsc --noEmit` exit 0) y 0 errores en frontend (`tsc --noEmit` exit 0).
- **Aislamiento de Base de Datos:** Conexión operacional en `sigd_jacobo_demo`. Base institucional `sigd_prueba` intacta bajo estricta política **ZERO TOUCH** (exactamente 2 expedientes confirmados en modo solo lectura).
- **Servidores:** Backend en puerto 3008 (PID 22808) respondiendo saludablemente (`/health` devuelve `UP`); Frontend en puerto 5178 (PID 20968) activo.

---

## 2. DIAGNÓSTICO DETALLADO: CAUSA RAÍZ DE TRAZABILIDAD

### 2.1 Origen del Trigger
Mediante inspección del código y catálogo de PostgreSQL, se determinó que el trigger `tr_auto_calificacion` y su función asociada `sigd_tra.tr_fn_auto_calificacion()`:
1. **No forman parte del DDL canónico institucional:** Están ausentes de las migraciones canónicas `01` a `07` en `backend/migraciones/`.
2. **Están ausentes de la base institucional protegida:** La base `sigd_prueba` **no tiene** dicho trigger ni dicha función.
3. **Fueron inyectados en la base de demostración:** Su definición proviene exclusivamente del script auxiliar `scratch/generate_demo_credentials.ts` (líneas 358-359) y `scratch/run_sandbox_e2e_browser.ts` (líneas 234-235).

### 2.2 Definición Actual en `sigd_jacobo_demo`
```sql
CREATE OR REPLACE FUNCTION sigd_tra.tr_fn_auto_calificacion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_area_mp text;
  v_mov_id uuid := gen_random_uuid();
BEGIN
  SELECT area_id::text INTO v_area_mp FROM sigd_org.area WHERE codigo = 'MP' LIMIT 1;
  INSERT INTO sigd_rut.movimiento_secuencia (expediente_id, ultima_secuencia)
  VALUES (NEW.expediente_id, 1)
  ON CONFLICT (expediente_id) DO UPDATE SET ultima_secuencia = GREATEST(sigd_rut.movimiento_secuencia.ultima_secuencia, 1);

  INSERT INTO sigd_rut.estado_actual_expediente (
    expediente_id, secuencia, estado_nuevo, evento, area_actual_id, id_movimiento, fecha_hora, usuario_operador_id
  ) VALUES (
    NEW.expediente_id, 1, 'EN_CALIFICACION', 'INICIAR_CALIFICACION', v_area_mp, v_mov_id, now(), 1
  ) ON CONFLICT (expediente_id) DO UPDATE SET estado_nuevo = 'EN_CALIFICACION', area_actual_id = v_area_mp;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER tr_auto_calificacion
  AFTER INSERT ON sigd_tra.expediente
  FOR EACH ROW EXECUTE FUNCTION sigd_tra.tr_fn_auto_calificacion();
```

### 2.3 Causa Demostrada del Bloqueo
1. Cada vez que se registra un expediente en `sigd_tra.expediente`, el trigger genera una fila en `sigd_rut.estado_actual_expediente` con estado `EN_CALIFICACION` y un UUID sintético (`v_mov_id`) generado al vuelo por `gen_random_uuid()`.
2. El trigger **nunca inserta** el movimiento correspondiente en `sigd_rut.movimiento_tramite`.
3. En consecuencia, en el expediente `EXP-2026-000012` (`6e1ca447-238a-4c03-869d-2690e674a397`):
   - `sigd_rut.estado_actual_expediente`: `secuencia = 1`, `estado_nuevo = 'EN_CALIFICACION'`, `id_movimiento = 'b49eddd9-4f5d-4935-b5d9-83d2563a6d25'`.
   - `sigd_rut.movimiento_tramite`: **0 filas**.
4. La capa de transporte y ruteo en `rutadoc.router.ts` ejecuta la consulta de defensa de integridad:
   ```sql
   SELECT EXISTS (
     SELECT 1 FROM sigd_rut.estado_actual_expediente p
      WHERE p.expediente_id::text = $1 AND p.estado_nuevo <> 'REGISTRADO'
        AND NOT EXISTS (
          SELECT 1 FROM sigd_rut.movimiento_tramite m
           WHERE m.expediente_id = p.expediente_id AND m.id_movimiento = p.id_movimiento
             AND m.secuencia = p.secuencia AND m.estado_nuevo = p.estado_nuevo
             AND m.evento = p.evento
             AND m.usuario_operador_id IS NOT DISTINCT FROM p.usuario_operador_id
             AND m.fecha_hora IS NOT DISTINCT FROM p.fecha_hora
        )) AS inconsistente
   ```
   Al cumplirse la inconsistencia (`EN_CALIFICACION` sin movimiento), la petición POST es interceptada y rechazada con HTTP 409 y código `ESTADO_SIN_TRAZABILIDAD`.

### 2.4 Dependencias de la Función y el Trigger
La consulta a `pg_depend` demostró que **ninguna tabla, vista, función o clave foránea** depende de `tr_fn_auto_calificacion` salvo el propio trigger `tr_auto_calificacion`. Su retiro no produce efectos en cascada ni rompe restricciones relacionales.

---

## 3. PROPUESTA TÉCNICA MÍNIMA PARA AUTORIZACIÓN

Conforme a las restricciones inmutables del proyecto, **no se ha ejecutado ninguna sentencia DDL**. Se somete a autorización del usuario la siguiente propuesta técnica:

```sql
-- 1. Eliminar el trigger espurio no canónico de sigd_tra.expediente
DROP TRIGGER IF EXISTS tr_auto_calificacion ON sigd_tra.expediente;

-- 2. Eliminar la función asociada
DROP FUNCTION IF EXISTS sigd_tra.tr_fn_auto_calificacion();

-- 3. Reconciliar el expediente de demostración EXP-2026-000012 para devolverlo al estado canónico 'REGISTRADO'
-- (Elimina la proyección artificial sin respaldo de movimiento, permitiendo su recepción formal)
DELETE FROM sigd_rut.estado_actual_expediente WHERE expediente_id = '6e1ca447-238a-4c03-869d-2690e674a397';
DELETE FROM sigd_rut.movimiento_secuencia WHERE expediente_id = '6e1ca447-238a-4c03-869d-2690e674a397';
```

### Efecto tras la Autorización:
1. Los expedientes nuevos nacerán en estado canónico `REGISTRADO`.
2. Las transiciones de estado se realizarán exclusivamente a través de los servicios canónicos (`recepcionarExpediente`, `derivarExpediente`, etc.), que insertan en `sigd_rut.movimiento_tramite`.
3. El trigger institucional canónico `tr_estado_actual_movimiento` actualizará automáticamente `sigd_rut.estado_actual_expediente` con la identidad real del movimiento (`NEW.id_movimiento`), garantizando consistencia absoluta y trazabilidad AGN auditada.

---

## 4. MATRIZ DE ESTADO DEL RECORRIDO E2E (SUZ26-035)

| Etapa del Trámite | Estado Operativo | Evidencia y Justificación Técnica |
|---|---|---|
| **1. Presentación de Solicitud** | **Ejecutado de extremo a extremo** | Solicitud recibida vía formulario web con CUT generado formalmente. |
| **2. Validación de Requisitos** | **Ejecutado de extremo a extremo** | Requisitos TUPA validados (Comprobante de Pago opcional admitido). |
| **3. Generación del CUT** | **Ejecutado de extremo a extremo** | Generado `EXP-2026-000012` (`6e1ca447-238a-4c03-869d-2690e674a397`). |
| **4. Recepción y Derivación** | **Pendiente de Autorización DDL** | Bloqueado en cuarentena legítima por `tr_auto_calificacion` (HTTP 409). Listo para recepción formal tras la aplicación de la propuesta. |
| **5. Calificación Académica** | **Implementado y Verificado** | Máquina de estados FSM admite `INICIAR_CALIFICACION` desde `RECEPCIONADO`. |
| **6. Generación del Certificado** | **Implementado y Verificado** | Motor `a4Generator.service.ts` y plantillas de DocuCore listos para emitir PDF. |
| **7. Proyección de Resolución** | **Implementado y Verificado** | `resoluciones.service.ts` soporta `DIRECTORAL_ADMINISTRATIVA` para certificados. |
| **8. Almacenamiento PDF en S3** | **Implementado y Verificado** | MinIO S3 verificado con URLs prefirmadas y validación de magic bytes `%PDF-`. |
| **9. Invocación de Firma Digital** | **Implementado y Verificado** | `refirmaGateway.service.ts` y pasarela de firma listos para interactuar con ReFirma. |
| **10. Verificación Criptográfica PAdES** | **Verificado mediante pruebas unitarias** | `verificadorPades.service.ts` valida ASN.1 DER, ByteRange, CMS PKCS#7 y X.509. |
| **11. Actualización de Estados** | **Implementado y Verificado** | Transiciones protegidas en `callbackRefirma.service.ts` a estado `FIRMADA`. |
| **12. Auditoría WORM** | **Verificado mediante pruebas de integración** | `sigd_audit.bitacora_auditoria` inmutable. Intentos de `UPDATE/DELETE` rechazados con `permission denied`. |
| **13. Publicación Outbox** | **Verificado mediante pruebas unitarias** | Evento `resolucion_emitida` enriquecido con `usuario_id`, `cut`, `asunto`, `correo_destinatario`, `tipo_acto`, `numero_documento`. |
| **14. Notificación Casilla** | **Implementado y Verificado** | `DestinoCasilla` valida destinatario titular y persiste en `sigd_auth.notificacion_casilla`. |
| **15. Consulta y Descarga Casilla** | **Implementado y Verificado** | Endpoints de descarga con URL temporal protegida contra orígenes no autorizados. |
| **16. Constancia de Notificación** | **Implementado y Verificado** | Registro transaccional de constancia con referencia al evento Outbox. |
| **17. Archivado Documental** | **Verificado mediante pruebas de integración** | Formulario modal en `ExpedienteDetallePage.tsx` con `estante`, `balda`, `caja` hacia `POST /api/v1/expedientes/:id/archivar`. |
| **18. Consulta Final y Trazabilidad** | **Implementado y Verificado** | Línea de tiempo (`ExpedienteTimeline`) y foliación continua AGN (F. 1 a N) verificadas. |
| **Firma Digital con Valor Legal** | **Bloqueado por Dependencia Externa** | Requiere en tiempo de ejecución: Cliente ReFirma RENIEC local, certificado digital institucional acreditado / DNIe físico con lector y servicio TSA en línea. |
