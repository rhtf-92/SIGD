import type { PoolClient } from 'pg';
import { ConflictError, ValidationError } from '../../shared/domain/errors/index.js';
import type { DatosRegistro, RepresentanteLegal } from './registro.types.js';

interface IdResult {
  id: string;
}

export async function insertarPersona(
  cliente: PoolClient,
  _tipoDocumentoId: string,
  datos: DatosRegistro,
): Promise<string> {
  const resultado = await cliente.query<IdResult>(
    `INSERT INTO sigd_auth.persona
       (tipo, id_documento)
     VALUES ($1, $2)
     RETURNING id_persona::text AS id`,
    [datos.tipoPersona, datos.numeroDocumento],
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
  const apellidos = [datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ') || datos.apellidoPaterno || '';
  const nombreCompleto = [datos.nombres, apellidos].filter(Boolean).join(' ');
  await cliente.query(
    `INSERT INTO sigd_auth.persona_natural
       (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [personaId, datos.nombres, apellidos, nombreCompleto, datos.correo, datos.celular],
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
       (id_persona_juridica, id_persona_natural, cargo, vigente_desde)
     VALUES ($1, $2, 'Representante Legal', CURRENT_DATE)`,
    [personaJuridicaId, representante.id],
  );
}

async function buscarRepresentante(cliente: PoolClient, dni: string): Promise<RepresentanteLegal> {
  const resultado = await cliente.query<RepresentanteLegal>(
    `SELECT p.id_persona::text AS id, pn.nombres, pn.apellidos
       FROM sigd_auth.persona p
       JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
      WHERE p.id_documento = $1 AND p.tipo = 'NATURAL'
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
  const nombreRegistrado = [representante.nombres, representante.apellido_paterno]
    .filter(Boolean)
    .join(' ');
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
       (id_persona, razon_social, nombre_comercial, representante_legal, direccion)
     VALUES ($1, $2, $3, $4, $5) RETURNING id_persona::text AS id`,
    [personaId, datos.razonSocial, datos.nombreComercial, datos.nombreRepresentante, datos.direccion],
  );
  const id = resultado.rows[0]?.id;
  if (!id) throw new Error('La inserción de persona jurídica no devolvió su identificador.');
  return id;
}

function normalizarNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}