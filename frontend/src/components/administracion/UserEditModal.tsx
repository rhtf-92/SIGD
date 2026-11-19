import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { extraerInvalidParams } from "../../services/adminUsuariosService";
import { ApiHttpError } from "../../types/api";
import type { Usuario, OpcionDirectorio, UpdateUsuarioDTO } from "../../types/usuarioAdmin";

interface UserEditModalProps {
  usuario: Usuario;
  areas: OpcionDirectorio[];
  cargos: OpcionDirectorio[];
  roles: OpcionDirectorio[];
  onClose: () => void;
  onSave: (cambios: UpdateUsuarioDTO) => Promise<unknown> | unknown;
  onResetPassword?: (passwordInicial: string) => Promise<unknown>;
  onAsignarRol?: (rolId: string) => Promise<unknown>;
  onRevocarRol?: (usuarioRolId: string) => Promise<unknown>;
  onServerError?: (error: ApiHttpError) => void;
}

interface UsuarioAdminForm {
  nombres: string;
  apellidos: string;
  correo: string;
  estado: "Activo" | "Inactivo";
  asignacionId: string;
  areaId: string;
  cargoId: string;
}

const clase = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100";
const ROLES_EXTERNOS = ["CIUDADANO", "ESTUDIANTE"];

export default function UserEditModal({
  usuario,
  areas,
  cargos,
  roles,
  onClose,
  onSave,
  onResetPassword,
  onAsignarRol,
  onRevocarRol,
  onServerError,
}: UserEditModalProps) {
  const [passwordTemporal, setPasswordTemporal] = useState("");
  const [mensajeCredenciales, setMensajeCredenciales] = useState("");
  const [errorCredenciales, setErrorCredenciales] = useState("");
  const [restableciendo, setRestableciendo] = useState(false);

  // Estado para asignación de nuevo rol
  const [nuevoRolId, setNuevoRolId] = useState("");
  const [asignandoRol, setAsignandoRol] = useState(false);
  const [revocandoRolId, setRevocandoRolId] = useState<string | null>(null);
  const [mensajeRol, setMensajeRol] = useState("");
  const [errorRol, setErrorRol] = useState("");

  function valores(): UsuarioAdminForm {
    const a = usuario.asignaciones.length === 1 ? usuario.asignaciones[0] : undefined;
    return {
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      estado: usuario.estado === "Activo" ? "Activo" : "Inactivo",
      asignacionId: a?.id ?? "",
      areaId: a?.areaId ?? "",
      cargoId: a?.cargoId ?? "",
    };
  }

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioAdminForm>({ defaultValues: valores(), mode: "onSubmit" });

  useEffect(() => {
    reset(valores());
  }, [usuario, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const asignacionId = watch("asignacionId");
  const asignacion = usuario.asignaciones.find(a => a.id === asignacionId);
  const variasAsignaciones = usuario.asignaciones.length > 1 && !asignacionId;

  // Filtrar roles disponibles para asignar (internos y que no estén ya activos)
  const rolesActivosIds = useMemo(
    () => new Set(usuario.roles.filter(r => r.activo !== false).map(r => r.rolId)),
    [usuario.roles],
  );

  const rolesDisponiblesParaAsignar = useMemo(() => {
    return roles.filter(r => {
      const cod = (r.codigo || "").toUpperCase();
      const nom = (r.nombre || "").toUpperCase();
      const esExterno = ROLES_EXTERNOS.includes(cod) || nom.includes("CIUDADANO") || nom.includes("ESTUDIANTE");
      const yaAsignado = rolesActivosIds.has(r.id);
      return !esExterno && !yaAsignado;
    });
  }, [roles, rolesActivosIds]);

  const rolesVigentes = useMemo(
    () => usuario.roles.filter(r => r.activo !== false),
    [usuario.roles],
  );

  async function enviar(v: UsuarioAdminForm) {
    const cambios: UpdateUsuarioDTO = {};
    if (v.nombres !== usuario.nombres) cambios.nombres = v.nombres.trim();
    if (v.apellidos !== usuario.apellidos) cambios.apellidos = v.apellidos.trim();
    if (v.correo !== usuario.correo) cambios.correo = v.correo.trim().toLowerCase();

    // Validación de habilitación de cuenta: debe tener al menos un rol asignado
    if (v.estado === "Activo" && rolesVigentes.length === 0) {
      setError("estado", {
        type: "validate",
        message: "No se puede activar una cuenta sin roles asignados. Asigne al menos un rol antes de habilitar la cuenta.",
      });
      return;
    }

    if (v.estado !== usuario.estado) cambios.estado = v.estado === "Activo" ? "ACTIVO" : "INACTIVO";

    if (
      !variasAsignaciones &&
      (v.cargoId !== (asignacion?.cargoId ?? "") || v.areaId !== (asignacion?.areaId ?? ""))
    ) {
      if (!v.cargoId || !v.areaId) {
        setError("cargoId", { message: "Seleccione cargo y área existentes." });
        return;
      }
      cambios.cargoId = v.cargoId;
      cambios.areaId = v.areaId;
      if (asignacionId) cambios.asignacionId = asignacionId;
    }

    if (!Object.keys(cambios).length) {
      setError("root", { message: "No hay cambios para guardar." });
      return;
    }

    try {
      await onSave(cambios);
    } catch (error) {
      const invalidos = extraerInvalidParams(error);
      const campos = ["nombres", "apellidos", "correo", "estado", "asignacionId", "areaId", "cargoId"];
      for (const { name, reason } of invalidos) {
        setError(campos.includes(name) ? (name as keyof UsuarioAdminForm) : "root", {
          type: "server",
          message: reason,
        });
      }
      if (!invalidos.length) {
        setError("root", {
          message: error instanceof ApiHttpError ? error.message : "No se pudo guardar la modificación.",
        });
      }
      if (error instanceof ApiHttpError) onServerError?.(error);
    }
  }

  async function ejecutarAsignarRol() {
    if (!onAsignarRol || !nuevoRolId) return;
    setAsignandoRol(true);
    setMensajeRol("");
    setErrorRol("");
    try {
      await onAsignarRol(nuevoRolId);
      setNuevoRolId("");
      setMensajeRol("Rol institucional asignado correctamente.");
    } catch (err) {
      setErrorRol(err instanceof Error ? err.message : "No fue posible asignar el rol.");
    } finally {
      setAsignandoRol(false);
    }
  }

  async function ejecutarRevocarRol(usuarioRolId: string) {
    if (!onRevocarRol) return;
    setRevocandoRolId(usuarioRolId);
    setMensajeRol("");
    setErrorRol("");
    try {
      await onRevocarRol(usuarioRolId);
      setMensajeRol("Asignación de rol revocada correctamente.");
    } catch (err) {
      setErrorRol(err instanceof Error ? err.message : "No fue posible revocar el rol.");
    } finally {
      setRevocandoRolId(null);
    }
  }

  async function restablecer() {
    if (!onResetPassword || passwordTemporal.length < 12) return;
    setRestableciendo(true);
    setMensajeCredenciales("");
    setErrorCredenciales("");
    try {
      await onResetPassword(passwordTemporal);
      setPasswordTemporal("");
      setMensajeCredenciales("La contraseña se actualizó y se revocaron las sesiones activas.");
    } catch (error) {
      setErrorCredenciales(error instanceof Error ? error.message : "No fue posible restablecer las credenciales.");
    } finally {
      setRestableciendo(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={"Administrar cuenta de " + usuario.nombre}
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        {/* Encabezado */}
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-blue-700 border border-blue-200/50">
              Administración de cuenta
            </span>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{usuario.nombre}</h3>
            <p className="mt-0.5 text-xs text-slate-500 font-mono">
              DNI: {usuario.dni} · Usuario: @{usuario.username || "—"} · Estado actual: {usuario.estado}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <span className="text-xl font-bold leading-none">&times;</span>
          </button>
        </div>

        {/* Alerta si está pendiente de asignación de roles */}
        {rolesVigentes.length === 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed">
            <p className="font-bold text-amber-950">Cuenta pendiente de asignación de roles</p>
            <p className="mt-0.5">
              Esta cuenta no tiene roles institucionales vigentes y no puede autenticarse ni activarse.
              Utilice la sección siguiente para asignarle al menos un rol institucional.
            </p>
          </div>
        )}

        {/* =========================================================
            SECCIÓN ROLES ASIGNADOS AL USUARIO
            ========================================================= */}
        <section className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/30 p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-blue-950 flex items-center gap-2">
                <svg className="h-4 w-4 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                ROLES ASIGNADOS AL USUARIO
              </h4>
              <p className="text-2xs text-slate-500 mt-0.5">
                Vincule o revoque roles del sistema. Los permisos proceden del módulo independiente Roles y Permisos.
              </p>
            </div>
            <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200">
              {rolesVigentes.length} {rolesVigentes.length === 1 ? "rol activo" : "roles activos"}
            </span>
          </div>

          {/* Lista de roles asignados */}
          {usuario.roles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center">
              <p className="text-xs font-semibold text-slate-500">
                El trabajador no tiene ningún rol asignado actualmente.
              </p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {usuario.roles.map(r => {
                const esVigente = r.activo !== false;
                const ambitoTexto = (r.ambito || (r.areaId ? "AREA" : "GLOBAL")) === "GLOBAL"
                  ? "Institucional (Global)"
                  : "Por Área Institucional";

                return (
                  <div
                    key={r.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition ${
                      esVigente
                        ? "border-blue-200 bg-white shadow-2xs"
                        : "border-slate-200 bg-slate-50/70 opacity-70"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{r.nombre}</span>
                        {r.codigo && (
                          <span className="font-mono text-2xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {r.codigo}
                          </span>
                        )}
                        <span
                          className={`text-2xs font-bold uppercase px-2 py-0.5 rounded-full border ${
                            esVigente
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-300"
                          }`}
                        >
                          {esVigente ? "Vigente" : "Concluido"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-slate-500">
                        <span>
                          <strong>Ámbito:</strong> {ambitoTexto}
                        </span>
                        {r.vigenteDesde && (
                          <span>
                            <strong>Desde:</strong> {new Date(r.vigenteDesde).toLocaleDateString("es-PE")}
                          </span>
                        )}
                        {r.vigenteHasta && (
                          <span>
                            <strong>Hasta:</strong> {new Date(r.vigenteHasta).toLocaleDateString("es-PE")}
                          </span>
                        )}
                      </div>
                    </div>

                    {esVigente && onRevocarRol && (
                      <button
                        type="button"
                        onClick={() => void ejecutarRevocarRol(r.id)}
                        disabled={revocandoRolId === r.id || isSubmitting}
                        className="self-end sm:self-center shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 transition"
                      >
                        {revocandoRolId === r.id ? "Revocando…" : "Revocar rol"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulario para asignar nuevo rol */}
          {onAsignarRol && (
            <div className="mt-3 rounded-xl border border-blue-200 bg-white p-3.5">
              <label htmlFor="nuevo-rol-select" className="block text-xs font-bold uppercase text-slate-700 mb-1">
                + Asignar rol institucional
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  id="nuevo-rol-select"
                  aria-label="Seleccionar rol para asignar"
                  value={nuevoRolId}
                  onChange={e => setNuevoRolId(e.target.value)}
                  disabled={asignandoRol || isSubmitting}
                  className={`${clase} flex-1`}
                >
                  <option value="">Seleccione un rol institucional disponible</option>
                  {rolesDisponiblesParaAsignar.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} {r.codigo ? `(${r.codigo})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void ejecutarAsignarRol()}
                  disabled={asignandoRol || !nuevoRolId || isSubmitting}
                  className="shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 disabled:opacity-50 transition"
                >
                  {asignandoRol ? "Asignando…" : "Asignar rol"}
                </button>
              </div>
              <p className="mt-1.5 text-2xs text-slate-500">
                Los roles globales (ADMINISTRADOR) operan en todo el SIGD; los roles departamentales resuelven la unidad orgánica asignada al trabajador.
              </p>
            </div>
          )}

          {mensajeRol && <p role="status" className="mt-2 text-xs font-medium text-emerald-700">{mensajeRol}</p>}
          {errorRol && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{errorRol}</p>}
        </section>

        {/* =========================================================
            FORMULARIO DE DATOS INSTITUCIONALES Y ESTADO
            ========================================================= */}
        <form className="grid gap-4" onSubmit={handleSubmit(enviar)} noValidate>
          <div>
            <label htmlFor="usuario-nombre" className="mb-1 block text-xs font-bold uppercase text-slate-700">
              Nombre completo
            </label>
            <input id="usuario-nombre" value={usuario.nombre} readOnly className={`${clase} bg-slate-50 text-slate-600`} />
          </div>

          <div>
            <label htmlFor="usuario-dni" className="mb-1 block text-xs font-bold uppercase text-slate-700">
              Documento de identidad
            </label>
            <input id="usuario-dni" value={usuario.dni} readOnly className={`${clase} bg-slate-50 text-slate-600 font-mono`} />
          </div>

          {usuario.tipoPersona === "NATURAL" &&
            (["nombres", "apellidos"] as const).map(campo => (
              <div key={campo}>
                <label htmlFor={"usuario-" + campo} className="mb-1 block text-xs font-bold uppercase text-slate-700">
                  {campo === "nombres" ? "Nombres" : "Apellidos"}
                </label>
                <input
                  id={"usuario-" + campo}
                  {...register(campo, { required: "El campo es obligatorio.", minLength: 2, maxLength: 120 })}
                  aria-invalid={!!errors[campo]}
                  className={clase}
                />
                {errors[campo] && <p className="mt-1 text-xs text-red-700">{errors[campo]?.message || "Revise este campo."}</p>}
              </div>
            ))}

          {usuario.asignaciones.length > 1 && (
            <div>
              <label htmlFor="usuario-asignacion" className="mb-1 block text-xs font-bold uppercase text-slate-700">
                Asignación a modificar
              </label>
              <select
                id="usuario-asignacion"
                value={asignacionId}
                className={clase}
                onChange={e => {
                  const a = usuario.asignaciones.find(x => x.id === e.target.value);
                  setValue("asignacionId", e.target.value);
                  setValue("areaId", a?.areaId ?? "");
                  setValue("cargoId", a?.cargoId ?? "");
                }}
              >
                <option value="">Conservar todas las asignaciones</option>
                {usuario.asignaciones.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.cargo + " / " + a.area}
                  </option>
                ))}
              </select>
            </div>
          )}

          {([
            { campo: "areaId", label: "Área o unidad orgánica", opciones: areas },
            { campo: "cargoId", label: "Cargo institucional", opciones: cargos },
          ] as const).map(({ campo, label, opciones }) => (
            <div key={campo}>
              <label htmlFor={"usuario-" + campo} className="mb-1 block text-xs font-bold uppercase text-slate-700">
                {label}
              </label>
              <select
                id={"usuario-" + campo}
                aria-label={campo === "cargoId" ? "Cargo" : undefined}
                {...register(campo)}
                disabled={variasAsignaciones}
                className={clase}
                aria-invalid={!!errors[campo]}
              >
                <option value="">Sin asignación</option>
                {asignacion && !opciones.some(o => o.id === asignacion[campo]) && (
                  <option value={asignacion[campo]} disabled>
                    {campo === "areaId" ? asignacion.area : asignacion.cargo} (no vigente)
                  </option>
                )}
                {opciones.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
              {errors[campo] && <p className="mt-1 text-xs text-red-700">{errors[campo]?.message}</p>}
            </div>
          ))}

          <div>
            <label htmlFor="usuario-correo" className="mb-1 block text-xs font-bold uppercase text-slate-700">
              Correo institucional
            </label>
            <input
              id="usuario-correo"
              {...register("correo", {
                required: "El correo es obligatorio.",
                validate: v =>
                  v === usuario.correo ||
                  /^[^\s@]+@(iestpsuiza|iestp-suiza)\.edu\.pe$/i.test(v.trim()) ||
                  "El correo debe pertenecer al dominio @iestpsuiza.edu.pe.",
              })}
              aria-invalid={!!errors.correo}
              className={clase}
            />
            {errors.correo && <p className="mt-1 text-xs text-red-700">{errors.correo.message}</p>}
          </div>

          <div>
            <label htmlFor="usuario-estado" className="mb-1 block text-xs font-bold uppercase text-slate-700">
              Estado de la cuenta
            </label>
            <select id="usuario-estado" {...register("estado")} className={clase} aria-invalid={!!errors.estado}>
              <option value="Activo">Activo (Habilitado para operar)</option>
              <option value="Inactivo">Inactivo (Acceso suspendido)</option>
            </select>
            {errors.estado && <p className="mt-1 text-xs text-red-700 font-medium">{errors.estado.message}</p>}
            <p className="mt-1 text-2xs text-slate-500">
              {rolesVigentes.length === 0
                ? "Atención: La cuenta requiere al menos un rol institucional asignado para poder ser activada."
                : "Determina si el usuario puede autenticarse en el SIGD."}
            </p>
          </div>

          {errors.root && (
            <p role="alert" className="text-sm font-medium text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">
              {errors.root.message}
            </p>
          )}

          <div className="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-bold text-white shadow-xs hover:bg-blue-800 disabled:opacity-60"
            >
              {isSubmitting ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>

        {/* =========================================================
            SECCIÓN RESTABLECER CREDENCIALES
            ========================================================= */}
        {onResetPassword && (
          <section className="mt-6 border-t border-slate-200 pt-5">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Restablecer credenciales
            </h4>
            <p className="mt-1 text-xs text-slate-600">
              Ingrese una contraseña temporal de al menos 12 caracteres. Las sesiones activas se revocarán.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                aria-label="Nueva contraseña temporal"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={passwordTemporal}
                onChange={e => setPasswordTemporal(e.target.value)}
                className={clase}
                placeholder="Mínimo 12 caracteres"
              />
              <button
                type="button"
                onClick={() => void restablecer()}
                disabled={restableciendo || passwordTemporal.length < 12}
                className="shrink-0 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {restableciendo ? "Actualizando…" : "Restablecer contraseña"}
              </button>
            </div>
            {mensajeCredenciales && <p role="status" className="mt-2 text-sm text-emerald-700 font-medium">{mensajeCredenciales}</p>}
            {errorCredenciales && <p role="alert" className="mt-2 text-sm text-red-700 font-medium">{errorCredenciales}</p>}
          </section>
        )}
      </div>
    </div>
  );
}
