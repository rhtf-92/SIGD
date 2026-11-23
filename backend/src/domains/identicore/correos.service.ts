import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { AppError } from '../../shared/domain/errors/index.js';
import { EntregaOtp } from './identidadOtp.service.js';
import { crearEntregaOtpSmtp } from './otpSmtp.js';
import { AlmacenOtp, RedisAlmacenOtp } from './identidadOtp.service.js';

export class CorreosService {
  constructor(
    private readonly pool: Pool,
    private readonly store: AlmacenOtp = new RedisAlmacenOtp(),
    private readonly entrega: EntregaOtp = crearEntregaOtpSmtp() ?? { enviar: async () => { console.warn('OTP entrega no configurada'); } }
  ) {}

  private async checkRateLimit(idUsuario: string, action: string) {
    if (!await this.store.cuota(`correos:${action}:${idUsuario}`, 5, 3600)) {
        throw new AppError({ code: 'RATE_LIMIT', status: 429, message: 'Límite de solicitudes alcanzado.' });
    }
  }

  async agregarCorreo(idUsuario: string, correo: string): Promise<{ idCorreoAdicional: string }> {
    await this.checkRateLimit(idUsuario, 'add');
    const { rows } = await this.pool.query(
      `INSERT INTO sigd_auth.correos_adicionales (id_usuario, correo)
       VALUES ($1, $2)
       RETURNING id_correo_adicional;`,
      [idUsuario, correo.trim().toLowerCase()]
    );
    return { idCorreoAdicional: rows[0].id_correo_adicional };
  }

  async establecerPreferido(idUsuario: string, idCorreoAdicional: string): Promise<void> {
    const client = await this.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE sigd_auth.correos_adicionales SET preferido = FALSE WHERE id_usuario = $1`, [idUsuario]);
        await client.query(`UPDATE sigd_auth.correos_adicionales SET preferido = TRUE WHERE id_usuario = $1 AND id_correo_adicional = $2`, [idUsuario, idCorreoAdicional]);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
  }

  async iniciarVerificacion(idUsuario: string, idCorreoAdicional: string): Promise<void> {
    await this.checkRateLimit(idUsuario, 'verify');
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiracion = new Date(Date.now() + 3600000); // 1 hora

    const { rows } = await this.pool.query(
      `UPDATE sigd_auth.correos_adicionales
          SET token_hash = $1, token_expiracion = $2
        WHERE id_correo_adicional = $3 AND id_usuario = $4
        RETURNING correo;`,
      [tokenHash, expiracion, idCorreoAdicional, idUsuario]
    );

    if (rows.length === 0) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Correo no encontrado.' });

    await this.entrega.enviar(rows[0].correo, `Código de verificación: ${token}`);
  }

  async confirmarVerificacion(idUsuario: string, idCorreoAdicional: string, token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rowCount } = await this.pool.query(
      `UPDATE sigd_auth.correos_adicionales
          SET verificado = TRUE, fecha_verificacion = now(), token_hash = NULL, token_expiracion = NULL
        WHERE id_correo_adicional = $1 AND id_usuario = $2 AND token_hash = $3 AND token_expiracion > now();`,
      [idCorreoAdicional, idUsuario, tokenHash]
    );
    if (rowCount === 0) throw new AppError({ code: 'INVALID_TOKEN', status: 400, message: 'Token inválido o expirado.' });
  }

  async listarCorreos(idUsuario: string) {
    const { rows } = await this.pool.query(
      `SELECT id_correo_adicional, correo, verificado, fecha_verificacion, preferido
         FROM sigd_auth.correos_adicionales WHERE id_usuario = $1;`,
      [idUsuario]
    );
    return rows;
  }

  async eliminarCorreo(idUsuario: string, idCorreoAdicional: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM sigd_auth.correos_adicionales WHERE id_correo_adicional = $1 AND id_usuario = $2;`,
      [idCorreoAdicional, idUsuario]
    );
  }
}
