/**
 * ENT-M01-02: Preset Institucional Regional de Ucayali (INEI 25)
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * 
 * NOTA ARQUITECTÓNICA:
 * La ÚNICA FUENTE DE VERDAD OFICIAL del Catálogo Nacional de Ubigeo reside en la base de datos
 * PostgreSQL (esquema sigd_auth, tablas departamento_ubigeo, provincia_ubigeo y distrito_ubigeo)
 * y es consultada dinámicamente mediante el servicio ubigeoService y la API REST /api/v1/ubigeo/*.
 * 
 * Este archivo preserva EXCLUSIVAMENTE los metadatos institucionales de la sede del instituto
 * (Sede Central Pucallpa, Coronel Portillo, Ucayali) sin duplicar datos territoriales ni arrays estáticos.
 */

export type { UbigeoItem, UbigeoDTO } from '../types/ubigeo';
import type { UbigeoItem } from '../types/ubigeo';

export const DEPARTAMENTO_UCAYALI_ID = '25';
export const DEPARTAMENTO_UCAYALI_NOMBRE = 'UCAYALI';

export const DEPARTAMENTO_UCAYALI: UbigeoItem = {
  id: DEPARTAMENTO_UCAYALI_ID,
  nombre: DEPARTAMENTO_UCAYALI_NOMBRE,
};
