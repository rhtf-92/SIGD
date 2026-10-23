import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TablasMaestrasPage from "../../../src/pages/administracion/TablasMaestrasPage";

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
});
