// Guarda de ruta por módulo y rol (RBAC de navegación ENT-M05-03).
// Bloquea el acceso por URL directa a módulos no autorizados para el rol activo.
import type { JSX, ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { buscarModulo, puedeAcceder } from "../config/modulos";
import { useRolActual } from "../hooks/useModulosVisibles";

interface ModuloGuardProps {
  /** Identificador del módulo en el catálogo canónico. */
  moduloId: string;
  children?: ReactNode;
}

const CLAVE_TOKEN = "sigd_token";

export default function ModuloGuard({
  moduloId,
  children,
}: ModuloGuardProps): JSX.Element {
  const location = useLocation();
  const rol = useRolActual();
  const modulo = buscarModulo(moduloId);
  const esPublico = modulo?.publico === true;

  if (!esPublico) {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem(CLAVE_TOKEN)
        : null;

    if (!token) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (!puedeAcceder(rol, moduloId)) {
      return <Navigate to="/acceso-denegado" replace />;
    }
  }

  return <>{children ?? <Outlet />}</>;
}
