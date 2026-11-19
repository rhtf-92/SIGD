import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import HomePage from '@/pages/HomePage';
import { useAuthStore } from '@/stores/authStore';

function montar(initialEntry: string | { pathname: string; state?: unknown } = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<RutaActual />} />
      </Routes>
    </MemoryRouter>
  );
}

function RutaActual() {
  return <p data-testid="ruta-actual">{useLocation().pathname}</p>;
}

describe('HomePage — Portada Institucional y Visibilidad de Módulos por Rol', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  it('Escenario 1: Portada pública muestra exactamente 4 tarjetas de servicios públicos y franja de beneficios', () => {
    montar();

    // Título principal institucional
    const tituloPrincipal = screen.getByRole('heading', { level: 1 });
    expect(tituloPrincipal).toHaveTextContent('Sistema Integral de');
    expect(tituloPrincipal).toHaveTextContent('Gestión Documentaria');

    // Sección de servicios digitales
    expect(screen.getByRole('heading', { name: 'Servicios digitales' })).toBeInTheDocument();

    // Exactamente 4 tarjetas principales
    expect(screen.getByRole('heading', { name: 'Mesa de Partes Virtual' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Casilla Electrónica' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Consulta de Trámite' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Validador CVD' })).toBeInTheDocument();

    // Acciones de las tarjetas
    expect(screen.getByText('Acceder al servicio')).toBeInTheDocument();
    expect(screen.getByText('Ingresar al servicio')).toBeInTheDocument();
    expect(screen.getByText('Consultar trámite')).toBeInTheDocument();
    expect(screen.getByText('Verificar documento')).toBeInTheDocument();

    // Franja de beneficios institucionales
    expect(screen.getByText(/Trámites seguros/i)).toBeInTheDocument();
    expect(screen.getByText(/Atención transparente/i)).toBeInTheDocument();
    expect(screen.getByText(/Servicio con validez legal/i)).toBeInTheDocument();
    expect(screen.getByText(/Al servicio de la/i)).toBeInTheDocument();

    // Módulos privados NUNCA expuestos en portada
    expect(screen.queryByRole('heading', { name: 'Panel de Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bandeja de Expedientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reportes y Tableros de Control' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Firma Digital' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Resoluciones' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Sesión institucional activa/i)).not.toBeInTheDocument();
  });

  it('Escenario 2: Rol CIUDADANO ve casilla, nuevo trámite, consulta y CVD en gestión autorizada', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'token-ciudadano',
      usuario: {
        id: 'usr-ciu',
        nombreCompleto: 'Juan Pérez Ciudadano',
        correo: 'juan.perez@gmail.com',
        rol: 'CIUDADANO',
        roles: ['CIUDADANO'],
      },
    });

    montar();

    // Banner de identidad
    expect(screen.getByText(/Sesión institucional activa/i)).toBeInTheDocument();
    expect(screen.getByText(/Juan Pérez Ciudadano/i)).toBeInTheDocument();
    expect(screen.getByText('CIUDADANO')).toBeInTheDocument();

    // Módulos autorizados al ciudadano
    expect(screen.getByRole('heading', { name: 'Casilla Electrónica' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nuevo Trámite' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Consulta de Trámite' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Validador CVD' })).toBeInTheDocument();

    // Bloqueo de módulos internos de gestión
    expect(screen.queryByRole('heading', { name: 'Panel de Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bandeja de Expedientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reportes y Tableros de Control' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Firma Digital' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Resoluciones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ventanilla Presencial' })).not.toBeInTheDocument();
  });

  it('Escenario 3: ADMINISTRADOR entra al panel centralizado sin cuadrícula duplicada', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'token-admin',
      usuario: {
        id: 'usr-admin',
        nombreCompleto: 'Administrador Demo',
        correo: 'admin@iestp-suiza.edu.pe',
        rol: 'ADMINISTRADOR',
        roles: ['ADMINISTRADOR'],
        permisos: [
          { codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null },
          { codigo: 'REPORTE_LEER', ambito: 'GLOBAL', areaId: null },
        ],
      },
    });

    montar();

    expect(await screen.findByTestId('ruta-actual')).toHaveTextContent('/administracion');
    expect(screen.queryByRole('heading', { name: 'Módulos de Gestión Autorizados' })).not.toBeInTheDocument();
  });

  it('un administrador que vuelve manualmente ve la portada institucional y no es redirigido', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'token-admin',
      usuario: {
        id: 'usr-admin', nombreCompleto: 'Administrador Demo', correo: 'admin@example.test',
        rol: 'ADMINISTRADOR', roles: ['ADMINISTRADOR'],
      },
    });
    montar({ pathname: '/', state: { mostrarPortadaAdministrador: true } });
    expect(screen.getByRole('heading', { name: 'Servicios digitales' })).toBeInTheDocument();
    expect(screen.queryByTestId('ruta-actual')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Panel de Administración' })).not.toBeInTheDocument();
  });

  it('TESORERO ve M10 pero no recibe tarjetas de administración general', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'token-tesorero',
      usuario: {
        id: 'usr-tesorero', nombreCompleto: 'Tesorero Demo', correo: 'tesorero@example.test',
        rol: 'TESORERO', roles: ['TESORERO'],
        permisos: [{ codigo: 'TESORERIA_LEER', ambito: 'GLOBAL', areaId: null }],
      },
    });
    montar();
    expect(screen.getByRole('heading', { name: 'Tesorería' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Panel de Administración' })).not.toBeInTheDocument();
  });

  it('Escenario 4: Rol DIRECTOR ve Firma Digital, Bandeja y Reportes ejecutivos', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'token-director',
      usuario: {
        id: 'usr-dir',
        nombreCompleto: 'Director General',
        correo: 'director@iestp-suiza.edu.pe',
        rol: 'DIRECTOR',
        roles: ['DIRECTOR'],
        permisos: [
          { codigo: 'FIRMA_FIRMAR', ambito: 'GLOBAL', areaId: null },
          { codigo: 'REPORTE_LEER', ambito: 'GLOBAL', areaId: null },
        ],
      },
    });

    montar();

    expect(screen.getByRole('heading', { name: 'Firma Digital' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bandeja de Expedientes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reportes y Tableros de Control' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Validador CVD' })).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Panel de Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ventanilla Presencial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Resoluciones' })).not.toBeInTheDocument();
  });

  it('Escenario 5: Rol SECRETARIO ve Bandeja, Resoluciones y CVD', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'token-sec',
      usuario: {
        id: 'usr-sec',
        nombreCompleto: 'Secretario Académico',
        correo: 'secretario@iestp-suiza.edu.pe',
        rol: 'SECRETARIO',
        roles: ['SECRETARIO'],
      },
    });

    montar();

    expect(screen.getByRole('heading', { name: 'Bandeja de Expedientes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resoluciones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Validador CVD' })).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Panel de Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Firma Digital' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reportes y Tableros de Control' })).not.toBeInTheDocument();
  });

  it('Escenario 6: Rol JEFE_UNIDAD_ACADEMICA ve Bandeja, Resoluciones y CVD con aislamiento', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'token-jua',
      usuario: {
        id: 'usr-jua',
        nombreCompleto: 'Jefe Unidad Académica',
        correo: 'jefe.academica@iestp-suiza.edu.pe',
        rol: 'JEFE_UNIDAD_ACADEMICA',
        roles: ['JEFE_UNIDAD_ACADEMICA'],
      },
    });

    montar();

    expect(screen.getByRole('heading', { name: 'Bandeja de Expedientes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resoluciones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Validador CVD' })).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Panel de Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Firma Digital' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reportes y Tableros de Control' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ventanilla Presencial' })).not.toBeInTheDocument();
  });

  it('la facultad global de administrador también conduce al panel centralizado', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'token-admin-global',
      usuario: {
        id: 'usr-admin-global', nombreCompleto: 'Administrador General', correo: 'admin-global@example.test',
        rol: 'MESA_PARTES', roles: ['MESA_PARTES'],
        permisos: [{ codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null }],
      },
    });
    montar();
    expect(await screen.findByTestId('ruta-actual')).toHaveTextContent('/administracion');
  });

  it('Escenario 7: Rol MESA_PARTES ve Ventanilla Presencial, Bandeja y CVD', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'token-mp',
      usuario: {
        id: 'usr-mp',
        nombreCompleto: 'Operador Mesa de Partes',
        correo: 'mesapartes@iestp-suiza.edu.pe',
        rol: 'MESA_PARTES',
        roles: ['MESA_PARTES'],
      },
    });

    montar();

    expect(screen.getByRole('heading', { name: 'Ventanilla Presencial' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bandeja de Expedientes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Validador CVD' })).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Panel de Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Firma Digital' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reportes y Tableros de Control' })).not.toBeInTheDocument();
  });
});
