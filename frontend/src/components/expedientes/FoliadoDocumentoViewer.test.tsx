import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { documentos } from "../../test/expedientesFixtures";
import FoliadoDocumentoViewer from "./FoliadoDocumentoViewer";

describe("FoliadoDocumentoViewer", () => {
  it("mantiene F. 1 a N al cambiar de documento y es solo lectura", async () => {
    const user = userEvent.setup();
    render(<FoliadoDocumentoViewer recurso={{ estado: "listo", datos: documentos }} />);
    expect(screen.getByText("F. 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Folio anterior" })).toBeDisabled();
    const imagen = screen.getByRole("img");
    expect(imagen).toHaveAccessibleName(/página 1, folio 1/);
    fireEvent.load(imagen);
    expect(screen.queryByText("Cargando página…")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Folio siguiente" }));
    expect(screen.getByText("F. 2")).toBeInTheDocument();
    expect(screen.getByText(/Vista previa de esta página no disponible/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Folio siguiente" }));
    expect(screen.getByText("F. 3")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Informe de prueba · Página 1 · Folio 3 de 3");
    expect(screen.getByRole("link", { name: /Abrir documento original/ })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("button", { name: "Folio siguiente" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Folio anterior" }));
    expect(screen.getByText("F. 2")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("maneja carga, vacío, error y documentos sin folios", () => {
    const { rerender } = render(<FoliadoDocumentoViewer recurso={{ estado: "cargando" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    rerender(<FoliadoDocumentoViewer recurso={{ estado: "vacio" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("no tiene documentos");
    rerender(<FoliadoDocumentoViewer recurso={{ estado: "listo", datos: [] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("no tiene documentos");
    rerender(<FoliadoDocumentoViewer recurso={{ estado: "error", mensaje: "Error de consulta" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Error de consulta");
    rerender(<FoliadoDocumentoViewer recurso={{ estado: "listo", datos: [{ ...documentos[0], folios: [] }] }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No hay folios");
  });

  it("rechaza saltos, páginas desordenadas, documentos duplicados y URL insegura", () => {
    const { rerender } = render(<FoliadoDocumentoViewer recurso={{ estado: "listo", datos: [{ ...documentos[0], folios: [{ numero: 2, pagina: 1 }] }] }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("comenzar en F. 1");
    rerender(<FoliadoDocumentoViewer recurso={{ estado: "listo", datos: [{ ...documentos[0], folios: [{ numero: 1, pagina: 2 }] }] }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("inconsistentes");
    rerender(<FoliadoDocumentoViewer recurso={{ estado: "listo", datos: [documentos[0], { ...documentos[1], id: documentos[0].id }] }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("inconsistentes");
    rerender(<FoliadoDocumentoViewer recurso={{ estado: "listo", datos: [{ ...documentos[0], folios: [{ numero: 1, pagina: 1, urlImagen: "javascript:alert(1)" }] }] }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("no es segura");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    rerender(<FoliadoDocumentoViewer recurso={{ estado: "listo", datos: [{ ...documentos[0], urlOriginal: "https://externo.example/a.pdf" }] }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("presenta un fallo controlado si no carga la imagen", () => {
    render(<FoliadoDocumentoViewer recurso={{ estado: "listo", datos: documentos }} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar la página");
  });
});
