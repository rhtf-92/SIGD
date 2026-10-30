// Modal de administración de cuentas de usuario (ENT-M05-02 / T-FE-ADM-02)
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { UserCheck, X, AlertCircle } from "lucide-react";

import { extraerInvalidParams } from "../../services/adminUsuariosService";
import type { ApiHttpError } from "../../types/api";
import type { EstadoUsuario, Usuario } from "../../types/usuarioAdmin";
import { PrimaryButton, SecondaryButton } from "./common/Buttons";

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

const CORREO_INSTITUCIONAL_DOMINIO = "iestpsuiza.edu.pe";
const MENSAJE_DOMINIO = `El correo debe pertenecer al dominio @${CORREO_INSTITUCIONAL_DOMINIO}.`;
const ESTADOS: EstadoUsuario[] = ["Activo", "Inactivo", "Bloqueado"];

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
      onServerError?.(error as ApiHttpError);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`Administrar cuenta de ${usuario.nombre}`}
    >
      <div className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Administrar Cuenta Institucional
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-semibold text-cyan-300">
                  {usuario.nombre}
                </span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-[11px] text-slate-400">
                  DNI: {usuario.dni}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-800/60 p-2 text-slate-400 hover:text-white hover:border-slate-700 transition"
            aria-label="Cerrar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit(enviar)} noValidate>
          {/* Nombre Completo */}
          <div>
            <label
              htmlFor="usuario-nombre"
              className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400"
            >
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
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
            />
            {errors.nombre && (
              <p
                id="error-usuario-nombre"
                className="mt-1.5 flex items-center gap-1 text-xs text-rose-400 font-medium"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.nombre.message}</span>
              </p>
            )}
          </div>

          {/* DNI y Sede en 2 columnas */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="usuario-dni"
                className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400"
              >
                DNI (8 dígitos)
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
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 font-mono text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
              />
              {errors.dni && (
                <p
                  id="error-usuario-dni"
                  className="mt-1.5 flex items-center gap-1 text-xs text-rose-400 font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errors.dni.message}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="usuario-sede"
                className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400"
              >
                Sede institucional
              </label>
              <select
                id="usuario-sede"
                aria-invalid={errors.sede ? "true" : "false"}
                aria-describedby={errors.sede ? "error-usuario-sede" : undefined}
                {...register("sede", { required: "Debe seleccionar una sede." })}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
              >
                {sedes.map((sede) => (
                  <option key={sede} value={sede} className="bg-slate-900 text-white">
                    {sede}
                  </option>
                ))}
              </select>
              {errors.sede && (
                <p
                  id="error-usuario-sede"
                  className="mt-1.5 flex items-center gap-1 text-xs text-rose-400 font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errors.sede.message}</span>
                </p>
              )}
            </div>
          </div>

          {/* Área y Cargo en 2 columnas */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="usuario-area"
                className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400"
              >
                Unidad Orgánica (Área)
              </label>
              <select
                id="usuario-area"
                aria-invalid={errors.area ? "true" : "false"}
                aria-describedby={errors.area ? "error-usuario-area" : undefined}
                {...register("area", { required: "Debe seleccionar un área orgánica." })}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
              >
                {areas.map((area) => (
                  <option key={area} value={area} className="bg-slate-900 text-white">
                    {area}
                  </option>
                ))}
              </select>
              {errors.area && (
                <p
                  id="error-usuario-area"
                  className="mt-1.5 flex items-center gap-1 text-xs text-rose-400 font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errors.area.message}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="usuario-cargo"
                className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400"
              >
                Cargo institucional
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
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
              />
              {errors.cargo && (
                <p
                  id="error-usuario-cargo"
                  className="mt-1.5 flex items-center gap-1 text-xs text-rose-400 font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errors.cargo.message}</span>
                </p>
              )}
            </div>
          </div>

          {/* Rol y Estado en 2 columnas */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="usuario-rol"
                className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400"
              >
                Rol asignado
              </label>
              <select
                id="usuario-rol"
                aria-invalid={errors.rol ? "true" : "false"}
                aria-describedby={errors.rol ? "error-usuario-rol" : undefined}
                {...register("rol", { required: "Debe asignar un rol institucional." })}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
              >
                {roles.map((rol) => (
                  <option key={rol} value={rol} className="bg-slate-900 text-white">
                    {rol}
                  </option>
                ))}
              </select>
              {errors.rol && (
                <p
                  id="error-usuario-rol"
                  className="mt-1.5 flex items-center gap-1 text-xs text-rose-400 font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errors.rol.message}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="usuario-estado"
                className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400"
              >
                Estado operativo
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
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
              >
                {ESTADOS.map((item) => (
                  <option key={item} value={item} className="bg-slate-900 text-white">
                    {item}
                  </option>
                ))}
              </select>
              {errors.estado && (
                <p
                  id="error-usuario-estado"
                  className="mt-1.5 flex items-center gap-1 text-xs text-rose-400 font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errors.estado.message}</span>
                </p>
              )}
            </div>
          </div>

          {/* Correo Corporativo */}
          <div>
            <label
              htmlFor="usuario-correo"
              className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400"
            >
              Correo institucional (@{CORREO_INSTITUCIONAL_DOMINIO})
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
              placeholder={`usuario@${CORREO_INSTITUCIONAL_DOMINIO}`}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
            />
            {errors.correo && (
              <p
                id="error-usuario-correo"
                className="mt-1.5 flex items-center gap-1 text-xs text-rose-400 font-medium"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.correo.message}</span>
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
            <SecondaryButton type="button" onClick={onClose}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" isLoading={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
