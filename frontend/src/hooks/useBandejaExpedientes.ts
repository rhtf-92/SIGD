import { useEffect } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { env } from "../config/env";
import { EXPEDIENTES_FIXTURE } from "../data/expedientesFixtures";
import { ORDEN_PESTANAS_BANDEJA, type EstadoFlujoExpediente, type ExpedienteFilaBandeja, type ExpedienteSGD } from "../types/expediente";

/** Retardo de red simulado en modo mock, conforme al estándar de la arquitectura (300 ms). */
const RETARDO_MOCK_MS = 300;

const usarMocks = import.meta.env.VITE_ENABLE_MOCKS === "true";

const PESTANAS_API = [
  "PENDIENTES",
  "EN_TRAMITE",
  "DERIVADOS",
  "POR_FIRMAR",
  "ATENDIDOS",
  "ARCHIVADOS",
] as const;

type PestanaApi = (typeof PESTANAS_API)[number];

interface ResumenExpedienteApi {
  idExpediente: string;
  cut: string;
  asunto: string;
  fechaRadicacion: string;
  estadoActual: string;
  areaActualId: string | null;
}

interface RespuestaBandejaApi {
  elementos: ResumenExpedienteApi[];
  contadores: Record<PestanaApi, number>;
}

const ESTADO_API_A_FLUJO: Record<string, EstadoFlujoExpediente> = {
  REGISTRADO: "PENDIENTE",
  RECEPCIONADO: "PENDIENTE",
  EN_CALIFICACION: "PENDIENTE",
  EN_REVISION: "EN_PROCESO",
  SUBSANADO: "EN_PROCESO",
  OBSERVADO: "OBSERVADO",
  DERIVADO: "DERIVADO",
  EN_FIRMA: "NOTIFICADO",
  RESUELTO: "NOTIFICADO",
  ARCHIVADO: "ARCHIVADO",
};

function calcularFechaLimite(fechaRadicacion: string): string {
  const fecha = new Date(fechaRadicacion);
  if (Number.isNaN(fecha.getTime())) return fechaRadicacion;
  fecha.setUTCDate(fecha.getUTCDate() + 30);
  return fecha.toISOString();
}

function aExpedienteSGD(resumen: ResumenExpedienteApi): ExpedienteSGD {
  return {
    id: resumen.idExpediente,
    codigoExpediente: resumen.cut,
    asunto: resumen.asunto,
    solicitante: {
      tipoPersona: "NATURAL",
      tipoDocumento: "DNI",
      numeroDocumento: "",
      nombreOrazonSocial: "No disponible",
      correoNotificacion: "",
      telefonoContacto: "",
    },
    clasificacionCCD: {
      fondo: "IESTP_SUIZA",
      seccion: "NO_ESPECIFICADA",
      serieDocumental: "Sin clasificar",
      codigoSerie: "SIN-CCD",
    },
    metadatos: {
      tipoDocumentoPrincipal: "EXPEDIENTE_EXTERNO",
      palabrasClave: [],
      creadorId: "",
      creadorNombre: "No disponible",
    },
    areaOrigen: resumen.areaActualId ?? "NO_ASIGNADA",
    areaActual: resumen.areaActualId ?? "NO_ASIGNADA",
    estadoFlujo: ESTADO_API_A_FLUJO[resumen.estadoActual] ?? "PENDIENTE",
    prioridad: "NORMAL",
    fechaIngreso: resumen.fechaRadicacion,
    fechaUltimoMovimiento: resumen.fechaRadicacion,
    fechaLimiteAtencion: calcularFechaLimite(resumen.fechaRadicacion),
    versionesDocumentos: [],
    cantidadFolios: 0,
  };
}

export interface FiltrosBandejaExpedientes {
  estado: EstadoFlujoExpediente;
  /** Búsqueda libre por CUT, solicitante o asunto. */
  busqueda?: string;
  codigoSerie?: string;
}

interface RespuestaBandejaRutaDoc {
  elementos: Array<{
    idExpediente: string;
    cut: string;
    asunto: string;
    fechaRadicacion: string;
    estadoActual: string;
    areaActualId: string | null;
    solicitanteNombre: string | null;
    totalFolios: number;
    codigoSerie: string | null;
    nombreSerie: string | null;
  }>;
  contadores: Record<string, number>;
  conteosEstado: Record<string, number>;
  siguienteCursor: string | null;
}

export interface IndicadoresBandeja {
  volumenActivo: number;
  urgentes: number;
  proximosAVencer: number;
}

export interface DatosBandeja {
  expedientes: ExpedienteFilaBandeja[];
  conteos: Record<EstadoFlujoExpediente, number>;
  siguienteCursor: string | null;
}

const PESTANA_API: Record<EstadoFlujoExpediente, string> = {
  PENDIENTE: "TODOS",
  EN_PROCESO: "TODOS",
  OBSERVADO: "TODOS",
  DERIVADO: "TODOS",
  NOTIFICADO: "TODOS",
  ARCHIVADO: "TODOS",
};

const ESTADOS_API: Record<EstadoFlujoExpediente, string[]> = {
  PENDIENTE: ["REGISTRADO"],
  EN_PROCESO: ["RECEPCIONADO", "EN_CALIFICACION", "EN_REVISION", "SUBSANADO", "EN_FIRMA"],
  OBSERVADO: ["OBSERVADO"],
  DERIVADO: ["DERIVADO"],
  NOTIFICADO: ["RESUELTO"],
  ARCHIVADO: ["ARCHIVADO"],
};

const ESTADO_FLUJO_API: Record<string, EstadoFlujoExpediente> = {
  REGISTRADO: "PENDIENTE",
  RECEPCIONADO: "EN_PROCESO",
  EN_CALIFICACION: "EN_PROCESO",
  EN_REVISION: "EN_PROCESO",
  SUBSANADO: "EN_PROCESO",
  EN_FIRMA: "EN_PROCESO",
  OBSERVADO: "OBSERVADO",
  DERIVADO: "DERIVADO",
  RESUELTO: "NOTIFICADO",
  ARCHIVADO: "ARCHIVADO",
};

async function obtenerExpedientesMock(): Promise<ExpedienteSGD[]> {
  await new Promise((resolve) => setTimeout(resolve, RETARDO_MOCK_MS));
  return EXPEDIENTES_FIXTURE;
}

async function obtenerExpedientesApi(): Promise<ExpedienteSGD[]> {
  const respuestas = await Promise.all(
    PESTANAS_API.map((pestana) =>
      apiClient.get<RespuestaBandejaApi>("/api/v1/expedientes", {
        params: { pestana, limite: 100 },
      }),
    ),
  );

  const expedientes = new Map<string, ExpedienteSGD>();
  for (const { data } of respuestas) {
    for (const resumen of data.elementos ?? []) {
      expedientes.set(resumen.idExpediente, aExpedienteSGD(resumen));
    }
  }
  return [...expedientes.values()];
}

async function obtenerBandejaApi(filtros: FiltrosBandejaExpedientes, cursor: string | null): Promise<DatosBandeja> {
  const { data } = await apiClient.get<RespuestaBandejaRutaDoc>("/api/v1/expedientes", {
    params: {
      pestana: PESTANA_API[filtros.estado],
      estadosActuales: ESTADOS_API[filtros.estado].join(","),
      limite: 100,
      ...(cursor ? { cursor } : {}),
      ...(filtros.busqueda?.trim() ? { terminoBusqueda: filtros.busqueda.trim() } : {}),
      ...(filtros.codigoSerie ? { codigoSerie: filtros.codigoSerie } : {}),
    },
  });
  const conteos = {
    PENDIENTE: data.conteosEstado.REGISTRADO ?? 0,
    EN_PROCESO: (data.conteosEstado.RECEPCIONADO ?? 0) + (data.conteosEstado.EN_CALIFICACION ?? 0) + (data.conteosEstado.EN_REVISION ?? 0) +
      (data.conteosEstado.SUBSANADO ?? 0) + (data.conteosEstado.EN_FIRMA ?? 0),
    OBSERVADO: data.conteosEstado.OBSERVADO ?? 0,
    DERIVADO: data.conteosEstado.DERIVADO ?? 0,
    NOTIFICADO: data.conteosEstado.RESUELTO ?? 0,
    ARCHIVADO: data.conteosEstado.ARCHIVADO ?? 0,
  } satisfies Record<EstadoFlujoExpediente, number>;
  return {
    conteos,
    siguienteCursor: data.siguienteCursor,
    expedientes: data.elementos.map((item) => ({
      id: item.idExpediente,
      codigoExpediente: item.cut,
      asunto: item.asunto,
      solicitanteNombre: item.solicitanteNombre,
      codigoSerie: item.codigoSerie,
      nombreSerie: item.nombreSerie,
      cantidadFolios: item.totalFolios,
      fechaIngreso: item.fechaRadicacion,
      estadoFlujo: ESTADO_FLUJO_API[item.estadoActual] ?? filtros.estado,
      areaActualId: item.areaActualId,
    })),
  };
}

function aplicarFiltros(
  expedientes: ExpedienteSGD[],
  filtros: FiltrosBandejaExpedientes,
): ExpedienteSGD[] {
  let resultado = expedientes;

  if (filtros.estado) {
    resultado = resultado.filter((exp) => exp.estadoFlujo === filtros.estado);
  }

  if (filtros.busqueda && filtros.busqueda.trim().length > 0) {
    const termino = filtros.busqueda.trim().toLowerCase();
    resultado = resultado.filter(
      (exp) =>
        exp.codigoExpediente.toLowerCase().includes(termino) ||
        exp.asunto.toLowerCase().includes(termino) ||
        exp.solicitante.nombreOrazonSocial.toLowerCase().includes(termino),
    );
  }

  return resultado;
}

/**
 * Trae la lista completa de expedientes (sin filtrar) para poder calcular los
 * contadores de las 6 pestañas de la Bandeja Operativa.
 */
export function useExpedientesBase() {
  return useQuery({
    queryKey: ["expedientes", "base"],
    queryFn: usarMocks ? obtenerExpedientesMock : obtenerExpedientesApi,
    staleTime: 30_000,
  });
}

/**
 * Hook principal de la Bandeja Operativa (ENT-M03-01).
 * Aplica los filtros de pestaña y búsqueda sobre los datos ya cacheados por TanStack Query.
 */
export function useBandejaExpedientes(filtros: FiltrosBandejaExpedientes) {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ["expedientes", "bandeja", filtros.estado, filtros.busqueda ?? "", filtros.codigoSerie ?? ""],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!usarMocks) return obtenerBandejaApi(filtros, pageParam);
      const expedientes = await obtenerExpedientesMock();
      const conteos = ORDEN_PESTANAS_BANDEJA.reduce((resultado, estado) => {
        resultado[estado] = expedientes.filter((expediente) => expediente.estadoFlujo === estado).length;
        return resultado;
      }, {} as Record<EstadoFlujoExpediente, number>);
      return {
        conteos,
        siguienteCursor: null,
        expedientes: aplicarFiltros(expedientes, filtros)
          .filter((expediente) => expediente.estadoFlujo === filtros.estado)
          .filter((expediente) => !filtros.codigoSerie || expediente.clasificacionCCD.codigoSerie === filtros.codigoSerie)
          .map((expediente) => ({
            id: expediente.id,
            codigoExpediente: expediente.codigoExpediente,
            asunto: expediente.asunto,
            solicitanteNombre: expediente.solicitante.nombreOrazonSocial,
            codigoSerie: expediente.clasificacionCCD.codigoSerie,
            nombreSerie: expediente.clasificacionCCD.serieDocumental,
            cantidadFolios: expediente.cantidadFolios,
            fechaIngreso: expediente.fechaIngreso,
            estadoFlujo: expediente.estadoFlujo,
            areaActualId: expediente.areaActual,
          })),
      };
    },
    getNextPageParam: (ultimaPagina) => ultimaPagina.siguienteCursor ?? undefined,
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (usarMocks || typeof window === "undefined") return;
    const token = window.localStorage.getItem("sigd_token") || window.localStorage.getItem("token");
    if (!token) return;
    const baseUrl = env.apiBaseUrl.replace(/\/+$/, "");
    const rutaStream = baseUrl.endsWith("/v1")
      ? `${baseUrl}/realtime/stream`
      : `${baseUrl}/api/v1/realtime/stream`;
    const streamUrl = new URL(rutaStream, window.location.origin);
    streamUrl.searchParams.set("canales", "expedientes");
    streamUrl.searchParams.set("token", token);
    const eventSource = new EventSource(streamUrl.toString());
    const invalidarBandeja = () => {
      void queryClient.invalidateQueries({ queryKey: ["expedientes"] });
    };
    const eventos = [
      "ExpedienteRecepcionado",
      "ExpedienteDerivado",
      "ExpedienteObservado",
      "ExpedienteSubsanado",
      "ExpedienteAtendido",
      "ExpedienteArchivado",
      "ExpedienteRadicado",
    ];
    eventos.forEach((nombre) => eventSource.addEventListener(nombre, invalidarBandeja));
    return () => {
      eventos.forEach((nombre) => eventSource.removeEventListener(nombre, invalidarBandeja));
      eventSource.close();
    };
  }, [queryClient]);
  const indicadores = useQuery({
    queryKey: ["expedientes", "indicadores"],
    queryFn: async (): Promise<IndicadoresBandeja> => {
      if (usarMocks) {
        const expedientes = await obtenerExpedientesMock();
        return { volumenActivo: expedientes.length, urgentes: 0, proximosAVencer: 0 };
      }
      const { data } = await apiClient.get<IndicadoresBandeja>("/api/v1/expedientes/indicadores");
      return data;
    },
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const pages = query.data?.pages ?? [];
  const data = pages.length > 0
    ? {
        ...pages[0],
        expedientes: pages.flatMap((page) => page.expedientes),
      }
    : undefined;
  return {
    ...query,
    data,
    indicadores: indicadores.data,
    errorIndicadores: indicadores.isError,
  };
}
