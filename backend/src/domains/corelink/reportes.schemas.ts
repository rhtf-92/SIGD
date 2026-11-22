/**
 * SIGD · IESTP "Suiza" (Pucallpa) — Núcleo 00 CoreLink
 * Motor Analítico MGD-PCM/SEGDI · Esquemas Zod de los filtros de reporte.
 *
 * Validación flexible y resiliente de entrada de los endpoints #50, #51 y #52.
 * Soporta consultas directas del frontend con filtros de fecha, periodo y unidad orgánica.
 */

import { z } from 'zod';

const helperVacio = (val: unknown) => (val === '' || val === null ? undefined : val);

/** Período mensual `YYYY-MM` o descriptivo del frontend. */
const periodo = z.preprocess(
  helperVacio,
  z.string().regex(/^(\d{4}-(0[1-9]|1[0-2])|anual|mensual|personalizado|year|month|custom|all)$/i, {
    message: 'El período debe tener formato YYYY-MM o ser anual/mensual/personalizado.',
  }),
);

/**
 * Rango de años admitidos.
 */
const anio = z.preprocess(helperVacio, z.coerce.number().int().min(2000).max(2100));

/**
 * `diasLimite` es el umbral de estancamiento EN DÍAS HÁBILES.
 */
const diasLimite = z.preprocess(helperVacio, z.coerce.number().int().min(0).max(365).default(5));

/** Filtros del tablero consolidado (#50). */
export const filtrosResumenSchema = z.object({
  periodo: periodo.optional(),
  fechaInicio: z.preprocess(helperVacio, z.string().optional()),
  fechaFin: z.preprocess(helperVacio, z.string().optional()),
  diasLimite: diasLimite.optional(),
  anio: anio.optional(),
  mes: z.preprocess(helperVacio, z.string().optional()),
  unidadOrganicaId: z.preprocess(helperVacio, z.string().optional()),
}).passthrough();

/** Filtros del ranking de cuellos de botella (#51). */
export const filtrosCuellosBotellaSchema = z.object({
  periodo: periodo.optional(),
  diasLimite: diasLimite.optional(),
  fechaInicio: z.preprocess(helperVacio, z.string().optional()),
  fechaFin: z.preprocess(helperVacio, z.string().optional()),
  anio: anio.optional(),
  mes: z.preprocess(helperVacio, z.string().optional()),
  unidadOrganicaId: z.preprocess(helperVacio, z.string().optional()),
}).passthrough();

/** Filtros de la serie mensual de tendencias (#52). */
export const filtrosTendenciasSchema = z.object({
  anio: anio.optional(),
  periodo: periodo.optional(),
  fechaInicio: z.preprocess(helperVacio, z.string().optional()),
  fechaFin: z.preprocess(helperVacio, z.string().optional()),
  mes: z.preprocess(helperVacio, z.string().optional()),
  diasLimite: diasLimite.optional(),
  unidadOrganicaId: z.preprocess(helperVacio, z.string().optional()),
}).passthrough();

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
