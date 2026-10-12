import { describe, expect, it, vi, beforeEach } from "vitest";
import { apiClient } from "../api/client";
import { useAuthStore } from "./authStore";

vi.mock("../api/client", () => ({
  apiClient: { post: vi.fn(), defaults: { baseURL: "https://sigd.example/api" } },
}));

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false,
      tokenSeleccionPerfil: null, rolesDisponibles: [] });
  });

  it("login() multirrol no autentica hasta seleccionar un perfil validado", async () => {
    const rolesDisponibles = [
      { id: "r1", codigo: "ADMINISTRADOR", nombre: "Administrador" },
      { id: "r2", codigo: "DIRECTOR", nombre: "Director" },
    ];
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { requiereSeleccionPerfil: true, tokenSeleccionPerfil: "selection-token", rolesDisponibles },
    });

    const ingresoDirecto = await useAuthStore.getState().login({ identificador: "juan", password: "pass123" });

    expect(ingresoDirecto).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().rolesDisponibles).toEqual(rolesDisponibles);

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { accessToken: "tok-r2", refreshToken: "rtok-r2", usuario: {
        id: "u1", nombreCompleto: "Juan", correo: "juan@inst.edu.pe", rol: "DIRECTOR", roles: ["DIRECTOR"] } },
    });
    await useAuthStore.getState().seleccionarPerfil("r2");

    expect(apiClient.post).toHaveBeenLastCalledWith("/api/v1/auth/seleccionar-perfil", {
      tokenSeleccionPerfil: "selection-token", rolId: "r2",
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().usuario?.rol).toBe("DIRECTOR");
    expect(useAuthStore.getState().rolesDisponibles).toEqual([]);
  });

  it("cambiarPerfil() rota ambos tokens con el perfil validado por backend", async () => {
    useAuthStore.setState({ accessToken: "tok-admin", refreshToken: "rtok-admin", usuario: {
      id: "u1", nombreCompleto: "Juan", correo: "juan@inst.edu.pe", rol: "ADMINISTRADOR" }, isAuthenticated: true });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: {
      accessToken: "tok-director", refreshToken: "rtok-director",
      usuario: { id: "u1", nombreCompleto: "Juan", correo: "juan@inst.edu.pe", rol: "DIRECTOR" },
    } });

    await useAuthStore.getState().cambiarPerfil("r2");

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/auth/cambiar-perfil", { refreshToken: "rtok-admin", rolId: "r2" });
    expect(useAuthStore.getState().accessToken).toBe("tok-director");
    expect(useAuthStore.getState().refreshToken).toBe("rtok-director");
    expect(useAuthStore.getState().usuario?.rol).toBe("DIRECTOR");
  });

  it("login() exitoso guarda accessToken, refreshToken, usuario e isAuthenticated en true", async () => {
    const mockUsuario = { id: "u1", nombreCompleto: "Juan Perez", correo: "juan@inst.edu.pe", rol: "DOCENTE", permisos: {} };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { accessToken: "tok-1", refreshToken: "rtok-1", usuario: mockUsuario },
    });

    await useAuthStore.getState().login({ identificador: "juan", password: "pass" });

    expect(useAuthStore.getState().accessToken).toBe("tok-1");
    expect(useAuthStore.getState().refreshToken).toBe("rtok-1");
    expect(useAuthStore.getState().usuario).toEqual(mockUsuario);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/auth/login", { identificador: "juan", password: "pass" });
  });

  it("logout() limpia todos los campos a null/false", () => {
    useAuthStore.setState({ accessToken: "tok", refreshToken: "rtok", usuario: { id: "1", nombreCompleto: "X", correo: "x@x.pe", rol: "DOCENTE" }, isAuthenticated: true });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().usuario).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("setToken() actualiza el accessToken conservando el refreshToken si no se pasa uno nuevo", () => {
    useAuthStore.setState({ accessToken: "old", refreshToken: "old-rt", isAuthenticated: false });

    useAuthStore.getState().setToken("new");

    expect(useAuthStore.getState().accessToken).toBe("new");
    expect(useAuthStore.getState().refreshToken).toBe("old-rt");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
