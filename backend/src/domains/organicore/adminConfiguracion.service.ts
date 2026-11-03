import type { Pool, PoolClient } from 'pg';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { ConflictError, NotFoundError } from '../../shared/domain/errors/index.js';

export interface JornadaInput {
  horaInicio: string;
  horaFin: string;
  horaCorte: '16:30';
  zonaHoraria: string;
  diasLaborales: number[];
}
export interface PoliticasInput { maxIntentosFallidos: number; minutosBloqueo: number; minutosSesion: number }
type Row = Record<string, unknown>;

async function cerrar(client: PoolClient, ok: boolean): Promise<void> {
  await client.query(ok ? 'COMMIT' : 'ROLLBACK');
}

export function crearAdminConfiguracionService(pool: Pool) {
  async function obtenerJornada(): Promise<Row> {
    const { rows } = await pool.query<Row>(`SELECT singleton, to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
      to_char(hora_fin, 'HH24:MI') AS hora_fin, to_char(hora_corte, 'HH24:MI') AS hora_corte,
      zona_horaria, dias_laborales, actualizado_en FROM sigd_org.configuracion_jornada WHERE singleton = TRUE`);
    return rows[0] ?? {};
  }

  async function guardarJornada(input: JornadaInput, usuarioId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = (await client.query<Row>(`SELECT singleton, to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
        to_char(hora_fin, 'HH24:MI') AS hora_fin, to_char(hora_corte, 'HH24:MI') AS hora_corte,
        zona_horaria, dias_laborales FROM sigd_org.configuracion_jornada WHERE singleton = TRUE FOR UPDATE`)).rows[0] ?? null;
      const updated = await client.query<Row>(`UPDATE sigd_org.configuracion_jornada SET hora_inicio=$1::time,
        hora_fin=$2::time, hora_corte=$3::time, zona_horaria=$4, dias_laborales=$5::smallint[],
        actualizado_por=$6, actualizado_en=now() WHERE singleton=TRUE
        RETURNING singleton, to_char(hora_inicio,'HH24:MI') AS hora_inicio, to_char(hora_fin,'HH24:MI') AS hora_fin,
        to_char(hora_corte,'HH24:MI') AS hora_corte, zona_horaria, dias_laborales, actualizado_en`,
      [input.horaInicio, input.horaFin, input.horaCorte, input.zonaHoraria, input.diasLaborales, usuarioId]);
      const after = updated.rows[0];
      if (!after) throw new NotFoundError({ message: 'No existe la configuración de jornada.' });
      await registrarMutacion(client, { esquema: 'sigd_org', tabla: 'configuracion_jornada', operacion: 'UPDATE', datos_antes: before, datos_despues: { ...after, actualizado_por: usuarioId } });
      await cerrar(client, true);
      return { jornada: after };
    } catch (error) { await cerrar(client, false).catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  async function obtenerPoliticas(): Promise<Row> {
    const { rows } = await pool.query<Row>(`SELECT max_intentos_fallidos, minutos_bloqueo, minutos_sesion, actualizado_en
      FROM sigd_org.politicas_seguridad WHERE singleton=TRUE`);
    return rows[0] ?? {};
  }

  async function guardarPoliticas(input: PoliticasInput, usuarioId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = (await client.query<Row>(`SELECT max_intentos_fallidos, minutos_bloqueo, minutos_sesion
        FROM sigd_org.politicas_seguridad WHERE singleton=TRUE FOR UPDATE`)).rows[0] ?? null;
      const updated = await client.query<Row>(`UPDATE sigd_org.politicas_seguridad SET max_intentos_fallidos=$1,
        minutos_bloqueo=$2, minutos_sesion=$3, actualizado_por=$4, actualizado_en=now() WHERE singleton=TRUE
        RETURNING max_intentos_fallidos, minutos_bloqueo, minutos_sesion, actualizado_en`,
      [input.maxIntentosFallidos, input.minutosBloqueo, input.minutosSesion, usuarioId]);
      const after = updated.rows[0];
      if (!after) throw new NotFoundError({ message: 'No existen las políticas de seguridad.' });
      await registrarMutacion(client, { esquema: 'sigd_org', tabla: 'politicas_seguridad', operacion: 'UPDATE', datos_antes: before, datos_despues: { ...after, actualizado_por: usuarioId } });
      await cerrar(client, true);
      return { politicas: after };
    } catch (error) { await cerrar(client, false).catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  async function listarIntentos(limite: number, offset: number) {
    const { rows } = await pool.query<Row>(`SELECT id_auditoria, correlation_id, usuario_id, ip_origen,
      datos_despues, fecha_hora, count(*) OVER()::int AS total FROM sigd_audit.bitacora_auditoria
      WHERE esquema='sigd_auth' AND tabla='intento_acceso' ORDER BY fecha_hora DESC LIMIT $1 OFFSET $2`, [limite, offset]);
    return { total: Number(rows[0]?.total ?? 0), intentos: rows.map(({ total: _total, ...row }) => row) };
  }

  async function listarCuentasBloqueadas() {
    const { rows } = await pool.query<Row>(`SELECT c.id_usuario, c.usuario, c.correo,
      COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo,
      c.bloqueado_hasta, c.intentos_fallidos FROM sigd_auth.cuenta_usuario c
      LEFT JOIN sigd_auth.persona_natural pn USING (id_persona)
      LEFT JOIN sigd_auth.persona_juridica pj USING (id_persona)
      WHERE c.activo=TRUE AND c.bloqueado_hasta > now() ORDER BY c.bloqueado_hasta DESC`);
    return { cuentas: rows };
  }

  async function desbloquearCuenta(id: string, justificacion: string, usuarioId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = (await client.query<Row>(`SELECT id_usuario, usuario, correo, intentos_fallidos, bloqueado_hasta
        FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1 FOR UPDATE`, [id])).rows[0];
      if (!before) throw new NotFoundError({ message: 'No existe la cuenta indicada.' });
      const hasta = before.bloqueado_hasta;
      if (!hasta || (hasta !== 'infinity' && new Date(String(hasta)).getTime() <= Date.now())) {
        throw new ConflictError({ code: 'CUENTA_NO_BLOQUEADA', message: 'La cuenta ya no está bloqueada.' });
      }
      const updated = await client.query<Row>(`UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos=0,
        bloqueado_hasta=NULL WHERE id_usuario=$1 RETURNING id_usuario, usuario, correo, intentos_fallidos, bloqueado_hasta`, [id]);
      const after = updated.rows[0];
      await registrarMutacion(client, { esquema: 'sigd_auth', tabla: 'cuenta_usuario', operacion: 'UPDATE', datos_antes: before,
        datos_despues: { ...after, desbloqueo_justificacion: justificacion, desbloqueado_por: usuarioId } });
      await cerrar(client, true);
      return { cuenta: after, guardado: true };
    } catch (error) { await cerrar(client, false).catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  return { obtenerJornada, guardarJornada, obtenerPoliticas, guardarPoliticas, listarIntentos, listarCuentasBloqueadas, desbloquearCuenta };
}
