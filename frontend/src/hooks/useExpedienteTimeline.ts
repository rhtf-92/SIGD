import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { BITACORA_FIXTURE } from "../data/expedientesFixtures";
import type { BitacoraEventoExpediente } from "../types/trazabilidadExpediente";

const RETARDO_MOCK_MS = 300;

const usarMocks = import.meta.env.VITE_ENABLE_MOCKS === "true";

async function obtenerTimelineMock(
  expedienteId: string,
): Promise<BitacoraEventoExpediente[]> {
  await new Promise((resolve) => setTimeout(resolve, RETARDO_MOCK_MS));
  return BITACORA_FIXTURE[expedienteId] ?? [];
}

function normalizarTipoEvento(evento: string): BitacoraEventoExpediente["tipoEvento"] {
  const normalizado = (evento || "").toUpperCase();
  if (normalizado === "DERIVACION") return "DERIVACION";
  if (normalizado === "RECEPCION" || normalizado === "CREAR") return "RECEPCION";
  if (normalizado === "OBSERVACION" || normalizado === "OBSERVAR") return "OBSERVACION";
  if (normalizado === "SUBSANACION" || normalizado === "CORRECCION") return "SUBSANACION";
  if (normalizado === "NOTIFICACION" || normalizado === "NOTIFICAR") return "NOTIFICACION";
  if (normalizado === "ARCHIVADO" || normalizado === "ARCHIVAR" || normalizado === "CIERRE") return "ARCHIVADO";
  if (normalizado === "DESARCHIVADO") return "DESARCHIVADO";
  if (normalizado === "VERSION_ADJUNTA") return "VERSION_ADJUNTA";
  return "RECEPCION";
}

function mapearActuacionAEvento(
  actuacion: any,
  expedienteId: string,
  indice: number,
): BitacoraEventoExpediente {
  if (actuacion.eventoId && actuacion.tipoEvento && actuacion.timestamp) {
    return actuacion as BitacoraEventoExpediente;
  }

  const id = actuacion.movimientoId || actuacion.idMovimiento || `act-${indice + 1}`;
  const fecha = actuacion.fechaHora || actuacion.timestamp || new Date().toISOString();
  const evento = actuacion.evento || "RECEPCION";
  const estAnt = actuacion.estadoAnterior;
  const estNuevo = actuacion.estadoNuevo || actuacion.estado_nuevo || "EN_TRAMITE";
  const datos = actuacion.datosAsociados || actuacion.datos || {};
  const area = actuacion.areaNombre || datos.areaNombre || "Mesa de Partes";
  const usuario = actuacion.usuarioNombre || actuacion.usuario || "Operador SIGD";
  const resumen = datos.resumen || actuacion.resumen || (actuacion.proveido ? String(actuacion.proveido) : `Movimiento procesal: ${evento}`);

  return {
    eventoId: String(id),
    expedienteId,
    tipoEvento: normalizarTipoEvento(evento),
    timestamp: fecha,
    usuarioId: actuacion.usuarioOperadorId || "00000000-0000-0000-0000-000000000000",
    usuarioNombre: String(usuario),
    areaNombre: String(area),
    estadoAnterior: estAnt ? String(estAnt) : undefined,
    estadoNuevo: String(estNuevo),
    descripcionDetallada: String(resumen),
    hashTransaccion: actuacion.movimientoId ? `tx-${actuacion.movimientoId.slice(0, 16)}` : `hash-${Date.parse(fecha)}`,
  };
}

async function obtenerTimelineApi(
  expedienteId: string,
): Promise<BitacoraEventoExpediente[]> {
  const { data } = await apiClient.get<unknown>(
    `/api/v1/expedientes/${encodeURIComponent(expedienteId)}/trazabilidad`,
  );

  if (Array.isArray(data)) {
    return data.map((item, idx) => mapearActuacionAEvento(item, expedienteId, idx));
  }

  if (data && typeof data === "object") {
    const obj = data as { actuaciones?: unknown[]; movimientos?: unknown[] };
    const lista = Array.isArray(obj.actuaciones)
      ? obj.actuaciones
      : Array.isArray(obj.movimientos)
        ? obj.movimientos
        : [];
    return lista.map((item, idx) => mapearActuacionAEvento(item, expedienteId, idx));
  }

  return [];
}

/**
 * Trae la bitácora inmutable (Timeline) de un expediente específico, ordenada
 * cronológicamente. Modo de solo lectura: no expone ninguna mutación.
 */
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
