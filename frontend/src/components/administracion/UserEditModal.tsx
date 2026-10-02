// Modal de administración de cuentas de usuario (ENT-M05-02 / T-FE-ADM-02)
// Problema que resuelve: modificar datos de un usuario exigía reiniciar el
// formulario completo o recargar la página entera. Ahora el alta y la edición
// se gestionan con React Hook Form, con validación de credenciales y roles,
// y los errores RFC 7807 del backend se mapean al campo infractor.
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { extraerInvalidParams } from "../../services/adminUsuariosService";
import type { ApiHttpError } from "../../types/api";
import type { EstadoUsuario, Usuario } from "../../types/usuarioAdmin";

interface UserEditModalProps {
  usuario: Usuario;
  areas: string[];
  sedes: string[];
  roles: string[];
  onClose: () => void;
  onSave: (usuario: Usuario) => Promise<unknown> | unknown;
  onServerError?: (error: ApiHttpError) => void;
}

interface UsuarioAdminForm {
  nombre: string;
  dni: string;
  correo: string;
  sede: string;
  area: string;
  cargo: string;
  rol: string;
  estado: EstadoUsuario;
}

// El correo corporativo del IESTP "Suiza" es el único dominio admitido.
const CORREO_INSTITUCIONAL_DOMINIO = "iestpsuiza.edu.pe";
const MENSAJE_DOMINIO = `El correo debe pertenecer al dominio @${CORREO_INSTITUCIONAL_DOMINIO}.`;

const ESTADOS: EstadoUsuario[] = ["Activo", "Inactivo", "Bloqueado"];

// Reglas de validación declarativas de React Hook Form. Se replican aquí en
// lugar de usar un schema externo para mantener el modal autosuficiente.
export default function UserEditModal({
  usuario,
  areas,
  sedes,
  roles,
  onClose,
  onSave,
  onServerError,
}: UserEditModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioAdminForm>({
    defaultValues: {
      nombre: usuario.nombre,
      dni: usuario.dni,
      correo: usuario.correo,
      sede: usuario.sede,
      area: usuario.area,
      cargo: usuario.cargo,
      rol: usuario.rol,
      estado: usuario.estado,
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    reset({
      nombre: usuario.nombre,
      dni: usuario.dni,
      correo: usuario.correo,
      sede: usuario.sede,
      area: usuario.area,
      cargo: usuario.cargo,
      rol: usuario.rol,
      estado: usuario.estado,
    });
  }, [usuario, reset]);

  async function enviar(values: UsuarioAdminForm) {
    try {
      await onSave({ ...usuario, ...values, correo: values.correo.trim().toLowerCase() });
    } catch (error) {
      // Los `invalidParams` de RFC 7807 se iluminan en el campo infractor.
      const invalidParams = extraerInvalidParams(error);
      if (invalidParams.length > 0) {
        invalidParams.forEach(({ name, reason }) => {
          setError(name as keyof UsuarioAdminForm, {
            type: "server",
            message: reason,
          });
        });
        return;
      }

      // Sin `invalidParams` no hay campo concreto: se informa el mensaje
      // general del servidor junto con su código de correlación.
      onServerError?.(error as ApiHttpError);
    }
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

        <form className="grid gap-4" onSubmit={handleSubmit(enviar)} noValidate>
          <div>
            <label htmlFor="usuario-nombre" className="mb-1.5 block text-sm font-semibold">
              Nombre completo
            </label>
            <input
              id="usuario-nombre"
              aria-invalid={errors.nombre ? "true" : "false"}
              aria-describedby={errors.nombre ? "error-usuario-nombre" : undefined}
              {...register("nombre", {
                required: "El nombre completo es obligatorio.",
                minLength: {
                  value: 3,
                  message: "El nombre completo debe tener al menos 3 caracteres.",
                },
              })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
            {errors.nombre && (
              <p id="error-usuario-nombre" className="mt-1 text-xs text-red-700">
                {errors.nombre.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="usuario-dni" className="mb-1.5 block text-sm font-semibold">
              DNI
            </label>
            <input
              id="usuario-dni"
              aria-invalid={errors.dni ? "true" : "false"}
              aria-describedby={errors.dni ? "error-usuario-dni" : undefined}
              {...register("dni", {
                required: "El DNI es obligatorio.",
                pattern: {
                  value: /^\d{8}$/,
                  message: "El DNI debe contener exactamente 8 dígitos.",
                },
              })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
            {errors.dni && (
              <p id="error-usuario-dni" className="mt-1 text-xs text-red-700">
                {errors.dni.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="usuario-area" className="mb-1.5 block text-sm font-semibold">
              Área
            </label>
            <select
              id="usuario-area"
              aria-invalid={errors.area ? "true" : "false"}
              aria-describedby={errors.area ? "error-usuario-area" : undefined}
              {...register("area", { required: "Debe seleccionar un área orgánica." })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            {errors.area && (
              <p id="error-usuario-area" className="mt-1 text-xs text-red-700">
                {errors.area.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="usuario-sede" className="mb-1.5 block text-sm font-semibold">
              Sede (plaza)
            </label>
            <select
              id="usuario-sede"
              aria-invalid={errors.sede ? "true" : "false"}
              aria-describedby={errors.sede ? "error-usuario-sede" : undefined}
              {...register("sede", { required: "Debe seleccionar una sede." })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              {sedes.map((sede) => (
                <option key={sede} value={sede}>
                  {sede}
                </option>
              ))}
            </select>
            {errors.sede && (
              <p id="error-usuario-sede" className="mt-1 text-xs text-red-700">
                {errors.sede.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="usuario-cargo" className="mb-1.5 block text-sm font-semibold">
              Cargo
            </label>
            <input
              id="usuario-cargo"
              aria-invalid={errors.cargo ? "true" : "false"}
              aria-describedby={errors.cargo ? "error-usuario-cargo" : undefined}
              {...register("cargo", {
                required: "El cargo es obligatorio.",
                minLength: {
                  value: 3,
                  message: "El cargo debe tener al menos 3 caracteres.",
                },
              })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
            {errors.cargo && (
              <p id="error-usuario-cargo" className="mt-1 text-xs text-red-700">
                {errors.cargo.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="usuario-rol" className="mb-1.5 block text-sm font-semibold">
              Rol
            </label>
            <select
              id="usuario-rol"
              aria-invalid={errors.rol ? "true" : "false"}
              aria-describedby={errors.rol ? "error-usuario-rol" : undefined}
              {...register("rol", { required: "Debe asignar un rol institucional." })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              {roles.map((rol) => (
                <option key={rol} value={rol}>
                  {rol}
                </option>
              ))}
            </select>
            {errors.rol && (
              <p id="error-usuario-rol" className="mt-1 text-xs text-red-700">
                {errors.rol.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="usuario-correo"
              className="mb-1.5 block text-sm font-semibold"
            >
              Correo institucional
            </label>
            <input
              id="usuario-correo"
              aria-invalid={errors.correo ? "true" : "false"}
              aria-describedby={errors.correo ? "error-usuario-correo" : undefined}
              {...register("correo", {
                required: "El correo institucional es obligatorio.",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "El correo institucional no tiene un formato válido.",
                },
                validate: (valor) =>
                  valor.trim().toLowerCase().endsWith(`@${CORREO_INSTITUCIONAL_DOMINIO}`) ||
                  MENSAJE_DOMINIO,
              })}
              placeholder={`@${CORREO_INSTITUCIONAL_DOMINIO}`}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
            {errors.correo && (
              <p id="error-usuario-correo" className="mt-1 text-xs text-red-700">
                {errors.correo.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="usuario-estado" className="mb-1.5 block text-sm font-semibold">
              Estado
            </label>
            <select
              id="usuario-estado"
              aria-invalid={errors.estado ? "true" : "false"}
              aria-describedby={errors.estado ? "error-usuario-estado" : undefined}
              {...register("estado", {
                required: "Debe indicar el estado operativo del usuario.",
                validate: (valor) =>
                  (ESTADOS as string[]).includes(valor) ||
                  "El estado debe ser Activo, Inactivo o Bloqueado.",
              })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              {ESTADOS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {errors.estado && (
              <p id="error-usuario-estado" className="mt-1 text-xs text-red-700">
                {errors.estado.message}
              </p>
            )}
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
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
