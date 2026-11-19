import { describe, expect, it } from "vitest";

import { esSuperAdmin, PERMISOS, tienePermiso } from "./permissions";

describe("permisos canónicos del SIGD", () => {
  it("reconoce los códigos canónicos de migración 19", () => {
    expect(tienePermiso([PERMISOS.ADMIN_ACCESO, PERMISOS.CALENDARIO_LEER], PERMISOS.ADMIN_ACCESO)).toBe(true);
    expect(tienePermiso([PERMISOS.ADMIN_ACCESO], PERMISOS.USUARIOS_GESTIONAR)).toBe(false);
  });

  it("no acepta los alias anteriores como permisos de acceso", () => {
    expect(tienePermiso(["ADMIN_USUARIOS"], PERMISOS.ADMIN_ACCESO)).toBe(false);
  });

  it("reserva edición de roles al perfil SUPER_ADMIN normalizado", () => {
    expect(esSuperAdmin("SUPER_ADMIN")).toBe(true);
    expect(esSuperAdmin("DIRECTOR")).toBe(false);
    expect(esSuperAdmin("ADMINISTRADOR")).toBe(false);
  });
});
