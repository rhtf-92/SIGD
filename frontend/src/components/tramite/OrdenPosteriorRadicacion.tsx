import { useState } from 'react';
import { apiClient } from '../../api/client';
import { publicRequest, publicTrackingHeaders } from '../../services/radicacionPublicaService';
export interface EstadoOrdenPosterior {estado:string;ordenId?:string;codigo?:string;importe?:string;moneda?:string;mensaje:string}
export function OrdenPosteriorRadicacion({expedienteId,cut,publico,inicial}:{expedienteId:string;cut:string;publico:boolean;inicial?:EstadoOrdenPosterior}){
 const [estado,setEstado]=useState(inicial),[cantidad,setCantidad]=useState(''),[ocupado,setOcupado]=useState(false),[error,setError]=useState('');
 async function reintentar(){setOcupado(true);setError('');try{
  const data=cantidad?{cantidad:Number(cantidad)}:{};
  const response=publico?await publicRequest<EstadoOrdenPosterior>(`/expedientes/${expedienteId}/orden-pago`,{method:'POST',headers:publicTrackingHeaders(cut),body:JSON.stringify(data)}):await apiClient.post<EstadoOrdenPosterior>(`/api/v1/tramites/${expedienteId}/orden-pago`,data);
  setEstado(response.data);
 }catch{setError('No se pudo obtener la orden. Su expediente y CUT permanecen registrados; puede reintentar.');}finally{setOcupado(false);}}
 return <section aria-label="Tesorería posterior a la radicación" className="my-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-left text-sm">
  <h3 className="font-semibold">Tesorería — expediente {cut}</h3>
  <p role="status">{estado?.mensaje??'Su expediente está recibido. Consulte la orden posterior a la radicación.'}</p>
  {estado?.codigo&&<p>Orden: {estado.codigo} · S/ {estado.importe}</p>}
  {estado?.estado==='REQUIERE_CANTIDAD'&&<label className="block">Cantidad de unidades según la tarifa<input type="number" min={1} max={10000} step={1} value={cantidad} onChange={e=>setCantidad(e.target.value)} className="ml-2 rounded border p-1"/></label>}
  {estado?.estado!=='GRATUITO'&&<button type="button" disabled={ocupado} onClick={()=>void reintentar()} className="mt-2 font-semibold text-blue-800 underline">{ocupado?'Consultando…':estado?.ordenId?'Actualizar estado de la orden':'Consultar o generar orden de pago'}</button>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
