import express from 'express';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearRouterStorage } from '../../../../src/core/storage/storage.router.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { RadicacionVirtualService } from '../../../../src/domains/tramicore/radicacionVirtual.service.js';
import { exigirSinPagoDemoPendiente, omitirPagoDemo } from '../../../../src/domains/tramicore/demoPago.js';

const USER = '11111111-1111-4111-8111-111111111111';
const KEY = 'expedientes/2026/22222222-2222-4222-8222-222222222222.pdf';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Radicación autenticada: aislamiento documental y excepción económica', () => {
  it.each(['sigd_prueba', 'otra_base'])('no omite pagos en %s aunque la bandera esté activa', async db => {
    vi.stubEnv('SIGD_DEMO_OMITIR_PAGO', 'true'); vi.stubEnv('NODE_ENV', 'test');
    const query = vi.fn().mockResolvedValue({ rows: [{ db }] });
    expect(await omitirPagoDemo({ query } as unknown as Pool)).toBe(false);
    expect(query).toHaveBeenCalledWith('SELECT current_database() AS db');
  });
  it('la omisión queda desactivada en producción sin consultar otra base', async () => {
    vi.stubEnv('SIGD_DEMO_OMITIR_PAGO', 'true'); vi.stubEnv('NODE_ENV', 'production');
    const query = vi.fn(); expect(await omitirPagoDemo({ query } as unknown as Pool)).toBe(false); expect(query).not.toHaveBeenCalled();
  });
  it('el bloqueo persistente consulta también la auditoría autenticada aunque se desactive la bandera', async () => {
    vi.stubEnv('SIGD_DEMO_OMITIR_PAGO', 'false');
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ db: 'sigd_jacobo_demo' }] })
      .mockResolvedValueOnce({ rows: [{ tabla: null }] })
      .mockResolvedValueOnce({ rows: [{ pendiente: 1 }] });
    await expect(exigirSinPagoDemoPendiente({ query } as unknown as Pool, USER)).rejects.toMatchObject({ status: 422, code: 'DEMO_PAYMENT_PENDING' });
    expect(query.mock.calls[2][0]).toContain("tabla='radicacion_virtual'");
    expect(query.mock.calls[2][0]).toContain('UNION ALL');
  });
  it('rechaza un objeto no emitido a la cuenta antes de leer MinIO', async () => {
    vi.stubEnv('S3_ENDPOINT', 'http://minio-unitario.invalid:9000'); vi.stubEnv('S3_BUCKET', 'bucket-unitario');
    const query = vi.fn().mockResolvedValue({ rows: [] }); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const service = new RadicacionVirtualService({} as Pool);
    const verify = service as unknown as { verificarArchivo(doc: unknown, titular: { cliente: PoolClient; usuario: string }): Promise<unknown> };
    await expect(verify.verificarArchivo({ storagePath: KEY, nombreArchivo: 'solicitud.pdf', hashSha256: 'a'.repeat(64), tamanoBytes: 100 },
      { cliente: { query } as unknown as PoolClient, usuario: USER })).rejects.toMatchObject({ status: 403 });
    expect(query.mock.calls[0][1]).toEqual([USER, KEY, 'a'.repeat(64), '100', 'solicitud.pdf']); expect(fetch).not.toHaveBeenCalled();
  });
  it('registra la emisión de la carga a nombre del titular autenticado, sin crear un adjunto prematuro', async () => {
    vi.stubEnv('AUTH_JWT_SECRET', 'secreto-solo-unitario-no-utilizado-en-servidores');
    vi.stubEnv('S3_ENDPOINT', 'http://minio-unitario.invalid:9000'); vi.stubEnv('S3_BUCKET', 'bucket-unitario');
    vi.stubEnv('S3_ACCESS_KEY', 'unitario'); vi.stubEnv('S3_SECRET_KEY', 'unitario');
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes('FROM sigd_auth.cuenta_usuario')
      ? [{ id_usuario: USER, id_persona: USER }] : [{ id_auditoria: USER }] }));
    const app = express(); app.use(express.json()); app.use('/api/v1', crearRouterStorage({ query } as unknown as Pool));
    const response = await request(app).post('/api/v1/storage/presigned-url').set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: USER }))
      .send({ nombreArchivo: 'solicitud.pdf', tamanoBytes: 100, mimeType: 'application/pdf', checksumSha256: 'a'.repeat(64), categoria: 'EXPEDIENTE_INGRESO' });
    expect(response.status).toBe(200);
    const writes = query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO'));
    expect(writes).toHaveLength(1); expect(writes[0][0]).toContain('sigd_audit.bitacora_auditoria');
  });
});
