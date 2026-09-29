import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, it, expect, vi } from "vitest";

import SlaBadge from "../../components/expedientes/SlaBadge";
import { addBusinessDays } from "../../utils/slaCalculator";
import type { VistaCalendario } from "../../types/calendarioLaboral";
import {
  feriadoExcepcional,
  vistaCalendario2026,
} from "../../test/calendarioLaboralFixtures";

/**
 * El semáforo consume el calendario oficial del backend (T-BE-OC-13), por lo que
 * el componente necesita `QueryClientProvider`. Se mockea la capa de servicio,
 * no el cliente HTTP, y se alimenta con una respuesta con la forma exacta de
 * `GET /api/v1/admin/calendario-laboral`.
 */
const obtenerMock = vi.fn<() => Promise<VistaCalendario>>();

vi.mock("../../services/calendarioLaboral.service", () => ({
  CALENDARIO_ENDPOINTS: {
    LISTAR: "/v1/admin/calendario-laboral",
    REGISTRAR_FERIADO: "/v1/admin/calendario-laboral/feriado-excepcional",
  },
  obtenerCalendarioLaboral: () => obtenerMock(),
  registrarFeriadoExcepcional: vi.fn(),
}));

function renderConProvider(ui: ReactElement) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={cliente}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  obtenerMock.mockReset();
  obtenerMock.mockResolvedValue(vistaCalendario2026());
});

describe("Suite de Pruebas de Componente SlaBadge (ENT-M03-02)", () => {
  it("renderiza correctamente el estado NORMAL (Verde / Al día)", async () => {
    const inicio = new Date(2026, 5, 1);
    const hoy = addBusinessDays(inicio, 5); // 25 días restantes

    renderConProvider(
      <SlaBadge
        fechaIngreso={inicio}
        fechaReferencia={hoy}
        plazoMaximoDiasHabiles={30}
      />,
    );

    const badge = await screen.findByLabelText(/25d hábiles \[Al día\]/i);
    expect(badge.className).toContain("text-emerald-800");
    expect(badge.className).toContain("border-emerald-300");
  });

  it("renderiza correctamente el estado ALERTA (Ámbar / Atención)", async () => {
    const inicio = new Date(2026, 5, 1);
    const hoy = addBusinessDays(inicio, 20); // 10 días restantes

    renderConProvider(
      <SlaBadge
        fechaIngreso={inicio}
        fechaReferencia={hoy}
        plazoMaximoDiasHabiles={30}
      />,
    );

    const badge = await screen.findByLabelText(/10d hábiles \[Atención\]/i);
    expect(badge.className).toContain("text-amber-900");
    expect(badge.className).toContain("border-amber-300");
  });

  it("renderiza correctamente el estado CRITICO (Rojo / Vencimiento inminente)", async () => {
    const inicio = new Date(2026, 5, 1);
    const hoy = addBusinessDays(inicio, 28); // 2 días restantes

    renderConProvider(
      <SlaBadge
        fechaIngreso={inicio}
        fechaReferencia={hoy}
        plazoMaximoDiasHabiles={30}
      />,
    );

    const badge = await screen.findByLabelText(/2d hábiles \[Crítico\]/i);
    expect(badge.className).toContain("text-rose-800");
    expect(badge.className).toContain("border-rose-300");
  });

  it("renderiza correctamente el estado VENCIDO con animación pulse de advertencia legal", async () => {
    const inicio = new Date(2026, 5, 1);
    const hoy = addBusinessDays(inicio, 34); // 4 días de mora

    renderConProvider(
      <SlaBadge
        fechaIngreso={inicio}
        fechaReferencia={hoy}
        plazoMaximoDiasHabiles={30}
      />,
    );

    const badge = await screen.findByLabelText(/Vencido \(4d hábiles\)/i);
    expect(badge.className).toContain("animate-pulse");
    expect(badge.className).toContain("text-red-900");
    expect(badge.className).toContain("border-red-500");
  });

  it("despliega la estructura accesible del tooltip con el desglose de días", async () => {
    const inicio = new Date(2026, 5, 1);
    const hoy = addBusinessDays(inicio, 10);

    renderConProvider(
      <SlaBadge
        fechaIngreso={inicio}
        fechaReferencia={hoy}
        plazoMaximoDiasHabiles={30}
      />,
    );

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent(/Días hábiles consumidos:/i);
    expect(tooltip).toHaveTextContent(/Días hábiles restantes:/i);
    expect(tooltip).toHaveTextContent(/Vencimiento legal:/i);
  });

  // -------------------------------------------------------------------------
  // T-BE-OC-14: el semáforo refleja el calendario oficial que devuelve el
  // backend, incluido un feriado excepcional recién registrado.
  // -------------------------------------------------------------------------
  describe("feriado excepcional reflejado en el semáforo", () => {
    it("cuenta menos días hábiles cuando el backend declara un feriado excepcional", async () => {
      const inicio = new Date(2026, 10, 16); // Lunes 16 de noviembre
      const referencia = new Date(2026, 10, 20); // Viernes 20 de noviembre

      // Mié 18 aún no es feriado en el calendario oficial.
      const { unmount } = renderConProvider(
        <SlaBadge
          fechaIngreso={inicio}
          fechaReferencia={referencia}
          plazoMaximoDiasHabiles={30}
        />,
      );
      const antes = await screen.findByLabelText(/26d hábiles/);
      expect(antes).toBeInTheDocument();
      unmount();

      // El backend registra el 18 como feriado excepcional y devuelve el
      // calendario actualizado: el 18 deja de computar.
      obtenerMock.mockResolvedValue(
        vistaCalendario2026([
          feriadoExcepcional("2026-11-18", "Feriado excepcional institucional"),
        ]),
      );

      renderConProvider(
        <SlaBadge
          fechaIngreso={inicio}
          fechaReferencia={referencia}
          plazoMaximoDiasHabiles={30}
        />,
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/27d hábiles/)).toBeInTheDocument();
      });
      expect(screen.queryByLabelText(/26d hábiles/)).not.toBeInTheDocument();
    });

    it("degrada a lunes-viernes sin romper si el calendario no se puede cargar", async () => {
      obtenerMock.mockRejectedValue(new Error("503 Service Unavailable"));
      const inicio = new Date(2026, 5, 1);
      const hoy = addBusinessDays(inicio, 5);

      renderConProvider(
        <SlaBadge
          fechaIngreso={inicio}
          fechaReferencia={hoy}
          plazoMaximoDiasHabiles={30}
        />,
      );

      // Sin calendario el cálculo sigue funcionando (sólo fines de semana).
      expect(await screen.findByLabelText(/25d hábiles \[Al día\]/i)).toBeInTheDocument();
    });
  });
});
