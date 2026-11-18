import { useId, useRef, useState, type FormEvent } from "react";
import type { ModalAccionProps, ResultadoArchivado, SolicitudArchivado } from "../../types/expedienteActions";
import { useFormularioExpediente } from "../../hooks/useFormularioExpediente";
import AccionModal from "./AccionModal";

export type ArchivadoModalProps = ModalAccionProps<SolicitudArchivado, ResultadoArchivado>;

export default function ArchivadoModal(props: ArchivadoModalProps) {
  return props.open ? <FormularioArchivado key={props.expediente.id} {...props} /> : null;
}

function FormularioArchivado({ expediente, accion, onClose }: ArchivadoModalProps) {
  const id = useId();
  const [estante, setEstante] = useState("EST-04");
  const [balda, setBalda] = useState("B-02");
  const [caja, setCaja] = useState("CAJ-2026-11");
  const [observaciones, setObservaciones] = useState("Legajo completo foliado y clasificado en custodia física del Archivo Central.");
  const [confirmado, setConfirmado] = useState(false);
  const [intento, setIntento] = useState(false);

  const estanteRef = useRef<HTMLInputElement>(null);
  const baldaRef = useRef<HTMLInputElement>(null);
  const cajaRef = useRef<HTMLInputElement>(null);
  const confirmacionRef = useRef<HTMLInputElement>(null);
  const formulario = useFormularioExpediente(accion);

  const camposValidos = estante.trim().length > 0 && balda.trim().length > 0 && caja.trim().length > 0;

  function cerrar() {
    if (!formulario.pending) {
      accion.restablecer();
      onClose();
    }
  }

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formulario.pending) return;
    setIntento(true);
    if (!estante.trim()) {
      estanteRef.current?.focus();
      return;
    }
    if (!balda.trim()) {
      baldaRef.current?.focus();
      return;
    }
    if (!caja.trim()) {
      cajaRef.current?.focus();
      return;
    }
    if (!confirmado) {
      confirmacionRef.current?.focus();
      return;
    }

    const payload: SolicitudArchivado = {
      expediente,
      estante: estante.trim(),
      balda: balda.trim(),
      caja: caja.trim(),
      observaciones: observaciones.trim() || undefined,
    };

    void formulario.enviar(payload, () => {
      setConfirmado(false);
      setIntento(false);
      onClose();
    });
  }

  return (
    <AccionModal
      titulo="Archivar Expediente Formalmente"
      descripcion={`Expediente ${expediente.codigo}. Registro del depósito y custodia física en el Archivo Institucional.`}
      pending={formulario.pending}
      onClose={cerrar}
    >
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 mb-4">
        <p className="font-semibold mb-1">Cierre de Ciclo Institucional:</p>
        <p>
          Esta acción cierra el trámite y transiciona el expediente al estado terminal <strong>ARCHIVADO</strong>. Solo debe realizarse tras constatar la custodia física del legajo.
        </p>
      </div>

      <form noValidate onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor={`${id}-estante`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Estante / Módulo *
            </label>
            <input
              id={`${id}-estante`}
              ref={estanteRef}
              data-foco-inicial
              type="text"
              className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              required
              value={estante}
              onChange={(e) => setEstante(e.target.value)}
              disabled={formulario.pending}
            />
          </div>
          <div>
            <label htmlFor={`${id}-balda`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Balda / Nivel *
            </label>
            <input
              id={`${id}-balda`}
              ref={baldaRef}
              type="text"
              className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              required
              value={balda}
              onChange={(e) => setBalda(e.target.value)}
              disabled={formulario.pending}
            />
          </div>
          <div>
            <label htmlFor={`${id}-caja`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Caja / Archivador *
            </label>
            <input
              id={`${id}-caja`}
              ref={cajaRef}
              type="text"
              className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              required
              value={caja}
              onChange={(e) => setCaja(e.target.value)}
              disabled={formulario.pending}
            />
          </div>
        </div>
        {intento && !camposValidos && (
          <p className="text-xs text-rose-700 font-medium">
            Estante, balda y caja son campos obligatorios para el inventario físico.
          </p>
        )}

        <div>
          <label htmlFor={`${id}-observaciones`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Observaciones del Depósito (opcional)
          </label>
          <textarea
            id={`${id}-observaciones`}
            rows={2}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            disabled={formulario.pending}
          />
        </div>

        <div className="pt-2">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-slate-900" htmlFor={`${id}-confirmacion`}>
            <input
              ref={confirmacionRef}
              id={`${id}-confirmacion`}
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              disabled={formulario.pending}
              className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span>
              Confirmo que el expediente ha sido inventariado físicamente y depositado en la ubicación declarada.
            </span>
          </label>
          {intento && !confirmado && (
            <p className="text-xs text-rose-700 mt-1 font-medium pl-6">
              Debe marcar la confirmación antes de archivar el expediente.
            </p>
          )}
        </div>

        {formulario.error && (
          <p role="alert" className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-medium">
            {formulario.error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            disabled={formulario.pending}
            onClick={cerrar}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 transition shadow-sm disabled:opacity-50"
            disabled={formulario.pending || !accion.disponible}
          >
            {formulario.pending ? "Archivando..." : "Confirmar Archivado"}
          </button>
        </div>
      </form>
    </AccionModal>
  );
}
