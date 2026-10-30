import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { TesoreriaService } from '../../../../src/domains/tesoreria/tesoreria.service.js';
import { TesoreriaRepository } from '../../../../src/domains/tesoreria/tesoreria.repository.js';
import { TaypiProvider } from '../../../../src/domains/tesoreria/providers/taypi.provider.js';
import { ForbiddenError, UnauthorizedError } from '../../../../src/shared/domain/errors/index.js';
import { registrarMutacion } from '../../../../src/audit/bitacora-auditoria.repository.js';
import { insertarEvento } from '../../../../src/audit/evento-outbox.repository.js';

vi.mock('../../../../src/audit/bitacora-auditoria.repository.js', () => ({
  registrarMutacion: vi.fn().mockResolvedValue('audit-uuid-1'),
}));

vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({
  insertarEvento: vi.fn().mockResolvedValue('outbox-uuid-1'),
}));

describe('SIGD 2026 — Webhook TAYPI Sandbox & Desbloqueo FSM', () => {
  const secretKey = 'taypi_sk_test_secret_for_tests';
  const webhookSecret = 'taypi_whsec_test_for_tests';
  const mockOrdenPagoId = 'ord-0000-0000-0000-000000000001';
  const mockExpedienteId = 'exp-0000-0000-0000-000000000001';

  let mockPool: Pool;
  let mockClient: PoolClient;
  let repository: TesoreriaRepository;
  let provider: TaypiProvider;
  let service: TesoreriaService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    } as unknown as PoolClient;

    mockPool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    repository = new TesoreriaRepository();
    provider = new TaypiProvider({
      secretKey,
      publicKey: 'taypi_pk_test_for_tests',
      webhookSecret,
      baseUrl: 'https://sandbox.taypi.pe',
      isSandbox: true,
      webhookEnabled: true,
    });
    service = new TesoreriaService(mockPool, repository, provider);
  });

  function generarFirma(payload: string): string {
    return crypto.createHmac('sha256', webhookSecret).update(Buffer.from(payload, 'utf-8')).digest('hex');
  }

  const mockFilaOrdenPendiente = {
    orden_pago_id: mockOrdenPagoId,
    codigo_pago: 'PAG-2026-000001',
    expediente_id: mockExpedienteId,
    registro_version_id: null,
    solicitante_id: 'sol-1',
    concepto: 'Certificado de Inglés',
    codigo_tupa: 'p1-fila-06',
    monto: '100.00',
    moneda: 'PEN',
    estado: 'PENDIENTE' as const,
    metodo_pago: null,
    referencia_operacion: null,
    monto_recibido: null,
    vuelto: null,
    codigo_recibo: null,
    fecha_creacion: new Date(),
    fecha_vencimiento: new Date(Date.now() + 24 * 3600 * 1000),
    fecha_pago: null,
    tesorero_id: null,
    motivo_rechazo: null,
    observacion: null,
    payment_provider: 'TAYPI' as const,
    provider_payment_id: 'taypi_pay_123',
    created_at: new Date(),
    updated_at: new Date(),
  };

  it('ciudadano sin persona asociada no puede iniciar pago sobre una orden ajena', async () => {
    vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValueOnce({ ...mockFilaOrdenPendiente });
    await expect(service.crearPagoAutomaticoTaypi(
      mockOrdenPagoId, 'usuario-sin-persona', ['CIUDADANO'], undefined,
    )).rejects.toThrow(ForbiddenError);
  });

  it('1. Webhook con firma HMAC inválida lanza UnauthorizedError (401)', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.completed',
      payment_id: 'taypi_pay_123',
      amount: 100.0,
      currency: 'PEN',
      status: 'completed',
      reference: 'PAG-2026-000001',
    });

    await expect(
      service.procesarWebhookTaypi(rawPayload, 'firma_invalida_o_falsa'),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      service.procesarWebhookTaypi(rawPayload, undefined),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('2. Evento payment.completed válido confirma la orden, genera REC y desbloquea expediente', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.completed',
      payment_id: 'taypi_pay_123',
      amount: 100.0,
      currency: 'PEN',
      status: 'completed',
      reference: 'PAG-2026-000001',
      paid_at: new Date().toISOString(),
    });
    const firma = generarFirma(rawPayload);

    vi.spyOn(repository, 'obtenerOrdenPorProviderPaymentIdConLock').mockResolvedValueOnce({
      ...mockFilaOrdenPendiente,
    });
    vi.spyOn(repository, 'obtenerSiguienteCodigoRecibo').mockResolvedValueOnce('REC-2026-000001');
    const updateSpy = vi.spyOn(repository, 'actualizarOrdenAConfirmada').mockResolvedValueOnce();

    const resultado = await service.procesarWebhookTaypi(rawPayload, firma);

    expect(resultado.received).toBe(true);
    expect(resultado.status).toBe('processed');
    expect(resultado.codigoPago).toBe('PAG-2026-000001');
    expect(resultado.codigoRecibo).toBe('REC-2026-000001');

    // Verifica actualización atómica en base de datos
    expect(updateSpy).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        ordenPagoId: mockOrdenPagoId,
        metodoPago: 'QR_AUTOMATICO_SANDBOX',
        confirmedSource: 'WEBHOOK',
        codigoRecibo: 'REC-2026-000001',
        providerPaymentId: 'taypi_pay_123',
      }),
    );

    // Verifica desbloqueo del expediente en FSM (pasa de PENDIENTE_PAGO a REGISTRADO)
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE sigd_tra.expediente"),
      [mockExpedienteId],
    );

    // Verifica auditoría e inserción outbox
    expect(registrarMutacion).toHaveBeenCalledTimes(1);
    expect(insertarEvento).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        tipo_evento: 'PAGO_CONFIRMADO',
        payload: expect.objectContaining({
          metodoPago: 'QR_AUTOMATICO_SANDBOX',
          confirmedSource: 'WEBHOOK',
        }),
      }),
    );
  });

  it('3. Webhook con monto discrepante es rechazado y no altera la orden a CONFIRMADO', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.completed',
      payment_id: 'taypi_pay_123',
      amount: 50.0, // Orden requiere 100.00
      currency: 'PEN',
      status: 'completed',
      reference: 'PAG-2026-000001',
    });
    const firma = generarFirma(rawPayload);

    vi.spyOn(repository, 'obtenerOrdenPorProviderPaymentIdConLock').mockResolvedValueOnce({
      ...mockFilaOrdenPendiente,
    });
    const updateSpy = vi.spyOn(repository, 'actualizarOrdenAConfirmada');

    const resultado = await service.procesarWebhookTaypi(rawPayload, firma);

    expect(resultado.received).toBe(true);
    expect(resultado.status).toBe('rejected');
    expect(resultado.motivo).toMatch(/DISCREPANCIA_MONTO/);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('4. Webhook con moneda no soportada (USD != PEN) es rechazado', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.completed',
      payment_id: 'taypi_pay_123',
      amount: 100.0,
      currency: 'USD',
      status: 'completed',
      reference: 'PAG-2026-000001',
    });
    const firma = generarFirma(rawPayload);

    const resultado = await service.procesarWebhookTaypi(rawPayload, firma);
    expect(resultado.received).toBe(true);
    expect(resultado.status).toBe('rejected');
    expect(resultado.motivo).toMatch(/Moneda inválida/);
  });

  it('rechaza webhook sin moneda en lugar de asumir PEN', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.completed', payment_id: 'taypi_pay_123', amount: 100,
      status: 'completed', reference: 'PAG-2026-000001',
    });
    const confirmar = vi.spyOn(repository, 'actualizarOrdenAConfirmada');
    const resultado = await service.procesarWebhookTaypi(rawPayload, generarFirma(rawPayload));
    expect(resultado.status).toBe('rejected');
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('5. Webhook con payment_id y reference desconocidos es rechazado', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.completed',
      payment_id: 'pay_desconocido_999',
      amount: 100.0,
      currency: 'PEN',
      status: 'completed',
      reference: 'PAG-2026-999999',
    });
    const firma = generarFirma(rawPayload);

    vi.spyOn(repository, 'obtenerOrdenPorProviderPaymentIdConLock').mockResolvedValueOnce(null);
    vi.spyOn(repository, 'obtenerOrdenPorCodigoPago').mockResolvedValueOnce(null);

    const resultado = await service.procesarWebhookTaypi(rawPayload, firma);
    expect(resultado.received).toBe(true);
    expect(resultado.status).toBe('rejected');
    expect(resultado.motivo).toMatch(/No se encontró orden de pago/);
  });

  it('rechaza payment_id desconocido aunque reference coincida con una orden', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.completed', payment_id: 'otro_pago', amount: 100,
      currency: 'PEN', status: 'completed', reference: 'PAG-2026-000001',
    });
    vi.spyOn(repository, 'obtenerOrdenPorProviderPaymentIdConLock').mockResolvedValueOnce(null);
    const porReferencia = vi.spyOn(repository, 'obtenerOrdenPorCodigoPago');
    const confirmar = vi.spyOn(repository, 'actualizarOrdenAConfirmada');

    const resultado = await service.procesarWebhookTaypi(rawPayload, generarFirma(rawPayload));

    expect(resultado.status).toBe('rejected');
    expect(porReferencia).not.toHaveBeenCalled();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('rechaza reference distinta aunque payment_id corresponda a una orden', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.completed', payment_id: 'taypi_pay_123', amount: 100,
      currency: 'PEN', status: 'completed', reference: 'PAG-2026-OTRA',
    });
    vi.spyOn(repository, 'obtenerOrdenPorProviderPaymentIdConLock').mockResolvedValueOnce({ ...mockFilaOrdenPendiente });
    const confirmar = vi.spyOn(repository, 'actualizarOrdenAConfirmada');

    const resultado = await service.procesarWebhookTaypi(rawPayload, generarFirma(rawPayload));

    expect(resultado.status).toBe('rejected');
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('6. Webhook duplicado / reintentado es procesado de forma idempotente sin duplicar efectos', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.completed',
      payment_id: 'taypi_pay_123',
      amount: 100.0,
      currency: 'PEN',
      status: 'completed',
      reference: 'PAG-2026-000001',
    });
    const firma = generarFirma(rawPayload);

    // Simular que la orden ya fue previamente confirmada
    vi.spyOn(repository, 'obtenerOrdenPorProviderPaymentIdConLock').mockResolvedValueOnce({
      ...mockFilaOrdenPendiente,
      estado: 'CONFIRMADO',
      codigo_recibo: 'REC-2026-000001',
    });

    const updateSpy = vi.spyOn(repository, 'actualizarOrdenAConfirmada');

    const resultado = await service.procesarWebhookTaypi(rawPayload, firma);

    expect(resultado.received).toBe(true);
    expect(resultado.status).toBe('already_confirmed');
    expect(resultado.codigoRecibo).toBe('REC-2026-000001');

    // No debe actualizar nuevamente ni volver a emitir recibos
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertarEvento).not.toHaveBeenCalled();
  });

  it('7. Concurrencia: si dos llamadas webhook coinciden, el lock pesimista garantiza confirmación única', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.completed',
      payment_id: 'taypi_pay_123',
      amount: 100.0,
      currency: 'PEN',
      status: 'completed',
      reference: 'PAG-2026-000001',
    });
    const firma = generarFirma(rawPayload);

    let estado = 'PENDIENTE';
    vi.spyOn(repository, 'obtenerOrdenPorProviderPaymentIdConLock').mockImplementation(async () => {
      const fila = {
        ...mockFilaOrdenPendiente,
        estado: estado as any,
        codigo_recibo: estado === 'CONFIRMADO' ? 'REC-2026-000001' : null,
      };
      if (estado === 'PENDIENTE') {
        estado = 'CONFIRMADO';
      }
      return fila;
    });

    vi.spyOn(repository, 'obtenerSiguienteCodigoRecibo').mockResolvedValue('REC-2026-000001');
    vi.spyOn(repository, 'actualizarOrdenAConfirmada').mockResolvedValue();

    const [res1, res2] = await Promise.all([
      service.procesarWebhookTaypi(rawPayload, firma),
      service.procesarWebhookTaypi(rawPayload, firma),
    ]);

    const exitosos = [res1, res2].filter((r) => r.status === 'processed');
    const idempotentes = [res1, res2].filter((r) => r.status === 'already_confirmed');

    expect(exitosos).toHaveLength(1);
    expect(idempotentes).toHaveLength(1);
  });
});
