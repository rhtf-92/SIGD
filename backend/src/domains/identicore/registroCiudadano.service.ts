import type { Pool, PoolClient } from 'pg';
import { Argon2Service } from './argon2.service.js';
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

interface ExisteResult {
  existe: boolean;
}

interface RepresentanteResult extends IdResult {
  nombre_completo: string;
}

interface DatosPersonaRegistro {
  tipoPersona: 'NATURAL' | 'JURIDICA';
  tipoDocumento: 'DNI' | 'CE' | 'RUC';
  numeroDocumento: string;
  nombres: string;
  apellidos: string | null;
  correo: string;
  celular: string;
  direccion: string;
  referenciaDomicilio?: string;
  ubigeoDistrito: string;
  password: string;
  ipAddress: string | null;
  consentimientoDatos: true;
  aceptaNotificaciones: boolean;
  declaracionJurada: true;
  fechaNacimiento?: string;
  fechaAceptacion?: string;
  razonSocial?: string;
  partidaRegistral?: string;
  tipoDocumentoRepresentante?: 'DNI' | 'CE';
  dniRepresentante?: string;
  nombreRepresentante?: string;
  cargoRepresentante?: string;
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
    if (datos.tipoDocumento === 'DNI') {
      const validacion = validarDni(datos.dni);
      if (!validacion.valido) {
        throw new ValidationError({
          invalidParams: [{ name: 'dni', reason: 'DNI_FORMATO_INVALIDO: debe contener 8 dígitos.' }],
        });
      }
    }

    return this.registrarPersona({
      tipoPersona: 'NATURAL',
      tipoDocumento: datos.tipoDocumento,
      numeroDocumento: datos.dni,
      nombres: datos.nombres,
      apellidos: `${datos.apellidoPaterno} ${datos.apellidoMaterno}`,
      correo: datos.correo,
      celular: datos.celular,
      direccion: datos.direccion,
      referenciaDomicilio: datos.referenciaDomicilio,
      ubigeoDistrito: datos.ubigeoDistrito,
      password: datos.password,
      ipAddress,
      consentimientoDatos: datos.consentimientoDatos,
      aceptaNotificaciones: datos.aceptaNotificaciones,
      declaracionJurada: datos.declaracionJurada,
      fechaNacimiento: datos.fechaNacimiento,
      fechaAceptacion: datos.fechaAceptacion,
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
      tipoPersona: 'JURIDICA',
      tipoDocumento: 'RUC',
      numeroDocumento: datos.ruc,
      nombres: datos.razonSocial,
      apellidos: null,
      razonSocial: datos.razonSocial,
      partidaRegistral: datos.partidaRegistral,
      tipoDocumentoRepresentante: datos.tipoDocumentoRepresentante,
      dniRepresentante: datos.dniRepresentante,
      nombreRepresentante: datos.nombreRepresentante,
      cargoRepresentante: datos.cargoRepresentante,
      correo: datos.correo,
      celular: datos.celular,
      direccion: datos.direccion,
      referenciaDomicilio: datos.referenciaDomicilio,
      ubigeoDistrito: datos.ubigeoDistrito,
      password: datos.password,
      ipAddress,
      consentimientoDatos: datos.consentimientoDatos,
      aceptaNotificaciones: datos.aceptaNotificaciones,
      declaracionJurada: datos.declaracionJurada,
      fechaAceptacion: datos.fechaAceptacion,
    });
  }

  private async registrarPersona(datos: DatosPersonaRegistro): Promise<RegistroResult> {
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

      const documento = await this.buscarTipoDocumento(cliente, datos.tipoDocumento);
      await this.verificarDuplicados(cliente, datos, documento);
      const personaId = await this.insertarPersona(cliente, datos, documento);
      if (datos.tipoPersona === 'NATURAL') {
        await this.insertarPersonaNatural(cliente, personaId, datos);
      } else {
        await this.insertarPersonaJuridica(cliente, personaId, datos);
      }

      const usuarioId = await this.insertarCuenta(cliente, personaId, datos, passwordHash);
      await this.asignarRolCiudadano(cliente, usuarioId);
      await this.insertarConsentimientos(cliente, personaId, datos);

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

  private async buscarTipoDocumento(cliente: PoolClient, codigo: DatosPersonaRegistro['tipoDocumento']): Promise<string> {
    const resultado = await cliente.query<IdResult>(
      `SELECT id_tipo_documento::text AS id
         FROM sigd_auth.tipos_documento
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
    datos: DatosPersonaRegistro,
    tipoDocumentoId: string,
  ): Promise<void> {
    const resultado = await cliente.query<ExisteResult>(
      `SELECT
         EXISTS (
           SELECT 1 FROM sigd_auth.persona p
            WHERE p.tipo = $1 AND p.id_documento = $2
              AND p.id_tipo_documento = $5
         ) OR EXISTS (
           SELECT 1 FROM sigd_auth.cuenta_usuario u
            WHERE lower(u.correo) = lower($3) OR u.usuario = $4
         ) AS existe`,
      [datos.tipoPersona, datos.numeroDocumento, datos.correo, datos.numeroDocumento, tipoDocumentoId],
    );
    if (resultado.rows[0]?.existe) {
      throw new ConflictError({
        code: 'CITIZEN_ALREADY_EXISTS',
        message: 'Ya existe una persona o cuenta con ese documento o correo.',
      });
    }
  }

  private async insertarPersona(
    cliente: PoolClient,
    datos: DatosPersonaRegistro,
    tipoDocumentoId: string,
  ): Promise<string> {
    const resultado = await cliente.query<IdResult>(
      `INSERT INTO sigd_auth.persona
         (tipo, id_documento, id_tipo_documento, direccion, ubigeo_distrito, referencia_domicilio)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_persona::text AS id`,
      [datos.tipoPersona, datos.numeroDocumento, tipoDocumentoId, datos.direccion,
        datos.ubigeoDistrito, datos.referenciaDomicilio ?? null],
    );
    const id = resultado.rows[0]?.id;
    if (!id) throw new Error('La inserción de persona no devolvió su identificador.');
    return id;
  }

  private async insertarPersonaNatural(
    cliente: PoolClient,
    personaId: string,
    datos: DatosPersonaRegistro,
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO sigd_auth.persona_natural
         (id_persona, nombres, apellidos, nombre_completo, correo, telefono, fecha_nacimiento)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [personaId, datos.nombres, datos.apellidos, `${datos.nombres} ${datos.apellidos}`,
        datos.correo, datos.celular, datos.fechaNacimiento ?? null],
    );
  }

  private async insertarPersonaJuridica(
    cliente: PoolClient,
    personaId: string,
    datos: DatosPersonaRegistro,
  ): Promise<void> {
    const documentoRepresentante = datos.dniRepresentante;
    const nombreRepresentante = datos.nombreRepresentante;
    const cargoRepresentante = datos.cargoRepresentante;
    if (!documentoRepresentante || !nombreRepresentante || !cargoRepresentante || !datos.razonSocial) {
      throw new ValidationError({
        invalidParams: [{ name: 'representanteLegal', reason: 'Complete los datos del representante legal.' }],
      });
    }

    const representante = await cliente.query<RepresentanteResult>(
      `SELECT p.id_persona::text AS id, pn.nombre_completo
         FROM sigd_auth.persona p
         JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
         JOIN sigd_auth.tipos_documento td ON td.id_tipo_documento = p.id_tipo_documento
        WHERE p.tipo = 'NATURAL' AND p.id_documento = $1 AND td.codigo = $2
        FOR SHARE OF p, pn`,
      [documentoRepresentante, datos.tipoDocumentoRepresentante ?? 'DNI'],
    );
    const titularRepresentante = representante.rows[0];
    if (!titularRepresentante) {
      throw new ConflictError({
        code: 'REPRESENTANTE_NO_REGISTRADO',
        message: 'El representante legal debe estar previamente registrado como persona natural.',
      });
    }
    if (normalizarNombre(titularRepresentante.nombre_completo) !== normalizarNombre(nombreRepresentante)) {
      throw new ValidationError({
        invalidParams: [{ name: 'nombreRepresentante', reason: 'El nombre no coincide con el documento del representante.' }],
      });
    }

    await cliente.query(
      `INSERT INTO sigd_auth.persona_juridica
         (id_persona, razon_social, nombre_comercial, representante_legal, direccion,
          partida_registral_sunarp, representante_tipo_documento, representante_documento,
          representante_cargo, correo_contacto, telefono_contacto, ubigeo_distrito)
       VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [personaId, datos.razonSocial, nombreRepresentante, datos.direccion,
        datos.partidaRegistral ?? null, datos.tipoDocumentoRepresentante ?? 'DNI',
        documentoRepresentante, cargoRepresentante, datos.correo, datos.celular, datos.ubigeoDistrito],
    );
    await cliente.query(
      `INSERT INTO sigd_auth.representacion_legal
         (id_persona_juridica, id_persona_natural, cargo)
       VALUES ($1, $2, $3)`,
      [personaId, titularRepresentante.id, cargoRepresentante],
    );
  }

  private async insertarCuenta(
    cliente: PoolClient,
    personaId: string,
    datos: DatosPersonaRegistro,
    passwordHash: string,
  ): Promise<string> {
    const resultado = await cliente.query<IdResult>(
      `INSERT INTO sigd_auth.cuenta_usuario
         (id_persona, usuario, correo, password_hash, debe_cambiar_password)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id_usuario::text AS id`,
      [personaId, datos.numeroDocumento, datos.correo, passwordHash],
    );
    const id = resultado.rows[0]?.id;
    if (!id) throw new Error('La inserción de cuenta no devolvió su identificador.');
    return id;
  }

  private async asignarRolCiudadano(cliente: PoolClient, usuarioId: string): Promise<void> {
    const asignacion = await cliente.query<IdResult>(
      `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
       SELECT $1, rol_id
         FROM sigd_org.rol_sistema
        WHERE codigo = 'CIUDADANO' AND vigente = TRUE
       RETURNING id_usuario_rol::text AS id`,
      [usuarioId],
    );
    if (!asignacion.rows[0]?.id) {
      throw new AppError({
        status: 500,
        code: 'CITIZEN_ROLE_NOT_CONFIGURED',
        message: 'No está configurado el rol CIUDADANO.',
      });
    }
  }

  private async insertarConsentimientos(
    cliente: PoolClient,
    personaId: string,
    datos: DatosPersonaRegistro,
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO sigd_auth.consentimiento_datos
         (id_persona, finalidade, version_politica, aceptado, fecha_aceptacion, ip_origen)
       VALUES ($1, 'Tratamiento de datos personales (Ley N.° 29733)', 'v1.0', $2,
               COALESCE($3::timestamptz, now()), $4)`,
      [personaId, datos.consentimientoDatos, datos.fechaAceptacion ?? null, datos.ipAddress],
    );
    await cliente.query(
      `INSERT INTO sigd_auth.consentimiento_datos
         (id_persona, finalidade, version_politica, aceptado, fecha_aceptacion, ip_origen)
       VALUES ($1, 'Notificaciones electrónicas', 'v1.0', $2,
               CASE WHEN $2 THEN COALESCE($3::timestamptz, now()) ELSE NULL END, $4)`,
      [personaId, datos.aceptaNotificaciones, datos.fechaAceptacion ?? null, datos.ipAddress],
    );
    await cliente.query(
      `INSERT INTO sigd_auth.consentimiento_datos
         (id_persona, finalidade, version_politica, aceptado, fecha_aceptacion, ip_origen)
       VALUES ($1, 'Declaración jurada de veracidad', 'v1.0', TRUE,
               COALESCE($2::timestamptz, now()), $3)`,
      [personaId, datos.fechaAceptacion ?? null, datos.ipAddress],
    );
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
