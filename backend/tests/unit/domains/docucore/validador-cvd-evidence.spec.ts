import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { crearVerificadorCvd } from '../../../../src/domains/docucore/validadorCvd.controller.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

it('no fabrica número de resolución, emisor, certificado ni descarga en el CVD público', async () => {
  const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{
    cvd: 'CVD-2026-RD-000412-892F', sha256_firmado: 'a'.repeat(64),
    firmante: 'Firmante Persistido', fecha_sello_tsa: '2026-10-24T13:00:00Z',
    estado: 'FIRMADO_DIGITALMENTE', s3_bucket: null, s3_key: null,
  }] });
  const generarUrlDescarga = vi.fn();
  const app = express();
  app.get('/cvd/:cvd', (req, res, next) => {
    crearVerificadorCvd({ query } as unknown as Pool, { generarUrlDescarga })(req, res).catch(next);
  });
  app.use(errorMiddleware);
  const response = await request(app).get('/cvd/CVD-2026-RD-000412-892F');
  expect(response.status).toBe(200);
  expect(response.body.documento).toBeNull();
  expect(response.body.descarga_copia_certificada).toBeNull();
  expect(response.body.sha256_firmado).toBe('a'.repeat(64));
  expect(response.body.firmante).toBe('Firmante Persistido');
  expect(response.body.naturalezaFirma).toBe('FIRMA_DIGITAL_OFICIAL');
  expect(response.body.esFirmaLaboratorio).toBe(false);
  expect(generarUrlDescarga).not.toHaveBeenCalled();
});

it('distingue firma de laboratorio cuando el certificado o proveedor es de pruebas', async () => {
  const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{
    cvd: 'CVD-2026-LAB-000001', sha256_firmado: 'b'.repeat(64),
    firmante: 'Director Lab', fecha_sello_tsa: '2026-10-24T13:00:00Z',
    estado: 'FIRMADO_DIGITALMENTE', s3_bucket: null, s3_key: null,
    proveedor_firma: 'MOCK_TEST', certificado_emisor: 'CN=SIGD TEST ROOT CA, OU=TEST_ONLY',
    algoritmo_firma: 'SHA256withRSA', firma_b64: 'c2ln',
  }] });
  const app = express();
  app.get('/cvd/:cvd', (req, res, next) => {
    crearVerificadorCvd({ query } as unknown as Pool)(req, res).catch(next);
  });
  app.use(errorMiddleware);
  const response = await request(app).get('/cvd/CVD-2026-LAB-000001');
  expect(response.status).toBe(200);
  expect(response.body.valido).toBe(true);
  expect(response.body.naturalezaFirma).toBe('FIRMA_LABORATORIO');
  expect(response.body.esFirmaLaboratorio).toBe(true);
});

it('detecta artefacto vacío e invalida el CVD cuando sha256_firmado corresponde a contenido vacío', async () => {
  const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{
    cvd: 'CVD-2026-MOD-806593',
    sha256_firmado: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    firmante: 'DIRECTOR GENERAL IESTP SUIZA', fecha_sello_tsa: '2026-11-17T15:27:27Z',
    estado: 'FIRMADO_DIGITALMENTE', s3_bucket: 'sigd-expedientes',
    s3_key: 'resoluciones/2026/c0e4671a-8051-4f32-b056-cdc374a6042f.pdf',
    proveedor_firma: 'DNIE_CANONICO', certificado_emisor: null,
    algoritmo_firma: 'SHA256withRSA', firma_b64: null,
  }] });
  const app = express();
  app.get('/cvd/:cvd', (req, res, next) => {
    crearVerificadorCvd({ query } as unknown as Pool)(req, res).catch(next);
  });
  app.use(errorMiddleware);
  const response = await request(app).get('/cvd/CVD-2026-MOD-806593');
  expect(response.status).toBe(200);
  expect(response.body.valido).toBe(false);
  expect(response.body.naturalezaFirma).toBe('EVIDENCIA_INCOMPLETA');
  expect(response.body.integridadArchivo).toBe('ARTEFACTO_INEXISTENTE_O_VACIO');
});
