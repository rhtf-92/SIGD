// Modelos RBAC de los roles canónicos institucionales y la matriz de permisos (ENT-M05-03)
// Conforme a sigd_org.rol_sistema y especificación institucional IESTP Suiza

export type RolCanonicoId =
  // 10 Roles Canónicos Vigentes Aprobados (Migración 22)
  | "ADMINISTRADOR"
  | "DIRECTOR"
  | "JEFE_UNIDAD_ACADEMICA"
  | "COORDINADOR_AREA"
  | "SECRETARIO"
  | "MESA_PARTES"
  | "DOCENTE"
  | "TESORERO"
  | "ESTUDIANTE"
  | "CIUDADANO"
  // Rol transversal de plataforma SaaS (Migración 25)
  | "SUPER_ADMIN";

// Capacidad operativa delegada institucional (Secretaría de Apoyo de Área)
export type CapacidadOperativaId =
  | "GESTOR_APOYO_AREA";

// Distinción formal de contexto de autorización
export type TipoContextoInstitucional =
  | "ROL"
  | "CAPACIDAD";

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
