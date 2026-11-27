import type { RolCanonicoId } from "../services/authService";

export const RUTA_INICIAL_POR_ROL: Record<RolCanonicoId, string> = {
  SUPER_ADMIN: "/administracion",
  DIRECTOR: "/flujo-validez-legal",
  DOCENTE: "/expedientes",
  MESA_PARTES: "/tramite/mesa-partes-virtual",
  ESTUDIANTE: "/casilla",
};

function esRolCanonico(rol: string): rol is RolCanonicoId {
  return Object.hasOwn(RUTA_INICIAL_POR_ROL, rol);
}

export function obtenerRutaInicialPorRol(rol: string | null | undefined): string {
  if (rol && esRolCanonico(rol)) {
    return RUTA_INICIAL_POR_ROL[rol];
  }
  return "/acceso-denegado";
}
