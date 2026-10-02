/**
 * Motor Matemático de los 4 KPIs Oficiales (MGD)
 * Desarrollado por: Jennifer Gatica (F_GATICA)
 */
export const KpiCalculatorService = {

  // 1. VTEP: (Atendidos + Archivados / Radicados) * 100 (Meta >= 95)
  calculateVTEP: (atendidos: number, archivados: number, radicados: number): number => {
    if (radicados === 0) return 0; // Control estricto de división por cero
    const total = ((atendidos + archivados) / radicados) * 100;
    return Number(total.toFixed(2)); // Redondeo determinista a 2 decimales
  },

  // 2. TPR: Tiempo promedio de respuesta en horas hábiles (Meta <= 24 hrs)
  calculateTPR: (totalHorasHabiles: number, expedientesResueltos: number): number => {
    if (expedientesResueltos === 0) return 0;
    const promedio = totalHorasHabiles / expedientesResueltos;
    return Number(promedio.toFixed(2));
  },

  // 3. TRO: Tasa de resolución dentro del plazo legal de 30 días hábiles (Meta >= 90)
  calculateTRO: (resueltosEnPlazo: number, totalResueltos: number): number => {
    if (totalResueltos === 0) return 0;
    const tasa = (resueltosEnPlazo / totalResueltos) * 100;
    return Number(tasa.toFixed(2));
  },

  // 4. TEO: Tasa de expedientes observados (Meta <= 5)
  calculateTEO: (observados: number, radicados: number): number => {
    if (radicados === 0) return 0;
    const tasa = (observados / radicados) * 100;
    return Number(tasa.toFixed(2));
  }

};