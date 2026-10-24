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

/**
 * Categorías de segmentación de módulos en la página principal.
 */
export type CategoriaModulo = 'PUBLICO' | 'CIUDADANO' | 'INSTITUCIONAL';

export interface ModuloHomeItem {
  id: string;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  ruta: string;
  categoria: CategoriaModulo;
  badge: 'Público' | 'Requiere login' | 'Requiere rol institucional';
  ctaPublico: string;
  ctaAutenticado?: string;
  rolesPermitidos?: readonly RolCanonica[];
}

/**
 * 1. Módulos Públicos: Servicios abiertos a la ciudadanía sin login previo.
 */
export const MODULOS_HOME_PUBLICOS: readonly ModuloHomeItem[] = [
  {
    id: 'consulta-cut',
    titulo: 'Consulta Pública por CUT',
    subtitulo: 'Seguimiento 24x7',
    descripcion:
      'Consulta el estado procesal y trazabilidad de tu trámite en tiempo real sin requerir inicio de sesión.',
    ruta: '/consulta',
    categoria: 'PUBLICO',
    badge: 'Público',
    ctaPublico: 'Consultar trámite',
  },
  {
    id: 'registro-ciudadano',
    titulo: 'Registro Ciudadano',
    subtitulo: 'ENT-M01-01 / ENT-M01-02',
    descripcion:
      'Registro de personas naturales y jurídicas con validación RENIEC / SUNAT y Ubigeo Ucayali.',
    ruta: '/registro',
    categoria: 'PUBLICO',
    badge: 'Público',
    ctaPublico: 'Registrar cuenta',
  },
  {
    id: 'validador-cvd',
    titulo: 'Validador CVD',
    subtitulo: 'MOD-04 / Verificación',
    descripcion:
      'Valida la autenticidad e integridad de documentos firmados digitalmente mediante el Código de Verificación.',
    ruta: '/validador-cvd',
    categoria: 'PUBLICO',
    badge: 'Público',
    ctaPublico: 'Verificar documento',
  },
  {
    id: 'flujo-validez-legal',
    titulo: 'Flujo y Validez Legal',
    subtitulo: 'MOD-04 / Firma Digital',
    descripcion:
      'Demostración técnica del flujo de firma digital e integridad criptográfica.',
    ruta: '/flujo-validez-legal',
    categoria: 'PUBLICO',
    badge: 'Público',
    ctaPublico: 'Ver flujo y validez',
  },
  {
    id: 'iniciar-sesion',
    titulo: 'Iniciar Sesión',
    subtitulo: 'Acceso Institucional y Ciudadano',
    descripcion:
      'Ingreso al sistema SIGD con credenciales y verificación de perfil asignado.',
    ruta: '/login',
    categoria: 'PUBLICO',
    badge: 'Público',
    ctaPublico: 'Iniciar sesión',
  },
];

/**
 * 2. Módulos de Cuenta Ciudadana: Requieren autenticación con rol CIUDADANO.
 */
export const MODULOS_HOME_CIUDADANO: readonly ModuloHomeItem[] = [
  {
    id: 'mesa-partes-virtual',
    titulo: 'Mesa de Partes Virtual',
    subtitulo: 'ENT-M02 / TUPA',
    descripcion:
      'Presentación y radicación de trámites digitales, requisitos TUPA y anexos documentales.',
    ruta: '/tramite',
    categoria: 'CIUDADANO',
    badge: 'Requiere login',
    ctaPublico: 'Iniciar sesión para acceder',
    ctaAutenticado: 'Acceder a Mesa de Partes',
    rolesPermitidos: ['CIUDADANO'],
  },
  {
    id: 'mis-expedientes',
    titulo: 'Mis Expedientes',
    subtitulo: 'Portal Ciudadano',
    descripcion:
      'Consulta centralizada y seguimiento exclusivo de los trámites y expedientes de tu autoría.',
    ruta: '/mis-expedientes',
    categoria: 'CIUDADANO',
    badge: 'Requiere login',
    ctaPublico: 'Iniciar sesión para acceder',
    ctaAutenticado: 'Ver mis expedientes',
    rolesPermitidos: ['CIUDADANO'],
  },
  {
    id: 'casilla-electronica',
    titulo: 'Casilla Electrónica',
    subtitulo: 'ENT-M01-03',
    descripcion:
      'Consulta y recepción de notificaciones electrónicas institucionales con plena validez legal.',
    ruta: '/casilla',
    categoria: 'CIUDADANO',
    badge: 'Requiere login',
    ctaPublico: 'Iniciar sesión para acceder',
    ctaAutenticado: 'Abrir casilla electrónica',
    rolesPermitidos: ['CIUDADANO'],
  },
];

/**
 * 3. Módulos Institucionales: Requieren rol institucional asignado.
 */
export const MODULOS_HOME_INSTITUCIONAL: readonly ModuloHomeItem[] = [
  {
    id: 'bandeja-expedientes',
    titulo: 'Bandeja de Expedientes',
    subtitulo: 'ENT-M05 / Institucional',
    descripcion:
      'Gestiona y consulta el estado, trazabilidad, providencias y foliado de expedientes institucionales.',
    ruta: '/expedientes',
    categoria: 'INSTITUCIONAL',
    badge: 'Requiere rol institucional',
    ctaPublico: 'Acceso con rol asignado',
    ctaAutenticado: 'Ir a bandeja institucional',
    rolesPermitidos: [
      'MESA_PARTES',
      'ESPECIALISTA',
      'SECRETARIO',
      'DIRECTOR',
      'ADMINISTRADOR',
    ],
  },
  {
    id: 'ventanilla-presencial',
    titulo: 'Ventanilla Presencial',
    subtitulo: 'Mesa de Partes Física',
    descripcion:
      'Recepción física de documentos en ventanilla y emisión de ticket térmico correlativo.',
    ruta: '/tramite/ventanilla-presencial',
    categoria: 'INSTITUCIONAL',
    badge: 'Requiere rol institucional',
    ctaPublico: 'Acceso con rol asignado',
    ctaAutenticado: 'Abrir ventanilla presencial',
    rolesPermitidos: ['MESA_PARTES', 'ADMINISTRADOR'],
  },
  {
    id: 'panel-administracion',
    titulo: 'Panel de Administración',
    subtitulo: 'ENT-M05-01 / RBAC',
    descripcion:
      'Gestión de usuarios, roles, permisos, auditoría, tablas maestras y calendario laboral.',
    ruta: '/administracion',
    categoria: 'INSTITUCIONAL',
    badge: 'Requiere rol institucional',
    ctaPublico: 'Acceso con rol asignado',
    ctaAutenticado: 'Ingresar a administración',
    rolesPermitidos: ['ADMINISTRADOR'],
  },
  {
    id: 'reportes-tableros',
    titulo: 'Reportes y Tableros',
    subtitulo: '06_reportes-tablero-control',
    descripcion:
      'Consulta indicadores ejecutivos, tendencias, distribución de expedientes y cuellos de botella.',
    ruta: '/reportes/dashboard',
    categoria: 'INSTITUCIONAL',
    badge: 'Requiere rol institucional',
    ctaPublico: 'Acceso con rol asignado',
    ctaAutenticado: 'Ver tablero directivo',
    rolesPermitidos: ['DIRECTOR', 'ADMINISTRADOR'],
  },
];
