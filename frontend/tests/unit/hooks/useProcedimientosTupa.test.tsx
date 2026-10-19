import "@testing-library/jest-dom/vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { useProcedimientosTupa } from "../../../src/hooks/useProcedimientosTupa";
import { apiClient } from "@/api/client";
import { ApiHttpError } from "../../../src/types/api";
import type { ApiProblemDetails } from "../../../src/types/api";

const REGISTRO_VERSION_CERTIFICADO = "11111111-1111-4111-8111-111111111111";

const CATALOGO_TUPA_API = [
  {
    registroVersionId: REGISTRO_VERSION_CERTIFICADO,
    codigo: "01",
    denominacion: "Certificado de estudios",
    requisitos: ["Solicitud FUT"],
    monto: "S/. 11.00 por semestre",
    fuente: "TUPA 2026",
  },
];

function problema(status: number): ApiProblemDetails {
  return {
    type: "https://sigd.iestpsuiza.edu.pe/errors/catalogo",
    title: "Error de catálogo",
    status,
    detail: "Fallo simulado del catálogo TUPA.",
    instance: "/api/v1/tramites/procedimientos-tupa",
    code: "CATALOGO_ERROR",
    category: "System",
    correlationId: "test-correlation",
    retryable: true,
  };
}

describe("useProcedimientosTupa — integración visual TUPA (casos 1-3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Caso 1: carga el catálogo real desde la API y expone los procedimientos", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: { data: CATALOGO_TUPA_API } } as never);

    const { result } = renderHook(() => useProcedimientosTupa());

    await waitFor(() => expect(result.current.estado).toBe("listo"));

    expect(result.current.procedimientos).toHaveLength(1);
    expect(result.current.procedimientos[0].registroVersionId).toBe(
      REGISTRO_VERSION_CERTIFICADO,
    );
    expect(result.current.procedimientos[0].codigo).toBe("01");
    expect(result.current.estaVacio).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("Caso 2: marca el catálogo como vacío cuando la API responde sin registros", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: { data: [] } } as never);

    const { result } = renderHook(() => useProcedimientosTupa());

    await waitFor(() => expect(result.current.estado).toBe("listo"));

    expect(result.current.procedimientos).toHaveLength(0);
    expect(result.current.estaVacio).toBe(true);
  });

  it("Caso 3: clasifica un error de servidor (500) y NO hace fallback a datos mock", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new ApiHttpError(problema(500)));

    const { result } = renderHook(() => useProcedimientosTupa());

    await waitFor(() => expect(result.current.estado).toBe("error"));

    expect(result.current.error?.tipo).toBe("servidor");
    expect(result.current.procedimientos).toHaveLength(0);
    expect(result.current.estaVacio).toBe(false);
  });

  it("Caso 3b: clasifica un error de autorización (403)", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new ApiHttpError(problema(403)));

    const { result } = renderHook(() => useProcedimientosTupa());

    await waitFor(() => expect(result.current.estado).toBe("error"));

    expect(result.current.error?.tipo).toBe("autorizacion");
  });
});
