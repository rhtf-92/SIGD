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
      const tipoDocumentoId = await this.buscarTipoDocumento(cliente, datos.tipoDocumento);
      await this.verificarDuplicados(cliente, tipoDocumentoId, datos);

      const personaId = await insertarPersona(cliente, tipoDocumentoId, datos);
      await insertarExtensionPersona(cliente, personaId, datos);
      const usuarioId = await this.insertarCuenta(cliente, personaId, datos, passwordHash);
      await this.insertarConsentimiento(cliente, usuarioId, datos);

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

  private async buscarTipoDocumento(cliente: PoolClient, codigo: 'DNI' | 'RUC'): Promise<string> {
    const resultado = await cliente.query<IdResult>(
      `SELECT id::text AS id FROM sigd_auth.tipos_documento
        WHERE codigo = $1 AND estado = TRUE`,
      [codigo],
    );
    const id = resultado.rows[0]?.id;
    if (!id) {
      throw new AppError({
        status: 500,
        code: 'DOCUMENT_TYPE_NOT_CONFIGURED',
        message: `No está configurado el tipo de documento ${codigo}.`,
      });
    }
    return id;
  }

  private async verificarDuplicados(
    cliente: PoolClient,
    tipoDocumentoId: string,
    datos: DatosRegistro,
  ): Promise<void> {
    const resultado = await cliente.query<ExisteResult>(
      `SELECT EXISTS (
           SELECT 1 FROM sigd_auth.persona
            WHERE tipo_documento_id = $1 AND numero_documento = $2
       ) OR EXISTS (
           SELECT 1 FROM sigd_auth.cuenta_usuario
            WHERE lower(email_login) = lower($3) OR username = $4
       ) AS existe`,
      [tipoDocumentoId, datos.numeroDocumento, datos.correo, datos.numeroDocumento],
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
      `INSERT INTO sigd_auth.cuenta_usuario (persona_id, username, email_login, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id::text AS id`,
      [personaId, datos.numeroDocumento, datos.correo, passwordHash],
    );
    const id = resultado.rows[0]?.id;
    if (!id) throw new Error('La inserción de cuenta no devolvió su identificador.');
    return id;
  }

  private async insertarConsentimiento(
    cliente: PoolClient,
    usuarioId: string,
    datos: DatosRegistro,
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO sigd_auth.consentimiento_datos
         (usuario_id, ip_address, version_termsoservicio,
          aceptacion_notificaciones, consentimiento_obfuscacion)
       VALUES ($1, $2, 'v1.0', $3, TRUE)`,
      [usuarioId, datos.ipAddress, datos.aceptaNotificaciones],
    );
  }
}

function esViolacionUnicidad(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}