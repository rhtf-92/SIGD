-- =============================================================================
-- 11_asignacion_personal_puesto.sql
-- =============================================================================
-- `sigd_org.asignacion_personal` declaraba `cargo_id` y `area_id` pero NO el
-- puesto laboral, de modo que no existia ninguna forma de saber en que SEDE
-- prestaba el servidor su servicio: el directorio institucional no podia
-- resolver la sede y el organigrama no podia descender hasta ella.
--
-- El modelo correcto es: la asignacion apunta al PUESTO, y el puesto arrastra
-- cargo, sede y area. Se agrega la clave foranea con backfill por coincidencia
-- de (cargo_id, area_id), que es como venia distribuyendose la informacion.
--
-- La columna se deja NULLABLE: una asignacion puede existir sin puesto definido
-- (personal de apoyo sin sede asignada) y eso no debe impedir el alta.
-- =============================================================================

ALTER TABLE sigd_org.asignacion_personal
    ADD COLUMN IF NOT EXISTS puesto_laboral_id UUID NULL
        REFERENCES sigd_org.puesto_laboral (puesto_laboral_id) ON DELETE RESTRICT;

COMMENT ON COLUMN sigd_org.asignacion_personal.puesto_laboral_id IS
    'Puesto laboral que ocupa el servidor. Arrastra cargo, sede y area.';

CREATE INDEX IF NOT EXISTS idx_asignacion_personal_puesto
    ON sigd_org.asignacion_personal (puesto_laboral_id);

-- Backfill: se enlaza cada asignacion existente con el puesto que reune el mismo
-- cargo y la misma area. Si hubiera mas de uno, gana el de codigo mas bajo para
-- que el resultado sea determinista.
UPDATE sigd_org.asignacion_personal ap
   SET puesto_laboral_id = (
       SELECT pl.puesto_laboral_id
         FROM sigd_org.puesto_laboral pl
        WHERE pl.cargo_id = ap.cargo_id
          AND pl.area_id IS NOT DISTINCT FROM ap.area_id
          AND pl.activo
        ORDER BY pl.codigo
        LIMIT 1)
 WHERE ap.puesto_laboral_id IS NULL
   AND EXISTS (
       SELECT 1
         FROM sigd_org.puesto_laboral pl
        WHERE pl.cargo_id = ap.cargo_id
          AND pl.area_id IS NOT DISTINCT FROM ap.area_id
          AND pl.activo);


-- -----------------------------------------------------------------------------
-- 11.1 Asignaciones de las cuentas de evaluacion
--      Cada cuenta queda vinculada a su puesto, lo que hace resolubles la sede y
--      el area en el directorio de usuarios.
-- -----------------------------------------------------------------------------
INSERT INTO sigd_org.asignacion_personal
    (id_asignacion, id_usuario, puesto_laboral_id, cargo_id, area_id, vigente_desde)
SELECT
    gen_random_uuid(),
    u.id_usuario,
    pl.puesto_laboral_id,
    pl.cargo_id,
    pl.area_id,
    DATE '2026-01-01'
  FROM sigd_auth.cuenta_usuario u
  JOIN sigd_org.puesto_laboral pl
    ON pl.codigo = CASE u.usuario
        WHEN 'admin'        THEN 'PL-ADMIN'
        WHEN 'director'     THEN 'PL-DIRECTOR'
        WHEN 'secretario'   THEN 'PL-SECRETARIO'
        WHEN 'especialista' THEN 'PL-ESPECIALISTA'
        WHEN 'mesaparte'    THEN 'PL-MESA-PARTES'
        ELSE NULL
    END
 WHERE u.usuario IN ('admin', 'director', 'secretario', 'especialista', 'mesaparte')
   AND NOT EXISTS (
    SELECT 1 FROM sigd_org.asignacion_personal ap
     WHERE ap.id_usuario = u.id_usuario
       AND ap.puesto_laboral_id = pl.puesto_laboral_id);