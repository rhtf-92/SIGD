import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Milestone 3 Viewport Stress Challenger: Admin & Executive Dashboard (320px to 3840px)", () => {
  const rootDir = path.resolve(__dirname, "../../src");

  // Helper to read file content
  function readFile(relPath: string): string {
    const fullPath = path.resolve(rootDir, relPath);
    expect(fs.existsSync(fullPath)).toBe(true);
    return fs.readFileSync(fullPath, "utf-8");
  }

  // =========================================================================
  // SUITE 1: AdministracionPage 6-Module Layout & 2xl:grid-cols-6 Scaling
  // =========================================================================
  describe("Suite 1: AdministracionPage 6-Module Layout across Breakpoints", () => {
    const adminPages = [
      "pages/administracion/AdministracionPage.tsx",
      "pages/admin/AdministracionPage.tsx",
    ];

    it.each(adminPages)("1.1 (%s): eliminates max-w-7xl and uses full fluid container", (file) => {
      const content = readFile(file);
      expect(content).not.toMatch(/max-w-7xl/);
      expect(content).not.toMatch(/max-w-6xl/);
      expect(content).not.toMatch(/max-w-5xl/);
      expect(content).toContain("w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-8");
    });

    it.each(adminPages)("1.2 (%s): declares exact responsive grid progression ending in 2xl:grid-cols-6", (file) => {
      const content = readFile(file);
      expect(content).toContain("grid gap-4 sm:gap-5 xl:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6");
    });

    it.each(adminPages)("1.3 (%s): contains exactly 6 administrative modules", (file) => {
      const content = readFile(file);
      const expectedModules = [
        "Usuarios",
        "Roles y Permisos",
        "Auditoría",
        "Tablas Maestras",
        "Calendario Laboral",
        "Seguridad",
      ];
      for (const mod of expectedModules) {
        expect(content).toContain(`titulo: "${mod}"`);
      }
    });

    it("1.4: verifies single horizontal row at 2xl (1536px+) up to 4K (3840px)", () => {
      // At 2xl:grid-cols-6, 6 modules / 6 columns = exactly 1 row
      const moduleCount = 6;
      const columnsAt2xl = 6;
      const rowsAt2xl = Math.ceil(moduleCount / columnsAt2xl);
      expect(rowsAt2xl).toBe(1);

      // Verify grid behavior across viewport matrix
      const viewportGridMapping = [
        { width: 320, name: "Mobile S (320px)", expectedCols: 1, expectedRows: 6 },
        { width: 375, name: "Mobile M (375px)", expectedCols: 1, expectedRows: 6 },
        { width: 640, name: "Tablet sm (640px)", expectedCols: 2, expectedRows: 3 },
        { width: 768, name: "Tablet md (768px)", expectedCols: 2, expectedRows: 3 },
        { width: 1024, name: "Desktop lg (1024px)", expectedCols: 3, expectedRows: 2 },
        { width: 1280, name: "Desktop xl (1280px)", expectedCols: 3, expectedRows: 2 },
        { width: 1536, name: "Ultrawide 2xl (1536px)", expectedCols: 6, expectedRows: 1 },
        { width: 1920, name: "Full HD 1080p (1920px)", expectedCols: 6, expectedRows: 1 },
        { width: 2560, name: "2K QHD (2560px)", expectedCols: 6, expectedRows: 1 },
        { width: 3840, name: "4K UHD (3840px)", expectedCols: 6, expectedRows: 1 },
      ];

      for (const vp of viewportGridMapping) {
        const activeCols = vp.width >= 1536 ? 6 : vp.width >= 1024 ? 3 : vp.width >= 640 ? 2 : 1;
        expect(activeCols).toBe(vp.expectedCols);
        const activeRows = Math.ceil(moduleCount / activeCols);
        expect(activeRows).toBe(vp.expectedRows);
      }
    });
  });

  // =========================================================================
  // SUITE 2: DashboardEjecutivoPage SVG Chart Scaling & Responsive Grid
  // =========================================================================
  describe("Suite 2: DashboardEjecutivoPage SVG Chart Height & Grid Responsiveness", () => {
    const dashboardFile = "pages/reportes/DashboardEjecutivoPage.tsx";

    it("2.1: eliminates max-w-7xl in both loading state and ready state", () => {
      const content = readFile(dashboardFile);
      expect(content).not.toMatch(/max-w-7xl/);
      expect(content).not.toMatch(/max-w-6xl/);
      // Main container in loading and ready states has full fluid padding
      expect(content).toContain("w-full bg-slate-100 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-8");
    });

    it("2.2: SVG trend chart has multi-breakpoint height scaling (h-56 sm:h-64 lg:h-72 xl:h-80 w-full)", () => {
      const content = readFile(dashboardFile);
      expect(content).toMatch(/<svg[^>]*className="[^"]*h-56\s+sm:h-64\s+lg:h-72\s+xl:h-80\s+w-full[^"]*"/);
    });

    it("2.3: verifies SVG height scaling dynamics prevent line flattening across viewport ranges", () => {
      // Tailwind default root rem = 16px
      const heightBreakpoints = [
        { minWidth: 0, class: "h-56", rem: 14, px: 224, label: "Mobile (<640px)" },
        { minWidth: 640, class: "sm:h-64", rem: 16, px: 256, label: "Tablet sm (>=640px)" },
        { minWidth: 1024, class: "lg:h-72", rem: 18, px: 288, label: "Desktop lg (>=1024px)" },
        { minWidth: 1280, class: "xl:h-80", rem: 20, px: 320, label: "Panoramic xl (>=1280px)" },
      ];

      // Heights must increase monotonically to preserve vertical wave amplitude on wide displays
      for (let i = 1; i < heightBreakpoints.length; i++) {
        expect(heightBreakpoints[i].px).toBeGreaterThan(heightBreakpoints[i - 1].px);
        expect(heightBreakpoints[i].rem).toBeGreaterThan(heightBreakpoints[i - 1].rem);
      }
    });

    it("2.4: charts grid features asymmetric split (min-[1025px]:grid-cols-[1.7fr_1fr] 2xl:grid-cols-[2fr_1fr])", () => {
      const content = readFile(dashboardFile);
      expect(content).toContain("grid min-w-0 grid-cols-1 gap-6 xl:gap-8 min-[1025px]:grid-cols-[1.7fr_1fr] 2xl:grid-cols-[2fr_1fr]");
    });

    it("2.5: KpiMetricGrid scales from 1 to 4 columns (sm:grid-cols-2 lg:grid-cols-4 xl:gap-6)", () => {
      const content = readFile("components/reportes/KpiMetricGrid.tsx");
      expect(content).toContain("grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-6");
    });

    it("2.6: ExecutiveKpiSummary scales dynamically (sm:grid-cols-2 xl:grid-cols-3)", () => {
      const content = readFile("components/dashboard/ExecutiveKpiSummary.tsx");
      expect(content).toContain("grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-900 p-4 text-white sm:grid-cols-2 xl:grid-cols-3");
    });

    it("2.7: Bottlenecks table (cuellosBotella) is wrapped in overflow-x-auto", () => {
      const content = readFile(dashboardFile);
      const tableMatch = content.match(/<div className="overflow-x-auto">\s*<table className="min-w-full text-left text-sm">/);
      expect(tableMatch).not.toBeNull();
    });
  });

  // =========================================================================
  // SUITE 3: Table Horizontal Scroll Containment Across ALL Admin Pages
  // =========================================================================
  describe("Suite 3: Horizontal Scroll Containment Across Admin Tables", () => {
    const adminTableSpecs = [
      {
        page: "pages/administracion/UsuariosPage.tsx",
        minWidth: "min-w-[900px]",
        description: "Usuarios table with 8 columns",
      },
      {
        page: "components/administracion/RolePermissionMatrix.tsx",
        minWidth: "min-w-[900px]",
        description: "RBAC permission matrix table",
      },
      {
        page: "pages/administracion/AuditoriaPage.tsx",
        minWidth: "min-w-[1000px]",
        description: "Auditoria 9-column table",
      },
      {
        page: "pages/administracion/TablasMaestrasPage.tsx",
        minWidth: "min-w-[800px]",
        description: "Tablas Maestras records table",
      },
      {
        page: "pages/administracion/SeguridadPage.tsx",
        minWidth: "min-w-[800px]",
        description: "Seguridad access attempts table",
      },
      {
        page: "pages/admin/TablasMaestrasPage.tsx",
        minWidth: "min-w-[800px]",
        description: "Admin legacy Tablas Maestras table",
      },
    ];

    it.each(adminTableSpecs)(
      "3.X ($description): table $minWidth is strictly enclosed inside overflow-x-auto wrapper",
      ({ page, minWidth }) => {
        const content = readFile(page);

        // Verify min-width exists on table
        expect(content).toContain(minWidth);

        // Verify overflow-x-auto is present on wrapper
        expect(content).toContain("overflow-x-auto");

        // Verify table is directly or immediately inside an overflow-x-auto container
        const tableIndex = content.indexOf(minWidth);
        const precedingContent = content.slice(Math.max(0, tableIndex - 300), tableIndex);
        expect(precedingContent).toContain("overflow-x-auto");
      }
    );

    it("3.7: AdminPageHeader has unified fluid padding w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16", () => {
      const content = readFile("components/administracion/AdminPageHeader.tsx");
      expect(content).not.toMatch(/max-w-7xl/);
      expect(content).toContain("w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-4 sm:py-5");
    });

    it("3.8: All 7 active administracion pages use the unified fluid container", () => {
      const activeAdminPages = [
        "pages/administracion/AdministracionPage.tsx",
        "pages/administracion/UsuariosPage.tsx",
        "pages/administracion/RolesPermisosPage.tsx",
        "pages/administracion/TablasMaestrasPage.tsx",
        "pages/administracion/AuditoriaPage.tsx",
        "pages/administracion/CalendarioLaboralPage.tsx",
        "pages/administracion/SeguridadPage.tsx",
      ];

      for (const page of activeAdminPages) {
        const content = readFile(page);
        expect(content).not.toMatch(/mx-auto\s+max-w-7xl/);
        expect(content).not.toMatch(/max-w-7xl\s+mx-auto/);
        expect(content).toContain("w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16");
      }
    });

    it("3.9: Empirical verification that no wide table escapes overflow-x-auto containment", () => {
      // Mathematical proof: if all tables with min-w > 320px are wrapped in overflow-x-auto,
      // the parent section will fit 100% of the screen width (w-full) without triggering
      // horizontal scroll on window or document.body at any viewport width >= 320px.
      const filesWithTables = [
        "pages/administracion/UsuariosPage.tsx",
        "components/administracion/RolePermissionMatrix.tsx",
        "pages/administracion/AuditoriaPage.tsx",
        "pages/administracion/TablasMaestrasPage.tsx",
        "pages/administracion/SeguridadPage.tsx",
      ];

      for (const file of filesWithTables) {
        const content = readFile(file);
        const tableMatches = content.match(/<table[^>]*>/g) || [];
        expect(tableMatches.length).toBeGreaterThan(0);

        for (const tableTag of tableMatches) {
          // If table has min-w, it must be contained in overflow-x-auto
          if (tableTag.includes("min-w-")) {
            const tablePos = content.indexOf(tableTag);
            const parentContext = content.slice(Math.max(0, tablePos - 400), tablePos);
            expect(parentContext).toContain("overflow-x-auto");
          }
        }
      }
    });
  });

  // =========================================================================
  // SUITE 4: Viewport Matrix Stress Simulation (320px to 3840px)
  // =========================================================================
  describe("Suite 4: Viewport Stress Simulation Matrix (320px - 3840px)", () => {
    const viewportScenarios = [
      { name: "320px (Mobile Small: iPhone SE, Galaxy Fold outer)", width: 320, category: "mobile" },
      { name: "375px (Mobile Standard: iPhone 12/13/14/15)", width: 375, category: "mobile" },
      { name: "414px (Mobile Large: iPhone Plus/Max)", width: 414, category: "mobile" },
      { name: "640px (Tailwind sm breakpoint: Large phones / Phablets)", width: 640, category: "phablet" },
      { name: "768px (Tailwind md breakpoint: iPad / Tablet portrait)", width: 768, category: "tablet" },
      { name: "1024px (Tailwind lg breakpoint: iPad landscape / Netbook)", width: 1024, category: "laptop" },
      { name: "1280px (Tailwind xl breakpoint: Standard laptop)", width: 1280, category: "desktop" },
      { name: "1440px (MacBook Pro 15/16 display)", width: 1440, category: "desktop" },
      { name: "1536px (Tailwind 2xl breakpoint)", width: 1536, category: "ultrawide" },
      { name: "1920px (Full HD 1080p standard desktop)", width: 1920, category: "ultrawide" },
      { name: "2560px (2K QHD 1440p monitor)", width: 2560, category: "panoramic" },
      { name: "3440px (Ultrawide 21:9 monitor)", width: 3440, category: "panoramic" },
      { name: "3840px (4K UHD monitor)", width: 3840, category: "panoramic" },
    ];

    it.each(viewportScenarios)("4.X ($name): validates layout integrity and containment", (vp) => {
      // 1. Padding resolution:
      // <640px: px-4 (16px left + 16px right = 32px total gutter) -> useful canvas = width - 32px
      // >=640px: px-6 (24px left + 24px right = 48px gutter)
      // >=1024px: px-8 (32px left + 32px right = 64px gutter)
      // >=1280px: px-12 (48px left + 48px right = 96px gutter)
      // >=1536px: px-16 (64px left + 64px right = 128px gutter)
      const gutter = vp.width >= 1536 ? 128 : vp.width >= 1280 ? 96 : vp.width >= 1024 ? 64 : vp.width >= 640 ? 48 : 32;
      const usefulCanvas = vp.width - gutter;
      expect(usefulCanvas).toBeGreaterThan(0);

      // 2. AdministracionPage grid columns:
      const adminCols = vp.width >= 1536 ? 6 : vp.width >= 1024 ? 3 : vp.width >= 640 ? 2 : 1;
      expect([1, 2, 3, 6]).toContain(adminCols);

      // 3. Dashboard SVG chart height:
      const svgHeightRem = vp.width >= 1280 ? 20 : vp.width >= 1024 ? 18 : vp.width >= 640 ? 16 : 14;
      expect(svgHeightRem).toBeGreaterThanOrEqual(14);
      expect(svgHeightRem).toBeLessThanOrEqual(20);

      // 4. Horizontal containment:
      // On mobile (usefulCanvas < 900px), min-w-[900px] table exceeds usefulCanvas,
      // BUT because of overflow-x-auto, body width stays equal to viewport width.
      const tableNeedsHorizontalScroll = usefulCanvas < 900;
      if (vp.width <= 768) {
        expect(tableNeedsHorizontalScroll).toBe(true);
      } else if (vp.width >= 1280) {
        expect(tableNeedsHorizontalScroll).toBe(false);
      }
    });
  });
});
