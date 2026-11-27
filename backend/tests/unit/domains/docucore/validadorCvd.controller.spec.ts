import express, { type ErrorRequestHandler } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { crearVerificadorCvd } from '../../../../src/domains/docucore/validadorCvd.controller.js';

const manejadorErrores: ErrorRequestHandler = (
  error: Error & { status?: number; code?: string; detail?: string },
  _req,
  res,
  _next,
) => {
  res.status(error.status ?? 500).json({
    code: error.code ?? 'INTERNAL_ERROR',
    detail: error.detail ?? error.message,
  });
};

function crearApp(pool: Pool, generarUrlDescarga = vi.fn().mockResolvedValue('/descarga')) {
  const app = express();
  app.get('/:cvd', crearVerificadorCvd(pool, { generarUrlDescarga }));
  app.use(manejadorErrores);
  return { app, generarUrlDescarga };
}

describe('Verificador público de CVD', () => {
  it('valida un CVD emitido como notificación y tolera fallo del almacenamiento', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{
        cvd: 'CVD-2026-RD-000142-A4F2',
        sha256_firmado: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ',
        firmante: 'Dirección General IESTP Suiza',
        fecha_sello_tsa: new Date('2026-01-01T12:00:00.000Z'),
        estado: 'FIRMADO_DIGITALMENTE',
        s3_bucket: 'sigd-docs',
        s3_key: 'notificaciones/CVD-2026-RD-000142-A4F2.pdf',
        numero_documento: 'RD N.° 0142-2026-DG-IESTP-SUIZA',
        asunto: 'Notificación de Resolución Directoral de Matrícula',
      }],
    });
    const { app } = crearApp(
      { query } as unknown as Pool,
      vi.fn().mockRejectedValue(new Error('S3 settings unavailable')),
    );

    const respuesta = await request(app).get('/CVD-2026-RD-000142-A4F2');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      valido: true,
      esValido: true,
      cvd: 'CVD-2026-RD-000142-A4F2',
      descarga_copia_certificada:
        '/api/v1/storage/download/sigd-docs/notificaciones%2FCVD-2026-RD-000142-A4F2.pdf',
    });
    expect(respuesta.body.documento.numeroDocumento).toBe(
      'RD N.° 0142-2026-DG-IESTP-SUIZA',
    );
    expect(respuesta.body.documento.hashIntegridadSha256).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(query.mock.calls[0][0]).toContain('sigd_doc.firma_digital_documento');
    expect(query.mock.calls[0][0]).toContain('sigd_auth.notificacion_casilla');
  });

  it('responde 404 sin filtrar detalles si el CVD no existe en ninguna fuente', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const { app } = crearApp({ query } as unknown as Pool);

    const respuesta = await request(app).get('/CVD-2026-RD-999999-FFFF');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.code).toBe('NOT_FOUND');
  });
});
