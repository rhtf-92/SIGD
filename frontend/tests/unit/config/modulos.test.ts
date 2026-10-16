import { describe, expect, it } from "vitest";

import {
  MODULOS,
  modulosHeaderParaRol,
  modulosParaRol,
  normalizarRolCanonico,
  puedeAcceder,
} from "../../../src/config/modulos";

const ids = (rol: Parameters<typeof modulosParaRol>[0]) =>
  modulosParaRol(rol).map((modulo) => modulo.id);

describe("Catálogo de módulos por rol (RBAC de navegación)", () => {
  it("sin sesión solo expone módulos públicos", () => {
    expect(ids(null)).toEqual(["registro", "validador-cvd"]);
  });

  it("ESTUDIANTE ve exactamente Registro, Casilla, Mesa de Partes y Validador", () => {
    expect(ids("ESTUDIANTE")).toEqual([
      "registro",
      "casilla",
      "mesa-partes",
      "validador-cvd",
    ]);
  });

  it("MESA_PARTES ve ventanilla y no administración", () => {
    const visibles = ids("MESA_PARTES");
    expect(visibles).toContain("ventanilla");
    expect(visibles).toContain("expedientes");
    expect(visibles).not.toContain("administracion");
    expect(visibles).not.toContain("reportes");
  });

  it("DOCENTE ve flujos académicos y no administración ni reportes", () => {
    const visibles = ids("DOCENTE");
    expect(visibles).toContain("titulacion");
    expect(visibles).toContain("validez-legal");
    expect(visibles).not.toContain("administracion");
    expect(visibles).not.toContain("reportes");
  });

  it("DIRECTOR ve administración y reportes", () => {
    const visibles = ids("DIRECTOR");
    expect(visibles).toContain("administracion");
    expect(visibles).toContain("reportes");
  });

  it("SUPER_ADMIN accede a todos los módulos del catálogo", () => {
    expect(modulosParaRol("SUPER_ADMIN")).toHaveLength(MODULOS.length);
  });

  it("los accesos rápidos de cabecera respetan el rol", () => {
    expect(modulosHeaderParaRol("ESTUDIANTE").map((m) => m.id)).toEqual([
      "casilla",
      "mesa-partes",
      "validador-cvd",
    ]);
  });

  describe("puedeAcceder", () => {
    it("permite módulos públicos sin rol", () => {
      expect(puedeAcceder(null, "validador-cvd")).toBe(true);
      expect(puedeAcceder(null, "registro")).toBe(true);
    });

    it("niega módulos privados sin rol", () => {
      expect(puedeAcceder(null, "casilla")).toBe(false);
      expect(puedeAcceder(null, "administracion")).toBe(false);
    });

    it("respeta la matriz rol-módulo", () => {
      expect(puedeAcceder("ESTUDIANTE", "casilla")).toBe(true);
      expect(puedeAcceder("ESTUDIANTE", "administracion")).toBe(false);
      expect(puedeAcceder("MESA_PARTES", "ventanilla")).toBe(true);
      expect(puedeAcceder("DOCENTE", "reportes")).toBe(false);
      expect(puedeAcceder("DIRECTOR", "reportes")).toBe(true);
    });

    it("SUPER_ADMIN accede a cualquier módulo existente", () => {
      for (const modulo of MODULOS) {
        expect(puedeAcceder("SUPER_ADMIN", modulo.id)).toBe(true);
      }
    });

    it("rechaza módulos inexistentes", () => {
      expect(puedeAcceder("SUPER_ADMIN", "inexistente")).toBe(false);
    });
  });

  describe("normalizarRolCanonico", () => {
    it("mapea alias del backend a los 5 roles canónicos", () => {
      expect(normalizarRolCanonico("ADMINISTRADOR")).toBe("SUPER_ADMIN");
      expect(normalizarRolCanonico("SECRETARIO")).toBe("DOCENTE");
      expect(normalizarRolCanonico("ESPECIALISTA")).toBe("DOCENTE");
      expect(normalizarRolCanonico("CIUDADANO")).toBe("ESTUDIANTE");
      expect(normalizarRolCanonico("estudiante")).toBe("ESTUDIANTE");
      expect(normalizarRolCanonico("DOCENTE")).toBe("DOCENTE");
    });

    it("devuelve null ante códigos desconocidos o vacíos", () => {
      expect(normalizarRolCanonico("NO_EXISTE")).toBeNull();
      expect(normalizarRolCanonico(null)).toBeNull();
      expect(normalizarRolCanonico(undefined)).toBeNull();
    });
  });
});
