import type { JSX, ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { ClavePermiso } from '../types/rbacRoles';

interface ProtectedRouteProps {
  children?: ReactNode;
  requiredRoles?: string[];
  requiredModule?: string;
  requiredAction?: ClavePermiso;
}

const PERMISO_BACKEND: Record<string, string | undefined> = {
  'Expedientes.ver': 'EXPEDIENTE_LEER',
  'Expedientes.derivar': 'EXPEDIENTE_DERIVAR',
  'Expedientes.editar': 'EXPEDIENTE_RESOLVER',
  'Documentos.editar': 'FIRMA_FIRMAR',
  'Administración.ver': 'ADMIN_USUARIOS',
  'Administración.editar': 'ADMIN_USUARIOS',
  'Auditoría.ver': 'REPORTE_LEER',
  'Auditoría.exportar': 'REPORTE_LEER',
};

export default function ProtectedRoute({
  children,
  requiredRoles = [],
  requiredModule,
  requiredAction = 'ver',
}: ProtectedRouteProps): JSX.Element {
  const location = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const usuario = useAuthStore((state) => state.usuario);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!accessToken || !usuario || !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (requiredRoles.length > 0 && !requiredRoles.includes(usuario.rol)) {
    return <Navigate to="/acceso-denegado" replace />;
  }
  if (requiredModule) {
    const permiso = PERMISO_BACKEND[`${requiredModule}.${requiredAction}`];
    if (!permiso || !(usuario.permisos ?? []).includes(permiso)) {
      return <Navigate to="/acceso-denegado" replace />;
    }
  }
  return <>{children ?? <Outlet />}</>;
}
