import { useState, type FormEvent } from "react";
import { X, UserPlus } from "lucide-react";
import { apiClient } from "../../api/client";
import type { AreaCatalogo, RolCatalogo } from "../../services/adminUsuariosService";

export interface NuevoUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (nombre: string) => void;
  roles?: readonly RolCatalogo[];
  areas?: readonly AreaCatalogo[];
}

export default function NuevoUsuarioModal({
  isOpen,
  onClose,
  onSuccess,
  roles = [],
  areas = [],
}: NuevoUsuarioModalProps) {
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [activo, setActivo] = useState(true);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (numeroDocumento.trim().length !== 8) {
      setError("El DNI debe contener exactamente 8 dígitos numéricos.");
      return;
    }
    if (!nombres.trim() || !apellidos.trim()) {
      setError("Nombres y apellidos son obligatorios.");
      return;
    }
    if (!correo.trim().toLowerCase().endsWith("@iestpsuiza.edu.pe")) {
      setError("El correo institucional debe pertenecer al dominio @iestpsuiza.edu.pe");
      return;
    }
    if (usuario.trim().length < 3) {
      setError("El nombre de usuario debe contener al menos 3 caracteres.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña inicial debe tener al menos 8 caracteres.");
      return;
    }
    if (!rolId) {
      setError("Debe seleccionar un rol institucional.");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      await apiClient.post("/api/v1/admin/usuarios/institucional", {
        tipoDocumento: "DNI",
        numeroDocumento: numeroDocumento.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        correo: correo.trim().toLowerCase(),
        usuario: usuario.trim(),
        password,
        rolId,
        areaId: areaId || null,
        activo,
      });

      onSuccess(`${nombres.trim()} ${apellidos.trim()}`);
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const msg = e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Error al registrar el usuario institucional.";
      setError(msg);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-nuevo-usuario-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 id="modal-nuevo-usuario-titulo" className="text-base font-bold text-slate-900">
                Nuevo Usuario Institucional
              </h2>
              <p className="text-xs text-slate-500">
                Registro de colaborador con cuenta institucional y rol asignado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Persona Natural */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="modal-dni" className="block text-xs font-semibold text-slate-700">
                DNI <span className="text-red-500">*</span>
              </label>
              <input
                id="modal-dni"
                type="text"
                required
                maxLength={8}
                pattern="\d{8}"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value.replace(/\D/g, ""))}
                placeholder="71234567"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
              />
            </div>
            <div>
              <label htmlFor="modal-nombres" className="block text-xs font-semibold text-slate-700">
                Nombres <span className="text-red-500">*</span>
              </label>
              <input
                id="modal-nombres"
                type="text"
                required
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Juan Carlos"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label htmlFor="modal-apellidos" className="block text-xs font-semibold text-slate-700">
                Apellidos <span className="text-red-500">*</span>
              </label>
              <input
                id="modal-apellidos"
                type="text"
                required
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="Pérez García"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Credenciales */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-correo" className="block text-xs font-semibold text-slate-700">
                Correo Institucional (@iestpsuiza.edu.pe) <span className="text-red-500">*</span>
              </label>
              <input
                id="modal-correo"
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="colaborador@iestpsuiza.edu.pe"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label htmlFor="modal-usuario" className="block text-xs font-semibold text-slate-700">
                Nombre de Usuario (Login) <span className="text-red-500">*</span>
              </label>
              <input
                id="modal-usuario"
                type="text"
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="jperez"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="modal-password" className="block text-xs font-semibold text-slate-700">
              Contraseña Temporal (mínimo 8 caracteres) <span className="text-red-500">*</span>
            </label>
            <input
              id="modal-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Se cifrará con Argon2id de 4 hilos en el backend. El usuario deberá cambiarla al primer ingreso.
            </p>
          </div>

          {/* Asignación Institucional */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-rol" className="block text-xs font-semibold text-slate-700">
                Rol Institucional <span className="text-red-500">*</span>
              </label>
              <select
                id="modal-rol"
                required
                value={rolId}
                onChange={(e) => setRolId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
              >
                <option value="">-- Seleccionar Rol --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre || r.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="modal-area" className="block text-xs font-semibold text-slate-700">
                Unidad Orgánica / Área
              </label>
              <select
                id="modal-area"
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
              >
                <option value="">-- Sin unidad asignada --</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.sigla ? `${a.sigla} - ${a.nombre}` : a.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              id="modal-activo"
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="modal-activo" className="text-xs font-medium text-slate-700">
              Cuenta habilitada y activa inmediatamente para inicio de sesión
            </label>
          </div>

          {/* Botones de acción */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition disabled:opacity-50 shadow-xs"
            >
              <UserPlus className="h-4 w-4" />
              {enviando ? "Registrando usuario..." : "Registrar usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
