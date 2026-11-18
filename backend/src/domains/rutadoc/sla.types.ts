export type EstadoSla = 'VERDE' | 'AMARILLO' | 'ROJO';

/** El calendario institucional entrega días no laborables como fechas civiles YYYY-MM-DD. */
export interface CalendarioLaboralPort {
  obtenerDiasNoLaborables(desde: string, hasta: string): Promise<readonly string[]>;
}

export interface IntervaloSuspensionSla {
  desde: string; // ISO civil YYYY-MM-DD
  hasta: string; // ISO civil YYYY-MM-DD
  motivo?: string;
  ronda?: number;
}

export interface EntradaSla {
  fechaInicio: string;
  fechaActual: string;
  diasHabilesLimite?: number;
  porcentajeAmarilloDesde?: number;
  diasNoLaborables?: ReadonlySet<string>;
  intervalosSuspension?: readonly IntervaloSuspensionSla[];
}

export interface ResultadoSla {
  fechaInicio: string;
  fechaCalculo: string;
  fechaLimite: string;
  diasHabilesLimite: number;
  diasHabilesTranscurridos: number;
  diasHabilesSuspendidos: number;
  diasHabilesConsumidos: number;
  diasHabilesRestantes: number;
  porcentaje: number;
  estado: EstadoSla;
  suspendidoActualmente?: boolean;
}
