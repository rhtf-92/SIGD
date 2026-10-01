export type EstadoSla = 'VERDE' | 'AMARILLO' | 'ROJO';

/** El calendario institucional entrega días no laborables como fechas civiles YYYY-MM-DD. */
export interface CalendarioLaboralPort {
  obtenerDiasNoLaborables(desde: string, hasta: string): Promise<readonly string[]>;
}

export interface EntradaSla {
  fechaInicio: string;
  fechaActual: string;
  diasHabilesLimite?: number;
  porcentajeAmarilloDesde?: number;
  diasNoLaborables?: ReadonlySet<string>;
}

export interface ResultadoSla {
  fechaInicio: string;
  fechaCalculo: string;
  fechaLimite: string;
  diasHabilesLimite: number;
  diasHabilesTranscurridos: number;
  diasHabilesRestantes: number;
  porcentaje: number;
  estado: EstadoSla;
}
