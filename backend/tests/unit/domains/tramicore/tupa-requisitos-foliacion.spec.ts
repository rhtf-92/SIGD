import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { PDFDocument } from 'pdf-lib';
import {
  TupaRequisitosService,
  type DtoRequisitoTupa,
  type DocumentoAValidar,
} from '../../../../src/domains/tramicore/tupaRequisitos.service.js';
import { ValidationError, NotFoundError } from '../../../../src/shared/domain/errors/index.js';
import { documentoStorageService } from '../../../../src/core/storage/documento-storage.service.js';

describe('TUPA 2026: Requisitos Documentales Estructurados y Foliación Automática', () => {
  let mockPool: Pool;
  let mockClient: PoolClient;
  let mockQuery: any;
  let service: TupaRequisitosService;

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
    service = new TupaRequisitosService(mockPool);
  });

  describe('1. Consulta de Requisitos Estructurados (obtenerRequisitosPorProcedimiento)', () => {
    it('Debe devolver la estructura de requisitos cuando el procedimiento existe', async () => {
      const procId = '11111111-1111-1111-1111-111111111111';
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id_procedimiento: procId,
              codigo_ref: 'p1-fila-06',
              denominacion: 'Certificado de Inglés',
              genera_expediente: true,
              registro_version_id: 'aaaa1111-0000-0000-0000-000000000001',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id_requisito: 'req-01',
              id_procedimiento: procId,
              registro_version_id: 'aaaa1111-0000-0000-0000-000000000001',
              nombre: 'Pago en el Área de Tesorería',
              descripcion: 'Monto correspondiente según TUPA',
              tipo_requisito: 'FINANCIERO',
              es_anexo_digital: false,
              obligatorio: true,
              orden: 1,
              formatos_permitidos: 'COMPROBANTE',
              activo: true,
              fuente_original: 'TUPA Suiza 2026',
            },
            {
              id_requisito: 'req-02',
              id_procedimiento: procId,
              registro_version_id: 'aaaa1111-0000-0000-0000-000000000001',
              nombre: 'Emisión de la B/V',
              descripcion: 'Boleta de venta o comprobante interno',
              tipo_requisito: 'INTERNO',
              es_anexo_digital: false,
              obligatorio: false,
              orden: 2,
              formatos_permitidos: 'INTERNO',
              activo: true,
              fuente_original: 'TUPA Suiza 2026',
            },
          ],
        });

      const resultado = await service.obtenerRequisitosPorProcedimiento('p1-fila-06');

      expect(resultado.procedimientoId).toBe(procId);
      expect(resultado.codigoRef).toBe('p1-fila-06');
      expect(resultado.denominacion).toBe('Certificado de Inglés');
      expect(resultado.totalRequisitos).toBe(2);
      expect(resultado.totalAnexosDigitales).toBe(0);
      expect(resultado.totalAnexosObligatorios).toBe(0);
      expect(resultado.anexosDigitales).toHaveLength(0);
    });

    it('Debe lanzar NotFoundError si el identificador no existe en el catálogo', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.obtenerRequisitosPorProcedimiento('inexistente')).rejects.toThrow(NotFoundError);
    });
  });

  describe('2. Invariante TUPA: Procedimiento p1-fila-06 (Certificado de Inglés)', () => {
    it('p1-fila-06 tiene requisitos financieros e internos, pero 0 anexos documentales obligatorios (NO inventar requisitos)', async () => {
      const procId = '11111111-1111-1111-1111-111111111111';
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id_procedimiento: procId,
              codigo_ref: 'p1-fila-06',
              denominacion: 'Certificado de Inglés',
              genera_expediente: true,
              registro_version_id: null,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id_requisito: 'req-p1-06-1',
              id_procedimiento: procId,
              registro_version_id: null,
              nombre: 'Pago en el Área de Tesorería',
              tipo_requisito: 'FINANCIERO',
              es_anexo_digital: false,
              obligatorio: true,
              orden: 1,
              formatos_permitidos: 'RECIBO',
              activo: true,
              fuente_original: 'Pago en el Área de Tesorería',
            },
            {
              id_requisito: 'req-p1-06-2',
              id_procedimiento: procId,
              registro_version_id: null,
              nombre: 'Emisión de la B/V',
              tipo_requisito: 'INTERNO',
              es_anexo_digital: false,
              obligatorio: false,
              orden: 2,
              formatos_permitidos: 'BOLETA_VENTA',
              activo: true,
              fuente_original: 'Emisión de la B/V',
            },
          ],
        });

      // Validar sin ningún documento adjunto
      const docsPresentados: DocumentoAValidar[] = [];
      await expect(service.validarRequisitosObligatorios('p1-fila-06', docsPresentados)).resolves.not.toThrow();
    });
  });

  describe('3. Validación Estricta de Requisitos Obligatorios (validarRequisitosObligatorios)', () => {
    const procId = '55555555-5555-5555-5555-555555555555';
    const reqObligatorioId = '99999999-9999-9999-9999-999999999901';

    beforeEach(() => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id_procedimiento: procId,
              codigo_ref: 'p5-fila-21',
              denominacion: 'Prueba de Requisito Documental Obligatorio',
              genera_expediente: true,
              registro_version_id: null,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id_requisito: reqObligatorioId,
              id_procedimiento: procId,
              registro_version_id: null,
              nombre: 'Solicitud en FUT dirigida al Director.',
              descripcion: 'Formulario Único de Trámite firmado',
              tipo_requisito: 'DOCUMENTAL',
              es_anexo_digital: true,
              obligatorio: true,
              orden: 1,
              formatos_permitidos: 'PDF',
              activo: true,
              fuente_original: 'Solicitud en FUT dirigida al Director.',
              estado_homologacion: 'HOMOLOGADO',
            },
          ],
        });
    });

    it('Debe lanzar REQUISITO_DOCUMENTAL_FALTANTE si falta un requisito obligatorio', async () => {
      const docsVacios: DocumentoAValidar[] = [];

      try {
        await service.validarRequisitosObligatorios('p5-fila-21', docsVacios);
        expect.unreachable('Debió lanzar ValidationError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.code).toBe('REQUISITO_DOCUMENTAL_FALTANTE');
        expect(err.message).toContain('Solicitud en FUT dirigida al Director');
      }
    });

    it('Debe rechazar con REQUISITO_AJENO_PROCEDIMIENTO si se envía un requisito de otro procedimiento', async () => {
      const reqAjenoId = '88888888-8888-8888-8888-888888888888';
      const docsConRequisitoInvalido: DocumentoAValidar[] = [
        {
          idRequisito: reqAjenoId,
          nombreArchivo: 'DocumentoInvalido.pdf',
        },
      ];

      try {
        await service.validarRequisitosObligatorios('p5-fila-21', docsConRequisitoInvalido);
        expect.unreachable('Debió rechazar requisito ajeno');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.code).toBe('REQUISITO_AJENO_PROCEDIMIENTO');
      }
    });

    it('Debe tener éxito cuando el requisito obligatorio está adjunto', async () => {
      const docsValidos: DocumentoAValidar[] = [
        {
          idRequisito: reqObligatorioId,
          nombreArchivo: 'FUT_Firmado.pdf',
        },
      ];

      await expect(service.validarRequisitosObligatorios('p5-fila-21', docsValidos)).resolves.not.toThrow();
    });
  });

  describe('4. Foliación Física Exacta y Continua de PDFs de Múltiples Páginas', () => {
    it('Debe detectar páginas reales con PDFDocument: Doc 1 (3 págs) + Doc 2 (2 págs) -> Folios 1–3 y 4–5 (Total 5)', async () => {
      // Crear Doc 1 con 3 páginas físicas reales
      const pdf1 = await PDFDocument.create();
      pdf1.addPage([600, 400]);
      pdf1.addPage([600, 400]);
      pdf1.addPage([600, 400]);
      const bytes1 = await pdf1.save();
      const buffer1 = Buffer.from(bytes1);

      // Crear Doc 2 con 2 páginas físicas reales
      const pdf2 = await PDFDocument.create();
      pdf2.addPage([600, 400]);
      pdf2.addPage([600, 400]);
      const bytes2 = await pdf2.save();
      const buffer2 = Buffer.from(bytes2);

      // Medir páginas server-side con documentoStorageService
      const paginasDoc1 = await documentoStorageService.obtenerCantidadPaginasPdf(buffer1);
      const paginasDoc2 = await documentoStorageService.obtenerCantidadPaginasPdf(buffer2);

      expect(paginasDoc1).toBe(3);
      expect(paginasDoc2).toBe(2);

      // Simular cálculo de folios continuo
      let maxFolio = 0;

      // Asignación Doc 1
      const doc1Inicio = maxFolio + 1;
      const doc1Fin = doc1Inicio + paginasDoc1 - 1;
      maxFolio = doc1Fin;

      expect(doc1Inicio).toBe(1);
      expect(doc1Fin).toBe(3);

      // Asignación Doc 2 (continuo sin saltos)
      const doc2Inicio = maxFolio + 1;
      const doc2Fin = doc2Inicio + paginasDoc2 - 1;
      maxFolio = doc2Fin;

      expect(doc2Inicio).toBe(4);
      expect(doc2Fin).toBe(5);

      // Total de folios del expediente
      const totalFolios = maxFolio;
      expect(totalFolios).toBe(5);
    });
  });
});
