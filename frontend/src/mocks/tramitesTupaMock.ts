/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLE: ENT-M02-01 — Asistente Wizard de Tramitación de 4 Pasos
 * ARCHIVO: src/mocks/tramitesTupaMock.ts
 * AUTORA: Anllely Melgarejo V. (F_ANLLELY)
 * REVISIÓN: Patricia Marina (R)
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
  readonly diasPlazoLegal: number;
  readonly costoSoles: number;
  readonly descripcion: string;
  readonly carrerasAplica: readonly ProgramaEstudioCodigo[];
}

export const TRAMITES_TUPA_MOCK: readonly TramiteTupaMockItem[] = [
  {
    id: "TUPA-01",
    codigo: "TUPA-01",
    nombre: "TUPA 01: Certificado Oficial de Estudios Modulares / Regular",
    esTupa: true,
    unidadOrganica: "Secretaría Académica",
    unidadId: "SEC_ACAD",
    diasPlazoLegal: 7,
    costoSoles: 25.0,
    descripcion:
      "Expedición física y digital de certificados modulares para egresados y estudiantes regulares.",
    carrerasAplica: [
      "ADE",
      "AOT",
      "ASAD",
      "CONT",
      "CCIV",
      "DSI",
      "EIND",
      "ENF",
      "MFOR",
      "MAUT",
      "PAGR",
    ],
  },
  {
    id: "TUPA-02",
    codigo: "TUPA-02",
    nombre: "TUPA 02: Emisión de Título Profesional Técnico y Duplicado",
    esTupa: true,
    unidadOrganica: "Dirección General",
    unidadId: "DIR_GRAL",
    diasPlazoLegal: 30,
    costoSoles: 120.0,
    descripcion:
      "Trámite de titulación oficial e inscripción ante la Dirección Regional de Educación Ucayali.",
    carrerasAplica: [
      "ADE",
      "AOT",
      "ASAD",
      "CONT",
      "CCIV",
      "DSI",
      "EIND",
      "ENF",
      "MFOR",
      "MAUT",
      "PAGR",
    ],
  },
  {
    id: "TUPA-03",
    codigo: "TUPA-03",
    nombre: "TUPA 03: Constancia de Matrícula, No Adeudo o Egresado",
    esTupa: true,
    unidadOrganica: "Secretaría Académica",
    unidadId: "SEC_ACAD",
    diasPlazoLegal: 3,
    costoSoles: 15.0,
    descripcion:
      "Constancias institucionales inmediatas para becas PRONABEC, pasantías y convenios.",
    carrerasAplica: [
      "ADE",
      "AOT",
      "ASAD",
      "CONT",
      "CCIV",
      "DSI",
      "EIND",
      "ENF",
      "MFOR",
      "MAUT",
      "PAGR",
    ],
  },
  {
    id: "TUPA-04",
    codigo: "TUPA-04",
    nombre: "TUPA 04: Convalidación y Reincorporación de Matrícula",
    esTupa: true,
    unidadOrganica: "Unidad Académica",
    unidadId: "UNID_ACAD",
    diasPlazoLegal: 15,
    costoSoles: 45.0,
    descripcion:
      "Evaluación curricular de asignaturas cursadas para cambio de plan o traslado institucional.",
    carrerasAplica: [
      "ADE",
      "AOT",
      "ASAD",
      "CONT",
      "CCIV",
      "DSI",
      "EIND",
      "ENF",
      "MFOR",
      "MAUT",
      "PAGR",
    ],
  },
  {
    id: "LIBRE",
    codigo: "LIBRE",
    nombre: "Trámite General / Memorial / Solicitud Libre Externa",
    esTupa: false,
    unidadOrganica: "Mesa de Partes Central",
    unidadId: "MESA_PARTES",
    diasPlazoLegal: 30,
    costoSoles: 0.0,
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
