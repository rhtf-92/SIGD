import { useMemo, useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";

type TipoTabla = "Sedes" | "Áreas" | "Tipos documentales";
type EstadoRegistro = "Activo" | "Inactivo";

interface RegistroMaestro {
  id: number;
  tipo: TipoTabla;
  codigo: string;
  nombre: string;
  detalle: string;
  estado: EstadoRegistro;
}

const registrosIniciales: RegistroMaestro[] = [
  { id: 1, tipo: "Sedes", codigo: "SED-001", nombre: "Sede Principal", detalle: "Instituto Suiza", estado: "Activo" },
  { id: 2, tipo: "Áreas", codigo: "ARE-001", nombre: "Dirección General", detalle: "Nivel superior", estado: "Activo" },
  { id: 3, tipo: "Áreas", codigo: "ARE-002", nombre: "Secretaría Académica", detalle: "Depende de Dirección General", estado: "Activo" },
  { id: 4, tipo: "Áreas", codigo: "ARE-003", nombre: "Mesa de Partes", detalle: "Depende de Administración", estado: "Activo" },
  { id: 5, tipo: "Tipos documentales", codigo: "TD-001", nombre: "Solicitud", detalle: "Documento de trámite general", estado: "Activo" },
  { id: 6, tipo: "Tipos documentales", codigo: "TD-002", nombre: "Informe", detalle: "Documento informativo o técnico", estado: "Activo" },
  { id: 7, tipo: "Tipos documentales", codigo: "TD-003", nombre: "Memorando", detalle: "Comunicación interna", estado: "Inactivo" },
];

const tipos: TipoTabla[] = ["Sedes", "Áreas", "Tipos documentales"];

export default function TablasMaestrasPage() {
  const [registros, setRegistros] = useState(registrosIniciales);
  const [tipoActivo, setTipoActivo] = useState<TipoTabla>("Sedes");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [detalle, setDetalle] = useState("");

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return registros.filter(
      (registro) =>
        registro.tipo === tipoActivo &&
        (texto === "" ||
          registro.codigo.toLowerCase().includes(texto) ||
          registro.nombre.toLowerCase().includes(texto) ||
          registro.detalle.toLowerCase().includes(texto)),
    );
  }, [busqueda, registros, tipoActivo]);

  function crearRegistro() {
    if (!codigo.trim() || !nombre.trim()) return;

    setRegistros((actuales) => [
      ...actuales,
      {
        id: Math.max(0, ...actuales.map((registro) => registro.id)) + 1,
        tipo: tipoActivo,
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        detalle: detalle.trim() || "Sin detalle",
        estado: "Activo",
      },
    ]);

    setCodigo("");
    setNombre("");
    setDetalle("");
    setMostrarFormulario(false);
  }

  function alternarEstado(id: number) {
    setRegistros((actuales) =>
      actuales.map((registro) =>
        registro.id === id
          ? {
              ...registro,
              estado: registro.estado === "Activo" ? "Inactivo" : "Activo",
            }
          : registro,
      ),
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Tablas Maestras"
        description="Configuración institucional de sedes, organigrama y tipos documentales."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {tipos.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => {
                setTipoActivo(tipo);
                setBusqueda("");
                setMostrarFormulario(false);
              }}
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

            <button
              type="button"
              onClick={() => setMostrarFormulario((actual) => !actual)}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              + Nuevo registro
            </button>
          </div>

          {mostrarFormulario && (
            <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Código</label>
                <input
                  value={codigo}
                  onChange={(event) => setCodigo(event.target.value)}
                  placeholder="Ej. ARE-004"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Nombre</label>
                <input
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Nombre del registro"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Detalle</label>
                <input
                  value={detalle}
                  onChange={(event) => setDetalle(event.target.value)}
                  placeholder="Dependencia, descripción, etc."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="flex gap-3 md:col-span-3 md:justify-end">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={crearRegistro}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Guardar registro
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold">{tipoActivo}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Se utiliza inactivación en lugar de borrado definitivo para conservar trazabilidad.
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
                  <th className="px-6 py-3">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((registro) => (
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
                      <button
                        type="button"
                        onClick={() => alternarEstado(registro.id)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100"
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
