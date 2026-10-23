// Tipos del Directorio Institucional de Usuarios (ENT-M05-02)
// Alineado al documento SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-05 y al contrato PostgreSQL de OrganiCore

export type EstadoUsuario = "Activo" | "Inactivo" | "Bloqueado";

export interface Usuario {
  id: string;
  nombre: string;
  dni: string;
  correo: string;
  sede: string;
  area: string;
  cargo: string;
  rol: string;
  estado: EstadoUsuario;
  ultimoAcceso: string;
}

// Contratos de integración REST /api/v1/admin/usuarios
export interface UpdateUsuarioDTO {
  area: string;
  sede: string;
  cargo: string;
  rol: string;
}

export interface UpdateEstadoDTO {
  estado: EstadoUsuario;
}

export type UsuarioDetailDTO = Usuario;

// Filtros de servidor: búsqueda por texto, unidad orgánica (areaId), sede (sedeId), rol (rolId) y estado.
export interface FiltrosUsuarios {
  busqueda: string;
  areaId?: string;
  sedeId?: string;
  rolId?: string;
  area: string;
  sede: string;
  rol: string;
  estado: EstadoUsuario | "Todos";
}

export const FILTROS_USUARIOS_INICIALES: FiltrosUsuarios = {
  busqueda: "",
  areaId: undefined,
  sedeId: undefined,
  rolId: undefined,
  area: "",
  sede: "",
  rol: "",
  estado: "Todos",
};

export const DEBOUNCE_BUSQUEDA_MS = 300;
