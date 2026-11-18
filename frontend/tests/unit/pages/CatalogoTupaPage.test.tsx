import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CatalogoTupaPage from '../../../src/pages/tramite/CatalogoTupaPage';
import { useAuthStore } from '../../../src/stores/authStore';

describe('CatalogoTupaPage — Consulta Pública TUPA y Acceso Institucional', () => {
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

  it('permite a un usuario anónimo consultar el catálogo público sin bloqueo 403', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/tramites/tupa')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'tupa-01',
                codigo: 'p1-fila-05',
                codigoRef: 'p1-fila-05',
                denominacion: 'Certificado Modular (I, II, III y IV)',
                categoria: 'PROCEDIMIENTO_APROBADO',
                monto: 'S/ 100.00',
                costoSoles: 100,
                plazo: '15 días hábiles',
                requisitos: ['Pago en Tesorería'],
                generaExpediente: true,
              },
              {
                id: 'tupa-02',
                codigo: 'p2-fila-10',
                codigoRef: 'p2-fila-10',
                denominacion: 'Alquiler del Galpón Agrícola',
                categoria: 'SERVICIO_COMERCIAL',
                monto: 'S/ 250.00',
                costoSoles: 250,
                plazo: '5 días hábiles',
                requisitos: ['Solicitud de alquiler'],
                generaExpediente: false,
              },
            ]),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    // Debe mostrar el catálogo público, no la pantalla de bloqueo
    await waitFor(() => {
      expect(screen.getByText(/Catálogo de Procedimientos y Servicios/i)).toBeInTheDocument();
      expect(screen.getByText(/Certificado Modular \(I, II, III y IV\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Alquiler del Galpón Agrícola/i)).toBeInTheDocument();
      expect(screen.queryByText(/Acceso Denegado \/ Solicitud Requerida/i)).not.toBeInTheDocument();
    });

    // Enlace para solicitar la copia escaneada oficial en PDF
    expect(screen.getByRole('link', { name: /Solicitar Copia Escaneada \(PDF\)/i })).toHaveAttribute(
      'href',
      '/solicitud-acceso-tupa'
    );
  });

  it('permite a un ciudadano autenticado consultar el catálogo y ver el enlace a solicitar copia PDF', async () => {
    useAuthStore.setState({
      accessToken: 'token-ciudadano',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-ciudadano',
        nombreCompleto: 'Juan Pérez',
        correo: 'juan@test.com',
        rol: 'CIUDADANO',
      },
    });

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/acceso/estado')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              autenticado: true,
              autorizado: false,
              estado: 'PENDIENTE',
            }),
        });
      }
      if (url.includes('/api/v1/tramites/tupa')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'tupa-01',
                codigo: 'p1-fila-05',
                codigoRef: 'p1-fila-05',
                denominacion: 'Certificado Modular (I, II, III y IV)',
                categoria: 'PROCEDIMIENTO_APROBADO',
                monto: 'S/ 100.00',
                costoSoles: 100,
                plazo: '15 días hábiles',
                requisitos: ['Pago en Tesorería'],
                generaExpediente: true,
              },
            ]),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Catálogo de Procedimientos y Servicios/i)).toBeInTheDocument();
      expect(screen.getByText(/Certificado Modular \(I, II, III y IV\)/i)).toBeInTheDocument();
      expect(screen.queryByText(/Acceso Denegado \/ Solicitud Requerida/i)).not.toBeInTheDocument();
    });
  });

  it('permite acceso con insignia de rol institucional y datos en vivo para rol MESA_PARTES', async () => {
    useAuthStore.setState({
      accessToken: 'token-admin',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-admin',
        nombreCompleto: 'Operador Mesa Partes',
        correo: 'mp@suiza.edu.pe',
        rol: 'MESA_PARTES',
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'tupa-01',
            codigo: 'p1-fila-05',
            codigoRef: 'p1-fila-05',
            denominacion: 'Certificado Modular (I, II, III y IV)',
            categoria: 'PROCEDIMIENTO_APROBADO',
            monto: 'S/ 100.00',
            costoSoles: 100,
            plazo: '15 días hábiles',
            requisitos: ['Pago en Tesorería'],
            generaExpediente: true,
          },
          {
            id: 'tupa-02',
            codigo: 'p2-fila-10',
            codigoRef: 'p2-fila-10',
            denominacion: 'Alquiler del Galpón Agrícola',
            categoria: 'SERVICIO_COMERCIAL',
            monto: 'S/ 250.00',
            costoSoles: 250,
            plazo: '5 días hábiles',
            requisitos: ['Solicitud de alquiler'],
            generaExpediente: false,
          },
        ]),
    });

    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Catálogo de Procedimientos y Servicios/i)).toBeInTheDocument();
      expect(screen.getByText(/Rol: MESA_PARTES/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Certificado Modular \(I, II, III y IV\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Alquiler del Galpón Agrícola/i)).toBeInTheDocument();
  });

  it('permite filtrar por texto y por categoría', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Catálogo de Procedimientos y Servicios/i)).toBeInTheDocument();
    });

    // Filtro por texto
    const inputBusqueda = screen.getByLabelText(/Buscar por denominación o código:/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Inglés' } });

    await waitFor(() => {
      expect(screen.getByText('Certificado de Inglés')).toBeInTheDocument();
      expect(screen.queryByText(/Alquiler del Galpón Agrícola/i)).not.toBeInTheDocument();
    });

    // Limpiar filtro
    fireEvent.change(inputBusqueda, { target: { value: '' } });

    // Filtro por categoría BIEN_PRODUCTIVO
    const selectCategoria = screen.getByLabelText(/Filtrar por Categoría:/i);
    await user.selectOptions(selectCategoria, 'BIEN_PRODUCTIVO');

    await waitFor(() => {
      expect(screen.getByText(/Venta de Mangos/i)).toBeInTheDocument();
      expect(screen.queryByText(/Certificado de Inglés/i)).not.toBeInTheDocument();
    });
  });

  it('para visitantes públicos, los conceptos no radicables muestran ficha informativa y NO botón de solicitud digital', async () => {
    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Catálogo de Procedimientos y Servicios/i)).toBeInTheDocument();
    });

    // Filtrar para encontrar el Galpón (servicio comercial no radicable)
    const inputBusqueda = screen.getByLabelText(/Buscar por denominación o código:/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Galpón' } });

    await waitFor(() => {
      expect(screen.getByText(/Alquiler del Galpón Agrícola/i)).toBeInTheDocument();
      // Debe mostrar la Ficha Informativa
      expect(screen.getByText(/Ficha Informativa de Atención/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Centro de Producción de Bienes y Servicios/i).length).toBeGreaterThanOrEqual(1);
      // NO debe ofrecer botón de solicitud digital a usuarios externos
      expect(screen.queryByRole('button', { name: /Iniciar Trámite de Solicitud/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Registrar en Ventanilla/i })).not.toBeInTheDocument();
    });
  });

  it('permite a un operador institucional registrar en ventanilla un servicio no radicable mediante el modal por pasos', async () => {
    useAuthStore.setState({
      accessToken: 'token-ventanilla',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-operador',
        nombreCompleto: 'Operador Ventanilla',
        correo: 'ventanilla@suiza.edu.pe',
        rol: 'MESA_PARTES',
      },
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Catálogo de Procedimientos y Servicios/i)).toBeInTheDocument();
    });

    // Filtrar para encontrar el Galpón
    const inputBusqueda = screen.getByLabelText(/Buscar por denominación o código:/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Galpón' } });

    await waitFor(
      () => {
        const botonVentanilla = screen.getByRole('button', { name: /Registrar en Ventanilla/i });
        expect(botonVentanilla).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    const botonVentanilla = screen.getByRole('button', { name: /Registrar en Ventanilla/i });
    await user.click(botonVentanilla);

    // Modal debe abrirse en Paso 1 (Orientación)
    await waitFor(() => {
      expect(screen.getByText(/Solicitud de Servicio Institucional/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Alquiler del Galpón Agrícola/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: /Completar Solicitud/i })).toBeInTheDocument();
    });

    // Avanzar a Paso 2 (Datos de la Solicitud)
    const botonCompletar = screen.getByRole('button', { name: /Completar Solicitud/i });
    await user.click(botonCompletar);

    await waitFor(() => {
      expect(screen.getByText(/Datos del Solicitante/i)).toBeInTheDocument();
      expect(screen.getByText(/Detalle de la Solicitud/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Revisar Resumen/i })).toBeInTheDocument();
    });

    // Retroceder a Paso 1 con el botón Atrás
    const botonAtras = screen.getByRole('button', { name: /Atrás/i });
    await user.click(botonAtras);

    await waitFor(() => {
      expect(screen.getByText(/Requisitos y Condiciones Oficiales/i)).toBeInTheDocument();
    });
  });

  it('informa con claridad que la radicación digital no está habilitada para procedimientos PENDIENTE (NULL)', async () => {
    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Catálogo de Procedimientos y Servicios/i)).toBeInTheDocument();
    });

    // Filtrar para encontrar "Reincorporación" (p5-fila-05, PROCEDIMIENTO_PENDIENTE)
    const inputBusqueda = screen.getByLabelText(/Buscar por denominación o código:/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Reincorporación' } });

    await waitFor(() => {
      expect(screen.getByText(/Derecho de Reincorporación/i)).toBeInTheDocument();
      expect(screen.getByText(/Radicación Digital No Habilitada/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Iniciar Trámite/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Iniciar Trámite con CUT/i })).not.toBeInTheDocument();
    });
  });

  it('proporciona enlace directo a Mesa de Partes para procedimientos con CUT', async () => {
    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Catálogo de Procedimientos y Servicios/i)).toBeInTheDocument();
    });

    // Filtrar para encontrar Certificado Modular
    const inputBusqueda = screen.getByLabelText(/Buscar por denominación o código:/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Modular' } });

    await waitFor(() => {
      const linkCut = screen.getByRole('link', { name: /Iniciar Trámite con CUT/i });
      expect(linkCut).toBeInTheDocument();
      expect(linkCut).toHaveAttribute('href', expect.stringContaining('/mesa-partes?procedimiento='));
    });
  });
});
