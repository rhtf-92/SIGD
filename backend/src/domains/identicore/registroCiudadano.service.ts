import argon2 from 'argon2';
import type { Pool } from 'pg';
import { AppError, ConflictError, ValidationError } from '../../shared/domain/errors/index.js';
import type {
  RegistroCiudadanoInput,
  RegistroPersonaJuridicaInput,
} from './registro.schemas.js';
import { validarDni, validarRuc } from './modulo11.validator.js';
import { UbigeoService } from './ubigeo.service.js';

interface IdResult {
  id: string;
}

interface TipoDocumentoResult {
  id: string;
}

interface RepresentanteResult extends IdResult {
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
}

interface ExisteResult {
  existe: boolean;
}

export interface RegistroResult {
  idPersona: string;
  mensaje: 'Registro exitoso';
}

const PARAMETROS_ARGON2ID = {
  type: 2 as const,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
};

export class RegistroCiudadanoService {
  constructor(
    private readonly pool: Pool,
    private readonly ubigeoService: UbigeoService,
  ) {}

  async registrarCiudadano(datos: RegistroCiudadanoInput, ipAddress: string | null): Promise<RegistroResult> {
    const validacion = validarDni(datos.dni);
    if (!validacion.valido) {
      throw new ValidationError({
        invalidParams: [{ name: 'dni', reason: 'DNI_FORMATO_INVALIDO: debe contener 8 dígitos.' }],
      });
    }
    return this.registrarPersona({
      tipoDocumento: 'DNI',
      numeroDocumento: datos.dni,
      correo: datos.correo,
      celular: datos.celular,
      direccion: datos.direccion,
      ubigeoDistrito: datos.ubigeoDistrito,
      password: datos.password,
      nombres: datos.nombres,
      apellidoPaterno: datos.apellidoPaterno,
      apellidoMaterno: datos.apellidoMaterno,
      aceptaNotificaciones: datos.aceptaNotificaciones,
      ipAddress,
      tipoPersona: 'NATURAL',
      partidaRegistral: null,
    });
  }

  async registrarPersonaJuridica(
    datos: RegistroPersonaJuridicaInput,
    ipAddress: string | null,
  ): Promise<RegistroResult> {
    const validacion = validarRuc(datos.ruc);
    if (!validacion.valido) {
      throw new AppError({
        status: 400,
        code: validacion.codigo,
        message: 'El RUC no supera la validación Módulo 11 de SUNAT.',
        invalidParams: [{ name: 'ruc', reason: validacion.codigo }],
      });
    }
    return this.registrarPersona({
      tipoDocumento: 'RUC',
      numeroDocumento: datos.ruc,
      correo: datos.correo,
      celular: datos.celular,
      direccion: datos.direccion,
      ubigeoDistrito: datos.ubigeoDistrito,
      password: datos.password,
      nombres: datos.razonSocial,
      apellidoPaterno: null,
      apellidoMaterno: null,
      tipoPersona: 'JURIDICA',
      razonSocial: datos.razonSocial,
      nombreComercial: datos.razonSocial,
      documentoRepresentante: datos.dniRepresentante,
      nombreRepresentante: datos.nombreRepresentante,
      aceptaNotificaciones: datos.aceptaNotificaciones,
      ipAddress,
      partidaRegistral: datos.partidaRegistral ? BigInt(datos.partidaRegistral).toString() : null,
    });
  }

  private async registrarPersona(datos: {
    tipoDocumento: 'DNI' | 'RUC';
    numeroDocumento: string;
    correo: string;
    celular: string;
    direccion: string;
    ubigeoDistrito: string;
    password: string;
    nombres: string;
    apellidoPaterno: string | null;
    apellidoMaterno: string | null;
    aceptaNotificaciones: boolean;
    ipAddress: string | null;
    tipoPersona: 'NATURAL' | 'JURIDICA';
    razonSocial?: string;
    nombreComercial?: string;
    documentoRepresentante?: string;
    nombreRepresentante?: string;
    partidaRegistral: string | null;
  }): Promise<RegistroResult> {
    if (!(await this.ubigeoService.contieneDistrito(datos.ubigeoDistrito))) {
      throw new ValidationError({
        invalidParams: [{ name: 'ubigeoDistrito', reason: 'El distrito no pertenece al catálogo de Ucayali.' }],
      });
    }

    const passwordHash = await argon2.hash(datos.password, PARAMETROS_ARGON2ID);
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      const tipoDocumento = await cliente.query<TipoDocumentoResult>(
        `SELECT id::text AS id
           FROM sigd_auth.tipos_documento
          WHERE codigo = $1 AND estado = TRUE`,
        [datos.tipoDocumento],
      );
      const tipoDocumentoId = tipoDocumento.rows[0]?.id;
      if (!tipoDocumentoId) {
        throw new AppError({
          status: 500,
          code: 'DOCUMENT_TYPE_NOT_CONFIGURED',
          message: `No está configurado el tipo de documento ${datos.tipoDocumento}.`,
        });
      }

      const duplicado = await cliente.query<ExisteResult>(
        `SELECT
           EXISTS (
             SELECT 1 FROM sigd_auth.persona p
              WHERE p.tipo_documento_id = $1 AND p.numero_documento = $2
           ) OR EXISTS (
             SELECT 1 FROM sigd_auth.cuenta_usuario u
              WHERE lower(u.email_login) = lower($3) OR u.username = $4
           ) AS existe`,
        [tipoDocumentoId, datos.numeroDocumento, datos.correo, datos.numeroDocumento],
      );
      if (duplicado.rows[0]?.existe) {
        throw new ConflictError({
          code: 'CITIZEN_ALREADY_EXISTS',
          message: 'Ya existe una persona o cuenta con ese documento o correo.',
        });
      }

      const persona = await cliente.query<IdResult>(
        `INSERT INTO sigd_auth.persona
           (tipo_documento_id, numero_documento, nombres, apellido_paterno,
            apellido_materno, telefono, email_contacto, tipo_persona,
            direccion, ubigeo_distrito)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id::text AS id`,
        [
          tipoDocumentoId,
          datos.numeroDocumento,
          datos.nombres,
          datos.apellidoPaterno,
          datos.apellidoMaterno,
          datos.celular,
          datos.correo,
          datos.tipoPersona,
          datos.direccion,
          datos.ubigeoDistrito,
        ],
      );
      const personaId = persona.rows[0]?.id;
      if (!personaId) throw new Error('La inserción de persona no devolvió su identificador.');

      if (datos.tipoPersona === 'NATURAL') {
        await cliente.query(
          `INSERT INTO sigd_auth.persona_natural
             (persona_id, numero_documento, nombres, apellido_paterno,
              apellido_materno, telefono, email_contacto)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            personaId,
            datos.numeroDocumento,
            datos.nombres,
            datos.apellidoPaterno,
            datos.apellidoMaterno,
            datos.celular,
            datos.correo,
          ],
        );
      } else {
        const documentoRepresentante = datos.documentoRepresentante;
        const nombreRepresentante = datos.nombreRepresentante;
        if (!documentoRepresentante || !nombreRepresentante) {
          throw new Error('Faltan los datos de identificación del representante legal.');
        }
        const representante = await cliente.query<RepresentanteResult>(
          `SELECT pn.id::text AS id, p.nombres, p.apellido_paterno, p.apellido_materno
             FROM sigd_auth.persona_natural pn
             JOIN sigd_auth.persona p ON p.id = pn.persona_id
             JOIN sigd_auth.tipos_documento td ON td.id = p.tipo_documento_id
            WHERE pn.numero_documento = $1
              AND td.codigo = 'DNI'
              AND p.tipo_persona = 'NATURAL'
              AND p.estado = TRUE
              AND pn.estado = TRUE
            FOR SHARE OF pn, p`,
          [documentoRepresentante],
        );
        const personaRepresentante = representante.rows[0];
        if (!personaRepresentante) {
          throw new ConflictError({
            code: 'REPRESENTANTE_NO_REGISTRADO',
            message: 'El representante legal debe estar previamente registrado como persona natural.',
          });
        }
        const nombreRegistrado = normalizarNombre([
          personaRepresentante.nombres,
          personaRepresentante.apellido_paterno,
          personaRepresentante.apellido_materno,
        ].filter(Boolean).join(' '));
        if (nombreRegistrado !== normalizarNombre(nombreRepresentante)) {
          throw new ValidationError({
            invalidParams: [{ name: 'nombreRepresentante', reason: 'El nombre no coincide con el DNI del representante.' }],
          });
        }

        const juridica = await cliente.query<IdResult>(
          `INSERT INTO sigd_auth.persona_juridica
             (persona_id, razon_social, nombre_comercial, partida_registral_sunarp)
           VALUES ($1, $2, $3, $4)
           RETURNING id::text AS id`,
          [personaId, datos.razonSocial, datos.nombreComercial, datos.partidaRegistral],
        );
        const personaJuridicaId = juridica.rows[0]?.id;
        if (!personaJuridicaId) throw new Error('La inserción de persona jurídica no devolvió su identificador.');

        await cliente.query(
          `INSERT INTO sigd_auth.representacion_legal
             (persona_natural_id, persona_juridica_id, vigencia_inicio, activo)
           VALUES ($1, $2, CURRENT_DATE, TRUE)`,
          [personaRepresentante.id, personaJuridicaId],
        );
      }

      const cuenta = await cliente.query<IdResult>(
        `INSERT INTO sigd_auth.cuenta_usuario
           (persona_id, username, email_login, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id::text AS id`,
        [personaId, datos.numeroDocumento, datos.correo, passwordHash],
      );
      const usuarioId = cuenta.rows[0]?.id;
      if (!usuarioId) throw new Error('La inserción de cuenta no devolvió su identificador.');

      await cliente.query(
        `INSERT INTO sigd_auth.consentimiento_datos
           (usuario_id, ip_address, version_termsoservicio,
            aceptacion_notificaciones, consentimiento_obfuscacion)
         VALUES ($1, $2, 'v1.0', $3, TRUE)`,
        [usuarioId, datos.ipAddress, datos.aceptaNotificaciones],
      );

      await cliente.query('COMMIT');
      transaccionAbierta = false;
      return { idPersona: personaId, mensaje: 'Registro exitoso' };
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
}

function esViolacionUnicidad(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}