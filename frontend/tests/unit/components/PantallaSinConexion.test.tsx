/**
 * Suite de la pantalla de "sin conexión a internet".
 * Verifica que la escena del cavernícola aparezca al perder la señal y se
 * desvanezca al recuperarla.
 */
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PantallaSinConexion from "../../../src/components/common/PantallaSinConexion";
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

function renderPantalla() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PantallaSinConexion />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Provoca la pérdida de salida a internet. */
function perderConexion() {
  act(() => {
    definirEstadoNavegador(false);
    window.dispatchEvent(new Event("offline"));
  });
}

/** Provoca la recuperación de la salida a internet. */
async function recuperarConexion() {
  await act(async () => {
    definirEstadoNavegador(true);
    window.dispatchEvent(new Event("online"));
  });
}

beforeEach(() => {
  definirEstadoNavegador(true);
  mockSonda.mockResolvedValue(true);
});

afterEach(() => {
  definirEstadoNavegador(true);
});

describe("Pantalla de sin conexión", () => {
  it("1. No se muestra mientras la conexión es estable", () => {
    renderPantalla();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("2. Aparece automáticamente al perder la salida a internet", async () => {
    renderPantalla();

    perderConexion();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { level: 1, name: /desenchufó el cable/i }),
    ).toBeInTheDocument();
  });

  it("3. Conserva la estructura base: .page_404 y .four_zero_four_bg", async () => {
    const { container } = renderPantalla();

    perderConexion();

    await waitFor(() => {
      expect(container.querySelector(".page_404")).not.toBeNull();
    });
    expect(container.querySelector(".four_zero_four_bg")).not.toBeNull();
  });

  it("4. Se cierra al recuperar la conexión", async () => {
    renderPantalla();

    perderConexion();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    await recuperarConexion();

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("5. El botón de reintento vuelve a comprobar la conexión", async () => {
    renderPantalla();

    perderConexion();

    const boton = await screen.findByRole("button", { name: /reintentar conexión/i });
    expect(boton).toBeInTheDocument();

    await act(async () => {
      definirEstadoNavegador(true);
      boton.click();
    });

    expect(mockSonda).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("6. Repite la animación del cavernícola cuando la conexión vuelve a caerse", async () => {
    const { container } = renderPantalla();

    perderConexion();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    const primera = container.querySelector("img.page_404_ilustracion");
    expect(primera).not.toBeNull();

    await recuperarConexion();
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });

    perderConexion();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // La ilustración se vuelve a montar: la secuencia arranca de nuevo.
    const segunda = container.querySelector("img.page_404_ilustracion");
    expect(segunda).not.toBeNull();
    expect(segunda).not.toBe(primera);
  });
});
