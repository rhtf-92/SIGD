import { useEffect, useState } from "react";

import type { FamiliaModulo } from "./taxonomiaModulos";

// Roles canónicos institucionales (igual que LoginPage + authStore)
export type RolCanonico =
  | "SUPER_ADMIN"
  | "DIRECTOR"
  | "DOCENTE"
  | "MESA_PARTES"
  | "ESTUDIANTE";

export const ROLES_CANONICOS: RolCanonico[] = [
  "SUPER_ADMIN",
  "DIRECTOR",
  "DOCENTE",
  "MESA_PARTES",
  "ESTUDIANTE",
];

const CLAVE_TOKEN = "sigd_token";
const CLAVE_ROL = "sigd_rol";

export interface DefinicionModulo {
  id: string;
  titulo: string;
  subtitulo?: string;
  descripcion: string;
  ruta: string;
  destacado?: boolean;
  /** Orden ascendente en Home/Header. Menor = primero. */
  orden: number;
  /** Si true se muestra sin iniciar sesión. Si false, requiere token. */
  publico: boolean;
  /** Roles que pueden ver el módulo una vez autenticados. Vacío = todos los autenticados. */
  rolesPermitidos: RolCanonico[];
  /** Módulo de la matriz RBAC para doble chequeo de permiso "ver". Opcional. */
  moduloPermiso?: string;
  /** Familia de archivo a la que pertenece (agrupa el rail lateral). */
  familia?: FamiliaModulo;
}

// Tabla única de verdad: qué módulo ve cada cuenta.
// Ordenado por flujo documental: ingreso -> gestión -> notificación ->
// verificación -> firma -> gobierno.
// - Sin sesión: solo publico === true.
// - Con sesión: publico === true O rol incluido en rolesPermitidos.
export const MODULOS_VISIBLES: DefinicionModulo[] = [
  {
    id: "mesa-virtual",
    familia: "ingreso",
    titulo: "Mesa de Partes Virtual",
    subtitulo: "ENT-M02 / TUPA",
    descripcion:
      "Presentación y radicación de trámites digitales, requisitos TUPA y anexos documentales.",
    ruta: "/tramite",
    destacado: true,
    orden: 10,
    publico: true,
    rolesPermitidos: ["SUPER_ADMIN", "DIRECTOR", "MESA_PARTES", "ESTUDIANTE"],
    moduloPermiso: "Expedientes",
  },
  {
    id: "ventanilla",
    familia: "ingreso",
    titulo: "Ventanilla Presencial",
    subtitulo: "ENT-M02 / Presencial",
    descripcion:
      "Recepción ciudadana presencial, foliado y asignación de CUT.",
    ruta: "/tramite/ventanilla-presencial",
    orden: 20,
    publico: false,
    rolesPermitidos: ["SUPER_ADMIN", "DIRECTOR", "MESA_PARTES"],
    moduloPermiso: "Expedientes",
  },
  {
    id: "registro",
    familia: "ingreso",
    titulo: "Registro Ciudadano",
    subtitulo: "ENT-M01-01 / ENT-M01-02",
    descripcion:
      "Registro de personas naturales y jurídicas con validación RENIEC / SUNAT y Ubigeo Ucayali.",
    ruta: "/registro",
    orden: 30,
    publico: true,
    rolesPermitidos: ["SUPER_ADMIN", "DIRECTOR", "MESA_PARTES", "ESTUDIANTE"],
  },
  {
    id: "expedientes",
    familia: "gestion",
    titulo: "Bandeja de Expedientes",
    subtitulo: "ENT-M05",
    descripcion:
      "Gestiona y consulta el estado, trazabilidad, providencias y foliado de expedientes.",
    ruta: "/expedientes",
    orden: 40,
    publico: false,
    rolesPermitidos: ["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES"],
    moduloPermiso: "Expedientes",
  },
  {
    id: "casilla",
    familia: "gestion",
    titulo: "Casilla Electrónica",
    subtitulo: "ENT-M01-03",
    descripcion:
      "Consulta y recepción de notificaciones electrónicas institucionales con plena validez legal.",
    ruta: "/casilla",
    destacado: true,
    orden: 50,
    publico: false,
    rolesPermitidos: ["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES", "ESTUDIANTE"],
    moduloPermiso: "Documentos",
  },
  {
    id: "consulta",
    familia: "ingreso",
    titulo: "Consulta Pública",
    subtitulo: "Seguimiento CUT",
    descripcion: "Consulta pública del estado de tu trámite con tu CUT.",
    ruta: "/consulta",
    orden: 60,
    publico: true,
    rolesPermitidos: [],
  },
  {
    id: "validador",
    familia: "validez",
    titulo: "Validador CVD",
    subtitulo: "MOD-04 / Verificación",
    descripcion:
      "Valida la autenticidad e integridad de documentos firmados digitalmente mediante el Código de Verificación de Documentos.",
    ruta: "/validador-cvd",
    orden: 70,
    publico: true,
    rolesPermitidos: [],
  },
  {
    id: "flujo-validez",
    familia: "validez",
    titulo: "Flujo y Validez Legal",
    subtitulo: "MOD-04 / Firma Digital",
    descripcion:
      "Tramitación con plena validez legal: firma digital, re-firma, workflow académico y verificación pública de documentos (CVD).",
    ruta: "/flujo-validez-legal",
    destacado: true,
    orden: 80,
    publico: false,
    rolesPermitidos: ["SUPER_ADMIN", "DIRECTOR", "DOCENTE"],
    moduloPermiso: "Documentos",
  },
  {
    id: "titulacion",
    familia: "validez",
    titulo: "Workflow Titulación",
    subtitulo: "ENT-M04-01",
    descripcion:
      "Evaluación académica de proyectos de titulación y derivación de actuados.",
    ruta: "/flujos/titulacion",
    orden: 90,
    publico: false,
    rolesPermitidos: ["SUPER_ADMIN", "DIRECTOR", "DOCENTE"],
    moduloPermiso: "Expedientes",
  },
  {
    id: "proyector",
    familia: "validez",
    titulo: "Proyector de Resoluciones",
    subtitulo: "ENT-M04-02 · Isaí",
    descripcion:
      "Bandeja de proyectos de resolución directoral con correlativo, estados y pase a firma.",
    ruta: "/flujos/proyector-resoluciones",
    orden: 95,
    publico: false,
    rolesPermitidos: ["SUPER_ADMIN", "DIRECTOR", "DOCENTE"],
    moduloPermiso: "Documentos",
  },
  {
    id: "administracion",
    familia: "gobierno",
    titulo: "Panel de Administración",
    subtitulo: "ENT-M05-01 / RBAC",
    descripcion:
      "Gestión de usuarios, roles, permisos, auditoría, tablas maestras y calendario laboral.",
    ruta: "/administracion",
    orden: 100,
    publico: false,
    rolesPermitidos: ["SUPER_ADMIN", "DIRECTOR"],
    moduloPermiso: "Administración",
  },
  {
    id: "reportes",
    familia: "gobierno",
    titulo: "Reportes y Tableros de Control",
    subtitulo: "06_reportes-tablero-control",
    descripcion:
      "Consulta indicadores ejecutivos, tendencias, distribución de expedientes y áreas con cuellos de botella.",
    ruta: "/reportes/dashboard",
    orden: 110,
    publico: false,
    rolesPermitidos: ["SUPER_ADMIN", "DIRECTOR"],
    moduloPermiso: "Auditoría",
  },
];

export function leerSesion(): { rol: RolCanonico | null; autenticado: boolean } {
  try {
    const token = window.localStorage.getItem(CLAVE_TOKEN);
    const rolCrudo = window.localStorage.getItem(CLAVE_ROL);
    const rol = ROLES_CANONICOS.includes(rolCrudo as RolCanonico)
      ? (rolCrudo as RolCanonico)
      : null;
    return { rol, autenticado: Boolean(token) && Boolean(rol) };
  } catch {
    return { rol: null, autenticado: false };
  }
}

/** Hook reactivo al login/logout (escucha storage + evento sigd:sesion). */
export function useSesion(): { rol: RolCanonico | null; autenticado: boolean } {
  const [sesion, setSesion] = useState(() => leerSesionSeguro());

  useEffect(() => {
    const actualizar = () => {
      const actual = leerSesionSeguro();
      setSesion((prev) =>
        prev.rol === actual.rol && prev.autenticado === actual.autenticado
          ? prev
          : actual,
      );
    };
    actualizar();
    window.addEventListener("storage", actualizar);
    window.addEventListener("sigd:sesion", actualizar);
    return () => {
      window.removeEventListener("storage", actualizar);
      window.removeEventListener("sigd:sesion", actualizar);
    };
  }, []);

  return sesion;
}

function leerSesionSeguro(): { rol: RolCanonico | null; autenticado: boolean } {
  try {
    return leerSesion();
  } catch {
    return { rol: null, autenticado: false };
  }
}

/** ¿Este rol autenticado puede ver el módulo?
 *  Sin sesión: solo módulos públicos.
 *  Con sesión: SOLO los módulos correspondientes a su rol.
 *  (Si rolesPermitidos está vacío = visible para todo autenticado, ej. Consulta/Validador).
 */
export function puedeVerModulo(
  modulo: DefinicionModulo,
  rol: RolCanonico | null,
  autenticado: boolean,
): boolean {
  if (!autenticado || !rol) return modulo.publico;
  if (modulo.rolesPermitidos.length === 0) return true;
  return modulo.rolesPermitidos.includes(rol);
}

/** Lista filtrada para Home/Header según la sesión actual. Siempre ordenada por `orden`. */
export function filtrarModulosPorRol(
  rol: RolCanonico | null,
  autenticado: boolean,
): DefinicionModulo[] {
  return MODULOS_VISIBLES.filter((m) => puedeVerModulo(m, rol, autenticado)).sort(
    (a, b) => a.orden - b.orden,
  );
}

/** Notifica a los hooks que la sesión cambió (llamar tras login/logout). */
export function notificarCambioSesion(): void {
  try {
    window.dispatchEvent(new Event("sigd:sesion"));
  } catch {
    // entorno sin DOM (tests)
  }
}
