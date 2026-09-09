import { useMemo, useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";

interface Rol {
  id: string;
  nombre: string;
  descripcion: string;
  alcance: string;
  usuarios: number;
}

interface PermisoModulo {
  modulo: string;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  derivar: boolean;
  archivar: boolean;
  eliminar: boolean;
  exportar: boolean;
}

const roles: Rol[] = [
  {
    id: "admin",
    nombre: "Administrador",
    descripcion: "Control administrativo general del SIGD.",
    alcance: "Institución",
    usuarios: 2,
  },
  {
    id: "responsable",
    nombre: "Responsable de Área",
    descripcion: "Gestiona documentos de su área y subáreas autorizadas.",
    alcance: "Área y subáreas",
    usuarios: 8,
  },
  {
    id: "operador",
    nombre: "Operador",
    descripcion: "Registra y tramita expedientes según sus funciones.",
    alcance: "Área",
    usuarios: 14,
  },
  {
    id: "consulta",
    nombre: "Consulta",
    descripcion: "Acceso de solo lectura a la información autorizada.",
    alcance: "Asignado",
    usuarios: 5,
  },
];

const permisosIniciales: Record<string, PermisoModulo[]> = {
  admin: [
    { modulo: "Expedientes", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: true, exportar: true },
    { modulo: "Documentos", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: true, exportar: true },
    { modulo: "Administración", ver: true, crear: true, editar: true, derivar: false, archivar: false, eliminar: true, exportar: true },
    { modulo: "Auditoría", ver: true, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: true },
  ],
  responsable: [
    { modulo: "Expedientes", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: false, exportar: true },
    { modulo: "Documentos", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: false, exportar: true },
    { modulo: "Administración", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Auditoría", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
  ],
  operador: [
    { modulo: "Expedientes", ver: true, crear: true, editar: true, derivar: true, archivar: false, eliminar: false, exportar: false },
    { modulo: "Documentos", ver: true, crear: true, editar: true, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Administración", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Auditoría", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
  ],
  consulta: [
    { modulo: "Expedientes", ver: true, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Documentos", ver: true, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Administración", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Auditoría", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
  ],
};

type ClavePermiso = Exclude<keyof PermisoModulo, "modulo">;

const columnas: Array<{ clave: ClavePermiso; etiqueta: string }> = [
  { clave: "ver", etiqueta: "Ver" },
  { clave: "crear", etiqueta: "Crear" },
  { clave: "editar", etiqueta: "Editar" },
  { clave: "derivar", etiqueta: "Derivar" },
  { clave: "archivar", etiqueta: "Archivar" },
  { clave: "eliminar", etiqueta: "Eliminar" },
  { clave: "exportar", etiqueta: "Exportar" },
];

export default function RolesPermisosPage() {
  const [rolSeleccionado, setRolSeleccionado] = useState("admin");
  const [permisos, setPermisos] = useState(permisosIniciales);
  const [mensaje, setMensaje] = useState("");

  const rolActual = useMemo(
    () => roles.find((rol) => rol.id === rolSeleccionado) ?? roles[0],
    [rolSeleccionado],
  );

  function alternarPermiso(indice: number, clave: ClavePermiso) {
    setMensaje("");
    setPermisos((actuales) => ({
      ...actuales,
      [rolSeleccionado]: actuales[rolSeleccionado].map((fila, posicion) =>
        posicion === indice ? { ...fila, [clave]: !fila[clave] } : fila,
      ),
    }));
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Roles y Permisos"
        description="Control de acceso por rol, acción y alcance institucional."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Roles del sistema</h2>

            <div className="space-y-3">
              {roles.map((rol) => (
                <button
                  key={rol.id}
                  type="button"
                  onClick={() => {
                    setRolSeleccionado(rol.id);
                    setMensaje("");
                  }}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    rolSeleccionado === rol.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold">{rol.nombre}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {rol.usuarios}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {rol.descripcion}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-blue-700">
                    Rol seleccionado
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">{rolActual.nombre}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {rolActual.descripcion}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-semibold">Alcance:</span>{" "}
                  {rolActual.alcance}
                </div>
              </div>
            </section>

            {mensaje && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {mensaje}
              </div>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h3 className="font-bold">Matriz de permisos</h3>
                <p className="mt-1 text-xs text-slate-500">
                  La validación definitiva deberá aplicarse también en backend y base de datos.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Módulo</th>
                      {columnas.map((columna) => (
                        <th key={columna.clave} className="px-4 py-3 text-center">
                          {columna.etiqueta}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {permisos[rolSeleccionado].map((fila, indice) => (
                      <tr key={fila.modulo}>
                        <td className="px-5 py-4 text-sm font-semibold">
                          {fila.modulo}
                        </td>
                        {columnas.map((columna) => (
                          <td key={columna.clave} className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={fila[columna.clave]}
                              onChange={() => alternarPermiso(indice, columna.clave)}
                              className="h-4 w-4 accent-blue-700"
                              aria-label={`${columna.etiqueta} en ${fila.modulo}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-slate-200 p-5">
                <button
                  type="button"
                  onClick={() =>
                    setMensaje(
                      "Configuración guardada en la vista de demostración. Falta persistencia del backend.",
                    )
                  }
                  className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Guardar permisos
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
