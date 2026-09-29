/**
 * Servicio del calendario laboral (T-BE-OC-13, T-BE-OC-14 y T-BE-OC-16).
 *
 * Reglas de la capa de servicio del proyecto: orquesta la transacción, aplica
 * las reglas de negocio, encola el evento de dominio en el Transactional Outbox
 * dentro de la misma transacción y levanta los errores de dominio. No conoce
 * `req`/`res` de Express ni devuelve respuestas HTTP: devuelve datos de dominio
 * y lanza `AppError`, que `src/middleware/error-middleware.ts` traduce a RFC 9457.
 *
 * Reutiliza los mecanismos transversales que ya existen en el repositorio:
 *   - `registrarMutacion` → bitácora forense WORM (`sigd_audit.bitacora_auditoria`).
 *   - `insertarEvento`    → Transactional Outbox (`sigd_audit.evento_outbox`).
 * No se crea un bus de eventos ni un sistema de caché paralelo.
 */

import type { Pool } from 'pg';
import { ConflictError, ValidationError } from '../../shared/domain/errors/index.js';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { CacheMemoria } from '../../shared/cache/cache-memoria.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import {
  calendarioDelAnio,
  contarDiasHabiles,
  esDiaLaborable,
  esFechaValida,
  esFeriado,
  esFinDeSemana,
  listarDiasNoLaborables,
  primerDiaHabil,
  proximoDiaHabil,
  sumarDiasHabiles,
  type DiaCalendario,
  type TipoFeriado,
  type UnidadTerritorial,
} from './calendario.habiles.js';
import {
  cargarCalendario,
  consultarDiasNoLaborables,
  existeCalendario,
  insertarCalendario,
  listarCalendario,
  type FilaCalendario,
  type FiltroCalendario,
} from './calendario.repository.js';
import type { FeriadoExcepcionalInput } from './calendario.schemas.js';

export * from './calendario.habiles.js';

/** Agregado del dominio en la bitácora y en el outbox. */
export const AGREGADO_CALENDARIO = 'calendario_laboral';

/** Evento de dominio que dispara el recálculo de los semáforos SLA. */
export const EVENTO_FERIADO_EXCEPCIONAL = 'FeriadoExcepcionalRegistrado';

/** Clave de caché del calendario laboral completo. */
export const CLAVE_CACHE_CALENDARIO = 'organicore:calendario-laboral:v1';

/** TTL por defecto del calendario: 24 h (criterio de aceptación 2). */
export const TTL_CALENDARIO_MS = 24 * 60 * 60 * 1000;

export interface FeriadoRegistrado extends DiaCalendario {
  id_calendario: string;
  creado_en: string;
  correlation_id: string;
  cache_invalidation: 'EMITIDA';
  id_evento_outbox: string;
  id_auditoria: string;
}

export interface ResumenSla {
  dias_habiles_consumidos: number;
  dias_habiles_restantes: number;
  plazo_maximo_dias_habiles: number;
  estado: 'NORMAL' | 'ALERTA' | 'CRITICO' | 'VENCIDO';
  fecha_vencimiento_calculada: string;
}

const PLAZO_MAXIMO_DIAS_HABILES = 30;

function mapearFila(fila: FilaCalendario): DiaCalendario {
  return {
    id_calendario: fila.id_calendario,
    fecha: fila.fecha,
    anio: Number(fila.anio),
    tipo_feriado: fila.tipo_feriado,
    descripcion: fila.descripcion,
    unidad_territorial: fila.unidad_territorial,
    es_laborable: fila.es_laborable,
    base_legal: fila.base_legal,
    activo: fila.activo,
  };
}

export interface CalendarioServiceOpciones {
  cache?: CacheMemoria<DiaCalendario[]>;
  ttlMs?: number;
}

export class CalendarioService {
  private readonly pool: Pool;
  private readonly cache: CacheMemoria<DiaCalendario[]>;

  constructor(pool: Pool, opciones: CalendarioServiceOpciones = {}) {
    this.pool = pool;
    this.cache = opciones.cache ?? new CacheMemoria<DiaCalendario[]>(opciones.ttlMs ?? TTL_CALENDARIO_MS);
  }

  /**
   * Lee el calendario institucional vigente, usando la caché en memoria.
   * Tras un alta de feriado, la caché se invalida para que el semáforo SLA de
   * los expedientes activos se recalcule en la siguiente lectura.
   */
  public async obtenerCalendario(): Promise<DiaCalendario[]> {
    const cacheado = this.cache.obtener(CLAVE_CACHE_CALENDARIO);
    if (cacheado) {
      return cacheado;
    }
    const filas = await cargarCalendario(this.pool);
    const calendario = filas.map(mapearFila);
    this.cache.guardar(CLAVE_CACHE_CALENDARIO, calendario);
    return calendario;
  }

  /** Invalida la caché del calendario (señal de refresco tras una mutación). */
  public invalidarCache(): void {
    this.cache.invalidar(CLAVE_CACHE_CALENDARIO);
  }

  public async listar(filtro: FiltroCalendario = {}): Promise<DiaCalendario[]> {
    const filas = await listarCalendario(this.pool, filtro);
    return filas.map(mapearFila);
  }

  public async listarPorAnio(anio: number): Promise<DiaCalendario[]> {
    if (!Number.isInteger(anio)) {
      throw new ValidationError({
        invalidParams: [{ name: 'anio', reason: 'El año debe ser un número entero.' }],
      });
    }
    return this.listar({ anio });
  }

  /** Fechas no laborables registradas en base de datos para el rango, para el SLA. */
  public async diasNoLaborables(desde: string, hasta: string): Promise<string[]> {
    return consultarDiasNoLaborables(this.pool, desde, hasta);
  }

  /**
   * Registra un feriado excepcional (T-BE-OC-14).
   *
   * atomicidad: fila de `sigd_org.calendario_laboral` + asiento en la bitácora
   * WORM + evento en el outbox se escriben en la misma transacción. Después, y
   * sólo si la transacción confirma, se invalida la caché para forzar el
   * recálculo de los días hábiles (criterio de aceptación 1).
   */
  public async registrarFeriadoExcepcional(entrada: FeriadoExcepcionalInput): Promise<FeriadoRegistrado> {
    if (!esFechaValida(entrada.fecha)) {
      throw new ValidationError({
        invalidParams: [{ name: 'fecha', reason: 'La fecha no existe en el calendario.' }],
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const duplicado = await existeCalendario(cliente, entrada.fecha, entrada.unidad_territorial);
      if (duplicado) {
        throw new ConflictError({
          code: 'FERIADO_DUPLICADO',
          message: 'Ya existe un registro en el calendario para esa fecha y unidad territorial.',
          detail: `La fecha ${entrada.fecha} ya está registrada en el calendario laboral para la unidad ${entrada.unidad_territorial}.`,
        });
      }

      const contexto = getRequestContext();
      const fila = await insertarCalendario(cliente, {
        fecha: entrada.fecha,
        tipo_feriado: entrada.tipo_feriado as TipoFeriado | null,
        descripcion: entrada.descripcion,
        unidad_territorial: entrada.unidad_territorial as UnidadTerritorial,
        es_laborable: entrada.es_laborable,
        base_legal: entrada.base_legal ?? null,
        registrado_por: contexto?.usuario_id ?? null,
      });

      const id_auditoria = await registrarMutacion(cliente, {
        esquema: 'sigd_org',
        tabla: 'calendario_laboral',
        operacion: 'INSERT',
        datos_despues: {
          id_calendario: fila.id_calendario,
          fecha: fila.fecha,
          tipo_feriado: fila.tipo_feriado,
          descripcion: fila.descripcion,
          unidad_territorial: fila.unidad_territorial,
          es_laborable: fila.es_laborable,
          base_legal: fila.base_legal,
        },
      });

      const id_evento_outbox = await insertarEvento(cliente, {
        agregado: AGREGADO_CALENDARIO,
        tipo_evento: EVENTO_FERIADO_EXCEPCIONAL,
        payload: {
          id_calendario: fila.id_calendario,
          fecha: fila.fecha,
          tipo_feriado: fila.tipo_feriado,
          descripcion: fila.descripcion,
          unidad_territorial: fila.unidad_territorial,
          es_laborable: fila.es_laborable,
          anio: Number(fila.anio),
          // Señal explícita de invalidación para los consumidores del outbox.
          invalidar_cache: true,
          correlation_id: getRequestContext()?.correlation_id ?? null,
        },
      });

      await cliente.query('COMMIT');

      this.invalidarCache();

      return {
        ...mapearFila(fila),
        id_calendario: fila.id_calendario,
        creado_en: fila.creado_en,
        correlation_id: getRequestContext()?.correlation_id ?? '',
        cache_invalidation: 'EMITIDA',
        id_evento_outbox,
        id_auditoria,
      };
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  /**
   * Recalcula el semáforo SLA de un expediente con el calendario vigente.
   * Es la operación equivalente a `calculateSlaStatus` del frontend, pero
   * resuelta contra `sigd_org.calendario_laboral` para que un feriado
   * excepcional impacte de inmediato a los expedientes en trámite.
   */
  public async calcularSla(
    fechaIngreso: string,
    fechaReferencia: string,
    calendario?: readonly DiaCalendario[],
  ): Promise<ResumenSla> {
    if (!esFechaValida(fechaIngreso) || !esFechaValida(fechaReferencia)) {
      throw new ValidationError({
        invalidParams: [
          { name: 'fecha_ingreso', reason: 'La fecha de ingreso no es válida (YYYY-MM-DD).' },
          { name: 'fecha_referencia', reason: 'La fecha de referencia no es válida (YYYY-MM-DD).' },
        ],
      });
    }

    const vigente = calendario ?? (await this.obtenerCalendario());
    const consumidos = Math.max(0, contarDiasHabiles(fechaIngreso, fechaReferencia, vigente));
    const restantes = PLAZO_MAXIMO_DIAS_HABILES - consumidos;
    const estado: ResumenSla['estado'] =
      restantes < 0 ? 'VENCIDO' : restantes <= 4 ? 'CRITICO' : restantes <= 14 ? 'ALERTA' : 'NORMAL';

    return {
      dias_habiles_consumidos: consumidos,
      dias_habiles_restantes: restantes,
      plazo_maximo_dias_habiles: PLAZO_MAXIMO_DIAS_HABILES,
      estado,
      fecha_vencimiento_calculada: sumarDiasHabiles(fechaIngreso, PLAZO_MAXIMO_DIAS_HABILES, vigente),
    };
  }
}

/**
 * Fábrica funcional equivalente, para consumo directo desde los routers sin
 * estado propio. Comparte caché con la instancia si se le inyecta una.
 */
export function crearCalendarioService(
  pool: Pool,
  opciones: CalendarioServiceOpciones = {},
): CalendarioService {
  return new CalendarioService(pool, opciones);
}

/**
 * Vista consolidada del calendario laboral institucional. Incluye los
 * feriados de fecha fija y la clasificación normativa de cada uno, para que el
 * frontend deje de mantener la lista codificada en `slaCalculator.ts`.
 */
export interface VistaCalendario {
  anio: number;
  total_dias: number;
  dias_no_laborables: number;
  feriados_nacionales: DiaCalendario[];
  feriados_regionales_ucayali: DiaCalendario[];
  feriados_institucionales: DiaCalendario[];
  duelos_nacionales: DiaCalendario[];
  dias_laborables_excepcionales: DiaCalendario[];
  calendario: DiaCalendario[];
}

export function construirVistaCalendario(
  anio: number,
  calendario: readonly DiaCalendario[],
): VistaCalendario {
  const delAnio = calendarioDelAnio(calendario, anio);
  const porTipo = (tipo: TipoFeriado) => delAnio.filter((dia) => dia.tipo_feriado === tipo);
  const noLaborables = delAnio.filter((dia) => !dia.es_laborable);

  return {
    anio,
    total_dias: delAnio.length,
    dias_no_laborables: noLaborables.length,
    feriados_nacionales: porTipo('NACIONAL'),
    feriados_regionales_ucayali: porTipo('REGIONAL_UCAYALI'),
    feriados_institucionales: porTipo('INSTITUCIONAL'),
    duelos_nacionales: porTipo('DUELO_NACIONAL'),
    dias_laborables_excepcionales: delAnio.filter((dia) => dia.es_laborable),
    calendario: delAnio,
  };
}
