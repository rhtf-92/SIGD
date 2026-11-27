import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { EXPEDIENTES_FIXTURE } from "../data/expedientesFixtures";
import type { EstadoFlujoExpediente, ExpedienteSGD } from "../types/expediente";

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
  /** Pestaña activa. `undefined` trae todos los expedientes (usado para calcular contadores). */
  estado?: EstadoFlujoExpediente;
  /** Búsqueda libre por CUT, solicitante o asunto. */
  busqueda?: string;
}

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
  const { data, ...resto } = useExpedientesBase();

  const expedientesFiltrados = data ? aplicarFiltros(data, filtros) : undefined;

  return { data: expedientesFiltrados, ...resto };
}
