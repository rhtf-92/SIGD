/**
 * Pruebas del hook del calendario oficial (T-BE-OC-13 / T-BE-OC-14).
 *
 * Se sigue el patrón del repositorio para hooks con TanStack Query:
 * `renderHook` + `QueryClientProvider` + `vi.spyOn(cliente, "invalidateQueries")`
 * (ver `src/hooks/useExpedienteActions.test.tsx`).
 *
 * Se mockea la capa de servicio, no el cliente HTTP, para aislar la lógica del
 * hook: traducción de la vista del backend y señal de invalidación.
 */

import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useCalendarioOficial,
  aCalendarioLaboral,
  combinarVistasAnuales,
  rangoPorDefecto,
  CALENDARIO_QUERY_KEYS,
} from "./useCalendarioOficial";
import type {
  ConsultaCalendario,
  FeriadoRegistrado,
  VistaCalendario,
} from "../types/calendarioLaboral";
import { calculateSlaStatus } from "../utils/slaCalculator";
import {
  diaCalendario,
  feriadoExcepcional,
  vistaCalendario2026,
} from "../test/calendarioLaboralFixtures";

const obtenerMock =
  vi.fn<(filtros?: ConsultaCalendario) => Promise<VistaCalendario>>();
const registrarMock = vi.fn<() => Promise<FeriadoRegistrado>>();

vi.mock("../services/calendarioLaboral.service", () => ({
  CALENDARIO_ENDPOINTS: {
    LISTAR: "/v1/admin/calendario-laboral",
    REGISTRAR_FERIADO: "/v1/admin/calendario-laboral/feriado-excepcional",
  },
  obtenerCalendarioLaboral: (filtros: ConsultaCalendario) => obtenerMock(filtros),
  registrarFeriadoExcepcional: () => registrarMock(),
}));

function preparar() {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  }
  return { cliente, wrapper: Wrapper };
}

function registrado(fecha: string): FeriadoRegistrado {
  return {
    ...feriadoExcepcional(fecha, "Feriado excepcional institucional"),
    creado_en: "2026-09-28T00:00:00.000Z",
    correlation_id: "corr-prueba",
    cache_invalidation: "EMITIDA",
    id_evento_outbox: "evt-1",
    id_auditoria: "aud-1",
  };
}

beforeEach(() => {
  obtenerMock.mockReset();
  registrarMock.mockReset();
});

describe("useCalendarioOficial", () => {
  it("traduce la vista del backend al formato de slaCalculator", () => {
    const vista = vistaCalendario2026([
      feriadoExcepcional("2026-11-18", "Feriado excepcional"),
      {
        ...feriadoExcepcional("2026-11-21", "Sábado laborable"),
        es_laborable: true,
        tipo_feriado: null,
      },
    ]);

    const calendario = aCalendarioLaboral(vista);

    expect(calendario.noLaborables.has("2026-11-18")).toBe(true);
    expect(calendario.noLaborables.has("2026-05-01")).toBe(true);
    expect(calendario.laborablesExcepcionales.has("2026-11-21")).toBe(true);
    // El sábado habilitado no debe figurar como no laborable.
    expect(calendario.noLaborables.has("2026-11-21")).toBe(false);
  });

  it("ignora las filas dadas de baja (activo = false)", () => {
    const vista = vistaCalendario2026();
    vista.calendario = vista.calendario.map((dia) =>
      dia.fecha === "2026-05-01" ? { ...dia, activo: false } : dia,
    );

    const calendario = aCalendarioLaboral(vista);
    expect(calendario.noLaborables.has("2026-05-01")).toBe(false);
    expect(calendario.noLaborables.has("2026-12-25")).toBe(true);
  });

  it("expone un rango por defecto que cubre el ejercicio actual y los adyacentes", () => {
    const rango = rangoPorDefecto(new Date(2026, 5, 15));
    expect(rango).toEqual({ desde: "2025-01-01", hasta: "2027-12-31" });
  });

  // -------------------------------------------------------------------------
  // `construirVistaCalendario` del backend construye la vista de un SOLO
  // ejercicio: una consulta por rango devuelve el `total` global pero sólo los
  // días de un año. El hook debe fusionarlos para no calcular el SLA con un
  // calendario incompleto.
  // -------------------------------------------------------------------------
  describe("consulta por rango", () => {
    it("pide un año por ejercicio y fusiona los días de todo el rango", async () => {
      obtenerMock.mockImplementation(async (filtros) => {
        const anio = filtros?.anio ?? 2026;
        return {
          anio,
          total_dias: 1,
          dias_no_laborables: 1,
          feriados_nacionales: [],
          feriados_regionales_ucayali: [],
          feriados_institucionales: [],
          duelos_nacionales: [],
          dias_laborables_excepcionales: [],
          calendario: [
            diaCalendario(
              `${anio}-12-25`,
              "NACIONAL",
              `Navidad ${anio}`,
            ),
          ],
          anios_disponibles: [anio],
        };
      });

      const { wrapper } = preparar();
      const { result } = renderHook(
        () => useCalendarioOficial(rangoPorDefecto(new Date(2026, 5, 15))),
        { wrapper },
      );
      await waitFor(() => expect(result.current.cargando).toBe(false));

      // Un año por ejercicio, sin repetir el rango inicial.
      const aniosPedidos = obtenerMock.mock.calls.map(([f]) => f?.anio);
      expect(aniosPedidos).toEqual([2025, 2026, 2027]);

      // Los tres ejercicios deben estar presentes en el calendario entregado.
      expect(result.current.diasNoLaborables).toEqual(
        expect.arrayContaining(["2025-12-25", "2026-12-25", "2027-12-25"]),
      );
      expect(result.current.vista.anios_disponibles).toEqual([2025, 2026, 2027]);
    });

    it("usa una sola petición cuando la consulta trae un año explícito", async () => {
      obtenerMock.mockResolvedValue(vistaCalendario2026());
      const { wrapper } = preparar();

      const { result } = renderHook(
        () => useCalendarioOficial({ anio: 2026 }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.cargando).toBe(false));

      expect(obtenerMock).toHaveBeenCalledOnce();
      expect(obtenerMock).toHaveBeenCalledWith({ anio: 2026 });
    });

    it("combina vistas anuales sin duplicar días ni perder los contadores", () => {
      const navidad2027 = diaCalendario("2027-01-01", "NACIONAL", "Año Nuevo 2027");
      const agregada = combinarVistasAnuales([
        vistaCalendario2026(),
        {
          anio: 2027,
          total_dias: 1,
          dias_no_laborables: 1,
          feriados_nacionales: [navidad2027],
          feriados_regionales_ucayali: [],
          feriados_institucionales: [],
          duelos_nacionales: [],
          dias_laborables_excepcionales: [],
          calendario: [navidad2027],
          anios_disponibles: [2027],
        },
      ]);

      // 16 feriados de 2026 + 1 de 2027, sin repetir los de 2026.
      expect(agregada.total_dias).toBe(17);
      expect(agregada.dias_no_laborables).toBe(17);
      expect(agregada.calendario).toHaveLength(17);
      expect(agregada.calendario.map((d) => d.fecha)).toContain("2027-01-01");
      expect(agregada.anios_disponibles).toEqual([2026, 2027]);
      // La vista agregada debe quedar ordenada por fecha.
      expect(agregada.calendario[0].fecha).toBe("2026-01-01");
    });

    it("devuelve la vista sin cambios cuando sólo se consulta un año", () => {
      const unica = vistaCalendario2026();
      expect(combinarVistasAnuales([unica])).toBe(unica);
    });
  });

  it("entrega el calendario oficial al cálculo del SLA", async () => {
    obtenerMock.mockResolvedValue(vistaCalendario2026());
    const { wrapper } = preparar();

    const { result } = renderHook(() => useCalendarioOficial(), { wrapper });
    await waitFor(() => expect(result.current.cargando).toBe(false));

    // 2026-06-24 es feriado regional de Ucayali: no debe computar.
    const sla = calculateSlaStatus(
      new Date(2026, 5, 22),
      new Date(2026, 5, 29),
      30,
      result.current.calendario,
    );
    expect(sla.diasHabilesConsumidos).toBe(3);
    expect(result.current.diasNoLaborables).toContain("2026-06-24");
  });

  it("invalida la query del calendario tras registrar un feriado, sin esperar al revalidado", async () => {
    obtenerMock.mockResolvedValue(vistaCalendario2026());
    registrarMock.mockResolvedValue(registrado("2026-11-18"));

    const { cliente, wrapper } = preparar();
    const invalidar = vi.spyOn(cliente, "invalidateQueries");

    const { result } = renderHook(() => useCalendarioOficial(), { wrapper });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    const llamadasAntes = obtenerMock.mock.calls.length;

    await act(async () => {
      await result.current.registrarFeriado({
        fecha: "2026-11-18",
        descripcion: "Feriado excepcional institucional",
      });
    });

    expect(registrarMock).toHaveBeenCalledOnce();
    expect(invalidar).toHaveBeenCalledWith({
      queryKey: CALENDARIO_QUERY_KEYS.all,
    });
    // Efecto observable de la invalidación: se vuelve a pedir el calendario al
    // backend sin esperar al revalidado de los 5 minutos. (No se comprueba
    // `isInvalidated` porque el refetch ya lo restablece a false.)
    await waitFor(() =>
      expect(obtenerMock.mock.calls.length).toBeGreaterThan(llamadasAntes),
    );
  });

  it("el calendario se actualiza tras el alta: el mismo día pasa a ser inhábil", async () => {
    const inicial = vistaCalendario2026();
    const trasAlta = vistaCalendario2026([
      feriadoExcepcional("2026-11-18", "Feriado excepcional institucional"),
    ]);
    // El rango por defecto pide un año por ejercicio, así que el estado del
    // backend se modela con una variable y no con `mockResolvedValueOnce`.
    let estado = inicial;
    obtenerMock.mockImplementation(async () => estado);
    registrarMock.mockResolvedValue(registrado("2026-11-18"));

    const { wrapper } = preparar();
    const { result } = renderHook(() => useCalendarioOficial(), { wrapper });
    await waitFor(() => expect(result.current.cargando).toBe(false));

    const antes = calculateSlaStatus(
      new Date(2026, 10, 16),
      new Date(2026, 10, 20),
      30,
      result.current.calendario,
    );
    expect(antes.diasHabilesConsumidos).toBe(4);

    // El backend responde ya con el feriado recién registrado.
    estado = trasAlta;
    await act(async () => {
      await result.current.registrarFeriado({
        fecha: "2026-11-18",
        descripcion: "Feriado excepcional institucional",
      });
    });

    await waitFor(() =>
      expect(result.current.calendario.noLaborables.has("2026-11-18")).toBe(true),
    );

    const despues = calculateSlaStatus(
      new Date(2026, 10, 16),
      new Date(2026, 10, 20),
      30,
      result.current.calendario,
    );
    expect(despues.diasHabilesConsumidos).toBe(3);
    expect(despues.diasHabilesRestantes).toBe(27);
  });

  it("mantiene un calendario vacío (lunes a viernes) si el backend no responde", async () => {
    obtenerMock.mockRejectedValue(new Error("503 Service Unavailable"));
    const { wrapper } = preparar();

    const { result } = renderHook(() => useCalendarioOficial(), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.calendario.noLaborables.size).toBe(0);
    expect(result.current.diasNoLaborables).toEqual([]);
    expect(result.current.vista.total_dias).toBe(0);
  });
});
