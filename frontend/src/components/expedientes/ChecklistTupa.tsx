import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '../../api/client';
import { Check, X } from 'lucide-react';

interface Requisito {
  requisito_id: string;
  codigo: string;
  denominacion: string;
  obligatorio: boolean;
  cumplido: boolean | null;
  verificado_en: string | null;
  pagoTesoreria?: {
    verificado: boolean;
    estado: string;
    ordenCodigo: string | null;
    numeroRecibo: string | null;
    importe: string | null;
  };
}

export const ChecklistTupa: React.FC<{ expedienteId: string }> = ({ expedienteId }) => {
  const queryClient = useQueryClient();
  const [observarRequisitoId, setObservarRequisitoId] = useState<string | null>(null);
  const [motivoObservacion, setMotivoObservacion] = useState('');
  const [plazoDias, setPlazoDias] = useState(5);
  const [errorObservacion, setErrorObservacion] = useState<string | null>(null);

  const [errorCalificacion, setErrorCalificacion] = useState<string | null>(null);
  const [exitoConformidad, setExitoConformidad] = useState<string | null>(null);

  const { data: requisitos, isLoading, error } = useQuery<Requisito[]>({
    queryKey: ['requisitos', expedienteId],
    queryFn: () =>
      api
        .get(`/api/v1/expedientes/${expedienteId}/checklist`)
        .then((res) => (Array.isArray(res.data) ? res.data : [])),
  });
  const listaRequisitos = Array.isArray(requisitos) ? requisitos : [];

  const todosObligatoriosCumplidos = listaRequisitos.length > 0 &&
    listaRequisitos.filter(r => r.obligatorio).every(r => r.cumplido === true);

  const conformidadMutation = useMutation({
    mutationFn: () => api.post(`/api/v1/expedientes/${expedienteId}/declarar-conformidad`),
    onSuccess: (res: any) => {
      setExitoConformidad(res.data?.mensaje || 'Conformidad documental declarada exitosamente.');
      setErrorCalificacion(null);
      void queryClient.invalidateQueries({ queryKey: ['requisitos', expedienteId] });
      void queryClient.invalidateQueries({ queryKey: ['expediente', expedienteId] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes', expedienteId, 'timeline'] });
      void queryClient.invalidateQueries({ queryKey: ['trazabilidad', expedienteId] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setErrorCalificacion(e.response?.data?.detail || e.response?.data?.message || e.message || 'No se pudo declarar la conformidad documental.');
    },
  });

  const calificarMutation = useMutation({
    mutationFn: (variables: { reqId: string, cumplido: boolean }) =>
      api.put(`/api/v1/expedientes/${expedienteId}/checklist/${variables.reqId}`, { cumplido: variables.cumplido }),
    onSuccess: () => {
      setErrorCalificacion(null);
      void queryClient.invalidateQueries({ queryKey: ['requisitos', expedienteId] });
      void queryClient.invalidateQueries({ queryKey: ['certificado-ingles', expedienteId] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setErrorCalificacion(e.response?.data?.detail || e.response?.data?.message || e.message || 'No se pudo calificar el requisito.');
    },
  });

  const observarMutation = useMutation({
    mutationFn: async (variables: { reqId: string; motivo: string; plazoDias: number }) => {
      await api.put(`/api/v1/expedientes/${expedienteId}/checklist/${variables.reqId}`, { cumplido: false });
      return api.post(`/api/v1/expedientes/${expedienteId}/observar`, {
        requisitoId: variables.reqId,
        motivo: variables.motivo,
        plazoDias: variables.plazoDias,
        tipoObservacion: 'ADMINISTRATIVA',
        requisitos: [
          {
            requisitoId: variables.reqId,
            descripcionIncumplimiento: variables.motivo,
          },
        ],
      });
    },
    onSuccess: () => {
      setObservarRequisitoId(null);
      setMotivoObservacion('');
      setErrorObservacion(null);
      void queryClient.invalidateQueries({ queryKey: ['requisitos', expedienteId] });
      void queryClient.invalidateQueries({ queryKey: ['expediente', expedienteId] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      void queryClient.invalidateQueries({ queryKey: ['expedientes', expedienteId, 'timeline'] });
      void queryClient.invalidateQueries({ queryKey: ['trazabilidad', expedienteId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar la observación administrativa.';
      setErrorObservacion(msg);
    },
  });

  if (isLoading) return <div className="p-4">Cargando requisitos TUPA...</div>;
  if (error) return <div className="p-4 text-red-600">Error cargando requisitos TUPA</div>;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-3 mb-4">
        <h2 className="text-base font-bold text-slate-900">Calificación Administrativa — Checklist de Requisitos TUPA</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Verificación formal de cumplimiento de requisitos del procedimiento TUPA (LPAG Art. 136).
        </p>
      </div>
      {errorCalificacion && (
        <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
          {errorCalificacion}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-slate-600">
            <th className="text-left p-2">Código</th>
            <th className="text-left p-2">Denominación</th>
            <th className="text-center p-2">Estado</th>
            <th className="text-center p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {listaRequisitos.map((req) => (
            <tr key={req.requisito_id} className="border-b hover:bg-gray-50">
              <td className="p-2 font-mono text-xs font-semibold">{req.codigo}</td>
              <td className="p-2">
                <div>{req.denominacion}</div>
                {req.codigo === 'COMPROBANTE_PAGO' && req.pagoTesoreria && (
                  <span
                    className={`inline-block mt-1 rounded border px-2 py-0.5 text-[11px] font-semibold ${
                      req.pagoTesoreria.verificado
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    {req.pagoTesoreria.verificado
                      ? `Pago Verificado en Tesorería (S/ ${req.pagoTesoreria.importe ?? '100.00'}${req.pagoTesoreria.numeroRecibo ? ` · Recibo N° ${req.pagoTesoreria.numeroRecibo}` : ''})`
                      : req.pagoTesoreria.ordenCodigo
                      ? `Pendiente cobro en Tesorería (${req.pagoTesoreria.ordenCodigo})`
                      : 'Sin orden pagada en Tesorería'}
                  </span>
                )}
              </td>
              <td className="p-2 text-center">
                {req.cumplido === true && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    <Check className="h-3.5 w-3.5 text-emerald-600 inline" /> Cumple
                  </span>
                )}
                {req.cumplido === false && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                    <X className="h-3.5 w-3.5 text-rose-600 inline" /> No cumple
                  </span>
                )}
                {req.cumplido === null && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    Pendiente
                  </span>
                )}
              </td>
              <td className="p-2 text-center whitespace-nowrap">
                <button
                  type="button"
                  disabled={
                    calificarMutation.isPending ||
                    (req.codigo === 'COMPROBANTE_PAGO' && Boolean(req.pagoTesoreria) && !req.pagoTesoreria?.verificado)
                  }
                  title={
                    req.codigo === 'COMPROBANTE_PAGO' && req.pagoTesoreria && !req.pagoTesoreria.verificado
                      ? 'Tesorería debe verificar el abono antes de aprobar este requisito.'
                      : 'Marcar como cumplido'
                  }
                  className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold cursor-pointer hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => calificarMutation.mutate({ reqId: req.requisito_id, cumplido: true })}
                >
                  Cumple
                </button>
                <button
                  type="button"
                  disabled={calificarMutation.isPending}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded text-xs font-semibold ml-1.5 cursor-pointer hover:bg-amber-700 disabled:opacity-50"
                  onClick={() => calificarMutation.mutate({ reqId: req.requisito_id, cumplido: false })}
                >
                  No cumple
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1 bg-rose-600 text-white rounded text-xs font-semibold ml-1.5 cursor-pointer hover:bg-rose-700"
                  onClick={() => {
                    setErrorObservacion(null);
                    setObservarRequisitoId(req.requisito_id);
                  }}
                >
                  Observar requisito
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {todosObligatoriosCumplidos && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2.5">
            <Check className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-950">
                Todos los requisitos obligatorios han sido verificados conforme.
              </p>
              <p className="text-[11px] text-emerald-800">
                El expediente cumple el estándar TUPA y se encuentra apto para conformidad documental y derivación a unidad resolutiva.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={conformidadMutation.isPending}
            onClick={() => conformidadMutation.mutate()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {conformidadMutation.isPending ? 'Declarando...' : '✓ Declarar Conformidad Documental'}
          </button>
        </div>
      )}

      {exitoConformidad && (
        <div role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-100 p-3 text-xs font-semibold text-emerald-900">
          ✓ {exitoConformidad}
        </div>
      )}

      {observarRequisitoId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md space-y-4">
            <h4 className="font-bold text-base text-slate-900">Formular Observación Administrativa (TUPA)</h4>
            <div>
              <label htmlFor="motivo-obs-tupa" className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo de incumplimiento (mínimo 10 caracteres)
              </label>
              <textarea
                id="motivo-obs-tupa"
                rows={3}
                value={motivoObservacion}
                onChange={(e) => setMotivoObservacion(e.target.value)}
                placeholder="Describa el defecto u omisión advertida en el requisito TUPA..."
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="plazo-obs-tupa" className="block text-xs font-semibold text-slate-700 mb-1">
                Plazo de subsanación (días hábiles)
              </label>
              <input
                id="plazo-obs-tupa"
                type="number"
                min={1}
                max={30}
                value={plazoDias}
                onChange={(e) => setPlazoDias(Number(e.target.value) || 2)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </div>
            {errorObservacion && (
              <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                {errorObservacion}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-3.5 py-1.5 bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-300"
                onClick={() => setObservarRequisitoId(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={observarMutation.isPending || motivoObservacion.trim().length < 10}
                className="px-3.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-rose-700 disabled:opacity-50"
                onClick={() =>
                  observarMutation.mutate({
                    reqId: observarRequisitoId,
                    motivo: motivoObservacion.trim(),
                    plazoDias,
                  })
                }
              >
                {observarMutation.isPending ? 'Registrando...' : 'Confirmar Observación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
