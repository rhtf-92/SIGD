import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../../../src/pages/LoginPage';
import { useAuthStore, type RolInstitucional } from '../../../src/stores/authStore';

const estadoReal = useAuthStore.getState();

function renderLogin() {
  return render(<MemoryRouter initialEntries={['/login']}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/reportes/dashboard" element={<h1>Panel de dirección</h1>} />
    <Route path="/expedientes" element={<h1>Expedientes</h1>} />
  </Routes></MemoryRouter>);
}

function completarFormulario() {
  fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'persona@suiza.edu.pe' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-segura' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar al sistema' }));
}

describe('LoginPage - autenticación y perfil efectivo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    useAuthStore.setState({
      accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false,
      selectionToken: null, rolesDisponibles: [], usuarioPendiente: null,
      login: estadoReal.login, seleccionarPerfil: estadoReal.seleccionarPerfil,
    });
  });

  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('elimina el selector y muestra las credenciales desde la carga', () => {
    renderLogin();
    expect(screen.queryByLabelText('Rol institucional')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Usuario o correo')).toBeVisible();
    expect(screen.getByLabelText('Contraseña')).toBeVisible();
    expect(screen.getByText('Ingresa tus credenciales institucionales para acceder al sistema.')).toBeVisible();
  });

  it('autoriza un único rol y navega según el perfil confirmado por el servidor', async () => {
    const login = vi.fn(async () => {
      useAuthStore.setState({ accessToken: 'token-real', usuario: {
        id: 'director-1', nombreCompleto: 'Dirección General', correo: 'director@suiza.edu.pe',
        rol: 'DIRECTOR', rolesAutorizados: ['DIRECTOR'], permisos: [],
      }, isAuthenticated: true });
      return { requiresRoleSelection: false };
    });
    useAuthStore.setState({ login }); renderLogin(); completarFormulario();
    expect(screen.getByRole('heading', { name: 'Validando credenciales...' })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(220));
    expect(screen.getByRole('heading', { name: '¡Acceso autorizado!' })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(150));
    expect(screen.getByRole('heading', { name: 'Panel de dirección' })).toBeInTheDocument();
  });

  it('para múltiples roles muestra solo perfiles confirmados y conserva la identidad', async () => {
    const login = vi.fn(async () => {
      useAuthStore.setState({ selectionToken: 'selection-token', rolesDisponibles: ['DOCENTE', 'DIRECTOR'],
        usuarioPendiente: { id: 'u1', nombreCompleto: 'Usuario Multirrol', correo: 'u@suiza.edu.pe' } });
      return { requiresRoleSelection: true };
    });
    const seleccionarPerfil = vi.fn(async (rol: RolInstitucional) => {
      useAuthStore.setState({ accessToken: 'access-selected', isAuthenticated: true,
        usuario: { id: 'u1', nombreCompleto: 'Usuario Multirrol', correo: 'u@suiza.edu.pe', rol,
          rolesAutorizados: ['DOCENTE', 'DIRECTOR'], permisos: [] }, selectionToken: null,
        rolesDisponibles: [], usuarioPendiente: null });
    });
    useAuthStore.setState({ login, seleccionarPerfil }); renderLogin(); completarFormulario();
    await act(async () => vi.advanceTimersByTimeAsync(220));
    expect(screen.getByRole('heading', { name: 'Selecciona tu perfil de trabajo' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Docente/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Director/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Estudiante/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Docente/ }));
    expect(seleccionarPerfil).toHaveBeenCalledWith('DOCENTE');
    await act(async () => vi.advanceTimersByTimeAsync(150));
    expect(screen.getByRole('heading', { name: 'Expedientes' })).toBeVisible();
  });

  it('rechaza credenciales inválidas sin conceder acceso', async () => {
    useAuthStore.setState({ login: vi.fn().mockRejectedValue(new Error('Unauthorized')) });
    renderLogin(); completarFormulario();
    await act(async () => vi.advanceTimersByTimeAsync(220));
    expect(screen.getByRole('heading', { name: 'Correo o contraseña incorrectos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intentar nuevamente' })).toBeEnabled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
