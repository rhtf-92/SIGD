import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../../../src/routes/ProtectedRoute';
import { useAuthStore } from '../../../src/stores/authStore';

function montar() {
  render(<MemoryRouter initialEntries={['/administracion']}><Routes>
    <Route path="/administracion" element={<ProtectedRoute requiredRoles={['ADMINISTRADOR']}><p>Administración real</p></ProtectedRoute>} />
    <Route path="/login" element={<p>Iniciar sesión</p>} />
    <Route path="/acceso-denegado" element={<p>Acceso denegado</p>} />
  </Routes></MemoryRouter>);
}

afterEach(() => {
  useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
  localStorage.clear();
});

describe('ruta administrativa', () => {
  it('ignora permisos falsos guardados localmente y pide sesión', () => {
    localStorage.setItem('sigd_permisos', JSON.stringify({ administrar: true }));
    montar();
    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
  });

  it('rechaza al ciudadano autenticado', () => {
    useAuthStore.setState({ accessToken: 'jwt', refreshToken: null, isAuthenticated: true,
      usuario: { id: 'u1', nombreCompleto: 'Ciudadano', correo: 'c@example.test', rol: 'CIUDADANO' } });
    montar();
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
  });

  it('permite al administrador autenticado', () => {
    useAuthStore.setState({ accessToken: 'jwt', refreshToken: null, isAuthenticated: true,
      usuario: { id: 'u2', nombreCompleto: 'Admin', correo: 'a@example.test', rol: 'ADMINISTRADOR' } });
    montar();
    expect(screen.getByText('Administración real')).toBeInTheDocument();
  });

  it.each([
    ['CIUDADANO', false], ['MESA_PARTES', true], ['ESPECIALISTA', false],
    ['SECRETARIO', false], ['DIRECTOR', false], ['ADMINISTRADOR', true],
  ] as const)('ventanilla presencial: rol %s tiene acceso %s', (rol, permitido) => {
    useAuthStore.setState({ accessToken: 'jwt', refreshToken: null, isAuthenticated: true,
      usuario: { id: 'u-lab', nombreCompleto: 'Prueba', correo: 'lab@example.test', rol } });
    render(<MemoryRouter initialEntries={['/ventanilla']}><Routes>
      <Route path="/ventanilla" element={<ProtectedRoute requiredRoles={['MESA_PARTES', 'ADMINISTRADOR']}><p>Ventanilla</p></ProtectedRoute>} />
      <Route path="/acceso-denegado" element={<p>Acceso denegado</p>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText(permitido ? 'Ventanilla' : 'Acceso denegado')).toBeInTheDocument();
  });
});
