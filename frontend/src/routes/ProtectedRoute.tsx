import type { JSX, ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";
import { canAccessRoute, type RolCanonica } from "../config/navigation.config";

interface ProtectedRouteProps {
  children?: ReactNode;
  requiredRoles?: readonly string[];
}

export default function ProtectedRoute({
  children,
  requiredRoles = [],
}: ProtectedRouteProps): JSX.Element {
  const location = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const usuario = useAuthStore((state) => state.usuario);

  if (!accessToken || !usuario) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const rol = usuario.rol as RolCanonica;

  // 1. Guarda canónica centralizada basada en la ruta solicitada
  if (!canAccessRoute(rol, location.pathname)) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  // 2. Comprobación complementaria si la guarda exige roles específicos explícitos
  if (requiredRoles.length > 0) {
    const tienePermiso = requiredRoles.includes(usuario.rol)
      || (usuario.rol === 'ADMINISTRADOR' && requiredRoles.some((r) => r !== 'CIUDADANO'));
    if (!tienePermiso) {
      return <Navigate to="/acceso-denegado" replace />;
    }
  }
  return <>{children ?? <Outlet />}</>;
}
