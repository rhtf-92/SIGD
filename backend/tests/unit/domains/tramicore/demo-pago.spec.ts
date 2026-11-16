import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { omitirPagoDemo, exigirSinPagoDemoPendiente, MARCA_PAGO_DEMO } from '../../../../src/domains/tramicore/demoPago.js';
import { derivarExpediente, atenderExpediente, archivarExpediente, recepcionarExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { crearServicioResoluciones } from '../../../../src/domains/docucore/resoluciones.service.js';
import type { Pool } from 'pg';
const ID = '33333333-3333-4333-8333-333333333333';
vi.mock('../../../../src/shared/request-context/request-context.js', () => ({ getRequestContext: () => ({ usuario_id: '44444444-4444-4444-8444-444444444444' }) }));
const connection = (db = 'sigd_jacobo_demo', pending = false) => ({ query: vi.fn(async (sql: string) => ({ rows: sql.includes('current_database') ? [{ db }] : pending ? [{ pendiente: 1 }] : [] })) }) as unknown as PoolClient;
afterEach(() => vi.unstubAllEnvs());
describe('excepción económica temporal, control exclusivo del servidor', () => {
 it('el pago posterior verificado permite continuar sin reescribir la evidencia inicial',async()=>{
   const query=vi.fn(async(sql:string)=>({rows:sql.includes('current_database')?[{db:'sigd_jacobo_demo'}]:sql.includes('to_regclass')?[{tabla:'sigd_tes.aplicacion_pago'}]:[{verificado:true}]}));
   await expect(exigirSinPagoDemoPendiente({query} as unknown as PoolClient,ID)).resolves.toBeUndefined();
   expect(query.mock.calls.every(([sql])=>sql.startsWith('SELECT'))).toBe(true);
 });
 it('sin flag no activa la excepción ni consulta otra base', async () => {
   vi.stubEnv('SIGD_DEMO_OMITIR_PAGO', 'false'); const c = connection();
   expect(await omitirPagoDemo(c)).toBe(false); expect(c.query).not.toHaveBeenCalled();
 });
 it.each(['sigd_prueba', 'produccion', 'otra_demo'])('flag no habilita %s', async db => {
   vi.stubEnv('SIGD_DEMO_OMITIR_PAGO', 'true'); vi.stubEnv('NODE_ENV', 'test');
   expect(await omitirPagoDemo(connection(db))).toBe(false);
 });
 it('requiere conexión demo comprobada y no funciona en NODE_ENV production', async () => {
   vi.stubEnv('SIGD_DEMO_OMITIR_PAGO', 'true'); vi.stubEnv('NODE_ENV', 'test');
   expect(await omitirPagoDemo(connection())).toBe(true);
   vi.stubEnv('NODE_ENV', 'production'); expect(await omitirPagoDemo(connection())).toBe(false);
 });
 it('el bloqueo durable persiste al desactivar el flag y no afecta expedientes anteriores', async () => {
   vi.stubEnv('SIGD_DEMO_OMITIR_PAGO', 'false'); const c = connection('sigd_jacobo_demo', true);
   await expect(exigirSinPagoDemoPendiente(c, ID)).rejects.toMatchObject({ code: 'DEMO_PAYMENT_PENDING', status: 422 });
   expect(c.query).toHaveBeenLastCalledWith(expect.stringContaining("'NO_VERIFICADO'"), [ID, MARCA_PAGO_DEMO]);
   await expect(exigirSinPagoDemoPendiente(connection(), ID)).resolves.toBeUndefined();
 });
 it('las cuatro acciones de RutaDoc rechazan el expediente antes de cualquier mutación', async () => {
   const c = connection('sigd_jacobo_demo', true);
   for (const action of [() => derivarExpediente(c, ID, {} as never), () => atenderExpediente(c, ID, {} as never),
     () => archivarExpediente(c, ID, { estante: 'DEMO', balda: '1', caja: '1' }), () => recepcionarExpediente(c, ID)]) {
     await expect(action()).rejects.toMatchObject({ code: 'DEMO_PAYMENT_PENDING' });
   }
   expect(vi.mocked(c.query).mock.calls.every(([sql]) => String(sql).trim().startsWith('SELECT'))).toBe(true);
 });
 it('impide proyectar resolución y consumir su correlativo', async () => {
   const c = connection('sigd_jacobo_demo', true);
   const repo = { guardar: vi.fn(), asignarNumeroAnual: vi.fn() };
   const service = crearServicioResoluciones(c as unknown as Pool, repo as never);
   await expect(service.proyectar({ expedienteId: ID } as never)).rejects.toMatchObject({ code: 'DEMO_PAYMENT_PENDING' });
   expect(repo.guardar).not.toHaveBeenCalled(); expect(repo.asignarNumeroAnual).not.toHaveBeenCalled();
 });
});
