import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import type { Pool } from 'pg';
import type { S3Client } from '@aws-sdk/client-s3';
import { construirApp } from '../../../src/app.js';
import { firmarTokenAcceso } from '../../../src/core/auth/jwt.service.js';

describe('SEC-02: Storage S3 Real Object Validation en confirmar-carga', () => {
  const ID_EXPEDIENTE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const ID_TIPO_DOC = 'a373f0c7-8d3e-4328-aec1-78409b539131';

  const token = firmarTokenAcceso({
    sub: '11111111-1111-1111-1111-111111111111',
    roles: ['ADMINISTRADOR'],
    expiraSegundos: 300,
  });

  const pdfBufferValido = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const hashValido = crypto.createHash('sha256').update(pdfBufferValido).digest('hex');

  const fakePool = {
    query: vi.fn(async (sql: string) => {
      const sqlStr = String(sql);
      if (sqlStr.includes('sigd_doc.expediente')) {
        return {
          rows: [
            {
              expediente_id: ID_EXPEDIENTE,
              solicitante_id: '11111111-1111-1111-1111-111111111111',
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
      return { rows: [], rowCount: 1 };
    }),
    connect: vi.fn(async () => ({
      query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
      release: vi.fn(),
    })),
  } as unknown as Pool;

  it('rechaza con 404 si el objeto no existe en S3 (NoSuchKey)', async () => {
    const mockS3 = {
      send: vi.fn(async () => {
        const error = new Error('The specified key does not exist.') as Error & { name: string; $metadata: any };
        error.name = 'NoSuchKey';
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      }),
    } as unknown as S3Client;

    const app = construirApp(fakePool, { s3Client: mockS3 });

    const res = await request(app)
      .post('/api/v1/storage/confirmar-carga')
      .set('Authorization', `Bearer ${token}`)
      .send({
        s3Key: 'expedientes/2026/archivo-inexistente.pdf',
        sha256Hash: hashValido,
        idExpediente: ID_EXPEDIENTE,
        tipoDocumentalId: ID_TIPO_DOC,
      });

    expect(res.status).toBe(404);
    expect(res.body.detail).toContain('no existe en el almacenamiento institucional');
  });

  it('rechaza con 400/422 si los magic bytes no corresponden a %PDF-', async () => {
    const maliciousBuffer = Buffer.from('<html><script>alert(1)</script></html>');
    const maliciousHash = crypto.createHash('sha256').update(maliciousBuffer).digest('hex');

    const mockS3 = {
      send: vi.fn(async () => ({
        Body: Readable.from(maliciousBuffer),
      })),
    } as unknown as S3Client;

    const app = construirApp(fakePool, { s3Client: mockS3 });

    const res = await request(app)
      .post('/api/v1/storage/confirmar-carga')
      .set('Authorization', `Bearer ${token}`)
      .send({
        s3Key: 'expedientes/2026/fake.pdf',
        sha256Hash: maliciousHash,
        idExpediente: ID_EXPEDIENTE,
        tipoDocumentalId: ID_TIPO_DOC,
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.detail || res.body.message || JSON.stringify(res.body)).toContain('PDF');
  });

  it('rechaza con 400/422 si el hash calculado en S3 no coincide con el declarado', async () => {
    const mockS3 = {
      send: vi.fn(async () => ({
        Body: Readable.from(pdfBufferValido),
      })),
    } as unknown as S3Client;

    const app = construirApp(fakePool, { s3Client: mockS3 });

    const res = await request(app)
      .post('/api/v1/storage/confirmar-carga')
      .set('Authorization', `Bearer ${token}`)
      .send({
        s3Key: 'expedientes/2026/tampered.pdf',
        sha256Hash: '0000000000000000000000000000000000000000000000000000000000000000',
        idExpediente: ID_EXPEDIENTE,
        tipoDocumentalId: ID_TIPO_DOC,
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.detail || res.body.message || JSON.stringify(res.body)).toContain('integridad criptográfica');
  });

  it('confirma con 201 y persiste en DB cuando el objeto en S3 es PDF válido y el hash coincide', async () => {
    let insertedInDb = false;
    const testPool = {
      query: vi.fn(async (sql: string) => {
        const sqlStr = String(sql);
        if (sqlStr.includes('sigd_doc.expediente')) {
          return {
            rows: [
              {
                expediente_id: ID_EXPEDIENTE,
                solicitante_id: '11111111-1111-1111-1111-111111111111',
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
          insertedInDb = true;
          return {
            rows: [
              {
                documento_adjunto_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                sha256: hashValido,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      connect: vi.fn(async () => ({
        query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
        release: vi.fn(),
      })),
    } as unknown as Pool;

    const mockS3 = {
      send: vi.fn(async () => ({
        Body: Readable.from(pdfBufferValido),
      })),
    } as unknown as S3Client;

    const app = construirApp(testPool, { s3Client: mockS3 });

    const res = await request(app)
      .post('/api/v1/storage/confirmar-carga')
      .set('Authorization', `Bearer ${token}`)
      .send({
        s3Key: 'expedientes/2026/valido.pdf',
        sha256Hash: hashValido,
        idExpediente: ID_EXPEDIENTE,
        tipoDocumentalId: ID_TIPO_DOC,
      });

    expect(res.status).toBe(201);
    expect(res.body.confirmado).toBe(true);
    expect(res.body.s3Key).toBe('expedientes/2026/valido.pdf');
    expect(insertedInDb).toBe(true);
  });
});
