import { Argon2Service } from './argon2.service.js';
import type { Pool } from 'pg';
import { AppError, ValidationError } from '../../shared/domain/errors/index.js';
import type {
  RegistroCiudadanoInput,
  RegistroPersonaJuridicaInput,
} from './registro.schemas.js';
import { validarDni, validarRuc } from './modulo11.validator.js';
import { UbigeoService } from './ubigeo.service.js';
import { RegistroRepository } from './registro.repository.js';
import type { DatosRegistro } from './registro.types.js';

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

  private async registrarPersona(datos: DatosRegistro & { password: string }): Promise<RegistroResult> {
    if (!(await this.ubigeoService.contieneDistrito(datos.ubigeoDistrito))) {
      throw new ValidationError({
        invalidParams: [{ name: 'ubigeoDistrito', reason: 'El distrito no pertenece al catálogo de Ucayali.' }],
      });
    }

    const { password, ...datosRegistro } = datos;
    const passwordHash = await Argon2Service.hash(password, PARAMETROS_ARGON2ID);
    const resultado = await new RegistroRepository(this.pool).registrar(datosRegistro, passwordHash);
    return { idPersona: resultado.idPersona, mensaje: 'Registro exitoso' };
  }
}
