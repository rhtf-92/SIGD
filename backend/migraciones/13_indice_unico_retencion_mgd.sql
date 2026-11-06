-- =============================================================================
-- 13_indice_unico_retencion_mgd.sql
-- =============================================================================
-- `07_sigd_reportes.sql` creo el indice unico de
-- `sigd_tra.mv_tiempos_retencion_area` sobre una EXPRESION:
--   (COALESCE(area_id, '000...000'), estado)
--
-- `REFRESH MATERIALIZED VIEW CONCURRENTLY` exige un indice unico construido
-- solo con nombres de columna y sin WHERE. Con el indice expresional el refresco
-- fallaba con:
--   ERROR: no se puede refrescar la vista materializada concurrentemente
--   HINT: Cree un indice unico sin clausula WHERE en una o mas columnas...
--
-- La vista agrupa por `COALESCE(area_id, area_destino_id)` y `estado`, de modo
-- que existe como maximo una fila con `area_id IS NULL` por estado. Un indice
-- unico sobre (area_id, estado) sigue siendo unico para todas las filas reales
-- y si es admitido por el refresco concurrente.
-- =============================================================================

DROP INDEX IF EXISTS sigd_tra.ux_mv_tiempos_retencion_area_clave;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_tiempos_retencion_area_clave
    ON sigd_tra.mv_tiempos_retencion_area (area_id, estado);
