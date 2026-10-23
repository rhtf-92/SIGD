import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import OrganigramaTreeView from "../../components/administracion/OrganigramaTreeView";
import { useTablasMaestras } from "../../hooks/useTablasMaestras";

export default function TablasMaestrasPage() {
  const {
    tipos,
    registros,
    areasOrganicas,
    tipoActivo,
    cambiarTipo,
    busqueda,
    setBusqueda,
    mensaje,
    isLoading,
    estadoCarga,
    errorCarga,
  } = useTablasMaestras();

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Tablas Maestras"
        description="Configuración institucional de sedes, organigrama y tipos documentales."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {mensaje && (
          <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {mensaje}
          </div>
        )}

        {errorCarga && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorCarga}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {tipos.map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => cambiarTipo(tipo)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  tipoActivo === tipo
                    ? "bg-blue-700 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tipo}
              </button>
            ))}
          </div>

          <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            Catálogo Oficial (Solo Lectura)
          </span>
        </div>

        {tipoActivo === "Áreas" && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Organigrama institucional</h2>
            <p className="mt-1 text-sm text-slate-500">
              Jerarquía bajo el modelo Materialized Path (formato{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-xs">
                01.03.02
              </code>
              ).
            </p>
            <div className="mt-4">
              <OrganigramaTreeView areas={areasOrganicas} />
            </div>
          </section>
        )}

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-xl">
              <label className="mb-2 block text-sm font-semibold">
                Buscar en {tipoActivo.toLowerCase()}
              </label>
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Código, nombre o detalle"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <p className="text-xs text-slate-500">
              {registros.length} registro{registros.length === 1 ? "" : "s"} sincronizados
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold">{tipoActivo}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Catálogo institucional oficial. Preserva la trazabilidad histórica de los expedientes.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Código</th>
                  <th className="px-6 py-3">Nombre</th>
                  <th className="px-6 py-3">Detalle / Jerarquía</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Disponibilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                      Cargando catálogo institucional...
                    </td>
                  </tr>
                )}
                {!isLoading && estadoCarga === "error" && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-red-600 font-semibold">
                      Error al consultar el catálogo institucional.
                    </td>
                  </tr>
                )}
                {!isLoading && estadoCarga !== "error" && registros.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                      No se encontraron registros coincidentes.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  registros.map((registro) => (
                    <tr key={registro.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-semibold">
                        {registro.codigo}
                      </td>
                      <td className="px-6 py-4 text-sm">{registro.nombre}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {registro.detalle}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            registro.estado === "Activo"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {registro.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {registro.disponible === false ? (
                          <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                            Pendiente DDL
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                            Solo lectura
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
