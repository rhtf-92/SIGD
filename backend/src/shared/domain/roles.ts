/**
 * Vocabulario canónico de roles del SIGD.
 *
 * FUENTE DE VERDAD: la tabla `sigd_org.rol_sistema`, sembrada por la migración
 * 03_sigd_org.sql. Ese seed ya está certificado y es el que emite el JWT, de modo
 * que el código de aplicación debe hablar el mismo idioma que la base de datos.
 *
 * Antes de este módulo coexistían dos vocabularios incompatibles:
 *   - la base de datos: ADMINISTRADOR, DIRECTOR, SECRETARIO, ESPECIALISTA,
 *     MESA_PARTES, CIUDADANO;
 *   - el código: SUPER_ADMIN, DOCENTE, ESTUDIANTE (nunca sembrados).
 * Consecuencia: el administrador sembrado en 08_sigd_mvp_seed.sql recibía el rol
 * ADMINISTRADOR y por lo tanto quedaba FUERA de los controles de acceso que
 * exigían SUPER_ADMIN, DOCENTE o ESTUDIANTE. No existía ningún camino por el
 * que un usuario real obtuviera autorización.
 *
 * `ROLES_CANONICOS` y `ROLES_PERSONAL` son la unica referencia que deben usar los
 * guards. El vocabulario antiguo queda ONLY como alias de normalización para
 * migrar con segurança datos preexistentes o clients antiguos.
 */

/** Roles sembrados en `sigd_org.rol_sistema`. */
export const ROLES_CANONICOS = [
  'ADMINISTRADOR',
  'DIRECTOR',
  'SECRETARIO',
  'ESPECIALISTA',
  'MESA_PARTES',
  'CIUDADANO',
] as const;

export type RolCanonico = (typeof ROLES_CANONICOS)[number];

/**
 * Roles con capacidad real de operar expedientes: todo el personal de la
 * institución. `CIUDADANO` queda excluido por diseño (Art. 137 LPAG): el
 * administrado sólo accede a su propia consulta pública y a su casilla.
 */
export const ROLES_PERSONAL: ReadonlySet<string> = new Set<string>([
  'ADMINISTRADOR',
  'DIRECTOR',
  'SECRETARIO',
  'ESPECIALISTA',
  'MESA_PARTES',
]);

/** Roles que administran la configuración institucional. */
export const ROLES_ADMINISTRACION: ReadonlySet<string> = new Set<string>([
  'ADMINISTRADOR',
  'DIRECTOR',
]);

/** Roles autorizados a ver la analítica ejecutiva (MGD-PCM). */
export const ROLES_ANALITICA: ReadonlySet<string> = new Set<string>([
  'ADMINISTRADOR',
  'DIRECTOR',
]);

/** Rol facultado para forzar el refresco de las vistas materializadas. */
export const ROLES_REFACTOR_VISTAS: ReadonlySet<string> = new Set<string>(['ADMINISTRADOR']);

/**
 * Normaliza un rol heredado al vocabulario canónico. Acepta el vocabulario
 * antiguo para no romper tokens emitidos antes de la unificación.
 */
export function normalizarRol(rol: string | null | undefined): RolCanonico | null {
  if (!rol) return null;
  const codigo = rol.trim().toUpperCase();
  switch (codigo) {
    case 'SUPER_ADMIN':
    case 'ADMINISTRADOR':
      return 'ADMINISTRADOR';
    case 'DIRECTOR':
      return 'DIRECTOR';
    case 'DOCENTE':
    case 'SECRETARIO':
      return 'SECRETARIO';
    case 'ESPECIALISTA':
      return 'ESPECIALISTA';
    case 'MESA_PARTES':
      return 'MESA_PARTES';
    case 'ESTUDIANTE':
    case 'CIUDADANO':
      return 'CIUDADANO';
    default:
      return null;
  }
}

/**
 * Normaliza una lista de roles y descarta los desconocidos, de modo que un JWT
 * con roles antiguos siga autorizando lo que corresponde.
 */
export function normalizarRoles(roles: readonly string[] | null | undefined): RolCanonico[] {
  if (!roles) return [];
  const vistos = new Set<RolCanonico>();
  for (const rol of roles) {
    const normalizado = normalizarRol(rol);
    if (normalizado) vistos.add(normalizado);
  }
  return [...vistos];
}

/** ¿El actor tiene al menos uno de los roles indicados? */
export function tieneAlgunRol(roles: readonly string[], exigidos: ReadonlySet<string>): boolean {
  return roles.some((rol) => exigidos.has(normalizarRol(rol) ?? ''));
}

/** Etiqueta legible de un rol canónico, para las respuestas de la API. */
export const ETIQUETAS_ROL: Record<RolCanonico, string> = {
  ADMINISTRADOR: 'Administrador del sistema',
  DIRECTOR: 'Director General',
  SECRETARIO: 'Secretario / Docente',
  ESPECIALISTA: 'Especialista',
  MESA_PARTES: 'Mesa de Partes',
  CIUDADANO: 'Ciudadano / Administrado',
};
