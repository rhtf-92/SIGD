import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import HomePage from '@/pages/HomePage';
import { useAuthStore } from '@/stores/authStore';

function montar() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <HomePage />
    </MemoryRouter>
  );
}

describe('HomePage — 9 Módulos Institucionales y Navegación de F_ANLLELY', () => {
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

  it('muestra la cabecera institucional y el título del SIGD', () => {
    montar();

    expect(screen.getByText(/IESTP "Suiza" — Pucallpa/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'SIGD' })).toBeInTheDocument();
    expect(screen.getByText(/Sistema Integral de Gestión Documentaria/i)).toBeInTheDocument();
  });

  it('muestra los 9 módulos oficiales sin ocultar ninguno por filtro de rol', () => {
    montar();

    const titulosModulos = [
      'Flujo y Validez Legal',
      'Casilla Electrónica',
      'Mesa de Partes Virtual',
      'Registro Ciudadano',
      'Bandeja de Expedientes',
      'Validador CVD',
      'Panel de Administración',
      'Iniciar Sesión',
      'Reportes y Tableros de Control',
    ];

    for (const titulo of titulosModulos) {
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument();
    }
  });

  it('enlaza cada módulo a su ruta correspondiente', () => {
    montar();

    expect(screen.getByRole('link', { name: /Flujo y Validez Legal/i })).toHaveAttribute('href', '/flujo-validez-legal');
    expect(screen.getByRole('link', { name: /Casilla Electrónica/i })).toHaveAttribute('href', '/casilla');
    expect(screen.getByRole('link', { name: /Mesa de Partes Virtual/i })).toHaveAttribute('href', '/tramite');
    expect(screen.getByRole('link', { name: /Registro Ciudadano/i })).toHaveAttribute('href', '/registro');
    expect(screen.getByRole('link', { name: /Bandeja de Expedientes/i })).toHaveAttribute('href', '/expedientes');
    expect(screen.getByRole('link', { name: /Validador CVD/i })).toHaveAttribute('href', '/validador-cvd');
    expect(screen.getByRole('link', { name: /Panel de Administración/i })).toHaveAttribute('href', '/administracion');
    expect(screen.getByRole('link', { name: /Iniciar Sesión/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /Reportes y Tableros de Control/i })).toHaveAttribute('href', '/reportes/dashboard');
  });

  it('conserva la visibilidad de los 9 módulos cuando el usuario tiene rol ADMINISTRADOR', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      usuario: {
        id: 'admin-1',
        nombreCompleto: 'Admin General',
        correo: 'admin@iestpsuiza.edu.pe',
        rol: 'ADMINISTRADOR',
        roles: ['ADMINISTRADOR'],
      },
    });

    montar();

    expect(screen.getByRole('heading', { name: 'Panel de Administración' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mesa de Partes Virtual' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bandeja de Expedientes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Flujo y Validez Legal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reportes y Tableros de Control' })).toBeInTheDocument();
  });

  it('conserva la visibilidad de los 9 módulos cuando el usuario tiene rol CIUDADANO o DOCENTE', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      usuario: {
        id: 'docente-1',
        nombreCompleto: 'Profesor Suiza',
        correo: 'docente@iestpsuiza.edu.pe',
        rol: 'DOCENTE',
        roles: ['DOCENTE'],
      },
    });

    montar();

    expect(screen.getByRole('heading', { name: 'Mesa de Partes Virtual' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Casilla Electrónica' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bandeja de Expedientes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Panel de Administración' })).toBeInTheDocument();
  });
});
