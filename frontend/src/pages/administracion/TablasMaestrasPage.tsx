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
    mostrarFormulario,
    setMostrarFormulario,
    codigo,
    setCodigo,
    nombre,
    setNombre,
    detalle,
    setDetalle,
    mensaje,
    setMensaje,
    crearRegistro,
    alternarEstado,
  } = useTablasMaestras();

  return (
    <main className="sigd-fade-in admin-dark min-h-screen bg-transparent text-[#0b2a4a]">
      <AdminPageHeader
        title="Tablas Maestras"
        description="Configuración institucional de sedes, organigrama y tipos documentales."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {mensaje && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensaje}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          {tipos.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => cambiarTipo(tipo)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                tipoActivo === tipo
                  ? "bg-[#006ec7] text-white"
                  : "border border-[#bfe0f7] bg-white text-[#2f648c] hover:bg-[#f4f8fb]"
              }`}
            >
              {tipo}
            </button>
          ))}
        </div>

        {tipoActivo === "Áreas" && (
          <section className="mb-6 rounded-xl border border-[#bfe0f7] bg-white backdrop-blur-[12px] p-6 shadow-sm">
            <h2 className="text-lg font-bold">Organigrama institucional</h2>
            <p className="mt-1 text-sm text-[#4b6b85]">
              Jerarquía bajo el modelo Materialized Path (formato{" "}
              <code className="rounded bg-[#e8f4ff] px-1 font-mono text-xs">
                01.03.02
              </code>
              ).
            </p>
            <div className="mt-4">
              <OrganigramaTreeView areas={areasOrganicas} />
            </div>
          </section>
        )}

        <section className="mb-6 rounded-xl border border-[#bfe0f7] bg-white backdrop-blur-[12px] p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-xl">
              <label className="mb-2 block text-sm font-semibold">
                Buscar en {tipoActivo.toLowerCase()}
              </label>
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Código, nombre o detalle"
                className="w-full rounded-lg border border-[#bfe0f7] px-3 py-2.5 text-sm outline-none focus:border-[#006ec7]"
              />
            </div>

            <button
              type="button"
              onClick={() => setMostrarFormulario((actual) => !actual)}
              className="rounded-lg bg-[#006ec7] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition-all duration-300 ease-out"
            >
              + Nuevo registro
            </button>
          </div>

          {mostrarFormulario && (
            <div className="mt-5 grid gap-4 border-t border-[#d7e9f7] pt-5 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Código</label>
                <input
                  value={codigo}
                  onChange={(event) => setCodigo(event.target.value)}
                  placeholder="Ej. ARE-007"
                  className="w-full rounded-lg border border-[#bfe0f7] px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Nombre</label>
                <input
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Nombre del registro"
                  className="w-full rounded-lg border border-[#bfe0f7] px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Detalle</label>
                <input
                  value={detalle}
                  onChange={(event) => setDetalle(event.target.value)}
                  placeholder="Dependencia, descripción, etc."
                  className="w-full rounded-lg border border-[#bfe0f7] px-3 py-2.5 text-sm"
                />
              </div>

              <div className="flex gap-3 md:col-span-3 md:justify-end">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="rounded-lg border border-[#bfe0f7] px-4 py-2 text-sm font-semibold hover:bg-[#e8f4ff]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={crearRegistro}
                  className="rounded-lg bg-[#006ec7] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition-all duration-300 ease-out"
                >
                  Guardar registro
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-[#bfe0f7] bg-white backdrop-blur-[12px] shadow-sm">
          <div className="border-b border-[#d7e9f7] px-6 py-4">
            <h2 className="font-bold">{tipoActivo}</h2>
            <p className="mt-1 text-xs text-[#4b6b85]">
              Se utiliza inactivación (borrado lógico) en lugar de borrado
              definitivo para conservar la trazabilidad histórica.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-[#f4f8fb] text-xs uppercase text-[#4b6b85]">
                <tr>
                  <th className="px-6 py-3">Código</th>
                  <th className="px-6 py-3">Nombre</th>
                  <th className="px-6 py-3">Detalle / Jerarquía</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registros.map((registro) => (
                  <tr key={registro.id} className="hover:bg-[#f4f8fb]">
                    <td className="px-6 py-4 text-sm font-semibold">
                      {registro.codigo}
                    </td>
                    <td className="px-6 py-4 text-sm">{registro.nombre}</td>
                    <td className="px-6 py-4 text-sm text-[#4b6b85]">
                      {registro.detalle}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          registro.estado === "Activo"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-[#d7e9f7] text-[#2f648c]"
                        }`}
                      >
                        {registro.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          setMensaje("");
                          alternarEstado(registro.id);
                        }}
                        className="rounded-lg border border-[#bfe0f7] px-3 py-2 text-xs font-semibold hover:bg-[#e8f4ff]"
                      >
                        {registro.estado === "Activo" ? "Inactivar" : "Activar"}
                      </button>
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