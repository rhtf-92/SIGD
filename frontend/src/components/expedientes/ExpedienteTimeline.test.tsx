import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BitacoraEventoExpediente } from "../../types/trazabilidadExpediente";
import ExpedienteTimeline from "./ExpedienteTimeline";

const eventos: readonly BitacoraEventoExpediente[] = [
  {
    eventoId: "evento-2",
    expedienteId: "expediente-1",
    timestamp: "2026-09-11T10:00:00-05:00",
    areaNombre: "Dirección General",
    usuarioId: "usuario-2",
    usuarioNombre: "María López",
    tipoEvento: "DERIVACION",
    estadoAnterior: "EN_PROCESO",
    estadoNuevo: "DERIVADO",
    descripcionDetallada: "Revisar y emitir informe técnico.",
    hashTransaccion: "sha256-evento-2",
  },
  {
    eventoId: "evento-1",
    expedienteId: "expediente-1",
    timestamp: "2026-09-10T08:30:00-05:00",
    areaNombre: "Mesa de Partes",
    usuarioId: "usuario-1",
    usuarioNombre: "Juan Pérez",
    tipoEvento: "RECEPCION",
    estadoNuevo: "PENDIENTE",
    descripcionDetallada: "Recepcionar expediente.",
    hashTransaccion: "sha256-evento-1",
  },
];

describe("ExpedienteTimeline", () => {
  it("respeta el orden recibido y muestra los datos esenciales y el hash", () => {
    const entrada = [...eventos];
    render(<ExpedienteTimeline eventos={entrada} />);

    const tarjetas = screen.getAllByRole("article");
    expect(tarjetas).toHaveLength(2);
    expect(
      within(tarjetas[0]).getByRole("heading", { name: "Derivación a otra área" }),
    ).toBeInTheDocument();
    expect(
      within(tarjetas[1]).getByRole("heading", { name: "Recepción formal" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mesa de Partes")).toBeInTheDocument();
    expect(screen.getByText("Dirección General")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Revisar y emitir informe técnico.")).toBeInTheDocument();
    expect(screen.getByText("EN_PROCESO → DERIVADO")).toBeInTheDocument();
    expect(screen.getByTitle("sha256-evento-1")).toHaveTextContent("sha256-evento-1…");
    expect(screen.getByTitle("sha256-evento-2")).toHaveTextContent("sha256-evento-2…");
    expect(entrada).toEqual(eventos);
  });

  it("presenta el estado vacío cuando no hay eventos", () => {
    render(<ExpedienteTimeline eventos={[]} />);
    expect(
      screen.getByText("Este expediente todavía no registra movimientos en su bitácora."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("no ofrece controles para editar o borrar eventos", () => {
    render(<ExpedienteTimeline eventos={[...eventos]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/editar|eliminar|borrar/i)).not.toBeInTheDocument();
  });

  it("no altera eventos congelados", () => {
    const evento = Object.freeze({ ...eventos[0] });
    const lista = Object.freeze([evento]);
    const entrada = [...lista];
    expect(() => render(<ExpedienteTimeline eventos={entrada} />)).not.toThrow();
    fireEvent.focus(screen.getByRole("article"));
    expect(entrada).toEqual(lista);
    expect(lista[0]).toBe(evento);
    expect(lista[0].hashTransaccion).toBe("sha256-evento-2");
  });
});
