import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MisExpedientesPage from '../../../src/pages/tramite/MisExpedientesPage';
import { apiClient } from '../../../src/api/client';
import { useAuthStore } from '../../../src/stores/authStore';

vi.mock('../../../src/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('MisExpedientesPage — Portal Ciudadano', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: 'jwt-ciudadano',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-1',
        nombreCompleto: 'Carlos Ruiz',
        correo: 'carlos.ruiz@test.com',
        rol: 'CIUDADANO',
      },
    });
  });

  it('renderiza la lista de expedientes del ciudadano con sus datos y badges', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [
        {
          expedienteId: 'exp-1',
          cut: 'EXP-2026-000042',
          codigoExpediente: 'EXP-2026-000042',
          numero: 'EXP-2026-000042',
          asunto: 'Solicitud de Constancia de Egresado',
          tipoDocumento: 'SOLICITUD',
          tipoTramite: 'Constancia de Estudios',
          estado: 'EN_TRAMITE',
          fechaRadicacion: '2026-10-24T10:30:00Z',
          canalIngreso: 'MESA_VIRTUAL',
          totalFolios: 4,
        },
      ],
    });

    render(
      <MemoryRouter>
        <MisExpedientesPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Cargando tus expedientes...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('EXP-2026-000042')).toBeInTheDocument();
    });

    expect(screen.getByText('Solicitud de Constancia de Egresado')).toBeInTheDocument();
    expect(screen.getByText('Constancia de Estudios')).toBeInTheDocument();
    expect(screen.getByText('EN_TRAMITE')).toBeInTheDocument();
    expect(screen.getByText('MESA_VIRTUAL')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Seguimiento →')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ Nuevo Trámite' })).toHaveAttribute('href', '/tramite');
  });

  it('muestra estado vacío amigable cuando el ciudadano no registra expedientes', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [],
    });

    render(
      <MemoryRouter>
        <MisExpedientesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aún no tienes expedientes radicados')).toBeInTheDocument();
    });

    expect(screen.getByText('Presentar Primer Trámite')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Presentar Primer Trámite' })).toHaveAttribute('href', '/tramite');
  });

  it('muestra mensaje de error y botón de reintento si la API falla', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Fallo de conexión con TramiCore'));

    render(
      <MemoryRouter>
        <MisExpedientesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No se pudieron cargar los expedientes')).toBeInTheDocument();
    });

    expect(screen.getByText('Fallo de conexión con TramiCore')).toBeInTheDocument();
    expect(screen.getByText('Reintentar')).toBeInTheDocument();
  });
});
