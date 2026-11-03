import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../src/api/client';
import { useAuditLogs } from '../../../src/hooks/useAuditLogs';

vi.mock('@/api/client', () => ({ apiClient: { get: vi.fn() } }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAuditLogs', () => {
  it('carga la bitácora real con paginación y no usa registros de ejemplo', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { total: 1, registros: [{ id_auditoria: 'a-1', correlation_id: 'c-1', usuario_id: 'u-1', ip_origen: '127.0.0.1', esquema: 'sigd_core', tabla: 'expediente', operacion: 'INSERT', creado_en: '2026-11-03T10:00:00Z' }] } } as never);
    const { result } = renderHook(() => useAuditLogs(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/auditoria/bitacora', { params: { limite: 50, offset: 0 } });
    expect(result.current.filtrados).toHaveLength(1);
    expect(result.current.filtrados[0].id).toBe('a-1');
    expect(result.current.filtrados[0].usuario).toBe('u-1');
    expect(result.current.filtrados[0].correlationId).toBe('c-1');
    expect(result.current.modulos).toEqual(['sigd_core']);
  });
});
