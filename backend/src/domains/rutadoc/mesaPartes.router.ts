import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';

export function crearRouterMesaPartes(pool: Pool, proveedorActor?: ActorProviderRutaDoc): Router {
  const router = Router();

  async function resolverActor(req: Request) {
    if (proveedorActor) {
      const actor = await proveedorActor.obtenerActor(req);
      if (actor) return actor;
    }
    const u = (req as any).user;
    if (u && u.id) return u;
    return null;
  }

  // Middleware de autorización para Mesa de Partes
  router.use(async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const actor = await resolverActor(req);
      if (!actor) throw new UnauthorizedError();
      const roles = Array.isArray(actor.roles) ? actor.roles : [actor.rol];
      const permitido = roles.some((r: string) =>
        ['MESA_PARTES', 'SECRETARIO', 'JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA', 'DIRECTOR', 'ADMINISTRADOR'].includes(r)
      );
      if (!permitido) {
        throw new ForbiddenError({ detail: 'No cuenta con facultades operativas de Mesa de Partes.' });
      }
      next();
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/mesa-partes/contadores - 12 Bandejas especializadas
  router.get('/contadores', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const sql = `
        SELECT
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'REGISTRADO')::int AS pendientes_recepcion,
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'RECEPCIONADO')::int AS recepcionados,
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) IN ('RECEPCIONADO', 'EN_CALIFICACION'))::int AS pendientes_calificacion,
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'OBSERVADO')::int AS observados,
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'OBSERVADO')::int AS pendientes_subsanacion,
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'SUBSANADO')::int AS subsanados,
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'EN_CALIFICACION')::int AS conformes,
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'CERRADO' OR doc.estado = 'ANULADO')::int AS rechazados,
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) IN ('RECEPCIONADO', 'EN_CALIFICACION', 'SUBSANADO'))::int AS pendientes_derivacion,
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'DERIVADO')::int AS derivados,
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'DERIVADO')::int AS pendientes_recepcion_destino,
          COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) IN ('ATENDIDO', 'RESUELTO', 'ARCHIVADO'))::int AS atendidos
        FROM sigd_tra.expediente e
        LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
        LEFT JOIN sigd_doc.expediente doc ON doc.expediente_id = e.expediente_id
      `;
      const { rows } = await pool.query(sql);
      res.json({
        ok: true,
        fechaHora: new Date().toISOString(),
        contadores: rows[0],
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/mesa-partes/expedientes?bandeja=...
  router.get('/expedientes', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bandeja = String(req.query.bandeja || 'pendientes_recepcion').toLowerCase();
      const limite = Math.min(Number(req.query.limite || 50), 100);
      const pagina = Math.max(Number(req.query.pagina || 1), 1);
      const offset = (pagina - 1) * limite;
      const busqueda = req.query.busqueda ? `%${String(req.query.busqueda).trim()}%` : null;

      let filtroBandejaSql = "COALESCE(ultimo.estado_nuevo, e.estado) = 'REGISTRADO'";
      switch (bandeja) {
        case 'recepcionados':
          filtroBandejaSql = "COALESCE(ultimo.estado_nuevo, e.estado) = 'RECEPCIONADO'";
          break;
        case 'pendientes_calificacion':
          filtroBandejaSql = "COALESCE(ultimo.estado_nuevo, e.estado) IN ('RECEPCIONADO', 'EN_CALIFICACION')";
          break;
        case 'observados':
        case 'pendientes_subsanacion':
          filtroBandejaSql = "COALESCE(ultimo.estado_nuevo, e.estado) = 'OBSERVADO'";
          break;
        case 'subsanados':
          filtroBandejaSql = "COALESCE(ultimo.estado_nuevo, e.estado) = 'SUBSANADO'";
          break;
        case 'conformes':
          filtroBandejaSql = "COALESCE(ultimo.estado_nuevo, e.estado) = 'EN_CALIFICACION'";
          break;
        case 'rechazados':
          filtroBandejaSql = "(COALESCE(ultimo.estado_nuevo, e.estado) = 'CERRADO' OR doc.estado = 'ANULADO')";
          break;
        case 'pendientes_derivacion':
          filtroBandejaSql = "COALESCE(ultimo.estado_nuevo, e.estado) IN ('RECEPCIONADO', 'EN_CALIFICACION', 'SUBSANADO')";
          break;
        case 'derivados':
        case 'pendientes_recepcion_destino':
          filtroBandejaSql = "COALESCE(ultimo.estado_nuevo, e.estado) = 'DERIVADO'";
          break;
        case 'atendidos':
          filtroBandejaSql = "COALESCE(ultimo.estado_nuevo, e.estado) IN ('ATENDIDO', 'RESUELTO', 'ARCHIVADO')";
          break;
        default:
          filtroBandejaSql = "COALESCE(ultimo.estado_nuevo, e.estado) = 'REGISTRADO'";
      }

      const params: any[] = [limite, offset];
      let filtroBusquedaSql = '';
      if (busqueda) {
        params.push(busqueda);
        filtroBusquedaSql = `AND (e.codigo_expediente ILIKE $3 OR COALESCE(doc.asunto, ar.asunto) ILIKE $3 OR pn.nombre_completo ILIKE $3 OR e.dni_solicitante ILIKE $3)`;
      }

      const querySql = `
        SELECT
          e.expediente_id AS "idExpediente",
          e.codigo_expediente AS cut,
          COALESCE(doc.asunto, ar.asunto, 'Trámite Institucional') AS asunto,
          COALESCE(ultimo.estado_nuevo, e.estado) AS "estadoActual",
          e.fecha_radicacion AS "fechaRadicacion",
          COALESCE(ar.canal_ingreso, 'MESA_VIRTUAL') AS "canalIngreso",
          COALESCE(tt.denominacion, 'Trámite TUPA') AS "procedimientoTupa",
          tt.codigo AS "codigoTupa",
          a.nombre AS "areaDestino",
          COALESCE(pn.nombre_completo, CONCAT(pn.nombres, ' ', pn.apellidos), 'Ciudadano') AS "solicitanteNombre",
          COALESCE(e.dni_solicitante, '—') AS "solicitanteDni",
          m.datos->'cargo' AS cargo
        FROM sigd_tra.expediente e
        LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
        LEFT JOIN sigd_rut.movimiento_tramite m ON m.id_movimiento = ultimo.id_movimiento
        LEFT JOIN sigd_doc.expediente doc ON doc.expediente_id = e.expediente_id
        LEFT JOIN (
          SELECT DISTINCT ON (expediente_id) expediente_id, canal_ingreso, asunto
          FROM sigd_tra.asiento_registro
          WHERE anulado = FALSE
          ORDER BY expediente_id, numero_registro ASC
        ) ar ON ar.expediente_id = e.expediente_id
        LEFT JOIN sigd_doc.tipo_tramite_tupa tt ON tt.tipo_tramite_id = doc.tipo_tramite_id
        LEFT JOIN sigd_org.area a ON a.area_id = e.area_destino_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
        WHERE ${filtroBandejaSql}
          ${filtroBusquedaSql}
        ORDER BY e.fecha_radicacion DESC
        LIMIT $1 OFFSET $2
      `;

      const { rows } = await pool.query(querySql, params);

      const countSql = `
        SELECT COUNT(*)::int AS total
        FROM sigd_tra.expediente e
        LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
        LEFT JOIN sigd_doc.expediente doc ON doc.expediente_id = e.expediente_id
        LEFT JOIN (
          SELECT DISTINCT ON (expediente_id) expediente_id, canal_ingreso, asunto
          FROM sigd_tra.asiento_registro
          WHERE anulado = FALSE
          ORDER BY expediente_id, numero_registro ASC
        ) ar ON ar.expediente_id = e.expediente_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
        WHERE ${filtroBandejaSql}
          ${filtroBusquedaSql}
      `;
      const countRes = await pool.query(countSql, busqueda ? [busqueda] : []);
      const total = countRes.rows[0]?.total || 0;

      res.json({
        ok: true,
        bandeja,
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
        items: rows,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/mesa-partes/expedientes/:id/cargo
  router.get('/expedientes/:id/cargo', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const query = `
        SELECT
          e.codigo_expediente AS cut,
          e.asunto,
          e.fecha_radicacion,
          TRIM(CONCAT(p.nombres, ' ', p.apellido_paterno, ' ', COALESCE(p.apellido_materno, ''))) AS solicitante,
          p.numero_documento AS dni,
          m.fecha_hora AS "fechaRecepcion",
          m.datos->'cargo' AS cargo,
          m.datos->>'observaciones' AS observaciones
        FROM sigd_tra.expediente e
        JOIN sigd_rut.movimiento_tramite m ON m.expediente_id = e.expediente_id AND m.evento = 'RECEPCION'
        LEFT JOIN sigd_auth.persona p ON p.id_persona = e.solicitante_id
        WHERE e.expediente_id = $1::uuid
        ORDER BY m.secuencia DESC
        LIMIT 1
      `;
      const { rows } = await pool.query(query, [id]);
      if (rows.length === 0) {
        throw new NotFoundError({ detail: 'No se encontró cargo de recepción oficial para este expediente.' });
      }
      res.json({ ok: true, cargoData: rows[0] });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
