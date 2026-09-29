/**
 * Suite unitaria del calendario laboral de OrganiCore (T-BE-OC-16).
 *
 * Cubre el motor de cómputo de días hábiles (Art. 143 TUO Ley N° 27444) con el
 * calendario de `sigd_org.calendario_laboral`: feriados nacionales, feriados
 * regionales de Ucayali, feriados excepcionales, duplicidad, fechas inválidas,
 * rangos, fines de semana y días de feriado.
 *
 * Es una suite pura: no levanta PostgreSQL ni Testcontainers, porque la lógica
 * de cómputo es una función del calendario inyectado. La persistencia, la
 * unicidad real y la transacción ACID se validan en la suite E2E.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  aFechaIso,
  aInstanteUtc,
  calendarioDelAnio,
  compararFechas,
  contarDiasHabiles,
  desplazarDias,
  diaSemana,
  esDiaLaborable,
  esFechaValida,
  esFeriado,
  esFinDeSemana,
  indexarCalendario,
  listarDiasNoLaborables,
  primerDiaHabil,
  proximoDiaHabil,
  sumarDiasHabiles,
  type DiaCalendario,
  type TipoFeriado,
  type UnidadTerritorial,
} from '../../../../src/domains/organicore/calendario.habiles.js';
import { CalendarioService, construirVistaCalendario } from '../../../../src/domains/organicore/calendario.service.js';
import { CacheMemoria } from '../../../../src/shared/cache/cache-memoria.js';
import { ConflictError, ValidationError } from '../../../../src/shared/domain/errors/index.js';
import {
  esquemaConsultaCalendario,
  esquemaFeriadoExcepcional,
} from '../../../../src/domains/organicore/calendario.schemas.js';

/**
 * Calendario institucional 2026 tal como lo deja el DDL
 * `docs/02_organicore/11_esquema_calendario_laboral.sql`: 14 feriados
 * nacionales (D. Leg. N° 713) y 2 feriados regionales de Ucayali.
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
// 1. Validación de fechas
// ---------------------------------------------------------------------------
describe('calendario laboral · validación de fechas', () => {
  it('acepta fechas ISO reales del calendario', () => {
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

  it('convierte y formatea fechas sin desvíos de zona horaria', () => {
    expect(aFechaIso(aInstanteUtc('2026-06-24'))).toBe('2026-06-24');
    expect(desplazarDias('2026-06-24', 1)).toBe('2026-06-25');
    expect(desplazarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(compararFechas('2026-01-02', '2026-01-01')).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Fines de semana
// ---------------------------------------------------------------------------
describe('calendario laboral · fines de semana', () => {
  it('identifica sábados y domingos', () => {
    expect(esFinDeSemana('2026-05-09')).toBe(true); // sábado
    expect(esFinDeSemana('2026-05-10')).toBe(true); // domingo
    expect(esFinDeSemana('2026-05-08')).toBe(false); // viernes
    expect(diaSemana('2026-05-10')).toBe(0);
    expect(diaSemana('2026-05-11')).toBe(1);
  });

  it('un fin de semana nunca es día laborable, aunque el calendario esté vacío', () => {
    expect(esDiaLaborable('2026-05-09', [])).toBe(false);
    expect(esDiaLaborable('2026-05-10', [])).toBe(false);
  });

  it('lunes a viernes es laborable cuando no hay excepción en el calendario', () => {
    expect(esDiaLaborable('2026-05-04', CALENDARIO_2026)).toBe(true);
    expect(esDiaLaborable('2026-05-08', CALENDARIO_2026)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Feriados nacionales y regionales de Ucayali
// ---------------------------------------------------------------------------
describe('calendario laboral · feriados del calendario institucional', () => {
  it('detecta los feriados nacionales del D. Leg. N° 713', () => {
    for (const fecha of ['2026-01-01', '2026-05-01', '2026-07-28', '2026-07-29', '2026-12-25']) {
      expect(esFeriado(fecha, CALENDARIO_2026)).toBe(true);
      expect(esDiaLaborable(fecha, CALENDARIO_2026)).toBe(false);
    }
  });

  it('detecta los feriados regionales de Ucayali', () => {
    expect(esFeriado('2026-06-24', CALENDARIO_2026)).toBe(true); // San Juan Bautista
    expect(esFeriado('2026-10-13', CALENDARIO_2026)).toBe(true); // Aniversario de Pucallpa
    expect(esDiaLaborable('2026-06-24', CALENDARIO_2026)).toBe(false);
    expect(esDiaLaborable('2026-10-13', CALENDARIO_2026)).toBe(false);
  });

  it('un feriado que cae en fin de semana no altera el cómputo (ya no es laborable)', () => {
    // 2026-06-07 (domingo) y 2026-11-01 (domingo): el fin de semana ya lo excluía.
    expect(esFinDeSemana('2026-06-07')).toBe(true);
    expect(esFeriado('2026-06-07', CALENDARIO_2026)).toBe(true);
    expect(esDiaLaborable('2026-06-07', CALENDARIO_2026)).toBe(false);
  });

  it('no considera las filas dadas de baja (activo = false)', () => {
    const calendarioConBaja = CALENDARIO_2026.map((fila) =>
      fila.fecha === '2026-06-24' ? { ...fila, activo: false } : fila,
    );
    expect(esFeriado('2026-06-24', calendarioConBaja)).toBe(false);
    expect(esDiaLaborable('2026-06-24', calendarioConBaja)).toBe(true);
  });

  it('la habilitación laborable expresa prevalece sobre el feriado previo', () => {
    const conHabilitacion: DiaCalendario[] = [
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
    expect(indexarCalendario(conHabilitacion).get('2026-06-24')?.es_laborable).toBe(true);
    expect(esDiaLaborable('2026-06-24', conHabilitacion)).toBe(true);
    expect(esFeriado('2026-06-24', conHabilitacion)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Cálculo de días hábiles (Art. 143 LPAG)
// ---------------------------------------------------------------------------
describe('calendario laboral · cómputo de días hábiles', () => {
  it('cuenta 4 días hábiles de una semana completa sin feriados', () => {
    // Lunes 2026-05-04 a viernes 2026-05-08; la fecha de inicio no se cuenta.
    expect(contarDiasHabiles('2026-05-04', '2026-05-08', CALENDARIO_2026)).toBe(4);
  });

  it('descuenta el feriado regional de Ucayali del 24 de junio', () => {
    // Semana del 22 al 26 de junio: 23, 24 (San Juan), 25 y 26.
    expect(contarDiasHabiles('2026-06-22', '2026-06-26', CALENDARIO_2026)).toBe(3);
  });

  it('descuenta los dos feriados nacionales de Fiestas Patrias', () => {
    // Semana del 27 al 31 de julio: 28 y 29 son feriados nacionales.
    expect(contarDiasHabiles('2026-07-27', '2026-07-31', CALENDARIO_2026)).toBe(2);
  });

  it('devuelve 0 cuando ambas fechas coinciden', () => {
    expect(contarDiasHabiles('2026-05-04', '2026-05-04', CALENDARIO_2026)).toBe(0);
  });

  it('devuelve negativo cuando el rango es inverso, preservando el orden', () => {
    expect(contarDiasHabiles('2026-05-08', '2026-05-04', CALENDARIO_2026)).toBe(-4);
  });

  it('rechaza rangos con fechas inválidas', () => {
    expect(() => contarDiasHabiles('2026-02-30', '2026-03-10', CALENDARIO_2026)).toThrow(RangeError);
    expect(() => contarDiasHabiles('2026-03-01', '2026-13-01', CALENDARIO_2026)).toThrow(RangeError);
  });

  it('proyecta los 30 días hábiles del plazo legal (Art. 143) sin feriados en el trayecto', () => {
    expect(sumarDiasHabiles('2026-05-04', 30, CALENDARIO_2026)).toBe('2026-06-15');
  });

  it('alarga la proyección cuando el calendario declara un feriado en el trayecto', () => {
    // Del 22 de junio: 23, 24 (feriado regional), 25, 26, 29 (feriado nacional), 30, ...
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

  it('salta al siguiente día hábil desde un viernes y desde un feriado', () => {
    expect(proximoDiaHabil('2026-05-08', CALENDARIO_2026)).toBe('2026-05-11');
    expect(proximoDiaHabil('2026-06-24', CALENDARIO_2026)).toBe('2026-06-25');
    expect(primerDiaHabil('2026-06-24', CALENDARIO_2026)).toBe('2026-06-25');
    expect(primerDiaHabil('2026-06-23', CALENDARIO_2026)).toBe('2026-06-23');
    expect(primerDiaHabil('2026-06-20', CALENDARIO_2026)).toBe('2026-06-22');
  });
});

// ---------------------------------------------------------------------------
// 5. Feriados excepcionales
// ---------------------------------------------------------------------------
describe('calendario laboral · feriados excepcionales', () => {
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
    expect(esFeriado('2026-10-28', conDuelo)).toBe(true);
    expect(esDiaLaborable('2026-10-28', conDuelo)).toBe(false);
    // Semana del 26 al 30 de octubre: 27, 28 (duelo), 29 y 30.
    expect(contarDiasHabiles('2026-10-26', '2026-10-30', conDuelo)).toBe(3);
    expect(contarDiasHabiles('2026-10-26', '2026-10-30', CALENDARIO_2026)).toBe(4);
  });

  it('un feriado institucional por resolución tiene el mismo efecto', () => {
    const institucional: DiaCalendario = {
      fecha: '2026-11-18',
      anio: 2026,
      tipo_feriado: 'INSTITUCIONAL',
      descripcion: 'Cierre institucional por mantenimiento de sistemas',
      unidad_territorial: 'IESTP_SUIZA',
      es_laborable: false,
      base_legal: 'RR. No. 118-2026-IE-SUIZA',
      activo: true,
    };
    const conInstitucional = [...CALENDARIO_2026, institucional];
    // Semana del 16 al 20 de noviembre: 17, 18 (feriado institucional), 19 y 20.
    expect(contarDiasHabiles('2026-11-16', '2026-11-20', conInstitucional)).toBe(3);
    expect(contarDiasHabiles('2026-11-16', '2026-11-20', CALENDARIO_2026)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 6. Rangos de fechas y enumeración de días no laborables
// ---------------------------------------------------------------------------
describe('calendario laboral · rangos de fechas', () => {
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

  it('devuelve una lista vacía para un rango de un solo día laborable', () => {
    expect(listarDiasNoLaborables('2026-05-04', '2026-05-04', CALENDARIO_2026)).toEqual([]);
  });

  it('rechaza rangos invertidos o con fechas inválidas', () => {
    expect(() => listarDiasNoLaborables('2026-06-28', '2026-06-20', CALENDARIO_2026)).toThrow(RangeError);
    expect(() => listarDiasNoLaborables('2026-02-30', '2026-03-10', CALENDARIO_2026)).toThrow(RangeError);
  });

  it('filtra el calendario por ejercicio fiscal', () => {
    const conOtroAnio: DiaCalendario[] = [
      ...CALENDARIO_2026,
      dia('2027-01-01', 'NACIONAL', 'NACIONAL', 'Año Nuevo'),
    ];
    expect(calendarioDelAnio(conOtroAnio, 2027)).toHaveLength(1);
    expect(calendarioDelAnio(conOtroAnio, 2026)).toHaveLength(CALENDARIO_2026.length);
  });
});

// ---------------------------------------------------------------------------
// 7. Consolidado de vista por tipo de feriado
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
// 8. Validación Zod del feriado excepcional
// ---------------------------------------------------------------------------
describe('calendario laboral · validación Zod', () => {
  const entradaValida = {
    fecha: '2026-11-27',
    descripcion: 'Duelo nacional por fallecimiento de autoridad',
    tipo_feriado: 'DUELO_NACIONAL',
  };

  it('acepta una entrada válida y deriva la unidad territorial del tipo', () => {
    const datos = esquemaFeriadoExcepcional.parse(entradaValida);
    expect(datos.fecha).toBe('2026-11-27');
    expect(datos.tipo_feriado).toBe('DUELO_NACIONAL');
    expect(datos.unidad_territorial).toBe('NACIONAL');
    expect(datos.es_laborable).toBe(false);
  });

  it('deriva IESTP_SUIZA para el tipo institucional y UCAYALI para el regional', () => {
    expect(
      esquemaFeriadoExcepcional.parse({ ...entradaValida, tipo_feriado: 'INSTITUCIONAL' })
        .unidad_territorial,
    ).toBe('IESTP_SUIZA');
    expect(
      esquemaFeriadoExcepcional.parse({ ...entradaValida, tipo_feriado: 'REGIONAL_UCAYALI' })
        .unidad_territorial,
    ).toBe('UCAYALI');
  });

  it('rechaza fechas inexistentes o mal formateadas', () => {
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, fecha: '2026-02-30' })).toThrow();
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, fecha: '27-11-2026' })).toThrow();
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, fecha: '' })).toThrow();
  });

  it('rechaza descripciones demasiado cortas o ausentes', () => {
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, descripcion: 'x' })).toThrow();
    expect(() => esquemaFeriadoExcepcional.parse({ ...entradaValida, descripcion: '   ' })).toThrow();
    const sinDescripcion: Record<string, unknown> = { fecha: '2026-11-27', tipo_feriado: 'DUELO_NACIONAL' };
    expect(() => esquemaFeriadoExcepcional.parse(sinDescripcion)).toThrow();
  });

  it('rechaza tipos de feriado fuera del catálogo', () => {
    expect(() =>
      esquemaFeriadoExcepcional.parse({ ...entradaValida, tipo_feriado: 'PROVINCIAL' }),
    ).toThrow();
  });

  it('rechaza unidades territoriales no admitidas', () => {
    expect(() =>
      esquemaFeriadoExcepcional.parse({ ...entradaValida, unidad_territorial: 'LIMA' }),
    ).toThrow();
  });

  it('rechaza campos desconocidos (strict)', () => {
    expect(() =>
      esquemaFeriadoExcepcional.parse({ ...entradaValida, prioridad: 1 }),
    ).toThrow();
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
    expect(() => esquemaConsultaCalendario.parse({ desde: '2026-02-30' })).toThrow();
  });

  it('rechaza un rango de fechas invertido en la propia capa de validación', () => {
    const invertido = esquemaConsultaCalendario.safeParse({
      desde: '2026-12-01',
      hasta: '2026-01-01',
    });
    expect(invertido.success).toBe(false);
    expect(invertido.error?.issues[0]?.path).toEqual(['desde']);
    expect(invertido.error?.issues[0]?.message).toContain('posterior a');

    // Rangos coherentes, incluidos los de un solo día, siguen siendo válidos.
    expect(esquemaConsultaCalendario.parse({ desde: '2026-01-01', hasta: '2026-12-31' })).toBeTruthy();
    expect(esquemaConsultaCalendario.parse({ desde: '2026-05-01', hasta: '2026-05-01' })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 9. Duplicidad, transacción y señal de invalidación de caché
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
  return { pool, cliente, lecturas: () => lecturas };
}

describe('calendario laboral · duplicidad y señal de invalidación', () => {
  let cache: CacheMemoria<DiaCalendario[]>;
  let servicio: CalendarioService;

  beforeEach(() => {
    cache = new CacheMemoria<DiaCalendario[]>(24 * 60 * 60 * 1000);
  });

  it('rechaza con 409 el registro duplicado de (fecha, unidad_territorial)', async () => {
    const { pool, cliente } = crearPoolFalso({ fechasExistentes: ['2026-11-27'] });
    servicio = new CalendarioService(pool, { cache });
    const entrada = esquemaFeriadoExcepcional.parse({
      fecha: '2026-11-27',
      descripcion: 'Duelo nacional por fallecimiento de autoridad',
      tipo_feriado: 'DUELO_NACIONAL',
    });

    await expect(servicio.registrarFeriadoExcepcional(entrada)).rejects.toBeInstanceOf(ConflictError);
    // La transacción se revierte: no se escribe ni bitácora ni outbox.
    expect(cliente.consultas).toContain('BEGIN');
    expect(cliente.consultas).toContain('ROLLBACK');
    expect(cliente.consultas.some((c) => c.includes('INSERT INTO sigd_audit'))).toBe(false);
  });

  it('acepta el primer registro y revierte ante un segundo intento idéntico', async () => {
    const { pool } = crearPoolFalso();
    servicio = new CalendarioService(pool, { cache });
    const entrada = esquemaFeriadoExcepcional.parse({
      fecha: '2026-11-27',
      descripcion: 'Duelo nacional por fallecimiento de autoridad',
      tipo_feriado: 'DUELO_NACIONAL',
    });

    const registrado = await servicio.registrarFeriadoExcepcional(entrada);
    expect(registrado.id_calendario).toBe('11111111-1111-4111-8111-111111111111');
    expect(registrado.cache_invalidation).toBe('EMITIDA');

    await expect(servicio.registrarFeriadoExcepcional(entrada)).rejects.toBeInstanceOf(ConflictError);
  });

  it('escribe bitácora WORM y evento de outbox dentro de la misma transacción', async () => {
    const { pool, cliente } = crearPoolFalso();
    servicio = new CalendarioService(pool, { cache });
    const entrada = esquemaFeriadoExcepcional.parse({
      fecha: '2026-11-27',
      descripcion: 'Duelo nacional por fallecimiento de autoridad',
      tipo_feriado: 'DUELO_NACIONAL',
    });

    const registrado = await servicio.registrarFeriadoExcepcional(entrada);
    expect(registrado.id_auditoria).toBe('aud-1');
    expect(registrado.id_evento_outbox).toBe('evt-1');

    const unicos = new Set(cliente.consultas);
    expect(unicos.has('BEGIN')).toBe(true);
    expect(unicos.has('COMMIT')).toBe(true);
    expect(unicos.has('ROLLBACK')).toBe(false);
  });

  it('la caché se puebla una vez y se invalida tras el alta del feriado', async () => {
    const { pool, lecturas } = crearPoolFalso();
    servicio = new CalendarioService(pool, { cache });

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

  it('calcularSla rechaza fechas inválidas con 400', async () => {
    const { pool } = crearPoolFalso();
    servicio = new CalendarioService(pool, { cache });
    await expect(servicio.calcularSla('2026-02-30', '2026-03-10')).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
