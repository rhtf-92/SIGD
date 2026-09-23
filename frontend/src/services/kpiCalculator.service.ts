/**
 * @file kpiCalculator.service.ts
 * @description Servicio de cálculo matemático de KPIs del Modelo de Gestión Documental (MGD)
 * @module services/kpiCalculator
 * @author Jennifer Gatica Saavedra
 * @version 1.0.0
 * @since 2026-09-10
 *
 * Implementa las 4 fórmulas oficiales del SIGD:
 * - KPI-01: Volumen Total de Expedientes Procesados (VTEP)
 * - KPI-02: Tiempo Promedio de Respuesta (TPR)
 * - KPI-03: Tasa de Resolución Oportuna (TRO)
 * - KPI-04: Tasa de Expedientes Observados (TEO)
 */

import type {
  KpiCalculationResult,
  KpiAggregateData,
  DashboardKpiResumenDTO,
  AllKpisCalculationResult,
  KpiConfiguration,
} from '../types/kpiCalculations';

/**
 * Configuraciones oficiales de umbrales semafóricos para cada KPI
 */
const KPI_CONFIGURATIONS: Record<string, KpiConfiguration> = {
  'KPI-01': {
    id: 'KPI-01',
    name: 'Volumen Total de Expedientes Procesados',
    unit: '%',
    targetValue: 95,
    thresholds: {
      greenLow: 95,
      yellowLow: 75,
      redLow: 0,
      redHigh: 74.9,
    },
    description:
      'Proporción de expedientes procesados respecto al total radicado. Meta: >= 95%',
  },
  'KPI-02': {
    id: 'KPI-02',
    name: 'Tiempo Promedio de Respuesta',
    unit: 'hrs',
    targetValue: 24,
    thresholds: {
      greenLow: 0,
      greenHigh: 24,
      yellowLow: 24.1,
      yellowHigh: 48,
      redLow: 48.1,
    },
    description:
      'Promedio de horas hábiles de atención. Meta: <= 24 horas por instancia',
  },
  'KPI-03': {
    id: 'KPI-03',
    name: 'Tasa de Solicitudes Completadas',
    unit: '%',
    targetValue: 90,
    thresholds: {
      greenLow: 90,
      yellowLow: 75,
      yellowHigh: 89.9,
      redLow: 0,
      redHigh: 74.9,
    },
    description: 'Porcentaje de expedientes resueltos en plazo. Meta: >= 90%',
  },
  'KPI-04': {
    id: 'KPI-04',
    name: 'Documentos Atrasados / Críticos',
    unit: '%',
    targetValue: 5,
    thresholds: {
      greenLow: 0,
      greenHigh: 5,
      yellowLow: 5.1,
      yellowHigh: 10,
      redLow: 10.1,
    },
    description:
      'Porcentaje de expedientes en mora o atrasados. Meta: <= 5%',
  },
};

/**
 * Determina si una fecha es un día hábil (excluye sábados y domingos)
 * @param date Fecha a validar
 * @returns true si es día hábil (lunes a viernes)
 */
function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = domingo, 6 = sábado
}

/**
 * Calcula las horas hábiles entre dos fechas
 * Excluye fines de semana (sábados y domingos)
 * Cuenta cada día hábil completo como 24 horas
 *
 * @param startDate Fecha de inicio
 * @param endDate Fecha de fin (exclusiva)
 * @returns Número de horas hábiles entre las dos fechas
 */
export function calculateBusinessHours(
  startDate: Date,
  endDate: Date
): number {
  if (startDate >= endDate) {
    return 0;
  }

  let totalHours = 0;
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);

  // Iterar por cada día desde startDate hasta endDate (endDate exclusiva)
  while (currentDate < endDate) {
    if (isBusinessDay(currentDate)) {
      totalHours += 24;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return totalHours;
}

/**
 * Determina el estado semafórico basado en el valor y la configuración
 */
function getKpiStatus(
  value: number,
  config: KpiConfiguration
): 'green' | 'yellow' | 'red' {
  const { thresholds } = config;

  // Para KPIs donde más alto es mejor (porcentajes, eficiencia)
  if (config.id === 'KPI-01' || config.id === 'KPI-03') {
    if (value >= (thresholds.greenLow || 0)) {
      return 'green';
    } else if (value >= (thresholds.yellowLow || 0)) {
      return 'yellow';
    } else {
      return 'red';
    }
  }

  // Para KPI-02 (tiempo, donde menos es mejor)
  if (config.id === 'KPI-02') {
    if (value <= (thresholds.greenHigh || 24)) {
      return 'green';
    } else if (value <= (thresholds.yellowHigh || 48)) {
      return 'yellow';
    } else {
      return 'red';
    }
  }

  // Para KPI-04 (atrasados, donde menos es mejor)
  if (config.id === 'KPI-04') {
    if (value <= (thresholds.greenHigh || 5)) {
      return 'green';
    } else if (value <= (thresholds.yellowHigh || 10)) {
      return 'yellow';
    } else {
      return 'red';
    }
  }

  return 'yellow';
}

/**
 * Calcula el estado de la tendencia comparando con un valor anterior
 */
function calculateTrend(
  currentValue: number,
  previousValue: number,
  kpiId: string
): 'up' | 'down' | 'neutral' {
  // Para KPIs donde más alto es mejor (KPI-01 y KPI-03)
  if (kpiId === 'KPI-01' || kpiId === 'KPI-03') {
    if (currentValue > previousValue) return 'up';
    if (currentValue < previousValue) return 'down';
    return 'neutral';
  }

  // Para KPIs donde menos es mejor (KPI-02 y KPI-04)
  if (currentValue < previousValue) return 'up';
  if (currentValue > previousValue) return 'down';
  return 'neutral';
}

/**
 * KPI-01: Calcula el Volumen Total de Expedientes Procesados (VTEP)
 *
 * Formula: VTEP = Σ(resueltos) + Σ(archivados)
 * Expresado como porcentaje del total radicado
 *
 * @param aggregateData Datos agregados de expedientes
 * @returns Porcentaje de expedientes procesados
 */
export function calculateKpi01VolumenProcesados(
  aggregateData: KpiAggregateData
): number {
  const { totalRadicados, totalResueltos, totalArchivados } = aggregateData;

  // Si no hay expedientes radicados, retornar 0%
  if (!totalRadicados || totalRadicados <= 0) {
    return 0;
  }

  const totalProcesados = totalResueltos + totalArchivados;
  const percentage = (totalProcesados / totalRadicados) * 100;

  // Redondear a 2 decimales
  return Math.round(percentage * 100) / 100;
}

/**
 * KPI-02: Calcula el Tiempo Promedio de Respuesta (TPR)
 *
 * Formula: TPR = (Σ tiempo en horas hábiles) / N
 * Retorna el promedio en horas hábiles
 *
 * @param aggregateData Datos agregados de expedientes
 * @returns Promedio de horas hábiles de respuesta
 */
export function calculateKpi02TempoPromedio(
  aggregateData: KpiAggregateData
): number {
  const { expedientes } = aggregateData;

  // Si no hay expedientes, retornar 0
  if (!expedientes || expedientes.length === 0) {
    return 0;
  }

  let totalHours = 0;

  // Calcular horas hábiles para cada expediente
  for (const exp of expedientes) {
    const hours = calculateBusinessHours(exp.fechaIngreso, exp.fechaResolucion);
    totalHours += hours;
  }

  const promedio = totalHours / expedientes.length;

  // Redondear a 2 decimales
  return Math.round(promedio * 100) / 100;
}

/**
 * KPI-03: Calcula la Tasa de Resolución Oportuna (TRO)
 *
 * Formula: TRO = (atendidos en plazo / total resueltos) * 100
 * Si total resueltos es 0, retorna 100%
 *
 * @param aggregateData Datos agregados de expedientes
 * @returns Porcentaje de expedientes resueltos en plazo
 */
export function calculateKpi03TasaResolucion(
  aggregateData: KpiAggregateData
): number {
  const { totalResueltos, resueltosDentroDelPlazo } = aggregateData;

  // Si no hay expedientes resueltos, retornar 100% (meta alcanzada)
  if (!totalResueltos || totalResueltos <= 0) {
    return 100;
  }

  const percentage = (resueltosDentroDelPlazo / totalResueltos) * 100;

  // Redondear a 2 decimales
  return Math.round(percentage * 100) / 100;
}

/**
 * KPI-04: Calcula la Tasa de Expedientes Observados (TEO)
 *
 * Formula: TEO = (expedientes observados / total radicados) * 100
 * Si total radicados es 0, retorna 0%
 *
 * @param aggregateData Datos agregados de expedientes
 * @returns Porcentaje de expedientes observados
 */
export function calculateKpi04TasaObservados(
  aggregateData: KpiAggregateData
): number {
  const { totalRadicados, observados } = aggregateData;

  // Si no hay expedientes radicados, retornar 0%
  if (!totalRadicados || totalRadicados <= 0) {
    return 0;
  }

  const percentage = (observados / totalRadicados) * 100;

  // Redondear a 2 decimales
  return Math.round(percentage * 100) / 100;
}

/**
 * Calcula todos los KPIs a partir de datos agregados
 * Retorna un array con los 4 KPIs calculados con sus estados
 *
 * @param aggregateData Datos agregados de expedientes
 * @param previousKpis KPIs del período anterior para calcular deltas (opcional)
 * @returns Array con los 4 KPIs calculados
 */
export function calculateAllKpis(
  aggregateData: KpiAggregateData,
  previousKpis?: Record<string, number>
): KpiCalculationResult[] {
  const results: KpiCalculationResult[] = [];

  // KPI-01
  const kpi01Value = calculateKpi01VolumenProcesados(aggregateData);
  const kpi01Config = KPI_CONFIGURATIONS['KPI-01'];
  results.push({
    id: 'KPI-01',
    name: kpi01Config.name,
    value: kpi01Value,
    unit: kpi01Config.unit,
    target: kpi01Config.targetValue,
    status: getKpiStatus(kpi01Value, kpi01Config),
    deltaPercentage: previousKpis
      ? Math.round(
          ((kpi01Value - (previousKpis['KPI-01'] || 0)) /
            (previousKpis['KPI-01'] || 1)) *
            100 *
            100
        ) / 100
      : 0,
    trend: previousKpis
      ? calculateTrend(kpi01Value, previousKpis['KPI-01'] || 0, 'KPI-01')
      : 'neutral',
    description: kpi01Config.description,
    calculatedAt: new Date(),
  });

  // KPI-02
  const kpi02Value = calculateKpi02TempoPromedio(aggregateData);
  const kpi02Config = KPI_CONFIGURATIONS['KPI-02'];
  results.push({
    id: 'KPI-02',
    name: kpi02Config.name,
    value: kpi02Value,
    unit: kpi02Config.unit,
    target: kpi02Config.targetValue,
    status: getKpiStatus(kpi02Value, kpi02Config),
    deltaPercentage: previousKpis
      ? Math.round(
          ((kpi02Value - (previousKpis['KPI-02'] || 0)) /
            (previousKpis['KPI-02'] || 1)) *
            100 *
            100
        ) / 100
      : 0,
    trend: previousKpis
      ? calculateTrend(kpi02Value, previousKpis['KPI-02'] || 0, 'KPI-02')
      : 'neutral',
    description: kpi02Config.description,
    calculatedAt: new Date(),
  });

  // KPI-03
  const kpi03Value = calculateKpi03TasaResolucion(aggregateData);
  const kpi03Config = KPI_CONFIGURATIONS['KPI-03'];
  results.push({
    id: 'KPI-03',
    name: kpi03Config.name,
    value: kpi03Value,
    unit: kpi03Config.unit,
    target: kpi03Config.targetValue,
    status: getKpiStatus(kpi03Value, kpi03Config),
    deltaPercentage: previousKpis
      ? Math.round(
          ((kpi03Value - (previousKpis['KPI-03'] || 0)) /
            (previousKpis['KPI-03'] || 1)) *
            100 *
            100
        ) / 100
      : 0,
    trend: previousKpis
      ? calculateTrend(kpi03Value, previousKpis['KPI-03'] || 0, 'KPI-03')
      : 'neutral',
    description: kpi03Config.description,
    calculatedAt: new Date(),
  });

  // KPI-04
  const kpi04Value = calculateKpi04TasaObservados(aggregateData);
  const kpi04Config = KPI_CONFIGURATIONS['KPI-04'];
  results.push({
    id: 'KPI-04',
    name: kpi04Config.name,
    value: kpi04Value,
    unit: kpi04Config.unit,
    target: kpi04Config.targetValue,
    status: getKpiStatus(kpi04Value, kpi04Config),
    deltaPercentage: previousKpis
      ? Math.round(
          ((kpi04Value - (previousKpis['KPI-04'] || 0)) /
            (previousKpis['KPI-04'] || 1)) *
            100 *
            100
        ) / 100
      : 0,
    trend: previousKpis
      ? calculateTrend(kpi04Value, previousKpis['KPI-04'] || 0, 'KPI-04')
      : 'neutral',
    description: kpi04Config.description,
    calculatedAt: new Date(),
  });

  return results;
}

/**
 * Procesa datos del DTO de la API y calcula todos los KPIs
 * Esta es la función de entrada principal para el frontend
 *
 * @param dtoData Datos recibidos del endpoint /api/v1/reportes/dashboard/resumen
 * @param fechaInicio Inicio del período de análisis
 * @param fechaFin Fin del período de análisis
 * @returns Objeto consolidado con todos los KPIs calculados
 */
export function processAndCalculateAllKpis(
  dtoData: DashboardKpiResumenDTO,
  fechaInicio: Date,
  fechaFin: Date
): AllKpisCalculationResult {
  // Crear objeto agregado a partir del DTO
  // Nota: El DTO proporciona valores ya calculados por el backend
  // Aquí podría haber lógica adicional si el frontend necesita recalcular

  const aggregateData: KpiAggregateData = {
    totalRadicados: 0,
    totalResueltos: 0,
    totalArchivados: 0,
    resueltosDentroDelPlazo: 0,
    observados: 0,
    expedientes: [],
    totalHorasHabiles: dtoData.tprHoras || 0,
    fechaInicio,
    fechaFin,
  };

  // Calcular KPIs basados en los datos del DTO
  const kpis = calculateAllKpis(aggregateData);

  return {
    kpis,
    calculatedAt: new Date(),
    fechaInicio,
    fechaFin,
    sourceData: dtoData,
  };
}

/**
 * Obtiene la configuración oficial de un KPI específico
 */
export function getKpiConfiguration(kpiId: string): KpiConfiguration | null {
  return KPI_CONFIGURATIONS[kpiId] || null;
}

/**
 * Obtiene todas las configuraciones de KPIs
 */
export function getAllKpiConfigurations(): Record<
  string,
  KpiConfiguration
> {
  return { ...KPI_CONFIGURATIONS };
}
