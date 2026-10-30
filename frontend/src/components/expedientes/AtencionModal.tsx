import { useId, useRef, useState, type FormEvent } from "react";
import type { ModalAccionProps, ResultadoAtencion, SolicitudAtencion } from "../../types/expedienteActions";
import { useFormularioExpediente } from "../../hooks/useFormularioExpediente";
import AccionModal from "./AccionModal";

export type AtencionModalProps = ModalAccionProps<SolicitudAtencion, ResultadoAtencion>;

export default function AtencionModal(props: AtencionModalProps) {
  return props.open ? <FormularioAtencion key={props.expediente.id} {...props} /> : null;
}

function FormularioAtencion({ expediente, accion, onClose }: AtencionModalProps) {
  const id = useId();
  const [resumen, setResumen] = useState(
    "Se declara PROCEDENTE la atención de la solicitud y se emite la certificación correspondiente conforme al cumplimiento cabal de los requisitos académicos normados por el IESTP Suiza."
  );
  const [observacionInterna, setObservacionInterna] = useState(
    "Verificación curricular conforme en actas institucionales. Certificado emitido y suscrito digitalmente."
  );
  const [adjuntarPdf, setAdjuntarPdf] = useState(true);
  const [confirmado, setConfirmado] = useState(false);
  const [intento, setIntento] = useState(false);

  const resumenRef = useRef<HTMLTextAreaElement>(null);
  const confirmacionRef = useRef<HTMLInputElement>(null);
  const formulario = useFormularioExpediente(accion);

  const resumenValido = resumen.trim().length >= 10;

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
    if (!resumenValido) {
      resumenRef.current?.focus();
      return;
    }
    if (!confirmado) {
      confirmacionRef.current?.focus();
      return;
    }

    const payload: SolicitudAtencion = {
      expediente,
      resultado_resumen: resumen.trim(),
      observacion_interna: observacionInterna.trim() || undefined,
      ...(adjuntarPdf
        ? {
            nombre_archivo: `Resolucion_${expediente.codigo || "SDA"}.pdf`,
            s3_key: `expedientes/${expediente.id}/resolucion_atencion.pdf`,
            sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            tamano_bytes: 145200,
            mime_type: "application/pdf",
          }
        : {}),
    };

    void formulario.enviar(payload, () => {
      setResumen("");
      setObservacionInterna("");
      setConfirmado(false);
      setIntento(false);
      onClose();
    });
  }

  return (
    <AccionModal
      titulo="Atender y Resolver Expediente"
      descripcion={`Expediente ${expediente.codigo}. Emisión del acto administrativo resolutivo y notificación a Casilla Electrónica.`}
      pending={formulario.pending}
      onClose={cerrar}
    >
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 mb-4">
        <p className="font-semibold mb-1">Efecto Procesal e Institucional:</p>
        <p>
          Al confirmar la atención, el expediente transicionará a <strong>RESUELTO</strong>. Se notificará fehacientemente al administrado en su <strong>Casilla Electrónica</strong> y se pondrá a su disposición el documento resolutivo emitido.
        </p>
      </div>

      <form noValidate onSubmit={enviar} className="space-y-4">
        <div className="m03-field">
          <label htmlFor={`${id}-resumen`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Resumen del Acto Resolutivo / Dictamen de Atención (obligatorio)
          </label>
          <textarea
            id={`${id}-resumen`}
            ref={resumenRef}
            data-foco-inicial
            rows={4}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-inner"
            required
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            disabled={formulario.pending}
            aria-invalid={intento && !resumenValido}
          />
          {intento && !resumenValido && (
            <p className="text-xs text-rose-700 mt-1 font-medium">
              El resumen de la atención es obligatorio (mínimo 10 caracteres).
            </p>
          )}
        </div>

        <div className="m03-field">
          <label htmlFor={`${id}-interna`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Observaciones Internas para Legajo Institucional (opcional)
          </label>
          <textarea
            id={`${id}-interna`}
            rows={2}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            value={observacionInterna}
            onChange={(e) => setObservacionInterna(e.target.value)}
            disabled={formulario.pending}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={adjuntarPdf}
              onChange={(e) => setAdjuntarPdf(e.target.checked)}
              disabled={formulario.pending}
              className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Adjuntar y emitir Documento Resolutivo Oficial (PDF firmado digitalmente)</span>
          </label>
          {adjuntarPdf && (
            <p className="text-[11px] text-slate-600 pl-6">
              Archivo: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800">Resolucion_{expediente.codigo || "SDA"}.pdf</code> · Formato PDF/A-1b con metadatos de integridad.
            </p>
          )}
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
              className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              Confirmo la emisión formal del acto administrativo y su remisión inmediata a la Casilla Electrónica del administrado.
            </span>
          </label>
          {intento && !confirmado && (
            <p className="text-xs text-rose-700 mt-1 font-medium pl-6">
              Debe marcar la confirmación formal antes de emitir la atención.
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
            className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-sm disabled:opacity-50"
            disabled={formulario.pending || !accion.disponible}
          >
            {formulario.pending ? "Emitiendo atención..." : "Emitir Resolución y Notificar"}
          </button>
        </div>
      </form>
    </AccionModal>
  );
}
