import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  ValidationError,
} from '../../shared/domain/errors/index.js';

import {
  asignarFoliacionContinua,
} from './foliacionAgn.service.js';

import {
  registrarCallbackRefirma,
  verificarFirmaWebhook,
} from './callbackRefirma.service.js';

import {
  crearVerificadorCvd,
} from './validadorCvd.controller.js';

type RequestConRawBody = Request & {
  rawBody?: Buffer;
};

const foliacionSchema = z.object({
  documento_id: z.string().uuid(),
  total_folios: z.number().int().positive(),
});

const callbackSchema = z.object({
  documento_id: z.string().uuid(),
  sha256_firmado: z.string().regex(/^[a-fA-F0-9]{64}$/),
  firmante: z.string().trim().min(1),
  fecha_sello_tsa: z.string().datetime(),
  s3_bucket: z.string().trim().min(1),
  s3_key: z.string().trim().min(1),
});

export function crearRouterDocuCore(pool: Pool): Router {
  const router = Router();

  router.post(
    '/v1/expedientes/:id/foliar-documento',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const idParam = req.params.id;
        if (Array.isArray(idParam)) {
          throw new ValidationError({
            invalidParams: [{ name: 'id', reason: 'El ID de expediente no puede ser un arreglo.' }],
          });
        }
        if (!idParam || typeof idParam !== 'string' || !idParam.trim()) {
          throw new ValidationError({
            invalidParams: [{ name: 'id', reason: 'El ID de expediente es obligatorio.' }],
          });
        }

        const datos = foliacionSchema.parse(req.body);

        const cliente = await pool.connect();
        try {
          await cliente.query('BEGIN');

          const foliacion = await asignarFoliacionContinua(
            cliente,
            idParam.trim(),
            datos.documento_id,
            datos.total_folios,
          );

          await cliente.query('COMMIT');

          return res.status(201).json(foliacion);
        } catch (error) {
          await cliente.query('ROLLBACK');
          throw error;
        } finally {
          cliente.release();
        }
      } catch (error) {
        return next(error);
      }
    },
  );

  router.post(
    '/v1/firma/callback-refirma',
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        const rawReq = req as RequestConRawBody;
        if (!rawReq.rawBody) {
          throw new ValidationError({
            invalidParams: [
              {
                name: 'rawBody',
                reason: 'No se recibió el cuerpo original para validar el callback.',
              },
            ],
          });
        }

        verificarFirmaWebhook(
          rawReq.rawBody,
          req.get('x-refirma-signature') ?? undefined,
          process.env.REFIRMA_WEBHOOK_SECRET ?? '',
        );

        const datos = callbackSchema.parse(req.body);

        const cliente = await pool.connect();
        try {
          await cliente.query('BEGIN');

          const cvd = await registrarCallbackRefirma(cliente, datos);

          await cliente.query('COMMIT');

          return res.status(200).json({
            estado: 'FIRMADO_DIGITALMENTE',
            cvd,
          });
        } catch (error) {
          await cliente.query('ROLLBACK');
          throw error;
        } finally {
          cliente.release();
        }
      } catch (error) {
        return next(error);
      }
    },
  );

  router.get(
    '/v1/validador-cvd/verificar/:cvd',
    crearVerificadorCvd(pool),
  );

  return router;
}
