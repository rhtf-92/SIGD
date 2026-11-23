# SIGD SUIZA — TSK-1.2 FASE A0
# PLAN DE ROLLBACK Y REVERSIÓN CONTROLADA

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Rama Git exclusiva:** `B_JACOBO` | **Base oficial:** `sigd_jacobo_demo` (PostgreSQL 18.6)  
**Estado:** Plan Técnico Preparado — **Cero mutaciones ejecutadas**

---

## 1. ESTRATEGIA DE REVERSIÓN EN TRES NIVELES

Para proteger `sigd_jacobo_demo` sin destrucción de auditoría ni pérdida referencial:

### Nivel 1 — Reversión Atómica Intra-Migración (Error en Fase A)
- La migración `22_sigd_org_catalogo_rbac_institucional.sql` corre dentro de `BEGIN ... COMMIT` administrado por [`migrate.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/db/migrate.ts#L240-L258).
- Cualquier falla en sintaxis, constraint o assertion final ejecuta `ROLLBACK;` automático dejando `sigd_jacobo_demo` y `public.sigd_migraciones` intactos al estado previo.

### Nivel 2 — Script Compilado de Rollback Lógico No Destructivo (Post-Commit) y Orden `23_ -> 22_`
En Fase A se ubicará en `backend/migraciones/pendientes/22_sigd_org_catalogo_rbac_institucional_rollback.sql` (y en `pendientes/23_sigd_doc_auditoria_acceso_y_descarga_excepcional_rollback.sql` si se autoriza y ejecuta la migración `23_` para bitácora documental y autorización extraordinaria), fuera de la raíz para que `migrate.ts` no lo aplique automáticamente.

**Regla fundamental de distinción operativa (`0 filas` vs. `> 0 filas`):**
- **Reversión técnica previa a operación (`0 filas` nuevas registradas):** Si tras `Fase A` (dentro de ventana sin tráfico operativo) ocurre un hallazgo bloqueante antes de producir movimientos nuevos, el script retira triggers, índices y tablas nuevas vacías (`IF NOT EXISTS (SELECT 1 FROM ...)`), dejando la estructura limpia al nivel `21_`.
- **Migración compensatoria posterior a operación (`> 0 filas` o bitácoras WORM):** Una vez que el sistema operó y registró eventos en tablas append-only (`sigd_audit.bitacora_acceso_documental`, `sigd_rut.expediente_cierre_historial`) o filas operativas (`encargatura_permiso`, `usuario_capacidad`, `expediente_evaluador`, `autorizacion_descarga_excepcional`), **JAMÁS se ejecuta `DROP TABLE`, `TRUNCATE` ni `DELETE` masivo**: se aplican cierres lógicos (`activo = FALSE`, `vigente = FALSE`, `revocado_en = now()`) o una migración compensatoria hacia adelante (`24_+`) que preserve el 100 % de la evidencia forense y el historial institucional.

**Regla de precedencia (`23_ -> 22_`):** Si existiera migración `23_` aplicada, su reversión lógica debe ejecutarse **siempre antes** que la de `22_`, respetando las siguientes reglas:
1. **Protección de datos operativos y auditoría WORM generados tras Fase A:**
   - Si `sigd_audit.bitacora_acceso_documental` (`23_`) o `sigd_audit.bitacora_superadmin_saas` (`23_` Anexo A.3) ya registraron eventos, **JAMÁS se ejecuta `DROP TABLE` ni `DELETE`**: se revocan privilegios de escritura ordinarios y se conservan íntegras como evidencia forense. Solo con `0 filas` procede `DROP TABLE`.
   - Si `sigd_org.autorizacion_descarga_excepcional` o `sigd_org.autorizacion_rol_permiso_institucional` (`23_`) contienen registros, se marcan como revocados (`activo = FALSE`, `revocado_en = now()`, `motivo_revocacion = 'ROLLBACK_TSK_1_2'`) **sin borrar historial**; solo con `0 filas` procede `DROP TABLE`.
   - Si `sigd_org.encargatura_permiso` (`22_` Bloque 7B) contiene registros, no se destruye el historial de delegaciones ni las filas preexistentes de `sigd_org.encargatura_despacho`; solo con `0 filas` en `encargatura_permiso` procede retirar la tabla auxiliar y sus triggers, manteniendo compatibilidad hacia atrás con las columnas aditivas de `encargatura_despacho`.
   - Si `sigd_rut.expediente_cierre_historial`, `sigd_rut.expediente_evaluador`, `sigd_rut.expediente_responsable`, `sigd_rut.expediente_custodia` o `sigd_org.usuario_capacidad` contienen filas nuevas con historial operativo: **NO se ejecuta `DROP TABLE` ni `DELETE`**; se marca `activo = FALSE` / `vigente = FALSE` (salvo historial WORM de cierre, que se conserva intacto en tabla de solo lectura). Solo si una tabla nueva tiene **`0 filas`**, puede ejecutarse `DROP TABLE IF EXISTS ...`.
2. **Desactivación o retiro seguro de roles, `#32 EXPEDIENTE_DESCARGAR` y regla innegociable sobre `ADMINISTRADOR`:**
   - Las 6 asignaciones históricas de `ESPECIALISTA` (`4` cuentas) permanecen intactas y nunca se eliminan en el rollback.
   - Si ninguno de los 4 roles nuevos (`JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `DOCENTE`, `ESTUDIANTE`) tiene asignaciones en `sigd_org.usuario_rol`, se revocan sus `rol_permiso` y se eliminan las 4 filas nuevas; si existen asignaciones, se pasan a `vigente = FALSE` sin romper FK.
   - Para los 16 permisos atómicos incorporados en `22_` (incluyendo **`EXPEDIENTE_DESCARGAR` #32**, UUID `5b010000-0000-4000-8000-000000000016`): dado que `EXPEDIENTE_DESCARGAR` nace con `0` asignaciones automáticas en `rol_permiso`, si no fue referenciado en `rol_permiso` ni en bitácora/historial puede eliminarse o marcarse **`vigente = FALSE`** (nunca romper integridad referencial de auditoría). Las columnas aditivas `descripcion` y `vigente` en `sigd_org.permiso_sistema` son backward-compatible y no rompen código previo; pueden conservarse o retirarse solo en reversión previa a operación sin dependencias.
   - **Advertencia crítica sobre privilegios retirados de `ADMINISTRADOR` (`FIRMA_FIRMAR` y `EXPEDIENTE_RESOLVER`) y transición de `EXPEDIENTE_RESOLVER`:** Por política de seguridad institucional confirmada en [TSK_1_2_A0_REVISION_TECNICA_FINAL.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_REVISION_TECNICA_FINAL.md), el rollback lógico de Nivel 2 **NO reasigna automáticamente** `FIRMA_FIRMAR` ni `EXPEDIENTE_RESOLVER` a `ADMINISTRADOR` (conservando además su UUID histórico `797a084e-6c20-491d-83bf-e5c9fddaa6ab` intacto en `permiso_sistema` dentro de su estrategia de descontinuación progresiva en 4 etapas) **y conserva intacta la lectura institucional de `ADMINISTRADOR` (`EXPEDIENTE_LEER` `GLOBAL` acotada a su propia institución y `ADMIN_USUARIOS`, sin acceso cruzado a otras instituciones)**. Tampoco toca ni mezcla identidades de `SUPER_ADMIN_PLATAFORMA`. Si Dirección ordenase excepcionalmente volver íntegramente al snapshot binario anterior (Nivel 3) tras revertir también Fase B, dicha restauración quedaría cubierta por Nivel 3 o por acto administrativo separado auditado en WORM (`actualizarPermisosRol`).
   - Se remueven los triggers `tr_bloquear_nueva_asignacion_rol_historico` y `tr_bloquear_nueva_asignacion_permiso_legado` (y se revierte `ESPECIALISTA.vigente = TRUE` únicamente si se ejecuta reversión técnica previa a operación con `0` filas nuevas para volver exactamente a la línea base `21_`).
   - Se elimina la fila de `22_sigd_org_catalogo_rbac_institucional.sql` (y de `23_...` si aplicó) en `public.sigd_migraciones` únicamente cuando la reversión sea completa y verificada (o, en migración compensatoria posterior a operación, **no** se borran filas históricas de `sigd_migraciones` sino que se registra `24_compensacion_...`).

### Nivel 3 — Política Confirmada de Restauración Controlada del Respaldo (`CONFIRMADO`)
**Toda restauración de PostgreSQL requiere autorización expresa previa.** Queda terminantemente **PROHIBIDO**:
- Ejecutar `pg_restore` de forma automática ante cualquier fallo de script o despliegue.
- Restaurar sin evaluar previamente el impacto sobre datos operativos posteriores al respaldo.
- Sobrescribir datos institucionales activos sin autorización expresa de Dirección y responsable técnico.
- Eliminar bitácoras históricas (`bitacora_auditoria`, `bitacora_acceso_documental`, `bitacora_superadmin_saas`) o destruir evidencias WORM (`expediente_cierre_historial`).
- Crear otra base de datos paralela para efectuar una restauración (todo trabajo permanece exclusivamente en `sigd_jacobo_demo` dentro de `B_JACOBO`).

**Procedimiento obligatorio de 7 pasos ANTES de autorizar o ejecutar cualquier restauración:**
1. **Identificar la base afectada:** Confirmar `sigd_jacobo_demo` en entorno exclusivo `B_JACOBO` (prohibida base paralela).
2. **Verificar el respaldo:** Validar existencia física y catálogo (`pg_restore --list`, 673 entradas) de [`sigd_jacobo_demo_pre_tsk12_2026-11-12T17-29-27.dump`](file:///C:/Users/Liz/Backups/SIGD/pre_tsk12/sigd_jacobo_demo_pre_tsk12_2026-11-12T17-29-27.dump) (`662,972 bytes`) o respaldo fresco verificado previo al corte.
3. **Verificar SHA-256:** Confirmar integridad criptográfica exacta (`1A8B845A53E7C2EA609EC989B8508D300392992E2C07B221429A1C98C9ED2BCC` para el respaldo base verificado).
4. **Explicar el impacto sobre datos posteriores:** Cuantificar por escrito qué trámites, resoluciones, firmas, pagos o bitácoras generados después del corte se perderían si se restaurara el snapshot completo.
5. **Obtener autorización expresa:** Acta o aprobación formal explícita antes de detener workers o ejecutar `pg_restore`.
6. **Documentar la ventana de mantenimiento:** Detener backend/outbox workers, cerrar conexiones activas y documentar inicio/fin de ventana.
7. **Registrar la operación:** Dejar evidencia de auditoría y archivo SHA-256 pre/post restauración en el expediente de mantenimiento.

**Regla de prioridad operativa (`CONFIRMADO`):** Una vez iniciada la operación institucional (`> 0` eventos documentales posteriores al corte), **se priorizan migraciones compensatorias hacia adelante (`24_+`)** en lugar de restaurar respaldos, preservando íntegras todas las evidencias WORM y actuaciones institucionales.

---

## 2. SCRIPT SQL DE ROLLBACK PROPUESTO (NO EJECUTADO)

```sql
-- ============================================================================
-- SIGD IESTP PÚBLICO «SUIZA» — ROLLBACK NO DESTRUCTIVO TSK-1.2 (22_)
-- ESTADO: DISEÑO DOCUMENTAL — NO EJECUTADO
-- ============================================================================

BEGIN;

-- 1. Desactivar capacidades operativas o remover si están vacías
DO $$
BEGIN
  IF to_regclass('sigd_org.usuario_capacidad') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM sigd_org.usuario_capacidad) THEN
      UPDATE sigd_org.usuario_capacidad
         SET activo = FALSE,
             desactivado_en = COALESCE(desactivado_en, now()),
             motivo_desactivacion = COALESCE(motivo_desactivacion, 'ROLLBACK_TSK_1_2')
       WHERE activo = TRUE;
    ELSE
      DROP TRIGGER IF EXISTS tr_proteger_capacidad_permiso ON sigd_org.capacidad_permiso;
      DROP FUNCTION IF EXISTS sigd_org.fn_proteger_capacidad_permiso();
      DROP TABLE IF EXISTS sigd_org.usuario_capacidad;
      DROP TABLE IF EXISTS sigd_org.capacidad_permiso;
      DROP TABLE IF EXISTS sigd_org.capacidad_sistema;
    END IF;
  END IF;
END $$;

-- 2. Desactivar asignaciones de evaluadores/responsables/custodios si hay datos; DROP solo si vacías
DO $$
BEGIN
  IF to_regclass('sigd_rut.expediente_evaluador') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM sigd_rut.expediente_evaluador) THEN
      UPDATE sigd_rut.expediente_evaluador
         SET activo = FALSE, desactivado_en = COALESCE(desactivado_en, now()),
             motivo_desasignacion = COALESCE(motivo_desasignacion, 'ROLLBACK_TSK_1_2')
       WHERE activo = TRUE;
    ELSE
      DROP TRIGGER IF EXISTS tr_expediente_evaluador_integridad ON sigd_rut.expediente_evaluador;
      DROP FUNCTION IF EXISTS sigd_rut.fn_validar_expediente_evaluador();
      DROP TABLE IF EXISTS sigd_rut.expediente_evaluador;
    END IF;
  END IF;

  IF to_regclass('sigd_rut.expediente_responsable') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM sigd_rut.expediente_responsable) THEN
      UPDATE sigd_rut.expediente_responsable
         SET activo = FALSE, desactivado_en = COALESCE(desactivado_en, now()),
             motivo_desactivacion = COALESCE(motivo_desactivacion, 'ROLLBACK_TSK_1_2')
       WHERE activo = TRUE;
    ELSE
      DROP TABLE IF EXISTS sigd_rut.expediente_responsable;
    END IF;
  END IF;

  IF to_regclass('sigd_rut.expediente_custodia') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM sigd_rut.expediente_custodia) THEN
      UPDATE sigd_rut.expediente_custodia SET activo = FALSE, hasta = COALESCE(hasta, now()) WHERE activo = TRUE;
    ELSE
      DROP TABLE IF EXISTS sigd_rut.expediente_custodia;
    END IF;
  END IF;

  IF to_regclass('sigd_doc.procedimiento_cierre_regla') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM sigd_doc.procedimiento_cierre_regla) THEN
      UPDATE sigd_doc.procedimiento_cierre_regla SET vigente = FALSE WHERE vigente = TRUE;
    ELSE
      DROP TABLE IF EXISTS sigd_doc.procedimiento_cierre_regla;
    END IF;
  END IF;
END $$;

-- 3. Remover triggers de bloqueo histórico / permiso legado (solo en reversión previa a operación pre-22)
DROP TRIGGER IF EXISTS tr_bloquear_nueva_asignacion_rol_historico ON sigd_org.usuario_rol;
DROP FUNCTION IF EXISTS sigd_org.fn_bloquear_nueva_asignacion_rol_historico();
DROP TRIGGER IF EXISTS tr_bloquear_nueva_asignacion_permiso_legado ON sigd_org.rol_permiso;
DROP FUNCTION IF EXISTS sigd_org.fn_bloquear_nueva_asignacion_permiso_legado();
-- Si se revierte completamente a línea base 21_ en ventana previa a operación (0 filas nuevas):
UPDATE sigd_org.rol_sistema SET vigente = TRUE WHERE codigo = 'ESPECIALISTA' AND vigente = FALSE;

-- 4. Roles nuevos y permiso #32 (EXPEDIENTE_DESCARGAR): borrar solo si no tienen asignaciones/referencias históricas; caso contrario vigente = FALSE
DELETE FROM sigd_org.rol_permiso
 WHERE rol_id IN (
   SELECT rol_id FROM sigd_org.rol_sistema
    WHERE codigo IN ('JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA', 'DOCENTE', 'ESTUDIANTE')
 )
    OR permiso_id IN (
   SELECT permiso_id FROM sigd_org.permiso_sistema
    WHERE codigo = 'EXPEDIENTE_DESCARGAR'
 );

DO $$
DECLARE
  v_asig INT;
  v_desc_ref INT := 0;
BEGIN
  SELECT count(*) INTO v_asig
    FROM sigd_org.usuario_rol ur
    JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
   WHERE r.codigo IN ('JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA', 'DOCENTE', 'ESTUDIANTE');

  IF v_asig > 0 THEN
    UPDATE sigd_org.rol_sistema SET vigente = FALSE
     WHERE codigo IN ('JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA', 'DOCENTE', 'ESTUDIANTE');
  ELSE
    DELETE FROM sigd_org.rol_sistema
     WHERE codigo IN ('JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA', 'DOCENTE', 'ESTUDIANTE');

    ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;
    ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK (
      codigo::text = ANY (ARRAY[
        'ADMINISTRADOR'::text, 'DIRECTOR'::text, 'SECRETARIO'::text, 'ESPECIALISTA'::text,
        'MESA_PARTES'::text, 'CIUDADANO'::text, 'CAJERO'::text, 'TESORERO'::text,
        'SUPERVISOR_TESORERIA'::text, 'APROBADOR_DEVOLUCIONES'::text
      ])
    );
  END IF;

  -- Permiso #32 EXPEDIENTE_DESCARGAR: desactivar o eliminar si no tiene referencias históricas
  IF to_regclass('sigd_org.rol_permiso') IS NOT NULL THEN
    SELECT count(*) INTO v_desc_ref
      FROM sigd_org.rol_permiso rp
      JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
     WHERE p.codigo = 'EXPEDIENTE_DESCARGAR';
  END IF;
  IF v_desc_ref > 0 THEN
    UPDATE sigd_org.permiso_sistema SET vigente = FALSE WHERE codigo = 'EXPEDIENTE_DESCARGAR';
  ELSE
    DELETE FROM sigd_org.permiso_sistema WHERE codigo = 'EXPEDIENTE_DESCARGAR';
  END IF;
END $$;

-- 4A. Bloque 7B (Control 2 — encargatura_permiso y extensiones de encargatura_despacho)
-- IMPORTANTE: Jamás borrar ni alterar filas históricas/activas de sigd_org.encargatura_despacho.
DO $$
BEGIN
  IF to_regclass('sigd_org.encargatura_permiso') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM sigd_org.encargatura_permiso) THEN
      DROP TRIGGER IF EXISTS tr_proteger_encargatura_permiso ON sigd_org.encargatura_permiso;
      DROP FUNCTION IF EXISTS sigd_org.fn_proteger_encargatura_permiso();
      DROP TABLE IF EXISTS sigd_org.encargatura_permiso;
    END IF; -- Con > 0 filas, se preserva intacta como evidencia/delegación histórica.
  END IF;
  -- Las columnas aditivas de sigd_org.encargatura_despacho (institucion_id, area_despacho_id,
  -- autoridad_designante_id, documento_sustento_*, tipos_documento_permitidos, revocado_*)
  -- son backward-compatible y NO se dropean si ya hubo registros en operación.
END $$;

-- 4B. Reversión ordenada previa para objetos candidatos de 23_ (si fueron aprobados y aplicados)
-- IMPORTANTE: Ejecutar SIEMPRE antes del rollback de 22_ (orden inverso 23_ -> 22_).
DO $$
BEGIN
  IF to_regclass('sigd_org.autorizacion_descarga_excepcional') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM sigd_org.autorizacion_descarga_excepcional) THEN
      UPDATE sigd_org.autorizacion_descarga_excepcional
         SET activo = FALSE,
             revocado_en = COALESCE(revocado_en, now()),
             motivo_revocacion = COALESCE(motivo_revocacion, 'ROLLBACK_23_ANTES_DE_22')
       WHERE activo = TRUE;
    ELSE
      DROP TABLE IF EXISTS sigd_org.autorizacion_descarga_excepcional;
    END IF;
  END IF;

  IF to_regclass('sigd_org.autorizacion_rol_permiso_institucional') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM sigd_org.autorizacion_rol_permiso_institucional) THEN
      UPDATE sigd_org.autorizacion_rol_permiso_institucional
         SET activo = FALSE,
             revocado_en = COALESCE(revocado_en, now()),
             motivo_revocacion = COALESCE(motivo_revocacion, 'ROLLBACK_23_ANTES_DE_22')
       WHERE activo = TRUE;
    ELSE
      DROP TRIGGER IF EXISTS tr_validar_autorizacion_rol_permiso_inst ON sigd_org.autorizacion_rol_permiso_institucional;
      DROP FUNCTION IF EXISTS sigd_org.fn_validar_autorizacion_rol_permiso_institucional();
      DROP TABLE IF EXISTS sigd_org.autorizacion_rol_permiso_institucional;
    END IF;
  END IF;

  IF to_regclass('sigd_audit.bitacora_acceso_documental') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM sigd_audit.bitacora_acceso_documental) THEN
      DROP TRIGGER IF EXISTS tr_bitacora_acceso_inmutable ON sigd_audit.bitacora_acceso_documental;
      DROP FUNCTION IF EXISTS sigd_audit.fn_bitacora_acceso_inmutable();
      DROP TABLE IF EXISTS sigd_audit.bitacora_acceso_documental;
    END IF; -- Con > 0 filas (operación iniciada), JAMÁS se elimina ni se trunca (WORM).
  END IF;

  IF to_regclass('sigd_audit.bitacora_superadmin_saas') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM sigd_audit.bitacora_superadmin_saas) THEN
      DROP TRIGGER IF EXISTS tr_bitacora_saas_inmutable ON sigd_audit.bitacora_superadmin_saas;
      DROP FUNCTION IF EXISTS sigd_audit.fn_bitacora_saas_inmutable();
      DROP TABLE IF EXISTS sigd_audit.bitacora_superadmin_saas;
    END IF; -- Con > 0 filas, JAMÁS se elimina ni se trunca (WORM SaaS).
  END IF;

  IF to_regclass('sigd_rut.expediente_cierre_historial') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM sigd_rut.expediente_cierre_historial) THEN
      DROP TRIGGER IF EXISTS tr_cierre_historial_inmutable ON sigd_rut.expediente_cierre_historial;
      DROP FUNCTION IF EXISTS sigd_rut.fn_cierre_historial_inmutable();
      DROP TABLE IF EXISTS sigd_rut.expediente_cierre_historial;
    END IF; -- Con > 0 filas, JAMÁS se elimina ni se trunca (WORM).
  END IF;
END $$;

-- 5. Nota de seguridad: NO restaurar en ADMINISTRADOR los permisos retirados
--    FIRMA_FIRMAR ni EXPEDIENTE_RESOLVER mediante este script lógico;
--    cualquier retorno íntegro al estado pre-TSK-1.2 requiere Nivel 3 autorizado o
--    reasignación explícita autorizada y auditada en WORM.

-- 6. Retirar registro del runner SOLO en reversión técnica previa a operación (0 eventos WORM).
--    Si ya existen eventos WORM (> 0 filas), NO borrar sigd_migraciones: emitir migración compensatoria 24_.
DELETE FROM public.sigd_migraciones
 WHERE nombre_script IN (
   '23_sigd_doc_auditoria_acceso_y_descarga_excepcional.sql',
   '22_sigd_org_catalogo_rbac_institucional.sql'
 )
   AND (
     to_regclass('sigd_audit.bitacora_acceso_documental') IS NULL
     OR NOT EXISTS (SELECT 1 FROM sigd_audit.bitacora_acceso_documental)
   )
   AND (
     to_regclass('sigd_audit.bitacora_superadmin_saas') IS NULL
     OR NOT EXISTS (SELECT 1 FROM sigd_audit.bitacora_superadmin_saas)
   )
   AND (
     to_regclass('sigd_rut.expediente_cierre_historial') IS NULL
     OR NOT EXISTS (SELECT 1 FROM sigd_rut.expediente_cierre_historial)
   );

COMMIT;
```
