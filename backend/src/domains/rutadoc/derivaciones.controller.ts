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

  return router;
}

