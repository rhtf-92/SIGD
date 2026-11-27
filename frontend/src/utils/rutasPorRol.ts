import type { RolCanonicoId } from "../services/authService";

export const RUTA_INICIAL_POR_ROL: Record<RolCanonicoId, string> = {
  SUPER_ADMIN: "/administracion",
  DIRECTOR: "/flujo-validez-legal",
  DOCENTE: "/expedientes",
  MESA_PARTES: "/tramite/ventanilla-presencial",
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

export function obtenerRutaSolicitada(estado: unknown, busqueda: string): string | null {
  const desdeEstado = (estado as { from?: unknown } | null)?.from;
  const desdeQuery = new URLSearchParams(busqueda).get("from");
  const candidato =
    typeof desdeEstado === "string"
      ? desdeEstado
      : desdeEstado && typeof desdeEstado === "object"
        ? (() => {
            const { pathname, search, hash } = desdeEstado as {
              pathname?: unknown;
              search?: unknown;
              hash?: unknown;
            };
            return typeof pathname === "string"
              ? `${pathname}${typeof search === "string" ? search : ""}${typeof hash === "string" ? hash : ""}`
              : null;
          })()
        : desdeQuery;

  return candidato && candidato.startsWith("/") && !candidato.startsWith("//")
    ? candidato
    : null;
}
