/**
 * Cálculo de días hábiles (Lun–Vie menos feriados) — F_ADRIANO / ENT-M04-01.
 * Usado por EtapasStepper para el cronómetro de permanencia por etapa
 * y detección de cuellos de botella en titulaciones.
 */

/** Feriados nacionales fijos + muestra Ucayali (el backend provee el calendario oficial). */
const FERIADOS_FIJOS_MMDD = new Set([
  "01-01", // Año Nuevo
  "05-01", // Día del Trabajo
  "06-29", // San Pedro y San Pablo
  "07-28",
  "07-29", // Fiestas Patrias
  "08-30", // Santa Rosa de Lima
  "10-08", // Combate de Angamos
  "11-01", // Todos los Santos
  "12-08", // Inmaculada Concepción
  "12-25", // Navidad
]);

function claveMmDd(fecha: Date): string {
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

function claveYmd(fecha: Date): string {
  return `${fecha.getFullYear()}-${claveMmDd(fecha)}`;
}

export function esDiaHabil(fecha: Date, feriadosExtra: string[] = []): boolean {
  const dia = fecha.getDay();
  if (dia === 0 || dia === 6) return false; // Dom / Sáb
  if (FERIADOS_FIJOS_MMDD.has(claveMmDd(fecha))) return false;
  if (feriadosExtra.includes(claveYmd(fecha))) return false;
  return true;
}

/** Días hábiles transcurridos entre inicio y fin (fin exclusivo si es hoy). */
export function diasHabilesEntre(
  inicioIso: string | undefined,
  finIso?: string,
  feriadosExtra: string[] = [],
): number {
  if (!inicioIso) return 0;
  const inicio = new Date(inicioIso);
  if (Number.isNaN(inicio.getTime())) return 0;
  const fin = finIso ? new Date(finIso) : new Date();
  if (Number.isNaN(fin.getTime()) || fin < inicio) return 0;
  let contador = 0;
  const cursor = new Date(inicio);
  cursor.setHours(0, 0, 0, 0);
  const limite = new Date(fin);
  limite.setHours(0, 0, 0, 0);
  while (cursor < limite) {
    if (esDiaHabil(cursor, feriadosExtra)) contador += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return contador;
}

/** Clasifica la permanencia contra el SLA de la etapa (semáforo). */
export function clasificarPermanencia(
  diasHabiles: number,
  slaDias: number,
): "EN_PLAZO" | "POR_VENCER" | "VENCIDA" {
  if (slaDias <= 0) return "EN_PLAZO";
  const ratio = diasHabiles / slaDias;
  if (ratio < 0.6) return "EN_PLAZO";
  if (ratio <= 1) return "POR_VENCER";
  return "VENCIDA";
}
