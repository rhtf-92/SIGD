import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { ActorProviderRutaDoc } from '../rutadoc/rutadoc.actor-provider.js';
import {
  obtenerEstadoCertificadoInglesExpediente,
  registrarVerificacionAcademicaIngles,
  proyectarCertificadoIngles,
} from './certificadoIngles.service.js';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/domain/errors/index.js';
import { setUnidadOrganicaId, setUsuarioId } from '../../shared/request-context/request-context.js';

const VerificarAntecedentesSchema = z.object({
  registroEstudioId: z.string().uuid().nullable().optional(),
  resultado: z.enum(['FAVORABLE', 'OBSERVADO', 'IMPROCEDENTE']),
  observacionesAcademicas: z.string().trim().min(10).max(2000),
}).strict();

const ProyectarCertificadoSchema = z.object({
  asunto: z.string().trim().min(5).max(500).optional(),
  periodoEstudios: z.string().trim().min(3).max(120).optional(),
}).strict();

export function crearRouterCertificadoIngles(
  pool: Pool,
  actorProvider: ActorProviderRutaDoc,
): Router {
  const router = Router();

  router.get('/expediente/:expedienteId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.expedienteId ?? '').trim();
      if (!z.string().uuid().safeParse(expedienteId).success) {
        return res.status(200).json({ esCertificadoIngles: false });
      }

      const actor = await actorProvider.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      if (actor.puedeVerExpediente) {
        const autorizado = await actor.puedeVerExpediente(expedienteId);
        if (!autorizado) {
          throw new ForbiddenError({ detail: 'No cuenta con autorización para consultar este expediente.' });
        }
      }

      try {
        const estado = await obtenerEstadoCertificadoInglesExpediente(pool, expedienteId);
        if (!estado) {
          return res.status(200).json({ esCertificadoIngles: false });
        }

        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json(estado);
      } catch (err) {
        if (err instanceof ForbiddenError || err instanceof UnauthorizedError || err instanceof ValidationError) {
          throw err;
        }
        console.warn('[CertificadoIngles] Fallback estado no disponible:', (err as Error).message);
        return res.status(200).json({ esCertificadoIngles: false });
      }
    } catch (error) {
      next(error);
    }
  });

  router.post('/expediente/:expedienteId/verificar-antecedentes', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.expedienteId ?? '').trim();
      if (!z.string().uuid().safeParse(expedienteId).success) {
        return res.status(404).json({ detail: 'Expediente sin certificado de inglés proyectado.' });
      }

      const actor = await actorProvider.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const datos = VerificarAntecedentesSchema.parse(req.body);
      setUsuarioId(actor.id);
      setUnidadOrganicaId(actor.unidadOrganicaId ?? null);

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const verificacion = await registrarVerificacionAcademicaIngles(
          cliente,
          expedienteId,
          actor.id,
          actor.roles,
          datos,
        );
        await cliente.query('COMMIT');
        res.status(201).json({ ok: true, verificacion });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  router.post('/expediente/:expedienteId/proyectar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.expedienteId ?? '').trim();
      if (!z.string().uuid().safeParse(expedienteId).success) {
        return res.status(404).json({ detail: 'Expediente sin certificado de inglés proyectado.' });
      }

      const actor = await actorProvider.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const datos = ProyectarCertificadoSchema.parse(req.body ?? {});
      setUsuarioId(actor.id);
      setUnidadOrganicaId(actor.unidadOrganicaId ?? null);

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const certificado = await proyectarCertificadoIngles(
          cliente,
          expedienteId,
          actor.id,
          actor.roles,
          datos,
        );
        await cliente.query('COMMIT');
        res.status(201).json({ ok: true, certificado });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
