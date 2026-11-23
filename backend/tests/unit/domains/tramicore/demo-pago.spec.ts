import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { omitirPagoDemo, exigirSinPagoDemoPendiente, obtenerEstadoPago, MARCA_PAGO_DEMO } from '../../../../src/domains/tramicore/demoPago.js';
import { derivarExpediente, atenderExpediente, archivarExpediente, recepcionarExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { crearServicioResoluciones } from '../../../../src/domains/docucore/resoluciones.service.js';
import type { Pool } from 'pg';
const ID = '33333333-3333-4333-8333-333333333333';
vi.mock('../../../../src/shared/request-context/request-context.js', () => ({ getRequestContext: () => ({ usuario_id: '44444444-4444-4444-8444-444444444444' }) }));
const connection = (db = 'sigd_jacobo_demo', pending = false) => ({ query: vi.fn(async (sql: string) => ({ rows: sql.includes('current_database') ? [{ db }] : pending ? [{ pendiente: 1 }] : [] })) }) as unknown as PoolClient;

/**
 * Helper: crea un mock de conexión con Tesorería instalada que retorna un
 * estado específico desde la consulta principal de _consultarEstadoEnTesoreria.
 * El argumento `tesRow` es el objeto que el mock devuelve para la consulta SQL
 * principal (que contiene tiene_orden, verificado, importe, importe_pagado, tiene_devolucion_activa).
 */
const connectionTes = (tesRow: Record<string, unknown>) => ({
  query: vi.fn(async (sql: string) => {
    if (sql.includes('current_database')) return { rows: [{ db: 'sigd_jacobo_demo' }] };
    if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.aplicacion_pago' }] };
    return { rows: [tesRow] };
  }),
}) as unknown as PoolClient;

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

 // ── Nuevos tests: cobertura de todos los estados del ciclo de pago ──────────

 describe('obtenerEstadoPago — cobertura completa de estados', () => {
   it('expediente con pago verificado → estado VERIFICADO y permite derivar', async () => {
     const c = connectionTes({ tiene_orden: true, verificado: true, importe: '100', importe_pagado: '100', tiene_devolucion_activa: false });
     const resultado = await obtenerEstadoPago(c, ID);
     expect(resultado.estado).toBe('VERIFICADO');
     expect(resultado.permiteDerivacion).toBe(true);
     expect(resultado.mensajeBloqueo).toBeNull();
   });

   it('expediente con pago pendiente (orden sin pago verificado) → estado PENDIENTE y lanza 422', async () => {
     const c = connectionTes({ tiene_orden: true, verificado: false, importe: '100', importe_pagado: '0', tiene_devolucion_activa: false });
     const resultado = await obtenerEstadoPago(c, ID);
     expect(resultado.estado).toBe('PENDIENTE');
     expect(resultado.permiteDerivacion).toBe(false);
     expect(resultado.mensajeBloqueo).toContain('NO ha sido verificado');
   });

   it('exigirSinPagoDemoPendiente con pago pendiente lanza AppError 422', async () => {
     const c = connectionTes({ tiene_orden: true, verificado: false, importe: '100', importe_pagado: '0', tiene_devolucion_activa: false });
     await expect(exigirSinPagoDemoPendiente(c, ID)).rejects.toMatchObject({ code: 'DEMO_PAYMENT_PENDING', status: 422 });
   });

   it('expediente sin orden de pago → estado SIN_ORDEN y permite derivar', async () => {
     const c = connectionTes({ tiene_orden: false, verificado: false, importe: null, importe_pagado: '0', tiene_devolucion_activa: false });
     const resultado = await obtenerEstadoPago(c, ID);
     expect(resultado.estado).toBe('SIN_ORDEN');
     expect(resultado.tieneOrden).toBe(false);
     expect(resultado.permiteDerivacion).toBe(true);
   });

   it('exigirSinPagoDemoPendiente sin orden de pago resuelve sin lanzar', async () => {
     const c = connectionTes({ tiene_orden: false, verificado: false, importe: null, importe_pagado: '0', tiene_devolucion_activa: false });
     await expect(exigirSinPagoDemoPendiente(c, ID)).resolves.toBeUndefined();
   });

   it('expediente con devolución aceptada → estado ANULADO y bloquea derivación', async () => {
     const c = connectionTes({ tiene_orden: true, verificado: false, importe: '100', importe_pagado: '100', tiene_devolucion_activa: true });
     const resultado = await obtenerEstadoPago(c, ID);
     expect(resultado.estado).toBe('ANULADO');
     expect(resultado.permiteDerivacion).toBe(false);
     expect(resultado.mensajeBloqueo).toContain('devolución');
   });

   it('exigirSinPagoDemoPendiente con devolución aceptada lanza 422', async () => {
     const c = connectionTes({ tiene_orden: true, verificado: false, importe: '100', importe_pagado: '100', tiene_devolucion_activa: true });
     await expect(exigirSinPagoDemoPendiente(c, ID)).rejects.toMatchObject({ code: 'DEMO_PAYMENT_PENDING', status: 422 });
   });

   it('expediente con pago parcial → estado PARCIAL y bloquea derivación', async () => {
     const c = connectionTes({ tiene_orden: true, verificado: false, importe: '100', importe_pagado: '50', tiene_devolucion_activa: false });
     const resultado = await obtenerEstadoPago(c, ID);
     expect(resultado.estado).toBe('PARCIAL');
     expect(resultado.permiteDerivacion).toBe(false);
     expect(resultado.importe).toBe(100);
     expect(resultado.importePagado).toBe(50);
   });

   it('expediente exonerado (importe=0) → estado EXONERADO y permite derivar', async () => {
     const c = connectionTes({ tiene_orden: false, verificado: false, importe: '0', importe_pagado: '0', tiene_devolucion_activa: false });
     const resultado = await obtenerEstadoPago(c, ID);
     expect(resultado.estado).toBe('EXONERADO');
     expect(resultado.permiteDerivacion).toBe(true);
   });

   it('obtenerEstadoPago en base no-demo retorna SIN_ORDEN sin consultar Tesorería', async () => {
     const c = connectionTes({ tiene_orden: true, verificado: true, importe: '100', importe_pagado: '100', tiene_devolucion_activa: false });
     // Override: simular base de producción
     const cProd = {
       query: vi.fn(async (sql: string) => {
         if (sql.includes('current_database')) return { rows: [{ db: 'sigd_produccion' }] };
         return { rows: [] };
       }),
     } as unknown as PoolClient;
     const resultado = await obtenerEstadoPago(cProd, ID);
     expect(resultado.estado).toBe('SIN_ORDEN');
     expect(resultado.permiteDerivacion).toBe(true);
   });
 });
});
