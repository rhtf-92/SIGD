import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { BITACORA_FIXTURE } from "../data/expedientesFixtures";
import type {
  BitacoraEventoExpediente,
  TipoEventoBitacora,
} from "../types/trazabilidadExpediente";

const RETARDO_MOCK_MS = 300;

const usarMocks = import.meta.env.VITE_ENABLE_MOCKS === "true";

interface ActuacionApi {
  movimientoId?: string;
  fechaHora?: string;
  estadoAnterior?: string;
  evento?: string;
  estadoNuevo?: string;
  usuarioOperadorId?: string;
  areaDestinoId?: string | null;
  remitente?: string | null;
  destinatario?: string | null;
  proveido?: unknown;
  datosAsociados?: Record<string, unknown>;
  hashTransaccion?: string;
}

interface RespuestaTrazabilidadApi {
  expedienteId?: string;
  actuaciones?: ActuacionApi[];
}

const MAPA_EVENTOS: Record<string, TipoEventoBitacora> = {
  RECEPCION: "RECEPCION",
  DERIVACION: "DERIVACION",
  OBSERVACION: "OBSERVACION",
  CORRECCION: "SUBSANACION",
  CIERRE: "ARCHIVADO",
};

function texto(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number") return String(valor);
  return "";
}

function aEvento(
  actuacion: ActuacionApi,
  expedienteId: string,
): BitacoraEventoExpediente {
  const estadoAnterior = texto(actuacion.estadoAnterior);
  const estadoNuevo = texto(actuacion.estadoNuevo);
  const evento = texto(actuacion.evento).toUpperCase();
  const remitente = texto(actuacion.remitente);
  const destinatario = texto(actuacion.destinatario);
  const detalles = [
    texto(actuacion.proveido),
    remitente && `Remitente: ${remitente}`,
    destinatario && `Destinatario: ${destinatario}`,
  ].filter(Boolean);

  return {
    eventoId: texto(actuacion.movimientoId),
    expedienteId,
    tipoEvento: MAPA_EVENTOS[evento] ?? "OTRO",
    timestamp: texto(actuacion.fechaHora),
    usuarioId: texto(actuacion.usuarioOperadorId),
    usuarioNombre:
      texto(actuacion.datosAsociados?.usuarioNombre) ||
      texto(actuacion.usuarioOperadorId) ||
      "Sistema",
    areaNombre: texto(actuacion.areaDestinoId) || "Área no registrada",
    estadoAnterior: estadoAnterior || undefined,
    estadoNuevo,
    descripcionDetallada:
      detalles.join(" · ") ||
      [evento, estadoAnterior && `→ ${estadoNuevo}`].filter(Boolean).join(" "),
    hashTransaccion: texto(actuacion.hashTransaccion),
  };
}

async function obtenerTimelineMock(
  expedienteId: string,
): Promise<BitacoraEventoExpediente[]> {
  await new Promise((resolve) => setTimeout(resolve, RETARDO_MOCK_MS));
  return BITACORA_FIXTURE[expedienteId] ?? [];
}

async function obtenerTimelineApi(
  expedienteId: string,
): Promise<BitacoraEventoExpediente[]> {
  const { data } = await apiClient.get<
    RespuestaTrazabilidadApi | BitacoraEventoExpediente[]
  >(`/api/v1/expedientes/${expedienteId}/trazabilidad`);

  if (Array.isArray(data)) return data;

  const actuaciones = Array.isArray(data?.actuaciones) ? data.actuaciones : [];
  return actuaciones.map((actuacion) =>
    aEvento(actuacion, data?.expedienteId ?? expedienteId),
  );
}

export function useExpedienteTimeline(expedienteId: string | undefined) {
  return useQuery({
    queryKey: ["expedientes", expedienteId, "timeline"],
    queryFn: () =>
      expedienteId
        ? usarMocks
          ? obtenerTimelineMock(expedienteId)
          : obtenerTimelineApi(expedienteId)
        : Promise.resolve([]),
    enabled: Boolean(expedienteId),
    staleTime: 30_000,
    select: (eventos) =>
      [...eventos].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
  });
}
