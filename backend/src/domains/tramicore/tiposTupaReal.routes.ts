import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Pool } from 'pg';

/**
 * GET /api/v1/tramites/tipos
 * Catalogo del wizard: tramites reales del TUPA vigente (sigd_tupa).
 * Conserva los nombres de campo del catalogo anterior.
 */
export function crearRouterTiposTupaReal(pool: Pool): Router {
  const router = Router();

  router.get('/tramites/tipos', async (_req: Request, res: Response) => {
    const resultado = await pool.query(
      `SELECT tv.tramite_version_id AS id,
              tv.tramite_version_id AS id_tipo_tramite,
              tv.codigo,
              tv.denominacion,
              tv.descripcion,
              tv.unidad_recibe AS unidad_organica,
              tv.plazo_dias_habiles AS plazo_dias,
              tv.plazo_dias_habiles,
              tv.silencio_administrativo,
              tv.calificacion,
              tv.base_legal,
              TRUE AS vigente
         FROM sigd_tupa.tramite_version tv
         JOIN sigd_tupa.version v ON v.version_id = tv.version_id
        WHERE v.estado = 'VIGENTE'
        ORDER BY tv.codigo ASC`,
    );
    res.status(200).json(resultado.rows);
  });

  return router;
}