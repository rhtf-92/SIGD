/**
 * SIGD · IESTP "Suiza" (Pucallpa) — Núcleo 00 CoreLink
 * Motor Analítico MGD-PCM/SEGDI · Servicio matemático de KPIs.
 *
 * Tareas: T-BE-CL-11 (fórmulas oficiales) y T-BE-CL-13 (división por cero).
 *
 * Este módulo concentra DOS responsabilidades que no deben mezclarse:
 *
 *  1. Funciones PURAS de conteo (`horasHabilesEntre`, `diasHabilesEntre`) y de
 *     fórmula (`calcularVtep`, `calcularTpr`, `calcularTro`, `calcularTeo`). No
 *     leen el reloj, no tocan la base de datos y no dependen de la zona horaria
 *     del host, de modo que son verificables sin mocks. Reproducen exactamente
 *     `sigd_tra.fn_mgd_horas_habiles` y `sigd_tra.fn_mgd_dias_habiles_entre` del
 *     script `07_vistas_materializadas_mgd.sql`.
 *
 *  2. Orquestación de lectura (clase `ServicioMgdAnalytics`), que consulta las
 *     vistas materializadas, aplica las MISMAS fórmulas puras sobre los
 *     contadores crudos y cachea el resultado.
 *
 * Por qué las fórmulas se aplican en TypeScript y no se leen del SQL: la vista
 * materializada almacena los porcentajes por área, pero el consolidado
 * institucional NO es el promedio de esos porcentajes. Promediar tasas es el error
 * clásico de los tableros executives: un área con 2 expedientes no debe pesar
 * tanto como un área con 2 000. Al volver a dividir las sumas con estas funciones
 * se garantiza que `total` y `Σ áreas` sean el mismo hecho contable.
 */

import {
  CONTADORES_VACIOS,
  DIAS_HABILES_PLAZO,
  META_TEO,
  META_TPR_HORAS_HABILES,
  META_TRO,
  META_VTEP,
  UNIDAD_SIN_AREA,
  type ContadoresMgd,
  type CuelloBotellaArea,
  type IndicadorMgd,
  type PuntoTendencia,
  type ResumenKpisMgd,
  type ResultadoRefrescoMgd,
  type RiesgoCuelloBotella,
  type Semaforo,
  type TramoRetencion,
} from './mgdAnalytics.types.js';
import type { CacheDistribuida } from '../identicore/ubigeo.service.js';
import type { RepositorioMgdAnalytics } from './mgdAnalytics.repository.js';
import {
  MINUTOS_APERTURA,
  MINUTOS_CORTE,
  esDiaHabil,
  obtenerPartesLima,
  sumarDias,
} from '../tramicore/horarioCorte.util.js';

const MS_DIA = 86_400_000;

/**
 * Techo de días de iteración de las funciones de conteo. No es una política de
 * negocio sino una guarda contra entradas patológicas: un `timestamptz` corrupto
 * (año 9999) convertiría un bucle de días hábiles en un DoS de CPU dentro de un
 * endpoint HTTP. 100 años cubren cualquier ventana de reporte institucional y
 * dejan el error explícito en vez de un tiempo de cómputo indefinido.
 */
const DIAS_MAXIMOS = 36_525;

/** Décimales de las horas hábiles; coincide con el `ROUND(..., 4)` del SQL. */
const DECIMALES_HORAS = 4;
/** Décimales de los porcentajes; coincide con el `ROUND(..., 2)` del SQL. */
const DECIMALES_PORCENTAJE = 2;

/**
 * Redondeo bancario-seguro.
 *
 * `Math.round` opera sobre la representación binaria, donde 1.005 puede ser
 * 1.00499999999999989 y el resultado baja un centésimo. Sumar `EPSILON` corrige el
 * caso clásico de los porcentajes; no resuelve todo el error de coma flotante,
 * pero evita que el tablero prorruntee decimales por debajo de lo que dice el
 * SQL para la misma operación.
 */
function redondear(valor: number, decimales: number): number {
  if (!Number.isFinite(valor)) return 0;
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

/** Acumula contadores; entrada inmutable (las filas de `pg` no se tocan). */
export function sumarContadores(
  ...grupos: readonly Readonly<ContadoresMgd>[]
): ContadoresMgd {
  return grupos.reduce<ContadoresMgd>((total, grupo) => ({
    nRadicados: total.nRadicados + grupo.nRadicados,
    nAtendidos: total.nAtendidos + grupo.nAtendidos,
    nArchivados: total.nArchivados + grupo.nArchivados,
    nResueltos: total.nResueltos + grupo.nResueltos,
    nEnTramite: total.nEnTramite + grupo.nEnTramite,
    nObservados: total.nObservados + grupo.nObservados,
    nResueltosDentroPlazo: total.nResueltosDentroPlazo + grupo.nResueltosDentroPlazo,
    horasHabilesSuma: total.horasHabilesSuma + grupo.horasHabilesSuma,
  }), { ...CONTADORES_VACIOS });
}

// =============================================================================
// FÓRMULAS OFICIALES MGD-PCM
//
// Cada una protege el denominador. El plan maestro (T-BE-CL-13) documenta el
// incidente que motiva esto: un mes o un área sin expedientes radicados lanzaba
// `Division by zero` y tumbaba el tablero entero. Aquí un denominador no positivo
// devuelve 0 en vez de propagar NaN, Infinity o una excepción.
// =============================================================================

/**
 * VTEP — Volumen Total de Expedientes Procesados.
 * `VTEP = (N_atendidos + N_archivados) / N_radicados × 100`. Meta ≥ 95 %.
 *
 * `N_atendidos` es la pestaña ATENDIDOS (RESUELTO) y `N_archivados` la ARCHIVADOS;
 * los expedientes en trámite no suman al numerador porque aún no han sido
 * procesados, que es justamente lo que el indicador mide.
 */
export function calcularVtep(
  nRadicados: number,
  nAtendidos: number,
  nArchivados: number,
): number {
  if (!Number.isFinite(nRadicados) || nRadicados <= 0) return 0;
  return redondear(((nAtendidos + nArchivados) / nRadicados) * 100, DECIMALES_PORCENTAJE);
}

/**
 * TPR — Tiempo Promedio de Respuesta en horas hábiles.
 * `TPR = Σ HorasHábiles(FechaIngreso, FechaResolucion) / N`. Meta ≤ 24 h hábiles.
 *
 * `nResueltos` (RESUELTO o ARCHIVADO) es el denominador y el numerador sólo
 * acumula horas de expedientes efectivamente resueltos: el tiempo de espera de un
 * pendiente no es tiempo de respuesta, y sumarlo degradaría falsamente la
 * métrica de celeridad.
 */
export function calcularTpr(horasHabilesSuma: number, nResueltos: number): number {
  if (!Number.isFinite(nResueltos) || nResueltos <= 0) return 0;
  return redondear(horasHabilesSuma / nResueltos, DECIMALES_HORAS);
}

/**
 * TRO — Tasa de Resolucion Oportuna.
 * `TRO = N_resueltos_con_permanencia_≤_30_días_hábiles / N_resueltos × 100`.
 * Meta ≥ 90 %.
 */
export function calcularTro(nResueltosDentroPlazo: number, nResueltos: number): number {
  if (!Number.isFinite(nResueltos) || nResueltos <= 0) return 0;
  return redondear((nResueltosDentroPlazo / nResueltos) * 100, DECIMALES_PORCENTAJE);
}

/**
 * TEO — Tasa de Expedientes Observados.
 * `TEO = N_observados / N_en_trámite × 100`. Meta ≤ 5 %.
 *
 * El denominador es `N_en_trámite` (EN_REVISION + OBSERVADO + SUBSANADO) y no el
 * total de expedientes: un RESUELTO no observado no puede degradar la tasa, y un
 * REGISTRADO aún no evaluable tampoco debe contarse como fallo de calidad.
 */
export function calcularTeo(nObservados: number, nEnTramite: number): number {
  if (!Number.isFinite(nEnTramite) || nEnTramite <= 0) return 0;
  return redondear((nObservados / nEnTramite) * 100, DECIMALES_PORCENTAJE);
}

/**
 * Aplica las cuatro fórmulas a un juego de contadores.
 *
 * Es el ÚNICO punto donde se derivan los indicadores del tablero, y es el mismo
 * para el consolidado y para cada área. De ahí que la suma de las filas por área
 * no pueda divergir del total: no hay una segunda implementación que pueda
 * desincronizarse.
 */
export function calcularIndicadoresMgd(
  contadores: Readonly<ContadoresMgd>,
): ResumenKpisMgd {
  const vtep = calcularVtep(contadores.nRadicados, contadores.nAtendidos, contadores.nArchivados);
  const tpr = calcularTpr(contadores.horasHabilesSuma, contadores.nResueltos);
  const tro = calcularTro(contadores.nResueltosDentroPlazo, contadores.nResueltos);
  const teo = calcularTeo(contadores.nObservados, contadores.nEnTramite);

  return {
    periodo: null,
    vtep: evaluarIndicador(vtep, META_VTEP, 'minimo'),
    tprHorasHabiles: evaluarIndicador(tpr, META_TPR_HORAS_HABILES, 'maximo'),
    tro: evaluarIndicador(tro, META_TRO, 'minimo'),
    teo: evaluarIndicador(teo, META_TEO, 'maximo'),
    totalExpedientesEnTramite: contadores.nEnTramite,
    totalExpedientesAtendidos: contadores.nAtendidos + contadores.nArchivados,
    contadores: { ...contadores },
    actualizadoEn: null,
  };
}

/** Marca de cumplimiento según si la meta es un piso (`minimo`) o un tope (`maximo`). */
function evaluarIndicador(
  valor: number,
  meta: number,
  sentido: 'minimo' | 'maximo',
): IndicadorMgd {
  return {
    valor,
    meta,
    cumple: sentido === 'minimo' ? valor >= meta : valor <= meta,
  };
}

/**
 * Semáforo de un indicador. La banda ámbar es el 90 % de la meta: un KPI que
 * toca la meta exacta pero roza el límite no es "cumple con holgura", y el
 * tablero necesita distinguir el estado para que la Dirección actúe antes de que
 * el indicador caiga.
 */
export function semaforoIndicador(
  valor: number,
  meta: number,
  sentido: 'minimo' | 'maximo',
): Semaforo {
  if (sentido === 'minimo') {
    if (valor >= meta) return 'VERDE';
    return valor >= meta * 0.9 ? 'AMARILLO' : 'ROJO';
  }
  if (valor <= meta) return 'VERDE';
  return valor <= meta * 1.1 ? 'AMARILLO' : 'ROJO';
}

// =============================================================================
// TIEMPO HÁBIL INSTITUCIONAL (espejo en TypeScript de las funciones SQL)
// =============================================================================

/**
 * Instante de una hora civil de Lima a partir de `YYYY-MM-DD` y minutos del dia.
 *
 * `America/Lima` es UTC-05:00 fijo desde 2019, asi que el desplazamiento es
 * aritmetica y el resultado no depende de la zona horaria del host donde corran
 * las pruebas ni de la base de datos de zonas horarias del servidor PostgreSQL.
 */
function instanteEnLima(fecha: string, minutosDelDia: number): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 0, 0, 0) + (minutosDelDia + 5 * 60) * 60_000);
}

/**
 * Horas hábiles institucionales entre dos instantes.
 *
 * Réplica de `sigd_tra.fn_mgd_horas_habiles`: recorre los días civiles de
 * `America/Lima` entre ambos extremos y suma el solape con la ventana de
 * atención 08:00–16:30, excluyendo sábados, domingos y feriados. El recorte del
 * primer y del último día es lo que hace que una radicación a las 09:20 con
 * resolución a las 11:00 rinda 1,67 h y no las 8,5 h del día completo.
 *
 * Es la corrección de T-BE-CL-11: contar el reloj de pared hacía que el sistema
 * concluyera falsamente que la institución incumplía la celeridad de la PCM,
 * porque los fines de semana y los feriados se sumaban al tiempo de respuesta.
 */
export function horasHabilesEntre(
  desde: Date,
  hasta: Date,
  feriados: ReadonlySet<string> = new Set<string>(),
): number {
  if (!Number.isFinite(desde.getTime()) || !Number.isFinite(hasta.getTime())) return 0;
  if (hasta.getTime() <= desde.getTime()) return 0;

  const diaDesde = obtenerPartesLima(desde).fecha;
  const diaHasta = obtenerPartesLima(hasta).fecha;

  const diasTotales = (Date.parse(`${diaHasta}T00:00:00Z`)
    - Date.parse(`${diaDesde}T00:00:00Z`)) / MS_DIA;
  if (diasTotales > DIAS_MAXIMOS) {
    throw new RangeError(
      `VENTANA_TEMPORAL_EXCESIVA: ${diasTotales} days exceden el maximo analizable de ${DIAS_MAXIMOS}.`,
    );
  }

  // El recorte se aplica POR DIA, no una sola vez sobre el rango: el primer dia
  // solo puede aportar desde la hora real de radicacion y el ultimo solo hasta la
  // hora real de resolucion. Calcular un unico solape con el dia inicial y
  // aplicarlo a todos los dias devuelve cero en cuanto el rango cruza de dia, que
  // es justo el caso de un expediente radicado un viernes por la tarde y resuelto
  // el lunes por la manana: el caso mas frecuente de todos.
  let minutos = 0;
  let dia = diaDesde;
  while (dia <= diaHasta) {
    if (esDiaHabil(dia, feriados)) {
      const apertura = instanteEnLima(dia, MINUTOS_APERTURA);
      const corte = instanteEnLima(dia, MINUTOS_CORTE);
      const inicioEfectivo = dia === diaDesde && desde > apertura ? desde : apertura;
      const finEfectivo = dia === diaHasta && hasta < corte ? hasta : corte;
      const solapeMinutos = (finEfectivo.getTime() - inicioEfectivo.getTime()) / 60_000;
      if (solapeMinutos > 0) minutos += solapeMinutos;
    }
    dia = sumarDias(dia, 1);
  }
  return redondear(minutos / 60, DECIMALES_HORAS);
}

/**
 * Días hábiles de permanencia entre dos instantes.
 *
 * Réplica de `sigd_tra.fn_mgd_dias_habiles_entre` y de `calcularSla` de RutaDoc:
 * el día inicial NO consume plazo y el final SÍ. Es a propósito la misma magnitud
 * con la que el semáforo SLA evalúa los 30 días hábiles, de modo que TRO y el
 * semáforo no pueden discrepar sobre un mismo expediente.
 */
export function diasHabilesEntre(
  desde: Date,
  hasta: Date,
  feriados: ReadonlySet<string> = new Set<string>(),
): number {
  if (!Number.isFinite(desde.getTime()) || !Number.isFinite(hasta.getTime())) return 0;
  if (hasta.getTime() <= desde.getTime()) return 0;

  let dia = sumarDias(obtenerPartesLima(desde).fecha, 1);
  const diaFinal = obtenerPartesLima(hasta).fecha;

  const diasTotales = (Date.parse(`${diaFinal}T00:00:00Z`) - Date.parse(`${dia}T00:00:00Z`)) / MS_DIA;
  if (diasTotales > DIAS_MAXIMOS) {
    throw new RangeError(
      `VENTANA_TEMPORAL_EXCESIVA: ${diasTotales} días exceden el máximo analizable de ${DIAS_MAXIMOS}.`,
    );
  }

  let contados = 0;
  while (dia <= diaFinal) {
    if (esDiaHabil(dia, feriados)) contados += 1;
    dia = sumarDias(dia, 1);
  }
  return contados;
}

// =============================================================================
// TRAMOS DE PERMANENCIA Y SEMÁFORO DE CUELLO DE BOTELLA
// =============================================================================

/**
 * Límites inferiores de los ocho tramos de `mv_tiempos_retencion_area`, en días
 * hábiles. El orden es el del SQL y NO se altera: los identificadores de tramo son
 * la clave de grain de la vista materializada.
 */
export const LIMITES_TRAMOS = Object.freeze([
  0, 6, 11, 16, 21, 31, 46, 61,
] as const);

/**
 * Devuelve el identificador del tramo al que pertenece una permanencia en días
 * hábiles. Espejo del `CASE` del script DDL; el tablero y la vista deben clasificar
 * un expediente en el mismo tramo o el porcentaje del área no cuadraría.
 */
export function tramoDePermanencia(diasHabiles: number): string {
  if (diasHabiles <= 5) return '01_00_05';
  if (diasHabiles <= 10) return '02_06_10';
  if (diasHabiles <= 15) return '03_11_15';
  if (diasHabiles <= 20) return '04_16_20';
  if (diasHabiles <= 30) return '05_21_30';
  if (diasHabiles <= 45) return '06_31_45';
  if (diasHabiles <= 60) return '07_46_60';
  return '08_MAS_60';
}

/**
 * Alinea el umbral solicitado por el cliente a un borde de tramo.
 *
 * La vista materializada guarda la distribución POR TRAMO, no el expediente. Un
 * `diasLimite` que cayera dentro de un tramo obligaría a elegir entre contar de más
 * o de menos; en vez de devolver un número arbitrario se sube al borde siguiente,
 * con lo que `expedientesEstancados` es siempre un subconjunto exacto. El valor
 * aplicado se devuelve en `diasLimiteAplicado` para que la interfaz no insinúe una
 * precisión que el dato no tiene.
 */
export function alinearUmboloATramo(diasLimite: number): number {
  const limite = Math.max(0, Math.floor(diasLimite));
  const borde = LIMITES_TRAMOS.find((candidato) => limite < candidato);
  // Por encima del último borde no hay tramo superior: todo es "estancado".
  return borde ?? Number.POSITIVE_INFINITY;
}

/**
 * Riesgo de cuello de botella por permanencia promedio en días hábiles.
 * Los cortes coinciden con el plazo legal de 30 días hábiles y con los tramos de la
 * vista materializada: 30 días hábiles es la frontera entre "en plazo" y "fuera de
 * plazo" en el resto del sistema, y reutilizarla evita un segundo calendario de
 * umbrales que pudiera divergir del semáforo SLA.
 */
export function riesgoPorPermanencia(diasHabilesPromedio: number): RiesgoCuelloBotella {
  if (diasHabilesPromedio <= DIAS_HABILES_PLAZO) return 'bajo';
  if (diasHabilesPromedio <= 45) return 'medio';
  return 'alto';
}

// =============================================================================
// ORQUESTACIÓN
// =============================================================================

/**
 * Claves de caché.
 *
 * Se versionan por período y no se borran: `CacheDistribuida` sólo expone `get` y
 * `set`, sin borrado, así que la invalidación se consigue por TTL (cinco minutos)
 * y por el cambio de clave. Un refresco de la vista materializada queda visible a
 * lo sumo en un TTL, que es la ventana aceptable para un tablero ejecutivo.
 */
const CACHE_RESUMEN = (periodo: string | null) => `cache:mgd:resumen:${periodo ?? 'todo'}`;
const CACHE_CUELLOS = (periodo: string | null, diasLimite: number) =>
  `cache:mgd:cuellos:${periodo ?? 'todo'}:${diasLimite}`;
const CACHE_TENDENCIAS = (anio: number) => `cache:mgd:tendencias:${anio}`;

/** TTL corto: el dato es de un refresco programado, no de un catálogo estático. */
const TTL_SEGUNDOS = 300;

/** Tramos esperados de la vista materializada, para rellenar meses sin datos. */
const TRAMOS = Object.freeze([
  '01_00_05', '02_06_10', '03_11_15', '04_16_20', '05_21_30', '06_31_45', '07_46_60', '08_MAS_60',
] as const);

export interface OpcionesMgdAnalytics {
  /** Caché de la analítica. Opcional: sin ella el servicio lee siempre la vista. */
  cache?: CacheDistribuida;
  /** Reloj inyectable para no depender del reloj de pared en las pruebas. */
  ahora?: () => number;
}

export class ServicioMgdAnalytics {
  constructor(
    private readonly repositorio: RepositorioMgdAnalytics,
    private readonly opciones: OpcionesMgdAnalytics = {},
  ) {}

  private ahora(): number {
    return (this.opciones.ahora ?? Date.now)();
  }

  private async deCache<T>(clave: string, calcular: () => Promise<T>): Promise<T> {
    const cache = this.opciones.cache;
    if (!cache) return calcular();
    try {
      const crudo = await cache.get(clave);
      if (crudo !== null) return JSON.parse(crudo) as T;
    } catch {
      // Una caché caída no puede tumbar un tablero: se recalcula. Se ignora el
      // error a propósito en vez de propagarlo al cliente.
    }
    const valor = await calcular();
    try {
      await cache.set(clave, JSON.stringify(valor), TTL_SEGUNDOS);
    } catch {
      // Ídem: escribir en caché es una optimización, no un requisito.
    }
    return valor;
  }

  /**
   * Tablero consolidado (#50).
   *
   * `periodo` en formato `YYYY-MM` acota a un mes; `null` agrega todo el histórico
   * disponible. Los KPIs se recalculan desde los contadores crudos, nunca se suman
   * los porcentajes por área.
   */
  async resumen(periodo: string | null): Promise<ResumenKpisMgd> {
    return this.deCache(CACHE_RESUMEN(periodo), async () => {
      const filas = await this.repositorio.obtenerContadores(periodo);
      const contadores = sumarContadores(...filas.map((fila) => fila.contadores));
      const base = calcularIndicadoresMgd(contadores);
      const actualizaciones = filas
        .map((fila) => fila.actualizadoEn)
        .filter((valor): valor is string => typeof valor === 'string');
      return {
        ...base,
        periodo,
        // La marca de refresco más reciente es la que gobierna la vista.
        actualizadoEn: actualizaciones.length > 0
          ? actualizaciones.reduce((max, valor) => (valor > max ? valor : max))
          : null,
      };
    });
  }

  /**
   * Series mensual de radicados vs. atendidos (#52).
   *
   * Se devuelven los doce meses del año, incluidos los que no tienen
   *idimensionalidad: una serie con huecos hace que el frontend dibuje meses
   * intermedios como cero, cuando en realidad son "sin datos".
   */
  async tendencias(anio: number): Promise<PuntoTendencia[]> {
    return this.deCache(CACHE_TENDENCIAS(anio), async () => {
      const porPeriodo = new Map<string, PuntoTendencia>();
      for (const fila of await this.repositorio.obtenerTendencias(anio)) {
        const mes = Number(fila.periodo.slice(5, 7));
        porPeriodo.set(fila.periodo, {
          mes,
          radicados: fila.contadores.nRadicados,
          atendidos: fila.contadores.nAtendidos + fila.contadores.nArchivados,
          observados: fila.contadores.nObservados,
        });
      }
      return Array.from({ length: 12 }, (_, indice) => {
        const clave = `${anio}-${String(indice + 1).padStart(2, '0')}`;
        return porPeriodo.get(clave) ?? { mes: indice + 1, radicados: 0, atendidos: 0, observados: 0 };
      });
    });
  }

  /**
   * Ranking de cuellos de botella (#51) y distribución de permanencia (#52 según
   * §20).
   *
   * La permanencia promedio del área es la media de las medias de cada tramo
   * pesada por `n_expedientes`. Es exactamente la media del área — la media de
   * medias sólo Sesga cuando los grupos tienen pesos distintos, y aquí el peso es
   * precisamente el tamaño del grupo — y evita releer la tabla de expedientes en
   * un endpoint del tablero.
   */
  async cuellosBotella(
    periodo: string | null,
    diasLimite: number,
    nombres: ReadonlyMap<string, { nombre: string; sigla: string | null }>,
  ): Promise<CuelloBotellaArea[]> {
    const limiteAplicado = alinearUmboloATramo(diasLimite);
    return this.deCache(CACHE_CUELLOS(periodo, diasLimite), async () => {
      const porArea = new Map<string, TramoAcumulado>();
      for (const tramo of await this.repositorio.obtenerRetencion(periodo)) {
        const id = tramo.unidadOrganicaId;
        const acumulado = porArea.get(id) ?? {
          nExpedientes: 0,
          sumaDiasPonderada: 0,
          sumaHorasPonderada: 0,
          nEstancados: 0,
          tramos: new Map<string, TramoRetencion>(),
        };
        acumulado.nExpedientes += tramo.nExpedientes;
        acumulado.sumaDiasPonderada += tramo.promedioDiasHabiles * tramo.nExpedientes;
        acumulado.sumaHorasPonderada += tramo.promedioHorasHabiles * tramo.nExpedientes;
        if (tramo.limiteInferiorDias >= limiteAplicado) {
          acumulado.nEstancados += tramo.nExpedientes;
        }
        acumulado.tramos.set(tramo.tramo, {
          tramo: tramo.tramo,
          nExpedientes: tramo.nExpedientes,
          porcentajeDelArea: tramo.porcentajeDelArea,
        });
        porArea.set(id, acumulado);
      }

      const areas = Array.from(porArea.entries()).map(([areaId, acumulado]) => {
        const diasRetencion = acumulado.nExpedientes > 0
          ? redondear(acumulado.sumaDiasPonderada / acumulado.nExpedientes, DECIMALES_HORAS)
          : 0;
        const nombre = nombres.get(areaId);
        return {
          areaId,
          areaNombre: nombre?.nombre ?? (areaId === UNIDAD_SIN_AREA ? 'Sin unidad asignada' : areaId),
          sigla: nombre?.sigla ?? null,
          expedientes: acumulado.nExpedientes,
          expedientesEstancados: acumulado.nEstancados,
          diasRetencion,
          horasPromedioRetencion: acumulado.nExpedientes > 0
            ? redondear(acumulado.sumaHorasPonderada / acumulado.nExpedientes, DECIMALES_HORAS)
            : 0,
          porcentajeEstancado: acumulado.nExpedientes > 0
            ? redondear((acumulado.nEstancados / acumulado.nExpedientes) * 100, DECIMALES_PORCENTAJE)
            : 0,
          riesgo: riesgoPorPermanencia(diasRetencion),
          estado: riesgoPorPermanencia(diasRetencion).toUpperCase(),
          diasLimiteAplicado: Number.isFinite(limiteAplicado) ? limiteAplicado : diasLimite,
        } satisfies CuelloBotellaArea;
      });

      // Orden de cuello de botella: primero el mayor volumen estancado y, a igual
      // volumen, la mayor permanencia promedio. El desempate por nombre mantiene
      // el ranking estable entre refrescos, que si no haría parpadear el tablero
      // sin que haya cambiado ningún dato.
      return areas.sort((a, b) => b.expedientesEstancados - a.expedientesEstancados
        || b.diasRetencion - a.diasRetencion
        || a.areaNombre.localeCompare(b.areaNombre, 'es'));
    });
  }

  /** Distribución por tramo de una unidad, para el mapa de calor del frontend. */
  async distribucionRetencion(periodo: string | null): Promise<Map<string, TramoRetencion[]>> {
    const porArea = new Map<string, TramoRetencion[]>();
    for (const tramo of await this.repositorio.obtenerRetencion(periodo)) {
      const lista = porArea.get(tramo.unidadOrganicaId) ?? [];
      lista.push({
        tramo: tramo.tramo,
        nExpedientes: tramo.nExpedientes,
        porcentajeDelArea: tramo.porcentajeDelArea,
      });
      porArea.set(tramo.unidadOrganicaId, lista);
    }
    for (const lista of porArea.values()) {
      lista.sort((a, b) => a.tramo.localeCompare(b.tramo));
    }
    return porArea;
  }

  /**
   * Refresco concurrente de las vistas materializadas (#51 según §20).
   *
   * `REFRESH ... CONCURRENTLY` no admite transacción explícita ni es idempotente
   * bajo concurrencia: sólo puede correr un refresco por vista a la vez. El
   * repositorio lo serializa con `pg_try_advisory_lock`; si otra petición ya lo
   * tiene, esta responde `refrescoYaEnCurso` en lugar de esperar o fallar, porque
   * un 409 en un tablero ejecutivo es peor que un dato de hace cinco minutos.
   */
  async refrescar(): Promise<ResultadoRefrescoMgd> {
    const inicio = this.ahora();
    const resultado = await this.repositorio.refrescarVistasMgd();
    return { ...resultado, duracionMs: this.ahora() - inicio };
  }
}

interface TramoAcumulado {
  nExpedientes: number;
  sumaDiasPonderada: number;
  sumaHorasPonderada: number;
  nEstancados: number;
  tramos: Map<string, TramoRetencion>;
}

export { TRAMOS };
