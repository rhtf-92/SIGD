import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import AuditDetailDrawer from "../../components/administracion/AuditDetailDrawer";
import { useAuditLogs } from "../../hooks/useAuditLogs";

function estiloResultado(resultado: string) {
  if (resultado === "Exitoso") return "bg-emerald-100 text-emerald-700";
  if (resultado === "Denegado") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function AuditoriaPage() {
  const {
    filtrados,
    resumen,
    busqueda,
    setBusqueda,
    modulo,
    setModulo,
    resultado,
    setResultado,
    seleccionado,
    setSeleccionado,
    exportarCsv,
  } = useAuditLogs();

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Logs de Auditoría"
        description="Trazabilidad inmutable (WORM), acciones, accesos y correlación X-Correlation-ID."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Los registros de auditoría son de solo lectura. La inmutabilidad real
          debe garantizarse en backend y base de datos (append-only + hash
          encadenado).
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-semibold text-emerald-800">
              Eventos exitosos
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {resumen.exitosos}
            </p>
          </article>
          <article className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-800">
              Acciones denegadas (403)
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-700">
              {resumen.denegados}
            </p>
          </article>
          <article className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-800">
              Errores de sistema (RFC 7807)
            </p>
            <p className="mt-2 text-3xl font-bold text-red-700">
              {resumen.errores}
            </p>
          </article>
        </div>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_auto]">
            <div>
              <label className="mb-2 block text-sm font-semibold">Buscar</label>
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Usuario, acción, expediente, ID o X-Correlation-ID"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Módulo</label>
              <select
                value={modulo}
                onChange={(event) => setModulo(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option>Todos</option>
                <option>Expedientes</option>
                <option>Documentos</option>
                <option>Autenticación</option>
                <option>Seguridad</option>
                <option>Administración</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Resultado
              </label>
              <select
                value={resultado}
                onChange={(event) =>
                  setResultado(
                    event.target.value as "Exitoso" | "Denegado" | "Error" | "Todos",
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="Todos">Todos</option>
                <option value="Exitoso">Exitoso</option>
                <option value="Denegado">Denegado</option>
                <option value="Error">Error</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={exportarCsv}
                className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold">Registro de eventos</h2>
            <p className="mt-1 text-xs text-slate-500">
              {filtrados.length} evento
              {filtrados.length === 1 ? "" : "s"} encontrado
              {filtrados.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1350px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">ID / Fecha</th>
                  <th className="px-5 py-3">Usuario</th>
                  <th className="px-5 py-3">Área</th>
                  <th className="px-5 py-3">Acción</th>
                  <th className="px-5 py-3">Módulo</th>
                  <th className="px-5 py-3">Registro</th>
                  <th className="px-5 py-3">Resultado</th>
                  <th className="px-5 py-3">IP</th>
                  <th className="px-5 py-3">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((registro) => (
                  <tr key={registro.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold">{registro.id}</p>
                      <p className="text-xs text-slate-500">{registro.fecha}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold">{registro.usuario}</p>
                      <p className="text-xs text-slate-500">{registro.rol}</p>
                    </td>
                    <td className="px-5 py-4 text-sm">{registro.area}</td>
                    <td className="px-5 py-4 text-sm">{registro.accion}</td>
                    <td className="px-5 py-4 text-sm">{registro.modulo}</td>
                    <td className="px-5 py-4 text-sm font-medium">
                      {registro.registro}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estiloResultado(
                          registro.resultado,
                        )}`}
                      >
                        {registro.resultado}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">
                      {registro.ip}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setSeleccionado(registro)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <AuditDetailDrawer
        registro={seleccionado}
        onClose={() => setSeleccionado(null)}
      />
    </main>
  );
}