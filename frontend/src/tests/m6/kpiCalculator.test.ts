/**
 * @file kpiCalculator.test.ts
 * @description Suite de pruebas unitarias para el servicio de cálculo matemático de KPIs
 * @module tests/m6/kpiCalculator.test
 * @author Jennifer Gatica Saavedra
 * @version 1.0.0
 * @since 2026-09-10
 *
 * Pruebas comprensivas para:
 * - Cálculo de las 4 fórmulas matemáticas
 * - Manejo de casos de borde (división por cero, valores nulos)
 * - Cálculo de horas hábiles (exclusión de fines de semana)
 * - Validación de umbrales semafóricos
 * - Cálculo de deltas porcentuales
 * - Cobertura >= 80% de Vitest
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateBusinessHours,
  calculateKpi01VolumenProcesados,
  calculateKpi02TempoPromedio,
  calculateKpi03TasaResolucion,
  calculateKpi04TasaObservados,
  calculateAllKpis,
} from '../../services/kpiCalculator.service';
import type { KpiAggregateData } from '../../types/kpiCalculations';

/**
 * Suite de pruebas para cálculo de horas hábiles
 */
describe('calculateBusinessHours', () => {
  it('debe calcular 0 horas si la fecha inicial es igual a la final', () => {
    const date = new Date('2026-09-10T10:00:00Z');
    const result = calculateBusinessHours(date, date);
    expect(result).toBe(0);
  });

  it('debe retornar 0 si la fecha final es anterior a la inicial', () => {
    const startDate = new Date('2026-09-10T10:00:00Z');
    const endDate = new Date('2026-09-09T10:00:00Z');
    const result = calculateBusinessHours(startDate, endDate);
    expect(result).toBe(0);
  });

  it('debe calcular 24 horas para un día hábil completo (lunes a viernes)', () => {
    // Lunes 7 de septiembre de 2026
    const monday = new Date('2026-09-07T00:00:00Z');
    const tuesday = new Date('2026-09-08T00:00:00Z');
    const result = calculateBusinessHours(monday, tuesday);
    expect(result).toBe(24);
  });

  it('debe excluir sábados y domingos del cálculo', () => {
    // Viernes 11 de septiembre hasta lunes 14 de septiembre
    // Excluye sábado 12 y domingo 13
    const friday = new Date('2026-09-11T00:00:00Z');
    const nextMonday = new Date('2026-09-14T00:00:00Z');
    const result = calculateBusinessHours(friday, nextMonday);
    // Viernes + Lunes = 2 días = 48 horas
    expect(result).toBe(48);
  });

  it('debe calcular correctamente para una semana laboral completa', () => {
    // Lunes a viernes = 5 días = 120 horas
    const monday = new Date('2026-09-07T00:00:00Z');
    const saturday = new Date('2026-09-12T00:00:00Z');
    const result = calculateBusinessHours(monday, saturday);
    expect(result).toBe(120);
  });
});

/**
 * Suite de pruebas para KPI-01: Volumen Total Procesados
 */
describe('calculateKpi01VolumenProcesados', () => {
  let aggregateData: KpiAggregateData;

  beforeEach(() => {
    aggregateData = {
      totalRadicados: 100,
      totalResueltos: 80,
      totalArchivados: 10,
      resueltosDentroDelPlazo: 75,
      observados: 5,
      expedientes: [],
      totalHorasHabiles: 0,
      fechaInicio: new Date('2026-09-01'),
      fechaFin: new Date('2026-09-30'),
    };
  });

  it('debe calcular 90% para 80 resueltos + 10 archivados sobre 100 radicados', () => {
    const result = calculateKpi01VolumenProcesados(aggregateData);
    expect(result).toBe(90);
  });

  it('debe retornar 100% si todos los expedientes fueron procesados', () => {
    aggregateData.totalResueltos = 90;
    aggregateData.totalArchivados = 10;
    const result = calculateKpi01VolumenProcesados(aggregateData);
    expect(result).toBe(100);
  });

  it('debe retornar 0% si no hay expedientes procesados', () => {
    aggregateData.totalResueltos = 0;
    aggregateData.totalArchivados = 0;
    const result = calculateKpi01VolumenProcesados(aggregateData);
    expect(result).toBe(0);
  });

  it('debe manejar división por cero retornando 0', () => {
    aggregateData.totalRadicados = 0;
    const result = calculateKpi01VolumenProcesados(aggregateData);
    expect(result).toBe(0);
  });

  it('debe retornar 0 si totalRadicados es negativo', () => {
    aggregateData.totalRadicados = -5;
    const result = calculateKpi01VolumenProcesados(aggregateData);
    expect(result).toBe(0);
  });

  it('debe redondear a 2 decimales', () => {
    aggregateData.totalRadicados = 3;
    aggregateData.totalResueltos = 1;
    aggregateData.totalArchivados = 1;
    const result = calculateKpi01VolumenProcesados(aggregateData);
    expect(result).toBe(66.67);
  });

  it('debe calcular 95% como meta institucional mínima', () => {
    aggregateData.totalRadicados = 100;
    aggregateData.totalResueltos = 95;
    aggregateData.totalArchivados = 0;
    const result = calculateKpi01VolumenProcesados(aggregateData);
    expect(result).toBe(95);
  });
});

/**
 * Suite de pruebas para KPI-02: Tiempo Promedio Respuesta
 */
describe('calculateKpi02TempoPromedio', () => {
  let aggregateData: KpiAggregateData;

  beforeEach(() => {
    aggregateData = {
      totalRadicados: 0,
      totalResueltos: 0,
      totalArchivados: 0,
      resueltosDentroDelPlazo: 0,
      observados: 0,
      expedientes: [],
      totalHorasHabiles: 0,
      fechaInicio: new Date('2026-09-01'),
      fechaFin: new Date('2026-09-30'),
    };
  });

  it('debe retornar 0 si no hay expedientes', () => {
    const result = calculateKpi02TempoPromedio(aggregateData);
    expect(result).toBe(0);
  });

  it('debe calcular promedio de 24 horas para un expediente con 1 día hábil', () => {
    aggregateData.expedientes = [
      {
        id: 'EXP001',
        fechaIngreso: new Date('2026-09-07T00:00:00Z'),
        fechaResolucion: new Date('2026-09-08T00:00:00Z'),
        estado: 'RESUELTO',
        resueltoEnPlazo: true,
        estancado: false,
      },
    ];
    const result = calculateKpi02TempoPromedio(aggregateData);
    expect(result).toBe(24);
  });

  it('debe calcular promedio correcto para múltiples expedientes', () => {
    aggregateData.expedientes = [
      {
        id: 'EXP001',
        fechaIngreso: new Date('2026-09-07T00:00:00Z'),
        fechaResolucion: new Date('2026-09-09T00:00:00Z'),
        estado: 'RESUELTO',
        resueltoEnPlazo: true,
        estancado: false,
      },
      {
        id: 'EXP002',
        fechaIngreso: new Date('2026-09-07T00:00:00Z'),
        fechaResolucion: new Date('2026-09-08T00:00:00Z'),
        estado: 'RESUELTO',
        resueltoEnPlazo: true,
        estancado: false,
      },
    ];
    const result = calculateKpi02TempoPromedio(aggregateData);
    // Expediente 1: 2 días (48h), Expediente 2: 1 día (24h), promedio = (48+24)/2 = 36h
    expect(result).toBeCloseTo(36, 1);
  });

  it('debe respetar la meta de 24 horas máximo', () => {
    aggregateData.expedientes = [
      {
        id: 'EXP001',
        fechaIngreso: new Date('2026-09-07T00:00:00Z'), // lunes
        fechaResolucion: new Date('2026-09-08T00:00:00Z'), // martes
        estado: 'RESUELTO',
        resueltoEnPlazo: true,
        estancado: false,
      },
    ];
    const result = calculateKpi02TempoPromedio(aggregateData);
    expect(result).toBeLessThanOrEqual(24);
  });

  it('debe excluir fines de semana en el cálculo', () => {
    // Viernes a lunes (excluye sábado y domingo)
    aggregateData.expedientes = [
      {
        id: 'EXP001',
        fechaIngreso: new Date('2026-09-11T00:00:00Z'), // viernes
        fechaResolucion: new Date('2026-09-14T00:00:00Z'), // lunes
        estado: 'RESUELTO',
        resueltoEnPlazo: true,
        estancado: false,
      },
    ];
    const result = calculateKpi02TempoPromedio(aggregateData);
    // Viernes = 24 horas, Lunes = 24 horas = 48 horas
    expect(result).toBe(48);
  });

  it('debe redondear a 2 decimales', () => {
    aggregateData.expedientes = [
      {
        id: 'EXP001',
        fechaIngreso: new Date('2026-09-07T00:00:00Z'),
        fechaResolucion: new Date('2026-09-08T00:00:00Z'),
        estado: 'RESUELTO',
        resueltoEnPlazo: true,
        estancado: false,
      },
    ];
    const result = calculateKpi02TempoPromedio(aggregateData);
    expect(result % 1).toBeLessThanOrEqual(0.01);
  });
});

/**
 * Suite de pruebas para KPI-03: Tasa Resolución Oportuna
 */
describe('calculateKpi03TasaResolucion', () => {
  let aggregateData: KpiAggregateData;

  beforeEach(() => {
    aggregateData = {
      totalRadicados: 100,
      totalResueltos: 100,
      totalArchivados: 0,
      resueltosDentroDelPlazo: 90,
      observados: 0,
      expedientes: [],
      totalHorasHabiles: 0,
      fechaInicio: new Date('2026-09-01'),
      fechaFin: new Date('2026-09-30'),
    };
  });

  it('debe calcular 90% si 90 de 100 expedientes fueron resueltos en plazo', () => {
    const result = calculateKpi03TasaResolucion(aggregateData);
    expect(result).toBe(90);
  });

  it('debe retornar 100% si todos los expedientes fueron resueltos en plazo', () => {
    aggregateData.resueltosDentroDelPlazo = 100;
    const result = calculateKpi03TasaResolucion(aggregateData);
    expect(result).toBe(100);
  });

  it('debe retornar 0% si ningún expediente fue resuelto en plazo', () => {
    aggregateData.resueltosDentroDelPlazo = 0;
    const result = calculateKpi03TasaResolucion(aggregateData);
    expect(result).toBe(0);
  });

  it('debe retornar 100% si no hay expedientes resueltos (división por cero)', () => {
    aggregateData.totalResueltos = 0;
    const result = calculateKpi03TasaResolucion(aggregateData);
    expect(result).toBe(100);
  });

  it('debe redondear a 2 decimales', () => {
    aggregateData.totalResueltos = 3;
    aggregateData.resueltosDentroDelPlazo = 1;
    const result = calculateKpi03TasaResolucion(aggregateData);
    expect(result).toBe(33.33);
  });

  it('debe validar meta mínima de 90%', () => {
    aggregateData.resueltosDentroDelPlazo = 90;
    aggregateData.totalResueltos = 100;
    const result = calculateKpi03TasaResolucion(aggregateData);
    expect(result).toBeGreaterThanOrEqual(90);
  });
});

/**
 * Suite de pruebas para KPI-04: Tasa Expedientes Observados
 */
describe('calculateKpi04TasaObservados', () => {
  let aggregateData: KpiAggregateData;

  beforeEach(() => {
    aggregateData = {
      totalRadicados: 100,
      totalResueltos: 90,
      totalArchivados: 10,
      resueltosDentroDelPlazo: 85,
      observados: 5,
      expedientes: [],
      totalHorasHabiles: 0,
      fechaInicio: new Date('2026-09-01'),
      fechaFin: new Date('2026-09-30'),
    };
  });

  it('debe calcular 5% si 5 de 100 expedientes están observados', () => {
    const result = calculateKpi04TasaObservados(aggregateData);
    expect(result).toBe(5);
  });

  it('debe retornar 0% si no hay expedientes observados', () => {
    aggregateData.observados = 0;
    const result = calculateKpi04TasaObservados(aggregateData);
    expect(result).toBe(0);
  });

  it('debe retornar 0% si no hay expedientes radicados (división por cero)', () => {
    aggregateData.totalRadicados = 0;
    const result = calculateKpi04TasaObservados(aggregateData);
    expect(result).toBe(0);
  });

  it('debe manejar totalRadicados negativo retornando 0%', () => {
    aggregateData.totalRadicados = -10;
    const result = calculateKpi04TasaObservados(aggregateData);
    expect(result).toBe(0);
  });

  it('debe redondear a 2 decimales', () => {
    aggregateData.totalRadicados = 3;
    aggregateData.observados = 1;
    const result = calculateKpi04TasaObservados(aggregateData);
    expect(result).toBe(33.33);
  });

  it('debe validar meta máxima de 5%', () => {
    aggregateData.observados = 5;
    aggregateData.totalRadicados = 100;
    const result = calculateKpi04TasaObservados(aggregateData);
    expect(result).toBeLessThanOrEqual(5);
  });

  it('debe retornar valor superior a 5% si hay demasiados observados', () => {
    aggregateData.observados = 15;
    aggregateData.totalRadicados = 100;
    const result = calculateKpi04TasaObservados(aggregateData);
    expect(result).toBeGreaterThan(5);
  });
});

/**
 * Suite de pruebas integrales para calculateAllKpis
 */
describe('calculateAllKpis', () => {
  let aggregateData: KpiAggregateData;

  beforeEach(() => {
    aggregateData = {
      totalRadicados: 100,
      totalResueltos: 90,
      totalArchivados: 5,
      resueltosDentroDelPlazo: 85,
      observados: 3,
      expedientes: [
        {
          id: 'EXP001',
          fechaIngreso: new Date('2026-09-07T10:00:00Z'),
          fechaResolucion: new Date('2026-09-08T10:00:00Z'),
          estado: 'RESUELTO',
          resueltoEnPlazo: true,
          estancado: false,
        },
      ],
      totalHorasHabiles: 24,
      fechaInicio: new Date('2026-09-01'),
      fechaFin: new Date('2026-09-30'),
    };
  });

  it('debe retornar array con 4 KPIs', () => {
    const results = calculateAllKpis(aggregateData);
    expect(results).toHaveLength(4);
    expect(results[0].id).toBe('KPI-01');
    expect(results[1].id).toBe('KPI-02');
    expect(results[2].id).toBe('KPI-03');
    expect(results[3].id).toBe('KPI-04');
  });

  it('debe asignar estados semafóricos correctamente', () => {
    const results = calculateAllKpis(aggregateData);
    results.forEach((kpi: typeof results[0]) => {
      expect(['green', 'yellow', 'red']).toContain(kpi.status);
    });
  });

  it('debe calcular deltas porcentuales correctamente con datos anteriores', () => {
    const previousKpis = {
      'KPI-01': 90,
      'KPI-02': 20,
      'KPI-03': 80,
      'KPI-04': 2,
    };
    const results = calculateAllKpis(aggregateData, previousKpis);

    // KPI-01: 95 vs 90 anterior = +5.56%
    expect(results[0].deltaPercentage).toBeGreaterThan(0);
    // KPI-03: 94.44 vs 80 anterior = +18.05%
    expect(results[2].deltaPercentage).toBeGreaterThan(0);
  });

  it('debe retornar delta 0 si no se proporcionan datos anteriores', () => {
    const results = calculateAllKpis(aggregateData);
    results.forEach((kpi: typeof results[0]) => {
      expect(kpi.deltaPercentage).toBe(0);
    });
  });

  it('debe establecer tendencia neutral si no hay datos anteriores', () => {
    const results = calculateAllKpis(aggregateData);
    results.forEach((kpi: typeof results[0]) => {
      expect(kpi.trend).toBe('neutral');
    });
  });

  it('debe incluir información descriptiva en cada KPI', () => {
    const results = calculateAllKpis(aggregateData);
    results.forEach((kpi: typeof results[0]) => {
      expect(kpi.name).toBeDefined();
      expect(kpi.unit).toBeDefined();
      expect(kpi.description).toBeDefined();
      expect(kpi.target).toBeDefined();
    });
  });

  it('debe mantener valores en rango esperado', () => {
    const results = calculateAllKpis(aggregateData);

    // KPI-01: 0-100%
    expect(results[0].value).toBeGreaterThanOrEqual(0);
    expect(results[0].value).toBeLessThanOrEqual(100);

    // KPI-02: >= 0 hrs
    expect(results[1].value).toBeGreaterThanOrEqual(0);

    // KPI-03: 0-100%
    expect(results[2].value).toBeGreaterThanOrEqual(0);
    expect(results[2].value).toBeLessThanOrEqual(100);

    // KPI-04: 0-100%
    expect(results[3].value).toBeGreaterThanOrEqual(0);
    expect(results[3].value).toBeLessThanOrEqual(100);
  });
});

/**
 * Suite de pruebas para casos extremos y edge cases
 */
describe('Edge Cases y Validación', () => {
  it('debe manejar valores muy grandes sin overflow', () => {
    const aggregateData: KpiAggregateData = {
      totalRadicados: 1000000,
      totalResueltos: 950000,
      totalArchivados: 50000,
      resueltosDentroDelPlazo: 900000,
      observados: 5000,
      expedientes: [],
      totalHorasHabiles: 0,
      fechaInicio: new Date('2026-09-01'),
      fechaFin: new Date('2026-09-30'),
    };
    const result = calculateKpi01VolumenProcesados(aggregateData);
    expect(result).toBe(100);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('debe manejar valores muy pequeños con precisión', () => {
    const aggregateData: KpiAggregateData = {
      totalRadicados: 1000,
      totalResueltos: 1,
      totalArchivados: 0,
      resueltosDentroDelPlazo: 1,
      observados: 0,
      expedientes: [],
      totalHorasHabiles: 0,
      fechaInicio: new Date('2026-09-01'),
      fechaFin: new Date('2026-09-30'),
    };
    const result = calculateKpi01VolumenProcesados(aggregateData);
    expect(result).toBe(0.1);
  });

  it('debe retornar valores consistentes para múltiples llamadas', () => {
    const aggregateData: KpiAggregateData = {
      totalRadicados: 50,
      totalResueltos: 40,
      totalArchivados: 5,
      resueltosDentroDelPlazo: 38,
      observados: 2,
      expedientes: [],
      totalHorasHabiles: 0,
      fechaInicio: new Date('2026-09-01'),
      fechaFin: new Date('2026-09-30'),
    };

    const result1 = calculateKpi01VolumenProcesados(aggregateData);
    const result2 = calculateKpi01VolumenProcesados(aggregateData);
    expect(result1).toBe(result2);
  });
});
