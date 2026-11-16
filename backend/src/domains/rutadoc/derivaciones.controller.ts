import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { DerivarExpedienteSchema } from './dto/derivarExpediente.dto.js';
import { AtenderExpedienteSchema } from './dto/atenderExpediente.dto.js';
import { ArchivarExpedienteSchema } from './dto/archivarExpediente.dto.js';
import { RecepcionarExpedienteSchema } from './dto/recepcionarExpediente.dto.js';
import { derivarExpediente, atenderExpediente, archivarExpediente, recepcionarExpediente } from './derivaciones.service.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { obtenerSiguienteEstado } from './rutadoc.fsm.js';
import { AppError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';

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

  // Endpoint de Derivación Masiva / Lote (T-BE-RD-15 / Fase II)
  const handlerDerivarLote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const esquemaLote = z.object({
        expedienteIds: z
          .array(z.string().uuid({ message: 'Cada identificador debe ser un UUID válido.' }))
          .min(1, 'Debe especificar al menos un expediente.')
          .max(100, 'El lote no puede exceder 100 expedientes.'),
        destinos: DerivarExpedienteSchema.shape.destinos,
        proveido: DerivarExpedienteSchema.shape.proveido,
      });

      const { expedienteIds, destinos, proveido } = esquemaLote.parse(req.body);
      const cliente = await pool.connect();

      try {
        await cliente.query('BEGIN');
        const resultados: Array<{ expedienteId: string; ok: boolean }> = [];

        for (const expId of expedienteIds) {
          await derivarExpediente(cliente, expId, { destinos, proveido });
          resultados.push({ expedienteId: expId, ok: true });
        }

        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: `Derivación masiva de ${resultados.length} expedientes procesada exitosamente.`,
          total: resultados.length,
          resultados,
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

  router.post('/derivar-lote', handlerDerivarLote);
  router.post('/derivar-masivo', handlerDerivarLote);
  router.post('/:id/derivar', handlerDerivar);
  router.post('/:id/movimientos/derivar', handlerDerivar);

  // Endpoint de Recepción Formal (T-BE-RD-12 / FASE 7B)
  const handlerRecepcionar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const datos = RecepcionarExpedienteSchema.parse(req.body || {});

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await recepcionarExpediente(cliente, expedienteId, datos);
        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Recepción formal registrada exitosamente.',
          expediente_id: expedienteId,
          movimientoId: resultado.movimientoId,
          nuevoEstado: resultado.nuevoEstado,
          secuencia: resultado.secuencia,
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

  router.post('/:id/recepcionar', handlerRecepcionar);
  router.post('/:id/movimientos/recepcionar', handlerRecepcionar);

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
        const actual = await cliente.query<{ estado: string }>(
          `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid FOR UPDATE`,
          [expedienteId],
        );
        if (actual.rows.length !== 1) throw new NotFoundError({ detail: 'El expediente no existe.' });
        const siguienteEstado = obtenerSiguienteEstado(actual.rows[0].estado, 'OBSERVACION');
        const resultado = await cliente.query<{ expediente_id: string; codigo_expediente: string; solicitante_id: string }>(
          `UPDATE sigd_tra.expediente SET estado = $2
            WHERE expediente_id = $1::uuid
            RETURNING expediente_id::text, codigo_expediente, solicitante_id::text`,
          [expedienteId, siguienteEstado],
        );

        if (resultado.rowCount === 0) {
          throw new NotFoundError({ detail: `El expediente con ID ${expedienteId} no existe.` });
        }

        const expediente = resultado.rows[0];
        const destinatarios = await cliente.query<{ usuario_id: string; asunto: string }>(
          `SELECT c.id_usuario::text AS usuario_id, t.asunto
             FROM sigd_tra.expediente e
             JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
             JOIN sigd_auth.cuenta_usuario c
               ON c.id_persona = e.solicitante_id AND c.activo = TRUE
            WHERE e.expediente_id = $1::uuid AND e.solicitante_id = $2::uuid
            ORDER BY c.id_usuario
            LIMIT 2`,
          [expediente.expediente_id, expediente.solicitante_id],
        );
        if (destinatarios.rows.length !== 1) {
          throw new AppError({
            status: 409,
            code: 'CASILLA_TITULAR_NO_UNICO',
            message: 'No se pudo identificar una única cuenta activa titular para depositar la observación en Casilla.',
          });
        }
        const destinatario = destinatarios.rows[0];
        await insertarEvento(cliente, {
          agregado: 'Expediente',
          tipo_evento: 'expediente_observado',
          payload: {
            usuario_id: destinatario.usuario_id,
            expediente_id: expediente.expediente_id,
            cut: expediente.codigo_expediente,
            asunto: destinatario.asunto,
            tipo_acto: 'Observación de expediente',
            cuerpo: { contenido: motivo },
          },
        });

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

