import { filtrosResumenSchema } from './src/domains/corelink/reportes.schemas.js';

const testQuery = {
  fechaInicio: '2026-01-01',
  fechaFin: '2026-12-31',
  periodo: 'anual',
  diasLimite: '5',
  anio: '2026',
};

const result = filtrosResumenSchema.safeParse(testQuery);
console.log('Result:', JSON.stringify(result, null, 2));
