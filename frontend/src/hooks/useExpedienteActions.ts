import { useState } from "react";
import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { crearServicioExpedienteActions } from "../api/expedienteActions";
import { ErrorAccionExpediente } from "../types/expedienteActions";
import type { AccionExpediente, NotificacionExpediente, SolicitudAcumulacion, SolicitudDerivacion, SolicitudObservacion, UseExpedienteActionsOptions } from "../types/expedienteActions";
import { adaptarErrorAccion } from "../utils/expedienteActions";

const servicioSinContratos = crearServicioExpedienteActions();
const bloqueos = new WeakMap<QueryClient, Set<string>>();
const idsDerivacion = (entrada: SolicitudDerivacion) => [entrada.expediente.id];
const idsObservacion = (entrada: SolicitudObservacion) => [entrada.expediente.id];
const idsAcumulacion = (entrada: SolicitudAcumulacion) => [entrada.principal.id, ...entrada.conexos.map((item) => item.id)];

function useAccion<Entrada, Salida>(
  operacion: ((entrada: Entrada) => Promise<Salida>) | undefined,
  ids: (entrada: Entrada) => readonly string[],
  mensajeExito: string,
  opciones: UseExpedienteActionsOptions,
  notificar: (aviso: NotificacionExpediente) => void,
): AccionExpediente<Entrada, Salida> {
  const cliente = useQueryClient();
  const mutacion = useMutation<Salida, ErrorAccionExpediente, Entrada>({
    retry: false,
    mutationFn: async (entrada) => {
      if (!operacion) throw new ErrorAccionExpediente("Esta operación aún no está disponible. Falta completar su integración con el servidor.", "integracion");
      try { return await operacion(entrada); } catch (error) { throw adaptarErrorAccion(error); }
    },
    onSuccess: async (_resultado, entrada) => {
      // Un fallo de revalidación no convierte una escritura confirmada en fallo de envío.
      try {
        const claves = opciones.obtenerClavesAfectadas(ids(entrada));
        await Promise.all(claves.filter((clave) => clave.length > 0).map((queryKey) => cliente.invalidateQueries({ queryKey, exact: true }, { throwOnError: true })));
        notificar({ tipo: "success", mensaje: mensajeExito });
      } catch {
        notificar({ tipo: "aviso", mensaje: `${mensajeExito} No se pudieron actualizar todas las vistas. Actualice los datos sin repetir la operación.` });
      }
    },
    onError: (error) => notificar({ tipo: "error", mensaje: error.message }),
  });

  return {
    disponible: Boolean(operacion), pending: mutacion.isPending, estado: mutacion.status,
    error: mutacion.error, resultado: mutacion.data, restablecer: mutacion.reset,
    ejecutar: async (entrada) => {
      const afectados = ids(entrada);
      let activos = bloqueos.get(cliente);
      if (!activos) { activos = new Set(); bloqueos.set(cliente, activos); }
      if (afectados.some((id) => activos.has(id))) return false;
      afectados.forEach((id) => activos.add(id));
      try { await mutacion.mutateAsync(entrada); return true; }
      catch { return false; }
      finally { afectados.forEach((id) => activos.delete(id)); }
    },
  };
}

export function useExpedienteActions(opciones: UseExpedienteActionsOptions) {
  const [notificacion, setNotificacion] = useState<NotificacionExpediente | null>(null);
  const servicio = opciones.servicio ?? servicioSinContratos;
  function notificar(aviso: NotificacionExpediente) {
    setNotificacion(aviso);
    opciones.notificar?.(aviso);
  }
  const derivacion = useAccion(servicio.derivar, idsDerivacion, "La derivación fue registrada correctamente.", opciones, notificar);
  const observacion = useAccion(servicio.observar, idsObservacion, "La observación fue registrada. El servidor confirmó la suspensión temporal del SLA.", opciones, notificar);
  const acumulacion = useAccion(servicio.acumular, idsAcumulacion, "La acumulación fue registrada correctamente.", opciones, notificar);
  return { derivacion, observacion, acumulacion, notificacion, limpiarNotificacion: () => setNotificacion(null) };
}
