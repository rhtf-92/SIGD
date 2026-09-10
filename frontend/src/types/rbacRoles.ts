// 5 roles canónicos institucionales
export const ROLES_CANONICOS = [
  "SUPER_ADMIN",
  "DIRECTOR",
  "DOCENTE",
  "MESA_PARTES",
  "ESTUDIANTE",
] as const;

export type RolCanonical = (typeof ROLES_CANONICOS)[number];

// 7 acciones operativas
export const ACCIONES_OPERATIVAS = [
  "ver",
  "crear",
  "editar",
  "derivar",
  "archivar",
  "eliminar",
  "exportar",
] as const;

export type AccionOperativa = (typeof ACCIONES_OPERATIVAS)[number];

// DTO para detalle de rol (mostrado en la matriz)
export interface PermisoDetalleDTO {
  modulo: string;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  derivar: boolean;
  archivar: boolean;
  eliminar: boolean;
  exportar: boolean;
}

export interface RoleDetailDTO {
  id: string;
  nombre: string;
  descripcion: string;
  alcance: string;
  permisos: PermisoDetalleDTO[];
}

// DTO para actualizar permisos de un rol (enviado al backend)
export interface UpdatePermisosDTO {
  permisos: PermisoDetalleDTO[];
}
