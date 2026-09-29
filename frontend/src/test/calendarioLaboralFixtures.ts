/**
 * Fixtures del calendario laboral oficial para las pruebas.
 *
 * Reproducen la forma exacta de `GET /api/v1/admin/calendario-laboral`. No son una
 * lista de feriados "escrita a mano" en producción: son datos de prueba que
 * simulan la respuesta del backend (`sigd_org.calendario_laboral`), igual que
 * cualquier mock de contrato. Sirven además de documentación del contrato.
 */

import type { DiaCalendario, VistaCalendario } from "../types/calendarioLaboral";
import type { CalendarioLaboral } from "../utils/slaCalculator";

let secuencia = 0;

export function diaCalendario(
  fecha: string,
  tipo_feriado: DiaCalendario["tipo_feriado"],
  descripcion: string,
  unidad_territorial: DiaCalendario["unidad_territorial"] = "NACIONAL",
  esLaborable = false,
): DiaCalendario {
  secuencia += 1;
  return {
    id_calendario: `cal-${String(secuencia).padStart(4, "0")}`,
    fecha,
    anio: Number(fecha.slice(0, 4)),
    tipo_feriado,
    descripcion,
    unidad_territorial,
    es_laborable: esLaborable,
    base_legal: "D. Leg. N° 713",
    activo: true,
  };
}

/** Feriados de fecha fija del D. Leg. N° 713 más los regionales de Ucayali. */
export const FERIADOS_OFICIALES_2026: DiaCalendario[] = [
  diaCalendario("2026-01-01", "NACIONAL", "Año Nuevo"),
  diaCalendario("2026-05-01", "NACIONAL", "Día del Trabajo"),
  diaCalendario("2026-06-07", "NACIONAL", "Batalla de Arica y Día de la Bandera"),
  diaCalendario("2026-06-24", "REGIONAL_UCAYALI", "Fiesta Patronal de San Juan Bautista", "UCAYALI"),
  diaCalendario("2026-06-29", "NACIONAL", "San Pedro y San Pablo"),
  diaCalendario("2026-07-23", "NACIONAL", "Día de la Fuerza Aérea del Perú"),
  diaCalendario("2026-07-28", "NACIONAL", "Fiestas Patrias (Primer día)"),
  diaCalendario("2026-07-29", "NACIONAL", "Fiestas Patrias (Segundo día)"),
  diaCalendario("2026-08-06", "NACIONAL", "Batalla de Junín"),
  diaCalendario("2026-08-30", "NACIONAL", "Santa Rosa de Lima"),
  diaCalendario("2026-10-08", "NACIONAL", "Combate de Angamos"),
  diaCalendario("2026-10-13", "REGIONAL_UCAYALI", "Aniversario de la Provincia de Coronel Portillo", "UCAYALI"),
  diaCalendario("2026-11-01", "NACIONAL", "Día de Todos los Santos"),
  diaCalendario("2026-12-08", "NACIONAL", "Inmaculada Concepción"),
  diaCalendario("2026-12-09", "NACIONAL", "Batalla de Ayacucho"),
  diaCalendario("2026-12-25", "NACIONAL", "Navidad"),
];

/** Respuesta del backend con el calendario oficial de un ejercicio concreto. */
export function vistaCalendarioAnio(
  anio: number,
  extra: DiaCalendario[] = [],
): VistaCalendario {
  const calendario = [
    ...FERIADOS_OFICIALES_2026.map((dia) => ({ ...dia, anio })).filter(
      (dia) => dia.anio === anio,
    ),
    ...extra,
  ];
  return {
    anio,
    total_dias: calendario.length,
    dias_no_laborables: calendario.filter((dia) => !dia.es_laborable).length,
    feriados_nacionales: calendario.filter((dia) => dia.tipo_feriado === "NACIONAL"),
    feriados_regionales_ucayali: calendario.filter((dia) => dia.tipo_feriado === "REGIONAL_UCAYALI"),
    feriados_institucionales: calendario.filter((dia) => dia.tipo_feriado === "INSTITUCIONAL"),
    duelos_nacionales: calendario.filter((dia) => dia.tipo_feriado === "DUELO_NACIONAL"),
    dias_laborables_excepcionales: calendario.filter((dia) => dia.es_laborable),
    calendario,
    anios_disponibles: [anio],
  };
}

/** Respuesta del backend con el calendario oficial de 2026. */
export function vistaCalendario2026(
  extra: DiaCalendario[] = [],
): VistaCalendario {
  return vistaCalendarioAnio(2026, extra);
}

/** Calendario listo para `slaCalculator`, equivalente a la respuesta oficial. */
export function calendarioLaboral2026(
  extra: DiaCalendario[] = [],
): CalendarioLaboral {
  const noLaborables = new Set<string>();
  const laborablesExcepcionales = new Set<string>();

  for (const dia of [...FERIADOS_OFICIALES_2026, ...extra]) {
    if (!dia.activo) continue;
    if (dia.es_laborable) {
      laborablesExcepcionales.add(dia.fecha);
    } else {
      noLaborables.add(dia.fecha);
    }
  }

  return { noLaborables, laborablesExcepcionales };
}

/** Feriado excepcional genérico (duelo, resolución regional, etc.). */
export function feriadoExcepcional(
  fecha: string,
  descripcion = "Feriado excepcional por resolución",
): DiaCalendario {
  return diaCalendario(
    fecha,
    "INSTITUCIONAL",
    descripcion,
    "IESTP_SUIZA",
    false,
  );
}
