import {describe,expect,it,vi} from 'vitest';
import type {Pool,PoolClient} from 'pg';
import {TesoreriaPublica} from '../../../../src/domains/tesoreria/tesoreria.publica.js';
import {TesoreriaRepository} from '../../../../src/domains/tesoreria/tesoreria.repository.js';
import {TesoreriaService} from '../../../../src/domains/tesoreria/tesoreria.service.js';
import {validarPagoRadicacion} from '../../../../src/domains/tesoreria/tesoreria.radicacion.js';
import {busquedaSchema} from '../../../../src/domains/tesoreria/tesoreria.schemas.js';

const ORDER='11111111-1111-4111-8111-111111111111',EXP='22222222-2222-4222-8222-222222222222',PERSON='33333333-3333-4333-8333-333333333333',USER='44444444-4444-4444-8444-444444444444';
const twoPayments=[{id:'p1',estado:'VERIFICADO',numeroRecibo:'1',importe:'80.00'},{id:'p2',estado:'VERIFICADO',numeroRecibo:'2',importe:'80.00'}];

describe('lecturas de órdenes con pagos adicionales',()=>{
 it('el historial del ciudadano agrega todos los pagos y devoluciones asociadas a cada pago',async()=>{
  const query=vi.fn().mockResolvedValue({rows:[{id:ORDER,pagos:twoPayments,devoluciones:[{pago_id:'p1',estado:'RECHAZADA'},{pago_id:'p2',estado:'SOLICITADA'}]}]});
  const repo=new TesoreriaRepository({query} as unknown as Pool),service=new TesoreriaService(repo);
  const actor={usuario:USER,persona:PERSON,ciudadano:true,permisos:[]};
  const rows=await service.listar(actor,busquedaSchema.parse({}));
  expect(rows[0].pagos).toHaveLength(2);expect(rows[0].devoluciones).toHaveLength(2);
  const sql=query.mock.calls[0][0] as string;
  expect(sql).toContain('FROM sigd_tes.pago px WHERE px.orden_id=o.id');
  expect(sql).toContain('JOIN sigd_tes.pago pd ON pd.id=d.pago_id WHERE pd.orden_id=o.id');
  expect(sql).toContain('EXISTS(SELECT 1 FROM sigd_tes.pago pf');
 });

 it('la consulta pública agrega todos los pagos sin un join no determinista',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[{habilitado:true}]}).mockResolvedValueOnce({rows:[{id:ORDER,estado_pago:'VERIFICADO',pagos:twoPayments}]});
  const service=new TesoreriaPublica(new TesoreriaRepository({query} as unknown as Pool));
  const result=await service.consultar(ORDER,'a'.repeat(64));
  expect(result.pagos).toHaveLength(2);
  const sql=query.mock.calls[1][0] as string;
  expect(sql).toContain("EXISTS(SELECT 1 FROM sigd_tes.pago pv WHERE pv.orden_id=o.id AND pv.estado='VERIFICADO')");
  expect(sql).toContain("json_agg(json_build_object('id',p.id");
  expect(sql).not.toContain('LEFT JOIN sigd_tes.pago p ON p.orden_id=o.id');
 });

 it('la radicación consulta devoluciones de cualquier pago de la orden',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('to_regclass'))return{rows:[{tabla:'sigd_tes.orden_pago'}],rowCount:1};
   if(sql.includes('SELECT o.*'))return{rows:[{id:ORDER,persona_id:PERSON,ciudadano_id:USER,tipo_tramite_id:EXP,sesion_publica_hash:null}],rowCount:1};
   if(sql.includes('aplicacion_pago'))return{rows:[],rowCount:0};
   return{rows:[],rowCount:0};
  });
  const client={query} as unknown as PoolClient;
  await expect(validarPagoRadicacion(client,EXP,PERSON,USER,ORDER,false)).resolves.toBe(ORDER);
  const refunds=query.mock.calls.find(([sql])=>String(sql).includes('JOIN sigd_tes.pago p ON p.id=d.pago_id'))?.[0] as string;
  expect(refunds).toContain('WHERE p.orden_id=$1');
  expect(refunds).not.toContain('d.pago_id=$');
 });
});
