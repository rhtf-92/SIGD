import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  AppError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/domain/errors/index.js';
import {
  obtenerAutorizacionCuenta,
  resolverIdentidad,
} from '../../core/auth/auth.guard.js';

import {
  asignarFoliacionContinua,
} from './foliacionAgn.service.js';

import {
  registrarCallbackRefirma,
  verificarFirmaWebhook,
} from './callbackRefirma.service.js';

import {
  crearVerificadorCvd,
  type GeneradorUrlDescarga,
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

export function crearRouterDocuCore(pool: Pool, storage?: GeneradorUrlDescarga): Router {
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

        const identidad = resolverIdentidad(req);
        if (!z.string().uuid().safeParse(identidad.idUsuario).success) {
          throw new UnauthorizedError({ detail: 'Identificador de usuario no válido.' });
        }

        const autorizacion = await obtenerAutorizacionCuenta(pool, identidad.idUsuario, identidad.contextoId);
        if (!autorizacion) {
          throw new ForbiddenError({ detail: 'Cuenta institucional inactiva o no autorizada.' });
        }
        if (identidad.contextoId && autorizacion.contextoRevocado) {
          throw new AppError({
            status: 403,
            code: 'CONTEXT_REVOKED',
            message: 'El contexto activo ha sido revocado o no se encuentra vigente. Debe seleccionar un contexto vigente.',
          });
        }

        const esAdminODirector =
          autorizacion.roles.some((r) => r === 'ADMINISTRADOR' || r === 'DIRECTOR') ||
          autorizacion.permisos.some(
            (p) => (p.codigo === 'ADMIN_USUARIOS' || p.codigo === 'FIRMA_FIRMAR') && p.ambito === 'GLOBAL',
          );

        if (!esAdminODirector) {
          const permisosFoliar = autorizacion.permisos.filter(
            (p) => p.codigo === 'EXPEDIENTE_DERIVAR' || p.codigo === 'EXPEDIENTE_RESOLVER',
          );
          const rolesOperativos = autorizacion.roles.some((r) =>
            ['SECRETARIO', 'MESA_PARTES'].includes(r),
          );

          if (autorizacion.roles.includes('CIUDADANO') || (!rolesOperativos && permisosFoliar.length === 0)) {
            throw new ForbiddenError({
              detail: 'El usuario no dispone de facultades para foliar documentos en este expediente.',
            });
          }

          const tieneGlobal = permisosFoliar.some((p) => p.ambito === 'GLOBAL' || p.areaId === null);
          if (!tieneGlobal && z.string().uuid().safeParse(idParam.trim()).success) {
            const areasUsuario = permisosFoliar
              .filter((p) => p.ambito === 'AREA' && p.areaId !== null)
              .map((p) => p.areaId);

            if (autorizacion.unidadOrganicaId) {
              areasUsuario.push(autorizacion.unidadOrganicaId);
            }

            if (areasUsuario.length > 0) {
              const acceso = await pool.query<{ autorizado: boolean }>(
                `SELECT EXISTS (
                   SELECT 1 FROM sigd_tra.expediente e
                   LEFT JOIN sigd_rut.estado_actual_expediente a USING (expediente_id)
                   LEFT JOIN (
                     SELECT DISTINCT ON (expediente_id)
                            expediente_id, canal_ingreso, anulado
                       FROM sigd_tra.asiento_registro
                      WHERE anulado = FALSE
                      ORDER BY expediente_id, numero_registro ASC
                   ) ar ON ar.expediente_id = e.expediente_id
                  WHERE e.expediente_id = $1::uuid
                    AND (
                      a.area_actual_id = ANY($2::text[])
                      OR ar.canal_ingreso = 'VIRTUAL'
                    )
                 ) AS autorizado`,
                [idParam.trim(), areasUsuario],
              );
              if (!acceso.rows[0]?.autorizado) {
                throw new ForbiddenError({
                  detail: 'El usuario no tiene competencia en el área del expediente para foliar.',
                });
              }
            }
          }
        }

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

        const secretoWebhook = process.env.REFIRMA_WEBHOOK_SECRET;
        if (!secretoWebhook || secretoWebhook.trim() === '') {
          throw new ForbiddenError({
            detail: 'El servicio de firma no está configurado para recibir callbacks (falta REFIRMA_WEBHOOK_SECRET).',
          });
        }

        verificarFirmaWebhook(
          rawReq.rawBody,
          req.get('x-refirma-signature') ?? undefined,
          secretoWebhook,
          req.get('x-refirma-timestamp') ?? undefined,
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
    crearVerificadorCvd(pool, storage),
  );

  return router;
}
