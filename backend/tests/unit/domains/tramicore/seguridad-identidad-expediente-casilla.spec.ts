import request from 'supertest';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { RegistroCiudadanoService } from '../../../../src/domains/identicore/registroCiudadano.service.js';
import { VinculacionHistoricaService } from '../../../../src/domains/tramicore/vinculacionHistorica.service.js';
import { ConflictError, ForbiddenError, UnauthorizedError, NotFoundError } from '../../../../src/shared/domain/errors/index.js';

const secreto = 'seguridad-identidad-expediente-32chars!';

const usuarioCiudadanoA = '11111111-1111-4111-8111-111111111111';
const personaIdA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dniA = '45678901';

const usuarioCiudadanoB = '22222222-2222-4222-8222-222222222222';
const personaIdB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const dniB = '87654321';

const usuarioAdmin = '99999999-9999-4999-8999-999999999999';
const personaIdAdmin = '99999999-aaaa-4aaa-8aaa-999999999999';

const usuarioMesaPartes = '88888888-8888-4888-8888-888888888888';
const personaIdMesaPartes = '88888888-aaaa-4aaa-8aaa-888888888888';

const usuarioEspecialista = '77777777-7777-4777-8777-777777777777';
const personaIdEspecialista = '77777777-aaaa-4aaa-8aaa-777777777777';

const expedientePropioId = 'eeeeeeee-1111-4eee-8eee-111111111111';
const cutPropio = 'EXP-2026-000100';

const expedienteHistoricoId = 'eeeeeeee-2222-4eee-8eee-222222222222';
const cutHistorico = 'EXP-2026-000200';

describe('SIGD 2026 — Seguridad de Identidad, Casilla y Protección BOLA de Expedientes', () => {
  const anteriorJwt = process.env.AUTH_JWT_SECRET;

  beforeAll(() => {
    process.env.AUTH_JWT_SECRET = secreto;
  });

  afterAll(() => {
    if (anteriorJwt === undefined) delete process.env.AUTH_JWT_SECRET;
    else process.env.AUTH_JWT_SECRET = anteriorJwt;
  });

  const tokenA = () => firmarTokenAcceso({ sub: usuarioCiudadanoA, roles: ['CIUDADANO'], secreto });
  const tokenB = () => firmarTokenAcceso({ sub: usuarioCiudadanoB, roles: ['CIUDADANO'], secreto });
  const tokenAdminFunc = () => firmarTokenAcceso({ sub: usuarioAdmin, roles: ['ADMINISTRADOR'], secreto });
  const tokenMesa = () => firmarTokenAcceso({ sub: usuarioMesaPartes, roles: ['MESA_PARTES'], secreto });
  const tokenEspecialista = () => firmarTokenAcceso({ sub: usuarioEspecialista, roles: ['ESPECIALISTA'], secreto });

  describe('PRIORIDAD 1 — Identidad Ciudadana y Registro Seguro', () => {
    let mockPool: any;
    let mockClient: any;
    let mockQuery: any;

    beforeEach(() => {
      mockQuery = vi.fn();
      mockClient = {
        query: mockQuery,
        release: vi.fn(),
      };
      mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: mockQuery,
      };
    });

    it('1. Registro nuevo sin historial: crea persona, datos civiles y cuenta de usuario limpiamente', async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('sigd_auth.tipos_documento')) {
          return { rows: [{ id: 'tipo-dni' }] };
        }
        if (sql.includes('AS existe')) {
          return { rows: [{ existe: false, usuario_existente: false }] };
        }
        if (sql.includes('SELECT id_persona::text AS id_persona FROM sigd_auth.persona')) {
          // Persona nueva
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO sigd_auth.persona\n') || sql.includes('INSERT INTO sigd_auth.persona ')) {
          return { rows: [{ id: 'persona-nueva-uuid' }] };
        }
        if (sql.includes('INSERT INTO sigd_auth.persona_natural')) {
          return { rows: [{ id_persona: 'persona-nueva-uuid' }] };
        }
        if (sql.includes('INSERT INTO sigd_auth.cuenta_usuario')) {
          return { rows: [{ id: 'usuario-nuevo-uuid' }] };
        }
        if (sql.includes('sigd_org.usuario_rol')) {
          return { rows: [{ id: 'usuario-nuevo-uuid' }] };
        }
        if (sql.includes('sigd_auth.consentimiento_datos')) {
          return { rows: [{ id: 'consentimiento-uuid' }] };
        }
        return { rows: [] };
      });

      const ubigeoMock = { contieneDistrito: vi.fn().mockResolvedValue(true) } as any;
      const servicio = new RegistroCiudadanoService(mockPool, ubigeoMock);

      const res = await servicio.registrarCiudadano(
        {
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          dni: '11223344',
          nombres: 'Roberto',
          apellidoPaterno: 'Gómez',
          apellidoMaterno: 'Bolaños',
          correo: 'roberto@example.com',
          celular: '987654321',
          ubigeoDistrito: '250101',
          direccion: 'Av. Las Palmas 123',
          username: 'roberto.gomez',
          password: 'Password123#',
          consentimientoDatos: true,
          aceptaNotificaciones: true,
        },
        '192.168.1.50',
      );

      expect(res.mensaje).toBe('Registro exitoso');
      expect(res.idPersona).toBe('persona-nueva-uuid');
    });

    it('2. DNI preexistente sin identidad acreditada: preserva padrón civil inalterado y confina contacto a la cuenta', async () => {
      let updateCivilQueries: string[] = [];
      let insertCuentaQueries: any[] = [];
      let insertPerfilQueries: any[] = [];

      mockQuery.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('sigd_auth.tipos_documento')) {
          return { rows: [{ id: 'tipo-dni' }] };
        }
        if (sql.includes('AS existe')) {
          return { rows: [{ existe: false, usuario_existente: false }] };
        }
        if (sql.includes('SELECT id_persona::text AS id_persona FROM sigd_auth.persona')) {
          // Persona existe de trámite físico previo
          return { rows: [{ id_persona: 'persona-previa-uuid' }] };
        }
        if (sql.includes('FROM sigd_auth.persona_natural')) {
          return {
            rows: [
              {
                id_persona: 'persona-previa-uuid',
                nombres: 'María',
                apellidos: 'Flores Chávez',
                nombre_completo: 'María Flores Chávez',
              },
            ],
          };
        }
        if (sql.includes('UPDATE sigd_auth.persona_natural') || sql.includes('UPDATE sigd_auth.persona')) {
          updateCivilQueries.push(sql);
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO sigd_auth.cuenta_usuario')) {
          insertCuentaQueries.push({ sql, params });
          return { rows: [{ id: 'usuario-nuevo-uuid' }] };
        }
        if (sql.includes('INSERT INTO sigd_auth.perfil_usuario')) {
          insertPerfilQueries.push({ sql, params });
          return { rows: [{ id: 'usuario-nuevo-uuid' }] };
        }
        if (sql.includes('sigd_org.usuario_rol')) {
          return { rows: [{ id: 'usuario-nuevo-uuid' }] };
        }
        return { rows: [] };
      });

      const ubigeoMock = { contieneDistrito: vi.fn().mockResolvedValue(true) } as any;
      const servicio = new RegistroCiudadanoService(mockPool, ubigeoMock);

      const res = await servicio.registrarCiudadano(
        {
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          dni: '77889900',
          nombres: 'María',
          apellidoPaterno: 'Flores',
          apellidoMaterno: 'Chávez',
          correo: 'maria.flores@example.com',
          celular: '999888777',
          ubigeoDistrito: '250101',
          direccion: 'Jr. Ucayali 456',
          username: 'maria.flores',
          password: 'Password123#',
          consentimientoDatos: true,
          aceptaNotificaciones: true,
        },
        '192.168.1.51',
      );

      expect(res.idPersona).toBe('persona-previa-uuid');
      expect(res.mensaje).toBe('Registro exitoso');

      // Seguridad Residual: El padrón civil (persona y persona_natural) NO es mutado
      // Ningún campo (ni existente ni NULL) es completado o sobreescrito por el registro no verificado
      expect(updateCivilQueries.length).toBe(0);

      // Los datos declarados se conservan exclusivamente en la cuenta y perfil del solicitante
      expect(insertCuentaQueries.length).toBe(1);
      expect(insertCuentaQueries[0].params[2]).toBe('maria.flores@example.com');
      expect(insertPerfilQueries.length).toBe(1);
      expect(insertPerfilQueries[0].params[1]).toBe('999888777');
    });

    it('3. Intento de suplantación: rechaza registro con IDENTITY_MISMATCH si los nombres difieren del registro previo', async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('sigd_auth.tipos_documento')) {
          return { rows: [{ id: 'tipo-dni' }] };
        }
        if (sql.includes('AS existe')) {
          return { rows: [{ existe: false, usuario_existente: false }] };
        }
        if (sql.includes('SELECT id_persona::text AS id_persona FROM sigd_auth.persona')) {
          return { rows: [{ id_persona: 'persona-juan-uuid' }] };
        }
        if (sql.includes('FROM sigd_auth.persona_natural')) {
          return {
            rows: [
              {
                id_persona: 'persona-juan-uuid',
                nombres: 'Juan Alberto',
                apellidos: 'Pérez García',
                nombre_completo: 'Juan Alberto Pérez García',
              },
            ],
          };
        }
        return { rows: [] };
      });

      const ubigeoMock = { contieneDistrito: vi.fn().mockResolvedValue(true) } as any;
      const servicio = new RegistroCiudadanoService(mockPool, ubigeoMock);

      await expect(
        servicio.registrarCiudadano(
          {
            tipoPersona: 'NATURAL',
            tipoDocumento: 'DNI',
            dni: '45678901',
            nombres: 'Carlos', // Nombre divergente (impostor)
            apellidoPaterno: 'López',
            apellidoMaterno: 'Malory',
            correo: 'malory@attacker.com',
            celular: '999000111',
            ubigeoDistrito: '250101',
            direccion: 'Calle Falsa 123',
            username: 'carlos.malory',
            password: 'Password123#',
            consentimientoDatos: true,
          aceptaNotificaciones: true,
          },
          '10.0.0.99',
        ),
      ).rejects.toThrowError(ConflictError);
    });
  });

  describe('PRIORIDAD 2 — Protección BOLA en GET /api/v1/tramites/expedientes/:expedienteId', () => {
    let mockPool: any;
    let mockQuery: any;
    let app: any;
    let especialistaTieneCompetencia = false;

    beforeEach(() => {
      especialistaTieneCompetencia = false;
      mockQuery = vi.fn(async (sql: string, params: any[] = []) => {
        // Consulta expediente en sigd_tra.expediente
        if (sql.includes('FROM sigd_tra.expediente') && sql.includes('WHERE expediente_id = $1::uuid')) {
          const id = params[0];
          if (id === expedientePropioId) {
            return {
              rows: [
                {
                  expediente_id: expedientePropioId,
                  solicitante_id: personaIdA,
                  id_usuario_creador: usuarioCiudadanoA,
                  codigo_expediente: cutPropio,
                  area_destino_id: '11111111-2222-4333-8444-555555555555',
                },
              ],
              rowCount: 1,
            };
          }
          if (id === expedienteHistoricoId) {
            return {
              rows: [
                {
                  expediente_id: expedienteHistoricoId,
                  solicitante_id: personaIdA,
                  id_usuario_creador: null, // Radicado sin cuenta
                  codigo_expediente: cutHistorico,
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }

        // Consulta de detalle para RadicacionVirtualService.obtenerDetalleExpediente
        if (sql.includes('FROM sigd_tra.expediente e') && sql.includes('LEFT JOIN sigd_tra.tramite t')) {
          return {
            rows: [
              {
                expediente_id: expedientePropioId,
                codigo_expediente: cutPropio,
                numero: '00100',
                dni_solicitante: dniA,
                tipo_documental_id: 'd-uuid',
                solicitante_id: personaIdA,
                area_destino_id: null,
                estado: 'EN_TRAMITE',
                fecha_radicacion: new Date('2026-03-01T10:00:00Z'),
                asunto: 'Certificado de Estudios',
                canal_ingreso: 'MESA_PARTES_DIGITAL',
              },
            ],
            rowCount: 1,
          };
        }

        // Identidad del usuario autenticado desde cuenta_usuario
        if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('WHERE c.id_usuario = $1')) {
          const uid = params[0];
          if (uid === usuarioCiudadanoA) {
            return {
              rows: [
                {
                  id_persona: personaIdA,
                  activo: true,
                  correo: 'ciudadanoA@test.com',
                  nombre_completo: 'Juan Pérez',
                },
              ],
              rowCount: 1,
            };
          }
          if (uid === usuarioCiudadanoB) {
            return {
              rows: [
                {
                  id_persona: personaIdB,
                  activo: true,
                  correo: 'ciudadanoB@test.com',
                  nombre_completo: 'María Gómez',
                },
              ],
              rowCount: 1,
            };
          }
          if (uid === usuarioAdmin) {
            return {
              rows: [
                {
                  id_persona: personaIdAdmin,
                  activo: true,
                  correo: 'admin@test.com',
                  nombre_completo: 'Administrador Institucional',
                },
              ],
              rowCount: 1,
            };
          }
          if (uid === usuarioMesaPartes) {
            return {
              rows: [
                {
                  id_persona: personaIdMesaPartes,
                  activo: true,
                  correo: 'mesapartes@test.com',
                  nombre_completo: 'Operador Mesa Partes',
                },
              ],
              rowCount: 1,
            };
          }
          if (uid === usuarioEspecialista) {
            return {
              rows: [
                {
                  id_persona: personaIdEspecialista,
                  activo: true,
                  correo: 'especialista@test.com',
                  nombre_completo: 'Especialista Documentario',
                },
              ],
              rowCount: 1,
            };
          }
        }

        // Verificación de competencia de área / custodia para roles confinados (ESPECIALISTA)
        if (sql.includes('sigd_auth.perfil_usuario p') && sql.includes('sigd_rut.expediente_asignacion ea')) {
          return { rows: [{ asignado: especialistaTieneCompetencia }], rowCount: 1 };
        }

        // Verificación de vinculación aprobada
        if (sql.includes('FROM sigd_tra.solicitud_vinculacion_expediente')) {
          return { rows: [], rowCount: 0 };
        }

        // Verificación de representación legal
        if (sql.includes('FROM sigd_auth.representacion_legal')) {
          return { rows: [], rowCount: 0 };
        }

        // Tupa vinculo
        if (sql.includes('FROM sigd_doc.expediente_tupa_vinculo')) {
          return { rows: [], rowCount: 0 };
        }

        return { rows: [], rowCount: 0 };
      });

      mockPool = {
        query: mockQuery,
        connect: vi.fn(async () => ({
          query: mockQuery,
          release: vi.fn(),
        })),
      };

      app = construirApp(mockPool as unknown as Pool);
    });

    it('4. Consulta sin autenticación es rechazada con HTTP 401 Unauthorized', async () => {
      const res = await request(app).get(`/api/v1/tramites/expedientes/${expedientePropioId}`);
      expect(res.status).toBe(401);
      expect(res.body.detail).toContain('Debe iniciar sesión');
    });

    it('5. Consulta de expediente propio por titular legítimo es autorizada con HTTP 200', async () => {
      const res = await request(app)
        .get(`/api/v1/tramites/expedientes/${expedientePropioId}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(res.body.expedienteId).toBe(expedientePropioId);
      expect(res.body.cut).toBe(cutPropio);
    });

    it('6. Consulta de expediente ajeno mediante UUID es bloqueada con HTTP 403 Forbidden (Protección BOLA)', async () => {
      const res = await request(app)
        .get(`/api/v1/tramites/expedientes/${expedientePropioId}`)
        .set('Authorization', `Bearer ${tokenB()}`); // Ciudadano B intentando ver expediente de Ciudadano A

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('protección BOLA');
    });

    it('7. DNI preexistente sin vinculación aprobada: Ciudadano A no puede ver expediente histórico sin acreditación', async () => {
      const res = await request(app)
        .get(`/api/v1/tramites/expedientes/${expedienteHistoricoId}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('protección BOLA');
    });

    it('8. Consulta autorizada por funcionario institucional (ADMINISTRADOR y MESA_PARTES) retorna HTTP 200', async () => {
      const resAdmin = await request(app)
        .get(`/api/v1/tramites/expedientes/${expedientePropioId}`)
        .set('Authorization', `Bearer ${tokenAdminFunc()}`);

      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.expedienteId).toBe(expedientePropioId);

      const resMesa = await request(app)
        .get(`/api/v1/tramites/expedientes/${expedientePropioId}`)
        .set('Authorization', `Bearer ${tokenMesa()}`);

      expect(resMesa.status).toBe(200);
      expect(resMesa.body.expedienteId).toBe(expedientePropioId);
    });

    it('9. Funcionario institucional con rol confinado (ESPECIALISTA) sin competencia de área ni custodia recibe HTTP 403 Forbidden', async () => {
      especialistaTieneCompetencia = false;
      const res = await request(app)
        .get(`/api/v1/tramites/expedientes/${expedientePropioId}`)
        .set('Authorization', `Bearer ${tokenEspecialista()}`);

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('No tiene competencia de área ni custodia asignada');
    });

    it('10. Funcionario institucional con rol confinado (ESPECIALISTA) con competencia activa de área o custodia retorna HTTP 200', async () => {
      especialistaTieneCompetencia = true;
      const res = await request(app)
        .get(`/api/v1/tramites/expedientes/${expedientePropioId}`)
        .set('Authorization', `Bearer ${tokenEspecialista()}`);

      expect(res.status).toBe(200);
      expect(res.body.expedienteId).toBe(expedientePropioId);
    });
  });

  describe('PRIORIDAD 3 — Aislamiento de Casilla Electrónica y Vinculación Aprobada', () => {
    let mockPool: any;
    let mockQuery: any;
    let app: any;

    const notifCuentaA = {
      id: 'notif-aaaa-0001-bbbb-cccccccccccc',
      usuario_id: usuarioCiudadanoA,
      persona_id: personaIdA,
      correo_destinatario: 'ciudadanoA@test.com',
      cut: cutPropio,
      asunto: 'Resolución Directoral 045-2026',
      tipo_acto: 'RESOLUCION',
      numero_documento: 'RD-045-2026',
      cuerpo: { resolucionId: 'res-001' },
      referencia: cutPropio,
      estado: 'PUESTA_A_DISPOSICION',
      fecha_deposito: new Date('2026-03-01T10:00:00Z'),
      fecha_lectura: null,
      hash_sha256: 'hash-a',
      cvd: 'CVD-001',
      id_acuse: null,
      acuse_hash_sha256: null,
      acuse_sellado_tiempo: null,
      documento_url: 'res.pdf',
      creado_en: new Date('2026-03-01T10:00:00Z'),
    };

    const notifHistoricaSinCuenta = {
      id: 'notif-hist-0002-bbbb-cccccccccccc',
      usuario_id: null, // Histórica sin cuenta
      persona_id: personaIdA,
      correo_destinatario: 'contacto.antiguo@test.com',
      cut: cutHistorico,
      asunto: 'Notificación Histórica 2024',
      tipo_acto: 'RESOLUCION',
      numero_documento: 'RD-010-2024',
      cuerpo: { resolucionId: 'res-old' },
      referencia: cutHistorico,
      estado: 'PUESTA_A_DISPOSICION',
      fecha_deposito: new Date('2024-05-10T10:00:00Z'),
      fecha_lectura: null,
      hash_sha256: 'hash-old',
      cvd: 'CVD-OLD',
      id_acuse: null,
      acuse_hash_sha256: null,
      acuse_sellado_tiempo: null,
      documento_url: 'old.pdf',
      creado_en: new Date('2024-05-10T10:00:00Z'),
    };

    beforeEach(() => {
      mockQuery = vi.fn(async (sql: string, params: any[] = []) => {
        // Datos de cuenta / persona para obtenerDestinatario
        if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('JOIN sigd_auth.persona p')) {
          const uid = params[0];
          if (uid === usuarioCiudadanoA) {
            return {
              rows: [{ nombre_completo: 'Juan Pérez', id_documento: dniA, tipo: 'NATURAL' }],
              rowCount: 1,
            };
          }
          if (uid === usuarioCiudadanoB) {
            return {
              rows: [{ nombre_completo: 'María Gómez', id_documento: dniB, tipo: 'NATURAL' }],
              rowCount: 1,
            };
          }
        }

        // Casilla bandeja count
        if (sql.includes('FROM sigd_auth.notificacion_casilla') && sql.includes('COUNT(*)')) {
          const uid = params[0];
          if (uid === usuarioCiudadanoA) {
            // Solo ve la suya propia, no la histórica sin cuenta
            return { rows: [{ total: '1' }], rowCount: 1 };
          }
          if (uid === usuarioCiudadanoB) {
            return { rows: [{ total: '0' }], rowCount: 1 };
          }
        }

        // Casilla bandeja listado
        if (sql.includes('FROM sigd_auth.notificacion_casilla') && sql.includes('LIMIT')) {
          const uid = params[0];
          if (uid === usuarioCiudadanoA) {
            return { rows: [notifCuentaA], rowCount: 1 };
          }
          if (uid === usuarioCiudadanoB) {
            return { rows: [], rowCount: 0 };
          }
        }

        return { rows: [], rowCount: 0 };
      });

      mockPool = {
        query: mockQuery,
        connect: vi.fn(async () => ({
          query: mockQuery,
          release: vi.fn(),
        })),
      };

      app = construirApp(mockPool as unknown as Pool);
    });

    it('9. Casilla personal sin herencia indebida: Ciudadano B no ve notificaciones de Ciudadano A', async () => {
      const resA = await request(app)
        .get('/api/v1/casilla/notificaciones')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(resA.status).toBe(200);
      expect(resA.body.notificaciones).toHaveLength(1);
      expect(resA.body.notificaciones[0].id).toBe(notifCuentaA.id);

      const resB = await request(app)
        .get('/api/v1/casilla/notificaciones')
        .set('Authorization', `Bearer ${tokenB()}`);

      expect(resB.status).toBe(200);
      expect(resB.body.notificaciones).toHaveLength(0);
    });

    it('10. Vinculación histórica legítima con aprobación habilita acceso a expediente y notificaciones', async () => {
      // Probar servicio de vinculación histórica
      let vinculacionEstado = 'PENDIENTE';
      let expedienteCreadorId: string | null = null;
      let notificacionUsuarioId: string | null = null;

      const mockClient = {
        query: vi.fn(async (sql: string, params: any[] = []) => {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };

          if (sql.includes('FROM sigd_tra.expediente e')) {
            return {
              rows: [
                {
                  expediente_id: expedienteHistoricoId,
                  codigo_expediente: cutHistorico,
                  solicitante_id: personaIdA,
                  id_usuario_creador: expedienteCreadorId,
                  estado: 'REGISTRADO',
                  asunto: 'Trámite Histórico',
                },
              ],
            };
          }

          if (sql.includes('FROM sigd_tra.solicitud_vinculacion_expediente')) {
            if (sql.includes('FOR UPDATE')) {
              return {
                rows: [
                  {
                    id_solicitud: 'sol-001',
                    expediente_id: expedienteHistoricoId,
                    id_usuario: usuarioCiudadanoA,
                    estado: vinculacionEstado,
                  },
                ],
              };
            }
            return { rows: [] };
          }

          if (sql.includes('INSERT INTO sigd_tra.solicitud_vinculacion_expediente')) {
            return {
              rows: [{ id_solicitud: 'sol-001', solicitado_en: new Date() }],
            };
          }

          if (sql.includes('UPDATE sigd_tra.solicitud_vinculacion_expediente')) {
            vinculacionEstado = 'APROBADA';
            return { rows: [] };
          }

          if (sql.includes('UPDATE sigd_tra.expediente')) {
            expedienteCreadorId = params[1];
            return { rows: [] };
          }

          if (sql.includes('UPDATE sigd_auth.notificacion_casilla')) {
            notificacionUsuarioId = params[1];
            return { rows: [] };
          }

          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const poolMock = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: mockClient.query,
      } as any;

      const service = new VinculacionHistoricaService(poolMock);

      // Paso A: Ciudadano solicita vinculación
      const sol = await service.solicitarVinculacion({
        idUsuario: usuarioCiudadanoA,
        idPersona: personaIdA,
        cut: cutHistorico,
        motivo: 'Trámite presentado en ventanilla física hace un año',
      });

      expect(sol.estado).toBe('PENDIENTE');
      expect(expedienteCreadorId).toBeNull(); // Aún no está vinculado

      // Paso B: Mesa de Partes aprueba formalmente la vinculación
      const res = await service.resolverSolicitud('sol-001', usuarioMesaPartes, {
        decision: 'APROBADA',
      });

      expect(res.estado).toBe('APROBADA');
      expect(expedienteCreadorId).toBe(usuarioCiudadanoA);
      expect(notificacionUsuarioId).toBe(usuarioCiudadanoA);
    });
  });
});
