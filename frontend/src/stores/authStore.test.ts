import { describe, expect, it, vi, beforeEach } from "vitest";
import { apiClient } from "../api/client";
import { useAuthStore } from "./authStore";

vi.mock("../api/client", () => ({
  apiClient: { post: vi.fn(), defaults: { baseURL: "https://sigd.example/api" } },
}));

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
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