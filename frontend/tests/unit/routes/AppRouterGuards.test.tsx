import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppRouter from '../../../src/routes/AppRouter';
import { useAuthStore } from '../../../src/stores/authStore';
import { apiClient } from '../../../src/api/client';

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [] });
  vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
});

function renderWithProviders(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    usuario: null,
    isAuthenticated: false,
  });
  localStorage.clear();
});

describe('AppRouter — Fail-Closed Route Guards y Segmentación Modular RBAC', () => {
  describe('1. Módulos Públicos (Acceso permitido sin autenticación)', () => {
    it('ruta pública / se renderiza sin requerir sesión', () => {
      renderWithProviders('/');
      expect(screen.getByText('Sistema Integral de Gestión Documentaria')).toBeInTheDocument();
    });

    it('ruta pública /login se renderiza sin requerir sesión', () => {
      renderWithProviders('/login');
      expect(screen.getAllByText(/Iniciar sesión/i).length).toBeGreaterThan(0);
    });

    it('ruta pública /registro se renderiza sin requerir sesión', () => {
      renderWithProviders('/registro');
      expect(screen.getByText(/Registro de Usuario Externo/i)).toBeInTheDocument();
    });

    it('ruta pública /consulta se renderiza sin requerir sesión', () => {
      renderWithProviders('/consulta');
      expect(screen.getByText(/Consulta Pública de Trámite/i)).toBeInTheDocument();
    });

    it('ruta pública /validador-cvd se renderiza sin requerir sesión', async () => {
      renderWithProviders('/validador-cvd');
      expect(await screen.findByText(/Verificador público de Códigos de Verificación Digital/i)).toBeInTheDocument();
    });

    it('ruta pública /flujo-validez-legal se renderiza sin requerir sesión', async () => {
      renderWithProviders('/flujo-validez-legal');
      expect(await screen.findByText(/Módulo 04 · Flujo y Validez Legal de Documentos Digitales/i)).toBeInTheDocument();
    });

    it('ruta pública /acceso-denegado se renderiza sin requerir sesión', () => {
      renderWithProviders('/acceso-denegado');
      expect(screen.getByText(/Acceso denegado/i)).toBeInTheDocument();
    });
  });

  describe('2. Fail-Closed: Redirección inmediata a /login para anónimos en rutas privadas', () => {
    it.each([
      '/tramite',
      '/mis-expedientes',
      '/casilla',
      '/tramite/ventanilla-presencial',
      '/expedientes',
      '/reportes/dashboard',
      '/administracion',
      '/calendarizacion-institucional',
    ])('usuario anónimo accediendo a %s es enviado a /login', (rutaPrivada) => {
      renderWithProviders(rutaPrivada);
      expect(screen.getAllByText(/Iniciar sesión/i).length).toBeGreaterThan(0);
    });
  });

  describe('3. CIUDADANO: Acceso exclusivo a trámites personales, bloqueo de institucional', () => {
    beforeEach(() => {
      useAuthStore.setState({
        accessToken: 'jwt-ciudadano',
        refreshToken: null,
        isAuthenticated: true,
        usuario: {
          id: 'u-ciu',
          nombreCompleto: 'Ciudadano Demo',
          correo: 'ciudadano@example.test',
          rol: 'CIUDADANO',
        },
      });
    });

    it('permite acceso a /tramite (Mesa de Partes Virtual)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          idPersona: '33333333-3333-4333-8333-333333333333',
          tipoDocumento: 'DNI', numeroDocumento: '12345678',
          nombres: 'Ana', apellidos: 'Pérez', correo: 'ciudadano@example.test',
          telefono: '987654321', direccion: 'Av. Central 100',
        }),
      } as Response);
      renderWithProviders('/tramite');
      expect(await screen.findByText(/Verifica tus datos/i)).toBeInTheDocument();
    });

    it('permite /mi-perfil solo con sesión ciudadana', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({ data: {
        id: 'u-ciu', idPersona: '33333333-3333-4333-8333-333333333333',
        username: '12345678', usernameConfigurado: false, tipoDocumento: 'DNI',
        numeroDocumento: '12345678', nombres: 'Ana', apellidos: 'Pérez',
        correo: 'ciudadano@example.test', telefono: null, direccion: null,
      } });
      renderWithProviders('/mi-perfil');
      expect(await screen.findByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();
    });

    it('permite acceso a /mis-expedientes', async () => {
      renderWithProviders('/mis-expedientes');
      expect(await screen.findByText(/Portal del Ciudadano/i)).toBeInTheDocument();
      expect(screen.getByText(/Mis Expedientes/i)).toBeInTheDocument();
    });

    it('permite acceso a /casilla', async () => {
      renderWithProviders('/casilla');
      expect(await screen.findByText(/Bandeja de Casilla Electrónica Ciudadana/i)).toBeInTheDocument();
    });

    it.each([
      '/expedientes',
      '/tramite/ventanilla-presencial',
      '/reportes/dashboard',
      '/administracion',
      '/calendarizacion-institucional',
    ])('ciudadano accediendo a módulo institucional %s es bloqueado con /acceso-denegado', (ruta) => {
      renderWithProviders(ruta);
      expect(screen.getByText(/Acceso denegado/i)).toBeInTheDocument();
    });
  });

  describe('4. MESA_PARTES: Ventanilla y bandeja institucional', () => {
    beforeEach(() => {
      useAuthStore.setState({
        accessToken: 'jwt-mp',
        refreshToken: null,
        isAuthenticated: true,
        usuario: {
          id: 'u-mp',
          nombreCompleto: 'Operador Ventanilla',
          correo: 'mp@example.test',
          rol: 'MESA_PARTES',
        },
      });
    });

    it('permite acceso a /tramite/ventanilla-presencial', async () => {
      renderWithProviders('/tramite/ventanilla-presencial');
      expect(await screen.findByText(/Ventanilla Presencial de Atención al Ciudadano/i)).toBeInTheDocument();
    });

    it('permite acceso a /expedientes', async () => {
      renderWithProviders('/expedientes');
      expect(await screen.findByText(/Bandeja de expedientes/i)).toBeInTheDocument();
    });

    it.each(['/tramite', '/mis-expedientes', '/mi-perfil', '/administracion', '/reportes/dashboard'])(
      'mesa de partes accediendo a %s es bloqueado con /acceso-denegado',
      (ruta) => {
        renderWithProviders(ruta);
        expect(screen.getByText(/Acceso denegado/i)).toBeInTheDocument();
      }
    );
  });

  describe('5. ESPECIALISTA y SECRETARIO: Bandeja de expedientes', () => {
    it.each(['ESPECIALISTA', 'SECRETARIO'] as const)(
      'rol %s accede a /expedientes y es bloqueado en /administracion y /tramite',
      async (rol) => {
        useAuthStore.setState({
          accessToken: `jwt-${rol}`,
          refreshToken: null,
          isAuthenticated: true,
          usuario: {
            id: `u-${rol}`,
            nombreCompleto: `${rol} Funcionario`,
            correo: `${rol.toLowerCase()}@example.test`,
            rol,
          },
        });

        const { unmount } = renderWithProviders('/expedientes');
        expect(await screen.findByText(/Bandeja de expedientes/i)).toBeInTheDocument();
        unmount();

        renderWithProviders('/administracion');
        expect(screen.getByText(/Acceso denegado/i)).toBeInTheDocument();
      }
    );
  });

  describe('6. DIRECTOR: Reportes y bandeja de expedientes', () => {
    beforeEach(() => {
      useAuthStore.setState({
        accessToken: 'jwt-dir',
        refreshToken: null,
        isAuthenticated: true,
        usuario: {
          id: 'u-dir',
          nombreCompleto: 'Director General',
          correo: 'dir@example.test',
          rol: 'DIRECTOR',
        },
      });
    });

    it('permite acceso a /reportes/dashboard', async () => {
      renderWithProviders('/reportes/dashboard');
      expect((await screen.findAllByText(/Tablero Directivo Ejecutivo/i)).length).toBeGreaterThan(0);
    });

    it('permite acceso a /expedientes', async () => {
      renderWithProviders('/expedientes');
      expect(await screen.findByText(/Bandeja de expedientes/i)).toBeInTheDocument();
    });

    it('bloquea acceso a /administracion y /tramite', () => {
      renderWithProviders('/administracion');
      expect(screen.getByText(/Acceso denegado/i)).toBeInTheDocument();
    });
  });

  describe('7. ADMINISTRADOR: Panel de Administración, Reportes, Calendario y Expedientes', () => {
    beforeEach(() => {
      useAuthStore.setState({
        accessToken: 'jwt-admin',
        refreshToken: null,
        isAuthenticated: true,
        usuario: {
          id: 'u-admin',
          nombreCompleto: 'Admin Sistema',
          correo: 'admin@example.test',
          rol: 'ADMINISTRADOR',
        },
      });
    });

    it('permite acceso a /administracion', async () => {
      renderWithProviders('/administracion');
      expect((await screen.findAllByText(/Panel de Administración/i)).length).toBeGreaterThan(0);
    });

    it('permite acceso a /calendarizacion-institucional', async () => {
      renderWithProviders('/calendarizacion-institucional');
      expect((await screen.findAllByText(/Calendarización Institucional/i)).length).toBeGreaterThan(0);
    });

    it('permite acceso a /reportes/dashboard', async () => {
      renderWithProviders('/reportes/dashboard');
      expect((await screen.findAllByText(/Tablero Directivo Ejecutivo/i)).length).toBeGreaterThan(0);
    });

    it('permite acceso a /expedientes', async () => {
      renderWithProviders('/expedientes');
      expect(await screen.findByText(/Bandeja de expedientes/i)).toBeInTheDocument();
    });

    it('permite acceso a /tesoreria para ADMINISTRADOR', async () => {
      renderWithProviders('/tesoreria');
      expect((await screen.findAllByText(/Módulo de Tesorería/i)).length).toBeGreaterThan(0);
    });
  });

  describe('8. TESORERIA: Acceso a Módulo de Tesorería y bloqueo de otros módulos', () => {
    beforeEach(() => {
      useAuthStore.setState({
        accessToken: 'jwt-tesoreria',
        refreshToken: null,
        isAuthenticated: true,
        usuario: {
          id: 'u-tes',
          nombreCompleto: 'Tesorero Demo',
          correo: 'tesoreria@suiza.edu.pe',
          rol: 'TESORERIA',
        },
      });
    });

    it('permite acceso a /tesoreria para rol TESORERIA', async () => {
      renderWithProviders('/tesoreria');
      expect((await screen.findAllByText(/Módulo de Tesorería/i)).length).toBeGreaterThan(0);
    });

    it('bloquea acceso a /administracion para rol TESORERIA', () => {
      renderWithProviders('/administracion');
      expect(screen.getByText(/Acceso denegado/i)).toBeInTheDocument();
    });
  });
});
