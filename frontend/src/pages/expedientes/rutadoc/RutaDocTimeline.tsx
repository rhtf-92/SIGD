import type { Trazabilidad } from "./rutadoc.dto";
import { FechaRutaDoc, IdentificadorRutaDoc } from "./RutaDocEstado";
export default function RutaDocTimeline({ datos }: { datos: Trazabilidad }) {
  if (!datos.actuaciones.length) return <p>Sin actuaciones registradas.</p>;
  return <ol className="space-y-4">{datos.actuaciones.map(a =>
    <li key={a.movimientoId} className="rounded border p-3">
      <p>{a.evento} · {a.tipoActuacion}</p>
      <p>{a.estadoAnterior} → {a.estadoNuevo} · <FechaRutaDoc valor={a.fechaHora} /></p>
      <div>Movimiento UUID: <IdentificadorRutaDoc valor={a.movimientoId} /></div><p className="break-all">Secuencia: {a.secuencia}</p>
      <div>Operador: <IdentificadorRutaDoc valor={a.usuarioOperadorId} /></div>
      <div>Área: <IdentificadorRutaDoc valor={a.areaAnteriorId} /> → <IdentificadorRutaDoc valor={a.areaDestinoId} /></div>
      {a.remitente && <p>Remitente: {a.remitente}</p>}
      {a.destinatario && <p>Destinatario: {a.destinatario}</p>}
      {a.duracionMinutos !== null && <p>Duración: {a.duracionMinutos} minutos</p>}
      {typeof a.proveido === "string" && <p>{a.proveido}</p>}
    </li>)}</ol>;
}
