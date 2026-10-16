// Hooks de visibilidad de módulos según el rol activo (RBAC de navegación).
import { useAuthStore } from "../stores/authStore";
import {
  modulosHeaderParaRol,
  modulosParaRol,
  normalizarRolCanonico,
  type ModuloSistema,
} from "../config/modulos";
import type { RolCanonicoId } from "../types/rbacRoles";

const CLAVE_ROL = "sigd_rol";
const CLAVE_TOKEN = "sigd_token";

/** Rol canónico activo, priorizando el store y cayendo a localStorage (demo/reload). */
export function useRolActual(): RolCanonicoId | null {
  const rolStore = useAuthStore((state) => state.usuario?.rol ?? null);
  if (rolStore) return normalizarRolCanonico(rolStore);
  if (typeof window === "undefined") return null;
  return normalizarRolCanonico(window.localStorage.getItem(CLAVE_ROL));
}

/** Indica si hay una sesión activa, considerando el store o el token persistido. */
export function useAutenticado(): boolean {
  const autenticadoStore = useAuthStore((state) => state.isAuthenticated);
  if (autenticadoStore) return true;
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(CLAVE_TOKEN));
}

/** Módulos visibles para el rol activo (solo públicos si no hay sesión). */
export function useModulosVisibles(): ModuloSistema[] {
  return modulosParaRol(useRolActual());
}

/** Accesos rápidos de cabecera visibles para el rol activo. */
export function useModulosHeaderVisibles(): ModuloSistema[] {
  return modulosHeaderParaRol(useRolActual());
}
