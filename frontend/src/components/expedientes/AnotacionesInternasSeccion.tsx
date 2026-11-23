import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, FileText, AlertCircle, CheckCircle2, ShieldCheck, Info } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  obtenerAnotacionesInternas,
  registrarAnotacionInterna,
} from '../../api/anotacionesApi';
import type {
  TipoAnotacionInterna,
  AnotacionInternaItem,
} from '../../api/anotacionesApi';

interface EvaluadorActivoProp {
  idAsignacion?: string;
  idDocente?: string;
  docenteNombre?: string;
  docenteEmail?: string;
  docenteUsuario?: string;
}

interface AnotacionesInternasSeccionProps {
  expedienteId: string;
  evaluadorActivo?: EvaluadorActivoProp | null;
}

export const AnotacionesInternasSeccion: React.FC<AnotacionesInternasSeccionProps> = ({
  expedienteId,
  evaluadorActivo,
}) => {
  const queryClient = useQueryClient();
  const usuario = useAuthStore((state) => state.usuario);

  const [tipoAnotacion, setTipoAnotacion] = useState<TipoAnotacionInterna>('SEGUIMIENTO');
  const [contenido, setContenido] = useState('');
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Consulta de anotaciones registradas
  const {
    data: anotaciones = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AnotacionInternaItem[]>({
    queryKey: ['anotaciones-internas', expedienteId],
    queryFn: () => obtenerAnotacionesInternas(expedienteId),
    enabled: Boolean(expedienteId),
  });

  // Evaluación de permisos RBAC
  const rolesUsuario = usuario?.roles ?? (usuario?.rol ? [usuario.rol] : []);
  const esDocente = rolesUsuario.includes('DOCENTE');
  const esCoordinadorOAdmin = rolesUsuario.some((r) =>
    ['COORDINADOR_AREA', 'JEFE_UNIDAD_ACADEMICA', 'ADMINISTRADOR_SISTEMA'].includes(r)
  );

  const esDocenteAsignado =
    esDocente &&
    Boolean(
      evaluadorActivo &&
        (evaluadorActivo.idDocente === usuario?.id ||
          evaluadorActivo.docenteEmail?.toLowerCase() === usuario?.correo?.toLowerCase() ||
          evaluadorActivo.docenteUsuario === usuario?.id)
    );

  const puedeEscribir = esCoordinadorOAdmin || esDocenteAsignado;

  // Mutación para registrar nueva anotación
  const registrarMutation = useMutation({
    mutationFn: (payload: { tipoAnotacion: TipoAnotacionInterna; contenido: string }) =>
      registrarAnotacionInterna(expedienteId, payload),
    onSuccess: () => {
      setContenido('');
      setErrorEnvio(null);
      setMensajeExito('Anotación interna registrada con éxito e incorporada inmutablemente al seguimiento.');
      void queryClient.invalidateQueries({ queryKey: ['anotaciones-internas', expedienteId] });
      setTimeout(() => setMensajeExito(null), 5000);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const detalle =
        e.response?.data?.detail || e.response?.data?.message || e.message || 'Error al registrar anotación interna.';
      setErrorEnvio(detalle);
    },
  });

  const longitudValida = contenido.trim().length >= 10 && contenido.length <= 2000;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!longitudValida || !puedeEscribir || registrarMutation.isPending) return;
    setErrorEnvio(null);
    registrarMutation.mutate({
      tipoAnotacion,
      contenido: contenido.trim(),
    });
  };

  const badgeTipo = (tipo: TipoAnotacionInterna) => {
    switch (tipo) {
      case 'SEGUIMIENTO':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
            <span>📋</span> SEGUIMIENTO
          </span>
        );
      case 'SUPERVISION':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
            <span>👁️</span> SUPERVISIÓN
          </span>
        );
      case 'INCIDENCIA':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
            <span>⚠️</span> INCIDENCIA
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {tipo}
          </span>
        );
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Cabecera y Distinción Institucional */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <span>Anotaciones Internas de Seguimiento Institucional</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro interno inmutable (WORM) de coordinación técnica y supervisión docente entre áreas operativas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">
            <Lock className="h-3 w-3" />
            Anotación interna institucional — no visible para el ciudadano
          </span>
        </div>
      </div>

      {/* Banner Informativo de Separación Normativa LPAG */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600 flex items-start gap-3">
        <Info className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          <strong className="text-slate-800 font-semibold">Trazabilidad interna append-only:</strong> Las anotaciones registradas en este panel no alteran las observaciones formales al administrado (Art. 136 LPAG), no notifican a Casilla Electrónica, no modifican los plazos perentorios del SLA ni mutan el estado del expediente (<span className="font-mono font-medium text-slate-700">EN_REVISION</span>).
        </p>
      </div>

      {/* Formulario de Registro o Aviso de Modo Consulta */}
      {puedeEscribir ? (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-3 flex items-center gap-1.5">
            <span>✍️</span> Registrar Nueva Anotación Interna
          </h3>

          <div className="grid gap-3 sm:grid-cols-3 mb-3">
            <div>
              <label htmlFor="tipo-anotacion-select" className="block text-[11px] font-medium text-slate-600 mb-1">
                Tipo de Anotación:
              </label>
              <select
                id="tipo-anotacion-select"
                value={tipoAnotacion}
                onChange={(e) => setTipoAnotacion(e.target.value as TipoAnotacionInterna)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="SEGUIMIENTO">Seguimiento Técnico / Operativo</option>
                <option value="SUPERVISION">Supervisión de Área / Coordinación</option>
                <option value="INCIDENCIA">Incidencia Técnica u Observación Interna</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex items-end justify-end">
              <span className={`text-[11px] font-medium ${contenido.length > 2000 ? 'text-rose-600 font-bold' : contenido.trim().length >= 10 ? 'text-emerald-700' : 'text-slate-500'}`}>
                {contenido.length} / 2,000 caracteres (mínimo 10)
              </span>
            </div>
          </div>

          <div className="mb-3">
            <textarea
              rows={3}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Describa el seguimiento interno, coordinación entre evaluadores o incidencia operativa del expediente..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {errorEnvio && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorEnvio}</span>
            </div>
          )}

          {mensajeExito && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{mensajeExito}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={!longitudValida || registrarMutation.isPending}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-xs transition ${
                !longitudValida || registrarMutation.isPending
                  ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {registrarMutation.isPending ? 'Registrando...' : 'Guardar Anotación Interna'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-blue-700 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-blue-900">Modo consulta institucional:</p>
              <p className="mt-0.5 text-blue-800">
                La consulta del historial está habilitada para Secretaría Académica. El registro de nuevas anotaciones de seguimiento está reservado al docente evaluador asignado y a la coordinación de área.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Historial Cronológico de Anotaciones */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Historial Cronológico ({anotaciones.length})
          </h3>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
          >
            Actualizar historial
          </button>
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Cargando historial de anotaciones internas...
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
            <p className="font-medium">No se pudo cargar el historial de anotaciones internas.</p>
            <p className="text-[11px] mt-1 text-rose-600">{(error as Error)?.message || 'Error del servidor.'}</p>
          </div>
        ) : anotaciones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <p className="text-xs text-slate-500">
              Sin anotaciones internas registradas. Este expediente no cuenta actualmente con anotaciones de seguimiento o supervisión.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {anotaciones.map((anotacion) => (
              <div
                key={anotacion.idAnotacion}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-slate-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    {badgeTipo(anotacion.tipoAnotacion)}
                    <span className="text-xs font-bold text-slate-900">
                      {anotacion.autorNombreCompleto}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      (@{anotacion.autorUsuario})
                    </span>
                    <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                      {anotacion.rolNombre || anotacion.rolCodigo}
                    </span>
                    {anotacion.areaNombre && (
                      <span className="text-[10px] text-slate-500">
                        • {anotacion.areaNombre}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span title={anotacion.creadoEn}>
                      {new Date(anotacion.creadoEn).toLocaleString('es-PE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 border border-slate-200">
                      <Lock className="h-2.5 w-2.5" /> INMUTABLE
                    </span>
                  </div>
                </div>
                <div className="whitespace-pre-wrap text-xs text-slate-800 leading-relaxed pl-1">
                  {anotacion.contenido}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
