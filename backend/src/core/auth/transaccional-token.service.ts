import crypto from 'node:crypto';
import { AppError } from '../../shared/domain/errors/index.js';

export type TipoOperacionTransaccional =
  | 'RECTIFICAR_ENCARGATURA'
  | 'REVOCAR_PERMISO'
  | 'ASIGNAR_PERMISO'
  | 'AUTORIZAR_SUPLENCIA';

export interface TokenTransaccionalInput {
  kid: string;
  userId: string;
  op: TipoOperacionTransaccional;
  targetId: string;
  subTargetId?: string;
  contentHash: string;
  institucionId: string;
  correlationId: string;
  ventanaSegundos?: number; // Máximo 60s
}

export interface TokenPayloadJson {
  iss: 'SIGD_API_BACKEND';
  aud: 'SIGD_POSTGRESQL_ENGINE';
  kid: string;
  user_id: string;
  op: TipoOperacionTransaccional;
  target_id: string;
  sub_target_id?: string;
  content_hash: string;
  institucion_id: string;
  correlation_id: string;
  iat: number;
  exp: number;
  nonce: string;
}

export interface ParamsContentHashRectificar {
  encargaturaId: string;
  campo: string;
  valorAnterior?: string | null;
  valorNuevo: string;
  documentoSustentoTipo?: string | null;
  documentoSustentoNumero?: string | null;
  justificacion: string;
}

export interface ParamsContentHashRevocar {
  encargaturaId: string;
  permisoId: string;
  motivo: string;
}

export interface ParamsContentHashAsignar {
  encargaturaId: string;
  permisoId: string;
}

export interface ParamsContentHashSuplencia {
  encargaturaId: string;
  codigoPermiso: string;
  tipoDocumento?: string | null;
}

/**
 * Servicio Criptográfico Transaccional SIGD
 * Unifica la serialización canónica, cálculo de huella SHA-256 y firma HMAC-SHA256
 * compartida entre NestJS y PostgreSQL 18.6 (TSK-1.2-M).
 */
export class TransaccionalTokenService {
  /**
   * Genera la serialización canónica y digestión SHA-256 idéntica a PL/pgSQL
   */
  static calcularContentHashRectificar(params: ParamsContentHashRectificar): string {
    const canonical =
      `OP:RECTIFICAR_ENCARGATURA|TARGET:${params.encargaturaId}|CAMPO:${params.campo ?? ''}` +
      `|VAL_ANT:${params.valorAnterior ?? ''}|VAL_NUEVO:${params.valorNuevo ?? ''}` +
      `|DOC_TIPO:${params.documentoSustentoTipo ?? ''}|DOC_NUM:${params.documentoSustentoNumero ?? ''}` +
      `|JUST:${params.justificacion ?? ''}`;
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  static calcularContentHashRevocar(params: ParamsContentHashRevocar): string {
    const canonical =
      `OP:REVOCAR_PERMISO|TARGET:${params.encargaturaId}|PERM:${params.permisoId}|MOTIVO:${params.motivo ?? ''}`;
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  static calcularContentHashAsignar(params: ParamsContentHashAsignar): string {
    const canonical = `OP:ASIGNAR_PERMISO|TARGET:${params.encargaturaId}|PERM:${params.permisoId}`;
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  static calcularContentHashSuplencia(params: ParamsContentHashSuplencia): string {
    const canonical =
      `OP:AUTORIZAR_SUPLENCIA|TARGET:${params.encargaturaId}|PERM:${params.codigoPermiso ?? ''}|DOC_TIPO:${params.tipoDocumento ?? ''}`;
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /**
   * Genera el token transaccional en formato <payload_b64>.<signature_hex>
   */
  static generarToken(input: TokenTransaccionalInput, secreto: string): string {
    if (!secreto || secreto.trim() === '') {
      throw new AppError({
        status: 500,
        code: 'CRYPTO_SECRET_MISSING',
        message: 'No se configuró el secreto de firma transaccional institucional.',
      });
    }

    const nowEpoch = Date.now() / 1000;
    const ventana = Math.min(Math.max(input.ventanaSegundos ?? 30, 5), 60);
    const nonce = crypto.randomBytes(32).toString('hex');

    const payload: TokenPayloadJson = {
      iss: 'SIGD_API_BACKEND',
      aud: 'SIGD_POSTGRESQL_ENGINE',
      kid: input.kid,
      user_id: input.userId,
      op: input.op,
      target_id: input.targetId,
      sub_target_id: input.subTargetId,
      content_hash: input.contentHash,
      institucion_id: input.institucionId,
      correlation_id: input.correlationId,
      iat: Math.round(nowEpoch * 1000) / 1000,
      exp: Math.round((nowEpoch + ventana) * 1000) / 1000,
      nonce,
    };

    const payloadJsonStr = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadJsonStr, 'utf8').toString('base64');
    const signature = crypto.createHmac('sha256', secreto).update(payloadB64).digest('hex');

    return `${payloadB64}.${signature}`;
  }

  /**
   * Deserializa y valida localmente en Node.js un token transaccional
   */
  static validarTokenLocal(
    token: string,
    secreto: string,
    opEsperada: TipoOperacionTransaccional,
    targetIdEsperado: string,
    subTargetEsperado?: string,
    contentHashEsperado?: string,
  ): TokenPayloadJson {
    if (!token || typeof token !== 'string') {
      throw new AppError({
        status: 400,
        code: 'TOKEN_INVALID_FORMAT',
        message: 'Formato de token transaccional inválido.',
      });
    }

    const partes = token.split('.');
    if (partes.length !== 2) {
      throw new AppError({
        status: 400,
        code: 'TOKEN_INVALID_STRUCTURE',
        message: 'El token debe contener exactamente <payload_b64>.<signature_hex>.',
      });
    }

    const [payloadB64, firmaRecibida] = partes;
    const firmaEsperada = crypto.createHmac('sha256', secreto).update(payloadB64).digest('hex');

    // Comparación en tiempo constante para mitigar timing attacks
    const bufRecibido = Buffer.from(firmaRecibida, 'hex');
    const bufEsperado = Buffer.from(firmaEsperada, 'hex');
    if (bufRecibido.length !== bufEsperado.length || !crypto.timingSafeEqual(bufRecibido, bufEsperado)) {
      throw new AppError({
        status: 403,
        code: 'TOKEN_SIGNATURE_MISMATCH',
        message: 'Firma del token transaccional inválida.',
      });
    }

    let payload: TokenPayloadJson;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    } catch {
      throw new AppError({
        status: 400,
        code: 'TOKEN_CORRUPT_JSON',
        message: 'La carga del token transaccional no es un JSON válido.',
      });
    }

    if (
      !payload.iss ||
      !payload.aud ||
      !payload.kid ||
      !payload.user_id ||
      !payload.op ||
      !payload.target_id ||
      !payload.content_hash ||
      !payload.nonce ||
      !payload.institucion_id ||
      !payload.correlation_id
    ) {
      throw new AppError({
        status: 400,
        code: 'TOKEN_MISSING_PROPERTIES',
        message: 'El token transaccional carece de propiedades obligatorias de cabecera o identidad.',
      });
    }

    if (payload.iss !== 'SIGD_API_BACKEND' || payload.aud !== 'SIGD_POSTGRESQL_ENGINE') {
      throw new AppError({
        status: 403,
        code: 'TOKEN_UNAUTHORIZED_PARTIES',
        message: 'Emisor (iss) o audiencia (aud) no válidos en el token transaccional.',
      });
    }

    const nowEpoch = Date.now() / 1000;
    if (payload.iat > nowEpoch + 5) {
      throw new AppError({
        status: 403,
        code: 'TOKEN_PREMATURE',
        message: 'Token transaccional emitido en el futuro.',
      });
    }

    if (payload.exp <= nowEpoch) {
      throw new AppError({
        status: 403,
        code: 'TOKEN_EXPIRED',
        message: 'Token transaccional expirado.',
      });
    }

    if (payload.exp - payload.iat > 60 || payload.exp <= payload.iat) {
      throw new AppError({
        status: 403,
        code: 'TOKEN_INVALID_WINDOW',
        message: 'Ventana de validez del token transaccional inválida (>60s).',
      });
    }

    if (payload.op !== opEsperada) {
      throw new AppError({
        status: 403,
        code: 'TOKEN_OPERATION_MISMATCH',
        message: `Operación autorizada (${payload.op}) no coincide con la esperada (${opEsperada}).`,
      });
    }

    if (payload.target_id !== targetIdEsperado) {
      throw new AppError({
        status: 403,
        code: 'TOKEN_TARGET_MISMATCH',
        message: 'Destino autorizado no coincide.',
      });
    }

    if (subTargetEsperado !== undefined && payload.sub_target_id !== subTargetEsperado) {
      throw new AppError({
        status: 403,
        code: 'TOKEN_SUBTARGET_MISMATCH',
        message: 'Sub-destino autorizado no coincide.',
      });
    }

    if (contentHashEsperado !== undefined && payload.content_hash !== contentHashEsperado) {
      throw new AppError({
        status: 403,
        code: 'TOKEN_CONTENT_DIGEST_MISMATCH',
        message: 'El resumen criptográfico del contenido no coincide.',
      });
    }

    return payload;
  }
}
