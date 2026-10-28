import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SolicitudAccesoTupaPage from '../../../src/pages/tramite/SolicitudAccesoTupaPage';
import { useAuthStore } from '../../../src/stores/authStore';

describe('SolicitudAccesoTupaPage — Acceso Restringido al TUPA y Solicitudes Ciudadanas', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renderiza la política institucional de acceso y opciones de ingreso para usuario anónimo', () => {
    render(
      <MemoryRouter>
        <SolicitudAccesoTupaPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Acceso al Catálogo Integral TUPA 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Para consultar el documento TUPA institucional completo/i)).toBeInTheDocument();
    expect(screen.getByText(/Identificación de Usuario Requerida/i)).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: /Iniciar Sesión/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login?intent=SOLICITAR_ACCESO_TUPA&from=/solicitud-acceso-tupa');
    expect(screen.getByRole('link', { name: /Registrarse como Ciudadano/i })).toBeInTheDocument();
  });

  it('muestra mensaje de autorización directa para personal institucional sin formulario', () => {
    useAuthStore.setState({
      accessToken: 'token-admin',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-admin',
        nombreCompleto: 'Director General',
        correo: 'director@suiza.edu.pe',
        rol: 'DIRECTOR',
      },
    });

    render(
      <MemoryRouter>
        <SolicitudAccesoTupaPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Usuario Institucional Autorizado/i)).toBeInTheDocument();
    expect(screen.getByText(/Usted cuenta con autorización directa/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Consultar Catálogo TUPA Autorizado/i })).toHaveAttribute('href', '/tupa');
  });

  it('permite a un ciudadano autenticado completar y enviar la solicitud de acceso', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      accessToken: 'token-ciudadano',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-ciudadano',
        nombreCompleto: 'Ana García',
        correo: 'ana.garcia@gmail.com',
        rol: 'CIUDADANO',
      },
    });

    globalThis.fetch = vi.fn((url: any, _opts: any) => {
      if (String(url).includes('/api/v1/tramites/tupa/acceso/estado')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            autenticado: true,
            autorizado: false,
            estado: 'NINGUNA',
            solicitud: null,
          }),
        });
      }
      if (String(url).includes('/api/v1/tramites/tupa/acceso/solicitar')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            idSolicitud: 'sol-001',
            idPersona: 'p-001',
            motivo: 'Consulta de requisitos para titulación profesional',
            correoContacto: 'ana.garcia@gmail.com',
            estado: 'PENDIENTE',
            fechaSolicitud: '2026-10-24T20:00:00Z',
          }),
        });
      }
      return Promise.reject(new Error('URL no mockeada'));
    }) as any;

    render(
      <MemoryRouter>
        <SolicitudAccesoTupaPage />
      </MemoryRouter>
    );

    // Formulario visible
    await waitFor(() => {
      expect(screen.getByLabelText(/Motivo o Justificación/i)).toBeInTheDocument();
    });

    const motivoInput = screen.getByLabelText(/Motivo o Justificación/i);
    const checkboxLey = screen.getByRole('checkbox');
    const botonEnviar = screen.getByRole('button', { name: /Enviar Solicitud de Acceso/i });

    // Llenar motivo
    await user.type(motivoInput, 'Consulta de requisitos para titulación profesional');

    // Intentar enviar sin check -> error
    await user.click(botonEnviar);
    expect(screen.getByText(/Debe aceptar el aviso de tratamiento de datos personales conforme a la Ley 29733/i)).toBeInTheDocument();

    // Marcar check y enviar
    await user.click(checkboxLey);
    await user.click(botonEnviar);

    // Debe mostrar estado de solicitud en revisión
    await waitFor(() => {
      expect(screen.getByText(/Solicitud en Revisión por Mesa de Partes/i)).toBeInTheDocument();
      expect(screen.getByText(/Su solicitud de acceso al catálogo TUPA ha sido radicada/i)).toBeInTheDocument();
    });
  });

  it('muestra estado APROBADA con enlace directo al catálogo TUPA para ciudadano autorizado', async () => {
    useAuthStore.setState({
      accessToken: 'token-aprobado',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-aprobado',
        nombreCompleto: 'Juan Pérez',
        correo: 'juan.perez@test.com',
        rol: 'CIUDADANO',
      },
    });

    globalThis.fetch = vi.fn((url: any) => {
      if (String(url).includes('/api/v1/tramites/tupa/acceso/estado')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            autenticado: true,
            autorizado: true,
            estado: 'APROBADA',
            solicitud: {
              idSolicitud: 'sol-002',
              estado: 'APROBADA',
              motivo: 'Investigación académica',
              fechaSolicitud: '2026-10-24T18:00:00Z',
              fechaRespuesta: '2026-10-24T18:30:00Z',
            },
          }),
        });
      }
      return Promise.reject(new Error('URL no mockeada'));
    }) as any;

    render(
      <MemoryRouter>
        <SolicitudAccesoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/¡Acceso al TUPA Institucional Autorizado!/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Consultar Catálogo TUPA Completo/i })).toHaveAttribute('href', '/tupa');
    });
  });
});
