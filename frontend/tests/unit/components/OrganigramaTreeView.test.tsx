import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import OrganigramaTreeView from "../../../src/components/administracion/OrganigramaTreeView";
import type { AreaOrganica } from "../../../src/types/tablasMaestras";

describe("OrganigramaTreeView", () => {
  it("muestra estado vacío informativo cuando la lista de áreas está vacía", () => {
    render(<OrganigramaTreeView areas={[]} />);

    const emptyStatus = screen.getByRole("status");
    expect(emptyStatus).toBeInTheDocument();
    expect(emptyStatus).toHaveTextContent("No hay áreas registradas en el organigrama institucional.");
    expect(screen.getByText("El catálogo de unidades orgánicas de la base de datos se encuentra vacío.")).toBeInTheDocument();
  });

  it("renderiza el árbol jerárquico cuando existen áreas institucionales", async () => {
    const user = userEvent.setup();
    const areasMock: AreaOrganica[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        codigo: "DIR-GEN",
        nombre: "Dirección General",
        ruta: "01",
        detalle: "Órgano de máxima jerarquía",
        estado: "Activo",
        esReal: true,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        codigo: "SEC-ACA",
        nombre: "Secretaría Académica",
        ruta: "01.01",
        detalle: "Órgano de gestión académica",
        estado: "Activo",
        esReal: true,
      },
    ];

    render(<OrganigramaTreeView areas={areasMock} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Dirección General")).toBeInTheDocument();
    expect(screen.getByText("Secretaría Académica")).toBeInTheDocument();
    expect(screen.getByText("DIR-GEN")).toBeInTheDocument();
    expect(screen.getByText("SEC-ACA")).toBeInTheDocument();

    // El botón para contraer / expandir funciona
    const botonContraer = screen.getByRole("button", { name: /Contraer Dirección General/i });
    expect(botonContraer).toBeInTheDocument();
    await user.click(botonContraer);
    expect(screen.queryByText("Secretaría Académica")).not.toBeInTheDocument();
  });
});
