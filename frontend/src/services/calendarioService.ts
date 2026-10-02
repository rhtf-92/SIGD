// frontend/src/services/calendarioService.ts

export interface Feriado {
  fecha: string; // Formato 'YYYY-MM-DD'
  descripcion: string;
  tipo: 'NACIONAL' | 'REGIONAL_UCAYALI';
}

export const obtenerFeriados = async (): Promise<Feriado[]> => {
  const feriados: Feriado[] = [
    { fecha: '2026-06-24', descripcion: 'Fiesta de San Juan', tipo: 'REGIONAL_UCAYALI' },
    { fecha: '2026-10-13', descripcion: 'Aniversario de Pucallpa', tipo: 'REGIONAL_UCAYALI' },
    { fecha: '2026-01-01', descripcion: 'Año Nuevo', tipo: 'NACIONAL' },
    { fecha: '2026-04-02', descripcion: 'Jueves Santo', tipo: 'NACIONAL' },
    { fecha: '2026-04-03', descripcion: 'Viernes Santo', tipo: 'NACIONAL' },
    { fecha: '2026-05-01', descripcion: 'Día del Trabajo', tipo: 'NACIONAL' },
    { fecha: '2026-06-29', descripcion: 'San Pedro y San Pablo', tipo: 'NACIONAL' },
    { fecha: '2026-07-28', descripcion: 'Fiestas Patrias', tipo: 'NACIONAL' },
    { fecha: '2026-07-29', descripcion: 'Fiestas Patrias', tipo: 'NACIONAL' },
    { fecha: '2026-08-30', descripcion: 'Santa Rosa de Lima', tipo: 'NACIONAL' },
    { fecha: '2026-10-08', descripcion: 'Combate de Angamos', tipo: 'NACIONAL' },
    { fecha: '2026-11-01', descripcion: 'Día de Todos los Santos', tipo: 'NACIONAL' },
    { fecha: '2026-12-08', descripcion: 'Inmaculada Concepción', tipo: 'NACIONAL' },
    { fecha: '2026-12-25', descripcion: 'Navidad', tipo: 'NACIONAL' },
  ];

  return feriados;
};

export const esFeriado = (fechaStr: string, listaFeriados: Feriado[]): boolean => {
  return listaFeriados.some(f => f.fecha === fechaStr);
};