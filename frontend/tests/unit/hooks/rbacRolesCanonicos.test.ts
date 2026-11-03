import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useRbacConfig } from "../../../src/hooks/useRbacConfig";
import { apiClient } from "../../../src/api/client";

describe("Suite de Pruebas de Gobernanza RBAC y 5 Roles Canónicos Institucionales (BR-08 / ENT-M05-03)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("incluye exactamente los 5 roles canónicos institucionales del IESTP Suiza", () => {
    const { result } = renderHook(() => useRbacConfig());
    const ids = result.current.roles.map((r) => r.id);

    expect(ids).toContain("SUPER_ADMIN");
    expect(ids).toContain("DIRECTOR");
    expect(ids).toContain("DOCENTE");
    expect(ids).toContain("MESA_PARTES");
    expect(ids).toContain("ESTUDIANTE");
    expect(result.current.roles).toHaveLength(5);
  });

  it("SUPER_ADMIN inicia como rol seleccionado por defecto con permisos completos", () => {
    const { result } = renderHook(() => useRbacConfig());

    expect(result.current.rolSeleccionado).toBe("SUPER_ADMIN");
    expect(result.current.rolActual.nombre).toBe("Super Administrador");

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
      result.current.setRolSeleccionado("DOCENTE");
    });

    expect(result.current.rolActual.nombre).toBe("Docente / Coordinador");

    // Alternar permiso 'exportar' en índice 0 (Expedientes)
    act(() => {
      result.current.alternarPermiso(0, "exportar");
    });

    const permisoActualizado = result.current.permisosRolActual[0];
    expect(permisoActualizado?.exportar).toBe(false);
  });

  it("muestra la cantidad real de cuentas por rol y no cifras de ejemplo", async () => {
    localStorage.setItem("sigd_token", "token-test");
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: { roles: [
      { codigo: "ADMINISTRADOR", permisos: [], usuarios: 7 },
      { codigo: "DIRECTOR", permisos: [], usuarios: 2 },
    ] } } as never);
    const { result } = renderHook(() => useRbacConfig());
    await waitFor(() => expect(result.current.roles.find((role) => role.id === "SUPER_ADMIN")?.usuarios).toBe(7));
    expect(result.current.roles.find((role) => role.id === "DIRECTOR")?.usuarios).toBe(2);
    vi.restoreAllMocks();
  });

  it("restaura la matriz previa si el servidor rechaza el guardado", async () => {
    localStorage.setItem("sigd_token", "token-test");
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: { roles: [
      { codigo: "ADMINISTRADOR", permisos: ["ADMIN_USUARIOS"], usuarios: 1 },
    ] } } as never);
    vi.spyOn(apiClient, "put").mockRejectedValue(new Error("El servidor rechazó la matriz"));
    const { result } = renderHook(() => useRbacConfig());
    await waitFor(() => expect(result.current.permisosRolActual.find((item) => item.modulo === "Administración")?.editar).toBe(true));
    act(() => result.current.alternarPermiso(2, "editar"));
    expect(result.current.permisosRolActual[2].editar).toBe(false);
    await act(async () => { await result.current.guardarPermisos(); });
    expect(result.current.permisosRolActual[2].editar).toBe(true);
    expect(result.current.mensaje).toMatch(/no fue posible guardar/i);
    vi.restoreAllMocks();
  });

  it("expone error de carga y permite reintentar la sincronización desde PostgreSQL", async () => {
    localStorage.setItem("sigd_token", "token-test");
    const get = vi.spyOn(apiClient, "get")
      .mockRejectedValueOnce(new Error("API no disponible"))
      .mockResolvedValueOnce({ data: { roles: [{ codigo: "ADMINISTRADOR", permisos: ["ADMIN_USUARIOS"], usuarios: 3 }] } } as never);
    const { result } = renderHook(() => useRbacConfig());
    await waitFor(() => expect(result.current.isError).toBe(true));
    await act(async () => { await result.current.recargar(); });
    expect(result.current.isError).toBe(false);
    expect(result.current.roles.find((role) => role.id === "SUPER_ADMIN")?.usuarios).toBe(3);
    expect(get).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});
