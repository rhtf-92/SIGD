import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

describe('SEC-01 BOLA: Control de Acceso Horizontal y Autorización Real', () => {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const ID_USUARIO_PROPIETARIO = '11111111-1111-4111-8111-111111111111';
  const ID_PERSONA_PROPIETARIO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const ID_USUARIO_AJENO = '22222222-2222-4222-8222-222222222222';
  const ID_PERSONA_AJENO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const ID_EXPEDIENTE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const AREA_DESTINO_ID = '33333333-3333-4333-8333-333333333333';

  const tokenPropietario = firmarTokenAcceso({
    sub: ID_USUARIO_PROPIETARIO,
    roles: ['CIUDADANO'],
  });

  const tokenAjeno = firmarTokenAcceso({
    sub: ID_USUARIO_AJENO,
    roles: ['CIUDADANO'],
  });

  const tokenEstudianteAjeno = firmarTokenAcceso({
    sub: ID_USUARIO_AJENO,
    roles: ['ESTUDIANTE'],
  });

  const tokenOperadorMesaPartes = firmarTokenAcceso({
    sub: '44444444-4444-4444-8444-444444444444',
    roles: ['MESA_PARTES'],
  });

  const tokenDirector = firmarTokenAcceso({
    sub: '55555555-5555-4555-8555-555555555555',
    roles: ['DIRECTOR'],
  });

  const mockPool = {
    query: async (sql: string, params?: unknown[]) => {
      const sqlStr = String(sql);

      // Fecha inicio para cálculo SLA
      if (sqlStr.includes('fecha_radicacion AT TIME ZONE')) {
        return { rows: [{ fecha_inicio: hoy }] };
      }

      // Consulta de usuario / perfil
      if (sqlStr.includes('sigd_auth.cuenta_usuario')) {
        const userId = params?.[0];
        if (userId === ID_USUARIO_PROPIETARIO) {
          return { rows: [{ id_persona: ID_PERSONA_PROPIETARIO, area_id: null }] };
        }
        if (userId === ID_USUARIO_AJENO) {
          return { rows: [{ id_persona: ID_PERSONA_AJENO, area_id: null }] };
        }
        if (userId === '44444444-4444-4444-8444-444444444444') {
          return { rows: [{ id_persona: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', area_id: AREA_DESTINO_ID }] };
        }
        return { rows: [] };
      }

      // Consulta de expediente
      if (sqlStr.includes('sigd_tra.expediente') && sqlStr.includes('WHERE expediente_id = $1')) {
        const expId = params?.[0];
        if (expId === ID_EXPEDIENTE) {
          return {
            rows: [
              {
                solicitante_id: ID_PERSONA_PROPIETARIO,
                area_destino_id: AREA_DESTINO_ID,
                estado: 'REGISTRADO',
              },
            ],
          };
        }
        return { rows: [] };
      }

      // Consulta de movimientos
      if (sqlStr.includes('sigd_rut.movimiento_tramite')) {
        return { rows: [] };
      }

      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => undefined,
    }),
  } as unknown as Pool;

  const app = construirApp(mockPool);

  it('permite acceso al usuario propietario titular del expediente (200 OK)', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/sla-status`)
      .set('Authorization', `Bearer ${tokenPropietario}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('diasHabilesTranscurridos');
  });

  it('deniega acceso con 403 a un usuario ajeno (CIUDADANO no titular)', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/sla-status`)
      .set('Authorization', `Bearer ${tokenAjeno}`);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe(403);
  });

  it('deniega acceso con 403 a un ESTUDIANTE sobre un expediente ajeno', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/sla-status`)
      .set('Authorization', `Bearer ${tokenEstudianteAjeno}`);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe(403);
  });

  it('permite acceso a operador de MESA_PARTES sobre expediente en estado REGISTRADO (200 OK)', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/sla-status`)
      .set('Authorization', `Bearer ${tokenOperadorMesaPartes}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('diasHabilesTranscurridos');
  });

  it('permite acceso institucional a DIRECTOR (200 OK)', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/sla-status`)
      .set('Authorization', `Bearer ${tokenDirector}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('diasHabilesTranscurridos');
  });

  it('responde 401 si se envía un token malformado o inválido', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/sla-status`)
      .set('Authorization', 'Bearer token_invalido_criptograficamente');

    expect(res.status).toBe(401);
  });

  it('responde 401 si no se envía cabecera de autenticación', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/sla-status`);

    expect(res.status).toBe(401);
  });
});
