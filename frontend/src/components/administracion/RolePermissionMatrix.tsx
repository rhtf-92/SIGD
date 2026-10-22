// Matriz interactiva de permisos RBAC por módulo y acción (ENT-M05-03)
import type { ClavePermiso, PermisoModulo } from "../../types/rbacRoles";
import { ACCIONES_INMUTABLES_AUDITORIA } from "../../hooks/useRbacConfig";
import { Lock, Shield } from "lucide-react";

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
      <table className="w-full min-w-[850px] text-left">
        <thead className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-5 py-3.5">Módulo Institucional</th>
            {columnasPermisos.map((columna) => (
              <th key={columna.clave} className="px-4 py-3.5 text-center">
                {columna.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {permisos.map((fila, indice) => (
            <tr
              key={fila.modulo}
              className="hover:bg-slate-800/40 transition-colors group"
            >
              <td className="px-5 py-3.5 text-sm font-semibold text-white group-hover:text-cyan-200 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                <span>{fila.modulo}</span>
              </td>
              {columnasPermisos.map((columna) => {
                const bloqueado = esLecturaInmutable(
                  fila.modulo,
                  columna.clave,
                );
                return (
                  <td key={columna.clave} className="px-4 py-3.5 text-center">
                    <label className="inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fila[columna.clave]}
                        disabled={bloqueado}
                        onChange={() => onAlternar(indice, columna.clave)}
                        className="h-4 w-4 rounded-md border-slate-700 bg-slate-900 text-cyan-500 accent-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                        aria-label={`${columna.etiqueta} en ${fila.modulo}`}
                        title={
                          bloqueado
                            ? "Acción bloqueada por inmutabilidad normativa (principio WORM)"
                            : `${columna.etiqueta} en ${fila.modulo}`
                        }
                      />
                      {bloqueado && (
                        <span title="Bloqueado por inmutabilidad WORM">
                          <Lock
                            className="h-3 w-3 text-slate-500 ml-1"
                            aria-hidden="true"
                          />
                        </span>
                      )}
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 border-t border-slate-800/80 bg-slate-950/40 px-5 py-3 text-xs text-slate-400">
        <Shield className="h-4 w-4 text-cyan-400 shrink-0" />
        <span>
          El módulo <strong>Auditoría</strong> mantiene las acciones crear, editar, derivar y eliminar deshabilitadas por principio WORM (Write Once, Read Many).
        </span>
      </div>
    </div>
  );
}