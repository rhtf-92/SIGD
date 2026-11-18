/**
 * ENT-M01-02: Base de datos canónica e interfaces de Ubigeo Nacional (INEI Perú)
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 */

// @ts-ignore - Evita que TypeScript busque un archivo de declaraciones estricto
import ubigeoData from 'ubigeo-peru';

export interface UbigeoItem {
  id: string;
  nombre: string;
  padreId?: string;
}

export interface UbigeoDTO {
  departamento: UbigeoItem | null;
  provincia: UbigeoItem | null;
  distrito: UbigeoItem | null;
  ubigeoCod: string;
}

// Función auxiliar para convertir texto UPPERCASE a Formato Título (Ej. "CUSCO" -> "Cusco")
const formatNombre = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Extracción segura de los datos desde la librería instalada
const rawData: any = ubigeoData;
const rawReniec: Array<{
  departamento: string;
  provincia: string;
  distrito: string;
  nombre: string;
}> = rawData.reniec || rawData.inei || (Array.isArray(rawData) ? rawData : []);

// 1. Departamentos (24 Regiones + Callao)
export const DEPARTAMENTOS_PERU: ReadonlyArray<UbigeoItem> = rawReniec
  .filter((item) => item.provincia === '00' && item.distrito === '00')
  .map((item) => ({
    id: item.departamento,
    nombre: formatNombre(item.nombre),
  }));

// 2. Provincias
export const PROVINCIAS_PERU: ReadonlyArray<UbigeoItem> = rawReniec
  .filter((item) => item.provincia !== '00' && item.distrito === '00')
  .map((item) => ({
    id: `${item.departamento}${item.provincia}`,
    nombre: formatNombre(item.nombre),
    padreId: item.departamento,
  }));

// 3. Distritos
export const DISTRITOS_PERU: ReadonlyArray<UbigeoItem> = rawReniec
  .filter((item) => item.provincia !== '00' && item.distrito !== '00')
  .map((item) => ({
    id: `${item.departamento}${item.provincia}${item.distrito}`,
    nombre: formatNombre(item.nombre),
    padreId: `${item.departamento}${item.provincia}`,
  }));

// ============================================================================
// RETROCOMPATIBILIDAD CON MÓDULOS ANTERIORES
// ============================================================================

export const DEPARTAMENTO_UCAYALI: UbigeoItem = { id: '25', nombre: 'Ucayali' };
export const PROVINCIAS_UCAYALI: ReadonlyArray<UbigeoItem> = PROVINCIAS_PERU.filter((p) => p.padreId === '25');
export const DISTRITOS_UCAYALI: ReadonlyArray<UbigeoItem> = DISTRITOS_PERU.filter((d) => d.padreId?.startsWith('25'));

export interface Provincia {
  nombre: string;
  distritos: string[];
}

export const UCAYALI_PROVINCIAS: readonly Provincia[] = [
  { nombre: 'Coronel Portillo', distritos: ['Callería', 'Campoverde', 'Iparía', 'Masisea', 'Yarinacocha', 'Nueva Requena', 'Manantay'] },
  { nombre: 'Atalaya', distritos: ['Raymondi', 'Sepahua', 'Tahuanía', 'Yurúa'] },
  { nombre: 'Padre Abad', distritos: ['Padre Abad', 'Irazola', 'Curimaná', 'Neshuya', 'Alexander von Humboldt'] },
  { nombre: 'Purús', distritos: ['Purús'] },
];