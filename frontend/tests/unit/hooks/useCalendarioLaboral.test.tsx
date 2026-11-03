import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../src/api/client';
import { useCalendarioLaboral } from '../../../src/hooks/useCalendarioLaboral';

vi.mock('@/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() } }));

describe('useCalendarioLaboral', () => {
  it('recarga jornada persistida y guarda los días/hours en API', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => String(url).includes('/configuracion')
      ? { data: { jornada: { hora_inicio: '09:00', hora_fin: '17:00', hora_corte: '16:30', zona_horaria: 'America/Lima', dias_laborales: [1, 2, 4, 5] } } } as never
      : { data: { calendario: [] } } as never);
    vi.mocked(apiClient.put).mockResolvedValue({ data: { guardado: true } } as never);
    const { result } = renderHook(() => useCalendarioLaboral());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.horaInicio).toBe('09:00');
    expect(result.current.dias.map(({ activo }) => activo)).toEqual([true, true, false, true, true, false, false]);
    await act(async () => { await result.current.guardarConfiguracion(); });
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/admin/calendario-laboral/configuracion', {
      horaInicio: '09:00', horaFin: '17:00', horaCorte: '16:30', zonaHoraria: 'America/Lima', diasLaborales: [1, 2, 4, 5],
    });
  });
});
