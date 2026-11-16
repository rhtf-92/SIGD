import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  generarUrlPresigned,
  headObject,
  type MetodoS3,
} from '../../src/core/storage/s3-storage.service.js';
import type { ConfiguracionS3 } from '../../src/config/s3.config.js';

const mockConfig: ConfiguracionS3 = {
  endpoint: 'http://127.0.0.1:9000',
  region: 'us-east-1',
  bucket: 'sigd-expedientes',
  accessKey: 'test-access-key',
  secretKey: 'test-secret-key',
  forcePathStyle: true,
  presignExpirationSegundos: 900,
};

describe('AF-19 — S3 Storage Service & SigV4 headObject', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('generarUrlPresigned — Firma canónica por método HTTP', () => {
    it('Caso 4.1: firma por defecto utiliza el método GET', () => {
      const urlDefault = generarUrlPresigned('test.pdf', mockConfig);
      const urlExplicitGet = generarUrlPresigned('test.pdf', mockConfig, { metodo: 'GET' });
      expect(urlDefault).toBe(urlExplicitGet);
    });

    it('Caso 4.2: firma para PUT genera firma distinta a GET', () => {
      const fechaFija = new Date('2026-10-24T12:00:00Z');
      const urlGet = generarUrlPresigned('test.pdf', mockConfig, { metodo: 'GET', ahora: fechaFija });
      const urlPut = generarUrlPresigned('test.pdf', mockConfig, { metodo: 'PUT', ahora: fechaFija });
      
      const sigGet = new URL(urlGet).searchParams.get('X-Amz-Signature');
      const sigPut = new URL(urlPut).searchParams.get('X-Amz-Signature');
      expect(sigGet).toBeTruthy();
      expect(sigPut).toBeTruthy();
      expect(sigGet).not.toBe(sigPut);
    });

    it('Caso 4.3: firma para HEAD genera firma específica distinta a GET y PUT', () => {
      const fechaFija = new Date('2026-10-24T12:00:00Z');
      const urlGet = generarUrlPresigned('test.pdf', mockConfig, { metodo: 'GET', ahora: fechaFija });
      const urlHead = generarUrlPresigned('test.pdf', mockConfig, { metodo: 'HEAD', ahora: fechaFija });
      const urlPut = generarUrlPresigned('test.pdf', mockConfig, { metodo: 'PUT', ahora: fechaFija });

      const sigGet = new URL(urlGet).searchParams.get('X-Amz-Signature');
      const sigHead = new URL(urlHead).searchParams.get('X-Amz-Signature');
      const sigPut = new URL(urlPut).searchParams.get('X-Amz-Signature');

      expect(sigHead).toBeTruthy();
      expect(sigHead).not.toBe(sigGet);
      expect(sigHead).not.toBe(sigPut);
    });
  });

  describe('headObject — Comprobación de metadatos y sondeo seguro', () => {
    it('Caso 1: objeto existente — despacha HTTP HEAD con firma HEAD y retorna metadatos', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        expect(init.method).toBe('HEAD');
        const urlParsed = new URL(url);
        // Debe contener los parámetros SigV4 requeridos
        expect(urlParsed.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
        expect(urlParsed.searchParams.get('X-Amz-Signature')).toBeTruthy();

        return new Response(null, {
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            'content-length': '1047',
          },
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      const resultado = await headObject('expedientes/2026/doc.pdf', mockConfig, { intentos: 1 });

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(resultado).toEqual({
        existe: true,
        contentType: 'application/pdf',
        contentLength: 1047,
      });
    });

    it('Caso 2: objeto inexistente — HTTP 404 retorna existe: false sin lanzar error', async () => {
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        expect(init.method).toBe('HEAD');
        return new Response(null, { status: 404 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const resultado = await headObject('expedientes/2026/inexistente.pdf', mockConfig, { intentos: 1 });

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(resultado).toEqual({
        existe: false,
        contentType: null,
        contentLength: null,
      });
    });

    it('Caso 3: firma inválida o fallo de permisos — HTTP 403 lanza error y NO se confunde con 404', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(null, { status: 403 });
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        headObject('expedientes/2026/bloqueado.pdf', mockConfig, { intentos: 1 }),
      ).rejects.toThrow('S3 respondió 403 en HEAD expedientes/2026/bloqueado.pdf');

      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('Caso 3.2: error de servidor HTTP 500 lanza error preservando status', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(null, { status: 500 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const intento = headObject('expedientes/2026/falla.pdf', mockConfig, { intentos: 1 });
      await expect(intento).rejects.toMatchObject({
        message: expect.stringContaining('S3 respondió 500 en HEAD'),
        status: 500,
      });
    });
  });
});
