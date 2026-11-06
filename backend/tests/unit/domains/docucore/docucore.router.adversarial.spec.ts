import { describe, it, expect, vi } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { crearRouterDocuCore } from '../../../../src/domains/docucore/docucore.router.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

describe('docucore.router.ts — Adversarial Route Parameter Verification', () => {
  const expedienteId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
  const usuarioId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13';
  const token = firmarTokenAcceso({ sub: usuarioId, roles: ['MESA_PARTES'] });
  const validBody = {
    documento_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    total_folios: 3,
  };

  function setupApp(paramOverride?: (req: Request) => void) {
    const mockClient = {
      query: vi.fn().mockImplementation((queryText: string, params?: unknown[]) => {
        if (queryText === 'BEGIN' || queryText === 'COMMIT' || queryText === 'ROLLBACK') {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        if (queryText.includes('SELECT DISTINCT r.codigo')) {
          return Promise.resolve({ rows: [{ codigo: 'MESA_PARTES' }], rowCount: 1 });
        }
        if (queryText.includes('SELECT expediente_id FROM sigd_doc.expediente')) {
          return Promise.resolve({ rows: [{ expediente_id: params?.[0] }], rowCount: 1 });
        }
        if (queryText.includes('SELECT') && queryText.includes('AS autorizado')) {
          return Promise.resolve({ rows: [{ autorizado: true }], rowCount: 1 });
        }
        if (queryText.includes('FROM sigd_doc.documento_adjunto')) {
          return Promise.resolve({ rows: [{ expediente_id: expedienteId }], rowCount: 1 });
        }
        if (queryText.includes('FROM sigd_tra.expediente_documento_folio')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        if (queryText.includes('FROM sigd_tra.expediente')) {
          return Promise.resolve({ rows: [{ expediente_id: expedienteId }], rowCount: 1 });
        }
        if (queryText.includes('agregar_folio_expediente')) {
          return Promise.resolve({
            rows: [{ folio_inicio: 1, folio_fin: 3 }],
            rowCount: 1,
          });
        }
        if (queryText.includes('FROM sigd_doc.firma_digital_documento')) {
          const cvdParam = params?.[0];
          if (cvdParam === 'CVD-VALID-123456') {
            return Promise.resolve({
              rows: [
                {
                  cvd: 'CVD-VALID-123456',
                  sha256_firmado: 'a'.repeat(64),
                  firmante: 'Director',
                  fecha_sello_tsa: new Date('2026-01-01T12:00:00Z'),
                  estado: 'FIRMADO_DIGITALMENTE',
                  s3_bucket: 'sigd-bucket',
                  s3_key: 'docs/123.pdf',
                },
              ],
              rowCount: 1,
            });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: mockClient.query,
    } as unknown as Pool;

    const app = express();
    app.use(express.json());

    if (paramOverride) {
      app.use('/v1/expedientes/:id/foliar-documento', (req: Request, _res: Response, next: NextFunction) => {
        paramOverride(req);
        const overriddenParams = { ...req.params };
        Object.defineProperty(req, 'params', {
          get: () => overriddenParams,
          set: () => {},
          configurable: true,
        });
        next();
      });
    }

    app.use(crearRouterDocuCore(mockPool));
    app.use(errorMiddleware);

    return { app, mockClient, mockPool };
  }

  describe('RFC 7807 and ValidationError compliance', () => {
    it('returns 201 for valid expediente id and valid body', async () => {
      const { app } = setupApp();
      const res = await request(app)
        .post(`/v1/expedientes/${expedienteId}/foliar-documento`)
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(res.status, res.text).toBe(201);
      expect(res.body).toHaveProperty('folio_desde', 1);
      expect(res.body).toHaveProperty('folio_hasta', 3);
    });

    it('rejects missing id with ValidationError (400 / RFC 7807)', async () => {
      const { app } = setupApp((req) => {
        // simulate missing id param (e.g. undefined)
        delete (req.params as Record<string, unknown>).id;
      });

      const res = await request(app)
        .post('/v1/expedientes/placeholder/foliar-documento')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.invalid_params).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'id', reason: 'El ID de expediente es obligatorio.' }),
        ]),
      );
    });

    it('rejects empty string id with ValidationError (400 / RFC 7807)', async () => {
      const { app } = setupApp((req) => {
        req.params.id = '';
      });

      const res = await request(app)
        .post('/v1/expedientes/placeholder/foliar-documento')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.invalid_params).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'id', reason: 'El ID de expediente es obligatorio.' }),
        ]),
      );
    });

    it('rejects non-string id (e.g. number/object) with ValidationError (400 / RFC 7807)', async () => {
      const { app } = setupApp((req) => {
        (req.params as Record<string, unknown>).id = 12345;
      });

      const res = await request(app)
        .post('/v1/expedientes/placeholder/foliar-documento')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.invalid_params).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'id', reason: 'El ID de expediente es obligatorio.' }),
        ]),
      );
    });

    it('adversarial check: whitespace id should be rejected with ValidationError (400 / RFC 7807)', async () => {
      const { app } = setupApp();
      // Sending URL encoded spaces as :id: /v1/expedientes/%20%20%20/foliar-documento
      const res = await request(app)
        .post('/v1/expedientes/%20%20%20/foliar-documento')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      // We expect 400 with VALIDATION_ERROR and invalid_params for 'id'
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.invalid_params).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'id' }),
        ]),
      );
    });

    it('adversarial check: array id should be rejected with ValidationError (400 / RFC 7807)', async () => {
      const { app } = setupApp((req) => {
        (req.params as Record<string, unknown>).id = ['exp-1', 'exp-2'];
      });

      const res = await request(app)
        .post('/v1/expedientes/placeholder/foliar-documento')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      // An array of IDs is not a valid single expediente ID and must be rejected with 400 ValidationError
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.invalid_params).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'id' }),
        ]),
      );
    });
  });

  describe('POST /v1/firma/callback-refirma — rawBody and webhook validation', () => {
    it('rejects missing rawBody with ValidationError (400 / RFC 7807)', async () => {
      const { app } = setupApp();
      const res = await request(app)
        .post('/v1/firma/callback-refirma')
        .send({
          documento_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          sha256_firmado: 'a'.repeat(64),
          firmante: 'Juan Perez',
          fecha_sello_tsa: new Date().toISOString(),
          s3_bucket: 'sigd-docs',
          s3_key: 'docs/doc.pdf',
        });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.invalid_params).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'rawBody',
            reason: 'No se recibió el cuerpo original para validar el callback.',
          }),
        ]),
      );
    });
  });

  describe('GET /v1/validador-cvd/verificar/:cvd — CVD validation', () => {
    it('rejects malformed CVD with ValidationError (400 / RFC 7807)', async () => {
      const { app } = setupApp();
      const res = await request(app).get('/v1/validador-cvd/verificar/CVD-1');

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.invalid_params).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'cvd',
            reason: 'El formato del CVD es inválido.',
          }),
        ]),
      );
    });

    it('returns 404 NotFoundError if CVD does not exist', async () => {
      const { app } = setupApp();
      const res = await request(app).get('/v1/validador-cvd/verificar/CVD-NONEXISTENT-99999');

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('returns 200 with document details if CVD is valid and exists', async () => {
      const { app } = setupApp();
      const res = await request(app).get('/v1/validador-cvd/verificar/CVD-VALID-123456');

      expect(res.status).toBe(200);
      expect(res.body.valido).toBe(true);
      expect(res.body.cvd).toBe('CVD-VALID-123456');
    });
  });
});
