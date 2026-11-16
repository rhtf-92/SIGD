import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../src/api/client";
import { useRbacConfig } from "../../../src/hooks/useRbacConfig";
vi.mock("../../../src/api/client", () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
const roleId = "11111111-1111-4111-8111-111111111111";
const permissionId = "22222222-2222-4222-8222-222222222222";
const config = {
  roles: [{ id: roleId, codigo: "ADMINISTRADOR", nombre: "Administrador", descripcion: null, vigente: true, usuarios: 0, permisos: [] }],
  catalogoPermisos: [{ id: permissionId, codigo: "ADMIN_USUARIOS", nombre: "Administrar usuarios y roles", ambito: "GLOBAL" }],
};
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
describe("RBAC institucional persistido", () => {
  it("consulta los roles reales sin inventar cuentas o asignaciones", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: config });
    const { result } = renderHook(() => useRbacConfig());
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.roles).toEqual(config.roles);
    expect(result.current.rolActual?.codigo).toBe("ADMINISTRADOR");
    expect(result.current.permisosSeleccionados).toEqual([]);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/admin/roles-permisos");
  });
  it("una denegación no se reemplaza por roles o permisos locales", async () => {
    localStorage.setItem("sigd_permisos", JSON.stringify({ SUPER_ADMIN: [{ ver: true }] }));
    vi.mocked(apiClient.get).mockRejectedValue(new Error("Acceso denegado"));
    const { result } = renderHook(() => useRbacConfig());
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.roles).toEqual([]);
    expect(result.current.error).toBe("Acceso denegado");
  });
  it("guarda IDs institucionales en el endpoint original y confirma mediante una nueva lectura", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: config })
      .mockResolvedValueOnce({ data: { ...config, roles: [{ ...config.roles[0], permisos: ["ADMIN_USUARIOS"] }] } });
    vi.mocked(apiClient.put).mockResolvedValue({ status: 200 });
    const { result } = renderHook(() => useRbacConfig());
    await waitFor(() => expect(result.current.cargando).toBe(false));
    act(() => result.current.alternarPermiso(permissionId));
    await act(async () => { await result.current.guardarPermisos(); });
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/roles/" + roleId + "/permisos", { permisos: [permissionId] });
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(result.current.mensaje).toContain("confirmados");
    expect(localStorage.getItem("sigd_permisos")).toBeNull();
  });
  it("evita dos envíos simultáneos y conserva el borrador cuando falla el servidor", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: config });
    let rechazar!: (e: Error) => void;
    vi.mocked(apiClient.put).mockReturnValue(new Promise((_resolve, reject) => { rechazar = reject; }));
    const { result } = renderHook(() => useRbacConfig());
    await waitFor(() => expect(result.current.cargando).toBe(false));
    act(() => result.current.alternarPermiso(permissionId));
    let envio!: Promise<void>;
    act(() => { envio = result.current.guardarPermisos(); void result.current.guardarPermisos(); });
    expect(apiClient.put).toHaveBeenCalledTimes(1);
    await act(async () => { rechazar(new Error("Servicio no disponible")); await envio; });
    expect(result.current.permisosSeleccionados).toEqual([permissionId]);
    expect(result.current.mensaje).toBe("");
    expect(result.current.error).toBe("Servicio no disponible");
  });
});
