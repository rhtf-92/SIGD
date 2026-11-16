import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { VentanillaPresencialService, type DatosRecepcionFisica } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';

// Todos los UUID y resultados SQL pertenecen a dobles; no hay conexiones reales.
function prepararDoble(errorAsiento?: Error) {
  const idPersona = randomUUID();
  const idExpediente = randomUUID();
  const datos: DatosRecepcionFisica = {
    tipoPersona: 'NATURAL',
    tipoDocumento: 'DNI',
    dniSolicitante: '12345678',
    nombres: 'Persona',
    apellidos: 'del doble',
    asunto: 'Prueba aislada del asiento presencial V2',
    foliosTotales: 3,
    areaDestinoId: randomUUID(),
    tipoDocumentalId: randomUUID(),
  };
  const query = vi.fn(async (sql: string, parametros?: unknown[]) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM sigd_doc.tipo_documento')) return { rows: [{ tipo_documental_id: datos.tipoDocumentalId }], rowCount: 1 };
    if (sql.includes('generar_cut_expediente')) {
      return { rows: [{ cut: `EXP-${parametros?.[0]}-000001` }], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_auth.persona p')) {
      return { rows: [{ id_persona: idPersona, id_persona_natural: idPersona, nombre_completo: 'Persona del doble' }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO sigd_tra.expediente')) {
      return { rows: [{ expediente_id: idExpediente }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO sigd_tra.asiento_registro')) {
      if (errorAsiento) throw errorAsiento;
      return { rows: [], rowCount: 1 };
    }
    throw new Error('Consulta no contemplada por el doble de asiento V2.');
  });
  const release = vi.fn();
  const cliente = { query, release } as unknown as PoolClient;
  const connect = vi.fn(async () => cliente);
  const servicio = new VentanillaPresencialService({ connect } as unknown as Pool);
  return { servicio, cliente, connect, query, release, datos, idPersona, idExpediente };
}

type Doble = ReturnType<typeof prepararDoble>;

function obtenerAsiento(doble: Doble) {
  const llamadas = doble.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO sigd_tra.asiento_registro'));
  expect(llamadas).toHaveLength(1);
  return llamadas[0];
}

describe('Ventanilla activa · asiento de registro PostgreSQL V2', () => {
  it('utiliza columnas V2, UUID devueltos por el doble y la numeración predeterminada', async () => {
    const doble = prepararDoble();
    const resultado = await doble.servicio.registrarExpedienteVentanilla(doble.datos);
    const [sql, parametros] = obtenerAsiento(doble);
    const ddl = readFileSync(new URL('../../../../migraciones_v2/05_sigd_tra.sql', import.meta.url), 'utf8');
    const definicion = ddl.match(/CREATE TABLE IF NOT EXISTS sigd_tra\.asiento_registro \(([\s\S]*?)\r?\n\);/)?.[1];
    expect(definicion).toBeDefined();
    const columnasExistentes = Array.from(definicion!.matchAll(/^\s*(\w+)\s+(?:UUID|BIGINT|TIMESTAMPTZ|VARCHAR|BOOLEAN|TEXT)\b/gm), ([, columna]) => columna);
    const columnasInsertadas = sql.match(/asiento_registro\s*\(([\s\S]*?)\)\s*VALUES/)![1].split(',').map((columna) => columna.trim());
    for (const columna of columnasInsertadas) expect(columnasExistentes).toContain(columna);
    expect(columnasInsertadas).toEqual(['expediente_id', 'fecha_ingreso', 'canal_ingreso', 'asunto', 'remitente_id']);
    expect(definicion).toContain("DEFAULT nextval('sigd_tra.seq_asiento_numero_registro')");
    expect(sql).not.toMatch(/\b(?:id_asiento|numero_registro|numero_asiento|anio_fiscal|cut|folios|destinatario_id|ON CONFLICT)\b/);
    expect(sql).toContain("'MESA_PRESENCIAL'");
    expect(parametros).toEqual([doble.idExpediente, expect.any(Date), doble.datos.asunto, doble.idPersona]);
    expect(resultado.expedienteId).toBe(doble.idExpediente);
    expect(resultado.cut).toMatch(/^EXP-\d{4}-000001$/);
    expect(doble.query.mock.calls.filter(([consulta]) => consulta.includes('generar_cut_expediente'))).toHaveLength(1);
  });

  it('registra expediente y asiento con la misma conexión y fecha antes del COMMIT', async () => {
    const doble = prepararDoble();
    const resultado = await doble.servicio.registrarExpedienteVentanilla(doble.datos);
    const expediente = doble.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO sigd_tra.expediente'))!;
    const [sqlAsiento, parametros] = obtenerAsiento(doble);
    expect(parametros?.[1]).toBe(expediente[1]?.[5]);
    expect((parametros?.[1] as Date).toISOString()).toBe(resultado.fechaRadicacion);
    const consultas = doble.query.mock.calls.map(([sql]) => sql);
    expect(consultas.indexOf(sqlAsiento)).toBeGreaterThan(consultas.indexOf(expediente[0]));
    expect(consultas.indexOf('COMMIT')).toBeGreaterThan(consultas.indexOf(sqlAsiento));
    expect(consultas).not.toContain('ROLLBACK');
    expect(doble.connect).toHaveBeenCalledOnce();
    expect(doble.release).toHaveBeenCalledOnce();
  });

  it.each(['23503', '23514', '23505'])('propaga el error SQL %s del asiento y revierte la transacción propia', async (code) => {
    const errorAsiento = Object.assign(new Error('Error SQL sintético del asiento'), { code });
    const doble = prepararDoble(errorAsiento);

    await expect(doble.servicio.registrarExpedienteVentanilla(doble.datos)).rejects.toBe(errorAsiento);

    obtenerAsiento(doble);
    expect(doble.query).toHaveBeenCalledWith('ROLLBACK');
    expect(doble.query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
    expect(doble.release).toHaveBeenCalledOnce();
  });

  it('deja el COMMIT y la liberación de una conexión externa bajo control del llamador', async () => {
    const doble = prepararDoble();
    await doble.servicio.registrarExpedienteVentanilla(doble.datos, doble.cliente);

    obtenerAsiento(doble);
    expect(doble.connect).not.toHaveBeenCalled();
    expect(doble.query.mock.calls.some(([sql]) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql))).toBe(false);
    expect(doble.release).not.toHaveBeenCalled();
  });

  it('propaga el fallo del asiento con conexión externa sin cerrar la transacción del llamador', async () => {
    const errorAsiento = new Error('Error sintético en transacción externa');
    const doble = prepararDoble(errorAsiento);

    await expect(doble.servicio.registrarExpedienteVentanilla(doble.datos, doble.cliente)).rejects.toBe(errorAsiento);

    obtenerAsiento(doble);
    expect(doble.query.mock.calls.some(([sql]) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql))).toBe(false);
    expect(doble.connect).not.toHaveBeenCalled();
    expect(doble.release).not.toHaveBeenCalled();
  });
});
