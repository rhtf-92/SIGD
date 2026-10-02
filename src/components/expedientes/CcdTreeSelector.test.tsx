import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RutaCcdSeleccionada } from "../../types/ccdArchivistica";
import { fondos } from "../../test/expedientesFixtures";
import CcdTreeSelector from "./CcdTreeSelector";

describe("CcdTreeSelector", () => {
  it("expande y contrae fondo/sección; selecciona exclusivamente una serie y emite la ruta", async () => {
    const user = userEvent.setup();
    const seleccionar = vi.fn();
    function Controlado() {
      const [seleccion, setSeleccion] = useState<RutaCcdSeleccionada | null>(null);
      return <CcdTreeSelector recurso={{ estado: "listo", datos: fondos }} seleccion={seleccion} onSeleccionar={(ruta) => { seleccionar(ruta); setSeleccion(ruta); }} />;
    }
    render(<Controlado />);
    expect(screen.getByRole("tree")).toHaveAccessibleName("Cuadro de Clasificación Documental");
    const fondo = screen.getByRole("treeitem", { name: "IESTP_SUIZA" });
    expect(fondo).toHaveAttribute("aria-expanded", "false");
    await user.click(fondo);
    const seccion = screen.getByRole("treeitem", { name: "Secretaría Académica" });
    await user.click(seccion);
    expect(seleccionar).not.toHaveBeenCalled();
    expect(fondo).not.toHaveAttribute("aria-selected");
    expect(seccion).not.toHaveAttribute("aria-selected");
    const serie = screen.getByRole("treeitem", { name: "Expedientes de Titulación" });
    await user.click(serie);
    expect(seleccionar).toHaveBeenLastCalledWith({ fondo: fondos[0], seccion: fondos[0].secciones[0], serie: fondos[0].secciones[0].series[0] });
    expect(serie).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("status")).toHaveTextContent("IESTP_SUIZA / Secretaría Académica / Expedientes de Titulación");
    await user.click(screen.getByRole("treeitem", { name: "Actas de Evaluación" }));
    expect(serie).toHaveAttribute("aria-selected", "false");
    expect(screen.getAllByRole("treeitem").filter((item) => item.getAttribute("aria-selected") === "true")).toHaveLength(1);
    await user.click(screen.getByRole("treeitem", { name: "Serie inactiva" }));
    expect(seleccionar).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Limpiar selección" }));
    expect(seleccionar).toHaveBeenLastCalledWith(null);
    await user.click(seccion);
    expect(screen.queryByRole("treeitem", { name: "Actas de Evaluación" })).not.toBeInTheDocument();
    await user.click(fondo);
    expect(screen.queryByRole("treeitem", { name: "Secretaría Académica" })).not.toBeInTheDocument();
  });

  it("recorre con flechas, Home/End, texto y Enter sin seleccionar ramas", async () => {
    const user = userEvent.setup();
    const seleccionar = vi.fn();
    render(<CcdTreeSelector recurso={{ estado: "listo", datos: fondos }} seleccion={null} onSeleccionar={seleccionar} />);
    await user.tab();
    expect(screen.getByRole("treeitem", { name: "IESTP_SUIZA" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}{Enter}{ArrowDown}");
    expect(screen.getByRole("treeitem", { name: "Expedientes de Titulación" })).toHaveFocus();
    await user.keyboard(" ");
    expect(seleccionar).toHaveBeenCalledOnce();
    await user.keyboard("{ArrowRight}{ArrowDown}{ArrowUp}{End}");
    expect(screen.getByRole("treeitem", { name: "Serie inactiva" })).toHaveFocus();
    await user.keyboard("{Home}a");
    expect(screen.getByRole("treeitem", { name: "Actas de Evaluación" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("treeitem", { name: "IESTP_SUIZA" })).toHaveFocus();
    expect(seleccionar).toHaveBeenCalledOnce();
  });

  it("recibe selección controlada, respeta disabled y puede ocultar limpiar", () => {
    const seleccion = { fondo: fondos[0], seccion: fondos[0].secciones[0], serie: fondos[0].secciones[0].series[0] };
    const seleccionar = vi.fn();
    const { rerender } = render(<CcdTreeSelector recurso={{ estado: "listo", datos: fondos }} seleccion={seleccion} onSeleccionar={seleccionar} disabled />);
    fireEvent.click(screen.getByRole("treeitem", { name: seleccion.serie.nombre }));
    fireEvent.keyDown(screen.getByRole("treeitem", { name: seleccion.serie.nombre }), { key: "Enter" });
    expect(seleccionar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Limpiar selección" })).toBeDisabled();
    rerender(<CcdTreeSelector recurso={{ estado: "listo", datos: fondos }} seleccion={seleccion} onSeleccionar={seleccionar} permitirLimpiar={false} />);
    expect(screen.queryByRole("button", { name: "Limpiar selección" })).not.toBeInTheDocument();
  });

  it("presenta carga, vacío y error", () => {
    const { rerender } = render(<CcdTreeSelector recurso={{ estado: "cargando" }} seleccion={null} onSeleccionar={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    rerender(<CcdTreeSelector recurso={{ estado: "vacio" }} seleccion={null} onSeleccionar={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("No hay clasificación");
    rerender(<CcdTreeSelector recurso={{ estado: "listo", datos: [] }} seleccion={null} onSeleccionar={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("No hay clasificación");
    rerender(<CcdTreeSelector recurso={{ estado: "error", mensaje: "No se pudo cargar el catálogo." }} seleccion={null} onSeleccionar={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar");
  });
});
