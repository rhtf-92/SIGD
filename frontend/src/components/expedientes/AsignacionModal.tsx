import { useEffect, useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import AccionModal from "./AccionModal";
import { adaptarErrorAccion } from "../../utils/expedienteActions";
import type { ExpedienteAccionReferencia } from "../../types/expedienteActions";

export interface CandidatoAsignacion {
  idUsuario: string;
  idPersona: string;
  usuario: string;
  nombreCompleto: string;
  rolCodigo: string;
  perfilCodigo: string | null;
  alcance: any;
  esPrioritario: boolean;
}

export interface AsignacionData {
  ok: boolean;
  activa: {
    idAsignacion: string;
    idPersona: string;
    idUsuario: string;
    usuario: string;
    nombreCompleto: string;
    motivo: string;
    asignadoEn: string;
  } | null;
  historial: Array<{
    idAsignacion: string;
    usuario: string;
    nombreCompleto: string;
    motivo: string;
    asignadoEn: string;
    activo: boolean;
  }>;
  candidatos: CandidatoAsignacion[];
}

export interface AsignacionModalProps {
  open: boolean;
  expediente: ExpedienteAccionReferencia;
  onClose: () => void;
  onAsignado: () => void;
}

export default function AsignacionModal(props: AsignacionModalProps) {
  return props.open ? <FormularioAsignacion key={props.expediente.id} {...props} /> : null;
}

function FormularioAsignacion({ expediente, onClose, onAsignado }: AsignacionModalProps) {
  const id = useId();
  const [selectedUsuarioId, setSelectedUsuarioId] = useState<string>("");
  const [motivo, setMotivo] = useState(
    "Asignación para evaluación y dictamen técnico conforme al TUPA"
  );
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<AsignacionData>({
    queryKey: ["rutadoc", expediente.id, "asignacion"],
    queryFn: async () => {
      const res = await apiClient.get<AsignacionData>(
        `/api/v1/expedientes/${encodeURIComponent(expediente.id)}/asignacion`
      );
      return res.data;
    },
    staleTime: 10_000,
  });

  const candidatos = data?.candidatos ?? [];

  // Auto-seleccionar el candidato prioritario si no hay selección
  useEffect(() => {
    if (!selectedUsuarioId && candidatos.length > 0) {
      const prioritario = candidatos.find((c) => c.esPrioritario) ?? candidatos[0];
      setSelectedUsuarioId(prioritario.idUsuario);
    }
  }, [candidatos, selectedUsuarioId]);

  const candidatoSeleccionado = candidatos.find((c) => c.idUsuario === selectedUsuarioId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!candidatoSeleccionado || enviando) return;

    setEnviando(true);
    setErrorEnvio(null);

    try {
      await apiClient.post(
        `/api/v1/expedientes/${encodeURIComponent(expediente.id)}/asignar`,
        {
          idPersona: candidatoSeleccionado.idPersona,
          idUsuario: candidatoSeleccionado.idUsuario,
          motivo: motivo.trim() || "Asignación operativa de expediente",
        }
      );
      onAsignado();
      onClose();
    } catch (err: any) {
      console.error("Error al asignar expediente:", err);
      const adaptado = adaptarErrorAccion(err);
      setErrorEnvio(adaptado.message || "No se pudo completar la asignación del expediente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AccionModal
      titulo="Asignar Expediente a Especialista"
      descripcion={`Expediente ${expediente.codigo}. Despacho interno a un especialista o responsable técnico del área.`}
      pending={enviando}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {data?.activa && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900">
            <span className="font-bold">Asignación actual: </span>
            <span>{data.activa.nombreCompleto} ({data.activa.usuario})</span>
            <p className="text-[11px] text-blue-700 mt-0.5">
              Motivo previo: {data.activa.motivo} (desde {new Date(data.activa.asignadoEn).toLocaleDateString("es-PE")})
            </p>
          </div>
        )}

        {isLoading && (
          <div className="p-4 text-center text-xs text-slate-500">
            Cargando especialistas elegibles del área...
          </div>
        )}

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-800 rounded-lg border border-rose-200">
            Error al consultar los especialistas del área.
          </div>
        )}

        {errorEnvio && (
          <div className="p-3 text-xs bg-rose-50 text-rose-800 rounded-lg border border-rose-200">
            {errorEnvio}
          </div>
        )}

        {!isLoading && candidatos.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
            No se encontraron especialistas disponibles adscritos a esta unidad orgánica.
          </div>
        )}

        {!isLoading && candidatos.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Especialistas Elegibles del Área ({candidatos.length})
            </label>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {candidatos.map((c) => {
                const isSelected = c.idUsuario === selectedUsuarioId;
                const funcion = c.alcance?.funcion ? String(c.alcance.funcion) : null;
                return (
                  <div
                    key={c.idUsuario}
                    onClick={() => setSelectedUsuarioId(c.idUsuario)}
                    className={`cursor-pointer rounded-xl border p-3 transition text-xs flex items-start gap-3 ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/90 ring-1 ring-indigo-500"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="candidato"
                      checked={isSelected}
                      onChange={() => setSelectedUsuarioId(c.idUsuario)}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-slate-900">{c.nombreCompleto}</span>
                        <span className="text-[11px] text-slate-500 font-mono">(@{c.usuario})</span>
                        {c.esPrioritario && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            ★ Prioritario TUPA
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 flex flex-wrap gap-2">
                        <span>Rol: <strong className="text-slate-800">{c.rolCodigo}</strong></span>
                        {c.perfilCodigo && <span>Perfil: <strong className="text-slate-800">{c.perfilCodigo}</strong></span>}
                        {funcion && <span>Función: <strong className="text-slate-800">{funcion}</strong></span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label htmlFor={`${id}-motivo`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Motivo / Proveído de Asignación
          </label>
          <textarea
            id={`${id}-motivo`}
            rows={2}
            className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={enviando}
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={enviando}
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || !candidatoSeleccionado}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-800 transition shadow-xs disabled:opacity-50"
          >
            {enviando ? "Asignando..." : "Confirmar Asignación"}
          </button>
        </div>
      </form>
    </AccionModal>
  );
}
