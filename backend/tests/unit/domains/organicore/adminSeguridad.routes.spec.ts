import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

const ADMIN = firmarTokenAcceso({ sub: '11111111-1111-1111-1111-111111111111', roles: ['SUPER_ADMIN'], rolesAutorizados: ['SUPER_ADMIN'] });
const STUDENT = firmarTokenAcceso({ sub: '22222222-2222-2222-2222-222222222222', roles: ['ESTUDIANTE'], rolesAutorizados: ['ESTUDIANTE'] });

function appFixture() {
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes('SELECT DISTINCT ps.codigo AS permiso_codigo')) {
      const roles = Array.isArray(_params?.[1]) ? _params[1] as string[] : [];
      const esAdmin = roles.includes('SUPER_ADMIN') || roles.includes('ADMINISTRADOR');
      return { rows: esAdmin ? [
        'admin:acceso', 'usuarios:leer', 'usuarios:gestionar', 'auditoria:leer', 'calendario:leer', 'calendario:gestionar',
      ].map((permiso_codigo) => ({ permiso_codigo })) : [] };
    }
    if (sql.includes('FROM sigd_org.politicas_seguridad')) return { rows: [{ max_intentos_fallidos: 5, minutos_bloqueo: 30, minutos_sesion: 30 }] };
    if (sql.includes('FROM sigd_org.configuracion_jornada')) return { rows: [{ hora_inicio: '08:00', hora_fin: '16:30', hora_corte: '16:30', zona_horaria: 'America/Lima', dias_laborales: [1, 2, 3, 4, 5] }] };
    return { rows: [] };
  });
  const pool = { query, connect: vi.fn() } as unknown as Pool;
  return { app: construirApp(pool), query };
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
