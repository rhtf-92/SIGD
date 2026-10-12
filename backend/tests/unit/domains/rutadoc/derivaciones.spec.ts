import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import { registrarActuacion, derivarExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { crearContexto, runWithContext } from '../../../../src/shared/request-context/request-context.js';
const id = '00000000-0000-4000-8000-000000000001';
const area = '00000000-0000-4000-8000-000000000002';
const query = vi.fn();
const cliente = { query } as unknown as PoolClient;
const contexto = crearContexto({ usuario_id: id, unidad_organica_id: area });
beforeEach(() => query.mockReset());
describe('Actuaciones RutaDoc sobre el contrato 06', () => {
  it('exige identidad autenticada antes de escribir', async () => {
    await expect(registrarActuacion(cliente, id, 'CIERRE', {}, 'Archivo')).rejects.toMatchObject({status:401});
    expect(query).not.toHaveBeenCalled();
  });
  it('rechaza IDs numericos de expediente', async () => {
    await expect(runWithContext(contexto, () => registrarActuacion(cliente, '123', 'CIERRE', {}, 'Archivo'))).rejects.toMatchObject({status:400});
    expect(query).not.toHaveBeenCalled();
  });
  it('no archiva un expediente que no esta resuelto', async () => {
    query.mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[{estado:'EN_REVISION',area_id:area}]});
    await expect(runWithContext(contexto, () => registrarActuacion(cliente, id, 'CIERRE', {}, 'Archivo'))).rejects.toMatchObject({status:422});
  });
  it('deniega atencion sin tenencia de area', async () => {
    query.mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[{estado:'EN_FIRMA',area_id:id}]});
    await expect(runWithContext(contexto, () => registrarActuacion(cliente, id, 'FIRMA', {}, 'Atencion',true))).rejects.toMatchObject({status:403});
  });
  it('conserva metadata de archivo y emite outbox sin modificar historial', async () => {
    query.mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[{estado:'RESUELTO',area_id:area}]})
      .mockResolvedValueOnce({rows:[{id_movimiento:id}]}).mockResolvedValueOnce({rows:[{id_evento:id}]});
    await runWithContext(contexto, () => registrarActuacion(cliente,id,'CIERRE',{caja:'A'},'Archivo'));
    expect(query.mock.calls[2][1][3]).toBe('ARCHIVADO');
    expect(JSON.parse(query.mock.calls[2][1][7])).toEqual({areaId:area,caja:'A'});
    expect(query.mock.calls.some(([sql]) => /UPDATE|DELETE/.test(sql))).toBe(false);
    expect(query.mock.calls[3][0]).toContain('evento_outbox');
  });
  it('rechaza derivaciones ambiguas sin un principal unico', async () => {
    await expect(derivarExpediente(cliente,id,{destinos:[{area_destino_id:area,es_copia:true}],proveido:'Pase'})).rejects.toMatchObject({status:400});
  });
});
