import { useId, useState, type FormEvent } from "react";
import type { ModalAccionProps, ResultadoEnviarAFirma, SolicitudEnviarAFirma } from "../../types/expedienteActions";
import { useFormularioExpediente } from "../../hooks/useFormularioExpediente";
import AccionModal from "./AccionModal";

export type EnviarAFirmaModalProps = ModalAccionProps<SolicitudEnviarAFirma, ResultadoEnviarAFirma>;

export default function EnviarAFirmaModal(props: EnviarAFirmaModalProps) {
  return props.open ? <FormularioEnviarAFirma key={props.expediente.id} {...props} /> : null;
}

function FormularioEnviarAFirma({ expediente, accion, onClose }: EnviarAFirmaModalProps) {
  const id = useId();
  const [motivo, setMotivo] = useState(
    "Expediente evaluado conforme. Se eleva a Despacho de Dirección para suscripción y firma digital del acto resolutivo."
  );
  const formulario = useFormularioExpediente(accion);

  function cerrar() {
    if (!formulario.pending) {
      accion.restablecer();
      onClose();
    }
  }

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formulario.pending) return;

    const payload: SolicitudEnviarAFirma = {
      expediente,
      motivo: motivo.trim() || undefined,
    };

    void formulario.enviar(payload, () => {
      setMotivo("");
      onClose();
    });
  }

  return (
    <AccionModal
      titulo="Enviar Expediente a Firma"
      descripcion={`Expediente ${expediente.codigo}. El expediente transicionará a EN_FIRMA para la suscripción de la autoridad competente.`}
      pending={formulario.pending}
      onClose={cerrar}
    >
      <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 text-xs text-violet-900 mb-4">
        <p className="font-semibold mb-1">Efecto Procesal Institucional:</p>
        <p>
          Al confirmar el envío, el expediente pasará a estado <strong>EN_FIRMA</strong>. La autoridad resolutiva correspondiente (Director o encargado con delegación formal) podrá firmar digitalmente el acto administrativo.
        </p>
      </div>

      <form noValidate onSubmit={enviar} className="space-y-4">
        <div>
          <label htmlFor={`${id}-motivo`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Motivo / Proveído de Elevación a Despacho
          </label>
          <textarea
            id={`${id}-motivo`}
            rows={3}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-violet-600 focus:ring-1 focus:ring-violet-600 shadow-inner"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={formulario.pending}
            onClick={cerrar}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={formulario.pending}
            className="rounded-lg bg-violet-700 px-4 py-2 text-xs font-bold text-white hover:bg-violet-800 transition shadow-xs disabled:opacity-50"
          >
            {formulario.pending ? "Enviando a firma..." : "Confirmar Envío a Firma"}
          </button>
        </div>
      </form>
    </AccionModal>
  );
}
