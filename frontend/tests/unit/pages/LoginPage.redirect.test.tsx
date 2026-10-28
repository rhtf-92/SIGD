// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '../../../src/pages/LoginPage';
import ProtectedRoute from '../../../src/routes/ProtectedRoute';
import { apiClient } from '../../../src/api/client';
import { useAuthStore, type UsuarioPerfil } from '../../../src/stores/authStore';
import { ROLES_ADMIN, ROLES_CIUDADANO, ROLES_REPORTES, ROLES_VENTANILLA } from '../../../src/config/navigation.config';

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
  localStorage.clear();
});

describe('primer login y redirect por rol', () => {
  it.each([
    ['CIUDADANO', '/administracion', '/tramite'],
    ['ADMINISTRADOR', '/administracion', '/administracion'],
    ['DIRECTOR', '/administracion', '/reportes/dashboard'],
    ['MESA_PARTES', '/tramite', '/tramite/ventanilla-presencial'],
    ['CIUDADANO', null, '/tramite'],
  ] as const)('%s desde %s termina en %s al primer intento', async (rol, origen, destino) => {
    const usuario: UsuarioPerfil = { id: '11111111-1111-4111-8111-111111111111', nombreCompleto: 'Persona Lab', correo: 'lab@example.test', rol };
    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { accessToken: 'jwt-lab', refreshToken: 'refresh-lab', usuario } });
    render(<MemoryRouter initialEntries={[{ pathname: '/login', state: origen ? { from: { pathname: origen } } : null }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/administracion" element={<ProtectedRoute requiredRoles={ROLES_ADMIN}><p>Destino administración</p></ProtectedRoute>} />
        <Route path="/tramite" element={<ProtectedRoute requiredRoles={ROLES_CIUDADANO}><p>Destino trámite</p></ProtectedRoute>} />
        <Route path="/tramite/ventanilla-presencial" element={<ProtectedRoute requiredRoles={ROLES_VENTANILLA}><p>Destino ventanilla</p></ProtectedRoute>} />
        <Route path="/reportes/dashboard" element={<ProtectedRoute requiredRoles={ROLES_REPORTES}><p>Destino reportes</p></ProtectedRoute>} />
        <Route path="/acceso-denegado" element={<p>Acceso denegado</p>} />
      </Routes>
    </MemoryRouter>);
    const actor = userEvent.setup();
    await actor.type(screen.getByLabelText(/Usuario o correo/i), 'lab@example.test');
    await actor.type(screen.getByLabelText(/Contraseña/i), 'clave-lab');
    await actor.click(screen.getByRole('button', { name: /Ingresar al sistema/i }));
    await waitFor(() => expect(screen.getByText(`Destino ${destino === '/administracion' ? 'administración' : destino === '/tramite' ? 'trámite' : destino === '/reportes/dashboard' ? 'reportes' : 'ventanilla'}`)).toBeInTheDocument());
    expect(screen.queryByText('Acceso denegado')).not.toBeInTheDocument();
    expect(useAuthStore.getState().usuario?.rol).toBe(rol);
  });
});

describe('LoginPage — Contexto de Login al solicitar acceso TUPA (SIGD 2026)', () => {
  it('A) CIUDADANO con intent SOLICITAR_ACCESO_TUPA regresa a /solicitud-acceso-tupa', async () => {
    const usuario: UsuarioPerfil = {
      id: '22222222-2222-4222-8222-222222222222',
      nombreCompleto: 'Juan Ciudadano',
      correo: 'ciudadano@prueba.pe',
      rol: 'CIUDADANO',
    };
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { accessToken: 'jwt-ciudadano', refreshToken: 'ref-ciudadano', usuario },
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            state: { from: '/solicitud-acceso-tupa', intent: 'SOLICITAR_ACCESO_TUPA' },
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/solicitud-acceso-tupa" element={<p>Pantalla de Solicitud TUPA</p>} />
          <Route path="/tramite" element={<p>Destino trámite</p>} />
        </Routes>
      </MemoryRouter>
    );

    const actor = userEvent.setup();
    await actor.type(screen.getByLabelText(/Usuario o correo/i), 'ciudadano@prueba.pe');
    await actor.type(screen.getByLabelText(/Contraseña/i), 'clave123');
    await actor.click(screen.getByRole('button', { name: /Ingresar al sistema/i }));

    await waitFor(() => {
      expect(screen.getByText('Pantalla de Solicitud TUPA')).toBeInTheDocument();
    });
    expect(screen.queryByText('Destino trámite')).not.toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it.each([
    ['MESA_PARTES', 'Ventanilla Presencial'],
    ['ADMINISTRADOR', 'Administración'],
    ['DIRECTOR', 'Reportes Dashboard'],
    ['SECRETARIO', 'Expedientes'],
    ['ESPECIALISTA', 'Expedientes'],
  ] as const)('%s con intent SOLICITAR_ACCESO_TUPA muestra aviso institucional con botones y NO redirige', async (rol, _destino) => {
    const usuario: UsuarioPerfil = {
      id: '33333333-3333-4333-8333-333333333333',
      nombreCompleto: `Personal ${rol}`,
      correo: `${rol.toLowerCase()}@iestpsuiza.edu.pe`,
      rol,
    };
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { accessToken: 'jwt-staff', refreshToken: 'ref-staff', usuario },
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            search: '?intent=SOLICITAR_ACCESO_TUPA&from=/solicitud-acceso-tupa',
            state: { from: '/solicitud-acceso-tupa', intent: 'SOLICITAR_ACCESO_TUPA' },
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/tramite/ventanilla-presencial" element={<p>Ventanilla Presencial</p>} />
          <Route path="/administracion" element={<p>Administración</p>} />
          <Route path="/reportes/dashboard" element={<p>Reportes Dashboard</p>} />
          <Route path="/expedientes" element={<p>Expedientes</p>} />
          <Route path="/tupa" element={<p>Catálogo TUPA</p>} />
          <Route path="/" element={<p>Página de Inicio</p>} />
        </Routes>
      </MemoryRouter>
    );

    const actor = userEvent.setup();
    await actor.type(screen.getByLabelText(/Usuario o correo/i), `${rol.toLowerCase()}@iestpsuiza.edu.pe`);
    await actor.type(screen.getByLabelText(/Contraseña/i), 'clave123');
    await actor.click(screen.getByRole('button', { name: /Ingresar al sistema/i }));

    // Debe mostrar la pantalla informativa
    await waitFor(() => {
      expect(screen.getByText(/Acceso institucional detectado/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Tu cuenta pertenece al personal del instituto y ya cuenta con acceso al Catálogo TUPA institucional/i)
    ).toBeInTheDocument();

    // Comprobar botones [Ir al Catálogo TUPA] y [Volver al inicio]
    const botonTupa = screen.getByRole('link', { name: /Ir al Catálogo TUPA/i });
    expect(botonTupa).toHaveAttribute('href', '/tupa');

    const botonInicio = screen.getByRole('link', { name: /Volver al inicio/i });
    expect(botonInicio).toHaveAttribute('href', '/');

    // No debe haber ido a los paneles habituales
    expect(screen.queryByText('Ventanilla Presencial')).not.toBeInTheDocument();
    expect(screen.queryByText('Administración')).not.toBeInTheDocument();
    expect(screen.queryByText('Reportes Dashboard')).not.toBeInTheDocument();
  });
});
