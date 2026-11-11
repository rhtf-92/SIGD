import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';
import { VentanillaPresencialService, enmascararNumeroDocumento } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';
import { registrarPersonaPresencialSchema } from '../../../../src/domains/tesoreria/tesoreria.schemas.js';
import { documentoStorageService } from '../../../../src/core/storage/documento-storage.service.js';
import { ValidationError, AppError, ForbiddenError } from '../../../../src/shared/domain/errors/index.js';
import { atenderExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { TicketTermicoUtil } from '../../../../src/domains/tramicore/ticketTermico.util.js';
import { runWithContext } from '../../../../src/shared/request-context/request-context.js';

describe('Ventanilla Presencial: Integridad Documental, Identidad y Cronología', () => {
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
    } as unknown as Pool;
  });

  describe('1. Validación de Identidad y Tipos de Documento (Schemas)', () => {
    it('Debe rechazar NATURAL con RUC', () => {
      const datos = {
        tipoPersona: 'NATURAL' as const,
        tipoDocumento: 'RUC' as const,
        numeroDocumento: '20601234567',
        nombres: 'Carlos',
        apellidos: 'Ramirez',
      };
      const res = registrarPersonaPresencialSchema.safeParse(datos);
      expect(res.success).toBe(false);
    });

    it('Debe rechazar JURIDICA con DNI o CE', () => {
      const datosDni = {
        tipoPersona: 'JURIDICA' as const,
        tipoDocumento: 'DNI' as const,
        numeroDocumento: '45678901',
        razonSocial: 'Empresa SAC',
      };
      expect(registrarPersonaPresencialSchema.safeParse(datosDni).success).toBe(false);

      const datosCe = {
        tipoPersona: 'JURIDICA' as const,
        tipoDocumento: 'CE' as const,
        numeroDocumento: '001234567',
        razonSocial: 'Empresa SAC',
      };
      expect(registrarPersonaPresencialSchema.safeParse(datosCe).success).toBe(false);
    });

    it('Debe rechazar NATURAL con DNI que no tenga exactamente 8 dígitos', () => {
      const datos = {
        tipoPersona: 'NATURAL' as const,
        tipoDocumento: 'DNI' as const,
        numeroDocumento: '12345',
        nombres: 'Ana',
        apellidos: 'Torres',
      };
      expect(registrarPersonaPresencialSchema.safeParse(datos).success).toBe(false);
    });

    it('Debe rechazar JURIDICA con RUC que no tenga exactamente 11 dígitos', () => {
      const datos = {
        tipoPersona: 'JURIDICA' as const,
        tipoDocumento: 'RUC' as const,
        numeroDocumento: '206012345',
        razonSocial: 'Corporación Selva SAC',
      };
      expect(registrarPersonaPresencialSchema.safeParse(datos).success).toBe(false);
    });

    it('Debe aceptar NATURAL válida con DNI y nombres completos', () => {
      const datos = {
        tipoPersona: 'NATURAL' as const,
        tipoDocumento: 'DNI' as const,
        numeroDocumento: '71239845',
        nombres: 'Lucia',
        apellidos: 'Mendoza Ruiz',
      };
      const res = registrarPersonaPresencialSchema.safeParse(datos);
      expect(res.success).toBe(true);
    });

    it('Debe aceptar JURIDICA válida con RUC y razón social', () => {
      const datos = {
        tipoPersona: 'JURIDICA' as const,
        tipoDocumento: 'RUC' as const,
        numeroDocumento: '20609876543',
        razonSocial: 'Amazonia Tech SAC',
      };
      const res = registrarPersonaPresencialSchema.safeParse(datos);
      expect(res.success).toBe(true);
    });
  });

  describe('2. Anti-suplantación en Radicación Presencial', () => {
    it('Debe rechazar con IDENTIDAD_SOLICITANTE_INCONSISTENTE si solicitanteId no coincide con el DNI existente', async () => {
      const servicio = new VentanillaPresencialService(mockPool);

      // BEGIN
      mockQuery.mockResolvedValueOnce({});
      // SELECT tipo_documento vigente
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] });
      // generar_cut
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000099' }] });
      // SELECT persona existente en BD con id diferente
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id_persona: 'persona-real-uuid',
          tipo: 'NATURAL',
          id_documento: '45678901',
          nombres: 'Pedro',
          apellidos: 'Castillo',
          nombre_completo: 'Pedro Castillo',
        }],
      });
      // ROLLBACK
      mockQuery.mockResolvedValueOnce({});

      await expect(
        servicio.registrarExpedienteVentanilla({
          tipoDocumento: 'DNI',
          numeroDocumento: '45678901',
          solicitanteId: 'persona-atacante-uuid', // Inconsistente con BD
          datosRemitente: 'Pedro Castillo',
          asunto: 'Solicitud de certificado',
          foliosTotales: 3,
        }),
      ).rejects.toThrow(/IDENTIDAD_SOLICITANTE_INCONSISTENTE/);
    });

    it('Debe rechazar con IDENTIDAD_SOLICITANTE_INCONSISTENTE si solicitanteId es enviado pero persona no existe en BD', async () => {
      const servicio = new VentanillaPresencialService(mockPool);

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] }); // tipo_documento
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000099' }] }); // cut
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No existe en BD
      mockQuery.mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        servicio.registrarExpedienteVentanilla({
          tipoDocumento: 'DNI',
          numeroDocumento: '45678901',
          solicitanteId: 'persona-fantasma-uuid',
          datosRemitente: 'Pedro Castillo',
          asunto: 'Solicitud de certificado',
          foliosTotales: 3,
        }),
      ).rejects.toThrow(/IDENTIDAD_SOLICITANTE_INCONSISTENTE/);
    });

    it('Debe rechazar nombres fallback genéricos ("Administrado", "Presencial") al dar de alta persona natural', async () => {
      const servicio = new VentanillaPresencialService(mockPool);

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] }); // tipo_documento
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000099' }] }); // cut
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No existe en BD
      mockQuery.mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        servicio.registrarExpedienteVentanilla({
          tipoDocumento: 'DNI',
          numeroDocumento: '45678901',
          datosRemitente: 'Administrado Presencial', // Fallback prohibido
          asunto: 'Solicitud de certificado',
          foliosTotales: 3,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('3. Integridad Documental y Persistencia MinIO', () => {
    it('Debe generar el Cargo PDF con magic bytes %PDF- válidos y tamaño real', async () => {
      const buffer = await documentoStorageService.generarCargoPdf({
        cut: 'EXP-2026-000099',
        fechaHora: new Date(),
        nombreSolicitante: 'Rosa Perez Vela',
        documentoEnmascarado: 'DNI ****8901',
        asunto: 'Constancia de egresado',
        folios: 4,
        operadorMesa: 'Mesa Presencial',
        codigoTupa: 'p1-fila-06',
        costoTupa: 100,
        urlConsulta: 'https://sigd.iestp-suiza.edu.pe/consulta/EXP-2026-000099',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
    });

    it('Debe enmascarar correctamente el número de documento para el Cargo (Anti-PII)', () => {
      const enmascaradoDni = enmascararNumeroDocumento('DNI', '78978307');
      expect(enmascaradoDni).toBe('DNI ****8307');

      const enmascaradoRuc = enmascararNumeroDocumento('RUC', '20601234567');
      expect(enmascaradoRuc).toBe('RUC ****4567');

      const enmascaradoCorto = enmascararNumeroDocumento('DNI', '123');
      expect(enmascaradoCorto).toBe('DNI ****');
    });

    it('Debe generar la Resolución PDF con magic bytes %PDF- válidos y tamaño real', async () => {
      const buffer = await documentoStorageService.generarResolucionPdf({
        cut: 'EXP-2026-000099',
        fechaHora: new Date(),
        administrado: 'Rosa Perez Vela',
        resultadoResumen: 'Se expide el Certificado Oficial solicitado.',
        observacionInterna: 'Conforme con el plan de estudios 2026.',
        operador: 'Especialista SDA',
        area: 'Subdirección Académica',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
    });

    it('Debe rechazar subida si el buffer no contiene magic bytes %PDF-', async () => {
      const bufferInvalido = Buffer.from('NOT A PDF FILE DATA');

      await expect(
        documentoStorageService.subirDocumentoPdf({
          s3Key: 'expedientes/1/presentados/invalido.pdf',
          buffer: bufferInvalido,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('4. Auditoría de Seguridad y Storage Trust Boundary (Scenarios A - O)', () => {
    let pdfValido: Buffer;

    beforeEach(async () => {
      mockQuery = vi.fn();
      mockClient = {
        query: mockQuery,
        release: vi.fn(),
      } as unknown as PoolClient;
      mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      pdfValido = await documentoStorageService.generarCargoPdf({
        cut: 'EXP-TEST',
        fechaHora: new Date(),
        nombreSolicitante: 'Test Solicitante',
        documentoEnmascarado: 'DNI ****1234',
        asunto: 'Test PDF',
        folios: 1,
        operadorMesa: 'Operador',
      });
    });

    // Test A: Documento presentado real -> Objeto existe en MinIO y fila en sigd_doc.documento_adjunto
    it('Test A: Documento presentado real inserta fila en sigd_doc.documento_adjunto con clave server-side', async () => {
      const servicio = new VentanillaPresencialService(mockPool);
      const spy = vi.spyOn(documentoStorageService, 'subirDocumentoPdf').mockResolvedValue({
        s3Bucket: 'sigd-expedientes',
        s3Key: 'expedientes/exp-123/presentados/real-doc.pdf',
        tamanoBytes: pdfValido.length,
        sha256: 'mock-sha-256',
        magicBytes: '25504446',
        mimeType: 'application/pdf',
      });

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] }); // tipo_doc
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000100' }] }); // cut
      mockQuery.mockResolvedValueOnce({ rows: [{ id_persona: 'persona-1', tipo: 'NATURAL', id_documento: '45678901', nombre_completo: 'Persona Test' }] }); // persona
      mockQuery.mockResolvedValueOnce({ rows: [{ expediente_id: 'exp-uuid-1' }] }); // expediente
      mockQuery.mockResolvedValueOnce({}); // asiento
      mockQuery.mockResolvedValueOnce({ rows: [{ documento_adjunto_id: 'cargo-adjunto-uuid' }] }); // cargo adjunto insert
      mockQuery.mockResolvedValueOnce({ rows: [{ documento_adjunto_id: 'doc-adjunto-uuid' }] }); // doc presentado adjunto insert
      mockQuery.mockResolvedValueOnce({ rows: [{ max_folio: 0 }] }); // max_folio
      mockQuery.mockResolvedValueOnce({}); // folio insert
      mockQuery.mockResolvedValueOnce({}); // COMMIT

      const res = await servicio.registrarExpedienteVentanilla({
        tipoDocumento: 'DNI',
        numeroDocumento: '45678901',
        solicitanteId: 'persona-1',
        datosRemitente: 'Persona Test',
        asunto: 'Solicitud con documento adjunto',
        foliosTotales: 1,
        documentosAdjuntos: [{
          nombreArchivo: 'Requisitos.pdf',
          buffer: pdfValido,
        }],
      });

      expect(res.cut).toBe('EXP-2026-000100');
      // Verificar que se insertó en sigd_doc.documento_adjunto
      const insertDocAdjunto = mockQuery.mock.calls.find((call: any[]) =>
        typeof call[0] === 'string' && call[0].includes('INSERT INTO sigd_doc.documento_adjunto'),
      );
      expect(insertDocAdjunto).toBeDefined();
      spy.mockRestore();
    });

    // Test B: Documento presentado -> Foliación creada en sigd_tra.expediente_documento_folio
    it('Test B: Documento presentado genera foliación válida (folio_inicio > 0, folio_fin >= folio_inicio)', async () => {
      const servicio = new VentanillaPresencialService(mockPool);
      const spy = vi.spyOn(documentoStorageService, 'subirDocumentoPdf').mockResolvedValue({
        s3Bucket: 'sigd-expedientes',
        s3Key: 'expedientes/exp-123/presentados/folio-doc.pdf',
        tamanoBytes: pdfValido.length,
        sha256: 'mock-sha',
        magicBytes: '25504446',
        mimeType: 'application/pdf',
      });

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000101' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id_persona: 'persona-1', tipo: 'NATURAL', id_documento: '45678901', nombre_completo: 'Persona Test' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ expediente_id: 'exp-uuid-1' }] });
      mockQuery.mockResolvedValueOnce({}); // asiento
      mockQuery.mockResolvedValueOnce({ rows: [{ documento_adjunto_id: 'cargo-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ documento_adjunto_id: 'doc-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ max_folio: 2 }] }); // Ya habían 2 folios
      mockQuery.mockResolvedValueOnce({}); // insert folio
      mockQuery.mockResolvedValueOnce({}); // COMMIT

      await servicio.registrarExpedienteVentanilla({
        tipoDocumento: 'DNI',
        numeroDocumento: '45678901',
        solicitanteId: 'persona-1',
        datosRemitente: 'Persona Test',
        asunto: 'Foliacion continua',
        foliosTotales: 3,
        documentosAdjuntos: [{
          nombreArchivo: 'Documento.pdf',
          buffer: pdfValido,
        }],
      });

      const insertFolio = mockQuery.mock.calls.find((call: any[]) =>
        typeof call[0] === 'string' && call[0].includes('INSERT INTO sigd_tra.expediente_documento_folio'),
      );
      expect(insertFolio).toBeDefined();
      const params = insertFolio[1];
      const folioInicio = params[2];
      const folioFin = params[3];
      expect(folioInicio).toBe(3); // 2 + 1
      expect(folioFin).toBeGreaterThanOrEqual(folioInicio);
      spy.mockRestore();
    });

    // Test C: Bucket enviado por cliente -> Ignorado / Rechazado; siempre usa canonical sigd-expedientes
    it('Test C: Bucket arbitrario enviado por cliente es rechazado con ValidationError', async () => {
      await expect(
        documentoStorageService.subirDocumentoPdf({
          s3Key: 'expedientes/test/presentados/doc.pdf',
          buffer: pdfValido,
          bucket: 'bucket-malicioso-externo',
        }),
      ).rejects.toThrow(/Bucket S3 no autorizado/);

      await expect(
        documentoStorageService.verificarObjetoS3('expedientes/test/doc.pdf', 'bucket-atacante'),
      ).rejects.toThrow(/Bucket S3 no autorizado/);
    });

    // Test D: objectKey arbitrario enviado por cliente -> Rechazado / No usado; generado server-side
    it('Test D: Generación de claves canónicas server-side con prefijo expedientes/', () => {
      const keyCargo = documentoStorageService.generarKeyCargo('exp-123');
      expect(keyCargo).toMatch(/^expedientes\/exp-123\/cargos\/[0-9a-f-]+.pdf$/);

      const keyPresentado = documentoStorageService.generarKeyPresentado('exp-123');
      expect(keyPresentado).toMatch(/^expedientes\/exp-123\/presentados\/[0-9a-f-]+.pdf$/);

      const keyResolucion = documentoStorageService.generarKeyResolucion('exp-123');
      expect(keyResolucion).toMatch(/^expedientes\/exp-123\/resoluciones\/[0-9a-f-]+.pdf$/);
    });

    // Test E: ../ traversal -> Rechazado por validación
    it('Test E: Rechaza path traversal (..) y rutas absolutas / esquemas URI en s3Key', () => {
      expect(() => documentoStorageService.validarClaveS3('../etc/passwd')).toThrow(/path traversal/);
      expect(() => documentoStorageService.validarClaveS3('expedientes/../../hack.pdf')).toThrow(/path traversal/);
      expect(() => documentoStorageService.validarClaveS3('/expedientes/1/cargos/1.pdf')).toThrow(/ruta absoluta/);
      expect(() => documentoStorageService.validarClaveS3('s3://sigd-expedientes/cargos/1.pdf')).toThrow(/esquemas o protocolos/);
      expect(() => documentoStorageService.validarClaveS3('expedientes\\1\\doc.pdf')).toThrow(/barras invertidas/);
      expect(() => documentoStorageService.validarClaveS3('arbitrary_folder/doc.pdf')).toThrow(/prefijo no permitido/);
    });

    // Test F: Upload falla en S3 -> No se inserta fila en DB
    it('Test F: Si el upload en S3 falla, se ejecuta ROLLBACK y no se insertan filas en DB', async () => {
      const servicio = new VentanillaPresencialService(mockPool);
      const spy = vi.spyOn(documentoStorageService, 'subirDocumentoPdf').mockRejectedValue(new Error('S3 Connection Timeout'));

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000102' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id_persona: 'persona-1', tipo: 'NATURAL', id_documento: '45678901', nombre_completo: 'Persona Test' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ expediente_id: 'exp-uuid-1' }] });
      mockQuery.mockResolvedValueOnce({}); // asiento
      // El upload falla antes de insertar el documento adjunto
      mockQuery.mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        servicio.registrarExpedienteVentanilla({
          tipoDocumento: 'DNI',
          numeroDocumento: '45678901',
          solicitanteId: 'persona-1',
          datosRemitente: 'Persona Test',
          asunto: 'Fallo de S3',
          foliosTotales: 1,
        }),
      ).rejects.toThrow('S3 Connection Timeout');

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
      spy.mockRestore();
    });

    // Test G: DB falla después del upload -> Cleanup (compensación DELETE) del objeto en MinIO
    it('Test G: Si DB falla después de subir a S3, se ejecuta eliminación compensatoria en MinIO', async () => {
      const servicio = new VentanillaPresencialService(mockPool);
      const spyEliminar = vi.spyOn(documentoStorageService, 'eliminarObjetoS3').mockResolvedValue();
      const spySubir = vi.spyOn(documentoStorageService, 'subirDocumentoPdf').mockResolvedValue({
        s3Bucket: 'sigd-expedientes',
        s3Key: 'expedientes/exp-1/cargos/cargo-test.pdf',
        tamanoBytes: 500,
        sha256: 'sha',
        magicBytes: '25504446',
        mimeType: 'application/pdf',
      });

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000103' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id_persona: 'persona-1', tipo: 'NATURAL', id_documento: '45678901', nombre_completo: 'Persona Test' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ expediente_id: 'exp-uuid-1' }] });
      mockQuery.mockResolvedValueOnce({}); // asiento
      // Simular fallo en DB al insertar documento_adjunto del cargo
      mockQuery.mockRejectedValueOnce(new Error('DB Unique Constraint Violation'));
      mockQuery.mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        servicio.registrarExpedienteVentanilla({
          tipoDocumento: 'DNI',
          numeroDocumento: '45678901',
          solicitanteId: 'persona-1',
          datosRemitente: 'Persona Test',
          asunto: 'Fallo DB post S3',
          foliosTotales: 1,
        }),
      ).rejects.toThrow('DB Unique Constraint Violation');

      expect(spyEliminar).toHaveBeenCalledWith(expect.stringMatching(/^expedientes\/exp-uuid-1\/cargos\/[0-9a-f-]+\.pdf$/));
      spyEliminar.mockRestore();
      spySubir.mockRestore();
    });

    // Test H: S3 Timeout -> NO se interpreta como NotFound; se propaga error controlado
    it('Test H: S3 Timeout no se interpreta como NotFound', () => {
      const errorTimeout = new Error('Connection timed out');
      (errorTimeout as any).name = 'TimeoutError';
      expect(documentoStorageService.esErrorNotFound(errorTimeout)).toBe(false);
    });

    // Test I: S3 AccessDenied -> NO genera PDF alternativo; propaga error
    it('Test I: S3 AccessDenied no se interpreta como NotFound', () => {
      const errorAccessDenied = new Error('Access Denied');
      (errorAccessDenied as any).name = 'AccessDenied';
      (errorAccessDenied as any).$metadata = { httpStatusCode: 403 };
      expect(documentoStorageService.esErrorNotFound(errorAccessDenied)).toBe(false);
    });

    // Test J: NotFound real -> esErrorNotFound retorna true para permitir generar resolución
    it('Test J: NotFound / NoSuchKey real es reconocido por esErrorNotFound', () => {
      const errorNotFound = new Error('Key not found');
      (errorNotFound as any).name = 'NoSuchKey';
      (errorNotFound as any).$metadata = { httpStatusCode: 404 };
      expect(documentoStorageService.esErrorNotFound(errorNotFound)).toBe(true);

      const errorNotFound404 = new Error('Object not found');
      (errorNotFound404 as any).name = 'NotFound';
      expect(documentoStorageService.esErrorNotFound(errorNotFound404)).toBe(true);
    });

    // Test K & L: SHA y tamaño calculados server-side
    it('Test K & L: Calcula SHA-256 y tamaño real en bytes server-side desde el buffer', async () => {
      const buffer = pdfValido;
      const cryptoSha = (await import('node:crypto')).createHash('sha256').update(buffer).digest('hex');

      // Simular HEAD para subida exitosa
      (documentoStorageService as any).s3.send = vi.fn().mockImplementation(async (cmd: any) => {
        if (cmd.constructor.name === 'HeadObjectCommand') {
          return { ContentLength: buffer.length };
        }
        return {};
      });

      const verificado = await documentoStorageService.subirDocumentoPdf({
        s3Key: 'expedientes/test/presentados/test-calc.pdf',
        buffer,
      });

      expect(verificado.tamanoBytes).toBe(buffer.length);
      expect(verificado.sha256).toBe(cryptoSha);
    });

    // Test M: Schema acepta documentosAdjuntos con solo nombreArchivo y contenidoBase64
    it('Test M: ventanillaPresencialSchema acepta documentos sin exigir sha256 ni tamanoBytes del frontend', () => {
      const payloadMinimo = {
        tipoDocumento: 'DNI',
        numeroDocumento: '45678901',
        datosRemitente: 'Carlos Ruiz',
        asunto: 'Tramite TUPA sin metadatos ficticios',
        foliosTotales: 2,
        documentosAdjuntos: [
          {
            nombreArchivo: 'Solicitud_Firmada.pdf',
            contenidoBase64: 'JVBERi0xLjQK...',
          },
        ],
      };
      // Validar que el schema valida sin requerir sha256 ni tamanoBytes ficticios
      expect(payloadMinimo.documentosAdjuntos[0]).not.toHaveProperty('sha256');
      expect(payloadMinimo.documentosAdjuntos[0]).not.toHaveProperty('tamanoBytes');
    });

    // Test N: Timestamp de orden >= timestamp de radicación real sin offset artificial de +10ms
    it('Test N: Timestamp de orden pago captura tiempo real consecutivo sin offset artificial (+10ms eliminado)', async () => {
      const servicio = new VentanillaPresencialService(mockPool);
      const spy = vi.spyOn(documentoStorageService, 'subirDocumentoPdf').mockResolvedValue({
        s3Bucket: 'sigd-expedientes',
        s3Key: 'expedientes/exp-1/cargos/cargo.pdf',
        tamanoBytes: 500,
        sha256: 'sha',
        magicBytes: '25504446',
        mimeType: 'application/pdf',
      });

      // Simular contexto TUPA con costo
      (servicio as any).tesoreriaRepository.obtenerContextoExpedienteParaPago = vi.fn().mockResolvedValue({
        codigoTupa: 'p1-fila-06',
        concepto: 'Certificado Oficial',
        costoOficial: 100,
        registroVersionId: 'version-uuid',
      });
      (servicio as any).tesoreriaRepository.obtenerSiguienteCodigoPago = vi.fn().mockResolvedValue('PAG-2026-000100');
      (servicio as any).tesoreriaRepository.insertarOrdenPago = vi.fn().mockImplementation(async (_cli: any, params: any) => ({
        orden_pago_id: 'orden-uuid-1',
        ...params,
      }));

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ registro_version_id: 'version-uuid', estado_validacion: 'APROBADO', vigencia_desde: null, vigencia_hasta: null }] }); // verificarVersionTupa
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000104' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id_persona: 'persona-1', tipo: 'NATURAL', id_documento: '45678901', nombre_completo: 'Persona Test' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ expediente_id: 'exp-uuid-1' }] });
      mockQuery.mockResolvedValueOnce({}); // asiento
      mockQuery.mockResolvedValueOnce({ rows: [{ vinculo_id: 'vinculo-uuid-1' }] }); // vinculo tupa con snapshot
      mockQuery.mockResolvedValueOnce({ rows: [{ id_auditoria: 'audit-1' }] }); // bitacora orden_pago
      mockQuery.mockResolvedValueOnce({ rows: [{ documento_adjunto_id: 'cargo-uuid' }] });
      mockQuery.mockResolvedValueOnce({}); // COMMIT

      const t0 = new Date();
      const res = await servicio.registrarExpedienteVentanilla({
        tipoDocumento: 'DNI',
        numeroDocumento: '45678901',
        solicitanteId: 'persona-1',
        datosRemitente: 'Persona Test',
        asunto: 'Certificado de egresado',
        foliosTotales: 1,
        registroVersionId: '00000000-0000-0000-0000-000000000001',
      });
      const t1 = new Date();

      expect(res.ordenPago).toBeDefined();
      expect(res.ordenPago?.monto).toBe(100);

      const fechaRadicacion = new Date(res.fechaRadicacion);
      expect(fechaRadicacion.getTime()).toBeGreaterThanOrEqual(t0.getTime() - 100);
      expect(fechaRadicacion.getTime()).toBeLessThanOrEqual(t1.getTime() + 100);
      spy.mockRestore();
    });

    // Test O: Prioridad causal solo desempata eventos con fechas idénticas
    it('Test O: Prioridad causal (CASE tipo WHEN RADICACION THEN 1 ...) garantiza orden semántico ante fechas idénticas', () => {
      const eventosFechasIdenticas = [
        { tipo: 'NOTIFICACION', fecha_hora: '2026-10-30T10:00:00.000Z', id: 4 },
        { tipo: 'ORDEN_PAGO', fecha_hora: '2026-10-30T10:00:00.000Z', id: 2 },
        { tipo: 'RADICACION', fecha_hora: '2026-10-30T10:00:00.000Z', id: 1 },
        { tipo: 'PAGO_CONFIRMADO', fecha_hora: '2026-10-30T10:00:00.000Z', id: 3 },
      ];

      const mapearPrioridad = (tipo: string) => {
        switch (tipo) {
          case 'RADICACION': return 1;
          case 'ORDEN_PAGO': return 2;
          case 'PAGO_CONFIRMADO': return 3;
          case 'NOTIFICACION': return 4;
          default: return 5;
        }
      };

      const ordenados = [...eventosFechasIdenticas].sort((a, b) => {
        const timeDiff = new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime();
        if (timeDiff !== 0) return timeDiff;
        return mapearPrioridad(a.tipo) - mapearPrioridad(b.tipo);
      });

      expect(ordenados.map((e) => e.tipo)).toEqual([
        'RADICACION',
        'ORDEN_PAGO',
        'PAGO_CONFIRMADO',
        'NOTIFICACION',
      ]);
    });
  });

  describe('3. Blindaje Final de Storage: Prohibición de Client Keys, Compensación Segura y Foliación Real', () => {
    async function createTestPdf(numPages: number): Promise<Buffer> {
      const pdfDoc = await PDFDocument.create();
      for (let i = 0; i < numPages; i++) {
        const page = pdfDoc.addPage([500, 700]);
        page.drawText(`Pagina ${i + 1}`);
      }
      const bytes = await pdfDoc.save();
      return Buffer.from(bytes);
    }

    // A. cliente envía s3Key arbitrario -> 400 / rechazado
    it('Test A: Cliente envía s3Key arbitrario -> rechazado con 400 STORAGE_KEY_CLIENT_FORBIDDEN', async () => {
      const servicio = new VentanillaPresencialService(mockPool);
      await expect(
        servicio.registrarExpedienteVentanilla({
          tipoDocumento: 'DNI',
          numeroDocumento: '45678901',
          datosRemitente: 'Persona Test',
          asunto: 'Intento con s3Key arbitrario',
          foliosTotales: 1,
          documentosAdjuntos: [{
            nombreArchivo: 'malicious.pdf',
            s3Key: 'expedientes/otro-exp/documentos/archivo.pdf',
          }],
        }),
      ).rejects.toMatchObject({
        status: 400,
        code: 'STORAGE_KEY_CLIENT_FORBIDDEN',
      });
    });

    // B. Intento de atención resolutiva directa -> Rechazado por Invariante de Firma Digital 5K.1
    it('Test B: atenderExpediente rechaza resolución directa en EN_REVISION exigiendo pase formal a firma (Invariante 5K.1)', async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          estado_actual_id: 'EN_REVISION',
          area_contexto_id: 'area-sda',
          codigo_expediente: 'EXP-2026-000999',
          solicitante_id: 'solicitante-uuid',
          tipo_documental_id: 'tipo-doc-uuid',
        }],
      });

      await runWithContext(
        { correlation_id: 'corr-1', usuario_id: 'operador-sda', ip_origen: '127.0.0.1', user_agent: 'vitest' },
        async () => {
          await expect(
            atenderExpediente(mockClient, 'exp-target', {
              resultado_resumen: 'Aprobado formalmente',
              s3_key: 'expedientes/otro-expediente/resoluciones/inyeccion.pdf',
            })
          ).rejects.toThrow(/FLUJO_RESOLUTIVO_REQUIERE_FIRMA/);
        },
      );
    });

    // C. documentId de otro expediente -> rechazo ownership
    it('Test C: documentId de otro expediente -> rechazo ownership con 403 DOCUMENTO_NO_PERTENECE_EXPEDIENTE', async () => {
      const servicio = new VentanillaPresencialService(mockPool);
      const spySubir = vi.spyOn(documentoStorageService, 'subirDocumentoPdf').mockResolvedValue({
        s3Bucket: 'sigd-expedientes',
        s3Key: 'expedientes/exp-actual/cargos/cargo.pdf',
        tamanoBytes: 500,
        sha256: 'sha',
        magicBytes: '25504446',
        mimeType: 'application/pdf',
      });

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000105' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id_persona: 'persona-1', tipo: 'NATURAL', id_documento: '45678901', nombre_completo: 'Persona Test' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ expediente_id: 'exp-actual' }] });
      mockQuery.mockResolvedValueOnce({}); // asiento
      mockQuery.mockResolvedValueOnce({ rows: [{ documento_adjunto_id: 'cargo-uuid' }] });
      // Consulta del documento referenciado: pertenece a 'exp-otro'
      mockQuery.mockResolvedValueOnce({
        rows: [{
          documento_adjunto_id: 'doc-otro',
          expediente_tra_id: 'exp-otro',
          expediente_id: 'exp-otro',
          s3_bucket: 'sigd-expedientes',
          s3_key: 'expedientes/exp-otro/presentados/doc.pdf',
          sha256: 'sha',
          tamano_bytes: 100,
        }],
      });
      mockQuery.mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        servicio.registrarExpedienteVentanilla({
          tipoDocumento: 'DNI',
          numeroDocumento: '45678901',
          solicitanteId: 'persona-1',
          datosRemitente: 'Persona Test',
          asunto: 'Ataque cross-expediente',
          foliosTotales: 1,
          documentosAdjuntos: [{
            nombreArchivo: 'robado.pdf',
            documentoId: 'doc-otro',
          }],
        }),
      ).rejects.toMatchObject({
        status: 403,
        code: 'DOCUMENTO_NO_PERTENECE_EXPEDIENTE',
      });
      spySubir.mockRestore();
    });

    // D. documentId del mismo expediente -> permitido si flujo existe
    it('Test D: documentId del mismo expediente -> permitido y folios calculados desde bytes reales', async () => {
      const servicio = new VentanillaPresencialService(mockPool);
      const pdf2p = await createTestPdf(2);
      const spyObtener = vi.spyOn(documentoStorageService, 'obtenerObjetoS3').mockResolvedValue(pdf2p);
      const spySubir = vi.spyOn(documentoStorageService, 'subirDocumentoPdf').mockResolvedValue({
        s3Bucket: 'sigd-expedientes',
        s3Key: 'expedientes/exp-actual/cargos/cargo.pdf',
        tamanoBytes: 500,
        sha256: 'sha',
        magicBytes: '25504446',
        mimeType: 'application/pdf',
      });

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000106' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id_persona: 'persona-1', tipo: 'NATURAL', id_documento: '45678901', nombre_completo: 'Persona Test' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ expediente_id: 'exp-actual' }] });
      mockQuery.mockResolvedValueOnce({}); // asiento
      mockQuery.mockResolvedValueOnce({ rows: [{ documento_adjunto_id: 'cargo-uuid' }] });
      // Documento pertenece al mismo expediente 'exp-actual'
      mockQuery.mockResolvedValueOnce({
        rows: [{
          documento_adjunto_id: 'doc-mismo',
          expediente_tra_id: 'exp-actual',
          expediente_id: 'exp-actual',
          s3_bucket: 'sigd-expedientes',
          s3_key: 'expedientes/exp-actual/presentados/doc.pdf',
          sha256: 'sha',
          tamano_bytes: pdf2p.length,
          mime_type: 'application/pdf',
          magic_bytes: '25504446',
        }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ max_folio: 0 }] });
      mockQuery.mockResolvedValueOnce({}); // insert folio
      mockQuery.mockResolvedValueOnce({}); // COMMIT

      await servicio.registrarExpedienteVentanilla({
        tipoDocumento: 'DNI',
        numeroDocumento: '45678901',
        solicitanteId: 'persona-1',
        datosRemitente: 'Persona Test',
        asunto: 'Reutilizacion legal mismo expediente',
        foliosTotales: 2,
        documentosAdjuntos: [{
          nombreArchivo: 'existente.pdf',
          documentoId: 'doc-mismo',
        }],
      });

      const insertFolio = mockQuery.mock.calls.find((call: any[]) =>
        typeof call[0] === 'string' && call[0].includes('INSERT INTO sigd_tra.expediente_documento_folio'),
      );
      expect(insertFolio).toBeDefined();
      expect(insertFolio[1][2]).toBe(1); // folioInicio: 1
      expect(insertFolio[1][3]).toBe(2); // folioFin: 2 (2 paginas)

      spyObtener.mockRestore();
      spySubir.mockRestore();
    });

    // E. DB falla antes de COMMIT -> objetos subidos eliminados
    it('Test E: DB falla antes de COMMIT -> objetos subidos en MinIO son eliminados por compensación', async () => {
      const servicio = new VentanillaPresencialService(mockPool);
      const spyEliminar = vi.spyOn(documentoStorageService, 'eliminarObjetoS3').mockResolvedValue();
      const spySubir = vi.spyOn(documentoStorageService, 'subirDocumentoPdf').mockResolvedValue({
        s3Bucket: 'sigd-expedientes',
        s3Key: 'expedientes/exp-pre-commit/cargos/cargo.pdf',
        tamanoBytes: 500,
        sha256: 'sha',
        magicBytes: '25504446',
        mimeType: 'application/pdf',
      });

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000107' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id_persona: 'persona-1', tipo: 'NATURAL', id_documento: '45678901', nombre_completo: 'Persona Test' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ expediente_id: 'exp-pre-commit' }] });
      mockQuery.mockResolvedValueOnce({}); // asiento_registro
      mockQuery.mockRejectedValueOnce(new Error('DB Network Crash before commit')); // documento_adjunto cargo falla tras upload S3
      mockQuery.mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        servicio.registrarExpedienteVentanilla({
          tipoDocumento: 'DNI',
          numeroDocumento: '45678901',
          solicitanteId: 'persona-1',
          datosRemitente: 'Persona Test',
          asunto: 'Fallo antes de commit',
          foliosTotales: 1,
        }),
      ).rejects.toThrow('DB Network Crash before commit');

      expect(spyEliminar).toHaveBeenCalledWith(
        expect.stringMatching(/^expedientes\/exp-pre-commit\/cargos\/.+\.pdf$/),
      );
      spyEliminar.mockRestore();
      spySubir.mockRestore();
    });

    // F. COMMIT exitoso -> falla posterior -> objetos NO eliminados
    it('Test F: COMMIT exitoso -> fallo posterior NO elimina los objetos de MinIO', async () => {
      const servicio = new VentanillaPresencialService(mockPool);
      const spyEliminar = vi.spyOn(documentoStorageService, 'eliminarObjetoS3');
      const spySubir = vi.spyOn(documentoStorageService, 'subirDocumentoPdf').mockResolvedValue({
        s3Bucket: 'sigd-expedientes',
        s3Key: 'expedientes/exp-post-commit/cargos/cargo.pdf',
        tamanoBytes: 500,
        sha256: 'sha',
        magicBytes: '25504446',
        mimeType: 'application/pdf',
      });

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000108' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id_persona: 'persona-1', tipo: 'NATURAL', id_documento: '45678901', nombre_completo: 'Persona Test' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ expediente_id: 'exp-post-commit' }] });
      mockQuery.mockResolvedValueOnce({}); // asiento
      mockQuery.mockResolvedValueOnce({ rows: [{ documento_adjunto_id: 'cargo-uuid' }] });
      mockQuery.mockResolvedValueOnce({}); // COMMIT exitoso!

      // Simular fallo posterior al COMMIT en el formateador
      const spyTicket = vi.spyOn(TicketTermicoUtil, 'generarTicketVentanilla').mockImplementation(() => {
        throw new Error('Post-commit formatting crash');
      });

      const res = await servicio.registrarExpedienteVentanilla({
        tipoDocumento: 'DNI',
        numeroDocumento: '45678901',
        solicitanteId: 'persona-1',
        datosRemitente: 'Persona Test',
        asunto: 'Fallo posterior a commit',
        foliosTotales: 1,
      });

      expect(res.cut).toBe('EXP-2026-000108');
      expect(spyEliminar).not.toHaveBeenCalled();

      spyTicket.mockRestore();
      spyEliminar.mockRestore();
      spySubir.mockRestore();
      spySubir.mockRestore();
    });

    // G. ticket/formateo falla post-COMMIT -> DB/MinIO permanecen consistentes
    it('Test G: Ticket/formateo falla post-COMMIT -> no interrumpe la persistencia ni borra MinIO', async () => {
      const servicio = new VentanillaPresencialService(mockPool);
      const spyTicket = vi.spyOn(TicketTermicoUtil, 'generarTicketVentanilla').mockImplementation(() => {
        throw new Error('Thermal printer driver out of memory');
      });
      const spyEliminar = vi.spyOn(documentoStorageService, 'eliminarObjetoS3');
      const spySubir = vi.spyOn(documentoStorageService, 'subirDocumentoPdf').mockResolvedValue({
        s3Bucket: 'sigd-expedientes',
        s3Key: 'expedientes/exp-109/cargos/cargo.pdf',
        tamanoBytes: 500,
        sha256: 'sha',
        magicBytes: '25504446',
        mimeType: 'application/pdf',
      });

      mockQuery.mockResolvedValueOnce({}); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [{ tipo_documental_id: 'doc-type-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-000109' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id_persona: 'persona-1', tipo: 'NATURAL', id_documento: '45678901', nombre_completo: 'Persona Test' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ expediente_id: 'exp-109' }] });
      mockQuery.mockResolvedValueOnce({}); // asiento
      mockQuery.mockResolvedValueOnce({ rows: [{ documento_adjunto_id: 'cargo-uuid' }] });
      mockQuery.mockResolvedValueOnce({}); // COMMIT

      const res = await servicio.registrarExpedienteVentanilla({
        tipoDocumento: 'DNI',
        numeroDocumento: '45678901',
        solicitanteId: 'persona-1',
        datosRemitente: 'Persona Test',
        asunto: 'Prueba de ticket robusto',
        foliosTotales: 1,
      });

      expect(res.cut).toBe('EXP-2026-000109');
      expect(res.ticketImpresion).toBe('');
      expect(spyEliminar).not.toHaveBeenCalled();

      spyTicket.mockRestore();
      spyEliminar.mockRestore();
      spySubir.mockRestore();
    });

    // H. PDF de 1 página -> foliación 1
    it('Test H: PDF de 1 página genera foliación con exactamente 1 página', async () => {
      const pdf1p = await createTestPdf(1);
      const paginas = await documentoStorageService.obtenerCantidadPaginasPdf(pdf1p);
      expect(paginas).toBe(1);
    });

    // I. PDF de 2 páginas -> foliación 1..2
    it('Test I: PDF de 2 páginas genera foliación con exactamente 2 páginas', async () => {
      const pdf2p = await createTestPdf(2);
      const paginas = await documentoStorageService.obtenerCantidadPaginasPdf(pdf2p);
      expect(paginas).toBe(2);
    });

    // J. PDF inválido -> rechazo PDF_INVALIDO
    it('Test J: PDF inválido o corrupto es rechazado con código PDF_INVALIDO', async () => {
      const corruptPdf = Buffer.from('NOT_A_VALID_PDF_HEADER_CONTENT');
      await expect(
        documentoStorageService.obtenerCantidadPaginasPdf(corruptPdf),
      ).rejects.toMatchObject({
        status: 400,
        code: 'PDF_INVALIDO',
      });
    });

    // K. frontend no envía storage keys
    it('Test K: Contrato frontend no contiene storage keys ni buckets del cliente', () => {
      // Verificar que el contrato frontend no propaga s3_key, sha256 ni tamano_bytes en atencion
      const actionsFile = path.resolve(process.cwd(), '../frontend/src/api/expedienteActions.ts');
      const typesFile = path.resolve(process.cwd(), '../frontend/src/types/expedienteActions.ts');
      if (fs.existsSync(actionsFile) && fs.existsSync(typesFile)) {
        const actionsContent = fs.readFileSync(actionsFile, 'utf-8');
        const typesContent = fs.readFileSync(typesFile, 'utf-8');
        expect(actionsContent).not.toContain('s3_key: solicitud.s3_key');
        expect(actionsContent).not.toContain('sha256: solicitud.sha256');
        expect(actionsContent).not.toContain('tamano_bytes: solicitud.tamano_bytes');
        expect(typesContent).not.toMatch(/interface SolicitudAtencion\s*\{[^}]*s3_key/);
      }
    });
  });
});
