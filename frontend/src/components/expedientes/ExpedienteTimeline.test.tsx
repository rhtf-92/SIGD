import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EventoTrazabilidadExpediente } from "../../types/trazabilidadExpediente";
import ExpedienteTimeline from "./ExpedienteTimeline";

const eventos: readonly EventoTrazabilidadExpediente[] = [
  {
    id: "evento-2",
    fechaHora: "2026-09-11T10:00:00-05:00",
    unidadEmisora: "Secretaría Académica",
    unidadReceptora: "Dirección General",
    servidorResponsable: "María López",
    tipoMovimiento: "DERIVACION",
    proveido: "Revisar y emitir informe técnico.",
    hashIntegridad: "sha256-evento-2",
    documentoAsociado: { id: "doc-2", nombre: "Informe técnico.pdf" },
  },
  {
    id: "evento-1",
    fechaHora: "2026-09-10T08:30:00-05:00",
    unidadEmisora: "Mesa de Partes",
    unidadReceptora: "Secretaría Académica",
    servidorResponsable: "Juan Pérez",
    tipoMovimiento: "RECEPCION",
    proveido: "Recepcionar expediente.",
    hashIntegridad: "sha256-evento-1",
  },
];

describe("ExpedienteTimeline", () => {
  it("ordena cronológicamente y muestra los datos esenciales y el hash", () => {
    const entrada = [...eventos];
    render(<ExpedienteTimeline eventos={entrada} />);

    const tarjetas = screen.getAllByRole("article");
    expect(tarjetas).toHaveLength(2);
    expect(tarjetas[0]).toHaveAccessibleName("RECEPCION");
    expect(tarjetas[1]).toHaveAccessibleName("DERIVACION");
    expect(screen.getByText("Mesa de Partes")).toBeInTheDocument();
    expect(screen.getByText("Dirección General")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Revisar y emitir informe técnico.")).toBeInTheDocument();
    expect(screen.getByText("sha256-evento-1")).toBeInTheDocument();
    expect(screen.getByText("sha256-evento-2")).toBeInTheDocument();
    expect(screen.getByText("Informe técnico.pdf")).toBeInTheDocument();
    expect(entrada).toEqual(eventos);
  });

  it("presenta un estado vacío accesible", () => {
    render(<ExpedienteTimeline eventos={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("No hay movimientos registrados");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("no ofrece controles para editar o borrar eventos", () => {
    render(<ExpedienteTimeline eventos={eventos} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/editar|eliminar|borrar/i)).not.toBeInTheDocument();
  });

  it("no altera eventos congelados", () => {
    const evento = Object.freeze({ ...eventos[0] });
    const lista = Object.freeze([evento]);
    expect(() => render(<ExpedienteTimeline eventos={lista} />)).not.toThrow();
    fireEvent.focus(screen.getByRole("article"));
    expect(lista[0]).toBe(evento);
    expect(lista[0].hashIntegridad).toBe("sha256-evento-2");
  });
});

