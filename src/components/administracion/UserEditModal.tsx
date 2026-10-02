// Modal de administración de cuentas de usuario (ENT-M05-02)
import { useState } from "react";

import type { EstadoUsuario, Usuario } from "../../types/usuarioAdmin";

interface UserEditModalProps {
  usuario: Usuario;
  areas: string[];
  sedes: string[];
  roles: string[];
  onClose: () => void;
  onSave: (usuario: Usuario) => void;
}

export default function UserEditModal({
  usuario,
  areas,
  sedes,
  roles,
  onClose,
  onSave,
}: UserEditModalProps) {
  const [edicion, setEdicion] = useState<Usuario>({ ...usuario });

  function actualizar<K extends keyof Usuario>(clave: K, valor: Usuario[K]) {
    setEdicion((actual) => ({ ...actual, [clave]: valor }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Administrar cuenta de ${usuario.nombre}`}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Administrar cuenta</h3>
            <p className="mt-1 text-sm text-slate-500">{usuario.nombre}</p>
            <p className="mt-0.5 text-xs text-slate-400">DNI: {usuario.dni}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>

        <div className="grid gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Área</label>
            <select
              value={edicion.area}
              onChange={(event) => actualizar("area", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">
              Sede (plaza)
            </label>
            <select
              value={edicion.sede}
              onChange={(event) => actualizar("sede", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              {sedes.map((sede) => (
                <option key={sede} value={sede}>
                  {sede}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">Cargo</label>
            <input
              value={edicion.cargo}
              onChange={(event) => actualizar("cargo", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">Rol</label>
            <select
              value={edicion.rol}
              onChange={(event) => actualizar("rol", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              {roles.map((rol) => (
                <option key={rol} value={rol}>
                  {rol}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">
              Correo institucional
            </label>
            <input
              value={edicion.correo}
              onChange={(event) => actualizar("correo", event.target.value)}
              placeholder="@institutosuiza.edu.pe"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">Estado</label>
            <select
              value={edicion.estado}
              onChange={(event) =>
                actualizar("estado", event.target.value as EstadoUsuario)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
              <option value="Bloqueado">Bloqueado</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(edicion)}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}