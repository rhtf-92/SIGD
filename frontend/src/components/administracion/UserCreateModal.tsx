import { useForm } from "react-hook-form";
import type { ReactNode } from "react";

import type { CrearUsuarioDTO, OpcionCatalogo } from "../../types/usuarioAdmin";

interface Props {
  areas: OpcionCatalogo[];
  cargos: OpcionCatalogo[];
  roles: OpcionCatalogo[];
  onClose: () => void;
  onSave: (datos: CrearUsuarioDTO) => Promise<unknown>;
}

export default function UserCreateModal({ areas, cargos, roles, onClose, onSave }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CrearUsuarioDTO>({
    defaultValues: { tipo: "NATURAL", rolIds: [] },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Registrar usuario">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div><h2 className="text-xl font-bold">Registrar usuario</h2><p className="text-sm text-slate-500">Alta institucional persistente</p></div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">Cerrar</button>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="grid gap-4 md:grid-cols-2 [&_.campo]:mt-1.5 [&_.campo]:w-full [&_.campo]:rounded-lg [&_.campo]:border [&_.campo]:border-slate-300 [&_.campo]:px-3 [&_.campo]:py-2.5 [&_.campo]:font-normal">
          <Campo label="Documento" error={errors.numeroDocumento?.message}><input {...register("numeroDocumento", { required: "El documento es obligatorio.", minLength: { value: 8, message: "Mínimo 8 caracteres." } })} className="campo" /></Campo>
          <Campo label="Usuario" error={errors.username?.message}><input {...register("username", { required: "El usuario es obligatorio.", minLength: { value: 4, message: "Mínimo 4 caracteres." } })} className="campo" /></Campo>
          <Campo label="Nombres" error={errors.nombres?.message}><input {...register("nombres", { required: "Los nombres son obligatorios." })} className="campo" /></Campo>
          <Campo label="Apellidos" error={errors.apellidos?.message}><input {...register("apellidos", { required: "Los apellidos son obligatorios." })} className="campo" /></Campo>
          <Campo label="Correo institucional" error={errors.correo?.message}><input type="email" {...register("correo", { required: "El correo es obligatorio.", validate: (v) => v.toLowerCase().endsWith("@iestpsuiza.edu.pe") || "Use el dominio @iestpsuiza.edu.pe." })} className="campo" /></Campo>
          <Campo label="Teléfono" error={errors.telefono?.message}><input {...register("telefono")} className="campo" /></Campo>
          <Campo label="Contraseña inicial" error={errors.passwordInicial?.message}><input type="password" {...register("passwordInicial", { required: "La contraseña es obligatoria.", minLength: { value: 8, message: "Mínimo 8 caracteres." } })} className="campo" /></Campo>
          <Campo label="Área" error={errors.areaId?.message}><select {...register("areaId", { required: "Seleccione un área." })} className="campo"><option value="">Seleccione</option>{areas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></Campo>
          <Campo label="Cargo" error={errors.cargoId?.message}><select {...register("cargoId", { required: "Seleccione un cargo." })} className="campo"><option value="">Seleccione</option>{cargos.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></Campo>
          <fieldset className="rounded-lg border border-slate-200 p-3 md:col-span-2">
            <legend className="px-1 text-sm font-semibold">Roles iniciales</legend>
            <div className="grid gap-2 sm:grid-cols-2">{roles.map((rol) => <label key={rol.id} className="flex items-center gap-2 text-sm"><input type="checkbox" value={rol.id} {...register("rolIds", { validate: (v) => v.length > 0 || "Seleccione al menos un rol." })} />{rol.nombre}</label>)}</div>
            {errors.rolIds && <p className="mt-1 text-xs text-red-700">{errors.rolIds.message}</p>}
          </fieldset>
          <div className="flex justify-end gap-3 md:col-span-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Guardando..." : "Registrar usuario"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="text-sm font-semibold">{label}{children}{error && <span className="mt-1 block text-xs text-red-700">{error}</span>}</label>;
}
