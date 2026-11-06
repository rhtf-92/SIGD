import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import StepDocumentos from "../../../src/components/tramite/WizardSteps/StepDocumentos";
import StepConfirmacion from "../../../src/components/tramite/WizardSteps/StepConfirmacion";
import VentanillaPresencialPage from "../../../src/pages/tramite/VentanillaPresencialPage";
import CargoDigitalModal from "../../../src/components/tramite/CargoDigitalModal";
import type { TramiteWizardState, DocumentosData } from "../../../src/types/tramiteWizardState";
import type { CargoOficialTramite } from "../../../src/types/cargoOficial";
import { apiClient } from "@/api/client";
import { getCanonicalUuidForCodigo } from "../../../src/hooks/useCatalogoTupa";

/**
 * Suite de Integración Fullstack Frontend E2E — Milestone 3 & M4 (worker_o9_m3)
 * Certificación de Selección y Radicación Multi-Procedimiento TUPA
 * (TUPA-01, TUPA-02, TUPA-03, TUPA-04, TUPA-48, LIBRE-01) en Mesa de Partes Virtual y Ventanilla Presencial
 */

describe("Fullstack E2E Lifecycle & Multi-TUPA Integration Suite (M3/M4)", () => {
  const PROCEDIMIENTOS_OBJETIVO = [
    {
      codigo: "TUPA-01",
      codigoCorto: "01",
      uuid: "00000000-0000-0000-0001-000000000001",
      nombre: "Certificado de estudios",
      arancelEsperado: /S\/\.\s*11\.00/i,
      plazoEsperado: /05 días hábiles/i,
    },
    {
      codigo: "TUPA-02",
      codigoCorto: "02",
      uuid: "00000000-0000-0000-0001-000000000002",
      nombre: "Convalidación de estudios",
      arancelEsperado: /S\/\.\s*25\.00/i,
      plazoEsperado: /Cronograma/i,
    },
    {
      codigo: "TUPA-03",
      codigoCorto: "03",
      uuid: "00000000-0000-0000-0001-000000000003",
      nombre: "Constancia de aprobación de prácticas",
      arancelEsperado: /S\/\.\s*3\.00/i,
      plazoEsperado: /01 día hábil/i,
    },
    {
      codigo: "TUPA-04",
      codigoCorto: "04",
      uuid: "00000000-0000-0000-0001-000000000004",
      nombre: "Carta de presentación",
      arancelEsperado: /S\/\.\s*3\.00/i,
      plazoEsperado: /01 día/i,
    },
    {
      codigo: "TUPA-48",
      codigoCorto: "48",
      uuid: "00000000-0000-0000-0001-000000000048",
      nombre: "Otros servicios y alquileres",
      arancelEsperado: /Tarifas según servicio y alquiler/i,
      plazoEsperado: /30 días hábiles/i,
    },
    {
      codigo: "LIBRE-01",
      codigoCorto: "LIBRE",
      uuid: "00000000-0000-0000-0001-000000000099",
      nombre: "Solicitud Formal General",
      arancelEsperado: /Gratuito/i,
      plazoEsperado: /30 días hábiles/i,
    },
  ];

  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. MESA DE PARTES VIRTUAL: ASISTENTE WIZARD (StepDocumentos & StepConfirmacion)
  // ===========================================================================
  describe("1. Mesa de Partes Virtual: Visualización y Radicación Multi-TUPA", () => {
    it.each(PROCEDIMIENTOS_OBJETIVO)(
      "StepDocumentos despliega correctamente requisitos y arancel para $codigo ($nombre)",
      async (proc) => {
        const user = userEvent.setup();
        const dispatchMock = vi.fn();

        const dataInicial: DocumentosData = {
          tipoTramiteId: "",
          asunto: "",
          numeroFolios: 1,
          archivos: [],
        };

        render(
          <MemoryRouter>
            <StepDocumentos
              data={dataInicial}
              dispatch={dispatchMock}
              onNext={vi.fn()}
              onBack={vi.fn()}
            />
          </MemoryRouter>,
        );

        const select = screen.getByLabelText(/Procedimiento Institucional o Trámite TUPA/i);
        expect(select).toBeInTheDocument();

        // Seleccionar por código
        await user.selectOptions(select, proc.codigo);

        // Debe despachar acción UPDATE_DOCUMENTOS
        expect(dispatchMock).toHaveBeenCalledWith({
          type: "UPDATE_DOCUMENTOS",
          payload: { tipoTramiteId: proc.codigo },
        });

        // Re-render con el trámite seleccionado
        cleanup();
        render(
          <MemoryRouter>
            <StepDocumentos
              data={{ ...dataInicial, tipoTramiteId: proc.codigo }}
              dispatch={dispatchMock}
              onNext={vi.fn()}
              onBack={vi.fn()}
            />
          </MemoryRouter>,
        );

        // Verificar la presencia del nombre, arancel y plazo si aplica
        expect(screen.getAllByText(new RegExp(proc.nombre, "i")).length).toBeGreaterThanOrEqual(1);
        if (proc.arancelEsperado) {
          expect(screen.getByText(proc.arancelEsperado)).toBeInTheDocument();
        }
        if (proc.plazoEsperado) {
          expect(screen.getByText(proc.plazoEsperado)).toBeInTheDocument();
        }
      },
    );

    it.each(PROCEDIMIENTOS_OBJETIVO)(
      "StepConfirmacion transmite UUID canónico para $codigo hacia POST /api/v1/tramites/radicacion-virtual",
      async (proc) => {
        let payloadCapturado: any = null;

        vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
          if (url.includes("tramites/tipos")) {
            return {
              data: PROCEDIMIENTOS_OBJETIVO.map((p) => ({
                id: p.uuid,
                codigo: p.codigo,
                nombre: p.nombre,
              })),
            } as any;
          }
          return { data: {} } as any;
        });

        vi.spyOn(apiClient, "post").mockImplementation(async (url: string, data: any) => {
          if (url.includes("radicacion-virtual")) {
            payloadCapturado = data;
            return {
              data: {
                expedienteId: "exp-test-uuid-1234",
                cut: `EXP-2026-000${proc.codigoCorto.padStart(3, "0")}`,
                anioFiscal: 2026,
                fechaEnvioReal: new Date().toISOString(),
                fechaRadicacionLegal: new Date().toISOString(),
                diferidoPorCorte: false,
                totalFolios: 3,
                qrSeguimientoUrl: `https://sigd.iestpsuiza.edu.pe/tramite?cut=EXP-2026-000${proc.codigoCorto.padStart(3, "0")}`,
                cargoDigital: {
                  codigo: "CARGO-TEST",
                  hashSha256: "a".repeat(64),
                  qrContenido: "SIGD://cargo/TEST",
                },
                mensajeLegal: "Radicado conforme a ley",
              },
            } as any;
          }
          return { data: {} } as any;
        });

        const estadoWizard: TramiteWizardState = {
          currentStep: 4,
          identificacion: {
            tipoDocumento: "DNI",
            numeroDocumento: "74561238",
            nombres: "María Elena",
            apellidos: "García Flores",
            correo: "maria@iestpsuiza.edu.pe",
            telefono: "961234567",
            direccion: "Av. Túpac Amaru 123",
          },
          documentos: {
            tipoTramiteId: proc.codigo,
            asunto: `Solicitud formal de ${proc.nombre}`,
            numeroFolios: 3,
            archivos: [
              {
                nombre: "documento.pdf",
                hashSha256: "b".repeat(64),
                peso: 2048,
              },
            ],
          },
          declaracionJurada: {
            autorizaNotificacionCasilla: true,
            aceptaTerminos: true,
            declaracionVeracidad: true,
          },
          cargoEmitido: null,
          isSubmitting: false,
          error: null,
        };

        const dispatchMock = vi.fn();
        const onSuccessMock = vi.fn();
        const user = userEvent.setup();

        render(
          <MemoryRouter>
            <StepConfirmacion
              state={estadoWizard}
              dispatch={dispatchMock}
              onBack={vi.fn()}
              onSuccess={onSuccessMock}
            />
          </MemoryRouter>,
        );

        const botonRadicar = screen.getByRole("button", { name: /^Radicar Trámite$/i });
        await user.click(botonRadicar);

        await waitFor(() => {
          expect(payloadCapturado).not.toBeNull();
        });

        // Debe resolver el UUID canónico oficial del procedimiento
        expect(payloadCapturado.idTipoTramiteTupa).toBe(proc.uuid);
        expect(payloadCapturado.nombreSolicitante).toContain("María Elena");
        expect(payloadCapturado.correo).toBe("maria@iestpsuiza.edu.pe");
        expect(payloadCapturado.totalFolios).toBe(3);
      },
    );
  });

  // ===========================================================================
  // 2. VENTANILLA PRESENCIAL: REGISTRO FÍSICO Y CARGO CON TICKET TÉRMICO
  // ===========================================================================
  describe("2. Ventanilla Presencial: Registro Multi-TUPA y Emisión de Cargo", () => {
    it.each(PROCEDIMIENTOS_OBJETIVO)(
      "VentanillaPresencialPage registra físicamente el trámite $codigo ($nombre) y envía payload estructurado",
      async (proc) => {
        let payloadVentanilla: any = null;

        vi.spyOn(apiClient, "post").mockImplementation(async (url: string, data: any) => {
          if (url.includes("ventanilla-presencial")) {
            payloadVentanilla = data;
            return {
              data: {
                expedienteId: "exp-ventanilla-uuid",
                cut: `EXP-2026-000${proc.codigoCorto.padStart(3, "0")}`,
                anioFiscal: 2026,
                fechaRadicacion: new Date().toISOString(),
                ticketImpresion: "TICKET POS",
                cargo: {
                  cut: `EXP-2026-000${proc.codigoCorto.padStart(3, "0")}`,
                  remitente: "Carlos Mendoza Ríos",
                  dni: "45872315",
                  asunto: `Trámite presencial ${proc.nombre}`,
                  folios: 4,
                  fechaRecepcion: new Date().toISOString(),
                  hashSha256: "c".repeat(64),
                  qrSeguimientoUrl: `https://sigd.iestpsuiza.edu.pe/tramite?cut=EXP-2026-000${proc.codigoCorto.padStart(3, "0")}`,
                },
              },
            } as any;
          }
          return { data: {} } as any;
        });

        const user = userEvent.setup();

        render(
          <MemoryRouter>
            <VentanillaPresencialPage />
          </MemoryRouter>,
        );

        await user.type(screen.getByLabelText(/Número de Documento \*/i), "45872315");
        await user.type(screen.getByLabelText(/Apellidos y Nombres \*/i), "Carlos Mendoza Ríos");
        await user.type(screen.getByLabelText(/Correo Electrónico para Notificación \*/i), "carlos@gmail.com");
        await user.type(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i), "961234567");

        const selectorTupa = screen.getByLabelText(/Procedimiento TUPA 2026/i);
        // En ventanilla las opciones son el código corto ("01", "02", "03", "04", "48", "NO_TUPA")
        const opcionValue = proc.codigo === "LIBRE-01" ? "NO_TUPA" : proc.codigoCorto;
        await user.selectOptions(selectorTupa, opcionValue);

        await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i), `Trámite presencial ${proc.nombre}`);

        const botonRegistrar = screen.getByRole("button", { name: /✓ Registrar y Emitir Cargo CUT/i });
        await user.click(botonRegistrar);

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        expect(payloadVentanilla).toBeDefined();
        expect(payloadVentanilla.idTipoTramiteTupa).toBe(proc.uuid);
        expect(payloadVentanilla.codigoTupa).toBe(proc.codigo);
        expect(payloadVentanilla.dniSolicitante).toBe("45872315");
      },
    );
  });

  // ===========================================================================
  // 3. CICLO DE VIDA E2E: CARGO DIGITAL, SEGUIMIENTO QR Y NOTIFICACIÓN
  // ===========================================================================
  describe("3. Certificación del Ciclo de Vida: Cargo Digital, Foliación y QR", () => {
    it("CargoDigitalModal renderiza datos legales completos, estampa QR y botón de ticket térmico", () => {
      const cargoMock: CargoOficialTramite = {
        codigoExpediente: "EXP-2026-000301",
        fechaRecepcionIso: "2026-10-05T10:00:00.000Z",
        fechaIngresoFormalIso: "2026-10-05T10:00:00.000Z",
        horaRecepcion: "10:00:00",
        operadorVentanillaNombre: "Operador de Mesa de Partes (Ventanilla 1)",
        sedeInstitucional: "Sede Central - Av. Túpac Amaru Km. 4.5, Pucallpa",
        solicitante: {
          tipoPersona: "NATURAL",
          tipoDocumento: "DNI",
          numeroDocumento: "74561238",
          nombreOrazonSocial: "Ana Sofía Ramos Torres",
          correoElectronico: "ana.ramos@iestpsuiza.edu.pe",
          telefono: "961234567",
        },
        asunto: "Solicitud de Titulación Profesional Técnica en Computación",
        documentoPrincipalTipo: "SOLICITUD",
        cantidadFolios: 25,
        hashSha256Recepcion: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        horaCorteAplicada: "16:30",
        radicadoDiaSiguiente: false,
        urlSeguimiento: "https://sigd.iestpsuiza.edu.pe/tramite?cut=EXP-2026-000301",
      };

      render(
        <CargoDigitalModal
          isOpen={true}
          onClose={vi.fn()}
          cargo={cargoMock}
        />,
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("EXP-2026-000301")).toBeInTheDocument();
      expect(screen.getByText(/Ana Sofía Ramos Torres/i)).toBeInTheDocument();
      expect(screen.getByText(/25 foja\(s\)/i)).toBeInTheDocument();
      expect(screen.getByRole("img", { name: /QR para seguimiento del trámite/i })).toBeInTheDocument();
      expect(screen.getByText(/🖨️ Imprimir Ticket Térmico/i)).toBeInTheDocument();
    });

    it("valida la función getCanonicalUuidForCodigo para todos los procedimientos", () => {
      for (const proc of PROCEDIMIENTOS_OBJETIVO) {
        const canonicalUuid = getCanonicalUuidForCodigo(proc.codigo);
        expect(canonicalUuid).toBe(proc.uuid);
      }
    });
  });
});
