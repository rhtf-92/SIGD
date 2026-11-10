// Hook de autorización granular por módulo y acción (RBAC)
// Lee los permisos guardados en localStorage (clave: sigd_permisos)
import { useAuthStore } from "../stores/authStore";
import type { ClavePermiso } from "../types/rbacRoles";

export function usePermission(modulo: string, accion: ClavePermiso): boolean {
  const { usuario } = useAuthStore.getState();
  if (!usuario) return false;

  const crudo = window.localStorage.getItem("sigd_permisos");
  if (!crudo) return false;

  try {
    const matriz = JSON.parse(crudo) as Record<
      string,
      Array<Record<string, boolean | string>>
    >;
    const filas = matriz[usuario.rol];
    if (!filas) return false;

    const fila = filas.find((f) => f.modulo === modulo);
    return fila ? Boolean(fila[accion]) : false;
  } catch {
    return false;
  }
}
