/**
 * Utilidad de cálculo de SLA en días hábiles conforme al TUO de la Ley N° 27444 (LPAG)
 * Entregable: ENT-M03-02
 *
 * Excluye fines de semana y feriados oficiales (nacionales y regionales de Ucayali).
 * Regla base: 30 días hábiles de plazo legal máximo para procedimientos administrativos ordinarios.
 */

export type SlaStatus = "NORMAL" | "ALERTA" | "CRITICO" | "VENCIDO";

export interface SlaCalculationResult {
  diasHabilesConsumidos: number;
  diasHabilesRestantes: number;
  plazoMaximoDiasHabiles: number;
  porcentajeConsumido: number;
  estado: SlaStatus;
  estaVencido: boolean;
  fechaVencimientoCalculada: string;
  mensajeExplicativo: string;
}

/**
 * Catálogo canónico de feriados nacionales (D. Leg. N° 713) y regionales de Ucayali.
 * Se representan en formato MM-DD para aplicar independientemente del año,
 * complementados con feriados con año específico.
 */
export const FERIADOS_RECURRENTES_PE_UCAYALI: readonly string[] = [
  "01-01", // Año Nuevo
  "05-01", // Día del Trabajo
  "06-07", // Batalla de Arica y Día de la Bandera
  "06-24", // Fiesta Patronal de San Juan Bautista (Feriado Regional Ucayali)
  "06-29", // San Pedro y San Pablo
  "07-23", // Día de la Fuerza Aérea del Perú
  "07-28", // Fiestas Patrias
  "07-29", // Fiestas Patrias
  "08-06", // Batalla de Junín
  "08-30", // Santa Rosa de Lima
  "10-08", // Combate de Angamos
  "10-13", // Aniversario de la Provincia de Coronel Portillo / Pucallpa (Feriado Regional Ucayali)
  "11-01", // Todos los Santos
  "12-08", // Inmaculada Concepción
  "12-09", // Batalla de Ayacucho
  "12-25", // Navidad
] as const;

/**
 * Normaliza una fecha a formato YYYY-MM-DD local
 */
export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Verifica si una fecha dada es un día hábil (lunes a viernes no feriado).
 */
export function isBusinessDay(date: Date, feriadosPersonalizados?: string[]): boolean {
  const dayOfWeek = date.getDay();
  // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  const yyyyMmDd = formatLocalDateKey(date);
  const mmDd = yyyyMmDd.slice(5);

  if (FERIADOS_RECURRENTES_PE_UCAYALI.includes(mmDd)) {
    return false;
  }

  if (feriadosPersonalizados && feriadosPersonalizados.includes(yyyyMmDd)) {
    return false;
  }

  return true;
}

/**
 * Suma N días hábiles a una fecha dada, respetando feriados y fines de semana.
 * Conforme al Art. 143 del TUO Ley 27444, el cómputo inicia a partir del día hábil siguiente.
 */
export function addBusinessDays(
  startDate: Date | string,
  businessDays: number,
  feriadosPersonalizados?: string[],
): Date {
  const current = new Date(startDate);
  // Normalizar hora a inicio del día
  current.setHours(0, 0, 0, 0);

  let added = 0;
  while (added < businessDays) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current, feriadosPersonalizados)) {
      added++;
    }
  }

  return current;
}

/**
 * Cuenta la cantidad de días hábiles transcurridos entre dos fechas.
 * Cómputo legal: no incluye la fecha de inicio (empieza al día siguiente hábil).
 */
export function countBusinessDays(
  startDate: Date | string,
  endDate: Date | string,
  feriadosPersonalizados?: string[],
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (start.getTime() === end.getTime()) {
    return 0;
  }

  const isReverse = end.getTime() < start.getTime();
  let [from, to] = isReverse ? [end, start] : [start, end];

  let count = 0;
  const cursor = new Date(from);

  while (cursor.getTime() < to.getTime()) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor, feriadosPersonalizados)) {
      count++;
    }
  }

  return isReverse ? -count : count;
}

/**
 * Calcula el estado de semáforo SLA de 30 días hábiles (LPAG Ley 27444) para un expediente.
 *
 * Umbrales cromáticos institucionales:
 * - NORMAL (Verde): <= 15 días hábiles consumidos (>= 15 días hábiles restantes)
 * - ALERTA (Ámbar): 16 a 25 días hábiles consumidos (5 a 14 días hábiles restantes)
 * - CRITICO (Rojo): 26 a 30 días hábiles consumidos (1 a 4 días hábiles restantes)
 * - VENCIDO (Rojo parpadeante / alerta): > 30 días hábiles consumidos (<= 0 días hábiles restantes)
 */
export function calculateSlaStatus(
  fechaIngreso: string | Date,
  fechaReferencia: Date = new Date(),
  plazoMaximoDiasHabiles = 30,
  feriadosPersonalizados?: string[],
): SlaCalculationResult {
  const fechaIngresoDate = new Date(fechaIngreso);
  const fechaLimiteCalculada = addBusinessDays(
    fechaIngresoDate,
    plazoMaximoDiasHabiles,
    feriadosPersonalizados,
  );

  const diasConsumidos = Math.max(
    0,
    countBusinessDays(fechaIngresoDate, fechaReferencia, feriadosPersonalizados),
  );

  const diasRestantes = plazoMaximoDiasHabiles - diasConsumidos;
  const estaVencido = diasRestantes < 0;

  let estado: SlaStatus;
  let mensajeExplicativo: string;

  if (estaVencido) {
    estado = "VENCIDO";
    const diasExcedidos = Math.abs(diasRestantes);
    mensajeExplicativo = `Vencido hace ${diasExcedidos} día(s) hábil(es) (Plazo legal de ${plazoMaximoDiasHabiles} días hábiles excedido)`;
  } else if (diasRestantes <= 4) {
    estado = "CRITICO";
    mensajeExplicativo = `Vencimiento inminente: queda(n) ${diasRestantes} día(s) hábil(es) para vencimiento legal`;
  } else if (diasRestantes <= 14) {
    estado = "ALERTA";
    mensajeExplicativo = `Atención preventiva: queda(n) ${diasRestantes} día(s) hábil(es) para vencimiento legal`;
  } else {
    estado = "NORMAL";
    mensajeExplicativo = `En plazo ordinario: queda(n) ${diasRestantes} día(s) hábil(es) para vencimiento legal`;
  }

  const porcentajeConsumido = Math.min(
    100,
    Math.round((diasConsumidos / plazoMaximoDiasHabiles) * 100),
  );

  return {
    diasHabilesConsumidos: diasConsumidos,
    diasHabilesRestantes: diasRestantes,
    plazoMaximoDiasHabiles,
    porcentajeConsumido,
    estado,
    estaVencido,
    fechaVencimientoCalculada: formatLocalDateKey(fechaLimiteCalculada),
    mensajeExplicativo,
  };
}
