import { useEffect, useState } from "react";

import { apiClient } from "../../api/client";
import { CASILLA_ENDPOINTS } from "../../services/casillaService";
import type { Notificacion } from "../../types/casilla";

export interface AcuseEmitidoServidor {
  idAcuse: string;
  hashSha256: string;
  selladoTiempo: string;
}

interface AcuseNotificacionModalProps {
  isOpen: boolean;
  notificacion: Notificacion | null;
  onClose: () => void;
  onAcuseGenerado: (acuse: AcuseEmitidoServidor) => void;
}

function formatFechaHora(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: "America/Lima",
  }).format(date);
}

function leerAcuseServidor(value: unknown): AcuseEmitidoServidor | null {
  if (typeof value !== "object" || value === null) return null;
  const root = value as Record<string, unknown>;
  const payload =
    typeof root.data === "object" && root.data !== null
      ? (root.data as Record<string, unknown>)
      : root;
  const idAcuse = payload.idAcuse;
  const hashSha256 = payload.hashSha256 ?? payload.hashSha256Acuse;
  const selladoTiempo = payload.selladoTiempo ?? payload.timestampGeneracionIso;

  if (
    typeof idAcuse !== "string" ||
    idAcuse.trim() === "" ||
    typeof hashSha256 !== "string" ||
    !/^[a-f\d]{64}$/i.test(hashSha256) ||
    typeof selladoTiempo !== "string" ||
    Number.isNaN(Date.parse(selladoTiempo))
  ) {
    return null;
  }

  return { idAcuse, hashSha256, selladoTiempo };
}

export default function AcuseNotificacionModal({
  isOpen,
  notificacion,
  onClose,
  onAcuseGenerado,
}: AcuseNotificacionModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acuse, setAcuse] = useState<AcuseEmitidoServidor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfirmed(false);
    setIsSubmitting(false);
    setAcuse(null);
    setError(null);
  }, [isOpen, notificacion?.id]);

  if (!isOpen || !notificacion) return null;
  const currentNotification = notificacion;

  async function handleConfirm() {
    if (!confirmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      if (currentNotification.estado === "NO_LEIDO") {
        await apiClient.patch(
          CASILLA_ENDPOINTS.MARCAR_LEIDO(currentNotification.id),
        );
      }
      const result = await apiClient.post<unknown>(
        CASILLA_ENDPOINTS.GENERAR_ACUSE(currentNotification.id),
        {
          notificacionId: currentNotification.id,
          confirmacionAdministrado: true,
        },
      );
      const acuseServidor = leerAcuseServidor(result.data);
      if (!acuseServidor) {
        throw new Error(
          "El servidor no devolvió un acuse verificable. No se registró como emitido.",
        );
      }

      setAcuse(acuseServidor);
      onAcuseGenerado(acuseServidor);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? `No se pudo emitir el acuse; no figura como emitido. ${requestError.message}`
          : "No se pudo emitir el acuse; no figura como emitido. Verifique la conexión e intente nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="acuse-modal-title"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="bg-slate-900 px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
            Constancia digital · Casilla ciudadana
          </p>
          <h2 id="acuse-modal-title" className="mt-2 text-xl font-bold">
            {acuse ? "Acuse registrado" : "Confirmación de notificación"}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {notificacion.numeroNotificacion} · {notificacion.numeroExpediente}
          </p>
        </header>

        <div className="space-y-5 px-6 py-6 text-sm text-slate-700">
          {acuse ? (
            <div aria-live="polite" className="space-y-4">
              <p className="font-semibold text-emerald-800">
                Constancia confirmada por la respuesta del servidor.
              </p>
              <dl className="space-y-3">
                <div>
                  <dt className="font-bold text-slate-900">Fecha y hora (hora de Lima)</dt>
                  <dd className="mt-1">{formatFechaHora(acuse.selladoTiempo)}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-900">Sello de tiempo ISO-8601</dt>
                  <dd className="mt-1 break-all font-mono text-xs">{acuse.selladoTiempo}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-900">Hash criptográfico SHA-256</dt>
                  <dd className="mt-1 break-all rounded-md bg-slate-950 p-3 font-mono text-xs text-emerald-300">
                    {acuse.hashSha256}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-900">Identificador de acuse</dt>
                  <dd className="mt-1 font-mono">{acuse.idAcuse}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <>
              <p>
                Al confirmar, se solicitará al servidor el registro del acuse de
                recepción. La constancia solo aparecerá si la respuesta contiene
                un identificador, sello de tiempo y hash SHA-256 válidos.
              </p>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-slate-50 p-4 font-medium text-slate-900">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={isSubmitting}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-blue-800"
                />
                <span>
                  Confirmo que he accedido a la cédula y solicito registrar el
                  acuse digital de esta notificación.
                </span>
              </label>
              {error && (
                <p role="alert" className="font-semibold text-red-800">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          {!acuse && (
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Ahora no
            </button>
          )}
          {acuse ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-900"
            >
              Cerrar constancia
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!confirmed || isSubmitting}
              className="rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "Registrando acuse…" : "Confirmar y registrar acuse"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
