/**
 * @file kpiCalculations.ts
 * @description Tipos e interfaces para cálculos de indicadores KPI del SIGD
 * @module types/kpiCalculations
 * @author Jennifer Gatica Saavedra
 * @version 1.0.0
 * @since 2026-09-10
 */

/**
 * Datos brutos recibidos del endpoint de API para el resumen de KPIs
 */
export interface DashboardKpiResumenDTO {
  totalProcesados: number;
  tprHoras: number;
  tasaCompletitud: number;
  atrasadosCriticos: number;
  deltaMensual: number;
}

/**
 * Resultado del cálculo de un KPI individual
 * Contiene el valor calculado, la meta institucional, el estado del semáforo y la tendencia
 */
export interface KpiCalculationResult {
  /** Identificador único del KPI (KPI-01, KPI-02, etc.) */
  id: string;

  /** Nombre legible del indicador */
  name: string;

  /** Valor numérico calculado */
  value: number;

  /** Unidad de medida (%, hrs, expedientes, etc.) */
  unit: string;

  /** Meta institucional que debe alcanzarse */
  target: number;

  /** Estado del semáforo: 'green' (verde), 'yellow' (ámbar), 'red' (rojo) */
  status: 'green' | 'yellow' | 'red';

  /** Cambio porcentual respecto al período anterior */
  deltaPercentage: number;

  /** Indica si la tendencia es positiva (up), negativa (down) o neutral (neutral) */
  trend: 'up' | 'down' | 'neutral';

  /** Descripción breve del estado actual del indicador */
  description: string;

  /** Timestamp de cuándo se calculó este resultado */
  calculatedAt: Date;
}

/**
 * Datos de un expediente para cálculos de TPR
 */
export interface ExpedienteTimingData {
  /** ID único del expediente */
  id: string;

  /** Fecha y hora de ingreso del expediente */
  fechaIngreso: Date;

  /** Fecha y hora de resolución o derivación */
  fechaResolucion: Date;

  /** Estado actual del expediente */
  estado: 'RADICADO' | 'EN_TRAMITE' | 'RESUELTO' | 'ARCHIVADO' | 'OBSERVADO';

  /** Indica si fue resuelto dentro del plazo */
  resueltoEnPlazo: boolean;

  /** Indica si está atrasado */
  estancado: boolean;
}

/**
 * Datos agregados para cálculos de KPIs
 */
export interface KpiAggregateData {
  /** Total de expedientes radicados en el período */
  totalRadicados: number;

  /** Total de expedientes resueltos en el período */
  totalResueltos: number;

  /** Total de expedientes archivados */
  totalArchivados: number;

  /** Total de expedientes resueltos dentro del plazo */
  resueltosDentroDelPlazo: number;

  /** Total de expedientes observados */
  observados: number;

  /** Array con datos de timing de cada expediente */
  expedientes: ExpedienteTimingData[];

  /** Suma total de horas hábiles de todos los expedientes */
  totalHorasHabiles: number;

  /** Período de análisis: inicio */
  fechaInicio: Date;

  /** Período de análisis: fin */
  fechaFin: Date;
}

/**
 * Configuración de umbrales semafóricos para un KPI
 */
export interface KpiThresholds {
  /** Límite inferior para estado rojo */
  redLow: number;

  /** Límite superior para estado rojo (en caso de máximos) */
  redHigh?: number;

  /** Límite inferior para estado ámbar */
  yellowLow: number;

  /** Límite superior para estado ámbar */
  yellowHigh?: number;

  /** Límite inferior para estado verde */
  greenLow?: number;

  /** Límite superior para estado verde */
  greenHigh?: number;
}

/**
 * Formulas y configuración de cálculo para cada KPI
 */
export interface KpiConfiguration {
  id: string;
  name: string;
  unit: string;
  targetValue: number;
  thresholds: KpiThresholds;
  description: string;
}

/**
 * Datos históricos para cálculo de variación porcentual
 */
export interface HistoricalKpiData {
  /** Período (ej: mes anterior, semana anterior) */
  period: string;

  /** Valor del KPI en ese período */
  value: number;

  /** Timestamp del período */
  timestamp: Date;
}

/**
 * Respuesta consolidada de cálculo de todos los KPIs
 */
export interface AllKpisCalculationResult {
  /** Resultados individuales de cada KPI */
  kpis: KpiCalculationResult[];

  /** Timestamp de cuándo se calcularon todos los KPIs */
  calculatedAt: Date;

  /** Período de análisis: inicio */
  fechaInicio: Date;

  /** Período de análisis: fin */
  fechaFin: Date;

  /** Datos de entrada que se usaron para calcular */
  sourceData: DashboardKpiResumenDTO;
}
