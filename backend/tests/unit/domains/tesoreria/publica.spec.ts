import {describe,it,expect,vi} from 'vitest';
import type {Pool,PoolClient} from 'pg';
import {ordenPublicaSchema,TesoreriaPublica,ordenesPublicasInstaladas} from '../../../../src/domains/tesoreria/tesoreria.publica.js';
import {validarPagoRadicacion} from '../../../../src/domains/tesoreria/tesoreria.radicacion.js';
import {TesoreriaRepository} from '../../../../src/domains/tesoreria/tesoreria.repository.js';
const id='11111111-1111-4111-8111-111111111111',hash='a'.repeat(64);
const datos={procedimientoId:id,claveSolicitud:id,expedienteId:id,tipoDocumento:'DNI',numeroDocumento:'00000050',nombres:'Persona',apellidos:'Prueba',correo:'qa@sandbox.invalid',telefono:'900000001',declaracionVeracidad:true,aceptaTerminos:true};
describe('Orden pública sin cuenta: controles previos a activación',()=>{
 it('conserva ceros del DNI sin exigir una cuenta',()=>{expect(ordenPublicaSchema.parse(datos).numeroDocumento).toBe('00000050');});
 it.each(['personaId','usuarioId','importe','estado'])('no acepta %s desde React',campo=>expect(ordenPublicaSchema.safeParse({...datos,[campo]:id}).success).toBe(false));
 it('rechaza representación jurídica no habilitada',()=>expect(ordenPublicaSchema.safeParse({...datos,tipoDocumento:'RUC',numeroDocumento:'20000000000'}).success).toBe(false));
 it('exige declaración y consentimiento',()=>expect(ordenPublicaSchema.safeParse({...datos,aceptaTerminos:false}).success).toBe(false));
 it('no anuncia la capacidad si falta la migración autorizada',async()=>{expect(await ordenesPublicasInstaladas({query:vi.fn().mockResolvedValue({rows:[{habilitado:false}]})} as unknown as Pool)).toBe(false);});
 it('no intenta escribir cuando el esquema no está instalado',async()=>{const query=vi.fn().mockResolvedValue({rows:[{habilitado:false}]}),connect=vi.fn();const s=new TesoreriaPublica(new TesoreriaRepository({query,connect} as unknown as Pool));await expect(s.crear(hash,ordenPublicaSchema.parse(datos))).rejects.toMatchObject({code:'PUBLIC_ORDER_NOT_INSTALLED',status:503});expect(connect).not.toHaveBeenCalled();});
 it('no permite recuperar órdenes por documento ni por identificador sin la capacidad',async()=>{const query=vi.fn().mockResolvedValueOnce({rows:[{habilitado:true}]}).mockResolvedValueOnce({rows:[]});await expect(new TesoreriaPublica(new TesoreriaRepository({query} as unknown as Pool)).consultar(id,'b'.repeat(64))).rejects.toMatchObject({status:404});expect(query.mock.calls[1][1]).toEqual([id,'b'.repeat(64)]);});
 function escritura(importe='124.00',previa?:Record<string,unknown>){
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM sigd_doc.expediente e'))return{rows:[{expediente_id:id,tipo_tramite_id:id,solicitante_id:id,codigo_expediente:'EXP-2026-000001',datos_declarados:datos}]};
   if(sql.includes('FROM sigd_tes.aplicacion_pago a'))return{rows:previa?[{...previa,importe}]:[]};
   if(sql.startsWith('SELECT * FROM sigd_tes.orden_pago'))return{rows:previa?[previa]:[]};
   if(sql.includes('SELECT f.*'))return{rows:[{id,importe,concepto:'Certificado fixture'}]};
   if(sql.includes('INSERT INTO sigd_auth.persona ('))return{rows:[{id_persona:id}]};
   if(sql.includes('INSERT INTO sigd_audit.bitacora_auditoria'))return{rows:[{id_auditoria:id}]};
   if(sql.includes('SELECT o.id,o.codigo'))return{rows:[{id,codigo:'OP-FIXTURE',importe,estado_pago:null}]};
   return{rows:[],rowCount:1};
  });
  const c={query,release:vi.fn()},pool={query:vi.fn().mockResolvedValue({rows:[{habilitado:true}]}),connect:vi.fn().mockResolvedValue(c)} as unknown as Pool;
  return{service:new TesoreriaPublica(new TesoreriaRepository(pool)),query};
 }
 it('prepara la orden con persona, tarifa backend y capacidad, sin insertar cuenta genérica',async()=>{
  const f=escritura();expect((await f.service.crear(hash,ordenPublicaSchema.parse(datos))).importe).toBe('124.00');
  expect(f.query.mock.calls.some(([sql])=>sql.includes('INSERT INTO sigd_auth.cuenta_usuario'))).toBe(false);
  expect(f.query.mock.calls.some(([sql])=>sql==='COMMIT')).toBe(true);
  expect(f.query.mock.calls.some(([sql])=>sql.includes('sesion_publica_hash,solicitante_declarado'))).toBe(true);
 });
 it('recupera el reintento sin crear otra persona u orden',async()=>{
  const f=escritura('124.00',{id,tipo_tramite_id:id,solicitante_declarado:datos});await f.service.crear(hash,ordenPublicaSchema.parse(datos));
  expect(f.query.mock.calls.some(([sql])=>sql.startsWith('INSERT'))).toBe(false);
 });
 it('reintentar no sustituye la identidad registrada en el expediente',async()=>{
  const f=escritura('124.00',{id,tipo_tramite_id:id,solicitante_declarado:{...datos,nombres:'Otra persona'}});
  await f.service.crear(hash,ordenPublicaSchema.parse(datos));
  expect(f.query.mock.calls.some(([sql])=>sql.startsWith('INSERT')||sql.startsWith('UPDATE'))).toBe(false);
 });
 it('no crea órdenes ni personas para una tarifa gratuita',async()=>{
  const f=escritura('0.00');expect(await f.service.crear(hash,ordenPublicaSchema.parse(datos))).toMatchObject({estado:'GRATUITO'});
  expect(f.query.mock.calls.some(([sql])=>sql.startsWith('INSERT'))).toBe(false);
 });
 const orden={id,persona_id:id,ciudadano_id:null,sesion_publica_hash:hash,tipo_tramite_id:id,importe:'124.00',estado_pago:'VERIFICADO',pago_id:id};
 const cliente=(o:Record<string,unknown>)=>({query:vi.fn(async(sql:string)=>sql.includes('to_regclass')?{rows:[{tabla:'sigd_tes.orden_pago'}]}:sql.includes('FOR UPDATE')?{rows:[o]}:{rows:[],rowCount:0})}) as unknown as PoolClient;
 it('acepta la orden pública verificada de la misma persona y capacidad',async()=>expect(await validarPagoRadicacion(cliente(orden),id,id,null,id,false,hash)).toBe(id));
 it.each([undefined,'b'.repeat(64)])('rechaza otra capacidad pública (%s)',async h=>await expect(validarPagoRadicacion(cliente(orden),id,id,null,id,false,h)).rejects.toMatchObject({status:403}));
 it('null usuario nunca equivale por sí mismo a titularidad',async()=>await expect(validarPagoRadicacion(cliente({...orden,sesion_publica_hash:null}),id,id,null,id,false)).rejects.toMatchObject({status:403}));
 it('un JWT no puede apropiarse de una orden pública por conocer su DNI',async()=>await expect(validarPagoRadicacion(cliente(orden),id,id,id,id,false,hash)).rejects.toMatchObject({status:403}));
 it('una orden propia pendiente no impide recibir la solicitud',async()=>expect(await validarPagoRadicacion(cliente({...orden,estado_pago:'REGISTRADO'}),id,id,null,id,true,hash)).toBe(id));
});
