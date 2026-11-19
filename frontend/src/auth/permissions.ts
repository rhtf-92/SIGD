export const PERMISOS = {
  ADMIN_ACCESO: "admin:acceso",
  USUARIOS_LEER: "usuarios:leer",
  USUARIOS_GESTIONAR: "usuarios:gestionar",
  ROLES_LEER: "roles:leer",
  AUDITORIA_LEER: "auditoria:leer",
  ORGANIGRAMA_LEER: "organigrama:leer",
  ORGANIGRAMA_GESTIONAR: "organigrama:gestionar",
  MAESTRAS_LEER: "maestras:leer",
  MAESTRAS_GESTIONAR: "maestras:gestionar",
  CALENDARIO_LEER: "calendario:leer",
  CALENDARIO_GESTIONAR: "calendario:gestionar",
} as const;

export type PermisoCanonico = (typeof PERMISOS)[keyof typeof PERMISOS];

export function tienePermiso(
  permisos: readonly string[] | null | undefined,
  requerido: string,
): boolean {
  return permisos?.includes(requerido) ?? false;
}

export function esSuperAdmin(rol: string | null | undefined): boolean {
  return rol === "SUPER_ADMIN";
}
