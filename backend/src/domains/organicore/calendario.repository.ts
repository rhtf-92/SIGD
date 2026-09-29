/**
 * Repositorio de `sigd_org.calendario_laboral` (capa de acceso a datos).
 *
 * Todas las consultas son parametrizadas y se ejecutan sobre el `Pool`
 * inyectado; aquí no hay construcción dinámica de SQL ni lógica de negocio. La
 * transacción se controla desde el servicio (`BEGIN`/`COMMIT`/`ROLLBACK`) para
 * poder escribir, en una sola unidad atómica, la fila de negocio, la bitácora
 * WORM y el evento de outbox, tal como hace `src/referencia/expediente.router.ts`.
 */

import type { Pool, PoolClient } from 'pg';
import type { TipoFeriado, UnidadTerritorial } from './calendario.habiles.js';

export interface FilaCalendario {
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

const SELECCION = `
    c.id_calendario,
    to_char(c.fecha, 'YYYY-MM-DD')        AS fecha,
    c.anio,
    c.tipo_feriado,
    c.descripcion,
    c.unidad_territorial,
    c.es_laborable,
    c.base_legal,
    c.activo
  FROM sigd_org.calendario_laboral AS c`;

export interface InsertarFeriadoParams {
  fecha: string;
  tipo_feriado: TipoFeriado | null;
  descripcion: string;
  unidad_territorial: UnidadTerritorial;
  es_laborable: boolean;
  base_legal: string | null;
  registrado_por: string | null;
}

export interface FiltroCalendario {
  anio?: number;
  desde?: string;
  hasta?: string;
  incluirInactivos?: boolean;
}

/** Inserta una excepción de calendario. La unicidad la impone el índice único. */
export async function insertarCalendario(
  cliente: PoolClient,
  params: InsertarFeriadoParams,
): Promise<FilaCalendario> {
  const resultado = await cliente.query<FilaCalendario>(
    `INSERT INTO sigd_org.calendario_laboral
       (fecha, tipo_feriado, descripcion, unidad_territorial, es_laborable, base_legal, registrado_por)
     VALUES ($1::date, $2, $3, $4, $5, $6, $7)
     RETURNING id_calendario,
               to_char(fecha, 'YYYY-MM-DD') AS fecha,
               anio,
               tipo_feriado,
               descripcion,
               unidad_territorial,
               es_laborable,
               base_legal,
               activo,
               to_char(creado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS creado_en`,
    [
      params.fecha,
      params.tipo_feriado,
      params.descripcion,
      params.unidad_territorial,
      params.es_laborable,
      params.base_legal,
      params.registrado_por,
    ],
  );
  return resultado.rows[0];
}

/** ¿Existe ya una entrada para (fecha, unidad_territorial)? Control previo al 409. */
export async function existeCalendario(
  cliente: PoolClient,
  fecha: string,
  unidad_territorial: UnidadTerritorial,
): Promise<boolean> {
  const resultado = await cliente.query<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM sigd_org.calendario_laboral
        WHERE fecha = $1::date
          AND unidad_territorial = $2
     ) AS existe`,
    [fecha, unidad_territorial],
  );
  return resultado.rows[0]?.existe === true;
}

export async function listarCalendario(
  pool: Pool,
  filtro: FiltroCalendario = {},
): Promise<FilaCalendario[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (!filtro.incluirInactivos) {
    condiciones.push('c.activo = TRUE');
  }
  if (filtro.anio !== undefined) {
    valores.push(filtro.anio);
    condiciones.push(`c.anio = $${valores.length}`);
  }
  if (filtro.desde !== undefined) {
    valores.push(filtro.desde);
    condiciones.push(`c.fecha >= $${valores.length}::date`);
  }
  if (filtro.hasta !== undefined) {
    valores.push(filtro.hasta);
    condiciones.push(`c.fecha <= $${valores.length}::date`);
  }

  const where = condiciones.length > 0 ? ` WHERE ${condiciones.join(' AND ')}` : '';
  const resultado = await pool.query<FilaCalendario>(
    `${SELECCION}${where} ORDER BY c.fecha, c.unidad_territorial`,
    valores,
  );
  return resultado.rows;
}

/**
 * Fechas no laborables en un rango, en un solo viaje de red.
 * Es la consulta que alimenta el semáforo SLA y por eso se apoya en el índice
 * parcial `idx_calendario_laboral_no_laborable`.
 *
 * Respeta la precedencia de `sigd_org.es_dia_no_laborable`: una fecha queda
 * habilitada si existe una fila `es_laborable = TRUE` para ella, de modo que el
 * listado debe excluir esos días aunque además exista una excepción no laborable.
 */
export async function consultarDiasNoLaborables(
  pool: Pool,
  desde: string,
  hasta: string,
): Promise<string[]> {
  const resultado = await pool.query<{ fecha: string }>(
    `SELECT DISTINCT to_char(n.fecha, 'YYYY-MM-DD') AS fecha
       FROM sigd_org.calendario_laboral AS n
      WHERE n.activo = TRUE
        AND n.es_laborable = FALSE
        AND n.fecha BETWEEN $1::date AND $2::date
        AND NOT EXISTS (
              SELECT 1
                FROM sigd_org.calendario_laboral AS h
               WHERE h.fecha = n.fecha
                 AND h.activo = TRUE
                 AND h.es_laborable = TRUE
            )
      ORDER BY fecha`,
    [desde, hasta],
  );
  return resultado.rows.map((fila) => fila.fecha);
}

/** Carga el calendario completo; el servicio lo memoriza con TTL. */
export async function cargarCalendario(pool: Pool): Promise<FilaCalendario[]> {
  return listarCalendario(pool, { incluirInactivos: false });
}
