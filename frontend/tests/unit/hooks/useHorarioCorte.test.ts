import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  calculateHorarioCorte,
  formatFechaJuridicaRecepcion,
  useHorarioCorte,
} from "../../../src/hooks/useHorarioCorte";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useHorarioCorte", () => {
  it("considera hábil un lunes a las 09:00 de Lima", () => {
    const result = calculateHorarioCorte(new Date("2026-09-07T09:00:00-05:00"));

    expect(result.isHorarioHabil).toBe(true);
    expect(result.isExtemporaneo).toBe(false);
  });

  it("considera hábil un lunes a las 16:14:59", () => {
    const result = calculateHorarioCorte(new Date("2026-09-07T16:14:59-05:00"));

    expect(result.isHorarioHabil).toBe(true);
    expect(result.isUltimosMinutos).toBe(false);
  });

  it("activa los últimos minutos exactamente a las 16:15:00", () => {
    const result = calculateHorarioCorte(new Date("2026-09-07T16:15:00-05:00"));

    expect(result.isHorarioHabil).toBe(true);
    expect(result.isUltimosMinutos).toBe(true);
  });

  it("mantiene la alerta de últimos minutos hasta las 16:29:59", () => {
    const result = calculateHorarioCorte(new Date("2026-09-07T16:29:59-05:00"));

    expect(result.isUltimosMinutos).toBe(true);
    expect(result.isExtemporaneo).toBe(false);
  });

  it("activa el estado extemporáneo a las 16:30:01", () => {
    const result = calculateHorarioCorte(new Date("2026-09-07T16:30:01-05:00"));

    expect(result.isExtemporaneo).toBe(true);
    expect(result.legalTimestamp).toBe("2026-09-08T08:00:00-05:00");
  });

  it("difiere una radicación del lunes a las 16:35 al martes a las 08:00", () => {
    const result = calculateHorarioCorte(new Date("2026-09-07T16:35:00-05:00"));

    expect(result.fechaJuridicaRecepcion).toBe("2026-09-08T08:00:00-05:00");
  });

  it("difiere una radicación del viernes por la tarde al lunes a las 08:00", () => {
    const result = calculateHorarioCorte(new Date("2026-09-11T17:00:00-05:00"));

    expect(result.fechaJuridicaRecepcion).toBe("2026-09-14T08:00:00-05:00");
  });

  it("difiere las radicaciones de sábado y domingo al lunes a las 08:00", () => {
    const saturday = calculateHorarioCorte(new Date("2026-09-12T10:00:00-05:00"));
    const sunday = calculateHorarioCorte(new Date("2026-09-13T23:59:00-05:00"));

    expect(saturday.isExtemporaneo).toBe(true);
    expect(saturday.fechaJuridicaRecepcion).toBe("2026-09-14T08:00:00-05:00");
    expect(sunday.isExtemporaneo).toBe(true);
    expect(sunday.fechaJuridicaRecepcion).toBe("2026-09-14T08:00:00-05:00");
  });

  it("usa America/Lima aunque la zona local equivalga a UTC", () => {
    const limaAt1615 = new Date("2026-09-07T21:15:00.000Z");
    const result = calculateHorarioCorte(limaAt1615);

    expect(result.isUltimosMinutos).toBe(true);
    expect(result.serverTime.toISOString()).toBe("2026-09-07T21:15:00.000Z");
  });

  it("sincroniza el reloj con la cabecera Date de la API", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T13:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue({
      headers: { get: (name: string) => name.toLowerCase() === "date"
        ? "Mon, 07 Sep 2026 21:35:00 GMT"
        : null },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useHorarioCorte());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "HEAD", cache: "no-store" }),
    );
    expect(result.current.serverTime.toISOString()).toBe("2026-09-07T21:35:00.000Z");
    expect(result.current.isExtemporaneo).toBe(true);
  });

  it("actualiza el estado al avanzar el reloj simulado", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-09-07T16:14:59-05:00");
    vi.setSystemTime(start);
    const serverTimeProvider = async () => start;
    const { result } = renderHook(() =>
      useHorarioCorte(start, [], serverTimeProvider),
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isUltimosMinutos).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.isUltimosMinutos).toBe(true);
  });

  it("formatea la fecha jurídica para mostrarla al usuario", () => {
    const formatted = formatFechaJuridicaRecepcion("2026-09-08T08:00:00-05:00");

    expect(formatted).toContain("2026");
    expect(formatted).not.toBe("2026-09-08T08:00:00-05:00");
  });
});