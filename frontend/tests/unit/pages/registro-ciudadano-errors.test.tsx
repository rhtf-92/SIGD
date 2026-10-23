import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RegistroCiudadanoPage from "@/pages/registro/RegistroCiudadanoPage";
import { TRAMITE_WIZARD_STORAGE_KEY } from "@/hooks/useTramiteWizardReducer";

const post = vi.fn();

vi.mock("@/api/client", () => ({
  apiClient: {
    post: (...args: unknown[]) => post(...args),
  },
}));

// Mock PersonaNaturalForm to directly trigger onSubmit with valid test data
vi.mock("@/components/registro/PersonaNaturalForm", () => ({
  default: ({ onSubmit }: { onSubmit: (data: any) => Promise<void> }) => (
    <button
      type="button"
      data-testid="submit-natural"
      onClick={() =>
        onSubmit({
          tipoPersona: "NATURAL",
          numeroDocumento: "71234567",
          nombres: "Juan",
          apellidos: "Perez Lopez",
          correo: "jperez@test.com",
          celular: "961234567",
          domicilio: { distritoCodigo: "250101", direccionExacta: "Av Principal 123" },
        })
      }
    >
      Enviar Natural
    </button>
  ),
}));

describe("H-07: RegistroCiudadanoPage — Strict 201 + valid idPersona verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("201 válido con idPersona -> éxito y fusiona idPersona en borrador", async () => {
    const validUuid = "11111111-1111-4111-8111-111111111111";
    post.mockResolvedValueOnce({
      status: 201,
      data: {
        idPersona: validUuid,
        idCuenta: "22222222-2222-4222-8222-222222222222",
        correo: "71234567@casilla.iestpsuiza.edu.pe",
      },
    });

    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("submit-natural"));

    await waitFor(() => {
      expect(screen.getByText(/Registro completado/i)).toBeInTheDocument();
    });

    const stored = JSON.parse(window.sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY) || "{}");
    expect(stored.identificacion?.idPersona).toBe(validUuid);
    expect(screen.queryByText(/Error al procesar el registro/i)).not.toBeInTheDocument();
  });

  it("201 sin idPersona -> error y NO muestra éxito", async () => {
    post.mockResolvedValueOnce({
      status: 201,
      data: {
        mensaje: "Registrado sin identificador",
      },
    });

    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("submit-natural"));

    await waitFor(() => {
      expect(screen.queryByText(/Registro completado/i)).not.toBeInTheDocument();
      expect(screen.getByText(/El servidor no devolvió una confirmación válida con idPersona/i)).toBeInTheDocument();
    });

    expect(window.sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY)).toBeNull();
  });

  it("200 vacío -> error y NO muestra éxito", async () => {
    post.mockResolvedValueOnce({
      status: 200,
      data: {},
    });

    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("submit-natural"));

    await waitFor(() => {
      expect(screen.queryByText(/Registro completado/i)).not.toBeInTheDocument();
      expect(screen.getByText(/El servidor no devolvió una confirmación válida con idPersona/i)).toBeInTheDocument();
    });
  });

  it("204 No Content -> error y NO muestra éxito", async () => {
    post.mockResolvedValueOnce({
      status: 204,
      data: null,
    });

    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("submit-natural"));

    await waitFor(() => {
      expect(screen.queryByText(/Registro completado/i)).not.toBeInTheDocument();
      expect(screen.getByText(/El servidor no devolvió una confirmación válida con idPersona/i)).toBeInTheDocument();
    });
  });

  it("409 Conflict con mensaje RFC 7807/9457 -> muestra detail en mensaje de error", async () => {
    post.mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          detail: "El DNI ingresado ya se encuentra registrado en el sistema.",
        },
      },
    });

    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("submit-natural"));

    await waitFor(() => {
      expect(screen.queryByText(/Registro completado/i)).not.toBeInTheDocument();
      expect(screen.getByText("El DNI ingresado ya se encuentra registrado en el sistema.")).toBeInTheDocument();
    });
  });

  it("Network error -> muestra error de conexión", async () => {
    post.mockRejectedValueOnce(new Error("Network Error"));

    render(
      <MemoryRouter>
        <RegistroCiudadanoPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("submit-natural"));

    await waitFor(() => {
      expect(screen.queryByText(/Registro completado/i)).not.toBeInTheDocument();
      expect(screen.getByText("Network Error")).toBeInTheDocument();
    });
  });
});
