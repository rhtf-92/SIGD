import crypto from 'node:crypto';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';

export interface ClaimsJwt {
  sub: string;
  roles: string[];
  iat: number;
  exp: number;
  typ: 'access';
}

export interface OpcionesFirma {
  sub: string;
  roles?: string[];
  expiraSegundos?: number;
  ahora?: number;
  secreto?: string;
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;

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
  if (!secreto || secreto.trim().length < 32) {
    throw new Error(
      'AUTH_JWT_SECRET no configurado o demasiado corto (mínimo 32 caracteres). ' +
        'Defina la variable de entorno antes de emitir o verificar tokens.',
    );
  }
  return secreto;
}

export function firmarTokenAcceso(opciones: OpcionesFirma): string {
  const ahora = Math.floor((opciones.ahora ?? Date.now()) / 1000);
  const claims: ClaimsJwt = {
    sub: opciones.sub,
    roles: opciones.roles ?? [],
    iat: ahora,
    exp: ahora + (opciones.expiraSegundos ?? 900),
    typ: 'access',
  };

  const encabezado = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const cuerpo = base64url(JSON.stringify(claims));
  const firma = crypto
    .createHmac('sha256', opciones.secreto ?? secretoJwt())
    .update(`${encabezado}.${cuerpo}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${encabezado}.${cuerpo}.${firma}`;
}

export function verificarTokenAcceso(token: string, opciones: { ahora?: number; secreto?: string } = {}): ClaimsJwt {
  const partes = token.trim().split('.');
  if (partes.length !== 3 || !partes.every((p) => BASE64URL.test(p))) {
    throw new UnauthorizedError({ detail: 'Token de acceso mal formado.' });
  }

  const [encabezadoCrudo, cuerpoCrudo, firma] = partes;
  const esperado = crypto
    .createHmac('sha256', opciones.secreto ?? secretoJwt())
    .update(`${encabezadoCrudo}.${cuerpoCrudo}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const firmaRecibida = Buffer.from(firma);
  const firmaEsperada = Buffer.from(esperado);
  if (
    firmaRecibida.length !== firmaEsperada.length ||
    !crypto.timingSafeEqual(firmaRecibida, firmaEsperada)
  ) {
    throw new UnauthorizedError({ detail: 'Firma del token de acceso inválida.' });
  }

  let claims: ClaimsJwt;
  try {
    claims = JSON.parse(fromBase64url(cuerpoCrudo).toString('utf8')) as ClaimsJwt;
  } catch {
    throw new UnauthorizedError({ detail: 'Contenido del token de acceso ilegible.' });
  }

  if (claims.typ !== 'access' || typeof claims.sub !== 'string' || claims.sub === '') {
    throw new UnauthorizedError({ detail: 'El token no corresponde a un token de acceso.' });
  }

  const ahora = Math.floor((opciones.ahora ?? Date.now()) / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= ahora) {
    throw new UnauthorizedError({ detail: 'El token de acceso ha expirado.' });
  }

  return { ...claims, roles: Array.isArray(claims.roles) ? claims.roles : [] };
}

export function extraerTokenBearer(cabeceraAuthorization: string | undefined): string | null {
  if (!cabeceraAuthorization) return null;
  const partes = cabeceraAuthorization.trim().split(/\s+/);
  if (partes.length !== 2 || partes[0].toLowerCase() !== 'bearer') return null;
  return partes[1].trim() === '' ? null : partes[1].trim();
}