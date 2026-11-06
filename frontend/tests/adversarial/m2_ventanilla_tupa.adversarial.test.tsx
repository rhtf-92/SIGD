import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, cleanup, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import VentanillaPresencialPage from "../../src/pages/tramite/VentanillaPresencialPage";
import CargoDigitalModal from "../../src/components/tramite/CargoDigitalModal";
import { ThermalTicketPreview } from "../../src/components/tramite/ThermalTicketPreview";
import { StepDocumentos } from "../../src/components/tramite/WizardSteps/StepDocumentos";
import {
  useCatalogoTupa,
  getCanonicalUuidForCodigo,
  CATALOGO_TUPA_COMPLETO_FALLBACK,
} from "../../src/hooks/useCatalogoTupa";
import type { DocumentosData } from "../../src/types/tramiteWizardState";
import type { CargoOficialTramite } from "../../src/types/cargoOficial";
import { apiClient } from "@/api/client";

describe("Adversarial Stress Suite — Milestone 2: Ventanilla Presencial, TUPA & Thermal Ticket", () => {
  const originalPrint = window.print;

  beforeEach(() => {
    vi.restoreAllMocks();
    window.print = vi.fn();
  });

  afterEach(() => {
    cleanup();
    window.print = originalPrint;
  });

  // =========================================================================
  // 1. THERMAL TICKET PRINTING (80mm / 58mm), CUT QR RENDERING & AGN FOLIATION
  // =========================================================================
  describe("1. Thermal Ticket Printing, CUT QR Rendering and AGN Foliation", () => {
    const mockCargoBase: CargoOficialTramite = {
      codigoExpediente: "EXP-2026-000789",
      fechaRecepcionIso: "2026-10-05T10:15:00.000Z",
      fechaIngresoFormalIso: "2026-10-05T10:15:00.000Z",
      horaRecepcion: "10:15:00",
      operadorVentanillaNombre: "Operador de Mesa de Partes (Ventanilla 1)",
      sedeInstitucional: "Sede Central - Jr. Tarapacá N° 645, Pucallpa",
      solicitante: {
        tipoPersona: "NATURAL",
        tipoDocumento: "DNI",
        numeroDocumento: "45678912",
        nombreOrazonSocial: "Gladys Panduro Ruiz",
        correoElectronico: "gladys@gmail.com",
        telefono: "961987654",
      },
      asunto: "TUPA 01: Certificado de estudios - Solicitud de certificado oficial",
      documentoPrincipalTipo: "SOLICITUD",
      cantidadFolios: 27,
      hashSha256Recepcion: "a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef",
      horaCorteAplicada: "16:30",
      radicadoDiaSiguiente: false,
      urlSeguimiento: "https://sigd.iestpsuiza.edu.pe/tramite?cut=EXP-2026-000789",
    };

    it("renderiza correctamente el ticket térmico con CUT, código QR y folios AGN", () => {
      render(
        <CargoDigitalModal
          isOpen={true}
          onClose={() => {}}
          cargo={mockCargoBase}
        />
      );

      // Verificación de CUT
      expect(screen.getByText("EXP-2026-000789")).toBeInTheDocument();
      // Verificación de Foliación AGN
      expect(screen.getByText(/27 foja\(s\)/i)).toBeInTheDocument();
      // Verificación de QR SVG con role="img" y accessible label
      const qrElement = screen.getByRole("img", {
        name: /QR para seguimiento del trámite EXP-2026-000789/i,
      });
      expect(qrElement).toBeInTheDocument();
      expect(qrElement.tagName.toLowerCase()).toBe("svg");
    });

    it("al hacer clic en 'Imprimir Ticket Térmico', invoca window.print() para impresión ESC/POS", async () => {
      const user = userEvent.setup();

      render(
        <CargoDigitalModal
          isOpen={true}
          onClose={() => {}}
          cargo={mockCargoBase}
        />
      );

      const botonImprimir = screen.getByRole("button", {
        name: /🖨️ Imprimir Ticket Térmico/i,
      });
      await user.click(botonImprimir);

      expect(window.print).toHaveBeenCalledTimes(1);
    });

    it("ThermalTicketPreview admite explícitamente rollos térmicos de 80mm", () => {
      const ticketData = {
        codigoCUT: "EXP-2026-000789",
        administrado: "Gladys Panduro",
        dni: "45678912",
        tramite: "Certificado de estudios",
        folios: 27,
        fecha: "2026-10-05 10:15",
      };

      const { container } = render(
        <ThermalTicketPreview paperWidth="80mm" ticketData={ticketData} />
      );
      const ticket80 = container.querySelector("#thermal-ticket");
      expect(ticket80).toHaveClass("w-[80mm]");
    });

    it("ThermalTicketPreview admite explícitamente rollos térmicos de 58mm", () => {
      const ticketData = {
        codigoCUT: "EXP-2026-000789",
        administrado: "Gladys Panduro",
        dni: "45678912",
        tramite: "Certificado de estudios",
        folios: 27,
        fecha: "2026-10-05 10:15",
      };

      const { container } = render(
        <ThermalTicketPreview paperWidth="58mm" ticketData={ticketData} />
      );
      const ticket58 = container.querySelector("#thermal-ticket");
      expect(ticket58).toHaveClass("w-[58mm]");
    });

    it("maneja folios límite según Directiva AGN (1 folio mínimo y hasta 500 folios)", () => {
      const cargoMaxFolios = { ...mockCargoBase, cantidadFolios: 500 };
      render(
        <CargoDigitalModal
          isOpen={true}
          onClose={() => {}}
          cargo={cargoMaxFolios}
        />
      );
      expect(screen.getByText(/500 foja\(s\)/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. REQUIREMENTS CHECKLIST & FEE CALCULATIONS ACCURACY
  // =========================================================================
  describe("2. Requirements Checklist & Fee Calculations Accuracy", () => {
    it("procedimiento 01: despliega arancel exacto y checklist reactivo de 4 requisitos", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      await user.selectOptions(
        screen.getByLabelText(/Procedimiento TUPA 2026/i),
        "01"
      );

      // Verificación de Título y Arancel
      expect(
        screen.getByText(/Derecho de pago: S\/\. 11\.00 por semestre; S\/\. 2\.00/i)
      ).toBeInTheDocument();

      // Verificación de Requisitos Iniciales (0 de 4)
      expect(screen.getByText(/0 de 4 verificados/i)).toBeInTheDocument();

      // Marcar checkbox "Constancia de No Adeudar"
      const checkboxConstancia = screen.getByLabelText("Constancia de No Adeudar");
      expect(checkboxConstancia).not.toBeChecked();

      await user.click(checkboxConstancia);
      expect(checkboxConstancia).toBeChecked();
      expect(screen.getByText(/1 de 4 verificados/i)).toBeInTheDocument();

      // Marcar un segundo requisito
      const checkboxFUT = screen.getByLabelText("Solicitud FUT");
      await user.click(checkboxFUT);
      expect(screen.getByText(/2 de 4 verificados/i)).toBeInTheDocument();

      // Desmarcar requisito
      await user.click(checkboxConstancia);
      expect(checkboxConstancia).not.toBeChecked();
      expect(screen.getByText(/1 de 4 verificados/i)).toBeInTheDocument();
    });

    it("procedimiento 47: despliega los 11 servicios médicos odontológicos en 'Servicios y tarifas'", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      await user.selectOptions(
        screen.getByLabelText(/Procedimiento TUPA 2026/i),
        "47"
      );

      expect(screen.getByText("Curación pequeña: S/. 10.00")).toBeInTheDocument();
      expect(screen.getByText("Fluorización: S/. 5.00")).toBeInTheDocument();
      expect(screen.getByText("Destartraje: S/. 20.00")).toBeInTheDocument();
      expect(screen.getByText("Rayos X oclusales: S/. 23.00")).toBeInTheDocument();
    });

    it("procedimiento 48: despliega arancel general 'Tarifas según servicio y alquiler' y lista de alquileres", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      await user.selectOptions(
        screen.getByLabelText(/Procedimiento TUPA 2026/i),
        "48"
      );

      expect(
        screen.getByText(/Derecho de pago: Tarifas según servicio y alquiler/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText("Alquiler de Proyector Multimedia: S/. 10.00 / hora")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Alquiler de Auditorio interno: S/. 700.00 / día")
      ).toBeInTheDocument();
    });

    it("trámite NO_TUPA (Trámite Libre): arancel Gratuito y requisitos generales según Art. 117 LPAG", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      await user.selectOptions(
        screen.getByLabelText(/Procedimiento TUPA 2026/i),
        "NO_TUPA"
      );

      expect(screen.getByText(/Derecho de pago: Gratuito/i)).toBeInTheDocument();
      expect(screen.getByText(/0 de (2|3) verificados/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(
          /Solicitud.*dirigid.*a la Dirección/i
        )
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. EDGE CASES: EMPTY SELECTION, INVALID CODE, PROCEDURE SWITCHING
  // =========================================================================
  describe("3. Edge Cases: Empty Selection, Non-Existent Procedure, Switching Mid-Form", () => {
    it("selección vacía: no renderiza tarjeta de detalle TUPA y no causa excepciones", () => {
      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      expect(screen.queryByLabelText(/detalle-tupa-heading/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Requisitos documentarios/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Derecho de pago:/i)).not.toBeInTheDocument();
    });

    it("código inexistente: getCanonicalUuidForCodigo maneja códigos desconocidos sin lanzar excepción", () => {
      const uuidDefault = getCanonicalUuidForCodigo("CODIGO_INEXISTENTE_XYZ");
      expect(uuidDefault).toBe("00000000-0000-0000-0001-000000000001");

      const uuidLibre = getCanonicalUuidForCodigo("LIBRE_OTRO");
      expect(uuidLibre).toBe("00000000-0000-0000-0001-000000000099");

      const uuidNoTupa = getCanonicalUuidForCodigo("NO_TUPA");
      expect(uuidNoTupa).toBe("00000000-0000-0000-0001-000000000099");

      const uuid48 = getCanonicalUuidForCodigo("TUPA-48");
      expect(uuid48).toBe("00000000-0000-0000-0001-000000000048");
    });

    it("conmutación de procedimientos mid-form: limpia rigurosamente los requisitos marcados", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      const selectTupa = screen.getByLabelText(/Procedimiento TUPA 2026/i);

      // 1. Seleccionar procedimiento 01 y marcar dos requisitos
      await user.selectOptions(selectTupa, "01");
      expect(screen.getByText(/0 de 4 verificados/i)).toBeInTheDocument();

      const req0 = screen.getByLabelText("Solicitud FUT");
      const req1 = screen.getByLabelText("Constancia de No Adeudar");
      await user.click(req0);
      await user.click(req1);
      expect(screen.getByText(/2 de 4 verificados/i)).toBeInTheDocument();

      // 2. Conmutar a procedimiento 02 (Convalidación de estudios)
      await user.selectOptions(selectTupa, "02");

      // El contador DEBE reiniciarse a 0 y no arrastrar los checks previos
      expect(screen.getByText(/0 de 4 verificados/i)).toBeInTheDocument();
      const reqConvalida0 = screen.getByLabelText("Solicitud FUT");
      expect(reqConvalida0).not.toBeChecked();

      // 3. Conmutar a NO_TUPA
      await user.selectOptions(selectTupa, "NO_TUPA");
      expect(screen.getByText(/0 de (2|3) verificados/i)).toBeInTheDocument();

      // 4. Volver a conmutar a vacío ""
      await user.selectOptions(selectTupa, "");
      expect(screen.queryByText(/Requisitos documentarios/i)).not.toBeInTheDocument();
    });

    it("botón 'Limpiar Campos' resetea completamente el estado de la ventanilla", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      // Llenar campos
      await user.type(screen.getByLabelText(/Número de Documento \*/i), "74561238");
      await user.type(screen.getByLabelText(/Apellidos y Nombres \*/i), "María Alva");
      await user.type(screen.getByLabelText(/Correo Electrónico para Notificación \*/i), "maria@correo.pe");
      await user.type(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i), "961112233");
      await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), "03");
      await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i), "Petitorio de prueba");

      // Clic en Limpiar Campos
      const botonLimpiar = screen.getByRole("button", { name: /Limpiar Campos/i });
      await user.click(botonLimpiar);

      // Verificar que todos los campos volvieron a su estado inicial
      expect(screen.getByLabelText(/Número de Documento \*/i)).toHaveValue("");
      expect(screen.getByLabelText(/Apellidos y Nombres \*/i)).toHaveValue("");
      expect(screen.getByLabelText(/Correo Electrónico para Notificación \*/i)).toHaveValue("");
      expect(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i)).toHaveValue("");
      expect(screen.getByLabelText(/Procedimiento TUPA 2026/i)).toHaveValue("");
      expect(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i)).toHaveValue("");
      expect(screen.queryByText(/Requisitos documentarios/i)).not.toBeInTheDocument();
    });

    it("envío con conmutación dinámica transmite el UUID canónico exacto a la API", async () => {
      const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({
        data: {
          expedienteId: "00000000-0000-0000-0001-000000000010",
          cut: "EXP-2026-000999",
          anioFiscal: 2026,
          fechaRadicacion: "2026-10-05T11:00:00.000Z",
          ticketImpresion: "TICKET",
          cargo: {
            cut: "EXP-2026-000999",
            remitente: "Carlos Ruiz",
            dni: "74561238",
            asunto: "TUPA 10: Traslado externo - Solicitud de traslado",
            folios: 5,
            fechaRecepcion: "2026-10-05T11:00:00.000Z",
            hashSha256: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
            qrSeguimientoUrl: "https://sigd.iestpsuiza.edu.pe/tramite?cut=EXP-2026-000999",
          },
        },
      } as any);

      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      await user.type(screen.getByLabelText(/Número de Documento \*/i), "74561238");
      await user.type(screen.getByLabelText(/Apellidos y Nombres \*/i), "Carlos Ruiz");
      await user.type(screen.getByLabelText(/Correo Electrónico para Notificación \*/i), "carlos@correo.pe");
      await user.type(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i), "961556677");

      // Seleccionar TUPA 10
      await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), "10");
      await user.clear(screen.getByLabelText(/Cantidad de Folios Físicos \*/i));
      await user.type(screen.getByLabelText(/Cantidad de Folios Físicos \*/i), "5");
      await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i), "Solicitud de traslado");

      const botonRegistrar = screen.getByRole("button", {
        name: /✓ Registrar y Emitir Cargo CUT/i,
      });
      await user.click(botonRegistrar);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledTimes(1);
      });

      const calledPayload = postSpy.mock.calls[0][1] as any;
      expect(calledPayload.idTipoTramiteTupa).toBe(
        "00000000-0000-0000-0001-000000000010"
      );
      expect(calledPayload.codigoTupa).toBe("TUPA-10");
      expect(calledPayload.foliosTotales).toBe(5);
      expect(calledPayload.dniSolicitante).toBe("74561238");
    });
  });

  // =========================================================================
  // 4. STEP DOCUMENTOS (MESA DE PARTES VIRTUAL) RESILIENCE
  // =========================================================================
  describe("4. StepDocumentos (Mesa de Partes Virtual) Resilience", () => {
    const mockDocumentosDataVacia: DocumentosData = {
      tipoTramiteId: "",
      asunto: "",
      numeroFolios: 1,
      archivos: [],
    };

    it("StepDocumentos: contiene las 49 opciones en el selector TUPA", () => {
      render(
        <StepDocumentos
          data={mockDocumentosDataVacia}
          dispatch={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const options = screen.getAllByRole("option");
      // 1 placeholder "-- Seleccione un procedimiento oficial --" + 49 procedimientos = 50
      expect(options).toHaveLength(50);
    });

    it("StepDocumentos: muestra tarjeta de detalle al seleccionar TUPA-05", () => {
      const dataConTupa05: DocumentosData = {
        ...mockDocumentosDataVacia,
        tipoTramiteId: "TUPA-05",
      };

      render(
        <StepDocumentos
          data={dataConTupa05}
          dispatch={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(
        screen.getByRole("heading", {
          name: /Aprobación de borrador de informe de práctica profesional/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByText(/Derecho de Pago \/ Arancel/i)).toBeInTheDocument();
      expect(screen.getByText("S/. 20.00")).toBeInTheDocument();
      expect(screen.getByText(/07 días/i)).toBeInTheDocument();
    });

    it("StepDocumentos: rechaza avanzar si no hay procedimiento ni asunto ni archivos", async () => {
      const user = userEvent.setup();
      const onNextSpy = vi.fn();

      render(
        <StepDocumentos
          data={mockDocumentosDataVacia}
          dispatch={vi.fn()}
          onNext={onNextSpy}
          onBack={vi.fn()}
        />
      );

      const botonSiguiente = screen.getByRole("button", { name: /Siguiente/i });
      expect(botonSiguiente).toBeDisabled();

      await user.click(botonSiguiente);
      expect(onNextSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. HOOK useCatalogoTupa OFFLINE RESILIENCE & BIDIRECTIONAL LOOKUP
  // =========================================================================
  describe("5. useCatalogoTupa Hook Resilience & Bidirectional Lookup", () => {
    it("CATALOGO_TUPA_COMPLETO_FALLBACK contiene exactamente 48 trámites TUPA + 1 Trámite Libre (49 total)", () => {
      expect(CATALOGO_TUPA_COMPLETO_FALLBACK).toHaveLength(49);

      const tupas = CATALOGO_TUPA_COMPLETO_FALLBACK.filter((t) => t.esTupa);
      const noTupas = CATALOGO_TUPA_COMPLETO_FALLBACK.filter((t) => !t.esTupa);

      expect(tupas).toHaveLength(48);
      expect(noTupas).toHaveLength(1);
      expect(noTupas[0].codigo).toBe("LIBRE-01");
      expect(noTupas[0].id).toBe("00000000-0000-0000-0001-000000000099");
    });

    it("todos los procedimientos poseen UUIDs válidos e irrepetibles", () => {
      const uuids = new Set(CATALOGO_TUPA_COMPLETO_FALLBACK.map((t) => t.id));
      expect(uuids.size).toBe(CATALOGO_TUPA_COMPLETO_FALLBACK.length);

      for (const item of CATALOGO_TUPA_COMPLETO_FALLBACK) {
        expect(item.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      }
    });

    it("obtenerPorCodigo soporta búsqueda insensible a mayúsculas y formato", () => {
      const { result } = renderHook(() => useCatalogoTupa());

      // Por código formal
      expect(result.current.obtenerPorCodigo("TUPA-01")?.codigo).toBe("TUPA-01");
      // Por código minúscula
      expect(result.current.obtenerPorCodigo("tupa-01")?.codigo).toBe("TUPA-01");
      // Por código corto
      expect(result.current.obtenerPorCodigo("01")?.codigo).toBe("TUPA-01");
      // Por alias no_tupa
      expect(result.current.obtenerPorCodigo("no_tupa")?.codigo).toBe("LIBRE-01");
      // Por LIBRE
      expect(result.current.obtenerPorCodigo("LIBRE")?.codigo).toBe("LIBRE-01");
      // Inexistente
      expect(result.current.obtenerPorCodigo("NON_EXISTENT_999")).toBeUndefined();
    });

    it("resiste fallos de red al consultar /api/v1/tramites/tipos sin lanzar excepción", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValue(new Error("Conexión rehusada ECONNREFUSED"));

      const { result } = renderHook(() => useCatalogoTupa());

      await waitFor(() => {
        expect(result.current.cargando).toBe(false);
      });

      // El catálogo de respaldo DEBE estar intacto con 49 items
      expect(result.current.catalogo).toHaveLength(49);
      expect(result.current.error).toBe("Conexión rehusada ECONNREFUSED");
    });
  });
});
