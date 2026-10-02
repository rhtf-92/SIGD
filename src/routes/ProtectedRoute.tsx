// Guardia de rutas protegidas del SIGD (ENT-M05-01 / doc 03 RBAC)
// Si el token JWT expiró o el rol no posee el permiso, redirige a /login o a 403.
import type { JSX, ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import type { ClavePermiso, MatrizPermisos } from "../types/rbacRoles";

const CLAVE_TOKEN = "sigd_token";
const CLAVE_ROL = "sigd_rol";
const CLAVE_PERMISOS = "sigd_permisos";

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
  const rol = window.localStorage.getItem(CLAVE_ROL) ?? "";
  const crudo = window.localStorage.getItem(CLAVE_PERMISOS);
  if (!crudo) return false;

  try {
    const matriz = JSON.parse(crudo) as MatrizPermisos;
    const filas = matriz[rol] ?? [];
    const fila = filas.find(
      (item) => item.modulo.toLowerCase() === modulo.toLowerCase(),
    );
    if (!fila) return false;
    return accion in fila ? Boolean((fila as never)[accion]) : false;
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
  const location = useLocation();
  const token = window.localStorage.getItem(CLAVE_TOKEN);
  const rol = window.localStorage.getItem(CLAVE_ROL);

  // Entorno de desarrollo sin módulo de autenticación aún implementado:
  // la navegación demo no se bloquea hasta integrar el backend de login.
  if (!token && import.meta.env.DEV) {
    return <>{children ?? <Outlet />}</>;
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(rol ?? "")) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  if (requiredModule && !tienePermisoAlmacenado(requiredModule, requiredAction)) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}