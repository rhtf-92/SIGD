import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import ProtectedRoute from '../../../src/routes/ProtectedRoute';
import { useAuthStore } from '../../../src/stores/authStore';

afterEach(() => useAuthStore.setState({ accessToken: null, usuario: null, isAuthenticated: false }));

describe('ProtectedRoute para Administración', () => {
  it('permite al superadministrador con el claim de acceso que devuelve login entrar al hub', () => {
    useAuthStore.setState({ accessToken: 'token', isAuthenticated: true, usuario: {
      id: 'user-1', nombreCompleto: 'Admin', correo: 'admin@example.test', rol: 'SUPER_ADMIN', permisos: ['ADMIN_USUARIOS'],
    } });
    render(<MemoryRouter initialEntries={['/administracion']}><Routes><Route path="/administracion" element={<ProtectedRoute requiredModule="Administración" requiredAction="ver"><h1>Hub administrativo</h1></ProtectedRoute>} /><Route path="/acceso-denegado" element={<h1>Denegado</h1>} /></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Hub administrativo' })).toBeInTheDocument();
  });
});
