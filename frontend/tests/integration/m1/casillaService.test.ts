import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "../../../src/api/client";
import { ApiHttpError } from "../../../src/types/api";
import { casillaService, CASILLA_ENDPOINTS } from "../../../src/services/casillaService";
import type { NotificacionesResponse, EstadisticasCasilla, FiltrosCasilla, Notificacion, AcuseNotificacion } from "../../../src/types/casilla";

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
  afterEach(() => vi.unstubAllGlobals());

  const notificacion = { id: 'notificacion-propia', actoAdministrativo: {
    nombreArchivoPdf: 'documento-original.pdf',
  } } as Notificacion;
  const acuse = { idAcuse: 'acuse-propio', idNotificacion: notificacion.id } as AcuseNotificacion;
  const urlPdf = 'https://almacen-prueba.invalid/documento.pdf?firma=sintetica';

  function prepararDescarga(bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55])) {
    const get = vi.spyOn(apiClient, 'get');
    const fetchArchivo = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer });
    const crearUrl = vi.fn().mockReturnValue('blob:prueba');
    const revocarUrl = vi.fn();
    vi.stubGlobal('fetch', fetchArchivo);
    vi.stubGlobal('URL', Object.assign(class extends URL {}, {
      createObjectURL: crearUrl, revokeObjectURL: revocarUrl,
    }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    return { get, fetchArchivo, crearUrl, revocarUrl, click, bytes };
  }

  it('descarga los bytes reales después de autorizar Casilla y Storage, sin enviar JWT a S3', async () => {
    const p = prepararDescarga();
    p.get.mockResolvedValueOnce({ data: { downloadUrl: '/api/v1/storage/download/pruebas/archivo.pdf' } } as never)
      .mockResolvedValueOnce({ data: { downloadUrl: urlPdf } } as never);
    await casillaService.descargarDocumento(notificacion);
    expect(p.get.mock.calls).toEqual([
      [CASILLA_ENDPOINTS.DESCARGAR_DOCUMENTO(notificacion.id)],
      ['/api/v1/storage/download/pruebas/archivo.pdf'],
    ]);
    expect(p.fetchArchivo).toHaveBeenCalledWith(urlPdf, { credentials: 'omit' });
    expect(p.crearUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(p.crearUrl.mock.calls[0][0].size).toBe(p.bytes.byteLength);
    expect(p.click).toHaveBeenCalledOnce();
    expect(p.click.mock.instances[0]).toHaveProperty('download', 'documento-original.pdf');
    expect(p.revocarUrl).toHaveBeenCalledWith('blob:prueba');
  });

  it('solicita el acuse por su notificación y conserva el PDF devuelto', async () => {
    const p = prepararDescarga();
    p.get.mockResolvedValueOnce({ data: { downloadUrl: urlPdf } } as never);
    await casillaService.descargarAcuse(acuse);
    expect(p.get).toHaveBeenCalledWith(CASILLA_ENDPOINTS.DESCARGAR_ACUSE(notificacion.id));
    expect(p.click.mock.instances[0]).toHaveProperty('download', 'ACUSE_LEGAL_acuse-propio.pdf');
  });

  it('propaga un rechazo de autorización sin fabricar un documento', async () => {
    const p = prepararDescarga();
    const rechazo = new Error('Acceso denegado');
    p.get.mockRejectedValueOnce(rechazo);
    await expect(casillaService.descargarDocumento(notificacion)).rejects.toBe(rechazo);
    expect(p.fetchArchivo).not.toHaveBeenCalled();
    expect(p.crearUrl).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', '//servidor-ajeno.invalid/a', '', undefined])('rechaza URL inválida %s sin navegar', async downloadUrl => {
    const p = prepararDescarga();
    p.get.mockResolvedValueOnce({ data: { downloadUrl } } as never);
    await expect(casillaService.descargarDocumento(notificacion)).rejects.toThrow();
    expect(p.fetchArchivo).not.toHaveBeenCalled();
    expect(p.click).not.toHaveBeenCalled();
  });

  it('no guarda respuestas de error del almacenamiento como PDF', async () => {
    const p = prepararDescarga();
    p.get.mockResolvedValueOnce({ data: { downloadUrl: urlPdf } } as never);
    p.fetchArchivo.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(casillaService.descargarDocumento(notificacion)).rejects.toThrow();
    expect(p.crearUrl).not.toHaveBeenCalled();
  });

  it('rechaza contenido que no sea PDF, aunque la respuesta sea exitosa', async () => {
    const p = prepararDescarga(new TextEncoder().encode('Documento no encontrado'));
    p.get.mockResolvedValueOnce({ data: { downloadUrl: urlPdf } } as never);
    await expect(casillaService.descargarDocumento(notificacion)).rejects.toThrow();
    expect(p.crearUrl).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce({ data: { idNotificacion: notificacion.id, estado: 'LEIDO', leidoEn: '2026-10-19T12:00:00Z' } } as never);
    const actualizada = { ...notificacion, estado: 'LEIDO', fechaLecturaIso: '2026-10-19T12:00:00Z' };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: actualizada } as never);

    expect(await casillaService.marcarComoLeido("NOT-2026-000184")).toEqual(actualizada);

    expect(patchSpy).toHaveBeenCalledWith(
      CASILLA_ENDPOINTS.MARCAR_LEIDO("NOT-2026-000184"),
    );
    expect(getSpy).toHaveBeenCalledWith(CASILLA_ENDPOINTS.DETALLE_NOTIFICACION('NOT-2026-000184'));
  });

  it('no consulta ni presenta una lectura exitosa si el PATCH es rechazado', async () => {
    const error = new Error('Lectura rechazada');
    vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(error);
    const get = vi.spyOn(apiClient, 'get');
    await expect(casillaService.marcarComoLeido(notificacion.id)).rejects.toBe(error);
    expect(get).not.toHaveBeenCalled();
  });

  it("ya no expone resetMockData (el mock fue erradicado por completo)", () => {
    expect((casillaService as Record<string, unknown>).resetMockData).toBeUndefined();
  });
});
