/**
 * Hook del calendario laboral oficial (T-BE-OC-13 / T-BE-OC-14).
 *
 * Reemplaza los feriados escritos a mano del frontend por una única fuente:
 * `GET /api/v1/admin/calendario-laboral`, que lee la tabla
 * `sigd_org.calendario_laboral`. El hook entrega el calendario en el formato que
 * espera `src/utils/slaCalculator.ts`, de modo que el semáforo SLA y el cálculo de
 * días hábiles consumen el dato oficial sin conocer la capa de red.
 *
 * Invalidación (sin inventar un bus de eventos): el backend ya invalida su caché
 * y encola el evento en el transactional outbox al dar de alta un feriado. En el
 * cliente, tras el alta se llama a `queryClient.invalidateQueries` sobre la clave
 * del calendario — el mismo mecanismo que ya usa `useCasilla` y
 * `useExpedienteActions` — y el semáforo se recalcula en el siguiente render.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  obtenerCalendarioLaboral,
  registrarFeriadoExcepcional,
} from "../services/calendarioLaboral.service";
import type {
  ConsultaCalendario,
  FeriadoExcepcionalInput,
  FeriadoRegistrado,
  VistaCalendario,
} from "../types/calendarioLaboral";
import type { CalendarioLaboral } from "../utils/slaCalculator";

/** Clave ya reservada para este recurso en el plan de frontend. */
export const CALENDARIO_QUERY_KEYS = {
  all: ["admin", "calendario-laboral"] as const,
  rango: (filtros: ConsultaCalendario) =>
    ["admin", "calendario-laboral", filtros] as const,
};

/**
 * Antigüedad de la copia local del calendario.
 *
 * El backend sirve el calendario desde caché 24 h, pero el semáforo SLA es un
 * cómputo legal: no interesa esperar un día para enterarse de un feriado
 * excepcional, así que se revalida cada 5 minutos. El alta de un feriado desde
 * esta misma sesión invalida la query al instante, sin esperar ese intervalo.
 */
export const STALE_TIME_CALENDARIO_MS = 5 * 60 * 1000;

/** Vista vacía mientras la consulta no resuelve. */
const VISTA_VACIA: VistaCalendario = {
  anio: new Date().getFullYear(),
  total_dias: 0,
  dias_no_laborables: 0,
  feriados_nacionales: [],
  feriados_regionales_ucayali: [],
  feriados_institucionales: [],
  duelos_nacionales: [],
  dias_laborables_excepcionales: [],
  calendario: [],
  anios_disponibles: [],
};

/**
 * Traduce la vista del backend al formato de `slaCalculator`.
 * Sólo se consideran los días activos: una excepción dada de baja no computa.
 */
export function aCalendarioLaboral(vista: VistaCalendario): CalendarioLaboral {
  const noLaborables = new Set<string>();
  const laborablesExcepcionales = new Set<string>();

  for (const dia of vista.calendario) {
    if (!dia.activo) continue;
    if (dia.es_laborable) {
      laborablesExcepcionales.add(dia.fecha);
    } else {
      noLaborables.add(dia.fecha);
    }
  }

  return { noLaborables, laborablesExcepcionales };
}

/**
 * Rango por defecto: el ejercicio en curso y los adyacentes.
 *
 * Cubre de sobra el horizonte del Art. 143 (30 días hábiles) para expedientes
 * archivados y permite que todos los semáforos compartan una única clave de
 * query, es decir una sola petición al backend.
 */
export function rangoPorDefecto(
  referencia: Date = new Date(),
): ConsultaCalendario {
  const anioActual = referencia.getFullYear();
  return {
    desde: `${anioActual - 1}-01-01`,
    hasta: `${anioActual + 1}-12-31`,
  };
}

/** Años que abarca una consulta por rango, inclusivos. */
function aniosDelRango(filtros: ConsultaCalendario): number[] {
  if (typeof filtros.anio === "number") return [filtros.anio];
  const desde = filtros.desde ?? `${new Date().getFullYear()}-01-01`;
  const hasta = filtros.hasta ?? `${new Date().getFullYear()}-12-31`;
  const anioDesde = Number(desde.slice(0, 4));
  const anioHasta = Number(hasta.slice(0, 4));
  if (!Number.isFinite(anioDesde) || !Number.isFinite(anioHasta)) return [];
  if (anioDesde > anioHasta) return [];
  const anios: number[] = [];
  for (let anio = anioDesde; anio <= anioHasta; anio += 1) anios.push(anio);
  return anios;
}

/**
 * Combina las vistas anuales en una vista agregada coherente.
 *
 * `construirVistaCalendario` del backend construye la vista de un SOLO ejercicio,
 * por lo que una consulta por rango devuelve el conteo global en `total` pero
 * únicamente los días de un año en `calendario`. Para que el semáforo nunca
 * compute con un calendario incompleto, se pide un año por ejercicio y se fusionan
 * las respuestas usando sólo el contrato ya existente.
 */
export function combinarVistasAnuales(
  vistas: VistaCalendario[],
): VistaCalendario {
  const [primera, ...resto] = vistas;
  if (!primera) return VISTA_VACIA;
  if (resto.length === 0) return primera;

  const porId = new Map<string, VistaCalendario["calendario"][number]>();
  const anios = new Set<number>();
  for (const vista of vistas) {
    for (const dia of vista.calendario) porId.set(dia.id_calendario, dia);
    for (const anio of vista.anios_disponibles ?? [vista.anio]) anios.add(anio);
  }

  const calendario = [...porId.values()].sort((a, b) =>
    a.fecha.localeCompare(b.fecha),
  );
  const noLaborables = calendario.filter((dia) => !dia.es_laborable && dia.activo);

  return {
    ...primera,
    calendario,
    total_dias: calendario.length,
    dias_no_laborables: noLaborables.length,
    feriados_nacionales: noLaborables.filter(
      (dia) => dia.tipo_feriado === "NACIONAL",
    ),
    feriados_regionales_ucayali: noLaborables.filter(
      (dia) => dia.tipo_feriado === "REGIONAL_UCAYALI",
    ),
    feriados_institucionales: noLaborables.filter(
      (dia) => dia.tipo_feriado === "INSTITUCIONAL",
    ),
    duelos_nacionales: noLaborables.filter(
      (dia) => dia.tipo_feriado === "DUELO_NACIONAL",
    ),
    dias_laborables_excepcionales: calendario.filter(
      (dia) => dia.es_laborable,
    ),
    anios_disponibles: [...anios].sort((a, b) => a - b),
    total: calendario.length,
  };
}

/**
 * Obtiene el calendario oficial completo de la consulta.
 *
 * Si la consulta es por rango, se resuelve un año por ejercicio y se fusionan las
 * respuestas; si trae `anio`, basta una petición.
 */
async function cargarCalendario(
  filtros: ConsultaCalendario,
): Promise<VistaCalendario> {
  const anios = aniosDelRango(filtros);
  if (anios.length === 0) return obtenerCalendarioLaboral(filtros);
  if (anios.length === 1) {
    return obtenerCalendarioLaboral({ ...filtros, anio: anios[0] });
  }
  const vistas = await Promise.all(
    anios.map((anio) => obtenerCalendarioLaboral({ ...filtros, anio })),
  );
  return combinarVistasAnuales(vistas);
}

export interface UseCalendarioOficialResultado {
  /** Calendario listo para `calculateSlaStatus`. */
  calendario: CalendarioLaboral;
  /** Feriados no laborables como fechas `YYYY-MM-DD`, para `useHorarioCorte`. */
  diasNoLaborables: readonly string[];
  /** Días habilitados por resolución: son hábiles aunque sean fin de semana. */
  diasLaborablesExcepcionales: readonly string[];
  vista: VistaCalendario;
  cargando: boolean;
  error: Error | null;
  recargar: () => Promise<unknown>;
  registrarFeriado: (
    entrada: FeriadoExcepcionalInput,
  ) => Promise<FeriadoRegistrado>;
  registrando: boolean;
}

export function useCalendarioOficial(
  filtros: ConsultaCalendario = rangoPorDefecto(),
): UseCalendarioOficialResultado {
  const queryClient = useQueryClient();

  const consulta = useQuery({
    queryKey: CALENDARIO_QUERY_KEYS.rango(filtros),
    queryFn: () => cargarCalendario(filtros),
    staleTime: STALE_TIME_CALENDARIO_MS,
    // No se fija `retry`: se hereda el valor por defecto de `main.tsx` para no
    // duplicar la política de reintentos en dos lugares.
  });

  const vista = consulta.data ?? VISTA_VACIA;
  const calendario = useMemo(() => aCalendarioLaboral(vista), [vista]);

  // Arreglos estables entre renders: los consumen como dependencia de useMemo
  // otros hooks (por ejemplo useHorarioCorte) y no deben invalidarse cada vez.
  const diasNoLaborables = useMemo(
    () => [...calendario.noLaborables],
    [calendario],
  );
  const diasLaborablesExcepcionales = useMemo(
    () => [...calendario.laborablesExcepcionales],
    [calendario],
  );

  const mutacion = useMutation({
    mutationFn: (entrada: FeriadoExcepcionalInput) =>
      registrarFeriadoExcepcional(entrada),
    onSuccess: () => {
      // El backend ya invalidó su caché; aquí se invalida la copia del cliente
      // para que el semáforo SLA se recalcule sin esperar al revalidado.
      void queryClient.invalidateQueries({
        queryKey: CALENDARIO_QUERY_KEYS.all,
      });
    },
  });

  return {
    calendario,
    diasNoLaborables,
    diasLaborablesExcepcionales,
    vista,
    cargando: consulta.isPending,
    error: (consulta.error as Error | null) ?? null,
    recargar: () => consulta.refetch(),
    registrarFeriado: (entrada) => mutacion.mutateAsync(entrada),
    registrando: mutacion.isPending,
  };
}
