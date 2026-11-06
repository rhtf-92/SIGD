import type { Pool, PoolClient } from 'pg';
import { AppError, ConflictError } from '../../shared/domain/errors/index.js';
import { insertarExtensionPersona, insertarPersona } from './registro.persona.repository.js';
import type { DatosRegistro, RegistroResult } from './registro.types.js';

interface IdResult {
  id: string;
}

interface ExisteResult {
  existe: boolean;
}

export class RegistroRepository {
  constructor(private readonly pool: Pool) {}

  async registrar(datos: DatosRegistro, passwordHash: string): Promise<RegistroResult> {
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;
    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;
      await this.verificarDuplicados(cliente, datos);

      const personaId = await insertarPersona(cliente, datos);
      await insertarExtensionPersona(cliente, personaId, datos);
      const usuarioId = await this.insertarCuenta(cliente, personaId, datos, passwordHash);
      await this.insertarConsentimiento(cliente, personaId, datos, datos.ipAddress);

      await cliente.query('COMMIT');
      transaccionAbierta = false;
      return { idPersona: personaId, casillaId: usuarioId, mensaje: 'Registro exitoso' };
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      if (esViolacionUnicidad(error)) {
        throw new ConflictError({
          code: 'CITIZEN_ALREADY_EXISTS',
          message: 'Ya existe una persona o cuenta con ese documento o correo.',
        });
      }
      throw error;
    } finally {
      cliente.release();
    }
  }

  private async verificarDuplicados(
    cliente: PoolClient,
    datos: DatosRegistro,
  ): Promise<void> {
    const resultado = await cliente.query<ExisteResult>(
      `SELECT EXISTS (
           SELECT 1 FROM sigd_auth.persona
            WHERE id_documento = $1
       ) OR EXISTS (
           SELECT 1 FROM sigd_auth.cuenta_usuario
            WHERE lower(correo) = lower($2) OR usuario = $3
       ) AS existe`,
      [datos.numeroDocumento, datos.correo, datos.numeroDocumento],
    );
    if (resultado.rows[0]?.existe) {
      throw new ConflictError({
        code: 'CITIZEN_ALREADY_EXISTS',
        message: 'Ya existe una persona o cuenta con ese documento o correo.',
      });
    }
  }

  private async insertarCuenta(
    cliente: PoolClient,
    personaId: string,
    datos: DatosRegistro,
    passwordHash: string,
  ): Promise<string> {
    const resultado = await cliente.query<IdResult>(
      `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id_usuario::text AS id`,
      [personaId, datos.numeroDocumento, datos.correo, passwordHash],
    );
    const id = resultado.rows[0]?.id;
    if (!id) throw new Error('La inserción de cuenta no devolvió su identificador.');
    return id;
  }

  private async insertarConsentimiento(
    cliente: PoolClient,
    personaId: string,
    datos: DatosRegistro,
    ipAddress: string | null,
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO sigd_auth.consentimiento_datos
         (id_persona, finalidade, version_politica, aceptado, fecha_aceptacion, ip_origen)
       VALUES ($1, $2, 'v1.0', $3, now(), $4::inet)`,
      [
        personaId,
        datos.aceptaNotificaciones
          ? 'GESTION_DE_TRAMITES_Y_NOTIFICACIONES'
          : 'GESTION_DE_TRAMITES',
        datos.aceptaNotificaciones,
        ipAddress,
      ],
    );
  }
}

function esViolacionUnicidad(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
