import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../src/api/client';
import { ApiHttpError } from '../../../src/types/api';
import ValidadorPublicoCvdPage from '../../../src/pages/validador/ValidadorPublicoCvdPage';
import { useCvdPublicVerification } from '../../../src/hooks/useCvdPublicVerification';
import { aplicarMascaraCvd, extraerCvdDeTexto, validarCvd } from '../../../src/utils/cvdValidator';

vi.mock('../../../src/config/env', () => ({ env: { enableMocks: false, apiBaseUrl: 'http://127.0.0.1:3002' } }));
const codigo = 'CVD-2026-12ABCDEF34567890';

describe('CVD generado por el modelo PostgreSQL original', () => {
  afterEach(() => vi.restoreAllMocks());
  it('acepta CVD-YYYY y los 16 caracteres hexadecimales persistidos', () => {
    expect(validarCvd(codigo.toLowerCase())).toMatchObject({ valido: true, normalizado: codigo });
  });
  it('conserva todos los caracteres al escribir, pegar y editar', () => {
    for (let longitud = 9; longitud <= codigo.length; longitud++) {
      expect(aplicarMascaraCvd(codigo.slice(0, longitud))).toBe(codigo.slice(0, longitud));
    }
    expect(aplicarMascaraCvd(codigo.toLowerCase())).toBe(codigo);
    expect(aplicarMascaraCvd('CVD-2026-RD-000412-892F')).toBe('CVD-2026-RD-000412-892F');
  });
  it('extrae el código completo del QR o texto sin aceptar prefijos truncados', () => {
    expect(extraerCvdDeTexto(`https://prueba.invalid/validador?cvd=${codigo}`)).toBe(codigo);
    expect(extraerCvdDeTexto(`${codigo}F`)).toBeNull();
  });
  it.each(['CVD-2026-12ABCDEF3456789', 'CVD-2026-12ABCDEF34567890F', 'CVD-2026-12ABCDEFG4567890'])('rechaza el formato incompleto o inválido %s', valor => {
    expect(validarCvd(valor).valido).toBe(false);
  });
  it('envía desde el formulario el mismo CVD completo al endpoint existente', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: {
      esValido: false, cvd: codigo, documento: null, selloTiempoTsa: null,
      mensajeSeguridad: 'Resultado sintético para verificar el transporte del identificador.',
    } } as never);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
    render(<MemoryRouter><QueryClientProvider client={client}><ValidadorPublicoCvdPage /></QueryClientProvider></MemoryRouter>);
    const user = userEvent.setup();
    const input = screen.getByLabelText('Código CVD del documento');
    await user.type(input, codigo);
    expect(input).toHaveValue(codigo);
    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    await waitFor(() => expect(get).toHaveBeenCalledWith(`/api/v1/validador/cvd/${codigo}`));
  });

  it.each([404, 503])('presenta el error HTTP %s original sin afirmar autenticidad', async status => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new ApiHttpError({
      status, title: 'Error', detail: 'No disponible', type: 'test', instance: 'test',
      code: 'TEST', category: 'System', correlationId: 'test', retryable: false,
    }));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(<MemoryRouter><QueryClientProvider client={client}><ValidadorPublicoCvdPage /></QueryClientProvider></MemoryRouter>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código CVD del documento'), codigo);
    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 404 ? 'CVD no encontrado' : 'Verificación no disponible');
    expect(screen.getByRole('alert')).toHaveTextContent(`HTTP ${status}`);
    expect(screen.queryByText('Integridad documental cotejada')).not.toBeInTheDocument();
  });

  it('rechaza un positivo incompleto en lugar de inventar metadatos', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: {
      esValido: true, cvd: codigo, documento: null, selloTiempoTsa: null, mensajeSeguridad: 'Registro incompleto',
    } } as never);
    const client = new QueryClient();
    render(<MemoryRouter><QueryClientProvider client={client}><ValidadorPublicoCvdPage /></QueryClientProvider></MemoryRouter>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código CVD del documento'), codigo);
    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Respuesta no verificable');
    expect(screen.queryByText('Integridad documental cotejada')).not.toBeInTheDocument();
  });

  it('evita dos consultas simultáneas del mismo formulario', async () => {
    let completar!: (value: never) => void;
    const get = vi.spyOn(apiClient, 'get').mockReturnValue(new Promise(resolve => { completar = resolve; }) as never);
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useCvdPublicVerification(), { wrapper });
    act(() => { result.current.verificar(codigo); result.current.verificar(codigo); });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    await act(async () => completar({ data: { esValido: false, cvd: codigo, documento: null, selloTiempoTsa: null, mensajeSeguridad: 'No verificable' } } as never));
    await waitFor(() => expect(result.current.isValidando).toBe(false));
  });
});
