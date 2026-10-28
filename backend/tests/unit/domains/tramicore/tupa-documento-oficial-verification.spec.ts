import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import type { Pool } from 'pg';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

describe('P0 — Verificación Real del PDF Oficial en MinIO (Codex Audit)', () => {
  const ID_V2026 = '11111111-2026-4111-8111-111111111111';
  const UPLOAD_ID = '33333333-3333-4333-8333-333333333333';
  const STORAGE_KEY = `tupa/2026/oficiales/${UPLOAD_ID}/TUPA_2026_OFICIAL.pdf`;
  const tokenAdmin = firmarTokenAcceso({
    sub: '11111111-1111-4111-8111-111111111111',
    roles: ['ADMINISTRADOR'],
    expiraSegundos: 3600,
  });

  let mockPool: Partial<Pool>;
  let mockS3: any;
  let app: express.Express;
  let cargaConfirmada: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    cargaConfirmada = false;

    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('UPDATE sigd_doc.tupa_documento_oficial_upload')) {
          if (cargaConfirmada) return { rows: [], rowCount: 0 };
          cargaConfirmada = true;
          return { rows: [{ upload_id: UPLOAD_ID }], rowCount: 1 };
        }
        if (sql.includes('UPDATE sigd_doc.tupa_version SET documento_oficial_key')) {
          return {
            rows: [
              {
                id_version: ID_V2026,
                codigo: 'TUPA-2026',
                denominacion: 'TUPA 2026 Oficial',
                anio: 2026,
                estado: 'VIGENTE',
                documento_oficial_key: params?.[1],
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes('INSERT INTO sigd_doc.tupa_documento_oficial_historial')) {
          return { rows: [{ id_historial: 'hist-1' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient as any),
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('FROM sigd_doc.tupa_documento_oficial_upload')) {
          if (params?.[0] !== UPLOAD_ID) return { rows: [], rowCount: 0 };
          return { rows: [{ upload_id: UPLOAD_ID, id_version: ID_V2026, storage_key: STORAGE_KEY, nombre_archivo: 'TUPA_2026_OFICIAL.pdf', emitido_por: '11111111-1111-4111-8111-111111111111', estado: cargaConfirmada ? 'CONFIRMADO' : 'PENDIENTE' }], rowCount: 1 };
        }
        if (sql.includes('FROM sigd_doc.tupa_documento_oficial_historial') && sql.includes('id_historial =')) {
          const id = params?.[1];
          return { rows: [{ id_historial: id, id_version: ID_V2026, storage_key: id?.startsWith('aaaaaaaa') ? STORAGE_KEY : 'tupa/2026/oficiales/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/TUPA_2026_OFICIAL.pdf', nombre_archivo: 'TUPA_2026_OFICIAL.pdf', sha256: 'a'.repeat(64), tamano_bytes: 100 }], rowCount: 1 };
        }
        // Query resolver identidad
        if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
          return {
            rows: [
              {
                id_persona: '22222222-2222-4222-8222-222222222222',
                activo: true,
                correo: 'admin@iestpsuiza.edu.pe',
                nombre_completo: 'Administrador Demo',
              },
            ],
            rowCount: 1,
          };
        }
        // Query para resolver versión
        if (sql.includes('FROM sigd_doc.tupa_version') && sql.includes('id_version = $1')) {
          return {
            rows: [
              {
                id_version: ID_V2026,
                codigo: 'TUPA-2026',
                denominacion: 'TUPA 2026 Oficial',
                anio: 2026,
                estado: 'VIGENTE',
                total_procedimientos: 72,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    mockS3 = {
      send: vi.fn(),
    };

    app = express();
    app.use(express.json());
    app.use('/api/v1/tramites', crearRouterTramites(mockPool as Pool, undefined, mockS3 as any));
    app.use(errorMiddleware);
  });

  function crearS3BodyStream(buffer: Buffer) {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }

  function crearS3BodyChunkStream(chunks: Buffer[]) {
    const stream = new Readable({
      read() {
        for (const chunk of chunks) {
          this.push(chunk);
        }
        this.push(null);
      },
    });
    return stream;
  }

  it('1. Rechaza con 400 si la storageKey no corresponde al patrón autorizado de la versión', async () => {
    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: 'otra_carpeta/archivo_falso.pdf',
        nombreArchivo: 'archivo_falso.pdf',
        motivoCambio: 'Intento de storageKey arbitraria',
      });

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('Validation Error');
    expect(res.body.detail).toMatch(/storageKey no autorizados/i);
    expect(mockS3.send).not.toHaveBeenCalled();
  });

  it('1b. Rechaza con 400 si la storageKey contiene secuencias prohibidas de path traversal (..)', async () => {
    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: 'tupa/2026/../../../etc/passwd',
        nombreArchivo: '../../../etc/passwd',
        motivoCambio: 'Intento de path traversal',
      });

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('Validation Error');
    expect(res.body.detail).toMatch(/secuencias prohibidas|storageKey no autorizada/i);
    expect(mockS3.send).not.toHaveBeenCalled();
  });

  it('2. Rechaza con 404 si el objeto no existe en MinIO/S3', async () => {
    const noSuchKeyErr = new Error('NoSuchKey');
    noSuchKeyErr.name = 'NoSuchKey';
    mockS3.send.mockRejectedValueOnce(noSuchKeyErr);

    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: STORAGE_KEY,
        nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
        motivoCambio: 'Carga oficial',
      });

    expect(res.status).toBe(404);
    expect(res.body.detail).toMatch(/Debe cargar el archivo previamente a la URL prefirmada/i);
  });

  it('3. Rechaza con 400 si el archivo en MinIO no tiene magic bytes %PDF-', async () => {
    const corruptBuffer = Buffer.from('ESTO_NO_ES_UN_PDF_VALIDO');
    mockS3.send.mockResolvedValueOnce({
      ContentType: 'application/pdf',
      ContentLength: corruptBuffer.length,
      Body: crearS3BodyStream(corruptBuffer),
    });

    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: STORAGE_KEY,
        nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
        motivoCambio: 'Archivo corrupto',
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/no es un documento PDF válido/i);
  });

  it('3b. Rechaza con 400 si el archivo tiene magic bytes alterados como %PDX-', async () => {
    const invalidHeaderBuffer = Buffer.from('%PDX-1.4 Documento no valido');
    mockS3.send.mockResolvedValueOnce({
      ContentType: 'application/pdf',
      ContentLength: invalidHeaderBuffer.length,
      Body: crearS3BodyStream(invalidHeaderBuffer),
    });

    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: STORAGE_KEY,
        nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
        motivoCambio: 'Archivo con firma incorrecta',
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/no es un documento PDF válido/i);
  });

  it('3c. Rechaza con 400 si el Content-Type no es estrictamente application/pdf (ej. binary/octet-stream)', async () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4 Contenido legítimo');
    mockS3.send.mockResolvedValueOnce({
      ContentType: 'binary/octet-stream',
      ContentLength: validPdfBuffer.length,
      Body: crearS3BodyStream(validPdfBuffer),
    });

    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: STORAGE_KEY,
        nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
        motivoCambio: 'MIME type no admitido',
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/requiere application\/pdf/i);
  });

  it('3d. Rechaza con 400 si Content-Length es 0', async () => {
    mockS3.send.mockResolvedValueOnce({
      ContentType: 'application/pdf',
      ContentLength: 0,
      Body: crearS3BodyStream(Buffer.alloc(0)),
    });

    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: STORAGE_KEY,
        nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
        motivoCambio: 'Archivo vacío',
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/tamaño 0 bytes|mayor a 0/i);
  });

  it('3e. Rechaza con 400 si Content-Length excede 25 MB (26214400 bytes)', async () => {
    mockS3.send.mockResolvedValueOnce({
      ContentType: 'application/pdf',
      ContentLength: 26_214_401,
      Body: crearS3BodyStream(Buffer.from('%PDF-1.4')),
    });

    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: STORAGE_KEY,
        nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
        motivoCambio: 'Archivo gigante',
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/excede el tamaño máximo permitido de 25 MB/i);
  });

  it('4. Rechaza con 400 si el cliente envía un SHA-256 manipulado que no coincide con el cálculo backend', async () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4 Contenido legítimo del TUPA 2026 con 72 procedimientos');
    mockS3.send.mockResolvedValueOnce({
      ContentType: 'application/pdf',
      ContentLength: validPdfBuffer.length,
      Body: crearS3BodyStream(validPdfBuffer),
    });

    const hashManipulado = '0000000000000000000000000000000000000000000000000000000000000000';

    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: STORAGE_KEY,
        nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
        sha256: hashManipulado,
        tamanoBytes: validPdfBuffer.length,
        motivoCambio: 'Intento con hash falsificado',
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/hash SHA-256 provisto por el cliente no coincide/i);
  });

  it('5. Rechaza con 400 si el cliente envía un tamaño manipulado que no coincide con los bytes reales', async () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4 Contenido legítimo');
    mockS3.send.mockResolvedValueOnce({
      ContentType: 'application/pdf',
      ContentLength: validPdfBuffer.length,
      Body: crearS3BodyStream(validPdfBuffer),
    });

    const realHash = crypto.createHash('sha256').update(validPdfBuffer).digest('hex');

    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: STORAGE_KEY,
        nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
        sha256: realHash,
        tamanoBytes: 9999999, // Tamaño falso
        motivoCambio: 'Intento con tamaño falso',
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/tamaño provisto por el cliente no coincide/i);
  });

  it('6. Verifica y asocia exitosamente el PDF cuando pasa todas las validaciones server-side', async () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4 Contenido legítimo del TUPA 2026');
    const realHash = crypto.createHash('sha256').update(validPdfBuffer).digest('hex');
    mockS3.send.mockResolvedValueOnce({
      ContentType: 'application/pdf',
      ContentLength: validPdfBuffer.length,
      Body: crearS3BodyStream(validPdfBuffer),
    });

    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: STORAGE_KEY,
        nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
        sha256: realHash,
        tamanoBytes: validPdfBuffer.length,
        motivoCambio: 'Carga oficial aprobada',
      });

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toMatch(/verificada y asociada exitosamente/i);
    expect(res.body.verificado.sha256).toBe(realHash);
    expect(res.body.verificado.tamanoBytes).toBe(validPdfBuffer.length);
  });

  it('7. Acepta PDF válido cuando los magic bytes están divididos en múltiples chunks (chunk 1: %P, chunk 2: DF-)', async () => {
    const chunk1 = Buffer.from('%P');
    const chunk2 = Buffer.from('DF-1.4 Contenido con chunks divididos');
    const fullBuffer = Buffer.concat([chunk1, chunk2]);
    const realHash = crypto.createHash('sha256').update(fullBuffer).digest('hex');

    mockS3.send.mockResolvedValueOnce({
      ContentType: 'application/pdf',
      ContentLength: fullBuffer.length,
      Body: crearS3BodyChunkStream([chunk1, chunk2]),
    });

    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        uploadId: UPLOAD_ID,
        storageKey: STORAGE_KEY,
        nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
        sha256: realHash,
        tamanoBytes: fullBuffer.length,
        motivoCambio: 'Stream chunking test',
      });

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toMatch(/verificada y asociada exitosamente/i);
    expect(res.body.verificado.sha256).toBe(realHash);
    expect(res.body.verificado.tamanoBytes).toBe(fullBuffer.length);
  });

  it('emite dos claves distintas aunque el nombre del PDF sea el mismo', async () => {
    const ruta = `/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial/presigned-url`;
    const body = { nombreArchivo: 'TUPA_2026_OFICIAL.pdf', tamanoBytes: 100, sha256: 'a'.repeat(64) };
    const a = await request(app).post(ruta).set('Authorization', `Bearer ${tokenAdmin}`).send(body);
    const b = await request(app).post(ruta).set('Authorization', `Bearer ${tokenAdmin}`).send(body);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.uploadId).not.toBe(b.body.uploadId);
    expect(a.body.storageKey).not.toBe(b.body.storageKey);
    expect(a.body.storageKey).toContain(`/oficiales/${a.body.uploadId}/`);
    expect(a.body.presignedUrl).toContain('if-none-match');
  });

  it('rechaza uploadId no emitido antes de consultar MinIO', async () => {
    const id = '44444444-4444-4444-8444-444444444444';
    const res = await request(app)
      .post(`/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ uploadId: id, storageKey: `tupa/2026/oficiales/${id}/TUPA_2026_OFICIAL.pdf`, nombreArchivo: 'TUPA_2026_OFICIAL.pdf' });
    expect(res.status).toBe(400);
    expect(mockS3.send).not.toHaveBeenCalled();
  });

  it('rechaza reutilizar una carga ya confirmada', async () => {
    const pdf = Buffer.from('%PDF-1.4 Prueba');
    mockS3.send.mockResolvedValueOnce({ ContentType: 'application/pdf', ContentLength: pdf.length, Body: crearS3BodyStream(pdf) });
    const ruta = `/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial`;
    const body = { uploadId: UPLOAD_ID, storageKey: STORAGE_KEY, nombreArchivo: 'TUPA_2026_OFICIAL.pdf' };
    expect((await request(app).post(ruta).set('Authorization', `Bearer ${tokenAdmin}`).send(body)).status).toBe(200);
    expect((await request(app).post(ruta).set('Authorization', `Bearer ${tokenAdmin}`).send(body)).status).toBe(400);
    expect(mockS3.send).toHaveBeenCalledTimes(1);
  });

  it('firma cada descarga histórica con la clave de su propia fila', async () => {
    const base = `/api/v1/tramites/admin/tupa/versiones/${ID_V2026}/documento-oficial/historial`;
    const a = await request(app).get(`${base}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/descargar`).set('Authorization', `Bearer ${tokenAdmin}`);
    const b = await request(app).get(`${base}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/descargar`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.downloadUrl).toContain(UPLOAD_ID);
    expect(b.body.downloadUrl).toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });
});
