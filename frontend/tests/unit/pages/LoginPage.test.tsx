import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../../../src/pages/LoginPage';
import { useAuthStore } from '../../../src/stores/authStore';

const loginReal = useAuthStore.getState().login;

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reportes/dashboard" element={<h1>Panel de dirección</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function completarFormulario() {
  fireEvent.change(screen.getByLabelText('Rol institucional'), { target: { value: 'ESTUDIANTE' } });
  fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'persona@suiza.edu.pe' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-segura' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Ingresar al sistema' }).closest('form')!);
}

describe('LoginPage - validación animada', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
      login: loginReal,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    useAuthStore.setState({ login: loginReal });
  });

  it('solo autoriza y navega según el rol confirmado por el servidor', async () => {
    const login = vi.fn(async () => {
      useAuthStore.setState({
        accessToken: 'token-real',
        usuario: {
          id: 'director-1',
          nombreCompleto: 'Dirección General',
          correo: 'director@suiza.edu.pe',
          rol: 'DIRECTOR',
        },
        isAuthenticated: true,
      });
    });
    useAuthStore.setState({ login });
    renderLogin();

    completarFormulario();
    expect(screen.getByRole('heading', { name: 'Validando contraseña...' })).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(screen.getByRole('heading', { name: 'Verificando credenciales...' })).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(120));
    expect(screen.getByRole('heading', { name: '¡Acceso autorizado!' })).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(150));
    expect(screen.getByRole('heading', { name: 'Panel de dirección' })).toBeInTheDocument();
  });

  it('muestra el rechazo y no navega cuando el servidor rechaza las credenciales', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Unauthorized'));
    useAuthStore.setState({ login });
    renderLogin();

    completarFormulario();
    await act(async () => vi.advanceTimersByTimeAsync(220));

    expect(screen.getByRole('heading', { name: 'Correo o contraseña incorrectos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intentar nuevamente' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'Panel de dirección' })).not.toBeInTheDocument();
  });
});
