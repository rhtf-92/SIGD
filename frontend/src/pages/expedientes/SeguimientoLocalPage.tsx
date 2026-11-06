import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Download, LoaderCircle } from 'lucide-react';
type Actuacion={movimientoId:string;secuencia:string;fechaHora:string;evento:string;estadoAnterior:string;estadoNuevo:string};
type Documento={id:string;nombreArchivo:string;downloadUrl:string};
function DescargarPdf({documento}: {documento:Documento}) {
 const [abriendo,setAbriendo]=useState(false);
 useEffect(()=>{
  const volver=()=>setAbriendo(false);
  window.addEventListener('focus',volver);
  return ()=>window.removeEventListener('focus',volver);
 },[]);
 return <li className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
  <p className="mb-3 break-words text-sm font-medium text-slate-700">{documento.nombreArchivo}</p>
  <a href={documento.downloadUrl} target="_blank" rel="noreferrer"
   onClick={()=>setAbriendo(true)} aria-describedby={'descarga-'+documento.id}
   className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-blue-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 active:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 focus-visible:ring-offset-2 sm:w-auto">
   {abriendo ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true"/> : <Download className="h-5 w-5" aria-hidden="true"/>}
   Descargar PDF
  </a>
  <p id={'descarga-'+documento.id} role="status" aria-live="polite" className="mt-2 text-sm text-slate-600">
   {abriendo ? 'Abriendo PDF en otra pestaña… El navegador gestiona la descarga.' : 'El PDF se abre en otra pestaña.'}
  </p>
 </li>;
}
export default function SeguimientoLocalPage(){
 const {id}=useParams();const [items,setItems]=useState<Actuacion[]>([]),[error,setError]=useState('');
 const [detalle,setDetalle]=useState<{cut:string;asunto:string;estadoActual:string}|null>(null);
 const [documentos,setDocumentos]=useState<Documento[]>([]);
 useEffect(()=>{let vigente=true;Promise.all([
  apiClient.get(`/api/v1/expedientes/${id}/trazabilidad`),
  apiClient.get(`/api/v1/expedientes/${id}`),
  apiClient.get(`/api/v1/expedientes/${id}/documentos`),
 ]).then(([trace,exp,docs])=>{if(vigente){setItems(trace.data.actuaciones);setDetalle(exp.data);setDocumentos(docs.data);}})
 .catch(e=>{if(vigente)setError(e.message);});return ()=>{vigente=false;};},[id]);
 return <main className="max-w-3xl mx-auto p-4 sm:p-8"><h1 className="text-2xl font-bold">Trazabilidad del expediente</h1>
  {detalle&&<section><h2>{detalle.cut}</h2><p>{detalle.asunto}</p><p>Estado: {detalle.estadoActual}</p></section>}
  <ul aria-label="Documentos adjuntos" className="my-5 space-y-3">{documentos.map(d=><DescargarPdf key={d.id} documento={d}/>)}</ul>
  {error&&<p role="alert">{error}</p>}<ol>{items.map(a=><li key={a.movimientoId} className="border p-4 my-4">
   <strong>{a.evento}</strong><p>{a.estadoAnterior} → {a.estadoNuevo}</p><p>{new Date(a.fechaHora).toLocaleString()}</p><p>Secuencia {a.secuencia}</p>
  </li>)}</ol><Link to="/tramite/mesa-partes-virtual">Volver a mesa de partes</Link></main>;
}
