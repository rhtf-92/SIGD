import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { ventanillaPresencialSchema } from '../../../../src/domains/tramicore/tramites.controller.js';
import { VentanillaPresencialService, type DatosRecepcionFisica } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';

// Datos exclusivamente unitarios: todas las operaciones se resuelven con dobles.
const datos: DatosRecepcionFisica = {
  tipoPersona: 'NATURAL', tipoDocumento: 'DNI', dniSolicitante: '12345678',
  nombres: ' Nombres del doble ', apellidos: ' Apellido compuesto ',
  correo: 'prueba@example.invalid', telefono: '000000000',
  asunto: 'Prueba unitaria de persona natural', foliosTotales: 1,
  tipoDocumentalId: randomUUID(),
};

function prepararDoble(opciones: { existente?: boolean; duplicado?: boolean; errorExtension?: Error; errorBase?: Error; sinUuid?: boolean } = {}) {
  const idPersona = randomUUID();
  const idExpediente = randomUUID();
  let busquedas = 0;
  const query = vi.fn(async (sql: string, _parametros?: unknown[]) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM sigd_doc.tipo_documento')) return { rows: [{ tipo_documental_id: datos.tipoDocumentalId }], rowCount: 1 };
    if (sql.includes('generar_cut_expediente')) return { rows: [{ cut: 'EXP-2026-000001' }], rowCount: 1 };
    if (sql.includes('FROM sigd_auth.persona p')) {
      busquedas++;
      return { rows: opciones.existente || opciones.duplicado && busquedas > 1 ? [{ id_persona: idPersona, id_persona_natural: idPersona, nombre_completo: 'Nombre ya registrado' }] : [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO sigd_auth.persona (')) {
      if (opciones.errorBase) throw opciones.errorBase;
      return { rows: opciones.duplicado || opciones.sinUuid ? [] : [{ id_persona: idPersona }], rowCount: opciones.duplicado ? 0 : 1 };
    }
    if (sql.includes('INSERT INTO sigd_auth.persona_natural')) {
      if (opciones.errorExtension) throw opciones.errorExtension;
      return { rows: [{ id_persona: idPersona }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO sigd_tra.expediente')) return { rows: [{ expediente_id: idExpediente }], rowCount: 1 };
    if (sql.includes('INSERT INTO sigd_tra.asiento_registro')) return { rows: [], rowCount: 1 };
    throw new Error('SQL no previsto por el doble de persona natural.');
  });
  const release = vi.fn();
  const cliente = { query, release } as unknown as PoolClient;
  const connect = vi.fn(async () => cliente);
  return { servicio: new VentanillaPresencialService({ connect } as unknown as Pool), query, connect, release, idPersona, idExpediente };
}

describe('Ventanilla · creación natural V2 sin PostgreSQL real', () => {
  it('crea base y extensión con el UUID devuelto, datos explícitos y nombre completo sin dividir apellidos', async () => {
    const doble = prepararDoble();
    const resultado = await doble.servicio.registrarExpedienteVentanilla(datos);
    const base = doble.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO sigd_auth.persona ('))!;
    expect(base[0]).toContain('(tipo, id_documento)');
    expect(base[0]).toContain('RETURNING id_persona');
    expect(base[0]).not.toContain('gen_random_uuid');
    expect(base[1]).toEqual(['NATURAL', datos.dniSolicitante]);
    const extension = doble.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO sigd_auth.persona_natural'))!;
    expect(extension[1]).toEqual([doble.idPersona, 'Nombres del doble', 'Apellido compuesto', 'Nombres del doble Apellido compuesto', datos.correo, datos.telefono]);
    expect(extension[0]).not.toMatch(/apellido_paterno|ubigeo|\bdni\b/);
    expect(resultado.cargo.remitente).toBe('Nombres del doble Apellido compuesto');
    expect(doble.query.mock.calls.some(([sql]) => /cuenta_usuario|password|UPDATE\s+sigd_auth/i.test(sql))).toBe(false);
    expect(doble.query).toHaveBeenCalledWith('COMMIT');
  });

  it('reutiliza la persona existente y su nombre registrado sin sobrescribir contactos ni nombres', async () => {
    const doble = prepararDoble({ existente: true });
    const resultado = await doble.servicio.registrarExpedienteVentanilla(datos);
    expect(resultado.cargo.remitente).toBe('Nombre ya registrado');
    expect(doble.query.mock.calls.some(([sql]) => /(?:INSERT INTO|UPDATE) sigd_auth/.test(sql))).toBe(false);
  });

  it('resuelve la carrera de unicidad releyendo la identidad sin duplicar la extensión', async () => {
    const doble = prepararDoble({ duplicado: true });
    const resultado = await doble.servicio.registrarExpedienteVentanilla(datos);
    expect(resultado.cargo.remitente).toBe('Nombre ya registrado');
    expect(doble.query.mock.calls.filter(([sql]) => sql.includes('FROM sigd_auth.persona p'))).toHaveLength(2);
    expect(doble.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO sigd_auth.persona_natural'))).toBe(false);
  });

  it.each(['errorBase', 'errorExtension'] as const)('propaga %s y revierte antes de registrar el expediente', async (operacion) => {
    const error = Object.assign(new Error('Error SQL del doble'), { code: '23505' });
    const doble = prepararDoble({ [operacion]: error });
    await expect(doble.servicio.registrarExpedienteVentanilla(datos)).rejects.toBe(error);
    expect(doble.query).toHaveBeenCalledWith('ROLLBACK');
    expect(doble.query.mock.calls.some(([sql]) => sql === 'COMMIT' || sql.includes('INSERT INTO sigd_tra'))).toBe(false);
    expect(doble.release).toHaveBeenCalledOnce();
  });

  it('aborta si PostgreSQL no devuelve el UUID generado y no lo sustituye', async () => {
    const doble = prepararDoble({ sinUuid: true });
    await expect(doble.servicio.registrarExpedienteVentanilla(datos)).rejects.toMatchObject({ code: 'IDENTITY_CREATION_FAILED' });
    expect(doble.query).toHaveBeenCalledWith('ROLLBACK');
    expect(doble.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO sigd_auth.persona_natural'))).toBe(false);
  });

  it.each([
    { nombres: '' }, { apellidos: ' ' }, { nombres: 'x'.repeat(121) }, { apellidos: 'x'.repeat(121) },
    { dniSolicitante: '1234567' }, { correo: 'sin-arroba' }, { telefono: 'x'.repeat(21) },
  ])('rechaza datos insuficientes o inválidos antes de adquirir conexión: %j', async (cambio) => {
    const doble = prepararDoble();
    await expect(doble.servicio.registrarExpedienteVentanilla({ ...datos, ...cambio })).rejects.toMatchObject({ status: 400 });
    expect(doble.connect).not.toHaveBeenCalled();
  });

  it('acepta apellidos explícitos sin exigir dos partes y respeta los límites V2', async () => {
    const doble = prepararDoble();
    await doble.servicio.registrarExpedienteVentanilla({ ...datos, nombres: 'n'.repeat(120), apellidos: 'a'.repeat(120), correo: undefined, telefono: undefined });
    const extension = doble.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO sigd_auth.persona_natural'))!;
    expect((extension[1]?.[3] as string).length).toBe(241);
    expect(extension[1]?.slice(4)).toEqual([null, null]);
  });

  it('el controlador acepta el request estructurado y rechaza modalidades o campos ajenos', () => {
    expect(ventanillaPresencialSchema.parse(datos)).toMatchObject({ nombres: 'Nombres del doble', apellidos: 'Apellido compuesto' });
    for (const cambio of [{ tipoPersona: 'JURIDICA' }, { tipoDocumento: 'CE' }, { tipoDocumento: 'RUC' }, { datosRemitente: 'Nombre ambiguo' }]) {
      expect(ventanillaPresencialSchema.safeParse({ ...datos, ...cambio }).success).toBe(false);
    }
    const { nombres: _nombres, ...sinNombres } = datos;
    const { apellidos: _apellidos, ...sinApellidos } = datos;
    expect(ventanillaPresencialSchema.safeParse(sinNombres).success).toBe(false);
    expect(ventanillaPresencialSchema.safeParse(sinApellidos).success).toBe(false);
  });
});
