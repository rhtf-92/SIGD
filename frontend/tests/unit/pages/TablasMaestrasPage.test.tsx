import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import TablasMaestrasPage from "../../../src/pages/administracion/TablasMaestrasPage";
import { useAuthStore } from "../../../src/stores/authStore";

const get = vi.fn();

vi.mock("../../../src/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => get(...args),
  },
}));

function renderConRouter() {
  return render(
    <MemoryRouter>
      <TablasMaestrasPage />
    </MemoryRouter>,
  );
}

const CATALOGOS_MOCK = {
  catalogos: [
    {
      clave: "sedes",
      esquema: "sigd_org",
      tabla: "sede",
      descripcion: "Sedes institucionales",
      disponible: true,
      total: 1,
      items: [
        {
          codigo: "SED-001",
          nombre: "Sede Principal Pucallpa",
          descripcion: "Campus central",
          extra: { activo: true },
        },
      ],
    },
    {
      clave: "unidades_organicas",
      esquema: "sigd_org",
      tabla: "area",
      descripcion: "Áreas institucionales",
      disponible: true,
      total: 1,
      items: [
        {
          codigo: "ARE-001",
          nombre: "Dirección General",
          descripcion: "Nivel superior",
          extra: { vigente: true },
        },
      ],
    },
    {
      clave: "tipos_documento_tramite",
      esquema: "sigd_doc",
      tabla: "tipo_documento",
      descripcion: "Tipos documentales",
      disponible: false,
      total: 1,
      items: [
        {
          codigo: "SOL",
          nombre: "Solicitud del Administrado",
          descripcion: "Documento inicial",
          extra: { activo: true },
        },
      ],
    },
  ],
};

describe("F-05: TablasMaestrasPage — Read-Only Official Catalog Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ usuario: null, isAuthenticated: false, accessToken: null });
    get.mockImplementation((url: string) => {
      if (url === "/api/v1/admin/tablas-maestras") {
        return Promise.resolve({ data: CATALOGOS_MOCK });
      }
      if (url === "/api/v1/admin/organigrama") {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });
  });

  afterEach(() => {
    useAuthStore.setState({ usuario: null, isAuthenticated: false, accessToken: null });
  });

  it("renderiza el catálogo oficial en modo solo lectura desde la API", async () => {
    renderConRouter();

    expect(screen.getByText("Catálogo Oficial (Solo Lectura)")).toBeInTheDocument();
    expect(await screen.findByText("Sede Principal Pucallpa")).toBeInTheDocument();
    expect(screen.getByText("SED-001")).toBeInTheDocument();
    expect(screen.getByText("Solo lectura")).toBeInTheDocument();
  });

  it("no muestra formulario ni botón de nuevo registro ficticio", async () => {
    renderConRouter();

    await screen.findByText("Sede Principal Pucallpa");
    expect(screen.queryByText("+ Nuevo registro")).not.toBeInTheDocument();
    expect(screen.queryByText("Guardar registro")).not.toBeInTheDocument();
  });

  it("refleja el estado disponible: false con la etiqueta Pendiente DDL al cambiar de tipo", async () => {
    const user = userEvent.setup();
    renderConRouter();

    await screen.findByText("Sede Principal Pucallpa");

    const botonTiposDoc = screen.getByRole("button", { name: "Tipos documentales" });
    await user.click(botonTiposDoc);

    expect(await screen.findByText("Solicitud del Administrado")).toBeInTheDocument();
    expect(screen.getByText("Pendiente DDL")).toBeInTheDocument();
  });

  it("H-06: muestra estado de error y NUNCA fixtures cuando la API falla", async () => {
    get.mockImplementation((url: string) => {
      if (url === "/api/v1/admin/tablas-maestras") {
        return Promise.reject(new Error("Network Error"));
      }
      return Promise.resolve({ data: [] });
    });

    renderConRouter();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Error al consultar el catálogo institucional.")).toBeInTheDocument();
    // Jamás debe mostrar fixtures sintéticos de fallback
    expect(screen.queryByText("Campus central de Pucallpa (Av. Centenario Km 3.5).")).not.toBeInTheDocument();
    expect(screen.queryByText("SED-001")).not.toBeInTheDocument();
  });

  it("H-06: muestra estado vacío explícito cuando la API devuelve catálogos vacíos", async () => {
    get.mockImplementation((url: string) => {
      if (url === "/api/v1/admin/tablas-maestras") {
        return Promise.resolve({ data: { catalogos: [] } });
      }
      return Promise.resolve({ data: [] });
    });

    renderConRouter();

    expect(await screen.findByText("No se encontraron registros coincidentes.")).toBeInTheDocument();
    expect(screen.queryByText("Sede Principal Pucallpa")).not.toBeInTheDocument();
  });

  it("muestra la tarjeta y acceso visible a Gestión TUPA para rol ADMINISTRADOR", async () => {
    useAuthStore.setState({
      usuario: {
        id: "admin-uuid",
        nombreCompleto: "Administrador General",
        correo: "admin@suiza.edu.pe",
        rol: "ADMINISTRADOR",
      },
    });

    renderConRouter();
    await screen.findByText("Sede Principal Pucallpa");

    // Tarjeta claramente visible: "Gestión TUPA"
    const cardTitulo = screen.getByRole("heading", { name: "Gestión TUPA" });
    expect(cardTitulo).toBeInTheDocument();

    // Descripción canónica
    expect(
      screen.getByText("Versiones, procedimientos, publicación e histórico del TUPA.")
    ).toBeInTheDocument();

    // Botón / Enlace con acción hacia /administracion/tupa
    const btnAcceso = screen.getByRole("link", { name: /Acceder a Gestión TUPA/i });
    expect(btnAcceso).toHaveAttribute("href", "/administracion/tupa");

    // Botón de barra de herramientas superior
    const botonesTupa = screen.getAllByRole("link", { name: /Gestión TUPA/i });
    expect(botonesTupa.length).toBeGreaterThanOrEqual(1);
    botonesTupa.forEach((link) => expect(link).toHaveAttribute("href", "/administracion/tupa"));
  });

  it("oculta la tarjeta y accesos a Gestión TUPA para roles sin permiso explícito", async () => {
    useAuthStore.setState({
      usuario: {
        id: "ciudadano-uuid",
        nombreCompleto: "Ciudadano Demo",
        correo: "ciudadano@suiza.edu.pe",
        rol: "CIUDADANO",
      },
    });

    renderConRouter();
    await screen.findByText("Sede Principal Pucallpa");

    expect(screen.queryByRole("heading", { name: "Gestión TUPA" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Versiones, procedimientos, publicación e histórico del TUPA.")
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Acceder a Gestión TUPA/i })).not.toBeInTheDocument();
  });
});
