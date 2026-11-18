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
  expect(generarUrlDescarga).not.toHaveBeenCalled();
});
