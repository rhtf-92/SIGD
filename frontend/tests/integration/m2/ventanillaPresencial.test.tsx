import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import VentanillaPresencialPage from "../../../src/pages/tramite/VentanillaPresencialPage";
import CargoDigitalModal from "../../../src/components/tramite/CargoDigitalModal";
import type { CargoOficialTramite } from "../../../src/types/cargoOficial";
import { apiClient } from "@/api/client";

/**
 * Catálogo TUPA simulado servido por la API real (reemplaza al hardcode legado
 * `PROCEDIMIENTOS_TUPA_2026`). Solo `registroVersionId` es un identificador válido.
 */
const REGISTRO_VERSION_CERTIFICADO = "11111111-1111-4111-8111-111111111111";

const CATALOGO_TUPA_API = [
  {
    registroVersionId: REGISTRO_VERSION_CERTIFICADO,
    codigoExterno: null,
    codigo: null,
    denominacion: "Certificado de estudios",
    requisitos: null,
    monto: "S/. 11.00 por semestre",
    fuente: {
      nombre: "TUPA_2026_IESTP_Suiza.pdf",
      documentoSha256: "377DD8E14B8806F2030B5374120AB9B4FE17640BB98086E10C1A9A4431A33622",
      pagina: 5,
      referenciaFila: "p5-fila-20",
    },
    pagina: 5,
    revision: 1,
    vigencia: { desde: null, hasta: null },
    vigenciaDesde: null,
    vigenciaHasta: null,
    version: {
      etiqueta: "VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1",
      revision: 1,
      vigenciaDesde: null,
      vigenciaHasta: null,
    },
    estadoValidacion: "APROBADO",
    estado: "APROBADO",
    referenciaAprobacion: "VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1",
    id: REGISTRO_VERSION_CERTIFICADO,
  },
];

const mockRespuestaVentanilla = {
  data: {
    expedienteId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
    vi.restoreAllMocks();
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: CATALOGO_TUPA_API } as any);
    vi.spyOn(apiClient, "post").mockResolvedValue(mockRespuestaVentanilla as any);
  });

  it("renderiza el formulario de ventanilla presencial con campos obligatorios y conmutador de persona", async () => {
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
    expect(screen.getByLabelText(/Número de Documento \*/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Trámite no TUPA \/ documentación general/i })).toBeInTheDocument();
    // La opción proviene del catálogo real servido por la API simulada
    expect(
      await screen.findByRole("option", { name: /^Certificado de estudios$/i }),
    ).toBeInTheDocument();
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

    // Espera a que el catálogo (API simulada) cargue y selecciona por registroVersionId
    await screen.findByRole("option", { name: /^Certificado de estudios$/i });
    await user.selectOptions(
      screen.getByLabelText(/Procedimiento TUPA 2026/i),
      REGISTRO_VERSION_CERTIFICADO,
    );

    expect(screen.queryByText(/Constancia de No Adeudar/i)).not.toBeInTheDocument();
    expect(screen.getByText(/S\/. 11\.00 por semestre/i)).toBeInTheDocument();
    expect(screen.getByText(/TUPA_2026_IESTP_Suiza\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/p5-fila-20/i)).toBeInTheDocument();
    expect(screen.queryByText(/Vigencia/i)).not.toBeInTheDocument();

    // Caso 8: ninguna ruta activa debe exponer la marca hardcodeada legada
    expect(screen.queryByText(/IESTP Pasco/i)).not.toBeInTheDocument();
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
    await user.type(screen.getByLabelText(/Apellidos y Nombres \*/i), "Sergio Serruche");
    await user.type(screen.getByLabelText(/Correo Electrónico para Notificación \*/i), "sergio@correo.pe");
    await user.type(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i), "961234567");
    await screen.findByRole("option", { name: /^Certificado de estudios$/i });
    await user.selectOptions(
      screen.getByLabelText(/Procedimiento TUPA 2026/i),
      REGISTRO_VERSION_CERTIFICADO,
    );
    await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i), "Solicitud de convalidación académica");

    const botonRegistrar = screen.getByRole("button", { name: /✓ Registrar y Emitir Cargo CUT/i });
    await user.click(botonRegistrar);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/tramites/ventanilla-presencial",
      expect.objectContaining({ registroVersionId: REGISTRO_VERSION_CERTIFICADO }),
    );

    // Debe abrir el modal de cargo con el CUT generado
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Sergio Serruche/i)).toBeInTheDocument();
    expect(screen.getByText(/EXP-2026-/i)).toBeInTheDocument();
  });

  it("flujo no TUPA omite registroVersionId", async () => {
    const user = userEvent.setup();
    const post = vi.mocked(apiClient.post);
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);

    await user.type(screen.getByLabelText(/Número de Documento \*/i), "74561238");
    await user.type(screen.getByLabelText(/Apellidos y Nombres \*/i), "Sergio Serruche");
    await user.type(screen.getByLabelText(/Correo Electrónico para Notificación \*/i), "sergio@correo.pe");
    await user.type(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i), "961234567");
    await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), "NO_TUPA");
    await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i), "Solicitud documentaria general");
    await user.click(screen.getByRole("button", { name: /Registrar y Emitir Cargo CUT/i }));

    expect(post).toHaveBeenCalledWith(
      "/api/v1/tramites/ventanilla-presencial",
      expect.not.objectContaining({ registroVersionId: expect.anything() }),
    );
  });
});
