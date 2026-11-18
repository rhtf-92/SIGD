/**
 * SIGD · IESTP "Suiza" (Pucallpa) — Núcleo 00 CoreLink
 * Motor Analítico MGD-PCM/SEGDI · Esquemas Zod de los filtros de reporte.
 *
 * Validación de entrada de los endpoints #50, #51 y #52. Se usa `.strict()` para
 * que un parámetro desconocido sea un 400 explícito y no un campo ignorado en
 * silencio: si el frontend envía `?diasLimite=5&diaslimite=6`, aceptarlo y leer uno
 * de los dos es la forma más discreta de publicar un KPI mal calculado.
 */

import { z } from 'zod';

/** Período mensual `YYYY-MM`, el formato del `periodo` de las vistas materializadas. */
const periodo = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
  message: 'El período debe tener formato YYYY-MM.',
});

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'La fecha debe tener formato YYYY-MM-DD.',
});

/**
 * Rango de años admitidos.
 *
 * El cota superior sigue al calendario institucional (2026-2); el inferior permite
 * consultar los años anteriores en los que el sistema ya tiene histórico, sin
 * abrir la puerta a `make_date` con un año de cinco dígitos.
 */
const anio = z.coerce.number().int().min(2000).max(2100);
const mesSchema = z.string().regex(/^(0[1-9]|1[0-2])$/, {
  message: 'El mes debe tener formato MM (01-12).',
});

/**
 * `diasLimite` es el umbral de estancamiento EN DÍAS HÁBILES.
 *
 * Se acota a 365 porque el valor se alinea al borde de un tramo de la vista
 * materializada y por encima del último borde todos los expedientes cuentan como
 * estancados; aceptar un número arbitrariamente grande sólo produciría un
 * `Infinity` silencioso.
 */
const diasLimite = z.coerce.number().int().min(0).max(365).default(5);

/** Filtros del tablero consolidado (#50): admite modo mensual YYYY-MM o filtros del dashboard ejecutivo. */
export const filtrosResumenSchema = z.object({
  periodo: z.union([periodo, z.enum(['anual', 'mensual', 'personalizado'])]).optional(),
  fechaInicio: fechaIso.optional(),
  fechaFin: fechaIso.optional(),
  diasLimite: diasLimite.optional(),
  anio: anio.optional(),
  mes: mesSchema.optional(),
  unidadOrganicaId: z.string().uuid().optional(),
}).strict();

/** Filtros del ranking de cuellos de botella (#51). */
export const filtrosCuellosBotellaSchema = z.object({
  periodo: periodo.optional(),
  diasLimite,
}).strict();

/** Filtros de la serie mensual de tendencias (#52). */
export const filtrosTendenciasSchema = z.object({
  anio: anio.optional(),
}).strict();

export type FiltrosResumen = z.infer<typeof filtrosResumenSchema>;
export type FiltrosCuellosBotella = z.infer<typeof filtrosCuellosBotellaSchema>;
export type FiltrosTendencias = z.infer<typeof filtrosTendenciasSchema>;

/**
 * Año consultable por defecto: el año en curso según `America/Lima`.
 *
 * Se calcula en Lima y no en la zona del host. El plan de estudios es 2026-2 y el
 * servidor podría estar desplegado en UTC: tomar el año local de la máquina
 * devolvería 2027 un 31 de diciembre por la tarde en Lima, y el tablero ejecutivo
 * pediría un año sin datos.
 */
export function anioEnLima(ahora: Date = new Date()): number {
  const enLima = new Date(ahora.getTime());
  // `en-CA` rinde YYYY-MM-DD en la zona pedida; se recorta el año sin parsear.
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
  }).formatToParts(enLima);
  const anioParte = partes.find((parte) => parte.type === 'year')?.value;
  const valor = Number(anioParte);
  return Number.isFinite(valor) ? valor : ahora.getUTCFullYear();
}
