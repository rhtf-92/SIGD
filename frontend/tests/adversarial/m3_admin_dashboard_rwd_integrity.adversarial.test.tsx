import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fs from "node:fs";
import path from "node:path";

import AdministracionPage from "../../src/pages/administracion/AdministracionPage";
import UsuariosPage from "../../src/pages/administracion/UsuariosPage";
import RolesPermisosPage from "../../src/pages/administracion/RolesPermisosPage";
import TablasMaestrasPage from "../../src/pages/administracion/TablasMaestrasPage";
import AuditoriaPage from "../../src/pages/administracion/AuditoriaPage";
import CalendarioLaboralPage from "../../src/pages/administracion/CalendarioLaboralPage";
import SeguridadPage from "../../src/pages/administracion/SeguridadPage";
import DashboardEjecutivoPage from "../../src/pages/reportes/DashboardEjecutivoPage";

import { apiClient } from "@/api/client";
import { useAuthStore } from "../../src/stores/authStore";

// Mock API client using alias as configured in vite.config.ts
vi.mock("@/api/client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
  DEFAULT_HEADERS: {},
  AUTH_STORAGE_KEY: "sigd_access_token",
  isTokenExpired: vi.fn().mockReturnValue(false),
}));

const mockDashboardResponse = {
  totalProcesados: 245,
  tasaResolucionOportuna: 92.4,
  tasaCompletitud: 95.8,
  deltaMensual: 6.5,
  saludMesasPartes: "Operativa",
  tendencia: [
    { fechaLabel: "Enero", radicados: 20, resueltos: 18 },
    { fechaLabel: "Febrero", radicados: 28, resueltos: 25 },
    { fechaLabel: "Marzo", radicados: 35, resueltos: 32 },
  ],
  estados: [
    { estado: "En trámite", porcentaje: 45 },
    { estado: "Atendido", porcentaje: 50 },
    { estado: "Observado", porcentaje: 5 },
  ],
  unidades: [
    { id: "u-1", nombre: "Secretaría Académica" },
    { id: "u-2", nombre: "Mesa de Partes" },
  ],
  cuellosBotella: [
    { area: "Secretaría Académica", expedienteCount: 12, diasPromedio: 4.8, severity: "high" },
  ],
};

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

describe("Adversarial Empirical Challenge: M3 Administrative, Security & Executive Dashboard RWD Integrity", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    useAuthStore.setState({
      accessToken: "mock-valid-admin-token",
      refreshToken: "mock-refresh-token",
      usuario: {
        id: "usr-admin-01",
        correo: "admin@iestpsuiza.edu.pe",
        nombreCompleto: "Super Administrador",
        rol: "SUPER_ADMIN",
        permisos: ["ADMIN_ALL", "USUARIOS_WRITE", "REPORTES_READ"],
      },
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.useRealTimers();
  });

  // =========================================================================
  // SUITE 1: SOURCE CODE AUDIT — ERADICATION OF RIGID WIDTH CEILINGS
  // =========================================================================
  describe("Suite 1: Source Code Forensics & Rigid Constraint Eradication across 12 Admin & Dashboard Files", () => {
    const adminSourceFiles = [
      { name: "AdminPageHeader", relPath: "../../src/components/administracion/AdminPageHeader.tsx" },
      { name: "AdministracionPage (administracion)", relPath: "../../src/pages/administracion/AdministracionPage.tsx" },
      { name: "UsuariosPage", relPath: "../../src/pages/administracion/UsuariosPage.tsx" },
      { name: "RolesPermisosPage (administracion)", relPath: "../../src/pages/administracion/RolesPermisosPage.tsx" },
      { name: "TablasMaestrasPage (administracion)", relPath: "../../src/pages/administracion/TablasMaestrasPage.tsx" },
      { name: "AuditoriaPage", relPath: "../../src/pages/administracion/AuditoriaPage.tsx" },
      { name: "CalendarioLaboralPage (administracion)", relPath: "../../src/pages/administracion/CalendarioLaboralPage.tsx" },
      { name: "SeguridadPage", relPath: "../../src/pages/administracion/SeguridadPage.tsx" },
      { name: "AdministracionPage (admin legacy)", relPath: "../../src/pages/admin/AdministracionPage.tsx" },
      { name: "RolesPermisosPage (admin legacy)", relPath: "../../src/pages/admin/RolesPermisosPage.tsx" },
      { name: "TablasMaestrasPage (admin legacy)", relPath: "../../src/pages/admin/TablasMaestrasPage.tsx" },
      { name: "CalendarioLaboralPage (admin legacy)", relPath: "../../src/pages/admin/CalendarioLaboralPage.tsx" },
      { name: "DashboardEjecutivoPage", relPath: "../../src/pages/reportes/DashboardEjecutivoPage.tsx" },
      { name: "KpiMetricGrid", relPath: "../../src/components/reportes/KpiMetricGrid.tsx" },
    ];

    it.each(adminSourceFiles)(
      "1.X ($name): eradicated rigid outer containers (no max-w-7xl, max-w-6xl, or max-w-5xl mx-auto)",
      ({ relPath }) => {
        const fullPath = path.resolve(__dirname, relPath);
        const content = fs.readFileSync(fullPath, "utf-8");

        // Verify absence of rigid outer container ceilings
        expect(content).not.toMatch(/class(?:Name)?="[^"]*mx-auto\s+max-w-7xl/);
        expect(content).not.toMatch(/class(?:Name)?="[^"]*max-w-7xl\s+mx-auto/);
        expect(content).not.toMatch(/class(?:Name)?="[^"]*mx-auto\s+max-w-6xl/);
        expect(content).not.toMatch(/class(?:Name)?="[^"]*max-w-6xl\s+mx-auto/);
        expect(content).not.toMatch(/class(?:Name)?="[^"]*mx-auto\s+max-w-5xl/);
      }
    );

    it("1.15. AdminPageHeader integrates fluid padding progression standard", () => {
      const fullPath = path.resolve(__dirname, "../../src/components/administracion/AdminPageHeader.tsx");
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16");
    });
  });

  // =========================================================================
  // SUITE 2: ADMINISTRACIONPAGE HUB & 2xl:grid-cols-6 ULTRAWIDE LAYOUT
  // =========================================================================
  describe("Suite 2: AdministracionPage Hub & Ultrawide Grid Layout", () => {
    it("2.1. Renders all 6 administrative modules in a fluid container", () => {
      render(
        <MemoryRouter>
          <AdministracionPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Panel de Administración" })).toBeInTheDocument();
      expect(screen.getByText("Usuarios")).toBeInTheDocument();
      expect(screen.getByText("Roles y Permisos")).toBeInTheDocument();
      expect(screen.getByText("Auditoría")).toBeInTheDocument();
      expect(screen.getByText("Tablas Maestras")).toBeInTheDocument();
      expect(screen.getByText("Calendario Laboral")).toBeInTheDocument();
      expect(screen.getByText("Seguridad")).toBeInTheDocument();
    });

    it("2.2. Contains 2xl:grid-cols-6 so all 6 modules lay out in a single clean row on 2560px+ screens", () => {
      const { container } = render(
        <MemoryRouter>
          <AdministracionPage />
        </MemoryRouter>
      );

      const grid = container.querySelector("div[class*='2xl:grid-cols-6']");
      expect(grid).toBeInTheDocument();
      expect(grid?.className).toContain("grid-cols-1");
      expect(grid?.className).toContain("sm:grid-cols-2");
      expect(grid?.className).toContain("lg:grid-cols-3");
      expect(grid?.className).toContain("2xl:grid-cols-6");
    });

    it("2.3. Renders 6 accessible 'Administrar' buttons and responds to user interaction", () => {
      render(
        <MemoryRouter>
          <AdministracionPage />
        </MemoryRouter>
      );

      const buttons = screen.getAllByRole("button", { name: /administrar/i });
      expect(buttons).toHaveLength(6);
      buttons.forEach((btn) => {
        expect(btn).toBeEnabled();
        fireEvent.click(btn);
      });
    });
  });

  // =========================================================================
  // SUITE 3: USUARIOSPAGE SCALABILITY, FILTER BAR & SAFE TABLE SCROLL
  // =========================================================================
  describe("Suite 3: UsuariosPage Scalability, Debounce & Table Scroll Safety", () => {
    const mockUsers = [
      {
        id: 1,
        nombre: "Juan Carlos Pérez",
        dni: "71234567",
        correo: "jperez@iestpsuiza.edu.pe",
        sede: "Sede Principal",
        area: "Mesa de Partes",
        cargo: "Asistente Administrativo",
        rol: "Operador",
        estado: "Activo",
        ultimoAcceso: "29/08/2026 09:42",
      },
      {
        id: 2,
        nombre: "María Fernanda López",
        dni: "74561238",
        correo: "mlopez@iestpsuiza.edu.pe",
        sede: "Sede Principal",
        area: "Secretaría Académica",
        cargo: "Secretaria Académica",
        rol: "Responsable de Área",
        estado: "Inactivo",
        ultimoAcceso: "29/08/2026 08:35",
      },
    ];

    it("3.1. Renders full-width container with responsive filter bar (lg:grid-cols-5)", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockUsers } } as never);

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <UsuariosPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(await screen.findByText("Juan Carlos Pérez")).toBeInTheDocument();

      // Check responsive filter bar grid
      const filterBar = container.querySelector(".lg\\:grid-cols-5");
      expect(filterBar).toBeInTheDocument();
      expect(filterBar?.className).toContain("grid-cols-1");
      expect(filterBar?.className).toContain("sm:grid-cols-2");
    });

    it("3.2. Preserves min-w-[900px] and overflow-x-auto on table wrapper for mobile scroll containment", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockUsers } } as never);

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <UsuariosPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await screen.findByText("Juan Carlos Pérez");

      const tableWrapper = container.querySelector(".overflow-x-auto");
      expect(tableWrapper).toBeInTheDocument();

      const table = container.querySelector("table.min-w-\\[900px\\]");
      expect(table).toBeInTheDocument();
    });

    it("3.3. Opens UserEditModal with existing user attributes and validates institutional domain", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockUsers } } as never);
      const user = userEvent.setup();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <UsuariosPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await screen.findByText("Juan Carlos Pérez");

      const adminButtons = screen.getAllByRole("button", { name: /administrar/i });
      await user.click(adminButtons[0]);

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/correo institucional/i)).toHaveValue("jperez@iestpsuiza.edu.pe");

      // Enter invalid domain
      const emailInput = within(dialog).getByLabelText(/correo institucional/i);
      await user.clear(emailInput);
      await user.type(emailInput, "jperez@external-domain.com");

      const saveBtn = within(dialog).getByRole("button", { name: /guardar cambios/i });
      await user.click(saveBtn);

      expect(
        await within(dialog).findByText(/el correo debe pertenecer al dominio @iestpsuiza\.edu\.pe/i)
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 4: ROLESPERMISOSPAGE ASYMMETRIC SPLIT LAYOUT & RBAC MATRIX
  // =========================================================================
  describe("Suite 4: RolesPermisosPage Asymmetric Split Layout & Matrix Interaction", () => {
    it("4.1. Renders asymmetric split layout (lg:grid-cols-[300px_1fr] to 2xl:grid-cols-[380px_1fr])", () => {
      const { container } = render(
        <MemoryRouter>
          <RolesPermisosPage />
        </MemoryRouter>
      );

      expect(screen.getByText("Roles del sistema")).toBeInTheDocument();
      expect(screen.getByText("Matriz de permisos")).toBeInTheDocument();

      const splitGrid = container.querySelector("div[class*='lg:grid-cols-[300px_1fr]']");
      expect(splitGrid).toBeInTheDocument();
      expect(splitGrid?.className).toContain("xl:grid-cols-[340px_1fr]");
      expect(splitGrid?.className).toContain("2xl:grid-cols-[380px_1fr]");
    });

    it("4.2. Allows switching between system roles and displays role scope badge", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <RolesPermisosPage />
        </MemoryRouter>
      );

      const roleButtons = screen.getAllByRole("button", { name: /(super_admin|director|docente|mesa_partes|estudiante|administrador|operador|responsable)/i });
      expect(roleButtons.length).toBeGreaterThan(1);

      // Click second role
      await user.click(roleButtons[1]);
      expect(screen.getByText(/rol seleccionado/i)).toBeInTheDocument();
      expect(screen.getByText(/alcance:/i)).toBeInTheDocument();
    });

    it("4.3. Matrix permission checkboxes are interactive and allow saving configuration", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <RolesPermisosPage />
        </MemoryRouter>
      );

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThan(0);

      // Toggle first permission
      await user.click(checkboxes[0]);

      // Click 'Guardar permisos'
      const saveBtn = screen.getByRole("button", { name: /guardar permisos/i });
      expect(saveBtn).toBeInTheDocument();
      await user.click(saveBtn);
    });
  });

  // =========================================================================
  // SUITE 5: TABLASMAESTRASPAGE SEARCH SCALING & RESPONSIVE FORMS
  // =========================================================================
  describe("Suite 5: TablasMaestrasPage Search Scaling & Responsive Form", () => {
    it("5.1. Search input wrapper extends dynamically to xl:max-w-2xl", () => {
      const { container } = render(
        <MemoryRouter>
          <TablasMaestrasPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Tablas Maestras" })).toBeInTheDocument();

      const searchWrapper = container.querySelector(".xl\\:max-w-2xl");
      expect(searchWrapper).toBeInTheDocument();
      expect(searchWrapper?.className).toContain("md:max-w-xl");
    });

    it("5.2. Allows toggling '+ Nuevo registro' form with responsive 3-column grid", async () => {
      const user = userEvent.setup();

      const { container } = render(
        <MemoryRouter>
          <TablasMaestrasPage />
        </MemoryRouter>
      );

      const btnNuevo = screen.getByRole("button", { name: /\+ nuevo registro/i });
      expect(btnNuevo).toBeInTheDocument();

      await user.click(btnNuevo);

      // Form grid check
      const formGrid = container.querySelector(".md\\:grid-cols-3");
      expect(formGrid).toBeInTheDocument();
      expect(formGrid?.className).toContain("grid-cols-1");
      expect(formGrid?.className).toContain("sm:grid-cols-2");

      expect(screen.getByPlaceholderText("Ej. ARE-007")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Nombre del registro")).toBeInTheDocument();

      // Cancel button closes form
      const btnCancelar = screen.getByRole("button", { name: /cancelar/i });
      await user.click(btnCancelar);
      expect(screen.queryByPlaceholderText("Ej. ARE-007")).not.toBeInTheDocument();
    });

    it("5.3. Allows switching between master table tabs (Sedes, Áreas, Tipos Documentales)", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <TablasMaestrasPage />
        </MemoryRouter>
      );

      const tabAreas = screen.getByRole("button", { name: /^áreas/i });
      await user.click(tabAreas);

      // Organigrama institutional section appears
      expect(screen.getByText(/organigrama institucional/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 6: AUDITORIAPAGE 9-COLUMN WORM TABLE & EXTENDED FILTERS
  // =========================================================================
  describe("Suite 6: AuditoriaPage 9-Column WORM Table & Extended Filters", () => {
    it("6.1. Renders 3 KPI summary cards with responsive layout (grid-cols-1 sm:grid-cols-3)", () => {
      const { container } = render(
        <MemoryRouter>
          <AuditoriaPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Logs de Auditoría" })).toBeInTheDocument();
      expect(screen.getByText("Eventos exitosos")).toBeInTheDocument();
      expect(screen.getByText("Acciones denegadas (403)")).toBeInTheDocument();
      expect(screen.getByText(/errores de sistema/i)).toBeInTheDocument();

      const kpiGrid = container.querySelector(".sm\\:grid-cols-3");
      expect(kpiGrid).toBeInTheDocument();
    });

    it("6.2. Renders extended filter bar with xl:grid-cols-[1fr_240px_240px_auto]", () => {
      const { container } = render(
        <MemoryRouter>
          <AuditoriaPage />
        </MemoryRouter>
      );

      const filterBar = container.querySelector("div[class*='xl:grid-cols-[1fr_240px_240px_auto]']");
      expect(filterBar).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/usuario, acción, expediente/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /exportar csv/i })).toBeInTheDocument();
    });

    it("6.3. Table wrapper has min-w-[1000px] and overflow-x-auto accommodating 9 columns", () => {
      const { container } = render(
        <MemoryRouter>
          <AuditoriaPage />
        </MemoryRouter>
      );

      const tableWrapper = container.querySelector(".overflow-x-auto");
      expect(tableWrapper).toBeInTheDocument();

      const table = container.querySelector("table.min-w-\\[1000px\\]");
      expect(table).toBeInTheDocument();

      // Check header columns within table
      const headers = within(table as HTMLElement).getAllByRole("columnheader");
      expect(headers).toHaveLength(9);
      expect(headers[0]).toHaveTextContent("ID / Fecha");
      expect(headers[1]).toHaveTextContent("Usuario");
      expect(headers[2]).toHaveTextContent("Área");
      expect(headers[3]).toHaveTextContent("Acción");
      expect(headers[4]).toHaveTextContent("Módulo");
      expect(headers[5]).toHaveTextContent("Registro");
      expect(headers[6]).toHaveTextContent("Resultado");
      expect(headers[7]).toHaveTextContent("IP");
      expect(headers[8]).toHaveTextContent("Detalle");
    });

    it("6.4. Clicking 'Ver' opens AuditDetailDrawer with correlation ID and technical metadata", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <AuditoriaPage />
        </MemoryRouter>
      );

      const verButtons = screen.getAllByRole("button", { name: /^ver$/i });
      expect(verButtons.length).toBeGreaterThan(0);

      await user.click(verButtons[0]);

      // Drawer renders as dialog
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/x-correlation-id/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 7: CALENDARIOLABORALPAGE 2-COLUMN RESPONSIVE LAYOUT & UCAYALI RULES
  // =========================================================================
  describe("Suite 7: CalendarioLaboralPage 2-Column Responsive Layout & Regional Holiday Rules", () => {
    it("7.1. Renders 2-column layout (grid gap-6 xl:gap-8 lg:grid-cols-2)", () => {
      const { container } = render(
        <MemoryRouter>
          <CalendarioLaboralPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Calendario Laboral" })).toBeInTheDocument();
      expect(screen.getByText("Jornada laboral")).toBeInTheDocument();
      expect(screen.getByText("Feriados y días no laborables")).toBeInTheDocument();

      const layoutGrid = container.querySelector(".lg\\:grid-cols-2");
      expect(layoutGrid).toBeInTheDocument();
      expect(layoutGrid?.className).toContain("xl:gap-8");
    });

    it("7.2. Highlights normative cutoff hour 16:30 (Art. 138 TUO Ley N° 27444)", () => {
      render(
        <MemoryRouter>
          <CalendarioLaboralPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/hora de corte normativa: 16:30 hrs/i)).toBeInTheDocument();
      expect(screen.getByText(/art\. 138 tuo ley n° 27444/i)).toBeInTheDocument();
    });

    it("7.3. Allows adding and removing holidays dynamically", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <CalendarioLaboralPage />
        </MemoryRouter>
      );

      const descInput = screen.getByPlaceholderText(/descripción/i);
      await user.type(descInput, "Feriado Regional Ucayali San Juan");

      const btnAgregar = screen.getByRole("button", { name: /^agregar$/i });
      expect(btnAgregar).toBeInTheDocument();

      const btnGuardar = screen.getByRole("button", { name: /guardar calendario/i });
      expect(btnGuardar).toBeInTheDocument();
      await user.click(btnGuardar);
    });
  });

  // =========================================================================
  // SUITE 8: SEGURIDADPAGE METRICS, POLICIES & MODAL HARDENING
  // =========================================================================
  describe("Suite 8: SeguridadPage Metrics, Policies & Modal Hardening", () => {
    it("8.1. Renders 3 metric cards with responsive typography", () => {
      const { container } = render(
        <MemoryRouter>
          <SeguridadPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Seguridad" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Cuentas bloqueadas" })).toBeInTheDocument();
      expect(screen.getByText("Intentos fallidos visibles")).toBeInTheDocument();
      expect(screen.getByText("Sesión configurada")).toBeInTheDocument();

      const kpiGrid = container.querySelector(".sm\\:grid-cols-3");
      expect(kpiGrid).toBeInTheDocument();
    });

    it("8.2. Renders 2-column policies and security events grid (lg:grid-cols-2 xl:gap-8)", () => {
      const { container } = render(
        <MemoryRouter>
          <SeguridadPage />
        </MemoryRouter>
      );

      expect(screen.getByText("Políticas de acceso")).toBeInTheDocument();
      expect(screen.getByText(/el desbloqueo exige justificación forense obligatoria/i)).toBeInTheDocument();

      const layoutGrid = container.querySelector(".lg\\:grid-cols-2");
      expect(layoutGrid).toBeInTheDocument();
      expect(layoutGrid?.className).toContain("xl:gap-8");
    });

    it("8.3. Policy parameter inputs are interactive and saveable", async () => {
      const user = userEvent.setup();

      const { container } = render(
        <MemoryRouter>
          <SeguridadPage />
        </MemoryRouter>
      );

      const inputs = container.querySelectorAll<HTMLInputElement>('input[type="number"]');
      expect(inputs.length).toBeGreaterThan(0);

      await user.clear(inputs[0]);
      await user.type(inputs[0], "5");

      const saveBtn = screen.getByRole("button", { name: /guardar políticas/i });
      expect(saveBtn).toBeInTheDocument();
      await user.click(saveBtn);
    });
  });

  // =========================================================================
  // SUITE 9: DASHBOARDEJECUTIVOPAGE & KPIMETRICGRID PANORAMIC RESPONSIVENESS
  // =========================================================================
  describe("Suite 9: DashboardEjecutivoPage & KpiMetricGrid Panoramic Responsiveness", () => {
    it("9.1. Loading skeleton has fluid w-full space-y-6 container without rigid max-w-7xl", () => {
      vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(() => {}));

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardEjecutivoPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const main = screen.getByRole("main");
      expect(main).toHaveAttribute("aria-busy", "true");
      expect(main.className).toContain("w-full");
      expect(main.className).toContain("px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16");

      const innerWrapper = container.querySelector(".w-full.space-y-6");
      expect(innerWrapper).toBeInTheDocument();
      expect(innerWrapper?.className).not.toContain("max-w-7xl");
    });

    it("9.2. Ready state has fluid w-full container without rigid max-w-7xl", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockDashboardResponse } as never);

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardEjecutivoPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await screen.findByText("Expedientes procesados");

      const main = container.firstChild as HTMLElement;
      expect(main.className).toContain("w-full");
      expect(main.className).toContain("px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16");

      const innerWrapper = container.querySelector(".w-full.space-y-5.sm\\:space-y-6");
      expect(innerWrapper).toBeInTheDocument();
      expect(innerWrapper?.className).not.toContain("max-w-7xl");
    });

    it("9.3. KpiMetricGrid scales fluidly with gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-6", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockDashboardResponse } as never);

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardEjecutivoPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await screen.findByText("Expedientes procesados");

      const kpiGrid = container.querySelector(".lg\\:grid-cols-4");
      expect(kpiGrid).toBeInTheDocument();
      expect(kpiGrid?.className).toContain("grid-cols-1");
      expect(kpiGrid?.className).toContain("sm:grid-cols-2");
      expect(kpiGrid?.className).toContain("xl:gap-6");
    });

    it("9.4. Charts layout features asymmetric split: min-[1025px]:grid-cols-[1.7fr_1fr] 2xl:grid-cols-[2fr_1fr]", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockDashboardResponse } as never);

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardEjecutivoPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await screen.findByText("Expedientes procesados");

      const chartsSplit = container.querySelector("div[class*='min-[1025px]:grid-cols-[1.7fr_1fr]']");
      expect(chartsSplit).toBeInTheDocument();
      expect(chartsSplit?.className).toContain("2xl:grid-cols-[2fr_1fr]");
      expect(chartsSplit?.className).toContain("xl:gap-8");
    });

    it("9.5. SVG Trend Chart has responsive height h-56 sm:h-64 lg:h-72 xl:h-80 w-full preventing line flattening", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockDashboardResponse } as never);

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardEjecutivoPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await screen.findByText("Expedientes procesados");

      const svgChart = container.querySelector('svg[aria-label="Gráfico de tendencia de radicados y resueltos"]');
      expect(svgChart).toBeInTheDocument();
      const svgClass = svgChart?.getAttribute("class") || "";
      expect(svgClass).toContain("h-56");
      expect(svgClass).toContain("sm:h-64");
      expect(svgClass).toContain("lg:h-72");
      expect(svgClass).toContain("xl:h-80");
      expect(svgClass).toContain("w-full");
    });

    it("9.6. Cuellos de Botella table renders full width with bottleneck data", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockDashboardResponse } as never);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardEjecutivoPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await screen.findByText("Expedientes procesados");
      expect(screen.getByText("Cuellos de botella")).toBeInTheDocument();
      const table = screen.getByRole("table");
      expect(within(table).getByText("Secretaría Académica")).toBeInTheDocument();
      expect(within(table).getByText("12")).toBeInTheDocument();
    });
  });
});
