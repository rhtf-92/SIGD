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
  const contextoActivo = useAuthStore((state) => state.contextoActivo);
  const contextosDisponibles = useAuthStore((state) => state.contextosDisponibles);

  if (!accessToken || !usuario) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const rol = usuario.rol as RolCanonica;
  const contextoEfectivo = usuario.contexto ?? (contextosDisponibles && contextosDisponibles.length > 1 ? contextoActivo : undefined);

  // 1. Guarda canónica centralizada basada en la ruta solicitada, contexto operativo y capacidades (5H)
  if (!canAccessRoute(rol, location.pathname, { contexto: contextoEfectivo, perfiles: usuario.perfiles })) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  // 2. Comprobación complementaria si la guarda exige roles específicos explícitos
  if (requiredRoles.length > 0) {
    let tienePermiso = requiredRoles.includes(usuario.rol);
    if (!tienePermiso && usuario.rol === 'ADMINISTRADOR') {
      if (requiredRoles.includes('TESORERIA')) {
        tienePermiso = Boolean(usuario.perfiles?.includes('GESTOR_TESORERIA'));
      } else {
        tienePermiso = requiredRoles.some((r) => r !== 'CIUDADANO');
      }
    }
    if (!tienePermiso && requiredRoles.includes('TESORERIA') && usuario.perfiles?.includes('GESTOR_TESORERIA')) {
      tienePermiso = true;
    }
    if (!tienePermiso) {
      return <Navigate to="/acceso-denegado" replace />;
    }
  }
  return <>{children ?? <Outlet />}</>;
}
