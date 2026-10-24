/**
 * Suite del hook useEstadoConexion.
 * Cubre los eventos nativos `online` / `offline` y la confirmación de la
 * salida a internet mediante la sonda HTTP real.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEstadoConexion } from "../../../src/hooks/useEstadoConexion";
import { hayConectividadReal } from "../../../src/utils/conectividad";

vi.mock("../../../src/utils/conectividad", () => ({
  hayConectividadReal: vi.fn(async () => true),
}));

const mockSonda = vi.mocked(hayConectividadReal);

let enLinea = true;

function definirEstadoNavegador(valor: boolean) {
  enLinea = valor;
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => enLinea,
  });
}

beforeEach(() => {
  definirEstadoNavegador(true);
  mockSonda.mockResolvedValue(true);
});

afterEach(() => {
  definirEstadoNavegador(true);
});

describe("useEstadoConexion — eventos online/offline", () => {
  it("1. Arranca en línea cuando el navegador tiene salida a internet", () => {
    const { result } = renderHook(() => useEstadoConexion());
    expect(result.current.hayConexion).toBe(true);
    expect(result.current.estado).toBe("en-linea");
  });

  it("2. Marca la aplicación sin conexión al dispararse el evento offline", () => {
    const { result } = renderHook(() => useEstadoConexion());

    act(() => {
      definirEstadoNavegador(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.hayConexion).toBe(false);
    expect(result.current.estado).toBe("sin-conexion");
  });

  it("3. Vuelve a la normalidad al dispararse el evento online", async () => {
    const { result } = renderHook(() => useEstadoConexion());

    act(() => {
      definirEstadoNavegador(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.hayConexion).toBe(false);

    await act(async () => {
      definirEstadoNavegador(true);
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(result.current.hayConexion).toBe(true);
    });
    expect(mockSonda).toHaveBeenCalled();
  });

  it("4. Confirma con la sonda HTTP que la red volvió a responder", async () => {
    renderHook(() => useEstadoConexion());

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(mockSonda).toHaveBeenCalledTimes(1);
  });

  it("5. `reintentar` recupera la conexión si la sonda responde", async () => {
    const { result } = renderHook(() => useEstadoConexion());

    act(() => {
      definirEstadoNavegador(false);
      window.dispatchEvent(new Event("offline"));
    });

    await act(async () => {
      definirEstadoNavegador(true);
      await result.current.reintentar();
    });

    expect(result.current.hayConexion).toBe(true);
  });

  it("6. `reintentar` mantiene el estado sin conexión si la red sigue caída", async () => {
    mockSonda.mockResolvedValue(false);
    const { result } = renderHook(() => useEstadoConexion());

    act(() => {
      definirEstadoNavegador(false);
      window.dispatchEvent(new Event("offline"));
    });

    await act(async () => {
      await result.current.reintentar();
    });

    expect(result.current.hayConexion).toBe(false);
  });

  it("7. Elimina los listeners al desmontar el hook", () => {
    const quitar = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useEstadoConexion());

    unmount();

    const eventos = quitar.mock.calls.map(([evento]) => evento);
    expect(eventos).toContain("online");
    expect(eventos).toContain("offline");
  });
});
