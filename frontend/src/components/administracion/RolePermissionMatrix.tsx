// Matriz interactiva de permisos RBAC por módulo y acción (ENT-M05-03)
import type { ClavePermiso, PermisoModulo } from "../../types/rbacRoles";
import { ACCIONES_INMUTABLES_AUDITORIA } from "../../hooks/useRbacConfig";

export const columnasPermisos: Array<{ clave: ClavePermiso; etiqueta: string }> =
  [
    { clave: "ver", etiqueta: "Ver" },
    { clave: "crear", etiqueta: "Crear" },
    { clave: "editar", etiqueta: "Editar" },
    { clave: "derivar", etiqueta: "Derivar" },
    { clave: "archivar", etiqueta: "Archivar" },
    { clave: "eliminar", etiqueta: "Eliminar" },
    { clave: "exportar", etiqueta: "Exportar" },
  ];

interface RolePermissionMatrixProps {
  permisos: PermisoModulo[];
  onAlternar: (indice: number, clave: ClavePermiso) => void;
}

function esLecturaInmutable(modulo: string, clave: ClavePermiso): boolean {
  return (
    modulo === "Auditoría" &&
    ACCIONES_INMUTABLES_AUDITORIA.includes(clave)
  );
}

export default function RolePermissionMatrix({
  permisos,
  onAlternar,
}: RolePermissionMatrixProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-5 py-3">Módulo</th>
            {columnasPermisos.map((columna) => (
              <th key={columna.clave} className="px-4 py-3 text-center">
                {columna.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {permisos.map((fila, indice) => (
            <tr key={fila.modulo}>
              <td className="px-5 py-4 text-sm font-semibold">{fila.modulo}</td>
              {columnasPermisos.map((columna) => {
                const bloqueado = esLecturaInmutable(
                  fila.modulo,
                  columna.clave,
                );
                return (
                  <td key={columna.clave} className="px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={fila[columna.clave]}
                      disabled={bloqueado}
                      onChange={() => onAlternar(indice, columna.clave)}
                      className="h-4 w-4 accent-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`${columna.etiqueta} en ${fila.modulo}`}
                      title={
                        bloqueado
                          ? "Acción bloqueada por inmutabilidad (principio WORM)"
                          : undefined
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        El módulo Auditoría mantiene las acciones crear, editar, derivar y
        eliminar deshabilitadas incluso para el Administrador (principio WORM).
      </p>
    </div>
  );
}