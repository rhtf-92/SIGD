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
      await this.insertarConsentimiento(cliente, personaId, datos);

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
      `SELECT id_tipo_documento::text AS id FROM sigd_auth.tipos_documento
        WHERE codigo = $1 AND vigente = TRUE`,
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
    _tipoDocumentoId: string,
    datos: DatosRegistro,
  ): Promise<void> {
    const resultado = await cliente.query<ExisteResult>(
      `SELECT EXISTS (
           SELECT 1 FROM sigd_auth.persona
            WHERE tipo = $1 AND id_documento = $2
       ) OR EXISTS (
           SELECT 1 FROM sigd_auth.cuenta_usuario
            WHERE lower(correo) = lower($3) OR usuario = $4
       ) AS existe`,
      [datos.tipoPersona, datos.numeroDocumento, datos.correo, datos.numeroDocumento],
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
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO sigd_auth.consentimiento_datos
         (id_persona, finalidade, version_politica, aceptado, fecha_aceptacion, ip_origen)
       VALUES ($1, 'Trámites y Notificaciones SIGD', 'v1.0', $2, CASE WHEN $2 THEN now() ELSE null END, $3)`,
      [personaId, datos.aceptaNotificaciones, datos.ipAddress],
    );
  }
}

function esViolacionUnicidad(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505';
}