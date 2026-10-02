import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../../api/client";
import { ApiHttpError } from "../../types/api";
import { casillaService, CASILLA_ENDPOINTS } from "../../services/casillaService";
import type { NotificacionesResponse, EstadisticasCasilla, FiltrosCasilla } from "../../types/casilla";

describe("casillaService (ENT-M01-05): consumo HTTP real y manejo de errores RFC 7807", () => {
  const filtrosBase: FiltrosCasilla = {
    tipo: "TODOS",
    estado: "TODOS",
    fechaInicio: "",
    fechaFin: "",
    busqueda: "",
    page: 1,
    limit: 5,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getNotificaciones llama a GET sobre el endpoint canónico con los parámetros de filtro", async () => {
    const respuestaEsperada: NotificacionesResponse = {
      data: [],
      meta: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 5,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    const getSpy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValueOnce({ data: respuestaEsperada } as never);

    const resultado = await casillaService.getNotificaciones(filtrosBase);

    expect(getSpy).toHaveBeenCalledWith(
      CASILLA_ENDPOINTS.LISTAR_NOTIFICACIONES,
      expect.objectContaining({
        params: expect.objectContaining({ page: 1, limit: 5 }),
      }),
    );
    expect(resultado).toEqual(respuestaEsperada);
  });

  it("getNotificaciones NO cae a datos simulados: propaga el error si la petición HTTP falla", async () => {
    const errorHttp = new ApiHttpError({
      type: "about:blank",
      title: "No encontrado",
      status: 404,
      detail: "Recurso no disponible",
      instance: CASILLA_ENDPOINTS.LISTAR_NOTIFICACIONES,
      code: "ERR_HTTP_404",
      category: "Business",
      correlationId: "test-correlation-id",
      retryable: false,
    });

    vi.spyOn(apiClient, "get").mockRejectedValueOnce(errorHttp);

    await expect(casillaService.getNotificaciones(filtrosBase)).rejects.toBe(errorHttp);
  });

  it("getEstadisticas llama al endpoint de estadísticas y retorna el dato tal cual", async () => {
    const estadisticas: EstadisticasCasilla = {
      total: 10,
      noLeidos: 3,
      leidos: 5,
      notificados: 2,
      urgentes: 1,
    };

    const getSpy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValueOnce({ data: estadisticas } as never);

    const resultado = await casillaService.getEstadisticas();

    expect(getSpy).toHaveBeenCalledWith(CASILLA_ENDPOINTS.ESTADISTICAS);
    expect(resultado).toEqual(estadisticas);
  });

  it("marcarComoLeido usa PATCH sobre el endpoint de lectura con el id correcto", async () => {
    const patchSpy = vi
      .spyOn(apiClient, "patch")
      .mockResolvedValueOnce({ data: {} } as never);

    await casillaService.marcarComoLeido("NOT-2026-000184");

    expect(patchSpy).toHaveBeenCalledWith(
      CASILLA_ENDPOINTS.MARCAR_LEIDO("NOT-2026-000184"),
    );
  });

  it("ya no expone resetMockData (el mock fue erradicado por completo)", () => {
    expect((casillaService as Record<string, unknown>).resetMockData).toBeUndefined();
  });
});