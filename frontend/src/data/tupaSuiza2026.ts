/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ARCHIVO: src/data/tupaSuiza2026.ts
 * -----------------------------------------------------------------------------
 * FACHADA: los datos crudos oficiales del docente viven en
 *   src/data/proyectosProductivosDocente.ts
 * (transcripción fiel del archivo del profesor, con solo 3 erratas corregidas:
 * caracteres "0" y "$0" ajenos al contenido y "Productivis" → "Productivos").
 * Este módulo NO duplica datos: reexporta la fuente canónica y añade las
 * utilidades de presentación, búsqueda y el adaptador al contrato del wizard
 * de Mesa de Partes (PROCEDIMIENTOS_PRODUCTIVOS_TUPA, códigos PP-NN).
 * 100% TypeScript estricto (cero 'any').
 * ==============================================================================
 */

import type { ProcedimientoTupa2026 } from "./tupaPasco2026";
import {
  INSTITUTO_INFO,
  LISTA_PROYECTOS_PRODUCTIVOS,
  type CategoriaServicios,
  type ItemServicio,
} from "./proyectosProductivosDocente";

export { INSTITUTO_INFO, LISTA_PROYECTOS_PRODUCTIVOS, type CategoriaServicios, type ItemServicio };

// -----------------------------------------------------------------------------
// Utilidades de presentación y consulta
// -----------------------------------------------------------------------------

/** Formatea el monto del servicio a texto institucional (S/. 35.00). */
export function formatearMontoServicio(monto: number | string): string {
  if (typeof monto === "number") {
    return `S/. ${monto.toFixed(2)}`;
  }
  return monto;
}

/** Servicio productivo aplanado con su código correlativo PP-NN y su categoría. */
export interface ServicioProductivoPlano {
  readonly codigo: string;
  readonly concepto: string;
  readonly requisitos: readonly string[];
  readonly derechoPago: string;
  readonly categoria: string;
  readonly subRubro?: string;
  readonly baseLegal?: string;
  readonly cuentaBancaria?: string;
}

/** Catálogo aplanado con códigos correlativos PP-01, PP-02, … */
export const SERVICIOS_PRODUCTIVOS_PLANOS: readonly ServicioProductivoPlano[] =
  LISTA_PROYECTOS_PRODUCTIVOS.flatMap((categoria, indiceCategoria) => {
    let correlativoPrevio = LISTA_PROYECTOS_PRODUCTIVOS.slice(0, indiceCategoria).reduce(
      (acumulado, anterior) => acumulado + anterior.items.length,
      0,
    );
    return categoria.items.map((item) => {
      correlativoPrevio += 1;
      const codigo = `PP-${String(correlativoPrevio).padStart(2, "0")}`;
      return {
        codigo,
        concepto: item.concepto,
        requisitos: item.descripcion,
        derechoPago: formatearMontoServicio(item.monto),
        categoria: categoria.rubro,
        subRubro: categoria.subRubro,
        baseLegal: categoria.baseLegal,
        cuentaBancaria: categoria.cuentaBancaria,
      } satisfies ServicioProductivoPlano;
    });
  });

/** Total de servicios productivos del catálogo (33). */
export const TOTAL_SERVICIOS_PRODUCTIVOS: number = SERVICIOS_PRODUCTIVOS_PLANOS.length;

/** Búsqueda insensible a tildes y mayúsculas por concepto o categoría. */
export function buscarServicioProductivo(termino: string): readonly ServicioProductivoPlano[] {
  const normalizado = termino
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (!normalizado) return SERVICIOS_PRODUCTIVOS_PLANOS;
  return SERVICIOS_PRODUCTIVOS_PLANOS.filter((servicio) => {
    const texto = `${servicio.codigo} ${servicio.concepto} ${servicio.categoria} ${servicio.subRubro ?? ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return normalizado
      .split(/\s+/)
      .every((token) => texto.includes(token));
  });
}

// -----------------------------------------------------------------------------
// Adaptador al modelo de procedimientos TUPA del wizard de Mesa de Partes
// -----------------------------------------------------------------------------

/**
 * Procedimientos productivos adaptados al contrato del wizard
 * (Mesa de Partes Virtual y Ventanilla Presencial).
 */
export const PROCEDIMIENTOS_PRODUCTIVOS_TUPA: readonly ProcedimientoTupa2026[] =
  SERVICIOS_PRODUCTIVOS_PLANOS.map((servicio) => ({
    codigo: servicio.codigo,
    nombre: servicio.concepto,
    requisitos: [...servicio.requisitos],
    derechoPago: servicio.derechoPago,
    dependencia: "Tesorería / Proyectos Productivos — IESTP Suiza",
    autoridad: "Dirección General",
    tiempoMaximo: "Según contrato o disponibilidad",
    detalleTarifas: servicio.cuentaBancaria ? [servicio.cuentaBancaria] : undefined,
    nota: `${servicio.categoria}${servicio.baseLegal ? ` · Base legal: ${servicio.baseLegal}` : ""}`,
  }));
