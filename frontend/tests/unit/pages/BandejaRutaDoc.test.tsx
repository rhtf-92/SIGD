import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../../../src/api/client';
import BandejaExpedientesPage from '../../../src/pages/expedientes/BandejaExpedientesPage';
import { ApiHttpError } from '../../../src/types/api';

vi.mock('../../../src/api/client', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('../../../src/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ usuario: { id: 'usuario-prueba' } }),
}));
const expediente = {
  idExpediente: '983b861b-e339-4723-aecd-9e1a82b2dd1e', cut: 'EXP-2026-000002',
  asunto: 'Solicitud real', estadoActual: 'RECEPCIONADO',
  fechaRadicacion: '2026-10-09T13:00:00Z', areaActualId: null,
};
const pagina = { elementos: [expediente], contadores: {
  PENDIENTES: 21, EN_TRAMITE: 0, DERIVADOS: 0, POR_FIRMAR: 0, ATENDIDOS: 0, ARCHIVADOS: 0,
}, tieneMas: false, siguienteCursor: null };
function renderBandeja() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<MemoryRouter><QueryClientProvider client={client}><BandejaExpedientesPage /></QueryClientProvider></MemoryRouter>);
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: pagina } as never); });
describe('Bandeja conectada al contrato RutaDoc', () => {
  it('envía la pestaña obligatoria y lee elementos y contadores del envelope', async () => {
    renderBandeja(); await screen.findByText(expediente.cut);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/expedientes', expect.objectContaining({
      params: expect.objectContaining({ pestana: 'PENDIENTES', limite: 20 }),
    }));
    expect(screen.getByRole('tab', { name: 'Pendientes 21' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Ver expediente' })).toHaveAttribute('href', '/expedientes/' + expediente.idExpediente);
  });
  it('envía búsqueda y fechas al servidor, sin filtrar solo la página local', async () => {
    renderBandeja(); await screen.findByText(expediente.cut);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: expediente.cut } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.change(screen.getByLabelText('Fecha desde'), { target: { value: '2026-10-09' } });
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/v1/expedientes', expect.objectContaining({
      params: expect.objectContaining({ terminoBusqueda: expediente.cut, fechaDesde: '2026-10-09' }),
    })));
  });
  it('usa el cursor real y lo reinicia al cambiar de pestaña', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...pagina, tieneMas: true, siguienteCursor: 'cursor-real' } } as never);
    renderBandeja(); await screen.findByText(expediente.cut);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/v1/expedientes', expect.objectContaining({
      params: expect.objectContaining({ cursor: 'cursor-real' }),
    })));
    fireEvent.click(await screen.findByRole('tab', { name: 'En trámite 0' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/v1/expedientes', expect.objectContaining({
      params: expect.objectContaining({ pestana: 'EN_TRAMITE', cursor: undefined }),
    })));
    expect(screen.getByText('Página 1')).toBeInTheDocument();
  });
  it('muestra el error HTTP y su referencia, sin presentarlo como una bandeja vacía', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new ApiHttpError({ status: 400, detail: 'Falta pestana',
      title: 'Validation Error', correlationId: 'referencia-prueba', code: 'VALIDATION_ERROR',
      type: 'validation', category: 'Validation', instance: '/expedientes', retryable: false }));
    renderBandeja(); const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Falta pestana'); expect(alert).toHaveTextContent('HTTP 400');
    expect(alert).toHaveTextContent('referencia-prueba'); expect(screen.queryByText(/No hay expedientes/)).not.toBeInTheDocument();
  });
  it('rechaza una respuesta con el contrato antiguo de array', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [expediente] } as never);
    renderBandeja(); expect(await screen.findByRole('alert')).toHaveTextContent('no cumple el contrato RutaDoc');
  });
});
