import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import FileUploadDropzone from '../../components/common/FileUploadDropzone';
import type { UploadedFile } from '../../hooks/usePresignedUpload';

export default function RadicacionLocalPage() {
 const usuario=useAuthStore(s=>s.usuario);
 const [tipos,setTipos]=useState<{id:string;denominacion:string}[]>([]);
 const [tipo,setTipo]=useState(''),[asunto,setAsunto]=useState(''),[folios,setFolios]=useState(1);
 const [archivo,setArchivo]=useState<UploadedFile|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [resultado,setResultado]=useState<{cut:string;expedienteId:string;mensajeLegal:string}|null>(null);
 useEffect(()=>{apiClient.get('/api/v1/tramites/tupa').then(r=>setTipos(r.data)).catch(e=>setError(e.message));},[]);
 async function registrar(e:FormEvent){
  e.preventDefault(); if(!archivo||!usuario?.idPersona)return;
  setBusy(true);setError('');
  try{
   const {data}=await apiClient.post('/api/v1/tramites/radicacion-virtual',{
    idPersona:usuario.idPersona,idTipoTramiteTupa:tipo,nombreSolicitante:usuario.nombreCompleto,
    correo:usuario.correo,asunto,totalFolios:folios,documentos:[{
     nombreArchivo:archivo.file.name,contentType:'application/pdf',tamanoBytes:archivo.file.size,
     hashSha256:archivo.sha256,storagePath:archivo.s3Key,
    }],
   });setResultado(data);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo registrar el expediente.');}
  finally{setBusy(false);}
 }
 if(!usuario?.idPersona)return <main className="p-8"><h1>Mesa de partes virtual</h1><Link to="/login">Iniciar sesión</Link></main>;
 return <main className="max-w-3xl mx-auto p-8 space-y-4">
  <h1 className="text-2xl font-bold">Mesa de partes virtual</h1><p>Solicitante: {usuario.nombreCompleto}</p>
  {error&&<p role="alert">{error}</p>}
  {resultado?<section><h2>Expediente registrado: {resultado.cut}</h2><p>{resultado.mensajeLegal}</p>
   <p><Link to={`/consulta/${resultado.cut}`}>Consultar expediente</Link></p>
   <p><Link to={`/expedientes/${resultado.expedienteId}/seguimiento`}>Ver trazabilidad</Link></p></section>:
  <form onSubmit={registrar} className="space-y-4">
   <label className="block">Tipo de trámite<select required value={tipo} onChange={e=>setTipo(e.target.value)} className="block border p-2 w-full"><option value="">Seleccione un trámite</option>{tipos.map(t=><option key={t.id} value={t.id}>{t.denominacion}</option>)}</select></label>
   <label className="block">Asunto<textarea required minLength={10} maxLength={500} value={asunto} onChange={e=>setAsunto(e.target.value)} className="block border p-2 w-full"/></label>
   <label className="block">Total de folios<input type="number" min={1} max={5000} required value={folios} onChange={e=>setFolios(Number(e.target.value))} className="block border p-2"/></label>
   <FileUploadDropzone onUploaded={setArchivo} onStatusChange={status=>{if(status!=='success')setArchivo(null);}}/>
   <button disabled={busy||!archivo} className="bg-blue-700 text-white p-3 rounded disabled:opacity-50">{busy?'Registrando…':'Registrar expediente'}</button>
  </form>}
 </main>;
}
