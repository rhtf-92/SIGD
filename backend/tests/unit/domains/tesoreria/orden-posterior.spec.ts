import {describe,it,expect,vi} from 'vitest';
import type {Pool} from 'pg';
import {generarOrdenPosterior,intentarOrdenPosterior} from '../../../../src/domains/tesoreria/ordenPosterior.service.js';
const id='11111111-1111-4111-8111-111111111111';
function fixture({tarifas=[{id,importe:'124.00',concepto:'Certificado',fuente:'Fuente validada'}],propio=true,previa=false,verificado=false,unidad=false}:{tarifas?:Array<{id:string;importe:string;concepto:string;fuente:string}>;propio?:boolean;previa?:boolean;verificado?:boolean;unidad?:boolean}={}){
 const query=vi.fn(async(sql:string)=>{
  if(sql.includes('FROM sigd_doc.expediente e'))return {rows:propio?[{expediente_id:id,tipo_tramite_id:id,codigo_expediente:'EXP-2026-000001',solicitante_id:id,tupa_fuente:{nombre:unidad?'Convalidación por unidad didáctica':'Certificado'}}]:[]};
  if(sql.includes('FROM sigd_tes.aplicacion_pago a'))return {rows:previa?[{id,codigo:'OP-EXISTENTE',importe:'124.00',moneda:'PEN',pago_verificado:verificado}]:[]};
  if(sql.includes('SELECT f.*'))return {rows:tarifas};
  return {rows:[{id_auditoria:id}]};
 });const release=vi.fn();const pool={connect:vi.fn(async()=>({query,release}))} as unknown as Pool;return {pool,query,release};
}
describe('Orden exclusivamente posterior al CUT',()=>{
 it('rechaza un expediente ajeno sin insertar ni tocar pagos',async()=>{const f=fixture({propio:false});await expect(generarOrdenPosterior(f.pool,id,{usuario:id})).rejects.toMatchObject({status:404});expect(f.query.mock.calls.some(([s])=>s.startsWith('INSERT'))).toBe(false);expect(f.query).toHaveBeenCalledWith('ROLLBACK');});
 it('genera orden y vínculo en una transacción distinta, sin registrar pagos',async()=>{const f=fixture();const r=await generarOrdenPosterior(f.pool,id,{usuario:id});expect(r).toMatchObject({estado:'PENDIENTE_PAGO',importe:'124.00'});expect(f.query.mock.calls.some(([s])=>s.startsWith('INSERT INTO sigd_tes.aplicacion_pago'))).toBe(true);expect(f.query.mock.calls.some(([s])=>s.startsWith('INSERT INTO sigd_tes.pago('))).toBe(false);expect(f.query).toHaveBeenLastCalledWith('COMMIT');});
 it('reutiliza la orden ya vinculada aunque cambie la cantidad del reintento',async()=>{const f=fixture({previa:true});expect(await generarOrdenPosterior(f.pool,id,{usuario:id},9)).toMatchObject({ordenId:id,importe:'124.00'});expect(f.query.mock.calls.some(([s])=>s.startsWith('INSERT'))).toBe(false);});
 it('detecta pago verificado aunque haya varios pagos para la orden',async()=>{const f=fixture({previa:true,verificado:true});expect(await generarOrdenPosterior(f.pool,id,{usuario:id})).toMatchObject({estado:'PAGO_VERIFICADO'});const sql=f.query.mock.calls.find(([s])=>String(s).includes('FROM sigd_tes.aplicacion_pago a'))?.[0] as string;expect(sql).toContain('EXISTS(SELECT 1 FROM sigd_tes.pago');expect(sql).not.toContain('LEFT JOIN sigd_tes.pago');});
 it('no cobra si falta tarifa validada',async()=>{const f=fixture({tarifas:[]});expect(await generarOrdenPosterior(f.pool,id,{usuario:id})).toMatchObject({estado:'PENDIENTE_VALIDACION'});expect(f.query.mock.calls.some(([s])=>s.startsWith('INSERT'))).toBe(false);});
 it('no genera orden para gratuidad validada',async()=>{const f=fixture({tarifas:[{id,importe:'0.00',concepto:'Gratuito',fuente:'Fuente validada'}]});expect(await generarOrdenPosterior(f.pool,id,{usuario:id})).toMatchObject({estado:'GRATUITO'});expect(f.query.mock.calls.some(([s])=>s.startsWith('INSERT'))).toBe(false);});
 it('requiere cantidad cuando la fuente expresa cobro por unidad',async()=>{const f=fixture({unidad:true});expect(await generarOrdenPosterior(f.pool,id,{usuario:id})).toMatchObject({estado:'REQUIERE_CANTIDAD'});expect(f.query.mock.calls.some(([s])=>s.startsWith('INSERT'))).toBe(false);});
 it('multiplica centavos enteros sin redondeo flotante',async()=>{const f=fixture({unidad:true,tarifas:[{id,importe:'23.25',concepto:'Por unidad',fuente:'Fuente validada'}]});expect(await generarOrdenPosterior(f.pool,id,{usuario:id},3)).toMatchObject({importe:'69.75'});});
 it('el fallo de Tesorería conserva la confirmación de recepción y permite reintentar',async()=>{const pool={connect:vi.fn().mockRejectedValue(Error('fallo'))} as unknown as Pool;expect(await intentarOrdenPosterior(pool,id,{usuario:id})).toMatchObject({estado:'ERROR',mensaje:expect.stringContaining('no vuelva a radicar')});});
});
