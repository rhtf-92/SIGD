import { useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import {
  avanzarExpediente,
  buscarExpediente,
  mensajeDeErrorAtencion,
  obtenerTrazabilidad,
  type ExpedienteAtencion,
  type MovimientoAtencion,
} from "../../services/atencionService";

// La firma con DNIe esta en espera: el evento FIRMA no se ofrece en pantalla.
const EVENTOS_OCULTOS = ["FIRMA", "CIERRE"];

export default function AtencionPage() {
  const [cut, setCut] = useState("");
  const [expediente, setExpediente] = useState<ExpedienteAtencion | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoAtencion[]>([]);
  const [resumen, setResumen] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function cargar(valorCut: string) {
    const exp = await buscarExpediente(valorCut);
    setExpediente(exp);
    setMovimientos(await obtenerTrazabilidad(exp.expedienteId));
  }

  async function buscar() {
    setError("");
    setMensaje("");
    setExpediente(null);
    setMovimientos([]);
    setOcupado(true);
    try {
      await cargar(cut.trim().toUpperCase());
    } catch (e) {
      setError(mensajeDeErrorAtencion(e));
    } finally {
      setOcupado(false);
    }
  }

  async function avanzar(evento: string) {
    if (!expediente) return;
    if (resumen.trim().length < 3) {
      setError("Escriba un resumen de la actuacion (minimo 3 caracteres).");
      return;
    }
    setError("");
    setMensaje("");
    setOcupado(true);
    try {
      await avanzarExpediente(expediente.expedienteId, evento, resumen.trim());
      setResumen("");
      await cargar(expediente.cut);
      setMensaje("Movimiento registrado.");
    } catch (e) {
      setError(mensajeDeErrorAtencion(e));
    } finally {
      setOcupado(false);
    }
  }

  const visibles = expediente?.transiciones.filter((t) => !EVENTOS_OCULTOS.includes(t.evento)) ?? [];
  const firmaPendiente = expediente?.transiciones.some((t) => t.evento === "FIRMA") ?? false;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Atencion de expedientes"
        description="Avance un expediente por su recorrido y revise la trazabilidad registrada en la base de datos."
      />
      <section className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="cut-atencion">
            CUT del expediente
          </label>
          <div className="flex gap-3">
            <input
              id="cut-atencion"
              value={cut}
              onChange={(ev) => setCut(ev.target.value)}
              placeholder="EXP-2026-000009"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={() => void buscar()}
              disabled={ocupado}
              className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Buscar
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {mensaje && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
            {mensaje}
          </p>
        )}

        {expediente && (
          <>
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Expediente</p>
              <p className="font-mono text-lg font-bold">{expediente.cut}</p>
              <p className="mt-2 text-sm">
                Estado actual: <span className="font-semibold">{expediente.estado.replace(/_/g, " ")}</span>
              </p>

              {visibles.length > 0 && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-semibold" htmlFor="resumen-atencion">
                    Resumen de la actuacion
                  </label>
                  <input
                    id="resumen-atencion"
                    value={resumen}
                    onChange={(ev) => setResumen(ev.target.value)}
                    maxLength={300}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {visibles.map((t) => (
                      <button
                        key={t.evento}
                        type="button"
                        disabled={ocupado}
                        onClick={() => void avanzar(t.evento)}
                        className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {t.evento.replace(/_/g, " ")} → {t.estadoNuevo.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {firmaPendiente && (
                <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
                  Firma electronica pendiente: la firma con DNIe y QR esta en espera hasta contar con el lector.
                  No se simula.
                </p>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Trazabilidad</h2>
              {movimientos.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Sin movimientos registrados todavia.</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {movimientos.map((m) => (
                    <li key={m.secuencia} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="font-semibold">
                        {m.secuencia}. {m.evento.replace(/_/g, " ")} → {m.estadoNuevo.replace(/_/g, " ")}
                      </p>
                      <p className="text-slate-600">
                        {new Date(m.fechaHora).toLocaleString("es-PE", { timeZone: "America/Lima" })} · {m.usuario ?? "—"}
                      </p>
                      {m.resumen && <p className="mt-1">{m.resumen}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}