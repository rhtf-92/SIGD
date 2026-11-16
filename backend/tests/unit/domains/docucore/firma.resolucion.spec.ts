import { validarFirmaPades } from '../../../../src/domains/docucore/verificadorPades.service.js';
// Estas pruebas simulan exclusivamente el contrato de persistencia, no una firma real.
vi.mock('../../../../src/domains/docucore/verificadorPades.service.js', () => ({
  validarFirmaPades: vi.fn(async () => ({ valido: true, validacionCriptografica: true, detalles: {} })),
  obtenerPoliticaValidacionPades: vi.fn(() => ({ exigirTsa: false, exigirRevocacion: false })),
}));
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { registrarCallbackRefirma, verificarFirmaWebhook } from '../../../../src/domains/docucore/callbackRefirma.service.js';

const pdfFixture = Buffer.from('%PDF-1.7\n%Fixture de resolución directoral firmada para SIGD IESTP Suiza 2026.\n%%EOF');
const secret = 'secreto_webhook_refirma_desarrollo_2026';

describe('DocuCore — Firma Digital ReFirma & Integración de Resoluciones (Fase 9)', () => {
  const resolucionId = 'a2c988cb-f5d5-4a0d-944d-e34451ce3be1';
  const expedienteId = '9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca';
  const documentoId = '3e2922db-789b-470c-a613-6c9910203544';
  const directorUsuarioId = '00000000-0000-0000-0000-000000000020';
  const sha256Firmado = createHash('sha256').update(pdfFixture).digest('hex');

  const datosCallback = {
    documento_id: documentoId,
    sha256_firmado: sha256Firmado,
    firmante: directorUsuarioId,
    fecha_sello_tsa: '2026-10-27T17:00:00.000Z',
    s3_bucket: 'sigd-sandbox-e2e',
    s3_key: 'resoluciones/RD-2026-000009_firmada.pdf',
  };

  beforeEach(() => {
    vi.mocked(validarFirmaPades).mockResolvedValue({ valido: true, validacionCriptografica: true, integridadBytesProtegidos: true, tipoFirma: 'FIRMA_PADES_VALIDA', detalles: { tieneFirmaCms: true } });
    vi.stubEnv('S3_BUCKET', 'sigd-sandbox-e2e');
    vi.stubEnv('S3_ENDPOINT', 'http://127.0.0.1:9000');
    vi.stubEnv('REFIRMA_WEBHOOK_SECRET', secret);
    vi.stubEnv('AUTH_JWT_SECRET', 'secreto-jwt-exclusivo-unitario-al-menos-32');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(pdfFixture)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('1. Transición de Estado y Persistencia en Callback de Firma', () => {
    it('actualiza la resolución a FIRMADA, registra bitácora y evento outbox cuando el documento tiene expediente_id', async () => {
      const queriesEjecutadas: Array<{ sql: string; params?: any[] }> = [];

      const queryMock = vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        queriesEjecutadas.push({ sql, params });

        if (sql.trim().startsWith('SELECT') && sql.includes('FROM sigd_doc.documento_adjunto')) {
          return {
            rowCount: 1,
            rows: [{
              documento_adjunto_id: documentoId,
              s3_bucket: 'sigd-sandbox-e2e',
              expediente_id: expedienteId,
            }],
          };
        }

        if (sql.includes('FROM sigd_doc.firma_digital_documento')) {
          return { rowCount: 0, rows: [] };
        }

        if (sql.includes('INSERT INTO sigd_doc.firma_digital_documento')) {
          return { rowCount: 1, rows: [{ cvd: 'CVD-2026-ABCD1234EF56' }] };
        }

        if (sql.includes('UPDATE sigd_doc.resolucion')) {
          return {
            rowCount: 1,
            rows: [{
              resolucion_id: resolucionId,
              numero_resolucion: 'RD-2026-000009',
            }],
          };
        }

        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          return { rowCount: 1, rows: [] };
        }

        if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
          return { rowCount: 1, rows: [{ id_evento: randomUUID() }] };
        }

        if (sql.includes('cu.id_usuario AS usuario_id')) return { rowCount: 1, rows: [{ usuario_id: directorUsuarioId, cut: 'EXP-2026-PRUEBA', correo: null }] };
        return { rowCount: 0, rows: [] };
      });

      const client = { query: queryMock } as unknown as PoolClient;
      const cvd = await registrarCallbackRefirma(client, datosCallback);

      expect(cvd).toBe('CVD-2026-ABCD1234EF56');

      // Verificar que se actualizó sigd_doc.resolucion a FIRMADA
      const updateResolucion = queriesEjecutadas.find(q => q.sql.includes('UPDATE sigd_doc.resolucion'));
      expect(updateResolucion).toBeDefined();
      expect(updateResolucion!.params![0]).toBe(datosCallback.fecha_sello_tsa);
      expect(updateResolucion!.params![1]).toBe(directorUsuarioId);
      expect(updateResolucion!.params![2]).toBe(sha256Firmado);
      expect(updateResolucion!.params![3]).toBe(expedienteId);

      // Verificar registro en bitacora WORM
      const insertBitacora = queriesEjecutadas.find(q => q.sql.includes('INSERT INTO sigd_audit.bitacora_auditoria'));
      expect(insertBitacora).toBeDefined();
      expect(insertBitacora!.sql).toContain("'UPDATE'");
      expect(insertBitacora!.params![1]).toBe(directorUsuarioId);

      // Verificar evento Outbox
      const insertOutbox = queriesEjecutadas.find(q => q.sql.includes('INSERT INTO sigd_audit.evento_outbox'));
      expect(insertOutbox).toBeDefined();
      expect(insertOutbox!.sql).toContain("'resolucion'");
      expect(insertOutbox!.sql).toContain("'resolucion_emitida'");
      expect(insertOutbox!.params![1]).toContain(resolucionId);
      expect(JSON.parse(insertOutbox!.params![1])).toMatchObject({ usuario_id: directorUsuarioId, cut: 'EXP-2026-PRUEBA', documento_id: documentoId });
      expect(updateResolucion!.sql).toContain("d.s3_key = 'resoluciones/'");
    });

    it('es idempotente: si la firma ya fue registrada previamente con la misma evidencia, no re-inserta ni re-actualiza', async () => {
      const queriesEjecutadas: Array<{ sql: string; params?: any[] }> = [];

      const queryMock = vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        queriesEjecutadas.push({ sql, params });

        if (sql.trim().startsWith('SELECT') && sql.includes('FROM sigd_doc.documento_adjunto')) {
          return {
            rowCount: 1,
            rows: [{
              documento_adjunto_id: documentoId,
              s3_bucket: 'sigd-sandbox-e2e',
              expediente_id: expedienteId,
            }],
          };
        }

        if (sql.includes('FROM sigd_doc.firma_digital_documento')) {
          return {
            rowCount: 1,
            rows: [{ cvd: 'CVD-2026-EXISTENTE', coincide: true }],
          };
        }

        return { rowCount: 0, rows: [] };
      });

      const client = { query: queryMock } as unknown as PoolClient;
      const cvd = await registrarCallbackRefirma(client, datosCallback);

      expect(cvd).toBe('CVD-2026-EXISTENTE');
      expect(queriesEjecutadas.some(q => q.sql.includes('INSERT INTO sigd_doc.firma_digital_documento'))).toBe(false);
      expect(queriesEjecutadas.some(q => q.sql.includes('UPDATE sigd_doc.resolucion'))).toBe(false);
    });

    it('rechaza callback si el hash declarado no coincide con el archivo almacenado en S3', async () => {
      const queryMock = vi.fn().mockImplementation(async (sql: string) => {
        if (sql.trim().startsWith('SELECT') && sql.includes('FROM sigd_doc.documento_adjunto')) {
          return {
            rowCount: 1,
            rows: [{
              documento_adjunto_id: documentoId,
              s3_bucket: 'sigd-sandbox-e2e',
              expediente_id: expedienteId,
            }],
          };
        }
        return { rowCount: 0, rows: [] };
      });

      const client = { query: queryMock } as unknown as PoolClient;
      const hashErroneo = 'f'.repeat(64);

      await expect(
        registrarCallbackRefirma(client, { ...datosCallback, sha256_firmado: hashErroneo })
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('2. Endpoint HTTP /api/v1/firma/callback-refirma con HMAC', () => {
    function crearAppFixture() {
      const query = vi.fn().mockImplementation(async (sql: string) => {
        if (sql.trim().startsWith('SELECT') && sql.includes('FROM sigd_doc.documento_adjunto')) {
          return {
            rowCount: 1,
            rows: [{
              documento_adjunto_id: documentoId,
              s3_bucket: 'sigd-sandbox-e2e',
              expediente_id: expedienteId,
            }],
          };
        }
        if (sql.includes('FROM sigd_doc.firma_digital_documento')) return { rowCount: 0, rows: [] };
        if (sql.includes('INSERT INTO sigd_doc.firma_digital_documento')) {
          return { rowCount: 1, rows: [{ cvd: 'CVD-2026-HTTP-OK' }] };
        }
        if (sql.includes('UPDATE sigd_doc.resolucion')) {
          return { rowCount: 1, rows: [{ resolucion_id: resolucionId, numero_resolucion: 'RD-2026-000009' }] };
        }
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) return { rowCount: 1, rows: [] };
        if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) return { rowCount: 1, rows: [{ id_evento: randomUUID() }] };
        return { rows: [], rowCount: 0 };
      });
      const release = vi.fn();
      const pool = { query, connect: async () => ({ query, release }) } as unknown as Pool;
      return { app: construirApp(pool), query, release };
    }

    it('procesa callback exitoso con firma HMAC auténtica y confirma transacción', async () => {
      const f = crearAppFixture();
      const rawBody = JSON.stringify(datosCallback);
      const hmac = createHmac('sha256', secret).update(rawBody).digest('hex');

      const res = await request(f.app)
        .post('/api/v1/firma/callback-refirma')
        .set('Content-Type', 'application/json')
        .set('x-refirma-signature', hmac)
        .set('x-refirma-timestamp', new Date().toISOString())
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        estado: 'FIRMADO_DIGITALMENTE',
        cvd: 'CVD-2026-HTTP-OK',
      });
      expect(f.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rechaza callback si el header HMAC es inválido', async () => {
      const f = crearAppFixture();
      const rawBody = JSON.stringify(datosCallback);

      const res = await request(f.app)
        .post('/api/v1/firma/callback-refirma')
        .set('Content-Type', 'application/json')
        .set('x-refirma-signature', '0'.repeat(64))
        .send(rawBody);

      expect(res.status).toBe(403);
      expect(f.query).not.toHaveBeenCalledWith('BEGIN');
    });

    it('rechaza callback HTTP 403 con fallo seguro (fail-closed) si REFIRMA_WEBHOOK_SECRET no está configurado', async () => {
      vi.stubEnv('REFIRMA_WEBHOOK_SECRET', '');
      const f = crearAppFixture();
      const rawBody = JSON.stringify(datosCallback);
      const hmac = createHmac('sha256', secret).update(rawBody).digest('hex');

      const res = await request(f.app)
        .post('/api/v1/firma/callback-refirma')
        .set('Content-Type', 'application/json')
        .set('x-refirma-signature', hmac)
        .set('x-refirma-timestamp', new Date().toISOString())
        .send(rawBody);

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('falta REFIRMA_WEBHOOK_SECRET');
      expect(f.query).not.toHaveBeenCalledWith('BEGIN');
    });

    it('rechaza callback con ValidationError (400) si la marca de tiempo fecha_sello_tsa es futura', async () => {
      const f = crearAppFixture();
      const fechaFutura = new Date(Date.now() + 86400000).toISOString();
      const payloadFuturo = { ...datosCallback, fecha_sello_tsa: fechaFutura };
      const rawBody = JSON.stringify(payloadFuturo);
      const hmac = createHmac('sha256', secret).update(rawBody).digest('hex');

      const res = await request(f.app)
        .post('/api/v1/firma/callback-refirma')
        .set('Content-Type', 'application/json')
        .set('x-refirma-signature', hmac)
        .set('x-refirma-timestamp', new Date().toISOString())
        .send(rawBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rechaza callback HTTP 403 si el secreto de webhook es inseguro (menor a 16 caracteres)', async () => {
      vi.stubEnv('REFIRMA_WEBHOOK_SECRET', 'corto123');
      const f = crearAppFixture();
      const rawBody = JSON.stringify(datosCallback);
      const hmac = createHmac('sha256', 'corto123').update(rawBody).digest('hex');

      const res = await request(f.app)
        .post('/api/v1/firma/callback-refirma')
        .set('Content-Type', 'application/json')
        .set('x-refirma-signature', hmac)
        .set('x-refirma-timestamp', new Date().toISOString())
        .send(rawBody);

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('mínimo 16 caracteres');
    });

    it('protección anti-repetición: rechaza callback con x-refirma-timestamp expirado (> 300 segundos)', async () => {
      const f = crearAppFixture();
      const rawBody = JSON.stringify(datosCallback);
      const hmac = createHmac('sha256', secret).update(rawBody).digest('hex');
      const timestampExpirado = new Date(Date.now() - 400_000).toISOString();

      const res = await request(f.app)
        .post('/api/v1/firma/callback-refirma')
        .set('Content-Type', 'application/json')
        .set('x-refirma-signature', hmac)
        .set('x-refirma-timestamp', new Date().toISOString())
        .set('x-refirma-timestamp', timestampExpirado)
        .send(rawBody);

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('300 segundos');
    });

    it('protección anti-repetición: acepta callback con x-refirma-timestamp vigente (dentro de 300 segundos)', async () => {
      const f = crearAppFixture();
      const rawBody = JSON.stringify(datosCallback);
      const hmac = createHmac('sha256', secret).update(rawBody).digest('hex');
      const timestampVigente = new Date().toISOString();

      const res = await request(f.app)
        .post('/api/v1/firma/callback-refirma')
        .set('Content-Type', 'application/json')
        .set('x-refirma-signature', hmac)
        .set('x-refirma-timestamp', new Date().toISOString())
        .set('x-refirma-timestamp', timestampVigente)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.cvd).toBe('CVD-2026-HTTP-OK');
    });

    it('rechaza callback si REFIRMA_EXIGIR_PADES es true y el PDF almacenado posee solo sello visual sin contenedor CMS', async () => {
      vi.mocked(validarFirmaPades).mockResolvedValue({ valido: false, validacionCriptografica: false, integridadBytesProtegidos: false, tipoFirma: 'SIN_FIRMA', detalles: { tieneFirmaCms: false, motivoRechazo: 'PDF sin firma PAdES' } });
      const f = crearAppFixture();
      const rawBody = JSON.stringify(datosCallback);
      const hmac = createHmac('sha256', secret).update(rawBody).digest('hex');

      const res = await request(f.app)
        .post('/api/v1/firma/callback-refirma')
        .set('Content-Type', 'application/json')
        .set('x-refirma-signature', hmac)
        .set('x-refirma-timestamp', new Date().toISOString())
        .send(rawBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.invalid_params[0].name).toBe('firmaPades');
      expect(res.body.invalid_params[0].reason).toContain('PAdES');
    });
  });
});
