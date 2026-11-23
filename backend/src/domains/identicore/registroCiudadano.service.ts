import crypto from 'node:crypto';
import { Argon2Service } from './argon2.service.js';
import type { Pool, PoolClient } from 'pg';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { cifrarTokenPayload } from '../../core/security/cifrado-payload.js';
import type {
  RegistroCiudadanoInput,
  RegistroPersonaJuridicaInput,
} from './registro.schemas.js';
import { validarDni, validarRuc } from './modulo11.validator.js';
import { UbigeoService } from './ubigeo.service.js';
import { IdentidadOtpService, normalizarIdentidadOtp } from './identidadOtp.service.js';

interface IdResult {
  id: string;
}

interface TipoDocumentoResult {
  id: string;
}

interface RepresentanteResult extends IdResult {
  nombres: string;
  apellidos: string;
  correo: string | null;
}

interface ExisteResult {
  existe: boolean;
}

export interface RegistroResult {
  idPersona: string;
  idUsuario: string;
  idCasilla: string;
  cvdCasilla: string;
  correo: string;
  mensaje: string;
  activo: true;
  casillaHabilitada: true;
}

export class RegistroCiudadanoService {
  constructor(
    private readonly pool: Pool,
    private readonly ubigeoService: UbigeoService,
    private readonly identidadOtp: IdentidadOtpService = new IdentidadOtpService(pool),
  ) {}

  async registrarCiudadano(datos: RegistroCiudadanoInput, ipAddress: string | null): Promise<RegistroResult> {
    const numeroDocumento = datos.numeroDocumento ?? datos.dni;
    const validacion = datos.tipoDocumento === 'DNI' && numeroDocumento
      ? validarDni(numeroDocumento)
      : { valido: Boolean(numeroDocumento) };
    if (!validacion.valido) {
      throw new ValidationError({
        invalidParams: [{ name: 'dni', reason: 'DNI_FORMATO_INVALIDO: debe contener 8 dígitos.' }],
      });
    }
    if (!cumpleEdadMinima(datos.fechaNacimiento, 16)) {
      throw new ValidationError({
        invalidParams: [{ name: 'fechaNacimiento', reason: 'La persona debe tener al menos 16 anios.' }],
      });
    }
    return this.registrarPersona({
      tipoDocumento: datos.tipoDocumento,
      numeroDocumento: numeroDocumento!,
      correo: datos.correo,
      celular: datos.celular,
      direccion: datos.direccion,
      ubigeoDistrito: datos.ubigeoDistrito,
      referencia: datos.referencia,
      password: datos.password,
      nombres: datos.nombres,
      apellidoPaterno: datos.apellidoPaterno,
      apellidoMaterno: datos.apellidoMaterno || null,
      fechaNacimiento: datos.fechaNacimiento,
      verificacionTitularidad: datos.verificacionTitularidad,
      versionPolitica: datos.versionPolitica,
      declaracionJuradaAceptada: datos.declaracionJuradaAceptada,
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
    const documentoRepresentante = datos.numeroDocumentoRepresentante ?? datos.dniRepresentante;
    if (!documentoRepresentante) {
      throw new ValidationError({ invalidParams: [{ name: 'numeroDocumentoRepresentante', reason: 'El documento del representante es obligatorio.' }] });
    }
    if (datos.tipoDocumentoRepresentante === 'DNI' && !validarDni(documentoRepresentante).valido) {
      throw new ValidationError({ invalidParams: [{ name: 'numeroDocumentoRepresentante', reason: 'El DNI del representante no es válido.' }] });
    }
    return this.registrarPersona({
      tipoDocumento: 'RUC',
      verificacionTitularidad: datos.verificacionTitularidad,
      numeroDocumento: datos.ruc,
      correo: datos.correo,
      celular: datos.celular,
      direccion: datos.direccion,
      ubigeoDistrito: datos.ubigeoDistrito,
      referencia: datos.referencia,
      password: datos.password,
      nombres: datos.razonSocial,
      apellidoPaterno: null,
      apellidoMaterno: null,
      tipoPersona: 'JURIDICA',
      razonSocial: datos.razonSocial,
      nombreComercial: datos.razonSocial,
      documentoRepresentante,
      tipoDocumentoRepresentante: datos.tipoDocumentoRepresentante,
      nombreRepresentante: datos.nombreRepresentante,
      cargoRepresentante: datos.cargoRepresentante,
      versionPolitica: datos.versionPolitica,
      declaracionJuradaAceptada: datos.declaracionJuradaAceptada,
      aceptaNotificaciones: datos.aceptaNotificaciones,
      ipAddress,
      partidaRegistral: datos.partidaRegistral ? BigInt(datos.partidaRegistral).toString() : null,
    });
  }

  private async registrarPersona(datos: {
    tipoDocumento: 'DNI' | 'CE' | 'RUC';
    numeroDocumento: string;
    correo: string;
    celular: string;
    direccion?: string;
    ubigeoDistrito?: string;
    referencia?: string;
    verificacionTitularidad?: string;
    password: string;
    nombres: string;
    apellidoPaterno: string | null;
    apellidoMaterno: string | null;
    fechaNacimiento?: string;
    cargoRepresentante?: string;
    declaracionJuradaAceptada: true;
    aceptaNotificaciones: boolean;
    versionPolitica?: string;
    ipAddress: string | null;
    tipoPersona: 'NATURAL' | 'JURIDICA';
    razonSocial?: string;
    nombreComercial?: string;
    documentoRepresentante?: string;
    tipoDocumentoRepresentante?: 'DNI' | 'CE';
    nombreRepresentante?: string;
    partidaRegistral: string | null;
  }): Promise<RegistroResult> {
    const capacidades = await this.capacidadesRegistro();
    if (Boolean(datos.direccion) !== Boolean(datos.ubigeoDistrito)) throw new ValidationError({ invalidParams: [{ name: 'direccion', reason: 'Complete direccion y distrito conjuntamente.' }] });
    if (datos.referencia && !datos.direccion) throw new ValidationError({ invalidParams: [{ name: 'referencia', reason: 'La referencia requiere domicilio.' }] });
    if ((datos.direccion || datos.ubigeoDistrito || datos.referencia) && !capacidades.domicilio) throw new ValidationError({ invalidParams: [{ name: 'direccion', reason: 'DOMICILIO_NO_DISPONIBLE: cree la cuenta sin domicilio; puede declararlo al presentar su solicitud.' }] });

    const tipoDocumento = await this.pool.query<TipoDocumentoResult>(
      `SELECT id_tipo_documento::text AS id
         FROM sigd_auth.tipos_documento
        WHERE codigo = $1 AND vigente = TRUE`,
      [datos.tipoDocumento],
    );
    const tipoDocumentoId = tipoDocumento.rows[0]?.id;
    if (!tipoDocumentoId) {
      throw new AppError({
        status: 503,
        code: 'DOCUMENT_TYPE_NOT_CONFIGURED',
        message: `El catálogo institucional no tiene un tipo de documento vigente configurado para ${datos.tipoDocumento}.`,
      });
    }

    if (datos.ubigeoDistrito && !(await this.ubigeoService.contieneDistrito(datos.ubigeoDistrito))) {
      throw new ValidationError({
        invalidParams: [{ name: 'ubigeoDistrito', reason: 'El distrito no pertenece al catálogo oficial de UBIGEO.' }],
      });
    }

    let passwordHash: string;
    try {
      passwordHash = await Argon2Service.hashArgon2id(datos.password);
    } catch {
      throw new AppError({ status: 503, code: 'REGISTRATION_HASH_UNAVAILABLE',
        message: 'El registro ciudadano no está disponible temporalmente.' });
    }
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      const duplicado = await cliente.query<ExisteResult>(
        `SELECT
           EXISTS (
             SELECT 1 FROM sigd_auth.persona p
             JOIN sigd_auth.cuenta_usuario c ON c.id_persona = p.id_persona
              WHERE p.tipo = $1 AND p.id_documento = $2
           ) OR EXISTS (
             SELECT 1 FROM sigd_auth.cuenta_usuario u
              WHERE lower(u.correo) = lower($3) OR u.usuario = $4
           ) AS existe`,
        [datos.tipoPersona, datos.numeroDocumento, datos.correo, datos.numeroDocumento],
      );
      if (duplicado.rows[0]?.existe) {
        throw new ConflictError({
          code: 'CITIZEN_ALREADY_EXISTS',
          message: 'No se puede completar el registro con esos datos. Si ya tiene cuenta, inicie sesión.',
        });
      }

      const persona = await cliente.query<IdResult>(
        `INSERT INTO sigd_auth.persona (tipo, id_documento)
         VALUES ($1, $2)
         ON CONFLICT (tipo, id_documento) DO NOTHING
         RETURNING id_persona::text AS id`,
        [datos.tipoPersona, datos.numeroDocumento],
      );
      let personaId = persona.rows[0]?.id;
      const personaNueva = Boolean(personaId);
      let identidadPrevia: { id: string; nombres?: string; apellidos?: string; correo?: string | null; fecha_nacimiento?: string | null } | undefined = undefined;
      if (!personaId) {
        // En caso de identidad preexistente (por ejemplo, registrada previamente
        // en Mesa de Partes), se recupera el id_persona sin sobrescribir datos.
        // REGLA ARQUITECTÓNICA INVIOLABLE (Regla 5): La cuenta ciudadana se crea
        // de manera independiente sin bloquear al usuario, mientras que los expedientes
        // históricos permanecen protegidos y desvinculados hasta una acreditación posterior.
        const existente = await cliente.query<{ id: string; nombres?: string; apellidos?: string; correo?: string | null; fecha_nacimiento?: string | null }>(
          `SELECT p.id_persona::text AS id, pn.nombres, pn.apellidos, pn.correo, pn.fecha_nacimiento::text
             FROM sigd_auth.persona p
             LEFT JOIN sigd_auth.persona_natural pn USING (id_persona)
            WHERE p.tipo = $1 AND p.id_documento = $2
            FOR UPDATE OF p`,
          [datos.tipoPersona, datos.numeroDocumento],
        );
        const identidad = existente.rows[0];
        if (!identidad) {
          throw new ConflictError({
            code: 'CITIZEN_IDENTITY_CONFLICT',
            message: 'No se pudo validar el registro. Revise sus datos o contacte con atención institucional.',
          });
        }
        identidadPrevia = identidad;
        personaId = identidad.id;

        // Comprobar que los datos declarados no choquen con una identidad civil previa
        if (datos.tipoPersona === 'NATURAL' && identidad.nombres && identidad.apellidos) {
          if (
            normalizarIdentidadOtp(identidad.nombres) !== normalizarIdentidadOtp(datos.nombres) ||
            normalizarIdentidadOtp(identidad.apellidos) !== normalizarIdentidadOtp([datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ')) ||
            (identidad.fecha_nacimiento && identidad.fecha_nacimiento !== datos.fechaNacimiento)
          ) {
            throw new ConflictError({
              code: 'CITIZEN_IDENTITY_CONFLICT',
              message: 'No fue posible verificar la identidad. Solicite validacion institucional.',
            });
          }
        }

        // Si se proporcionó prueba de titularidad previa, consumirla
        if (datos.verificacionTitularidad) {
          await this.identidadOtp.consumir(datos.verificacionTitularidad, personaId, datos.numeroDocumento, identidad.correo ?? null);
        }

        // Comprobar que no exista una cuenta previa asociada a esta persona
        const cuentaPrevia = await cliente.query<ExisteResult>(
          `SELECT EXISTS (
             SELECT 1 FROM sigd_auth.cuenta_usuario WHERE id_persona=$1::uuid
           ) AS existe`,
          [personaId],
        );
        if (cuentaPrevia.rows[0]?.existe) {
          throw new ConflictError({
            code: 'CITIZEN_ALREADY_EXISTS',
            message: 'No se puede completar el registro con esos datos. Si ya tiene cuenta, inicie sesión.',
          });
        }
      }

      await cliente.query(
        `INSERT INTO sigd_auth.persona_documento_historial
           (id_persona, id_documento, tipo_documento, origen)
         SELECT $1::uuid, $2::varchar, $3::smallint, 'MANUAL'
         WHERE NOT EXISTS (SELECT 1 FROM sigd_auth.persona_documento_historial
           WHERE id_persona=$1::uuid AND id_documento=$2::varchar AND tipo_documento=$3::smallint)`,
        [personaId, datos.numeroDocumento, tipoDocumentoId],
      );

      if (datos.tipoPersona === 'NATURAL') {
        if (personaNueva) {
          await cliente.query(
            `INSERT INTO sigd_auth.persona_natural
               (id_persona, nombres, apellidos, nombre_completo, fecha_nacimiento, correo, telefono${capacidades.domicilio ? ', direccion, ubigeo_distrito' : ''})
             VALUES ($1::uuid, $2, $3, $4, $5::date, $6, $7${capacidades.domicilio ? ', $8, $9' : ''})`,
            [
              personaId,
              datos.nombres,
              [datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' '),
              [datos.nombres, datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' '),
              datos.fechaNacimiento ?? null,
              datos.correo,
              datos.celular,
              ...(capacidades.domicilio ? [datos.direccion ?? null, datos.ubigeoDistrito ?? null] : []),
            ],
          );
        } else if (!identidadPrevia?.nombres) {
          // Si la persona ya existía pero no tenía registro en persona_natural, se asegura su inserción
          await cliente.query(
            `INSERT INTO sigd_auth.persona_natural
               (id_persona, nombres, apellidos, nombre_completo, fecha_nacimiento, correo, telefono${capacidades.domicilio ? ', direccion, ubigeo_distrito' : ''})
             VALUES ($1::uuid, $2, $3, $4, $5::date, $6, $7${capacidades.domicilio ? ', $8, $9' : ''})
             ON CONFLICT (id_persona) DO NOTHING`,
            [
              personaId,
              datos.nombres,
              [datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' '),
              [datos.nombres, datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' '),
              datos.fechaNacimiento ?? null,
              datos.correo,
              datos.celular,
              ...(capacidades.domicilio ? [datos.direccion ?? null, datos.ubigeoDistrito ?? null] : []),
            ],
          );
        }
      } else if (datos.tipoPersona === 'JURIDICA') {
        const documentoRepresentante = datos.documentoRepresentante;
        const nombreRepresentante = datos.nombreRepresentante;
        if (!documentoRepresentante || !nombreRepresentante) {
          throw new Error('Faltan los datos de identificación del representante legal.');
        }
        const representante = await cliente.query<RepresentanteResult>(
          `SELECT p.id_persona::text AS id, pn.nombres, pn.apellidos, pn.correo
             FROM sigd_auth.persona p
             JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
            WHERE p.id_documento = $1
              AND p.tipo = 'NATURAL'
            FOR UPDATE OF pn, p`,
          [documentoRepresentante],
        );
        let personaRepresentante = representante.rows[0];
        if (!personaRepresentante) {
          // Si el representante no cuenta aún con registro civil, se registra como persona natural civil
          const insRep = await cliente.query<IdResult>(
            `INSERT INTO sigd_auth.persona (tipo, id_documento)
             VALUES ('NATURAL', $1)
             ON CONFLICT (tipo, id_documento) DO NOTHING
             RETURNING id_persona::text AS id`,
            [documentoRepresentante],
          );
          let idRep = insRep.rows[0]?.id;
          if (!idRep) {
            const expRep = await cliente.query<IdResult>(
              `SELECT id_persona::text AS id FROM sigd_auth.persona WHERE tipo = 'NATURAL' AND id_documento = $1`,
              [documentoRepresentante],
            );
            idRep = expRep.rows[0]?.id;
          }
          if (idRep) {
            await cliente.query(
              `INSERT INTO sigd_auth.persona_documento_historial (id_persona, id_documento, tipo_documento, origen)
               SELECT $1::uuid, $2::varchar, td.id_tipo_documento, 'MANUAL'
                 FROM sigd_auth.tipos_documento td
                WHERE td.codigo = $3
               ON CONFLICT DO NOTHING`,
              [idRep, documentoRepresentante, datos.tipoDocumentoRepresentante ?? 'DNI'],
            );
            await cliente.query(
              `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
               VALUES ($1::uuid, $2, '', $2, $3, $4)
               ON CONFLICT (id_persona) DO NOTHING`,
              [idRep, nombreRepresentante, datos.correo, datos.celular],
            );
            personaRepresentante = {
              id: idRep,
              nombres: nombreRepresentante,
              apellidos: '',
              correo: datos.correo,
            };
          }
        }

        if (!personaRepresentante) {
          throw new ConflictError({
            code: 'REPRESENTANTE_NO_REGISTRADO',
            message: 'No se pudo asociar la identidad del representante legal.',
          });
        }

        if (datos.verificacionTitularidad) {
          await this.identidadOtp.consumir(datos.verificacionTitularidad, personaRepresentante.id,
            documentoRepresentante, personaRepresentante.correo);
        }

        const columnasJuridica = [
          'id_persona', 'razon_social', 'nombre_comercial', 'representante_legal', 'direccion',
        ];
        const valoresJuridica: unknown[] = [
          personaId, datos.razonSocial, datos.nombreComercial, datos.nombreRepresentante,
          datos.direccion ?? null,
        ];
        if (capacidades.domicilio) {
          columnasJuridica.push('ubigeo_distrito');
          valoresJuridica.push(datos.ubigeoDistrito ?? null);
        }
        const parametrosJuridica = valoresJuridica.map((_, indice) => `$${indice + 1}${indice === 0 ? '::uuid' : ''}`);
        await cliente.query(
          `INSERT INTO sigd_auth.persona_juridica (${columnasJuridica.join(', ')})
           VALUES (${parametrosJuridica.join(', ')})
           ON CONFLICT (id_persona) DO UPDATE SET
             razon_social = EXCLUDED.razon_social,
             nombre_comercial = EXCLUDED.nombre_comercial,
             representante_legal = EXCLUDED.representante_legal,
             direccion = COALESCE(EXCLUDED.direccion, sigd_auth.persona_juridica.direccion)${capacidades.domicilio ? ', ubigeo_distrito = COALESCE(EXCLUDED.ubigeo_distrito, sigd_auth.persona_juridica.ubigeo_distrito)' : ''}`,
          valoresJuridica,
        );

        await cliente.query(
          `INSERT INTO sigd_auth.representacion_legal
             (id_persona_natural, id_persona_juridica, cargo)
           VALUES ($1::uuid, $2::uuid, $3)
           ON CONFLICT DO NOTHING`,
          [personaRepresentante.id, personaId, datos.cargoRepresentante ?? 'REPRESENTANTE LEGAL'],
        );
      }

      // La cuenta ciudadana se crea en estado ACTIVO (activo = true)
      // conforme a la decisión institucional de activación automática y habilitación inmediata.
      const cuenta = await cliente.query<IdResult>(
        `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash, activo)
         VALUES ($1::uuid, $2, $3, $4, TRUE)
         RETURNING id_usuario::text AS id`,
        [personaId, datos.numeroDocumento, datos.correo, passwordHash],
      );
      const usuarioId = cuenta.rows[0]?.id;
      if (!usuarioId) throw new Error('La inserción de cuenta no devolvió su identificador.');

      // Perfil de usuario institucional (sigd_auth.perfil_usuario)
      if (capacidades.domicilio) {
        await cliente.query(`INSERT INTO sigd_auth.perfil_usuario (id_usuario, telefono, direccion, ubigeo_distrito, referencia)
          VALUES ($1::uuid,$2,$3,$4,$5)`, [usuarioId, datos.celular, datos.direccion ?? null, datos.ubigeoDistrito ?? null, datos.referencia ?? null]);
      } else {
        await cliente.query(`INSERT INTO sigd_auth.perfil_usuario (id_usuario, telefono) VALUES ($1::uuid,$2)`, [usuarioId, datos.celular]);
      }

      // 5. Vinculación institucional canónica y asignación del rol CIUDADANO (Migración 24)
      // 5.1. Resolver inequívocamente la institución IESTP Suiza
      const institucionRes = await cliente.query<{ institucion_id: string }>(
        `SELECT institucion_id
           FROM sigd_org.institucion
          WHERE codigo = 'IESTP_SUIZA' AND activo = TRUE`,
      );
      if (institucionRes.rows.length !== 1) {
        throw new AppError({
          status: 503,
          code: 'INSTITUTION_NOT_CONFIGURED',
          message: 'La institución IESTP «Suiza» no está configurada o activa para el registro de ciudadanos.',
        });
      }
      const institucionId = institucionRes.rows[0].institucion_id;

      // 5.2. Crear membresía en sigd_auth.usuario_institucion (condición previa obligatoria para FK en usuario_rol)
      await cliente.query(
        `INSERT INTO sigd_auth.usuario_institucion (id_usuario, institucion_id, activo)
         VALUES ($1::uuid, $2::uuid, TRUE)
         ON CONFLICT (id_usuario, institucion_id) DO NOTHING`,
        [usuarioId, institucionId],
      );

      // Verificar que la membresía institucional existe y está activa
      const membresiaRes = await cliente.query<{ activo: boolean }>(
        `SELECT activo
           FROM sigd_auth.usuario_institucion
          WHERE id_usuario = $1::uuid AND institucion_id = $2::uuid`,
        [usuarioId, institucionId],
      );
      if (!membresiaRes.rows[0]?.activo) {
        throw new AppError({
          status: 503,
          code: 'INSTITUTIONAL_MEMBERSHIP_INACTIVE',
          message: 'No se pudo establecer la vinculación institucional activa para el usuario.',
        });
      }

      // 5.3. Obtener rol_id canónico de CIUDADANO
      const rolRes = await cliente.query<{ rol_id: string }>(
        `SELECT rol_id
           FROM sigd_org.rol_sistema
          WHERE codigo = 'CIUDADANO' AND vigente = TRUE`,
      );
      if (rolRes.rows.length !== 1) {
        throw new AppError({
          status: 503,
          code: 'CITIZEN_ROLE_NOT_CONFIGURED',
          message: 'El registro ciudadano no está disponible temporalmente.',
        });
      }
      const rolId = rolRes.rows[0].rol_id;

      // 5.4. Asignar rol CIUDADANO en sigd_org.usuario_rol
      await cliente.query(
        `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, area_id, institucion_id)
         VALUES ($1::uuid, $2::uuid, NULL, $3::uuid)
         ON CONFLICT DO NOTHING`,
        [usuarioId, rolId, institucionId],
      );

      // 5.5. Verificar formalmente que la asignación institucional esperada existe y está vigente
      const rolVerifRes = await cliente.query<{ id_usuario_rol: string }>(
        `SELECT ur.id_usuario_rol
           FROM sigd_org.usuario_rol ur
          WHERE ur.id_usuario = $1::uuid
            AND ur.rol_id = $2::uuid
            AND ur.institucion_id = $3::uuid
            AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > CURRENT_TIMESTAMP)`,
        [usuarioId, rolId, institucionId],
      );
      if (rolVerifRes.rows.length === 0) {
        throw new AppError({
          status: 503,
          code: 'CITIZEN_ROLE_NOT_CONFIGURED',
          message: 'El registro ciudadano no está disponible temporalmente.',
        });
      }

      // Consentimientos normativos Ley N° 29733 (sigd_auth.consentimiento_datos)
      await cliente.query(
        `INSERT INTO sigd_auth.consentimiento_datos
           (id_persona, finalidade, version_politica, aceptado, fecha_aceptacion, ip_origen)
         VALUES
           ($1::uuid, 'TRATAMIENTO_DATOS_PERSONALES', $2, TRUE, CURRENT_TIMESTAMP, $3::inet),
           ($1::uuid, 'DECLARACION_JURADA', $2, TRUE, CURRENT_TIMESTAMP, $3::inet)`,
        [personaId, datos.versionPolitica ?? '1.0', datos.ipAddress],
      );

      if (datos.aceptaNotificaciones) {
        await cliente.query(
          `INSERT INTO sigd_auth.consentimiento_datos
             (id_persona, finalidade, version_politica, aceptado, fecha_aceptacion, ip_origen)
           VALUES ($1::uuid, 'NOTIFICACIONES_ELECTRONICAS', $2, TRUE, CURRENT_TIMESTAMP, $3::inet)`,
          [personaId, datos.versionPolitica ?? '1.0', datos.ipAddress],
        );
      }

      // Inicialización formal de la Casilla Electrónica Institucional y emisión del acto de apertura
      // dentro de la misma transacción (BEGIN ... COMMIT), mediante la operación canónica compartida.
      const casillaApertura = await this.abrirCasillaElectronicaEnTransaccion(cliente, {
        usuarioId,
        usuario: datos.numeroDocumento,
        correo: datos.correo,
      });

      const nombreTitular = datos.tipoPersona === 'NATURAL'
        ? [datos.nombres, datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ')
        : (datos.razonSocial ?? datos.numeroDocumento);

      // Publicación en Transactional Outbox del evento canónico de activación de cuenta
      await insertarEvento(cliente, {
        agregado: 'cuenta_usuario',
        tipo_evento: 'cuenta_activada',
        payload: {
          idUsuario: usuarioId,
          idCasilla: casillaApertura.idCasilla,
          cvdCasilla: casillaApertura.cvdCasilla,
          correo: datos.correo,
          titular: nombreTitular,
          fechaActivacion: new Date().toISOString(),
        },
      });

      // Registro de auditoría institucional estructurada con trazabilidad JSONB (sigd_auth.auditoria_usuarios)
      const correlationId = crypto.randomUUID();
      const detalleAuditoria = {
        tipoPersona: datos.tipoPersona,
        tipoDocumento: datos.tipoDocumento,
        numeroDocumento: datos.numeroDocumento,
        direccion: datos.direccion,
        ubigeoDistrito: datos.ubigeoDistrito,
        referencia: datos.referencia,
        declaracionJuradaAceptada: datos.declaracionJuradaAceptada,
        aceptaNotificaciones: datos.aceptaNotificaciones,
        versionPolitica: datos.versionPolitica ?? '1.0',
        personaReutilizada: !personaNueva,
        verificacionVinculacion: datos.verificacionTitularidad ? 'CONTROL_CONTACTO_PREEXISTENTE_OTP_NO_ACREDITA_IDENTIDAD_OFICIAL' : null,
        verificacionRepresentante: datos.tipoPersona === 'JURIDICA' && datos.verificacionTitularidad ? 'CONTROL_CONTACTO_REPRESENTANTE_OTP_DECLARACION_NO_VERIFICA_SUNARP' : null,
        partidaRegistral: datos.partidaRegistral,
        ipAddress: datos.ipAddress,
        activo: true,
        correoVerificado: false,
        casillaHabilitada: true,
        idCasilla: casillaApertura.idCasilla,
        cvdCasilla: casillaApertura.cvdCasilla,
      };

      await cliente.query(
        `INSERT INTO sigd_auth.auditoria_usuarios
           (correlation_id, id_usuario, operacion, detalle)
         VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)`,
        [
          correlationId,
          usuarioId,
          datos.tipoPersona === 'NATURAL' ? 'REGISTRO_CIUDADANO' : 'REGISTRO_PERSONA_JURIDICA',
          JSON.stringify(detalleAuditoria),
        ],
      );

      await cliente.query('COMMIT');
      transaccionAbierta = false;

      return {
        idPersona: personaId,
        idUsuario: usuarioId,
        idCasilla: casillaApertura.idCasilla,
        cvdCasilla: casillaApertura.cvdCasilla,
        correo: datos.correo,
        mensaje: 'Registro exitoso',
        activo: true,
        casillaHabilitada: true,
      };
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      if (esViolacionUnicidad(error)) {
        throw new ConflictError({
          code: 'CITIZEN_ALREADY_EXISTS',
          message: 'No se puede completar el registro con esos datos. Si ya tiene cuenta, inicie sesión.',
        });
      }
      throw error;
    } finally {
      cliente.release();
    }
  }

  /**
   * Activa la cuenta de un ciudadano mediante el token de verificación recibido por correo.
   * Conforme a la Ley N° 27444 y el modelo institucional del SIGD:
   * 1. Valida criptográficamente el token (SHA-256) contra sigd_auth.token_verificacion_correo.
   * 2. Comprueba que no haya expirado ni haya sido utilizado.
   * 3. Marca el token como consumido e inicia la cuenta en sigd_auth.cuenta_usuario (activo = TRUE).
   * 4. Habilita e inicializa formalmente su Casilla Electrónica Institucional con el acto de apertura.
   * 5. Encola el evento en Transactional Outbox y registra la auditoría institucional.
   */
  async activarCuenta(tokenRaw: string, ipAddress: string | null = null): Promise<{
    exito: boolean;
    mensaje: string;
    idUsuario: string;
    correo: string;
  }> {
    if (!tokenRaw || typeof tokenRaw !== 'string' || tokenRaw.trim().length < 10) {
      throw new ValidationError({
        invalidParams: [{ name: 'token', reason: 'Token de activación inválido o malformado.' }],
      });
    }

    const tokenHash = crypto.createHash('sha256').update(tokenRaw.trim()).digest('hex');
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      const tokenRes = await cliente.query<{
        id: string;
        id_usuario: string;
        correo: string;
        tipo: string;
        expira_en: string;
        usado_en: string | null;
        activo: boolean;
        usuario: string;
        titular: string;
      }>(
        `SELECT t.id, t.id_usuario, t.correo, t.tipo, t.expira_en, t.usado_en,
                c.activo, c.usuario,
                COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS titular
           FROM sigd_auth.token_verificacion_correo t
           JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = t.id_usuario
           LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
           LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
          WHERE t.token_hash = $1
          FOR UPDATE OF t, c`,
        [tokenHash],
      );

      const fila = tokenRes.rows[0];
      if (!fila) {
        throw new AppError({
          status: 404,
          code: 'TOKEN_INVALIDO',
          message: 'El enlace o código de activación es inválido o no existe.',
        });
      }

      if (fila.usado_en) {
        throw new ConflictError({
          code: 'TOKEN_YA_UTILIZADO',
          message: 'Este enlace de activación ya ha sido utilizado previamente. Si ya activó su cuenta, inicie sesión.',
        });
      }

      if (new Date(fila.expira_en).getTime() < Date.now()) {
        throw new AppError({
          status: 410,
          code: 'TOKEN_EXPIRADO',
          message: 'El enlace de activación ha expirado. Solicite un nuevo enlace de activación.',
        });
      }

      // Marcar token como utilizado
      await cliente.query(
        `UPDATE sigd_auth.token_verificacion_correo
            SET usado_en = now()
          WHERE id = $1`,
        [fila.id],
      );

      // Activar cuenta de usuario
      await cliente.query(
        `UPDATE sigd_auth.cuenta_usuario
            SET activo = TRUE
          WHERE id_usuario = $1`,
        [fila.id_usuario],
      );

      // Inicializar formalmente la Casilla Electrónica Institucional con el acto de apertura
      // reutilizando la operación canónica compartida sobre el PoolClient transaccional.
      const casillaApertura = await this.abrirCasillaElectronicaEnTransaccion(cliente, {
        usuarioId: fila.id_usuario,
        usuario: fila.usuario,
        correo: fila.correo,
      });

      // Encolar evento outbox
      await insertarEvento(cliente, {
        agregado: 'cuenta_usuario',
        tipo_evento: 'cuenta_activada',
        payload: {
          idUsuario: fila.id_usuario,
          idCasilla: casillaApertura.idCasilla,
          cvdCasilla: casillaApertura.cvdCasilla,
          correo: fila.correo,
          titular: fila.titular,
          fechaActivacion: new Date().toISOString(),
        },
      });

      // Registrar auditoría de activación
      await cliente.query(
        `INSERT INTO sigd_auth.auditoria_usuarios
           (correlation_id, id_usuario, operacion, detalle)
         VALUES ($1::uuid, $2::uuid, 'ACTIVACION_CUENTA_VERIFICADA', $3::jsonb)`,
        [
          crypto.randomUUID(),
          fila.id_usuario,
          JSON.stringify({
            correo: fila.correo,
            ipAddress,
            fechaActivacion: new Date().toISOString(),
          }),
        ],
      );

      await cliente.query('COMMIT');
      transaccionAbierta = false;

      return {
        exito: true,
        mensaje: 'Cuenta activada exitosamente. Su Casilla Electrónica Institucional ha sido habilitada.',
        idUsuario: fila.id_usuario,
        correo: fila.correo,
      };
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  /**
   * Reenvía un nuevo enlace de activación a la cuenta solicitada.
   * Incluye protección anti-enumeración de usuarios (retorna respuesta neutra si no existe).
   */
  async reenviarVerificacion(identificador: string, ipAddress: string | null = null): Promise<{
    exito: boolean;
    mensaje: string;
    correo?: string;
  }> {
    if (!identificador || typeof identificador !== 'string' || identificador.trim().length < 3) {
      throw new ValidationError({
        invalidParams: [{ name: 'identificador', reason: 'Ingrese su número de documento o correo electrónico institucional.' }],
      });
    }

    const identLimpio = identificador.trim();
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      const usuarioRes = await cliente.query<{
        id_usuario: string;
        correo: string;
        activo: boolean;
        usuario: string;
        titular: string;
      }>(
        `SELECT c.id_usuario, c.correo, c.activo, c.usuario,
                COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS titular
           FROM sigd_auth.cuenta_usuario c
           LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
           LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
          WHERE c.usuario = $1 OR lower(c.correo) = lower($1)
          LIMIT 1
          FOR UPDATE OF c`,
        [identLimpio],
      );

      const user = usuarioRes.rows[0];
      // Protección anti-enumeración de usuarios
      if (!user) {
        await cliente.query('COMMIT');
        transaccionAbierta = false;
        return {
          exito: true,
          mensaje: 'Si los datos corresponden a una cuenta pendiente de activación, se ha enviado un nuevo enlace a su correo electrónico.',
        };
      }

      if (user.activo) {
        throw new ConflictError({
          code: 'CUENTA_YA_ACTIVA',
          message: 'La cuenta ya se encuentra activa. Puede iniciar sesión directamente con su documento o correo.',
        });
      }

      // Invalidar tokens previos no utilizados para este usuario
      await cliente.query(
        `UPDATE sigd_auth.token_verificacion_correo
            SET expira_en = now()
          WHERE id_usuario = $1 AND usado_en IS NULL`,
        [user.id_usuario],
      );

      // Generar nuevo token con 24 horas de vigencia
      const tokenRaw = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(tokenRaw).digest('hex');
      const expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await cliente.query(
        `INSERT INTO sigd_auth.token_verificacion_correo
           (id_usuario, correo, token_hash, tipo, expira_en)
         VALUES ($1::uuid, $2, $3, 'ACTIVACION_CUENTA', $4)`,
        [user.id_usuario, user.correo, tokenHash, expiraEn],
      );

      const tokenCifrado = cifrarTokenPayload(tokenRaw);

      await insertarEvento(cliente, {
        agregado: 'cuenta_usuario',
        tipo_evento: 'verificacion_correo_solicitada',
        payload: {
          idUsuario: user.id_usuario,
          correo: user.correo,
          titular: user.titular,
          tokenCifrado,
          expiraEn: expiraEn.toISOString(),
          reenvio: true,
        },
      });

      await cliente.query(
        `INSERT INTO sigd_auth.auditoria_usuarios
           (correlation_id, id_usuario, operacion, detalle)
         VALUES ($1::uuid, $2::uuid, 'REENVIO_VERIFICACION_CORREO', $3::jsonb)`,
        [
          crypto.randomUUID(),
          user.id_usuario,
          JSON.stringify({
            correo: user.correo,
            ipAddress,
            fechaReenvio: new Date().toISOString(),
          }),
        ],
      );

      await cliente.query('COMMIT');
      transaccionAbierta = false;

      return {
        exito: true,
        mensaje: 'Se ha enviado un nuevo enlace de activación a su correo electrónico.',
        correo: user.correo,
      };
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  /**
   * Operación canónica, atómica e idempotente de apertura formal de la Casilla Electrónica
   * Institucional sobre el PoolClient compartido de la transacción activa.
   * Garantiza:
   * - Emisión del acto de apertura y notificación inaugural en sigd_auth.notificacion_casilla.
   * - Cálculo de hash SHA-256 y Código de Verificación Digital (CVD) canónico.
   * - Idempotencia estricta (reutiliza la apertura previa si ya existe, sin duplicar).
   * - Falla cerrada (fail-closed): si no se persiste la apertura, revierte toda la transacción.
   */
  private async abrirCasillaElectronicaEnTransaccion(
    cliente: PoolClient,
    params: {
      usuarioId: string;
      usuario: string;
      correo: string;
    },
  ): Promise<{ idCasilla: string; cvdCasilla: string; hashSha256: string }> {
    const existente = await cliente.query<{ id: string; cvd: string; hash_sha256: string }>(
      `SELECT id::text AS id, cvd, hash_sha256
         FROM sigd_auth.notificacion_casilla
        WHERE usuario_id = $1::uuid
          AND tipo_acto = 'Apertura de Casilla Electrónica'
        LIMIT 1
        FOR UPDATE`,
      [params.usuarioId],
    );
    if (existente.rows[0]?.id && existente.rows[0]?.cvd && existente.rows[0]?.hash_sha256) {
      return {
        idCasilla: existente.rows[0].id,
        cvdCasilla: existente.rows[0].cvd,
        hashSha256: existente.rows[0].hash_sha256,
      };
    }

    const cuerpoCasilla = {
      mensaje: 'Bienvenido al Sistema Integral de Gestión Documentaria del IESTP Público Suiza. Su Casilla Electrónica Institucional ha sido habilitada conforme al TUO de la Ley N° 27444. A través de este canal oficial se realizarán las notificaciones legales y administrativas de sus trámites con plena validez procesal.',
      tipo: 'APERTURA_CASILLA',
      fechaActivacion: new Date().toISOString(),
      usuario: params.usuario,
      correo: params.correo,
    };
    const hashCasilla = crypto.createHash('sha256').update(JSON.stringify(cuerpoCasilla)).digest('hex');
    const cvdCasilla = `CVD-CASILLA-${params.usuarioId.slice(0, 8).toUpperCase()}`;

    const insertada = await cliente.query<{ id: string; cvd: string; hash_sha256: string }>(
      `INSERT INTO sigd_auth.notificacion_casilla
         (usuario_id, correo_destinatario, cut, asunto, tipo_acto, numero_documento, cuerpo, referencia, estado, fecha_deposito, hash_sha256, cvd)
       SELECT $1::uuid, $2, NULL, 'Bienvenida a su Casilla Electrónica Institucional - IESTP Suiza', 'Apertura de Casilla Electrónica',
              'CASILLA-APERTURA-' || to_char(now(), 'YYYYMMDD'), $3::jsonb, 'Ley N° 27444 / TUO', 'NO_LEIDO', now(), $4, $5
        WHERE NOT EXISTS (
          SELECT 1 FROM sigd_auth.notificacion_casilla
           WHERE usuario_id = $1::uuid AND tipo_acto = 'Apertura de Casilla Electrónica'
        )
       RETURNING id::text AS id, cvd, hash_sha256`,
      [params.usuarioId, params.correo, JSON.stringify(cuerpoCasilla), hashCasilla, cvdCasilla],
    );

    const fila = insertada.rows[0];
    if (!fila?.id || !fila.cvd || !fila.hash_sha256) {
      throw new AppError({
        status: 503,
        code: 'CASILLA_OPENING_FAILED',
        message: 'No se pudo completar la apertura formal de la Casilla Electrónica Institucional.',
      });
    }

    return {
      idCasilla: fila.id,
      cvdCasilla: fila.cvd,
      hashSha256: fila.hash_sha256,
    };
  }

  async capacidadesRegistro(): Promise<{ domicilio: boolean; verificacionContacto: boolean }> {
    const tablas = ['persona', 'persona_natural', 'persona_juridica', 'cuenta_usuario', 'perfil_usuario', 'consentimiento_datos', 'auditoria_usuarios'];
    const resultado = await this.pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='sigd_auth' AND table_name=ANY($1::text[])`, [tablas]);
    const existentes = new Set(resultado.rows.map(r => r.table_name));
    if (tablas.some(t => !existentes.has(t))) throw new AppError({ status: 503, code: 'REGISTRO_MODELO_NO_COMPATIBLE', message: 'El registro no esta disponible temporalmente. No se ha creado ninguna cuenta.' });
    const perfil = new Set(resultado.rows.filter(r => r.table_name === 'perfil_usuario').map(r => r.column_name));
    return { domicilio: ['direccion','ubigeo_distrito','referencia'].every(c => perfil.has(c)), verificacionContacto: true };
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

function cumpleEdadMinima(fechaNacimiento: string, edadMinima: number): boolean {
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00.000Z`);
  if (Number.isNaN(nacimiento.getTime())) return false;
  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const cumpleEsteAnio = hoy.getUTCMonth() > nacimiento.getUTCMonth()
    || (hoy.getUTCMonth() === nacimiento.getUTCMonth() && hoy.getUTCDate() >= nacimiento.getUTCDate());
  if (!cumpleEsteAnio) edad -= 1;
  return edad >= edadMinima;
}
