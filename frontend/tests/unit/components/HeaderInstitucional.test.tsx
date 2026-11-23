import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HeaderInstitucional from '@/components/HeaderInstitucional';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';

const originalLogout = useAuthStore.getState().logout;
const logout = vi.fn();
function montar() { return render(<MemoryRouter><HeaderInstitucional /></MemoryRouter>); }
beforeEach(() => {
  localStorage.clear(); logout.mockReset();
  useAuthStore.setState({ accessToken: 'acceso-del-doble', refreshToken: 'refresh-del-doble', isAuthenticated: true, logout });
});
afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ accessToken: null, refreshToken: null, isAuthenticated: false, logout: originalLogout });
  localStorage.clear();
});

describe('Cierre explícito desde la cabecera institucional (transporte controlado)', () => {
  it('invoca el endpoint original una sola vez y espera su confirmación antes de limpiar la sesión', async () => {
    let confirmar!: (value: unknown) => void;
    const post = vi.spyOn(apiClient, 'post').mockReturnValue(new Promise(resolve => { confirmar = resolve; }));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(screen.getByRole('button', { name: 'Cerrando sesión…' })).toBeDisabled();
    await act(async () => { void useAuthStore.getState().cerrarSesion(); });
    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith('/api/v1/auth/logout', { refreshToken: 'refresh-del-doble' });
    expect(logout).not.toHaveBeenCalled();
    await act(async () => { confirmar({ status: 200, data: { ok: true } }); });
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
  });
  it('limpia la sesión localmente y redirige de forma limpia aunque el servidor falle', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Servicio no disponible'));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('limpia la sesión de forma limpia ante una respuesta no exitosa o incompleta del servidor', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({ status: 200, data: {} });
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('la visita pública no presenta una sesión iniciada', () => {
    useAuthStore.setState({ isAuthenticated: false }); montar();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });
  it('el cierre local elimina los Bearer de ambos almacenamientos compatibles sin borrar otros datos', () => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.setItem('sigd_token', 'acceso-del-doble'); storage.setItem('token', 'acceso-del-doble');
    }
    sessionStorage.setItem('dato-ajeno-al-login', 'conservar');
    const actualWindow = window;
    vi.stubGlobal('window', { localStorage, sessionStorage, location: { href: '' } });
    try { originalLogout(); }
    finally { vi.stubGlobal('window', actualWindow); }
    for (const storage of [localStorage, sessionStorage]) {
      expect(storage.getItem('sigd_token')).toBeNull(); expect(storage.getItem('token')).toBeNull();
    }
    expect(sessionStorage.getItem('dato-ajeno-al-login')).toBe('conservar');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('Visibilidad de módulos por rol institucional en HeaderInstitucional', () => {
  it('visita pública no autenticada ve portales públicos y botón de inicio de sesión', () => {
    useAuthStore.setState({ isAuthenticated: false, accessToken: null, refreshToken: null, usuario: null });
    montar();
    expect(screen.getByRole('button', { name: 'Casilla Electrónica' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mesa de Partes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consulta de Trámite' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bandeja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reportes' })).not.toBeInTheDocument();
  });

  it('rol CIUDADANO ve casilla, nuevo trámite y consulta, sin módulos internos de gestión', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      usuario: { id: 'usr-1', nombreCompleto: 'Ciudadano Demo', correo: 'ciu@demo.pe', rol: 'CIUDADANO', roles: ['CIUDADANO'] },
    });
    montar();
    expect(screen.getByRole('button', { name: 'Casilla Electrónica' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo Trámite' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consulta de Trámite' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bandeja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reportes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ventanilla Presencial' })).not.toBeInTheDocument();
  });

  it('rol MESA_PARTES ve Ventanilla Presencial y Bandeja operativa', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      usuario: { id: 'usr-2', nombreCompleto: 'Operador Ventanilla', correo: 'mp@demo.pe', rol: 'MESA_PARTES', roles: ['MESA_PARTES'] },
    });
    montar();
    expect(screen.getByRole('button', { name: 'Ventanilla Presencial' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bandeja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Firma Digital' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reportes' })).not.toBeInTheDocument();
  });

  it('rol DIRECTOR ve Firma Digital, Bandeja y Reportes ejecutivos', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      usuario: {
        id: 'usr-3', nombreCompleto: 'Director General', correo: 'dg@demo.pe', rol: 'DIRECTOR', roles: ['DIRECTOR'],
        permisos: [{ codigo: 'FIRMA_FIRMAR', ambito: 'GLOBAL', areaId: null }, { codigo: 'REPORTE_LEER', ambito: 'GLOBAL', areaId: null }],
      },
    });
    montar();
    expect(screen.getByRole('button', { name: 'Firma Digital' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bandeja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ventanilla Presencial' })).not.toBeInTheDocument();
  });

  it('rol ADMINISTRADOR ve Bandeja, Reportes y Administración institucional', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      usuario: {
        id: 'usr-4', nombreCompleto: 'Administrador Sistema', correo: 'admin@demo.pe', rol: 'ADMINISTRADOR', roles: ['ADMINISTRADOR'],
        permisos: [{ codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null }, { codigo: 'REPORTE_LEER', ambito: 'GLOBAL', areaId: null }],
      },
    });
    montar();
    expect(screen.getByRole('button', { name: 'Bandeja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Administración' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ventanilla Presencial' })).not.toBeInTheDocument();
  });

  it('rol SECRETARIO ve Resoluciones y Bandeja', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      usuario: { id: 'usr-5', nombreCompleto: 'Secretario Académico', correo: 'sec@demo.pe', rol: 'SECRETARIO', roles: ['SECRETARIO'] },
    });
    montar();
    expect(screen.getByRole('button', { name: 'Resoluciones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bandeja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Firma Digital' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reportes' })).not.toBeInTheDocument();
  });

  it('rol JEFE_UNIDAD_ACADEMICA ve Resoluciones y Bandeja, pero no Administración, Firma, Ventanilla ni Reportes', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      usuario: { id: 'usr-jua', nombreCompleto: 'Jefe Unidad Académica', correo: 'jefe.acad@demo.pe', rol: 'JEFE_UNIDAD_ACADEMICA', roles: ['JEFE_UNIDAD_ACADEMICA'] },
    });
    montar();
    expect(screen.getByRole('button', { name: 'Resoluciones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bandeja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Firma Digital' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reportes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ventanilla Presencial' })).not.toBeInTheDocument();
  });

  it('rol TESORERO ve Tesorería y no ve Bandeja general de expedientes', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      usuario: { id: 'usr-tes', nombreCompleto: 'Tesorero Institucional', correo: 'tesorero@demo.pe', rol: 'TESORERO', roles: ['TESORERO'] },
    });
    montar();
    expect(screen.getByRole('button', { name: 'Tesorería' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bandeja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resoluciones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
  });

  it('rol ESPECIALISTA (descontinuado) no ve módulos operativos de gestión (Bandeja, Resoluciones)', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      usuario: { id: 'usr-esp', nombreCompleto: 'Especialista Técnico', correo: 'esp@demo.pe', rol: 'ESPECIALISTA', roles: ['ESPECIALISTA'] },
    });
    montar();
    expect(screen.queryByRole('button', { name: 'Resoluciones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bandeja' })).not.toBeInTheDocument();
  });
});
