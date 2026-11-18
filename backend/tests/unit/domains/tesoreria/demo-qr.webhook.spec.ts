import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { TesoreriaService } from '../../../../src/domains/tesoreria/tesoreria.service.js';
import { TesoreriaRepository } from '../../../../src/domains/tesoreria/tesoreria.repository.js';
import { DemoQrProvider } from '../../../../src/domains/tesoreria/providers/demo-qr.provider.js';
import { UnauthorizedError } from '../../../../src/shared/domain/errors/index.js';

vi.mock('../../../../src/audit/bitacora-auditoria.repository.js', () => ({ registrarMutacion: vi.fn() }));
vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({ insertarEvento: vi.fn() }));

describe('DEMO_QR webhook usa el cierre transaccional de Tesorería', () => {
  const secret = 'demo-only-test-secret-with-at-least-32-characters';
  let client: PoolClient;
  let repository: TesoreriaRepository;
  let service: TesoreriaService;
  const pending = {
    orden_pago_id: 'order-1', expediente_id: 'exp-1', codigo_pago: 'PAG-2026-000099',
    estado: 'PENDIENTE', monto: '100.00', payment_provider: 'DEMO_QR',
    provider_payment_id: 'demo-payment-1', provider_expires_at: new Date(Date.now() + 60_000),
    codigo_recibo: null,
  };
  const payload = (changes: Record<string, unknown> = {}) => JSON.stringify({
    event_id: crypto.randomUUID(), event: 'payment.completed', payment_id: 'demo-payment-1',
    reference: 'PAG-2026-000099', amount: 100, currency: 'PEN', status: 'completed',
    paid_at: new Date().toISOString(), timestamp: new Date().toISOString(), ...changes,
  });
  const signature = (raw: string) => crypto.createHmac('sha256', secret).update(raw).digest('hex');

  beforeEach(() => {
    vi.stubEnv('DEMO_QR_ENABLED', 'true');
    vi.stubEnv('DEMO_QR_SECRET', secret);
    vi.stubEnv('DEMO_QR_PUBLIC_URL', 'https://demo.example.test');
    client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }), release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    repository = new TesoreriaRepository();
    service = new TesoreriaService(pool, repository, undefined, new DemoQrProvider());
    vi.spyOn(repository, 'obtenerOrdenPorProviderPaymentIdConLock').mockResolvedValue(pending as never);
    vi.spyOn(repository, 'obtenerSiguienteCodigoRecibo').mockResolvedValue('REC-2026-000099');
    vi.spyOn(repository, 'actualizarOrdenAConfirmada').mockResolvedValue();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('rechaza firma inválida sin consultar la orden', async () => {
    await expect(service.procesarWebhookDemo(payload(), 'bad')).rejects.toThrow(UnauthorizedError);
    expect(repository.obtenerOrdenPorProviderPaymentIdConLock).not.toHaveBeenCalled();
  });

  it('confirma una vez, emite REC y desbloquea expediente con FOR UPDATE', async () => {
    const raw = payload();
    const result = await service.procesarWebhookDemo(raw, signature(raw));
    expect(result).toMatchObject({ status: 'processed', codigoRecibo: 'REC-2026-000099' });
    expect(repository.obtenerOrdenPorProviderPaymentIdConLock).toHaveBeenCalledWith(client, 'demo-payment-1');
    expect(repository.actualizarOrdenAConfirmada).toHaveBeenCalledWith(client, expect.objectContaining({
      metodoPago: 'QR_AUTOMATICO_SANDBOX', confirmedSource: 'WEBHOOK', providerPaymentId: 'demo-payment-1',
    }));
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SET estado = 'REGISTRADO'"), ['exp-1']);
  });

  it('replay confirmado devuelve el mismo REC sin generar otro', async () => {
    vi.mocked(repository.obtenerOrdenPorProviderPaymentIdConLock).mockResolvedValue({
      ...pending, estado: 'CONFIRMADO', codigo_recibo: 'REC-2026-000099',
    } as never);
    const raw = payload();
    expect(await service.procesarWebhookDemo(raw, signature(raw))).toMatchObject({
      status: 'already_confirmed', codigoRecibo: 'REC-2026-000099',
    });
    expect(repository.obtenerSiguienteCodigoRecibo).not.toHaveBeenCalled();
    expect(repository.actualizarOrdenAConfirmada).not.toHaveBeenCalled();
  });

  it.each([
    [{ amount: 1 }, 'amount'],
    [{ currency: 'USD' }, 'currency'],
    [{ reference: 'PAG-OTRA' }, 'reference'],
    [{ payment_id: 'unknown' }, 'payment_id'],
  ])('rechaza %s sin confirmar la orden (%s)', async (change, _label) => {
    const raw = payload(change);
    const result = await service.procesarWebhookDemo(raw, signature(raw));
    expect(result.status).toBe('rejected');
    expect(repository.actualizarOrdenAConfirmada).not.toHaveBeenCalled();
  });

  it('rechaza QR expirado', async () => {
    vi.mocked(repository.obtenerOrdenPorProviderPaymentIdConLock).mockResolvedValue({
      ...pending, provider_expires_at: new Date(0),
    } as never);
    const raw = payload();
    expect((await service.procesarWebhookDemo(raw, signature(raw))).status).toBe('rejected');
  });
});
