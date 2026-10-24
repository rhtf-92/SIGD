import { afterEach, describe, expect, it } from "vitest";

import {
  accesosHomeVisiblesPara,
  esVisibleParaRol,
  seccionesVisiblesPara,
  tieneAccesoModulo,
} from "./routeMeta";

afterEach(() => {
  window.localStorage.removeItem("sigd_permisos");
});

describe("módulos por rol (routeMeta)", () => {
  it("sin sesión solo muestra lo público", () => {
    const secciones = seccionesVisiblesPara("", false);
    const rutas = secciones.flatMap((s) => s.accesos.map((a) => a.to));
    expect(rutas).toContain("/tramite");
    expect(rutas).not.toContain("/casilla");
    expect(rutas).not.toContain("/administracion");
  });

  it("ESTUDIANTE no ve administración ni reportes ni ventanilla", () => {
    expect(esVisibleParaRol({ publico: false, roles: ["SUPER_ADMIN", "DIRECTOR"] }, "ESTUDIANTE", true)).toBe(false);
    const rutas = seccionesVisiblesPara("ESTUDIANTE", true).flatMap((s) =>
      s.accesos.map((a) => a.to),
    );
    expect(rutas).toContain("/casilla");
    expect(rutas).not.toContain("/administracion");
    expect(rutas).not.toContain("/reportes/dashboard");
    expect(rutas).not.toContain("/tramite/ventanilla-presencial");
  });

  it("MESA_PARTES ve ventanilla pero no administración", () => {
    const rutas = seccionesVisiblesPara("MESA_PARTES", true).flatMap((s) =>
      s.accesos.map((a) => a.to),
    );
    expect(rutas).toContain("/tramite/ventanilla-presencial");
    expect(rutas).toContain("/expedientes");
    expect(rutas).not.toContain("/administracion");
  });

  it("SUPER_ADMIN ve todos los módulos", () => {
    const rutas = seccionesVisiblesPara("SUPER_ADMIN", true).flatMap((s) =>
      s.accesos.map((a) => a.to),
    );
    for (const esperada of [
      "/casilla",
      "/expedientes",
      "/flujo-validez-legal",
      "/tramite/ventanilla-presencial",
      "/reportes/dashboard",
      "/administracion",
    ]) {
      expect(rutas).toContain(esperada);
    }
  });

  it("el home filtra igual y agrega login solo sin sesión", () => {
    const sinSesion = accesosHomeVisiblesPara("", false);
    expect(sinSesion.some((a) => a.to === "/login")).toBe(true);
    const estudiante = accesosHomeVisiblesPara("ESTUDIANTE", true);
    expect(estudiante.some((a) => a.to === "/login")).toBe(false);
    expect(estudiante.some((a) => a.to === "/administracion")).toBe(false);
  });

  it("sin matriz guardada respalda por roles", () => {
    expect(tieneAccesoModulo("SUPER_ADMIN", "Administración", "ver")).toBe(true);
    expect(
      esVisibleParaRol(
        { publico: false, roles: ["SUPER_ADMIN"], modulo: "Administración", accion: "ver" },
        "SUPER_ADMIN",
        true,
      ),
    ).toBe(true);
  });

  it("con matriz guardada oculta el módulo si el permiso fue revocado", () => {
    window.localStorage.setItem(
      "sigd_permisos",
      JSON.stringify({
        DIRECTOR: [
          { modulo: "Expedientes", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: false, exportar: true },
          { modulo: "Administración", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
        ],
      }),
    );
    expect(tieneAccesoModulo("DIRECTOR", "Administración", "ver")).toBe(false);
    const rutas = seccionesVisiblesPara("DIRECTOR", true).flatMap((s) =>
      s.accesos.map((a) => a.to),
    );
    expect(rutas).not.toContain("/administracion");
    // Los módulos con permiso vigente siguen visibles.
    expect(rutas).toContain("/reportes/dashboard");
  });
});
