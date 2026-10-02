import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from 'pg';
import { insertarEvento } from '../audit/evento-outbox.repository.js';
import { registrarMutacion } from '../audit/bitacora-auditoria.repository.js';
import { getRequestContext, setUsuarioId } from '../shared/request-context/request-context.js';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../shared/domain/errors/index.js';

const esquemaRadicacion = z.object({
  numero: z.string().min(1, 'El campo es obligatorio.'),
  dni_solicitante: z.string().regex(/^\d{8}$/, 'Formato de DNI inválido.'),
  numero_documento: z.string().min(1, 'El campo es obligatorio.'),
  folios: z.number().int().min(0, 'Los folios no pueden ser negativos.'),
  tipo_documental_id: z.string().uuid(),
  solicitante_id: z.string().uuid(),
  area_destino_id: z.string().uuid(),
});

export function crearRouterReferencia(pool: Pool): Router {
  const router = Router();

  router.use((req, _res, next) => {
    const usuarioId = req.get('x-usuario-id');
    if (usuarioId) {
      setUsuarioId(usuarioId);
    }
    next();
  });

  router.get('/protegido', (req, res) => {
    if (!req.get('x-auth')) {
      throw new UnauthorizedError();
    }
    res.json({ ok: true });
  });

  router.post('/accion-admin', (req, res) => {
    if (!req.get('x-auth')) {
      throw new UnauthorizedError();
    }
    if (req.get('x-rol') !== 'admin') {
      throw new ForbiddenError();
    }
    res.json({ ok: true });
  });

  router.get('/falla-critica', () => {
    throw new Error('falla inducida en entorno de pruebas');
  });

  router.post('/areas', async (req, res) => {
    const esquema = z.object({ nombre: z.string().min(1) });
    const datos = esquema.parse(req.body);
    const cliente = await pool.connect();
    try {
      const creada = await cliente.query<{ area_id: string }>(
        `INSERT INTO sigd_org.area (nombre, vigente) VALUES ($1, true) RETURNING area_id`,
        [datos.nombre],
      );
      res.status(201).json({ area_id: creada.rows[0].area_id });
    } finally {
      cliente.release();
    }
  });

  router.post('/expedientes', async (req, res) => {
    const datos = esquemaRadicacion.parse(req.body);
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const insertado = await cliente.query<{ expediente_id: string; numero: string }>(
        `INSERT INTO sigd_tra.expediente
           (numero, dni_solicitante, tipo_documental_id, solicitante_id, area_destino_id, fecha_radicacion)
         VALUES ($1, $2, $3, $4, $5, now())
         RETURNING expediente_id, numero`,
        [
          datos.numero,
          datos.dni_solicitante,
          datos.tipo_documental_id,
          datos.solicitante_id,
          datos.area_destino_id,
        ],
      );
      const expedienteId = insertado.rows[0].expediente_id;

      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'expediente',
        operacion: 'INSERT',
        datos_despues: {
          numero: datos.numero,
          tipo_documental_id: datos.tipo_documental_id,
        },
      });

      await insertarEvento(cliente, {
        agregado: 'expediente',
        tipo_evento: 'TramiteRegistrado',
        payload: {
          expediente_id: expedienteId,
          numero: datos.numero,
          tipo_documental_id: datos.tipo_documental_id,
          solicitante_id: datos.solicitante_id,
          area_destino_id: datos.area_destino_id,
          correlation_id: getRequestContext()?.correlation_id,
        },
      });

      await cliente.query('COMMIT');
      res.status(201).json({
        expediente_id: expedienteId,
        numero: insertado.rows[0].numero,
        correlation_id: getRequestContext()?.correlation_id,
      });
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  });

  router.post('/expedientes/derivar', async (req, res) => {
    const esquema = z.object({
      expediente_id: z.string().uuid(),
      area_destino_id: z.string().uuid(),
    });
    const datos = esquema.parse(req.body);
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const area = await cliente.query(
        `SELECT area_id FROM sigd_org.area WHERE area_id = $1 AND vigente = true`,
        [datos.area_destino_id],
      );
      if (!area.rowCount || area.rowCount === 0) {
        throw new NotFoundError({ detail: 'El área de destino no existe.' });
      }

      await cliente.query(
        `INSERT INTO sigd_rut.movimiento_tramite (expediente_id, area_destino_id, fecha_movimiento)
         VALUES ($1, $2, now())`,
        [datos.expediente_id, datos.area_destino_id],
      );

      await registrarMutacion(cliente, {
        esquema: 'sigd_rut',
        tabla: 'movimiento_tramite',
        operacion: 'INSERT',
        datos_despues: { expediente_id: datos.expediente_id, area_destino_id: datos.area_destino_id },
      });

      await cliente.query('COMMIT');
      res.status(200).json({ ok: true, expediente_id: datos.expediente_id });
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  });

  return router;
}