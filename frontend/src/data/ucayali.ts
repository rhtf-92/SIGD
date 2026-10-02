/**
 * ENT-M01-02: Base de datos canónica e interfaces de Ubigeo de Ucayali (INEI 25)
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * 
 * @author Ángel Jesús Vásquez Godoy (F_JESUS)
 * @role Especialista de Integración (Ubigeo y SIAGIE) - Sub-equipo Grupo 2
 * @version 1.0.0
 */

/**
 * Representa un ítem territorial individual según estándar INEI.
 */
export interface UbigeoItem {
  /** Código oficial INEI (2 dígitos Depto, 4 Provincia, 6 Distrito) */
  id: string;
  /** Nombre oficial del territorio */
  nombre: string;
  /** Código INEI del nivel jerárquico superior */
  padreId?: string;
}

/**
 * Objeto de transferencia de datos (DTO) que emite la selección completa de la cascada.
 */
export interface UbigeoDTO {
  /** Objeto del Departamento seleccionado (Ucayali) */
  departamento: UbigeoItem;
  /** Objeto de la Provincia seleccionada o null si no se ha elegido */
  provincia: UbigeoItem | null;
  /** Objeto del Distrito seleccionado o null si no se ha elegido */
  distrito: UbigeoItem | null;
  /** Código INEI de 6 dígitos resultante para persistencia en base de datos */
  ubigeoCod: string;
}

/**
 * Departamento Canónico de Ucayali (Código INEI: 25)
 */
export const DEPARTAMENTO_UCAYALI: UbigeoItem = {
  id: '25',
  nombre: 'UCAYALI',
};

/**
 * Listado canónico e inmutable de las 4 Provincias del Departamento de Ucayali
 */
export const PROVINCIAS_UCAYALI: ReadonlyArray<UbigeoItem> = [
  { id: '2501', nombre: 'CORONEL PORTILLO', padreId: '25' },
  { id: '2502', nombre: 'ATALAYA', padreId: '25' },
  { id: '2503', nombre: 'PADRE ABAD', padreId: '25' },
  { id: '2504', nombre: 'PURUS', padreId: '25' },
];

/**
 * Listado canónico e inmutable de los 17 Distritos de Ucayali mapeados por Provincia
 */
export const DISTRITOS_UCAYALI: ReadonlyArray<UbigeoItem> = [
  // --- Provincia: Coronel Portillo (2501) ---
  { id: '250101', nombre: 'CALLERIA', padreId: '2501' },
  { id: '250102', nombre: 'CAMPOVERDE', padreId: '2501' },
  { id: '250103', nombre: 'IPARIA', padreId: '2501' },
  { id: '250104', nombre: 'MASISEA', padreId: '2501' },
  { id: '250105', nombre: 'YARINACOCHA', padreId: '2501' },
  { id: '250106', nombre: 'NUEVA REQUENA', padreId: '2501' },
  { id: '250107', nombre: 'MANANTAY', padreId: '2501' },

  // --- Provincia: Atalaya (2502) ---
  { id: '250201', nombre: 'RAIMONDI', padreId: '2502' },
  { id: '250202', nombre: 'SEPAHUA', padreId: '2502' },
  { id: '250203', nombre: 'TAHUANIA', padreId: '2502' },
  { id: '250204', nombre: 'YURUA', padreId: '2502' },

  // --- Provincia: Padre Abad (2503) ---
  { id: '250301', nombre: 'PADRE ABAD', padreId: '2503' },
  { id: '250302', nombre: 'IRAZOLA', padreId: '2503' },
  { id: '250303', nombre: 'CURIMANA', padreId: '2503' },
  { id: '250304', nombre: 'NESHUYA', padreId: '2503' },
  { id: '250305', nombre: 'ALEXANDER VON HUMBOLDT', padreId: '2503' },

  // --- Provincia: Purús (2504) ---
  { id: '250401', nombre: 'PURUS', padreId: '2504' },
];

/**
 * Estructura de compatibilidad para el asistente de trámites (ENT-M02 / ENT-M04)
 */
export interface Provincia {
  nombre: string;
  distritos: string[];
}

export const UCAYALI_PROVINCIAS: readonly Provincia[] = [
  {
    nombre: 'Coronel Portillo',
    distritos: [
      'Callería',
      'Campoverde',
      'Iparía',
      'Masisea',
      'Yarinacocha',
      'Nueva Requena',
      'Manantay',
    ],
  },
  {
    nombre: 'Atalaya',
    distritos: ['Raymondi', 'Sepahua', 'Tahuanía', 'Yurúa'],
  },
  {
    nombre: 'Padre Abad',
    distritos: [
      'Padre Abad',
      'Irazola',
      'Curimaná',
      'Neshuya',
      'Alexander von Humboldt',
    ],
  },
  {
    nombre: 'Purús',
    distritos: ['Purús'],
  },
];