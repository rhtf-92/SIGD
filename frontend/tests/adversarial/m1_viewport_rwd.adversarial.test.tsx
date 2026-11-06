import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MainLayout from "../../src/layouts/MainLayout";
import HeaderInstitucional from "../../src/components/HeaderInstitucional";
import HomePage from "../../src/pages/HomePage";
import { useAuthStore } from "../../src/stores/authStore";
import fs from "node:fs";
import path from "node:path";

describe("Adversarial Empirical Stress Testing: Responsive Web Design Full-Width Fluid Containers (Milestone M1)", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    document.body.style.overflow = "";
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.body.style.overflow = "";
  });

  // =========================================================================
  // SUITE 1: ROOT LAYOUT & GLOBAL CSS OVERFLOW CONTAINMENT
  // =========================================================================
  describe("Suite 1: Root Layout & Global CSS Overflow Containment (MainLayout & index.css)", () => {
    it("1.1. index.css contains mandatory @layer base overflow-x containment rules", () => {
      const cssPath = path.resolve(__dirname, "../../src/index.css");
      const cssContent = fs.readFileSync(cssPath, "utf-8");

      expect(cssContent).toContain("@import \"tailwindcss\";");
      expect(cssContent).toContain("@layer base");
      expect(cssContent).toContain("overflow-x: hidden;");
      expect(cssContent).toContain("width: 100%;");
      expect(cssContent).toContain("max-width: 100%;");
      expect(cssContent).toMatch(/html,\s*body,\s*#root/);
    });

    it("1.2. MainLayout root container has w-full and overflow-x-hidden without max-w clamping", () => {
      const { container } = render(
        <MemoryRouter>
          <MainLayout>
            <div data-testid="test-child">Child Content</div>
          </MainLayout>
        </MemoryRouter>
      );

      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toBeInTheDocument();
      expect(rootDiv.className).toContain("w-full");
      expect(rootDiv.className).toContain("overflow-x-hidden");
      expect(rootDiv.className).toContain("min-h-screen");
      expect(rootDiv.className).toContain("flex flex-col");
      expect(rootDiv.className).not.toContain("max-w-");
      expect(rootDiv.className).not.toContain("mx-auto");
    });

    it("1.3. MainLayout footer scales fluidly with w-full and full responsive padding progression", () => {
      render(
        <MemoryRouter>
          <MainLayout>
            <div>Test</div>
          </MainLayout>
        </MemoryRouter>
      );

      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeInTheDocument();
      expect(footer.className).toContain("w-full");
      expect(footer.className).not.toContain("max-w-");

      const footerInner = footer.firstElementChild as HTMLElement;
      expect(footerInner).toBeInTheDocument();
      expect(footerInner.className).toContain("w-full");
      expect(footerInner.className).not.toContain("max-w-7xl");
      expect(footerInner.className).not.toContain("max-w-6xl");
      // Responsive padding progression check
      expect(footerInner.className).toContain("px-4");
      expect(footerInner.className).toContain("sm:px-6");
      expect(footerInner.className).toContain("lg:px-8");
      expect(footerInner.className).toContain("xl:px-12");
      expect(footerInner.className).toContain("2xl:px-16");
    });

    it("1.4. MainLayout main content slot is fluid w-full flex-1", () => {
      render(
        <MemoryRouter>
          <MainLayout>
            <div data-testid="child-content">Content</div>
          </MainLayout>
        </MemoryRouter>
      );

      const main = screen.getByRole("main");
      expect(main).toBeInTheDocument();
      expect(main.className).toContain("w-full");
      expect(main.className).toContain("flex-1");
      expect(main.className).toContain("flex flex-col");
      expect(main.className).not.toContain("max-w-");
    });
  });

  // =========================================================================
  // SUITE 2: HEADER INSTITUCIONAL FLUID CONTAINER & SVG INTEGRITY
  // =========================================================================
  describe("Suite 2: HeaderInstitucional Fluid Container & SVG Integrity", () => {
    it("2.1. Header tag and inner wrapper span 100% width with no max-w-7xl restriction", () => {
      render(
        <MemoryRouter>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const header = screen.getByRole("banner");
      expect(header).toBeInTheDocument();
      expect(header.className).toContain("w-full");
      expect(header.className).not.toContain("max-w-7xl");
      expect(header.className).not.toContain("max-w-6xl");

      const innerWrapper = header.firstElementChild as HTMLElement;
      expect(innerWrapper).toBeInTheDocument();
      expect(innerWrapper.className).toContain("w-full");
      expect(innerWrapper.className).not.toContain("max-w-7xl");
      expect(innerWrapper.className).not.toContain("max-w-6xl");
      expect(innerWrapper.className).toContain("px-4");
      expect(innerWrapper.className).toContain("sm:px-6");
      expect(innerWrapper.className).toContain("lg:px-8");
      expect(innerWrapper.className).toContain("xl:px-12");
      expect(innerWrapper.className).toContain("2xl:px-16");
    });

    it("2.2. All HeaderInstitucional SVGs retain explicit dimension classes preventing stretching", () => {
      render(
        <MemoryRouter>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const header = screen.getByRole("banner");
      const svgs = Array.from(header.querySelectorAll("svg"));
      expect(svgs.length).toBeGreaterThan(0);

      svgs.forEach((svg) => {
        const cls = svg.getAttribute("class") || "";
        const hasExplicitSize =
          cls.includes("h-") && cls.includes("w-");
        expect(
          hasExplicitSize,
          `SVG missing explicit width/height classes: ${svg.outerHTML}`
        ).toBe(true);
      });
    });

    it("2.3. Mobile drawer opens with full responsive backdrop and restores body scroll on close", () => {
      render(
        <MemoryRouter>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const hamburgerBtn = screen.getByRole("button", {
        name: /abrir menú principal/i,
      });
      expect(hamburgerBtn).toBeInTheDocument();
      expect(document.body.style.overflow).toBe("");

      // Open drawer
      fireEvent.click(hamburgerBtn);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(document.body.style.overflow).toBe("hidden");

      // Verify drawer panel width containment for mobile 320px
      const drawerPanel = dialog.querySelector(".max-w-sm");
      expect(drawerPanel).toBeInTheDocument();
      expect(drawerPanel?.className).toContain("w-full");

      // Close drawer with Escape key
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });
  });

  // =========================================================================
  // SUITE 3: HOMEPAGE FLUID CONTAINER & GRID STABILITY
  // =========================================================================
  describe("Suite 3: HomePage Fluid Container & Grid Stability Across Breakpoints", () => {
    it("3.1. HomePage root container uses full-width with progressive padding", () => {
      const { container } = render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );

      const root = container.firstChild as HTMLElement;
      expect(root.className).toContain("w-full");
      expect(root.className).toContain("flex-1");
      expect(root.className).toContain("px-4");
      expect(root.className).toContain("sm:px-6");
      expect(root.className).toContain("lg:px-8");
      expect(root.className).toContain("xl:px-12");
      expect(root.className).toContain("2xl:px-16");
      expect(root.className).not.toContain("max-w-6xl");
      expect(root.className).not.toContain("max-w-7xl");
    });

    it("3.2. Hero banner has proportional width (max-w-5xl) and subtitle (max-w-3xl xl:max-w-4xl)", () => {
      const { container } = render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );

      const hero = container.querySelector("section.max-w-5xl");
      expect(hero).toBeInTheDocument();
      expect(hero?.className).toContain("w-full");
      expect(hero?.className).not.toContain("max-w-3xl mx-auto mb-8 sm:mb-12");

      const subtitle = hero?.querySelector("p");
      expect(subtitle?.className).toContain("max-w-3xl");
      expect(subtitle?.className).toContain("xl:max-w-4xl");
    });

    it("3.3. Public services section spans full-width with responsive 4-column grid and gaps", () => {
      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );

      const publicSection = screen.getByRole("region", {
        name: /servicios públicos a la ciudadanía/i,
      });
      expect(publicSection).toBeInTheDocument();
      expect(publicSection.className).toContain("w-full");
      expect(publicSection.className).not.toContain("max-w-6xl");

      const grid = publicSection.querySelector(".grid");
      expect(grid).toBeInTheDocument();
      expect(grid?.className).toContain("grid-cols-1");
      expect(grid?.className).toContain("sm:grid-cols-2");
      expect(grid?.className).toContain("lg:grid-cols-4");
      expect(grid?.className).toContain("gap-4");
      expect(grid?.className).toContain("sm:gap-5");
      expect(grid?.className).toContain("xl:gap-6");
      expect(grid?.className).toContain("2xl:gap-8");

      // Verify all 4 public cards render with proper icons and links
      const cards = Array.from(grid?.children || []);
      expect(cards.length).toBe(4);
    });

    it("3.4. Authenticated internal services grid expands with 2xl:grid-cols-4 and w-full", () => {
      useAuthStore.setState({
        accessToken: "test-token",
        isAuthenticated: true,
        usuario: {
          id: "usr-1",
          usuario: "director_test",
          nombreCompleto: "Dr. Víctor Raúl Director",
          correo: "director@iestpsuiza.edu.pe",
          rol: "DIRECTOR",
          numeroDocumento: "10203040",
        },
      });

      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );

      // Authenticated welcome panel check
      const welcomePanel = screen.getByRole("region", {
        name: /panel de bienvenida institucional/i,
      });
      expect(welcomePanel).toBeInTheDocument();
      expect(welcomePanel.className).toContain("w-full");
      expect(welcomePanel.className).not.toContain("max-w-6xl");
      expect(welcomePanel.className).toContain("p-6");
      expect(welcomePanel.className).toContain("sm:p-8");
      expect(welcomePanel.className).toContain("xl:p-10");
      expect(welcomePanel.className).toContain("2xl:p-12");

      // Internal services section check
      const internalSection = screen.getByRole("region", {
        name: /servicios internos y de gestión institucional/i,
      });
      expect(internalSection).toBeInTheDocument();
      expect(internalSection.className).toContain("w-full");
      expect(internalSection.className).not.toContain("max-w-6xl");

      const grid = internalSection.querySelector(".grid");
      expect(grid).toBeInTheDocument();
      expect(grid?.className).toContain("grid-cols-1");
      expect(grid?.className).toContain("sm:grid-cols-2");
      expect(grid?.className).toContain("lg:grid-cols-3");
      expect(grid?.className).toContain("2xl:grid-cols-4");
      expect(grid?.className).toContain("gap-4");
      expect(grid?.className).toContain("sm:gap-5");
      expect(grid?.className).toContain("xl:gap-6");
      expect(grid?.className).toContain("2xl:gap-8");
    });

    it("3.5. Unauthenticated personal institucional banner is full-width without max-w-6xl", () => {
      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );

      const staffBanner = screen.getByRole("region", {
        name: /acceso para funcionarios y personal institucional/i,
      });
      expect(staffBanner).toBeInTheDocument();
      expect(staffBanner.className).toContain("w-full");
      expect(staffBanner.className).not.toContain("max-w-6xl");
      expect(staffBanner.className).toContain("p-6");
      expect(staffBanner.className).toContain("sm:p-8");
      expect(staffBanner.className).toContain("xl:p-10");
      expect(staffBanner.className).toContain("2xl:p-12");
    });

    it("3.6. Category tabs container spans full-width without max-w-6xl in authenticated mode", () => {
      useAuthStore.setState({
        accessToken: "test-token",
        isAuthenticated: true,
        usuario: {
          id: "usr-2",
          usuario: "admin_test",
          nombreCompleto: "Admin Sistema",
          correo: "admin@iestpsuiza.edu.pe",
          rol: "SUPER_ADMIN",
          numeroDocumento: "99887766",
        },
      });

      const { container } = render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );

      const tabsContainer = container.querySelector(".border-b.border-slate-200.pb-3");
      expect(tabsContainer).toBeInTheDocument();
      expect(tabsContainer?.className).toContain("w-full");
      expect(tabsContainer?.className).not.toContain("max-w-6xl");
      expect(tabsContainer?.className).toContain("flex flex-col sm:flex-row");
    });
  });

  // =========================================================================
  // SUITE 4: ADVERSARIAL STRESS & VIEWPORT OVERFLOW BOUNDARIES
  // =========================================================================
  describe("Suite 4: Adversarial Stress & Viewport Overflow Boundaries", () => {
    it("4.1. Extreme content stress: 150-char full name does not break header layout or cause unhandled overflow", () => {
      const ultraLongName =
        "Don Maximiliano Francisco Javier de la Santísima Trinidad Valdivieso y Panduro Melgar de Ucayali y Pucallpa del Perú";

      useAuthStore.setState({
        accessToken: "token-stress",
        isAuthenticated: true,
        usuario: {
          id: "usr-stress",
          usuario: "stress_user",
          nombreCompleto: ultraLongName,
          correo: "stress_user_with_a_very_long_institutional_email@iestpsuiza.edu.pe",
          rol: "SUPER_ADMIN",
          numeroDocumento: "12345678",
        },
      });

      render(
        <MemoryRouter>
          <HeaderInstitucional />
          <HomePage />
        </MemoryRouter>
      );

      // Verify header user name element has truncation guard
      const headerName = screen.getByText(ultraLongName);
      expect(headerName).toBeInTheDocument();
      expect(headerName.className).toContain("truncate");
      expect(headerName.className).toContain("max-w-[140px]");

      // Verify welcome panel also renders gracefully
      const welcomeHeading = screen.getByRole("heading", {
        name: new RegExp(ultraLongName, "i"),
      });
      expect(welcomeHeading).toBeInTheDocument();
    });

    it("4.2. Viewport boundary check: Zero max-w-7xl or max-w-6xl in source files for M1 scope", () => {
      const filesToCheck = [
        "../../src/layouts/MainLayout.tsx",
        "../../src/components/HeaderInstitucional.tsx",
        "../../src/pages/HomePage.tsx",
      ];

      filesToCheck.forEach((relPath) => {
        const fullPath = path.resolve(__dirname, relPath);
        const content = fs.readFileSync(fullPath, "utf-8");

        expect(
          content.includes("max-w-7xl"),
          `Found prohibited max-w-7xl in ${relPath}`
        ).toBe(false);
        expect(
          content.includes("max-w-6xl"),
          `Found prohibited max-w-6xl in ${relPath}`
        ).toBe(false);
      });
    });

    it("4.3. Full composite integration: MainLayout + HeaderInstitucional + HomePage render together without class collisions", () => {
      const { container } = render(
        <MemoryRouter>
          <MainLayout>
            <HomePage />
          </MainLayout>
        </MemoryRouter>
      );

      // Verify root structure
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv.className).toContain("min-h-screen");
      expect(rootDiv.className).toContain("w-full");
      expect(rootDiv.className).toContain("overflow-x-hidden");

      // Verify header presence
      const header = screen.getByRole("banner");
      expect(header).toBeInTheDocument();

      // Verify main content
      const main = screen.getByRole("main");
      expect(main).toBeInTheDocument();

      // Verify footer presence
      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeInTheDocument();

      // Ensure no horizontal scrollbar inducing element with hardcoded overflow or width
      const fixedWidthElements = container.querySelectorAll("[class*='w-[']");
      expect(fixedWidthElements.length).toBe(0);
    });
  });
});
