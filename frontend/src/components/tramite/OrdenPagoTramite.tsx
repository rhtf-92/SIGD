import { useEffect,useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { tesGet,tesPost,claveSolicitudTesoreria,condicionDeTarifa,type CatalogoFinanciero,type OrdenFinanciera } from '../../services/tesoreriaService';

export default function OrdenPagoTramite({procedimiento,value,onChange,onCondicion}:{procedimiento:string;value?:string;onChange:(value:string|undefined)=>void;onCondicion?:(procedimiento:string,gratis:boolean)=>void}){
 const [ordenes,setOrdenes]=useState<OrdenFinanciera[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [consultado,setConsultado]=useState(false);
 const cuenta=useAuthStore(s=>s.usuario?.id);
 const [tarifa,setTarifa]=useState<CatalogoFinanciero|null>(null);
 useEffect(()=>{let vigente=true;if(procedimiento)tesGet<CatalogoFinanciero[]>('/catalogo').then(rows=>{if(!vigente)return;const t=rows.find(r=>r.id===procedimiento)??null;setTarifa(t);onCondicion?.(procedimiento,Boolean(t&&condicionDeTarifa(t)==='GRATUITO'));}).catch(()=>{if(vigente)onCondicion?.(procedimiento,false);});return()=>{vigente=false;};},[procedimiento,cuenta,onCondicion]);
 async function consultar(){setBusy(true);setError('');try{
  const disponibles:OrdenFinanciera[]=[];let pagina=1,hayMas=true;
  while(hayMas){const data=await tesGet<{items:(OrdenFinanciera&{ciudadano_id:string})[];hayMas?:boolean}>('/ordenes?'+new URLSearchParams({pagina:String(pagina),...(tarifa?{buscar:tarifa.codigo}:{})}));disponibles.push(...data.items.filter(o=>o.ciudadano_id===cuenta&&o.tipo_tramite_id===procedimiento&&!o.cut&&(o.estado_pago==='VERIFICADO'||o.importe==='0.00')&&!o.devoluciones.some(d=>d.estado!=='RECHAZADA')));hayMas=Boolean(data.hayMas);pagina++;}
  setOrdenes(disponibles);
  setConsultado(true);
 }catch(e){setError(e instanceof Error?e.message:'No se pudo consultar la condición de pago.');}finally{setBusy(false);}}
 async function generar(){if(!cuenta)return;setBusy(true);setError('');try{const o=await tesPost<{id:string}>('/ordenes',{procedimientoId:procedimiento,claveSolicitud:claveSolicitudTesoreria(cuenta,'orden:'+procedimiento)});window.location.assign('/tesoreria?orden='+encodeURIComponent(o.id));}catch(e){setError(e instanceof Error?e.message:'No se pudo generar la orden.');}finally{setBusy(false);}}
 if(!procedimiento)return null;
 return <section aria-label="Condición económica del trámite" className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
  <h3 className="font-semibold">Orden de pago verificada</h3><p>Vincule una orden propia para este procedimiento. El pago se realiza exclusivamente en efectivo en caja; el TESORERO confirma su recepci?n. La omisión demostrativa, cuando esté habilitada por el servidor, no registra un pago.</p>
  {tarifa&&<p role="status">{condicionDeTarifa(tarifa)==='GRATUITO'?'Gratuito: no necesita una orden de pago.':condicionDeTarifa(tarifa)==='SUJETO_PAGO'?`Sujeto a pago: S/ ${tarifa.tarifas[0].importe}. Requiere verificación de Tesorería.`:'Pendiente de validación financiera: no se autoriza un cobro.'}</p>}
  {tarifa&&condicionDeTarifa(tarifa)==='SUJETO_PAGO'&&<button type="button" disabled={busy} onClick={()=>void generar()} className="font-semibold text-[#006EC7] underline">Generar orden para pagar en caja</button>}
  <div className="flex flex-wrap gap-3"><button type="button" disabled={busy||!procedimiento} onClick={()=>void consultar()} className="font-semibold text-[#006EC7] underline">{busy?'Consultando…':'Consultar mis órdenes disponibles'}</button><a href="/tesoreria" className="font-semibold text-[#006EC7] underline">Ir a Mis pagos</a></div>
  {error&&<p role="alert">{error}</p>}
  {(consultado||value)&&<label className="block">Orden para aplicar<select className="mt-1 block w-full rounded border bg-white p-2" value={value??''} onChange={e=>onChange(e.target.value||undefined)}><option value="">Sin orden vinculada</option>{value&&!ordenes.some(o=>o.id===value)&&<option value={value}>Orden guardada: {value}; compruebe disponibilidad</option>}{ordenes.map(o=><option value={o.id} key={o.id}>{o.codigo} · S/ {o.importe}</option>)}</select></label>}
 </section>;
}
