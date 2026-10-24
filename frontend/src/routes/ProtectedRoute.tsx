import type { JSX, ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";

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
  if (requiredRoles.length > 0 && !requiredRoles.includes(usuario.rol)) {
    return <Navigate to="/acceso-denegado" replace />;
  }
  return <>{children ?? <Outlet />}</>;
}
