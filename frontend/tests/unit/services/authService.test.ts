import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/api/client", () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from "../../../src/api/client";
import {
  autenticarCredenciales,
  destinoPorRol,
} from "../../../src/services/authService";
import { ApiHttpError, type ApiProblemDetails } from "../../../src/types/api";

const post = vi.mocked(apiClient.post);

function problema(status: number, code: string, detail: string): ApiHttpError {
  return new ApiHttpError({
    type: "https://sigd.iestpsuiza.edu.pe/errors/security",
    title: "Error",
    status,
    detail,
    instance: "/api/v1/auth/login",
    code,
    category: "Security",
    correlationId: "corr-test",
    retryable: false,
  } satisfies ApiProblemDetails);
}

describe("authService — autenticación real contra la API", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("rechaza identificador vacío sin llamar a la API", async () => {
    const res = await autenticarCredenciales({
      identificador: "   ",
      password: "ClaveSegura2026",
    });

    expect(res.exito).toBe(false);
    if (!res.exito) expect(res.codigoError).toBe("CAMPOS_VACIOS");
    expect(post).not.toHaveBeenCalled();
  });

  it("rechaza contraseña vacía sin llamar a la API", async () => {
    const res = await autenticarCredenciales({
      identificador: "admin.demo",
      password: "",
    });

    expect(res.exito).toBe(false);
    if (!res.exito) expect(res.codigoError).toBe("CAMPOS_VACIOS");
    expect(post).not.toHaveBeenCalled();
  });

  it("envía el contrato real y normaliza la respuesta del backend", async () => {
    post.mockResolvedValueOnce({
      data: {
        accessToken: "access-token-real",
        refreshToken: "refresh-token-real",
        usuario: {
          id: "00000000-0000-0000-0000-000000000011",
          nombreCompleto: "Administrador Demo",
          correo: "admin.demo@iestpsuiza.edu.pe",
          rol: "MESA_PARTES",
        },
      },
    });

    const res = await autenticarCredenciales({
      identificador: "admin.demo",
      password: "ClaveSegura2026",
    });

    expect(post).toHaveBeenCalledWith("/api/v1/auth/login", {
      identificador: "admin.demo",
      password: "ClaveSegura2026",
    });
    expect(res.exito).toBe(true);
    if (res.exito) {
      expect(res.token).toBe("access-token-real");
      expect(res.refreshToken).toBe("refresh-token-real");
      expect(res.usuario.rol).toBe("MESA_PARTES");
      expect(res.destino).toBe("/tramite/ventanilla-presencial");
    }
  });

  it("traduce credenciales inválidas (401)", async () => {
    post.mockRejectedValueOnce(
      problema(401, "UNAUTHORIZED", "Credenciales inválidas."),
    );

    const res = await autenticarCredenciales({
      identificador: "usuario",
      password: "ClaveIncorrecta",
    });

    expect(res.exito).toBe(false);
    if (!res.exito) {
      expect(res.codigoError).toBe("CREDENCIALES_INVALIDAS");
      expect(res.mensaje).toMatch(/credenciales inválidas/i);
    }
  });

  it("traduce cuenta deshabilitada (403 ACCOUNT_DISABLED)", async () => {
    post.mockRejectedValueOnce(
      problema(403, "ACCOUNT_DISABLED", "Cuenta deshabilitada."),
    );

    const res = await autenticarCredenciales({
      identificador: "inactivo",
      password: "ClaveSegura2026",
    });

    expect(res.exito).toBe(false);
    if (!res.exito) expect(res.codigoError).toBe("CUENTA_SUSPENDIDA");
  });

  it("usa destino por defecto para roles no canónicos", () => {
    expect(destinoPorRol("SUPER_ADMIN")).toBe("/");
    expect(destinoPorRol("DIRECTOR")).toBe("/");
    expect(destinoPorRol("DOCENTE")).toBe("/flujos/titulacion");
    expect(destinoPorRol("MESA_PARTES")).toBe("/tramite/ventanilla-presencial");
    expect(destinoPorRol("ESTUDIANTE")).toBe("/casilla");
    expect(destinoPorRol("ROL_DESCONOCIDO")).toBe("/casilla");
    expect(destinoPorRol("ADMINISTRADOR")).toBe("/");
    expect(destinoPorRol("SECRETARIO")).toBe("/flujos/titulacion");
    expect(destinoPorRol("ESPECIALISTA")).toBe("/flujos/titulacion");
    expect(destinoPorRol("CIUDADANO")).toBe("/casilla");
  });
});
