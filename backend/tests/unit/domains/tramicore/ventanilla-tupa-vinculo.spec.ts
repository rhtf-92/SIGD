import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { VentanillaPresencialService, type DatosRecepcionFisica } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';
import { ventanillaPresencialSchema } from '../../../../src/domains/tramicore/tramites.controller.js';

// Exclusivamente dobles de contrato, sin PostgreSQL ni consumo de correlativos.
const tupa = '10000000-0000-4000-8000-000000000001';
const expediente = '20000000-0000-4000-8000-000000000001';
const persona = '30000000-0000-4000-8000-000000000001';
const tipo = '40000000-0000-4000-8000-000000000001';
function preparar(modo = 'vigente', falla = '') {
  const datos: DatosRecepcionFisica = { tipoPersona: 'NATURAL', tipoDocumento: 'DNI', dniSolicitante: '99000002',
    nombres: 'Persona', apellidos: 'del doble', asunto: 'Solicitud formal sin depender de su texto',
    foliosTotales: 1, tipoDocumentalId: tipo, idTipoTramiteTupa: tupa };
  const error = Object.assign(new Error('Fallo controlado de persistencia'), { code: '23505' });
  const query = vi.fn(async (sql: string, p: unknown[] = []) => {
    if (falla && sql.includes(falla)) throw error;
    if (sql.includes('FROM sigd_doc.tipo_documento')) return { rows: [{ tipo_documental_id: tipo }], rowCount: 1 };
    if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) return { rows: modo === 'ausente' ? [] : [{
      tipo_tramite_id: tupa, codigo: 'SUZ26-054', vigente: modo !== 'inactivo', tipo_documental_permitido: modo !== 'incompatible',
    }], rowCount: modo === 'ausente' ? 0 : 1 };
    if (sql.includes('generar_cut_expediente')) return { rows: [{ cut: 'EXP-2026-000001' }], rowCount: 1 };
    if (sql.includes('FROM sigd_auth.persona p')) return { rows: [{ id_persona: persona, id_persona_natural: persona, nombre_completo: 'Persona del doble' }], rowCount: 1 };
    if (sql.includes('INSERT INTO sigd_tra.expediente')) return { rows: [{ expediente_id: expediente }], rowCount: 1 };
    if (sql.includes('INSERT INTO sigd_doc.expediente')) return { rows: [{
      expediente_id: modo === 'identidad_contradictoria' ? persona : p[0], tipo_tramite_id: p[1], codigo_expediente: p[2], solicitante_id: p[4],
    }], rowCount: 1 };
    if (sql.includes('INSERT INTO sigd_tra.tramite')) return { rows: [{ expediente_id: p[0], codigo_tramite: modo === 'codigo_contradictorio' ? 'SUZ26-035' : p[1] }], rowCount: 1 };
    return { rows: [], rowCount: sql.includes('INSERT INTO sigd_tra.asiento_registro') ? 1 : 0 };
  });
  const release = vi.fn(); const cliente = { query, release } as unknown as PoolClient;
  const connect = vi.fn(async () => cliente);
  return { datos, query, release, connect, cliente, error, service: new VentanillaPresencialService({ connect } as unknown as Pool) };
}

describe('Fase 3C · vínculo TUPA de ventanilla, transacción con dobles', () => {
  it('amplía sólo el campo opcional reutilizado de MPV y conserva entradas generales', () => {
    const { datos } = preparar();
    expect(ventanillaPresencialSchema.parse(datos).idTipoTramiteTupa).toBe(tupa);
    const { idTipoTramiteTupa: _, ...general } = datos;
    expect(ventanillaPresencialSchema.parse(general)).not.toHaveProperty('idTipoTramiteTupa');
    expect(() => ventanillaPresencialSchema.parse({ ...datos, idTipoTramiteTupa: 'no-uuid' })).toThrow();
  });

  it('resuelve TUPA antes del CUT y vincula ambos dominios con UUID, CUT y solicitante originales', async () => {
    const d = preparar();
    const resultado = await d.service.registrarExpedienteVentanilla(d.datos);
    const calls = d.query.mock.calls;
    const consulta = calls.findIndex(([sql]) => sql.includes('FROM sigd_doc.tipo_tramite_tupa'));
    expect(calls[consulta][1]).toEqual([tupa, tipo]);
    expect(consulta).toBeLessThan(calls.findIndex(([sql])=>sql.includes('generar_cut_expediente')));
    const doc = calls.find(([sql])=>sql.includes('INSERT INTO sigd_doc.expediente'))!;
    const tramite = calls.find(([sql])=>sql.includes('INSERT INTO sigd_tra.tramite'))!;
    expect(doc[1]).toEqual([expediente,tupa,resultado.cut,d.datos.asunto,persona,expect.any(Date)]);
    expect(tramite[1]).toEqual([expediente,'SUZ26-054',d.datos.asunto]);
    expect(doc[0]).not.toMatch(/ON CONFLICT|UPDATE|LIMIT 1/);
    expect(calls.findIndex(([sql])=>sql.includes('INSERT INTO sigd_tra.asiento_registro'))).toBeGreaterThan(calls.indexOf(tramite));
    expect(calls.at(-1)?.[0]).toBe('COMMIT'); expect(d.connect).toHaveBeenCalledOnce(); expect(d.release).toHaveBeenCalledOnce();
  });

  it.each(['ausente','inactivo','incompatible'])('rechaza TUPA %s sin generar CUT ni insertar', async modo => {
    const d=preparar(modo);
    await expect(d.service.registrarExpedienteVentanilla(d.datos)).rejects.toMatchObject({status:400});
    expect(d.query.mock.calls.some(([s])=>s.includes('generar_cut_expediente')||s.includes('INSERT INTO'))).toBe(false);
    expect(d.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it.each(['no-uuid','00000000-0000-0000-0000-000000000000'])('rechaza UUID inválido %s antes de conectar', async id => {
    const d=preparar(); d.datos.idTipoTramiteTupa=id;
    await expect(d.service.registrarExpedienteVentanilla(d.datos)).rejects.toMatchObject({status:400});
    expect(d.connect).not.toHaveBeenCalled();
  });

  it('rechaza el marcador TUPA heredado sin identificador, sin inferir su relación', async () => {
    const d=preparar(); delete d.datos.idTipoTramiteTupa; d.datos.asunto='SUZ26-054 — Convalidación - Solicitud';
    await expect(d.service.registrarExpedienteVentanilla(d.datos)).rejects.toMatchObject({status:400});
    expect(d.connect).not.toHaveBeenCalled();
  });

  it('rechaza código de asunto contradictorio con el UUID antes de CUT', async () => {
    const d=preparar(); d.datos.asunto='SUZ26-035 — Otro procedimiento - Solicitud';
    await expect(d.service.registrarExpedienteVentanilla(d.datos)).rejects.toMatchObject({status:400});
    expect(d.query.mock.calls.some(([s])=>s.includes('generar_cut_expediente'))).toBe(false);
  });

  it('mantiene el flujo no TUPA sin asociaciones supuestas ni consultas al catálogo TUPA', async () => {
    const d=preparar(); delete d.datos.idTipoTramiteTupa;
    await expect(d.service.registrarExpedienteVentanilla(d.datos)).resolves.toHaveProperty('expedienteId',expediente);
    expect(d.query.mock.calls.some(([s])=>s.includes('tipo_tramite_tupa')||s.includes('INSERT INTO sigd_doc.expediente')||s.includes('INSERT INTO sigd_tra.tramite'))).toBe(false);
  });

  it.each(['INSERT INTO sigd_doc.expediente','INSERT INTO sigd_tra.tramite','INSERT INTO sigd_tra.asiento_registro'])('revierte toda la operación si falla %s, sin sobrescrituras', async falla => {
    const d=preparar('vigente',falla);
    await expect(d.service.registrarExpedienteVentanilla(d.datos)).rejects.toBe(d.error);
    expect(d.query).toHaveBeenCalledWith('ROLLBACK'); expect(d.query).not.toHaveBeenCalledWith('COMMIT');
    expect(d.query.mock.calls.some(([s])=>s.includes('UPDATE '))).toBe(false);
  });

  it.each(['identidad_contradictoria','codigo_contradictorio'])('no confirma una relación %s devuelta por persistencia', async modo => {
    const d=preparar(modo);
    await expect(d.service.registrarExpedienteVentanilla(d.datos)).rejects.toMatchObject({status:409,code:'TUPA_LINK_CONFLICT'});
    expect(d.query).toHaveBeenCalledWith('ROLLBACK'); expect(d.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('utiliza la transacción externa sin confirmarla ni liberarla', async () => {
    const d=preparar(); await d.service.registrarExpedienteVentanilla(d.datos,d.cliente);
    expect(d.query.mock.calls.some(([s])=>['BEGIN','COMMIT','ROLLBACK'].includes(s))).toBe(false);
    expect(d.connect).not.toHaveBeenCalled(); expect(d.release).not.toHaveBeenCalled();
  });
});
