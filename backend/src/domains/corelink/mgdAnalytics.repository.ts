/**
 * SIGD · IESTP "Suiza" (Pucallpa) — Núcleo 00 CoreLink
 * Motor Analítico MGD-PCM/SEGDI · Repositorio de vistas materializadas.
 *
 * Tarea: T-BE-CL-12 (lectura analítica de alta velocidad) y T-BE-CL-10.
 *
 * Todas las consultas leen EXCLUSIVAMENTE de las vistas materializadas
 * `sigd_tra.mv_kpis_mgd_mensual` y `sigd_tra.mv_tiempos_retencion_area`, nunca de
 * `sigd_tra.expediente` ni de `sigd_rut.movimiento_tramite`. Esa es la razón de ser
 * del diseño: la analítica del tablero no debe competir por I/O con la mesa de
 * partes, y una consulta de métricas sobre cientos de miles de movimientos
 * bloqueaba las tablas transaccionales durante segundos.
 *
 * Todas las consultas son parametrizadas ($1, $2, ...). No hay concatenación de
 * valores de entrada en el SQL, y el refresco usa literales fijos en vez de
 * `EXECUTE` sobre texto armable: un nombre de vista o de índice nunca debe poder
 * venir de una petición HTTP.
 */

import type { Pool, PoolClient } from 'pg';
import type { ContadoresMgd, ResultadoRefrescoMgd } from './mgdAnalytics.types.js';

/** Clave de lock consultivo para serializar los refrescos concurrentes. */
const LOCK_REFRESCO_MGD = 827_140_051;

/**
 * Vistas refrescadas por el endpoint administrativo. El orden importa: primero los
 * KPIs y después la retención, para que un refresco interrumpido a medias no deje
 * la retención más nueva que los contadores que la originan.
 */
const VISTAS_REFRESCO = Object.freeze([
  'sigd_tra.mv_kpis_mgd_mensual',
  'sigd_tra.mv_tiempos_retencion_area',
] as const);

/**
 * `pg` entrega los `numeric` como CADENA para no perder precisión. Convertirlos en
 * la frontera evita que un `string` se cuele en las fórmulas y se descubra en un
 * `NaN` dentro del tablero. Un `numeric` no numérico o `NaN` degrada a 0: es un
 * dato corrupto en la vista, no una razón para tumbar el tablero entero.
 */
function aNumero(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (typeof valor === 'string') {
    const parseado = Number(valor);
    return Number.isFinite(parseado) ? parseado : 0;
  }
  if (typeof valor === 'bigint') return Number(valor);
  return 0;
}

/** El `periodo` de la vista es `DATE` y llega como `YYYY-MM-DD`. */
function aTextoPeriodo(valor: unknown): string | null {
  if (typeof valor === 'string') return valor.slice(0, 10);
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return null;
}

interface FilaContadores {
  periodo: string | null;
  actualizado_en: Date | string | null;
  n_radicados: unknown;
  n_atendidos: unknown;
  n_archivados: unknown;
  n_resueltos: unknown;
  n_en_tramite: unknown;
  n_observados: unknown;
  n_resueltos_dentro_plazo: unknown;
  horas_habiles_suma: unknown;
}

interface FilaRetencion {
  unidad_organica_id: string;
  tramo_permanencia_dias_habiles: string;
  n_expedientes: unknown;
  promedio_dias_habiles_permanencia: unknown;
  promedio_horas_habiles: unknown;
  porcentaje_del_area: unknown;
}

export interface ContadoresPeriodo {
  periodo: string | null;
  contadores: ContadoresMgd;
  actualizadoEn: string | null;
}

/**
 * Fila mensual con período garantizado.
 *
 * `obtenerTendencias` filtra por un rango de fechas sobre una columna NOT NULL, así
 * que el período nunca es ausente. Se modela aparte en vez de `string | null` para
 * que el consumidor no tenga que narrowing en un bucle y para que un futuro cambio
 * de la consulta no pueda colar un `null` donde el servicio construye la clave
 * `YYYY-MM` de la serie.
 */
export interface ContadoresMes {
  periodo: string;
  contadores: ContadoresMgd;
  actualizadoEn: string | null;
}

export interface TramoRetencionFila {
  unidadOrganicaId: string;
  tramo: string;
  /** Límite inferior en días hábiles del tramo, para el umbral de estancamiento. */
  limiteInferiorDias: number;
  nExpedientes: number;
  promedioDiasHabiles: number;
  promedioHorasHabiles: number;
  porcentajeDelArea: number;
}

/**
 * Identificadores de tramo y su límite inferior en días hábiles. Es el mismo
 * corte que el `CASE` del script DDL; mantenerlo aquí evita que el endpoint tenga
 * que parsear el identificador (`'01_00_05'`) para decidir si un tramo está por
 * encima del umbral solicitado.
 */
const LIMITE_INFERIOR_POR_TRAMO: Readonly<Record<string, number>> = Object.freeze({
  '01_00_05': 0,
  '02_06_10': 6,
  '03_11_15': 11,
  '04_16_20': 16,
  '05_21_30': 21,
  '06_31_45': 31,
  '07_46_60': 46,
  '08_MAS_60': 61,
});

/**
 * Proyección de contadores crudos.
 *
 * Se piden explícitamente las columnas de auditoría en lugar de `SELECT *`: la
 * forma de la fila es parte del contrato de TypeScript y un `*` cambiaría los
 * tipos en silencio si alguien añadiera una columna a la vista.
 */
const PROYECCION_CONTADORES = `
  SELECT to_char(periodo, 'YYYY-MM')                                   AS periodo,
         actualizado_en,
         n_radicados, n_atendidos, n_archivados, n_resueltos,
         n_en_tramite, n_observados, n_resueltos_dentro_plazo,
         horas_habiles_suma
    FROM sigd_tra.mv_kpis_mgd_mensual`;

export class RepositorioMgdAnalytics {
  constructor(private readonly pool: Pool) {}

  /**
   * Contadores crudos por (período, área), o consolidados si `periodo` es `null`.
   *
   * Devuelve las filas SIN agregar cuando hay filtro de período, y una sola fila
   * consolidada cuando no lo hay. El servicio decide cuándo sumar varias filas, de
   * modo que la agregación vive en un único lugar y es testeable sin base de datos.
   */
  async obtenerContadores(periodo: string | null): Promise<ContadoresPeriodo[]> {
    const sql = periodo === null
      ? `SELECT to_char(MIN(periodo), 'YYYY-MM')     AS periodo,
                MAX(actualizado_en)                 AS actualizado_en,
                SUM(n_radicados)                    AS n_radicados,
                SUM(n_atendidos)                    AS n_atendidos,
                SUM(n_archivados)                   AS n_archivados,
                SUM(n_resueltos)                    AS n_resueltos,
                SUM(n_en_tramite)                   AS n_en_tramite,
                SUM(n_observados)                   AS n_observados,
                SUM(n_resueltos_dentro_plazo)       AS n_resueltos_dentro_plazo,
                SUM(horas_habiles_suma)             AS horas_habiles_suma
           FROM sigd_tra.mv_kpis_mgd_mensual`
      : `${PROYECCION_CONTADORES}
          WHERE periodo = $1::date`;

    const valores = periodo === null ? [] : [periodo];
    const { rows } = await this.pool.query<FilaContadores>(sql, valores);
    if (rows.length === 0) return [];
    return rows.map((fila) => ({
      periodo: aTextoPeriodo(fila.periodo),
      actualizadoEn: fila.actualizado_en instanceof Date
        ? fila.actualizado_en.toISOString()
        : typeof fila.actualizado_en === 'string' ? fila.actualizado_en : null,
      contadores: {
        nRadicados: aNumero(fila.n_radicados),
        nAtendidos: aNumero(fila.n_atendidos),
        nArchivados: aNumero(fila.n_archivados),
        nResueltos: aNumero(fila.n_resueltos),
        nEnTramite: aNumero(fila.n_en_tramite),
        nObservados: aNumero(fila.n_observados),
        nResueltosDentroPlazo: aNumero(fila.n_resueltos_dentro_plazo),
        horasHabilesSuma: aNumero(fila.horas_habiles_suma),
      },
    }));
  }

  /** Contadores crudos de los doce meses de un año, para la serie de tendencias. */
  async obtenerTendencias(anio: number): Promise<ContadoresMes[]> {
    const { rows } = await this.pool.query<FilaContadores>(
      `${PROYECCION_CONTADORES}
        WHERE periodo >= make_date($1, 1, 1)::date
          AND periodo <  (make_date($1, 1, 1) + INTERVAL '1 year')::date
        ORDER BY periodo`,
      [anio],
    );
    return rows.flatMap((fila): ContadoresMes[] => {
      const periodo = aTextoPeriodo(fila.periodo);
      // `periodo` es NOT NULL en la vista, así que un `null` aquí indica una fila
      // corrupta. Se descarta en vez de inventar un mes: una serie con un mes
      // desplazado es peor que una serie con un mes de menos.
      if (periodo === null) return [];
      return [{
        periodo,
        contadores: {
          nRadicados: aNumero(fila.n_radicados),
          nAtendidos: aNumero(fila.n_atendidos),
          nArchivados: aNumero(fila.n_archivados),
          nResueltos: aNumero(fila.n_resueltos),
          nEnTramite: aNumero(fila.n_en_tramite),
          nObservados: aNumero(fila.n_observados),
          nResueltosDentroPlazo: aNumero(fila.n_resueltos_dentro_plazo),
          horasHabilesSuma: aNumero(fila.horas_habiles_suma),
        },
        actualizadoEn: fila.actualizado_en instanceof Date
          ? fila.actualizado_en.toISOString()
          : typeof fila.actualizado_en === 'string' ? fila.actualizado_en : null,
      }];
    });
  }

  /** Distribución de permanencia por (período, área, tramo). */
  async obtenerRetencion(periodo: string | null): Promise<TramoRetencionFila[]> {
    const { rows } = await this.pool.query<FilaRetencion>(
      `SELECT unidad_organica_id,
              tramo_permanencia_dias_habiles,
              n_expedientes,
              promedio_dias_habiles_permanencia,
              promedio_horas_habiles,
              porcentaje_del_area
         FROM sigd_tra.mv_tiempos_retencion_area
        WHERE $1::date IS NULL OR periodo = $1::date
        ORDER BY unidad_organica_id, tramo_permanencia_dias_habiles`,
      [periodo],
    );
    return rows.map((fila) => {
      const tramo = fila.tramo_permanencia_dias_habiles;
      return {
        unidadOrganicaId: fila.unidad_organica_id,
        tramo,
        // Un tramo desconocido se trata como el más bajo: cuenta como vigente y
        // no como estancado, que es la lectura conservadora para un semáforo.
        limiteInferiorDias: LIMITE_INFERIOR_POR_TRAMO[tramo] ?? 0,
        nExpedientes: aNumero(fila.n_expedientes),
        promedioDiasHabiles: aNumero(fila.promedio_dias_habiles_permanencia),
        promedioHorasHabiles: aNumero(fila.promedio_horas_habiles),
        porcentajeDelArea: aNumero(fila.porcentaje_del_area),
      };
    });
  }

  /**
   * Nombres y siglas de las unidades orgánicas, para enriquecer el ranking.
   *
   * `sigd_org.unidad_organica` NO es un requisito del motor analítico: el preflight
   * del script DDL no lo exige y las vistas no lo necesitan. Por eso la consulta se
   * degrada a un mapa vacío si OrganiCore no está instalado, y el servicio usa
   * entonces el identificador como nombre. Un tablero sin siglas es un defecto
   * cosmético; uno que devuelve 500 porque falta OrganiCore no lo es.
   */
  async obtenerNombresUnidades(): Promise<Map<string, { nombre: string; sigla: string | null }>> {
    const nombres = new Map<string, { nombre: string; sigla: string | null }>();
    try {
      const { rows } = await this.pool.query<{ id: string; sigla: string | null; nombre: string }>(
        `SELECT id::text AS id, sigla, nombre
           FROM sigd_org.unidad_organica`,
      );
      for (const fila of rows) {
        nombres.set(fila.id, { nombre: fila.nombre, sigla: fila.sigla });
      }
    } catch {
      // Degradación documentada: sin OrganiCore se conserva el identificador.
    }
    return nombres;
  }

  /**
   * Refresco concurrente de las dos vistas materializadas.
   *
   * PostgreSQL sólo admite UN `REFRESH MATERIALIZED VIEW CONCURRENTLY` por vista a la
   * vez: un segundo refresco simultáneo falla con
   * `ERROR: concurrent refresh is disallowed`. El lock consultivo de sesión
   * (`pg_try_advisory_lock`) lo serializa sin esperar en cola ni devolver 409.
   *
   * El lock se toma y se libera SIEMPRE en la misma conexión, incluso si un refresco
   * lanza: si se filtra, todas las peticiones posteriores de refresco recibirían
   * `refrescoYaEnCurso` y el tablero jamás se actualizaría.
   */
  async refrescarVistasMgd(): Promise<ResultadoRefrescoMgd> {
    const cliente = await this.pool.connect();
    try {
      return await this.refrescarConCliente(cliente);
    } finally {
      cliente.release();
    }
  }

  private async refrescarConCliente(cliente: PoolClient): Promise<ResultadoRefrescoMgd> {
    const inicio = Date.now();
    const { rows: bloqueado } = await cliente.query<{rok: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS rok',
      [LOCK_REFRESCO_MGD],
    );
    if (!bloqueado[0]?.rok) {
      return { vistas: [], duracionMs: Date.now() - inicio, refrescoYaEnCurso: true };
    }
    try {
      for (const vista of VISTAS_REFRESCO) {
        // Identificador en un literal: no puede provenir de la entrada del usuario.
        await cliente.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${vista}`);
      }
    } finally {
      await cliente.query('SELECT pg_advisory_unlock($1)', [LOCK_REFRESCO_MGD]);
    }
    return {
      vistas: VISTAS_REFRESCO,
      duracionMs: Date.now() - inicio,
      refrescoYaEnCurso: false,
    };
  }
}
