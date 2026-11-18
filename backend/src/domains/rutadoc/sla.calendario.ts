import type { CalendarioLaboralPort } from './sla.types.js';

export interface FechaAnualNoLaborable {
  mes: number;
  dia: number;
}

export interface ConfiguracionCalendarioRutaDoc {
  /** Fechas civiles extraordinarias configuradas por la institución. */
  diasNoLaborables?: readonly string[];
  /** Fechas anuales, configurables sin acoplarlas al motor SLA. */
  fechasAnuales?: readonly FechaAnualNoLaborable[];
}

// Configuracion inicial derivada del plan maestro; puede sustituirse mediante el port.
const FECHAS_ANUALES_INICIALES: readonly FechaAnualNoLaborable[] = Object.freeze([
  { mes: 6, dia: 24 }, // Fiesta de San Juan, Ucayali
  { mes: 10, dia: 13 }, // Aniversario de Pucallpa
]);

/** Calendario local RutaDoc. La configuración institucional puede sustituirlo por el port. */
export class CalendarioLaboralRutaDoc implements CalendarioLaboralPort {
  private readonly fechas: ReadonlySet<string>;
  private readonly anuales: readonly FechaAnualNoLaborable[];

  constructor(configuracion: ConfiguracionCalendarioRutaDoc = {}) {
    this.fechas = new Set(configuracion.diasNoLaborables ?? []);
    this.anuales = configuracion.fechasAnuales ?? FECHAS_ANUALES_INICIALES;
    for (const fecha of this.fechas) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        new Date(`${fecha}T00:00:00.000Z`).toISOString().slice(0, 10) !== fecha) {
        throw new RangeError(`Fecha no laborable inválida: ${fecha}`);
      }
    }
    for (const { mes, dia } of this.anuales) {
      if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(dia) || dia < 1 || dia > 31) {
        throw new RangeError(`Fecha anual no laborable inválida: ${mes}-${dia}`);
      }
    }
  }

  async obtenerDiasNoLaborables(desde: string, hasta: string): Promise<readonly string[]> {
    const inicio = Date.parse(`${desde}T00:00:00.000Z`);
    const fin = Date.parse(`${hasta}T00:00:00.000Z`);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || inicio > fin ||
      new Date(inicio).toISOString().slice(0, 10) !== desde ||
      new Date(fin).toISOString().slice(0, 10) !== hasta) {
      throw new RangeError('El rango del calendario debe contener fechas ISO válidas y ordenadas.');
    }

    const resultado = new Set<string>();
    for (const fecha of this.fechas) if (fecha >= desde && fecha <= hasta) resultado.add(fecha);
    const primerAnio = new Date(inicio).getUTCFullYear();
    const ultimoAnio = new Date(fin).getUTCFullYear();
    for (let anio = primerAnio; anio <= ultimoAnio; anio++) {
      for (const { mes, dia } of this.anuales) {
        const ms = Date.UTC(anio, mes - 1, dia);
        const fecha = new Date(ms).toISOString().slice(0, 10);
        if (new Date(ms).getUTCMonth() === mes - 1 && fecha >= desde && fecha <= hasta) resultado.add(fecha);
      }
    }
    return [...resultado].sort();
  }
}

export const calendarioLaboralPredeterminadoRutaDoc: CalendarioLaboralPort =
  new CalendarioLaboralRutaDoc();
