import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

describe('SEC-01 / BOLA & FSM: Control de Acceso, Roles Reales y FSM Canónica en Mutaciones RutaDoc', () => {
  const ID_USUARIO_TITULAR = '11111111-1111-4111-8111-111111111111';
  const ID_PERSONA_TITULAR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const ID_USUARIO_AJENO = '22222222-2222-4222-8222-222222222222';
  const ID_PERSONA_AJENO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const ID_USUARIO_ADMIN = '33333333-3333-4333-8333-333333333333';
  const ID_USUARIO_DIRECTOR = '44444444-4444-4444-8444-444444444444';
  const ID_USUARIO_ESPECIALISTA = '55555555-5555-4555-8555-555555555555';
  const ID_USUARIO_SECRETARIO = '66666666-6666-4666-8666-666666666666';
  const ID_USUARIO_MESA_PARTES = '77777777-7777-4777-8777-777777777777';
  const ID_USUARIO_OPERADOR_OTRA_AREA = '88888888-8888-4888-8888-888888888888';

  const AREA_CUSTODIO_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const AREA_OTRA_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const ID_EXPEDIENTE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  // Tokens de autenticación basados estrictamente en roles reales de sigd_org.rol_sistema
  const tokenTitular = firmarTokenAcceso({ sub: ID_USUARIO_TITULAR, roles: ['CIUDADANO'] });
  const tokenAjeno = firmarTokenAcceso({ sub: ID_USUARIO_AJENO, roles: ['CIUDADANO'] });
  const tokenEstudianteAjeno = firmarTokenAcceso({ sub: ID_USUARIO_AJENO, roles: ['ESTUDIANTE'] });

  const tokenAdministrador = firmarTokenAcceso({ sub: ID_USUARIO_ADMIN, roles: ['ADMINISTRADOR'] });
  const tokenDirector = firmarTokenAcceso({ sub: ID_USUARIO_DIRECTOR, roles: ['DIRECTOR'] });
  const tokenEspecialistaCustodio = firmarTokenAcceso({ sub: ID_USUARIO_ESPECIALISTA, roles: ['ESPECIALISTA'] });
  const tokenSecretarioCustodio = firmarTokenAcceso({ sub: ID_USUARIO_SECRETARIO, roles: ['SECRETARIO'] });
  const tokenMesaPartes = firmarTokenAcceso({ sub: ID_USUARIO_MESA_PARTES, roles: ['MESA_PARTES'] });
  const tokenOperadorOtraArea = firmarTokenAcceso({ sub: ID_USUARIO_OPERADOR_OTRA_AREA, roles: ['ESPECIALISTA'] });

  let estadoExpediente = 'EN_CALIFICACION';
  const tracker = {
    mutaciones: 0,
    movimientos: 0,
    outbox: 0,
    beginCount: 0,
  };

  beforeEach(() => {
    estadoExpediente = 'EN_CALIFICACION';
    tracker.mutaciones = 0;
    tracker.movimientos = 0;
    tracker.outbox = 0;
    tracker.beginCount = 0;
  });

  const mockPool = {
    query: async (sql: string, params?: unknown[]) => {
      const sqlStr = String(sql);

      // Consulta de cuenta_usuario / persona / perfil
      if (sqlStr.includes('sigd_auth.cuenta_usuario')) {
        const userId = params?.[0];
        if (userId === ID_USUARIO_TITULAR) {
          return { rows: [{ id_persona: ID_PERSONA_TITULAR, area_id: null }] };
        }
        if (userId === ID_USUARIO_AJENO) {
          return { rows: [{ id_persona: ID_PERSONA_AJENO, area_id: null }] };
        }
        if (userId === ID_USUARIO_ADMIN) {
          return { rows: [{ id_persona: 'admin-persona', area_id: null }] };
        }
        if (userId === ID_USUARIO_DIRECTOR) {
          return { rows: [{ id_persona: 'dir-persona', area_id: 'dir-area' }] };
        }
        if (userId === ID_USUARIO_ESPECIALISTA) {
          return { rows: [{ id_persona: 'esp-persona', area_id: AREA_CUSTODIO_ID }] };
        }
        if (userId === ID_USUARIO_SECRETARIO) {
          return { rows: [{ id_persona: 'sec-persona', area_id: AREA_CUSTODIO_ID }] };
        }
        if (userId === ID_USUARIO_MESA_PARTES) {
          return { rows: [{ id_persona: 'mpv-persona', area_id: AREA_CUSTODIO_ID }] };
        }
        if (userId === ID_USUARIO_OPERADOR_OTRA_AREA) {
          return { rows: [{ id_persona: 'otra-persona', area_id: AREA_OTRA_ID }] };
        }
        return { rows: [] };
      }

      // Consulta de contexto de expediente
      if (sqlStr.includes('sigd_tra.expediente') && sqlStr.includes('WHERE e.expediente_id = $1::uuid')) {
        const expId = params?.[0];
        if (expId === ID_EXPEDIENTE) {
          return {
            rows: [{
              expediente_id: ID_EXPEDIENTE,
              solicitante_id: ID_PERSONA_TITULAR,
              estado_actual_id: estadoExpediente,
              area_contexto_id: AREA_CUSTODIO_ID,
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // Consulta simple de expediente para actor-provider puedeVerExpediente
      if (sqlStr.includes('sigd_tra.expediente') && sqlStr.includes('WHERE expediente_id = $1')) {
        const expId = params?.[0];
        if (expId === ID_EXPEDIENTE) {
          return {
            rows: [{
              solicitante_id: ID_PERSONA_TITULAR,
              area_destino_id: AREA_CUSTODIO_ID,
              estado: estadoExpediente,
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // Consulta de movimientos
      if (sqlStr.includes('sigd_rut.movimiento_tramite')) {
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async (sql: string) => {
        const sqlStr = String(sql);

        if (sqlStr.includes('BEGIN')) {
          tracker.beginCount++;
          return {};
        }
        if (sqlStr.includes('COMMIT') || sqlStr.includes('ROLLBACK')) {
          return {};
        }

        // Consultas de estado dentro del servicio
        if (sqlStr.includes('sigd_tra.expediente') && sqlStr.includes('LEFT JOIN sigd_rut.estado_actual_expediente')) {
          return {
            rows: [{
              estado_actual_id: estadoExpediente,
              area_contexto_id: AREA_CUSTODIO_ID,
            }],
            rowCount: 1,
          };
        }

        // Inserción de movimientos
        if (sqlStr.includes('INSERT INTO sigd_rut.movimiento_tramite')) {
          tracker.movimientos++;
          return { rows: [{ movimiento_id: 'mov-mock-uuid' }], rowCount: 1 };
        }

        // Actualización de estado en expediente
        if (sqlStr.includes('UPDATE sigd_tra.expediente')) {
          tracker.mutaciones++;
          return { rowCount: 1 };
        }

        // Inserción de evento outbox
        if (sqlStr.includes('INSERT INTO sigd_audit.evento_outbox')) {
          tracker.outbox++;
          return { rows: [{ id_evento: 'evt-mock-id' }], rowCount: 1 };
        }

        return { rows: [], rowCount: 0 };
      },
      release: () => undefined,
    }),
  } as unknown as Pool;

  const app = construirApp(mockPool);

  describe('1. BOLA Y AUTORIZACIÓN EN OBSERVAR EXPEDIENTE', () => {
    it('deniega con 403 a un CIUDADANO TITULAR (los administrados no observan)', async () => {
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
        .set('Authorization', `Bearer ${tokenTitular}`)
        .send({ motivo: 'Observación no permitida' });

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('administrados');
      expect(tracker.beginCount).toBe(0);
      expect(tracker.mutaciones).toBe(0);
    });

    it('deniega con 403 a un CIUDADANO AJENO (ataque BOLA)', async () => {
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
        .set('Authorization', `Bearer ${tokenAjeno}`)
        .send({ motivo: 'Ataque BOLA observacion' });

      expect(res.status).toBe(403);
      expect(tracker.beginCount).toBe(0);
      expect(tracker.mutaciones).toBe(0);
    });

    it('deniega con 403 a un ESTUDIANTE AJENO (ataque BOLA)', async () => {
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
        .set('Authorization', `Bearer ${tokenEstudianteAjeno}`)
        .send({ motivo: 'Ataque BOLA estudiante' });

      expect(res.status).toBe(403);
      expect(tracker.beginCount).toBe(0);
      expect(tracker.mutaciones).toBe(0);
    });

    it('deniega con 403 a un ESPECIALISTA de otra área sin custodia activa', async () => {
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
        .set('Authorization', `Bearer ${tokenOperadorOtraArea}`)
        .send({ motivo: 'Observación sin custodia' });

      expect(res.status).toBe(403);
      expect(tracker.beginCount).toBe(0);
    });
  });

  describe('2. ROLES REALES AUTORIZADOS EN OBSERVAR EXPEDIENTE', () => {
    it('permite con 200 OK al rol real ADMINISTRADOR institucional', async () => {
      estadoExpediente = 'EN_CALIFICACION';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
        .set('Authorization', `Bearer ${tokenAdministrador}`)
        .send({ motivo: 'Observación institucional por administrador' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.estado).toBe('OBSERVADO');
      expect(tracker.beginCount).toBe(1);
    });

    it('permite con 200 OK al rol real DIRECTOR institucional', async () => {
      estadoExpediente = 'EN_CALIFICACION';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
        .set('Authorization', `Bearer ${tokenDirector}`)
        .send({ motivo: 'Observación dictada por dirección' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.estado).toBe('OBSERVADO');
    });

    it('permite con 200 OK a ESPECIALISTA custodio de la unidad orgánica', async () => {
      estadoExpediente = 'EN_REVISION';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
        .set('Authorization', `Bearer ${tokenEspecialistaCustodio}`)
        .send({ motivo: 'Observación técnica por especialista' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.estado).toBe('OBSERVADO');
    });

    it('permite con 200 OK a SECRETARIO custodio de la unidad orgánica', async () => {
      estadoExpediente = 'EN_REVISION';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
        .set('Authorization', `Bearer ${tokenSecretarioCustodio}`)
        .send({ motivo: 'Observación formal por secretaría académica' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.estado).toBe('OBSERVADO');
    });

    it('permite con 200 OK a MESA_PARTES en fase inicial EN_CALIFICACION', async () => {
      estadoExpediente = 'EN_CALIFICACION';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
        .set('Authorization', `Bearer ${tokenMesaPartes}`)
        .send({ motivo: 'Observación en ventanilla de mesa de partes' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.estado).toBe('OBSERVADO');
    });
  });

  describe('3. FSM CANÓNICA PARA OBSERVAR (SOLO EN_CALIFICACION Y EN_REVISION)', () => {
    it('permite observar en estado canónico EN_CALIFICACION', async () => {
      estadoExpediente = 'EN_CALIFICACION';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
        .set('Authorization', `Bearer ${tokenDirector}`)
        .send({ motivo: 'Observación en calificación' });

      expect(res.status).toBe(200);
    });

    it('permite observar en estado canónico EN_REVISION', async () => {
      estadoExpediente = 'EN_REVISION';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
        .set('Authorization', `Bearer ${tokenDirector}`)
        .send({ motivo: 'Observación en revisión' });

      expect(res.status).toBe(200);
    });

    const estadosNoPermitidos = [
      'REGISTRADO',
      'RECEPCIONADO',
      'DERIVADO',
      'OBSERVADO',
      'SUBSANADO',
      'EN_FIRMA',
      'RESUELTO',
      'ARCHIVADO',
    ];

    estadosNoPermitidos.forEach((estadoInvalido) => {
      it(`rechaza con 422 (ESTADO_INVALIDO) intento de observar desde ${estadoInvalido}`, async () => {
        estadoExpediente = estadoInvalido;
        const res = await request(app)
          .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
          .set('Authorization', `Bearer ${tokenDirector}`)
          .send({ motivo: `Intento de observar desde ${estadoInvalido}` });

        expect(res.status).toBe(422);
        expect(res.body.code).toBe('ESTADO_INVALIDO');
        expect(tracker.beginCount).toBe(0);
        expect(tracker.mutaciones).toBe(0);
      });
    });
  });

  describe('4. BOLA, ROLES Y FSM CANÓNICA EN SUBSANAR EXPEDIENTE', () => {
    it('permite con 200 OK al CIUDADANO TITULAR cuando está OBSERVADO y devuelve EN_REVISION', async () => {
      estadoExpediente = 'OBSERVADO';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/subsanar`)
        .set('Authorization', `Bearer ${tokenTitular}`)
        .send({ motivo: 'Subsanación de requisitos por el titular' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.estado).toBe('EN_REVISION');
      expect(res.body.estadoRutaDoc).toBe('EN_REVISION');
      expect(res.body.pestana).toBe('EN_TRAMITE');
      expect(tracker.beginCount).toBe(1);
      expect(tracker.mutaciones).toBe(1);
    });

    it('deniega con 403 a un CIUDADANO AJENO (ataque BOLA en subsanar)', async () => {
      estadoExpediente = 'OBSERVADO';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/subsanar`)
        .set('Authorization', `Bearer ${tokenAjeno}`)
        .send({ motivo: 'Ataque BOLA subsanacion' });

      expect(res.status).toBe(403);
      expect(tracker.beginCount).toBe(0);
      expect(tracker.mutaciones).toBe(0);
    });

    it('deniega con 403 a un ESTUDIANTE AJENO (ataque BOLA en subsanar)', async () => {
      estadoExpediente = 'OBSERVADO';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/subsanar`)
        .set('Authorization', `Bearer ${tokenEstudianteAjeno}`)
        .send({ motivo: 'Ataque BOLA subsanacion estudiante' });

      expect(res.status).toBe(403);
      expect(tracker.beginCount).toBe(0);
    });

    it('deniega con 403 a un OPERADOR ajeno sin rol institucional de ventanilla', async () => {
      estadoExpediente = 'OBSERVADO';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/subsanar`)
        .set('Authorization', `Bearer ${tokenOperadorOtraArea}`)
        .send({ motivo: 'Subsanación no autorizada' });

      expect(res.status).toBe(403);
      expect(tracker.beginCount).toBe(0);
    });

    it('permite con 200 OK al rol ADMINISTRADOR institucional para ventanilla presencial', async () => {
      estadoExpediente = 'OBSERVADO';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/subsanar`)
        .set('Authorization', `Bearer ${tokenAdministrador}`)
        .send({ motivo: 'Recepción presencial de subsanación' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.estado).toBe('EN_REVISION');
    });

    it('permite con 200 OK a MESA_PARTES para ventanilla presencial', async () => {
      estadoExpediente = 'OBSERVADO';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/subsanar`)
        .set('Authorization', `Bearer ${tokenMesaPartes}`)
        .send({ motivo: 'Recepción en mesa de partes' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.estado).toBe('EN_REVISION');
    });

    it('rechaza con 422 (ESTADO_INVALIDO) si el expediente no está en estado OBSERVADO', async () => {
      estadoExpediente = 'EN_CALIFICACION';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/subsanar`)
        .set('Authorization', `Bearer ${tokenTitular}`)
        .send({ motivo: 'Intento de subsanación prematura' });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('ESTADO_INVALIDO');
      expect(tracker.beginCount).toBe(0);
    });

    it('responde 401 si no se envía cabecera de autenticación', async () => {
      estadoExpediente = 'OBSERVADO';
      const res = await request(app)
        .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/subsanar`)
        .send({ motivo: 'Sin autenticación' });

      expect(res.status).toBe(401);
      expect(tracker.beginCount).toBe(0);
    });
  });
});
