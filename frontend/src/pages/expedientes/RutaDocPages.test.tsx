// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BandejaExpedientesPage from "./BandejaExpedientesPage";
import ExpedienteDetallePage from "./ExpedienteDetallePage";

const usarBandeja = vi.fn();
const usarDetalle = vi.fn();
const usarTrazabilidad = vi.fn();
vi.mock("../../components/expedientes/CcdFoliadoConectado", () => ({ default: () => <div>Foliación conectada</div> }));
vi.mock("../../hooks/useRutaDocExpedientes", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../hooks/useRutaDocExpedientes")>();
  return { ...original, useBandejaRutaDoc: (...args: unknown[]) => usarBandeja(...args),
    useDetalleRutaDoc: (...args: unknown[]) => usarDetalle(...args),
    useTrazabilidadRutaDoc: (...args: unknown[]) => usarTrazabilidad(...args) };
});

describe("vistas RutaDoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usarTrazabilidad.mockReturnValue({ data: [], isPending: false, isError: false });
    usarBandeja.mockReturnValue({ data: { elementos: [], contadores: {
      PENDIENTES: 1, EN_TRAMITE: 2, DERIVADOS: 0, POR_FIRMAR: 0, ATENDIDOS: 0, ARCHIVADOS: 0,
    }, tieneMas: false, siguienteCursor: null }, isPending: false, isError: false });
  });

  it("muestra seis pestañas reales y cambia el parámetro de consulta", () => {
    render(<MemoryRouter><BandejaExpedientesPage /></MemoryRouter>);
    expect(screen.getAllByRole("tab")).toHaveLength(6);
    expect(screen.getByText("No hay expedientes con estos filtros.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /En trámite/ }));
    expect(usarBandeja).toHaveBeenLastCalledWith(expect.objectContaining({ pestana: "EN_TRAMITE", limite: 20 }), true);
  });

  it("navega entre páginas con el cursor devuelto por el servidor", () => {
    usarBandeja.mockReturnValue({ data: { elementos: [], contadores: {}, tieneMas: true, siguienteCursor: "cursor-2" }, isPending: false, isError: false });
    render(<MemoryRouter><BandejaExpedientesPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(usarBandeja).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "cursor-2" }), true);
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(usarBandeja).toHaveBeenLastCalledWith(expect.not.objectContaining({ cursor: expect.anything() }), true);
  });

  it("consulta el detalle por ID y no presenta campos inexistentes en el contrato", () => {
    usarDetalle.mockReturnValue({ data: { idExpediente: "12", cut: "EXP-12", asunto: "Solicitud",
      fechaRadicacion: "2026-10-18T00:00:00.000Z", estadoActual: "REGISTRADO", areaActualId: null,
      resumenDocumentos: null, ultimoMovimiento: null, solicitanteId: null, sla: null },
      isPending: false, isError: false });
    render(<MemoryRouter initialEntries={["/expedientes/12"]}><Routes>
      <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
    </Routes></MemoryRouter>);
    expect(usarDetalle).toHaveBeenCalledWith("12");
    expect(usarTrazabilidad).toHaveBeenCalledWith("12");
    expect(screen.getByText("EXP-12")).toBeTruthy();
    expect(screen.getByText("Foliación conectada")).toBeTruthy();
    expect(screen.queryByText("Derivar Expediente")).toBeNull();
  });
});
