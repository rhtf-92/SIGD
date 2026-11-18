import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../src/api/client";
import { AUTH_RETURN_TO_STORAGE_KEY, useAuthStore } from "../../../src/stores/authStore";

const originalAdapter = apiClient.defaults.adapter;
const originalLogout = useAuthStore.getState().logout;
const logout = vi.fn();

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, data, status, statusText: String(status), headers: {} };
}

function unauthorized(config: InternalAxiosRequestConfig): never {
  throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, {},
    response(config, { detail: "Acceso rechazado", category: "Security" }, 401));
}

describe("401 de login y conservación de la renovación existente", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    logout.mockClear();
    useAuthStore.setState({ accessToken: "access-anterior-del-doble", refreshToken: "refresh-anterior-del-doble", usuario: null, isAuthenticated: true, logout });
    localStorage.setItem("sigd_token", "access-anterior-del-doble");
    apiClient.defaults.adapter = async () => { throw new Error("Petición inesperada"); };
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false, logout: originalLogout });
    localStorage.clear();
    sessionStorage.clear();
  });

  it.each(["/api/v1/auth/login", "/api/v1/auth/login/", "/api/v1/auth/login?origen=web"])(
    "normaliza el 401 de %s sin refrescar, cerrar sesión ni modificar sus tokens", async (url) => {
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => unauthorized(config));
      apiClient.defaults.adapter = adapter;
      await expect(apiClient.post(url, { identificador: "operador", password: "solo-doble" }))
        .rejects.toMatchObject({ name: "ApiHttpError", status: 401, message: "Acceso rechazado" });
      expect(adapter).toHaveBeenCalledTimes(1);
      expect(logout).not.toHaveBeenCalled();
      expect(useAuthStore.getState().accessToken).toBe("access-anterior-del-doble");
      expect(useAuthStore.getState().refreshToken).toBe("refresh-anterior-del-doble");
      expect(localStorage.getItem("sigd_token")).toBe("access-anterior-del-doble");
    },
  );

  it("renueva una petición protegida, reintenta con el nuevo Bearer y almacena los tokens", async () => {
    const requests: string[] = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(config.url!);
      if (config.url === "/api/v1/auth/refresh") {
        expect(JSON.parse(config.data)).toEqual({ refreshToken: "refresh-anterior-del-doble" });
        return response(config, { accessToken: "access-renovado-del-doble", refreshToken: "refresh-renovado-del-doble" });
      }
      if (requests.length === 1) unauthorized(config);
      expect(config.headers.Authorization).toBe("Bearer access-renovado-del-doble");
      return response(config, { ok: true });
    };
    const result = await apiClient.get("/api/v1/tramites/ventanilla/cargo/CUT-DEL-DOBLE");
    expect(result.data).toEqual({ ok: true });
    expect(requests).toEqual([
      "/api/v1/tramites/ventanilla/cargo/CUT-DEL-DOBLE", "/api/v1/auth/refresh", "/api/v1/tramites/ventanilla/cargo/CUT-DEL-DOBLE",
    ]);
    expect(useAuthStore.getState()).toMatchObject({ accessToken: "access-renovado-del-doble", refreshToken: "refresh-renovado-del-doble" });
    expect(localStorage.getItem("sigd_token")).toBe("access-renovado-del-doble");
    expect(logout).not.toHaveBeenCalled();
  });

  it("no intenta refrescar una solicitud anÃ³nima rechazada", async () => {
    const requests: string[] = [];
    localStorage.removeItem("sigd_token");
    useAuthStore.setState({ accessToken: null, refreshToken: null, isAuthenticated: false });
    apiClient.defaults.adapter = async (config) => {
      requests.push(config.url!);
      unauthorized(config);
    };

    await expect(apiClient.post("/api/v1/tramites/radicacion-virtual", {}))
      .rejects.toMatchObject({ name: "ApiHttpError", status: 401 });
    expect(requests).toEqual(["/api/v1/tramites/radicacion-virtual"]);
    expect(logout).not.toHaveBeenCalled();
  });

  it("inyecta el Bearer existente en el POST de radicaciÃ³n", async () => {
    let request: InternalAxiosRequestConfig | undefined;
    apiClient.defaults.adapter = async (config) => {
      request = config;
      return response(config, { ok: true }, 201);
    };
    await apiClient.post("/api/v1/tramites/radicacion-virtual", { asunto: "Solicitud autenticada" });
    expect(request?.headers.Authorization).toBe("Bearer access-anterior-del-doble");
  });

  it("mantiene el cierre de sesión si falla la renovación de otra petición", async () => {
    const requests: string[] = [];
    window.history.replaceState({}, "", "/tramite/mesa-partes-virtual?borrador=1#confirmacion");
    apiClient.defaults.adapter = async (config) => { requests.push(config.url!); unauthorized(config); };
    await expect(apiClient.get("/api/v1/tramites/ventanilla/cargo/CUT-DEL-DOBLE"))
      .rejects.toMatchObject({ name: "ApiHttpError", status: 401 });
    expect(requests).toEqual(["/api/v1/tramites/ventanilla/cargo/CUT-DEL-DOBLE", "/api/v1/auth/refresh"]);
    expect(logout).toHaveBeenCalled();
    expect(sessionStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY)).toBe("/tramite/mesa-partes-virtual?borrador=1#confirmacion");
  });

  it("mantiene el cierre sin bucles cuando el reintento continúa devolviendo 401", async () => {
    const requests: string[] = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(config.url!);
      if (config.url === "/api/v1/auth/refresh") return response(config, { accessToken: "access-renovado-del-doble", refreshToken: "refresh-renovado-del-doble" });
      unauthorized(config);
    };
    await expect(apiClient.get("/api/v1/tramites/ventanilla/cargo/CUT-DEL-DOBLE"))
      .rejects.toMatchObject({ name: "ApiHttpError", status: 401 });
    expect(requests).toHaveLength(3);
    expect(logout).toHaveBeenCalled();
  });

  it.each(["/api/v1/auth/login-audit", "/api/v1/tramites?destino=/auth/login"])("no excluye del refresh otra ruta: %s", async (url) => {
    const requests: string[] = [];
    apiClient.defaults.adapter = async (config) => { requests.push(config.url!); unauthorized(config); };
    await expect(apiClient.get(url))
      .rejects.toMatchObject({ name: "ApiHttpError", status: 401 });
    expect(requests).toEqual([url, "/api/v1/auth/refresh"]);
    expect(logout).toHaveBeenCalled();
  });

  it("comparte un refresh entre peticiones protegidas concurrentes sin encolar el 401 del login", async () => {
    let refreshConfig: InternalAxiosRequestConfig | undefined;
    let completar!: (response: AxiosResponse) => void;
    const refreshPendiente = new Promise<AxiosResponse>((resolve) => { completar = resolve; });
    const requests: string[] = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(config.url!);
      if (config.url === "/api/v1/auth/refresh") {
        refreshConfig = config;
        return refreshPendiente;
      }
      if (config.url === "/api/v1/auth/login" || config.headers.Authorization !== "Bearer access-renovado-del-doble") unauthorized(config);
      return response(config, { ok: true });
    };
    const primera = apiClient.get("/api/v1/tramites/ventanilla/cargo/CUT-UNO");
    const segunda = apiClient.get("/api/v1/tramites/ventanilla/cargo/CUT-DOS");
    await vi.waitFor(() => expect(refreshConfig).toBeDefined());
    await expect(apiClient.post("/api/v1/auth/login", { identificador: "operador", password: "solo-doble" }))
      .rejects.toMatchObject({ status: 401 });
    expect(logout).not.toHaveBeenCalled();
    completar(response(refreshConfig!, { accessToken: "access-renovado-del-doble", refreshToken: "refresh-renovado-del-doble" }));
    const results = await Promise.all([primera, segunda]);
    expect(results.map((result) => result.data)).toEqual([{ ok: true }, { ok: true }]);
    expect(requests.filter((url) => url === "/api/v1/auth/refresh")).toHaveLength(1);
    expect(requests.filter((url) => url === "/api/v1/auth/login")).toHaveLength(1);
    expect(logout).not.toHaveBeenCalled();
  });
});
