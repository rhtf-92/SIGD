export type RolCanonica =
  | 'ADMINISTRADOR'
  | 'CIUDADANO'
  | 'DIRECTOR'
  | 'ESPECIALISTA'
  | 'MESA_PARTES'
  | 'SECRETARIO';

export interface NavItem {
  etiqueta: string;
  ruta: string;
}

/**
 * Destino canónico tras autenticación exitosa por rol.
 */
export const DESTINO_POR_ROL: Record<RolCanonica, string> = {
  CIUDADANO: '/tramite',
  MESA_PARTES: '/tramite/ventanilla-presencial',
  ESPECIALISTA: '/expedientes',
  SECRETARIO: '/expedientes',
  DIRECTOR: '/reportes/dashboard',
  ADMINISTRADOR: '/administracion',
};

/**
 * Menú de navegación pública para usuarios no autenticados.
 */
export const NAV_ITEMS_PUBLICOS: readonly NavItem[] = [
  { etiqueta: 'Inicio', ruta: '/' },
  { etiqueta: 'Consulta CUT', ruta: '/consulta' },
  { etiqueta: 'Validador CVD', ruta: '/validador-cvd' },
  { etiqueta: 'Flujo Validez Legal', ruta: '/flujo-validez-legal' },
  { etiqueta: 'Registro', ruta: '/registro' },
  { etiqueta: 'Iniciar Sesión', ruta: '/login' },
];

/**
 * Menú de navegación segmentado por cada rol canónico autenticado.
 */
export const NAV_ITEMS_POR_ROL: Record<RolCanonica, readonly NavItem[]> = {
  CIUDADANO: [
    { etiqueta: 'Nuevo Trámite', ruta: '/tramite' },
    { etiqueta: 'Mis Expedientes', ruta: '/mis-expedientes' },
    { etiqueta: 'Casilla Electrónica', ruta: '/casilla' },
    { etiqueta: 'Consulta CUT', ruta: '/consulta' },
  ],
  MESA_PARTES: [
    { etiqueta: 'Ventanilla Presencial', ruta: '/tramite/ventanilla-presencial' },
    { etiqueta: 'Bandeja de Expedientes', ruta: '/expedientes' },
    { etiqueta: 'Consulta CUT', ruta: '/consulta' },
  ],
  ESPECIALISTA: [
    { etiqueta: 'Bandeja de Expedientes', ruta: '/expedientes' },
    { etiqueta: 'Consulta CUT', ruta: '/consulta' },
  ],
  SECRETARIO: [
    { etiqueta: 'Bandeja de Expedientes', ruta: '/expedientes' },
    { etiqueta: 'Consulta CUT', ruta: '/consulta' },
  ],
  DIRECTOR: [
    { etiqueta: 'Reportes y Tableros', ruta: '/reportes/dashboard' },
    { etiqueta: 'Bandeja de Expedientes', ruta: '/expedientes' },
    { etiqueta: 'Validador CVD', ruta: '/validador-cvd' },
  ],
  ADMINISTRADOR: [
    { etiqueta: 'Administración', ruta: '/administracion' },
    { etiqueta: 'Bandeja de Expedientes', ruta: '/expedientes' },
    { etiqueta: 'Ventanilla Presencial', ruta: '/tramite/ventanilla-presencial' },
    { etiqueta: 'Reportes', ruta: '/reportes/dashboard' },
    { etiqueta: 'Calendario Laboral', ruta: '/calendarizacion-institucional' },
  ],
};
