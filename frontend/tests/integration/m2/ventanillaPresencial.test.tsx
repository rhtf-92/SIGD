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
const procedimientoFormalDoble = {
  id: randomUUID(), codigo: "SUZ26-054", denominacion: "Convalidación entre Planes de Estudios",
  descripcion: "Rubro: Otros Servicios Académicos. Derecho de pago: S/ 46.50. Plazo no especificado en la fuente.",
  unidad_organica: "Unidad del doble", vigente: true,
};

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
    vi.spyOn(apiClient, "get").mockImplementation(async (url) => ({ status: 200,
      data: url === "/api/v1/tramites/tipos" ? [procedimientoFormalDoble] : [tipoDocumentalDoble, segundoTipoDocumentalDoble],
    }));
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
    expect(await screen.findByRole("option", { name: /SUZ26-054/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Prácticas Iniciales/i })).not.toBeInTheDocument();
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

    await screen.findByRole("option", { name: /SUZ26-054/ });
    await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), "SUZ26-054");

    expect(screen.getByRole("option", { name: /Convalidaci.n entre Planes de Estudios/ })).toBeInTheDocument();
    expect(screen.getByText(/46\.50/)).toBeInTheDocument();
    expect(screen.getByText(/Rubro: Otros Servicios Acad/)).toBeInTheDocument();
  });

  it("busca en el catálogo formal y distingue una búsqueda sin coincidencias", async () => {
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);
    await screen.findByRole("option", { name: /SUZ26-054/ });
    const search = screen.getByLabelText(/Buscar por código o denominación/);
    fireEvent.change(search, { target: { value: "inexistente" } });
    expect(screen.queryByRole("option", { name: /SUZ26-054/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No hay procedimientos que coincidan/)).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "SUZ26-054" } });
    expect(screen.getByRole("option", { name: /SUZ26-054/ })).toBeInTheDocument();
  });

  it("no ofrece procedimientos inactivos ni inventa opciones cuando el catálogo está vacío", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({ status: 200,
      data: url === "/api/v1/tramites/tipos" ? [{ ...procedimientoFormalDoble, vigente: false }] : [tipoDocumentalDoble],
    }));
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);
    expect(await screen.findByText(/No hay procedimientos formales vigentes/)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /SUZ26-054/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /TUPA-01/ })).not.toBeInTheDocument();
  });

  it("bloquea y permite reintentar un error de catálogo formal sin reemplazos estáticos", async () => {
    let fail = true;
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === "/api/v1/tramites/tipos" && fail) throw new Error("servicio no disponible");
      return { status: 200, data: url === "/api/v1/tramites/tipos" ? [procedimientoFormalDoble] : [tipoDocumentalDoble] };
    });
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo consultar el catálogo formal");
    expect(screen.getByLabelText(/Procedimiento TUPA 2026/)).toBeDisabled();
    expect(screen.getByRole("button", { name: /Registrar y Emitir Cargo/ })).toBeDisabled();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /Reintentar catálogo/ }));
    expect(await screen.findByRole("option", { name: /SUZ26-054/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Procedimiento TUPA 2026/)).toBeEnabled();
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
    expect(screen.getByRole("option", { name: /^CE\b/i })).toBeDisabled();
    expect(screen.getByRole("option", { name: /^RUC\b/i })).toBeDisabled();
  });

  it("transmite el UUID TUPA seleccionado como campo propio, independiente del asunto", async () => {
    const user = await llenarFormulario();
    await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), procedimientoFormalDoble.codigo);
    await user.click(screen.getByRole("button", { name: /Registrar y Emitir Cargo/i }));
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/tramites/ventanilla-presencial", expect.objectContaining({
      idTipoTramiteTupa: procedimientoFormalDoble.id,
      tipoDocumentalId: tipoDocumentalDoble.tipo_documental_id,
    }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
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
    expect(screen.getByText("Cargando tipos documentales…")).toHaveAttribute("role", "status");
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
  it("muestra Persona Jurídica deshabilitada sin la palabra pendiente", async () => {
    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    const radioJuridica = screen.getByLabelText(/Persona Jurídica/i);
    expect(radioJuridica).toBeInTheDocument();
    expect(radioJuridica).toBeDisabled();
    expect(radioJuridica).toHaveAttribute("aria-disabled", "true");
    expect(radioJuridica.closest("label")).toHaveTextContent("Persona Jurídica");
    expect(radioJuridica.closest("label")).toHaveTextContent("No disponible en ventanilla física");
    expect(screen.queryByText(/pendiente/i)).not.toBeInTheDocument();
  });

  it("opera el selector personalizado de tipo de documento con teclado, scrollbar y sin pendiente", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: /Tipo Documento Identidad/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Abrir con click
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const listbox = screen.getByRole("listbox", { name: /Tipos de documento de identidad/i });
    expect(listbox).toBeInTheDocument();
    expect(listbox.className).toContain("max-h-[235px]");
    expect(listbox.className).toContain("overflow-y-auto");

    // Verificar dentro del listbox personalizado que las opciones disabled tienen aria-disabled="true"
    const itemsListbox = within(listbox).getAllByRole("option");
    expect(itemsListbox.length).toBeGreaterThanOrEqual(5);

    const opcionDni = itemsListbox.find((o) => o.textContent?.includes("DNI"));
    const opcionCe = itemsListbox.find((o) => o.textContent?.includes("CE"));
    expect(opcionDni).toBeInTheDocument();
    expect(opcionCe).toHaveAttribute("aria-disabled", "true");

    // Cerrar con Escape
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: /Tipos de documento de identidad/i })).not.toBeInTheDocument();
  });
  it("opera el selector personalizado de procedimiento TUPA 2026 con apertura, scrollbar y actualización de ficha", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    // Esperar a que cargue el procedimiento
    await screen.findByRole("option", { name: /SUZ26-054/ });

    const trigger = screen.getByRole("button", { name: /-- Seleccione un procedimiento o servicio --/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Abrir menú con clic
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const listbox = screen.getByRole("listbox", { name: /Procedimientos TUPA disponibles/i });
    expect(listbox).toBeInTheDocument();
    expect(listbox.className).toContain("max-h-[235px]");
    expect(listbox.className).toContain("overflow-y-auto");

    // Seleccionar el procedimiento del catálogo
    const opcionProc = within(listbox).getByRole("option", { name: /SUZ26-054/i });
    await user.click(opcionProc);

    // El dropdown se cierra tras la selección
    expect(screen.queryByRole("listbox", { name: /Procedimientos TUPA disponibles/i })).not.toBeInTheDocument();

    // El trigger se actualiza con el procedimiento seleccionado
    expect(trigger).toHaveTextContent("SUZ26-054");
    expect(trigger).toHaveTextContent("Convalidación entre Planes de Estudios");

    // La ficha informativa inferior se actualiza
    expect(screen.getByRole("heading", { name: /TUPA 2026 — IESTP Suiza/i })).toBeInTheDocument();
    expect(screen.getByText(/46\.50/)).toBeInTheDocument();
  });

  it("CargoDigitalModal (modoVentanilla): renderiza confirmación exitosa con botones institucionales de ventanilla y sin casilla", () => {
    const handleBandeja = vi.fn();
    const handleSeguimiento = vi.fn();
    const handleNuevo = vi.fn();

    render(
      <CargoDigitalModal
        isOpen={true}
        onClose={() => {}}
        cargo={cargoMuestra}
        modoVentanilla={true}
        onIrBandeja={handleBandeja}
        onConsultarSeguimiento={handleSeguimiento}
        onNuevoRegistro={handleNuevo}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("¡Trámite registrado exitosamente!")).toBeInTheDocument();
    expect(screen.getByText(/ESTADO INICIAL: REGISTRADO/i)).toBeInTheDocument();
    expect(screen.getByText("EXP-2026-000155")).toBeInTheDocument();

    // Botones de acción institucional
    const btnBandeja = screen.getByRole("button", { name: /Ir a Bandeja de Expedientes/i });
    const btnSeguimiento = screen.getByRole("button", { name: /Consultar Seguimiento/i });
    const btnNuevo = screen.getByRole("button", { name: /Registrar Nuevo Trámite/i });
    expect(btnBandeja).toBeInTheDocument();
    expect(btnSeguimiento).toBeInTheDocument();
    expect(btnNuevo).toBeInTheDocument();

    // NO debe existir acceso a casilla en ventanilla física
    expect(screen.queryByRole("button", { name: /Acceder a Casilla Electrónica/i })).not.toBeInTheDocument();

    fireEvent.click(btnBandeja);
    expect(handleBandeja).toHaveBeenCalledTimes(1);

    fireEvent.click(btnSeguimiento);
    expect(handleSeguimiento).toHaveBeenCalledWith("EXP-2026-000155");

    fireEvent.click(btnNuevo);
    expect(handleNuevo).toHaveBeenCalledTimes(1);
  });

  it("al cerrar el modal de cargo, muestra la barra institucional persistente con opciones de acceso y reapertura", async () => {
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
    await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), "NO_TUPA");
    await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i), "Solicitud de convalidación académica");
    await user.selectOptions(screen.getByLabelText(/Tipo de Documento Presentado/i), tipoDocumentalDoble.tipo_documental_id);

    await user.click(screen.getByRole("button", { name: /✓ Registrar y Emitir Cargo CUT/i }));

    // Modal abierto
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Cerrar modal usando botón "✕"
    const botonCerrarModal = within(dialog).getByRole("button", { name: /Cerrar ventana de cargo/i });
    await user.click(botonCerrarModal);

    // Modal cerrado
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // La barra persistente superior debe mostrarse
    const banner = screen.getByRole("status", { name: /Confirmación de último trámite registrado/i });
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByText("¡Trámite registrado exitosamente!")).toBeInTheDocument();
    expect(within(banner).getByText("EXP-2026-000155")).toBeInTheDocument();
    expect(within(banner).getByText("REGISTRADO")).toBeInTheDocument();

    // Reabrir modal con botón "Ver Cargo Digital"
    const btnReabrir = within(banner).getByRole("button", { name: /📄 Ver Cargo Digital/i });
    await user.click(btnReabrir);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
