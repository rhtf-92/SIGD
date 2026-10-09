export type CategoriaTupaCandidato =
  | 'TITULACION'
  | 'SERVICIOS_ACADEMICOS'
  | 'PRACTICAS_EFSRT'
  | 'IDIOMAS'
  | 'CEPRETEC'
  | 'ALQUILERES_SERVICIOS'
  | 'VENTA_BIENES';

export interface ProcedimientoTupaCandidato {
  codigo: string;
  denominacion: string;
  categoria: CategoriaTupaCandidato;
  monto: number;
  uitPorcentaje?: number;
  requisitos: readonly string[];
  cuentaBancaria?: string;
  observaciones?: string;
  confirmado: boolean;
}

export const CUENTAS_BANCARIAS_TUPA_SUIZA_CANDIDATO = [
  {
    denominacion: 'Cta. Cte. Académica/Titulación',
    cuenta: '0512-015263-BANCO DE LA NACIÓN',
  },
  {
    denominacion: 'Cta. Cte. Proyectos/Servicios',
    cuenta: '0512-039170-BANCO DE LA NACIÓN',
  },
] as const;

export const PROCEDIMIENTOS_TUPA_SUIZA_2026_CANDIDATO: readonly ProcedimientoTupaCandidato[] = [
  {
    codigo: 'CAND-001',
    denominacion: 'FUT (3 unidades)',
    categoria: 'SERVICIOS_ACADEMICOS',
    monto: 4,
    uitPorcentaje: 0.07,
    requisitos: [],
    confirmado: true,
    observaciones: 'La fuente indica tres unidades por S/ 4.00; confirmar si el monto corresponde al conjunto o a cada unidad.',
  },
  {
    codigo: 'CAND-002',
    denominacion: 'Constancia de No Adeudar',
    categoria: 'SERVICIOS_ACADEMICOS',
    monto: 16.5,
    uitPorcentaje: 0.3,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-003',
    denominacion: 'Trabajo de Aplicación Profesional',
    categoria: 'TITULACION',
    monto: 57,
    uitPorcentaje: 1.03,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-004',
    denominacion: 'Examen de Suficiencia Profesional',
    categoria: 'TITULACION',
    monto: 57,
    uitPorcentaje: 1.03,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-005',
    denominacion: 'Expedición de Título',
    categoria: 'TITULACION',
    monto: 105,
    uitPorcentaje: 1.9,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-006',
    denominacion: 'Certificado de Estudios Superiores (6 semestres)',
    categoria: 'SERVICIOS_ACADEMICOS',
    monto: 124,
    uitPorcentaje: 2.24,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-007',
    denominacion: 'Inscripción de Título',
    categoria: 'TITULACION',
    monto: 120,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-008',
    denominacion: 'Derecho de Reincorporación (Reingreso)',
    categoria: 'SERVICIOS_ACADEMICOS',
    monto: 300,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-009',
    denominacion: 'Convalidación entre Planes de Estudio',
    categoria: 'SERVICIOS_ACADEMICOS',
    monto: 46.5,
    uitPorcentaje: 0.84,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-010',
    denominacion: 'Traslado Interno',
    categoria: 'SERVICIOS_ACADEMICOS',
    monto: 309,
    uitPorcentaje: 5.61,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-011',
    denominacion: 'Traslado Externo',
    categoria: 'SERVICIOS_ACADEMICOS',
    monto: 412,
    uitPorcentaje: 7.48,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-012',
    denominacion: 'EFSRT por Módulo (I al IV)',
    categoria: 'PRACTICAS_EFSRT',
    monto: 46.5,
    uitPorcentaje: 0.84,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-013',
    denominacion: 'Prácticas Finales',
    categoria: 'PRACTICAS_EFSRT',
    monto: 60,
    uitPorcentaje: 1.09,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-014',
    denominacion: 'Examen de Suficiencia de Idiomas',
    categoria: 'IDIOMAS',
    monto: 350,
    requisitos: [],
    confirmado: true,
  },
  {
    codigo: 'CAND-015',
    denominacion: 'Constancia do Carmende...',
    categoria: 'SERVICIOS_ACADEMICOS',
    monto: 31,
    requisitos: [],
    confirmado: false,
    observaciones: 'Registro dudoso: denominación truncada en el PDF; no publicar como trámite confirmado hasta cotejar la fuente íntegra.',
  },
];