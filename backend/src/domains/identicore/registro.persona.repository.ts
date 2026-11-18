import type { PoolClient } from 'pg';
import { ConflictError, ValidationError } from '../../shared/domain/errors/index.js';
import type { DatosRegistro, RepresentanteLegal } from './registro.types.js';

interface IdResult {
  id: string;
}

export async function insertarPersona(
  cliente: PoolClient,
  tipoDocumentoId: string,
  datos: DatosRegistro,
): Promise<string> {
  const resultado = await cliente.query<IdResult>(
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
  const personaId = resultado.rows[0]?.id;
  if (!personaId) throw new Error('La inserción de persona no devolvió su identificador.');
  return personaId;
}

export async function insertarExtensionPersona(
  cliente: PoolClient,
  personaId: string,
  datos: DatosRegistro,
): Promise<void> {
  if (datos.tipoPersona === 'NATURAL') {
    await insertarPersonaNatural(cliente, personaId, datos);
    return;
  }
  await insertarPersonaJuridica(cliente, personaId, datos);
}

async function insertarPersonaNatural(
  cliente: PoolClient,
  personaId: string,
  datos: DatosRegistro,
): Promise<void> {
  await cliente.query(
    `INSERT INTO sigd_auth.persona_natural
       (persona_id, numero_documento, nombres, apellido_paterno,
        apellido_materno, telefono, email_contacto)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [personaId, datos.numeroDocumento, datos.nombres, datos.apellidoPaterno,
      datos.apellidoMaterno, datos.celular, datos.correo],
  );
}

async function insertarPersonaJuridica(
  cliente: PoolClient,
  personaId: string,
  datos: DatosRegistro,
): Promise<void> {
  const documentoRepresentante = datos.documentoRepresentante;
  const nombreRepresentante = datos.nombreRepresentante;
  if (!datos.razonSocial || !datos.nombreComercial || !documentoRepresentante || !nombreRepresentante) {
    throw new Error('Faltan los datos de identificación de la persona jurídica.');
  }

  const representante = await buscarRepresentante(cliente, documentoRepresentante);
  validarNombreRepresentante(representante, nombreRepresentante);
  const personaJuridicaId = await guardarPersonaJuridica(cliente, personaId, datos);
  await cliente.query(
    `INSERT INTO sigd_auth.representacion_legal
       (persona_natural_id, persona_juridica_id, vigencia_inicio, activo)
     VALUES ($1, $2, CURRENT_DATE, TRUE)`,
    [representante.id, personaJuridicaId],
  );
}

async function buscarRepresentante(cliente: PoolClient, dni: string): Promise<RepresentanteLegal> {
  const resultado = await cliente.query<RepresentanteLegal>(
    `SELECT pn.id::text AS id, p.nombres, p.apellido_paterno, p.apellido_materno
       FROM sigd_auth.persona_natural pn
       JOIN sigd_auth.persona p ON p.id = pn.persona_id
       JOIN sigd_auth.tipos_documento td ON td.id = p.tipo_documento_id
      WHERE pn.numero_documento = $1 AND td.codigo = 'DNI'
        AND p.tipo_persona = 'NATURAL' AND p.estado = TRUE AND pn.estado = TRUE
      FOR SHARE OF pn, p`,
    [dni],
  );
  const representante = resultado.rows[0];
  if (!representante) {
    throw new ConflictError({
      code: 'REPRESENTANTE_NO_REGISTRADO',
      message: 'El representante legal debe estar previamente registrado como persona natural.',
    });
  }
  return representante;
}

function validarNombreRepresentante(representante: RepresentanteLegal, nombre: string): void {
  const nombreRegistrado = [representante.nombres, representante.apellido_paterno,
    representante.apellido_materno].filter(Boolean).join(' ');
  if (normalizarNombre(nombreRegistrado) !== normalizarNombre(nombre)) {
    throw new ValidationError({
      invalidParams: [{ name: 'nombreRepresentante', reason: 'El nombre no coincide con el DNI del representante.' }],
    });
  }
}

async function guardarPersonaJuridica(
  cliente: PoolClient,
  personaId: string,
  datos: DatosRegistro,
): Promise<string> {
  const resultado = await cliente.query<IdResult>(
    `INSERT INTO sigd_auth.persona_juridica
       (persona_id, razon_social, nombre_comercial, partida_registral_sunarp)
     VALUES ($1, $2, $3, $4) RETURNING id::text AS id`,
    [personaId, datos.razonSocial, datos.nombreComercial, datos.partidaRegistral],
  );
  const id = resultado.rows[0]?.id;
  if (!id) throw new Error('La inserción de persona jurídica no devolvió su identificador.');
  return id;
}

function normalizarNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}