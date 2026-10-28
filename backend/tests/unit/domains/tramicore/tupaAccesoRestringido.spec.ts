import { describe, expect, it, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

describe('TramiCore — Acceso Restringido al TUPA y Motor de Formularios Dinámicos', () => {
  let app: Express;
  let mockPool: any;

  const idUsuarioCiudadano = '11111111-1111-4111-8111-111111111111';
  const idPersonaCiudadano = '22222222-2222-4222-8222-222222222222';
  const idUsuarioMesaPartes = '33333333-3333-4333-8333-333333333333';
  const idPersonaMesaPartes = '44444444-4444-4444-8444-444444444444';
  const idUsuarioCiudadanoB = '55555555-5555-4555-8555-555555555555';
  const idPersonaCiudadanoB = '66666666-6666-4666-8666-666666666666';

  let tokenCiudadano: string;
  let tokenMesaPartes: string;
  let tokenCiudadanoB: string;
  let tokenAdministrador: string;
  let tokenDirector: string;
  let tokenEspecialista: string;
  let tokenSecretario: string;

  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = 'unit-test-secret-not-for-production-min32chars';

    tokenCiudadano = firmarTokenAcceso({
      sub: idUsuarioCiudadano,
      roles: ['CIUDADANO'],
    });

    tokenMesaPartes = firmarTokenAcceso({
      sub: idUsuarioMesaPartes,
      roles: ['MESA_PARTES'],
    });

    tokenCiudadanoB = firmarTokenAcceso({
      sub: idUsuarioCiudadanoB,
      roles: ['CIUDADANO'],
    });

    tokenAdministrador = firmarTokenAcceso({
      sub: '77777777-7777-4777-8777-777777777777',
      roles: ['ADMINISTRADOR'],
    });

    tokenDirector = firmarTokenAcceso({
      sub: '88888888-8888-4888-8888-888888888888',
      roles: ['DIRECTOR'],
    });

    tokenEspecialista = firmarTokenAcceso({
      sub: '99999999-8888-4999-8999-999999999999',
      roles: ['ESPECIALISTA'],
    });

    tokenSecretario = firmarTokenAcceso({
      sub: '00000000-8888-4000-8000-000000000000',
      roles: ['SECRETARIO'],
    });

    mockPool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn(),
        release: vi.fn(),
      }),
    };

    app = express();
    app.use(express.json());
    app.use('/api/v1', crearRouterTramites(mockPool as any));
    app.use(errorMiddleware);
  });

  // ─── 1. TUPA sin autorización -> DENY ──────────────────────────────────────

  it('1. GET /api/v1/tramites/tupa sin token devuelve 403 con SOLICITUD_ACCESO_REQUERIDA', async () => {
    const res = await request(app).get('/api/v1/tramites/tupa');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ACCESO_RESTRINGIDO');
    expect(res.body.codigo).toBe('SOLICITUD_ACCESO_REQUERIDA');
    expect(res.body.mensaje).toMatch(/requiere una solicitud de acceso/i);
  });

  // ─── 2. Solicitud pendiente -> DENY ────────────────────────────────────────

  it('2. GET /api/v1/tramites/tupa con solicitud PENDIENTE deniega acceso (403)', async () => {
    // Mock resolución de identidad
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'ciudadano@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso WHERE id_persona = $1 AND estado = \'APROBADA\'')) {
        // No tiene solicitud aprobada
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .get('/api/v1/tramites/tupa')
      .set('Authorization', `Bearer ${tokenCiudadano}`);

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SOLICITUD_ACCESO_REQUERIDA');
  });

  // ─── 3. Solicitud aprobada -> ALLOW ────────────────────────────────────────

  it('3. GET /api/v1/tramites/tupa con solicitud APROBADA devuelve las 72 entradas', async () => {
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'ciudadano@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('WHERE id_persona = $1\n         AND estado = \'APROBADA\'')) {
        // Tiene solicitud aprobada
        return { rows: [{ 1: 1 }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        // Generar 72 filas simuladas
        const filas = Array.from({ length: 72 }, (_, i) => ({
          registro_version_id: `11111111-0000-0000-0000-${String(i).padStart(12, '0')}`,
          codigo_externo: `p${Math.floor(i / 10) + 1}-fila-${(i % 10) + 1}`,
          denominacion_original: `Procedimiento de prueba ${i + 1}`,
          requisitos_original: ['Requisito A'],
          monto_original: 'S/ 25.00',
          fuente_nombre: 'tupa-2026.pdf',
          documento_sha256: 'a'.repeat(64),
          pagina: Math.floor(i / 10) + 1,
          referencia_fila: `fila-${i + 1}`,
          version_fuente: '2026',
          revision: 1,
          vigencia_desde: new Date('2026-01-01'),
          vigencia_hasta: null,
          estado_validacion: i < 18 ? 'APROBADO' : 'PENDIENTE_VALIDACION',
          referencia_aprobacion: 'RD 01-2026',
        }));
        return { rows: filas, rowCount: 72 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .get('/api/v1/tramites/tupa')
      .set('Authorization', `Bearer ${tokenCiudadano}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(72);
  });

  // ─── 4. Rol institucional -> ALLOW directo ─────────────────────────────────

  it('4. GET /api/v1/tramites/tupa con rol MESA_PARTES devuelve las 72 entradas directamente', async () => {
    mockPool.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        const filas = Array.from({ length: 72 }, (_, i) => ({
          registro_version_id: `22222222-0000-0000-0000-${String(i).padStart(12, '0')}`,
          codigo_externo: `cod-${i + 1}`,
          denominacion_original: `Entrada institucional ${i + 1}`,
          requisitos_original: [],
          monto_original: '0.00',
          fuente_nombre: 'tupa-2026.pdf',
          documento_sha256: 'b'.repeat(64),
          pagina: 1,
          referencia_fila: `f-${i + 1}`,
          version_fuente: '2026',
          revision: 1,
          vigencia_desde: null,
          vigencia_hasta: null,
          estado_validacion: 'APROBADO',
          referencia_aprobacion: 'RD-2026',
        }));
        return { rows: filas, rowCount: 72 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .get('/api/v1/tramites/tupa')
      .set('Authorization', `Bearer ${tokenMesaPartes}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(72);
  });

  // ─── 5. Solicitar acceso (Ciudadano) ────────────────────────────────────────

  it('5. POST /api/v1/tramites/tupa/acceso/solicitar crea solicitud PENDIENTE', async () => {
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso s')) {
        // No tiene solicitud previa
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO sigd_doc.tupa_solicitud_acceso')) {
        return {
          rows: [
            {
              id_solicitud: '99999999-9999-4999-8999-999999999999',
              id_persona: idPersonaCiudadano,
              correo: params[1],
              motivo: params[2],
              fecha_solicitud: new Date(),
              estado: 'PENDIENTE',
              fecha_resolucion: null,
              resuelto_por: null,
              observacion_resolucion: null,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/api/v1/tramites/tupa/acceso/solicitar')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        motivo: 'Investigación académica y consulta de procedimientos institucionales',
        correo: 'juan@prueba.pe',
        aceptaTratamientoDatos: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('PENDIENTE');
    expect(res.body.idPersona).toBe(idPersonaCiudadano);
  });

  it('5b. POST /api/v1/tramites/tupa/acceso/solicitar rechaza cuentas institucionales con TUPA_ACCESS_ALREADY_GRANTED_BY_ROLE', async () => {
    mockPool.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaMesaPartes, activo: true, correo: 'staff@iestpsuiza.edu.pe', nombre_completo: 'Personal' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const tokensInstitucionales = [
      { rol: 'MESA_PARTES', token: tokenMesaPartes },
      { rol: 'ADMINISTRADOR', token: tokenAdministrador },
      { rol: 'DIRECTOR', token: tokenDirector },
      { rol: 'SECRETARIO', token: tokenSecretario },
      { rol: 'ESPECIALISTA', token: tokenEspecialista },
    ];

    for (const item of tokensInstitucionales) {
      // Probar en /solicitar
      const resSolicitar = await request(app)
        .post('/api/v1/tramites/tupa/acceso/solicitar')
        .set('Authorization', `Bearer ${item.token}`)
        .send({
          motivo: 'Intento de solicitud desde rol ' + item.rol,
          correo: 'staff@iestpsuiza.edu.pe',
          aceptaTratamientoDatos: true,
        });

      expect(resSolicitar.status).toBe(400);
      expect(resSolicitar.body.code).toBe('TUPA_ACCESS_ALREADY_GRANTED_BY_ROLE');
      expect(resSolicitar.body.message).toBe('La cuenta posee acceso institucional al catálogo TUPA.');

      // Probar en alias /solicitudes
      const resSolicitudes = await request(app)
        .post('/api/v1/tramites/tupa/acceso/solicitudes')
        .set('Authorization', `Bearer ${item.token}`)
        .send({
          motivo: 'Intento de solicitud desde rol ' + item.rol,
          correo: 'staff@iestpsuiza.edu.pe',
          aceptaTratamientoDatos: true,
        });

      expect(resSolicitudes.status).toBe(400);
      expect(resSolicitudes.body.code).toBe('TUPA_ACCESS_ALREADY_GRANTED_BY_ROLE');
      expect(resSolicitudes.body.message).toBe('La cuenta posee acceso institucional al catálogo TUPA.');
    }
  });

  // ─── 6. Aprobación por Mesa de Partes ───────────────────────────────────────

  it('6. PATCH /api/v1/tramites/tupa/acceso/admin/solicitudes/:id aprueba solicitud', async () => {
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaMesaPartes, activo: true, correo: 'operador@iestpsuiza.edu.pe', nombre_completo: 'Operador MP' }],
          rowCount: 1,
        };
      }
      if (sql.includes('UPDATE sigd_doc.tupa_solicitud_acceso')) {
        return {
          rows: [
            {
              id_solicitud: '99999999-9999-4999-8999-999999999999',
              id_persona: idPersonaCiudadano,
              correo: 'juan@prueba.pe',
              motivo: 'Investigación',
              fecha_solicitud: new Date(),
              estado: params[0],
              fecha_resolucion: new Date(),
              resuelto_por: params[1],
              observacion_resolucion: params[2],
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .patch('/api/v1/tramites/tupa/acceso/admin/solicitudes/99999999-9999-4999-8999-999999999999')
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        estado: 'APROBADA',
        observacion: 'Aprobado para consulta académica',
      });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('APROBADA');
  });

  // ─── 7. Registro de Solicitud Dinámica (Venta Mango -> SOL-2026-XXXXXX) ────

  it('7. POST /api/v1/tramites/solicitudes-dinamicas genera código SOL-2026-XXXXXX y calcula importe', async () => {
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso') && sql.includes("estado = 'APROBADA'")) return { rows: [{ one: 1 }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        return {
          rows: [
            {
              registro_version_id: '33333333-3333-4333-8333-333333333333',
              denominacion_original: 'Venta de Mangos (Ciento)',
              monto_original: 'S/ 15.00',
              estado_validacion: 'PENDIENTE_VALIDACION',
              referencia_fila: 'p2-fila-09',
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('nextval')) {
        return { rows: [{ val: '42' }] };
      }
      if (sql.includes('INSERT INTO sigd_doc.solicitud_tramite_dinamico')) {
        return {
          rows: [
            {
              id_solicitud: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              codigo_solicitud: 'SOL-2026-000042',
              tipo_formulario: params[1],
              codigo_tupa: params[2],
              denominacion: params[3],
              id_persona: params[4],
              nombre_solicitante: params[5],
              correo: params[6],
              telefono: params[7],
              monto_total: params[8],
              datos_formulario: JSON.parse(params[9]),
              estado: 'SOLICITADO',
              observacion: params[10],
              fecha_solicitud: new Date(),
              fecha_actualizacion: new Date(),
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        tipoFormulario: 'VENTA_BIEN',
        codigoTupa: 'p2-fila-09',
        denominacion: 'Venta de Mangos (Ciento)',
        montoTotal: 30.0,
        datosFormulario: {
          cantidad: 2,
          unidad: 'Ciento',
          precioUnitario: 15.0,
        },
        telefono: '961000001',
        observacion: 'Retiro en el centro de producción',
      });

    expect(res.status).toBe(201);
    expect(res.body.codigoSolicitud).toBe('SOL-2026-000042');
    expect(res.body.montoTotal).toBe(30.0);
    expect(res.body.estado).toBe('SOLICITADO');
  });

  // ─── 8. Actuación interna -> Ciudadano bloqueado (403), Institucional permitido ───

  it('8. POST /api/v1/tramites/solicitudes-dinamicas con ACTUACION_INTERNA deniega ciudadano (403) y permite institucional', async () => {
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) return { rows: [{
        registro_version_id: '88888888-8888-4888-8888-888888888888', denominacion_original: 'Prácticas Iniciales',
        monto_original: 'S/ 35.00', estado_validacion: 'PENDIENTE_VALIDACION', referencia_fila: 'p1-fila-01',
      }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const resCiudadano = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        tipoFormulario: 'ACTUACION_INTERNA',
        codigoTupa: 'p1-fila-01',
        denominacion: 'Prácticas Iniciales',
        montoTotal: 35.0,
        datosFormulario: {},
      });

    expect(resCiudadano.status).toBe(403);
    expect(resCiudadano.body.detail).toMatch(/Gestión interna institucional/i);

    // Con rol Mesa de Partes
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) return { rows: [{
        registro_version_id: '88888888-8888-4888-8888-888888888888', denominacion_original: 'Prácticas Iniciales',
        monto_original: 'S/ 35.00', estado_validacion: 'PENDIENTE_VALIDACION', referencia_fila: 'p1-fila-01',
      }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaMesaPartes, activo: true, correo: 'mp@iestpsuiza.edu.pe', nombre_completo: 'Operador MP' }],
          rowCount: 1,
        };
      }
      if (sql.includes('nextval')) {
        return { rows: [{ val: '99' }] };
      }
      if (sql.includes('INSERT INTO sigd_doc.solicitud_tramite_dinamico')) {
        return {
          rows: [
            {
              id_solicitud: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              codigo_solicitud: 'SOL-2026-000099',
              tipo_formulario: params[1],
              codigo_tupa: params[2],
              denominacion: params[3],
              id_persona: params[4],
              nombre_solicitante: params[5],
              correo: params[6],
              telefono: params[7],
              monto_total: params[8],
              datos_formulario: JSON.parse(params[9]),
              estado: 'SOLICITADO',
              observacion: params[10],
              fecha_solicitud: new Date(),
              fecha_actualizacion: new Date(),
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const resInstitucional = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        tipoFormulario: 'ACTUACION_INTERNA',
        codigoTupa: 'p1-fila-01',
        denominacion: 'Prácticas Iniciales',
        montoTotal: 35.0,
        datosFormulario: {},
      });

    expect(resInstitucional.status).toBe(201);
    expect(resInstitucional.body.codigoSolicitud).toBe('SOL-2026-000099');
  });

  // ─── 9. Anti-BOLA: Ciudadano A no puede consultar solicitudes de Ciudadano B ─

  it('ventanilla atribuye SOL al solicitante registrado, no al operador; ciudadano no suplanta', async () => {
    let insertParams: unknown[] | null = null;
    mockPool.query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) return { rows: [{
        id_persona: idPersonaMesaPartes, activo: true, correo: 'mesa@example.test', nombre_completo: 'Operador',
      }], rowCount: 1 };
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) return { rows: [{
        registro_version_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', denominacion_original: 'Venta de Mangos (Ciento)',
        monto_original: 'S/ 15.00', estado_validacion: 'PENDIENTE_VALIDACION', referencia_fila: 'p2-fila-09',
      }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.persona p')) return { rows: [{ id_persona: idPersonaCiudadanoB, nombre: 'Solicitante B' }], rowCount: 1 };
      if (sql.includes('nextval')) return { rows: [{ val: '55' }], rowCount: 1 };
      if (sql.includes('INSERT INTO sigd_doc.solicitud_tramite_dinamico')) {
        insertParams = params;
        return { rows: [{
          id_solicitud: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', codigo_solicitud: 'SOL-2026-000055',
          tipo_formulario: params[1], codigo_tupa: params[2], denominacion: params[3], id_persona: params[4],
          nombre_solicitante: params[5], correo: params[6], telefono: params[7], monto_total: params[8],
          datos_formulario: JSON.parse(String(params[9])), estado: 'SOLICITADO', observacion: params[10],
          fecha_solicitud: new Date(), fecha_actualizacion: new Date(),
        }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso')) return { rows: [{ one: 1 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const payload = { tipoFormulario: 'VENTA_BIEN', codigoTupa: 'p2-fila-09', denominacion: 'Manipulada',
      montoTotal: 1, datosFormulario: { cantidad: 2 },
      solicitante: { tipoPersona: 'NATURAL', numeroDocumento: '12345678', correo: 'solicitante@example.test' } };
    const mesa = await request(app).post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenMesaPartes}`).send(payload);
    expect(mesa.status).toBe(201);
    expect(insertParams?.[4]).toBe(idPersonaCiudadanoB);
    expect(insertParams?.[8]).toBe(30);
    const ciudadano = await request(app).post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`).send(payload);
    expect(ciudadano.status).toBe(403);
  });

  it('9. GET /api/v1/tramites/solicitudes-dinamicas/:codigo bloquea acceso cruzado entre ciudadanos (Anti-BOLA)', async () => {
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadanoB, activo: true, correo: 'b@prueba.pe', nombre_completo: 'Ciudadano B' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.solicitud_tramite_dinamico')) {
        // La consulta busca codigo_solicitud = $1 AND id_persona = $2
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .get('/api/v1/tramites/solicitudes-dinamicas/SOL-2026-000042')
      .set('Authorization', `Bearer ${tokenCiudadanoB}`);

    expect(res.status).toBe(404);
    expect(res.body.detail).toMatch(/no encontrada o no autorizada/i);
  });

  // ─── 10. Matriz RBAC para Aprobación de Acceso al TUPA ─────────────────────

  it('10. PATCH /api/v1/tramites/tupa/acceso/admin/solicitudes/:id solo permite MESA_PARTES y ADMINISTRADOR', async () => {
    // ADMINISTRADOR -> 200 OK
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: '77777777-1111-4777-8777-111111111111', activo: true, correo: 'admin@iestpsuiza.edu.pe', nombre_completo: 'Admin' }],
          rowCount: 1,
        };
      }
      if (sql.includes('UPDATE sigd_doc.tupa_solicitud_acceso')) {
        return {
          rows: [{
            id_solicitud: 'sol-1',
            id_persona: idPersonaCiudadano,
            correo: 'juan@prueba.pe',
            motivo: 'Investigación',
            fecha_solicitud: new Date(),
            estado: 'APROBADA',
            fecha_resolucion: new Date(),
            resuelto_por: '77777777-7777-4777-8777-777777777777',
            observacion_resolucion: 'Aprobado por Admin',
            vigencia_hasta: new Date(Date.now() + 30 * 86400000),
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const resAdmin = await request(app)
      .patch('/api/v1/tramites/tupa/acceso/admin/solicitudes/sol-1')
      .set('Authorization', `Bearer ${tokenAdministrador}`)
      .send({ estado: 'APROBADA' });
    expect(resAdmin.status).toBe(200);

    // CIUDADANO -> 403 Forbidden
    const resCiudadano = await request(app)
      .patch('/api/v1/tramites/tupa/acceso/admin/solicitudes/sol-1')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({ estado: 'APROBADA' });
    expect(resCiudadano.status).toBe(403);

    // DIRECTOR -> 403 Forbidden
    const resDirector = await request(app)
      .patch('/api/v1/tramites/tupa/acceso/admin/solicitudes/sol-1')
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({ estado: 'APROBADA' });
    expect(resDirector.status).toBe(403);

    // ESPECIALISTA -> 403 Forbidden
    const resEspecialista = await request(app)
      .patch('/api/v1/tramites/tupa/acceso/admin/solicitudes/sol-1')
      .set('Authorization', `Bearer ${tokenEspecialista}`)
      .send({ estado: 'APROBADA' });
    expect(resEspecialista.status).toBe(403);

    // SECRETARIO -> 403 Forbidden
    const resSecretario = await request(app)
      .patch('/api/v1/tramites/tupa/acceso/admin/solicitudes/sol-1')
      .set('Authorization', `Bearer ${tokenSecretario}`)
      .send({ estado: 'APROBADA' });
    expect(resSecretario.status).toBe(403);
  });

  // ─── 11. Expiración de Vigencia (30 días) ──────────────────────────────────

  it('11. GET /api/v1/tramites/tupa con solicitud APROBADA pero EXPIRADA deniega acceso (403)', async () => {
    mockPool.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'ciudadano@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso WHERE id_persona = $1 AND estado = \'APROBADA\'')) {
        // La condición `AND (vigencia_hasta IS NULL OR vigencia_hasta > now())` no se cumple porque expiró
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .get('/api/v1/tramites/tupa')
      .set('Authorization', `Bearer ${tokenCiudadano}`);

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SOLICITUD_ACCESO_REQUERIDA');
  });

  // ─── 12. Acceso Institucional Directo para todos los roles internos ────────

  it('12. GET /api/v1/tramites/tupa permite acceso directo a ADMINISTRADOR, DIRECTOR, ESPECIALISTA y SECRETARIO', async () => {
    const filas72 = Array.from({ length: 72 }, (_, i) => ({
      registro_version_id: `row-${i + 1}`,
      codigo_externo: `cod-${i + 1}`,
      denominacion_original: `Entrada ${i + 1}`,
      requisitos_original: [],
      monto_original: '0.00',
      fuente_nombre: 'tupa-2026.pdf',
      documento_sha256: 'c'.repeat(64),
      pagina: 1,
      referencia_fila: `f-${i + 1}`,
      version_fuente: '2026',
      revision: 1,
      vigencia_desde: null,
      vigencia_hasta: null,
      estado_validacion: 'APROBADO',
      referencia_aprobacion: 'RD-2026',
    }));

    mockPool.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        return { rows: filas72, rowCount: 72 };
      }
      return { rows: [], rowCount: 0 };
    });

    const resAdmin = await request(app).get('/api/v1/tramites/tupa').set('Authorization', `Bearer ${tokenAdministrador}`);
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body).toHaveLength(72);

    const resDir = await request(app).get('/api/v1/tramites/tupa').set('Authorization', `Bearer ${tokenDirector}`);
    expect(resDir.status).toBe(200);
    expect(resDir.body).toHaveLength(72);

    const resEsp = await request(app).get('/api/v1/tramites/tupa').set('Authorization', `Bearer ${tokenEspecialista}`);
    expect(resEsp.status).toBe(200);
    expect(resEsp.body).toHaveLength(72);

    const resSec = await request(app).get('/api/v1/tramites/tupa').set('Authorization', `Bearer ${tokenSecretario}`);
    expect(resSec.status).toBe(200);
    expect(resSec.body).toHaveLength(72);
  });

  // ─── 13. Procedimiento Documentario Oficial Aprobado -> Bloqueado en Dinámico ──

  it('13. POST /api/v1/tramites/solicitudes-dinamicas bloquea trámite documentario oficial aprobado (debe radicarse con CUT)', async () => {
    mockPool.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        return {
          rows: [
            {
              registro_version_id: 'doc-oficial-1',
              denominacion_original: 'Certificado de Estudios de Inglés',
              monto_original: 'S/ 25.00',
              estado_validacion: 'APROBADO',
              referencia_fila: 'p1-fila-05',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        tipoFormulario: 'DOCUMENTARIO',
        codigoTupa: 'p1-fila-05',
        denominacion: 'Certificado de Estudios de Inglés',
        montoTotal: 25.0,
        datosFormulario: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.invalidParams?.[0]?.reason).toMatch(/flujo con CUT/i);
  });

  // ─── 14. Anti-spoofing de Tipo de Formulario ───────────────────────────────

  it('14. POST /api/v1/tramites/solicitudes-dinamicas rechaza alteración a DOCUMENTARIO en venta de bien (Anti-spoofing)', async () => {
    mockPool.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        return {
          rows: [
            {
              registro_version_id: 'bien-1',
              denominacion_original: 'Venta de Mangos (Ciento)',
              monto_original: 'S/ 15.00',
              estado_validacion: 'PENDIENTE_VALIDACION',
              referencia_fila: 'p2-fila-09',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        tipoFormulario: 'DOCUMENTARIO',
        codigoTupa: 'p2-fila-09',
        denominacion: 'Venta de Mangos (Ciento)',
        montoTotal: 15.0,
        datosFormulario: { cantidad: 1 },
      });

    expect(res.status).toBe(400);
    expect(res.body.invalidParams?.[0]?.reason).toMatch(/clasificación institucional/i);
  });

  // ─── 15. Recálculo Mandatorio Server-Side del Monto ─────────────────────────

  it('15. POST /api/v1/tramites/solicitudes-dinamicas ignora montoTotal enviado por el cliente y recalcula (precioBase x cantidad)', async () => {
    let montoRegistradoEnBD: number | null = null;

    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso') && sql.includes("estado = 'APROBADA'")) return { rows: [{ one: 1 }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        return {
          rows: [
            {
              registro_version_id: 'bien-1',
              denominacion_original: 'Venta de Mangos (Ciento)',
              monto_original: 'S/ 15.00',
              estado_validacion: 'PENDIENTE_VALIDACION',
              referencia_fila: 'p2-fila-09',
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('nextval')) {
        return { rows: [{ val: '77' }] };
      }
      if (sql.includes('INSERT INTO sigd_doc.solicitud_tramite_dinamico')) {
        montoRegistradoEnBD = params[8];
        return {
          rows: [{
            id_solicitud: 'sub-77',
            codigo_solicitud: 'SOL-2026-000077',
            tipo_formulario: params[1],
            codigo_tupa: params[2],
            denominacion: params[3],
            id_persona: params[4],
            nombre_solicitante: params[5],
            correo: params[6],
            telefono: params[7],
            monto_total: params[8],
            datos_formulario: JSON.parse(params[9]),
            estado: 'SOLICITADO',
            observacion: params[10],
            fecha_solicitud: new Date(),
            fecha_actualizacion: new Date(),
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    // Cliente intenta enviar monto arbitrario de S/ 0.01 cuando son 3 cientos a S/ 15.00 = S/ 45.00
    const res = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        tipoFormulario: 'VENTA_BIEN',
        codigoTupa: 'p2-fila-09',
        denominacion: 'Venta de Mangos (Ciento)',
        montoTotal: 0.01,
        datosFormulario: { cantidad: 3, unidad: 'Ciento' },
      });

    expect(res.status).toBe(201);
    expect(res.body.montoTotal).toBe(45.0);
    expect(montoRegistradoEnBD).toBe(45.0);
  });

  // ─── 16. Validación de Esquema JSONB (Alquiler y Horarios) ──────────────────

  it('16. POST /api/v1/tramites/solicitudes-dinamicas rechaza alquiler con horaInicio >= horaFin', async () => {
    mockPool.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso') && sql.includes("estado = 'APROBADA'")) return { rows: [{ one: 1 }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        return {
          rows: [
            {
              registro_version_id: 'alq-1',
              denominacion_original: 'Alquiler de Auditorio',
              monto_original: 'S/ 300.00',
              estado_validacion: 'PENDIENTE_VALIDACION',
              referencia_fila: 'p2-fila-06',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        tipoFormulario: 'ALQUILER',
        codigoTupa: 'p2-fila-06',
        denominacion: 'Alquiler de Auditorio',
        montoTotal: 300.0,
        datosFormulario: {
          fechaUso: '2026-11-15',
          horaInicio: '18:00',
          horaFin: '14:00', // Inválido: fin anterior a inicio
          cantidadPeriodos: 1,
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.invalidParams?.[0]?.name).toBe('horaInicio');
  });

  // ─── 17. Depuración de Identidad en JSONB (Minimización Ley 29733) ──────────

  it('17. POST /api/v1/tramites/solicitudes-dinamicas elimina datos redundantes de identidad del JSONB', async () => {
    let jsonbGuardado: any = null;

    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso') && sql.includes("estado = 'APROBADA'")) return { rows: [{ one: 1 }], rowCount: 1 };
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) return { rows: [{
        registro_version_id: '77777777-7777-4777-8777-777777777777', denominacion_original: 'Venta de Mangos (Ciento)',
        monto_original: 'S/ 15.00', estado_validacion: 'PENDIENTE_VALIDACION', referencia_fila: 'p2-fila-09',
      }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('nextval')) {
        return { rows: [{ val: '88' }] };
      }
      if (sql.includes('INSERT INTO sigd_doc.solicitud_tramite_dinamico')) {
        jsonbGuardado = JSON.parse(params[9]);
        return {
          rows: [{
            id_solicitud: 'sub-88',
            codigo_solicitud: 'SOL-2026-000088',
            tipo_formulario: params[1],
            codigo_tupa: params[2],
            denominacion: params[3],
            id_persona: params[4],
            nombre_solicitante: params[5],
            correo: params[6],
            telefono: params[7],
            monto_total: params[8],
            datos_formulario: jsonbGuardado,
            estado: 'SOLICITADO',
            observacion: params[10],
            fecha_solicitud: new Date(),
            fecha_actualizacion: new Date(),
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        tipoFormulario: 'VENTA_BIEN',
        codigoTupa: 'p2-fila-09',
        denominacion: 'Venta de Mangos (Ciento)',
        montoTotal: 15.0,
        datosFormulario: {
          cantidad: 1,
          idPersona: 'intento-inyeccion-id',
          dni: '00000000',
          correo: 'falso@hacker.pe',
          nombre: 'Hacker',
          usuario: 'fake_user',
          observacionPropia: 'Dato legítimo del formulario',
        },
      });

    expect(res.status).toBe(201);
    expect(jsonbGuardado.idPersona).toBeUndefined();
    expect(jsonbGuardado.dni).toBeUndefined();
    expect(jsonbGuardado.correo).toBeUndefined();
    expect(jsonbGuardado.nombre).toBeUndefined();
    expect(jsonbGuardado.usuario).toBeUndefined();
    expect(jsonbGuardado.observacionPropia).toBe('Dato legítimo del formulario');
  });

  // ─── 18. Alquiler de Auditorio (ALQUILER -> SOL) ────────────────────────────

  it('18. POST /api/v1/tramites/solicitudes-dinamicas para ALQUILER calcula periodos x S/300.00', async () => {
    let montoInsertado: number | null = null;

    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso') && sql.includes("estado = 'APROBADA'")) return { rows: [{ one: 1 }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        return {
          rows: [
            {
              registro_version_id: 'alq-aud-1',
              denominacion_original: 'Alquiler de Auditorio Central',
              monto_original: 'S/ 300.00',
              estado_validacion: 'PENDIENTE_VALIDACION',
              referencia_fila: 'p2-fila-06',
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('nextval')) {
        return { rows: [{ val: '101' }] };
      }
      if (sql.includes('INSERT INTO sigd_doc.solicitud_tramite_dinamico')) {
        montoInsertado = params[8];
        return {
          rows: [{
            id_solicitud: 'sol-alq-1',
            codigo_solicitud: 'SOL-2026-000101',
            tipo_formulario: params[1],
            codigo_tupa: params[2],
            denominacion: params[3],
            id_persona: params[4],
            nombre_solicitante: params[5],
            correo: params[6],
            telefono: params[7],
            monto_total: params[8],
            datos_formulario: JSON.parse(params[9]),
            estado: 'SOLICITADO',
            observacion: params[10],
            fecha_solicitud: new Date(),
            fecha_actualizacion: new Date(),
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        tipoFormulario: 'ALQUILER',
        codigoTupa: 'p2-fila-06',
        denominacion: 'Alquiler de Auditorio Central',
        montoTotal: 0.0,
        datosFormulario: {
          fechaUso: '2026-11-20',
          horaInicio: '09:00',
          horaFin: '13:00',
          cantidadPeriodos: 2,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.codigoSolicitud).toBe('SOL-2026-000101');
    expect(res.body.montoTotal).toBe(600.0);
    expect(montoInsertado).toBe(600.0);
  });

  // ─── 19. Trámite Académico (ACADEMICO -> SOL) ──────────────────────────────

  it('19. POST /api/v1/tramites/solicitudes-dinamicas para ACADEMICO registra solicitud SOL', async () => {
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso') && sql.includes("estado = 'APROBADA'")) return { rows: [{ one: 1 }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        return {
          rows: [
            {
              registro_version_id: 'acad-mat-1',
              denominacion_original: 'Matrícula Regular',
              monto_original: 'S/ 25.00',
              estado_validacion: 'PENDIENTE_VALIDACION',
              referencia_fila: 'p5-fila-01',
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('nextval')) {
        return { rows: [{ val: '102' }] };
      }
      if (sql.includes('INSERT INTO sigd_doc.solicitud_tramite_dinamico')) {
        return {
          rows: [{
            id_solicitud: 'sol-acad-1',
            codigo_solicitud: 'SOL-2026-000102',
            tipo_formulario: params[1],
            codigo_tupa: params[2],
            denominacion: params[3],
            id_persona: params[4],
            nombre_solicitante: params[5],
            correo: params[6],
            telefono: params[7],
            monto_total: params[8],
            datos_formulario: JSON.parse(params[9]),
            estado: 'SOLICITADO',
            observacion: params[10],
            fecha_solicitud: new Date(),
            fecha_actualizacion: new Date(),
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        tipoFormulario: 'ACADEMICO',
        codigoTupa: 'p5-fila-01',
        denominacion: 'Matrícula Regular',
        montoTotal: 25.0,
        datosFormulario: {
          periodoAcademico: '2026-I',
          programaEstudios: 'Desarrollo de Sistemas de Información',
          semestre: 'III',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.codigoSolicitud).toBe('SOL-2026-000102');
    expect(res.body.tipoFormulario).toBe('ACADEMICO');
  });

  // ─── 20. Servicio Técnico / Productivo (SERVICIO -> SOL) ───────────────────

  it('20. POST /api/v1/tramites/solicitudes-dinamicas para SERVICIO registra solicitud SOL', async () => {
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso') && sql.includes("estado = 'APROBADA'")) return { rows: [{ one: 1 }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        return {
          rows: [
            {
              registro_version_id: 'serv-emp-1',
              denominacion_original: 'Servicio de Empadre de Ganado',
              monto_original: 'S/ 50.00',
              estado_validacion: 'PENDIENTE_VALIDACION',
              referencia_fila: 'p3-fila-08',
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('nextval')) {
        return { rows: [{ val: '103' }] };
      }
      if (sql.includes('INSERT INTO sigd_doc.solicitud_tramite_dinamico')) {
        return {
          rows: [{
            id_solicitud: 'sol-serv-1',
            codigo_solicitud: 'SOL-2026-000103',
            tipo_formulario: params[1],
            codigo_tupa: params[2],
            denominacion: params[3],
            id_persona: params[4],
            nombre_solicitante: params[5],
            correo: params[6],
            telefono: params[7],
            monto_total: params[8],
            datos_formulario: JSON.parse(params[9]),
            estado: 'SOLICITADO',
            observacion: params[10],
            fecha_solicitud: new Date(),
            fecha_actualizacion: new Date(),
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        tipoFormulario: 'SERVICIO',
        codigoTupa: 'p3-fila-08',
        denominacion: 'Servicio de Empadre de Ganado',
        montoTotal: 50.0,
        datosFormulario: {
          descripcionServicio: 'Empadre en centro experimental',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.codigoSolicitud).toBe('SOL-2026-000103');
    expect(res.body.tipoFormulario).toBe('SERVICIO');
  });

  // ─── 21. Otros Trámites / FUT (OTRO -> SOL) ────────────────────────────────

  it('21. POST /api/v1/tramites/solicitudes-dinamicas para OTRO registra solicitud SOL', async () => {
    mockPool.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM sigd_doc.tupa_solicitud_acceso') && sql.includes("estado = 'APROBADA'")) return { rows: [{ one: 1 }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{ id_persona: idPersonaCiudadano, activo: true, correo: 'juan@prueba.pe', nombre_completo: 'Juan Pérez' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) {
        return {
          rows: [
            {
              registro_version_id: 'fut-1',
              denominacion_original: 'Solicitud General FUT',
              monto_original: 'Gratuito',
              estado_validacion: 'PENDIENTE_VALIDACION',
              referencia_fila: 'p4-fila-01',
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('nextval')) {
        return { rows: [{ val: '104' }] };
      }
      if (sql.includes('INSERT INTO sigd_doc.solicitud_tramite_dinamico')) {
        return {
          rows: [{
            id_solicitud: 'sol-fut-1',
            codigo_solicitud: 'SOL-2026-000104',
            tipo_formulario: params[1],
            codigo_tupa: params[2],
            denominacion: params[3],
            id_persona: params[4],
            nombre_solicitante: params[5],
            correo: params[6],
            telefono: params[7],
            monto_total: params[8],
            datos_formulario: JSON.parse(params[9]),
            estado: 'SOLICITADO',
            observacion: params[10],
            fecha_solicitud: new Date(),
            fecha_actualizacion: new Date(),
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/api/v1/tramites/solicitudes-dinamicas')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        tipoFormulario: 'OTRO',
        codigoTupa: 'p4-fila-01',
        denominacion: 'Solicitud General FUT',
        montoTotal: 0.0,
        datosFormulario: {
          motivoDetallado: 'Petición institucional genérica',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.codigoSolicitud).toBe('SOL-2026-000104');
    expect(res.body.montoTotal).toBe(0.0);
  });

  // ─── 22. Concurrencia de Secuencia PostgreSQL SOL ──────────────────────────

  it('22. Repositorio genera código SOL correlativo seguro mediante secuencia PostgreSQL (sin race conditions)', async () => {
    const { SolicitudDinamicaRepository } = await import('../../../../src/domains/tramicore/solicitudDinamica.repository.js');

    const fakePool: any = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('nextval(\'sigd_doc.secuencia_solicitud_dinamica_2026\')')) {
          return { rows: [{ val: '500' }] };
        }
        return { rows: [] };
      }),
    };

    const repo = new SolicitudDinamicaRepository(fakePool);
    const codigoGenerado = await repo.generarCodigoCorrelativo();

    expect(codigoGenerado).toBe('SOL-2026-000500');
    expect(fakePool.query).toHaveBeenCalledWith("SELECT nextval('sigd_doc.secuencia_solicitud_dinamica_2026')::text AS val;");
  });
});
