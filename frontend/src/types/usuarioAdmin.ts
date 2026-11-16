// Directorio institucional: las claves de cuenta y asignación son UUID.
export type EstadoUsuario = "Activo" | "Inactivo" | "Bloqueado";
export interface OpcionDirectorio { id: string; nombre: string; codigo?: string }
export interface TipoDocumentoDirectorio extends OpcionDirectorio { codigo: string }
export interface AsignacionUsuario { id: string; cargoId: string; areaId: string; cargo: string; area: string }
export interface RolUsuario {
  id: string;
  rolId: string;
  areaId: string | null;
  nombre: string;
  codigo?: string;
  ambito?: "GLOBAL" | "AREA";
  vigenteDesde?: string;
  vigenteHasta?: string | null;
  activo?: boolean;
}
export interface Usuario {
  id: string; nombre: string; nombres: string; apellidos: string; tipoPersona: string;
  dni: string; correo: string; sede: string; area: string; cargo: string; rol: string;
  estado: EstadoUsuario; ultimoAcceso: string;
  asignaciones: AsignacionUsuario[]; roles: RolUsuario[]; username?: string;
}
export interface UpdateUsuarioDTO {
  nombres?: string; apellidos?: string; correo?: string;
  cargoId?: string; areaId?: string; asignacionId?: string;
  rolId?: string; usuarioRolId?: string; estado?: "ACTIVO" | "INACTIVO";
}
export interface CrearUsuarioDTO {
  tipoDocumentoId: number; numeroDocumento: string; nombres: string; apellidoPaterno: string;
  apellidoMaterno?: string; telefono?: string; correo: string; username: string; passwordInicial: string;
  areaId: string; cargoId: string;
  rolId?: string; estado?: "ACTIVO" | "INACTIVO";
}
export interface UpdateEstadoDTO { estado: EstadoUsuario }
export type UsuarioDetailDTO = Usuario;
export interface FiltrosUsuarios {
  busqueda: string; area: string; sede: string; rol: string; estado: EstadoUsuario | "Todos";
  pagina?: number; limite?: number;
}
export interface DirectorioUsuarios {
  datos: Usuario[];
  paginacion: { pagina: number; limite: number; total: number; totalPaginas: number };
  catalogos: { areas: OpcionDirectorio[]; cargos: OpcionDirectorio[]; roles: OpcionDirectorio[]; tiposDocumento: TipoDocumentoDirectorio[] };
}
export const FILTROS_USUARIOS_INICIALES: FiltrosUsuarios = {
  busqueda: "", area: "", sede: "", rol: "", estado: "Todos", pagina: 1, limite: 20,
};
export const DEBOUNCE_BUSQUEDA_MS = 300;
