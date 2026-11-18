/**
 * SIGD · IESTP "Suiza" (Pucallpa) — Núcleo 00 CoreLink
 * Suite matemática de las 4 fórmulas MGD-PCM y del tiempo hábil institucional.
 *
 * Tareas: T-BE-CL-13 (división por cero) y T-BE-CL-11 (exclusividad del tiempo
 * hábil).
 *
 * Estas pruebas cubren los dos errores que el plan maestro documenta como
 * verificados:
 *   * `Division by zero` cuando un mes o un área no tenía expedientes radicados.
 *   * TPR/TRO/TEO contados sobre el reloj de pared, que sumaba fines de semana y
 *     feriados y hacía creer que la institución incumplía la celeridad de la PCM.
 *
 * Las funciones son puras: no leen el reloj ni la base de datos, así que no
 * requieren dobles de prueba y los casos límite son exactamente reproducibles.
 *
 * Las fechas de los plazos NO se escriben a mano cuando existe una fuente
 * institucional: se derivan de `calcularSla` de RutaDoc. Un literal calculado a
 * mano en la prueba es una segunda implementación de la regla que puede quedar
 * desalineada de la real sin que nadie lo note.
 */

import { describe, expect, it } from 'vitest';
import {
  alinearUmboloATramo,
  calcularIndicadoresMgd,
  calcularTeo,
  calcularTro,
  calcularTpr,
  calcularVtep,
  diasHabilesEntre,
  horasHabilesEntre,
  riesgoPorPermanencia,
  semaforoIndicador,
  ServicioMgdAnalytics,
  sumarContadores,
  tramoDePermanencia,
} from '../../../../src/domains/corelink/mgdAnalytics.service.js';
import {
  CONTADORES_VACIOS,
  META_TEO,
  META_TPR_HORAS_HABILES,
  META_TRO,
  META_VTEP,
} from '../../../../src/domains/corelink/mgdAnalytics.types.js';
import {
  anioEnLima,
  filtrosCuellosBotellaSchema,
} from '../../../../src/domains/corelink/reportes.schemas.js';
import { obtenerPartesLima } from '../../../../src/domains/tramicore/horarioCorte.util.js';
import { calcularSla } from '../../../../src/domains/rutadoc/sla.service.js';

/**
 * Construye un instante a partir de su fecha civil en Lima y sus minutos del día.
 *
 * `America/Lima` es UTC-05:00 fijo desde 2019, así que el desplazamiento es
 * aritmética y no depende de la zona horaria del host donde corran las pruebas.
 */
function instanteEnLima(fecha: string, minutosDelDia: number): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const utc = Date.UTC(anio, mes - 1, dia, 0, 0, 0) + (minutosDelDia + 5 * 60) * 60_000;
  return new Date(utc);
}

const APERTURA = 8 * 60;
const CORTE = 16 * 60 + 30;

/** Fecha civil del trigésimo día hábil contado desde `fechaInicio`. */
function limiteDeTreintaHabiles(fechaInicio: string, fechaCalculo: string): string {
  return calcularSla({ fechaInicio, fechaActual: fechaCalculo }).fechaLimite;
}

describe('calcularVtep: (N_atendidos + N_archivados) / N_radicados × 100', () => {
  it('01 calcula el porcentaje sobre el radicado total', () => {
    expect(calcularVtep(100, 90, 5)).toBe(95);
  });

  it('02 cuenta RESUELTO y ARCHIVADO como procesados', () => {
    expect(calcularVtep(4, 3, 1)).toBe(100);
  });

  it('03 excluye a los expedientes aún en trámite del numerador', () => {
    // 8 radicados, 3 resueltos y 2 en trámite: sólo 3 han sido procesados.
    expect(calcularVtep(8, 3, 0)).toBe(37.5);
  });

  it('04 devuelve 0 cuando no hay radicados en vez de dividir entre cero', () => {
    expect(calcularVtep(0, 0, 0)).toBe(0);
    expect(calcularVtep(0, 5, 5)).toBe(0);
  });

  it('05 no propaga NaN ni Infinity con un denominador no positivo', () => {
    expect(calcularVtep(-1, 3, 2)).toBe(0);
    expect(calcularVtep(Number.NaN, 1, 1)).toBe(0);
    expect(calcularVtep(Number.POSITIVE_INFINITY, 1, 1)).toBe(0);
  });

  it('06 puede superar 100 si el numerador excede al radicado', () => {
    // Posible al agregar períodos: un archivo del mes anterior se resuelve en
    // este. Se conserva la razón; el tablero, no la función, decide si lo señala.
    expect(calcularVtep(10, 12, 0)).toBe(120);
  });
});

describe('calcularTpr: Σ horas hábiles / N resueltos', () => {
  it('01 promedia las horas hábiles de los resueltos', () => {
    expect(calcularTpr(50, 2)).toBe(25);
  });

  it('02 devuelve 0 sin resueltos aunque haya horas acumuladas', () => {
    // Una suma de horas sin denominador es un agregado incoherente; el KPI debe
    // ser 0, no Infinity ni NaN.
    expect(calcularTpr(100, 0)).toBe(0);
  });

  it('03 conserva los decimales de la suma de horas', () => {
    expect(calcularTpr(10.5, 3)).toBe(3.5);
  });

  it('04 distingue horas hábiles de horas calendario', () => {
    // De lunes a viernes son 42,5 horas hábiles, no las 120 del reloj de pared.
    const desde = instanteEnLima('2026-09-21', APERTURA);
    const hasta = instanteEnLima('2026-09-25', CORTE);
    expect(horasHabilesEntre(desde, hasta)).toBe(42.5);
    expect(calcularTpr(horasHabilesEntre(desde, hasta), 1)).toBe(42.5);
    const diasDeReloj = (hasta.getTime() - desde.getTime()) / 3_600_000;
    expect(diasDeReloj).toBeGreaterThan(100);
  });
});

describe('calcularTro: N_resueltos_≤_30_días_hábiles / N_resueltos × 100', () => {
  it('01 calcula la tasa de resoluciones oportunas', () => {
    expect(calcularTro(95, 100)).toBe(95);
  });

  it('02 devuelve 0 sin resueltos en vez de dividir entre cero', () => {
    expect(calcularTro(0, 0)).toBe(0);
  });

  it('03 llega a 100 cuando todos los resueltos fueron oportunos', () => {
    expect(calcularTro(7, 7)).toBe(100);
  });

  it('04 un plazo de 30 días hábiles no es 30 días calendario', () => {
    // La fecha límite la calcula `calcularSla`, que ya sabe saltar fines de semana
    // y feriados. 30 días hábiles ocupan unas seis semanas de calendario:
    // contando días calendario el sistema declararía oportuno lo que en realidad
    // venció, y TRO sobreestimaría la eficacia de la institución.
    const fechaInicio = '2026-09-21';
    const limite = limiteDeTreintaHabiles(fechaInicio, '2026-12-31');
    const desde = instanteEnLima(fechaInicio, APERTURA);
    const hasta = instanteEnLima(limite, APERTURA);

    expect(diasHabilesEntre(desde, hasta)).toBe(30);
    const diasCalendario = (hasta.getTime() - desde.getTime()) / 86_400_000;
    expect(diasCalendario).toBeGreaterThan(40);
  });
});

describe('calcularTeo: N_observados / N_en_trámite × 100', () => {
  it('01 mide la calidad de la tabla sobre lo que sigue en trámite', () => {
    expect(calcularTeo(2, 100)).toBe(2);
  });

  it('02 devuelve 0 cuando no hay expedientes en trámite', () => {
    expect(calcularTeo(0, 0)).toBe(0);
    expect(calcularTeo(5, 0)).toBe(0);
  });

  it('03 un observado cuenta también dentro del denominador', () => {
    // OBSERVADO pertenece a la pestaña EN_TRAMITE, así que sube numerador y
    // denominador a la vez: 1 de 4 observados, no 1 de 3.
    expect(calcularTeo(1, 4)).toBe(25);
  });

  it('04 llega a 100 cuando todo lo que está en trámite fue observado', () => {
    expect(calcularTeo(10, 10)).toBe(100);
  });
});

describe('División por cero: los cuatro KPIs con un área vacía', () => {
  it('05 los cuatro indicadores quedan en 0 y ninguno es NaN', () => {
    const resumen = calcularIndicadoresMgd(CONTADORES_VACIOS);
    for (const valor of [
      resumen.vtep.valor,
      resumen.tprHorasHabiles.valor,
      resumen.tro.valor,
      resumen.teo.valor,
    ]) {
      expect(Number.isNaN(valor)).toBe(false);
      expect(valor).toBe(0);
    }
    expect(resumen.totalExpedientesEnTramite).toBe(0);
    expect(resumen.totalExpedientesAtendidos).toBe(0);
  });

  it('06 un área sin radicados no cumple ninguna meta', () => {
    const resumen = calcularIndicadoresMgd(CONTADORES_VACIOS);
    // Es lo correcto: 0 % no alcanza la meta del 95 %. Un tablero que mostrara
    // "cumple" sobre una unidad sin expedientes sería un falso positivo de gestión.
    expect(resumen.vtep.cumple).toBe(false);
    expect(resumen.tro.cumple).toBe(false);
    expect(resumen.vtep.meta).toBe(META_VTEP);
  });

  it('07 el consolidado se recalcula desde los contadores, no desde los porcentajes', () => {
    // Dos áreas: una de 1 expediente (100 %) y otra de 99 (0 %). La media
    // aritmética de porcentajes daría 50 %; la verdad es 1 de 100 = 1 %.
    const areaA = {
      ...CONTADORES_VACIOS, nRadicados: 1, nAtendidos: 1,
      nResueltos: 1, nResueltosDentroPlazo: 1, horasHabilesSuma: 1,
    };
    const areaB = { ...CONTADORES_VACIOS, nRadicados: 99 };
    const resumen = calcularIndicadoresMgd(sumarContadores(areaA, areaB));
    expect(resumen.vtep.valor).toBe(1);
    expect(resumen.vtep.cumple).toBe(false);
  });
});

describe('Cumplimiento de metas y semáforo', () => {
  it('08 marca cumple según si la meta es piso o tope', () => {
    expect(calcularIndicadoresMgd({ ...CONTADORES_VACIOS, nRadicados: 100, nAtendidos: 95 }).vtep.cumple).toBe(true);
    expect(calcularIndicadoresMgd({ ...CONTADORES_VACIOS, nRadicados: 100, nAtendidos: 94 }).vtep.cumple).toBe(false);
    // TEO y TPR son topes: menos es mejor.
    expect(calcularIndicadoresMgd({ ...CONTADORES_VACIOS, nEnTramite: 100, nObservados: 5 }).teo.cumple).toBe(true);
    expect(calcularIndicadoresMgd({ ...CONTADORES_VACIOS, nEnTramite: 100, nObservados: 6 }).teo.cumple).toBe(false);
  });

  it('09 las metas coinciden con el plan maestro §4.7', () => {
    expect(META_VTEP).toBe(95);
    expect(META_TPR_HORAS_HABILES).toBe(24);
    expect(META_TRO).toBe(90);
    expect(META_TEO).toBe(5);
  });

  it('10 el semáforo diferencia el contacto con la meta del alejamiento', () => {
    expect(semaforoIndicador(95, META_VTEP, 'minimo')).toBe('VERDE');
    expect(semaforoIndicador(90, META_VTEP, 'minimo')).toBe('AMARILLO');
    expect(semaforoIndicador(80, META_VTEP, 'minimo')).toBe('ROJO');
    expect(semaforoIndicador(24, META_TPR_HORAS_HABILES, 'maximo')).toBe('VERDE');
    expect(semaforoIndicador(26, META_TPR_HORAS_HABILES, 'maximo')).toBe('AMARILLO');
  });
});

describe('horasHabilesEntre: tiempo hábil institucional 08:00–16:30', () => {
  it('11 recorre la jornada completa de un día hábil', () => {
    expect(horasHabilesEntre(
      instanteEnLima('2026-09-21', APERTURA),
      instanteEnLima('2026-09-21', CORTE),
    )).toBe(8.5);
  });

  it('12 excluye sábado y domingo', () => {
    expect(horasHabilesEntre(
      instanteEnLima('2026-09-26', APERTURA),
      instanteEnLima('2026-09-26', CORTE),
    )).toBe(0);
    expect(horasHabilesEntre(
      instanteEnLima('2026-09-27', APERTURA),
      instanteEnLima('2026-09-27', CORTE),
    )).toBe(0);
  });

  it('13 excluye un feriado configurado', () => {
    const feriados = new Set(['2026-09-24']);
    expect(horasHabilesEntre(
      instanteEnLima('2026-09-24', APERTURA),
      instanteEnLima('2026-09-24', CORTE),
      feriados,
    )).toBe(0);
  });

  it('14 recorta el primer y el último día a la ventana de atención', () => {
    expect(horasHabilesEntre(
      instanteEnLima('2026-09-21', 9 * 60 + 20),
      instanteEnLima('2026-09-21', 11 * 60),
    )).toBeCloseTo(1.6667, 4);
  });

  it('15 no cuenta horas anteriores a la apertura ni posteriores al corte', () => {
    expect(horasHabilesEntre(
      instanteEnLima('2026-09-21', 5 * 60),
      instanteEnLima('2026-09-21', 7 * 60),
    )).toBe(0);
    expect(horasHabilesEntre(
      instanteEnLima('2026-09-21', 18 * 60),
      instanteEnLima('2026-09-21', 22 * 60),
    )).toBe(0);
  });

  it('16 un viernes por la tarde y un lunes por la mañana cruza el fin de semana', () => {
    // Viernes 15:00→16:30 son 1,5 h; lunes 08:00→10:00 son 2 h. Sábado y domingo
    // no aportan. Éste es el caso que un solape calculado una sola vez sobre el
    // rango devolvería en cero, porque 10:00 del lunes es anterior a las 15:00 del
    // viernes.
    expect(horasHabilesEntre(
      instanteEnLima('2026-09-25', 15 * 60),
      instanteEnLima('2026-09-28', 10 * 60),
    )).toBe(3.5);
  });

  it('17 devuelve 0 con fechas nulas, inválidas o invertidas', () => {
    expect(horasHabilesEntre(new Date(Number.NaN), instanteEnLima('2026-09-21', CORTE))).toBe(0);
    const apertura = instanteEnLima('2026-09-21', APERTURA);
    expect(horasHabilesEntre(apertura, apertura)).toBe(0);
    expect(horasHabilesEntre(instanteEnLima('2026-09-25', APERTURA), apertura)).toBe(0);
  });

  it('18 rechaza una ventana patológica en vez de consumir la CPU', () => {
    expect(() => horasHabilesEntre(
      instanteEnLima('1900-01-01', APERTURA),
      instanteEnLima('9999-12-31', CORTE),
    )).toThrow(/VENTANA_TEMPORAL_EXCESIVA/);
  });

  /**
   * Anclas contra PostgreSQL 18.3 real.
   *
   * Estos valores NO se derivan a mano: son la salida de
   * `sigd_tra.fn_mgd_horas_habiles` y `fn_mgd_dias_habiles_entre` consultadas en
   * la base, sobre ventanas que cruzan fines de semana y el feriado del 12 de
   * octubre. Existen para que la paridad SQL <-> TypeScript siga teniendo una
   * señal cuando no hay cluster disponible, ya que la suite de integración que
   * la verifica exhaustivamente se omite sin `DATABASE_URL`.
   *
   * Se fijaron después de corregir dos defectos de conversión de zona horaria en
   * el SQL que esta suite en TypeScript nunca pudo ver: la ventana con `desde`
   * anterior a la apertura era la que ambos concordaban mal, porque las dos
   * implementations arrastraban el mismo error de origen.
   */
  describe('anclas verificadas contra fn_mgd_horas_habiles en PostgreSQL 18.3', () => {
    const feriados = new Set(['2026-10-12']);

    it('19a una ventana que empieza antes de la apertura y termina a media mañana', () => {
      // Miércoles 07:00 → miércoles 09:00, con un feriado el lunes 12 entre medio.
      // Antes de corregir la zona horaria el SQL recortaba el primer día y
      // devolvía 76,5 en vez de 77,5.
      expect(horasHabilesEntre(
        instanteEnLima('2026-09-30', 7 * 60),
        instanteEnLima('2026-10-14', 9 * 60),
        feriados,
      )).toBe(77.5);
    });

    it('19b la misma ventana, más corta, conserva el día de corte completo', () => {
      expect(horasHabilesEntre(
        instanteEnLima('2026-09-30', 7 * 60),
        instanteEnLima('2026-10-05', 17 * 60),
        feriados,
      )).toBe(34);
    });

    it('19c los días hábiles del rango ignoran el feriado intermedio', () => {
      expect(diasHabilesEntre(
        instanteEnLima('2026-09-30', 7 * 60),
        instanteEnLima('2026-10-21', 1 * 60),
        feriados,
      )).toBe(14);
    });
  });
});

describe('diasHabilesEntre: el día inicial no consume plazo', () => {
  it('19 el mismo día no cuenta como permanencia', () => {
    expect(diasHabilesEntre(
      instanteEnLima('2026-09-21', APERTURA),
      instanteEnLima('2026-09-21', CORTE),
    )).toBe(0);
  });

  it('20 cuenta el día siguiente si es hábil', () => {
    expect(diasHabilesEntre(
      instanteEnLima('2026-09-21', APERTURA),
      instanteEnLima('2026-09-22', APERTURA),
    )).toBe(1);
  });

  it('21 no cuenta el fin de semana ni el feriado intermedio', () => {
    // Del jueves al lunes hay cinco días naturales; el día de origen no cuenta, y
    // de los restantes sólo el viernes y el lunes son hábiles.
    expect(diasHabilesEntre(
      instanteEnLima('2026-09-24', APERTURA),
      instanteEnLima('2026-09-28', APERTURA),
    )).toBe(2);
    expect(diasHabilesEntre(
      instanteEnLima('2026-09-24', APERTURA),
      instanteEnLima('2026-09-28', APERTURA),
      new Set(['2026-09-25']),
    )).toBe(1);
  });

  it('22 aplica exactamente la misma regla que el semáforo SLA de RutaDoc', () => {
    // Se contrasta contra `calcularSla` en vez de contra fechas fijas escritas a
    // mano: si las dos reglas dejaran de coincidir, esta prueba lo detecta aunque
    // ambas siguieran siendo internamente consistentes.
    const feriados = new Set(['2026-09-24', '2026-10-12']);
    for (const hasta of ['2026-09-25', '2026-10-05', '2026-11-09', '2026-12-24']) {
      expect(diasHabilesEntre(
        instanteEnLima('2026-09-21', APERTURA),
        instanteEnLima(hasta, CORTE),
        feriados,
      )).toBe(calcularSla({
        fechaInicio: '2026-09-21',
        fechaActual: hasta,
        diasNoLaborables: feriados,
      }).diasHabilesTranscurridos);
    }
  });
});

describe('Tramos de permanencia y umbral de estancamiento', () => {
  it('23 clasifica en los ocho tramos del script DDL', () => {
    expect(tramoDePermanencia(0)).toBe('01_00_05');
    expect(tramoDePermanencia(5)).toBe('01_00_05');
    expect(tramoDePermanencia(6)).toBe('02_06_10');
    expect(tramoDePermanencia(30)).toBe('05_21_30');
    expect(tramoDePermanencia(60)).toBe('07_46_60');
    expect(tramoDePermanencia(61)).toBe('08_MAS_60');
  });

  it('24 alinea el umbral a un borde de tramo para no contar de más ni de menos', () => {
    expect(alinearUmboloATramo(5)).toBe(6);
    expect(alinearUmboloATramo(0)).toBe(6);
    expect(alinearUmboloATramo(6)).toBe(11);
    expect(alinearUmboloATramo(100)).toBe(Number.POSITIVE_INFINITY);
  });

  it('25 el riesgo usa los cortes institucionales de días hábiles', () => {
    expect(riesgoPorPermanencia(20)).toBe('bajo');
    expect(riesgoPorPermanencia(30)).toBe('bajo');
    expect(riesgoPorPermanencia(31)).toBe('medio');
    expect(riesgoPorPermanencia(45)).toBe('medio');
    expect(riesgoPorPermanencia(46)).toBe('alto');
  });
});

describe('Validación de la query de reportes', () => {
  it('26 aplica el valor por defecto de diasLimite que envía el frontend', () => {
    expect(filtrosCuellosBotellaSchema.parse({}).diasLimite).toBe(5);
  });

  it('27 rechaza un período con formato inválido y un límite absurdo', () => {
    expect(() => filtrosCuellosBotellaSchema.parse({ periodo: '2026-13' })).toThrow();
    expect(() => filtrosCuellosBotellaSchema.parse({ diasLimite: -1 })).toThrow();
    expect(() => filtrosCuellosBotellaSchema.parse({ diasLimite: 9999 })).toThrow();
  });

  it('28 rechaza un parámetro desconocido en vez de ignorarlo', () => {
    expect(() => filtrosCuellosBotellaSchema.parse({ diaslimite: 5 })).toThrow();
  });

  it('29 toma el año en Lima y no en la zona del host', () => {
    // 31 de diciembre a las 20:00 en Lima ya es 1 de enero en UTC. Un host en
    // UTC+14 pediría el año siguiente y el tablero volvería vacío.
    const instante = instanteEnLima('2026-12-31', 20 * 60);
    expect(obtenerPartesLima(instante).fecha).toBe('2026-12-31');
    expect(anioEnLima(instante)).toBe(2026);
  });
});

describe('Servicio: agregación y degradación sin caché', () => {
  const contadoresDeSeptiembre = {
    nRadicados: 100,
    nAtendidos: 90,
    nArchivados: 5,
    nResueltos: 95,
    nEnTramite: 10,
    nObservados: 1,
    nResueltosDentroPlazo: 90,
    horasHabilesSuma: 1900,
  };

  const repositorioFalso = {
    obtenerContadores: async () => [{
      periodo: '2026-09',
      actualizadoEn: '2026-10-01T00:00:00.000Z',
      contadores: contadoresDeSeptiembre,
    }],
    obtenerTendencias: async () => [
      {
        periodo: '2026-09',
        actualizadoEn: null,
        contadores: { ...CONTADORES_VACIOS, nRadicados: 10, nAtendidos: 8 },
      },
    ],
    obtenerRetencion: async () => [
      {
        unidadOrganicaId: 'UA', tramo: '01_00_05', limiteInferiorDias: 0, nExpedientes: 8,
        promedioDiasHabiles: 3, promedioHorasHabiles: 12, porcentajeDelArea: 80,
      },
      {
        unidadOrganicaId: 'UA', tramo: '06_31_45', limiteInferiorDias: 31, nExpedientes: 2,
        promedioDiasHabiles: 40, promedioHorasHabiles: 120, porcentajeDelArea: 20,
      },
    ],
    refrescarVistasMgd: async () => ({
      vistas: ['sigd_tra.mv_kpis_mgd_mensual'],
      duracionMs: 5,
      refrescoYaEnCurso: false,
    }),
  };

  it('30 el consolidado aplica las fórmulas a los contadores crudos', async () => {
    const servicio = new ServicioMgdAnalytics(repositorioFalso as never);
    const resumen = await servicio.resumen(null);
    expect(resumen.vtep.valor).toBe(95);
    expect(resumen.tprHorasHabiles.valor).toBe(20);
    // 90 / 95 = 94,7368… → 94,74 con dos decimales.
    expect(resumen.tro.valor).toBe(94.74);
    expect(resumen.teo.valor).toBe(10);
    expect(resumen.totalExpedientesAtendidos).toBe(95);
  });

  it('31 las tendencias devuelven los doce meses del año', async () => {
    const servicio = new ServicioMgdAnalytics(repositorioFalso as never);
    const serie = await servicio.tendencias(2026);
    expect(serie).toHaveLength(12);
    expect(serie[8]).toEqual({ mes: 9, radicados: 10, atendidos: 8, observados: 0 });
    expect(serie[0]).toEqual({ mes: 1, radicados: 0, atendidos: 0, observados: 0 });
  });

  it('32 el cuello de botella consolida la permanencia por área y cuenta estancados', async () => {
    const servicio = new ServicioMgdAnalytics(repositorioFalso as never);
    const areas = await servicio.cuellosBotella(
      '2026-09',
      30,
      new Map([['UA', { nombre: 'Unidad A', sigla: 'UA' }]]),
    );
    expect(areas).toHaveLength(1);
    // Media ponderada exacta: (8 × 3 + 2 × 40) / 10 = 10,4 días hábiles.
    expect(areas[0].diasRetencion).toBeCloseTo(10.4, 4);
    expect(areas[0].expedientes).toBe(10);
    expect(areas[0].expedientesEstancados).toBe(2);
    expect(areas[0].areaNombre).toBe('Unidad A');
  });

  it('33 degrada a un nombre legible cuando OrganiCore no está instalado', async () => {
    const servicio = new ServicioMgdAnalytics(repositorioFalso as never);
    const areas = await servicio.cuellosBotella(null, 5, new Map());
    expect(areas[0].areaNombre).toBe('UA');
    expect(areas[0].sigla).toBeNull();
  });

  it('34 una caché caída no tumba el tablero', async () => {
    const cache = {
      get: async () => { throw new Error('Redis no disponible'); },
      set: async () => { throw new Error('Redis no disponible'); },
    };
    const servicio = new ServicioMgdAnalytics(repositorioFalso as never, { cache });
    await expect(servicio.resumen(null)).resolves.toBeDefined();
  });
});
