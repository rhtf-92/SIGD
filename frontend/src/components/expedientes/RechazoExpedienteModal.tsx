import React, { useState } from 'react';
import { apiClient } from '../../api/client';
import { AlertOctagon, Ban } from 'lucide-react';

interface Props {
  expedienteId: string;
  cut: string;
  onCerrar: () => void;
  onExito: () => void;
}

export const RechazoExpedienteModal: React.FC<Props> = ({
  expedienteId,
  cut,
  onCerrar,
  onExito,
}) => {
  const [motivo, setMotivo] = useState('');
  const [baseLegal, setBaseLegal] = useState('Artículos 136 y 142 del TUO de la Ley N° 27444 — Ley del Procedimiento Administrativo General');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < 10) {
      setError('El motivo del rechazo debe detallar los fundamentos fácticos (mínimo 10 caracteres).');
      return;
    }
    if (baseLegal.trim().length < 5) {
      setError('La base legal es obligatoria conforme al principio de legalidad.');
      return;
    }

    setCargando(true);
    setError(null);
    try {
      await apiClient.post(`/api/v1/expedientes/${encodeURIComponent(expedienteId)}/rechazar`, {
        motivo: motivo.trim(),
        baseLegal: baseLegal.trim(),
      });
      onExito();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Error registrando el rechazo administrativo.';
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-rose-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-rose-300" />
            <h3 className="text-base font-bold">Declaración de Inadmisibilidad / Rechazo</h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-rose-200 hover:text-white text-sm font-semibold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900">
            <AlertOctagon className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Acto Administrativo Conclusivo — Expediente {cut}</p>
              <p className="mt-0.5 text-rose-800">
                Esta acción concluye el procedimiento administrativo por causales insubsanables o vencimiento del plazo de subsanación. Se notificará formalmente al administrado en su Casilla Electrónica.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Motivo Fundamentado del Rechazo (Causal Fáctica)
            </label>
            <textarea
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describa de manera motivada la causal de rechazo o incumplimiento insubsanable..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Base Legal Aplicable (LPAG / TUPA)
            </label>
            <input
              type="text"
              value={baseLegal}
              onChange={(e) => setBaseLegal(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              required
            />
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando || motivo.trim().length < 10}
              className="rounded-lg bg-rose-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50"
            >
              {cargando ? 'Procesando...' : 'Confirmar Rechazo e Inadmisibilidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
