import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { VentanillaPresencialService, type DatosRecepcionFisica } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';

// MT47: exclusivamente dobles; no se abre una conexión real ni se crea un catálogo.
const datos: DatosRecepcionFisica = {
  tipoPersona: 'NATURAL', tipoDocumento: 'DNI', dniSolicitante: '12345678',
  nombres: 'Persona', apellidos: 'del doble',
  asunto: 'Prueba unitaria de integridad documental', foliosTotales: 2,
  tipoDocumentalId: randomUUID(),
};

function prepararDoble(opciones: { tipoVigente?: boolean; errorCatalogo?: Error } = {}) {
  const idPersona = randomUUID();
  let correlativo = 0;
  const query = vi.fn(async (sql: string, parametros?: unknown[]) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM sigd_doc.tipo_documento')) {
      if (opciones.errorCatalogo) throw opciones.errorCatalogo;
      return { rows: opciones.tipoVigente === false ? [] : [{ tipo_documental_id: parametros?.[0] }], rowCount: opciones.tipoVigente === false ? 0 : 1 };
    }
    if (sql.includes('generar_cut_expediente')) return { rows: [{ cut: `EXP-2026-${String(++correlativo).padStart(6, '0')}` }], rowCount: 1 };
    if (sql.includes('FROM sigd_auth.persona p')) return { rows: [{ id_persona: idPersona, id_persona_natural: idPersona, nombre_completo: 'Nombre registrado del doble' }], rowCount: 1 };
    if (sql.includes('INSERT INTO sigd_tra.expediente')) return { rows: [{ expediente_id: randomUUID() }], rowCount: 1 };
    if (sql.includes('INSERT INTO sigd_tra.asiento_registro')) return { rows: [], rowCount: 1 };
    throw new Error('SQL no previsto por el doble de integridad documental.');
  });
  const release = vi.fn();
  const cliente = { query, release } as unknown as PoolClient;
  const connect = vi.fn(async () => cliente);
  const servicio = new VentanillaPresencialService({ connect } as unknown as Pool);
  return { servicio, cliente, query, release, connect, idPersona };
}

function comprobarSinEscrituras(doble: ReturnType<typeof prepararDoble>) {
  expect(doble.query.mock.calls.some(([sql]) => /\b(?:INSERT|UPDATE|DELETE)\b|generar_cut_expediente/i.test(sql))).toBe(false);
  expect(doble.query).not.toHaveBeenCalledWith('COMMIT');
}

describe('Ventanilla · integridad documental V2', () => {
  it.each([undefined, null, '', 'SOLICITUD', 'uuid-invalido'])('rechaza tipoDocumentalId %j antes de adquirir conexión', async (tipoDocumentalId) => {
    const doble = prepararDoble();
    // null simula un llamador JavaScript que no respeta los tipos TypeScript.
    await expect(doble.servicio.registrarExpedienteVentanilla({ ...datos, tipoDocumentalId } as DatosRecepcionFisica)).rejects.toMatchObject({
      status: 400, code: 'VALIDATION_ERROR', invalidParams: [{ name: 'tipoDocumentalId', reason: expect.stringContaining('catálogo') }],
    });
    expect(doble.connect).not.toHaveBeenCalled();
    expect(doble.query).not.toHaveBeenCalled();
  });

  it('rechaza un UUID sin coincidencia vigente antes del CUT y de toda escritura', async () => {
    const doble = prepararDoble({ tipoVigente: false });
    await expect(doble.servicio.registrarExpedienteVentanilla(datos)).rejects.toMatchObject({
      status: 400, invalidParams: [{ name: 'tipoDocumentalId', reason: expect.stringContaining('no existe o no está vigente') }],
    });
    const catalogo = doble.query.mock.calls.find(([sql]) => sql.includes('FROM sigd_doc.tipo_documento'))!;
    expect(catalogo[0]).toContain('tipo_documental_id = $1::uuid AND vigente = TRUE');
    expect(catalogo[1]).toEqual([datos.tipoDocumentalId]);
    comprobarSinEscrituras(doble);
    expect(doble.query).toHaveBeenCalledWith('ROLLBACK');
    expect(doble.release).toHaveBeenCalledOnce();
  });

  it('propaga un fallo del catálogo y revierte sin intentar sustituciones documentales', async () => {
    const errorCatalogo = new Error('Error SQL del catálogo del doble');
    const doble = prepararDoble({ errorCatalogo });
    await expect(doble.servicio.registrarExpedienteVentanilla(datos)).rejects.toBe(errorCatalogo);
    comprobarSinEscrituras(doble);
    expect(doble.query).toHaveBeenCalledWith('ROLLBACK');
    expect(doble.release).toHaveBeenCalledOnce();
  });

  it('rechaza el tipo no vigente con conexión externa y deja la transacción al llamador', async () => {
    const doble = prepararDoble({ tipoVigente: false });
    await expect(doble.servicio.registrarExpedienteVentanilla(datos, doble.cliente)).rejects.toMatchObject({ status: 400 });
    comprobarSinEscrituras(doble);
    expect(doble.query.mock.calls.some(([sql]) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql))).toBe(false);
    expect(doble.connect).not.toHaveBeenCalled();
    expect(doble.release).not.toHaveBeenCalled();
  });

  it('registra el UUID documental validado y reutiliza la identidad sin sobrescribirla', async () => {
    const doble = prepararDoble();
    const resultado = await doble.servicio.registrarExpedienteVentanilla(datos);
    const llamadas = doble.query.mock.calls;
    const indiceCatalogo = llamadas.findIndex(([sql]) => sql.includes('FROM sigd_doc.tipo_documento'));
    expect(indiceCatalogo).toBeLessThan(llamadas.findIndex(([sql]) => sql.includes('generar_cut_expediente')));
    const expediente = llamadas.find(([sql]) => sql.includes('INSERT INTO sigd_tra.expediente'))!;
    expect(expediente[0]).not.toContain('COALESCE');
    expect(expediente[1]?.[2]).toBe(datos.tipoDocumentalId);
    expect(expediente[1]?.[3]).toBe(doble.idPersona);
    const asiento = llamadas.find(([sql]) => sql.includes('INSERT INTO sigd_tra.asiento_registro'))!;
    expect(asiento[1]?.[3]).toBe(doble.idPersona);
    expect(resultado.cargo.remitente).toBe('Nombre registrado del doble');
    expect(llamadas.some(([sql]) => /(?:INSERT INTO|UPDATE) sigd_(?:auth|doc)\./.test(sql))).toBe(false);
    expect(doble.query).toHaveBeenCalledWith('COMMIT');
  });

  it('expone el riesgo de doble envío: dos solicitudes iguales generan expedientes distintos para la misma persona', async () => {
    const doble = prepararDoble();
    const primero = await doble.servicio.registrarExpedienteVentanilla(datos);
    const segundo = await doble.servicio.registrarExpedienteVentanilla(datos);
    expect(primero.expedienteId).not.toBe(segundo.expedienteId);
    expect(primero.cut).not.toBe(segundo.cut);
    expect(doble.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO sigd_tra.expediente'))).toHaveLength(2);
    // La identidad única no implica expediente único por DNI. El request actual
    // no distingue un reintento accidental de dos trámites legítimos iguales.
    expect(doble.query.mock.calls.some(([sql]) => /(?:INSERT INTO|UPDATE) sigd_auth\./.test(sql))).toBe(false);
  });
});

function diferido() {
  let resolver!: () => void;
  const promesa = new Promise<void>((resolve) => { resolver = resolve; });
  return { promesa, resolver };
}

describe('Ventanilla · carrera de identidad modelada con dos clientes', () => {
  it('relee la identidad comprometida tras ON CONFLICT sin crear otra extensión ni actualizar datos', async () => {
    // Modela READ COMMITTED y el conflicto de identidad; no prueba los bloqueos
    // reales del motor ni el bloqueo anual previo de la función del CUT.
    const idPersona = randomUUID();
    const ambasBusquedas = diferido();
    const identidadComprometida = diferido();
    let busquedasIniciales = 0;
    let ganador: number | undefined;
    let nombreRegistrado = '';

    const clientes = [0, 1].map((indice) => {
      let busquedas = 0;
      const query = vi.fn(async (sql: string, parametros?: unknown[]) => {
        if (sql === 'COMMIT') {
          if (ganador === indice) identidadComprometida.resolver();
          return { rows: [], rowCount: 0 };
        }
        if (['BEGIN', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
        if (sql.includes('FROM sigd_doc.tipo_documento')) return { rows: [{ tipo_documental_id: datos.tipoDocumentalId }], rowCount: 1 };
        if (sql.includes('generar_cut_expediente')) return { rows: [{ cut: `EXP-2026-00000${indice + 1}` }], rowCount: 1 };
        if (sql.includes('FROM sigd_auth.persona p')) {
          if (++busquedas === 1) {
            if (++busquedasIniciales === 2) ambasBusquedas.resolver();
            await ambasBusquedas.promesa;
            return { rows: [], rowCount: 0 };
          }
          await identidadComprometida.promesa;
          return { rows: [{ id_persona: idPersona, id_persona_natural: idPersona, nombre_completo: nombreRegistrado }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO sigd_auth.persona (')) {
          expect(sql).toContain('ON CONFLICT (tipo, id_documento) DO NOTHING');
          expect(parametros).toEqual(['NATURAL', datos.dniSolicitante]);
          if (ganador === undefined) {
            ganador = indice;
            return { rows: [{ id_persona: idPersona }], rowCount: 1 };
          }
          await identidadComprometida.promesa;
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('INSERT INTO sigd_auth.persona_natural')) {
          nombreRegistrado = parametros?.[3] as string;
          return { rows: [{ id_persona: idPersona }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO sigd_tra.expediente')) return { rows: [{ expediente_id: randomUUID() }], rowCount: 1 };
        if (sql.includes('INSERT INTO sigd_tra.asiento_registro')) return { rows: [], rowCount: 1 };
        throw new Error('SQL no previsto por los dobles concurrentes.');
      });
      const release = vi.fn();
      const cliente = { query, release } as unknown as PoolClient;
      const servicio = new VentanillaPresencialService({ connect: vi.fn(async () => cliente) } as unknown as Pool);
      return { servicio, query, release };
    });

    const resultados = await Promise.all(clientes.map(({ servicio }, indice) => servicio.registrarExpedienteVentanilla({ ...datos, nombres: `Persona ${indice}` })));
    const llamadas = clientes.flatMap(({ query }) => query.mock.calls);
    expect(llamadas.filter(([sql]) => sql.includes('INSERT INTO sigd_auth.persona_natural'))).toHaveLength(1);
    expect(llamadas.filter(([sql]) => sql.includes('FROM sigd_auth.persona p'))).toHaveLength(3);
    expect(llamadas.some(([sql]) => /UPDATE\s+sigd_auth/.test(sql))).toBe(false);
    for (const [sql, parametros] of llamadas.filter(([sql]) => sql.includes('INSERT INTO sigd_tra.expediente'))) {
      expect(parametros?.[3]).toBe(idPersona);
    }
    for (const resultado of resultados) expect(resultado.cargo.remitente).toBe(nombreRegistrado);
    expect(resultados[0].expedienteId).not.toBe(resultados[1].expedienteId);
    for (const cliente of clientes) {
      expect(cliente.query).toHaveBeenCalledWith('COMMIT');
      expect(cliente.release).toHaveBeenCalledOnce();
    }
  });
});
