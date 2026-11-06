// Modal de registro de nuevos usuarios institucionales (ENT-M05-02)
import { useForm } from "react-hook-form";

import { extraerInvalidParams } from "../../services/adminUsuariosService";
import type { ApiHttpError } from "../../types/api";
import type { CreateUsuarioDTO, EstadoUsuario } from "../../types/usuarioAdmin";

interface UserCreateModalProps {
  areas: string[];
  sedes: string[];
  roles: string[];
  onClose: () => void;
  onSave: (datos: CreateUsuarioDTO) => Promise<unknown> | unknown;
  onServerError?: (error: ApiHttpError) => void;
}

interface UsuarioCreateForm {
  nombre: string;
  dni: string;
  correo: string;
  usuario: string;
  passwordInicial: string;
  sede: string;
  area: string;
  cargo: string;
  rol: string;
  estado: EstadoUsuario;
}

const CORREO_INSTITUCIONAL_DOMINIO = "iestpsuiza.edu.pe";
const MENSAJE_DOMINIO = `El correo debe pertenecer al dominio @${CORREO_INSTITUCIONAL_DOMINIO}.`;
const ESTADOS: EstadoUsuario[] = ["Activo", "Inactivo", "Bloqueado"];

export default function UserCreateModal({
  areas,
  sedes,
  roles,
  onClose,
  onSave,
  onServerError,
}: UserCreateModalProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioCreateForm>({
    defaultValues: {
      nombre: "",
      dni: "",
      correo: "",
      usuario: "",
      passwordInicial: "Suiza2026*",
      sede: sedes[0] || "Sede Principal",
      area: areas[0] || "Administración",
      cargo: "Asistente Administrativo",
      rol: roles[0] || "Operador",
      estado: "Activo",
    },
    mode: "onSubmit",
  });

  async function enviar(values: UsuarioCreateForm) {
    const correoNormalizado = values.correo.trim().toLowerCase();
    const usernameNormalizado =
      values.usuario.trim() ||
      correoNormalizado.split("@")[0] ||
      `user_${values.dni.trim()}`;

    const payload: CreateUsuarioDTO = {
      nombre: values.nombre.trim(),
      dni: values.dni.trim(),
      correo: correoNormalizado,
      usuario: usernameNormalizado,
      clave: values.passwordInicial.trim() || "Suiza2026*",
      area: values.area,
      sede: values.sede,
      cargo: values.cargo.trim(),
      rol: values.rol,
      estado: values.estado,
    };

    try {
      await onSave(payload);
    } catch (error) {
      const invalidParams = extraerInvalidParams(error);
      if (invalidParams.length > 0) {
        invalidParams.forEach(({ name, reason }) => {
          setError(name as keyof UsuarioCreateForm, {
            type: "server",
            message: reason,
          });
        });
        return;
      }
      onServerError?.(error as ApiHttpError);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar nuevo usuario institucional"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Registrar Usuario Institucional</h3>
            <p className="mt-1 text-sm text-slate-500">
              Crea una nueva cuenta de acceso oficial al SIGD
            </p>
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
            <label htmlFor="nuevo-nombre" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Nombre completo
            </label>
            <input
              id="nuevo-nombre"
              aria-invalid={errors.nombre ? "true" : "false"}
              aria-describedby={errors.nombre ? "error-nuevo-nombre" : undefined}
              {...register("nombre", {
                required: "El nombre completo es obligatorio.",
                minLength: {
                  value: 3,
                  message: "El nombre completo debe tener al menos 3 caracteres.",
                },
              })}
              placeholder="Ej. Juan Carlos Pérez Morales"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
            {errors.nombre && (
              <p id="error-nuevo-nombre" className="mt-1 text-xs text-red-700">
                {errors.nombre.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="nuevo-dni" className="mb-1.5 block text-sm font-semibold text-slate-800">
                DNI (8 dígitos)
              </label>
              <input
                id="nuevo-dni"
                maxLength={8}
                aria-invalid={errors.dni ? "true" : "false"}
                aria-describedby={errors.dni ? "error-nuevo-dni" : undefined}
                {...register("dni", {
                  required: "El DNI es obligatorio.",
                  pattern: {
                    value: /^\d{8}$/,
                    message: "El DNI debe contener exactamente 8 dígitos.",
                  },
                })}
                placeholder="00000000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
              {errors.dni && (
                <p id="error-nuevo-dni" className="mt-1 text-xs text-red-700">
                  {errors.dni.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="nuevo-usuario" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Usuario / Username
              </label>
              <input
                id="nuevo-usuario"
                aria-invalid={errors.usuario ? "true" : "false"}
                aria-describedby={errors.usuario ? "error-nuevo-usuario" : undefined}
                {...register("usuario", {
                  minLength: {
                    value: 4,
                    message: "El usuario debe tener al menos 4 caracteres.",
                  },
                })}
                placeholder="jperez (opcional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
              {errors.usuario && (
                <p id="error-nuevo-usuario" className="mt-1 text-xs text-red-700">
                  {errors.usuario.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="nuevo-correo" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Correo institucional (@{CORREO_INSTITUCIONAL_DOMINIO})
            </label>
            <input
              id="nuevo-correo"
              type="email"
              aria-invalid={errors.correo ? "true" : "false"}
              aria-describedby={errors.correo ? "error-nuevo-correo" : undefined}
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
              placeholder={`nombre.apellido@${CORREO_INSTITUCIONAL_DOMINIO}`}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
            {errors.correo && (
              <p id="error-nuevo-correo" className="mt-1 text-xs text-red-700">
                {errors.correo.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="nuevo-password" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Contraseña inicial
            </label>
            <input
              id="nuevo-password"
              type="text"
              aria-invalid={errors.passwordInicial ? "true" : "false"}
              aria-describedby={errors.passwordInicial ? "error-nuevo-password" : undefined}
              {...register("passwordInicial", {
                minLength: {
                  value: 8,
                  message: "La contraseña debe tener al menos 8 caracteres.",
                },
              })}
              placeholder="Suiza2026*"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
            {errors.passwordInicial && (
              <p id="error-nuevo-password" className="mt-1 text-xs text-red-700">
                {errors.passwordInicial.message}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">Mínimo 8 caracteres (por defecto: Suiza2026*)</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="nuevo-area" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Área orgánica
              </label>
              <select
                id="nuevo-area"
                aria-invalid={errors.area ? "true" : "false"}
                {...register("area", { required: "Debe seleccionar un área." })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="nuevo-sede" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Sede institucional
              </label>
              <select
                id="nuevo-sede"
                aria-invalid={errors.sede ? "true" : "false"}
                {...register("sede", { required: "Debe seleccionar una sede." })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                {sedes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="nuevo-cargo" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Cargo
              </label>
              <input
                id="nuevo-cargo"
                aria-invalid={errors.cargo ? "true" : "false"}
                aria-describedby={errors.cargo ? "error-nuevo-cargo" : undefined}
                {...register("cargo", {
                  required: "El cargo es obligatorio.",
                  minLength: {
                    value: 3,
                    message: "El cargo debe tener al menos 3 caracteres.",
                  },
                })}
                placeholder="Ej. Especialista en Trámite"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
              {errors.cargo && (
                <p id="error-nuevo-cargo" className="mt-1 text-xs text-red-700">
                  {errors.cargo.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="nuevo-rol" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Rol
              </label>
              <select
                id="nuevo-rol"
                aria-invalid={errors.rol ? "true" : "false"}
                {...register("rol", { required: "Debe asignar un rol." })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="nuevo-estado" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Estado operativo inicial
            </label>
            <select
              id="nuevo-estado"
              {...register("estado", { required: true })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              {ESTADOS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              {isSubmitting ? "Registrando..." : "Registrar Usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
