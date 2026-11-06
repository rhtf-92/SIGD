// Drawer de detalle forense con diff JSON (ENT-M05-04)
import type { RegistroAuditoria } from "../../types/auditoriaForense";
import { serializar } from "../../hooks/useAuditLogs";

interface AuditDetailDrawerProps {
  registro: RegistroAuditoria | null;
  onClose: () => void;
}

function BloqueJson({ titulo, valor }: { titulo: string; valor: unknown }) {
  if (valor === undefined || valor === null) return null;

  return (
    <div className="rounded-lg border border-cyan-400/25 bg-slate-950/30">
      <p className="border-b border-cyan-400/25 bg-slate-900/50 px-3 py-2 text-xs font-bold uppercase text-slate-400">
        {titulo}
      </p>
      <pre className="overflow-x-auto p-3 text-xs leading-5 text-slate-200">
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
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 sigd-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle del registro ${registro.id}`}
    >
      <div className="sigd-fade-in flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-cyan-400/40 bg-[rgba(15,23,42,0.72)] shadow-xl backdrop-blur-[12px]">
        <div className="flex items-start justify-between gap-4 border-b border-cyan-400/25 p-6">
          <div>
            <p className="text-xs font-bold uppercase text-cyan-400">
              Registro {registro.id}
            </p>
            <h3 className="mt-1 text-xl font-bold">{registro.accion}</h3>
            <p className="mt-1 text-sm text-slate-400">
              {registro.fecha} · {registro.modulo}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-400 hover:bg-slate-900/50"
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
              <dd className="mt-1 font-semibold">{registro.usuario}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">
                Rol / Área
              </dt>
              <dd className="mt-1">
                {registro.rol} · {registro.area}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">
                Recurso
              </dt>
              <dd className="mt-1">{registro.registro}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">
                Resultado
              </dt>
              <dd className="mt-1">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    registro.resultado === "Exitoso"
                      ? "bg-emerald-100 text-emerald-700"
                      : registro.resultado === "Denegado"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-300"
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
              <dd className="mt-1 font-mono">{registro.ip}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">
                X-Correlation-ID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-300">
                {registro.correlationId ?? "—"}
              </dd>
            </div>
            {registro.hash && (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Hash WORM (SHA-256)
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-300">
                  {registro.hash}
                </dd>
              </div>
            )}
            {registro.hashAnterior && (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Hash Anterior (encadenamiento)
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-300">
                  {registro.hashAnterior}
                </dd>
              </div>
            )}
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
}