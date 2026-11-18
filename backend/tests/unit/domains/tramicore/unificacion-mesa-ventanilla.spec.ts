import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import express from 'express';
import request from 'supertest';
import { MesaPartesDigitalService } from '../../../../src/domains/tramicore/mesaPartesDigital.service.js';
import { VentanillaPresencialService } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';
import { TupaVersionRepository } from '../../../../src/domains/tramicore/tupaVersion.repository.js';
import { ConflictError, ForbiddenError, ValidationError } from '../../../../src/shared/domain/errors/index.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import { PDFDocument } from 'pdf-lib';

describe('SIGD 2026 — Unificación Digital y Blindaje de Ventanilla Presencial', () => {
  let mockPool: Pool;
  let mockClient: PoolClient;
  let mockQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = vi.fn();
    mockClient = {
      query: mockQuery,
      release: vi.fn(),
    } as unknown as PoolClient;
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: mockQuery,
    } as unknown as Pool;
  });

  async function generarPdfBase64(paginas = 1): Promise<string> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < paginas; i++) {
      doc.addPage([500, 500]);
    }
    const bytes = await doc.save();
    return Buffer.from(bytes).toString('base64');
  }

  describe('1. Mesa de Partes Digital Adaptativa (Anónimo vs Autenticado)', () => {
    it('Ciudadano anónimo: radica con id_usuario_creador = NULL y canal MESA_VIRTUAL', async () => {
      const base64 = await generarPdfBase64(1);
      const mockQueries: string[] = [];

      mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
        mockQueries.push(sql);
        if (sql.includes('sigd_doc.tupa_registro_version') || sql.includes('estado_validacion')) {
          return {
            rows: [{
              registro_version_id: 'a0000000-0000-4000-8000-000000000001',
              estado_validacion: 'APROBADO',
              vigencia_desde: null,
              vigencia_hasta: null,
              id_procedimiento: 'p0000000-0000-4000-8000-000000000001',
              codigo_ref: 'p1-fila-05',
              denominacion: 'Certificado de Estudios',
              genera_expediente: true,
              activo: true,
              categoria: 'PROCEDIMIENTO_APROBADO',
              unidad_receptora_id: 'a0000000-0000-4000-8000-000000000002',
            }],
          };
        }
        if (sql.includes('FROM sigd_doc.tupa_requisito_documental')) {
          return { rows: [] };
        }
        if (sql.includes('FROM sigd_auth.persona WHERE tipo')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO sigd_auth.persona (tipo')) {
          return { rows: [{ id_persona: 'b0000000-0000-0000-0000-000000000001' }] };
        }
        if (sql.includes('tipo_documento WHERE vigente = TRUE')) {
          return { rows: [{ tipo_documental_id: 'c0000000-0000-0000-0000-000000000001' }] };
        }
        if (sql.includes('sigd_tra.fn_generar_cut') || sql.includes('sigd_tra.generar_cut_expediente')) {
          return { rows: [{ cut: 'EXP-2026-000100' }] };
        }
        if (sql.includes('INSERT INTO sigd_tra.expediente')) {
          return { rows: [{ expediente_id: 'e0000000-0000-0000-0000-000000000001' }] };
        }
        if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) {
          return { rows: [{ documento_adjunto_id: 'adj00000-0000-0000-0000-000000000001' }] };
        }
        if (sql.includes('obtenerContextoExpedienteParaPago')) {
          return { rows: [{ costoOficial: 0 }] };
        }
        return { rows: [] };
      });

      const service = new MesaPartesDigitalService(mockPool, async () => []);
      const resultado = await service.radicarDigital({
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        numeroDocumento: '44556677',
        nombres: 'Juan',
        apellidoPaterno: 'Perez',
        correo: 'juan.perez@example.com',
        celular: '987654321',
        asunto: 'Solicitud de certificado de estudios',
        registroVersionId: 'a0000000-0000-4000-8000-000000000001',
        documentos: [{
          nombreArchivo: 'solicitud.pdf',
          mimeType: 'application/pdf',
          base64Content: base64,
          totalPaginas: 1,
        }],
      }, new Date(), undefined, undefined, undefined);

      expect(resultado.cut).toBe('EXP-2026-000100');
      const insertExp = mockQueries.find((q) => q.includes('INSERT INTO sigd_tra.expediente'));
      expect(insertExp).toBeDefined();
      expect(insertExp).toContain('NULL');

      const insertAsiento = mockQueries.find((q) => q.includes('INSERT INTO sigd_tra.asiento_registro'));
      expect(insertAsiento).toBeDefined();
      expect(insertAsiento).toContain('MESA_VIRTUAL');
    });

    it('Ciudadano autenticado: radica vinculando id_usuario_creador y personaAutenticadaId', async () => {
      const base64 = await generarPdfBase64(1);
      const mockQueries: string[] = [];
      const mockParams: any[] = [];

      mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
        mockQueries.push(sql);
        mockParams.push(params);
        if (sql.includes('sigd_doc.tupa_registro_version') || sql.includes('estado_validacion')) {
          return {
            rows: [{
              registro_version_id: 'a0000000-0000-4000-8000-000000000001',
              estado_validacion: 'APROBADO',
              vigencia_desde: null,
              vigencia_hasta: null,
              id_procedimiento: 'p0000000-0000-4000-8000-000000000001',
              codigo_ref: 'p1-fila-05',
              denominacion: 'Certificado de Estudios',
              genera_expediente: true,
              activo: true,
              categoria: 'PROCEDIMIENTO_APROBADO',
              unidad_receptora_id: 'a0000000-0000-4000-8000-000000000002',
            }],
          };
        }
        if (sql.includes('FROM sigd_doc.tupa_requisito_documental')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT id_persona::text AS id_persona, id_documento FROM sigd_auth.persona WHERE id_persona')) {
          return { rows: [{ id_persona: 'b0000000-0000-0000-0000-000000000099', id_documento: '44556677' }] };
        }
        if (sql.includes('tipo_documento WHERE vigente = TRUE')) {
          return { rows: [{ tipo_documental_id: 'c0000000-0000-0000-0000-000000000001' }] };
        }
        if (sql.includes('sigd_tra.fn_generar_cut') || sql.includes('sigd_tra.generar_cut_expediente')) {
          return { rows: [{ cut: 'EXP-2026-000101' }] };
        }
        if (sql.includes('INSERT INTO sigd_tra.expediente')) {
          return { rows: [{ expediente_id: 'e0000000-0000-0000-0000-000000000002' }] };
        }
        if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) {
          return { rows: [{ documento_adjunto_id: 'adj00000-0000-0000-0000-000000000002' }] };
        }
        return { rows: [] };
      });

      const service = new MesaPartesDigitalService(mockPool, async () => []);
      const resultado = await service.radicarDigital(
        {
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: '44556677',
          nombres: 'Juan Autenticado',
          apellidoPaterno: 'Perez',
          correo: 'juan.auth@example.com',
          celular: '987654321',
          asunto: 'Solicitud formal vinculada',
          registroVersionId: 'a0000000-0000-4000-8000-000000000001',
          documentos: [{
            nombreArchivo: 'solicitud.pdf',
            mimeType: 'application/pdf',
            base64Content: base64,
            totalPaginas: 1,
          }],
        },
        new Date(),
        undefined,
        'u0000000-0000-0000-0000-000000000077', // idUsuarioCreador
        'b0000000-0000-0000-0000-000000000099', // personaAutenticadaId
      );

      expect(resultado.cut).toBe('EXP-2026-000101');
      const insertExpIdx = mockQueries.findIndex((q) => q.includes('INSERT INTO sigd_tra.expediente'));
      expect(insertExpIdx).toBeGreaterThanOrEqual(0);
      const params = mockParams[insertExpIdx];
      expect(params).toContain('u0000000-0000-0000-0000-000000000077');
      expect(params).toContain('b0000000-0000-0000-0000-000000000099');
    });
  });

  describe('2. Blindaje de Ventanilla Presencial y Rechazo de ACTUACION_INTERNA', () => {
    it('validarElegibilidadRadicacion rechaza ACTUACION_INTERNA con ConflictError', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          registro_version_id: 'd2c1972b-b0bc-4130-9aed-978d973f369e',
          estado_validacion: 'APROBADO',
          vigencia_desde: null,
          vigencia_hasta: null,
          id_procedimiento: 'p-interna-01',
          codigo_ref: 'p1-fila-01',
          denominacion: 'Prácticas Iniciales',
          genera_expediente: false,
          activo: true,
          unidad_receptora_id: null,
          categoria: 'ACTUACION_INTERNA',
        }],
      });

      const repo = new TupaVersionRepository(mockPool);
      await expect(
        repo.validarElegibilidadRadicacion('d2c1972b-b0bc-4130-9aed-978d973f369e')
      ).rejects.toThrow(ConflictError);
    });

    it('VentanillaPresencialService rechaza radicación de ACTUACION_INTERNA (Prácticas / Colación)', async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('tipo_documento WHERE vigente = TRUE')) {
          return { rows: [{ tipo_documental_id: 'c0000000-0000-0000-0000-000000000001' }] };
        }
        if (sql.includes('sigd_doc.tupa_registro_version')) {
          return {
            rows: [{
              registro_version_id: 'd2c1972b-b0bc-4130-9aed-978d973f369e',
              estado_validacion: 'APROBADO',
              vigencia_desde: null,
              vigencia_hasta: null,
              id_procedimiento: 'p-interna-01',
              codigo_ref: 'p1-fila-01',
              denominacion: 'Prácticas Iniciales',
              genera_expediente: true,
              activo: true,
              categoria: 'ACTUACION_INTERNA',
            }],
          };
        }
        if (sql.includes('FROM sigd_doc.tupa_procedimiento WHERE registro_version_id')) {
          return {
            rows: [{
              categoria: 'ACTUACION_INTERNA',
              denominacion: 'Prácticas Iniciales',
              codigo_ref: 'p1-fila-01',
            }],
          };
        }
        return { rows: [] };
      });

      const ventanillaService = new VentanillaPresencialService(mockPool);
      await expect(
        ventanillaService.registrarExpedienteVentanilla({
          tipoDocumento: 'DNI',
          numeroDocumento: '44556677',
          datosRemitente: 'Carlos Lopez',
          asunto: 'Intento de radicar prácticas iniciales',
          registroVersionId: 'd2c1972b-b0bc-4130-9aed-978d973f369e',
          idOperadorVentanilla: 'op000000-0000-0000-0000-000000000001',
          foliosTotales: 1,
        })
      ).rejects.toThrow(ConflictError);
    });

    it('MesaPartesDigitalService rechaza radicación externa de ACTUACION_INTERNA', async () => {
      const base64 = await generarPdfBase64(1);
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('sigd_doc.tupa_registro_version')) {
          return {
            rows: [{
              registro_version_id: 'd2c1972b-b0bc-4130-9aed-978d973f369e',
              estado_validacion: 'APROBADO',
              vigencia_desde: null,
              vigencia_hasta: null,
              id_procedimiento: 'p-interna-01',
              codigo_ref: 'p1-fila-01',
              denominacion: 'Prácticas Iniciales',
              genera_expediente: false,
              activo: true,
              categoria: 'ACTUACION_INTERNA',
            }],
          };
        }
        return { rows: [] };
      });

      const service = new MesaPartesDigitalService(mockPool, async () => []);
      await expect(
        service.radicarDigital({
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: '44556677',
          nombres: 'Estudiante',
          apellidoPaterno: 'Demo',
          correo: 'estudiante@example.com',
          asunto: 'Intento de radicar prácticas por web',
          registroVersionId: 'd2c1972b-b0bc-4130-9aed-978d973f369e',
          documentos: [{
            nombreArchivo: 'solicitud.pdf',
            mimeType: 'application/pdf',
            base64Content: base64,
            totalPaginas: 1,
          }],
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('3. Seguridad HTTP en /tramites/mesa-partes-digital (Contextos, Fail-Closed y Anti-Suplantación)', () => {
    const SECRETO = 'super-secret-test-key-32-chars-long!';
    const USUARIO_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
    const PERSONA_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
    const DNI_CORRECTO = '44556677';
    let app: express.Express;
    const oldSecret = process.env.AUTH_JWT_SECRET;

    beforeEach(async () => {
      process.env.AUTH_JWT_SECRET = SECRETO;
      const base64Pdf = await generarPdfBase64(1);

      mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('sigd_auth.cuenta_usuario c') && sql.includes('sigd_auth.persona p')) {
          if (params?.[0] === USUARIO_ID) {
            return {
              rows: [{
                id_persona: PERSONA_ID,
                activo: true,
                id_documento: DNI_CORRECTO,
              }],
            };
          }
          return { rows: [] };
        }
        if (sql.includes('sigd_doc.tupa_registro_version') || sql.includes('estado_validacion')) {
          return {
            rows: [{
              registro_version_id: 'a0000000-0000-4000-8000-000000000001',
              estado_validacion: 'APROBADO',
              vigencia_desde: null,
              vigencia_hasta: null,
              id_procedimiento: 'p0000000-0000-4000-8000-000000000001',
              codigo_ref: 'p1-fila-05',
              denominacion: 'Certificado de Estudios',
              genera_expediente: true,
              activo: true,
              categoria: 'PROCEDIMIENTO_APROBADO',
              unidad_receptora_id: 'a0000000-0000-4000-8000-000000000002',
            }],
          };
        }
        if (sql.includes('FROM sigd_doc.tupa_requisito_documental')) return { rows: [] };
        if (sql.includes('SELECT id_persona::text AS id_persona, id_documento FROM sigd_auth.persona')) {
          return { rows: [{ id_persona: PERSONA_ID, id_documento: DNI_CORRECTO }] };
        }
        if (sql.includes('FROM sigd_auth.persona WHERE tipo')) {
          return { rows: [{ id_persona: PERSONA_ID, id_documento: DNI_CORRECTO }] };
        }
        if (sql.includes('INSERT INTO sigd_auth.persona')) {
          return { rows: [{ id_persona: PERSONA_ID }] };
        }
        if (sql.includes('tipo_documento WHERE vigente = TRUE')) {
          return { rows: [{ tipo_documental_id: 'c0000000-0000-0000-0000-000000000001' }] };
        }
        if (sql.includes('sigd_tra.fn_generar_cut')) {
          return { rows: [{ cut: 'EXP-2026-000999' }] };
        }
        if (sql.includes('INSERT INTO sigd_tra.expediente')) {
          return { rows: [{ expediente_id: 'e0000000-0000-0000-0000-000000000099' }] };
        }
        if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) {
          return { rows: [{ documento_adjunto_id: 'adj00000-0000-0000-0000-000000000099' }] };
        }
        return { rows: [] };
      });

      app = express();
      app.use(express.json({ limit: '10mb' }));
      app.use('/api/v1', crearRouterTramites(mockPool));
      app.use(errorMiddleware);
    });

    afterEach(() => {
      if (oldSecret === undefined) delete process.env.AUTH_JWT_SECRET;
      else process.env.AUTH_JWT_SECRET = oldSecret;
    });

    it('A. Visitante público: sin cabecera Authorization radica exitosamente con id_usuario_creador = NULL', async () => {
      const base64 = await generarPdfBase64(1);
      const res = await request(app)
        .post('/api/v1/tramites/mesa-partes-digital')
        .send({
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: DNI_CORRECTO,
          nombres: 'Visitante',
          apellidoPaterno: 'Publico',
          correo: 'visitante@example.com',
          asunto: 'Trámite anónimo público',
          registroVersionId: 'a0000000-0000-4000-8000-000000000001',
          documentos: [{
            nombreArchivo: 'solicitud.pdf',
            mimeType: 'application/pdf',
            base64Content: base64,
            totalPaginas: 1,
          }],
        });

      expect(res.status).toBe(201);
      expect(res.body.cut).toBe('EXP-2026-000999');
    });

    it('B. Ciudadano / Funcionario en PERSONAL: token válido con rol CIUDADANO radica vinculando a la cuenta', async () => {
      const token = firmarTokenAcceso({ sub: USUARIO_ID, roles: ['CIUDADANO'] });
      const base64 = await generarPdfBase64(1);
      const res = await request(app)
        .post('/api/v1/tramites/mesa-partes-digital')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: DNI_CORRECTO,
          nombres: 'Usuario',
          apellidoPaterno: 'Personal',
          correo: 'personal@example.com',
          asunto: 'Trámite autenticado personal',
          registroVersionId: 'a0000000-0000-4000-8000-000000000001',
          documentos: [{
            nombreArchivo: 'solicitud.pdf',
            mimeType: 'application/pdf',
            base64Content: base64,
            totalPaginas: 1,
          }],
        });

      expect(res.status).toBe(201);
      expect(res.body.cut).toBe('EXP-2026-000999');
    });

    it('C. Funcionario en INSTITUCIONAL: token con rol institucional (sin CIUDADANO) es rechazado con 403 Forbidden', async () => {
      const token = firmarTokenAcceso({ sub: USUARIO_ID, roles: ['DIRECTOR'] });
      const base64 = await generarPdfBase64(1);
      const res = await request(app)
        .post('/api/v1/tramites/mesa-partes-digital')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: DNI_CORRECTO,
          nombres: 'Director',
          apellidoPaterno: 'Prueba',
          correo: 'dir@example.com',
          asunto: 'Intento de radicar en contexto institucional',
          registroVersionId: 'a0000000-0000-4000-8000-000000000001',
          documentos: [{
            nombreArchivo: 'solicitud.pdf',
            mimeType: 'application/pdf',
            base64Content: base64,
            totalPaginas: 1,
          }],
        });

      expect(res.status).toBe(403);
      expect(res.body.detail || res.body.message).toContain('contexto PERSONAL');
    });

    it('D. Funcionario con header X-Contexto-Operacion: INSTITUCIONAL es rechazado con 403 Forbidden', async () => {
      const token = firmarTokenAcceso({ sub: USUARIO_ID, roles: ['CIUDADANO'] });
      const base64 = await generarPdfBase64(1);
      const res = await request(app)
        .post('/api/v1/tramites/mesa-partes-digital')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Contexto-Operacion', 'INSTITUCIONAL')
        .send({
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: DNI_CORRECTO,
          nombres: 'Funcionario',
          apellidoPaterno: 'Prueba',
          correo: 'func@example.com',
          asunto: 'Intento de radicación en contexto institucional',
          registroVersionId: 'a0000000-0000-4000-8000-000000000001',
          documentos: [{
            nombreArchivo: 'solicitud.pdf',
            mimeType: 'application/pdf',
            base64Content: base64,
            totalPaginas: 1,
          }],
        });

      expect(res.status).toBe(403);
      expect(res.body.detail || res.body.message).toContain('contexto PERSONAL');
    });

    it('E. Token inválido o corrupto: NO degrada silenciosamente a anónimo, responde 401 Unauthorized', async () => {
      const base64 = await generarPdfBase64(1);
      const res = await request(app)
        .post('/api/v1/tramites/mesa-partes-digital')
        .set('Authorization', 'Bearer token.corrupto.invalido')
        .send({
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: DNI_CORRECTO,
          nombres: 'Atacante',
          apellidoPaterno: 'Falso',
          correo: 'fake@example.com',
          asunto: 'Intento con token corrupto',
          registroVersionId: 'a0000000-0000-4000-8000-000000000001',
          documentos: [{
            nombreArchivo: 'solicitud.pdf',
            mimeType: 'application/pdf',
            base64Content: base64,
            totalPaginas: 1,
          }],
        });

      expect(res.status).toBe(401);
    });

    it('F. Token expirado: NO degrada silenciosamente a anónimo, responde 401 Unauthorized', async () => {
      const tokenExpirado = firmarTokenAcceso({
        sub: USUARIO_ID,
        roles: ['CIUDADANO'],
        expiraSegundos: -10, // Expirado hace 10 segundos
      });
      const base64 = await generarPdfBase64(1);
      const res = await request(app)
        .post('/api/v1/tramites/mesa-partes-digital')
        .set('Authorization', `Bearer ${tokenExpirado}`)
        .send({
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: DNI_CORRECTO,
          nombres: 'Usuario',
          apellidoPaterno: 'Expirado',
          correo: 'expirado@example.com',
          asunto: 'Intento con token expirado',
          registroVersionId: 'a0000000-0000-4000-8000-000000000001',
          documentos: [{
            nombreArchivo: 'solicitud.pdf',
            mimeType: 'application/pdf',
            base64Content: base64,
            totalPaginas: 1,
          }],
        });

      expect(res.status).toBe(401);
    });

    it('G. Anti-suplantación: DNI en payload no coincide con la identidad de la sesión -> 403 Forbidden', async () => {
      const token = firmarTokenAcceso({ sub: USUARIO_ID, roles: ['CIUDADANO'] });
      const base64 = await generarPdfBase64(1);
      const res = await request(app)
        .post('/api/v1/tramites/mesa-partes-digital')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: '99887766', // DNI diferente a DNI_CORRECTO (44556677)
          nombres: 'Identidad',
          apellidoPaterno: 'Suplantada',
          correo: 'suplantador@example.com',
          asunto: 'Intento de suplantación de identidad',
          registroVersionId: 'a0000000-0000-4000-8000-000000000001',
          documentos: [{
            nombreArchivo: 'solicitud.pdf',
            mimeType: 'application/pdf',
            base64Content: base64,
            totalPaginas: 1,
          }],
        });

      expect(res.status).toBe(403);
      expect(res.body.detail || res.body.message).toContain('No puede radicar con un documento de identidad distinto');
    });
  });
});
