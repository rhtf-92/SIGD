/**
 * Rutas canónicas institucionales del SIGD 2026.
 * Validadas contra AppRouter.tsx y navigation.config.ts.
 */
export const SIGD_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTRO: '/registro',
  CONSULTA_PUBLICA: '/consulta',
  TUPA_CATALOGO: '/tupa',
  SOLICITUD_ACCESO_TUPA: '/solicitud-acceso-tupa',
  TRAMITE_MESA_PARTES: '/tramite',
  MIS_EXPEDIENTES: '/mis-expedientes',
  CASILLA_ELECTRONICA: '/casilla',
  VALIDADOR_CVD: '/validador-cvd',
  FLUJO_VALIDEZ_LEGAL: '/flujo-validez-legal',
  TRANSPARENCIA: '/transparencia',
  TRANSPARENCIA_TUPA: '/transparencia/tupa',
} as const;
