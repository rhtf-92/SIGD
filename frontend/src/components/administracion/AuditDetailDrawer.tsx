// Drawer de detalle forense con diff JSON (ENT-M05-04)
import type { RegistroAuditoria } from "../../types/auditoriaForense";
import { serializar } from "../../hooks/useAuditLogs";
import { X, FileCode2, Shield, Network, User, Calendar, Database } from "lucide-react";
import StatusBadge from "./common/StatusBadge";

interface AuditDetailDrawerProps {
  registro: RegistroAuditoria | null;
  onClose: () => void;
}

function BloqueJson({ titulo, valor }: { titulo: string; valor: unknown }) {
  if (valor === undefined || valor === null) return null;

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 overflow-hidden shadow-inner">
      <div className="flex items-center gap-2 border-b border-slate-800/80 bg-slate-900/80 px-3.5 py-2">
        <FileCode2 className="h-3.5 w-3.5 text-cyan-400" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
          {titulo}
        </p>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-cyan-200">
        {JSON.stringify(valor, null, 2)}
      </pre>
    </div>
  );
}

export default function AuditDetailDrawer({
  registro,
  onClose,
}: AuditDetailDrawerProps) {
  if (!registro) return null;

  const detalles = serializar(registro.detallesTecnicos);
  const anterior = detalles["anterior"];
  const nuevo = detalles["nuevo"];
  const resto: [string, unknown][] = Object.entries(detalles).filter(
    ([clave]) => clave !== "anterior" && clave !== "nuevo",
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle forense del evento ${registro.id}`}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-cyan-500/30 bg-slate-900/95 shadow-2xl backdrop-blur-2xl text-slate-100 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">
                  Registro WORM #{registro.id}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400">{registro.modulo}</span>
              </div>
              <h3 className="mt-1 text-xl font-bold tracking-tight text-white">
                {registro.accion}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>{registro.fecha}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-800/60 p-2 text-slate-400 hover:text-white hover:border-slate-700 transition cursor-pointer"
            aria-label="Cerrar detalle"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3.5 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <User className="h-3 w-3 text-cyan-400" />
                <span>Usuario</span>
              </dt>
              <dd className="mt-1 text-sm font-semibold text-white">
                {registro.usuario}
              </dd>
            </div>

            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Rol / Unidad
              </dt>
              <dd className="mt-1 text-xs text-slate-300">
                {registro.rol} · {registro.area}
              </dd>
            </div>

            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Database className="h-3 w-3 text-cyan-400" />
                <span>Recurso / CUT</span>
              </dt>
              <dd className="mt-1 font-mono text-xs font-semibold text-cyan-300">
                {registro.registro}
              </dd>
            </div>

            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Resultado
              </dt>
              <dd className="mt-1">
                <StatusBadge status={registro.resultado} />
              </dd>
            </div>

            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Network className="h-3 w-3 text-cyan-400" />
                <span>IP de Origen</span>
              </dt>
              <dd className="mt-1 font-mono text-xs text-slate-300">
                {registro.ip}
              </dd>
            </div>

            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                X-Correlation-ID
              </dt>
              <dd className="mt-1 font-mono text-[11px] text-slate-400 break-all">
                {registro.correlationId ?? "—"}
              </dd>
            </div>
          </div>

          {/* JSON Diff (Before vs After) */}
          {(anterior !== undefined || nuevo !== undefined) && (
            <div>
              <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileCode2 className="h-4 w-4 text-cyan-400" />
                <span>Diferencias de Estado (Antes / Después)</span>
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <BloqueJson titulo="Estado Previo" valor={anterior} />
                <BloqueJson titulo="Nuevo Estado" valor={nuevo} />
              </div>
            </div>
          )}

          {/* Technical RFC 7807 details */}
          {resto.length > 0 && (
            <div>
              <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-cyan-400" />
                <span>Parámetros Forenses y Errores (RFC 7807)</span>
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {resto.map(([clave, valor]) => (
                  <BloqueJson key={clave} titulo={clave} valor={valor} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}