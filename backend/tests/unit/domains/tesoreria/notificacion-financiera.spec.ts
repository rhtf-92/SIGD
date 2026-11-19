import {describe,it,expect,vi} from 'vitest';
import type {Pool} from 'pg';
import {DestinoCasilla,DestinoSse} from '../../../../src/audit/despachador-notificaciones.js';
import type {EventoPendiente} from '../../../../src/audit/outbox-worker.js';
const USER='11111111-1111-4111-8111-111111111111',ORDEN='22222222-2222-4222-8222-222222222222',EVENT='33333333-3333-4333-8333-333333333333';
const event={id_evento:EVENT,tipo_evento:'tesoreria_notificacion',correlation_id:EVENT,agregado:'tesoreria',payload:{usuario_id:USER,orden_id:ORDEN,referencia_orden:'OP-FIXTURE',asunto:'Tesorería: pago observado',cuerpo:{motivo:'Fixture'}}} as unknown as EventoPendiente;
function crear(titular=true,previa=false,contradictoria=false){
 const query=vi.fn(async(sql:string)=>{
  if(sql.includes('SELECT o.codigo'))return{rows:titular?[{codigo:'OP-FIXTURE'}]:[]};
  if(sql.includes('SELECT usuario_id,numero_documento'))return{rows:previa?[{usuario_id:contradictoria?ORDEN:USER,numero_documento:'OP-FIXTURE'}]:[]};
  return{rows:[]};
 });
 const release=vi.fn();const connect=vi.fn(async()=>({query,release}));
 const pool={query:vi.fn(async()=>({rows:[{existe:'sigd_auth.notificacion_casilla'}]})),connect} as unknown as Pool;
 return{destino:new DestinoCasilla(pool),query,release};
}
describe('M10: Casilla financiera previa al CUT',()=>{
 it('SSE no difunde datos financieros o personales a otros suscriptores',async()=>{const emitirEvento=vi.fn();const sse=new DestinoSse({emitirEvento} as never);await sse.despachar(event);expect(emitirEvento).toHaveBeenCalledWith('casilla_notificacion',{tipoEvento:'tesoreria_notificacion',actualizar:true});expect(JSON.stringify(emitirEvento.mock.calls)).not.toContain(USER);expect(JSON.stringify(emitirEvento.mock.calls)).not.toContain('OP-FIXTURE');});
 it('valida titular de orden y registra comunicación sin inventar expediente ni CUT',async()=>{const{destino,query,release}=crear();await destino.despachar(event);const insert=query.mock.calls.find(([s])=>s.includes('INSERT INTO'));expect(insert?.[0]).toContain('numero_documento');expect(insert?.[0]).not.toContain('cut,');expect(query.mock.calls[0][0]).toBe('BEGIN');expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');expect(release).toHaveBeenCalledOnce();});
 it('reintento de evento ya entregado no duplica la comunicación',async()=>{const{destino,query}=crear(true,true);await destino.despachar(event);expect(query.mock.calls.some(([s])=>s.includes('INSERT INTO'))).toBe(false);});
 it('no entrega a quien no pertenece la orden',async()=>{const{destino,query,release}=crear(false);await expect(destino.despachar(event)).rejects.toThrow('titular');expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');expect(release).toHaveBeenCalledOnce();});
 it('rechaza una referencia asociada a otro destinatario',async()=>{const{destino}=crear(true,true,true);await expect(destino.despachar(event)).rejects.toThrow('contradictoria');});
 it('rechaza payload financiero incompleto sin efectos secundarios',async()=>{const{destino,query}=crear();await expect(destino.despachar({...event,payload:{}})).rejects.toThrow('válidos');expect(query).not.toHaveBeenCalled();});
});
