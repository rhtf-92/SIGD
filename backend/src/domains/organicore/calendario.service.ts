/**
 * Servicio del calendario laboral institucional de OrganiCore (T-BE-OC-13/14).
 *
 * Ámbito: Motor de cómputo de días hábiles, catálogo de feriados y alta de
 * feriados excepcionales. Marco jurídico: TUO de la Ley N° 27444 (LPAG)
 * Art. 143 (plazo máximo supletorio de 30 días hábiles), D. Leg. N° 713
 * (feriados nacionales), Ley N° 29001 (feriados regionales de Ucayali) y
 * decretos de duelo nacional.
 *
 * CAPA DE SERVICIO — este archivo es autocontenido por decisión de alcance:
 * agrupa el motor puro de fechas, los esquemas Zod de entrada, el acceso a
 * `sigd_org.calendario_laboral` y la caché en memoria con TTL. No conoce
 * `req`/`res` de Express: devuelve datos de dominio y lanza `AppError`, que
 * `src/middleware/error-middleware.ts` traduce a RFC 9457.
 *
 * REUTILIZA (sin modificarlos) los mecanismos transversales ya existentes:
 *   - `registrarMutacion` → bitácora forense WORM (`sigd_audit.bitacora_auditoria`).
 *   - `insertarEvento`    → Transactional Outbox (`sigd_audit.evento_outbox`).
 *   - `getRequestContext` → correlación y autor de la solicitud.
 *   - `ConflictError` / `ValidationError` → errores de dominio ya definidos.
 *
 * PENDIENTE DE AUTORIZACIÓN (no se resuelve aquí): el DDL de
 * `sigd_org.calendario_laboral` y del enum `sigd_org.tipo_feriado_enum` no está
 * versionado en el repositorio. Hasta que se autorice su alta, los métodos que
 * leen o escriben esa tabla lanzan el error de PostgreSQL `42P01` (relación no
 * existente); el motor puro de días hábiles es verificable sin base de datos.
 */

import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { ConflictError, ValidationError } from '../../shared/domain/errors/index.js';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';

// ===========================================================================
// 1. TAXONOMÍA DEL CALENDARIO
// ===========================================================================

/** Clasificación normativa exigida por la especificación de la tarea. */
export const TIPOS_FERIADO = [
  'NACIONAL',
  'REGIONAL_UCAYALI',
  'INSTITUCIONAL',
  'DUELO_NACIONAL',
] as const;

export type TipoFeriado = (typeof TIPOS_FERIADO)[number];

export const UNIDADES_TERRITORIALES = ['NACIONAL', 'UCAYALI', 'IESTP_SUIZA'] as const;

export type UnidadTerritorial = (typeof UNIDADES_TERRITORIALES)[number];

/** Excepción del calendario laboral para una fecha concreta. */
export interface DiaCalendario {
  id_calendario?: string;
  /** Fecha en formato ISO `YYYY-MM-DD`. */
  fecha: string;
  anio: number;
  /** `null` cuando el día es una habilitación laborable excepcional. */
  tipo_feriado: TipoFeriado | null;
  descripcion: string;
  unidad_territorial: UnidadTerritorial;
  es_laborable: boolean;
  base_legal: string | null;
  activo?: boolean;
}

// ===========================================================================
// 2. MOTOR PURO DE FECHAS
// ===========================================================================

const REGEXO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIAS_POR_MS = 86_400_000;

/** ¿El texto tiene forma de fecha ISO `YYYY-MM-DD`? No valida el calendario. */
export function tieneFormatoFecha(fecha: unknown): fecha is string {
  return typeof fecha === 'string' && REGEXO_FECHA.test(fecha);
}

/**
 * Valida que la fecha exista en el calendario gregoriano.
 * Rechaza, por ejemplo, `2026-02-30`, `2026-13-01` o `2025-02-29`.
 */
export function esFechaValida(fecha: string): boolean {
  if (!tieneFormatoFecha(fecha)) {
    return false;
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return false;
  }
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fechaUtc.getUTCFullYear() === anio &&
    fechaUtc.getUTCMonth() === mes - 1 &&
    fechaUtc.getUTCDate() === dia
  );
}

/** Convierte `YYYY-MM-DD` a instante UTC medianoche (sin derivas de zona horaria). */
export function aInstanteUtc(fecha: string): number {
  if (!esFechaValida(fecha)) {
    throw new RangeError(`Fecha inválida: ${fecha}. Se espera el formato YYYY-MM-DD.`);
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

/** Convierte un instante a `YYYY-MM-DD` en UTC. */
export function aFechaIso(instante: number): string {
  return new Date(instante).toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado (misma convención que `Date.prototype.getDay`). */
export function diaSemana(fecha: string): number {
  return new Date(aInstanteUtc(fecha)).getUTCDay();
}

export function esFinDeSemana(fecha: string): boolean {
  const dia = diaSemana(fecha);
  return dia === 0 || dia === 6;
}

/** Añade (o resta) días corridos a una fecha ISO. */
export function desplazarDias(fecha: string, dias: number): string {
  return aFechaIso(aInstanteUtc(fecha) + dias * DIAS_POR_MS);
}

/** Compara dos fechas ISO por orden cronológico. */
export function compararFechas(izquierda: string, derecha: string): number {
  return aInstanteUtc(izquierda) - aInstanteUtc(derecha);
}

/**
 * Normaliza la colección de excepciones a un índice por fecha.
 *
 * REGLA ANTI-DUPLICADOS: cuando varias filas compiten por la misma fecha en
 * unidades territoriales distintas (por ejemplo, un feriado nacional y una
 * habilitación institucional del mismo día), prevalece `es_laborable = TRUE`
 * por ser la resolución posterior. Es la misma regla que aplica
 * `sigd_org.es_dia_no_laborable` en la base de datos. Las filas dadas de baja
 * (`activo = false`) se descartan antes de indexar.
 */
export function indexarCalendario(calendario: readonly DiaCalendario[]): Map<string, DiaCalendario> {
  const indice = new Map<string, DiaCalendario>();
  for (const dia of calendario) {
    if (dia.activo === false) {
      continue;
    }
    const previo = indice.get(dia.fecha);
    if (previo === undefined || dia.es_laborable) {
      indice.set(dia.fecha, dia);
    }
  }
  return indice;
}

/**
 * Devuelve la excepción no laborable vigente para la fecha, o `null` si el día
 * es laborable (no hay excepción, o existe una habilitación expresa).
 */
export function buscarDia(
  fecha: string,
  indice: ReadonlyMap<string, DiaCalendario>,
): DiaCalendario | null {
  const encontrado = indice.get(fecha);
  if (!encontrado || encontrado.es_laborable) {
    return null;
  }
  return encontrado;
}

/** ¿La fecha es un feriado o día no laborable según el calendario institucional? */
export function esFeriado(fecha: string, calendario: readonly DiaCalendario[]): boolean {
  return buscarDia(fecha, indexarCalendario(calendario)) !== null;
}

/** Tipo de feriado vigente en la fecha, o `null` si el día es laborable. */
export function tipoFeriadoDe(
  fecha: string,
  calendario: readonly DiaCalendario[],
): TipoFeriado | null {
  return buscarDia(fecha, indexarCalendario(calendario))?.tipo_feriado ?? null;
}

/** ¿Es la fecha un feriado nacional (D. Leg. N° 713)? */
export function esFeriadoNacional(fecha: string, calendario: readonly DiaCalendario[]): boolean {
  return tipoFeriadoDe(fecha, calendario) === 'NACIONAL';
}

/** ¿Es la fecha un feriado regional de Ucayali (Ley N° 29001)? */
export function esFeriadoRegionalUcayali(fecha: string, calendario: readonly DiaCalendario[]): boolean {
  return tipoFeriadoDe(fecha, calendario) === 'REGIONAL_UCAYALI';
}

/** ¿Es la fecha un feriado institucional (resolución del IESTP "Suiza")? */
export function esFeriadoInstitucional(fecha: string, calendario: readonly DiaCalendario[]): boolean {
  return tipoFeriadoDe(fecha, calendario) === 'INSTITUCIONAL';
}

/** ¿Es la fecha un día de duelo nacional decretado por el Estado? */
export function esDueloNacional(fecha: string, calendario: readonly DiaCalendario[]): boolean {
  return tipoFeriadoDe(fecha, calendario) === 'DUELO_NACIONAL';
}

/**
 * ¿La fecha es un día laborable? (Art. 143 LPAG)
 * Falso si es sábado, domingo, feriado nacional, feriado regional de Ucayali,
 * feriado institucional, duelo nacional o si el calendario así lo declara.
 */
export function esDiaLaborable(fecha: string, calendario: readonly DiaCalendario[] = []): boolean {
  if (!esFechaValida(fecha)) {
    return false;
  }
  if (esFinDeSemana(fecha)) {
    return false;
  }
  return buscarDia(fecha, indexarCalendario(calendario)) === null;
}

function esHabilEnIndice(fecha: string, indice: ReadonlyMap<string, DiaCalendario>): boolean {
  if (esFinDeSemana(fecha)) {
    return false;
  }
  return buscarDia(fecha, indice) === null;
}

/**
 * Cuenta los días hábiles entre dos fechas.
 *
 * Cómputo legal del Art. 143: se excluye la fecha de inicio (el plazo corre a
 * partir del día hábil siguiente) y se incluye la fecha de fin. Devuelve un
 * valor negativo si `hasta` es anterior a `desde`, para preservar el orden.
 */
export function contarDiasHabiles(
  desde: string,
  hasta: string,
  calendario: readonly DiaCalendario[] = [],
): number {
  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    throw new RangeError('Las fechas del rango deben ser válidas y tener formato YYYY-MM-DD.');
  }
  const indice = indexarCalendario(calendario);
  const inicio = aInstanteUtc(desde);
  const fin = aInstanteUtc(hasta);
  if (inicio === fin) {
    return 0;
  }

  const esInverso = fin < inicio;
  const [menor, mayor] = esInverso ? [fin, inicio] : [inicio, fin];

  let total = 0;
  for (let instante = menor; instante < mayor; instante += DIAS_POR_MS) {
    if (esHabilEnIndice(aFechaIso(instante + DIAS_POR_MS), indice)) {
      total += 1;
    }
  }

  return esInverso ? -total : total;
}

/**
 * Suma N días hábiles a una fecha (Art. 143 LPAG).
 * El cómputo arranca al día siguiente, por eso el resultado nunca es la fecha
 * de entrada, aunque ésta sea un fin de semana o un feriado.
 */
export function sumarDiasHabiles(
  desde: string,
  diasHabiles: number,
  calendario: readonly DiaCalendario[] = [],
): string {
  if (!esFechaValida(desde)) {
    throw new RangeError('La fecha de inicio debe ser válida y tener formato YYYY-MM-DD.');
  }
  if (!Number.isInteger(diasHabiles) || diasHabiles < 0) {
    throw new RangeError('El número de días hábiles debe ser un entero no negativo.');
  }

  const indice = indexarCalendario(calendario);
  let instante = aInstanteUtc(desde);
  let restantes = diasHabiles;
  while (restantes > 0) {
    instante += DIAS_POR_MS;
    if (esHabilEnIndice(aFechaIso(instante), indice)) {
      restantes -= 1;
    }
  }
  return aFechaIso(instante);
}

/** Primera fecha laborable estrictamente posterior a `fecha` (regla del Art. 138). */
export function proximoDiaHabil(fecha: string, calendario: readonly DiaCalendario[] = []): string {
  return sumarDiasHabiles(fecha, 1, calendario);
}

/** Primera fecha laborable igual o posterior a `fecha`. */
export function primerDiaHabil(fecha: string, calendario: readonly DiaCalendario[] = []): string {
  return esDiaLaborable(fecha, calendario) ? fecha : proximoDiaHabil(fecha, calendario);
}

/**
 * Enumera las fechas no laborables (fines de semana y feriados) del rango
 * `[desde, hasta]` inclusive. Cada fecha aparece una sola vez aunque varias
 * filas del calendario la declaren no laborable.
 */
export function listarDiasNoLaborables(
  desde: string,
  hasta: string,
  calendario: readonly DiaCalendario[] = [],
): string[] {
  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    throw new RangeError('Las fechas del rango deben ser válidas y tener formato YYYY-MM-DD.');
  }
  const inicio = aInstanteUtc(desde);
  const fin = aInstanteUtc(hasta);
  if (inicio > fin) {
    throw new RangeError('El rango de fechas es inválido: "desde" es posterior a "hasta".');
  }

  const indice = indexarCalendario(calendario);
  const resultado: string[] = [];
  for (let instante = inicio; instante <= fin; instante += DIAS_POR_MS) {
    const fecha = aFechaIso(instante);
    if (!esHabilEnIndice(fecha, indice)) {
      resultado.push(fecha);
    }
  }
  return resultado;
}

/** Enumera las fechas laborables del rango `[desde, hasta]` inclusive. */
export function listarDiasLaborables(
  desde: string,
  hasta: string,
  calendario: readonly DiaCalendario[] = [],
): string[] {
  const noLaborables = new Set(listarDiasNoLaborables(desde, hasta, calendario));
  const inicio = aInstanteUtc(desde);
  const fin = aInstanteUtc(hasta);
  const resultado: string[] = [];
  for (let instante = inicio; instante <= fin; instante += DIAS_POR_MS) {
    const fecha = aFechaIso(instante);
    if (!noLaborables.has(fecha)) {
      resultado.push(fecha);
    }
  }
  return resultado;
}

/** Filtra el calendario a un ejercicio fiscal, para consultas por año indexadas. */
export function calendarioDelAnio(
  calendario: readonly DiaCalendario[],
  anio: number,
): DiaCalendario[] {
  return calendario.filter((dia) => dia.anio === anio);
}

// ===========================================================================
// 3. CACHÉ EN MEMORIA CON TTL
// ===========================================================================

interface EntradaCache<T> {
  valor: T;
  expira_en: number;
}

export interface CacheMemoriaOpciones {
  /** Reloj inyectable para pruebas deterministas. */
  ahora?: () => number;
}

/**
 * Caché en memoria con expiración opresiva bajo demanda: no hay temporizadores
 * ni tareas de fondo, por lo que una entrada expirada sólo se descarta cuando
 * se consulta. Es suficiente para catálogos de baja cardinalidad y permitiría
 * sustituir la implementación por Redis sin cambiar los servicios consumidores.
 */
export class CacheMemoria<T> {
  private readonly entradas = new Map<string, EntradaCache<T>>();
  private readonly ahora: () => number;
  private readonly ttlMs: number;

  constructor(ttlMs: number, opciones: CacheMemoriaOpciones = {}) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new RangeError('El TTL de la caché en memoria debe ser un número positivo.');
    }
    this.ttlMs = ttlMs;
    this.ahora = opciones.ahora ?? Date.now;
  }

  /** Devuelve el valor cacheado o `undefined` si no existe o ya expiró. */
  public obtener(clave: string): T | undefined {
    const entrada = this.entradas.get(clave);
    if (!entrada) {
      return undefined;
    }
    if (entrada.expira_en <= this.ahora()) {
      this.entradas.delete(clave);
      return undefined;
    }
    return entrada.valor;
  }

  public guardar(clave: string, valor: T): void {
    this.entradas.set(clave, { valor, expira_en: this.ahora() + this.ttlMs });
  }

  /** Devuelve el valor cacheado; si no existe o expiró, carga y memoriza. */
  public async obtenerOCargar(clave: string, cargador: () => Promise<T>): Promise<T> {
    const valor = this.obtener(clave);
    if (valor !== undefined) {
      return valor;
    }
    const cargado = await cargador();
    this.guardar(clave, cargado);
    return cargado;
  }

  /** Invalida una clave concreta o, si se omite, todo el contenido. */
  public invalidar(clave?: string): void {
    if (clave === undefined) {
      this.entradas.clear();
      return;
    }
    this.entradas.delete(clave);
  }

  public get tamano(): number {
    return this.entradas.size;
  }
}

// ===========================================================================
// 4. ESQUEMAS ZOD DE ENTRADA
// ===========================================================================

/** `YYYY-MM-DD` con validación de calendario gregoriano (rechaza 2026-02-30). */
export const esquemaFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'El formato de la fecha debe ser YYYY-MM-DD.')
  .refine(esFechaValida, 'La fecha no existe en el calendario.');

export const esquemaAnio = z.coerce
  .number()
  .int('El año debe ser un número entero.')
  .min(1970, 'El año es fuera del rango admitido.')
  .max(2999, 'El año es fuera del rango admitido.');

export const esquemaTipoFeriado = z.enum(TIPOS_FERIADO, {
  errorMap: () => ({ message: 'El tipo de feriado no es válido.' }),
});

export const esquemaUnidadTerritorial = z.enum(UNIDADES_TERRITORIALES, {
  errorMap: () => ({ message: 'La unidad territorial no es válida.' }),
});

/**
 * Unidad territorial por defecto según el tipo de feriado. Evita que el
 * administrador tenga que repetirla y mantiene la unicidad
 * (fecha, unidad_territorial) coherente con la clasificación normativa.
 */
export function unidadTerritorialPorDefecto(tipo: string): UnidadTerritorial {
  if (tipo === 'REGIONAL_UCAYALI') {
    return 'UCAYALI';
  }
  if (tipo === 'NACIONAL' || tipo === 'DUELO_NACIONAL') {
    return 'NACIONAL';
  }
  return 'IESTP_SUIZA';
}

/**
 * Body de `POST /api/v1/admin/calendario-laboral/feriado-excepcional` (#49).
 * Una habilitación laborable NO es un feriado: se registra con
 * `es_laborable = true` y `tipo_feriado = null` para no ensuciar el catálogo
 * jurídico, pero debe citar la resolución que la autoriza.
 */
export const esquemaFeriadoExcepcional = z
  .object({
    fecha: esquemaFecha,
    descripcion: z
      .string()
      .trim()
      .min(5, 'La descripción debe tener al menos 5 caracteres.')
      .max(200, 'La descripción no puede superar los 200 caracteres.'),
    tipo_feriado: esquemaTipoFeriado.default('INSTITUCIONAL'),
    unidad_territorial: esquemaUnidadTerritorial.optional(),
    es_laborable: z.boolean().default(false),
    base_legal: z.string().trim().max(500, 'La base legal no puede superar los 500 caracteres.').optional(),
  })
  .strict()
  .superRefine((datos, ctx) => {
    if (datos.es_laborable && datos.base_legal === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['base_legal'],
        message: 'Toda habilitación laborable requiere la resolución que la autoriza.',
      });
    }
  })
  .transform((datos) => ({
    ...datos,
    tipo_feriado: datos.es_laborable ? null : datos.tipo_feriado,
    unidad_territorial:
      datos.unidad_territorial ?? unidadTerritorialPorDefecto(datos.tipo_feriado),
  }));

export type FeriadoExcepcionalInput = z.infer<typeof esquemaFeriadoExcepcional>;

/** Query de `GET /api/v1/admin/calendario-laboral` (#48). */
export const esquemaConsultaCalendario = z
  .object({
    anio: esquemaAnio.optional(),
    desde: esquemaFecha.optional(),
    hasta: esquemaFecha.optional(),
    incluir_inactivos: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
  })
  .superRefine((datos, ctx) => {
    // La coherencia del rango es una regla de validación de entrada, no del
    // controller: se resuelve aquí para que el error llegue al middleware RFC.
    if (datos.desde && datos.hasta && datos.desde > datos.hasta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['desde'],
        message: 'El rango de fechas es inválido: "desde" es posterior a "hasta".',
      });
    }
  });

export type ConsultaCalendario = z.infer<typeof esquemaConsultaCalendario>;

// ===========================================================================
// 5. ACCESO A DATOS — sigd_org.calendario_laboral
// ===========================================================================

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
    to_char(c.fecha, 'YYYY-MM-DD') AS fecha,
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

/** Inserta una excepción de calendario. La unicidad la impone el índice único. */
async function insertarCalendario(
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
async function existeCalendario(
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

async function listarCalendario(
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
 * Respeta la precedencia de `sigd_org.es_dia_no_laborable`: una fecha queda
 * habilitada si existe una fila `es_laborable = TRUE` para ella, de modo que el
 * listado debe excluir esos días aunque además exista una excepción no laborable.
 */
async function consultarDiasNoLaborables(
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

// ===========================================================================
// 6. SERVICIO
// ===========================================================================

/** Agregado del dominio en la bitácora y en el outbox. */
export const AGREGADO_CALENDARIO = 'calendario_laboral';

/** Evento de dominio que dispara el recálculo de los semáforos SLA. */
export const EVENTO_FERIADO_EXCEPCIONAL = 'FeriadoExcepcionalRegistrado';

/** Clave de caché del calendario laboral completo. */
export const CLAVE_CACHE_CALENDARIO = 'organicore:calendario-laboral:v1';

/** TTL del calendario: 24 h. */
export const TTL_CALENDARIO_MS = 24 * 60 * 60 * 1000;

/** Plazo máximo supletorio del Art. 143 del TUO de la Ley N° 27444. */
export const PLAZO_MAXIMO_DIAS_HABILES = 30;

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

/** Vista consolidada del calendario laboral, agrupada por categoría normativa. */
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

  return {
    anio,
    total_dias: delAnio.length,
    dias_no_laborables: delAnio.filter((dia) => !dia.es_laborable).length,
    feriados_nacionales: porTipo('NACIONAL'),
    feriados_regionales_ucayali: porTipo('REGIONAL_UCAYALI'),
    feriados_institucionales: porTipo('INSTITUCIONAL'),
    duelos_nacionales: porTipo('DUELO_NACIONAL'),
    dias_laborables_excepcionales: delAnio.filter((dia) => dia.es_laborable),
    calendario: delAnio,
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
    this.cache =
      opciones.cache ?? new CacheMemoria<DiaCalendario[]>(opciones.ttlMs ?? TTL_CALENDARIO_MS);
  }

  /**
   * Lee el calendario institucional vigente usando la caché en memoria.
   * Tras un alta de feriado, la caché se invalida para que el semáforo SLA de
   * los expedientes activos se recalcule en la siguiente lectura.
   */
  public async obtenerCalendario(): Promise<DiaCalendario[]> {
    return this.cache.obtenerOCargar(CLAVE_CACHE_CALENDARIO, async () => {
      const filas = await listarCalendario(this.pool, { incluirInactivos: false });
      return filas.map(mapearFila);
    });
  }

  /** Invalida la caché del calendario (señal de refresco tras una mutación). */
  public invalidarCache(): void {
    this.cache.invalidar(CLAVE_CACHE_CALENDARIO);
  }

  /** Calendario filtrado por ejercicio fiscal y/o rango de fechas. */
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

  /** Fechas no laborables registradas en base de datos para el rango. */
  public async diasNoLaborables(desde: string, hasta: string): Promise<string[]> {
    return consultarDiasNoLaborables(this.pool, desde, hasta);
  }

  /**
   * Registra un feriado excepcional (T-BE-OC-14).
   *
   * Atomicidad: la fila de `sigd_org.calendario_laboral`, el asiento en la
   * bitácora WORM y el evento de outbox se escriben en la MISMA transacción.
   * Después, y sólo si la transacción confirma, se invalida la caché para forzar
   * el recálculo de los días hábiles.
   */
  public async registrarFeriadoExcepcional(
    entrada: FeriadoExcepcionalInput,
  ): Promise<FeriadoRegistrado> {
    if (!esFechaValida(entrada.fecha)) {
      throw new ValidationError({
        invalidParams: [{ name: 'fecha', reason: 'La fecha no existe en el calendario.' }],
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      if (await existeCalendario(cliente, entrada.fecha, entrada.unidad_territorial)) {
        throw new ConflictError({
          code: 'FERIADO_DUPLICADO',
          message: 'Ya existe un registro en el calendario para esa fecha y unidad territorial.',
          detail:
            `La fecha ${entrada.fecha} ya está registrada en el calendario laboral ` +
            `para la unidad ${entrada.unidad_territorial}.`,
        });
      }

      const contexto = getRequestContext();
      const fila = await insertarCalendario(cliente, {
        fecha: entrada.fecha,
        tipo_feriado: entrada.tipo_feriado,
        descripcion: entrada.descripcion,
        unidad_territorial: entrada.unidad_territorial,
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
          invalidar_cache: true,
          correlation_id: contexto?.correlation_id ?? null,
        },
      });

      await cliente.query('COMMIT');

      this.invalidarCache();

      return {
        ...mapearFila(fila),
        id_calendario: fila.id_calendario,
        creado_en: fila.creado_en,
        correlation_id: contexto?.correlation_id ?? '',
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
   * Recalcula el semáforo SLA de un expediente con el calendario vigente:
   * un feriado excepcional impacta de inmediato a los expedientes en trámite.
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
      fecha_vencimiento_calculada: sumarDiasHabiles(
        fechaIngreso,
        PLAZO_MAXIMO_DIAS_HABILES,
        vigente,
      ),
    };
  }
}

/** Fábrica funcional equivalente, para consumo directo desde los routers. */
export function crearCalendarioService(
  pool: Pool,
  opciones: CalendarioServiceOpciones = {},
): CalendarioService {
  return new CalendarioService(pool, opciones);
}