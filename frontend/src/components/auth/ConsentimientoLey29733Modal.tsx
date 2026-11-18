import { useEffect, useState } from "react";

export interface ConsentimientoLey29733Payload {
  consentimiento_ley_29733: boolean;
}

export async function registrarConConsentimiento<T>(
  payload: ConsentimientoLey29733Payload,
  registrar: () => T | Promise<T>,
): Promise<T> {
  if (payload.consentimiento_ley_29733 !== true) {
    throw new Error("Debe aceptar el consentimiento informado conforme a la Ley N° 29733.");
  }

  return registrar();
}

interface ConsentimientoLey29733ModalProps {
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { consentimiento_ley_29733: true }) => void | Promise<void>;
}

export function ConsentimientoLey29733Modal({
  isOpen,
  isSubmitting = false,
  onClose,
  onSubmit,
}: ConsentimientoLey29733ModalProps) {
  const [consentimiento, setConsentimiento] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setConsentimiento(false);
      setError(null);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  async function handleSubmit() {
    setError(null);
    try {
      await registrarConConsentimiento(
        { consentimiento_ley_29733: consentimiento },
        () => onSubmit({ consentimiento_ley_29733: true }),
      );
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible registrar el consentimiento.",
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="consentimiento-29733-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="border-b border-slate-200 bg-slate-900 px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
            Protección de datos personales · Ley N° 29733
          </p>
          <h2 id="consentimiento-29733-title" className="mt-2 text-xl font-bold">
            Consentimiento informado
          </h2>
        </header>

        <div className="space-y-5 px-6 py-6 text-sm leading-6 text-slate-700">
          <p>
            El IESTP “Suiza” solicita su autorización libre, previa, expresa,
            informada e inequívoca para tratar sus datos personales y habilitar
            su Casilla Electrónica Ciudadana.
          </p>

          <section aria-labelledby="finalidades-title">
            <h3 id="finalidades-title" className="font-bold text-slate-950">
              Finalidades del tratamiento
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Gestionar su identidad, registro y relación con la institución.</li>
              <li>Tramitar solicitudes, expedientes y procedimientos administrativos.</li>
              <li>Remitir cédulas, actos administrativos y comunicaciones oficiales a su casilla.</li>
              <li>Conservar evidencia de las notificaciones, consentimientos y actuaciones para auditoría.</li>
            </ul>
          </section>

          <section aria-labelledby="arco-title">
            <h3 id="arco-title" className="font-bold text-slate-950">
              Sus derechos ARCO
            </h3>
            <p className="mt-2">
              Puede solicitar Acceso, Rectificación, Cancelación u Oposición al
              tratamiento de sus datos, conforme a la Ley N° 29733, mediante la
              Mesa de Partes institucional o escribiendo a
              datos.personales@iestpsuiza.edu.pe.
            </p>
          </section>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-slate-50 p-4 font-medium text-slate-900">
            <input
              type="checkbox"
              checked={consentimiento}
              disabled={isSubmitting}
              onChange={(event) => setConsentimiento(event.target.checked)}
              className="mt-1 h-4 w-4 accent-blue-700"
            />
            <span>
              He leído esta información y otorgo mi consentimiento informado para
              el tratamiento de mis datos personales conforme a la Ley N° 29733.
            </span>
          </label>

          {error && (
            <p role="alert" className="font-semibold text-red-800">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!consentimiento || isSubmitting}
            className="rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting ? "Registrando…" : "Aceptar y continuar"}
          </button>
        </footer>
      </section>
    </div>
  );
}
