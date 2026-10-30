import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CatalogoTupaPage from '../../../src/pages/tramite/CatalogoTupaPage';
import { useAuthStore } from '../../../src/stores/authStore';

describe('CatalogoTupaPage — Catálogo TUPA Protegido y Formulario Dinámico', () => {
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

  it('muestra pantalla de restricción con enlace a solicitud cuando no hay usuario autenticado', async () => {
    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Acceso Denegado \/ Solicitud Requerida/i)).toBeInTheDocument();
      expect(screen.getByText(/El Catálogo Integral TUPA 2026 no es público y requiere una solicitud de acceso/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Solicitar Acceso al TUPA/i })).toHaveAttribute('href', '/solicitud-acceso-tupa');
    });

    // No debe mostrar la tabla de las 72 entradas
    expect(screen.queryByText(/Catálogo Integral TUPA 2026 — IESTP "Suiza"/i)).not.toBeInTheDocument();
  });

  it('muestra pantalla de restricción para ciudadano sin solicitud aprobada', async () => {
    useAuthStore.setState({
      accessToken: 'token-no-aprobado',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-ciudadano',
        nombreCompleto: 'Ciudadano Pendiente',
        correo: 'ciudadano@test.com',
        rol: 'CIUDADANO',
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        autenticado: true,
        autorizado: false,
        estado: 'PENDIENTE',
      }),
    });

    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Acceso Denegado \/ Solicitud Requerida/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Solicitar Acceso al TUPA/i })).toHaveAttribute('href', '/solicitud-acceso-tupa');
    });
  });

  it('permite acceso directo con las 72 entradas para rol institucional sin requerir solicitud', async () => {
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

    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Catálogo Integral TUPA 2026 — IESTP "Suiza"/i)).toBeInTheDocument();
      expect(screen.getByText(/Acceso Autorizado \(72 Entradas Completas\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Rol: MESA_PARTES/i)).toBeInTheDocument();
    });

    // Muestra tanto procedimientos académicos como bienes comerciales
    expect(screen.getByText(/Certificado Modular \(I, II, III y IV\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Alquiler del Galpón Agrícola/i)).toBeInTheDocument();
    expect(screen.getByText(/Venta de Mangos/i)).toBeInTheDocument();
  });

  it('permite a un ciudadano autorizado filtrar por texto y por categoría', async () => {
    const user = userEvent.setup();

    useAuthStore.setState({
      accessToken: 'token-aprobado',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-ciudadano',
        nombreCompleto: 'Ciudadana Aprobada',
        correo: 'aprobada@test.com',
        rol: 'CIUDADANO',
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        autenticado: true,
        autorizado: true,
        estado: 'APROBADA',
      }),
    });

    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Catálogo Integral TUPA 2026 — IESTP "Suiza"/i)).toBeInTheDocument();
    });

    // Filtro por texto usando label
    const inputBusqueda = screen.getByLabelText(/Buscar por denominación o código:/i);
    await user.type(inputBusqueda, 'Inglés');

    await waitFor(() => {
      expect(screen.getByText('Certificado de Inglés')).toBeInTheDocument();
      expect(screen.queryByText(/Alquiler del Galpón Agrícola/i)).not.toBeInTheDocument();
    });

    // Limpiar filtro
    await user.clear(inputBusqueda);

    // Filtro por categoría BIEN_PRODUCTIVO
    const selectCategoria = screen.getByLabelText(/Filtrar por Categoría:/i);
    await user.selectOptions(selectCategoria, 'BIEN_PRODUCTIVO');

    await waitFor(() => {
      expect(screen.getByText(/Venta de Mangos/i)).toBeInTheDocument();
      expect(screen.queryByText(/Certificado de Inglés/i)).not.toBeInTheDocument();
    });
  });

  it('abre el modal dinámico con el procedimiento seleccionado al pulsar Iniciar trámite', async () => {
    const user = userEvent.setup();

    useAuthStore.setState({
      accessToken: 'token-admin',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-admin',
        nombreCompleto: 'Admin',
        correo: 'admin@suiza.edu.pe',
        rol: 'ADMINISTRADOR',
      },
    });

    render(
      <MemoryRouter>
        <CatalogoTupaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Catálogo Integral TUPA 2026 — IESTP "Suiza"/i)).toBeInTheDocument();
    });

    // Filtrar para encontrar el Galpón
    const inputBusqueda = screen.getByLabelText(/Buscar por denominación o código:/i);
    await user.type(inputBusqueda, 'Galpón');

    await waitFor(() => {
      const botones = screen.getAllByRole('button', { name: /Iniciar Trámite/i });
      expect(botones.length).toBe(1);
    }, { timeout: 4000 });

    const botonIniciar = screen.getByRole('button', { name: /Iniciar Trámite/i });
    await user.click(botonIniciar);

    // Modal debe abrirse
    await waitFor(() => {
      expect(screen.getByText(/Motor de Formularios Dinámicos TUPA 2026/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Alquiler del Galpón Agrícola/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});
