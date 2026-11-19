import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { claveSolicitudTesoreria, tesGet, tesPost } from '../../services/tesoreriaService';

interface Caja {id:string;saldo_inicial:string;saldo_esperado:string;demostracion:boolean;abierta_en:string;cerrada_en?:string;efectivo_contado?:string;diferencia?:string}
interface EstadoCaja {actual:Caja|null;cajas:Caja[];movimientos:{id:string;tipo:string;importe:string;creado_en:string}[]}
const input='w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
const boton='rounded-lg bg-[#006EC7] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
export function vueltoVisual(importe:string,recibido:string):string|null{
 if(!/^\d{1,12}\.\d{2}$/.test(importe)||!/^\d{1,12}\.\d{2}$/.test(recibido))return null;
 const n=BigInt(recibido.replace('.',''))-BigInt(importe.replace('.',''));return n<0n?null:`${n/100n}.${String(n%100n).padStart(2,'0')}`;
}
export function CobroEfectivo({importe,busy,onConfirmar}:{importe:string;busy:boolean;onConfirmar:(recibido:string)=>void}){
 const [recibido,setRecibido]=useState('');const vuelto=vueltoVisual(importe,recibido);
 return <form className="grid gap-3 rounded-lg border bg-slate-50 p-4 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();onConfirmar(recibido);}}>
  <h3 className="font-semibold sm:col-span-2">Recepción de efectivo en caja</h3><p>Tarifa oficial: S/ {importe}</p>
  <label className="text-sm">Efectivo recibido (dos decimales)<input className={input} name="efectivoRecibido" inputMode="decimal" value={recibido} onChange={e=>setRecibido(e.target.value)} required/></label>
  <p aria-live="polite">Vuelto: {vuelto===null?'Ingrese un importe suficiente con dos decimales.':'S/ '+vuelto}</p>
  <label className="text-sm"><input type="checkbox" required/> Confirmo la recepción efectiva del dinero. En demostración, este registro es un ensayo sin dinero real.</label>
  <button className={boton} disabled={busy||vuelto===null}>Confirmar recepción de efectivo</button>
 </form>;
}
export function CajaTesoreria({puedeOperar=true}:{puedeOperar?:boolean}){
 const owner=useAuthStore(s=>s.usuario?.id)??'sin-cuenta';
 const [estado,setEstado]=useState<EstadoCaja|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[version,setVersion]=useState(0);
 useEffect(()=>{let active=true;tesGet<EstadoCaja>('/caja').then(d=>{if(active)setEstado(d);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudo consultar caja.');});return()=>{active=false;};},[version]);
 const guardar=async(path:string,body:unknown)=>{if(busy)return;setBusy(true);setError('');try{await tesPost(path,body);setVersion(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'No se pudo registrar.');}finally{setBusy(false);}};
 return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Caja y movimientos de efectivo</h2>
  {error&&<p role="alert" className="text-red-800">{error}</p>}
  {estado?.actual?<><p>{estado.actual.demostracion?'CAJA DE DEMOSTRACIÓN · SIN DINERO REAL':'Caja abierta'} · Saldo inicial S/ {estado.actual.saldo_inicial} · Saldo esperado S/ {estado.actual.saldo_esperado}</p>
    {puedeOperar&&<form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void guardar('/caja/'+estado.actual!.id+'/cierre',{efectivoContado:String(d.get('contado')),observaciones:String(d.get('observaciones'))});}}>
    <label>Efectivo contado<input className={input} name="contado" inputMode="decimal" required pattern="[0-9]+\.[0-9]{2}"/></label>
    <label>Observaciones del cierre (mínimo 10 caracteres)<input className={input} name="observaciones" required minLength={10}/></label>
     <button className={boton} disabled={busy||!puedeOperar}>Cerrar caja</button>
    </form>}
  </>:estado&&puedeOperar&&<form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();const saldoInicial=String(new FormData(e.currentTarget).get('saldo'));void guardar('/caja',{saldoInicial,claveSolicitud:claveSolicitudTesoreria(owner,'apertura-caja')});}}><label>Saldo inicial declarado<input className={input} name="saldo" inputMode="decimal" required pattern="[0-9]+\.[0-9]{2}"/></label><button className={boton} disabled={busy||!puedeOperar}>Abrir caja</button><button type="button" className="text-sm underline" onClick={()=>{claveSolicitudTesoreria(owner,'apertura-caja',true);setError('Se preparó una nueva apertura independiente.');}}>Preparar siguiente apertura</button></form>}
  {estado?.movimientos.map(m=><p className="border-t py-2 text-sm" key={m.id}>{m.tipo} · S/ {m.importe} · {new Date(m.creado_en).toLocaleString('es-PE',{timeZone:'America/Lima'})}</p>)}
  <h3 className="font-semibold">Historial de cajas</h3>{estado?.cajas.map(c=><p className="border-t py-2 text-sm" key={c.id}>{new Date(c.abierta_en).toLocaleString('es-PE',{timeZone:'America/Lima'})} · {c.cerrada_en?`Cerrada · Contado S/ ${c.efectivo_contado} · Diferencia S/ ${c.diferencia}`:'Abierta'}{c.demostracion?' · DEMOSTRACIÓN':''}</p>)}
 </section>;
}
