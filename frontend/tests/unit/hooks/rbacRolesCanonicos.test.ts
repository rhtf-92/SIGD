import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useRbacConfig } from "../../../src/hooks/useRbacConfig";

describe("Suite de Pruebas de Gobernanza RBAC y roles heredados de la matriz (BR-08 / ENT-M05-03)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("incluye exactamente los 4 roles heredados de la matriz", () => {
    const { result } = renderHook(() => useRbacConfig());
    const ids = result.current.roles.map((r) => r.id);

    expect(ids).toContain("ADMINISTRADOR");
    expect(ids).toContain("DIRECTOR");
    expect(ids).toContain("MESA_PARTES");
    expect(ids).toContain("CIUDADANO");
    expect(result.current.roles).toHaveLength(4);
  });

  it("ADMINISTRADOR inicia como rol seleccionado por defecto con permisos completos", () => {
    const { result } = renderHook(() => useRbacConfig());

    expect(result.current.rolSeleccionado).toBe("ADMINISTRADOR");
    expect(result.current.rolActual.nombre).toBe("Administrador");

    const permisoExpedientes = result.current.permisosRolActual.find(
      (p) => p.modulo === "Expedientes",
    );
    expect(permisoExpedientes?.ver).toBe(true);
    expect(permisoExpedientes?.crear).toBe(true);
    expect(permisoExpedientes?.editar).toBe(true);
    expect(permisoExpedientes?.eliminar).toBe(true);
  });

  it("Invariante WORM: el módulo Auditoría jamás admite mutaciones (crear, editar, eliminar, archivar)", () => {
    const { result } = renderHook(() => useRbacConfig());

    for (const rol of result.current.roles) {
      act(() => {
        result.current.setRolSeleccionado(rol.id);
      });

      const permisoAuditoria = result.current.permisosRolActual.find(
        (p) => p.modulo === "Auditoría",
      );

      expect(permisoAuditoria?.crear).toBe(false);
      expect(permisoAuditoria?.editar).toBe(false);
      expect(permisoAuditoria?.eliminar).toBe(false);
      expect(permisoAuditoria?.archivar).toBe(false);
      expect(permisoAuditoria?.derivar).toBe(false);
    }
  });

  it("permite conmutar roles y alternar permisos autorizados", () => {
    const { result } = renderHook(() => useRbacConfig());

    act(() => {
      result.current.setRolSeleccionado("CIUDADANO");
    });

    expect(result.current.rolActual.nombre).toBe("Ciudadano / Administrado");

    // Alternar permiso 'exportar' en índice 0 (Expedientes)
    act(() => {
      result.current.alternarPermiso(0, "exportar");
    });

    const permisoActualizado = result.current.permisosRolActual[0];
    expect(permisoActualizado?.exportar).toBe(true);
  });
});
