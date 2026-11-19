import type { Pool, PoolClient } from 'pg';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { fallo } from './tesoreria.rules.js';

export class TesoreriaRepository {
  constructor(readonly pool: Pool) {}
  async disponible(): Promise<void> {
    const r = await this.pool.query("SELECT to_regclass('sigd_tes.orden_pago')::text tabla");
    if (!r.rows[0]?.tabla) fallo('TESORERIA_NO_INSTALADA', 'Tesorería aún no está habilitada en esta instalación.', 503);
  }
  async transaccion<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
    catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
  }
  async hecho(c: PoolClient, tabla: string, id: string, actor: string, accion: string, motivo: string, ordenId?: string, devolucionId?: string, anexo?:{historialId:string;documentoId:string}): Promise<void> {
    const motivoHistorial=anexo?JSON.stringify({version:1,texto:motivo,documentoId:anexo.documentoId}):motivo;
    if (ordenId) await c.query(`INSERT INTO sigd_tes.historial(orden_id,devolucion_id,actor_id,accion,motivo,creado_en,id) VALUES($1,$2,$3,$4,$5,clock_timestamp(),COALESCE($6::uuid,gen_random_uuid()))`, [ordenId, devolucionId ?? null, actor, accion, motivoHistorial,anexo?.historialId??null]);
    await registrarMutacion(c, { esquema: 'sigd_tes', tabla, operacion: 'INSERT', datos_despues: { id, actor, accion, motivo, orden_id: ordenId ?? null, devolucion_id: devolucionId ?? null } });
    if (ordenId) {
      const orden = (await c.query('SELECT ciudadano_id,codigo FROM sigd_tes.orden_pago WHERE id=$1', [ordenId])).rows[0];
      if(orden.ciudadano_id)await insertarEvento(c, { agregado: 'tesoreria', tipo_evento: 'tesoreria_notificacion',
        payload: { usuario_id: orden.ciudadano_id, orden_id: ordenId, referencia_orden: orden.codigo, asunto: `Tesorería: ${accion.toLowerCase().replaceAll('_',' ')}`,
          cuerpo: { accion, motivo, devolucion_id: devolucionId ?? null }, tipo_acto: 'COMUNICACION_FINANCIERA' } });
    }
  }
}
