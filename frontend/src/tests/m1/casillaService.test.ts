import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock("../../api/client", () => ({ apiClient: http }));

import { apiClient } from "../../api/client";
import { CASILLA_ENDPOINTS, casillaService } from "../../services/casillaService";
import { acuse, filtrosIniciales, notificacion } from "./fixtures";

describe("casillaService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("consulta notificaciones con filtros omitidos o establecidos", async () => {
    const response = { data: [], meta: { totalItems: 0 } };
    http.get.mockResolvedValue({ data: response });
    await expect(casillaService.getNotificaciones(filtrosIniciales)).resolves.toEqual(response);
    expect(apiClient.get).toHaveBeenCalledWith(CASILLA_ENDPOINTS.LISTAR_NOTIFICACIONES, {
      params: {
        page: 1,
        limit: 5,
        tipo: undefined,
        estado: undefined,
        fechaInicio: undefined,
        fechaFin: undefined,
        busqueda: undefined,
      },
    });

    const filtros = {
      ...filtrosIniciales,
      tipo: "OFICIO" as const,
      estado: "LEIDO" as const,
      fechaInicio: "2026-01-01",
      fechaFin: "2026-01-31",
      busqueda: "expediente",
      page: 2,
      limit: 10,
    };
    await casillaService.getNotificaciones(filtros);
    expect(apiClient.get).toHaveBeenLastCalledWith(CASILLA_ENDPOINTS.LISTAR_NOTIFICACIONES, {
      params: {
        page: 2,
        limit: 10,
        tipo: "OFICIO",
        estado: "LEIDO",
        fechaInicio: "2026-01-01",
        fechaFin: "2026-01-31",
        busqueda: "expediente",
      },
    });
  });

  it("preserva los errores HTTP y llama a detalle y lectura", async () => {
    const failure = new Error("HTTP 503");
    http.get.mockRejectedValueOnce(failure).mockResolvedValueOnce({ data: notificacion });
    await expect(casillaService.getNotificaciones(filtrosIniciales)).rejects.toBe(failure);
    await expect(casillaService.getNotificacionById("notif-1")).resolves.toEqual(notificacion);

    http.patch.mockResolvedValue({ data: notificacion });
    await expect(casillaService.marcarComoLeido("notif-1")).resolves.toEqual(notificacion);
    expect(http.patch).toHaveBeenCalledWith(CASILLA_ENDPOINTS.MARCAR_LEIDO("notif-1"));
  });

  it("envía los metadatos al generar el acuse y devuelve el contrato del backend", async () => {
    const response = { success: true, message: "ok", data: acuse, notificacionActualizada: notificacion };
    http.post.mockResolvedValue({ data: response });
    await expect(
      casillaService.generarAcuseLegal("notif-1", { metadataCliente: { navegador: "Pruebas" } }),
    ).resolves.toEqual(response);
    expect(http.post).toHaveBeenCalledWith(
      CASILLA_ENDPOINTS.GENERAR_ACUSE("notif-1"),
      expect.objectContaining({
        notificacionId: "notif-1",
        confirmacionAdministrado: true,
        metadataCliente: expect.objectContaining({ navegador: "Pruebas" }),
      }),
    );

    http.get.mockResolvedValue({ data: { total: 1 } });
    await expect(casillaService.getEstadisticas()).resolves.toEqual({ total: 1 });
    expect(http.get).toHaveBeenCalledWith(CASILLA_ENDPOINTS.ESTADISTICAS);
  });

  it("genera descargas de documento y acuse", () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    casillaService.descargarDocumento(notificacion);
    casillaService.descargarDocumento({
      ...notificacion,
      actoAdministrativo: {
        ...notificacion.actoAdministrativo,
        nombreArchivoPdf: "",
        textoCompleto: "",
      },
    });
    casillaService.descargarAcuse(acuse);
    expect(createObjectURL).toHaveBeenCalledTimes(3);
    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
    expect(click).toHaveBeenCalledTimes(3);
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });
});
