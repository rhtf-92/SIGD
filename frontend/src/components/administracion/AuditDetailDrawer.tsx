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
    <div className="rounded-lg border border-[#d7e9f7] bg-[#f4f8fb]">
      <p className="border-b border-[#d7e9f7] bg-[#e8f4ff] px-3 py-2 text-xs font-bold uppercase text-[#6b8aa5]">
        {titulo}
      </p>
      <pre className="overflow-x-auto p-3 text-xs leading-5 text-[#2f648c]">
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
      className="fixed inset-0 z-50 flex justify-end bg-[#0b2a4a]/35 sigd-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle del registro ${registro.id}`}
    >
      <div className="sigd-fade-in flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-[#bfe0f7] bg-white shadow-xl backdrop-blur-[12px]">
        <div className="flex items-start justify-between gap-4 border-b border-[#d7e9f7] p-6">
          <div>
            <p className="text-xs font-bold uppercase text-[#006ec7]">
              Registro {registro.id}
            </p>
            <h3 className="mt-1 text-xl font-bold">{registro.accion}</h3>
            <p className="mt-1 text-sm text-[#6b8aa5]">
              {registro.fecha} · {registro.modulo}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[#6b8aa5] hover:bg-[#e8f4ff]"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-5 p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-[#6b8aa5]">
                Usuario
              </dt>
              <dd className="mt-1 font-semibold">{registro.usuario}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#6b8aa5]">
                Rol / Área
              </dt>
              <dd className="mt-1">
                {registro.rol} · {registro.area}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#6b8aa5]">
                Recurso
              </dt>
              <dd className="mt-1">{registro.registro}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#6b8aa5]">
                Resultado
              </dt>
              <dd className="mt-1">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    registro.resultado === "Exitoso"
                      ? "bg-emerald-100 text-emerald-700"
                      : registro.resultado === "Denegado"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-600"
                  }`}
                >
                  {registro.resultado}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#6b8aa5]">
                IP de origen
              </dt>
              <dd className="mt-1 font-mono">{registro.ip}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#6b8aa5]">
                X-Correlation-ID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-[#4b6b85]">
                {registro.correlationId ?? "—"}
              </dd>
            </div>
            {registro.hash && (
              <div>
                <dt className="text-xs font-semibold uppercase text-[#6b8aa5]">
                  Hash WORM (SHA-256)
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-[#4b6b85]">
                  {registro.hash}
                </dd>
              </div>
            )}
            {registro.hashAnterior && (
              <div>
                <dt className="text-xs font-semibold uppercase text-[#6b8aa5]">
                  Hash Anterior (encadenamiento)
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-[#4b6b85]">
                  {registro.hashAnterior}
                </dd>
              </div>
            )}
          </dl>

          {(anterior !== undefined || nuevo !== undefined) && (
            <section>
              <h4 className="mb-3 text-sm font-bold uppercase text-[#6b8aa5]">
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
              <h4 className="mb-3 text-sm font-bold uppercase text-[#6b8aa5]">
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