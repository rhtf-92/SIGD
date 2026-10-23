import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import RegistroCiudadanoPage from "../../src/pages/registro/RegistroCiudadanoPage";
import { apiClient } from "../../src/api/client";

describe("F-04: RegistroCiudadanoPage — Fail-Closed Error Handling & Network Resilience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  async function llenarFormularioNatural(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/Número de Documento \*/i), "74561238");
    await user.type(screen.getByLabelText(/Nombres \*/i), "Sergio");
    await user.type(screen.getByLabelText(/Apellidos \*/i), "Serruche Panduro");
    await user.type(screen.getByLabelText(/Fecha de Nacimiento \*/i), "1998-05-15");
    await user.type(screen.getByLabelText(/Correo Electrónico \*/i), "sergio@example.com");
    await user.type(screen.getByLabelText(/Celular \*/i), "961234567");

    await user.selectOptions(
      screen.getByLabelText(/Seleccionar Provincia de Ucayali/i),
      "2501",
    );
    await user.selectOptions(screen.getByLabelText(/Seleccionar Distrito/i), "250101");
    await user.type(screen.getByLabelText(/Dirección Exacta/i), "Jr. Tarapacá N° 645");

    await user.click(screen.getByRole("checkbox", { name: /Declaro bajo juramento/i }));
    await user.click(screen.getByRole("checkbox", { name: /conforme a la Ley N° 29733/i }));
  }

  it("201 Created -> éxito: muestra mensaje con la casilla institucional creada", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      data: { idPersona: "pers-001" },
      status: 201,
    } as any);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>,
    );

    await llenarFormularioNatural(user);
    await user.click(screen.getByRole("button", { name: /Registrar y Crear Casilla/i }));

    const statusBanner = await screen.findByRole("status", {}, { timeout: 4000 });
    expect(statusBanner).toHaveTextContent("74561238@casilla.iestpsuiza.edu.pe");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  }, 15000);

  it("400 Bad Request -> error: muestra alerta y NUNCA muestra status de éxito", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValueOnce({
      response: {
        status: 400,
        data: { message: "Documento inválido" },
      },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>,
    );

    await llenarFormularioNatural(user);
    await user.click(screen.getByRole("button", { name: /Registrar y Crear Casilla/i }));

    const alertBanner = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(alertBanner).toHaveTextContent("Documento inválido");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  }, 15000);

  it("409 Conflict -> error: muestra alerta de cuenta ya existente y nunca éxito", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValueOnce({
      response: {
        status: 409,
        data: { detail: "El DNI ya se encuentra registrado con una casilla activa." },
      },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>,
    );

    await llenarFormularioNatural(user);
    await user.click(screen.getByRole("button", { name: /Registrar y Crear Casilla/i }));

    const alertBanner = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(alertBanner).toHaveTextContent("El DNI ya se encuentra registrado");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  }, 15000);

  it("422 Unprocessable Entity -> error: muestra alerta y nunca éxito", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValueOnce({
      response: {
        status: 422,
        data: { message: "Ubigeo inválido para la provincia seleccionada" },
      },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>,
    );

    await llenarFormularioNatural(user);
    await user.click(screen.getByRole("button", { name: /Registrar y Crear Casilla/i }));

    const alertBanner = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(alertBanner).toHaveTextContent("Ubigeo inválido");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  }, 15000);

  it("429 Too Many Requests -> error: muestra alerta de límite de solicitudes y nunca éxito", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValueOnce({
      response: {
        status: 429,
        data: { detail: "Demasiadas solicitudes de registro. Intente más tarde." },
      },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>,
    );

    await llenarFormularioNatural(user);
    await user.click(screen.getByRole("button", { name: /Registrar y Crear Casilla/i }));

    const alertBanner = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(alertBanner).toHaveTextContent("Demasiadas solicitudes");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  }, 15000);

  it("500 Internal Server Error -> error: muestra alerta de servidor y nunca éxito", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValueOnce({
      response: {
        status: 500,
        data: { detail: "Error interno de base de datos" },
      },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>,
    );

    await llenarFormularioNatural(user);
    await user.click(screen.getByRole("button", { name: /Registrar y Crear Casilla/i }));

    const alertBanner = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(alertBanner).toHaveTextContent("Error interno de base de datos");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  }, 15000);

  it("ECONNREFUSED -> error: ante caída de backend muestra alerta y NUNCA éxito falso", async () => {
    const errorConexion = new Error("connect ECONNREFUSED 127.0.0.1:3000");
    vi.spyOn(apiClient, "post").mockRejectedValueOnce(errorConexion);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>,
    );

    await llenarFormularioNatural(user);
    await user.click(screen.getByRole("button", { name: /Registrar y Crear Casilla/i }));

    const alertBanner = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(alertBanner).toBeInTheDocument();
    expect(alertBanner).toHaveTextContent("connect ECONNREFUSED 127.0.0.1:3000");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  }, 15000);

  it("Timeout / AbortError -> error: ante cancelación por timeout muestra alerta y nunca éxito", async () => {
    const timeoutError = new Error("timeout of 10000ms exceeded");
    vi.spyOn(apiClient, "post").mockRejectedValueOnce(timeoutError);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>,
    );

    await llenarFormularioNatural(user);
    await user.click(screen.getByRole("button", { name: /Registrar y Crear Casilla/i }));

    const alertBanner = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(alertBanner).toHaveTextContent("timeout of 10000ms exceeded");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  }, 15000);
});
