import { PROCEDIMIENTOS_TUPA_2026, type ProcedimientoTupa2026 } from './tupaSuiza2026';

/**
 * Catálogo de consulta organizado por filas principales del tarifario Suiza.
 * Los códigos SUZ26-001 al SUZ26-072 son la numeración consecutiva oficial de presentación,
 * mientras que codigoInterno conserva el identificador técnico de la base de datos PostgreSQL.
 */
export interface ConceptoTupaMesaPartes {
  codigoInterno: string;
  codigoVisible: string;
  numeroVisible: string;
  referenciasInternas: readonly string[];
  nombre: string;
  rubro: string;
  paginaFuente: number;
  costoFuente: string;
  detallesTarifa: readonly string[];
  observacionFuente: string;
}

const paginas: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
  11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 2, 18: 2, 19: 2, 20: 2,
  21: 3, 22: 3, 23: 3, 24: 3, 25: 3, 26: 3, 27: 3, 28: 3, 29: 3,
  30: 4, 31: 4, 32: 4, 33: 4, 34: 4, 35: 4, 36: 4, 37: 4, 38: 4, 39: 4, 40: 4, 41: 4, 42: 4, 43: 4, 44: 4, 45: 4,
  46: 5, 47: 5, 48: 5, 49: 5, 50: 5, 51: 5, 52: 5, 53: 5, 54: 5, 55: 5, 56: 5, 57: 5, 58: 5, 59: 5, 60: 5, 61: 5, 62: 5, 63: 5, 64: 5, 65: 5, 66: 5,
  67: 6, 68: 6, 69: 6, 70: 6, 71: 6, 72: 6, 73: 6, 74: 6, 75: 6,
};

function numero(codigo: string): number {
  return Number(codigo.slice(-3));
}

function rubro(nota?: string): string {
  const match = nota?.match(/Rubro:\s*([^\.]+)/i);
  return match?.[1]?.trim() ?? 'Rubro según encabezado de la página fuente';
}

function crearConcepto(principal: ProcedimientoTupa2026, idx: number): ConceptoTupaMesaPartes {
  const variantes = principal.detalleTarifas ?? [];
  const numeroVisible = principal.numeroVisible ?? String(idx + 1).padStart(3, '0');
  const codigoVisible = principal.codigoVisible ?? `SUZ26-${numeroVisible}`;
  const codigoInterno = principal.codigoInterno ?? principal.codigo;
  return {
    codigoInterno,
    codigoVisible,
    numeroVisible,
    referenciasInternas: codigoInterno === 'SUZ26-021' ? ['SUZ26-021', 'SUZ26-022'] :
      codigoInterno === 'SUZ26-069' ? ['SUZ26-069', 'SUZ26-070', 'SUZ26-071'] : [codigoInterno],
    nombre: principal.nombre,
    rubro: rubro(principal.nota),
    paginaFuente: paginas[numero(codigoInterno)] ?? 1,
    costoFuente: principal.derechoPago ?? (variantes.length ? 'Importe agrupado o variante; revisar detalle' : 'No individualizado en el tarifario'),
    detallesTarifa: variantes,
    observacionFuente: principal.nota ?? '',
  };
}

export const CATALOGO_TUPA_MESA_PARTES: readonly ConceptoTupaMesaPartes[] =
  PROCEDIMIENTOS_TUPA_2026.map((p, idx) => crearConcepto(p, idx));

if (CATALOGO_TUPA_MESA_PARTES.length !== 72) {
  throw new Error(`El tarifario debe contener 72 filas principales; se obtuvieron ${CATALOGO_TUPA_MESA_PARTES.length}.`);
}
