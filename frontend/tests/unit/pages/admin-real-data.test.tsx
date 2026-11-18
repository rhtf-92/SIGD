import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '@/api/client';
import AuditoriaPage from '@/pages/administracion/AuditoriaPage';
import CalendarioLaboralPage from '@/pages/administracion/CalendarioLaboralPage';

afterEach(() => vi.restoreAllMocks());

describe('administración sin datos de demostración', () => {
  it('muestra solo eventos reales recibidos de la bitácora API', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { registros: [{
      id_auditoria: 'bfbd2eea-bcd0-4a6d-b0d5-548b765f78c8',
      correlation_id: null, usuario_id: null, ip_origen: '127.0.0.1',
      esquema: 'sigd_tra', tabla: 'expediente', operacion: 'INSERT', fecha_hora: '2026-10-24T13:00:00Z',
    }] } } as never);
    render(<MemoryRouter><AuditoriaPage /></MemoryRouter>);
    expect(await screen.findByText('sigd_tra.expediente')).toBeInTheDocument();
    expect(screen.getByText('INSERT')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/v1/admin/auditoria/bitacora', expect.objectContaining({ params: { limite: 100, offset: 0 } }));
    expect(screen.queryByText('AUD-000145')).not.toBeInTheDocument();
  });

  it('muestra el fallo de API sin sustituir el calendario por feriados locales', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Servidor no disponible'));
    render(<MemoryRouter><CalendarioLaboralPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Servidor no disponible');
    expect(screen.queryByText('Año Nuevo')).not.toBeInTheDocument();
  });
});
