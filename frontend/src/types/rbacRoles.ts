// Modelos RBAC de los 5 íconos canónicos y la matriz de permisos (ENT-M05-03)
// Alineado al documento SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-03

export interface Rol {
  id: string;
  nombre: string;
  descripcion: string;
  alcance: string;
  usuarios: number;
}

export interface PermisoModulo {
  modulo: string;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  derivar: boolean;
  archivar: boolean;
  eliminar: boolean;
  exportar: boolean;
}

export type ClavePermiso = Exclude<keyof PermisoModulo, "modulo">;

export type MatrizPermisos = Record<string, PermisoModulo[]>;

export interface RoleRBACPayload {
  roleId: string;
  permissions: Record<string, PermisoModulo>;
}