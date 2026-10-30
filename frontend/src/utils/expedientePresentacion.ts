const etiquetas: Readonly<Record<string, string>> = {
  IESTP_SUIZA: "IESTP Suiza",
  SECRETARIA_ACADEMICA: "Secretaría Académica",
  UNIDAD_ACADEMICA: "Unidad Académica",
  DIRECCION_GENERAL: "Dirección General",
  MESA_DE_PARTES: "Mesa de Partes",
  ARCHIVO_CENTRAL: "Archivo Central",
  MATRICULA_Y_ACTAS: "Matrícula y Actas",
  PRACTICAS_PREPROFESIONALES: "Prácticas Preprofesionales",
  CONVALIDACIONES: "Convalidaciones",
  TITULACION_PROFESIONAL: "Titulación Profesional",
  RESOLUCION_DIRECTORAL: "Resolución directoral",
  MESA_DE_PARTES_VIRTUAL: "Mesa de Partes Virtual",
  VENTANILLA_PRESENCIAL: "Ventanilla presencial",
  MUY_URGENTE: "Muy urgente",
};

export function etiquetaExpediente(valor: string): string {
  return etiquetas[valor] ?? valor.charAt(0).toLocaleUpperCase("es") + valor.slice(1).toLocaleLowerCase("es").replaceAll("_", " ");
}

const formatoFecha = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Lima",
});
const formatoFechaHora = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  hourCycle: "h23", timeZone: "America/Lima",
});

export function fechaExpediente(valor: string, conHora = false): string {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? "Fecha no disponible" : (conHora ? formatoFechaHora : formatoFecha).format(fecha);
}

/**
 * Formato legible local para fechas institucionales del ciudadano:
 * "28 oct 2026 · 08:00" en huso horario America/Lima.
 * Preserva el timestamp original inalterado en almacenamiento.
 */
export function formatearFechaHoraLegible(valor: string): string {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  try {
    const formatter = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = (parts.find((p) => p.type === 'month')?.value ?? '').replace('.', '').toLowerCase();
    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
    return `${day} ${month} ${year} · ${hour}:${minute}`;
  } catch {
    return valor;
  }
}

/** Referencia visual en días calendario; no reemplaza el cómputo oficial de SLA. */
export function plazoExpediente(limite: string, ahora = Date.now()): string {
  const diferencia = new Date(limite).getTime() - ahora;
  if (!Number.isFinite(diferencia)) return "Plazo no disponible";
  if (diferencia < 0) {
    const dias = Math.ceil(-diferencia / 86_400_000);
    return `Vencido hace ${dias} ${dias === 1 ? "día" : "días"}`;
  }
  const dias = Math.ceil(diferencia / 86_400_000);
  return dias === 0 ? "Vence ahora" : `${dias} ${dias === 1 ? "día restante" : "días restantes"}`;
}
