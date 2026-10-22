import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../api/client";
import {
  ConsentimientoLey29733Modal as AuthConsentModal,
  registrarConConsentimiento,
} from "../../components/auth/ConsentimientoLey29733Modal";
import { DeclaracionJuradaCheckbox } from "../../components/registro/DeclaracionJuradaCheckbox";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import RegistroCiudadanoPage from "../../pages/registro/RegistroCiudadanoPage";
import { juridicalSchema, naturalSchema } from "../../schemas/registroCiudadano.schema";

vi.mock("../../api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock("../../components/common/UbigeoSelector", () => ({
  UbigeoSelector: ({ onChange }: { onChange: (code: string, dto: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange("250101", {
          departamento: { id: "25" },
          provincia: { id: "2501" },
          distrito: { id: "250101" },
        })
      }
    >
      Seleccionar distrito de prueba
    </button>
  ),
}));

const naturalDatos = {
  tipoPersona: "NATURAL" as const,
  nombres: "Ana María",
  apellidos: "Pérez López",
  fechaNacimiento: "1990-01-01",
  correo: "ana@example.com",
  celular: "987654321",
  tipoDocumento: "DNI" as const,
  numeroDocumento: "12345678",
  domicilio: {
    departamentoCodigo: "25",
    provinciaCodigo: "2501",
    distritoCodigo: "250101",
    direccionExacta: "Jr. Prueba 123",
    referencia: "",
  },
  declaracionJuradaAceptada: true,
  consentimientoLey29733: true,
  version: "1.0" as const,
  fechaAceptacion: "2026-01-12T10:00:00.000Z",
};

async function fillNaturalForm() {
  fireEvent.change(screen.getByLabelText(/nombres \*/i), { target: { value: "Ana María" } });
  fireEvent.change(screen.getByLabelText(/apellidos \*/i), { target: { value: "Pérez López" } });
  fireEvent.change(screen.getByLabelText(/fecha de nacimiento/i), { target: { value: "1990-01-01" } });
  fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: "ana@example.com" } });
  fireEvent.change(screen.getByLabelText(/^celular/i), { target: { value: "987654321" } });
  fireEvent.change(screen.getByLabelText(/número de documento/i), { target: { value: "12345678" } });
  fireEvent.change(screen.getByLabelText(/dirección exacta/i), { target: { value: "Jr. Prueba 123" } });
  await userEvent.click(screen.getByRole("button", { name: /seleccionar distrito/i }));
  await userEvent.click(screen.getByRole("checkbox", { name: /declaro bajo juramento/i }));
  await userEvent.click(screen.getByRole("checkbox", { name: /he leído y acepto/i }));
}

async function fillJuridicalForm(acceptConsents = true) {
  fireEvent.change(screen.getByLabelText(/^ruc/i), { target: { value: "20100070970" } });
  fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: "Empresa de Prueba" } });
  fireEvent.change(screen.getByLabelText(/número de documento/i), { target: { value: "12345678" } });
  fireEvent.change(screen.getByLabelText(/^nombres/i), { target: { value: "Ana" } });
  fireEvent.change(screen.getByLabelText(/^apellidos/i), { target: { value: "Pérez" } });
  fireEvent.change(screen.getByLabelText(/^cargo/i), { target: { value: "Gerente" } });
  fireEvent.change(screen.getByLabelText(/correo corporativo/i), { target: { value: "contacto@example.com" } });
  fireEvent.change(screen.getByLabelText(/celular de contacto/i), { target: { value: "987654321" } });
  fireEvent.change(screen.getByLabelText(/dirección exacta/i), { target: { value: "Jr. Empresa 123" } });
  await userEvent.click(screen.getByRole("button", { name: /seleccionar distrito/i }));
  if (acceptConsents) {
    await userEvent.click(screen.getByRole("checkbox", { name: /declaro bajo juramento/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /he leído y acepto/i }));
  }
}

describe("formularios de registro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valida los datos Zod y exige declaración y consentimiento antes del envío", async () => {
    expect(naturalSchema.safeParse({ ...naturalDatos, numeroDocumento: "123" }).success).toBe(false);
    expect(naturalSchema.safeParse({ ...naturalDatos, fechaNacimiento: "2020-01-01" }).success).toBe(false);
    expect(juridicalSchema.safeParse({ tipoPersona: "JURIDICA" }).success).toBe(false);

    const onSubmit = vi.fn();
    render(<PersonaNaturalForm onSubmit={onSubmit} />);
    const submit = screen.getByRole("button", { name: /registrar y crear casilla/i });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /declaro bajo juramento/i }));
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /he leído y acepto/i }));
    await userEvent.click(submit);
    expect(await screen.findByText(/dni debe tener exactamente 8 dígitos/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("permite consultar la política y envía correctamente un registro natural válido", async () => {
    const onSubmit = vi.fn();
    render(<PersonaNaturalForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /ver política de tratamiento/i }));
    expect(screen.getByRole("dialog", { name: /política de tratamiento/i })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("dialog")).getByText("Cerrar"));
    await fillNaturalForm();
    await userEvent.click(screen.getByRole("button", { name: /registrar y crear casilla/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      ...naturalDatos,
      fechaAceptacion: expect.any(String),
    });
  });

  it("valida y envía los campos requeridos de una persona jurídica", async () => {
    const onSubmit = vi.fn();
    render(<PersonaJuridicaForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /declaro bajo juramento/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /he leído y acepto/i }));
    await userEvent.click(screen.getByRole("button", { name: /registrar empresa y crear casilla/i }));
    expect(await screen.findByText(/ruc debe tener 11 dígitos/i)).toBeInTheDocument();
    await fillJuridicalForm(false);
    await userEvent.click(screen.getByRole("button", { name: /registrar empresa y crear casilla/i }));
    await waitFor(() => expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      tipoPersona: "JURIDICA",
      ruc: "20100070970",
      razonSocial: "Empresa de Prueba",
      consentimientoLey29733: true,
      declaracionJuradaAceptada: true,
    }));
  });
});

describe("RegistroCiudadanoPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envía el contrato natural y muestra confirmación solo tras respuesta satisfactoria", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: "persona-1" } });
    render(<MemoryRouter><RegistroCiudadanoPage /></MemoryRouter>);
    await fillNaturalForm();
    await userEvent.click(screen.getByRole("button", { name: /registrar y crear casilla/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/registro completado/i);
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/auth/registro-ciudadano",
      expect.objectContaining({
        tipoPersona: "NATURAL",
        dni: "12345678",
        consentimientoDatos: true,
        aceptaNotificaciones: true,
        password: "Clave*12345678",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: /cerrar mensaje de éxito/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("muestra el error del servidor sin presentar un registro fallido como exitoso", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("HTTP 409: documento duplicado"));
    render(<MemoryRouter><RegistroCiudadanoPage /></MemoryRouter>);
    await fillNaturalForm();
    await userEvent.click(screen.getByRole("button", { name: /registrar y crear casilla/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/http 409/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("cambia al formulario jurídico y envía al endpoint correspondiente", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: "persona-juridica-1" } });
    render(<MemoryRouter><RegistroCiudadanoPage /></MemoryRouter>);
    await userEvent.click(screen.getByRole("tab", { name: /persona jurídica/i }));
    expect(screen.getByRole("button", { name: /registrar empresa y crear casilla/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver al inicio/i })).toBeInTheDocument();
  });

  it("registra correctamente una persona jurídica y presenta su casilla", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: "empresa-1" } });
    render(<MemoryRouter><RegistroCiudadanoPage /></MemoryRouter>);
    await userEvent.click(screen.getByRole("tab", { name: /persona jurídica/i }));
    await fillJuridicalForm();
    await userEvent.click(screen.getByRole("button", { name: /registrar empresa y crear casilla/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/20100070970@casilla/i);
    await userEvent.click(screen.getByRole("tab", { name: /persona natural/i }));
    expect(screen.getByRole("tab", { name: /persona natural/i })).toHaveAttribute("aria-selected", "true");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/auth/registro-persona-juridica",
      expect.objectContaining({
        tipoPersona: "JURIDICA",
        ruc: "20100070970",
        consentimientoDatos: true,
      }),
    );
  });

  it("muestra el error del servidor al registrar una persona jurídica", async () => {
    vi.mocked(apiClient.post).mockRejectedValue("error inesperado");
    render(<MemoryRouter><RegistroCiudadanoPage /></MemoryRouter>);
    await userEvent.click(screen.getByRole("tab", { name: /persona jurídica/i }));
    await fillJuridicalForm();
    await userEvent.click(screen.getByRole("button", { name: /registrar empresa y crear casilla/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo completar el registro/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("consentimiento y declaración", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza registrar si no se otorgó el consentimiento explícito", async () => {
    const registrar = vi.fn();
    await expect(
      registrarConConsentimiento({ consentimiento_ley_29733: false }, registrar),
    ).rejects.toThrow(/debe aceptar el consentimiento informado/i);
    expect(registrar).not.toHaveBeenCalled();
  });

  it("renderiza el error y comunica el estado de la declaración jurada", async () => {
    const onChange = vi.fn();
    render(<DeclaracionJuradaCheckbox checked={false} onChange={onChange} error="Debe aceptar" id="dj" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-describedby", "dj-error");
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("requiere consentimiento, maneja Escape y reporta rechazo del registro", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new Error("servicio caído"));
    render(<AuthConsentModal isOpen onClose={onClose} onSubmit={onSubmit} />);
    expect(screen.getByRole("button", { name: /aceptar y continuar/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /aceptar y continuar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/servicio caído/i);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({ consentimiento_ley_29733: true });
  });

  it("cierra el modal de consentimiento al completar una aceptación válida", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(<AuthConsentModal isOpen onClose={onClose} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /aceptar y continuar/i }));
    expect(onSubmit).toHaveBeenCalledWith({ consentimiento_ley_29733: true });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("no presenta el modal cerrado, bloquea Escape durante envío y trata un rechazo no estándar", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue("fallo desconocido");
    const { rerender } = render(
      <AuthConsentModal isOpen={false} onClose={onClose} onSubmit={onSubmit} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<AuthConsentModal isOpen isSubmitting onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /registrando/i })).toBeDisabled();
  });

  it("usa un mensaje seguro si la respuesta del servidor no es un Error", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue("fallo desconocido");
    render(<AuthConsentModal isOpen onClose={onClose} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /aceptar y continuar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/no fue posible registrar el consentimiento/i);
    expect(onClose).not.toHaveBeenCalled();
  });
});
