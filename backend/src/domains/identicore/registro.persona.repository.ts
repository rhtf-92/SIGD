import type { PoolClient } from 'pg';
import { ConflictError, ValidationError } from '../../shared/domain/errors/index.js';
import type { DatosRegistro, RepresentanteLegal } from './registro.types.js';

interface IdResult {
  id: string;
}

export async function insertarPersona(
  cliente: PoolClient,
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
  const apellidos = [datos.apellidoPaterno, datos.apellidoMaterno]
    .filter((apellido): apellido is string => Boolean(apellido))
    .join(' ');
  await cliente.query(
    `INSERT INTO sigd_auth.persona_natural
       (id_persona, nombres, apellidos, nombre_completo, telefono, correo)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [personaId, datos.nombres, apellidos, `${datos.nombres} ${apellidos}`.trim(), datos.celular, datos.correo],
  );
}

async function insertarPersonaJuridica(
  cliente: PoolClient,
  personaId: string,
  datos: DatosRegistro,
): Promise<void> {
  if (!datos.razonSocial || !datos.nombreComercial) {
    throw new Error('Faltan los datos de identificación de la persona jurídica.');
  }
  const resultado = await cliente.query<IdResult>(
    `INSERT INTO sigd_auth.persona_juridica
       (id_persona, razon_social, nombre_comercial, direccion)
     VALUES ($1, $2, $3, $4)
     RETURNING id_persona::text AS id`,
    [personaId, datos.razonSocial, datos.nombreComercial, datos.direccion],
  );
  const personaJuridicaId = resultado.rows[0]?.id;
  if (!personaJuridicaId) throw new Error('La inserción de persona jurídica no devolvió su identificador.');

  const documentoRepresentante = datos.documentoRepresentante;
  const nombreRepresentante = datos.nombreRepresentante;
  if (documentoRepresentante && nombreRepresentante) {
    const representante = await buscarRepresentante(cliente, documentoRepresentante);
    validarNombreRepresentante(representante, nombreRepresentante);
    await cliente.query(
      `INSERT INTO sigd_auth.representacion_legal
         (id_persona_juridica, id_persona_natural, cargo, vigente_desde)
       VALUES ($1, $2, 'REPRESENTANTE LEGAL', CURRENT_DATE)`,
      [personaJuridicaId, representante.id],
    );
  }
}

async function buscarRepresentante(cliente: PoolClient, dni: string): Promise<RepresentanteLegal> {
  const resultado = await cliente.query<{ id: string; nombres: string; apellidos: string }>(
    `SELECT pn.id_persona::text AS id, pn.nombres, pn.apellidos
       FROM sigd_auth.persona_natural pn
       JOIN sigd_auth.persona p ON p.id_persona = pn.id_persona
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
  const partesApellido = (representante.apellidos ?? '').split(' ');
  return {
    id: representante.id,
    nombres: representante.nombres,
    apellido_paterno: partesApellido[0] ?? null,
    apellido_materno: partesApellido.slice(1).join(' ') || null,
  };
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

function normalizarNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}
