import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { resolverIdentidad } from '../../core/auth/auth.guard.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES_INTERNOS = ['ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'MESA_PARTES'];
const EVENTOS = [
  'RECEPCION', 'INICIAR_CALIFICACION', 'INICIAR_REVISION', 'DERIVACION',
  'OBSERVACION', 'CORRECCION', 'ENVIAR_A_FIRMA', 'FIRMA', 'CIERRE',
];

function enviarError(res: Response, status: number, codigo: string, mensaje: string): void {
  res.status(status).json({ code: codigo, title: mensaje, detail: mensaje, error: { codigo, mensaje } });
}

function exigirInterno(req: Request, res: Response, next: NextFunction): void {
  try {
    const identidad = resolverIdentidad(req);
    if (identidad.via !== 'bearer') {
      enviarError(res, 401, 'NO_AUTENTICADO', 'Debe iniciar sesion.');
      return;
    }
    if (!identidad.roles.some((r: string) => ROLES_INTERNOS.includes(r))) {
      enviarError(res, 403, 'SIN_PERMISO', 'Se requiere un rol interno.');
      return;
    }
    res.locals['idOperador'] = identidad.idUsuario;
  } catch {
    enviarError(res, 401, 'NO_AUTENTICADO', 'Debe iniciar sesion.');
    return;
  }
  next();
}

export function crearAtencionRouter(pool: Pool): Router {
  const router = Router();
  router.use(exigirInterno);

  router.post('/expedientes/:id/avanzar', (req: Request, res: Response): void => {
    const id = String(req.params['id'] ?? '');
    const cuerpo = (req.body ?? {}) as { evento?: unknown; resumen?: unknown };
    const evento = typeof cuerpo.evento === 'string' ? cuerpo.evento : '';
    const resumen = typeof cuerpo.resumen === 'string' ? cuerpo.resumen.trim() : '';
    if (!UUID_RE.test(id)) {
      enviarError(res, 400, 'ID_NO_VALIDO', 'El id del expediente no es valido.');
      return;
    }
    if (!EVENTOS.includes(evento)) {
      enviarError(res, 400, 'EVENTO_NO_VALIDO', 'El evento no es valido.');
      return;
    }
    if (resumen.length < 3) {
      enviarError(res, 400, 'RESUMEN_OBLIGATORIO', 'El resumen es obligatorio.');
      return;
    }
    void (async () => {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const exp = await cliente.query('SELECT 1 FROM sigd_tra.expediente WHERE expediente_id = $1', [id]);
        if (exp.rowCount === 0) {
          await cliente.query('ROLLBACK');
          enviarError(res, 404, 'NO_ENCONTRADO', 'El expediente no existe.');
          return;
        }
        const act = await cliente.query<{ estado_nuevo: string }>(
          'SELECT estado_nuevo FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1',
          [id],
        );
        const anterior = act.rows[0]?.estado_nuevo ?? 'REGISTRADO';
        const sig = await cliente.query<{ estado_nuevo: string }>(
          'SELECT estado_nuevo FROM sigd_rut.transicion_estado_tramite WHERE estado_anterior = $1 AND evento = $2',
          [anterior, evento],
        );
        const nuevo = sig.rows[0]?.estado_nuevo;
        if (!nuevo) {
          await cliente.query('ROLLBACK');
          enviarError(res, 409, 'TRANSICION_INVALIDA', 'No se puede aplicar ' + evento + ' desde el estado ' + anterior + '.');
          return;
        }
        const ins = await cliente.query<{ id_movimiento: string; secuencia: string }>(
          `INSERT INTO sigd_rut.movimiento_tramite
             (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos)
           VALUES ($1, $2, $3, $4, $5, jsonb_build_object('resumen', $6::text))
           RETURNING id_movimiento, secuencia`,
          [id, anterior, evento, nuevo, res.locals['idOperador'], resumen],
        );
        await cliente.query('COMMIT');
        res.status(201).json({
          idMovimiento: ins.rows[0]?.id_movimiento,
          secuencia: Number(ins.rows[0]?.secuencia),
          estadoAnterior: anterior,
          evento,
          estadoNuevo: nuevo,
        });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        console.error('[atencion]', error instanceof Error ? error.message : error);
        if (!res.headersSent) enviarError(res, 500, 'ERROR_INTERNO', 'No se pudo registrar el movimiento.');
      } finally {
        cliente.release();
      }
    })();
  });

    router.get('/expedientes', (req: Request, res: Response): void => {
    const cut = typeof req.query['cut'] === 'string' ? req.query['cut'].trim() : '';
    if (!/^EXP-\d{4}-\d{6}$/.test(cut)) {
      enviarError(res, 400, 'CUT_NO_VALIDO', 'El CUT debe tener la forma EXP-AAAA-NNNNNN.');
      return;
    }
    void (async () => {
      try {
        const e = await pool.query<{ expediente_id: string; estado: string }>(
          `SELECT e.expediente_id, COALESCE(ea.estado_nuevo, e.estado) AS estado
             FROM sigd_tra.expediente e
             LEFT JOIN sigd_rut.estado_actual_expediente ea ON ea.expediente_id = e.expediente_id
            WHERE e.codigo_expediente = $1`,
          [cut],
        );
        const fila = e.rows[0];
        if (!fila) {
          enviarError(res, 404, 'NO_ENCONTRADO', 'No existe un expediente con ese CUT.');
          return;
        }
        const t = await pool.query(
          `SELECT evento, estado_nuevo AS "estadoNuevo"
             FROM sigd_rut.transicion_estado_tramite
            WHERE estado_anterior = $1
            ORDER BY evento`,
          [fila.estado],
        );
        res.json({ expedienteId: fila.expediente_id, cut, estado: fila.estado, transiciones: t.rows });
      } catch (error) {
        console.error('[atencion]', error instanceof Error ? error.message : error);
        enviarError(res, 500, 'ERROR_INTERNO', 'No se pudo buscar el expediente.');
      }
    })();
  });

  router.get('/expedientes/:id/trazabilidad', (req: Request, res: Response): void => {
    const id = String(req.params['id'] ?? '');
    if (!UUID_RE.test(id)) {
      enviarError(res, 400, 'ID_NO_VALIDO', 'El id del expediente no es valido.');
      return;
    }
    void (async () => {
      try {
        const r = await pool.query(
          `SELECT m.secuencia, m.fecha_hora AS "fechaHora", m.estado_anterior AS "estadoAnterior",
                  m.evento, m.estado_nuevo AS "estadoNuevo", cu.usuario,
                  m.datos->>'resumen' AS resumen
             FROM sigd_rut.movimiento_tramite m
             LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = m.usuario_operador_id
            WHERE m.expediente_id = $1
            ORDER BY m.secuencia`,
          [id],
        );
        res.json({ expedienteId: id, movimientos: r.rows });
      } catch (error) {
        console.error('[atencion]', error instanceof Error ? error.message : error);
        enviarError(res, 500, 'ERROR_INTERNO', 'No se pudo leer la trazabilidad.');
      }
    })();
  });

  return router;
}