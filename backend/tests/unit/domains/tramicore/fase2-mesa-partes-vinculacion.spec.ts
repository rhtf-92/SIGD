import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { MesaPartesDigitalService } from '../../../../src/domains/tramicore/mesaPartesDigital.service.js';
import { VinculacionHistoricaService } from '../../../../src/domains/tramicore/vinculacionHistorica.service.js';
import { ConsultaPublicaService } from '../../../../src/domains/tramicore/consultaPublica.service.js';
import { RegistroCiudadanoService } from '../../../../src/domains/identicore/registroCiudadano.service.js';
import { registroCiudadanoSchema } from '../../../../src/domains/identicore/registro.schemas.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../../src/shared/domain/errors/index.js';
import { PDFDocument } from 'pdf-lib';

describe('SIGD 2026 — FASE 2: Mesa Digital Pública, Persona sin Cuenta y Vinculación Histórica', () => {
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

  describe('1. Mesa de Partes Digital Pública (Radicación sin cuenta)', () => {
    it('radica trámite con id_usuario_creador = NULL y canal MESA_PARTES_DIGITAL sin crear cuenta_usuario', async () => {
      const pdf = await PDFDocument.create();
      pdf.addPage([500, 500]);
      pdf.addPage([500, 500]); // 2 páginas
      const pdfBytes = await pdf.save();
      const base64 = Buffer.from(pdfBytes).toString('base64');

      const mockQueries: string[] = [];
      const mockParams: any[] = [];

      mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
        mockQueries.push(sql);
        mockParams.push(params);

        if (sql.includes('SELECT registro_version_id, estado_validacion')) {
          return {
            rows: [{
              registro_version_id: 'a0000000-0000-0000-0000-000000000001',
              estado_validacion: 'APROBADO',
              vigencia_desde: null,
              vigencia_hasta: null,
            }],
          };
        }
        if (sql.includes('FROM sigd_doc.tupa_requisito_documental')) {
          return { rows: [] };
        }
        if (sql.includes('FROM sigd_auth.persona')) {
          // Persona nueva
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO sigd_auth.persona (tipo')) {
          return { rows: [{ id_persona: 'p0000000-0000-0000-0000-000000000001' }] };
        }
        if (sql.includes('tipo_documento WHERE vigente = TRUE')) {
          return { rows: [{ tipo_documental_id: 'd0000000-0000-0000-0000-000000000001' }] };
        }
        if (sql.includes('fn_generar_cut') || sql.includes('generar_cut_expediente')) {
          return { rows: [{ cut: 'EXP-2026-000050' }] };
        }
        if (sql.includes('INSERT INTO sigd_tra.expediente')) {
          return { rows: [{ expediente_id: 'e0000000-0000-0000-0000-000000000001' }] };
        }
        if (sql.includes('INSERT INTO sigd_doc.expediente_tupa_vinculo')) {
          return { rows: [{ vinculo_id: 'v0000000-0000-0000-0000-000000000001' }] };
        }
        if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) {
          return { rows: [{ documento_adjunto_id: 'doc-0001' }] };
        }
        if (sql.includes('SELECT MAX(folio_fin)')) {
          return { rows: [{ max_folio: 0 }] };
        }
        if (sql.includes('costoOficial') || sql.includes('tupa_registro_version')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const service = new MesaPartesDigitalService(mockPool, async () => []);
      const input = {
        tipoPersona: 'NATURAL' as const,
        tipoDocumento: 'DNI' as const,
        numeroDocumento: '77889900',
        nombres: 'María',
        apellidoPaterno: 'Flores',
        apellidoMaterno: 'Chávez',
        correo: 'maria.flores@example.com',
        celular: '987654321',
        direccion: 'Av. Ucayali 456',
        asunto: 'Solicitud de certificado de estudios presencial/digital',
        registroVersionId: 'a0000000-0000-0000-0000-000000000001',
        documentos: [{
          nombreArchivo: 'requisito_principal.pdf',
          mimeType: 'application/pdf',
          base64Content: base64,
        }],
      };

      const resultado = await service.radicarDigital(input);

      expect(resultado.cut).toBe('EXP-2026-000050');
      expect(resultado.totalFolios).toBe(2);
      expect(resultado.trackingUrl).toContain('EXP-2026-000050');
      expect(resultado.trackingUrl).toContain('77889900');

      // Verificar que el insert de expediente tuvo NULL en id_usuario_creador
      const insertExpQuery = mockQueries.find((q) => q.includes('INSERT INTO sigd_tra.expediente'));
      expect(insertExpQuery).toBeDefined();
      expect(insertExpQuery).toContain('id_usuario_creador');
      expect(insertExpQuery).toContain('NULL');

      // Verificar que el asiento tiene canal MESA_PARTES_DIGITAL
      const insertAsientoQuery = mockQueries.find((q) => q.includes('INSERT INTO sigd_tra.asiento_registro'));
      expect(insertAsientoQuery).toBeDefined();
      expect(insertAsientoQuery).toContain('MESA_PARTES_DIGITAL');

      // Verificar que NUNCA se intentó insertar en cuenta_usuario
      const insertCuenta = mockQueries.find((q) => q.includes('sigd_auth.cuenta_usuario'));
      expect(insertCuenta).toBeUndefined();
    });
  });

  describe('2. Consulta Pública Segura (Tracking con Doble Factor CUT + Documento)', () => {
    it('rechaza consulta si el documento de identidad no coincide con el solicitante', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          cut: 'EXP-2026-000099',
          anio_fiscal: 2026,
          estado_tramite: 'REGISTRADO',
          tipo_tramite: 'CERTIFICADO DE ESTUDIOS',
          asunto: 'Solicitud formal',
          fecha_envio_real: new Date(),
          fecha_radicacion_legal: new Date(),
          fuera_de_horario: false,
          canal_recepcion: 'MESA_PARTES_DIGITAL',
          total_folios: 3,
          numero_documento: '44556677',
          nombres: 'Juan',
          apellido_paterno: 'Pérez',
          apellido_materno: 'Gómez',
          area_actual: 'Mesa de Partes',
          estado_pago: 'PAGADO',
        }],
      });

      const consultaService = new ConsultaPublicaService(mockPool);

      await expect(
        consultaService.consultarPorCut({
          cut: 'EXP-2026-000099',
          documento: '99999999', // Documento incorrecto
        })
      ).rejects.toThrowError(NotFoundError);
    });

    it('retorna información pública higienizada con área amigable y paso siguiente cuando el documento coincide', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          cut: 'EXP-2026-000099',
          anio_fiscal: 2026,
          estado_tramite: 'REGISTRADO',
          tipo_tramite: 'CERTIFICADO DE ESTUDIOS',
          asunto: 'Solicitud formal',
          fecha_envio_real: new Date('2026-03-10T10:00:00Z'),
          fecha_radicacion_legal: new Date('2026-03-10T10:00:00Z'),
          fuera_de_horario: false,
          canal_recepcion: 'MESA_PARTES_DIGITAL',
          total_folios: 3,
          numero_documento: '44556677',
          nombres: 'Juan',
          apellido_paterno: 'Pérez',
          apellido_materno: 'Gómez',
          area_actual: 'Subdirección Académica',
          estado_pago: 'PAGADO',
        }],
      });

      const consultaService = new ConsultaPublicaService(mockPool);
      const res = await consultaService.consultarPorCut({
        cut: 'EXP-2026-000099',
        documento: '44556677',
      });

      expect(res.cut).toBe('EXP-2026-000099');
      expect(res.areaActual).toBe('Subdirección Académica');
      expect(res.estadoPago).toBe('PAGADO');
      expect(res.pasoSiguiente).toContain('Mesa de Partes');
      expect(res.administrado.documentoEnmascarado).toBe('44***677');
      expect(res.administrado.nombreEnmascarado).toBe('J*** P**** G****');
    });
  });

  describe('3. Reutilización de Persona en Registro de Ciudadano y Anti-Autolink', () => {
    it('reutiliza persona existente sin arrojar CITIZEN_ALREADY_EXISTS si la persona no tiene cuenta_usuario', async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('sigd_auth.tipos_documento')) {
          return { rows: [{ id: 'tipo-dni' }] };
        }
        if (sql.includes('AS existe')) {
          // No existe cuenta duplicada con ese username o correo, y la persona existente NO tiene cuenta
          return { rows: [{ existe: false, usuario_existente: false }] };
        }
        if (sql.includes('SELECT id_persona::text AS id_persona FROM sigd_auth.persona')) {
          // La persona ya existe del trámite presencial previo
          return { rows: [{ id_persona: 'p-existente-123' }] };
        }
        if (sql.includes('SELECT id_persona::text FROM sigd_auth.persona_natural')) {
          return { rows: [{ id_persona: 'p-existente-123' }] };
        }
        if (sql.includes('INSERT INTO sigd_auth.cuenta_usuario')) {
          return { rows: [{ id: 'user-nuevo-456' }] };
        }
        if (sql.includes('usuario_rol') || sql.includes('rol_sistema')) {
          return { rows: [{ id: 'user-nuevo-456' }] };
        }
        return { rows: [] };
      });

      const ubigeoMock = { contieneDistrito: vi.fn().mockResolvedValue(true) } as any;
      const registroService = new RegistroCiudadanoService(mockPool, ubigeoMock);

      const parsedData = registroCiudadanoSchema.parse({
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        dni: '77889900',
        nombres: 'María',
        apellidoPaterno: 'Flores',
        apellidoMaterno: 'Chávez',
        correo: 'maria.flores@example.com',
        celular: '987654321',
        ubigeoDistrito: '250101',
        direccion: 'Av. Ucayali 456',
        username: 'maria.flores',
        password: 'Password123#',
        consentimientoDatos: true,
      });

      const res = await registroService.registrarCiudadano(parsedData, null);

      expect(res.idPersona).toBe('p-existente-123');
      expect(res.mensaje).toBe('Registro exitoso');
    });
  });

  describe('4. Solicitud y Aprobación de Vinculación Histórica', () => {
    it('solicitarVinculacion rechaza BOLA si el CUT pertenece a otro solicitante', async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM sigd_tra.expediente')) {
          return {
            rows: [{
              expediente_id: 'exp-999',
              codigo_expediente: 'EXP-2026-000099',
              solicitante_id: 'persona-otrapersona', // Pertenece a otra persona
              id_usuario_creador: null,
              estado: 'REGISTRADO',
              asunto: 'Trámite ajeno',
            }],
          };
        }
        return { rows: [] };
      });

      const service = new VinculacionHistoricaService(mockPool);

      await expect(
        service.solicitarVinculacion({
          idUsuario: 'user-ciudadano-1',
          idPersona: 'persona-ciudadano-1',
          cut: 'EXP-2026-000099',
        })
      ).rejects.toThrowError(ForbiddenError);
    });

    it('solicitarVinculacion crea solicitud PENDIENTE si el solicitante es el legítimo titular', async () => {
      const queries: string[] = [];
      mockQuery.mockImplementation(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('FROM sigd_tra.expediente')) {
          return {
            rows: [{
              expediente_id: 'exp-100',
              codigo_expediente: 'EXP-2026-000100',
              solicitante_id: 'persona-ciudadano-1', // Coincide con titular
              id_usuario_creador: null,
              estado: 'REGISTRADO',
              asunto: 'Trámite propio presentado sin cuenta',
            }],
          };
        }
        if (sql.includes('FROM sigd_tra.solicitud_vinculacion_expediente')) {
          return { rows: [] }; // No hay solicitud previa
        }
        if (sql.includes('INSERT INTO sigd_tra.solicitud_vinculacion_expediente')) {
          return {
            rows: [{
              id_solicitud: 'sol-vinculo-1',
              solicitado_en: new Date(),
            }],
          };
        }
        return { rows: [] };
      });

      const service = new VinculacionHistoricaService(mockPool);
      const res = await service.solicitarVinculacion({
        idUsuario: 'user-ciudadano-1',
        idPersona: 'persona-ciudadano-1',
        cut: 'EXP-2026-000100',
        motivo: 'Presenté este trámite presencialmente antes de tener cuenta',
      });

      expect(res.idSolicitud).toBe('sol-vinculo-1');
      expect(res.estado).toBe('PENDIENTE');
      expect(res.cut).toBe('EXP-2026-000100');
    });

    it('resolverSolicitud (Mesa de Partes) aprueba la solicitud y actualiza id_usuario_creador en el expediente', async () => {
      const executed: string[] = [];
      mockQuery.mockImplementation(async (sql: string) => {
        executed.push(sql);
        if (sql.includes('sigd_tra.solicitud_vinculacion_expediente')) {
          return {
            rows: [{
              id_solicitud: 'sol-vinculo-1',
              expediente_id: 'exp-100',
              id_usuario: 'user-ciudadano-1',
              estado: 'PENDIENTE',
            }],
          };
        }
        return { rows: [] };
      });

      const service = new VinculacionHistoricaService(mockPool);
      const res = await service.resolverSolicitud('sol-vinculo-1', 'operador-mesa-1', {
        decision: 'APROBADA',
      });

      expect(res.estado).toBe('APROBADA');

      // Verificar que se actualizó solicitud_vinculacion_expediente a APROBADA
      const updateSol = executed.find((q) => q.includes('UPDATE sigd_tra.solicitud_vinculacion_expediente'));
      expect(updateSol).toContain("estado = 'APROBADA'");

      // Verificar que se actualizó expediente.id_usuario_creador
      const updateExp = executed.find((q) => q.includes('UPDATE sigd_tra.expediente'));
      expect(updateExp).toContain('id_usuario_creador = $2::uuid');
    });

    it('resolverSolicitud rechaza si se elige RECHAZADA sin motivo', async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('sigd_tra.solicitud_vinculacion_expediente')) {
          return {
            rows: [{
              id_solicitud: 'sol-vinculo-1',
              expediente_id: 'exp-100',
              id_usuario: 'user-ciudadano-1',
              estado: 'PENDIENTE',
            }],
          };
        }
        return { rows: [] };
      });

      const service = new VinculacionHistoricaService(mockPool);
      await expect(
        service.resolverSolicitud('sol-vinculo-1', 'operador-mesa-1', {
          decision: 'RECHAZADA',
          motivoRechazo: '', // Falta motivo
        })
      ).rejects.toThrowError(ValidationError);
    });
  });
});
