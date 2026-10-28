// Fuente única de verdad de visibilidad de módulos por rol (RBAC de navegación).
// Conforme a SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-03 y ENT-M05-03.
import type { RolCanonicoId } from "../types/rbacRoles";
import type { FamiliaModulo } from "./taxonomiaModulos";

export const TODOS_LOS_ROLES: RolCanonicoId[] = [
  "SUPER_ADMIN",
  "DIRECTOR",
  "DOCENTE",
  "MESA_PARTES",
  "ESTUDIANTE",
];

export interface ModuloSistema {
  /** Identificador estable usado por las guardas de ruta. */
  id: string;
  titulo: string;
  subtitulo?: string;
  descripcion: string;
  /** Ruta canónica de entrada al módulo. */
  ruta: string;
  /** Familia de archivo a la que pertenece (agrupa el rail lateral). */
  familia?: FamiliaModulo;
  /** Roles institucionales autorizados. SUPER_ADMIN siempre accede a todo. */
  roles: RolCanonicoId[];
  /** Accesible sin sesión iniciada (portal público). */
  publico?: boolean;
  /** Tarjeta resaltada en la página de inicio. */
  destacado?: boolean;
  /** Visible como acceso rápido en la cabecera institucional. */
  enHeader?: boolean;
}

export const MODULOS: ModuloSistema[] = [
  {
    id: "registro",
    familia: "ingreso",
    titulo: "Registro Ciudadano",
    subtitulo: "ENT-M01-01 / ENT-M01-02",
    descripcion:
      "Registro de personas naturales y jurídicas con validación RENIEC / SUNAT y Ubigeo Ucayali.",
    ruta: "/registro",
    roles: ["DIRECTOR", "MESA_PARTES", "ESTUDIANTE"],
    publico: true,
  },
  {
    id: "casilla",
    familia: "gestion",
    titulo: "Casilla Electrónica",
    subtitulo: "ENT-M01-03",
    descripcion:
      "Consulta y recepción de notificaciones electrónicas institucionales con plena validez legal.",
    ruta: "/casilla",
    roles: ["DIRECTOR", "DOCENTE", "MESA_PARTES", "ESTUDIANTE"],
    destacado: true,
    enHeader: true,
  },
  {
    id: "mesa-partes",
    familia: "ingreso",
    titulo: "Mesa de Partes Virtual",
    subtitulo: "ENT-M02 / TUPA",
    descripcion:
      "Presentación y radicación de trámites digitales, requisitos TUPA y anexos documentales.",
    ruta: "/tramite",
    roles: ["DOCENTE", "MESA_PARTES", "ESTUDIANTE"],
    destacado: true,
    enHeader: true,
  },
  {
    id: "ventanilla",
    familia: "ingreso",
    titulo: "Ventanilla Presencial",
    subtitulo: "ENT-M02 / Atención en sede",
    descripcion:
      "Atención presencial en ventanilla única con emisión de cargo y ticket térmico.",
    ruta: "/tramite/ventanilla-presencial",
    roles: ["MESA_PARTES"],
  },
  {
    id: "expedientes",
    familia: "gestion",
    titulo: "Bandeja de Expedientes",
    subtitulo: "ENT-M05",
    descripcion:
      "Gestiona y consulta el estado, trazabilidad, providencias y foliado de expedientes.",
    ruta: "/expedientes",
    roles: ["DIRECTOR", "DOCENTE", "MESA_PARTES"],
  },
  {
    id: "validez-legal",
    familia: "validez",
    titulo: "Flujo y Validez Legal",
    subtitulo: "MOD-04 / Firma Digital",
    descripcion:
      "Tramitación con plena validez legal: firma digital, re-firma, workflow académico y verificación pública (CVD).",
    ruta: "/flujo-validez-legal",
    roles: ["DIRECTOR", "DOCENTE"],
    destacado: true,
    enHeader: true,
  },
  {
    id: "titulacion",
    familia: "validez",
    titulo: "Workflow Académico",
    subtitulo: "MOD-05 / Titulación",
    descripcion:
      "Flujo académico de titulación: evaluación, aprobación y emisión de actos resolutivos.",
    ruta: "/flujos/titulacion",
    roles: ["DIRECTOR", "DOCENTE"],
  },
  {
    id: "resoluciones",
    familia: "validez",
    titulo: "Proyector de Resoluciones",
    subtitulo: "MOD-04 / Actos resolutivos",
    descripcion:
      "Editor de Resoluciones Directorales en formato A4 con firma digital y estampado CVD.",
    ruta: "/flujos/proyector-resoluciones",
    roles: ["DIRECTOR", "DOCENTE"],
  },
  {
    id: "reportes",
    familia: "gobierno",
    titulo: "Reportes y Tableros de Control",
    subtitulo: "06_reportes-tablero-control",
    descripcion:
      "Indicadores ejecutivos, tendencias, distribución de expedientes y áreas con cuellos de botella.",
    ruta: "/reportes/dashboard",
    roles: ["DIRECTOR"],
  },
  {
    id: "validador-cvd",
    familia: "validez",
    titulo: "Validador CVD",
    subtitulo: "MOD-04 / Verificación",
    descripcion:
      "Valida la autenticidad e integridad de documentos firmados digitalmente mediante el Código de Verificación de Documentos.",
    ruta: "/validador-cvd",
    roles: ["DIRECTOR", "DOCENTE", "MESA_PARTES", "ESTUDIANTE"],
    publico: true,
    enHeader: true,
  },
  {
    id: "administracion",
    familia: "gobierno",
    titulo: "Panel de Administración",
    subtitulo: "ENT-M05-01 / RBAC",
    descripcion:
      "Gestión de usuarios, roles, permisos, auditoría, tablas maestras y calendario laboral.",
    ruta: "/administracion",
    roles: ["DIRECTOR"],
    enHeader: true,
  },
];

const ALIAS_ROLES: Record<string, RolCanonicoId> = {
  ADMINISTRADOR: "SUPER_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  DIRECTOR: "DIRECTOR",
  DOCENTE: "DOCENTE",
  SECRETARIO: "DOCENTE",
  ESPECIALISTA: "DOCENTE",
  MESA_PARTES: "MESA_PARTES",
  ESTUDIANTE: "ESTUDIANTE",
  CIUDADANO: "ESTUDIANTE",
};

/** Normaliza cualquier código de rol del backend a los 5 roles canónicos. */
export function normalizarRolCanonico(
  rol?: string | null,
): RolCanonicoId | null {
  if (!rol) return null;
  return ALIAS_ROLES[rol.toUpperCase()] ?? null;
}

export function buscarModulo(moduloId: string): ModuloSistema | undefined {
  return MODULOS.find((modulo) => modulo.id === moduloId);
}

/** Módulos visibles para un rol. Sin sesión se muestran solo los públicos. */
export function modulosParaRol(rol: RolCanonicoId | null): ModuloSistema[] {
  if (!rol) return MODULOS.filter((modulo) => modulo.publico === true);
  if (rol === "SUPER_ADMIN") return MODULOS;
  return MODULOS.filter((modulo) => modulo.roles.includes(rol));
}

/** Accesos rápidos de cabecera visibles para un rol. */
export function modulosHeaderParaRol(rol: RolCanonicoId | null): ModuloSistema[] {
  return modulosParaRol(rol).filter((modulo) => modulo.enHeader === true);
}

/** Determina si un rol puede acceder a un módulo identificado por su id. */
export function puedeAcceder(
  rol: RolCanonicoId | null,
  moduloId: string,
): boolean {
  const modulo = buscarModulo(moduloId);
  if (!modulo) return false;
  if (modulo.publico) return true;
  if (!rol) return false;
  if (rol === "SUPER_ADMIN") return true;
  return modulo.roles.includes(rol);
}
