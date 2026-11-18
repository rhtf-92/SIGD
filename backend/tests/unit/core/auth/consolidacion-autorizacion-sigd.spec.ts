import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Pool, PoolClient } from 'pg';
import { crearRouterDerivaciones } from '../../../../src/domains/rutadoc/derivaciones.controller.js';
import { crearRouterTesoreria } from '../../../../src/domains/tesoreria/tesoreria.router.js';
import { crearUsuariosAdminRouter } from '../../../../src/domains/organicore/usuariosAdmin.routes.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import { getRequestContext } from '../../../../src/shared/request-context/request-context.js';
import { insertarEvento } from '../../../../src/audit/evento-outbox.repository.js';

vi.mock('../../../../src/shared/request-context/request-context.js', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({
  insertarEvento: vi.fn(),
}));

describe('CONSOLIDACIÓN 100% AUTORIZACIÓN FUNCIONAL SIGD — PRUEBAS NEGATIVAS Y BYPASS', () => {
  const SECRET_KEY = 'test_secret_key_with_at_least_32_characters_long_for_security';
  process.env.AUTH_JWT_SECRET = SECRET_KEY;

  const ID_EXPEDIENTE = '11111111-1111-4111-8111-111111111111';
  const ID_ORDEN_PAGO = '22222222-2222-4222-8222-222222222222';
  const ID_AREA_SDA = 'a0000000-0000-4000-8000-000000000001';
  const ID_AREA_DIR = 'a0000000-0000-4000-8000-000000000002';
  const ID_AREA_OTRA = '99999999-9999-4999-8999-999999999999';

  const ID_CIUDADANO = 'c1111111-1111-4111-8111-111111111111';
  const ID_MESA_PARTES = 'm2222222-2222-4222-8222-222222222222';
  const ID_TESORERIA = 't3333333-3333-4333-8333-333333333333';
  const ID_SECRETARIO_SDA = 's4444444-4444-4444-8444-444444444444';
  const ID_SECRETARIO_OTRO = 's5555555-5555-4555-8555-555555555555';
  const ID_ESPECIALISTA_1 = 'e6666666-6666-4666-8666-666666666666';
  const ID_ESPECIALISTA_2 = 'e7777777-7777-4777-8777-777777777777';
  const ID_DIRECTOR = 'd8888888-8888-4888-8888-888888888888';
  const ID_ADMIN = 'a9999999-9999-4999-8999-999999999999';
  const ID_SUPERADMIN = 'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const tokenCiudadano = firmarTokenAcceso({ sub: ID_CIUDADANO, roles: ['CIUDADANO'], secreto: SECRET_KEY });
  const tokenMesaPartes = firmarTokenAcceso({ sub: ID_MESA_PARTES, roles: ['MESA_PARTES'], secreto: SECRET_KEY });
  const tokenTesoreria = firmarTokenAcceso({ sub: ID_TESORERIA, roles: ['TESORERIA'], secreto: SECRET_KEY });
  const tokenSecretarioSda = firmarTokenAcceso({ sub: ID_SECRETARIO_SDA, roles: ['SECRETARIO'], secreto: SECRET_KEY });
  const tokenSecretarioOtro = firmarTokenAcceso({ sub: ID_SECRETARIO_OTRO, roles: ['SECRETARIO'], secreto: SECRET_KEY });
  const tokenEspecialista1 = firmarTokenAcceso({ sub: ID_ESPECIALISTA_1, roles: ['ESPECIALISTA'], secreto: SECRET_KEY });
  const tokenEspecialista2 = firmarTokenAcceso({ sub: ID_ESPECIALISTA_2, roles: ['ESPECIALISTA'], secreto: SECRET_KEY });
  const tokenDirector = firmarTokenAcceso({ sub: ID_DIRECTOR, roles: ['DIRECTOR'], secreto: SECRET_KEY });
  const tokenAdmin = firmarTokenAcceso({ sub: ID_ADMIN, roles: ['ADMINISTRADOR'], secreto: SECRET_KEY });
  const tokenSuperAdmin = firmarTokenAcceso({ sub: ID_SUPERADMIN, roles: ['SUPERADMINISTRADOR'], secreto: SECRET_KEY });

  let mockQuery: ReturnType<typeof vi.fn>;
  let mockClient: PoolClient;
  let mockPool: Pool;
  let app: express.Express;
  let estadoExpedienteSimulado = 'EN_REVISION';
  let asignacionEspecialistaSimulada = ID_ESPECIALISTA_1;

  beforeEach(() => {
    estadoExpedienteSimulado = 'EN_REVISION';
    asignacionEspecialistaSimulada = ID_ESPECIALISTA_1;

    mockQuery = vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
      const sqlStr = String(sql);

      // Lock de transacción
      if (sqlStr.includes('pg_advisory_xact_lock')) {
        return { rows: [], rowCount: 1 };
      }

      // Validación de unicidad de usuario/correo
      if (sqlStr.includes('WHERE usuario = $1 OR correo = $2')) {
        return { rows: [], rowCount: 0 };
      }

      // Resolución de cuenta o persona
      if (sqlStr.includes('sigd_auth.cuenta_usuario') && sqlStr.includes('SELECT')) {
        return { rows: [{ id_persona: 'pers-default-uuid', activo: true, id_usuario: params?.[0] || 'usr-default' }], rowCount: 1 };
      }

      // Asignación activa de especialista (debe ir antes de sigd_org.area porque hace JOIN)
      if (sqlStr.includes('sigd_rut.expediente_asignacion')) {
        return {
          rows: [{
            id_asignacion: 'asig-1',
            expediente_id: ID_EXPEDIENTE,
            id_persona: 'pers-esp-1',
            id_usuario: asignacionEspecialistaSimulada,
            id_area: ID_AREA_SDA,
            asignado_por: ID_SECRETARIO_SDA,
            asignado_en: new Date(),
            motivo: 'Evaluación técnica',
            activo: true,
            area_nombre: 'Subdirección Académica',
          }],
          rowCount: 1,
        };
      }

      // Consulta de rol sistema
      if (sqlStr.includes('sigd_org.rol_sistema')) {
        const codigo = params?.[0] || 'CIUDADANO';
        return { rows: [{ rol_id: 'rol-uuid-mock', codigo }], rowCount: 1 };
      }

      // Consulta de estado de expediente (debe ir antes de sigd_org.area porque la subquery tiene sigd_org.area)
      if (sqlStr.includes('sigd_tra.expediente') && sqlStr.includes('SELECT')) {
        return {
          rows: [{
            expediente_id: ID_EXPEDIENTE,
            solicitante_id: 'sol-externo-uuid',
            estado_actual_id: estadoExpedienteSimulado,
            estado: estadoExpedienteSimulado,
            area_contexto_id: ID_AREA_SDA,
            codigo_expediente: 'EXP-2026-000001',
          }],
          rowCount: 1,
        };
      }

      // Consulta de área
      if (sqlStr.includes('sigd_org.area')) {
        return { rows: [{ area_id: ID_AREA_DIR, vigente: true, nombre: 'Dirección General' }], rowCount: 1 };
      }

      // Consulta de facultades de firma
      if (sqlStr.includes('sigd_org.usuario_rol') && sqlStr.includes('sigd_org.rol_sistema')) {
        return { rows: [], rowCount: 0 };
      }

      // Firma digital registrada válida para resolución (sigd_doc.firma_digital_documento o sigd_doc.resolucion)
      if (sqlStr.includes('sigd_doc.firma_digital_documento') || sqlStr.includes('sigd_doc.resolucion')) {
        return {
          rows: [{
            documento_id: 'doc-resolucion-firmada-uuid',
            resolucion_id: 'doc-resolucion-firmada-uuid',
            cvd: 'CVD-TEST',
            s3_key: 'resoluciones/2026/res.pdf',
            sha256_firmado: 'abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          }],
          rowCount: 1,
        };
      }

      // UPDATE sigd_tra.expediente
      if (sqlStr.includes('UPDATE sigd_tra.expediente')) {
        return { rows: [], rowCount: 1 };
      }

      // Movimiento trámite inserción
      if (sqlStr.includes('sigd_rut.movimiento_tramite')) {
        return { rows: [{ movimiento_id: 'mov-resuelto-uuid' }], rowCount: 1 };
      }

      // Inserciones transaccionales
      if (sqlStr.includes('INSERT INTO sigd_auth.persona')) {
        return { rows: [{ id_persona: 'pers-nueva-uuid' }], rowCount: 1 };
      }
      if (sqlStr.includes('INSERT INTO sigd_auth.cuenta_usuario')) {
        return { rows: [{ id_usuario: 'usr-nueva-uuid' }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });

    mockClient = {
      query: mockQuery,
      release: vi.fn(),
    } as unknown as PoolClient;

    mockPool = {
      query: mockQuery,
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    vi.mocked(getRequestContext).mockReturnValue({
      usuario_id: ID_DIRECTOR,
      correlation_id: 'corr-auth-test',
      ip_origen: '127.0.0.1',
      user_agent: 'Vitest/Auth',
    });

    app = express();
    app.use(express.json());
    app.use('/api/v1', crearRouterTesoreria(mockPool));
    app.use('/api/v1/expedientes', crearRouterDerivaciones(mockPool, {
      obtenerActor: vi.fn().mockImplementation(async (req) => {
        const auth = req.headers['authorization'];
        if (!auth) return null;
        if (auth.includes(tokenCiudadano)) return { id: ID_CIUDADANO, roles: ['CIUDADANO'], unidadOrganicaId: null };
        if (auth.includes(tokenMesaPartes)) return { id: ID_MESA_PARTES, roles: ['MESA_PARTES'], unidadOrganicaId: ID_AREA_DIR };
        if (auth.includes(tokenTesoreria)) return { id: ID_TESORERIA, roles: ['TESORERIA'], unidadOrganicaId: ID_AREA_DIR };
        if (auth.includes(tokenSecretarioSda)) return { id: ID_SECRETARIO_SDA, roles: ['SECRETARIO'], unidadOrganicaId: ID_AREA_SDA };
        if (auth.includes(tokenSecretarioOtro)) return { id: ID_SECRETARIO_OTRO, roles: ['SECRETARIO'], unidadOrganicaId: ID_AREA_OTRA };
        if (auth.includes(tokenEspecialista1)) return { id: ID_ESPECIALISTA_1, roles: ['ESPECIALISTA'], unidadOrganicaId: ID_AREA_SDA };
        if (auth.includes(tokenEspecialista2)) return { id: ID_ESPECIALISTA_2, roles: ['ESPECIALISTA'], unidadOrganicaId: ID_AREA_SDA };
        if (auth.includes(tokenDirector)) return { id: ID_DIRECTOR, roles: ['DIRECTOR'], unidadOrganicaId: ID_AREA_DIR };
        if (auth.includes(tokenAdmin)) return { id: ID_ADMIN, roles: ['ADMINISTRADOR'], unidadOrganicaId: ID_AREA_DIR };
        if (auth.includes(tokenSuperAdmin)) return { id: ID_SUPERADMIN, roles: ['SUPERADMINISTRADOR'], unidadOrganicaId: ID_AREA_DIR };
        return null;
      }),
    }));
    app.use('/api/v1/admin/usuarios', crearUsuariosAdminRouter(mockPool));
    app.use(errorMiddleware);
  });

  // ===========================================================================
  // 1. CIUDADANO: Segregación estricta
  // ===========================================================================
  it('1. CIUDADANO -> derivar expediente = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/derivar`)
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        destinos: [{ area_destino_id: ID_AREA_SDA, es_copia: false }],
        proveido: 'Intento de derivar por administrado',
      });

    expect(res.status).toBe(403);
  });

  it('2. CIUDADANO -> resolver expediente = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/resolver`)
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({ resultado_resumen: 'Intento de resolver por administrado' });

    expect(res.status).toBe(403);
  });

  // ===========================================================================
  // 2. MESA DE PARTES: Segregación de funciones
  // ===========================================================================
  it('3. MESA_PARTES -> confirmar pago en Tesorería = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/tesoreria/ordenes/${ID_ORDEN_PAGO}/confirmar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({ metodoPago: 'EFECTIVO', numeroOperacion: 'OP-001' });

    expect(res.status).toBe(403);
  });

  it('4. MESA_PARTES -> resolver expediente = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/resolver`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({ resultado_resumen: 'Intento resolver desde Mesa de Partes' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SIN_FACULTAD_RESOLUTIVA');
  });

  it('5. MESA_PARTES -> derivar expediente cuando ya está en custodia de SDA = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [{ area_destino_id: ID_AREA_DIR, es_copia: false }],
        proveido: 'Intento de derivación indebida',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('BOLA_VIOLATION_CUSTODIA_AJENA');
  });

  // ===========================================================================
  // 3. TESORERÍA: Segregación documental
  // ===========================================================================
  it('6. TESORERIA -> derivar expediente documentario = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/derivar`)
      .set('Authorization', `Bearer ${tokenTesoreria}`)
      .send({
        destinos: [{ area_destino_id: ID_AREA_SDA, es_copia: false }],
        proveido: 'Derivación desde tesorería',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROL_FINANCIERO_SIN_FACULTAD_DERIVAR');
  });

  it('7. TESORERIA -> firmar / resolver expediente = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/resolver`)
      .set('Authorization', `Bearer ${tokenTesoreria}`)
      .send({ resultado_resumen: 'Resolución pretendida por tesorero' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SIN_FACULTAD_RESOLUTIVA');
  });

  it('8. TESORERIA -> asignar especialista = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/asignar`)
      .set('Authorization', `Bearer ${tokenTesoreria}`)
      .send({ idPersona: 'pers-1', idUsuario: 'usr-1', motivo: 'Asignación' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SIN_FACULTAD_ASIGNACION');
  });

  // ===========================================================================
  // 4. ESPECIALISTA: Segregación técnica y asignación
  // ===========================================================================
  it('9. ESPECIALISTA -> expediente no asignado a este especialista = DENY 403', async () => {
    // Está asignado a ESPECIALISTA_1; ESPECIALISTA_2 intenta atender
    asignacionEspecialistaSimulada = ID_ESPECIALISTA_1;

    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/atender`)
      .set('Authorization', `Bearer ${tokenEspecialista2}`)
      .send({ resultado_resumen: 'Dictamen técnico no autorizado' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA');
  });

  it('10. ESPECIALISTA -> enviar directamente a firma = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/enviar-a-firma`)
      .set('Authorization', `Bearer ${tokenEspecialista1}`)
      .send({ resultado_resumen: 'Pase a firma directo' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ESPECIALISTA_NO_PUEDE_ELEVAR_A_FIRMA');
  });

  it('11. ESPECIALISTA -> resolver expediente con firma = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/resolver`)
      .set('Authorization', `Bearer ${tokenEspecialista1}`)
      .send({ resultado_resumen: 'Resolución emitida por especialista' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SIN_FACULTAD_RESOLUTIVA');
  });

  it('12. ESPECIALISTA -> asignar expediente = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/asignar`)
      .set('Authorization', `Bearer ${tokenEspecialista1}`)
      .send({ idPersona: 'pers-1', idUsuario: 'usr-1', motivo: 'Autoasignación' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SIN_FACULTAD_ASIGNACION');
  });

  // ===========================================================================
  // 5. SECRETARIO: Despacho de área pero sin firma de Director
  // ===========================================================================
  it('13. SECRETARIO -> firmar resolución institucional = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/resolver`)
      .set('Authorization', `Bearer ${tokenSecretarioSda}`)
      .send({ resultado_resumen: 'Resolución firmada por secretario' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SIN_FACULTAD_RESOLUTIVA');
  });

  it('14. SECRETARIO de otra área -> operar expediente de SDA = DENY 403', async () => {
    // SECRETARIO_OTRO (de ID_AREA_OTRA) intenta asignar en SDA
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/asignar`)
      .set('Authorization', `Bearer ${tokenSecretarioOtro}`)
      .send({ idPersona: 'pers-1', idUsuario: 'usr-1', motivo: 'Asignación no autorizada' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('BOLA_VIOLATION_CUSTODIA_AJENA');
  });

  // ===========================================================================
  // 6. ADMINISTRADOR: Soporte técnico sin facultades de resolución ni financieras
  // ===========================================================================
  it('15. ADMINISTRADOR -> resolver / firmar expediente = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/resolver`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ resultado_resumen: 'Resolución emitida por admin técnico' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SIN_FACULTAD_RESOLUTIVA');
  });

  it('16. ADMINISTRADOR -> confirmar pago en Tesorería sin rol financiero = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/tesoreria/ordenes/${ID_ORDEN_PAGO}/confirmar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ metodoPago: 'EFECTIVO', numeroOperacion: 'OP-ADMIN' });

    expect(res.status).toBe(403);
  });

  it('17. ADMINISTRADOR -> asignar SUPERADMINISTRADOR o DIRECTOR (Anti-Escalamiento) = DENY 403', async () => {
    const res = await request(app)
      .post('/api/v1/admin/usuarios/institucional')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        tipoDocumento: 'DNI',
        numeroDocumento: '77889900',
        nombres: 'Intento',
        apellidos: 'SuperAdmin',
        correo: 'intento.superadmin@iestp-suiza.edu.pe',
        usuario: 'intento_superadmin',
        password: 'Password#2026',
        rolId: 'SUPERADMINISTRADOR',
        areaId: ID_AREA_DIR,
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PRIVILEGIO_INSUFICIENTE_ASIGNACION_ROL');
  });

  it('18. ADMINISTRADOR -> auto-escalación modificando su propia cuenta = DENY 403', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/usuarios/${ID_ADMIN}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombres: 'Admin',
        apellidos: 'Escalado',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTO_ESCALACION_PROHIBIDA');
  });

  // ===========================================================================
  // 7. SUPERADMINISTRADOR: Gobierno técnico sin bypass de resolución
  // ===========================================================================
  it('19. SUPERADMINISTRADOR -> resolver expediente sin rol DIRECTOR = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/resolver`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ resultado_resumen: 'Resolución emitida por superadmin' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SIN_FACULTAD_RESOLUTIVA');
  });

  // ===========================================================================
  // 8. DIRECTOR: Autoridad resolutiva en EN_FIRMA
  // ===========================================================================
  it('20. DIRECTOR -> resolver expediente en EN_FIRMA con firma válida = ALLOW 200', async () => {
    estadoExpedienteSimulado = 'EN_FIRMA';

    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/resolver`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({ resultado_resumen: 'Resolución Directoral 001-2026 debidamente suscrita' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.nuevoEstado).toBe('RESUELTO');
  });

  // ===========================================================================
  // 9. LÍMITES ESTRICTOS DE DIRECTOR (No reemplazo general de Secretaría ni Especialista)
  // ===========================================================================
  it('21. DIRECTOR -> asignar especialista sin encargatura en área SDA = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/asignar`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({ idPersona: 'pers-1', idUsuario: 'usr-1', motivo: 'Asignación no autorizada por Director' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SIN_FACULTAD_ASIGNACION');
  });

  it('22. DIRECTOR -> registrar dictamen técnico sin asignación/perfil = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/atender`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        resultado_resumen: 'Dictamen de Director',
        tipo_atencion: 'INFORME_TECNICO',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toMatch(/BOLA_VIOLATION_CUSTODIA_AJENA|DIRECTOR_SIN_FACULTAD_DICTAMEN/);
  });

  it('23. DIRECTOR -> enviar a firma desde etapa SDA por solo ser DIRECTOR = DENY 403', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/enviar-a-firma`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({ resultado_resumen: 'Pase a firma forzado por Director desde etapa SDA' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('BOLA_VIOLATION_CUSTODIA_AJENA');
  });

  // ===========================================================================
  // 10. SEGREGACIÓN FUNCIONAL DENTRO DE DIRECCIÓN GENERAL (DIR)
  // ===========================================================================
  it('24. TESORERIA y MESA_PARTES: misma unidad física DIR pero permisos mutuamente segregados = PASS', async () => {
    // A) MESA_PARTES (en DIR) intenta confirmar pago financiero en Tesorería -> DENY 403
    const resMdpEnTeso = await request(app)
      .post(`/api/v1/tesoreria/ordenes/${ID_ORDEN_PAGO}/confirmar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({ metodoPago: 'EFECTIVO', numeroOperacion: 'OP-MDP' });

    expect(resMdpEnTeso.status).toBe(403);

    // B) TESORERIA (en DIR) intenta derivar expediente documentario -> DENY 403 ROL_FINANCIERO_SIN_FACULTAD_DERIVAR
    const resTesoDerivar = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/derivar`)
      .set('Authorization', `Bearer ${tokenTesoreria}`)
      .send({
        destinos: [{ area_destino_id: ID_AREA_SDA, es_copia: false }],
        proveido: 'Intento de derivar por Tesorero',
      });

    expect(resTesoDerivar.status).toBe(403);
    expect(resTesoDerivar.body.code).toBe('ROL_FINANCIERO_SIN_FACULTAD_DERIVAR');

    // C) TESORERIA (en DIR) intenta asignar especialista -> DENY 403 SIN_FACULTAD_ASIGNACION
    const resTesoAsignar = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/asignar`)
      .set('Authorization', `Bearer ${tokenTesoreria}`)
      .send({ idPersona: 'pers-1', idUsuario: 'usr-1', motivo: 'Asignación' });

    expect(resTesoAsignar.status).toBe(403);
    expect(resTesoAsignar.body.code).toBe('SIN_FACULTAD_ASIGNACION');
  });
});
