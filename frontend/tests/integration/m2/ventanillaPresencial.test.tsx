import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import VentanillaPresencialPage from "../../../src/pages/tramite/VentanillaPresencialPage";
import CargoDigitalModal from "../../../src/components/tramite/CargoDigitalModal";
import type { CargoOficialTramite } from "../../../src/types/cargoOficial";
import { apiClient } from "@/api/client";

vi.mock("@/api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

const tramitesAuditoria = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    codigo: "AUDITORIA-01",
    denominacion: "AUDITORIA Constancia de prueba",
    unidad_organica: "AUDITORIA Unidad de prueba",
    plazo_dias_habiles: 5,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    codigo: "AUDITORIA-02",
    denominacion: "AUDITORIA Informe de prueba",
    unidad_organica: "AUDITORIA Unidad de prueba",
    plazo_dias_habiles: 10,
  },
];

const mockRespuestaVentanilla = {
  data: {
    expedienteId: "00000000-0000-4000-8000-000000000099",
    cut: "EXP-2026-000099",
    anioFiscal: 2026,
    fechaRadicacion: "2026-11-10T15:00:00.000Z",
    ticketImpresion: "AUDITORIA-TICKET",
    cargo: {
      cut: "EXP-2026-000099",
      remitente: "AUDITORIA Solicitante",
      dni: "AUDITORIA-DNI",
      asunto: "AUDITORIA solicitud de prueba",
      folios: 1,
      fechaRecepcion: "2026-11-10T15:00:00.000Z",
      hashSha256: "AUDITORIA-HASH-DE-PRUEBA",
      qrSeguimientoUrl: "/AUDITORIA/seguimiento?cut=EXP-2026-000099",
    },
  },
};

const cargoMuestra: CargoOficialTramite = {
  codigoExpediente: "AUDITORIA-EXP-001",
  fechaRecepcionIso: "2026-11-10T15:00:00.000Z",
  fechaIngresoFormalIso: "2026-11-10T15:00:00.000Z",
  horaRecepcion: "2026-11-10T15:00:00.000Z",
  operadorVentanillaNombre: "AUDITORIA Operador",
  sedeInstitucional: "AUDITORIA Sede",
  solicitante: {
    tipoPersona: "NATURAL",
    tipoDocumento: "DNI",
    numeroDocumento: "AUDITORIA-DNI",
    nombreOrazonSocial: "AUDITORIA Solicitante",
    correoElectronico: "auditoria@example.test",
    telefono: "AUDITORIA-TELEFONO",
  },
  asunto: "AUDITORIA solicitud de prueba",
  documentoPrincipalTipo: "AUDITORIA-SOLICITUD",
  cantidadFolios: 3,
  hashSha256Recepcion: "AUDITORIA-HASH-DE-PRUEBA",
  horaCorteAplicada: "16:30",
  radicadoDiaSiguiente: false,
  urlSeguimiento: "/AUDITORIA/seguimiento?cut=AUDITORIA-EXP-001",
};

describe("Suite de Pruebas de Ventanilla Presencial y Ticket Cargo CUT (ENT-M02-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === "/api/v1/tramites/tipos") {
        return Promise.resolve({ data: tramitesAuditoria } as never);
      }
      if (url === `/api/v1/tramites/tipos/${tramitesAuditoria[0].id}/requisitos`) {
        return Promise.resolve({
          data: [
            { orden: 1, texto: "AUDITORIA requisito uno" },
            { orden: 2, texto: "AUDITORIA requisito dos" },
          ],
        } as never);
      }
      if (url === `/api/v1/tramites/tipos/${tramitesAuditoria[1].id}/requisitos`) {
        return Promise.resolve({ data: [] } as never);
      }
      return Promise.resolve({ data: [] } as never);
    });
    vi.mocked(apiClient.post).mockResolvedValue(mockRespuestaVentanilla as never);
  });

  it("renderiza el formulario con campos obligatorios, conmutador de persona y catálogo TUPA", async () => {
    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /Ventanilla Presencial de Atención al Ciudadano/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Persona Natural/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Persona Jurídica/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tipo Documento Identidad/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Número de Documento \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombres \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Apellidos \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo Electrónico para Notificación \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Procedimiento TUPA 2026 \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tipo de Documento Presentado \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cantidad de Folios Físicos \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /✓ Registrar y Emitir Cargo CUT/i })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "AUDITORIA-01 - AUDITORIA Constancia de prueba" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "AUDITORIA-02 - AUDITORIA Informe de prueba" })).toBeInTheDocument();
  });

  it("muestra los datos del procedimiento TUPA seleccionado", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    const procedimiento = screen.getByLabelText(/Procedimiento TUPA 2026/i);
    await screen.findByRole("option", { name: "AUDITORIA-01 - AUDITORIA Constancia de prueba" });
    await user.selectOptions(procedimiento, tramitesAuditoria[0].id);

    expect(screen.getByText("AUDITORIA-01: AUDITORIA Constancia de prueba", { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/Fuente: TUPA vigente del sistema/i)).toBeInTheDocument();
  });

  it("muestra y permite verificar los requisitos documentarios del procedimiento", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    await screen.findByRole("option", { name: "AUDITORIA-01 - AUDITORIA Constancia de prueba" });
    await user.selectOptions(
      screen.getByLabelText(/Procedimiento TUPA 2026/i),
      tramitesAuditoria[0].id,
    );

    expect(await screen.findByText("AUDITORIA requisito uno")).toBeInTheDocument();
    expect(screen.getByText("AUDITORIA requisito dos")).toBeInTheDocument();
    expect(screen.getByText("0 de 2 verificados")).toBeInTheDocument();

    await user.click(screen.getByLabelText("AUDITORIA requisito uno"));

    expect(screen.getByText("1 de 2 verificados")).toBeInTheDocument();
  });

  it("indica cuando el procedimiento no tiene requisitos documentarios", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    await screen.findByRole("option", { name: "AUDITORIA-02 - AUDITORIA Informe de prueba" });
    await user.selectOptions(
      screen.getByLabelText(/Procedimiento TUPA 2026/i),
      tramitesAuditoria[1].id,
    );

    expect(
      await screen.findByText("Este procedimiento no tiene requisitos cargados en el TUPA."),
    ).toBeInTheDocument();
  });

  it("rechaza un DNI de 7 dígitos sin llamar al servidor", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/Número de Documento \*/i), "1234567");
    await user.type(screen.getByLabelText(/Nombres \*/i), "AUDITORIA Nombre");
    await user.type(screen.getByLabelText(/Apellidos \*/i), "AUDITORIA Apellido");
    await user.type(screen.getByLabelText(/Correo Electrónico para Notificación \*/i), "auditoria@example.test");
    await user.type(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i), "AUDITORIA-TELEFONO");
    await screen.findByRole("option", { name: "AUDITORIA-01 - AUDITORIA Constancia de prueba" });
    await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), tramitesAuditoria[0].id);
    await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i), "AUDITORIA asunto de prueba");

    await user.click(screen.getByRole("button", { name: /✓ Registrar y Emitir Cargo CUT/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/DNI debe tener exactamente 8 dígitos/i);
    expect(apiClient.post).not.toHaveBeenCalled();
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
    expect(screen.getByText("AUDITORIA-EXP-001")).toBeInTheDocument();
    expect(screen.getByText(/AUDITORIA Solicitante/i)).toBeInTheDocument();
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

    await user.type(screen.getByLabelText(/Número de Documento \*/i), "12345678");
    await user.type(screen.getByLabelText(/Nombres \*/i), "AUDITORIA Nombre");
    await user.type(screen.getByLabelText(/Apellidos \*/i), "AUDITORIA Apellido");
    await user.type(screen.getByLabelText(/Correo Electrónico para Notificación \*/i), "auditoria@example.test");
    await user.type(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i), "AUDITORIA-TELEFONO");
    await screen.findByRole("option", { name: "AUDITORIA-02 - AUDITORIA Informe de prueba" });
    await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), tramitesAuditoria[1].id);
    await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i), "AUDITORIA asunto de prueba");

    const botonRegistrar = screen.getByRole("button", { name: /✓ Registrar y Emitir Cargo CUT/i });
    await user.click(botonRegistrar);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("EXP-2026-000099")).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/tramites/ventanilla-presencial",
      expect.objectContaining({ idTipoTramiteTupa: tramitesAuditoria[1].id }),
    );
  });
});
