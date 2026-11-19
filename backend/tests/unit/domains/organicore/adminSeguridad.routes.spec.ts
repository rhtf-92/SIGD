import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

const ADMIN = firmarTokenAcceso({ sub: '11111111-1111-1111-1111-111111111111', roles: ['SUPER_ADMIN'], rolesAutorizados: ['SUPER_ADMIN'] });
const STUDENT = firmarTokenAcceso({ sub: '22222222-2222-2222-2222-222222222222', roles: ['ESTUDIANTE'], rolesAutorizados: ['ESTUDIANTE'] });
const DIRECTOR_ID = '33333333-3333-4333-8333-333333333333';
const DIRECTOR = firmarTokenAcceso({
  sub: DIRECTOR_ID,
  sid: 'director-session-refresh-token',
  roles: ['DIRECTOR'],
  rolesAutorizados: ['DIRECTOR'],
  rolActivo: 'DIRECTOR',
});
const SUPER_ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const SUPER_ADMIN_WITH_SESSION = firmarTokenAcceso({
  sub: SUPER_ADMIN_ID,
  sid: 'superadmin-session-refresh-token',
  roles: ['SUPER_ADMIN'],
  rolesAutorizados: ['SUPER_ADMIN'],
  rolActivo: 'SUPER_ADMIN',
});

function appFixture() {
  const clientQuery = vi.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes('SELECT rol_id, codigo FROM sigd_org.rol_sistema')) {
      return { rows: [{ rol_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', codigo: 'DIRECTOR' }] };
    }
    if (sql.includes('SELECT permiso_id, codigo FROM sigd_org.permiso_sistema')) {
      return { rows: [{ permiso_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', codigo: 'admin:acceso' }] };
    }
    return { rows: [] };
  });
  const connect = vi.fn(async () => ({ query: clientQuery, release: vi.fn() }));
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes('SELECT DISTINCT ps.codigo AS permiso_codigo')) {
      const roles = Array.isArray(_params?.[1])
        ? _params[1] as string[]
        : typeof _params?.[1] === 'string' ? [_params[1]] : [];
      const esAdmin = roles.includes('SUPER_ADMIN') || roles.includes('ADMINISTRADOR');
      const permisos = esAdmin
        ? ['admin:acceso', 'usuarios:leer', 'usuarios:gestionar', 'auditoria:leer', 'calendario:leer', 'calendario:gestionar']
        : roles.includes('DIRECTOR') ? ['admin:acceso', 'organigrama:leer', 'calendario:leer'] : [];
      return { rows: permisos.map((permiso_codigo) => ({ permiso_codigo })) };
    }
    if (sql.includes('FROM sigd_auth.sesion_usuario s')) return { rows: [{ id_usuario: String(_params?.[1]), activo: true, revocado_en: null, expira_en: new Date(Date.now() + 60_000) }] };
    if (sql.includes('FROM sigd_org.usuario_rol ur') && sql.includes('ps.codigo AS permiso_codigo')) {
      const esDirector = _params?.[0] === DIRECTOR_ID;
      return { rows: [{ rol_codigo: esDirector ? 'DIRECTOR' : 'ADMINISTRADOR', permiso_codigo: 'admin:acceso' }] };
    }
    if (sql.includes('FROM sigd_auth.cuenta_usuario c LEFT JOIN sigd_auth.perfil_usuario')) {
      return { rows: [{ id_usuario: String(_params?.[0]), id_persona: null, area_id: null }] };
    }
    if (sql.includes('FROM sigd_org.politicas_seguridad')) return { rows: [{ max_intentos_fallidos: 5, minutos_bloqueo: 30, minutos_sesion: 30 }] };
    if (sql.includes('FROM sigd_org.configuracion_jornada')) return { rows: [{ hora_inicio: '08:00', hora_fin: '16:30', hora_corte: '16:30', zona_horaria: 'America/Lima', dias_laborales: [1, 2, 3, 4, 5] }] };
    return { rows: [] };
  });
  const pool = { query, connect } as unknown as Pool;
  return { app: construirApp(pool), query, connect, clientQuery };
}

describe('rutas de seguridad y calendario administrativo', () => {
  it('sirve políticas de seguridad a Super Admin autenticado', async () => {
    const { app } = appFixture();
    const response = await request(app).get('/api/v1/admin/seguridad/politicas').set('Authorization', `Bearer ${ADMIN}`);
    expect(response.status).toBe(200);
    expect(response.body.politicas).toMatchObject({ max_intentos_fallidos: 5, minutos_bloqueo: 30, minutos_sesion: 30 });
  });

  it('deniega a un rol sin permiso antes de leer la política', async () => {
    const { app, query } = appFixture();
    const response = await request(app).get('/api/v1/admin/seguridad/politicas').set('Authorization', `Bearer ${STUDENT}`);
    expect(response.status).toBe(403);
    expect(query.mock.calls.filter(([sql]) => sql.includes('SELECT DISTINCT ps.codigo AS permiso_codigo'))).toHaveLength(1);
    expect(query.mock.calls.filter(([sql]) => sql.includes('FROM sigd_org.configuracion_jornada'))).toHaveLength(0);
  });

  it('no permite que DIRECTOR cambie políticas aunque tenga admin:acceso', async () => {
    const { app, query } = appFixture();
    const response = await request(app)
      .put('/api/v1/admin/seguridad/politicas')
      .set('Authorization', `Bearer ${DIRECTOR}`)
      .send({ maxIntentosFallidos: 6, minutosBloqueo: 20, minutosSesion: 30 });
    expect(response.status).toBe(403);
    expect(query.mock.calls.some(([sql]) => /UPDATE|INSERT INTO/.test(sql))).toBe(false);
  });

  it('deniega a DIRECTOR la edición de roles aunque tenga admin:acceso', async () => {
    const { app, clientQuery } = appFixture();
    const response = await request(app)
      .put('/api/v1/admin/roles/DIRECTOR/permisos')
      .set('Authorization', `Bearer ${DIRECTOR}`)
      .send({ permisos: ['admin:acceso'] });
    expect(response.status).toBe(403);
    expect(clientQuery.mock.calls.some(([sql]) => /^(BEGIN|COMMIT|DELETE|INSERT)/.test(String(sql)))).toBe(false);
  });

  it('permite que SUPER_ADMIN guarde una matriz con códigos existentes', async () => {
    const { app, clientQuery } = appFixture();
    const response = await request(app)
      .put('/api/v1/admin/roles/DIRECTOR/permisos')
      .set('Authorization', `Bearer ${SUPER_ADMIN_WITH_SESSION}`)
      .send({ permisos: ['admin:acceso'] });
    expect(response.status).toBe(200);
    expect(response.body.rolesActualizados).toEqual(['DIRECTOR']);
    expect(clientQuery.mock.calls.some(([sql]) => sql === 'DELETE FROM sigd_org.rol_permiso WHERE rol_id = ANY($1::uuid[])')).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith('INSERT INTO sigd_org.rol_permiso'))).toBe(true);
  });

  it('lee configuración de jornada por endpoint autenticado y devuelve el corte vigente', async () => {
    const { app } = appFixture();
    const response = await request(app).get('/api/v1/admin/calendario-laboral/configuracion').set('Authorization', `Bearer ${ADMIN}`);
    expect(response.status).toBe(200);
    expect(response.body.jornada).toMatchObject({ hora_inicio: '08:00', hora_corte: '16:30', dias_laborales: [1, 2, 3, 4, 5] });
  });

  it('auditoría aplica filtros y retorna el total de filas sin perder el detalle WORM', async () => {
    const { app, query } = appFixture();
    const response = await request(app).get('/api/v1/admin/auditoria/bitacora?limite=5&offset=10&esquema=sigd_auth&resultado=DENEGADO&q=persona')
      .set('Authorization', `Bearer ${ADMIN}`);
    expect(response.status).toBe(200);
    const call = query.mock.calls.find(([sql]) => sql.includes('SELECT id_auditoria') && sql.includes('FROM sigd_audit.bitacora_auditoria'));
    expect(call?.[0]).toContain('fecha_hora AS creado_en');
    expect(call?.[0]).toContain('count(*) OVER()');
    expect(call?.[0]).toContain("datos_despues->>'evento' IN ('FALLIDO','BLOQUEADO')");
    expect(call?.[1]).toEqual(expect.arrayContaining([5, 10, 'sigd_auth', '%persona%']));
  });

  it('valida en servidor el rango de jornada y mantiene fijo el corte de 16:30', async () => {
    const { app, query } = appFixture();
    const response = await request(app).put('/api/v1/admin/calendario-laboral/configuracion')
      .set('Authorization', `Bearer ${ADMIN}`)
      .send({ horaInicio: '09:00', horaFin: '08:00', horaCorte: '16:00', zonaHoraria: 'America/Lima', diasLaborales: [1, 2] });
    expect(response.status).toBe(400);
    expect(query.mock.calls.filter(([sql]) => sql.includes('SELECT DISTINCT ps.codigo AS permiso_codigo'))).toHaveLength(2);
    expect(query.mock.calls.filter(([sql]) => sql.includes('UPDATE sigd_org.cuenta_usuario'))).toHaveLength(0);
  });

  it('exige justificación forense de al menos diez caracteres para desbloquear', async () => {
    const { app, query } = appFixture();
    const response = await request(app).post('/api/v1/admin/seguridad/cuentas/11111111-1111-1111-1111-111111111111/desbloquear')
      .set('Authorization', `Bearer ${ADMIN}`).send({ justificacion: 'corta' });
    expect(response.status).toBe(400);
    expect(query.mock.calls.filter(([sql]) => sql.includes('SELECT DISTINCT ps.codigo AS permiso_codigo'))).toHaveLength(2);
    expect(query.mock.calls.filter(([sql]) => sql.includes('UPDATE sigd_auth.cuenta_usuario'))).toHaveLength(0);
  });
});
