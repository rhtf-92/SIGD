/**
 * Suite unitaria del calendario laboral de OrganiCore (T-BE-OC-13/14/16).
 *
 * Cubre los once casos exigidos por la especificación: fecha laborable, sábado,
 * domingo, feriado nacional, feriado regional de Ucayali, feriado institucional,
 * duelo nacional, cálculo de días hábiles, rango de fechas, fechas duplicadas y
 * fecha inválida.
 *
 * Es una suite PURA: no levanta PostgreSQL ni Testcontainers, porque el motor de
 * cómputo es una función del calendario inyectado y las pruebas de escritura
 * usan un doble de `Pool`. La persistencia real y la unicidad efectiva del
 * índice `(fecha, unidad_territorial)` se validan en la suite E2E.
 *
 * Framework: Vitest, el mismo que usa el resto del proyecto
 * (`vitest.unit.config.ts` incluye los `.spec.ts` de `tests/unit`). No se crea
 * ni se modifica ninguna configuración del framework.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  CacheMemoria,
  CalendarioService,
  aFechaIso,
  aInstanteUtc,
  calendarioDelAnio,
  compararFechas,
  construirVistaCalendario,
  contarDiasHabiles,
  desplazarDias,
  diaSemana,
  esDiaLaborable,
  esDueloNacional,
  esFechaValida,
  esFeriado,
  esFeriadoInstitucional,
  esFeriadoNacional,
  esFeriadoRegionalUcayali,
  esFinDeSemana,
  indexarCalendario,
  listarDiasLaborables,
  listarDiasNoLaborables,
  primerDiaHabil,
  proximoDiaHabil,
  sumarDiasHabiles,
  tipoFeriadoDe,
  TTL_CALENDARIO_MS,
  type DiaCalendario,
  type TipoFeriado,
  type UnidadTerritorial,
} from '../../../../src/domains/organicore/calendario.service.js';
import {
  TablasMaestrasService,
  TTL_TABLAS_MAESTRAS_MS,
  TTL_TABLAS_MAESTRAS_SEGUNDOS,
} from '../../../../src/domains/organicore/tablasMaestras.service.js';
import { ConflictError, ValidationError } from '../../../../src/shared/domain/errors/index.js';
import { esquemaConsultaCalendario, esquemaFeriadoExcepcional } from '../../../../src/domains/organicore/calendario.service.js';

/**
 * Calendario institucional 2026: 14 feriados nacionales (D. Leg. N° 713) y
 * 2 feriados regionales de Ucayali (Ley N° 29001).
 */
function dia(
  fecha: string,
  tipo_feriado: TipoFeriado,
  unidad_territorial: UnidadTerritorial,
  descripcion: string,
): DiaCalendario {
  return {
    fecha,
    anio: Number(fecha.slice(0, 4)),
    tipo_feriado,
    descripcion,
    unidad_territorial,
    es_laborable: false,
    base_legal: null,
    activo: true,
  };
}

const CALENDARIO_2026: DiaCalendario[] = [
  dia('2026-01-01', 'NACIONAL', 'NACIONAL', 'Año Nuevo'),
  dia('2026-05-01', 'NACIONAL', 'NACIONAL', 'Día del Trabajo'),
  dia('2026-06-07', 'NACIONAL', 'NACIONAL', 'Batalla de Arica y Día de la Bandera'),
  dia('2026-06-24', 'REGIONAL_UCAYALI', 'UCAYALI', 'Fiesta Patronal de San Juan Bautista'),
  dia('2026-06-29', 'NACIONAL', 'NACIONAL', 'San Pedro y San Pablo'),
  dia('2026-07-23', 'NACIONAL', 'NACIONAL', 'Día de la Fuerza Aérea del Perú'),
  dia('2026-07-28', 'NACIONAL', 'NACIONAL', 'Fiestas Patrias (Primer día)'),
  dia('2026-07-29', 'NACIONAL', 'NACIONAL', 'Fiestas Patrias (Segundo día)'),
  dia('2026-08-06', 'NACIONAL', 'NACIONAL', 'Batalla de Junín'),
  dia('2026-08-30', 'NACIONAL', 'NACIONAL', 'Santa Rosa de Lima'),
  dia('2026-10-08', 'NACIONAL', 'NACIONAL', 'Combate de Angamos'),
  dia('2026-10-13', 'REGIONAL_UCAYALI', 'UCAYALI', 'Aniversario de Pucallpa'),
  dia('2026-11-01', 'NACIONAL', 'NACIONAL', 'Día de Todos los Santos'),
  dia('2026-12-08', 'NACIONAL', 'NACIONAL', 'Inmaculada Concepción'),
  dia('2026-12-09', 'NACIONAL', 'NACIONAL', 'Batalla de Ayacucho'),
  dia('2026-12-25', 'NACIONAL', 'NACIONAL', 'Navidad'),
];

// ---------------------------------------------------------------------------
// CASO 1. Fecha laborable
// ---------------------------------------------------------------------------
describe('caso 1 · fecha laborable', () => {
  it('lunes a viernes es laborable cuando el calendario no declara excepción', () => {
    expect(esDiaLaborable('2026-05-04', CALENDARIO_2026)).toBe(true); // lunes
    expect(esDiaLaborable('2026-05-08', CALENDARIO_2026)).toBe(true); // viernes
  });

  it('con el calendario vacío todo día de lunes a viernes es laborable', () => {
    expect(esDiaLaborable('2026-05-04', [])).toBe(true);
    expect(esFeriado('2026-05-04', [])).toBe(false);
    expect(tipoFeriadoDe('2026-05-04', [])).toBeNull();
  });

  it('rechaza como laborable cualquier fecha mal formada', () => {
    expect(esDiaLaborable('2026-02-30', CALENDARIO_2026)).toBe(false);
    expect(esDiaLaborable('no-es-fecha', CALENDARIO_2026)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CASO 2. Sábado
// ---------------------------------------------------------------------------
describe('caso 2 · sábado', () => {
  it('identifica el sábado como no laborable', () => {
    expect(esFinDeSemana('2026-05-09')).toBe(true);
    expect(esDiaLaborable('2026-05-09', CALENDARIO_2026)).toBe(false);
    expect(diaSemana('2026-05-09')).toBe(6);
  });

  it('un sábado sigue excluido aunque el calendario declare una excepción', () => {
    const conExcepcion: DiaCalendario[] = [
      ...CALENDARIO_2026,
      {
        fecha: '2026-05-09',
        anio: 2026,
        tipo_feriado: null,
        descripcion: 'Jornada institucional con horario ampliado',
        unidad_territorial: 'IESTP_SUIZA',
        es_laborable: true,
        base_legal: 'RR. No. 004-2026-IE-SUIZA',
        activo: true,
      },
    ];
    // El sábado sólo es habilitable mediante la fila es_laborable = TRUE.
    expect(esFinDeSemana('2026-05-09')).toBe(true);
    expect(esDiaLaborable('2026-05-09', conExcepcion)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CASO 3. Domingo
// ---------------------------------------------------------------------------
describe('caso 3 · domingo', () => {
  it('identifica el domingo como no laborable', () => {
    expect(esFinDeSemana('2026-05-10')).toBe(true);
    expect(esDiaLaborable('2026-05-10', CALENDARIO_2026)).toBe(false);
    expect(diaSemana('2026-05-10')).toBe(0);
  });

  it('salta del viernes al lunes siguiente saltando el fin de semana', () => {
    expect(proximoDiaHabil('2026-05-08', CALENDARIO_2026)).toBe('2026-05-11');
  });
});

// ---------------------------------------------------------------------------
// CASO 4. Feriado nacional
// ---------------------------------------------------------------------------
describe('caso 4 · feriado nacional', () => {
  it('detecta los feriados nacionales del D. Leg. N° 713', () => {
    for (const fecha of ['2026-01-01', '2026-05-01', '2026-07-28', '2026-07-29', '2026-12-25']) {
      expect(esFeriadoNacional(fecha, CALENDARIO_2026)).toBe(true);
      expect(esFeriado(fecha, CALENDARIO_2026)).toBe(true);
      expect(esDiaLaborable(fecha, CALENDARIO_2026)).toBe(false);
    }
  });

  it('no confunde un feriado nacional con un regional o un duelo', () => {
    expect(esFeriadoRegionalUcayali('2026-01-01', CALENDARIO_2026)).toBe(false);
    expect(esFeriadoInstitucional('2026-01-01', CALENDARIO_2026)).toBe(false);
    expect(esDueloNacional('2026-01-01', CALENDARIO_2026)).toBe(false);
  });

  it('un feriado nacional en fin de semana no altera el cómputo', () => {
    expect(esFinDeSemana('2026-06-07')).toBe(true); // domingo
    expect(esFeriadoNacional('2026-06-07', CALENDARIO_2026)).toBe(true);
    expect(esDiaLaborable('2026-06-07', CALENDARIO_2026)).toBe(false);
  });

  it('descuenta los dos feriados nacionales de Fiestas Patrias', () => {
    // Semana del 27 al 31 de julio: 28 y 29 son feriados.
    expect(contarDiasHabiles('2026-07-27', '2026-07-31', CALENDARIO_2026)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// CASO 5. Feriado regional de Ucayali
// ---------------------------------------------------------------------------
describe('caso 5 · feriado regional de Ucayali', () => {
  it('detecta el 24 de junio (San Juan Bautista) y el 13 de octubre (Pucallpa)', () => {
    for (const fecha of ['2026-06-24', '2026-10-13']) {
      expect(esFeriadoRegionalUcayali(fecha, CALENDARIO_2026)).toBe(true);
      expect(tipoFeriadoDe(fecha, CALENDARIO_2026)).toBe('REGIONAL_UCAYALI');
      expect(esDiaLaborable(fecha, CALENDARIO_2026)).toBe(false);
    }
  });

  it('se descuenta del cómputo de la semana del 22 al 26 de junio', () => {
    expect(contarDiasHabiles('2026-06-22', '2026-06-26', CALENDARIO_2026)).toBe(3);
    // La misma semana sin el feriado regional daría 4.
    expect(contarDiasHabiles('2026-06-22', '2026-06-26', [])).toBe(4);
  });

  it('no lo confunde con un feriado nacional', () => {
    expect(esFeriadoNacional('2026-06-24', CALENDARIO_2026)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CASO 6. Feriado institucional
// ---------------------------------------------------------------------------
describe('caso 6 · feriado institucional', () => {
  const INSTITUCIONAL: DiaCalendario = {
    fecha: '2026-11-18',
    anio: 2026,
    tipo_feriado: 'INSTITUCIONAL',
    descripcion: 'Cierre institucional por mantenimiento de sistemas',
    unidad_territorial: 'IESTP_SUIZA',
    es_laborable: false,
    base_legal: 'RR. No. 118-2026-IE-SUIZA',
    activo: true,
  };

  it('un feriado institucional por resolución resta el día del cómputo', () => {
    const conInstitucional = [...CALENDARIO_2026, INSTITUCIONAL];
    expect(esFeriadoInstitucional('2026-11-18', conInstitucional)).toBe(true);
    expect(esDiaLaborable('2026-11-18', conInstitucional)).toBe(false);
    // Semana del 16 al 20 de noviembre: 17, 18 (feriado), 19 y 20.
    expect(contarDiasHabiles('2026-11-16', '2026-11-20', conInstitucional)).toBe(3);
    expect(contarDiasHabiles('2026-11-16', '2026-11-20', CALENDARIO_2026)).toBe(4);
  });

  it('el registro dado de baja deja de ser feriado', () => {
    const dadoDeBaja = [{ ...INSTITUCIONAL, activo: false }];
    expect(esFeriadoInstitucional('2026-11-18', dadoDeBaja)).toBe(false);
    expect(esDiaLaborable('2026-11-18', dadoDeBaja)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CASO 7. Duelo nacional
// ---------------------------------------------------------------------------
describe('caso 7 · día de duelo nacional', () => {
  const DUELO: DiaCalendario = {
    fecha: '2026-10-28',
    anio: 2026,
    tipo_feriado: 'DUELO_NACIONAL',
    descripcion: 'Duelo nacional decretado por el Estado',
    unidad_territorial: 'NACIONAL',
    es_laborable: false,
    base_legal: 'D.S. N° 012-2026-JUS',
    activo: true,
  };

  it('un duelo nacional se resta del cómputo de la semana', () => {
    const conDuelo = [...CALENDARIO_2026, DUELO];
    expect(esDueloNacional('2026-10-28', conDuelo)).toBe(true);
    expect(esFeriado('2026-10-28', conDuelo)).toBe(true);
    expect(esDiaLaborable('2026-10-28', conDuelo)).toBe(false);
    // Semana del 26 al 30 de octubre: 27, 28 (duelo), 29 y 30.
    expect(contarDiasHabiles('2026-10-26', '2026-10-30', conDuelo)).toBe(3);
    expect(contarDiasHabiles('2026-10-26', '2026-10-30', CALENDARIO_2026)).toBe(4);
  });

  it('un duelo no habilita un fin de semana ni anula un feriado nacional', () => {
    const conDuelo = [...CALENDARIO_2026, DUELO];
    expect(esFeriadoNacional('2026-12-25', conDuelo)).toBe(true);
    expect(esFeriadoNacional('2026-10-28', conDuelo)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CASO 8. Cálculo de días hábiles (Art. 143 LPAG)
// ---------------------------------------------------------------------------
describe('caso 8 · cálculo de días hábiles', () => {
  it('cuenta 4 días hábiles de una semana completa sin feriados', () => {
    // Lunes 2026-05-04 a viernes 2026-05-08; la fecha de inicio no se cuenta.
    expect(contarDiasHabiles('2026-05-04', '2026-05-08', CALENDARIO_2026)).toBe(4);
  });

  it('devuelve 0 cuando ambas fechas coinciden', () => {
    expect(contarDiasHabiles('2026-05-04', '2026-05-04', CALENDARIO_2026)).toBe(0);
  });

  it('devuelve negativo cuando el rango es inverso, preservando el orden', () => {
    expect(contarDiasHabiles('2026-05-08', '2026-05-04', CALENDARIO_2026)).toBe(-4);
  });

  it('proyecta los 30 días hábiles del plazo legal sin feriados en el trayecto', () => {
    expect(sumarDiasHabiles('2026-05-04', 30, CALENDARIO_2026)).toBe('2026-06-15');
  });

  it('alarga la proyección cuando el calendario declara un feriado en el trayecto', () => {
    // Del 22 de junio: 23, 24 (feriado regional), 25, 26, 29 (feriado nacional), 30, 1.
    expect(sumarDiasHabiles('2026-06-22', 6, CALENDARIO_2026)).toBe('2026-07-02');
    // Sin calendario, el mismo cómputo cerraría el 30 de junio.
    expect(sumarDiasHabiles('2026-06-22', 6, [])).toBe('2026-06-30');
  });

  it('el cálculo es data-driven: mover el feriado cambia el resultado', () => {
    const feriadoMovido = CALENDARIO_2026.map((fila) =>
      fila.fecha === '2026-06-24' ? { ...fila, fecha: '2026-07-06', anio: 2026 } : fila,
    );
    expect(sumarDiasHabiles('2026-06-22', 6, feriadoMovido)).toBe('2026-07-01');
  });

  it('rechaza cantidades negativas o no enteras de días hábiles', () => {
    expect(() => sumarDiasHabiles('2026-05-04', -1, CALENDARIO_2026)).toThrow(RangeError);
    expect(() => sumarDiasHabiles('2026-05-04', 1.5, CALENDARIO_2026)).toThrow(RangeError);
  });

  it('ubica el primer y el próximo día hábil desde un feriado y desde un fin de semana', () => {
    expect(proximoDiaHabil('2026-06-24', CALENDARIO_2026)).toBe('2026-06-25');
    expect(primerDiaHabil('2026-06-24', CALENDARIO_2026)).toBe('2026-06-25');
    expect(primerDiaHabil('2026-06-23', CALENDARIO_2026)).toBe('2026-06-23');
    expect(primerDiaHabil('2026-06-20', CALENDARIO_2026)).toBe('2026-06-22');
  });
});

// ---------------------------------------------------------------------------
// CASO 9. Rango de fechas
// ---------------------------------------------------------------------------
describe('caso 9 · rango de fechas', () => {
  it('enumera fines de semana y feriados del rango, sin repeticiones', () => {
    const noLaborables = listarDiasNoLaborables('2026-06-20', '2026-06-28', CALENDARIO_2026);
    expect(noLaborables).toEqual([
      '2026-06-20', // sábado
      '2026-06-21', // domingo
      '2026-06-24', // San Juan Bautista (feriado regional de Ucayali)
      '2026-06-27', // sábado
      '2026-06-28', // domingo
    ]);
  });

  it('enumera los días laborables del rango, complemento exacto del anterior', () => {
    const laborables = listarDiasLaborables('2026-06-20', '2026-06-28', CALENDARIO_2026);
    expect(laborables).toEqual(['2026-06-22', '2026-06-23', '2026-06-25', '2026-06-26']);
    expect(laborables.length + listarDiasNoLaborables('2026-06-20', '2026-06-28', CALENDARIO_2026).length).toBe(9);
  });

  it('devuelve listas vacías para un rango de un solo día laborable', () => {
    expect(listarDiasNoLaborables('2026-05-04', '2026-05-04', CALENDARIO_2026)).toEqual([]);
    expect(listarDiasLaborables('2026-05-04', '2026-05-04', CALENDARIO_2026)).toEqual(['2026-05-04']);
  });

  it('rechaza rangos invertidos o con fechas inválidas', () => {
    expect(() => listarDiasNoLaborables('2026-06-28', '2026-06-20', CALENDARIO_2026)).toThrow(RangeError);
    expect(() => listarDiasNoLaborables('2026-02-30', '2026-03-10', CALENDARIO_2026)).toThrow(RangeError);
    expect(() => contarDiasHabiles('2026-02-30', '2026-03-10', CALENDARIO_2026)).toThrow(RangeError);
  });

  it('filtra el calendario por ejercicio fiscal', () => {
    const conOtroAnio: DiaCalendario[] = [
      ...CALENDARIO_2026,
      dia('2027-01-01', 'NACIONAL', 'NACIONAL', 'Año Nuevo'),
    ];
    expect(calendarioDelAnio(conOtroAnio, 2027)).toHaveLength(1);
    expect(calendarioDelAnio(conOtroAnio, 2026)).toHaveLength(CALENDARIO_2026.length);
  });

  it('convierte y formatea fechas sin desvíos de zona horaria', () => {
    expect(aFechaIso(aInstanteUtc('2026-06-24'))).toBe('2026-06-24');
    expect(desplazarDias('2026-06-24', 1)).toBe('2026-06-25');
    expect(desplazarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(compararFechas('2026-01-02', '2026-01-01')).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CASO 10. Fechas duplicadas
// ---------------------------------------------------------------------------
describe('caso 10 · fechas duplicadas', () => {
  it('la habilitación laborable prevalece sobre el feriado de la misma fecha', () => {
    const conDuplicado: DiaCalendario[] = [
      ...CALENDARIO_2026,
      {
        fecha: '2026-06-24',
        anio: 2026,
        tipo_feriado: null,
        descripcion: 'Jornada institucional con horario ampliado',
        unidad_territorial: 'IESTP_SUIZA',
        es_laborable: true,
        base_legal: 'RR. No. 004-2026-IE-SUIZA',
        activo: true,
      },
    ];

    expect(indexarCalendario(conDuplicado).get('2026-06-24')?.es_laborable).toBe(true);
    expect(esDiaLaborable('2026-06-24', conDuplicado)).toBe(true);
    expect(esFeriado('2026-06-24', conDuplicado)).toBe(false);
    // El rango ya no lista el 24 de junio como no laborable.
    expect(listarDiasNoLaborables('2026-06-24', '2026-06-24', conDuplicado)).toEqual([]);
  });

  it('el índice colapsa varias filas de la misma fecha en una sola entrada', () => {
    const conTriplicado: DiaCalendario[] = [
      ...CALENDARIO_2026,
      dia('2026-06-24', 'NACIONAL', 'NACIONAL', 'Año Nuevo adicional'),
    ];
    expect(indexarCalendario(conTriplicado).size).toBe(CALENDARIO_2026.length);
  });

  it('el rango no repite una fecha declarada no laborable por varias unidades', () => {
    const conDuplicadoRegional: DiaCalendario[] = [
      ...CALENDARIO_2026,
      dia('2026-06-24', 'INSTITUCIONAL', 'IESTP_SUIZA', 'Cierre institucional'),
    ];
    const noLaborables = listarDiasNoLaborables('2026-06-24', '2026-06-24', conDuplicadoRegional);
    expect(noLaborables).toEqual(['2026-06-24']);
  });

  it('rechaza con 409 el registro duplicado de (fecha, unidad_territorial)', async () => {
    const { pool, cliente } = crearPoolFalso({ fechasExistentes: ['2026-11-27'] });
    const servicio = new CalendarioService(pool, {
      cache: new CacheMemoria<DiaCalendario[]>(TTL_CALENDARIO_MS),
    });

    await expect(
      servicio.registrarFeriadoExcepcional(
        esquemaFeriadoExcepcional.parse({
          fecha: '2026-11-27',
          descripcion: 'Duelo nacional por fallecimiento de autoridad',
          tipo_feriado: 'DUELO_NACIONAL',
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    // La transacción se revierte: no se escribe bitácora ni outbox.
    expect(cliente.consultas).toContain('BEGIN');
    expect(cliente.consultas).toContain('ROLLBACK');
    expect(cliente.consultas.some((c) => c.includes('INSERT INTO sigd_audit'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CASO 11. Fecha inválida
// ---------------------------------------------------------------------------
describe('caso 11 · fecha inválida', () => {
  it('acepta fechas ISO reales del calendario gregoriano', () => {
    for (const fecha of ['2026-01-01', '2026-02-28', '2026-06-24', '2028-02-29']) {
      expect(esFechaValida(fecha)).toBe(true);
    }
  });

  it('rechaza fechas que no existen en el calendario gregoriano', () => {
    for (const fecha of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '2025-02-29']) {
      expect(esFechaValida(fecha)).toBe(false);
    }
  });

  it('rechaza entradas con formato distinto a YYYY-MM-DD', () => {
    for (const fecha of ['26-01-01', '2026-1-1', '20260101', '2026/01/01', '', 'hoy']) {
      expect(esFechaValida(fecha)).toBe(false);
    }
  });

  it('el esquema Zod rechaza la fecha inválida en el borde de entrada', () => {
    const entradaValida = {
      fecha: '2026-11-27',
      descripcion: 'Duelo nacional por fallecimiento de autoridad',
      tipo_feriado: 'DUELO_NACIONAL',
    };
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, fecha: '2026-02-30' })).toThrow();
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, fecha: '27-11-2026' })).toThrow();
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, fecha: '' })).toThrow();
    expect(() => esquemaConsultaCalendario.parse({ desde: '2026-02-30' })).toThrow();
  });

  it('el servicio de calendario lanza ValidationError ante fechas inválidas', async () => {
    const { pool } = crearPoolFalso();
    const servicio = new CalendarioService(pool, {
      cache: new CacheMemoria<DiaCalendario[]>(TTL_CALENDARIO_MS),
    });
    await expect(servicio.calcularSla('2026-02-30', '2026-03-10')).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(servicio.listarPorAnio(2026.5)).rejects.toBeInstanceOf(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// Validación de la entrada de feriado excepcional
// ---------------------------------------------------------------------------
describe('calendario laboral · validación de la entrada de feriado excepcional', () => {
  const entradaValida = {
    fecha: '2026-11-27',
    descripcion: 'Duelo nacional por fallecimiento de autoridad',
    tipo_feriado: 'DUELO_NACIONAL',
  };

  it('deriva la unidad territorial a partir del tipo de feriado', () => {
    const duelo = esquemaFeriadoExcepcional.parse(entradaValida);
    expect(duelo.fecha).toBe('2026-11-27');
    expect(duelo.tipo_feriado).toBe('DUELO_NACIONAL');
    expect(duelo.unidad_territorial).toBe('NACIONAL');
    expect(duelo.es_laborable).toBe(false);

    expect(
      esquemaFeriadoExcepcional.parse({ ...entradaValida, tipo_feriado: 'INSTITUCIONAL' })
        .unidad_territorial,
    ).toBe('IESTP_SUIZA');
    expect(
      esquemaFeriadoExcepcional.parse({ ...entradaValida, tipo_feriado: 'REGIONAL_UCAYALI' })
        .unidad_territorial,
    ).toBe('UCAYALI');
  });

  it('rechaza descripciones demasiado cortas o ausentes', () => {
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, descripcion: 'x' })).toThrow();
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, descripcion: '   ' })).toThrow();
    expect(() =>
      esquemaFeriadoExcepcional.parse({ fecha: '2026-11-27', tipo_feriado: 'DUELO_NACIONAL' }),
    ).toThrow();
  });

  it('rechaza tipos de feriado y unidades territoriales fuera de catálogo', () => {
    expect(() =>
      esquemaFeriadoExcepcional.parse({ ...entradaValida, tipo_feriado: 'PROVINCIAL' }),
    ).toThrow();
    expect(() =>
      esquemaFeriadoExcepcional.parse({ ...entradaValida, unidad_territorial: 'LIMA' }),
    ).toThrow();
  });

  it('rechaza campos desconocidos (strict)', () => {
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, prioridad: 1 })).toThrow();
  });

  it('exige la resolución que autoriza una habilitación laborable', () => {
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, es_laborable: true })).toThrow();
    const habilitacion = esquemaFeriadoExcepcional.parse({
      fecha: '2026-11-28',
      descripcion: 'Sábado habilitado por disposición institucional',
      es_laborable: true,
      base_legal: 'RR. No. 210-2026-IE-SUIZA',
    });
    expect(habilitacion.tipo_feriado).toBeNull();
    expect(habilitacion.unidad_territorial).toBe('IESTP_SUIZA');
  });

  it('valida la consulta del calendario y normaliza los flags', () => {
    expect(esquemaConsultaCalendario.parse({ anio: '2026' }).anio).toBe(2026);
    expect(esquemaConsultaCalendario.parse({}).anio).toBeUndefined();
    expect(esquemaConsultaCalendario.parse({ incluir_inactivos: 'true' }).incluir_inactivos).toBe(true);
    expect(esquemaConsultaCalendario.parse({ incluir_inactivos: 'false' }).incluir_inactivos).toBe(false);
    expect(() => esquemaConsultaCalendario.parse({ anio: '2026-2' })).toThrow();
  });

  it('rechaza un rango de fechas invertido en la propia capa de validación', () => {
    const invertido = esquemaConsultaCalendario.safeParse({ desde: '2026-12-01', hasta: '2026-01-01' });
    expect(invertido.success).toBe(false);
    expect(invertido.error?.issues[0]?.path).toEqual(['desde']);
    expect(invertido.error?.issues[0]?.message).toContain('posterior a');

    expect(esquemaConsultaCalendario.parse({ desde: '2026-01-01', hasta: '2026-12-31' })).toBeTruthy();
    expect(esquemaConsultaCalendario.parse({ desde: '2026-05-01', hasta: '2026-05-01' })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Vista consolidada por categoría normativa
// ---------------------------------------------------------------------------
describe('calendario laboral · vista consolidada', () => {
  it('agrupa los días por categoría normativa', () => {
    const vista = construirVistaCalendario(2026, CALENDARIO_2026);
    expect(vista.anio).toBe(2026);
    expect(vista.total_dias).toBe(CALENDARIO_2026.length);
    expect(vista.dias_no_laborables).toBe(CALENDARIO_2026.length);
    expect(vista.feriados_nacionales).toHaveLength(14);
    expect(vista.feriados_regionales_ucayali.map((f) => f.fecha)).toEqual([
      '2026-06-24',
      '2026-10-13',
    ]);
    expect(vista.duelos_nacionales).toHaveLength(0);
    expect(vista.feriados_institucionales).toHaveLength(0);
    expect(vista.dias_laborables_excepcionales).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Caché en memoria con TTL
// ---------------------------------------------------------------------------
describe('calendario laboral · caché en memoria con TTL', () => {
  it('descarta la entrada una vez vencido el TTL', () => {
    let reloj = 1_000;
    const cache = new CacheMemoria<string>(24 * 60 * 60 * 1000, { ahora: () => reloj });
    cache.guardar('clave', 'valor');
    expect(cache.obtener('clave')).toBe('valor');

    reloj += 24 * 60 * 60 * 1000 - 1;
    expect(cache.obtener('clave')).toBe('valor');

    reloj += 1;
    expect(cache.obtener('clave')).toBeUndefined();
    expect(cache.tamano).toBe(0);
  });

  it('invalida una clave concreta o todo el contenido', () => {
    const cache = new CacheMemoria<number>(60_000);
    cache.guardar('a', 1);
    cache.guardar('b', 2);
    cache.invalidar('a');
    expect(cache.obtener('a')).toBeUndefined();
    expect(cache.obtener('b')).toBe(2);
    cache.invalidar();
    expect(cache.tamano).toBe(0);
  });

  it('rechaza un TTL no positivo', () => {
    expect(() => new CacheMemoria<number>(0)).toThrow(RangeError);
    expect(() => new CacheMemoria<number>(-1)).toThrow(RangeError);
  });

  it('la caché del calendario se puebla una vez y se invalida tras el alta', async () => {
    const { pool, lecturas } = crearPoolFalso();
    const servicio = new CalendarioService(pool, {
      cache: new CacheMemoria<DiaCalendario[]>(TTL_CALENDARIO_MS),
    });

    await servicio.obtenerCalendario();
    await servicio.obtenerCalendario();
    expect(lecturas()).toBe(1);

    await servicio.registrarFeriadoExcepcional(
      esquemaFeriadoExcepcional.parse({
        fecha: '2026-11-27',
        descripcion: 'Duelo nacional por fallecimiento de autoridad',
        tipo_feriado: 'DUELO_NACIONAL',
      }),
    );

    // La siguiente lectura vuelve a PostgreSQL: el semáforo SLA se recalcula.
    await servicio.obtenerCalendario();
    expect(lecturas()).toBe(2);
  });

  it('el TTL de tablas maestras es de 24 horas (86400 segundos)', () => {
    expect(TTL_TABLAS_MAESTRAS_MS).toBe(86_400_000);
    expect(TTL_TABLAS_MAESTRAS_SEGUNDOS).toBe(86_400);
  });

  it('tablas maestras se lee una sola vez dentro del TTL', async () => {
    const { pool, consultas } = crearPoolFalso();
    const servicio = new TablasMaestrasService(pool, {
      cache: new CacheMemoria(TTL_TABLAS_MAESTRAS_MS),
      ahora: () => '2026-09-28T12:00:00.000Z',
    });

    const primera = await servicio.listarMaestras();
    const segunda = await servicio.listarMaestras();
    expect(segunda).toBe(primera);
    expect(segunda.ttl_segundos).toBe(86_400);
    expect(consultas.length).toBe(primera.total_catalogos);

    await servicio.listarMaestras(true, true);
    expect(consultas.length).toBe(primera.total_catalogos * 2);
  });
});

// ---------------------------------------------------------------------------
// Transacción, bitácora WORM, outbox y recálculo del semáforo SLA
// ---------------------------------------------------------------------------
interface ClienteFalso extends PoolClient {
  consultas: string[];
}

interface FilaInsertada {
  id_calendario: string;
  fecha: string;
  anio: number;
  tipo_feriado: TipoFeriado | null;
  descripcion: string;
  unidad_territorial: UnidadTerritorial;
  es_laborable: boolean;
  base_legal: string | null;
  activo: boolean;
  creado_en: string;
}

function filaPara(fecha: string, unidad: UnidadTerritorial): FilaInsertada {
  return {
    id_calendario: '11111111-1111-4111-8111-111111111111',
    fecha,
    anio: Number(fecha.slice(0, 4)),
    tipo_feriado: 'DUELO_NACIONAL',
    descripcion: 'Duelo nacional',
    unidad_territorial: unidad,
    es_laborable: false,
    base_legal: 'D.S. N° 012-2026-JUS',
    activo: true,
    creado_en: '2026-09-28T12:00:00.000Z',
  };
}

/**
 * Pool mínimo que emula la interacción del servicio: transacción explícita,
 * control previo de duplicidad, inserción, bitácora WORM y evento de outbox.
 */
function crearPoolFalso(opciones: { fechasExistentes?: string[] } = {}): {
  pool: Pool;
  cliente: ClienteFalso;
  consultas: string[];
  lecturas: () => number;
} {
  const fechasExistentes = new Set(opciones.fechasExistentes ?? []);
  const consultas: string[] = [];
  let lecturas = 0;

  const ejecutar = async <T extends QueryResultRow>(
    sql: string,
    valores: unknown[] = [],
  ): Promise<{ rows: T[]; rowCount: number }> => {
    consultas.push(sql.trim().split('\n')[0]);
    if (sql.includes('SELECT EXISTS')) {
      return {
        rows: [{ existe: fechasExistentes.has(String(valores[0])) } as unknown as T],
        rowCount: 1,
      };
    }
    if (sql.includes('INSERT INTO sigd_org.calendario_laboral')) {
      const fila = filaPara(String(valores[0]), String(valores[3]) as UnidadTerritorial);
      fechasExistentes.add(fila.fecha);
      return { rows: [fila as unknown as T], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
      return { rows: [{ id_auditoria: 'aud-1' } as unknown as T], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
      return { rows: [{ id_evento: 'evt-1' } as unknown as T], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_org.calendario_laboral AS c')) {
      lecturas += 1;
      const filas = [...fechasExistentes]
        .sort()
        .map((fecha) => filaPara(fecha, 'NACIONAL')) as unknown as T[];
      return { rows: filas, rowCount: filas.length };
    }
    return { rows: [], rowCount: 0 };
  };

  const cliente = {
    consultas,
    query: ejecutar,
    release: () => undefined,
  } as unknown as ClienteFalso;

  const pool = { connect: async () => cliente, query: ejecutar } as unknown as Pool;
  return { pool, cliente, consultas, lecturas: () => lecturas };
}

describe('calendario laboral · alta de feriado con transaction/outbox', () => {
  let cache: CacheMemoria<DiaCalendario[]>;
  let servicio: CalendarioService;

  beforeEach(() => {
    cache = new CacheMemoria<DiaCalendario[]>(TTL_CALENDARIO_MS);
  });

  it('acepta el primer registro y lo devuelve con la señal de invalidación', async () => {
    const { pool } = crearPoolFalso();
    servicio = new CalendarioService(pool, { cache });

    const registrado = await servicio.registrarFeriadoExcepcional(
      esquemaFeriadoExcepcional.parse({
        fecha: '2026-11-27',
        descripcion: 'Duelo nacional por fallecimiento de autoridad',
        tipo_feriado: 'DUELO_NACIONAL',
      }),
    );
    expect(registrado.id_calendario).toBe('11111111-1111-4111-8111-111111111111');
    expect(registrado.tipo_feriado).toBe('DUELO_NACIONAL');
    expect(registrado.unidad_territorial).toBe('NACIONAL');
    expect(registrado.cache_invalidation).toBe('EMITIDA');
  });

  it('escribe bitácora WORM y evento de outbox dentro de la misma transacción', async () => {
    const { pool, cliente } = crearPoolFalso();
    servicio = new CalendarioService(pool, { cache });

    const registrado = await servicio.registrarFeriadoExcepcional(
      esquemaFeriadoExcepcional.parse({
        fecha: '2026-11-27',
        descripcion: 'Duelo nacional por fallecimiento de autoridad',
        tipo_feriado: 'DUELO_NACIONAL',
      }),
    );
    expect(registrado.id_auditoria).toBe('aud-1');
    expect(registrado.id_evento_outbox).toBe('evt-1');

    const unicos = new Set(cliente.consultas);
    expect(unicos.has('BEGIN')).toBe(true);
    expect(unicos.has('COMMIT')).toBe(true);
    expect(unicos.has('ROLLBACK')).toBe(false);
  });

  it('revierte ante un segundo intento idéntico de la misma fecha', async () => {
    const { pool } = crearPoolFalso();
    servicio = new CalendarioService(pool, { cache });
    const entrada = esquemaFeriadoExcepcional.parse({
      fecha: '2026-11-27',
      descripcion: 'Duelo nacional por fallecimiento de autoridad',
      tipo_feriado: 'DUELO_NACIONAL',
    });

    await servicio.registrarFeriadoExcepcional(entrada);
    await expect(servicio.registrarFeriadoExcepcional(entrada)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('calcularSla refleja de inmediato el feriado excepcional registrado', async () => {
    const { pool } = crearPoolFalso();
    servicio = new CalendarioService(pool, { cache });

    const antes = await servicio.calcularSla('2026-11-16', '2026-11-20');
    expect(antes.dias_habiles_consumidos).toBe(4);
    expect(antes.estado).toBe('NORMAL');

    await servicio.registrarFeriadoExcepcional(
      esquemaFeriadoExcepcional.parse({
        fecha: '2026-11-18',
        descripcion: 'Cierre institucional por mantenimiento de sistemas',
        tipo_feriado: 'INSTITUCIONAL',
      }),
    );

    const despues = await servicio.calcularSla('2026-11-16', '2026-11-20');
    expect(despues.dias_habiles_consumidos).toBe(3);
    expect(despues.dias_habiles_restantes).toBe(27);
  });
});