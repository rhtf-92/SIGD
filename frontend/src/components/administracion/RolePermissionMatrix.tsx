import type { AccionOperativa, PermisoDetalleDTO } from "../../types/rbacRoles";

interface RolePermissionMatrixProps {
  permisos: PermisoDetalleDTO[];
  onTogglePermiso: (modulo: string, accion: AccionOperativa, valor: boolean) => void;
  esSuperAdmin: boolean;
  loading: boolean;
}

const ACCIONES: Array<{ clave: AccionOperativa; etiqueta: string }> = [
  { clave: "ver", etiqueta: "Ver" },
  { clave: "crear", etiqueta: "Crear" },
  { clave: "editar", etiqueta: "Editar" },
  { clave: "derivar", etiqueta: "Derivar" },
  { clave: "archivar", etiqueta: "Archivar" },
  { clave: "eliminar", etiqueta: "Eliminar" },
  { clave: "exportar", etiqueta: "Exportar" },
];

export default function RolePermissionMatrix({
  permisos,
  onTogglePermiso,
  esSuperAdmin,
  loading,
}: RolePermissionMatrixProps) {
  const estaDeshabilitado = esSuperAdmin || loading;

  if (permisos.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          No hay permisos cargados para este rol.
        </p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h3 className="font-bold">Matriz de permisos</h3>
        <p className="mt-1 text-xs text-slate-500">
          {esSuperAdmin
            ? "El rol SUPER_ADMIN es de sololectura: todos los permisos están habilitados por definición."
            : "Marca o desmarca permisos según las necesidades del rol."}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Módulo</th>
              {ACCIONES.map((accion) => (
                <th key={accion.clave} className="px-4 py-3 text-center">
                  {accion.etiqueta}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {permisos.map((fila) => (
              <tr key={fila.modulo}>
                <td className="px-5 py-4 text-sm font-semibold">{fila.modulo}</td>
                {ACCIONES.map((accion) => {
                  const valor = fila[accion.clave];
                  return (
                    <td
                      key={accion.clave}
                      className="px-4 py-4 text-center"
                    >
                      <input
                        type="checkbox"
                        checked={valor}
                        disabled={estaDeshabilitado}
                        onChange={(evento) =>
                          onTogglePermiso(
                            fila.modulo,
                            accion.clave,
                            evento.target.checked,
                          )
                        }
                        className={`h-4 w-4 ${
                          esSuperAdmin
                            ? "cursor-not-allowed opacity-60"
                            : "accent-blue-700"
                        }`}
                        aria-label={`${accion.etiqueta} en ${fila.modulo}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}