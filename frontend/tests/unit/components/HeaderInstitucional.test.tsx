import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HeaderInstitucional from '../../../src/components/HeaderInstitucional';
import { useAuthStore } from '../../../src/stores/authStore';
import { NAV_ITEMS_POR_ROL } from '../../../src/config/navigation.config';

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
    expect(screen.getByText('Trámites')).toBeInTheDocument();
    expect(screen.getByText('Consultar CUT')).toBeInTheDocument();
    expect(screen.getByText('Ayuda')).toBeInTheDocument();
    expect(screen.getByText('Ingresar')).toBeInTheDocument();

    // No debe mostrar accesos directos a módulos privados como Casilla o Administración
    expect(screen.queryByText('Mis Expedientes')).not.toBeInTheDocument();
    expect(screen.queryByText('Bandeja de Expedientes')).not.toBeInTheDocument();
    expect(screen.queryByText('Administración')).not.toBeInTheDocument();
    expect(screen.queryByText('Salir')).not.toBeInTheDocument();
  });

  it('rol CIUDADANO: muestra Nuevo Trámite, Mis Expedientes, Casilla y Consulta CUT', () => {
    useAuthStore.setState({
      accessToken: 'jwt-ciudadano',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-ciudadano',
        nombreCompleto: 'Ciudadano Demo Laboratorio',
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
    expect(screen.getAllByText('Mi cuenta').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Mi cuenta' })[0]).toHaveAttribute('href', '/mi-perfil');
    expect(screen.queryByRole('button', { name: 'Mi perfil' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo Trámite' })).toBeInTheDocument();
    expect(NAV_ITEMS_POR_ROL.CIUDADANO.find((item) => item.etiqueta === 'Nuevo Trámite')?.ruta).toBe('/mesa-partes');
    expect(screen.queryByText('Ciudadano Demo Laboratorio')).not.toBeInTheDocument();
    expect(screen.queryByText('CIUDADANO')).not.toBeInTheDocument();
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

  it('identidad institucional: preserva shrink-0 y whitespace-nowrap evitando colapso de texto', () => {
    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    const titulo = screen.getByText('IESTP SUIZA');
    expect(titulo).toHaveClass('whitespace-nowrap');

    const subtitulo = screen.getByText('Instituto de Educación Superior');
    expect(subtitulo).toHaveClass('whitespace-nowrap');
  });

  it('selector de contexto: no se muestra cuando el usuario tiene un único contexto autorizado', () => {
    useAuthStore.setState({
      accessToken: 'jwt-single-ctx',
      refreshToken: null,
      isAuthenticated: true,
      contextosDisponibles: [
        { tipo: 'PERSONAL', descripcion: 'Trámites personales', rol: 'CIUDADANO' },
      ],
      usuario: {
        id: 'u-ciudadano',
        nombreCompleto: 'Juan Pérez',
        correo: 'juan@test.pe',
        rol: 'CIUDADANO',
      },
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.queryByRole('group', { name: /Selector de contexto operativo/i })).not.toBeInTheDocument();
  });

  it('cabecera autenticada limpia: no muestra switch de contexto y presenta usuario y rol de forma estable', () => {
    useAuthStore.setState({
      accessToken: 'jwt-multi-ctx',
      refreshToken: null,
      isAuthenticated: true,
      contextoActivo: 'INSTITUCIONAL',
      contextosDisponibles: [
        { tipo: 'PERSONAL', descripcion: 'Trámites personales', rol: 'CIUDADANO' },
        { tipo: 'INSTITUCIONAL', descripcion: 'Bandeja institucional', rol: 'MESA_PARTES' },
      ],
      usuario: {
        id: 'u-operador',
        nombreCompleto: 'Operador Dual',
        correo: 'operador@test.pe',
        rol: 'MESA_PARTES',
      },
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    // El switch ruidoso fue eliminado para garantizar estabilidad visual
    expect(screen.queryByRole('group', { name: /Selector de contexto operativo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Personal' })).not.toBeInTheDocument();
    // Muestra al usuario y su rol de manera sobria y limpia
    expect(screen.getByText('Operador Dual')).toBeInTheDocument();
    expect(screen.getByText('MESA_PARTES')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
  });

  it('navegación autenticada: despliega el menú Más con las opciones secundarias', async () => {
    const userEventModule = await import('@testing-library/user-event');
    const user = userEventModule.default.setup();

    useAuthStore.setState({
      accessToken: 'jwt-ciudadano-more',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-ciudadano',
        nombreCompleto: 'Ciudadano Demo',
        correo: 'demo@test.pe',
        rol: 'CIUDADANO',
      },
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    const botonMas = screen.getByTitle('Más opciones de trámite');
    expect(botonMas).toBeInTheDocument();
    expect(botonMas).toHaveAttribute('aria-expanded', 'false');

    await user.click(botonMas);
    expect(botonMas).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Trámites adicionales')).toBeInTheDocument();

    // Cierre al presionar Escape
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('usuario con múltiples contextos: menú Mi cuenta permite alternar modo de operación', async () => {
    const userEventModule = await import('@testing-library/user-event');
    const user = userEventModule.default.setup();

    const cambiarContextoMock = vi.fn().mockResolvedValue(undefined);

    useAuthStore.setState({
      accessToken: 'jwt-multi-ctx',
      refreshToken: null,
      isAuthenticated: true,
      contextoActivo: 'INSTITUCIONAL',
      contextosDisponibles: [
        { tipo: 'PERSONAL', descripcion: 'Trámites personales', rol: 'CIUDADANO' },
        { tipo: 'INSTITUCIONAL', descripcion: 'Bandeja institucional', rol: 'MESA_PARTES' },
      ],
      cambiarContexto: cambiarContextoMock,
      usuario: {
        id: 'u-operador',
        nombreCompleto: 'Operador Dual',
        correo: 'operador@test.pe',
        rol: 'MESA_PARTES',
      },
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    const triggerMenu = screen.getByLabelText('Menú de cuenta y modo de operación');
    expect(triggerMenu).toBeInTheDocument();
    expect(triggerMenu).toHaveAttribute('aria-expanded', 'false');

    // Abre el menú de usuario
    await user.click(triggerMenu);
    expect(triggerMenu).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Modo de operación')).toBeInTheDocument();

    // Las opciones de contexto están disponibles dentro del menú
    const botonPersonal = screen.getByRole('menuitem', { name: /Personal/i });
    expect(botonPersonal).toBeInTheDocument();

    // Al hacer clic en Personal, se invoca cambiarContexto('PERSONAL')
    await user.click(botonPersonal);
    expect(cambiarContextoMock).toHaveBeenCalledWith('PERSONAL');
  });

  it('usuario en contexto PERSONAL con múltiples contextos: preserva nombre real, no muestra "Mi cuenta" en el botón principal y exhibe "Mis trámites personales"', async () => {
    const userEventModule = await import('@testing-library/user-event');
    const user = userEventModule.default.setup();

    useAuthStore.setState({
      accessToken: 'jwt-personal-switch',
      refreshToken: null,
      isAuthenticated: true,
      contextoActivo: 'PERSONAL',
      contextosDisponibles: [
        { tipo: 'INSTITUCIONAL', descripcion: 'Gestión institucional', rol: 'DIRECTOR' },
        { tipo: 'PERSONAL', descripcion: 'Trámites personales', rol: 'CIUDADANO' },
      ],
      usuario: {
        id: 'u-director',
        nombreCompleto: 'Dr. Roberto Director',
        correo: 'director@test.pe',
        rol: 'CIUDADANO',
        contexto: 'PERSONAL',
      },
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    // En el botón principal debe mostrar el nombre real del usuario, no "Mi cuenta"
    expect(screen.getByText('Dr. Roberto Director')).toBeInTheDocument();
    // Subtexto debe ser exactamente "Mis trámites personales"
    expect(screen.getByText('Mis trámites personales')).toBeInTheDocument();
    // No debe mostrar rol institucional ni área cuando el contexto es PERSONAL
    expect(screen.queryByText('DIRECTOR')).not.toBeInTheDocument();

    // Al desplegar el menú, deben figurar las etiquetas exactas
    const triggerMenu = screen.getByLabelText('Menú de cuenta y modo de operación');
    await user.click(triggerMenu);

    expect(screen.getByText('Funciones de mi cargo')).toBeInTheDocument();
    expect(screen.getAllByText('Mis trámites personales').length).toBeGreaterThanOrEqual(1);
  });

  it('usuario con un solo contexto: no muestra selector de modo de operación en ningún estado', () => {
    useAuthStore.setState({
      accessToken: 'jwt-single-ctx',
      refreshToken: null,
      isAuthenticated: true,
      contextoActivo: 'PERSONAL',
      contextosDisponibles: [
        { tipo: 'PERSONAL', descripcion: 'Trámites personales', rol: 'CIUDADANO' },
      ],
      usuario: {
        id: 'u-ciudadano',
        nombreCompleto: 'Ciudadano Solo',
        correo: 'ciudadano@test.pe',
        rol: 'CIUDADANO',
      },
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText('Menú de cuenta y modo de operación')).not.toBeInTheDocument();
    expect(screen.queryByText('Modo de operación')).not.toBeInTheDocument();
  });
});
