import crypto from 'node:crypto';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';

export interface ClaimsJwt {
  sub: string;
  /** Huella persistida del refresh token que identifica y permite revocar la sesión. */
  sid?: string;
  roles: string[];
  rolesAutorizados: string[];
  rolActivo: string;
  iat: number;
  exp: number;
  typ: 'access';
  scope?: string;
  resource?: string;
}

export interface ClaimsSeleccionPerfil {
  sub: string;
  rolesAutorizados: string[];
  iat: number;
  exp: number;
  typ: 'role_selection';
}

export interface ClaimsRefresh {
  sub: string;
  rolesAutorizados: string[];
  rolActivo: string;
  jti: string;
  iat: number;
  exp: number;
  typ: 'refresh';
}

export interface OpcionesFirma {
  sub: string;
  sid?: string;
  roles?: string[];
  rolesAutorizados?: string[];
  rolActivo?: string;
  expiraSegundos?: number;
  ahora?: number;
  secreto?: string;
  scope?: string;
  resource?: string;
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const MARCADOR_SECRETO = /^(?:REPLACE_WITH_|EXAMPLE_|CHANGE_ME|CHANGEME|PLACEHOLDER)/i;

function base64url(datos: Buffer | string): string {
  return Buffer.from(datos).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(texto: string): Buffer {
  const normalizado = texto.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = normalizado.length % 4 === 0 ? '' : '='.repeat(4 - (normalizado.length % 4));
  return Buffer.from(normalizado + relleno, 'base64');
}

export function secretoJwt(env: NodeJS.ProcessEnv = process.env): string {
  const secreto = env.AUTH_JWT_SECRET ?? env.JWT_SECRET;
  const secretoNormalizado = secreto?.trim() ?? '';
  const esProduccion = env.NODE_ENV?.toLowerCase() === 'production';
  if (
    secretoNormalizado.length < 32 ||
    (esProduccion && MARCADOR_SECRETO.test(secretoNormalizado))
  ) {
    throw new Error(
      'AUTH_JWT_SECRET no configurado, inseguro para producción o demasiado corto ' +
        '(mínimo 32 caracteres). Defina una variable de entorno segura antes de emitir o verificar tokens.',
    );
  }
  return secreto as string;
}

function firmarClaims(claims: object, secreto?: string): string {
  const encabezado = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const cuerpo = base64url(JSON.stringify(claims));
  const firma = crypto
    .createHmac('sha256', secreto ?? secretoJwt())
    .update(`${encabezado}.${cuerpo}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${encabezado}.${cuerpo}.${firma}`;
}

function verificarClaimsFirmados(token: string, secreto?: string): Record<string, unknown> {
  const partes = token.trim().split('.');
  if (partes.length !== 3 || !partes.every((p) => BASE64URL.test(p))) {
    throw new UnauthorizedError({ detail: 'Token mal formado.' });
  }

  const [encabezadoCrudo, cuerpoCrudo, firma] = partes;
  const esperado = crypto
    .createHmac('sha256', secreto ?? secretoJwt())
    .update(`${encabezadoCrudo}.${cuerpoCrudo}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const firmaRecibida = Buffer.from(firma);
  const firmaEsperada = Buffer.from(esperado);
  if (firmaRecibida.length !== firmaEsperada.length || !crypto.timingSafeEqual(firmaRecibida, firmaEsperada)) {
    throw new UnauthorizedError({ detail: 'Firma del token inválida.' });
  }
  try {
    return JSON.parse(fromBase64url(cuerpoCrudo).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new UnauthorizedError({ detail: 'Contenido del token ilegible.' });
  }
}

function verificarExpiracion(claims: Record<string, unknown>, ahoraMs?: number): void {
  const ahora = Math.floor((ahoraMs ?? Date.now()) / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= ahora) {
    throw new UnauthorizedError({ detail: 'El token ha expirado.' });
  }
}

export function firmarTokenAcceso(opciones: OpcionesFirma): string {
  const ahora = Math.floor((opciones.ahora ?? Date.now()) / 1000);
  const rolActivo = opciones.rolActivo ?? opciones.roles?.[0] ?? '';
  const rolesAutorizados = opciones.rolesAutorizados ?? opciones.roles ?? (rolActivo ? [rolActivo] : []);
  const claims: ClaimsJwt = {
    sub: opciones.sub,
    ...(opciones.sid ? { sid: opciones.sid } : {}),
    roles: rolActivo ? [rolActivo] : [],
    rolesAutorizados,
    rolActivo,
    iat: ahora,
    exp: ahora + (opciones.expiraSegundos ?? 900),
    typ: 'access',
  };
  if (opciones.scope !== undefined) claims.scope = opciones.scope;
  if (opciones.resource !== undefined) claims.resource = opciones.resource;

  return firmarClaims(claims, opciones.secreto);
}

export function firmarTokenSeleccionPerfil(opciones: Omit<OpcionesFirma, 'roles' | 'rolActivo'> & { rolesAutorizados: string[] }): string {
  const ahora = Math.floor((opciones.ahora ?? Date.now()) / 1000);
  return firmarClaims({
    sub: opciones.sub,
    rolesAutorizados: opciones.rolesAutorizados,
    iat: ahora,
    exp: ahora + (opciones.expiraSegundos ?? 300),
    typ: 'role_selection',
  } satisfies ClaimsSeleccionPerfil, opciones.secreto);
}

export function firmarTokenRefresco(opciones: OpcionesFirma): string {
  const ahora = Math.floor((opciones.ahora ?? Date.now()) / 1000);
  const rolActivo = opciones.rolActivo ?? opciones.roles?.[0] ?? '';
  return firmarClaims({
    sub: opciones.sub,
    rolesAutorizados: opciones.rolesAutorizados ?? opciones.roles ?? [rolActivo],
    rolActivo,
    jti: crypto.randomUUID(),
    iat: ahora,
    exp: ahora + (opciones.expiraSegundos ?? 7 * 24 * 60 * 60),
    typ: 'refresh',
  } satisfies ClaimsRefresh, opciones.secreto);
}

export function verificarTokenAcceso(
  token: string,
  opciones: { ahora?: number; secreto?: string; permitirAlcance?: boolean } = {},
): ClaimsJwt {
  const claims = verificarClaimsFirmados(token, opciones.secreto) as unknown as ClaimsJwt;

  if (claims.typ !== 'access' || typeof claims.sub !== 'string' || claims.sub === '') {
    throw new UnauthorizedError({ detail: 'El token no corresponde a un token de acceso.' });
  }
  if (claims.sid !== undefined && (typeof claims.sid !== 'string' || claims.sid.length < 16)) {
    throw new UnauthorizedError({ detail: 'La sesión asociada al token no es válida.' });
  }
  if (claims.scope !== undefined && !opciones.permitirAlcance) {
    throw new UnauthorizedError({ detail: 'El token está limitado a un recurso específico.' });
  }

  verificarExpiracion(claims as unknown as Record<string, unknown>, opciones.ahora);
  const roles = Array.isArray(claims.roles) ? claims.roles : [];
  const rolActivo = typeof claims.rolActivo === 'string' ? claims.rolActivo : roles[0] ?? '';
  const rolesAutorizados = Array.isArray(claims.rolesAutorizados) ? claims.rolesAutorizados : roles;
  return { ...claims, roles: rolActivo ? [rolActivo] : [], rolActivo, rolesAutorizados };
}

export function verificarTokenSeleccionPerfil(token: string, opciones: { ahora?: number; secreto?: string } = {}): ClaimsSeleccionPerfil {
  const claims = verificarClaimsFirmados(token, opciones.secreto) as unknown as ClaimsSeleccionPerfil;
  if (claims.typ !== 'role_selection' || typeof claims.sub !== 'string' || !Array.isArray(claims.rolesAutorizados)) {
    throw new UnauthorizedError({ detail: 'El token no permite seleccionar un perfil.' });
  }
  verificarExpiracion(claims as unknown as Record<string, unknown>, opciones.ahora);
  return claims;
}

export function verificarTokenRefresco(token: string, opciones: { ahora?: number; secreto?: string } = {}): ClaimsRefresh {
  const claims = verificarClaimsFirmados(token, opciones.secreto) as unknown as ClaimsRefresh;
  if (claims.typ !== 'refresh' || typeof claims.sub !== 'string' || typeof claims.rolActivo !== 'string') {
    throw new UnauthorizedError({ detail: 'El token no corresponde a una sesión renovable.' });
  }
  verificarExpiracion(claims as unknown as Record<string, unknown>, opciones.ahora);
  return claims;
}

export const SCOPE_DESCARGA_DOCUCORE = 'docucore:documento:descargar';

export type ClaimsJwtDescargaDocuCore = ClaimsJwt & {
  scope: typeof SCOPE_DESCARGA_DOCUCORE;
  resource: string;
};

export function firmarTokenDescargaDocuCore(
  usuarioId: string,
  expedienteId: string,
  expiraSegundos = 300,
): string {
  return firmarTokenAcceso({
    sub: usuarioId,
    expiraSegundos,
    scope: SCOPE_DESCARGA_DOCUCORE,
    resource: expedienteId,
  });
}

export function verificarTokenDescargaDocuCore(token: string): ClaimsJwtDescargaDocuCore {
  const claims = verificarTokenAcceso(token, { permitirAlcance: true });
  if (claims.scope !== SCOPE_DESCARGA_DOCUCORE || !claims.resource) {
    throw new UnauthorizedError({ detail: 'El token no autoriza la descarga solicitada.' });
  }
  return {
    ...claims,
    scope: SCOPE_DESCARGA_DOCUCORE,
    resource: claims.resource,
  };
}

export function extraerTokenBearer(cabeceraAuthorization: string | undefined): string | null {
  if (!cabeceraAuthorization) return null;
  const partes = cabeceraAuthorization.trim().split(/\s+/);
  if (partes.length !== 2 || partes[0].toLowerCase() !== 'bearer') return null;
  return partes[1].trim() === '' ? null : partes[1].trim();
}
