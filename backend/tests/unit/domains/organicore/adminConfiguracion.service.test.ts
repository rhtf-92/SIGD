import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { crearAdminConfiguracionService } from '../../../../src/domains/organicore/adminConfiguracion.service.js';
import { runWithContext } from '../../../../src/shared/request-context/request-context.js';

describe('AdminConfiguracionService', () => {
  it('persiste calendario y su auditoría en una misma transacción', async () => {
    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        queries.push({ sql, values });
        if (sql.includes('SELECT singleton, hora_inicio')) return { rows: [{ singleton: true, hora_inicio: '08:00', hora_fin: '16:30', hora_corte: '16:30', zona_horaria: 'America/Lima', dias_laborales: [1, 2, 3, 4, 5] }] };
        if (sql.includes('RETURNING singleton')) return { rows: [{ singleton: true, hora_inicio: '08:30', hora_fin: '16:30', hora_corte: '16:30', zona_horaria: 'America/Lima', dias_laborales: [1, 2, 3, 4, 5] }] };
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'audit-1' }] };
        return { rows: [], rowCount: 1 };
      }), release: vi.fn(),
    } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client), query: vi.fn() } as unknown as Pool;
    const service = crearAdminConfiguracionService(pool);
    const result = await runWithContext({ correlation_id: 'corr-1', usuario_id: 'user-1', ip_origen: '127.0.0.1', user_agent: 'test' }, () => service.guardarJornada({ horaInicio: '08:30', horaFin: '16:30', horaCorte: '16:30', zonaHoraria: 'America/Lima', diasLaborales: [1, 2, 3, 4, 5] }, 'user-1'));
    expect(result.jornada.hora_inicio).toBe('08:30');
    expect(queries.map((item) => item.sql.trim()).filter((sql) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql))).toEqual(['BEGIN', 'COMMIT']);
    expect(queries.some(({ sql, values }) => sql.includes('INSERT INTO sigd_audit.bitacora_auditoria') && values?.includes('configuracion_jornada'))).toBe(true);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rechaza intentar desbloquear una cuenta que no existe o no está bloqueada', async () => {
    const client = { query: vi.fn(async () => ({ rows: [] })), release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client), query: vi.fn() } as unknown as Pool;
    await expect(crearAdminConfiguracionService(pool).desbloquearCuenta('account-1', 'justificación suficiente', 'admin-1')).rejects.toMatchObject({ status: 404 });
  });

  it('persiste políticas y deja constancia WORM dentro de la misma transacción', async () => {
    const sqls: string[] = [];
    const client = { query: vi.fn(async (sql: string) => {
      sqls.push(sql);
      if (sql.includes('SELECT max_intentos_fallidos')) return { rows: [{ max_intentos_fallidos: 5, minutos_bloqueo: 30, minutos_sesion: 30 }] };
      if (sql.includes('RETURNING max_intentos_fallidos')) return { rows: [{ max_intentos_fallidos: 6, minutos_bloqueo: 45, minutos_sesion: 60 }] };
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'audit-policy' }] };
      return { rows: [] };
    }), release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client), query: vi.fn() } as unknown as Pool;
    const result = await runWithContext({ correlation_id: 'corr-2', usuario_id: 'admin-1', ip_origen: '127.0.0.1', user_agent: 'test' }, () =>
      crearAdminConfiguracionService(pool).guardarPoliticas({ maxIntentosFallidos: 6, minutosBloqueo: 45, minutosSesion: 60 }, 'admin-1'));
    expect(result.politicas.max_intentos_fallidos).toBe(6);
    expect(sqls).toContain('BEGIN');
    expect(sqls).toContain('COMMIT');
    expect(sqls.some((sql) => sql.includes('INSERT INTO sigd_audit.bitacora_auditoria'))).toBe(true);
  });

  it('desbloquea una cuenta bloqueada y registra la justificación en el asiento WORM', async () => {
    const audits: unknown[][] = [];
    const client = { query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes('SELECT id_usuario, usuario')) return { rows: [{ id_usuario: 'user-1', usuario: 'cuenta', correo: 'c@example.test', intentos_fallidos: 5, bloqueado_hasta: 'infinity' }] };
      if (sql.includes('RETURNING id_usuario, usuario')) return { rows: [{ id_usuario: 'user-1', usuario: 'cuenta', correo: 'c@example.test', intentos_fallidos: 0, bloqueado_hasta: null }] };
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) { audits.push(values ?? []); return { rows: [{ id_auditoria: 'audit-unlock' }] }; }
      return { rows: [] };
    }), release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client), query: vi.fn() } as unknown as Pool;
    const result = await runWithContext({ correlation_id: 'corr-3', usuario_id: 'admin-1', ip_origen: '127.0.0.1', user_agent: 'test' }, () =>
      crearAdminConfiguracionService(pool).desbloquearCuenta('user-1', 'Verificación forense del caso', 'admin-1'));
    expect(result.guardado).toBe(true);
    expect(audits[0]?.[8]).toContain('Verificación forense del caso');
  });
});
