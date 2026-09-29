/**
 * Utilidad de cálculo de SLA en días hábiles conforme al TUO de la Ley N° 27444 (LPAG)
 * Entregable: ENT-M03-02 · Tarea: T-BE-OC-13/T-BE-OC-14 (fuente única del calendario)
 *
 * Este módulo es puro: no conoce React, ni la red, ni el backend. El calendario
 * laboral se recibe como parámetro (`CalendarioLaboral`) y su única fuente es
 * `GET /api/v1/admin/calendario-laboral`, es decir la tabla `sigd_org.calendario_laboral`
 * del backend. Antes esta función arrastraba una lista de feriados escrita a mano
 * (constante `FERIADOS_RECURRENTES_PE_UCAYALI`), que obligaba a editar código cada
 * ejercicio fiscal: exactamente el problema que T-BE-OC-13 elimina.
 *
 * Regla base: 30 días hábiles de plazo legal máximo para procedimientos ordinarios.
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
 * Calendario laboral oficial recibido del backend, en fechas `YYYY-MM-DD`.
 *
 * - `noLaborables`: feriados y días inhábiles registrados en `sigd_org.calendario_laboral`.
 * - `laborablesExcepcionales`: días habilitados por resolución (por ejemplo un sábado
 *   laborable). Tienen prioridad sobre `noLaborables`, igual que la función
 *   `sigd_org.es_dia_no_laborable` del backend.
 */
export interface CalendarioLaboral {
  noLaborables: ReadonlySet<string>;
  laborablesExcepcionales: ReadonlySet<string>;
}

/**
 * Calendario vacío: sin feriados conocidos. Es el valor por defecto y equivale a
 * "sólo lunes a viernes", para que las funciones puras sigan siendo utilizables
 * (y testeables) sin depender de una llamada de red.
 */
export const CALENDARIO_LABORAL_VACIO: CalendarioLaboral = {
  noLaborables: new Set<string>(),
  laborablesExcepcionales: new Set<string>(),
};

/** Día de la semana de una fecha `YYYY-MM-DD` sin sufijos de zona horaria. */
function dayOfWeekFromKey(yyyyMmDd: string): number {
  return new Date(`${yyyyMmDd}T12:00:00Z`).getUTCDay();
}

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
 * Verifica si una fecha es un día hábil según el calendario oficial.
 *
 * Orden de precedencia (idéntico al backend):
 *   1. Si la fecha está habilitada por resolución, es hábil aunque sea fin de semana.
 *   2. Si está registrada como no laborable, no es hábil.
 *   3. En cualquier otro caso, es hábil si es lunes a viernes.
 */
export function isBusinessDay(
  date: Date,
  calendario: CalendarioLaboral = CALENDARIO_LABORAL_VACIO,
): boolean {
  const yyyyMmDd = formatLocalDateKey(date);

  if (calendario.laborablesExcepcionales.has(yyyyMmDd)) {
    return true;
  }

  const dayOfWeek = dayOfWeekFromKey(yyyyMmDd);
  // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  return !calendario.noLaborables.has(yyyyMmDd);
}

/**
 * Suma N días hábiles a una fecha dada, respetando feriados y fines de semana.
 * Conforme al Art. 143 del TUO Ley 27444, el cómputo inicia a partir del día hábil siguiente.
 */
export function addBusinessDays(
  startDate: Date | string,
  businessDays: number,
  calendario: CalendarioLaboral = CALENDARIO_LABORAL_VACIO,
): Date {
  const current = new Date(startDate);
  // Normalizar hora a inicio del día
  current.setHours(0, 0, 0, 0);

  let added = 0;
  while (added < businessDays) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current, calendario)) {
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
  calendario: CalendarioLaboral = CALENDARIO_LABORAL_VACIO,
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
    if (isBusinessDay(cursor, calendario)) {
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
  calendario: CalendarioLaboral = CALENDARIO_LABORAL_VACIO,
): SlaCalculationResult {
  const fechaIngresoDate = new Date(fechaIngreso);
  const fechaLimiteCalculada = addBusinessDays(
    fechaIngresoDate,
    plazoMaximoDiasHabiles,
    calendario,
  );

  const diasConsumidos = Math.max(
    0,
    countBusinessDays(fechaIngresoDate, fechaReferencia, calendario),
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
