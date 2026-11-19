import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HeaderInstitucional from '@/components/HeaderInstitucional';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';

const originalLogout = useAuthStore.getState().logout;
const logout = vi.fn();
function montar() { return render(<MemoryRouter><HeaderInstitucional /></MemoryRouter>); }

beforeEach(() => {
  localStorage.clear();
  logout.mockReset();
  useAuthStore.setState({ accessToken: 'acceso-del-doble', refreshToken: 'refresh-del-doble', isAuthenticated: true, logout });
});

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ accessToken: null, refreshToken: null, isAuthenticated: false, logout: originalLogout });
  localStorage.clear();
});

describe('HeaderInstitucional — Cabecera Institucional y Cierre de Sesión', () => {
  it('renderiza la identidad institucional del IESTP Suiza', () => {
    montar();
    expect(screen.getByText('SIGD SUIZA')).toBeInTheDocument();
    expect(screen.getByText(/Instituto de Educación Superior Tecnológico Público/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Inicio/i })).toBeInTheDocument();
  });

  it('invoca el cierre de sesión cuando el usuario está autenticado', async () => {
    let confirmar!: (value: unknown) => void;
    const post = vi.spyOn(apiClient, 'post').mockReturnValue(new Promise(resolve => { confirmar = resolve; }));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(screen.getByRole('button', { name: 'Cerrando sesión…' })).toBeDisabled();
    await act(async () => { void useAuthStore.getState().cerrarSesion?.(); });
    expect(post).toHaveBeenCalledWith('/api/v1/auth/logout', { refreshToken: 'refresh-del-doble' });
    await act(async () => { confirmar({ status: 200, data: { ok: true } }); });
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
  });

  it('conserva la sesión y muestra el error si el servidor falla al cerrar sesión', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Servicio no disponible'));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible');
    expect(logout).not.toHaveBeenCalled();
    expect(useAuthStore.getState().refreshToken).toBe('refresh-del-doble');
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled();
  });

  it('la visita pública presenta el botón Iniciar Sesión', () => {
    useAuthStore.setState({ isAuthenticated: false, usuario: null });
    montar();
    expect(screen.getByRole('button', { name: /Iniciar Sesión/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });
});
