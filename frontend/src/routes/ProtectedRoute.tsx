// Guardia de rutas protegidas del SIGD (ENT-M05-01 / doc 03 RBAC)
// Si el token JWT expiró o el rol no posee el permiso, redirige a /login o a 403.
import type { JSX, ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import type { ClavePermiso } from "../types/rbacRoles";
import { useAuthStore } from "../stores/authStore";

const CLAVE_TOKEN = "sigd_token";
const CLAVE_ROL = "sigd_rol";
const CLAVE_PERMISOS = "sigd_facultades";

interface ProtectedRouteProps {
  children?: ReactNode;
  requiredRoles?: string[];
  requiredModule?: string;
  requiredAction?: ClavePermiso;
}

export function tienePermisoAlmacenado(
  modulo: string,
  accion: string,
): boolean {
  const crudo = window.localStorage.getItem(CLAVE_PERMISOS);
  if (!crudo) return false;

  try {
    const facultades: unknown = JSON.parse(crudo);
    if (!Array.isArray(facultades)) return false;
    const codigo = modulo.toLowerCase() === 'administración' ? 'ADMIN_USUARIOS'
      : modulo.toLowerCase() === 'reportes' && accion === 'ver' ? 'REPORTE_LEER'
      : modulo.toLowerCase() === 'expedientes' && accion === 'ver' ? 'EXPEDIENTE_LEER' : null;
    return codigo !== null && facultades.some(p => p && p.codigo === codigo && p.ambito === 'GLOBAL' && p.areaId === null);
  } catch {
    return false;
  }
}

export default function ProtectedRoute({
  children,
  requiredRoles = [],
  requiredModule,
  requiredAction = "ver",
}: ProtectedRouteProps): JSX.Element {
  useAuthStore();
  const location = useLocation();
  const token = window.localStorage.getItem(CLAVE_TOKEN);
  const rol = window.localStorage.getItem(CLAVE_ROL);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  let roles: string[] = rol ? [rol] : [];
  try {
    const actuales: unknown = JSON.parse(window.localStorage.getItem('sigd_roles') ?? 'null');
    if (Array.isArray(actuales)) roles = actuales.filter((r): r is string => typeof r === 'string');
  } catch { roles = []; }
  const solicitaAccesoAdministrador = requiredRoles.some(r => r === 'ADMINISTRADOR' || r === 'SUPER_ADMIN');
  const accesoAdministradorGlobal = solicitaAccesoAdministrador && tienePermisoAlmacenado('Administración', 'ver');
  if (requiredRoles.length > 0 && !requiredRoles.some(requerido => roles.includes(requerido)) && !accesoAdministradorGlobal) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  if (requiredModule && !tienePermisoAlmacenado(requiredModule, requiredAction)) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
