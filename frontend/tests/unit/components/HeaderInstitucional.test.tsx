import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HeaderInstitucional from '../../../src/components/HeaderInstitucional';
import { useAuthStore } from '../../../src/stores/authStore';

afterEach(() => {
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    usuario: null,
    isAuthenticated: false,
  });
  localStorage.clear();
});

describe('HeaderInstitucional — Segmentación Modular y Menús por Rol', () => {
  it('usuario anónimo: muestra únicamente navegación pública y botón de inicio de sesión', () => {
    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Consulta CUT')).toBeInTheDocument();
    expect(screen.getByText('Validador CVD')).toBeInTheDocument();
    expect(screen.getByText('Flujo Validez Legal')).toBeInTheDocument();
    expect(screen.getByText('Registro')).toBeInTheDocument();
    expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();

    // No debe mostrar accesos directos a módulos privados como Casilla o Administración
    expect(screen.queryByText('Mis Expedientes')).not.toBeInTheDocument();
    expect(screen.queryByText('Bandeja de Expedientes')).not.toBeInTheDocument();
    expect(screen.queryByText('Salir')).not.toBeInTheDocument();
  });

  it('rol CIUDADANO: muestra Nuevo Trámite, Mis Expedientes, Casilla y Consulta CUT', () => {
    useAuthStore.setState({
      accessToken: 'jwt-ciudadano',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-ciudadano',
        nombreCompleto: 'Juan Pérez Ciudadano',
        correo: 'juan.perez@example.test',
        rol: 'CIUDADANO',
      },
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.getByText('Nuevo Trámite')).toBeInTheDocument();
    expect(screen.getByText('Mis Expedientes')).toBeInTheDocument();
    expect(screen.getByText('Casilla Electrónica')).toBeInTheDocument();
    expect(screen.getByText('Consulta CUT')).toBeInTheDocument();

    // No debe mostrar módulos institucionales
    expect(screen.queryByText('Bandeja de Expedientes')).not.toBeInTheDocument();
    expect(screen.queryByText('Administración')).not.toBeInTheDocument();

    // Perfil y badge
    expect(screen.getByText('Juan Pérez Ciudadano')).toBeInTheDocument();
    expect(screen.getByText('CIUDADANO')).toBeInTheDocument();
    expect(screen.getByText('Salir')).toBeInTheDocument();
  });

  it('rol MESA_PARTES: muestra Ventanilla Presencial, Bandeja de Expedientes y Consulta CUT', () => {
    useAuthStore.setState({
      accessToken: 'jwt-mp',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-mp',
        nombreCompleto: 'Operador Mesa Partes',
        correo: 'operador@example.test',
        rol: 'MESA_PARTES',
      },
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.getByText('Ventanilla Presencial')).toBeInTheDocument();
    expect(screen.getByText('Bandeja de Expedientes')).toBeInTheDocument();
    expect(screen.getByText('Consulta CUT')).toBeInTheDocument();
    expect(screen.queryByText('Nuevo Trámite')).not.toBeInTheDocument();
    expect(screen.queryByText('Mis Expedientes')).not.toBeInTheDocument();
    expect(screen.getByText('MESA_PARTES')).toBeInTheDocument();
  });

  it('rol ESPECIALISTA: muestra Bandeja de Expedientes y Consulta CUT', () => {
    useAuthStore.setState({
      accessToken: 'jwt-esp',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-esp',
        nombreCompleto: 'Especialista Legal',
        correo: 'esp@example.test',
        rol: 'ESPECIALISTA',
      },
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.getByText('Bandeja de Expedientes')).toBeInTheDocument();
    expect(screen.getByText('Consulta CUT')).toBeInTheDocument();
    expect(screen.queryByText('Nuevo Trámite')).not.toBeInTheDocument();
    expect(screen.queryByText('Administración')).not.toBeInTheDocument();
    expect(screen.getByText('ESPECIALISTA')).toBeInTheDocument();
  });

  it('rol SECRETARIO: muestra Bandeja de Expedientes y Consulta CUT', () => {
    useAuthStore.setState({
      accessToken: 'jwt-sec',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-sec',
        nombreCompleto: 'Secretario Académico',
        correo: 'sec@example.test',
        rol: 'SECRETARIO',
      },
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.getByText('Bandeja de Expedientes')).toBeInTheDocument();
    expect(screen.getByText('Consulta CUT')).toBeInTheDocument();
    expect(screen.getByText('SECRETARIO')).toBeInTheDocument();
  });

  it('rol DIRECTOR: muestra Reportes y Tableros, Bandeja de Expedientes y Validador CVD', () => {
    useAuthStore.setState({
      accessToken: 'jwt-dir',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-dir',
        nombreCompleto: 'Director General',
        correo: 'director@example.test',
        rol: 'DIRECTOR',
      },
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.getByText('Reportes y Tableros')).toBeInTheDocument();
    expect(screen.getByText('Bandeja de Expedientes')).toBeInTheDocument();
    expect(screen.getByText('Validador CVD')).toBeInTheDocument();
    expect(screen.queryByText('Administración')).not.toBeInTheDocument();
    expect(screen.getByText('DIRECTOR')).toBeInTheDocument();
  });

  it('rol ADMINISTRADOR: muestra Administración, Bandeja, Ventanilla, Reportes y Calendario', () => {
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

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.getByText('Administración')).toBeInTheDocument();
    expect(screen.getByText('Bandeja de Expedientes')).toBeInTheDocument();
    expect(screen.getByText('Ventanilla Presencial')).toBeInTheDocument();
    expect(screen.getByText('Reportes')).toBeInTheDocument();
    expect(screen.getByText('Calendario Laboral')).toBeInTheDocument();
    expect(screen.getByText('ADMINISTRADOR')).toBeInTheDocument();
  });

  it('mobile: permite desplegar y colapsar el menú hamburguesa accesible', async () => {
    const userEventModule = await import('@testing-library/user-event');
    const user = userEventModule.default.setup();

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    const botonHamburguesa = screen.getByLabelText(/Abrir menú/i);
    expect(botonHamburguesa).toBeInTheDocument();
    expect(botonHamburguesa).toHaveAttribute('aria-expanded', 'false');

    // Al abrir el menú móvil
    await user.click(botonHamburguesa);
    expect(screen.getByLabelText(/Cerrar menú/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Menú móvil/i)).toBeInTheDocument();

    // Al cerrar el menú móvil
    await user.click(screen.getByLabelText(/Cerrar menú/i));
    expect(screen.queryByLabelText(/Menú móvil/i)).not.toBeInTheDocument();
  });
});
