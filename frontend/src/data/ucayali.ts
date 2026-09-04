// Catálogo de Ubigeo simplificado: Región Ucayali
// Fuente: División política oficial (INEI)

export interface Provincia {
  nombre: string;
  distritos: string[];
}

export const UCAYALI_PROVINCIAS: Provincia[] = [
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