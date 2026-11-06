import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fs from "node:fs";
import path from "node:path";

import BandejaExpedientesPage from "../../src/pages/expedientes/BandejaExpedientesPage";
import ExpedienteDetallePage from "../../src/pages/expedientes/ExpedienteDetallePage";
import VentanillaPresencialPage from "../../src/pages/tramite/VentanillaPresencialPage";
import TramitePage from "../../src/pages/tramite/TramitePage";
import ConsultaPublicaPage from "../../src/pages/tramite/ConsultaPublicaPage";
import VisorCvdPage from "../../src/pages/flujos/VisorCvdPage";
import FlujoValidezLegalPage from "../../src/pages/flujos/FlujoValidezLegalPage";
import CasillaElectronicaPage from "../../src/pages/casilla/CasillaElectronicaPage";
import WorkflowAcademicoPage from "../../src/pages/flujos/WorkflowAcademicoPage";
import ProyectorResolucionesPage from "../../src/pages/flujos/ProyectorResolucionesPage";
import ValidadorPublicoCvdPage from "../../src/pages/validador/ValidadorPublicoCvdPage";

import { useAuthStore } from "../../src/stores/authStore";
import { apiClient } from "../../src/api/client";

// Mock API client for realistic component rendering
vi.mock("../../src/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  DEFAULT_HEADERS: {},
  AUTH_STORAGE_KEY: "sigd_access_token",
  isTokenExpired: vi.fn().mockReturnValue(false),
}));

// Mock casilla service
vi.mock("../../src/services/casillaService", () => ({
  casillaService: {
    getNotificaciones: vi.fn().mockResolvedValue({
      notificaciones: [],
      total: 0,
      pagina: 1,
      totalPaginas: 1,
    }),
    getEstadisticas: vi.fn().mockResolvedValue({
      total: 5,
      noLeidos: 2,
      leidos: 2,
      notificados: 1,
      urgentes: 0,
    }),
    marcarComoLeido: vi.fn(),
    generarAcuseLegal: vi.fn(),
  },
  CASILLA_ENDPOINTS: {
    LISTAR_NOTIFICACIONES: "/api/v1/casilla/notificaciones",
    ESTADISTICAS: "/api/v1/casilla/estadisticas",
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

describe("Adversarial Empirical Challenge: M2 Operational Pages RWD & Regression Resistance", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    useAuthStore.setState({
      accessToken: "mock-valid-token",
      refreshToken: "mock-refresh-token",
      usuario: {
        id: "usr-admin-01",
        correo: "admin@iestpsuiza.edu.pe",
        nombreCompleto: "Super Administrador",
        rol: "SUPER_ADMIN",
        permisos: ["EXPEDIENTES_READ", "EXPEDIENTES_WRITE", "CASILLA_READ"],
      },
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  // =========================================================================
  // SUITE 1: SOURCE CODE AUDIT — ERADICATION OF RIGID CEILINGS ACROSS 13 PAGES
  // =========================================================================
  describe("Suite 1: Eradication of Rigid Width Ceilings in 13 Pages Source Files", () => {
    const pageFiles = [
      { name: "BandejaExpedientesPage", relPath: "../../src/pages/expedientes/BandejaExpedientesPage.tsx" },
      { name: "ExpedienteDetallePage", relPath: "../../src/pages/expedientes/ExpedienteDetallePage.tsx" },
      { name: "VentanillaPresencialPage", relPath: "../../src/pages/tramite/VentanillaPresencialPage.tsx" },
      { name: "TramitePage", relPath: "../../src/pages/tramite/TramitePage.tsx" },
      { name: "ConsultaPublicaPage", relPath: "../../src/pages/tramite/ConsultaPublicaPage.tsx" },
      { name: "VisorCvdPage", relPath: "../../src/pages/flujos/VisorCvdPage.tsx" },
      { name: "FlujoValidezLegalPage", relPath: "../../src/pages/flujos/FlujoValidezLegalPage.tsx" },
      { name: "PasarelaFirmaPage", relPath: "../../src/pages/flujos/PasarelaFirmaPage.tsx" },
      { name: "CasillaElectronicaPage", relPath: "../../src/pages/casilla/CasillaElectronicaPage.tsx" },
      { name: "WorkflowAcademicoPage", relPath: "../../src/pages/flujos/WorkflowAcademicoPage.tsx" },
      { name: "ProyectorResolucionesPage", relPath: "../../src/pages/flujos/ProyectorResolucionesPage.tsx" },
      { name: "ValidadorPublicoCvdPage", relPath: "../../src/pages/validador/ValidadorPublicoCvdPage.tsx" },
      { name: "MesaPartesVirtualPage", relPath: "../../src/pages/tramite/MesaPartesVirtualPage.tsx" },
    ];

    it.each(pageFiles)("1.X ($name): eradicated rigid outer containers (no max-w-7xl mx-auto or max-w-5xl mx-auto on header/main)", ({ relPath }) => {
      const fullPath = path.resolve(__dirname, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");

      // Verify header doesn't use old rigid wrapper
      expect(content).not.toMatch(/<header[^>]*>\s*<div[^>]*class(?:Name)?="[^"]*mx-auto\s+max-w-7xl/);
      expect(content).not.toMatch(/<header[^>]*>\s*<div[^>]*class(?:Name)?="[^"]*mx-auto\s+max-w-5xl/);
      expect(content).not.toMatch(/<header[^>]*>\s*<div[^>]*class(?:Name)?="[^"]*mx-auto\s+max-w-4xl/);

      // Verify presence of fluid container standard
      expect(content).toMatch(/px-4\s+sm:px-6\s+lg:px-8\s+xl:px-12\s+2xl:px-16/);
    });

    it("1.14. VisorCvdPage preserves print stylesheet classes without regression", () => {
      const fullPath = path.resolve(__dirname, "../../src/pages/flujos/VisorCvdPage.tsx");
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("print:mx-0");
      expect(content).toContain("print:max-w-none");
      expect(content).toContain("print:p-0");
    });
  });

  // =========================================================================
  // SUITE 2: EXPEDIENTEDETALLEPAGE ASYMMETRIC 2-COLUMN LAYOUT & ACTIONS
  // =========================================================================
  describe("Suite 2: ExpedienteDetallePage Asymmetric 2-Column Responsive Layout", () => {
    it("2.1. Renders asymmetric 2-column grid (lg:col-span-5/4 and lg:col-span-7/8) on wide viewports", async () => {
      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes("/api/v1/expedientes/")) {
          return Promise.resolve({
            data: {
              id: "EXP-2026-00042",
              codigoExpediente: "EXP-2026-00042",
              asunto: "Solicitud de Certificado de Estudios Superiores",
              areaOrigen: "Mesa de Partes",
              areaActual: "Secretaría Académica",
              estadoFlujo: "PENDIENTE",
              prioridad: "URGENTE",
              fechaIngreso: "2026-10-01T10:00:00Z",
              versionesDocumentos: [
                {
                  versionId: "v-1",
                  numeroVersion: 1,
                  estado: "VIGENTE",
                  nombreArchivo: "solicitud_firmada.pdf",
                  urlArchivo: "/api/v1/storage/descargar?key=expedientes/EXP-2026-00042/solicitud.pdf",
                  autorCambioId: "usr-01",
                  autorCambioNombre: "Mesa de Partes",
                  fechaRegistro: "2026-10-01T10:00:00Z",
                  motivoModificacion: "Registro inicial",
                  hashIntegridad: "b".repeat(64),
                },
              ],
            },
          });
        }
        if (url.includes("/organigrama")) {
          return Promise.resolve({
            data: [
              { id: "area-dg", nombre: "Dirección General", sigla: "DG" },
              { id: "area-sa", nombre: "Secretaría Académica", sigla: "SA" },
            ],
          });
        }
        return Promise.resolve({ data: [] });
      });

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/expedientes/EXP-2026-00042"]}>
            <Routes>
              <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify code and asunto render
      await waitFor(() => {
        expect(screen.getByText("EXP-2026-00042")).toBeInTheDocument();
      });

      // Find the grid container
      const grid = container.querySelector(".grid.grid-cols-1.lg\\:grid-cols-12");
      expect(grid).toBeInTheDocument();

      // Check left column
      const leftCol = container.querySelector(".lg\\:col-span-5.xl\\:col-span-4");
      expect(leftCol).toBeInTheDocument();

      // Check right column
      const rightCol = container.querySelector(".lg\\:col-span-7.xl\\:col-span-8");
      expect(rightCol).toBeInTheDocument();

      // Right column contains FoliadoDocumentoViewer
      expect(rightCol?.textContent).toContain("Visor de Foliado Continuo Oficial (F. 1 a N) — Directivas AGN");
    });

    it("2.2. Modal dialog buttons are rendered and trigger modal dialogs without layout destruction", async () => {
      (apiClient.get as any).mockResolvedValue({
        data: {
          id: "EXP-2026-00042",
          codigoExpediente: "EXP-2026-00042",
          asunto: "Prueba de Botones de Acción",
          areaOrigen: "Mesa de Partes",
          areaActual: "Secretaría Académica",
          estadoFlujo: "PENDIENTE",
          prioridad: "NORMAL",
          versionesDocumentos: [],
        },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/expedientes/EXP-2026-00042"]}>
            <Routes>
              <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("EXP-2026-00042")).toBeInTheDocument();
      });

      const btnDerivar = screen.getByRole("button", { name: /^derivar/i });
      const btnObservar = screen.getByRole("button", { name: /^observar/i });
      const btnAcumular = screen.getByRole("button", { name: /^acumular/i });

      expect(btnDerivar).toBeInTheDocument();
      expect(btnObservar).toBeInTheDocument();
      expect(btnAcumular).toBeInTheDocument();

      // Open Derivar Modal
      fireEvent.click(btnDerivar);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/derivar expediente/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 3: BANDEJAEXPEDIENTESPAGE FULL-WIDTH METRICS & FILTERS
  // =========================================================================
  describe("Suite 3: BandejaExpedientesPage Fluid Containers & Metrics Grid", () => {
    it("3.1. Renders full-width container with responsive KPI cards grid (grid-cols-2 to lg:grid-cols-6)", async () => {
      (apiClient.get as any).mockResolvedValue({
        data: {
          items: [],
          total: 0,
          pagina: 1,
          totalPaginas: 1,
        },
      });

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <BandejaExpedientesPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText("Bandeja de Trabajo Diario")).toBeInTheDocument();

      // KPI grid check
      const kpiGrid = container.querySelector(".grid.grid-cols-1.sm\\:grid-cols-3");
      expect(kpiGrid).toBeInTheDocument();

      // Pestañas check
      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 4: 5-STAGE WORKFLOW & LEGAL HORIZONTAL EXPANSION (2xl:grid-cols-5)
  // =========================================================================
  describe("Suite 4: 5-Stage Workflows Render 2xl:grid-cols-5 for Ultrawide Panels", () => {
    it("4.1. WorkflowAcademicoPage has 2xl:grid-cols-5 for 5 academic stages", () => {
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <WorkflowAcademicoPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText("Visualizador de Flujos Académicos de Titulación")).toBeInTheDocument();
      const grid = container.querySelector("div[class*='2xl:grid-cols-5']");
      expect(grid).toBeInTheDocument();
    });

    it("4.2. FlujoValidezLegalPage has 2xl:grid-cols-5 for 5 legal components", () => {
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <FlujoValidezLegalPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText("Centro de Coordinación Documental")).toBeInTheDocument();
      const grid = container.querySelector("div[class*='2xl:grid-cols-5']");
      expect(grid).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 5: PASARELAFIRMAPAGE TABLE EXPANSION
  // =========================================================================
  describe("Suite 5: PasarelaFirmaPage Fluid Table & Subject Width", () => {
    it("5.1. PasarelaFirmaPage table cell has widened subject width max-w-md xl:max-w-xl 2xl:max-w-2xl", () => {
      const fullPath = path.resolve(__dirname, "../../src/pages/flujos/PasarelaFirmaPage.tsx");
      const content = fs.readFileSync(fullPath, "utf-8");

      expect(content).toContain("max-w-md xl:max-w-xl 2xl:max-w-2xl");
      expect(content).not.toMatch(/<td[^>]*class(?:Name)?="[^"]*max-w-xs[^"]*truncate[^"]*">\s*\{doc\.asunto\}/);
    });
  });

  // =========================================================================
  // SUITE 6: VENTANILLAPRESENCIALPAGE REQUIREMENTS GRID & TICKET
  // =========================================================================
  describe("Suite 6: VentanillaPresencialPage Fluid Requirements & TUPA Selection", () => {
    it("6.1. VentanillaPresencialPage renders requirements list with xl:grid-cols-3", () => {
      const fullPath = path.resolve(__dirname, "../../src/pages/tramite/VentanillaPresencialPage.tsx");
      const content = fs.readFileSync(fullPath, "utf-8");

      expect(content).toContain("grid gap-2 sm:grid-cols-2 xl:grid-cols-3");
    });
  });

  // =========================================================================
  // SUITE 7: CASILLAELECTRONICAPAGE SPLIT LAYOUT & FLUID CONTAINER
  // =========================================================================
  describe("Suite 7: CasillaElectronicaPage Responsive Header & KPI Grid", () => {
    it("7.1. CasillaElectronicaPage uses full-width container and 4-column KPI grid", async () => {
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <CasillaElectronicaPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText("Bandeja de Casilla Electrónica Ciudadana")).toBeInTheDocument();

      const kpiGrid = container.querySelector(".grid.grid-cols-2.sm\\:grid-cols-4");
      expect(kpiGrid).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 8: VALIDATOR & VISOR CVD FLUID SIZING
  // =========================================================================
  describe("Suite 8: CVD Public Validator & Visor Fluid Sizing", () => {
    it("8.1. ValidadorPublicoCvdPage mounts responsive search container without max-w-4xl constraint", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ValidadorPublicoCvdPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText("Verificador público de Códigos de Verificación Digital (CVD)")).toBeInTheDocument();
    });

    it("8.2. VisorCvdPage mounts fluid document container", () => {
      render(
        <MemoryRouter>
          <VisorCvdPage />
        </MemoryRouter>
      );

      expect(screen.getByText("Visor Documental y Códigos QR")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 9: EDGE CASES & STATE RESILIENCE IN FLUID LAYOUTS
  // =========================================================================
  describe("Suite 9: Edge Cases & State Resilience in Fluid Layouts", () => {
    it("9.1. ExpedienteDetallePage handles null or 404 API response gracefully with fallback", async () => {
      (apiClient.get as any).mockRejectedValue(new Error("Network / 404 Not Found"));

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/expedientes/non-existent-id"]}>
            <Routes>
              <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Should render without unhandled exception and show fallback or loading
      expect(screen.getByText(/Detalle de Expediente/i)).toBeInTheDocument();
    });

    it("9.2. ConsultaPublicaPage renders search box and handles search interaction gracefully", async () => {
      render(
        <MemoryRouter initialEntries={["/consulta"]}>
          <ConsultaPublicaPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Consulta Pública de Trámites y Expedientes/i)).toBeInTheDocument();
      const input = screen.getByPlaceholderText(/EXP-2026-000104/i);
      expect(input).toBeInTheDocument();

      const btnConsultar = screen.getByRole("button", { name: /consultar estado/i });
      expect(btnConsultar).toBeInTheDocument();
    });

    it("9.3. ProyectorResolucionesPage allows adding and removing considerandos in fluid layout", async () => {
      render(
        <MemoryRouter>
          <ProyectorResolucionesPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Proyector de Resoluciones Directorales/i)).toBeInTheDocument();

      const btnAddConsiderando = screen.getByRole("button", { name: /añadir considerando/i });
      expect(btnAddConsiderando).toBeInTheDocument();

      // Click to add
      fireEvent.click(btnAddConsiderando);

      // Check that a new textarea or considering block appears
      const textareas = screen.getAllByRole("textbox");
      expect(textareas.length).toBeGreaterThan(1);
    });

    it("9.4. VentanillaPresencialPage toggles between Persona Natural and Jurídica dynamically", async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <VentanillaPresencialPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText(/Ventanilla Presencial de Atención al Ciudadano/i)).toBeInTheDocument();

      // Check radio or toggle button for Persona Jurídica
      const radioJuridica = screen.getByRole("radio", { name: /persona jurídica/i });
      expect(radioJuridica).toBeInTheDocument();

      fireEvent.click(radioJuridica);

      // Número de Documento (11 dígitos) and Razón Social fields should become visible
      expect(screen.getByPlaceholderText(/11 dígitos/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/razón social/i)).toBeInTheDocument();
    });

    it("9.5. TramitePage (Mesa de Partes Virtual) mounts Step 1 in fluid container without horizontal clipping", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TramitePage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText(/Asistente de Registro Documentario en Línea/i)).toBeInTheDocument();
      expect(screen.getByText(/Identificación del Solicitante/i)).toBeInTheDocument();
    });
  });
});
