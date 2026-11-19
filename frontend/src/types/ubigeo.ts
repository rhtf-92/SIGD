/**
 * Tipos oficiales para el Catálogo Geográfico Nacional (UBIGEO - INEI)
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * 
 * Este archivo contiene EXCLUSIVAMENTE interfaces, contratos de datos y tipos TypeScript.
 * No contiene catálogos estáticos ni arreglos de datos en disco.
 * Los datos geográficos proceden exclusivamente de la API REST respaldada por PostgreSQL.
 */

export interface UbigeoItem {
  /** Código oficial INEI (2 dígitos Depto, 4 dígitos Provincia, 6 dígitos Distrito) */
  id: string;
  /** Nombre oficial del territorio según PostgreSQL / INEI */
  nombre: string;
  /** Código INEI del nivel jerárquico superior (padre) */
  padreId?: string;
}

export interface UbigeoDTO {
  departamento: UbigeoItem | null;
  provincia: UbigeoItem | null;
  distrito: UbigeoItem | null;
  ubigeoCod: string;
}

export interface DepartamentoDTO {
  codigo: string;
  nombre: string;
}

export interface ProvinciaDTO {
  codigo: string;
  departamentoCodigo: string;
  nombre: string;
}

export interface DistritoDTO {
  codigo: string;
  provinciaCodigo: string;
  departamentoCodigo: string;
  nombre: string;
}

export interface DetalleUbigeoDTO {
  codigo: string;
  distrito: string;
  provincia: string;
  departamento: string;
}
