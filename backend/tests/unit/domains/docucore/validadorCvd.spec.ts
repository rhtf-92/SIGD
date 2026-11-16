import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { crearVerificadorCvd, type GeneradorUrlDescarga } from '../../../../src/domains/docucore/validadorCvd.controller.js';
import { generarDescargaAutorizada } from '../../../../src/core/storage/storage.router.js';

describe('AF-24 — Bloqueo C: DocuCore Validador CVD y Almacenamiento S3', () => {
  let mockPool: {
    query: ReturnType<typeof vi.fn>;
  };
  let mockRes: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };

  const pdfValido = Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'),
  ]);
  const sha256PdfValido = crypto.createHash('sha256').update(pdfValido).digest('hex');

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPool = {
      query: vi.fn(),
    };
    mockRes = {
      status: vi.fn(),
      json: vi.fn(),
    };
    mockRes.status.mockReturnValue(mockRes);
    mockRes.json.mockReturnValue(mockRes);
  });

  describe('1. Validación sintáctica y de existencia de CVD', () => {
    it('1.1 Rechaza formato de CVD inválido con HTTP 400 ValidationError', async () => {
      const verificador = crearVerificadorCvd(mockPool as unknown as Pool);
      const req = { params: { cvd: 'FORMATO-INVALIDO' } } as unknown as Request;

      await expect(verificador(req, mockRes as unknown as Response)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('1.2 Retorna HTTP 404 NotFoundError cuando el CVD no existe en base de datos', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      const verificador = crearVerificadorCvd(mockPool as unknown as Pool);
      const req = { params: { cvd: 'CVD-2026-INEXISTENTE-01' } } as unknown as Request;

      await expect(verificador(req, mockRes as unknown as Response)).rejects.toMatchObject({
        status: 404,
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM sigd_doc.firma_digital_documento'),
        ['CVD-2026-INEXISTENTE-01'],
      );
    });
  });

  describe('2. Integridad de documento S3 y verificación de firma', () => {
    it('2.1 Un hash coincidente sin firma criptografica no acredita autenticidad', async () => {
      mockPool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            cvd: 'CVD-2026-VALIDO-0001',
            sha256_firmado: sha256PdfValido,
            firmante: 'Director General IESTP Suiza',
            fecha_sello_tsa: new Date('2026-10-24T12:00:00Z'),
            estado: 'FIRMADO_DIGITALMENTE',
            s3_bucket: 'sigd-expedientes',
            s3_key: '2026/RD-001.pdf',
          },
        ],
      });

      const mockStorage: GeneradorUrlDescarga = {
        async generarUrlDescarga() {
          return 'http://localhost:9000/sigd-expedientes/2026/RD-001.pdf?X-Amz-Signature=mock';
        },
        async obtenerContenidoDocumento() {
          return pdfValido;
        },
      };

      const verificador = crearVerificadorCvd(mockPool as unknown as Pool, mockStorage);
      const req = {
        params: { cvd: 'CVD-2026-VALIDO-0001' },
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as Request;

      await verificador(req, mockRes as unknown as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          valido: false,
          esValido: false,
          cvd: 'CVD-2026-VALIDO-0001',
          sha256_firmado: sha256PdfValido,
          firmante: 'Director General IESTP Suiza',
          descarga_copia_certificada: '',
          documento: null,
          validacionCriptografica: false,
        }),
      );
    });

    it('2.2 Documento con hash alterado o no coincidente resulta en esValido=false sin lanzar 503', async () => {
      const pdfAlterado = Buffer.from('%PDF-1.4\nContenido corrupto o alterado');
      mockPool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            cvd: 'CVD-2026-ALTERADO-001',
            sha256_firmado: sha256PdfValido,
            firmante: 'Director General IESTP Suiza',
            fecha_sello_tsa: new Date('2026-10-24T12:00:00Z'),
            estado: 'FIRMADO_DIGITALMENTE',
            s3_bucket: 'sigd-expedientes',
            s3_key: '2026/RD-001.pdf',
          },
        ],
      });

      const mockStorage: GeneradorUrlDescarga = {
        async generarUrlDescarga() {
          return 'http://localhost:9000/sigd-expedientes/2026/RD-001.pdf?mock';
        },
        async obtenerContenidoDocumento() {
          return pdfAlterado;
        },
      };

      const verificador = crearVerificadorCvd(mockPool as unknown as Pool, mockStorage);
      const req = {
        params: { cvd: 'CVD-2026-ALTERADO-001' },
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as Request;

      await verificador(req, mockRes as unknown as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          valido: false,
          esValido: false,
          descarga_copia_certificada: '',
          documento: null,
        }),
      );
    });

    it('2.3 Cuando el objeto S3 no está disponible en almacenamiento, responde 503 CVD_DOCUMENT_UNAVAILABLE (Fail-Closed)', async () => {
      mockPool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            cvd: 'CVD-2026-NO-EN-S3-001',
            sha256_firmado: sha256PdfValido,
            firmante: 'Director General IESTP Suiza',
            fecha_sello_tsa: new Date('2026-10-24T12:00:00Z'),
            estado: 'FIRMADO_DIGITALMENTE',
            s3_bucket: 'sigd-expedientes',
            s3_key: '2026/RD-NOEXISTE.pdf',
          },
        ],
      });

      const mockStorage: GeneradorUrlDescarga = {
        async generarUrlDescarga() {
          return 'http://localhost:9000/sigd-expedientes/2026/RD-NOEXISTE.pdf';
        },
        async obtenerContenidoDocumento() {
          return null;
        },
      };

      const verificador = crearVerificadorCvd(mockPool as unknown as Pool, mockStorage);
      const req = {
        params: { cvd: 'CVD-2026-NO-EN-S3-001' },
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as Request;

      await expect(verificador(req, mockRes as unknown as Response)).rejects.toMatchObject({
        status: 503,
        code: 'CVD_DOCUMENT_UNAVAILABLE',
      });
    });

    it('2.4 Cuando el servicio S3 experimenta falla de transporte de red, responde 503 CVD_DOCUMENT_UNAVAILABLE', async () => {
      mockPool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            cvd: 'CVD-2026-S3-CAIDO-001',
            sha256_firmado: sha256PdfValido,
            firmante: 'Director General',
            fecha_sello_tsa: new Date(),
            estado: 'FIRMADO_DIGITALMENTE',
            s3_bucket: 'sigd-expedientes',
            s3_key: '2026/RD-001.pdf',
          },
        ],
      });

      const mockStorage: GeneradorUrlDescarga = {
        async generarUrlDescarga() {
          return '';
        },
        async obtenerContenidoDocumento() {
          throw new Error('ECONNREFUSED 127.0.0.1:9000');
        },
      };

      const verificador = crearVerificadorCvd(mockPool as unknown as Pool, mockStorage);
      const req = {
        params: { cvd: 'CVD-2026-S3-CAIDO-001' },
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as Request;

      await expect(verificador(req, mockRes as unknown as Response)).rejects.toMatchObject({
        status: 503,
        code: 'CVD_DOCUMENT_UNAVAILABLE',
      });
    });
  });

  describe('3. Resolución de Host para URLs de descarga autorizadas (Host vs Origin)', () => {
    it('3.1 Adapta endpoint interno minio a localhost cuando la cabecera Origin proviene del navegador (http://localhost:5173)', () => {
      process.env.S3_ENDPOINT = 'http://minio:9000';
      try {
        const mockReq = {
          get: vi.fn((header: string) => {
            if (header.toLowerCase() === 'origin') return 'http://localhost:5173';
            return undefined;
          }),
        } as unknown as Request;

        const url = generarDescargaAutorizada('sigd-expedientes', '2026/doc.pdf', mockReq);
        const urlParsed = new URL(url);

        expect(urlParsed.hostname).toBe('localhost');
        expect(urlParsed.port).toBe('9000');
        expect(urlParsed.searchParams.get('X-Amz-Signature')).toBeTruthy();
        expect(urlParsed.searchParams.get('X-Amz-SignedHeaders')).toContain('host');
      } finally {
        delete process.env.S3_ENDPOINT;
      }
    });

    it('3.2 Adapta endpoint interno minio a 127.0.0.1 cuando Origin es http://127.0.0.1:5173 y mantiene minio en llamadas internas', () => {
      process.env.S3_ENDPOINT = 'http://minio:9000';
      try {
        const mockReqLoopback = {
          get: vi.fn((header: string) => {
            if (header.toLowerCase() === 'origin') return 'http://127.0.0.1:5173';
            return undefined;
          }),
        } as unknown as Request;

        const urlLoopback = generarDescargaAutorizada('sigd-expedientes', '2026/doc.pdf', mockReqLoopback);
        expect(new URL(urlLoopback).hostname).toBe('127.0.0.1');

        const mockReqInterno = {
          get: vi.fn(() => undefined),
        } as unknown as Request;

        const urlInterna = generarDescargaAutorizada('sigd-expedientes', '2026/doc.pdf', mockReqInterno);
        expect(new URL(urlInterna).hostname).toBe('minio');
      } finally {
        delete process.env.S3_ENDPOINT;
      }
    });

    it('3.3 Rechaza caracteres de path traversal en la clave del documento', () => {
      const mockReq = {
        get: vi.fn().mockReturnValue('localhost:3000'),
      } as unknown as Request;

      expect(() => {
        generarDescargaAutorizada('sigd-expedientes', '../etc/passwd', mockReq);
      }).toThrowError(/La referencia del documento no está disponible/);
    });
  });
});
