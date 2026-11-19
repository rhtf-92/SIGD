import { useState } from 'react';
import type { IdentificacionData } from '../../types/tramiteWizardState';
import { publicDraftOwner,publicRequest,publicSession } from '../../services/radicacionPublicaService';
import { claveSolicitudTesoreria } from '../../services/tesoreriaService';
interface OrdenPublica {id:string;codigo:string;importe:string;concepto:string;estado_pago?:string;aplicada:boolean;en_devolucion:boolean}
export default function OrdenPagoPublica({procedimiento,identidad,value,onChange}:{procedimiento:string;identidad:IdentificacionData;value?:string;onChange:(v:string|undefined)=>void}){
 const [orden,setOrden]=useState<OrdenPublica|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[consentimiento,setConsentimiento]=useState(false),[recibos,setRecibos]=useState<Array<{id:string;numeroRecibo:number;referencia:string;fechaOperacion:string;importe:string;nombre:string;url:string}>>([]);
 async function consultar(crear=false){setBusy(true);setError('');try{
  const token=await publicSession();const id=value??orden?.id;
  const response=await publicRequest<OrdenPublica>(crear?'/ordenes':'/ordenes/'+id,{
   method:crear?'POST':'GET',headers:{'X-SIGD-Public-Session':token},...(crear?{body:JSON.stringify({procedimientoId:procedimiento,
    claveSolicitud:claveSolicitudTesoreria(publicDraftOwner(),'orden:'+procedimiento),tipoDocumento:identidad.tipoDocumento,numeroDocumento:identidad.numeroDocumento,
    nombres:identidad.nombres.trim(),apellidos:identidad.apellidos.trim(),correo:identidad.correo.trim(),telefono:identidad.telefono.trim(),declaracionVeracidad:consentimiento,aceptaTerminos:consentimiento})}:{})});
  const o=response.data;setOrden(o);onChange(o.estado_pago==='VERIFICADO'&&!o.aplicada&&!o.en_devolucion?o.id:undefined);
 }catch(e){setError(e instanceof Error?e.message:'No se pudo consultar la orden.');}finally{setBusy(false);}}
 const consultarRecibos=async()=>{if(!orden)return;setBusy(true);setError('');try{const r=await publicRequest<{items:Array<{id:string;numeroRecibo:number;referencia:string;fechaOperacion:string;importe:string;nombre:string;url:string}>}>('/ordenes/'+orden.id+'/recibos',{headers:{'X-SIGD-Public-Session':await publicSession()}});setRecibos(r.data.items);}catch(e){setError(e instanceof Error?e.message:'No se pudieron consultar los recibos.');}finally{setBusy(false);}};
 return <section aria-label="Pago público en efectivo" className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
  <h3 className="font-semibold">Orden pública de pago en caja</h3><p>No necesita crear una cuenta. Conserve este navegador y no comparta la sesión del formulario. La sesión pública tiene vigencia limitada; si vence después de pagar, solicite recuperación segura en Tesorería.</p>
  {!orden&&!value&&<><label className="block"><input type="checkbox" checked={consentimiento} onChange={e=>setConsentimiento(e.target.checked)}/> Declaro que mis datos son veraces y acepto su tratamiento para emitir la orden de pago.</label><button type="button" disabled={busy||!consentimiento} onClick={()=>void consultar(true)} className="font-semibold text-[#006EC7] underline">Generar orden pública para caja</button></>}
  {orden&&<p>{orden.codigo} · S/ {orden.importe} · {orden.concepto} · {orden.estado_pago??'PENDIENTE'}</p>}
  {(orden||value)&&<button type="button" disabled={busy} onClick={()=>void consultar()} className="mr-3 font-semibold text-[#006EC7] underline">Comprobar recepción de efectivo</button>}
  {orden?.estado_pago==='VERIFICADO'&&<button type="button" disabled={busy} onClick={()=>void consultarRecibos()} className="text-[#006EC7] underline">Consultar recibos internos</button>}
  {recibos.length>0&&<ul aria-label="Recibos verificados" className="space-y-1 border-t border-blue-200 pt-2">{recibos.map(r=><li key={r.id}><a href={r.url} target="_blank" rel="noreferrer" className="text-[#006EC7] underline">Recibo {r.numeroRecibo} · {r.referencia} · S/ {r.importe} · {new Date(r.fechaOperacion).toLocaleString('es-PE')}</a></li>)}</ul>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
