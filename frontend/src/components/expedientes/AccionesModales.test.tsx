import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { conexo, crearAccionPrueba, diferida, expediente, otroConexo, unidades } from "../../test/expedientesFixtures";
import { ErrorAccionExpediente } from "../../types/expedienteActions";
import type { ResultadoDerivacion, ResultadoObservacion, SolicitudAcumulacion, SolicitudDerivacion, SolicitudObservacion } from "../../types/expedienteActions";
import AcumulacionModal from "./AcumulacionModal";
import DerivacionModal from "./DerivacionModal";
import ObservacionModal from "./ObservacionModal";
import ExpedienteActionToast from "./ExpedienteActionToast";

describe("DerivacionModal", () => {
  it("identifica CUT, enfoca destino, exige destino y proveído y conserva el contenido normalizado", async () => {
    const user = userEvent.setup();
    const ejecutar = vi.fn(async () => true);
    const cerrar = vi.fn();
    render(<DerivacionModal open onClose={cerrar} expediente={expediente} unidades={{ estado: "listo", datos: unidades }} accion={crearAccionPrueba<SolicitudDerivacion, ResultadoDerivacion>({ ejecutar })} />);
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/CUT-PRUEBA-001/);
    const destino = screen.getByRole("combobox");
    expect(destino).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Confirmar derivación" }));
    expect(screen.getByText("Seleccione una unidad de destino válida.")).toBeInTheDocument();
    expect(ejecutar).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: /unidad de origen/ })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Unidad inactiva" })).toBeDisabled();
    await user.selectOptions(destino, "destino-prueba");
    await user.click(screen.getByRole("button", { name: "Confirmar derivación" }));
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByText("El proveído motivado es obligatorio.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "  Revisar   solicitud.\n\nAdjuntar informe.  ");
    await user.click(screen.getByRole("button", { name: "Confirmar derivación" }));
    expect(ejecutar).toHaveBeenCalledWith({ expediente, unidadDestinoId: "destino-prueba", proveido: "Revisar solicitud.\n\nAdjuntar informe." });
    expect(cerrar).toHaveBeenCalledOnce();
  });

  it("bloquea doble envío, edición y Escape mientras procesa", async () => {
    const user = userEvent.setup();
    const pendiente = diferida<boolean>();
    const ejecutar = vi.fn(() => pendiente.promesa);
    const cerrar = vi.fn();
    render(<DerivacionModal open onClose={cerrar} expediente={expediente} unidades={{ estado: "listo", datos: unidades }} accion={crearAccionPrueba<SolicitudDerivacion, ResultadoDerivacion>({ ejecutar })} />);
    await user.selectOptions(screen.getByRole("combobox"), "destino-prueba");
    await user.type(screen.getByRole("textbox"), "Revisar");
    await user.dblClick(screen.getByRole("button", { name: "Confirmar derivación" }));
    expect(ejecutar).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();
    expect(screen.getByRole("textbox")).toBeDisabled();
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(cerrar).not.toHaveBeenCalled();
    await act(async () => { pendiente.resolver(true); });
    expect(cerrar).toHaveBeenCalledOnce();
  });

  it("conserva datos ante error, restablece al cerrar y devuelve el foco", async () => {
    const user = userEvent.setup();
    const restablecer = vi.fn();
    const accion = crearAccionPrueba<SolicitudDerivacion, ResultadoDerivacion>({ ejecutar: async () => { throw new Error("Detalle privado"); }, restablecer });
    function Controlado() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Abrir</button><DerivacionModal open={open} onClose={() => setOpen(false)} expediente={expediente} unidades={{ estado: "listo", datos: unidades }} accion={accion} /></>;
    }
    render(<Controlado />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.selectOptions(screen.getByRole("combobox"), "destino-prueba");
    await user.type(screen.getByRole("textbox"), "Conservar este proveído");
    await user.click(screen.getByRole("button", { name: "Confirmar derivación" }));
    expect(screen.getByRole("alert")).not.toHaveTextContent("Detalle privado");
    expect(screen.getByRole("textbox")).toHaveValue("Conservar este proveído");
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(restablecer).toHaveBeenCalledOnce();
  });

  it("presenta carga, error, catálogo vacío y bloqueo por falta de contrato", () => {
    const props = { open: true, onClose: vi.fn(), expediente, accion: crearAccionPrueba<SolicitudDerivacion, ResultadoDerivacion>({ disponible: false }) };
    const { rerender } = render(<DerivacionModal {...props} unidades={{ estado: "cargando" }} />);
    expect(screen.getByText("Cargando unidades…")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeDisabled();
    rerender(<DerivacionModal {...props} unidades={{ estado: "error", mensaje: "Catálogo no disponible" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Catálogo no disponible");
    rerender(<DerivacionModal {...props} unidades={{ estado: "vacio" }} />);
    expect(screen.getByText("No hay unidades de destino disponibles.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar derivación" })).toBeDisabled();
  });
});

describe("ObservacionModal", () => {
  it("explica suspensión SLA, exige motivo y confirmación y envía solo tras confirmar", async () => {
    const user = userEvent.setup();
    const ejecutar = vi.fn(async () => true);
    const cerrar = vi.fn();
    render(<ObservacionModal open onClose={cerrar} expediente={expediente} accion={crearAccionPrueba<SolicitudObservacion, ResultadoObservacion>({ ejecutar })} />);
    expect(screen.getByText(/La observación suspenderá temporalmente el SLA/)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Confirmar observación" }));
    expect(screen.getByText("El motivo de observación es obligatorio.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "  Adjuntar constancia.  ");
    await user.click(screen.getByRole("button", { name: "Confirmar observación" }));
    expect(screen.getByRole("checkbox")).toHaveFocus();
    expect(ejecutar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Confirmar observación" }));
    expect(ejecutar).toHaveBeenCalledWith({ expediente, motivo: "Adjuntar constancia." });
    expect(cerrar).toHaveBeenCalledOnce();
  });

  it("no cierra ante error RFC, conserva el pliego y bloquea cuando está pendiente", async () => {
    const user = userEvent.setup();
    const cerrar = vi.fn();
    const accion = crearAccionPrueba<SolicitudObservacion, ResultadoObservacion>({ ejecutar: async () => false, error: new ErrorAccionExpediente("El expediente cambió.", "http", 409) });
    const { rerender } = render(<ObservacionModal open onClose={cerrar} expediente={expediente} accion={accion} />);
    await user.type(screen.getByRole("textbox"), "Pliego conservado");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Confirmar observación" }));
    expect(screen.getByRole("alert")).toHaveTextContent("El expediente cambió.");
    expect(screen.getByRole("textbox")).toHaveValue("Pliego conservado");
    expect(cerrar).not.toHaveBeenCalled();
    rerender(<ObservacionModal open onClose={cerrar} expediente={expediente} accion={{ ...accion, pending: true }} />);
    expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(cerrar).not.toHaveBeenCalled();
    rerender(<ObservacionModal open onClose={cerrar} expediente={expediente} accion={{ ...accion, disponible: false }} />);
    expect(screen.getByText(/Observación no disponible/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(cerrar).toHaveBeenCalledOnce();
  });
});

describe("AcumulacionModal", () => {
  it("filtra el propio expediente y duplicados, permite retirar, exige motivo y muestra resumen", async () => {
    const user = userEvent.setup();
    const buscar = vi.fn(async () => [expediente, conexo, conexo, otroConexo]);
    const ejecutar = vi.fn(async () => true);
    const cerrar = vi.fn();
    render(<AcumulacionModal open onClose={cerrar} expediente={expediente} busqueda={{ buscar }} accion={crearAccionPrueba<SolicitudAcumulacion, void>({ ejecutar })} />);
    expect(screen.getByRole("searchbox")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Revisar acumulación" }));
    expect(screen.getByText("Seleccione al menos un expediente conexo.")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "CUT");
    expect(screen.getByText("Buscando expedientes…")).toBeInTheDocument();
    const agregar = await screen.findByRole("button", { name: `Agregar ${conexo.codigo}` });
    expect(screen.queryByRole("button", { name: `Agregar ${expediente.codigo}` })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: `Agregar ${conexo.codigo}` })).toHaveLength(1);
    await user.click(agregar);
    expect(agregar).toBeDisabled();
    await user.click(screen.getByRole("button", { name: `Agregar ${otroConexo.codigo}` }));
    await user.click(screen.getByRole("button", { name: `Retirar ${otroConexo.codigo}` }));
    expect(within(screen.getByRole("list", { name: "Expedientes seleccionados" })).queryByText(otroConexo.codigo)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revisar acumulación" }));
    expect(screen.getByText("La justificación de acumulación es obligatoria.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "  Asunto   conexo. ");
    await user.click(screen.getByRole("button", { name: "Revisar acumulación" }));
    expect(screen.getByRole("heading", { name: "Resumen de acumulación" })).toHaveFocus();
    expect(ejecutar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Volver a editar" }));
    expect(screen.getByRole("textbox")).toHaveValue("  Asunto   conexo. ");
    await user.click(screen.getByRole("button", { name: "Revisar acumulación" }));
    await user.click(screen.getByRole("button", { name: "Confirmar acumulación" }));
    expect(ejecutar).toHaveBeenCalledWith({ principal: expediente, conexos: [conexo], motivo: "Asunto conexo." });
    expect(cerrar).toHaveBeenCalledOnce();
  });

  it("cancela búsquedas antiguas y controla vacíos y errores sin revelar detalles", async () => {
    const user = userEvent.setup();
    const anterior = diferida<readonly typeof conexo[]>();
    const buscar = vi.fn().mockImplementationOnce(() => anterior.promesa).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("DETALLE_INTERNO"));
    render(<AcumulacionModal open onClose={vi.fn()} expediente={expediente} busqueda={{ buscar }} accion={crearAccionPrueba<SolicitudAcumulacion, void>()} />);
    await user.type(screen.getByRole("searchbox"), "ant");
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1));
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "nue");
    await screen.findByText("No hay expedientes conexos disponibles para esta búsqueda.");
    await act(async () => { anterior.resolver([conexo]); });
    expect(screen.queryByRole("button", { name: `Agregar ${conexo.codigo}` })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "err");
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo buscar expedientes");
    expect(screen.getByRole("alert")).not.toHaveTextContent("DETALLE_INTERNO");
  });

  it("muestra integración pendiente y no finge una acumulación", async () => {
    const user = userEvent.setup();
    const ejecutar = vi.fn(async () => true);
    const cerrar = vi.fn();
    const props = { open: true, onClose: cerrar, expediente, accion: crearAccionPrueba<SolicitudAcumulacion, void>({ disponible: false, ejecutar }) };
    const { rerender } = render(<AcumulacionModal {...props} />);
    expect(screen.getByRole("searchbox")).toBeDisabled();
    expect(screen.getByText(/Acumulación no disponible/)).toBeInTheDocument();
    rerender(<AcumulacionModal {...props} busqueda={{ buscar: async () => [conexo] }} />);
    await user.type(screen.getByRole("searchbox"), "CUT");
    await user.click(await screen.findByRole("button", { name: `Agregar ${conexo.codigo}` }));
    await user.type(screen.getByRole("textbox"), "Motivo conexo");
    await user.click(screen.getByRole("button", { name: "Revisar acumulación" }));
    expect(screen.getByRole("button", { name: "Confirmar acumulación" })).toBeDisabled();
    expect(ejecutar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(cerrar).toHaveBeenCalledOnce();
  });
});

describe("notificación accesible", () => {
  it("presenta éxito/error y permite descartarla", async () => {
    const user = userEvent.setup();
    const cerrar = vi.fn();
    const { rerender } = render(<ExpedienteActionToast notificacion={null} onClose={cerrar} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    rerender(<ExpedienteActionToast notificacion={{ tipo: "success", mensaje: "Operación confirmada" }} onClose={cerrar} />);
    expect(screen.getByRole("status")).toHaveTextContent("Operación confirmada");
    await user.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    expect(cerrar).toHaveBeenCalledOnce();
    rerender(<ExpedienteActionToast notificacion={{ tipo: "error", mensaje: "Operación rechazada" }} onClose={cerrar} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Operación rechazada");
  });
});
