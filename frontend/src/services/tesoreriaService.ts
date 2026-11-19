import { apiClient } from '../api/client';
export interface DocumentoFinanciero { id:string; nombre:string; sha256:string; bytes:number }
export interface TarifaFinanciera { id:string; importe:string; concepto:string; fuente:string }
export type CondicionFinanciera='GRATUITO'|'SUJETO_PAGO'|'PENDIENTE_VALIDACION';
export interface CatalogoFinanciero { id:string; codigo:string; denominacion:string; descripcion?:string; unidad_organica?:string;vigente?:boolean;requisitos?:{codigo:string;denominacion:string;obligatorio:boolean}[];condicionFinanciera?:CondicionFinanciera; tarifas:TarifaFinanciera[] }
export interface DevolucionFinanciera { id:string; codigo:string; estado:string; importe:string; motivo:string; sustento:string; documento_id?:string; constancia_id?:string; orden_devolucion_codigo?:string|null; aprobada_por?:string|null; aprobada_en?:string|null; acciones?:string[] }
export interface OrdenFinanciera { id:string; codigo:string; importe:string; moneda:string; concepto:string; tipo_tramite_id:string; procedimiento:string; denominacion:string; creado_en:string; documento_solicitante?:string;nombre_solicitante?:string;
 estado_pago?:string; pago_id?:string; referencia?:string; documento_id?:string; cut?:string; devoluciones:DevolucionFinanciera[] }
export interface CapacidadesFinancieras { ciudadano:boolean; permisos:string[];funcionalidades?:{subsanacionesVersionadas?:boolean;condicionFinanciera?:boolean;constanciaRegistro?:boolean;efectivoCaja?:boolean} }
export interface TarifaAdministrativa extends TarifaFinanciera { codigo:string; estado:string; vigente_desde:string; vigente_hasta?:string; evidencia_id:string|null }
export interface DetalleFinanciero { orden:OrdenFinanciera; pago:{id:string;estado:string;caja_id?:string;efectivo_recibido?:string;vuelto?:string;documento_id:string;referencia:string}|null; pagos?:{id:string;estado:string;documento_id:string;referencia:string;numero_recibo:string;fecha_operacion:string;importe_aplicado:string}[]; historial:{id:string;accion:string;motivo:string;creado_en:string}[]; devoluciones:DevolucionFinanciera[];anexos?:{id:string;documentoId:string;motivo:string;devolucionId?:string;creadoEn:string}[] }
/** Presentation only: all tariffs come from the server's validated catalogue. */
export function condicionDeTarifa(t:CatalogoFinanciero):CondicionFinanciera{
 if(!Array.isArray(t.tarifas)||t.tarifas.length!==1||! /^(?:0|[1-9]\d{0,11})\.\d{2}$/.test(t.tarifas[0].importe))return 'PENDIENTE_VALIDACION';
 return BigInt(t.tarifas[0].importe.replace('.',''))===0n?'GRATUITO':'SUJETO_PAGO';
}
export function saldoDevolucion(total:string,devoluciones:DevolucionFinanciera[]):{importe:string;admiteSolicitud:boolean}{
 const cents=(v:string)=>BigInt(v.replace('.',''));
 const saldo=cents(total)-devoluciones.filter(d=>d.estado!=='RECHAZADA').reduce((a,d)=>a+cents(d.importe),0n);
 const importe=saldo>0n?`${saldo/100n}.${String(saldo%100n).padStart(2,'0')}`:'0.00';
 return {importe,admiteSolicitud:saldo>0n&&!devoluciones.some(d=>!['RECHAZADA','DEVUELTA','CERRADA'].includes(d.estado))};
}
export interface ReporteFinanciero { periodo:{desde:string;hasta:string}; nota:string; pagos:{codigo:string;estado:string;operaciones:number;importe:string}[]; devoluciones:{estado:string;solicitudes:number;importe:string}[] }
const ROOT='/api/v1/tesoreria';
const clavesEnMemoria=new Map<string,string>();
/** Preserve request identity over reload/retry, isolated by account and operation. No PII is stored. */
export function claveSolicitudTesoreria(owner:string,operacion:string,nueva=false):string{
 const key='SIGD_TES_SOLICITUD:'+owner+':'+operacion;
 let previous=clavesEnMemoria.get(key);
 try{previous=sessionStorage.getItem(key)??previous;}catch{/* in-memory fallback */}
 const value=!nueva&&previous&&/^[0-9a-f-]{36}$/i.test(previous)?previous:crypto.randomUUID();
 clavesEnMemoria.set(key,value);try{sessionStorage.setItem(key,value);}catch{/* in-memory fallback */}return value;
}
export async function tesGet<T>(path:string):Promise<T>{return(await apiClient.get<T>(ROOT+path)).data;}
export async function tesPost<T>(path:string,body:unknown):Promise<T>{return(await apiClient.post<T>(ROOT+path,body)).data;}
export async function descargarConstanciaDevolucion(id:string):Promise<void>{
 const r=await apiClient.get<Blob>(ROOT+'/devoluciones/'+encodeURIComponent(id)+'/constancia',{responseType:'blob'});
 const url=URL.createObjectURL(r.data);try{const a=document.createElement('a');a.href=url;a.download='constancia-devolucion.pdf';a.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export async function cargarDocumentoFinanciero(file:File):Promise<DocumentoFinanciero>{
 if(!file.name.toLowerCase().endsWith('.pdf')||file.size===0||file.size>20*1024*1024)throw new Error('Adjunte un PDF de hasta 20 MB.');
 const bytes=await file.arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('El archivo no tiene formato PDF.');
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const response=await apiClient.post<DocumentoFinanciero>(ROOT+'/documentos',file,{headers:{'Content-Type':'application/pdf','X-SIGD-File-Name':encodeURIComponent(file.name)},timeout:45000});
 if(response.data.sha256!==sha||response.data.bytes!==file.size)throw new Error('El almacenamiento no confirmó la integridad del documento.');
 return response.data;
}
