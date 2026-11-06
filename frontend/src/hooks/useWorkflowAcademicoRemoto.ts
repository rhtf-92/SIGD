import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import type {
  EstadoEtapaWorkflow,
  EtapaWorkflowVisual,
  WorkflowAcademico,
} from "../types/workflowAcademico";
import { requisitosPendientesDe } from "./useWorkflowAcademico";

type Comando =
  | { transicion: "tomar_revision" }
  | { transicion: "aprobar_etapa" }
  | { transicion: "observar"; observacion: string }
  | { transicion: "subsanar" }
  | { transicion: "reanudar" }
  | { transicion: "firmar" }
  | { transicion: "anular" }
  | { transicion: "marcar_requisito"; etapaId: number; requisitoId: number; cumplido: boolean };

function etapasVisuales(workflow: WorkflowAcademico): EtapaWorkflowVisual[] {
  const posicionActual = workflow.etapas.findIndex(
    (etapa) => etapa.idEtapa === workflow.etapaActualId,
  );
  return workflow.etapas.map((etapa, posicion) => {
    let estado: EstadoEtapaWorkflow;
    if (workflow.estado === "RESUELTO") estado = "COMPLETADA";
    else if (workflow.estado === "ANULADO") estado = posicion <= posicionActual ? "COMPLETADA" : "BLOQUEADA";
    else if (posicion === posicionActual) estado = workflow.estado === "OBSERVADO" ? "OBSERVADA" : "EN_CURSO";
    else estado = posicion < posicionActual ? "COMPLETADA" : "BLOQUEADA";
    return { ...etapa, estado };
  });
}

function mensajeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "No fue posible sincronizar la FSM académica con el backend.";
}

export function useWorkflowAcademicoRemoto(habilitado = true) {
  const queryClient = useQueryClient();
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [errorCliente, setErrorCliente] = useState<string | null>(null);

  const lista = useQuery({
    queryKey: queryKeys.flujos.titulacion.lista,
    queryFn: async () => (await apiClient.get<WorkflowAcademico[]>("/api/v1/flujos/titulacion")).data,
    enabled: habilitado,
    staleTime: 10_000,
  });
  const idActivo = seleccionado ?? lista.data?.[0]?.idTramite ?? null;
  const detalle = useQuery({
    queryKey: queryKeys.flujos.titulacion.detalle(idActivo ?? "pendiente"),
    queryFn: async () => (
      await apiClient.get<WorkflowAcademico>(`/api/v1/flujos/titulacion/${idActivo}`)
    ).data,
    enabled: habilitado && idActivo !== null,
    staleTime: 5_000,
  });

  const mutacion = useMutation({
    mutationFn: async (comando: Comando) => (
      await apiClient.post<WorkflowAcademico>(
        `/api/v1/flujos/titulacion/${idActivo}/transiciones`,
        comando,
      )
    ).data,
    onSuccess: (workflow) => {
      setErrorCliente(null);
      queryClient.setQueryData(queryKeys.flujos.titulacion.detalle(workflow.idTramite), workflow);
      queryClient.setQueryData<WorkflowAcademico[]>(queryKeys.flujos.titulacion.lista, (actual) =>
        actual?.map((item) => item.idTramite === workflow.idTramite ? workflow : item),
      );
    },
    onError: (error) => setErrorCliente(mensajeError(error)),
  });

  const workflow = detalle.data ?? null;
  const estado = workflow?.estado ?? "BORRADOR";
  const pendientes = useMemo(
    () => workflow ? requisitosPendientesDe(workflow, workflow.etapaActualId) : [],
    [workflow],
  );
  const enviar = useCallback((comando: Comando) => {
    setErrorCliente(null);
    mutacion.mutate(comando);
  }, [mutacion]);

  return {
    workflow,
    etapas: workflow ? etapasVisuales(workflow) : [],
    estado,
    errorFsm: errorCliente ?? (lista.error ? mensajeError(lista.error) : detalle.error ? mensajeError(detalle.error) : null),
    requisitosPendientesEtapaActual: pendientes,
    expedientesDisponibles: lista.data ?? [],
    puedeTomar: estado === "EN_TRAMITE" && !mutacion.isPending,
    puedeAprobar: estado === "EN_REVISION" && pendientes.length === 0 && !mutacion.isPending,
    puedeObservar: estado === "EN_REVISION" && !mutacion.isPending,
    puedeSubsanar: estado === "OBSERVADO" && !mutacion.isPending,
    puedeReanudar: estado === "SUBSANADO" && !mutacion.isPending,
    puedeFirmar: estado === "PARA_FIRMA" && !mutacion.isPending,
    puedeAnular: (estado === "EN_REVISION" || estado === "OBSERVADO") && !mutacion.isPending,
    tomarEnRevision: () => enviar({ transicion: "tomar_revision" }),
    cargarExpediente: (idTramite: number) => {
      setErrorCliente(null);
      setSeleccionado(idTramite);
    },
    aprobarEtapaActual: () => enviar({ transicion: "aprobar_etapa" }),
    observarEtapaActual: (observacion: string) => enviar({ transicion: "observar", observacion }),
    subsanar: () => enviar({ transicion: "subsanar" }),
    reanudarRevision: () => enviar({ transicion: "reanudar" }),
    firmarDocumento: () => enviar({ transicion: "firmar" }),
    anularTramite: () => enviar({ transicion: "anular" }),
    marcarRequisito: (etapaId: number, requisitoId: number, cumplido: boolean) =>
      enviar({ transicion: "marcar_requisito", etapaId, requisitoId, cumplido }),
    cargando: lista.isLoading || (idActivo !== null && detalle.isLoading),
    conectado: Boolean(workflow),
  };
}

