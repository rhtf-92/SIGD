// Guardia de rutas protegidas del SIGD (ENT-M05-01 / doc 03 RBAC)
// Si el token JWT expiró o el rol/capacidad no posee el permiso, redirige a /login o a /acceso-denegado.
import type { JSX, ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import type { ClavePermiso, CapacidadOperativaId, RolCanonicoId } from "../types/rbacRoles";
import { useAuthStore } from "../stores/authStore";

const CLAVE_TOKEN = "sigd_token";
const CLAVE_ROL = "sigd_rol";
const CLAVE_CAPACIDAD = "sigd_capacidad";
const CLAVE_ROLES = "sigd_roles";
const CLAVE_PERMISOS = "sigd_facultades";

interface ProtectedRouteProps {
  children?: ReactNode;
  requiredRoles?: readonly RolCanonicoId[];
  requiredCapacidades?: readonly CapacidadOperativaId[];
  requiredModule?: string;
  requiredAction?: ClavePermiso;
  redirectTo?: string;
}

export function tienePermisoAlmacenado(
  modulo: string,
  accion: string,
): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
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
  requiredCapacidades = [],
  requiredModule,
  requiredAction = "ver",
  redirectTo = "/login",
}: ProtectedRouteProps): JSX.Element {
  const { usuario } = useAuthStore();
  const location = useLocation();

  const token = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem(CLAVE_TOKEN) : null;
  const rol = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem(CLAVE_ROL) : null;
  const capacidad = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem(CLAVE_CAPACIDAD) : null;
  const rawRoles = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem(CLAVE_ROLES) : null;

  if (!token) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  // 1. Roles institucionales activos
  let roles: string[] = rol ? [rol] : [];
  if (rawRoles) {
    try {
      const parsed = JSON.parse(rawRoles);
      if (Array.isArray(parsed)) {
        roles = parsed.filter((r): r is string => typeof r === 'string' && r !== 'GESTOR_APOYO_AREA');
      }
    } catch {
      roles = [];
    }
  }

  // Si el contexto activo es explícitamente de tipo CAPACIDAD, no posee roles institucionales activos
  if (usuario?.contextoActivo?.tipo === 'CAPACIDAD') {
    roles = [];
  }

  // 2. Capacidades operativas delegadas activas
  const capacidades: string[] = [];
  if (capacidad && typeof capacidad === 'string') {
    capacidades.push(capacidad);
  }
  if (usuario?.capacidadActiva && !capacidades.includes(usuario.capacidadActiva)) {
    capacidades.push(usuario.capacidadActiva);
  }
  if (usuario?.contextoActivo?.tipo === 'CAPACIDAD' && usuario.contextoActivo.codigo) {
    if (!capacidades.includes(usuario.contextoActivo.codigo)) {
      capacidades.push(usuario.contextoActivo.codigo);
    }
  }
  if (Array.isArray(usuario?.capacidades)) {
    for (const c of usuario.capacidades) {
      if (typeof c === 'string' && !capacidades.includes(c)) {
        capacidades.push(c);
      }
    }
  }

  // 3. Verificación de autorización
  const solicitaAccesoAdministrador = requiredRoles.some(r => r === 'ADMINISTRADOR' || r === 'SUPER_ADMIN');
  const accesoAdministradorGlobal = solicitaAccesoAdministrador && tienePermisoAlmacenado('Administración', 'ver');

  const tieneRestriccionRoles = requiredRoles.length > 0;
  const tieneRestriccionCapacidades = requiredCapacidades.length > 0;

  if (tieneRestriccionRoles || tieneRestriccionCapacidades) {
    const cumpleRol = tieneRestriccionRoles && (requiredRoles.some(requerido => roles.includes(requerido)) || accesoAdministradorGlobal);
    const cumpleCapacidad = tieneRestriccionCapacidades && requiredCapacidades.some(reqCap => capacidades.includes(reqCap));

    if (tieneRestriccionRoles && tieneRestriccionCapacidades) {
      // Vías alternativas: permite acceso si cumple rol O si cumple capacidad delegada
      if (!cumpleRol && !cumpleCapacidad) {
        return <Navigate to="/acceso-denegado" replace />;
      }
    } else if (tieneRestriccionRoles) {
      // Exclusivo para roles institucionales canónicos
      if (!cumpleRol) {
        return <Navigate to="/acceso-denegado" replace />;
      }
    } else if (tieneRestriccionCapacidades) {
      // Exclusivo para capacidades delegadas
      if (!cumpleCapacidad) {
        return <Navigate to="/acceso-denegado" replace />;
      }
    }
  }

  // 4. Módulo y acción adicional
  if (requiredModule && !tienePermisoAlmacenado(requiredModule, requiredAction)) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
