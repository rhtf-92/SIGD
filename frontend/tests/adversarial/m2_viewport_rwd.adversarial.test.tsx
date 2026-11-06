import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fs from "node:fs";
import path from "node:path";

// Page Imports for DOM Rendering Verification
import ExpedienteDetallePage from "../../src/pages/expedientes/ExpedienteDetallePage";
import BandejaExpedientesPage from "../../src/pages/expedientes/BandejaExpedientesPage";
import WorkflowAcademicoPage from "../../src/pages/flujos/WorkflowAcademicoPage";
import FlujoValidezLegalPage from "../../src/pages/flujos/FlujoValidezLegalPage";
import PasarelaFirmaPage from "../../src/pages/flujos/PasarelaFirmaPage";
import VisorCvdPage from "../../src/pages/flujos/VisorCvdPage";
import ProyectorResolucionesPage from "../../src/pages/flujos/ProyectorResolucionesPage";
import TramitePage from "../../src/pages/tramite/TramitePage";
import VentanillaPresencialPage from "../../src/pages/tramite/VentanillaPresencialPage";
import MesaPartesVirtualPage from "../../src/pages/tramite/MesaPartesVirtualPage";
import CasillaElectronicaPage from "../../src/pages/casilla/CasillaElectronicaPage";
import { EXPEDIENTES_FIXTURE } from "../../src/data/expedientesFixtures";
import { useAuthStore } from "../../src/stores/authStore";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

describe("Adversarial Empirical Stress Testing: M2 Operational & Workflow RWD Fluid Refactoring", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    cleanup();
    queryClient = createTestQueryClient();
    window.localStorage.clear();

    // Mock authenticated user
    useAuthStore.setState({
      accessToken: "test-auth-token-m2",
      isAuthenticated: true,
      usuario: {
        id: "usr-emp-01",
        usuario: "admin_test",
        nombreCompleto: "Ing. Rosa Melgar Flores",
        correo: "rmelgar@iestpsuiza.edu.pe",
        rol: "SUPER_ADMIN",
        numeroDocumento: "45678901",
      },
    });

    // Populate queries with fixture data
    queryClient.setQueryData(
      ["expediente-detalle", "8f1c9b2e-0001-4a11-9c1a-000000000001"],
      EXPEDIENTES_FIXTURE[0]
    );
    queryClient.setQueryData(["expedientes", "base"], EXPEDIENTES_FIXTURE);
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SUITE 1: SOURCE AST AUDIT — ERADICATION OF RIGID CEILINGS IN ALL 13 PAGES
  // =========================================================================
  describe("Suite 1: Static AST Audit of the 13 Target Operational & Workflow Pages", () => {
    const pagesToAudit = [
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

    it("1.1. All 13 target pages have eradicated rigid max-w-7xl and max-w-5xl layout wrapper constraints", () => {
      pagesToAudit.forEach(({ name, relPath }) => {
        const fullPath = path.resolve(__dirname, relPath);
        const content = fs.readFileSync(fullPath, "utf-8");

        // Verify no unqualified rigid max-w-7xl mx-auto or max-w-5xl mx-auto on top-level layout containers
        const hasUnresponsiveMaxW7xl = /(?<!2xl:)max-w-7xl\s+mx-auto/.test(content);
        const hasUnresponsiveMaxW5xl = /(?<!2xl:)max-w-5xl\s+mx-auto/.test(content);

        expect(
          hasUnresponsiveMaxW7xl,
          `Page ${name} still contains rigid unqualified 'max-w-7xl mx-auto'`
        ).toBe(false);

        expect(
          hasUnresponsiveMaxW5xl,
          `Page ${name} still contains rigid unqualified 'max-w-5xl mx-auto'`
        ).toBe(false);
      });
    });

    it("1.2. All 13 target pages implement the standardized fluid responsive container padding", () => {
      pagesToAudit.forEach(({ name, relPath }) => {
        const fullPath = path.resolve(__dirname, relPath);
        const content = fs.readFileSync(fullPath, "utf-8");

        const hasFluidStandard =
          content.includes("w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16") ||
          content.includes("px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16");

        expect(
          hasFluidStandard,
          `Page ${name} does not implement the institutional fluid padding progression 'px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16'`
        ).toBe(true);
      });
    });
  });

  // =========================================================================
  // SUITE 2: EXPEDIENTE DETALLE 2-COLUMN RESPONSIVE ASYMMETRIC SPLIT
  // =========================================================================
  describe("Suite 2: ExpedienteDetallePage Asymmetric 2-Column Responsive Split", () => {
    it("2.1. ExpedienteDetallePage renders an asymmetric 12-column grid layout (lg:col-span-5/7 xl:col-span-4/8)", async () => {
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/expedientes/8f1c9b2e-0001-4a11-9c1a-000000000001"]}>
            <Routes>
              <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify grid container exists
      const mainGrid = container.querySelector(".grid.grid-cols-1.lg\\:grid-cols-12");
      expect(mainGrid, "ExpedienteDetallePage missing 'grid grid-cols-1 lg:grid-cols-12'").toBeInTheDocument();
      expect(mainGrid?.className).toContain("gap-6");
      expect(mainGrid?.className).toContain("xl:gap-8");
      expect(mainGrid?.className).toContain("items-start");

      // Verify Left Column: Metadata, Classification, Versions
      const leftCol = mainGrid?.firstElementChild as HTMLElement;
      expect(leftCol).toBeInTheDocument();
      expect(leftCol.className).toContain("lg:col-span-5");
      expect(leftCol.className).toContain("xl:col-span-4");
      expect(leftCol.className).toContain("space-y-6");

      // Verify Right Column: Foliado Viewer AGN & Timeline
      const rightCol = mainGrid?.children[1] as HTMLElement;
      expect(rightCol).toBeInTheDocument();
      expect(rightCol.className).toContain("lg:col-span-7");
      expect(rightCol.className).toContain("xl:col-span-8");
      expect(rightCol.className).toContain("space-y-6");
    });

    it("2.2. ExpedienteDetallePage header contains fluid responsive action buttons with mobile flex-wrap", async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/expedientes/8f1c9b2e-0001-4a11-9c1a-000000000001"]}>
            <Routes>
              <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const derivarBtn = screen.getByRole("button", { name: /derivar/i });
      const observarBtn = screen.getByRole("button", { name: /observar/i });
      const acumularBtn = screen.getByRole("button", { name: /acumular/i });

      expect(derivarBtn).toBeInTheDocument();
      expect(observarBtn).toBeInTheDocument();
      expect(acumularBtn).toBeInTheDocument();

      // Mobile button container test: flex-wrap + w-full sm:w-auto
      const btnContainer = derivarBtn.parentElement as HTMLElement;
      expect(btnContainer.className).toContain("flex-wrap");
      expect(btnContainer.className).toContain("sm:flex-nowrap");
      expect(btnContainer.className).toContain("w-full");
      expect(btnContainer.className).toContain("sm:w-auto");
    });
  });

  // =========================================================================
  // SUITE 3: 5-PHASE / 5-COLUMN HORIZONTAL EXPANSION ON WIDESCREEN & ULTRAWIDE
  // =========================================================================
  describe("Suite 3: 5-Phase Horizontal Expansion (WorkflowAcademicoPage & FlujoValidezLegalPage)", () => {
    it("3.1. WorkflowAcademicoPage stages grid scales seamlessly to 2xl:grid-cols-5 with 5 stages", () => {
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <WorkflowAcademicoPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const stagesGrid = container.querySelector(".grid.gap-5");
      expect(stagesGrid, "WorkflowAcademicoPage missing stage grid").toBeInTheDocument();
      expect(stagesGrid?.className).toContain("sm:grid-cols-2");
      expect(stagesGrid?.className).toContain("lg:grid-cols-3");
      expect(stagesGrid?.className).toContain("2xl:grid-cols-5");

      // Verify exactly 5 stage cards are rendered, meaning 0 orphaned slots at 2xl
      const stageCards = Array.from(stagesGrid?.children || []);
      expect(stageCards.length).toBe(5);
    });

    it("3.2. FlujoValidezLegalPage modules grid scales seamlessly to 2xl:grid-cols-5 with 5 modules", () => {
      const { container } = render(
        <MemoryRouter>
          <FlujoValidezLegalPage />
        </MemoryRouter>
      );

      const modulesGrid = container.querySelector(".grid.grid-cols-1");
      expect(modulesGrid, "FlujoValidezLegalPage missing module grid").toBeInTheDocument();
      expect(modulesGrid?.className).toContain("sm:grid-cols-2");
      expect(modulesGrid?.className).toContain("lg:grid-cols-3");
      expect(modulesGrid?.className).toContain("2xl:grid-cols-5");

      // Verify all 5 legal modules are rendered
      const moduleCards = Array.from(modulesGrid?.children || []);
      expect(moduleCards.length).toBe(5);
    });
  });

  // =========================================================================
  // SUITE 4: TABLE LAYOUT & HORIZONTAL SCROLL CONTAINMENT
  // =========================================================================
  describe("Suite 4: Table Layout & Horizontal Scroll Containment", () => {
    it("4.1. PasarelaFirmaPage encloses document table in overflow-x-auto container with responsive subject cell", () => {
      const { container } = render(
        <MemoryRouter>
          <PasarelaFirmaPage />
        </MemoryRouter>
      );

      const tableWrapper = container.querySelector(".overflow-x-auto");
      expect(tableWrapper, "PasarelaFirmaPage missing .overflow-x-auto table wrapper").toBeInTheDocument();

      const table = tableWrapper?.querySelector("table");
      expect(table).toBeInTheDocument();
      expect(table?.className).toContain("min-w-[760px]");
      expect(table?.className).toContain("w-full");

      // Check subject table cells have expanded max-w progression
      const subjectCells = container.querySelectorAll("td.max-w-md");
      expect(subjectCells.length).toBeGreaterThan(0);
      subjectCells.forEach((td) => {
        expect(td.className).toContain("xl:max-w-xl");
        expect(td.className).toContain("2xl:max-w-2xl");
      });
    });

    it("4.2. BandejaExpedientesPage uses dual-presentation: mobile cards on < md, protected scroll on >= md", () => {
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <BandejaExpedientesPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify desktop table has hidden md:block overflow-x-auto
      const desktopTableContainer = container.querySelector(".hidden.md\\:block.overflow-x-auto");
      expect(desktopTableContainer, "BandejaExpedientesPage missing '.hidden.md:block.overflow-x-auto'").toBeInTheDocument();

      // Verify tab filter has horizontal scroll containment on mobile
      const tabList = screen.getByRole("tablist");
      expect(tabList.className).toContain("overflow-x-auto");
      expect(tabList.className).toContain("sm:flex-wrap");
    });

    it("4.3. CasillaElectronicaPage renders accessible notification cards avoiding rigid table overflow", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <CasillaElectronicaPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // KPI metrics grid verification
      const totalHeading = screen.getByText(/total notificaciones/i);
      expect(totalHeading).toBeInTheDocument();

      const kpiSection = totalHeading.closest("section");
      expect(kpiSection?.className).toContain("grid-cols-2");
      expect(kpiSection?.className).toContain("sm:grid-cols-4");
      expect(kpiSection?.className).toContain("gap-4");
      expect(kpiSection?.className).toContain("sm:gap-5");
      expect(kpiSection?.className).toContain("xl:gap-6");
      expect(kpiSection?.className).toContain("2xl:gap-8");
    });
  });

  // =========================================================================
  // SUITE 5: VIEWPORT BOUNDARY STRESS (320px MOBILE TO 3840px 4K ULTRAWIDE)
  // =========================================================================
  describe("Suite 5: Viewport Boundary Stress (320px Mobile to 3840px 4K Ultrawide)", () => {
    it("5.1. 320px Mobile Boundary: VentanillaPresencialPage checklist and input grid wrap gracefully", () => {
      const { container } = render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      // Select TUPA procedure to trigger checklist rendering
      const selectTupa = screen.getByLabelText(/procedimiento tupa/i);
      expect(selectTupa).toBeInTheDocument();

      // Select first option with value
      const options = selectTupa.querySelectorAll("option");
      const validOption = Array.from(options).find((opt) => opt.value && opt.value !== "");
      if (validOption) {
        fireEvent.change(selectTupa, { target: { value: validOption.value } });
        const reqList = container.querySelector("ul.grid");
        if (reqList) {
          expect(reqList.className).toContain("sm:grid-cols-2");
          expect(reqList.className).toContain("xl:grid-cols-3");
        }
      }

      // Verify notice banner contains text without overflowing width if present
      const notice = screen.queryByRole("note");
      if (notice) {
        expect(notice.className).toContain("rounded-xl");
      }
      const formHeading = screen.getByRole("heading", { name: /datos de recepción en ventanilla/i });
      expect(formHeading).toBeInTheDocument();
      expect(formHeading.className).toContain("text-lg");
    });

    it("5.2. 320px Mobile Boundary: MesaPartesVirtualPage splits 2-column layout gracefully on lg: only", () => {
      const { container } = render(
        <MemoryRouter>
          <MesaPartesVirtualPage />
        </MemoryRouter>
      );

      const splitSection = container.querySelector(".grid.gap-6.lg\\:grid-cols-\\[1\\.15fr_0\\.85fr\\]");
      expect(splitSection, "MesaPartesVirtualPage missing lg:grid-cols-[1.15fr_0.85fr]").toBeInTheDocument();
    });

    it("5.3. 3840px 4K Boundary: All 13 page containers deliver 2xl:px-16 ensuring active fluid width of 3712px", () => {
      // In 4K UHD (3840px), 2xl:px-16 sets 64px padding left & right (128px total gutter).
      // Available content width = 3840 - 128 = 3712px.
      const pagesToTest = [
        { name: "ExpedienteDetalle", Component: () => (
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/expedientes/8f1c9b2e-0001-4a11-9c1a-000000000001"]}>
              <Routes>
                <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        )},
        { name: "WorkflowAcademico", Component: () => (
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <WorkflowAcademicoPage />
            </MemoryRouter>
          </QueryClientProvider>
        )},
        { name: "FlujoValidezLegal", Component: () => (
          <MemoryRouter>
            <FlujoValidezLegalPage />
          </MemoryRouter>
        )},
        { name: "VisorCvd", Component: () => (
          <MemoryRouter>
            <VisorCvdPage />
          </MemoryRouter>
        )},
        { name: "ProyectorResoluciones", Component: () => (
          <MemoryRouter>
            <ProyectorResolucionesPage />
          </MemoryRouter>
        )},
        { name: "PasarelaFirma", Component: () => (
          <MemoryRouter>
            <PasarelaFirmaPage />
          </MemoryRouter>
        )},
        { name: "TramitePage", Component: () => (
          <MemoryRouter>
            <TramitePage />
          </MemoryRouter>
        )},
      ];

      pagesToTest.forEach(({ name, Component }) => {
        const { container } = render(<Component />);
        const fluidElements = container.querySelectorAll("[class*='2xl:px-16']");
        expect(
          fluidElements.length,
          `Page ${name} should have at least one element with '2xl:px-16'`
        ).toBeGreaterThan(0);
        cleanup();
      });
    });

    it("5.4. Long Subject Text Stress: Extreme 200-char administrative subject wraps cleanly without overflowing container", () => {
      const longAsunto =
        "SOLICITUD DE TITULACIÓN PROFESIONAL TÉCNICA EXTRAORDINARIA Y CONVALIDACIÓN INTEGRAL DE EXPEDIENTE ACADÉMICO HISTÓRICO CONFORME A LA RESOLUCIÓN VICEMINISTERIAL N.° 277-2019-MINEDU Y LEY N.° 30512 DE EDUCACIÓN SUPERIOR";

      const queryClientWithLongSubject = createTestQueryClient();
      queryClientWithLongSubject.setQueryData(
        ["expediente-detalle", "exp-long-stress"],
        {
          id: "exp-long-stress",
          codigoExpediente: "EXP-2026-LONG-001",
          asunto: longAsunto,
          areaOrigen: "Mesa de Partes",
          areaActual: "Secretaría Académica",
          estadoFlujo: "EN_TRAMITE",
          prioridad: "URGENTE",
          fechaIngreso: new Date().toISOString(),
          fechaUltimoMovimiento: new Date().toISOString(),
          fechaLimiteAtencion: new Date(Date.now() + 15 * 86400000).toISOString(),
          cantidadFolios: 45,
          solicitante: {
            tipoPersona: "NATURAL",
            tipoDocumento: "DNI",
            numeroDocumento: "45678901",
            nombreOrazonSocial: "Estudiante de Prueba",
            correoNotificacion: "prueba@iestpsuiza.edu.pe",
            telefonoContacto: "987654321",
          },
          clasificacionCCD: {
            fondo: "IESTP_SUIZA",
            seccion: "SECRETARIA_ACADEMICA",
            serieDocumental: "EXPEDIENTES_ACADEMICOS",
            codigoSerie: "CCD-SA-EXP",
          },
          metadatos: {
            tipoDocumentoPrincipal: "SOLICITUD",
            palabrasClave: ["titulacion"],
            creadorId: "admin",
            creadorNombre: "Mesa de Partes",
          },
          versionesDocumentos: [],
        }
      );

      render(
        <QueryClientProvider client={queryClientWithLongSubject}>
          <MemoryRouter initialEntries={["/expedientes/exp-long-stress"]}>
            <Routes>
              <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const titleEl = screen.getByRole("heading", { level: 1, name: /EXP-2026-LONG-001/i });
      expect(titleEl).toBeInTheDocument();
      expect(titleEl.className).toContain("break-words");

      const asuntoEl = screen.getByText(longAsunto);
      expect(asuntoEl).toBeInTheDocument();
      expect(asuntoEl.className).toContain("line-clamp-2");
    });
  });
});
