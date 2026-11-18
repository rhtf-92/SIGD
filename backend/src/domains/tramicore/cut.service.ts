import type { Pool, PoolClient } from 'pg';

/**
 * T-BE-TC-01 · Generador atomico del Codigo Unico de Tramite (CUT).
 *
 * Mascara institucional: `EXP-YYYY-XXXXXX` (MGD-PCM, R.S. N° 001-2017-PCM/SEGDI).
 *
 * El correlativo se resuelve en PostgreSQL mediante la funcion nativa
 * `sigd_tra.fn_generar_cut(p_anio)` (alias canonico de
 * `sigd_tra.generar_cut_expediente(p_anio)` definida en `05_sigd_tra.sql`),
 * la cual incrementa atomicamente `sigd_tra.secuencia_anual_cut (anio_fiscal, ultimo_correlativo)`
 * bajo bloqueo pesimista de fila (`SELECT ... FOR UPDATE`).
 *
 * Este servicio delega en la base de datos para que exista una unica fuente de
 * verdad del CUT y la garantia de unicidad quede respaldada por las restricciones
 * `UNIQUE` sobre `sigd_tra.expediente.codigo_expediente` y `sigd_doc.expediente.codigo_expediente`.
 */

/** Expresion regular normativa del formato CUT. Criterio de aceptacion DoD. */
export const REGEX_CUT = /^EXP-\d{4}-\d{6}$/;

/** Ancho del correlativo dentro de la mascara EXP-YYYY-XXXXXX. */
const ANCHO_CORRELATIVO = 6;

/** Anio minimo y maximo admitido por `fn_generar_cut`. */
const ANIO_MINIMO = 1900;
const ANIO_MAXIMO = 9999;

export interface ResultadoCut {
  cut: string;
  anio: number;
}

interface FilaCut {
  cut: string;
}

/**
 * Formatea un correlativo con la mascara institucional. Funcion pura: no toca la
 * base de datos y existe para poder verificar el DoD de forma aislada.
 */
export function formatearCut(anio: number, correlativo: number): string {
  if (!Number.isInteger(anio) || anio < ANIO_MINIMO || anio > ANIO_MAXIMO) {
    throw new RangeError(
      `ANIO_FISCAL_INVALIDO: se esperaba un anio entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}, se recibio ${anio}`,
    );
  }
  if (!Number.isInteger(correlativo) || correlativo < 1) {
    throw new RangeError(
      `CORRELATIVO_INVALIDO: el correlativo debe ser un entero mayor o igual a 1, se recibio ${correlativo}`,
    );
  }
  if (String(correlativo).length > ANCHO_CORRELATIVO) {
    throw new RangeError(
      `CORRELATIVO_DESBORDADO: ${correlativo} no cabe en ${ANCHO_CORRELATIVO} digitos; la mascara EXP-YYYY-XXXXXX se agota`,
    );
  }
  return `EXP-${anio}-${String(correlativo).padStart(ANCHO_CORRELATIVO, '0')}`;
}

/** Indica si un CUT cumple la mascara institucional. */
export function esCutValido(cut: string): boolean {
  return REGEX_CUT.test(cut);
}

export class CutService {
  constructor(private readonly pool: Pool) {}

  /** Ejercicio fiscal corriente segun la zona horaria del instituto (America/Lima). */
  static anioFiscalCorriente(fecha: Date = new Date()): number {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
    }).formatToParts(fecha);
    const anio = Number(partes.find((parte) => parte.type === 'year')?.value);
    if (!Number.isFinite(anio)) {
      throw new Error('No se pudo determinar el anio fiscal corriente.');
    }
    return anio;
  }

  /**
   * Reserva el siguiente CUT del ejercicio fiscal invocando la funcion nativa
   * `sigd_tra.fn_generar_cut($1::INT)` (`05_sigd_tra.sql`). Acepta la conexion
   * del llamador para que la asignacion viaje en la misma transaccion que la
   * radicacion: si la radicacion falla, el correlativo se libera con el
   * ROLLBACK y no se quema.
   */
  async generar(anio: number, cliente?: PoolClient): Promise<ResultadoCut> {
    const ejecutor = cliente ?? this.pool;
    const resultado = await ejecutor.query<FilaCut>(
      'SELECT sigd_tra.fn_generar_cut($1::INT) AS cut',
      [anio],
    );
    const cut = resultado.rows[0]?.cut;
    if (!cut) {
      throw new Error('sigd_tra.fn_generar_cut no devolvio ningun CUT.');
    }
    if (!esCutValido(cut)) {
      throw new Error(`CUT_CON_MASCARA_INVALIDA: la base de datos devolvio "${cut}"`);
    }
    return { cut, anio };
  }

  /** CUT del ejercicio corriente. Azucar sintactico sobre `generar`. */
  async generarCorriente(cliente?: PoolClient): Promise<ResultadoCut> {
    return this.generar(CutService.anioFiscalCorriente(), cliente);
  }
}
