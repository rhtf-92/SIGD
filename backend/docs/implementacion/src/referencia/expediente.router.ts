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
  id_tipo_documental: z.string().uuid(),
  id_solicitante: z.string().uuid(),
  id_area_destino: z.string().uuid(),
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
      const creada = await cliente.query<{ id_area: string }>(
        `INSERT INTO sigd_org.area (nombre, vigente) VALUES ($1, true) RETURNING id_area`,
        [datos.nombre],
      );
      res.status(201).json({ id_area: creada.rows[0].id_area });
    } finally {
      cliente.release();
    }
  });

  router.post('/expedientes', async (req, res) => {
    const datos = esquemaRadicacion.parse(req.body);
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const insertado = await cliente.query<{ id_expediente: string; numero: string }>(
        `INSERT INTO sigd_tra.expediente
           (numero, dni_solicitante, id_tipo_documental, id_solicitante, id_area_destino, fecha_radicacion)
         VALUES ($1, $2, $3, $4, $5, now())
         RETURNING id_expediente, numero`,
        [
          datos.numero,
          datos.dni_solicitante,
          datos.id_tipo_documental,
          datos.id_solicitante,
          datos.id_area_destino,
        ],
      );
      const idExpediente = insertado.rows[0].id_expediente;

      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'expediente',
        operacion: 'INSERT',
        datos_despues: {
          numero: datos.numero,
          id_tipo_documental: datos.id_tipo_documental,
        },
      });

      await insertarEvento(cliente, {
        agregado: 'expediente',
        tipo_evento: 'TramiteRegistrado',
        payload: {
          id_expediente: idExpediente,
          numero: datos.numero,
          id_tipo_documental: datos.id_tipo_documental,
          id_solicitante: datos.id_solicitante,
          id_area_destino: datos.id_area_destino,
          correlation_id: getRequestContext()?.correlation_id,
        },
      });

      await cliente.query('COMMIT');
      res.status(201).json({
        id_expediente: idExpediente,
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
      id_expediente: z.string().uuid(),
      id_area_destino: z.string().uuid(),
    });
    const datos = esquema.parse(req.body);
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const area = await cliente.query(
        `SELECT id_area FROM sigd_org.area WHERE id_area = $1 AND vigente = true`,
        [datos.id_area_destino],
      );
      if (!area.rowCount || area.rowCount === 0) {
        throw new NotFoundError({ detail: 'El área de destino no existe.' });
      }

      await cliente.query(
        `INSERT INTO sigd_rut.movimiento_tramite (id_expediente, id_area_destino, fecha_movimiento)
         VALUES ($1, $2, now())`,
        [datos.id_expediente, datos.id_area_destino],
      );

      await registrarMutacion(cliente, {
        esquema: 'sigd_rut',
        tabla: 'movimiento_tramite',
        operacion: 'INSERT',
        datos_despues: { id_expediente: datos.id_expediente, id_area_destino: datos.id_area_destino },
      });

      await cliente.query('COMMIT');
      res.status(200).json({ ok: true, id_expediente: datos.id_expediente });
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  });

  return router;
}