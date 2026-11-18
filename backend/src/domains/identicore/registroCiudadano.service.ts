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
  apellidos: string;
}

interface ExisteResult {
  existe: boolean;
  usuario_existente?: boolean;
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
    const numeroDocumento = datos.tipoDocumento === 'CE' ? datos.ce : datos.dni;
    const validacion = datos.tipoDocumento === 'CE'
      ? { valido: /^[A-Za-z0-9]{8,12}$/.test(numeroDocumento ?? '') }
      : validarDni(numeroDocumento ?? '');
    if (!validacion.valido || !numeroDocumento) {
      throw new ValidationError({
        invalidParams: [{
          name: datos.tipoDocumento === 'CE' ? 'ce' : 'dni',
          reason: datos.tipoDocumento === 'CE'
            ? 'CE_FORMATO_INVALIDO: debe contener entre 8 y 12 caracteres alfanuméricos.'
            : 'DNI_FORMATO_INVALIDO: debe contener 8 dígitos.',
        }],
      });
    }
    return this.registrarPersona({
      tipoDocumento: datos.tipoDocumento,
      numeroDocumento,
      correo: datos.correo,
      username: datos.username,
      celular: datos.celular,
      direccion: datos.direccion,
      ubigeoDistrito: datos.ubigeoDistrito,
      password: datos.password,
      nombres: datos.nombres,
      apellidoPaterno: datos.apellidoPaterno,
      apellidoMaterno: datos.apellidoMaterno,
      aceptaNotificaciones: datos.aceptaNotificaciones,
      consentimientoDatos: datos.consentimientoDatos,
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
      username: datos.username,
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
      consentimientoDatos: datos.consentimientoDatos,
      ipAddress,
      partidaRegistral: datos.partidaRegistral ? BigInt(datos.partidaRegistral).toString() : null,
    });
  }

  private async registrarPersona(datos: {
    tipoDocumento: 'DNI' | 'CE' | 'RUC';
    numeroDocumento: string;
    correo: string;
    username: string;
    celular: string;
    direccion: string;
    ubigeoDistrito: string;
    password: string;
    nombres: string;
    apellidoPaterno: string | null;
    apellidoMaterno: string | null;
    aceptaNotificaciones: boolean;
    consentimientoDatos: boolean;
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
      if (!tipoDocumento.rows[0]?.id) {
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
              WHERE p.tipo = $1 AND p.id_documento = $2
                AND EXISTS (SELECT 1 FROM sigd_auth.cuenta_usuario cu WHERE cu.id_persona = p.id_persona)
           ) OR EXISTS (
             SELECT 1 FROM sigd_auth.cuenta_usuario u
              WHERE lower(u.correo) = lower($3) OR lower(u.usuario) = lower($4)
           ) AS existe,
           EXISTS (SELECT 1 FROM sigd_auth.cuenta_usuario u
                    WHERE lower(u.usuario) = lower($4)) AS usuario_existente`,
        [datos.tipoPersona, datos.numeroDocumento, datos.correo, datos.username],
      );
      if (duplicado.rows[0]?.existe) {
        if (duplicado.rows[0]?.usuario_existente) {
          throw new ConflictError({ code: 'USERNAME_ALREADY_EXISTS', message: 'Este nombre de usuario ya está en uso.' });
        }
        throw new ConflictError({
          code: 'CITIZEN_ALREADY_EXISTS',
          message: 'Ya existe una persona o cuenta con ese documento o correo.',
        });
      }

      // Verificar si la persona ya existe en el padrón (ej. de radicación presencial o digital sin cuenta)
      const personaExistente = await cliente.query<{ id_persona: string }>(
        `SELECT id_persona::text AS id_persona FROM sigd_auth.persona WHERE tipo = $1 AND id_documento = $2 LIMIT 1`,
        [datos.tipoPersona, datos.numeroDocumento],
      );

      let personaId: string;

      if (personaExistente.rows[0]?.id_persona) {
        // Reutilizar persona existente
        personaId = personaExistente.rows[0].id_persona;

        // Principio de Inmutabilidad Civil: NO alterar ni completar datos del padrón civil
        // (persona, persona_natural, persona_juridica) desde un registro público no verificado.
        // Los datos declarados por el solicitante se conservan en su cuenta de usuario (cuenta_usuario / perfil_usuario).
        if (datos.tipoPersona === 'NATURAL') {
          const apellidos = [datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ');
          const nombreCompleto = [datos.nombres, apellidos].filter(Boolean).join(' ');

          const existeNatural = await cliente.query<{
            id_persona: string;
            nombres: string;
            apellidos: string;
            nombre_completo: string;
          }>(
            `SELECT id_persona::text, nombres, apellidos, nombre_completo
               FROM sigd_auth.persona_natural
              WHERE id_persona = $1::uuid
              LIMIT 1`,
            [personaId],
          );
          if (existeNatural.rows[0]) {
            const natural = existeNatural.rows[0];
            const nombreRegistrado = normalizarNombre(
              natural.nombre_completo || [natural.nombres, natural.apellidos].filter(Boolean).join(' '),
            );
            const nombreDeclarado = normalizarNombre(nombreCompleto);

            // Salvaguarda contra suplantación de identidad (Anti-Impersonation):
            // Si la persona ya cuenta con identidad civil registrada en el padrón,
            // los nombres declarados deben coincidir sustancialmente con el registro previo.
            if (nombreRegistrado && nombreDeclarado && nombreRegistrado !== nombreDeclarado) {
              throw new ConflictError({
                code: 'IDENTITY_MISMATCH',
                message: 'Los nombres y apellidos declarados no coinciden con los registros institucionales de este documento de identidad.',
              });
            }
          } else {
            await cliente.query(
              `INSERT INTO sigd_auth.persona_natural
                 (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
               VALUES ($1::uuid, $2, $3, $4, NULL, NULL)`,
              [personaId, datos.nombres, apellidos, nombreCompleto],
            );
          }
        } else {
          const documentoRepresentante = datos.documentoRepresentante;
          const nombreRepresentante = datos.nombreRepresentante;
          if (!documentoRepresentante || !nombreRepresentante) {
            throw new Error('Faltan los datos de identificación del representante legal.');
          }
          const representante = await cliente.query<RepresentanteResult>(
            `SELECT pn.id_persona::text AS id, pn.nombres, pn.apellidos
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
            personaRepresentante.apellidos,
          ].filter(Boolean).join(' '));
          if (nombreRegistrado !== normalizarNombre(nombreRepresentante)) {
            throw new ValidationError({
              invalidParams: [{ name: 'nombreRepresentante', reason: 'El nombre no coincide con el DNI del representante.' }],
            });
          }

          const existeJuridica = await cliente.query<{ id_persona: string; razon_social: string }>(
            `SELECT id_persona::text, razon_social FROM sigd_auth.persona_juridica WHERE id_persona = $1::uuid LIMIT 1`,
            [personaId],
          );
          if (existeJuridica.rows[0]) {
            const jur = existeJuridica.rows[0];
            const razonRegistrada = normalizarNombre(jur.razon_social);
            const razonDeclarada = normalizarNombre(datos.razonSocial || '');
            if (razonRegistrada && razonDeclarada && razonRegistrada !== razonDeclarada) {
              throw new ConflictError({
                code: 'IDENTITY_MISMATCH',
                message: 'La razón social declarada no coincide con los registros institucionales de este RUC.',
              });
            }
          } else {
            await cliente.query(
              `INSERT INTO sigd_auth.persona_juridica
                 (id_persona, razon_social, nombre_comercial, representante_legal, direccion, partida_registral_sunarp)
               VALUES ($1::uuid, $2, $3, $4, NULL, NULL)`,
              [personaId, datos.razonSocial, datos.nombreComercial, nombreRepresentante],
            );
          }

          await cliente.query(
            `INSERT INTO sigd_auth.representacion_legal
               (id_persona_juridica, id_persona_natural, cargo, vigente_desde)
             VALUES ($1, $2, 'REPRESENTANTE LEGAL', CURRENT_DATE)
             ON CONFLICT DO NOTHING`,
            [personaId, personaRepresentante.id],
          );
        }
      } else {
        const persona = await cliente.query<IdResult>(
          `INSERT INTO sigd_auth.persona
             (tipo, id_documento, direccion, ubigeo_distrito)
           VALUES ($1, $2, $3, $4)
           RETURNING id_persona::text AS id`,
          [datos.tipoPersona, datos.numeroDocumento, datos.direccion, datos.ubigeoDistrito],
        );
        const nuevoId = persona.rows[0]?.id;
        if (!nuevoId) throw new Error('La inserción de persona no devolvió su identificador.');
        personaId = nuevoId;

        if (datos.tipoPersona === 'NATURAL') {
          const apellidos = [datos.apellidoPaterno, datos.apellidoMaterno]
            .filter(Boolean)
            .join(' ');
          const nombreCompleto = [datos.nombres, apellidos].filter(Boolean).join(' ');
          await cliente.query(
            `INSERT INTO sigd_auth.persona_natural
               (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              personaId,
              datos.nombres,
              apellidos,
              nombreCompleto,
              datos.correo,
              datos.celular,
            ],
          );
        } else {
          const documentoRepresentante = datos.documentoRepresentante;
          const nombreRepresentante = datos.nombreRepresentante;
          if (!documentoRepresentante || !nombreRepresentante) {
            throw new Error('Faltan los datos de identificación del representante legal.');
          }
          const representante = await cliente.query<RepresentanteResult>(
            `SELECT pn.id_persona::text AS id, pn.nombres, pn.apellidos
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
            personaRepresentante.apellidos,
          ].filter(Boolean).join(' '));
          if (nombreRegistrado !== normalizarNombre(nombreRepresentante)) {
            throw new ValidationError({
              invalidParams: [{ name: 'nombreRepresentante', reason: 'El nombre no coincide con el DNI del representante.' }],
            });
          }

          const juridica = await cliente.query<IdResult>(
            `INSERT INTO sigd_auth.persona_juridica
               (id_persona, razon_social, nombre_comercial, representante_legal, direccion, partida_registral_sunarp)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id_persona::text AS id`,
            [personaId, datos.razonSocial, datos.nombreComercial, nombreRepresentante, datos.direccion, datos.partidaRegistral],
          );
          const personaJuridicaId = juridica.rows[0]?.id;
          if (!personaJuridicaId) throw new Error('La inserción de persona jurídica no devolvió su identificador.');

          await cliente.query(
            `INSERT INTO sigd_auth.representacion_legal
               (id_persona_juridica, id_persona_natural, cargo, vigente_desde)
             VALUES ($1, $2, 'REPRESENTANTE LEGAL', CURRENT_DATE)`,
            [personaJuridicaId, personaRepresentante.id],
          );
        }
      }

      const cuenta = await cliente.query<IdResult>(
        `INSERT INTO sigd_auth.cuenta_usuario
           (id_persona, usuario, correo, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id_usuario::text AS id`,
        [personaId, datos.username, datos.correo, passwordHash],
      );
      const usuarioId = cuenta.rows[0]?.id;
      if (!usuarioId) throw new Error('La inserción de cuenta no devolvió su identificador.');

      if (datos.celular) {
        await cliente.query(
          `INSERT INTO sigd_auth.perfil_usuario (id_usuario, telefono)
           VALUES ($1::uuid, $2)
           ON CONFLICT (id_usuario) DO UPDATE SET telefono = EXCLUDED.telefono, actualizado_en = now()`,
          [usuarioId, datos.celular],
        );
      }

      const rolCiudadano = await cliente.query<IdResult>(
        `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
         SELECT $1::uuid, rol_id FROM sigd_org.rol_sistema
          WHERE codigo = 'CIUDADANO' AND vigente = TRUE
         RETURNING id_usuario::text AS id`,
        [usuarioId],
      );
      if (!rolCiudadano.rows[0]?.id) {
        throw new AppError({ status: 500, code: 'CITIZEN_ROLE_NOT_CONFIGURED',
          message: 'No está configurado el rol canónico CIUDADANO.' });
      }

      await cliente.query(
        `INSERT INTO sigd_auth.consentimiento_datos
           (id_persona, ip_origen, version_politica,
            finalidade, aceptado, fecha_aceptacion)
         VALUES ($1, $2, 'v1.0', 'registro_ciudadano', $3,
                 CASE WHEN $3 THEN now() ELSE NULL END)`,
        [personaId, datos.ipAddress, datos.consentimientoDatos],
      );

      await cliente.query('COMMIT');
      transaccionAbierta = false;
      return { idPersona: personaId, mensaje: 'Registro exitoso' };
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      if (esViolacionUnicidad(error)) {
        if (error.constraint === 'cuenta_usuario_usuario_key') {
          throw new ConflictError({ code: 'USERNAME_ALREADY_EXISTS', message: 'Este nombre de usuario ya está en uso.' });
        }
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

function esViolacionUnicidad(error: unknown): error is { code: string; constraint?: string } {
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
