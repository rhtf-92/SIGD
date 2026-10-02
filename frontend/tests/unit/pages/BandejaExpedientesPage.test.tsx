import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import BandejaTabs from "../../../src/components/expedientes/BandejaTabs";
import { type EstadoFlujoExpediente } from "../../../src/types/expediente";

const conteosMock: Record<EstadoFlujoExpediente, number> = {
  PENDIENTE: 3,
  EN_PROCESO: 2,
  OBSERVADO: 1,
  DERIVADO: 4,
  NOTIFICADO: 0,
  ARCHIVADO: 5,
};

describe("T-FE-EXP-05: Suite de pruebas unitarias de Bandeja de Expedientes", () => {
  const onCambiarEstadoMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Debe renderizar las 6 pestañas operativas obligatorias", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);
  });

  it("2. Debe contener el contenedor accesible role=tablist con aria-label descriptivo", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tablist = screen.getByRole("tablist");
    expect(tablist).toHaveAttribute(
      "aria-label",
      "Pestañas de la Bandeja Operativa de Expedientes"
    );
  });

  it("3. Debe marcar aria-selected=true únicamente en la pestaña activa", () => {
    render(
      <BandejaTabs
        estadoActivo="OBSERVADO"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabObservado = screen.getByRole("tab", { name: /observado/i });
    const tabPendiente = screen.getByRole("tab", { name: /pendiente/i });

    expect(tabObservado).toHaveAttribute("aria-selected", "true");
    expect(tabPendiente).toHaveAttribute("aria-selected", "false");
  });

  it("4. Debe reflejar dinámicamente los contadores en los badges sin números quemados", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    expect(screen.getByTestId("badge-pendiente").textContent).toBe("3");
    expect(screen.getByTestId("badge-observado").textContent).toBe("1");
    expect(screen.getByTestId("badge-derivado").textContent).toBe("4");
    expect(screen.getByTestId("badge-notificado").textContent).toBe("0");
  });

  it("5. Debe emitir el cambio al hacer clic en la pestaña OBSERVADO", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabObservado = screen.getByRole("tab", { name: /observado/i });
    fireEvent.click(tabObservado);

    expect(onCambiarEstadoMock).toHaveBeenCalledTimes(1);
    expect(onCambiarEstadoMock).toHaveBeenCalledWith("OBSERVADO");
  });

  it("6. Debe emitir el cambio al hacer clic en la pestaña DERIVADO", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabDerivado = screen.getByRole("tab", { name: /derivado/i });
    fireEvent.click(tabDerivado);

    expect(onCambiarEstadoMock).toHaveBeenCalledWith("DERIVADO");
  });

  it("7. Debe emitir el cambio al hacer clic en la pestaña ARCHIVADO", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabArchivado = screen.getByRole("tab", { name: /archivado/i });
    fireEvent.click(tabArchivado);

    expect(onCambiarEstadoMock).toHaveBeenCalledWith("ARCHIVADO");
  });

  it("8. Debe asignar estilos de resaltado visual a la pestaña activa", () => {
    render(
      <BandejaTabs
        estadoActivo="EN_PROCESO"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabEnProceso = screen.getByRole("tab", { name: /en proceso/i });
    expect(tabEnProceso.className).toContain("bg-blue-700");
  });

  it("9. Debe tolerar conteos indefinidos o vacíos mostrando 0 por defecto", () => {
    const conteosVacios = {} as Record<EstadoFlujoExpediente, number>;
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosVacios}
      />
    );
    expect(screen.getByTestId("badge-pendiente").textContent).toBe("0");
    expect(screen.getByTestId("badge-archivado").textContent).toBe("0");
  });

  it("10. Cada botón de pestaña debe contar con id y aria-controls vinculados para WAI-ARIA", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabPendiente = screen.getByRole("tab", { name: /pendiente/i });
    expect(tabPendiente).toHaveAttribute("id", "tab-pendiente");
    expect(tabPendiente).toHaveAttribute("aria-controls", "panel-pendiente");
  });
});
