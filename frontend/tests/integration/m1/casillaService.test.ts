import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../../../src/api/client";
import { ApiHttpError } from "../../../src/types/api";
import { casillaService, CASILLA_ENDPOINTS } from "../../../src/services/casillaService";
import type { NotificacionesResponse, EstadisticasCasilla, FiltrosCasilla } from "../../../src/types/casilla";

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
    vi.unstubAllGlobals();
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

  it("descargarDocumento obtiene el enlace temporal autenticado y navega al archivo real", async () => {
    const getSpy = vi.spyOn(apiClient, "get")
      .mockResolvedValueOnce({ data: { downloadUrl: "/api/v1/storage/download/private/acto.pdf" } } as never)
      .mockResolvedValueOnce({ data: { downloadUrl: "https://storage.example.test/acto.pdf?sig=abc" } } as never);
    const windowMock = { location: { assign: vi.fn() } };
    vi.stubGlobal("window", windowMock);

    await casillaService.descargarDocumento("notificacion-1");

    expect(getSpy).toHaveBeenNthCalledWith(1, CASILLA_ENDPOINTS.DESCARGAR_DOCUMENTO("notificacion-1"));
    expect(getSpy).toHaveBeenNthCalledWith(2, "/api/v1/storage/download/private/acto.pdf");
    expect(windowMock.location.assign).toHaveBeenCalledWith("https://storage.example.test/acto.pdf?sig=abc");
  });

  it("descargarAcuse solicita el PDF real al endpoint de la notificación", async () => {
    const pdf = new Blob(["%PDF-real"], { type: "application/pdf" });
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValueOnce({ data: pdf } as never);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:acuse");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await casillaService.descargarAcuse("notificacion-2");

    expect(getSpy).toHaveBeenCalledWith(CASILLA_ENDPOINTS.DESCARGAR_ACUSE("notificacion-2"), { responseType: "blob" });
    expect(click).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledWith(pdf);
  });

  it("ya no expone resetMockData (el mock fue erradicado por completo)", () => {
    expect((casillaService as Record<string, unknown>).resetMockData).toBeUndefined();
  });
});
