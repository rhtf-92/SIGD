/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLE: ENT-M02-01 — Asistente Wizard de Tramitación de 4 Pasos
 * ARCHIVO: src/mocks/tramitesTupaMock.ts
 * RESPONSABLE: Anllely Melgarejo V. (F_ANLLELY)
 * COLABORADORAS: Lucy Panduro Ramos, Noelia Alva (Grupo 1)
 * 
 * DESCRIPCIÓN:
 * Catálogos estandarizados y datos simulados para pruebas del Módulo 2.
 * Incluye la lista canónica oficial de las 11 carreras profesionales del IESTP "Suiza"
 * y los procedimientos TUPA de mayor demanda.
 * 100% TypeScript estricto (cero 'any').
 * ==============================================================================
 */

import {
  type ProgramaEstudioCodigo,
  PROGRAMAS_ESTUDIO_CATALOGO,
} from "../types/tramiteWizard";
import { type SelectOption } from "../components/common/SearchableSelect";
// ✅ TUPA IESTP SUIZA — Mock alineado con catálogo oficial
import { PROCEDIMIENTOS_TUPA_SUIZA_2026 } from "@/data/tupaSuiza2026";

/**
 * Lista canónica y oficial de las 11 Carreras Profesionales del IESTP "Suiza".
 * Cada carrera cuenta con su identificador único y normalizado (value).
 */
export const OPCIONES_PROGRAMAS_ESTUDIO_OFICIALES: readonly SelectOption[] =
  PROGRAMAS_ESTUDIO_CATALOGO;

/**
 * Catálogo de trámites institucionales TUPA y Libre para simulación en el Wizard.
 */
export interface TramiteTupaMockItem {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly esTupa: boolean;
  readonly unidadOrganica: string;
  readonly unidadId: string;
  readonly diasPlazoLegal?: number;
  readonly costoSoles?: number;
  readonly derechoPago?: string;
  readonly tiempoMaximo?: string;
  readonly descripcion: string;
  readonly carrerasAplica: readonly ProgramaEstudioCodigo[];
}

const TODOS_LOS_PROGRAMAS = PROGRAMAS_ESTUDIO_CATALOGO.map(
  ({ value }) => value
);

export const TRAMITES_TUPA_MOCK: readonly TramiteTupaMockItem[] = [
  ...PROCEDIMIENTOS_TUPA_SUIZA_2026.map((procedimiento) => {
    const dependencia = procedimiento.dependencia ?? "Mesa de Partes";
    const datosDescripcion = [
      procedimiento.derechoPago !== undefined
        ? `Derecho de pago: S/. ${procedimiento.derechoPago.toFixed(2)}`
        : undefined,
      procedimiento.tiempoMaximo
        ? `Tiempo máximo: ${procedimiento.tiempoMaximo}`
        : undefined,
      procedimiento.descripcion,
      procedimiento.nota,
    ].filter((dato): dato is string => Boolean(dato));

    return {
      id: `TUPA-${procedimiento.codigo}`,
      codigo: procedimiento.codigo,
      nombre: procedimiento.nombre,
      esTupa: true,
      unidadOrganica: dependencia,
      unidadId: dependencia
        .split(" / ")[0]
        .toUpperCase()
        .replaceAll(" ", "_"),
      derechoPago: procedimiento.derechoPago !== undefined
        ? `S/. ${procedimiento.derechoPago.toFixed(2)}`
        : undefined,
      tiempoMaximo: procedimiento.tiempoMaximo,
      descripcion: datosDescripcion.join(" • "),
      carrerasAplica: TODOS_LOS_PROGRAMAS,
    };
  }),
  {
    id: "LIBRE",
    codigo: "LIBRE",
    nombre: "Trámite General / Memorial / Solicitud Libre Externa",
    esTupa: false,
    unidadOrganica: "Mesa de Partes Central",
    unidadId: "MESA_PARTES",
    derechoPago: "Gratuito / no tarifado",
    tiempoMaximo: "30 días hábiles (referencial)",
    descripcion:
      "Ingreso directo a la Mesa de Partes Central para requerimientos no tarifados por el TUPA.",
    carrerasAplica: [],
  },
];

/**
 * Función auxiliar para obtener el nombre oficial del programa a partir de su código.
 */
export function getNombreProgramaEstudio(codigo: string): string {
  const item = PROGRAMAS_ESTUDIO_CATALOGO.find((p) => p.value === codigo);
  return item ? item.label : codigo;
}
