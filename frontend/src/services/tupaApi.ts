import axios from "axios";
import { env } from "../config/env";

export interface TupaVersion {
  version_id: string;
  codigo: string;
  nombre: string;
  fecha_vigencia: string | null;
  uit_vigente: number | string | null;
  resolucion_numero?: string | null;
  resolucion_fecha?: string | null;
  resolucion_pdf_sha256?: string | null;
  tiene_resolucion?: boolean;
  estado: "BORRADOR" | "VIGENTE" | "SUPERSEDIDA";
  version_anterior_id: string | null;
  total_tramites?: number;
  creado_en: string;
}

export interface TupaRequisito {
  requisito_id: string;
  orden: number;
  texto: string;
}

export interface TupaTramite {
  tramite_version_id: string;
  codigo: string;
  denominacion: string;
  rubro: string;
  descripcion: string | null;
  derecho_monto: number | string | null;
  derecho_porcentaje_uit: number | string | null;
  derecho_texto: string | null;
  cuenta_pago: string | null;
  plazo_texto: string | null;
  plazo_dias_habiles: number | null;
  calificacion: string;
  silencio_administrativo: string;
  unidad_recibe: string | null;
  autoridad_resuelve: string | null;
  recursos: string | null;
  base_legal: string | null;
  observaciones: string | null;
  requisitos: TupaRequisito[];
}

export interface TupaBitacora {
  bitacora_id: number;
  accion: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  usuario_id: string | null;
  detalle: Record<string, unknown>;
  fecha_hora: string;
}

interface LoginResponse {
  accessToken: string;
  usuario: { id: string; nombreCompleto: string; rol: string };
}

const http = axios.create({ baseURL: env.apiBaseUrl, timeout: 20000 });
const endpoint = "/api/v1/tupa";

function authorization(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export const tupaApi = {
  async vigente() {
    const { data } = await http.get<{ version: TupaVersion }>(`${endpoint}/vigente`);
    return data.version;
  },
  async listarVigente(filtros: { q: string; rubro: string; pagina: number }) {
    const { data } = await http.get<{
      tramites: TupaTramite[];
      total: number;
      pagina: number;
      porPagina: number;
      rubros: string[];
    }>(`${endpoint}/vigente/tramites`, { params: filtros });
    return data;
  },
  async detalle(codigo: string) {
    const { data } = await http.get<{ tramite: TupaTramite }>(
      `${endpoint}/vigente/tramites/${encodeURIComponent(codigo)}`,
    );
    return data.tramite;
  },
  async login(identificador: string, password: string) {
    const { data } = await http.post<LoginResponse>("/api/v1/auth/login", { identificador, password });
    return data;
  },
  async versiones(token: string) {
    const { data } = await http.get<{ versiones: TupaVersion[] }>(`${endpoint}/versiones`, {
      headers: authorization(token),
    });
    return data.versiones;
  },
  async crearVersion(
    token: string,
    datos: { codigo: string; nombre: string; fecha_vigencia: string; uit_vigente: number; copiarDesdeVersionId?: string },
  ) {
    const { data } = await http.post<{ version: TupaVersion }>(`${endpoint}/versiones`, datos, {
      headers: authorization(token),
    });
    return data.version;
  },
  async tramitesVersion(token: string, versionId: string) {
    const { data } = await http.get<{ tramites: TupaTramite[] }>(
      `${endpoint}/versiones/${versionId}/tramites`,
      { headers: authorization(token) },
    );
    return data.tramites;
  },
  async actualizarTramite(
    token: string,
    versionId: string,
    tramiteId: string,
    datos: Pick<Partial<TupaTramite>, "derecho_monto" | "plazo_texto">,
  ) {
    const { data } = await http.patch<{ tramite: TupaTramite }>(
      `${endpoint}/versiones/${versionId}/tramites/${tramiteId}`,
      datos,
      { headers: authorization(token) },
    );
    return data.tramite;
  },
  async agregarRequisito(token: string, versionId: string, tramiteId: string, orden: number, texto: string) {
    const { data } = await http.post(
      `${endpoint}/versiones/${versionId}/tramites/${tramiteId}/requisitos`,
      { orden, texto },
      { headers: authorization(token) },
    );
    return data;
  },
  async actualizarRequisito(
    token: string,
    versionId: string,
    tramiteId: string,
    requisitoId: string,
    datos: { orden?: number; texto?: string },
  ) {
    const { data } = await http.patch(
      `${endpoint}/versiones/${versionId}/tramites/${tramiteId}/requisitos/${requisitoId}`,
      datos,
      { headers: authorization(token) },
    );
    return data;
  },
  async subirResolucion(token: string, versionId: string, archivo: File) {
    const { data } = await http.put(
      `${endpoint}/versiones/${versionId}/resolucion`,
      archivo,
      {
        headers: {
          ...authorization(token),
          "Content-Type": "application/pdf",
          "X-Nombre-Archivo": archivo.name,
        },
      },
    );
    return data;
  },
  async publicar(
    token: string,
    versionId: string,
    datos: { resolucion_numero: string; resolucion_fecha: string; fecha_vigencia: string },
  ) {
    const { data } = await http.post<{ version: TupaVersion }>(
      `${endpoint}/versiones/${versionId}/publicar`,
      datos,
      { headers: authorization(token) },
    );
    return data.version;
  },
  async bitacora(token: string, versionId: string) {
    const { data } = await http.get<{ bitacora: TupaBitacora[] }>(
      `${endpoint}/versiones/${versionId}/bitacora`,
      { headers: authorization(token) },
    );
    return data.bitacora;
  },
  async descargarResolucion(token: string, versionId: string) {
    const { data } = await http.get<Blob>(`${endpoint}/versiones/${versionId}/resolucion`, {
      headers: authorization(token),
      responseType: "blob",
    });
    return data;
  },
};

export function mensajeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object") {
      const detalle = data as { detail?: unknown; message?: unknown };
      if (typeof detalle.detail === "string" && detalle.detail.trim()) return detalle.detail;
      if (typeof detalle.message === "string" && detalle.message.trim()) return detalle.message;
    }

    switch (error.response?.status) {
      case 401:
        return "La sesión ha caducado o no es válida. Inicie sesión de nuevo.";
      case 403:
        return "Su cuenta no tiene permisos de administrador para gestionar versiones TUPA.";
      case 409:
        return "Conflicto: solo se pueden modificar versiones en borrador; las publicadas son inmutables.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}
