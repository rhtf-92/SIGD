// Mapa único de navegación del SIGD.
// Define el ORDEN y si cada acceso es público o requiere iniciar sesión.
// El Header, la página de inicio y el router consumen esta misma fuente
// para que la página nunca pida login donde no corresponde ni lo omita
// donde sí corresponde.
import type { LucideIcon } from "lucide-react";
import type { ClavePermiso, MatrizPermisos } from "../types/rbacRoles";
import {
  BarChart3,
  FileCheck2,
  FileText,
  FolderOpen,
  Inbox,
  LogIn,
  Monitor,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";

export interface AccesoSIGD {
  to: string;
  etiqueta: string;
  descripcion: string;
  icono: LucideIcon;
  /** true = acceso libre · false = requiere iniciar sesión */
  publico: boolean;
  acento: string;
  /**
   * Roles que pueden ver este módulo una vez autenticados.
   * Si se omite, es visible para todo usuario autenticado
   * (y para visitantes si además es `publico`).
   */
  roles?: string[];
  /**
   * Permiso RBAC exigido además del rol (matriz `sigd_permisos`).
   * Si se omite, basta con el rol. Si se declara, el módulo solo aparece
   * cuando la matriz almacenada concede `accion` sobre `modulo`.
   */
  modulo?: string;
  accion?: ClavePermiso;
}

export interface SeccionMenu {
  id: string;
  titulo: string;
  accesos: AccesoSIGD[];
}

/** Roles canónicos del SIGD (los mismos del login demo y del RBAC). */
export const ROLES_CANONICOS_IDS = [
  "SUPER_ADMIN",
  "DIRECTOR",
  "DOCENTE",
  "MESA_PARTES",
  "ESTUDIANTE",
] as const;

export type RolCanónico = (typeof ROLES_CANONICOS_IDS)[number];

const TODOS_AUTENTICADOS: string[] = [...ROLES_CANONICOS_IDS];

export const SECCIONES_MENU: SeccionMenu[] = [
  {
    id: "servicios",
    titulo: "Servicios ciudadanos",
    accesos: [
      {
        to: "/tramite",
        etiqueta: "Mesa de Partes Virtual",
        descripcion: "Presenta trámites digitales y anexos TUPA.",
        icono: FileText,
        publico: true,
        acento: "from-[#006EC7] to-cyan-500",
      },
      {
        to: "/registro",
        etiqueta: "Registro Ciudadano",
        descripcion: "Personas naturales y jurídicas (RENIEC / SUNAT).",
        icono: UserPlus,
        publico: true,
        acento: "from-emerald-500 to-teal-500",
      },
      {
        to: "/consulta",
        etiqueta: "Consulta de Trámite",
        descripcion: "Sigue tu expediente con el CUT.",
        icono: Search,
        publico: true,
        acento: "from-amber-500 to-orange-500",
      },
      {
        to: "/validador-cvd",
        etiqueta: "Validador CVD",
        descripcion: "Verifica documentos firmados digitalmente.",
        icono: ShieldCheck,
        publico: true,
        acento: "from-cyan-600 to-sky-500",
      },
    ],
  },
  {
    id: "seguimiento",
    titulo: "Mi actividad",
    accesos: [
      {
        to: "/casilla",
        etiqueta: "Casilla Electrónica",
        descripcion: "Notificaciones electrónicas con validez legal.",
        icono: Inbox,
        publico: false,
        acento: "from-[#B8912A] to-amber-400",
        roles: TODOS_AUTENTICADOS,
      },
      {
        to: "/expedientes",
        etiqueta: "Bandeja de Expedientes",
        descripcion: "Estado, trazabilidad y foliado de expedientes.",
        icono: FolderOpen,
        publico: false,
        acento: "from-indigo-500 to-blue-500",
        roles: ["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES"],
        modulo: "Expedientes",
        accion: "ver",
      },
    ],
  },
  {
    id: "gestion",
    titulo: "Gestión interna",
    accesos: [
      {
        to: "/flujo-validez-legal",
        etiqueta: "Flujo y Validez Legal",
        descripcion: "Firma digital, re-firma y workflow académico.",
        icono: FileCheck2,
        publico: false,
        acento: "from-[#006EC7] to-cyan-500",
        roles: ["SUPER_ADMIN", "DIRECTOR", "DOCENTE"],
        modulo: "Documentos",
        accion: "ver",
      },
      {
        to: "/tramite/ventanilla-presencial",
        etiqueta: "Ventanilla Presencial",
        descripcion: "Atención y radicación en ventanilla.",
        icono: Monitor,
        publico: false,
        acento: "from-slate-600 to-slate-900",
        roles: ["SUPER_ADMIN", "MESA_PARTES"],
        modulo: "Expedientes",
        accion: "crear",
      },
      {
        to: "/reportes/dashboard",
        etiqueta: "Reportes y Tableros",
        descripcion: "Indicadores ejecutivos y cuellos de botella.",
        icono: BarChart3,
        publico: false,
        acento: "from-violet-600 to-purple-500",
        roles: ["SUPER_ADMIN", "DIRECTOR"],
        modulo: "Expedientes",
        accion: "exportar",
      },
      {
        to: "/administracion",
        etiqueta: "Administración",
        descripcion: "Usuarios, roles, auditoría y tablas maestras.",
        icono: Settings2,
        publico: false,
        acento: "from-slate-600 to-slate-900",
        roles: ["SUPER_ADMIN", "DIRECTOR"],
        modulo: "Administración",
        accion: "ver",
      },
    ],
  },
];

/** Tarjetas de la página de inicio, en el mismo orden del menú. */
export interface AccesoHome extends AccesoSIGD {
  subtitulo: string;
  destacado?: boolean;
}

export const ACCESOS_HOME: AccesoHome[] = [
  {
    to: "/flujo-validez-legal",
    etiqueta: "Flujo y Validez Legal",
    subtitulo: "MOD-04 / Firma Digital",
    descripcion:
      "Tramitación con plena validez legal: firma digital, re-firma, workflow académico y verificación pública (CVD).",
    icono: FileCheck2,
    publico: false,
    destacado: true,
    acento: "from-[#006EC7] to-cyan-500",
    roles: ["SUPER_ADMIN", "DIRECTOR", "DOCENTE"],
    modulo: "Documentos",
    accion: "ver",
  },
  {
    to: "/casilla",
    etiqueta: "Casilla Electrónica",
    subtitulo: "ENT-M01-03",
    descripcion:
      "Consulta y recepción de notificaciones electrónicas institucionales con plena validez legal.",
    icono: Inbox,
    publico: false,
    destacado: true,
    acento: "from-[#B8912A] to-amber-400",
    roles: TODOS_AUTENTICADOS,
  },
  {
    to: "/tramite",
    etiqueta: "Mesa de Partes Virtual",
    subtitulo: "ENT-M02 / TUPA",
    descripcion:
      "Presentación y radicación de trámites digitales, requisitos TUPA y anexos documentales.",
    icono: Sparkles,
    publico: true,
    destacado: true,
    acento: "from-amber-500 to-orange-500",
  },
  {
    to: "/registro",
    etiqueta: "Registro Ciudadano",
    subtitulo: "ENT-M01-01 / ENT-M01-02",
    descripcion:
      "Registro de personas naturales y jurídicas con validación RENIEC / SUNAT y Ubigeo Ucayali.",
    icono: UserPlus,
    publico: true,
    acento: "from-emerald-500 to-teal-500",
  },
  {
    to: "/expedientes",
    etiqueta: "Bandeja de Expedientes",
    subtitulo: "ENT-M05",
    descripcion:
      "Gestiona y consulta el estado, trazabilidad, providencias y foliado de expedientes.",
    icono: FolderOpen,
    publico: false,
    acento: "from-indigo-500 to-blue-500",
    roles: ["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES"],
    modulo: "Expedientes",
    accion: "ver",
  },
  {
    to: "/validador-cvd",
    etiqueta: "Validador CVD",
    subtitulo: "MOD-04 / Verificación",
    descripcion:
      "Valida la autenticidad e integridad de documentos firmados digitalmente mediante el CVD.",
    icono: ShieldCheck,
    publico: true,
    acento: "from-cyan-600 to-sky-500",
  },
  {
    to: "/administracion",
    etiqueta: "Panel de Administración",
    subtitulo: "ENT-M05-01 / RBAC",
    descripcion:
      "Gestión de usuarios, roles, permisos, auditoría, tablas maestras y calendario laboral.",
    icono: Settings2,
    publico: false,
    acento: "from-slate-600 to-slate-900",
    roles: ["SUPER_ADMIN", "DIRECTOR"],
    modulo: "Administración",
    accion: "ver",
  },
  {
    to: "/reportes/dashboard",
    etiqueta: "Reportes y Tableros",
    subtitulo: "Indicadores ejecutivos",
    descripcion:
      "Consulta tendencias, distribución de expedientes y áreas con cuellos de botella.",
    icono: BarChart3,
    publico: false,
    acento: "from-violet-600 to-purple-500",
    roles: ["SUPER_ADMIN", "DIRECTOR"],
    modulo: "Expedientes",
    accion: "exportar",
  },
];

/** Tarjeta de acceso: solo se muestra cuando NO hay sesión activa. */
export const ACCESO_LOGIN: AccesoHome = {
  to: "/login",
  etiqueta: "Iniciar Sesión",
  subtitulo: "Acceso Institucional",
  descripcion: "Ingreso al sistema SIGD con credenciales y verificación de perfil asignado.",
  icono: LogIn,
  publico: true,
  acento: "from-[#0a4a83] to-[#006EC7]",
};

const CLAVE_STORAGE_PERMISOS = "sigd_permisos";

/** Lee la matriz RBAC guardada al iniciar sesión (null si no existe o es inválida). */
export function leerMatrizPermisos(): MatrizPermisos | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const crudo = window.localStorage.getItem(CLAVE_STORAGE_PERMISOS);
    if (!crudo) return null;
    return JSON.parse(crudo) as MatrizPermisos;
  } catch {
    return null;
  }
}

/**
 * ¿El rol tiene concedida `accion` sobre `modulo` en la matriz almacenada?
 * Sin matriz guardada se devuelve true (respaldo por roles, p. ej. tests).
 */
export function tieneAccesoModulo(
  rol: string,
  modulo: string,
  accion: ClavePermiso,
): boolean {
  const matriz = leerMatrizPermisos();
  if (!matriz) return true;
  const filas = matriz[rol] ?? [];
  const fila = filas.find((item) => item.modulo.toLowerCase() === modulo.toLowerCase());
  if (!fila) return false;
  return Boolean(fila[accion]);
}

/**
 * ¿Este acceso es visible para este usuario?
 * - Sin sesión: modo invitado bloqueado, no se expone ningún módulo.
 * - Con sesión: lo público + lo privado cuyo `roles` incluya su rol
 *   (si no declara `roles`, es para todo autenticado) + el permiso RBAC
 *   exigido en `modulo`/`accion` cuando se declara.
 */
export function esVisibleParaRol(
  acceso: Pick<AccesoSIGD, "publico" | "roles" | "modulo" | "accion">,
  rol: string,
  isAuthenticated: boolean,
): boolean {
  if (!isAuthenticated) return false;
  if (acceso.publico) return true;
  if (acceso.roles && !acceso.roles.includes(rol)) return false;
  if (acceso.modulo && acceso.accion && !tieneAccesoModulo(rol, acceso.modulo, acceso.accion)) {
    return false;
  }
  return true;
}

/** Secciones del menú filtradas por rol (omite secciones que quedan vacías). */
export function seccionesVisiblesPara(
  rol: string,
  isAuthenticated: boolean,
): SeccionMenu[] {
  return SECCIONES_MENU.map((seccion) => ({
    ...seccion,
    accesos: seccion.accesos.filter((a) => esVisibleParaRol(a, rol, isAuthenticated)),
  })).filter((seccion) => seccion.accesos.length > 0);
}

/** Tarjetas del home filtradas por rol (+ login solo sin sesión). */
export function accesosHomeVisiblesPara(
  rol: string,
  isAuthenticated: boolean,
): AccesoHome[] {
  const base = ACCESOS_HOME.filter((a) => esVisibleParaRol(a, rol, isAuthenticated));
  return isAuthenticated ? base : [...base, ACCESO_LOGIN];
}
