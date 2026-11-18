import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import { DerivarExpedienteSchema } from './dto/derivarExpediente.dto.js';
import { AtenderExpedienteSchema } from './dto/atenderExpediente.dto.js';
import { ArchivarExpedienteSchema } from './dto/archivarExpediente.dto.js';
import { derivarExpediente, atenderExpediente, archivarExpediente } from './derivaciones.service.js';
import { NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';

export function crearRouterDerivaciones(pool: Pool): Router {
  const router = Router();

  // Endpoint #24 (T-BE-RD-06) - Derivación Documentaria
  // Prefijo esperado en app.ts: /api/v1/expedientes
  const handlerDerivar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      // 1. Validación del contrato de entrada mediante Zod
      const datos = DerivarExpedienteSchema.parse(req.body);

      // 2. Obtener conexión del pool para garantizar atomicidad
      const cliente = await pool.connect();

      try {
        await cliente.query('BEGIN');

        // 3. Ejecución de la lógica de negocio
        await derivarExpediente(cliente, expedienteId, datos);

        // 4. Confirmar transacción
        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Derivación procesada y registrada exitosamente.',
          expediente_id: expedienteId,
          derivacionId: expedienteId,
          nuevoEstado: 'DERIVADO',
        });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/derivar', handlerDerivar);
  router.post('/:id/movimientos/derivar', handlerDerivar);

  // Endpoint #25 (T-BE-RD-07) - Atención Resolutiva
  router.post('/:id/atender', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const datos = AtenderExpedienteSchema.parse(req.body);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await atenderExpediente(cliente, expedienteId, datos);
        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Atención resolutiva registrada exitosamente.',
          expediente_id: expedienteId,
        });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  // Endpoint (T-BE-RD-08) - Archivado Formal
  router.post('/:id/archivar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const datos = ArchivarExpedienteSchema.parse(req.body);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await archivarExpediente(cliente, expedienteId, datos);
        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Archivado fisico registrado exitosamente.',
          expediente_id: expedienteId,
        });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  // Endpoints #29-acum (T-BE-RD-11) — Acumulación de Expedientes (Art. 160 LPAG)
  const handlerAcumular = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedientePrincipalId = String(req.params.id);
      const accesorioId = req.body.expedienteAccesorioId || (Array.isArray(req.body.conexos) && req.body.conexos[0]?.id) || req.body.accesorioId;
      const actoResolutivo = req.body.actoResolutivo || req.body.motivo || 'Acumulación de expedientes conexos conforme al Art. 160 LPAG';

      if (!accesorioId) {
        throw new ValidationError({
          message: 'Parámetros inválidos para acumulación.',
          invalidParams: [
            { name: 'expedienteAccesorioId', reason: 'Se requiere el identificador del expediente accesorio a acumular.' },
          ],
        });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await cliente.query<{ id_acumulacion: string }>(
          'SELECT sigd_tra.acumular_expediente($1::uuid, $2::uuid, $3::text) AS id_acumulacion',
          [expedientePrincipalId, accesorioId, actoResolutivo],
        );
        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Expediente acumulado formalmente según Art. 160 LPAG.',
          idAcumulacion: resultado.rows[0]?.id_acumulacion,
          expedientePrincipalId,
          expedienteAccesorioId: accesorioId,
        });
      } catch (error: any) {
        await cliente.query('ROLLBACK').catch(() => {});
        if (error?.code === '02000') {
          throw new NotFoundError({ detail: error.message || 'Expediente principal o accesorio no encontrado.' });
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/acumular', handlerAcumular);
  router.post('/:id/movimientos/acumular', handlerAcumular);

  // Endpoints #25-obs — Observación de Expediente
  const handlerObservar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const motivo = req.body.motivo || req.body.observacion || 'Expediente observado por requisitos pendientes';

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await cliente.query(
          `UPDATE sigd_tra.expediente SET estado = 'OBSERVADO' WHERE expediente_id = $1::uuid`,
          [expedienteId],
        );

        if (resultado.rowCount === 0) {
          throw new NotFoundError({ detail: `El expediente con ID ${expedienteId} no existe.` });
        }

        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Observación registrada exitosamente.',
          expedienteId,
          motivo,
          estado: 'OBSERVADO',
          slaPaused: true,
        });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/observar', handlerObservar);
  router.post('/:id/movimientos/observar', handlerObservar);

  // Endpoints #26-sub — Subsanación de Expediente
  const handlerSubsanar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const motivo = req.body.motivo || req.body.detalle || 'Subsanación de observaciones presentada por el administrado';

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await cliente.query(
          `UPDATE sigd_tra.expediente SET estado = 'EN_TRAMITE' WHERE expediente_id = $1::uuid`,
          [expedienteId],
        );

        if (resultado.rowCount === 0) {
          throw new NotFoundError({ detail: `El expediente con ID ${expedienteId} no existe.` });
        }

        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Subsanación registrada exitosamente.',
          expedienteId,
          motivo,
          estado: 'EN_TRAMITE',
        });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/subsanar', handlerSubsanar);
  router.post('/:id/movimientos/subsanar', handlerSubsanar);

  return router;
}

