import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
// Dedicated demo-pago tests exercise the real guard; preserve ordered archive fixtures here.
vi.mock('../../../../src/domains/tramicore/demoPago.js', () => ({ exigirSinPagoDemoPendiente: vi.fn().mockResolvedValue(undefined) }));
import { archivarExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { insertarEvento } from '../../../../src/audit/evento-outbox.repository.js';
vi.mock('../../../../src/shared/request-context/request-context.js', () => ({ getRequestContext: () => ({ usuario_id: '990000001', correlation_id: '11111111-1111-4111-8111-111111111111' }) }));
vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({ insertarEvento: vi.fn() }));
const datos={estante:'E1',balda:'B1',caja:'C1'};
function fixture(estado='RESUELTO',guardado:Record<string,unknown>={...datos,observaciones:null,usuarioActorUuid:'990000001'}) {
 const query=vi.fn(async(sql:string)=>{
  if(sql.startsWith('SELECT expediente_id FROM')) return {rowCount:1,rows:[{expediente_id:'exp-demo'}]};
  if(sql.includes('estado_actual_expediente')) return {rowCount:1,rows:[{estado_actual:estado,area_actual_id:'area-demo'}]};
  if(sql.includes('SELECT datos')) return {rowCount:1,rows:[{datos:guardado}]};
  if(sql.includes('information_schema.columns')) return {rowCount:1,rows:[{data_type:'bigint'}]};
  if(sql.includes('INSERT INTO sigd_rut.movimiento_tramite')) return {rowCount:1,rows:[{id_movimiento:'mov-demo'}]};
  if(sql.includes('UPDATE sigd_tra.expediente') || sql.includes('UPDATE sigd_doc.expediente')) return {rowCount:1,rows:[]};
  if(sql.includes('sigd_org.area') || sql.includes('sigd_auth.cuenta_usuario') || sql.includes('expediente_custodia')) return {rowCount:1,rows:[{area_id:'a1',id_persona:'p1'}]};
  throw Error('Consulta inesperada: ' + sql);
 }); return {query,client:{query} as unknown as PoolClient};
}
beforeEach(()=>vi.clearAllMocks());
describe('Archivado: bloqueo y reintentos sin duplicar actuaciones (mocks)',()=>{
 it('bloquea antes de leer el estado canonico y registra el cierre una sola vez',async()=>{
  const f=fixture();await archivarExpediente(f.client,'exp-demo',datos);
  expect(f.query.mock.calls[0][0]).toMatch(/FOR UPDATE$/);expect(f.query.mock.calls[1][0]).toContain('estado_actual_expediente');
  expect(f.query.mock.calls.filter(([sql])=>sql.includes('INSERT INTO'))).toHaveLength(1);expect(insertarEvento).toHaveBeenCalledTimes(1);
 });
 it('un reintento identico del mismo actor devuelve exito sin insertar movimiento ni Outbox',async()=>{
  const f=fixture('ARCHIVADO');await archivarExpediente(f.client,'exp-demo',datos);
  expect(f.query.mock.calls.some(([sql])=>sql.includes('INSERT INTO'))).toBe(false);expect(insertarEvento).not.toHaveBeenCalled();
 });
 it.each([{...datos,caja:'otra'}, {...datos,usuarioActorUuid:'otro'}])('rechaza un cierre incompatible con el asiento previo',async(guardado)=>{
  const f=fixture('ARCHIVADO',{...guardado,observaciones:null});await expect(archivarExpediente(f.client,'exp-demo',datos)).rejects.toMatchObject({status:409});expect(insertarEvento).not.toHaveBeenCalled();
 });
 it('rechaza ubicaciones en blanco antes de consultar PostgreSQL',async()=>{
  const f=fixture();await expect(archivarExpediente(f.client,'exp-demo',{...datos,estante:'   '})).rejects.toMatchObject({status:400});expect(f.query).not.toHaveBeenCalled();
 });
});
