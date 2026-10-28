// Tipos del Directorio Institucional de Usuarios (ENT-M05-02)
// Alineado al documento SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-05

export type EstadoUsuario = "Activo" | "Inactivo" | "Bloqueado";

export interface Usuario {
  id: string | number;
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

/** Intervalo de refresco automático del directorio (tiempo real). */
export const INTERVALO_ACTUALIZACION_USUARIOS_MS = 5_000;

/** Roles canónicos que se muestran en el directorio y en el filtro. */
export const CATALOGO_ROLES_USUARIOS: string[] = [
  "SA",
  "Director General",
  "Docente",
  "Mesa de Partes",
  "Estudiante",
];

/**
 * Códigos de `sigd_org.rol_sistema` que corresponden a cada rol canónico.
 * El backend conserva códigos históricos (ADMINISTRADOR, SECRETARIO, etc.),
 * por lo que se agrupan bajo la etiqueta institucional vigente.
 */
export const CODIGOS_ROL_USUARIO: Record<string, string[]> = {
  SA: ["ADMINISTRADOR", "SUPER_ADMIN"],
  "Director General": ["DIRECTOR"],
  Docente: ["DOCENTE", "SECRETARIO", "ESPECIALISTA"],
  "Mesa de Partes": ["MESA_PARTES"],
  Estudiante: ["ESTUDIANTE", "CIUDADANO"],
};

const ETIQUETA_ROL_POR_ALIAS: Record<string, string> = {
  ADMINISTRADOR: "SA",
  "ADMINISTRADOR DEL SISTEMA": "SA",
  "SUPER ADMINISTRADOR": "SA",
  SUPER_ADMIN: "SA",
  DIRECTOR: "Director General",
  "DIRECTOR GENERAL": "Director General",
  DOCENTE: "Docente",
  SECRETARIO: "Docente",
  "SECRETARIO ACADÉMICO": "Docente",
  ESPECIALISTA: "Docente",
  MESA_PARTES: "Mesa de Partes",
  "MESA DE PARTES": "Mesa de Partes",
  CIUDADANO: "Estudiante",
  ESTUDIANTE: "Estudiante",
};

/** Convierte el rol que devuelve el backend a la etiqueta canónica del frontend. */
export function etiquetaRolUsuario(valor: string): string {
  const limpio = valor.trim();
  if (limpio === "") return "Sin rol";
  return ETIQUETA_ROL_POR_ALIAS[limpio.toUpperCase()] ?? limpio;
}
