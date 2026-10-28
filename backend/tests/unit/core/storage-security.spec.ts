import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import { construirApp } from '../../../src/app.js';
import { firmarTokenAcceso } from '../../../src/core/auth/jwt.service.js';

describe('SEC-02 & SEC-03: Seguridad y Consistencia en Storage S3', () => {
  const ID_USUARIO_PROPIETARIO = '11111111-1111-4111-8111-111111111111';
  const ID_PERSONA_PROPIETARIO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const ID_USUARIO_AJENO = '22222222-2222-4222-8222-222222222222';
  const ID_PERSONA_AJENO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const ID_EXPEDIENTE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const ID_TIPO_DOC = 'a373f0c7-8d3e-4328-aec1-78409b539131';

  const tokenPropietario = firmarTokenAcceso({
    sub: ID_USUARIO_PROPIETARIO,
    roles: ['CIUDADANO'],
  });

  const tokenAjeno = firmarTokenAcceso({
    sub: ID_USUARIO_AJENO,
    roles: ['CIUDADANO'],
  });

  const tokenAdmin = firmarTokenAcceso({
    sub: '55555555-5555-4555-8555-555555555555',
    roles: ['ADMINISTRADOR'],
  });
  const tokenEspecialistaSinArea = firmarTokenAcceso({
    sub: ID_USUARIO_AJENO,
    roles: ['ESPECIALISTA'],
  });

  const mockPool = {
    query: async (sql: string, params?: unknown[]) => {
      const sqlStr = String(sql);

      // Consulta de usuario / persona
      if (sqlStr.includes('sigd_auth.cuenta_usuario')) {
        const userId = params?.[0];
        if (userId === ID_USUARIO_PROPIETARIO) {
          return { rows: [{ id_persona: ID_PERSONA_PROPIETARIO, area_id: null }] };
        }
        if (userId === ID_USUARIO_AJENO) {
          return { rows: [{ id_persona: ID_PERSONA_AJENO, area_id: null }] };
        }
        return { rows: [] };
      }

      // Consulta de expediente (en sigd_doc.expediente o sigd_tra.expediente)
      if ((sqlStr.includes('FROM sigd_doc.expediente') || sqlStr.includes('FROM sigd_tra.expediente')) &&
          sqlStr.includes('expediente_id = $1')) {
        const expId = params?.[0];
        if (expId === ID_EXPEDIENTE) {
          return {
            rows: [
              {
                expediente_id: ID_EXPEDIENTE,
                solicitante_id: ID_PERSONA_PROPIETARIO,
                area_destino_id: null,
                area_actual_id: null,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // Consulta de tipo documento para confirmar-carga
      if (sqlStr.includes('sigd_doc.tipo_documento')) {
        return {
          rows: [
            {
              tipo_documental_id: ID_TIPO_DOC,
              vigente: true,
            },
          ],
          rowCount: 1,
        };
      }

      // Consulta de documento adjunto para download
      if (sqlStr.includes('sigd_doc.documento_adjunto') && sqlStr.includes('da.s3_bucket = $1 AND da.s3_key = $2')) {
        const keyParam = params?.[1];
        if (keyParam === 'expedientes/2026/inexistente.pdf') {
          return { rows: [] };
        }
        return {
          rows: [
            {
              expediente_id: ID_EXPEDIENTE,
              solicitante_id: ID_PERSONA_PROPIETARIO,
            },
          ],
        };
      }

      // Inserción en documento_adjunto
      if (sqlStr.includes('INSERT INTO sigd_doc.documento_adjunto')) {
        return {
          rows: [
            {
              documento_adjunto_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              sha256: String(params?.[7] ?? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
            },
          ],
          rowCount: 1,
        };
      }

      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => undefined,
    }),
  } as unknown as Pool;

  const app = construirApp(mockPool);

  const payloadPresignedValido = {
    nombreArchivo: 'requisito_tramite.pdf',
    tamanoBytes: 1024 * 50,
    mimeType: 'application/pdf',
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };

  it('anónimo upload -> 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/storage/presigned-url')
      .send(payloadPresignedValido);

    expect(res.status).toBe(401);
  });

  it('anónimo download -> 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/v1/storage/download/sigd-expedientes/expedientes%2F2026%2Ftest.pdf');

    expect(res.status).toBe(401);
  });

  it('usuario ajeno intentando presigned-url sobre expediente ajeno -> 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/storage/presigned-url')
      .set('Authorization', `Bearer ${tokenAjeno}`)
      .send({
        ...payloadPresignedValido,
        idExpediente: ID_EXPEDIENTE,
      });

    expect(res.status).toBe(403);
  });

  it('usuario ajeno intentando descargar documento de expediente ajeno -> 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/storage/download/sigd-expedientes/expedientes%2F2026%2Ftest.pdf')
      .set('Authorization', `Bearer ${tokenAjeno}`);

    expect(res.status).toBe(403);
  });

  it('actor autorizado (titular) genera presigned-url exitosamente -> 200 OK', async () => {
    const res = await request(app)
      .post('/api/v1/storage/presigned-url')
      .set('Authorization', `Bearer ${tokenPropietario}`)
      .send({
        ...payloadPresignedValido,
        idExpediente: ID_EXPEDIENTE,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uploadUrl');
    expect(res.body).toHaveProperty('s3Key');
  });

  it('actor institucional autorizado (ADMINISTRADOR) descarga documento institucional -> 200 OK', async () => {
    const res = await request(app)
      .get('/api/v1/storage/download/sigd-expedientes/expedientes%2F2026%2Ftest.pdf')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('downloadUrl');
  });

  it('no preautoriza un expediente inexistente por tener rol ADMINISTRADOR', async () => {
    const res = await request(app)
      .post('/api/v1/storage/presigned-url')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...payloadPresignedValido, idExpediente: '99999999-9999-4999-8999-999999999999' });
    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('uploadUrl');
  });

  it('no permite a un ESPECIALISTA sin custodia descargar un documento ajeno', async () => {
    const res = await request(app)
      .get('/api/v1/storage/download/sigd-expedientes/expedientes%2F2026%2Ftest.pdf')
      .set('Authorization', `Bearer ${tokenEspecialistaSinArea}`);
    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('downloadUrl');
  });

  it('rechaza descarga cuando se solicita un bucket arbitrario no institucional -> 400 Validation Error', async () => {
    const res = await request(app)
      .get('/api/v1/storage/download/bucket-malicioso-externo/expedientes%2F2026%2Ftest.pdf')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect([400, 422]).toContain(res.status);
    expect(res.body.title).toContain('Validation');
  });

  it('SEC-03: si pool.query falla en confirmar-carga, propaga error 5xx con RFC 9457 y NO responde 201', async () => {
    const pdfContenido = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const pdfHash = crypto.createHash('sha256').update(pdfContenido).digest('hex');

    const fakeS3 = {
      send: async () => ({
        Body: Readable.from([pdfContenido]),
      }),
    };

    const poolConFallo = {
      query: async (sql: string) => {
        const sqlStr = String(sql);
        if (sqlStr.includes('sigd_doc.expediente') || sqlStr.includes('sigd_tra.expediente')) {
          return {
            rows: [
              {
                expediente_id: ID_EXPEDIENTE,
                solicitante_id: ID_PERSONA_PROPIETARIO,
                area_destino_id: null,
                area_actual_id: null,
              },
            ],
            rowCount: 1,
          };
        }
        if (sqlStr.includes('sigd_doc.tipo_documento')) {
          return {
            rows: [
              {
                tipo_documental_id: ID_TIPO_DOC,
                vigente: true,
              },
            ],
            rowCount: 1,
          };
        }
        if (sqlStr.includes('INSERT INTO sigd_doc.documento_adjunto')) {
          throw new Error('FATAL: disk full or database connection broken');
        }
        return { rows: [] };
      },
      connect: async () => ({
        query: async () => ({ rows: [] }),
        release: () => undefined,
      }),
    } as unknown as Pool;

    const appFallo = construirApp(poolConFallo, { s3Client: fakeS3 as any });

    const payloadConfirmar = {
      s3Key: 'expedientes/2026/test.pdf',
      sha256Hash: pdfHash,
      idExpediente: ID_EXPEDIENTE,
      tipoDocumentalId: ID_TIPO_DOC,
    };

    const res = await request(appFallo)
      .post('/api/v1/storage/confirmar-carga')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(payloadConfirmar);

    expect(res.status).toBe(500);
    expect(res.body).not.toHaveProperty('confirmado');
    expect(res.body.title).toBeDefined();
  });

  it('F-02 FAIL-CLOSED: documento inexistente en DB (0 rows) -> 404 Not Found, nunca genera URL', async () => {
    const res = await request(app)
      .get('/api/v1/storage/download/sigd-expedientes/expedientes%2F2026%2Finexistente.pdf')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('downloadUrl');
  });

  it('F-02 FAIL-CLOSED: error DB inducido en consulta de documento -> 5xx, nunca URL', async () => {
    const poolConFallo = {
      query: async (sql: string) => {
        if (sql.includes('sigd_doc.documento_adjunto')) {
          throw new Error('DATABASE_CONNECTION_LOST');
        }
        return { rows: [] };
      },
      connect: async () => ({
        query: async () => ({ rows: [] }),
        release: () => undefined,
      }),
    } as unknown as Pool;

    const appFallo = construirApp(poolConFallo);

    const res = await request(appFallo)
      .get('/api/v1/storage/download/sigd-expedientes/expedientes%2F2026%2Ftest.pdf')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(500);
    expect(res.body).not.toHaveProperty('downloadUrl');
  });

  it('F-02 FAIL-CLOSED: sin pool de conexión -> 403 Forbidden', async () => {
    const appSinPool = construirApp(undefined as unknown as Pool);

    const res = await request(appSinPool)
      .get('/api/v1/storage/download/sigd-expedientes/expedientes%2F2026%2Ftest.pdf')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('downloadUrl');
  });

  it('H-01 FAIL-CLOSED: confirmar-carga sin pool de conexión -> 403 Forbidden', async () => {
    const appSinPool = construirApp(undefined as unknown as Pool);

    const res = await request(appSinPool)
      .post('/api/v1/storage/confirmar-carga')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        s3Key: 'expedientes/2026/test.pdf',
        sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        idExpediente: ID_EXPEDIENTE,
        tipoDocumentalId: ID_TIPO_DOC,
      });

    expect(res.status).toBe(403);
  });

  it('H-02 FAIL-CLOSED: presigned-url con expediente y sin pool de conexión -> 403 Forbidden', async () => {
    const appSinPool = construirApp(undefined as unknown as Pool);

    const res = await request(appSinPool)
      .post('/api/v1/storage/presigned-url')
      .set('Authorization', `Bearer ${tokenPropietario}`)
      .send({
        ...payloadPresignedValido,
        idExpediente: ID_EXPEDIENTE,
      });

    expect(res.status).toBe(403);
  });

  it('H-01: confirmar-carga exitoso con S3 y DB -> 201 Created con documentoId', async () => {
    const pdfContenido = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const pdfHash = crypto.createHash('sha256').update(pdfContenido).digest('hex');

    const fakeS3 = {
      send: async () => ({
        Body: Readable.from([pdfContenido]),
      }),
    };

    const { crearRouterStorage } = await import('../../../src/core/storage/storage.router.js');
    const express = (await import('express')).default;
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/v1', crearRouterStorage(mockPool, fakeS3 as any));

    const res = await request(testApp)
      .post('/api/v1/storage/confirmar-carga')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        s3Key: 'expedientes/2026/real.pdf',
        sha256Hash: pdfHash,
        idExpediente: ID_EXPEDIENTE,
        tipoDocumentalId: ID_TIPO_DOC,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('documentoId');
    expect(res.body).toHaveProperty('confirmado', true);
    expect(res.body.sha256).toBe(pdfHash);
  });

  it('asocia el PDF al expediente canónico TRA sin confundir un UUID duplicado en DOC', async () => {
    const pdf = Buffer.from('%PDF-1.4\n%%EOF');
    const hash = crypto.createHash('sha256').update(pdf).digest('hex');
    const queries: string[] = [];
    const insert = vi.fn().mockResolvedValue({
      rows: [{ documento_adjunto_id: ID_EXPEDIENTE, sha256: hash }], rowCount: 1,
    });
    const poolTra = {
      query: async (sql: string, params?: unknown[]) => {
        queries.push(sql);
        if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) return insert(sql, params);
        if (sql.includes('FROM sigd_tra.expediente')) {
          return { rows: [{ expediente_id: ID_EXPEDIENTE, solicitante_id: ID_PERSONA_PROPIETARIO, area_actual_id: null }] };
        }
        if (sql.includes('FROM sigd_doc.expediente')) {
          return { rows: [{ expediente_id: ID_EXPEDIENTE, solicitante_id: ID_PERSONA_AJENO, area_actual_id: null }] };
        }
        if (sql.includes('sigd_auth.cuenta_usuario')) {
          return { rows: [{ id_persona: params?.[0] === ID_USUARIO_PROPIETARIO ? ID_PERSONA_PROPIETARIO : ID_PERSONA_AJENO, area_id: null }] };
        }
        if (sql.includes('sigd_doc.tipo_documento')) return { rows: [{ tipo_documental_id: ID_TIPO_DOC, vigente: true }] };
        if (sql.includes('sigd_doc.documento_adjunto') && sql.includes('da.s3_bucket')) {
          return { rows: [{ expediente_id: ID_EXPEDIENTE, origen_expediente: 'TRA' }] };
        }
        return { rows: [] };
      },
    } as unknown as Pool;
    const fakeS3 = { send: async () => ({ Body: Readable.from([pdf]) }) };
    const { crearRouterStorage } = await import('../../../src/core/storage/storage.router.js');
    const express = (await import('express')).default;
    const { errorMiddleware } = await import('../../../src/middleware/error-middleware.js');
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/v1', crearRouterStorage(poolTra, fakeS3 as any));
    testApp.use(errorMiddleware);

    const payload = {
      s3Key: 'expedientes/2026/tra.pdf', sha256Hash: hash,
      idExpediente: ID_EXPEDIENTE, tipoDocumentalId: ID_TIPO_DOC,
      origenExpediente: 'TRA',
    };
    const own = await request(testApp).post('/api/v1/storage/confirmar-carga')
      .set('Authorization', `Bearer ${tokenPropietario}`).send(payload);
    expect(own.status).toBe(201);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toContain('expediente_tra_id');
    expect(queries.some((sql) => sql.includes('FROM sigd_doc.expediente'))).toBe(false);

    const foreign = await request(testApp)
      .get('/api/v1/storage/download/sigd-expedientes/expedientes%2F2026%2Ftra.pdf')
      .set('Authorization', `Bearer ${tokenAjeno}`);
    expect(foreign.status).toBe(403);
    expect(foreign.body).not.toHaveProperty('downloadUrl');
  });

  it('reintentar confirmación del mismo SHA y expediente devuelve el adjunto existente sin duplicarlo', async () => {
    const hash = 'a'.repeat(64);
    const insert = vi.fn();
    const poolRetry = {
      query: async (sql: string, params?: unknown[]) => {
        if (sql.includes('FROM sigd_tra.expediente')) {
          return { rows: [{ expediente_id: ID_EXPEDIENTE, solicitante_id: ID_PERSONA_PROPIETARIO, area_actual_id: null }] };
        }
        if (sql.includes('sigd_auth.cuenta_usuario')) {
          return { rows: [{ id_persona: ID_PERSONA_PROPIETARIO, area_id: null }] };
        }
        if (sql.includes('sigd_doc.tipo_documento')) return { rows: [{ tipo_documental_id: ID_TIPO_DOC, vigente: true }] };
        if (sql.includes('SELECT documento_adjunto_id') && sql.includes('sigd_doc.documento_adjunto')) {
          expect(params).toContain(ID_EXPEDIENTE);
          return { rows: [{ documento_adjunto_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', s3_key: 'original.pdf', sha256: hash }] };
        }
        if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) return insert();
        return { rows: [] };
      },
    } as unknown as Pool;
    const s3Send = vi.fn();
    const { crearRouterStorage } = await import('../../../src/core/storage/storage.router.js');
    const express = (await import('express')).default;
    const { errorMiddleware } = await import('../../../src/middleware/error-middleware.js');
    const appRetry = express();
    appRetry.use(express.json());
    appRetry.use('/api/v1', crearRouterStorage(poolRetry, { send: s3Send } as any));
    appRetry.use(errorMiddleware);
    const response = await request(appRetry).post('/api/v1/storage/confirmar-carga')
      .set('Authorization', `Bearer ${tokenPropietario}`)
      .send({ s3Key: 'retry.pdf', sha256Hash: hash, idExpediente: ID_EXPEDIENTE,
        tipoDocumentalId: ID_TIPO_DOC, origenExpediente: 'TRA' });
    expect(response.status).toBe(200);
    expect(response.body.documentoId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(insert).not.toHaveBeenCalled();
    expect(s3Send).not.toHaveBeenCalled();
  });
});
