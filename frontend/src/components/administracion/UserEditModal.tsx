import { useForm } from "react-hook-form";

import { extraerInvalidParams } from "../../services/adminUsuariosService";
import type { ApiHttpError } from "../../types/api";
import type { EstadoUsuario, OpcionCatalogo, Usuario } from "../../types/usuarioAdmin";

interface Props {
  usuario: Usuario;
  areas: OpcionCatalogo[];
  cargos: OpcionCatalogo[];
  roles: OpcionCatalogo[];
  onClose: () => void;
  onSave: (usuario: Usuario) => Promise<unknown> | unknown;
  onServerError?: (error: ApiHttpError) => void;
}

interface Formulario {
  correo: string;
  areaId: string;
  cargoId: string;
  rolIds: string[];
  estado: EstadoUsuario;
}

const DOMINIO = "iestpsuiza.edu.pe";

export default function UserEditModal({ usuario, areas, cargos, roles, onClose, onSave, onServerError }: Props) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Formulario>({
    defaultValues: {
      correo: usuario.correo,
      areaId: usuario.areaId ?? "",
      cargoId: usuario.cargoId ?? "",
      rolIds: usuario.rolIds,
      estado: usuario.estado,
    },
  });

  async function enviar(valores: Formulario) {
    const nombre = (opciones: OpcionCatalogo[], id: string) => opciones.find((item) => item.id === id)?.nombre ?? "—";
    try {
      await onSave({
        ...usuario,
        correo: valores.correo.trim().toLowerCase(),
        areaId: valores.areaId,
        area: nombre(areas, valores.areaId),
        cargoId: valores.cargoId,
        cargo: nombre(cargos, valores.cargoId),
        rolId: valores.rolIds[0] ?? null,
        rol: valores.rolIds.map((id) => nombre(roles, id)).join(", "),
        rolIds: valores.rolIds,
        roles: roles.filter((rol) => valores.rolIds.includes(rol.id)),
        estado: valores.estado,
      });
    } catch (error) {
      const invalidos = extraerInvalidParams(error);
      if (invalidos.length) {
        invalidos.forEach(({ name, reason }) => setError(name as keyof Formulario, { type: "server", message: reason }));
      } else onServerError?.(error as ApiHttpError);
    }
  }

  const selector = (name: "areaId" | "cargoId", label: string, opciones: OpcionCatalogo[]) => (
    <div>
      <label htmlFor={`usuario-${name}`} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <select id={`usuario-${name}`} {...register(name, { required: `${label} es obligatorio.` })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
        <option value="">Seleccione</option>
        {opciones.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
      </select>
      {errors[name] && <p className="mt-1 text-xs text-red-700">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog" aria-modal="true" aria-label={`Administrar cuenta de ${usuario.nombre}`}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div><h2 className="text-xl font-bold">Administrar usuario</h2><p className="text-sm text-slate-500">{usuario.nombre}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">Cerrar</button>
        </div>
        <form onSubmit={handleSubmit(enviar)} className="grid gap-4 md:grid-cols-2">
          {selector("areaId", "Área", areas)}
          {selector("cargoId", "Cargo", cargos)}
          <fieldset className="rounded-lg border border-slate-200 p-3 md:col-span-2">
            <legend className="px-1 text-sm font-semibold">Roles activos</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((rol) => (
                <label key={rol.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={rol.id} {...register("rolIds", {
                    validate: (seleccionados) => seleccionados.length > 0 || "Seleccione al menos un rol.",
                  })} />
                  {rol.nombre}
                </label>
              ))}
            </div>
            {errors.rolIds && <p className="mt-1 text-xs text-red-700">{errors.rolIds.message}</p>}
          </fieldset>
          <div>
            <label htmlFor="usuario-estado" className="mb-1.5 block text-sm font-semibold">Estado</label>
            <select id="usuario-estado" {...register("estado", { required: true })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
              <option value="Activo">Activo</option><option value="Inactivo">Inactivo</option><option value="Bloqueado">Bloqueado</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="usuario-correo" className="mb-1.5 block text-sm font-semibold">Correo institucional</label>
            <input id="usuario-correo" aria-invalid={errors.correo ? "true" : "false"} {...register("correo", {
              required: "El correo es obligatorio.",
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Formato de correo inválido." },
              validate: (valor) => valor.toLowerCase().endsWith(`@${DOMINIO}`) || `El correo debe pertenecer al dominio @${DOMINIO}.`,
            })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
            {errors.correo && <p className="mt-1 text-xs text-red-700">{errors.correo.message}</p>}
          </div>
          <div className="mt-2 flex justify-end gap-3 md:col-span-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancelar</button>
            <button type="submit" disabled={isSubmitting}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
