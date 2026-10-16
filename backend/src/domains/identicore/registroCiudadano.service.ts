import { Argon2Service } from './argon2.service.js';
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
  /** Cuenta creada: es la casilla electrónica del ciudadano. */
  casillaId: string;
  correo: string;
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

    const passwordHash = await Argon2Service.hash(datos.password, PARAMETROS_ARGON2ID);
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      const tipoDocumento = await cliente.query<TipoDocumentoResult>(
        `SELECT id_tipo_documento::text AS id
           FROM sigd_auth.tipos_documento
          WHERE codigo = $1 AND vigente = TRUE`,
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
              WHERE p.id_documento = $1
           ) OR EXISTS (
             SELECT 1 FROM sigd_auth.cuenta_usuario u
              WHERE lower(u.correo) = lower($2) OR u.usuario = $3
           ) AS existe`,
        [datos.numeroDocumento, datos.correo, datos.numeroDocumento],
      );
      if (duplicado.rows[0]?.existe) {
        throw new ConflictError({
          code: 'CITIZEN_ALREADY_EXISTS',
          message: 'Ya existe una persona o cuenta con ese documento o correo.',
        });
      }

      // `sigd_auth.persona` es la tabla nucleo: guarda la identidad (id_persona,
      // tipo de persona e id_documento). Los datos nominallyos viven en
      // `persona_natural` o `persona_juridica`, que comparten la misma clave.
      const persona = await cliente.query<IdResult>(
        `INSERT INTO sigd_auth.persona (tipo, id_documento)
         VALUES ($1, $2)
         RETURNING id_persona::text AS id`,
        [datos.tipoPersona, datos.numeroDocumento],
      );
      const personaId = persona.rows[0]?.id;
      if (!personaId) throw new Error('La inserción de persona no devolvió su identificador.');

      if (datos.tipoPersona === 'NATURAL') {
        const apellidos = [datos.apellidoPaterno, datos.apellidoMaterno]
          .filter((apellido): apellido is string => Boolean(apellido))
          .join(' ');
        await cliente.query(
          `INSERT INTO sigd_auth.persona_natural
             (id_persona, nombres, apellidos, nombre_completo, telefono, correo)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            personaId,
            datos.nombres,
            apellidos,
            `${datos.nombres} ${apellidos}`.trim(),
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
          `SELECT pn.id_persona::text AS id, pn.nombres,
                  split_part(pn.apellidos, ' ', 1) AS apellido_paterno,
                  NULLIF(substring(pn.apellidos FROM POSITION(' ' IN pn.apellidos) + 1), '') AS apellido_materno
             FROM sigd_auth.persona_natural pn
             JOIN sigd_auth.persona p ON p.id_persona = pn.id_persona
            WHERE p.id_documento = $1
              AND p.tipo = 'NATURAL'
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
             (id_persona, razon_social, nombre_comercial, direccion)
           VALUES ($1, $2, $3, $4)
           RETURNING id_persona::text AS id`,
          [personaId, datos.razonSocial, datos.nombreComercial, datos.direccion],
        );
        const personaJuridicaId = juridica.rows[0]?.id;
        if (!personaJuridicaId) throw new Error('La insercion de persona juridica no devolvio su identificador.');

        await cliente.query(
          `INSERT INTO sigd_auth.representacion_legal
             (id_persona_juridica, id_persona_natural, cargo, vigente_desde)
           VALUES ($1, $2, 'REPRESENTANTE LEGAL', CURRENT_DATE)`,
          [personaJuridicaId, personaRepresentante.id],
        );
      }

      const cuenta = await cliente.query<IdResult>(
        `INSERT INTO sigd_auth.cuenta_usuario
           (id_persona, usuario, correo, password_hash, activo)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id_usuario::text AS id`,
        [personaId, datos.numeroDocumento, datos.correo, passwordHash],
      );
      const usuarioId = cuenta.rows[0]?.id;
      if (!usuarioId) throw new Error('La insercion de cuenta no devolvio su identificador.');

      // Consentimiento de tratamiento de datos personales (Ley 29733, Art. 5):
      // es requisito de licitud, por eso se registra junto con la cuenta.
      await cliente.query(
        `INSERT INTO sigd_auth.consentimiento_datos
           (id_persona, finalidade, version_politica, aceptado, fecha_aceptacion, ip_origen)
         VALUES ($1, $2, 'v1.0', TRUE, now(), $3::inet)`,
        [
          personaId,
          datos.aceptaNotificaciones
            ? 'GESTION_DE_TRAMITES_Y_NOTIFICACIONES'
            : 'GESTION_DE_TRAMITES',
          datos.ipAddress,
        ],
      );

      await cliente.query('COMMIT');
      transaccionAbierta = false;
      return { idPersona: personaId, casillaId: usuarioId, correo: datos.correo, mensaje: 'Registro exitoso' };
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
