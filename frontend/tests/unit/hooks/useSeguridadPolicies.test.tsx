import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { apiClient } from '../../../src/api/client';
import { useSeguridadPolicies } from '../../../src/hooks/useSeguridadPolicies';
import { vi } from 'vitest';

vi.mock('@/api/client', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSeguridadPolicies', () => {
  it('no presenta cuentas ni intentos inventados como actividad real', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => String(url).includes('politicas')
      ? { data: { politicas: { max_intentos_fallidos: 5, minutos_bloqueo: 30, minutos_sesion: 30 } } } as never
      : { data: { cuentas: [], intentos: [] } } as never);
    const { result } = renderHook(() => useSeguridadPolicies(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cuentasBloqueadas).toEqual([]);
    expect(result.current.intentosIniciales).toEqual([]);
    expect(result.current.intentosFallidos).toBe(0);
  });

  it('guarda política y desbloquea solo después de respuesta exitosa del servidor', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (String(url).includes('politicas')) return { data: { politicas: { max_intentos_fallidos: 5, minutos_bloqueo: 30, minutos_sesion: 30 } } } as never;
      if (String(url).includes('cuentas-bloqueadas')) return { data: { cuentas: [{ id_usuario: 'u-1', nombre_completo: 'Cuenta', correo: 'cuenta@example.test', intentos_fallidos: 5, bloqueado_hasta: 'infinity' }] } } as never;
      return { data: { intentos: [{ id_auditoria: 'a-1', fecha_hora: '2026-11-03T10:00:00Z', ip_origen: '127.0.0.1', datos_despues: { evento: 'FALLIDO', identificador: 'cuenta@example.test' } }] } } as never;
    });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { guardado: true } } as never);
    vi.mocked(apiClient.post).mockResolvedValue({ data: { guardado: true } } as never);
    const { result } = renderHook(() => useSeguridadPolicies(), { wrapper });
    await waitFor(() => expect(result.current.cuentasBloqueadas).toHaveLength(1));
    expect(result.current.intentosFallidos).toBe(1);
    await act(async () => { await result.current.guardarPoliticas(); });
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/admin/seguridad/politicas', { maxIntentosFallidos: 5, minutosBloqueo: 30, minutosSesion: 30 });
    await act(async () => { await result.current.desbloquearCuenta('u-1', 'Revisión forense confirmada'); });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/admin/seguridad/cuentas/u-1/desbloquear', { justificacion: 'Revisión forense confirmada' });
  });
});
