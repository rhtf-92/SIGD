import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ActivarCuentaPage from "../../../src/pages/registro/ActivarCuentaPage";
import { apiClient } from "../../../src/api/client";
import { ApiHttpError } from "../../../src/types/api";

describe("ActivarCuentaPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("activa la cuenta automáticamente cuando recibe token por URL y muestra mensaje de éxito y enlace al login", async () => {
    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        exito: true,
        mensaje: "Cuenta activada exitosamente. Su Casilla Electrónica Institucional ha sido habilitada.",
        idUsuario: "usr-uuid-1",
        correo: "ciudadano@example.com",
      },
    } as never);

    render(
      <MemoryRouter initialEntries={["/activar-cuenta?token=valid-token-1234567890"]}>
        <ActivarCuentaPage />
      </MemoryRouter>
    );

    expect(postSpy).toHaveBeenCalledWith("/api/v1/auth/activar-cuenta", {
      token: "valid-token-1234567890",
    });

    const exitoAlert = await screen.findByRole("alert");
    expect(exitoAlert).toHaveTextContent(/¡Activación Exitosa!/i);
    expect(exitoAlert).toHaveTextContent(/Casilla Electrónica/i);

    const botonLogin = screen.getByRole("button", { name: /Iniciar Sesión en el SIGD/i });
    expect(botonLogin).toBeInTheDocument();
  });

  it("muestra error claro y formulario de reenvío cuando el token ha expirado (HTTP 410)", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValueOnce(
      new ApiHttpError({
        type: "about:blank",
        title: "Token expirado",
        status: 410,
        detail: "El enlace de activación ha expirado.",
        instance: "/api/v1/auth/activar-cuenta",
        code: "TOKEN_EXPIRADO",
        category: "Business",
        correlationId: "test-corr",
        retryable: false,
      })
    );

    render(
      <MemoryRouter initialEntries={["/activar-cuenta?token=expired-token-1234567890"]}>
        <ActivarCuentaPage />
      </MemoryRouter>
    );

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toHaveTextContent(/ha expirado/i);
    expect(screen.getByText(/¿Necesita un nuevo enlace de activación\?/i)).toBeInTheDocument();
  });

  it("muestra mensaje orientador y opción de login si el token ya fue utilizado (HTTP 409)", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValueOnce(
      new ApiHttpError({
        type: "about:blank",
        title: "Token ya utilizado",
        status: 409,
        detail: "Este enlace de activación ya ha sido utilizado previamente.",
        instance: "/api/v1/auth/activar-cuenta",
        code: "TOKEN_YA_UTILIZADO",
        category: "Business",
        correlationId: "test-corr",
        retryable: false,
      })
    );

    render(
      <MemoryRouter initialEntries={["/activar-cuenta?token=used-token-1234567890"]}>
        <ActivarCuentaPage />
      </MemoryRouter>
    );

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toHaveTextContent(/ya ha sido utilizado previamente/i);
    expect(screen.getByRole("button", { name: /Ir a Iniciar Sesión/i })).toBeInTheDocument();
  });

  it("permite solicitar un nuevo enlace de activación mediante el formulario de reenvío", async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        exito: true,
        mensaje: "Se ha enviado un nuevo enlace de activación a su correo electrónico.",
      },
    } as never);

    render(
      <MemoryRouter initialEntries={["/activar-cuenta"]}>
        <ActivarCuentaPage />
      </MemoryRouter>
    );

    const inputReenvio = screen.getByPlaceholderText(/DNI, RUC o Correo electrónico/i);
    await user.type(inputReenvio, "74561238");

    const botonReenviar = screen.getByRole("button", { name: /Reenviar enlace de activación/i });
    await user.click(botonReenviar);

    expect(postSpy).toHaveBeenCalledWith("/api/v1/auth/reenviar-verificacion", {
      identificador: "74561238",
    });

    const statusMsg = await screen.findByRole("status");
    expect(statusMsg).toHaveTextContent(/Se ha enviado un nuevo enlace de activación/i);
  });
});
