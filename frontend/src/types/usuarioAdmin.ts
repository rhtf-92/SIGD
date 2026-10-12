export type EstadoUsuario = "Activo" | "Inactivo" | "Bloqueado";

export interface OpcionCatalogo { id: string; nombre: string }

export interface Usuario {
  id: string;
  idPersona: string;
  nombre: string;
  documento: string;
  correo: string;
  areaId: string | null;
  area: string;
  cargoId: string | null;
  cargo: string;
  rolId: string | null;
  rol: string;
  rolIds: string[];
  roles: OpcionCatalogo[];
  estado: EstadoUsuario;
  ultimoAcceso: string;
}

export interface UpdateUsuarioDTO {
  correo?: string;
  areaId?: string;
  cargoId?: string;
  rolId?: string;
  rolesAgregar?: string[];
  rolesQuitar?: string[];
  estado?: "ACTIVO" | "INACTIVO" | "BLOQUEADO";
}

export interface CrearUsuarioDTO {
  tipo?: "NATURAL";
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  telefono?: string | null;
  correo: string;
  username: string;
  passwordInicial: string;
  areaId: string;
  cargoId: string;
  rolIds: string[];
}

export interface UpdateEstadoDTO { estado: EstadoUsuario }
export type UsuarioDetailDTO = Usuario;

export interface FiltrosUsuarios {
  busqueda: string;
  areaId: string;
  rolId: string;
  estado: EstadoUsuario | "Todos";
}

export const FILTROS_USUARIOS_INICIALES: FiltrosUsuarios = {
  busqueda: "", areaId: "", rolId: "", estado: "Todos",
};

export const DEBOUNCE_BUSQUEDA_MS = 300;
