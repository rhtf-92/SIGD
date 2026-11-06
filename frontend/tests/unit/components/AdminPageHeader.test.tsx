import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import AdminPageHeader from "@/components/administracion/AdminPageHeader";

describe("AdminPageHeader — Navegación Funcional Intermodular (ENT-M05)", () => {
  it("en el Panel Principal muestra botón 'Volver al inicio' y migajas canónicas", () => {
    render(
      <MemoryRouter initialEntries={["/administracion"]}>
        <AdminPageHeader
          title="Panel de Administración"
          description="Administración, Seguridad y Auditoría"
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: /Volver al inicio/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Panel de Administración" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", {
        name: /Navegación entre páginas administrativas/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("en una subpágina administrativa ofrece retorno al Panel de Administración y retorno a Inicio", () => {
    render(
      <MemoryRouter initialEntries={["/administracion/usuarios"]}>
        <AdminPageHeader
          title="Gestión de Usuarios"
          description="Administración de cuentas institucionales"
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: /Volver al Panel de Administración/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Volver al inicio/i }),
    ).toBeInTheDocument();
  });

  it("en una subpágina despliega los 7 botones de navegación rápida entre módulos", () => {
    render(
      <MemoryRouter initialEntries={["/administracion/usuarios"]}>
        <AdminPageHeader
          title="Gestión de Usuarios"
          description="Administración de cuentas institucionales"
        />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", {
      name: /Navegación entre páginas administrativas/i,
    });
    expect(nav).toBeInTheDocument();

    const enlaces = [
      "Panel Principal",
      "Usuarios",
      "Roles y Permisos",
      "Tablas Maestras",
      "Calendario Laboral",
      "Seguridad",
      "Auditoría",
    ];

    enlaces.forEach((titulo) => {
      expect(screen.getByRole("link", { name: new RegExp(titulo, "i") })).toBeInTheDocument();
    });

    const linkUsuarios = screen.getByRole("link", { name: /Usuarios/i });
    expect(linkUsuarios).toHaveAttribute("aria-current", "page");
  });

  it("permite hacer clic en los enlaces de navegación intermodular", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/administracion/usuarios"]}>
        <AdminPageHeader
          title="Gestión de Usuarios"
          description="Administración de cuentas institucionales"
        />
      </MemoryRouter>,
    );

    const linkRoles = screen.getByRole("link", { name: /Roles y Permisos/i });
    await user.click(linkRoles);
    expect(linkRoles).toHaveAttribute("href", "/administracion/roles-permisos");
  });
});
