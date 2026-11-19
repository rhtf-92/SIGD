import type { JSX, ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { ClavePermiso } from '../types/rbacRoles';
import { PERMISOS, tienePermiso } from '../auth/permissions';

interface ProtectedRouteProps {
  children?: ReactNode;
  requiredRoles?: string[];
  requiredModule?: string;
  requiredAction?: ClavePermiso;
  requiredAnyPermissions?: readonly string[];
  requiredPermission?: string;
}

const PERMISO_BACKEND: Record<string, string | undefined> = {
  'Expedientes.ver': 'EXPEDIENTE_LEER',
  'Expedientes.derivar': 'EXPEDIENTE_DERIVAR',
  'Expedientes.editar': 'EXPEDIENTE_RESOLVER',
  'Documentos.ver': 'EXPEDIENTE_LEER',
  'Documentos.editar': 'FIRMA_FIRMAR',
  'Reportes.ver': 'REPORTE_LEER',
  'Administración.ver': PERMISOS.ADMIN_ACCESO,
  'Usuarios.ver': PERMISOS.USUARIOS_LEER,
  'Usuarios.gestionar': PERMISOS.USUARIOS_GESTIONAR,
  'Roles y Permisos.ver': PERMISOS.ROLES_LEER,
  'Organigrama.ver': PERMISOS.ORGANIGRAMA_LEER,
  'Organigrama.gestionar': PERMISOS.ORGANIGRAMA_GESTIONAR,
  'Tablas Maestras.ver': PERMISOS.MAESTRAS_LEER,
  'Tablas Maestras.editar': PERMISOS.MAESTRAS_GESTIONAR,
  'Calendario Laboral.ver': PERMISOS.CALENDARIO_LEER,
  'Calendario Laboral.editar': PERMISOS.CALENDARIO_GESTIONAR,
  'Seguridad.ver': PERMISOS.ADMIN_ACCESO,
  'Auditoría.ver': PERMISOS.AUDITORIA_LEER,
  'Auditoría.exportar': PERMISOS.AUDITORIA_LEER,
};

export default function ProtectedRoute({
  children,
  requiredRoles = [],
  requiredModule,
  requiredAction = 'ver',
  requiredAnyPermissions = [],
  requiredPermission,
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
  if (requiredAnyPermissions.length > 0 && !requiredAnyPermissions.some((permiso) => tienePermiso(usuario.permisos, permiso))) {
    return <Navigate to="/acceso-denegado" replace />;
  }
  if (requiredPermission && !tienePermiso(usuario.permisos, requiredPermission)) {
    return <Navigate to="/acceso-denegado" replace />;
  }
  if (requiredModule) {
    const permiso = PERMISO_BACKEND[`${requiredModule}.${requiredAction}`];
    if (!permiso || !tienePermiso(usuario.permisos, permiso)) {
      return <Navigate to="/acceso-denegado" replace />;
    }
  }
  return <>{children ?? <Outlet />}</>;
}
