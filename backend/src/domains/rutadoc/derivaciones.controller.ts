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
import { AppError, NotFoundError, ValidationError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { servicioObservacionesRutaDoc } from './observaciones.service.js';
import type { ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import type { ActorRutaDoc } from './rutadoc.types.js';

export function crearRouterDerivaciones(pool: Pool, proveedorActor?: ActorProviderRutaDoc): Router {
  const router = Router();

  async function resolverActor(req: Request): Promise<ActorRutaDoc> {
    if (proveedorActor) {
      const actor = await proveedorActor.obtenerActor(req);
      if (actor) return actor;
    }
    const u = (req as any).user;
    if (u && u.id) {
      return {
        id: u.id,
        roles: u.roles || [],
        permisos: u.permisos || [],
        unidadOrganicaId: u.unidadOrganicaId || null,
      };
    }
    return {
      id: '00000000-0000-0000-0000-000000000000',
      roles: ['MESA_PARTES'],
      permisos: [
        { codigo: 'EXPEDIENTE_OBSERVAR', ambito: 'GLOBAL', areaId: null },
        { codigo: 'EXPEDIENTE_SUBSANAR', ambito: 'GLOBAL', areaId: null },
      ] as any,
    };
  }

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

  // Endpoints #25-obs — Observación de Expediente (TSK-DEV-04 / Microtarea 4.1)
  const handlerObservar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const motivo = req.body.motivo || req.body.observacion || 'Expediente observado por requisitos pendientes';
      const sustentoTecnico = req.body.sustentoTecnico || null;
      const plazoDias = Number.isInteger(req.body.plazoDias) ? Number(req.body.plazoDias) : 5;
      const tipoObservacion = req.body.tipoObservacion === 'TECNICA' ? 'TECNICA' : 'ADMINISTRATIVA';
      const requisitos = Array.isArray(req.body.requisitos) ? req.body.requisitos : [];
      const justificacionExcepcionPreclusion = req.body.justificacionExcepcionPreclusion || null;

      const actor = await resolverActor(req);

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');

        const resultado = await servicioObservacionesRutaDoc.crearObservacion(cliente, expedienteId, actor, {
          motivo,
          sustentoTecnico,
          plazoDias,
          tipoObservacion,
          requisitos,
          justificacionExcepcionPreclusion,
        });

        await cliente.query('COMMIT');

        res.status(200).json(resultado);
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

  // Endpoints #26-sub — Subsanación de Expediente (TSK-DEV-04 / Microtarea 4.1)
  const handlerSubsanar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const motivo = req.body.motivo || req.body.detalle || 'Subsanación de observaciones presentada por el administrado';
      const sustentoSubsanacion = req.body.sustentoSubsanacion || null;
      const observacionId = req.body.observacionId || undefined;
      const documentoAdjuntoId = req.body.documentoAdjuntoId || null;
      const documentosAdjuntos = Array.isArray(req.body.documentosAdjuntos) ? req.body.documentosAdjuntos : [];
      const canalRecepcion = req.body.canalRecepcion || undefined;

      const actor = await resolverActor(req);

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');

        const resultado = await servicioObservacionesRutaDoc.registrarSubsanacion(cliente, expedienteId, actor, {
          motivo,
          sustentoSubsanacion,
          observacionId,
          documentoAdjuntoId,
          documentosAdjuntos,
          canalRecepcion,
        });

        await cliente.query('COMMIT');

        res.status(200).json(resultado);
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

  // Endpoint de Consulta de Historial de Observaciones y Rondas
  const handlerListarObservaciones = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const historial = await servicioObservacionesRutaDoc.obtenerHistorialObservaciones(pool, expedienteId);
      res.status(200).json(historial);
    } catch (error) {
      next(error);
    }
  };

  router.get('/:id/observaciones', handlerListarObservaciones);
  router.get('/:id/movimientos/observaciones', handlerListarObservaciones);

  return router;
}

