import { describe, expect, it, vi, beforeEach } from 'vitest';
import { tesoreriaService } from '../../../src/services/tesoreria.service';
import { apiClient } from '../../../src/api/client';

vi.mock('../../../src/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('tesoreriaService — Cliente API de Tesorería', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtenerDashboard llama a /api/v1/tesoreria/dashboard', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { pendientes: 2, confirmadosHoy: 4, vencidos: 0 },
    });

    const res = await tesoreriaService.obtenerDashboard();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tesoreria/dashboard', { signal: undefined });
    expect(res.pendientes).toBe(2);
  });

  it('listarOrdenes construye query params correctamente', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { items: [], total: 0, page: 1, totalPages: 0 },
    });

    await tesoreriaService.listarOrdenes({ estado: 'PENDIENTE', buscar: 'EXP-14', page: 2, limit: 10 });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/tesoreria/ordenes?estado=PENDIENTE&buscar=EXP-14&page=2&limit=10',
      { signal: undefined }
    );
  });

  it('confirmarPago envía método y montos correspondientes', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { ok: true, mensaje: 'Pago confirmado', orden: { ordenPagoId: 'ord-1', estado: 'CONFIRMADO' } },
    });

    const res = await tesoreriaService.confirmarPago('ord-1', {
      metodoPago: 'EFECTIVO',
      montoRecibido: 100,
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/tesoreria/ordenes/ord-1/confirmar',
      { metodoPago: 'EFECTIVO', montoRecibido: 100 },
      { signal: undefined }
    );
    expect(res.ok).toBe(true);
  });

  it('rechazarPago envía motivo estructurado', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { ok: true, mensaje: 'Rechazado', orden: { ordenPagoId: 'ord-1', estado: 'RECHAZADO' } },
    });

    const res = await tesoreriaService.rechazarPago('ord-1', 'Error de arancel');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/tesoreria/ordenes/ord-1/rechazar',
      { motivo: 'Error de arancel' },
      { signal: undefined }
    );
    expect(res.ok).toBe(true);
  });

  it('obtenerPagoExpediente consulta /api/v1/expedientes/:id/pago', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { tieneOrden: true, pago: { ordenPagoId: 'ord-1', estado: 'PENDIENTE' } },
    });

    const res = await tesoreriaService.obtenerPagoExpediente('exp-1');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/expedientes/exp-1/pago',
      { signal: undefined }
    );
    expect(res.tieneOrden).toBe(true);
  });

  it('buscarPersonaPresencial consulta /api/v1/mesa-partes/personas/buscar', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { exito: true, datos: { idPersona: 'p-1', nombreCompleto: 'Maria' } },
    });

    const res = await tesoreriaService.buscarPersonaPresencial('DNI', '12345678');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/mesa-partes/personas/buscar?tipoDocumento=DNI&numeroDocumento=12345678',
      { signal: undefined }
    );
    expect(res.exito).toBe(true);
  });

});
