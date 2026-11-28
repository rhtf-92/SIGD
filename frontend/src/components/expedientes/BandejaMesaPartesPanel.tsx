import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Inbox, CheckCircle, AlertTriangle, Clock, RefreshCw, Send, Archive, Ban, ShieldCheck } from 'lucide-react';

export type BandejaMpKey =
  | 'pendientes_recepcion'
  | 'recepcionados'
  | 'pendientes_calificacion'
  | 'observados'
  | 'pendientes_subsanacion'
  | 'subsanados'
  | 'conformes'
  | 'rechazados'
  | 'pendientes_derivacion'
  | 'derivados'
  | 'pendientes_recepcion_destino'
  | 'atendidos';

interface BandejaConfig {
  key: BandejaMpKey;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const BANDEJAS_CONFIG: BandejaConfig[] = [
  { key: 'pendientes_recepcion', label: '1. Pendientes de Recepción', icon: <Inbox className="h-4 w-4" />, color: 'bg-amber-100 text-amber-800' },
  { key: 'recepcionados', label: '2. Recepcionados (Cargo)', icon: <CheckCircle className="h-4 w-4" />, color: 'bg-emerald-100 text-emerald-800' },
  { key: 'pendientes_calificacion', label: '3. Pend. Calificación TUPA', icon: <Clock className="h-4 w-4" />, color: 'bg-blue-100 text-blue-800' },
  { key: 'observados', label: '4. Observados', icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-rose-100 text-rose-800' },
  { key: 'pendientes_subsanacion', label: '5. Pend. Subsanación', icon: <Clock className="h-4 w-4" />, color: 'bg-orange-100 text-orange-800' },
  { key: 'subsanados', label: '6. Subsanados', icon: <RefreshCw className="h-4 w-4" />, color: 'bg-purple-100 text-purple-800' },
  { key: 'conformes', label: '7. Conformes', icon: <ShieldCheck className="h-4 w-4" />, color: 'bg-teal-100 text-teal-800' },
  { key: 'rechazados', label: '8. Rechazados / Inadmisibles', icon: <Ban className="h-4 w-4" />, color: 'bg-slate-200 text-slate-800' },
  { key: 'pendientes_derivacion', label: '9. Pend. Derivación', icon: <Send className="h-4 w-4" />, color: 'bg-sky-100 text-sky-800' },
  { key: 'derivados', label: '10. Derivados', icon: <Send className="h-4 w-4" />, color: 'bg-indigo-100 text-indigo-800' },
  { key: 'pendientes_recepcion_destino', label: '11. Pend. Rec. Destino', icon: <Clock className="h-4 w-4" />, color: 'bg-cyan-100 text-cyan-800' },
  { key: 'atendidos', label: '12. Atendidos / Resueltos', icon: <Archive className="h-4 w-4" />, color: 'bg-emerald-100 text-emerald-800' },
];

export const BandejaMesaPartesPanel: React.FC = () => {
  const navigate = useNavigate();
  const [bandejaActiva, setBandejaActiva] = useState<BandejaMpKey>('pendientes_recepcion');
  const [busqueda, setBusqueda] = useState('');

  const { data: contadoresData, isLoading: cargandoContadores, refetch: recargarContadores } = useQuery({
    queryKey: ['mesa-partes', 'contadores'],
    queryFn: async () => {
      const res = await apiClient.get<{ ok: boolean; contadores: Record<BandejaMpKey, number> }>('/api/v1/mesa-partes/contadores');
      return res.data?.contadores;
    },
    refetchInterval: 15000,
  });

  const { data: expedientesData, isLoading: cargandoExpedientes } = useQuery({
    queryKey: ['mesa-partes', 'expedientes', bandejaActiva, busqueda],
    queryFn: async () => {
      const res = await apiClient.get<{
        ok: boolean;
        bandeja: string;
        total: number;
        items: Array<{
          idExpediente: string;
          cut: string;
          asunto: string;
          estadoActual: string;
          fechaRadicacion: string;
          canalIngreso: string;
          procedimientoTupa: string;
          solicitanteNombre: string;
          solicitanteDni: string;
          cargo?: { numeroCargo: string };
        }>;
      }>(`/api/v1/mesa-partes/expedientes`, {
        params: {
          bandeja: bandejaActiva,
          busqueda: busqueda.trim() || undefined,
          limite: 50,
        },
      });
      return res.data;
    },
  });

  const items = expedientesData?.items || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-lg font-bold text-slate-900">
              Mesa de Partes — 12 Bandejas Especializadas de Trazabilidad LPAG
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Control de flujo documental E2E con contadores verificados en PostgreSQL (Ley N° 27444).
          </p>
        </div>
        <button
          type="button"
          onClick={() => recargarContadores()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          Actualizar Contadores
        </button>
      </div>

      {/* Grid de Pestañas con Contadores Reales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {BANDEJAS_CONFIG.map((b) => {
          const count = contadoresData ? contadoresData[b.key] ?? 0 : '—';
          const activa = bandejaActiva === b.key;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setBandejaActiva(b.key)}
              className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                activa
                  ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-500'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className={activa ? 'text-blue-700' : 'text-slate-500'}>{b.icon}</span>
                <span className={`text-xs font-semibold truncate ${activa ? 'text-blue-900 font-bold' : 'text-slate-700'}`}>
                  {b.label}
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  activa ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {cargandoContadores ? '…' : count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtro de búsqueda */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={`Buscar en ${BANDEJAS_CONFIG.find((b) => b.key === bandejaActiva)?.label || 'esta bandeja'} por CUT, asunto, solicitante...`}
          className="w-full max-w-md rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-blue-600 focus:outline-none"
        />
        <span className="text-xs text-slate-500 font-medium">
          Mostrando {items.length} trámite(s) de {expedientesData?.total ?? 0}
        </span>
      </div>

      {/* Tabla de Expedientes de la Bandeja */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
            <tr>
              <th className="p-3 font-semibold">CUT</th>
              <th className="p-3 font-semibold">Asunto / Procedimiento</th>
              <th className="p-3 font-semibold">Solicitante</th>
              <th className="p-3 font-semibold">Canal</th>
              <th className="p-3 font-semibold">Fecha</th>
              <th className="p-3 font-semibold">Estado</th>
              <th className="p-3 font-semibold text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {cargandoExpedientes && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  Cargando expedientes de la bandeja...
                </td>
              </tr>
            )}
            {!cargandoExpedientes && items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  No hay expedientes en esta bandeja.
                </td>
              </tr>
            )}
            {!cargandoExpedientes &&
              items.map((exp) => (
                <tr key={exp.idExpediente} className="hover:bg-blue-50/40 transition">
                  <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                    {exp.cut}
                    {exp.cargo?.numeroCargo && (
                      <span className="block text-[10px] text-emerald-700 font-mono font-medium">
                        ✓ {exp.cargo.numeroCargo}
                      </span>
                    )}
                  </td>
                  <td className="p-3 max-w-xs">
                    <p className="font-semibold text-slate-900 truncate">{exp.asunto}</p>
                    <p className="text-[11px] text-slate-500 truncate">{exp.procedimientoTupa}</p>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <p className="font-medium text-slate-800">{exp.solicitanteNombre}</p>
                    <p className="text-[11px] text-slate-500 font-mono">DNI: {exp.solicitanteDni}</p>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {exp.canalIngreso}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap text-slate-600">
                    {new Date(exp.fechaRadicacion).toLocaleDateString('es-PE')}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                      {exp.estadoActual}
                    </span>
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => navigate(`/expedientes/${exp.idExpediente || exp.cut}`)}
                      className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white px-3 py-1 text-xs font-semibold shadow-sm transition cursor-pointer"
                    >
                      Ver Expediente
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
