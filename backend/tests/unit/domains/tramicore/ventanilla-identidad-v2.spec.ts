import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { VentanillaPresencialService, type DatosRecepcionFisica } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';
import { ValidationError } from '../../../../src/shared/domain/errors/index.js';

// Estos dobles no abren conexiones ni registran identidades en PostgreSQL.
const datos: DatosRecepcionFisica = {
  tipoPersona: 'NATURAL',
  tipoDocumento: 'DNI',
  dniSolicitante: '12345678',
  nombres: 'Persona',
  apellidos: 'del doble',
  asunto: 'Prueba unitaria de resolución de identidad',
  foliosTotales: 1,
  tipoDocumentalId: randomUUID(),
};

type Identidad = { id_persona: string; id_persona_natural: string | null };

function prepararDoble(identidades: Identidad[], errorConsulta?: Error) {
  const siguienteOperacion = new Error('Límite del doble: no probar registro de expediente ni asiento.');
  const query = vi.fn(async (sql: string, _parametros?: unknown[]) => {
    if (['BEGIN', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM sigd_doc.tipo_documento')) return { rows: [{ tipo_documental_id: datos.tipoDocumentalId }], rowCount: 1 };
    if (sql.includes('generar_cut_expediente')) return { rows: [{ cut: 'EXP-2026-000001' }], rowCount: 1 };
    if (sql.includes('FROM sigd_auth.persona p')) {
      if (errorConsulta) throw errorConsulta;
      return { rows: identidades.map((identidad) => ({ ...identidad, nombre_completo: 'Persona del doble' })), rowCount: identidades.length };
    }
    // El doble falla ante cualquier escritura posterior, en vez de simular éxito.
    throw siguienteOperacion;
  });
  const release = vi.fn();
  const cliente = { query, release } as unknown as PoolClient;
  const connect = vi.fn(async () => cliente);
  const pool = { connect } as unknown as Pool;
  const servicio = new VentanillaPresencialService(pool);
  return { servicio, cliente, query, release, connect, siguienteOperacion };
}

function consultasIdentidad(query: ReturnType<typeof prepararDoble>['query']) {
  return query.mock.calls.filter(([sql]) => sql.includes('sigd_auth.persona'));
}

function comprobarAusenciaDeEscrituras(query: ReturnType<typeof prepararDoble>['query']) {
  expect(query.mock.calls.some(([sql]) => /\b(?:INSERT|UPDATE|DELETE)\b/i.test(sql))).toBe(false);
  expect(query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
}

describe('Ventanilla activa · contrato de identidad PostgreSQL V2', () => {
  it('busca por tipo e identificador documental y reutiliza el UUID existente', async () => {
    const idPersona = randomUUID();
    const doble = prepararDoble([{ id_persona: idPersona, id_persona_natural: idPersona }]);

    await expect(doble.servicio.registrarExpedienteVentanilla(datos)).rejects.toBe(doble.siguienteOperacion);

    const [[sql, parametros]] = consultasIdentidad(doble.query);
    expect(sql).toContain('FROM sigd_auth.persona p');
    expect(sql).toContain('pn.id_persona = p.id_persona');
    expect(sql).toContain('p.tipo = $1 AND p.id_documento = $2');
    expect(sql).not.toMatch(/\b(?:dni|tipo_persona|apellido_paterno|ubigeo_distrito)\b/);
    expect(parametros).toEqual(['NATURAL', datos.dniSolicitante]);
    expect(consultasIdentidad(doble.query)).toHaveLength(1);
    const expediente = doble.query.mock.calls.find(([consulta]) => consulta.includes('INSERT INTO sigd_tra.expediente'));
    expect(expediente?.[1]?.[3]).toBe(idPersona);
    expect(doble.query).toHaveBeenCalledWith('ROLLBACK');
    expect(doble.release).toHaveBeenCalledOnce();
  });

  it('rechaza crear una persona sin apellidos explícitos antes de iniciar la transacción', async () => {
    const doble = prepararDoble([]);

    await expect(doble.servicio.registrarExpedienteVentanilla({ ...datos, apellidos: '' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      invalidParams: [{
        name: 'apellidos',
        reason: expect.stringContaining('apellidos'),
      }],
    });

    comprobarAusenciaDeEscrituras(doble.query);
    expect(doble.connect).not.toHaveBeenCalled();
    expect(doble.query).not.toHaveBeenCalled();
    expect(doble.release).not.toHaveBeenCalled();
  });

  it('rechaza una persona base sin extensión natural y no intenta completarla con valores ficticios', async () => {
    const doble = prepararDoble([{ id_persona: randomUUID(), id_persona_natural: null }]);

    await expect(doble.servicio.registrarExpedienteVentanilla(datos)).rejects.toMatchObject({
      status: 400,
      invalidParams: [{ name: 'dniSolicitante', reason: expect.stringContaining('persona_natural') }],
    });

    comprobarAusenciaDeEscrituras(doble.query);
    expect(doble.query).toHaveBeenCalledWith('ROLLBACK');
    expect(doble.release).toHaveBeenCalledOnce();
  });

  it('propaga un fallo SQL de identidad sin realizar inserciones alternativas', async () => {
    const errorConsulta = new Error('Error SQL sintético del doble de identidad');
    const doble = prepararDoble([], errorConsulta);

    await expect(doble.servicio.registrarExpedienteVentanilla(datos)).rejects.toBe(errorConsulta);

    comprobarAusenciaDeEscrituras(doble.query);
    expect(doble.query).toHaveBeenCalledWith('ROLLBACK');
    expect(doble.release).toHaveBeenCalledOnce();
  });

  it('deja la transacción y la conexión suministradas bajo control del llamador', async () => {
    const doble = prepararDoble([{ id_persona: randomUUID(), id_persona_natural: null }]);

    await expect(doble.servicio.registrarExpedienteVentanilla(datos, doble.cliente)).rejects.toBeInstanceOf(ValidationError);

    comprobarAusenciaDeEscrituras(doble.query);
    expect(doble.connect).not.toHaveBeenCalled();
    expect(doble.query.mock.calls.some(([sql]) => ['BEGIN', 'ROLLBACK'].includes(sql))).toBe(false);
    expect(doble.release).not.toHaveBeenCalled();
  });

  it.each(['', '1234567', '123456789', 'ABCDEFGH'])('rechaza el DNI inválido %j antes de adquirir una conexión', async (dniSolicitante) => {
    const doble = prepararDoble([]);

    await expect(doble.servicio.registrarExpedienteVentanilla({ ...datos, dniSolicitante })).rejects.toBeInstanceOf(ValidationError);

    expect(doble.connect).not.toHaveBeenCalled();
    expect(doble.query).not.toHaveBeenCalled();
  });
});
