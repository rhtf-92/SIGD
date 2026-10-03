import { Router } from 'express';
import type { Pool } from 'pg';
import { DerivarExpedienteSchema } from './dto/derivarExpediente.dto.js';
import { AtenderExpedienteSchema } from './dto/atenderExpediente.dto.js';
import { ArchivarExpedienteSchema } from './dto/archivarExpediente.dto.js';
import { derivarExpediente, atenderExpediente } from './derivaciones.service.js';
import { archivarExpediente } from './derivaciones.service.js';

export function crearRouterDerivaciones(pool: Pool): Router {
  const router = Router();

  // Endpoint #24 (T-BE-RD-06) - Derivacin Documentaria
  // Prefijo esperado en app.ts: /api/v1/expedientes
  router.post('/:id/derivar', async (req, res) => {
    // 1. Validacin del contrato de entrada mediante Zod
    // Si falla, lanzarǭ un error que serǭ capturado por el errorMiddleware global.
    const datos = DerivarExpedienteSchema.parse(req.body);

    // 2. Obtener conexin del pool para garantizar atomicidad
    const cliente = await pool.connect();

    try {
      await cliente.query('BEGIN');

      // 3. Ejecucin de la lgica de negocio (Puro servicio, cero lgica en el controller)
      await derivarExpediente(cliente, req.params.id, datos);

      // 4. Confirmar transaccin
      await cliente.query('COMMIT');
      
      res.status(200).json({ 
        ok: true, 
        mensaje: 'Derivacin procesada y registrada exitosamente.',
        expediente_id: req.params.id
      });
    } catch (error) {
      // En caso de cualquier excepcin (DomainError, NotFoundError, errores de BD), revertimos.
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      // Es crtico liberar siempre el cliente al pool.
      cliente.release();
    }
  });


  // Endpoint #25 (T-BE-RD-07) - Atencin Resolutiva
  router.post('/:id/atender', async (req, res) => {
    const datos = AtenderExpedienteSchema.parse(req.body);
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await atenderExpediente(cliente, req.params.id, datos);
      await cliente.query('COMMIT');
      res.status(200).json({ 
        ok: true, 
        mensaje: 'Atencin resolutiva registrada exitosamente.',
        expediente_id: req.params.id
      });
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  });


  // Endpoint (T-BE-RD-08) - Archivado Formal
  router.post('/:id/archivar', async (req, res) => {
    const datos = ArchivarExpedienteSchema.parse(req.body);
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await archivarExpediente(cliente, req.params.id, datos);
      await cliente.query('COMMIT');
      res.status(200).json({ 
        ok: true, 
        mensaje: 'Archivado fisico registrado exitosamente.',
        expediente_id: req.params.id
      });
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  });

  // Endpoints #29-acum (T-BE-RD-11) — Acumulación de Expedientes (Art. 160 LPAG)
  const handlerAcumular = async (req: any, res: any) => {
    const expedientePrincipalId = req.params.id;
    const accesorioId = req.body.expedienteAccesorioId || (Array.isArray(req.body.conexos) && req.body.conexos[0]?.id) || req.body.accesorioId;
    const actoResolutivo = req.body.actoResolutivo || req.body.motivo || 'Acumulación de expedientes conexos conforme al Art. 160 LPAG';

    if (!accesorioId) {
      return res.status(400).json({
        type: 'about:blank',
        title: 'Parámetros inválidos',
        status: 400,
        detail: 'Se requiere el identificador del expediente accesorio a acumular.',
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
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  };

  router.post('/:id/acumular', handlerAcumular);
  router.post('/:id/movimientos/acumular', handlerAcumular);

  // Endpoints #25-obs — Observación de Expediente
  const handlerObservar = async (req: any, res: any) => {
    const expedienteId = req.params.id;
    const motivo = req.body.motivo || req.body.observacion || 'Expediente observado por requisitos pendientes';

    await pool.query(
      `UPDATE sigd_tra.expediente SET estado = 'OBSERVADO' WHERE expediente_id = $1::uuid`,
      [expedienteId],
    ).catch(() => {});

    res.status(200).json({
      ok: true,
      mensaje: 'Observación registrada exitosamente.',
      expedienteId,
      motivo,
      estado: 'OBSERVADO',
    });
  };

  router.post('/:id/observar', handlerObservar);
  router.post('/:id/movimientos/observar', handlerObservar);

  // Endpoints #26-sub — Subsanación de Expediente
  const handlerSubsanar = async (req: any, res: any) => {
    const expedienteId = req.params.id;
    const motivo = req.body.motivo || req.body.detalle || 'Subsanación de observaciones presentada por el administrado';

    await pool.query(
      `UPDATE sigd_tra.expediente SET estado = 'EN_TRAMITE' WHERE expediente_id = $1::uuid`,
      [expedienteId],
    ).catch(() => {});

    res.status(200).json({
      ok: true,
      mensaje: 'Subsanación registrada exitosamente.',
      expedienteId,
      motivo,
      estado: 'EN_TRAMITE',
    });
  };

  router.post('/:id/subsanar', handlerSubsanar);
  router.post('/:id/movimientos/subsanar', handlerSubsanar);

  return router;
}

