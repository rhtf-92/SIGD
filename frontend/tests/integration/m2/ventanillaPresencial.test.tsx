import "@testing-library/jest-dom/vitest";
import { randomUUID } from "node:crypto";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import VentanillaPresencialPage from "../../../src/pages/tramite/VentanillaPresencialPage";
import CargoDigitalModal from "../../../src/components/tramite/CargoDigitalModal";
import type { CargoOficialTramite } from "../../../src/types/cargoOficial";
import { apiClient } from "@/api/client";
import { ApiHttpError } from "../../../src/types/api";

vi.mock("../../../src/hooks/useHorarioCorte", () => ({
  useHorarioCorte: () => ({ isAfterCutoff: false, requiresProjection: false, legalDate: "2026-09-23T10:30:00.000Z" }),
}));

// Catálogo exclusivamente simulado: no se crean registros en PostgreSQL.
const tipoDocumentalDoble = { tipo_documental_id: randomUUID(), codigo: "TIPO_UNITARIO", nombre: "Documento del doble", vigente: true };
const segundoTipoDocumentalDoble = { tipo_documental_id: randomUUID(), codigo: "OTRO_UNITARIO", nombre: "Segundo documento del doble", vigente: true };

const mockRespuestaVentanilla = {
  status: 201,
  data: {
    expedienteId: "00000000-0000-0000-0000-000000000001",
    cut: "EXP-2026-000155",
    anioFiscal: 2026,
    fechaRadicacion: "2026-09-23T10:30:00.000Z",
    ticketImpresion: "TICKET",
    cargo: {
      cut: "EXP-2026-000155",
      remitente: "Sergio Serruche",
      dni: "74561238",
      asunto: "Solicitud de convalidación académica",
      folios: 1,
      fechaRecepcion: "2026-09-23T10:30:00.000Z",
      hashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      qrSeguimientoUrl: "https://sigd.iestpsuiza.edu.pe/tramite?cut=EXP-2026-000155",
    },
  },
};

const cargoMuestra: CargoOficialTramite = {
  codigoExpediente: "EXP-2026-000155",
  fechaRecepcionIso: "2026-09-23T10:30:00.000Z",
  fechaIngresoFormalIso: "2026-09-23T10:30:00.000Z",
  horaRecepcion: "10:30:00",
  operadorVentanillaNombre: "Operador de Mesa de Partes (Ventanilla 1)",
  sedeInstitucional: "Sede Central - Jr. Tarapacá N° 645, Pucallpa",
  solicitante: {
    tipoPersona: "NATURAL",
    tipoDocumento: "DNI",
    numeroDocumento: "74561238",
    nombreOrazonSocial: "Carlos Mendoza Ríos",
    correoElectronico: "carlos@gmail.com",
    telefono: "961234567",
  },
  asunto: "Solicitud de Certificado de Estudios",
  documentoPrincipalTipo: "SOLICITUD",
  cantidadFolios: 3,
  hashSha256Recepcion: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  horaCorteAplicada: "16:30",
  radicadoDiaSiguiente: false,
  urlSeguimiento: "https://sigd.iestpsuiza.edu.pe/tramite?cut=EXP-2026-000155",
};

describe("Suite de Pruebas de Ventanilla Presencial y Ticket Cargo CUT (ENT-M02-05)", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ status: 200, data: [tipoDocumentalDoble, segundoTipoDocumentalDoble] });
    vi.spyOn(apiClient, "post").mockResolvedValue(mockRespuestaVentanilla as any);
  });

  it("renderiza el formulario de ventanilla presencial con campos obligatorios y conmutador de persona", async () => {
    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("option", { name: tipoDocumentalDoble.nombre })).toHaveValue(tipoDocumentalDoble.tipo_documental_id);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/admin/maestras/tipo-documento", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(
      screen.getByRole("heading", { name: /Ventanilla Presencial de Atención al Ciudadano/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Persona Natural/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Persona Jurídica/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Número de Documento \*/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Trámite no TUPA \/ documentación general/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Prácticas Iniciales/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Cantidad de Folios Físicos \*/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /✓ Registrar y Emitir Cargo CUT/i })).toBeInTheDocument();
  });

  it("muestra requisitos, tarifas y datos del procedimiento TUPA seleccionado", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), "SUZ26-054");

    expect(screen.getByRole("option", { name: /Convalidaci.n entre Planes de Estudios/ })).toBeInTheDocument();
    expect(screen.getByText(/46\.50/)).toBeInTheDocument();
    expect(screen.getByText(/Rubro: Otros Servicios Acad/)).toBeInTheDocument();
  });

  it("CargoDigitalModal: renderiza el ticket térmico con CUT, QR y datos del solicitante", () => {
    render(
      <CargoDigitalModal
        isOpen={true}
        onClose={() => {}}
        cargo={cargoMuestra}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("EXP-2026-000155")).toBeInTheDocument();
    expect(screen.getByText(/Carlos Mendoza Ríos/i)).toBeInTheDocument();
    expect(screen.getByText(/3 foja\(s\)/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /QR para seguimiento del trámite/i })).toBeInTheDocument();
    expect(screen.getByText(/🖨️ Imprimir Ticket Térmico/i)).toBeInTheDocument();
  });

  it("completa el flujo de registro en ventanilla y despliega el modal de cargo con CUT generado", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/Número de Documento \*/i), "74561238");
    await user.type(screen.getByLabelText(/^Nombres \*/i), "Sergio");
    await user.type(screen.getByLabelText(/^Apellidos \*/i), "Serruche");
    await user.type(screen.getByLabelText(/Correo Electrónico para Notificación \*/i), "sergio@correo.pe");
    await user.type(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i), "961234567");
    await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), "SUZ26-054");
    await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i), "Solicitud de convalidación académica");
    await user.selectOptions(screen.getByLabelText(/Tipo de Documento Presentado/i), tipoDocumentalDoble.tipo_documental_id);

    const botonRegistrar = screen.getByRole("button", { name: /✓ Registrar y Emitir Cargo CUT/i });
    await user.click(botonRegistrar);

    // Debe abrir el modal de cargo con el CUT generado
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Sergio Serruche/i)).toBeInTheDocument();
    expect(screen.getByText(/EXP-2026-/i)).toBeInTheDocument();
  });

  async function llenarFormulario() {
    const user = userEvent.setup();
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);
    await user.type(screen.getByLabelText(/Número de Documento \*/i), "74561238");
    await user.type(screen.getByLabelText(/^Nombres \*/i), "Sergio");
    await user.type(screen.getByLabelText(/^Apellidos \*/i), "Serruche");
    await user.type(screen.getByLabelText(/Correo Electrónico para Notificación/i), "prueba@example.invalid");
    await user.type(screen.getByLabelText(/Teléfono \/ Celular de Contacto/i), "961234567");
    await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), "NO_TUPA");
    await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto/i), "Solicitud de convalidación académica");
    await user.selectOptions(screen.getByLabelText(/Tipo de Documento Presentado/i), tipoDocumentalDoble.tipo_documental_id);
    return user;
  }

  it("envía la identidad natural DNI y el UUID documental obtenido del catálogo", async () => {
    const user = await llenarFormulario();
    await user.click(screen.getByRole("button", { name: /Registrar y Emitir Cargo/i }));
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/tramites/ventanilla-presencial", {
      tipoPersona: "NATURAL", tipoDocumento: "DNI", dniSolicitante: "74561238",
      nombres: "Sergio", apellidos: "Serruche", correo: "prueba@example.invalid", telefono: "961234567",
      asunto: "Solicitud de convalidación académica", foliosTotales: 1,
      tipoDocumentalId: tipoDocumentalDoble.tipo_documental_id,
    });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/Persona Jurídica/i)).toBeDisabled();
    expect(screen.getByRole("option", { name: /CE.*pendiente/i })).toBeDisabled();
    expect(screen.getByRole("option", { name: /RUC.*pendiente/i })).toBeDisabled();
  });

  it("envía el UUID del tipo elegido y muestra su nombre del catálogo en el cargo", async () => {
    const user = await llenarFormulario();
    await user.selectOptions(screen.getByLabelText(/Tipo de Documento Presentado/i), segundoTipoDocumentalDoble.tipo_documental_id);
    await user.click(screen.getByRole("button", { name: /Registrar y Emitir Cargo/i }));
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/tramites/ventanilla-presencial", expect.objectContaining({
      tipoDocumento: "DNI", tipoDocumentalId: segundoTipoDocumentalDoble.tipo_documental_id,
    }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(segundoTipoDocumentalDoble.nombre)).toBeInTheDocument();
  });

  it("con catálogo vacío informa el bloqueo y no registra incluso ante un submit directo", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ status: 200, data: [] });
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);
    expect(await screen.findByText(/No hay tipos documentales vigentes disponibles/)).toHaveAttribute("role", "status");
    const select = screen.getByLabelText(/Tipo de Documento Presentado/i);
    expect(select).toBeDisabled();
    expect(select.querySelectorAll("option")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Registrar y Emitir Cargo/i })).toBeDisabled();
    fireEvent.submit(select.closest("form")!);
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("bloquea mientras carga el catálogo y exige elegir una opción después de recibirlo", async () => {
    let resolver!: (respuesta: any) => void;
    vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve; }));
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);
    const select = screen.getByLabelText(/Tipo de Documento Presentado/i);
    const registrar = screen.getByRole("button", { name: /Registrar y Emitir Cargo/i });
    expect(screen.getByRole("status")).toHaveTextContent("Cargando tipos documentales");
    expect(select).toBeDisabled();
    expect(registrar).toBeDisabled();
    fireEvent.submit(select.closest("form")!);
    expect(apiClient.post).not.toHaveBeenCalled();
    await act(async () => { resolver({ status: 200, data: [tipoDocumentalDoble] }); });
    expect(select).toBeEnabled();
    expect(select).toHaveValue("");
    expect(registrar).toBeDisabled();
    fireEvent.submit(select.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Seleccione un tipo documental vigente");
    expect(apiClient.post).not.toHaveBeenCalled();
    await userEvent.setup().selectOptions(select, tipoDocumentalDoble.tipo_documental_id);
    expect(registrar).toBeEnabled();
  });

  it("informa un error de carga del catálogo sin opciones sustitutas ni registro", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("Error del catálogo del doble"));
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el catálogo documental");
    const select = screen.getByLabelText(/Tipo de Documento Presentado/i);
    expect(select).toBeDisabled();
    expect(select.querySelectorAll("option")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Registrar y Emitir Cargo/i })).toBeDisabled();
    fireEvent.submit(select.closest("form")!);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it.each([
    { data: [{ codigo: "SOLICITUD", nombre: "Solicitud" }] },
    { data: [{ ...tipoDocumentalDoble, tipo_documental_id: "SOLICITUD" }] },
    { data: [{ ...tipoDocumentalDoble, vigente: false }] },
    { data: { tipos: [tipoDocumentalDoble] } },
  ])("rechaza un catálogo sin el contrato documental V2 válido: %j", async ({ data }) => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ status: 200, data });
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el catálogo documental");
    expect(screen.getByRole("button", { name: /Registrar y Emitir Cargo/i })).toBeDisabled();
    expect(screen.getByLabelText(/Tipo de Documento Presentado/i).querySelectorAll("option")).toHaveLength(1);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("rechaza un DNI inválido y apellidos vacíos sin sustituirlos ni enviar solicitudes", async () => {
    await llenarFormulario();
    const documento = screen.getByLabelText(/Número de Documento/i);
    const form = documento.closest("form")!;
    fireEvent.change(documento, { target: { value: "INVALIDO" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent("8 dígitos");
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.change(documento, { target: { value: "74561238" } });
    fireEvent.change(screen.getByLabelText(/^Apellidos/i), { target: { value: " " } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent("nombres y apellidos explícitos");
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("muestra los errores de validación de la API y no abre un cargo", async () => {
    const user = await llenarFormulario();
    vi.mocked(apiClient.post).mockRejectedValueOnce(new ApiHttpError({
      type: "validation", title: "Validation Error", status: 400, detail: "Los datos enviados no son válidos.",
      instance: "/api/v1/tramites/ventanilla-presencial", code: "VALIDATION_ERROR", category: "Validation", correlationId: "doble-unitario",
      invalidParams: [{ name: "apellidos", reason: "Indique los apellidos." }],
      retryable: false,
    }));
    await user.click(screen.getByRole("button", { name: /Registrar y Emitir Cargo/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("apellidos: Indique los apellidos.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    { status: 201, data: { cut: "EXP-2026-000155" } },
    { ...mockRespuestaVentanilla, status: 200 },
    { ...mockRespuestaVentanilla, data: { ...mockRespuestaVentanilla.data, anioFiscal: 2025 } },
    { ...mockRespuestaVentanilla, data: { ...mockRespuestaVentanilla.data, cargo: { ...mockRespuestaVentanilla.data.cargo, asunto: undefined } } },
  ])("rechaza una respuesta que no contiene un registro y cargo válidos: %j", async (respuesta) => {
    const user = await llenarFormulario();
    vi.mocked(apiClient.post).mockResolvedValueOnce(respuesta);
    await user.click(screen.getByRole("button", { name: /Registrar y Emitir Cargo/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo confirmar");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("impide envíos simultáneos y libera el estado al terminar la solicitud", async () => {
    await llenarFormulario();
    let resolver!: (respuesta: typeof mockRespuestaVentanilla) => void;
    vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve; }));
    const form = screen.getByLabelText(/Número de Documento/i).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Registrando…" })).toBeDisabled();
    await act(async () => { resolver(mockRespuestaVentanilla); });
    await waitFor(() => expect(screen.getByRole("button", { name: /Registrar y Emitir Cargo/i })).toBeEnabled());
  });
});
