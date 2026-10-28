import type { Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';
import { ValidationError } from '../../shared/domain/errors/validation-error.js';
import { z } from 'zod';
import { filtrosSchema, idSchema } from './rutadoc.schemas.js';
import { reversionSchema } from './rutadoc.reversion.schemas.js';
import type { ServicioReversionRutaDoc } from './rutadoc.reversion.service.js';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type { ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import type { ServicioRutaDoc } from './rutadoc.service.js';
import type { ServicioSlaRutaDoc } from './sla.service.js';

/** El proveedor debe derivar el actor de una sesión/token verificado, nunca de headers libres. */
export type ObtenerActorRutaDoc = (req: Request) => ActorRutaDoc | null | Promise<ActorRutaDoc | null>;

export interface OpcionesControladorRutaDoc {
  sla?: ServicioSlaRutaDoc;
  pool?: Pool;
}

export function crearControladorRutaDoc(
  servicio: ServicioRutaDoc,
  reversion: ServicioReversionRutaDoc,
  actorProvider: ActorProviderRutaDoc,
  opciones: OpcionesControladorRutaDoc = {},
): {
  listar: RequestHandler;
  obtener: RequestHandler;
  resumen: RequestHandler;
  revertir: RequestHandler;
} {
  const actorAutenticado = async (req: Request): Promise<ActorRutaDoc> => {
    const actor = await actorProvider.obtenerActor(req);
    if (!actor) throw new UnauthorizedError();
    return actor;
  };

  return {
    listar: async (req, res) => {
      const actor = await actorAutenticado(req);
      const filtros = filtrosSchema.parse(req.query);
      res.json(await servicio.listar(filtros, actor));
    },
    obtener: async (req, res) => {
      const actor = await actorAutenticado(req);
      const id = idSchema.parse(req.params.id);
      res.json(await servicio.obtener(id, actor));
    },
    resumen: async (req, res) => {
      const actor = await actorAutenticado(req);
      const id = idSchema.parse(req.params.id);
      const expediente = await servicio.obtener(id, actor);

      let tupaData = null;
      if (opciones.pool) {
        // Consulta SQL con esquema real de PostgreSQL sin silenciar errores (P1 - Codex Audit)
        const resTupa = await opciones.pool.query(
          `SELECT v.registro_version_id AS "registroVersionId",
                  COALESCE(tp.codigo_ref, rv.referencia_fila, rv.codigo_externo) AS "codigo",
                  COALESCE(tp.denominacion, rv.denominacion_original) AS "denominacion",
                  COALESCE(tp.categoria, 'PROCEDIMIENTO_APROBADO') AS "clasificacion",
                  COALESCE(tp.plazo_dias, 30)::int AS "plazoDias",
                  COALESCE(tp.monto, 0.00)::float AS "costo"
             FROM sigd_doc.expediente_tupa_vinculo v
             JOIN sigd_doc.tupa_registro_version rv ON rv.registro_version_id = v.registro_version_id
        LEFT JOIN sigd_doc.tupa_procedimiento tp ON tp.registro_version_id = rv.registro_version_id
            WHERE v.expediente_id = $1::uuid
              AND v.reemplaza_vinculo_id IS NULL
            ORDER BY v.vinculado_en DESC, v.vinculo_id DESC
            LIMIT 1`,
          [id],
        );
        tupaData = resTupa.rows[0] ?? null;
      }

      const slaData = opciones.sla ? await opciones.sla.obtener(id).catch(() => null) : null;

      res.json({
        expediente,
        estado: expediente.estadoActual,
        slaResumen: slaData
          ? {
              estado: slaData.estado,
              diasHabilesRestantes: slaData.diasHabilesRestantes,
              porcentaje: slaData.porcentaje,
              fechaLimite: slaData.fechaLimite,
            }
          : null,
        foliacionResumen: {
          cantidadDocumentos: expediente.resumenDocumentos?.cantidadDocumentos ?? 0,
          totalFolios: expediente.resumenDocumentos?.totalFolios ?? 0,
        },
        tupaResumen: tupaData,
      });
    },
    revertir: async (req, res) => {
      const actor = await actorAutenticado(req);
      const id = idSchema.parse(req.params.id);
      const comando = reversionSchema.parse(req.body);
      const correlationId = getRequestContext()?.correlation_id;
      if (!correlationId || !z.string().uuid().safeParse(correlationId).success) {
        throw new ValidationError({
          invalidParams: [
            {
              name: 'x-correlation-id',
              reason: 'Debe ser un UUID para el outbox transaccional.',
            },
          ],
        });
      }
      res.json(await reversion.revertir(id, comando, actor, correlationId));
    },
  };
}
