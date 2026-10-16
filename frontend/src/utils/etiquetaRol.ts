import type { RolCanonicoId } from "../types/rbacRoles";

export const ETIQUETA_ROL: Record<RolCanonicoId, string> = {
  SUPER_ADMIN: "Super Administrador",
  DIRECTOR: "Director General",
  DOCENTE: "Docente / Coordinador",
  MESA_PARTES: "Mesa de Partes / Ventanilla",
  ESTUDIANTE: "Estudiante / Administrado",
};