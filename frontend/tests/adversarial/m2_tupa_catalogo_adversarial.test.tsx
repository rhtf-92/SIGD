import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, renderHook, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { z } from "zod";

import {
  useCatalogoTupa,
  getCanonicalUuidForCodigo,
  TRAMITE_LIBRE_INSTITUCIONAL,
} from "../../src/hooks/useCatalogoTupa";
import StepDocumentos from "../../src/components/tramite/WizardSteps/StepDocumentos";
import StepConfirmacion from "../../src/components/tramite/WizardSteps/StepConfirmacion";
import VentanillaPresencialPage from "../../src/pages/tramite/VentanillaPresencialPage";
import type { TramiteWizardState, DocumentosData } from "../../src/types/tramiteWizardState";
import { apiClient } from "@/api/client";

// ==============================================================================
// ESQUEMAS ZOD ESPEJO DE BACKEND (tramites.schemas.ts)
// ==============================================================================
const adjuntoRadicacionSchema = z.object({
  nombreArchivo: z.string().trim().min(3).max(255),
  contentType: z.literal("application/pdf"),
  tamanoBytes: z.number().int().positive().max(26214400),
  hashSha256: z.string().regex(/^[0-9a-f]{64}$/i),
});

const radicacionVirtualSchema = z
  .object({
    asunto: z
      .string()
      .trim()
      .min(10, "El asunto debe tener al menos 10 caracteres.")
      .max(500, "El asunto no puede superar los 500 caracteres.")
      .refine((v) => v.trim().length >= 10),
    idTipoTramiteTupa: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((v) => v !== "00000000-0000-0000-0000-000000000000"),
    idPersona: z.union([
      z.string().uuid(),
      z.coerce.number().int().positive(),
      z.string().trim().min(1).max(64),
    ]),
    nombreSolicitante: z.string().trim().min(2).max(120),
    correo: z.string().trim().email().max(150),
    totalFolios: z.number().int().min(1).max(5000),
    documentos: z.array(adjuntoRadicacionSchema).min(1).max(30),
  })
  .strict();

const ventanillaPresencialSchema = z.object({
  dniSolicitante: z.string().regex(/^[0-9]{8}$/, "DNI debe contener exactamente 8 dígitos"),
  datosRemitente: z.string().min(3),
  asunto: z.string().min(5).max(500),
  foliosTotales: z.coerce.number().int().positive(),
  areaDestinoId: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/).optional(),
  tipoDocumentalId: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/).optional(),
  idTipoTramiteTupa: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/).optional(),
  codigoTupa: z.string().optional(),
});

describe("ADVERSARIAL CHALLENGE — Milestone 2: Catálogo TUPA Unificado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // SUITE 1: FAULT INJECTION & RESILIENCIA OFFLINE EN useCatalogoTupa
  // ============================================================================
  describe("Suite 1: Resiliencia del hook useCatalogoTupa ante fallos de backend", () => {
    it("1.1. Inyección de Fallo de Red (ERR_NETWORK / Rejection): se activa fallback sin excepciones", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValue(new Error("Network Error: Connection Refused"));

      const { result } = renderHook(() => useCatalogoTupa());

      // Inmediatamente o tras promesa, el catálogo debe tener 49 procedimientos (48 TUPA + 1 LIBRE)
      expect(result.current.catalogo.length).toBe(49);

      await waitFor(() => {
        expect(result.current.cargando).toBe(false);
      });

      expect(result.current.error).toBe("Network Error: Connection Refused");
      expect(result.current.catalogo.length).toBe(49);

      // Verificación de procedimientos clave en modo offline
      const t01 = result.current.obtenerPorCodigo("TUPA-01");
      expect(t01).toBeDefined();
      expect(t01?.codigo).toBe("TUPA-01");
      expect(t01?.id).toBe("00000000-0000-0000-0001-000000000001");

      const t10 = result.current.obtenerPorCodigo("TUPA-10");
      expect(t10?.nombre).toBe("Constancia de no adeudar");
      expect(t10?.id).toBe("00000000-0000-0000-0001-000000000010");

      const t25 = result.current.obtenerPorCodigo("TUPA-25");
      expect(t25?.nombre).toBe("Certificados de estudios urgentes");
      expect(t25?.id).toBe("00000000-0000-0000-0001-000000000025");

      const t48 = result.current.obtenerPorCodigo("TUPA-48");
      expect(t48?.nombre).toBe("Otros servicios y alquileres");
      expect(t48?.id).toBe("00000000-0000-0000-0001-000000000048");

      const libre = result.current.obtenerPorCodigo("LIBRE-01");
      expect(libre?.esTupa).toBe(false);
      expect(libre?.id).toBe("00000000-0000-0000-0001-000000000099");
    });

    it("1.2. Inyección de Error HTTP 500: preserva catálogo offline completo", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValue({
        response: { status: 500, data: { detail: "Internal Server Error" } },
        message: "Request failed with status code 500",
      });

      const { result } = renderHook(() => useCatalogoTupa());

      await waitFor(() => {
        expect(result.current.cargando).toBe(false);
      });

      expect(result.current.catalogo.length).toBe(49);
      expect(result.current.obtenerPorCodigo("NO_TUPA")).toEqual(TRAMITE_LIBRE_INSTITUCIONAL);
    });

    it("1.3. Backend retorna lista vacía []: preserva fallback offline de 49 procedimientos", async () => {
      vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] } as any);

      const { result } = renderHook(() => useCatalogoTupa());

      await waitFor(() => {
        expect(result.current.cargando).toBe(false);
      });

      expect(result.current.catalogo.length).toBe(49);
    });

    it("1.4. Invariante DDL de UUIDs Canónicos: getCanonicalUuidForCodigo genera valores idénticos a 04_sigd_doc.sql", () => {
      expect(getCanonicalUuidForCodigo("TUPA-01")).toBe("00000000-0000-0000-0001-000000000001");
      expect(getCanonicalUuidForCodigo("01")).toBe("00000000-0000-0000-0001-000000000001");
      expect(getCanonicalUuidForCodigo("TUPA-10")).toBe("00000000-0000-0000-0001-000000000010");
      expect(getCanonicalUuidForCodigo("10")).toBe("00000000-0000-0000-0001-000000000010");
      expect(getCanonicalUuidForCodigo("TUPA-25")).toBe("00000000-0000-0000-0001-000000000025");
      expect(getCanonicalUuidForCodigo("25")).toBe("00000000-0000-0000-0001-000000000025");
      expect(getCanonicalUuidForCodigo("TUPA-48")).toBe("00000000-0000-0000-0001-000000000048");
      expect(getCanonicalUuidForCodigo("48")).toBe("00000000-0000-0000-0001-000000000048");
      expect(getCanonicalUuidForCodigo("LIBRE-01")).toBe("00000000-0000-0000-0001-000000000099");
      expect(getCanonicalUuidForCodigo("LIBRE")).toBe("00000000-0000-0000-0001-000000000099");
      expect(getCanonicalUuidForCodigo("NO_TUPA")).toBe("00000000-0000-0000-0001-000000000099");

      // Valores límite
      expect(getCanonicalUuidForCodigo("TUPA-999")).toBe("00000000-0000-0000-0001-000000000999");
      expect(getCanonicalUuidForCodigo("")).toBe("00000000-0000-0000-0001-000000000001");
    });
  });

  // ============================================================================
  // SUITE 2: StepDocumentos.tsx — SELECCIÓN DIVERSA Y ACCESIBILIDAD WCAG 2.1 AA
  // ============================================================================
  describe("Suite 2: Selección diversa y A11y en StepDocumentos", () => {
    const baseDocumentosData: DocumentosData = {
      tipoTramiteId: "",
      asunto: "Solicitud de prueba",
      numeroFolios: 2,
      archivos: [],
    };

    it("2.1. Renderiza el catálogo completo con las opciones TUPA-01, TUPA-10, TUPA-25, TUPA-48 y LIBRE-01", () => {
      render(
        <StepDocumentos
          data={baseDocumentosData}
          dispatch={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const select = screen.getByLabelText(/Procedimiento Institucional o Trámite TUPA/i);
      expect(select).toBeInTheDocument();
      expect(select).toHaveAttribute("required");
      expect(select).toHaveAttribute("aria-required", "true");

      // Verificar existencia de procedimientos diversos
      expect(screen.getByRole("option", { name: /TUPA-01/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /TUPA-10/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /TUPA-25/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /TUPA-48/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /LIBRE-01/i })).toBeInTheDocument();
    });

    it("2.2. Tarjeta reactiva para TUPA-10 (Constancia de no adeudar)", () => {
      render(
        <StepDocumentos
          data={{ ...baseDocumentosData, tipoTramiteId: "TUPA-10" }}
          dispatch={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText("Constancia de no adeudar")).toBeInTheDocument();
      expect(screen.getByText(/S\/\. 2\.00/i)).toBeInTheDocument();
      expect(screen.getByText("Recibo de Pago")).toBeInTheDocument();
      expect(screen.getAllByText(/Administración \/ Biblioteca/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/01 día/i)).toBeInTheDocument();
    });

    it("2.3. Tarjeta reactiva para TUPA-25 (Certificados de estudios urgentes)", () => {
      render(
        <StepDocumentos
          data={{ ...baseDocumentosData, tipoTramiteId: "TUPA-25" }}
          dispatch={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText("Certificados de estudios urgentes")).toBeInTheDocument();
      expect(screen.getByText(/El documento indica S\/\. 0\.50 y S\/\. 15\.00/i)).toBeInTheDocument();
      expect(screen.getByText("01 fotografía tamaño pasaporte")).toBeInTheDocument();
      expect(screen.getByText("Secretaría Académica")).toBeInTheDocument();
    });

    it("2.4. Tarjeta reactiva para TUPA-48 (Otros servicios y alquileres - sin requisitos estáticos)", () => {
      render(
        <StepDocumentos
          data={{ ...baseDocumentosData, tipoTramiteId: "TUPA-48" }}
          dispatch={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText("Otros servicios y alquileres")).toBeInTheDocument();
      expect(screen.getByText(/Tarifas según servicio y alquiler/i)).toBeInTheDocument();
      // No debe romper ni mostrar requisitos si no existen
      expect(screen.queryByText(/Requisitos Documentarios Exigidos \(0\)/i)).toBeNull();
    });

    it("2.5. Tarjeta reactiva para LIBRE-01 (Trámite Libre Institucional)", () => {
      render(
        <StepDocumentos
          data={{ ...baseDocumentosData, tipoTramiteId: "LIBRE-01" }}
          dispatch={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText("Solicitud Formal General / Trámite Libre Institucional")).toBeInTheDocument();
      expect(screen.getByText("Trámite Libre Institucional")).toBeInTheDocument();
      expect(screen.getByText("Gratuito")).toBeInTheDocument();
      expect(screen.getByText("Mesa de Partes General")).toBeInTheDocument();
      expect(screen.getByText(/30 días hábiles \(LPAG Ley N° 27444\)/i)).toBeInTheDocument();
      expect(
        screen.getByText(/amparado en el Art\. 117 del TUO de la Ley N° 27444/i)
      ).toBeInTheDocument();
    });
  });

  // ============================================================================
  // SUITE 3: StepConfirmacion.tsx — AUDITORÍA FORENSE DE PAYLOADS DE RADICACIÓN
  // ============================================================================
  describe("Suite 3: Conformidad de Payload en StepConfirmacion con radicacionVirtualSchema", () => {
    function crearEstadoSimulado(tipoTramiteId: string): TramiteWizardState {
      return {
        currentStep: 4,
        identificacion: {
          tipoDocumento: "DNI",
          numeroDocumento: "74561238",
          nombres: "Rosa Angelica",
          apellidos: "García Lozano",
          correo: "rosa.garcia@iestpsuiza.edu.pe",
          telefono: "961888999",
          direccion: "Av. Centenario Km 4.5",
        },
        documentos: {
          tipoTramiteId,
          asunto: "Solicitud formal debidamente fundamentada para trámite oficial",
          numeroFolios: 3,
          archivos: [
            {
              nombre: "expediente_principal.pdf",
              peso: 204850,
              hashSha256: "b".repeat(64),
            },
          ],
        },
        declaracionJurada: {
          declaracionVeracidad: true,
          aceptaTerminos: true,
          autorizaNotificacionCasilla: true,
        },
        cargoEmitido: null,
        isSubmitting: false,
        error: null,
      };
    }

    const testCasesTupa = [
      { codigo: "TUPA-01", uuidEsperado: "00000000-0000-0000-0001-000000000001" },
      { codigo: "TUPA-10", uuidEsperado: "00000000-0000-0000-0001-000000000010" },
      { codigo: "TUPA-25", uuidEsperado: "00000000-0000-0000-0001-000000000025" },
      { codigo: "TUPA-48", uuidEsperado: "00000000-0000-0000-0001-000000000048" },
      { codigo: "LIBRE-01", uuidEsperado: "00000000-0000-0000-0001-000000000099" },
    ];

    for (const { codigo, uuidEsperado } of testCasesTupa) {
      it(`3.X. Radicación de ${codigo}: envía idTipoTramiteTupa=${uuidEsperado} y cumple estrictamente radicacionVirtualSchema`, async () => {
        let payloadCapturado: any = null;

        vi.spyOn(apiClient, "post").mockImplementation(async (url, data) => {
          if (url === "/api/v1/tramites/radicacion-virtual") {
            payloadCapturado = data;
            return {
              data: {
                expedienteId: "00000000-0000-0000-0000-000000000001",
                cut: `EXP-2026-${codigo}`,
                anioFiscal: 2026,
                fechaEnvioReal: "2026-10-05T10:00:00.000Z",
                fechaRadicacionLegal: "2026-10-05T10:00:00.000Z",
                diferidoPorCorte: false,
                totalFolios: 3,
                qrSeguimientoUrl: "https://sigd.iestpsuiza.edu.pe/consulta",
                cargoDigital: {
                  codigo: `EXP-2026-${codigo}`,
                  hashSha256: "c".repeat(64),
                  qrContenido: "https://sigd.iestpsuiza.edu.pe/consulta",
                },
                mensajeLegal: "Radicado con éxito",
              },
            } as any;
          }
          return { data: {} } as any;
        });

        // Mock offline para /api/v1/tramites/tipos para forzar fallback determinista
        vi.spyOn(apiClient, "get").mockRejectedValue(new Error("Offline"));

        const user = userEvent.setup();
        const state = crearEstadoSimulado(codigo);

        render(
          <StepConfirmacion
            state={state}
            dispatch={vi.fn()}
            onBack={vi.fn()}
          />
        );

        const btnRadicar = screen.getByRole("button", { name: /Radicar Trámite/i });
        await user.click(btnRadicar);

        expect(payloadCapturado).not.toBeNull();
        expect(payloadCapturado.idTipoTramiteTupa).toBe(uuidEsperado);

        // Validación estricta con el esquema Zod oficial de backend
        const parseResult = radicacionVirtualSchema.safeParse(payloadCapturado);
        expect(parseResult.success).toBe(true);

        if (parseResult.success) {
          expect(parseResult.data.asunto).toBe("Solicitud formal debidamente fundamentada para trámite oficial");
          expect(parseResult.data.nombreSolicitante).toBe("Rosa Angelica García Lozano");
          expect(parseResult.data.correo).toBe("rosa.garcia@iestpsuiza.edu.pe");
          expect(parseResult.data.totalFolios).toBe(3);
          expect(parseResult.data.documentos[0].contentType).toBe("application/pdf");
          expect(parseResult.data.documentos[0].hashSha256).toBe("b".repeat(64));
        }
      });
    }
  });

  // ============================================================================
  // SUITE 4: VentanillaPresencialPage.tsx — PAYLOAD Y MULTI-SELECCIÓN TUPA
  // ============================================================================
  describe("Suite 4: Selección TUPA y conformidad en VentanillaPresencialPage", () => {
    const testCasesVentanilla = [
      {
        codigoSelect: "01",
        codigoTupaEsperado: "TUPA-01",
        uuidEsperado: "00000000-0000-0000-0001-000000000001",
      },
      {
        codigoSelect: "10",
        codigoTupaEsperado: "TUPA-10",
        uuidEsperado: "00000000-0000-0000-0001-000000000010",
      },
      {
        codigoSelect: "25",
        codigoTupaEsperado: "TUPA-25",
        uuidEsperado: "00000000-0000-0000-0001-000000000025",
      },
      {
        codigoSelect: "48",
        codigoTupaEsperado: "TUPA-48",
        uuidEsperado: "00000000-0000-0000-0001-000000000048",
      },
      {
        codigoSelect: "NO_TUPA",
        codigoTupaEsperado: "LIBRE-01",
        uuidEsperado: "00000000-0000-0000-0001-000000000099",
      },
    ];

    for (const { codigoSelect, codigoTupaEsperado, uuidEsperado } of testCasesVentanilla) {
      it(`4.X. Ventanilla con selección ${codigoSelect}: envía idTipoTramiteTupa=${uuidEsperado}, codigoTupa=${codigoTupaEsperado} y cumple ventanillaPresencialSchema`, async () => {
        let payloadCapturado: any = null;

        vi.spyOn(apiClient, "post").mockImplementation(async (url, data) => {
          if (url === "/api/v1/tramites/ventanilla-presencial") {
            payloadCapturado = data;
            return {
              data: {
                expedienteId: "00000000-0000-0000-0000-000000000001",
                cut: "EXP-2026-000999",
                anioFiscal: 2026,
                fechaRadicacion: "2026-10-05T10:00:00.000Z",
                ticketImpresion: "TICKET",
                cargo: {
                  cut: "EXP-2026-000999",
                  remitente: "Administrado Presencial",
                  dni: "74561238",
                  asunto: "Trámite Presencial",
                  folios: 2,
                  fechaRecepcion: "2026-10-05T10:00:00.000Z",
                  hashSha256: "d".repeat(64),
                  qrSeguimientoUrl: "https://sigd.iestpsuiza.edu.pe/tramite?cut=EXP-2026-000999",
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
          </MemoryRouter>
        );

        await user.type(screen.getByLabelText(/Número de Documento \*/i), "74561238");
        await user.type(screen.getByLabelText(/Apellidos y Nombres \*/i), "Administrado Presencial");
        await user.type(screen.getByLabelText(/Correo Electrónico para Notificación \*/i), "admin@iestp.pe");
        await user.type(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i), "961234567");

        const selectTupa = screen.getByLabelText(/Procedimiento TUPA 2026 \*/i);
        await user.selectOptions(selectTupa, codigoSelect);

        await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i), "Petitorio formal en ventanilla");

        const btnSubmit = screen.getByRole("button", { name: /✓ Registrar y Emitir Cargo CUT/i });
        await user.click(btnSubmit);

        expect(payloadCapturado).not.toBeNull();
        expect(payloadCapturado.idTipoTramiteTupa).toBe(uuidEsperado);
        expect(payloadCapturado.codigoTupa).toBe(codigoTupaEsperado);

        // Validación con ventanillaPresencialSchema
        const parseResult = ventanillaPresencialSchema.safeParse(payloadCapturado);
        expect(parseResult.success).toBe(true);

        if (parseResult.success) {
          expect(parseResult.data.dniSolicitante).toBe("74561238");
          expect(parseResult.data.datosRemitente).toBe("Administrado Presencial");
          expect(parseResult.data.foliosTotales).toBe(1);
        }
      });
    }
  });
});
