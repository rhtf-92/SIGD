import {createHash} from 'node:crypto';
import {describe,expect,it,vi} from 'vitest';
import {PagoAdicionalService} from '../../../../src/domains/tesoreria/pagoAdicional.service.js';
import {TesoreriaRepository} from '../../../../src/domains/tesoreria/tesoreria.repository.js';
import {hashPagosConfirmados} from '../../../../src/domains/tesoreria/pago.snapshot.js';

const ORDER='11111111-1111-4111-8111-111111111111', EXP='22222222-2222-4222-8222-222222222222', CITIZEN='33333333-3333-4333-8333-333333333333', CASHIER='44444444-4444-4444-8444-444444444444', PAYMENT='55555555-5555-4555-8555-555555555555', AUTH='66666666-6666-4666-8666-666666666666';
const pagos=[{id:PAYMENT,referencia:'DEMO-RC-1',fecha_operacion:new Date('2026-11-01T12:00:00Z'),importe:'80.00',numero_recibo:'1',estado:'VERIFICADO',recibo:'recibo.pdf'}];
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
function harness(){
 const insertAuth:{params?:unknown[]}={};let authorize=true;
 const query=vi.fn(async(sql:string,params:unknown[]=[]):Promise<any>=>{
  if(sql.includes('SELECT o.id,o.ciudadano_id,o.importe::text importe,a.expediente_id'))return{rows:[{id:ORDER,ciudadano_id:CITIZEN,importe:'80.00',expediente_id:EXP}],rowCount:1};
  if(sql.includes('SELECT p.id,p.referencia,p.fecha_operacion'))return{rows:authorize?pagos:[],rowCount:authorize?1:0};
  if(sql.includes('INSERT INTO sigd_tes.autorizacion_pago_adicional')){insertAuth.params=params;return{rows:[],rowCount:1};}
  if(sql.includes('SELECT * FROM sigd_tes.autorizacion_pago_adicional'))return{rows:[{id:AUTH,orden_id:ORDER,solicitante_id:CITIZEN,creada_por:CASHIER,expediente_id:EXP,importe_autorizado:'80.00',token_sha256:params[1],snapshot_sha256:sha(JSON.stringify(pagos.map(p=>({id:p.id,referencia:p.referencia,fecha:p.fecha_operacion,importe:p.importe,numeroRecibo:p.numero_recibo})))),expira_en:new Date(Date.now()+60000),confirmada_en:null,consumida_en:null}],rowCount:1};
  if(sql.includes('SET confirmada_en=clock_timestamp()'))return{rows:[{id:AUTH,expira_en:new Date(Date.now()+60000)}],rowCount:1};
  if(sql.includes('SELECT id,referencia,fecha_operacion'))return{rows:pagos,rowCount:1};
  if(sql.includes('SELECT ciudadano_id,codigo FROM sigd_tes.orden_pago'))return{rows:[{ciudadano_id:CITIZEN,codigo:'OP-DEMO'}],rowCount:1};
  if(sql.includes('INSERT INTO sigd_audit.bitacora_auditoria'))return{rows:[{id_auditoria:AUTH}],rowCount:1};
  if(sql.includes('INSERT INTO sigd_audit.evento_outbox'))return{rows:[{id_evento:AUTH}],rowCount:1};
  return{rows:[],rowCount:1};
 });
 const client={query,release:vi.fn()};const pool={connect:vi.fn(async()=>client)};
 return{service:new PagoAdicionalService(new TesoreriaRepository(pool as never)),query,insertAuth,actor:{usuario:CASHIER,persona:CITIZEN,ciudadano:false,permisos:['TESORERIA_PAGO_REGISTRAR']}};
}
describe('autorización de pago adicional',()=>{
 it('la instantánea cambia cuando cambia el pago confirmado, impidiendo autorizaciones creadas en paralelo',()=>{
  expect(hashPagosConfirmados(pagos)).not.toBe(hashPagosConfirmados([...pagos,{...pagos[0],id:'77777777-7777-4777-8777-777777777777',numero_recibo:'2'}]));
 });
 it('expone el pago previo y requiere una confirmación temporal vinculada a orden y ciudadano',async()=>{
  const h=harness();const advertencia=await h.service.detectar(h.actor,ORDER);
  expect(advertencia.requiereConfirmacion).toBe(true);expect(advertencia.pagos).toHaveLength(1);expect(advertencia.token).toBeTruthy();
  const confirmacion=await h.service.confirmar(h.actor,ORDER,advertencia.token!);
  expect(confirmacion.autorizacionId).toBe(AUTH);
  expect(h.query).toHaveBeenCalledWith(expect.stringContaining('confirmada_por=$2'),expect.arrayContaining([AUTH,CASHIER]));
  expect(h.insertAuth.params?.[2]).toBe(CITIZEN);expect(h.insertAuth.params?.[0]).toBe(ORDER);expect(h.insertAuth.params?.[1]).toBe(EXP);expect(h.insertAuth.params?.[6]).toBe(CASHIER);
 });
 it('no genera autorización cuando no hay pagos confirmados',async()=>{
  const h=harness();h.query.mockImplementation(async(sql:string):Promise<any>=>sql.includes('SELECT o.id,o.ciudadano_id,o.importe::text importe,a.expediente_id')?{rows:[{id:ORDER,ciudadano_id:CITIZEN,importe:'80.00',expediente_id:EXP}],rowCount:1}:sql.includes('SELECT p.id,p.referencia,p.fecha_operacion')?{rows:[],rowCount:0}:{rows:[],rowCount:1});
  const result=await h.service.detectar(h.actor,ORDER);expect(result).toEqual({requiereConfirmacion:false,pagos:[]});expect(h.insertAuth.params).toBeUndefined();
 });
 it('no permite confirmar una autorización temporal emitida por otro tesorero',async()=>{
  const h=harness();
  h.query.mockImplementation(async(sql:string,params:unknown[]=[]):Promise<any>=>{
   if(sql.includes('SELECT o.id,o.ciudadano_id,o.importe::text importe,a.expediente_id'))return{rows:[{id:ORDER,ciudadano_id:CITIZEN,importe:'80.00',expediente_id:EXP}],rowCount:1};
   if(sql.includes('SELECT * FROM sigd_tes.autorizacion_pago_adicional'))return{rows:[{id:AUTH,orden_id:ORDER,solicitante_id:CITIZEN,creada_por:'77777777-7777-4777-8777-777777777777',expediente_id:EXP}],rowCount:1};
   return{rows:[],rowCount:1};
  });
  await expect(h.service.confirmar(h.actor,ORDER,'token-largo-de-prueba-para-la-confirmacion')).rejects.toMatchObject({code:'AUTORIZACION_INVALIDA'});
  expect(h.query.mock.calls.some(([sql])=>String(sql).includes('SET confirmada_en'))).toBe(false);
 });
});
