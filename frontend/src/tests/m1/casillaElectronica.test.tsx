import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CasillaBadgeRealtime } from "../../components/casilla/CasillaBadgeRealtime";
import AcuseNotificacionModal from "../../components/casilla/AcuseNotificacionModal";
import NotificacionDetailModal from "../../components/casilla/NotificacionDetailModal";
import NotificationList from "../../components/casilla/NotificacionList";
import CasillaElectronicaPage from "../../pages/casilla/CasillaElectronicaPage";
import type { Notificacion } from "../../types/casilla";
import { acuse, filtrosIniciales, metaInicial, notificacion } from "./fixtures";

const mocks = vi.hoisted(() => ({
  useCasilla: vi.fn(),
  useCasillaNotifications: vi.fn(),
}));

vi.mock("../../hooks/useCasilla", () => ({ useCasilla: mocks.useCasilla }));
vi.mock("../../hooks/useCasillaNotifications", () => ({
  useCasillaNotifications: mocks.useCasillaNotifications,
}));
vi.mock("../../api/client", () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

function listProps(overrides: Partial<React.ComponentProps<typeof NotificationList>> = {}) {
  return {
    notificaciones: [notificacion],
    meta: metaInicial,
    filtros: filtrosIniciales,
    hasActiveFilters: false,
    isLoading: false,
    isError: false,
    onSelectNotificacion: vi.fn(),
    onSetTipo: vi.fn(),
    onSetEstado: vi.fn(),
    onSetFechaInicio: vi.fn(),
    onSetFechaFin: vi.fn(),
    onSetBusqueda: vi.fn(),
    onSetPage: vi.fn(),
    onSetLimit: vi.fn(),
    onResetFiltros: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

function casillaHook(overrides: Record<string, unknown> = {}) {
  return {
    filtros: filtrosIniciales,
    hasActiveFilters: false,
    setTipo: vi.fn(),
    setEstado: vi.fn(),
    setFechaInicio: vi.fn(),
    setFechaFin: vi.fn(),
    setBusqueda: vi.fn(),
    setPage: vi.fn(),
    setLimit: vi.fn(),
    resetFiltros: vi.fn(),
    notificaciones: [notificacion],
    meta: metaInicial,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    stats: { total: 1, noLeidos: 1, leidos: 0, notificados: 0, urgentes: 1 },
    isLoadingStats: false,
    isModalOpen: false,
    selectedNotificacion: null as Notificacion | null,
    openDetalle: vi.fn(),
    closeDetalle: vi.fn(),
    generarAcuse: vi.fn(),
    isGenerandoAcuse: false,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CasillaElectronicaPage />
    </MemoryRouter>,
  );
}

describe("bandeja de casilla", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCasilla.mockReturnValue(casillaHook());
  });

  it("renderiza una notificación y activa su detalle al hacer clic o usar Enter", async () => {
    const onSelect = vi.fn();
    render(<NotificationList {...listProps({ onSelectNotificacion: onSelect })} />);

    const item = screen.getByRole("button", {
      name: /NOT-2026-000001.*Resolución de prueba/i,
    });
    expect(screen.getByText("Resolución")).toBeInTheDocument();
    expect(screen.getAllByText("No Leído").length).toBeGreaterThan(0);
    expect(screen.getByText("Urgente")).toBeInTheDocument();
    await userEvent.click(item);
    fireEvent.keyDown(item, { key: "Enter" });
    fireEvent.keyDown(item, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it("presenta los estados de carga, error y casilla vacía con sus acciones", async () => {
    const onRetry = vi.fn();
    const onReset = vi.fn();
    const { rerender } = render(
      <NotificationList {...listProps({ isLoading: true })} />,
    );
    expect(document.querySelectorAll(".animate-pulse").length).toBe(3);

    rerender(
      <NotificationList {...listProps({ isError: true, onRetry })} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /reintentar consulta/i }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(
      <NotificationList
        {...listProps({
          notificaciones: [],
          hasActiveFilters: true,
          onResetFiltros: onReset,
        })}
      />,
    );
    expect(screen.getByText(/no se encontraron notificaciones oficiales/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /restablecer todos los filtros/i }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("permite modificar y limpiar filtros y paginación", async () => {
    const props = listProps({
      hasActiveFilters: true,
      meta: { ...metaInicial, currentPage: 2, totalPages: 3, totalItems: 12, hasNextPage: true, hasPreviousPage: true },
    });
    render(<NotificationList {...props} />);
    await userEvent.selectOptions(screen.getByLabelText(/tipo de acto/i), "OFICIO");
    await userEvent.selectOptions(screen.getByLabelText(/estado de notificación/i), "LEIDO");
    await userEvent.type(screen.getByLabelText(/buscar por asunto/i), "expediente");
    await userEvent.type(screen.getByLabelText(/fecha depósito \(desde\)/i), "2026-01-01");
    await userEvent.type(screen.getByLabelText(/fecha depósito \(hasta\)/i), "2026-01-31");
    await userEvent.selectOptions(screen.getByLabelText(/por página/i), "10");
    await userEvent.click(screen.getByRole("button", { name: /limpiar filtros/i }));
    expect(props.onSetTipo).toHaveBeenCalledWith("OFICIO");
    expect(props.onSetEstado).toHaveBeenCalledWith("LEIDO");
    expect(props.onSetBusqueda).toHaveBeenLastCalledWith("e");
    expect(props.onSetFechaInicio).toHaveBeenCalledWith("2026-01-01");
    expect(props.onSetFechaFin).toHaveBeenCalledWith("2026-01-31");
    expect(props.onSetLimit).toHaveBeenCalledWith(10);
    expect(props.onResetFiltros).toHaveBeenCalledOnce();
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("renderiza los tipos y estados no leídos, leídos y notificados", () => {
    const rows = [
      notificacion,
      { ...notificacion, id: "2", tipo: "NOTIFICACION_OBSERVACION" as const, estado: "LEIDO" as const, prioridad: "NORMAL" as const },
      { ...notificacion, id: "3", tipo: "OFICIO" as const, estado: "NOTIFICADO" as const, prioridad: "ALTA" as const },
      { ...notificacion, id: "4", tipo: "CITACION" as const },
      { ...notificacion, id: "5", tipo: "CONSTANCIA" as const },
      { ...notificacion, id: "6", tipo: "INFORME" as const },
      { ...notificacion, id: "7", tipo: "OTRO" as const },
    ];
    render(<NotificationList {...listProps({ notificaciones: rows })} />);
    expect(screen.getByText("Observación")).toBeInTheDocument();
    expect(screen.getByText("Oficio")).toBeInTheDocument();
    expect(screen.getByText("Citación")).toBeInTheDocument();
    expect(screen.getByText("Constancia")).toBeInTheDocument();
    expect(screen.getByText("Informe")).toBeInTheDocument();
    expect(screen.getByText("Documento")).toBeInTheDocument();
    expect(screen.getAllByText("Leído").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Notificado (Con Acuse)").length).toBeGreaterThan(0);
  });

  it("muestra lista, contadores, error y detalle a través de la página enrutada", async () => {
    const hook = casillaHook();
    mocks.useCasilla.mockReturnValue(hook);
    const { rerender } = renderPage();
    expect(screen.getByRole("heading", { name: /bandeja de casilla electrónica ciudadana/i })).toBeInTheDocument();
    expect(screen.getByText("Resolución de prueba")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /no leídos/i }));
    expect(hook.setEstado).toHaveBeenCalledWith("NO_LEIDO");
    await userEvent.click(screen.getByRole("button", { name: /consultados sin acuse emitido/i }));
    await userEvent.click(screen.getByRole("button", { name: /con fecha cierta y hash sha-256/i }));
    expect(hook.setEstado).toHaveBeenNthCalledWith(2, "LEIDO");
    expect(hook.setEstado).toHaveBeenNthCalledWith(3, "NOTIFICADO");

    hook.isModalOpen = true;
    hook.selectedNotificacion = notificacion;
    rerender(<MemoryRouter><CasillaElectronicaPage /></MemoryRouter>);
    expect(screen.getByRole("dialog", { name: /RD-001-2026/i })).toBeInTheDocument();
  });

  it("permite reintentar desde la página y muestra bandeja vacía", async () => {
    const hook = casillaHook({ isError: true, notificaciones: [], hasActiveFilters: false });
    mocks.useCasilla.mockReturnValue(hook);
    const { rerender } = renderPage();
    await userEvent.click(screen.getByRole("button", { name: /reintentar consulta/i }));
    expect(hook.refetch).toHaveBeenCalledOnce();
    mocks.useCasilla.mockReturnValue({ ...hook, isError: false });
    rerender(<MemoryRouter><CasillaElectronicaPage /></MemoryRouter>);
    expect(screen.getByText(/su casilla electrónica se encuentra al día/i)).toBeInTheDocument();
  });
});

describe("detalle y acuse de notificación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no muestra detalle cerrado y ofrece cierre por botón, Escape y fondo", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <NotificacionDetailModal isOpen={false} notificacion={notificacion} isGenerandoAcuse={false} onClose={onClose} onGenerarAcuse={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(
      <NotificacionDetailModal isOpen notificacion={notificacion} isGenerandoAcuse={false} onClose={onClose} onGenerarAcuse={vi.fn()} />,
    );
    expect(screen.getByText("Texto íntegro del acto")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /cerrar modal de notificación/i }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog"), { target: screen.getByRole("dialog") });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("muestra el acuse emitido y llama a su descarga", async () => {
    const service = await import("../../services/casillaService");
    const download = vi.spyOn(service.casillaService, "descargarAcuse").mockImplementation(() => undefined);
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    render(
      <NotificacionDetailModal
        isOpen
        notificacion={{ ...notificacion, estado: "NOTIFICADO", acuse }}
        isGenerandoAcuse={false}
        onClose={vi.fn()}
        onGenerarAcuse={vi.fn()}
      />,
    );
    expect(screen.getByText(/cédula de acuse de notificación electrónica/i)).toBeInTheDocument();
    expect(screen.getByText(/vencimiento proyectado/i)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Copiar" })[1]!);
    expect(await screen.findByText("Copiado!")).toBeInTheDocument();
    expect(clipboardWrite).toHaveBeenCalledWith(acuse.hashSha256Acuse);
    await userEvent.click(screen.getByRole("button", { name: /descargar cédula de acuse/i }));
    expect(download).toHaveBeenCalledWith(acuse);
    download.mockRestore();
  });

  it("permite solicitar un acuse pendiente y representa la operación en curso", async () => {
    const service = await import("../../services/casillaService");
    const download = vi.spyOn(service.casillaService, "descargarDocumento").mockImplementation(() => undefined);
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    const onGenerate = vi.fn();
    const props = {
      isOpen: true,
      notificacion: {
        ...notificacion,
        estado: "LEIDO" as const,
        fechaLecturaIso: "2026-01-12T10:10:00.000Z",
        fechaDepositoIso: "fecha inválida",
        actoAdministrativo: { ...notificacion.actoAdministrativo, textoCompleto: undefined, firmantes: [] },
      },
      isGenerandoAcuse: false,
      onClose: vi.fn(),
      onGenerarAcuse: onGenerate,
    };
    const { rerender } = render(<NotificacionDetailModal {...props} />);
    expect(screen.getByText("fecha inválida")).toBeInTheDocument();
    expect(screen.queryByText(/lectura en este momento/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copiar" }));
    expect(clipboardWrite).toHaveBeenCalledWith(notificacion.actoAdministrativo.hashIntegridadSha256);
    await userEvent.click(screen.getByRole("button", { name: /descargar acto administrativo/i }));
    expect(download).toHaveBeenCalledWith(props.notificacion);
    await userEvent.click(screen.getByRole("button", { name: /generar y confirmar acuse digital legal/i }));
    expect(onGenerate).toHaveBeenCalledWith(notificacion.id);
    rerender(<NotificacionDetailModal {...props} isGenerandoAcuse />);
    expect(screen.getByRole("button", { name: /generando acuse legal/i })).toBeDisabled();
    download.mockRestore();
  });

  it("abre, valida, registra y presenta el acuse en el servidor", async () => {
    const { apiClient } = await import("../../api/client");
    vi.mocked(apiClient.patch).mockResolvedValue({ data: notificacion } as never);
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { data: { idAcuse: "ACU-1", hashSha256: "c".repeat(64), selladoTiempo: "2026-01-12T10:30:00.000Z" } },
    } as never);
    const onGenerated = vi.fn();
    render(<AcuseNotificacionModal isOpen notificacion={notificacion} onClose={vi.fn()} onAcuseGenerado={onGenerated} />);
    const confirm = screen.getByRole("button", { name: /confirmar y registrar acuse/i });
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(confirm);
    expect(await screen.findByText("Acuse registrado")).toBeInTheDocument();
    expect(apiClient.patch).toHaveBeenCalledOnce();
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/casilla/notificaciones/notif-1/acuse",
      { notificacionId: "notif-1", confirmacionAdministrado: true },
    );
    expect(onGenerated).toHaveBeenCalledWith(expect.objectContaining({ idAcuse: "ACU-1" }));
  });

  it("no solicita marcar como leído para una notificación ya leída y muestra errores de servidor", async () => {
    const { apiClient } = await import("../../api/client");
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("fallo de servidor"));
    render(<AcuseNotificacionModal isOpen notificacion={{ ...notificacion, estado: "LEIDO" }} onClose={vi.fn()} onAcuseGenerado={vi.fn()} />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /confirmar y registrar acuse/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/fallo de servidor/i);
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it("rechaza una respuesta del servidor sin datos verificables", async () => {
    const { apiClient } = await import("../../api/client");
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { idAcuse: "ACU-1" } } as never);
    render(<AcuseNotificacionModal isOpen notificacion={notificacion} onClose={vi.fn()} onAcuseGenerado={vi.fn()} />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /confirmar y registrar acuse/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/acuse verificable/i);
  });
});

describe("insignia de notificaciones", () => {
  it("expone el contador y el mensaje accesible, incluye el tope 99+", async () => {
    mocks.useCasilla.mockReturnValue({
      stats: { total: 0, noLeidos: 12, leidos: 0, notificados: 0, urgentes: 0 },
      isLoadingStats: false,
    });
    mocks.useCasillaNotifications.mockReturnValue({ sseConectado: true, notificacionesRecibidas: 0 });
    const { rerender } = render(<CasillaBadgeRealtime />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/12 notificaciones sin leer/i);

    mocks.useCasilla.mockReturnValue({
      stats: { total: 0, noLeidos: 120, leidos: 0, notificados: 0, urgentes: 0 },
      isLoadingStats: false,
    });
    mocks.useCasillaNotifications.mockReturnValue({ sseConectado: false, notificacionesRecibidas: 1 });
    rerender(<CasillaBadgeRealtime />);
    expect(screen.getByText("99+")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/actualizando periódicamente/i));
    await waitFor(
      () => expect(screen.getByText("🔔")).not.toHaveClass("animate-pulse"),
      { timeout: 1500 },
    );
  });

  it("expresa los estados sin pendientes y cargando sin dibujar contador", () => {
    mocks.useCasilla.mockReturnValue({
      stats: { total: 0, noLeidos: 0, leidos: 0, notificados: 0, urgentes: 0 },
      isLoadingStats: true,
    });
    mocks.useCasillaNotifications.mockReturnValue({ sseConectado: false, notificacionesRecibidas: 0 });
    render(<CasillaBadgeRealtime />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/cargando notificaciones/i);
  });
});
