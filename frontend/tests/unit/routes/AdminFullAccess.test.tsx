import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../../../src/routes/ProtectedRoute';
import { useAuthStore } from '../../../src/stores/authStore';
import {
  canAccessRoute,
  ROLES_VENTANILLA,
  ROLES_INSTITUCIONALES,
  ROLES_REPORTES,
  ROLES_ADMIN,
  NAV_ITEMS_POR_ROL,
} from '../../../src/config/navigation.config';

describe('RBAC — Acceso Institucional Completo de ADMINISTRADOR y Restricciones a CIUDADANO', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
    localStorage.clear();
  });

  afterEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
    localStorage.clear();
  });

  describe('1. Matriz de Navegación canAccessRoute', () => {
    it('ADMINISTRADOR tiene acceso a todas las rutas institucionales', () => {
      expect(canAccessRoute('ADMINISTRADOR', '/administracion')).toBe(true);
      expect(canAccessRoute('ADMINISTRADOR', '/administracion/usuarios')).toBe(true);
      expect(canAccessRoute('ADMINISTRADOR', '/administracion/tupa')).toBe(true);
      expect(canAccessRoute('ADMINISTRADOR', '/administracion/calendario-laboral')).toBe(true);
      expect(canAccessRoute('ADMINISTRADOR', '/expedientes')).toBe(true);
      expect(canAccessRoute('ADMINISTRADOR', '/tramite/ventanilla-presencial')).toBe(true);
      expect(canAccessRoute('ADMINISTRADOR', '/reportes/dashboard')).toBe(true);
      expect(canAccessRoute('ADMINISTRADOR', '/tupa')).toBe(true);
      expect(canAccessRoute('ADMINISTRADOR', '/')).toBe(true);
    });

    it('CIUDADANO no hereda permisos de rutas institucionales', () => {
      expect(canAccessRoute('CIUDADANO', '/administracion')).toBe(false);
      expect(canAccessRoute('CIUDADANO', '/administracion/usuarios')).toBe(false);
      expect(canAccessRoute('CIUDADANO', '/administracion/tupa')).toBe(false);
      expect(canAccessRoute('CIUDADANO', '/expedientes')).toBe(false);
      expect(canAccessRoute('CIUDADANO', '/tramite/ventanilla-presencial')).toBe(false);
      expect(canAccessRoute('CIUDADANO', '/reportes/dashboard')).toBe(false);
    });

    it('Todos los roles autenticados tienen la opción "Inicio" (/) en su menú', () => {
      const roles = ['CIUDADANO', 'MESA_PARTES', 'ESPECIALISTA', 'SECRETARIO', 'DIRECTOR', 'ADMINISTRADOR'] as const;
      for (const rol of roles) {
        const navItems = NAV_ITEMS_POR_ROL[rol];
        expect(navItems.some((item) => item.etiqueta === 'Inicio' && item.ruta === '/')).toBe(true);
      }
    });
  });

  describe('2. Guardas de ruta ProtectedRoute en la interfaz', () => {
    const rutasInstitucionales = [
      { path: '/tramite/ventanilla-presencial', roles: ROLES_VENTANILLA, label: 'Ventanilla' },
      { path: '/expedientes', roles: ROLES_INSTITUCIONALES, label: 'Bandeja' },
      { path: '/reportes/dashboard', roles: ROLES_REPORTES, label: 'Reportes' },
      { path: '/administracion', roles: ROLES_ADMIN, label: 'Admin' },
    ];

    for (const ruta of rutasInstitucionales) {
      it(`ADMINISTRADOR accede exitosamente a ${ruta.path}`, () => {
        useAuthStore.setState({
          accessToken: 'token-admin-jwt',
          refreshToken: null,
          isAuthenticated: true,
          usuario: {
            id: 'admin-uuid',
            nombreCompleto: 'Administrador General',
            correo: 'admin@iestpsuiza.edu.pe',
            rol: 'ADMINISTRADOR',
          },
        });

        render(
          <MemoryRouter initialEntries={[ruta.path]}>
            <Routes>
              <Route
                path={ruta.path}
                element={
                  <ProtectedRoute requiredRoles={ruta.roles}>
                    <p>{ruta.label} Habilitada</p>
                  </ProtectedRoute>
                }
              />
              <Route path="/acceso-denegado" element={<p>Acceso denegado</p>} />
              <Route path="/login" element={<p>Login</p>} />
            </Routes>
          </MemoryRouter>
        );

        expect(screen.getByText(`${ruta.label} Habilitada`)).toBeInTheDocument();
        expect(screen.queryByText('Acceso denegado')).not.toBeInTheDocument();
      });

      it(`CIUDADANO es bloqueado con /acceso-denegado en ${ruta.path}`, () => {
        useAuthStore.setState({
          accessToken: 'token-ciudadano-jwt',
          refreshToken: null,
          isAuthenticated: true,
          usuario: {
            id: 'ciudadano-uuid',
            nombreCompleto: 'Ciudadano Común',
            correo: 'ciudadano@test.pe',
            rol: 'CIUDADANO',
          },
        });

        render(
          <MemoryRouter initialEntries={[ruta.path]}>
            <Routes>
              <Route
                path={ruta.path}
                element={
                  <ProtectedRoute requiredRoles={ruta.roles}>
                    <p>{ruta.label} Habilitada</p>
                  </ProtectedRoute>
                }
              />
              <Route path="/acceso-denegado" element={<p>Acceso denegado</p>} />
              <Route path="/login" element={<p>Login</p>} />
            </Routes>
          </MemoryRouter>
        );

        expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
        expect(screen.queryByText(`${ruta.label} Habilitada`)).not.toBeInTheDocument();
      });
    }
  });

  describe('3. Aislamiento Estricto de Datos Personales Ciudadanos', () => {
    const rutasPersonalesCiudadano = [
      '/mis-expedientes',
      '/mis-expedientes/EXP-2026-0001',
      '/casilla',
      '/casilla/mensajes',
      '/casilla-electronica',
    ];

    for (const ruta of rutasPersonalesCiudadano) {
      it(`ADMINISTRADOR no puede acceder a vista personal ${ruta} (canAccessRoute false)`, () => {
        expect(canAccessRoute('ADMINISTRADOR', ruta)).toBe(false);
      });

      it(`CIUDADANO sí puede acceder a su vista personal ${ruta}`, () => {
        expect(canAccessRoute('CIUDADANO', ruta)).toBe(true);
      });
    }

    it('ADMINISTRADOR es bloqueado con /acceso-denegado al intentar navegar a /mis-expedientes mediante ProtectedRoute', () => {
      useAuthStore.setState({
        accessToken: 'token-admin-jwt',
        refreshToken: null,
        isAuthenticated: true,
        usuario: {
          id: 'admin-uuid',
          nombreCompleto: 'Administrador General',
          correo: 'admin@iestpsuiza.edu.pe',
          rol: 'ADMINISTRADOR',
        },
      });

      render(
        <MemoryRouter initialEntries={['/mis-expedientes']}>
          <Routes>
            <Route
              path="/mis-expedientes"
              element={
                <ProtectedRoute requiredRoles={['CIUDADANO']}>
                  <p>Bandeja Personal de Ciudadano</p>
                </ProtectedRoute>
              }
            />
            <Route path="/acceso-denegado" element={<p>Acceso denegado</p>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
      expect(screen.queryByText('Bandeja Personal de Ciudadano')).not.toBeInTheDocument();
    });

    it('ADMINISTRADOR es bloqueado con /acceso-denegado al intentar navegar a /casilla mediante ProtectedRoute', () => {
      useAuthStore.setState({
        accessToken: 'token-admin-jwt',
        refreshToken: null,
        isAuthenticated: true,
        usuario: {
          id: 'admin-uuid',
          nombreCompleto: 'Administrador General',
          correo: 'admin@iestpsuiza.edu.pe',
          rol: 'ADMINISTRADOR',
        },
      });

      render(
        <MemoryRouter initialEntries={['/casilla']}>
          <Routes>
            <Route
              path="/casilla"
              element={
                <ProtectedRoute requiredRoles={['CIUDADANO']}>
                  <p>Casilla Personal de Ciudadano</p>
                </ProtectedRoute>
              }
            />
            <Route path="/acceso-denegado" element={<p>Acceso denegado</p>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
      expect(screen.queryByText('Casilla Personal de Ciudadano')).not.toBeInTheDocument();
    });
  });
});
