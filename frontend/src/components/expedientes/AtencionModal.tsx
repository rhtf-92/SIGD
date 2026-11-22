import { useId, useRef, useState, type FormEvent } from "react";
import type { ModalAccionProps, ResultadoAtencion, SolicitudAtencion } from "../../types/expedienteActions";
import { useFormularioExpediente } from "../../hooks/useFormularioExpediente";
import AccionModal from "./AccionModal";

export interface AtencionModalProps extends ModalAccionProps<SolicitudAtencion, ResultadoAtencion> {
  esIntermediaTecnica?: boolean;
  modoInicial?: "dictamen" | "nsp";
}

export default function AtencionModal(props: AtencionModalProps) {
  return props.open ? <FormularioAtencion key={`${props.expediente.id}-${props.modoInicial || 'dictamen'}`} {...props} /> : null;
}

function FormularioAtencion({ expediente, accion, onClose, esIntermediaTecnica, modoInicial = "dictamen" }: AtencionModalProps) {
  const id = useId();
  const [modo, setModo] = useState<"dictamen" | "nsp">(modoInicial);

  const textoDictamenConforme = esIntermediaTecnica
    ? "Se declara PROCEDENTE la atención técnica de la solicitud tras verificación curricular conforme en actas institucionales."
    : "Se declara PROCEDENTE la atención de la solicitud y se emite la certificación correspondiente conforme al cumplimiento cabal de los requisitos académicos normados por el IESTP Suiza.";

  const textoInasistenciaNsp = "MEMORÁNDUM DE INASISTENCIA (NSP): Se declara IMPROCEDENTE el trámite debido a que el solicitante NO SE PRESENTÓ a la evaluación técnica programada. Se remite informe de inasistencia y notificación inmediata al correo registrado.";

  const [resumen, setResumen] = useState(modoInicial === "nsp" ? textoInasistenciaNsp : textoDictamenConforme);
  const [observacionInterna, setObservacionInterna] = useState(
    modoInicial === "nsp"
      ? "Inasistencia a fecha programada debidamente constatada. Se remite notificación fehaciente al administrado."
      : esIntermediaTecnica
        ? "Evaluación técnica conforme. Cumple requisitos del TUPA."
        : "Verificación curricular conforme en actas institucionales. Certificado emitido y suscrito digitalmente."
  );

  const cambiarModo = (nuevoModo: "dictamen" | "nsp") => {
    setModo(nuevoModo);
    if (nuevoModo === "nsp") {
      setResumen(textoInasistenciaNsp);
      setObservacionInterna("Inasistencia a fecha programada debidamente constatada. Se remite notificación fehaciente al administrado.");
    } else {
      setResumen(textoDictamenConforme);
      setObservacionInterna(esIntermediaTecnica ? "Evaluación técnica conforme. Cumple requisitos del TUPA." : "Verificación curricular conforme en actas institucionales. Certificado emitido y suscrito digitalmente.");
    }
  };
  const [adjuntarPdf, setAdjuntarPdf] = useState(!esIntermediaTecnica);
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
      titulo={
        modo === "nsp"
          ? "Emitir Memorándum de Inasistencia (NSP)"
          : esIntermediaTecnica
            ? "Registrar Atención y Dictamen Técnico"
            : "Atender y Resolver Expediente"
      }
      descripcion={
        modo === "nsp"
          ? `Expediente ${expediente.codigo}. El solicitante no se presentó a la evaluación técnica. Se cerrará el trámite y se notificará fehacientemente a su correo.`
          : esIntermediaTecnica
            ? `Expediente ${expediente.codigo}. Registro del dictamen técnico para posterior elevación a Despacho de Dirección.`
            : `Expediente ${expediente.codigo}. Emisión del acto administrativo resolutivo y notificación a Casilla Electrónica.`
      }
      pending={formulario.pending}
      onClose={cerrar}
    >
      {/* Selector de Modo: Dictamen Aprobatorio vs Memorándum de Inasistencia */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl mb-4 border border-slate-200">
        <button
          type="button"
          onClick={() => cambiarModo("dictamen")}
          disabled={formulario.pending}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            modo === "dictamen"
              ? "bg-white text-emerald-800 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>✅</span>
          <span>{esIntermediaTecnica ? "Dictamen Conforme (Procedente)" : "Atención Favorable"}</span>
        </button>
        <button
          type="button"
          onClick={() => cambiarModo("nsp")}
          disabled={formulario.pending}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            modo === "nsp"
              ? "bg-rose-700 text-white shadow-xs"
              : "text-rose-700 hover:bg-rose-50"
          }`}
        >
          <span>⚠️</span>
          <span>No se presentó (NSP) / Inasistencia</span>
        </button>
      </div>

      <div
        className={`rounded-lg p-3 text-xs mb-4 border ${
          modo === "nsp"
            ? "bg-rose-50 border-rose-200 text-rose-900"
            : "bg-emerald-50 border-emerald-200 text-emerald-900"
        }`}
      >
        <p className="font-semibold mb-1">
          {modo === "nsp" ? "Efecto de la Inasistencia (NSP):" : "Efecto Procesal e Institucional:"}
        </p>
        <p>
          {modo === "nsp"
            ? "Al confirmar la inasistencia (NSP), se emitirá formalmente el Memorándum de Desestimación por Inasistencia. El trámite se cerrará como IMPROCEDENTE y el sistema despachará automáticamente una notificación al correo electrónico registrado del solicitante."
            : esIntermediaTecnica
              ? "Al confirmar la atención técnica, se registrará formalmente el dictamen técnico en el workflow del expediente. El expediente permanecerá en su área para su elevación a Despacho de Dirección con la acción 'Enviar a Firma'."
              : "Al confirmar la atención, el expediente transicionará a RESUELTO. Se notificará fehacientemente al administrado en su Casilla Electrónica y se pondrá a su disposición el documento resolutivo emitido."}
        </p>
      </div>

      <form noValidate onSubmit={enviar} className="space-y-4">
        <div className="m03-field">
          <label htmlFor={`${id}-resumen`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            {modo === "nsp"
              ? "Detalle del Memorándum / Informe de Inasistencia (obligatorio)"
              : esIntermediaTecnica
                ? "Dictamen / Informe de Atención Técnica (obligatorio)"
                : "Resumen del Acto Resolutivo / Dictamen de Atención (obligatorio)"}
          </label>
          <textarea
            id={`${id}-resumen`}
            ref={resumenRef}
            data-foco-inicial
            rows={4}
            className={`w-full rounded-lg border p-2.5 text-xs text-slate-900 shadow-inner focus:ring-1 ${
              modo === "nsp"
                ? "border-rose-300 focus:border-rose-600 focus:ring-rose-600"
                : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-600"
            }`}
            required
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            disabled={formulario.pending}
            aria-invalid={intento && !resumenValido}
          />
          {intento && !resumenValido && (
            <p className="text-xs text-rose-700 mt-1 font-medium">
              El resumen es obligatorio (mínimo 10 caracteres).
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

        {!esIntermediaTecnica && modo !== "nsp" && (
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
        )}

        <div className="pt-2">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-slate-900" htmlFor={`${id}-confirmacion`}>
            <input
              ref={confirmacionRef}
              id={`${id}-confirmacion`}
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              disabled={formulario.pending}
              className={`mt-0.5 rounded border-slate-300 focus:ring-emerald-500 ${
                modo === "nsp" ? "text-rose-600" : "text-emerald-600"
              }`}
            />
            <span>
              {modo === "nsp"
                ? "Confirmo que el solicitante no asistió a la evaluación programada, emitiendo el Memorándum de Inasistencia y autorizando el envío inmediato de notificación a su correo."
                : esIntermediaTecnica
                  ? "Confirmo que he evaluado técnicamente la solicitud y el cumplimiento de requisitos académicos, emitiendo dictamen procedente para posterior elevación a Dirección."
                  : "Confirmo la emisión formal del acto administrativo y su remisión inmediata a la Casilla Electrónica del administrado."}
            </span>
          </label>
          {intento && !confirmado && (
            <p className="text-xs text-rose-700 mt-1 font-medium pl-6">
              Debe marcar la confirmación formal antes de registrar.
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
            className={`rounded-lg px-4 py-2 text-xs font-bold text-white transition shadow-sm disabled:opacity-50 ${
              modo === "nsp"
                ? "bg-rose-700 hover:bg-rose-800"
                : "bg-emerald-700 hover:bg-emerald-800"
            }`}
            disabled={formulario.pending || !accion.disponible}
          >
            {formulario.pending
              ? "Registrando..."
              : modo === "nsp"
                ? "Emitir Memorándum NSP y Enviar Correo"
                : esIntermediaTecnica
                  ? "Confirmar Dictamen Técnico"
                  : "Emitir Resolución y Notificar"}
          </button>
        </div>
      </form>
    </AccionModal>
  );
}
