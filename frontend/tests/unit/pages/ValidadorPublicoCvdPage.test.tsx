import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/api/client", () => ({
  apiClient: { get: vi.fn() },
}));

vi.mock("../../../src/config/env", () => ({
  env: { enableMocks: false },
}));

import { apiClient } from "../../../src/api/client";
import { CVD_ALTERADO, CVD_VALIDO } from "../../../src/hooks/useCvdPublicVerification";
import ValidadorPublicoCvdPage from "../../../src/pages/validador/ValidadorPublicoCvdPage";

const get = vi.mocked(apiClient.get);

function wrapper({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe("ValidadorPublicoCvdPage — botones de ejemplo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({
      data: {
        esValido: true,
        cvd: CVD_VALIDO,
        documento: null,
        selloTiempoTsa: "2026-09-05T16:42:16.000Z",
        mensajeSeguridad: "Documento íntegro y verificado.",
      },
    });
  });

  it.each([CVD_VALIDO, CVD_ALTERADO])(
    "completa el campo y verifica el ejemplo %s",
    async (ejemplo) => {
      render(<ValidadorPublicoCvdPage />, { wrapper });

      fireEvent.click(screen.getByRole("button", { name: ejemplo }));

      await waitFor(() => {
        expect(get).toHaveBeenCalledWith(`/api/v1/validador/cvd/${ejemplo}`);
      });
      expect(screen.getByLabelText("Código CVD del documento")).toHaveValue(ejemplo);
      expect(screen.queryByText(/Formato inválido/)).not.toBeInTheDocument();
    },
  );

  it("enmascara un CVD escrito en minúsculas y lo verifica con Enter", async () => {
    render(<ValidadorPublicoCvdPage />, { wrapper });
    const campo = screen.getByLabelText("Código CVD del documento");

    fireEvent.change(campo, { target: { value: "cvd-2026-rd-000413-alte" } });
    expect(campo).toHaveValue(CVD_ALTERADO);

    fireEvent.keyDown(campo, { key: "Enter" });

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(`/api/v1/validador/cvd/${CVD_ALTERADO}`);
    });
    expect(screen.queryByText(/Formato inválido/)).not.toBeInTheDocument();
  });
});
