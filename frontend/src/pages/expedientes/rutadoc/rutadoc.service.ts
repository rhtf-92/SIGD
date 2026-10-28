import { apiClient } from "../../../api/client";
import { adaptarTrazabilidad, RespuestaRutaDocInvalida, validarRespuesta } from "./rutadoc.adapters";
import { bandejaSchema, detalleSchema, foliacionSchema, slaSchema, uuid, type Filtros } from "./rutadoc.dto";

function url(ruta: string) {
  // Evita duplicar /api al usar baseURL=/api.
  return new URL(`/api/v1/expedientes${ruta}`,
    new URL(apiClient.defaults.baseURL || "/", window.location.origin)).href;
}
async function leer(ruta: string, signal?: AbortSignal, params?: Filtros) {
  const { data } = await apiClient.get<unknown>(url(ruta), { signal, params });
  return data;
}
function rutaId(id: string) {
  if (!uuid.safeParse(id).success) throw new Error("400: UUID de expediente inválido.");
  return `/${encodeURIComponent(id)}`;
}
export const rutaDoc = {
  bandeja: async (filtros: Filtros, signal?: AbortSignal) =>
    validarRespuesta(bandejaSchema, await leer("", signal, filtros)),
  detalle: async (id: string, signal?: AbortSignal) => {
    const dato = validarRespuesta(detalleSchema, await leer(rutaId(id), signal));
    if (dato.idExpediente.toLowerCase() !== id.toLowerCase()) throw new RespuestaRutaDocInvalida();
    return dato;
  },
  resumen: async (id: string, signal?: AbortSignal) => {
    const data = await leer(`${rutaId(id)}/resumen`, signal);
    return data as {
      expediente: ReturnType<typeof detalleSchema.parse>;
      estado: string;
      slaResumen: {
        estado: "VERDE" | "AMARILLO" | "ROJO";
        diasHabilesRestantes: number;
        porcentaje: number;
        fechaLimite: string;
      } | null;
      foliacionResumen: { cantidadDocumentos: number; totalFolios: number };
      tupaResumen: {
        registroVersionId: string;
        codigo: string;
        denominacion: string;
        clasificacion: string;
        plazoDias: number;
        costo: number;
      } | null;
    };
  },
  trazabilidad: async (id: string, signal?: AbortSignal) =>
    adaptarTrazabilidad(await leer(`${rutaId(id)}/trazabilidad`, signal), id),
  foliacion: async (id: string, signal?: AbortSignal) =>
    validarRespuesta(foliacionSchema, await leer(`${rutaId(id)}/foliacion`, signal)),
  sla: async (id: string, signal?: AbortSignal) =>
    validarRespuesta(slaSchema, await leer(`${rutaId(id)}/sla-status`, signal)),
};
