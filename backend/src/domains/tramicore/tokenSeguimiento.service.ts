import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { AppError } from '../../shared/domain/errors/index.js';

/**
 * Tiempo de vida predeterminado para el token de seguimiento público (en días).
 * Se puede configurar mediante la variable de entorno `PUBLIC_TRACKING_TOKEN_TTL_DAYS`.
 * Nota: El valor final de 180 días es propuesto y requiere ratificación institucional.
 */
export const DEFAULT_TRACKING_TOKEN_TTL_DAYS = 180;

export interface TokenSeguimientoEmitido {
  token: string;
  tokenHash: string;
  expiraEn: Date;
  idToken?: string;
}

export type MotivoFalloValidacion =
  | 'FORMATO_INVALIDO'
  | 'TABLA_NO_DISPONIBLE'
  | 'EXPEDIENTE_NO_ENCONTRADO'
  | 'TOKEN_NO_ENCONTRADO'
  | 'TOKEN_INVALIDO'
  | 'TOKEN_REVOCADO'
  | 'TOKEN_VENCIDO';

export interface ResultadoValidacionToken {
  valido: boolean;
  expedienteId?: string;
  idToken?: string;
  motivo?: MotivoFalloValidacion;
}

export class TokenSeguimientoService {
  constructor(private readonly pool: Pool) {}

  /**
   * Obtiene la política de días de expiración configurada en el entorno o usa el default.
   */
  obtenerTtlDias(): number {
    const envVal = Number(process.env.PUBLIC_TRACKING_TOKEN_TTL_DAYS);
    if (!Number.isNaN(envVal) && envVal > 0 && Number.isSafeInteger(envVal)) {
      return envVal;
    }
    return DEFAULT_TRACKING_TOKEN_TTL_DAYS;
  }

  /**
   * Genera un secreto criptográfico de 256 bits y su respectivo hash SHA-256.
   */
  generarToken(): { token: string; tokenHash: string } {
    const bytes = randomBytes(32); // 256 bits de entropía
    const token = bytes.toString('hex'); // 64 caracteres hex
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return { token, tokenHash };
  }

  /**
   * Verifica si la tabla `sigd_tra.token_seguimiento_publico` existe en la base de datos.
   */
  async verificarTablaExiste(cliente: PoolClient | Pool): Promise<boolean> {
    const res = await cliente.query<{ existe: string | null }>(
      "SELECT to_regclass('sigd_tra.token_seguimiento_publico')::text AS existe"
    );
    return Boolean(res.rows[0]?.existe);
  }

  /**
   * Emite un nuevo token de seguimiento para un expediente.
   * Si ya existe un token activo, lo revoca con motivo 'ROTACION_POR_RENOVACION' para
   * garantizar que solo exista un token activo a la vez.
   */
  async emitirToken(
    cliente: PoolClient,
    expedienteId: string,
    ttlDias?: number
  ): Promise<TokenSeguimientoEmitido> {
    const dias = ttlDias ?? this.obtenerTtlDias();
    const { token, tokenHash } = this.generarToken();
    const expiraEn = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

    const tablaExiste = await this.verificarTablaExiste(cliente);
    if (!tablaExiste) {
      // Si la migración aún no ha sido aplicada a la BD, retornar el token generado en memoria
      return { token, tokenHash, expiraEn };
    }

    // 1. Revocar tokens activos previos del mismo expediente (Rotación atómica)
    await cliente.query(
      `UPDATE sigd_tra.token_seguimiento_publico
          SET revocado = true,
              revocado_en = now(),
              motivo_revocacion = 'ROTACION_POR_RENOVACION'
        WHERE expediente_id = $1::uuid
          AND revocado = false`,
      [expedienteId]
    );

    // 2. Insertar el nuevo token con su hash SHA-256
    const res = await cliente.query<{ id_token: string; expira_en: Date }>(
      `INSERT INTO sigd_tra.token_seguimiento_publico (
          expediente_id,
          token_hash,
          expira_en
       ) VALUES ($1::uuid, $2, $3)
       RETURNING id_token, expira_en`,
      [expedienteId, tokenHash, expiraEn]
    );

    return {
      token,
      tokenHash,
      expiraEn: res.rows[0].expira_en,
      idToken: res.rows[0].id_token,
    };
  }

  /**
   * Valida un token de seguimiento para un CUT dado con verificación en tiempo constante.
   */
  async validarToken(
    cliente: PoolClient | Pool,
    cut: string,
    tokenCandidato: string
  ): Promise<ResultadoValidacionToken> {
    const cutLimpio = cut.trim().toUpperCase();
    if (!/^EXP-[0-9]{4}-[0-9]{6}$/.test(cutLimpio)) {
      return { valido: false, motivo: 'FORMATO_INVALIDO' };
    }

    const tokenLimpio = tokenCandidato.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(tokenLimpio)) {
      return { valido: false, motivo: 'FORMATO_INVALIDO' };
    }

    const tablaExiste = await this.verificarTablaExiste(cliente);
    if (!tablaExiste) {
      return { valido: false, motivo: 'TABLA_NO_DISPONIBLE' };
    }

    const hashCandidato = createHash('sha256').update(tokenLimpio).digest('hex');

    // Consultar tokens asociados al expediente correspondiente al CUT
    const query = `
      SELECT t.id_token,
             t.expediente_id,
             t.token_hash,
             t.expira_en,
             t.revocado,
             t.motivo_revocacion
        FROM sigd_tra.token_seguimiento_publico t
        JOIN sigd_tra.expediente e ON e.expediente_id = t.expediente_id
       WHERE e.codigo_expediente = $1
       ORDER BY t.creado_en DESC
       LIMIT 10
    `;

    const res = await cliente.query<{
      id_token: string;
      expediente_id: string;
      token_hash: string;
      expira_en: Date;
      revocado: boolean;
      motivo_revocacion: string | null;
    }>(query, [cutLimpio]);

    if (res.rows.length === 0) {
      return { valido: false, motivo: 'TOKEN_NO_ENCONTRADO' };
    }

    // Buscar si alguno de los registros corresponde al token presentado usando comparación segura
    let registroCoincidente: typeof res.rows[0] | null = null;
    for (const fila of res.rows) {
      const hashAlmacenado = fila.token_hash.trim().toLowerCase();
      if (
        hashAlmacenado.length === 64 &&
        timingSafeEqual(Buffer.from(hashCandidato), Buffer.from(hashAlmacenado))
      ) {
        registroCoincidente = fila;
        break;
      }
    }

    if (!registroCoincidente) {
      return { valido: false, motivo: 'TOKEN_INVALIDO' };
    }

    // Verificar revocación
    if (registroCoincidente.revocado) {
      return { valido: false, motivo: 'TOKEN_REVOCADO' };
    }

    // Verificar expiración
    const ahora = new Date();
    if (ahora > new Date(registroCoincidente.expira_en)) {
      return { valido: false, motivo: 'TOKEN_VENCIDO' };
    }

    // Registrar acceso exitoso asíncronamente sin bloquear la consulta
    try {
      await cliente.query(
        `UPDATE sigd_tra.token_seguimiento_publico
            SET ultimo_acceso_en = now(),
                contador_consultas = contador_consultas + 1
          WHERE id_token = $1::uuid`,
        [registroCoincidente.id_token]
      );
    } catch {
      // Si la actualización de telemetría falla, no se deniega la consulta del ciudadano
    }

    return {
      valido: true,
      expedienteId: registroCoincidente.expediente_id,
      idToken: registroCoincidente.id_token,
    };
  }

  /**
   * Revoca administrativamente el token activo de un expediente.
   */
  async revocarToken(
    cliente: PoolClient,
    expedienteId: string,
    motivo: string
  ): Promise<boolean> {
    const tablaExiste = await this.verificarTablaExiste(cliente);
    if (!tablaExiste) return false;

    const res = await cliente.query(
      `UPDATE sigd_tra.token_seguimiento_publico
          SET revocado = true,
              revocado_en = now(),
              motivo_revocacion = $2
        WHERE expediente_id = $1::uuid
          AND revocado = false`,
      [expedienteId, motivo]
    );

    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Rota el token de seguimiento de un expediente, invalidando el actual y generando uno nuevo.
   */
  async rotarToken(
    cliente: PoolClient,
    expedienteId: string,
    motivo = 'ROTACION_SOLICITADA',
    ttlDias?: number
  ): Promise<TokenSeguimientoEmitido> {
    await this.revocarToken(cliente, expedienteId, motivo);
    return this.emitirToken(cliente, expedienteId, ttlDias);
  }
}
