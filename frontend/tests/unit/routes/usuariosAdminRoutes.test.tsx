import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminRoutes from '@/routes/AdminRoutes';
import ProtectedRoute, { tienePermisoAlmacenado } from '@/routes/ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';
vi.mock('@/pages/administracion/UsuariosPage', () => ({ default: () => <p>Directorio protegido</p> }));
function montar() {
  return render(<MemoryRouter initialEntries={['/administracion/usuarios']}><Routes>
    <Route path='/administracion' element={<ProtectedRoute requiredModule='Administración'/>}>{AdminRoutes()}</Route>
    <Route path='/login' element={<p>Login requerido</p>}/>
    <Route path='/acceso-denegado' element={<p>Acceso denegado</p>}/>
  </Routes></MemoryRouter>);
}
beforeEach(() => { localStorage.clear(); });
function permiso(areaId: string | null = null) {
  localStorage.setItem('sigd_facultades', JSON.stringify([{ codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId }]));
}
describe('Navegación administrativa según facultades institucionales', () => {
  it('permite el directorio cuando el perfil publica ADMIN_USUARIOS GLOBAL', () => {
    localStorage.setItem('sigd_token','sesion-unitaria'); localStorage.setItem('sigd_rol','ADMINISTRADOR');
    permiso(); montar(); expect(screen.getByText('Directorio protegido')).toBeInTheDocument();
  });
  it('continúa exigiendo sesión', () => { permiso(); montar(); expect(screen.getByText('Login requerido')).toBeInTheDocument(); });
  it('no concede acceso por un nombre SUPER_ADMIN o una matriz editada localmente', () => {
    localStorage.setItem('sigd_token','sesion-unitaria'); localStorage.setItem('sigd_rol','SUPER_ADMIN');
    localStorage.setItem('sigd_permisos',JSON.stringify({SUPER_ADMIN:[{modulo:'Administración',ver:true,editar:true}]}));
    montar(); expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
  });
  it('una asignación de área no se convierte en permiso global', () => {
    localStorage.setItem('sigd_token','sesion-unitaria'); permiso('11111111-1111-4111-8111-111111111111');
    montar(); expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
  });
  it('no extiende ADMIN_USUARIOS a las operaciones documentales', () => {
    permiso(); expect(tienePermisoAlmacenado('Expedientes','editar')).toBe(false);
  });
  it('retira la pantalla protegida cuando la renovación revoca la facultad, sin navegar manualmente', () => {
    localStorage.setItem('sigd_token', 'sesion-unitaria'); permiso();
    montar(); expect(screen.getByText('Directorio protegido')).toBeInTheDocument();
    act(() => useAuthStore.getState().setToken('sesion-renovada-unitaria', null, { roles: [], permisos: [] }));
    expect(screen.queryByText('Directorio protegido')).not.toBeInTheDocument();
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
  });
});
