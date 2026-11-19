import {describe,it,expect,vi} from 'vitest';
import type {Pool,PoolClient} from 'pg';
import {PDFDocument} from 'pdf-lib';
import {TesoreriaRepository} from '../../../../src/domains/tesoreria/tesoreria.repository.js';
import {TesoreriaService,type ActorTesoreria} from '../../../../src/domains/tesoreria/tesoreria.service.js';
import {condicionFinanciera,anexoHistorial} from '../../../../src/domains/tesoreria/tesoreria.rules.js';
import {subsanacionSchema} from '../../../../src/domains/tesoreria/tesoreria.schemas.js';
import {generarConstanciaRegistro} from '../../../../src/domains/tesoreria/tesoreria.constancia.js';
import {admisibilidadPublica} from '../../../../src/domains/tramicore/admisibilidadPublica.js';
import {createHash} from 'node:crypto';
const ID='11111111-1111-4111-8111-111111111111',OTRO='22222222-2222-4222-8222-222222222222',KEY='33333333-3333-4333-8333-333333333333';
const ciudadano:ActorTesoreria={usuario:ID,persona:ID,ciudadano:true,permisos:[]};
const datos={documentoId:OTRO,motivo:'Sustento documental de prueba unitaria',claveSolicitud:KEY};
function servicio(respuestas:unknown[][]){
 const query=vi.fn();for(const rows of respuestas)query.mockResolvedValueOnce({rows,rowCount:rows.length});
 const c={query} as unknown as PoolClient,repo=new TesoreriaRepository({} as Pool);
 vi.spyOn(repo,'transaccion').mockImplementation(async fn=>fn(c));const hecho=vi.spyOn(repo,'hecho').mockResolvedValue();
 return {service:new TesoreriaService(repo),query,hecho};
}
describe('Consolidación M10',()=>{
 it('clasifica una ausencia o ambigüedad sin inferir gratuidad',()=>{expect(condicionFinanciera([])).toBe('PENDIENTE_VALIDACION');expect(condicionFinanciera([{importe:'0.00'},{importe:'80.00'}])).toBe('PENDIENTE_VALIDACION');});
 it('solo una tarifa validada cero es gratuita',()=>{expect(condicionFinanciera([{importe:'0.00'}])).toBe('GRATUITO');expect(condicionFinanciera([{importe:'0.01'}])).toBe('SUJETO_PAGO');});
 it('el canal público usa la condición financiera validada, no el importe de la descripción',()=>{
  expect(admisibilidadPublica('Derecho de pago: S/ 124.00',false,'GRATUITO').habilitado).toBe(true);
  expect(admisibilidadPublica('Derecho de pago: S/ 0.00\nFuente verificada: texto heredado',false,'PENDIENTE_VALIDACION').habilitado).toBe(false);
  expect(admisibilidadPublica(null,false,'SUJETO_PAGO').habilitado).toBe(true);
 });
 it('un texto histórico no se interpreta como vínculo documental',()=>{expect(anexoHistorial('PAGO_OBSERVADO','{"documentoId":"'+ID+'"}')).toBeNull();expect(anexoHistorial('PAGO_SUBSANADO','texto histórico')).toBeNull();});
 it('recupera únicamente el sobre estructurado de un anexo versionado',()=>{expect(anexoHistorial('PAGO_SUBSANADO',JSON.stringify({version:1,texto:'Explicación',documentoId:ID}))).toEqual({texto:'Explicación',documentoId:ID});});
 it('el ciudadano no puede imponer estados ni importe en una subsanación',()=>{expect(subsanacionSchema.safeParse({...datos,estado:'VERIFICADO',importe:'0.01'}).success).toBe(false);});
 it('rechaza un anexo sin PDF o explicación suficiente',()=>{expect(subsanacionSchema.safeParse({claveSolicitud:KEY,motivo:'corto'}).success).toBe(false);});
 it('rechaza texto cuyo escape JSON excedería la columna histórica antes de escribir SQL',()=>{expect(subsanacionSchema.safeParse({...datos,motivo:'\\'.repeat(1000)}).success).toBe(false);});
 it('el ejecutor puede reintentar CERRADA sin permiso de evaluador ni una segunda mutación',async()=>{const {service,query,hecho}=servicio([[{id:ID,ciudadano_id:OTRO,estado:'CERRADA'}]]);await expect(service.revisarDevolucion({...ciudadano,permisos:['TESORERIA_DEVOLUCION_EJECUTAR']},ID,{estado:'CERRADA',motivo:'Reintento de cierre autorizado'})).resolves.toMatchObject({estado:'CERRADA'});expect(query).toHaveBeenCalledOnce();expect(hecho).not.toHaveBeenCalled();});
 it('el ciudadano no puede reintentar un cierre administrativo',async()=>{const {service,hecho}=servicio([[{id:ID,ciudadano_id:OTRO,estado:'CERRADA'}]]);await expect(service.revisarDevolucion(ciudadano,ID,{estado:'CERRADA',motivo:'Intento no autorizado de cierre'})).rejects.toMatchObject({status:403});expect(hecho).not.toHaveBeenCalled();});
 it('rechaza subsanar un pago ajeno sin consultar sus documentos',async()=>{const {service,query,hecho}=servicio([[{id:OTRO,ciudadano_id:OTRO,estado:'OBSERVADO'}]]);await expect(service.subsanar(ciudadano,OTRO,datos)).rejects.toMatchObject({status:404});expect(query).toHaveBeenCalledOnce();expect(hecho).not.toHaveBeenCalled();});
 it('no permite alterar un pago verificado mediante subsanación',async()=>{const {service,hecho}=servicio([[{id:ID,ciudadano_id:ID,estado:'VERIFICADO'}],[]]);await expect(service.subsanar(ciudadano,ID,datos)).rejects.toMatchObject({code:'SUBSANACION_NO_ADMITIDA'});expect(hecho).not.toHaveBeenCalled();});
 it('rechaza usar el documento de otra cuenta',async()=>{const {service,hecho}=servicio([[{id:ID,ciudadano_id:ID,estado:'OBSERVADO'}],[],[]]);await expect(service.subsanar(ciudadano,ID,datos)).rejects.toMatchObject({code:'DOCUMENTO_AJENO'});expect(hecho).not.toHaveBeenCalled();});
 it('añade sustento inmutable sin actualizar el pago original ni su estado',async()=>{const {service,query,hecho}=servicio([[{id:ID,ciudadano_id:ID,estado:'OBSERVADO'}],[],[{id:OTRO}]]);await expect(service.subsanar(ciudadano,ID,datos)).resolves.toEqual({id:KEY});expect(query.mock.calls.some(([sql])=>/^\s*(UPDATE|DELETE)\b/.test(sql))).toBe(false);expect(hecho).toHaveBeenCalledWith(expect.anything(),'historial',KEY,ID,'PAGO_SUBSANADO',datos.motivo,ID,undefined,{historialId:KEY,documentoId:OTRO});});
 it('reconoce el reintento del mismo anexo después de la revisión, sin duplicarlo',async()=>{const h={id:KEY,orden_id:ID,actor_id:ID,accion:'PAGO_SUBSANADO',devolucion_id:null,motivo:JSON.stringify({version:1,texto:datos.motivo,documentoId:OTRO})};const {service,hecho}=servicio([[{id:ID,ciudadano_id:ID,estado:'VERIFICADO'}],[h]]);await expect(service.subsanar(ciudadano,ID,datos)).resolves.toEqual({id:KEY});expect(hecho).not.toHaveBeenCalled();});
 it('no reutiliza una clave con distinto sustento',async()=>{const {service,hecho}=servicio([[{id:ID,ciudadano_id:ID,estado:'OBSERVADO'}],[{id:KEY,orden_id:ID,actor_id:ID,accion:'PAGO_SUBSANADO',motivo:'distinto'}]]);await expect(service.subsanar(ciudadano,ID,datos)).rejects.toMatchObject({status:409});expect(hecho).not.toHaveBeenCalled();});
 it('genera un PDF de registro legible sin firma digital ni conexión bancaria',async()=>{const bytes=await generarConstanciaRegistro({codigo:'DEV-FIXTURE-UNITARIA',orden:'OP-FIXTURE-UNITARIA',importe:'10.00',moneda:'PEN',entidad:'PRUEBA - SIN OPERACION BANCARIA',referencia:'FIXTURE',fecha_operacion:new Date('2026-10-30T16:00:00Z'),creada_en:new Date('2026-10-30T16:01:00Z'),documento_enmascarado:'***1234'});const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBe(1);expect(pdf.getTitle()).toContain('DEV-FIXTURE-UNITARIA');});
 it('recupera y analiza documento histórico con paginas NULL sin actualizar el original',async()=>{
  const bytes=Buffer.from(await (async()=>{const p=await PDFDocument.create();p.addPage();p.addPage();return p.save();})());
  const sha=createHash('sha256').update(bytes).digest('hex'),adjunto='44444444-4444-4444-8444-444444444444';
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM sigd_tes.documento WHERE id=$1 FOR UPDATE'))return{rows:[{id:OTRO,nombre:'sustento.pdf',bucket:'sigd-expedientes',clave:'tesoreria/qa.pdf',sha256:sha,bytes:bytes.length,paginas:null}],rowCount:1};
   if(sql.includes('FROM sigd_tra.expediente WHERE'))return{rows:[{expediente_id:ID}],rowCount:1};
   if(sql.includes("codigo='SUSTENTO_DEVOLUCION'"))return{rows:[{tipo_documental_id:ID}],rowCount:1};
   if(sql.includes('FROM sigd_doc.documento_adjunto WHERE s3_bucket'))return{rows:[],rowCount:0};
   if(sql.includes('INSERT INTO sigd_doc.documento_adjunto'))return{rows:[{documento_adjunto_id:adjunto,expediente_id:ID}],rowCount:1};
   if(sql.includes('FROM sigd_tra.expediente_documento_folio WHERE expediente_id=$1 AND id_documento'))return{rows:[],rowCount:0};
   if(sql.includes('+1 folio_inicio'))return{rows:[{folio_inicio:3}],rowCount:1};
   if(sql.includes('INSERT INTO sigd_audit.bitacora_auditoria'))return{rows:[{id_auditoria:KEY}],rowCount:1};
   return{rows:[],rowCount:1};
  });
  const originalFetch=globalThis.fetch;vi.stubGlobal('fetch',vi.fn(async()=>new Response(bytes,{status:200})));
  try{
   const repo=new TesoreriaRepository({} as Pool),service=new TesoreriaService(repo),client={query} as unknown as PoolClient;
   const metodo=(service as unknown as {foliarDocumentoDevolucion:(c:PoolClient,d:string,e:string,doc:string,a:string,et:'SOLICITUD'|'SUBSANACION')=>Promise<{paginas:number;folioInicio:number;folioFin:number}>}).foliarDocumentoDevolucion;
   await expect(metodo.call(service,client,KEY,ID,OTRO,ID,'SOLICITUD')).resolves.toEqual({paginas:2,folioInicio:3,folioFin:4});
   expect(query.mock.calls.some(([sql])=>/^\s*UPDATE\s+sigd_tes\.documento/i.test(sql))).toBe(false);
   expect(query.mock.calls.some(([sql])=>String(sql).includes('ON CONFLICT (s3_bucket,sha256) DO NOTHING'))).toBe(true);
  }finally{vi.stubGlobal('fetch',originalFetch);}
 });
 it('no asocia un SHA-256 deduplicado entre expedientes distintos',async()=>{
  const query=vi.fn(async(sql:string)=>sql.includes('FROM sigd_tes.documento WHERE id=$1 FOR UPDATE')?{rows:[{id:OTRO,nombre:'sustento.pdf',bucket:'b',clave:'k',sha256:'a'.repeat(64),bytes:100,paginas:1}],rowCount:1}:sql.includes('FROM sigd_tra.expediente WHERE')?{rows:[{expediente_id:ID}],rowCount:1}:sql.includes("codigo='SUSTENTO_DEVOLUCION'")?{rows:[{tipo_documental_id:ID}],rowCount:1}:sql.includes('FROM sigd_doc.documento_adjunto WHERE s3_bucket')?{rows:[{documento_adjunto_id:KEY,expediente_id:OTRO}],rowCount:1}:{rows:[],rowCount:1});
  const service=new TesoreriaService(new TesoreriaRepository({} as Pool));
  const metodo=(service as unknown as {foliarDocumentoDevolucion:(c:PoolClient,d:string,e:string,doc:string,a:string,et:'SOLICITUD'|'SUBSANACION')=>Promise<unknown>}).foliarDocumentoDevolucion;
  await expect(metodo.call(service,{query} as unknown as PoolClient,KEY,ID,OTRO,ID,'SOLICITUD')).rejects.toMatchObject({code:'DOCUMENTO_DUPLICADO_OTRO_EXPEDIENTE'});
  expect(query.mock.calls.some(([sql])=>String(sql).startsWith('INSERT'))).toBe(false);
 });
 it('reutiliza el adjunto y la foliación existentes del mismo expediente sin duplicar sus registros',async()=>{
  const query=vi.fn(async(sql:string)=>sql.includes('FROM sigd_tes.documento WHERE id=$1 FOR UPDATE')?{rows:[{id:OTRO,nombre:'sustento.pdf',bucket:'b',clave:'k',sha256:'a'.repeat(64),bytes:100,paginas:2}],rowCount:1}:sql.includes('FROM sigd_tra.expediente WHERE')?{rows:[{expediente_id:ID}],rowCount:1}:sql.includes("codigo='SUSTENTO_DEVOLUCION'")?{rows:[{tipo_documental_id:ID}],rowCount:1}:sql.includes('FROM sigd_doc.documento_adjunto WHERE s3_bucket')?{rows:[{documento_adjunto_id:KEY,expediente_id:ID}],rowCount:1}:sql.includes('FROM sigd_tra.expediente_documento_folio WHERE expediente_id=$1 AND id_documento')?{rows:[{folio_inicio:7,folio_fin:8}],rowCount:1}:sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')?{rows:[{id_auditoria:KEY}],rowCount:1}:{rows:[],rowCount:1});
  const service=new TesoreriaService(new TesoreriaRepository({} as Pool));
  const metodo=(service as unknown as {foliarDocumentoDevolucion:(c:PoolClient,d:string,e:string,doc:string,a:string,et:'SOLICITUD'|'SUBSANACION')=>Promise<unknown>}).foliarDocumentoDevolucion;
  await expect(metodo.call(service,{query} as unknown as PoolClient,KEY,ID,OTRO,ID,'SUBSANACION')).resolves.toEqual({paginas:2,folioInicio:7,folioFin:8});
  expect(query.mock.calls.some(([sql])=>String(sql).startsWith('INSERT INTO sigd_doc.documento_adjunto'))).toBe(false);
  expect(query.mock.calls.some(([sql])=>String(sql).startsWith('INSERT INTO sigd_tra.expediente_documento_folio'))).toBe(false);
  expect(query.mock.calls.filter(([sql])=>String(sql).includes('INSERT INTO sigd_audit.bitacora_auditoria'))).toHaveLength(1);
 });
});
