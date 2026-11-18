/**
 * SIGD · IESTP "Suiza" (Pucallpa) — Núcleo 00 CoreLink
 * Motor Analítico MGD-PCM/SEGDI · Contratos de los indicadores.
 *
 * Tarea: T-BE-CL-11 (fórmulas oficiales MGD-PCM) y T-BE-CL-13 (división por cero).
 *
 * Las metas provienen del plan maestro §4.7 (Dominio 6, OE6) y son las mismas que
 * el frontend muestra en `KpiMetricGrid.tsx`: VTEP ≥ 95 %, TPR ≤ 24 horas hábiles,
 * TRO ≥ 90 % y TEO ≤ 5 %.
 */

/** Centinela de la vista base para expedientes sin unidad orgánica asignada. */
export const UNIDAD_SIN_AREA = 'SIN_AREA';

export const META_VTEP = 95;
export const META_TPR_HORAS_HABILES = 24;
export const META_TRO = 90;
export const META_TEO = 5;

/**
 * Permanencia máxima en días hábiles para considerar una resolución oportuna.
 * Coincide con `diasHabilesLimite` de `calcularSla` en `rutadoc/sla.service.ts`.
 */
export const DIAS_HABILES_PLAZO = 30;

/** Semáforo institucional; el TPR y la TEO son indicadores de tope (menor es mejor). */
export type Semaforo = 'VERDE' | 'AMARILLO' | 'ROJO';

/** Riesgo de cuello de botella por área, en el vocabulario que consume el frontend. */
export type RiesgoCuelloBotella = 'bajo' | 'medio' | 'alto';

/**
 * Numeradores y denominadores crudos de un agregado.
 *
 * Se transportan SIN normalizar porque el consolidado institucional no puede
 * obtenerse promediando porcentajes de grupo: hay que volver a dividir las sumas
 * (media ponderada). Guardar los contadores crudos en la vista materializada es
 * lo que permite que la fila consolidada nunca discrepe de la media aritmética de
 * sus áreas.
 *
 * Los valores `numeric` que devuelve `pg` llegan como cadena, de modo que el
 * repositorio ya los normaliza a `number`; aquí el contrato es numérico y finito.
 */
export interface ContadoresMgd {
  nRadicados: number;
  nAtendidos: number;
  nArchivados: number;
  nResueltos: number;
  nEnTramite: number;
  nObservados: number;
  nResueltosDentroPlazo: number;
  /** Suma de horas hábiles de atención de los expedientes resueltos. */
  horasHabilesSuma: number;
}

export const CONTADORES_VACIOS: Readonly<ContadoresMgd> = Object.freeze({
  nRadicados: 0,
  nAtendidos: 0,
  nArchivados: 0,
  nResueltos: 0,
  nEnTramite: 0,
  nObservados: 0,
  nResueltosDentroPlazo: 0,
  horasHabilesSuma: 0,
});

/** Un indicador con su meta y su evaluación de cumplimiento. */
export interface IndicadorMgd {
  valor: number;
  meta: number;
  cumple: boolean;
}

/**
 * Fila consolidada del tablero. `periodo` es `null` cuando se agrega todo el
 * histórico; en ese caso el consolidado puede ponderar años distintos y por eso
 * la respuesta lo declara explícitamente en vez de presentarlo como el dato del
 * mes en curso.
 */
export interface ResumenKpisMgd {
  periodo: string | null;
  vtep: IndicadorMgd;
  tprHorasHabiles: IndicadorMgd;
  tro: IndicadorMgd;
  teo: IndicadorMgd;
  totalExpedientesEnTramite: number;
  totalExpedientesAtendidos: number;
  contadores: ContadoresMgd;
  /** Instante del último refresco de la vista materializada consultada. */
  actualizadoEn: string | null;
}

/** Punto mensual de la serie de tendencias (#52). */
export interface PuntoTendencia {
  mes: number;
  radicados: number;
  atendidos: number;
  observados: number;
}

/** Fila del ranking de cuellos de botella (#51). */
export interface CuelloBotellaArea {
  areaId: string;
  areaNombre: string;
  sigla: string | null;
  /** Expedientes totales de la unidad en el período. */
  expedientes: number;
  /** Expedientes cuya permanencia supera el umbral `diasLimite`. */
  expedientesEstancados: number;
  /** Permanencia promedio en DÍAS HÁBILES (no calendario). */
  diasRetencion: number;
  /** Tiempo hábil promedio de permanencia, en horas. */
  horasPromedioRetencion: number;
  /** Porcentaje del volumen de la unidad que está estancado. */
  porcentajeEstancado: number;
  riesgo: RiesgoCuelloBotella;
  estado: string;
  /** Umbral de días hábiles realmente aplicado tras alinear al tramo. */
  diasLimiteAplicado: number;
}

/** Distribución por tramo de permanencia, anidada en cada cuello de botella. */
export interface TramoRetencion {
  tramo: string;
  nExpedientes: number;
  porcentajeDelArea: number;
}

/** Resultado del refresco concurrente (#51 según §20 del plan maestro). */
export interface ResultadoRefrescoMgd {
  vistas: readonly string[];
  duracionMs: number;
  /** Cierto si otra petición ya tenía el lock y este refresco se omitió. */
  refrescoYaEnCurso: boolean;
}
