// Tipos del Directorio Institucional de Usuarios (ENT-M05-02)
// Alineado al documento SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-05

export type EstadoUsuario = "Activo" | "Inactivo" | "Bloqueado";

export interface Usuario {
  id: number;
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

// Contratos de integración REST /api/v1/usuarios (canónicos del módulo)
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

// Filtros de servidor exigidos por T-FE-ADM-01: unidad orgánica, sede, rol y estado.
export interface FiltrosUsuarios {
  busqueda: string;
  area: string;
  sede: string;
  rol: string;
  estado: EstadoUsuario | "Todos";
}

export const FILTROS_USUARIOS_INICIALES: FiltrosUsuarios = {
  busqueda: "",
  area: "",
  sede: "",
  rol: "",
  estado: "Todos",
};

export const DEBOUNCE_BUSQUEDA_MS = 300;