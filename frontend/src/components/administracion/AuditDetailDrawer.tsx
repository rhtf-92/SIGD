// Drawer de detalle forense con diff JSON (ENT-M05-04)
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { RegistroAuditoria } from "../../types/auditoriaForense";
import { serializar } from "../../hooks/useAuditLogs";

interface AuditDetailDrawerProps {
  registro: RegistroAuditoria | null;
  onClose: () => void;
}

function BloqueJson({ titulo, valor }: { titulo: string; valor: unknown }) {
  if (valor === undefined || valor === null) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/90">
      <p className="border-b border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-bold uppercase text-sky-300">
        {titulo}
      </p>
      <pre className="overflow-x-auto p-3 text-xs leading-5 text-slate-100">
        {JSON.stringify(valor, null, 2)}
      </pre>
    </div>
  );
}

export default function AuditDetailDrawer({
  registro,
  onClose,
}: AuditDetailDrawerProps) {
  useEffect(() => {
    if (!registro) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [registro, onClose]);

  if (!registro) return null;

  const detalles = serializar(registro.detallesTecnicos);
  const anterior = detalles["anterior"];
  const nuevo = detalles["nuevo"];
  const resto: [string, unknown][] = Object.entries(detalles).filter(
    ([clave]) => clave !== "anterior" && clave !== "nuevo",
  );

  const contenido = (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-slate-950/65 backdrop-blur-xs"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle del registro ${registro.id}`}
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-sky-400/20 bg-slate-950 text-slate-100 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-6">
          <div>
            <p className="text-xs font-bold uppercase text-sky-400">
              Registro {registro.id}
            </p>
            <h3 className="mt-1 text-xl font-bold text-white">{registro.accion}</h3>
            <p className="mt-1 text-sm text-slate-400">
              {registro.fecha} · {registro.modulo}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-5 p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">
                Usuario
              </dt>
              <dd className="mt-1 font-semibold text-white">{registro.usuario}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">
                Rol / Área
              </dt>
              <dd className="mt-1 text-slate-200">
                {registro.rol} · {registro.area}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">
                Recurso
              </dt>
              <dd className="mt-1 text-slate-200">{registro.registro}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">
                Resultado
              </dt>
              <dd className="mt-1">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    registro.resultado === "Exitoso"
                      ? "bg-emerald-900/70 text-emerald-200"
                      : registro.resultado === "Denegado"
                        ? "bg-amber-900/70 text-amber-200"
                        : "bg-red-900/70 text-red-200"
                  }`}
                >
                  {registro.resultado}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">
                IP de origen
              </dt>
              <dd className="mt-1 font-mono text-slate-200">{registro.ip}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">
                X-Correlation-ID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-300">
                {registro.correlationId ?? "—"}
              </dd>
            </div>
          </dl>

          {(anterior !== undefined || nuevo !== undefined) && (
            <section>
              <h4 className="mb-3 text-sm font-bold uppercase text-slate-400">
                Diferencias JSON (antes / después)
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <BloqueJson titulo="Anterior" valor={anterior} />
                <BloqueJson titulo="Nuevo" valor={nuevo} />
              </div>
            </section>
          )}

          {resto.length > 0 && (
            <section>
              <h4 className="mb-3 text-sm font-bold uppercase text-slate-400">
                Detalles técnicos (RFC 7807)
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {resto.map(([clave, valor]) => (
                  <BloqueJson key={clave} titulo={clave} valor={valor} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(contenido, document.body) : contenido;
}