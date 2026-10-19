import "@testing-library/jest-dom/vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { useProcedimientosTupa } from "@/hooks/useProcedimientosTupa";
import { ApiHttpError, type ApiProblemDetails } from "@/types/api";

const REGISTRO_VERSION_ID = "11111111-1111-4111-8111-111111111111";

const procedimientoReal = {
  registroVersionId: REGISTRO_VERSION_ID,
  codigoExterno: null,
  codigo: null,
  denominacion: "Certificado de estudios",
  monto: "S/. 11.00 por semestre",
  requisitos: null,
  fuente: {
    nombre: "TUPA_2026_IESTP_Suiza.pdf",
    documentoSha256: "377DD8E14B8806F2030B5374120AB9B4FE17640BB98086E10C1A9A4431A33622",
    pagina: 5,
    referenciaFila: "p5-fila-20",
  },
  pagina: 5,
  revision: 1,
  vigencia: { desde: null, hasta: null },
  vigenciaDesde: null,
  vigenciaHasta: null,
  version: {
    etiqueta: "VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1",
    revision: 1,
    vigenciaDesde: null,
    vigenciaHasta: null,
  },
  estadoValidacion: "APROBADO",
  estado: "APROBADO",
  referenciaAprobacion: "VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1",
  id: REGISTRO_VERSION_ID,
};

function problema(status: number): ApiProblemDetails {
  return {
    type: "https://sigd.iestpsuiza.edu.pe/errors/catalogo",
    title: "Error de catalogo",
    status,
    detail: "Fallo simulado del catalogo TUPA.",
    instance: "/api/v1/tramites/tupa",
    code: "CATALOGO_ERROR",
    category: "System",
    correlationId: "test-correlation",
    retryable: true,
  };
}

describe("useProcedimientosTupa - contrato TUPA versionado", () => {
  afterEach(() => vi.restoreAllMocks());

  it("consulta el endpoint definitivo y conserva registroVersionId, codigo null y objetos de procedencia", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: [procedimientoReal] } as never);

    const { result } = renderHook(() => useProcedimientosTupa());
    expect(result.current.estado).toBe("cargando");
    await waitFor(() => expect(result.current.estado).toBe("listo"));

    expect(get).toHaveBeenCalledWith("/api/v1/tramites/tupa", {
      signal: expect.any(AbortSignal),
    });
    expect(result.current.procedimientos).toEqual([
      expect.objectContaining({
        registroVersionId: REGISTRO_VERSION_ID,
        codigo: null,
        denominacion: "Certificado de estudios",
        requisitos: [],
        fuente: procedimientoReal.fuente,
        version: procedimientoReal.version,
        vigencia: null,
      }),
    ]);
  });

  it("descarta una fila sin denominacion obligatoria", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: [{ ...procedimientoReal, denominacion: "   " }],
    } as never);

    const { result } = renderHook(() => useProcedimientosTupa());
    await waitFor(() => expect(result.current.estado).toBe("listo"));
    expect(result.current.procedimientos).toEqual([]);
    expect(result.current.estaVacio).toBe(true);
  });

  it("descarta una fila con registroVersionId que no es UUID", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: [{ ...procedimientoReal, registroVersionId: "TUPA-001" }],
    } as never);

    const { result } = renderHook(() => useProcedimientosTupa());
    await waitFor(() => expect(result.current.estado).toBe("listo"));
    expect(result.current.procedimientos).toEqual([]);
  });

  it("marca vacio cuando la API devuelve un arreglo sin registros", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] } as never);
    const { result } = renderHook(() => useProcedimientosTupa());
    await waitFor(() => expect(result.current.estado).toBe("listo"));
    expect(result.current.estaVacio).toBe(true);
  });

  it.each([
    [401, "autorizacion"],
    [403, "autorizacion"],
    [500, "servidor"],
  ] as const)("clasifica HTTP %s como %s sin fallback", async (status, tipo) => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new ApiHttpError(problema(status)));
    const { result } = renderHook(() => useProcedimientosTupa());
    await waitFor(() => expect(result.current.estado).toBe("error"));
    expect(result.current.error?.tipo).toBe(tipo);
    expect(result.current.procedimientos).toEqual([]);
  });

  it("clasifica un fallo de red y permite reintentar", async () => {
    const get = vi
      .spyOn(apiClient, "get")
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce({ data: [procedimientoReal] } as never);
    const { result } = renderHook(() => useProcedimientosTupa());
    await waitFor(() => expect(result.current.error?.tipo).toBe("red"));
    await act(async () => result.current.recargar());
    await waitFor(() => expect(result.current.estado).toBe("listo"));
    expect(get).toHaveBeenCalledTimes(2);
  });
});
