import { useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import { crearUsuario } from "../../services/adminUsuariosService";

interface Props { onClose: () => void; onCreated: () => void; }
interface RolOpcion { clave: string; etiqueta: string; codigosCompatibles: string[]; fallbackId: string; rolId: string; }

const ROLES_CANONICOS_CONFIG: Omit<RolOpcion, "rolId">[] = [
  { clave: "SUPER_ADMIN", etiqueta: "Administrador", codigosCompatibles: ["SUPER_ADMIN", "ADMINISTRADOR"], fallbackId: "22222222-2222-2222-2222-222222222001" },
  { clave: "DIRECTOR", etiqueta: "Director", codigosCompatibles: ["DIRECTOR"], fallbackId: "22222222-2222-2222-2222-222222222002" },
  { clave: "DOCENTE", etiqueta: "Docente", codigosCompatibles: ["DOCENTE", "ESPECIALISTA", "SECRETARIO"], fallbackId: "22222222-2222-2222-2222-222222222003" },
  { clave: "MESA_PARTES", etiqueta: "Mesa de Partes", codigosCompatibles: ["MESA_PARTES"], fallbackId: "22222222-2222-2222-2222-222222222004" },
  { clave: "ESTUDIANTE", etiqueta: "Estudiante", codigosCompatibles: ["ESTUDIANTE", "CIUDADANO"], fallbackId: "22222222-2222-2222-2222-222222222005" },
];

export default function UserCreateModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({ nombres: "", apellidoPaterno: "", apellidoMaterno: "", dni: "", correo: "", username: "", password: "", telefono: "", rolClave: "SUPER_ADMIN" });
  const [rolesOpciones, setRolesOpciones] = useState<RolOpcion[]>(() => ROLES_CANONICOS_CONFIG.map((cfg) => ({ ...cfg, rolId: cfg.fallbackId })));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let montado = true;
    apiClient.get<{ roles: { rol_id: string; codigo: string }[] }>("/api/v1/admin/roles-permisos").then((r) => {
      if (!montado) return;
      const list = r.data?.roles ?? [];
      if (!list.length) return;
      setRolesOpciones((prev) => prev.map((opt) => ({ ...opt, rolId: list.find((item) => opt.codigosCompatibles.includes(item.codigo?.toUpperCase?.() ?? ""))?.rol_id || opt.fallbackId })));
    }).catch(() => {});
    return () => { montado = false; };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const rolSeleccionado = rolesOpciones.find((r) => r.clave === form.rolClave) ?? rolesOpciones[0];
    try {
      await crearUsuario({ tipoDocumentoId: 21, numeroDocumento: form.dni, nombres: form.nombres, apellidoPaterno: form.apellidoPaterno, apellidoMaterno: form.apellidoMaterno || null, telefono: form.telefono || null, correo: form.correo, username: form.username, passwordInicial: form.password, puestoLaboralId: "50000000-0000-0000-0000-000000000001", rolId: rolSeleccionado.rolId });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.problemDetails?.detail ?? err?.message ?? "Error al crear usuario");
    } finally { setLoading(false); }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const inputCls = "w-full rounded-xl border border-cyan-400/40 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-300 ease-out hover:brightness-110 focus:border-cyan-400/60";
  const campo = (label: string, key: string, placeholder: string, tipo = "text", requerido = true) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-300">{label}{requerido && <span className="text-cyan-400"> *</span>}</label>
      <input type={tipo} placeholder={placeholder} value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} required={requerido} className={inputCls} />
    </div>
  );

  return (
    <div className="sigd-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="sigd-fade-in w-full max-w-2xl overflow-hidden rounded-2xl border border-cyan-400/40 bg-[rgba(15,23,42,0.68)] shadow-[0_0_15px_rgba(6,182,212,0.15)] backdrop-blur-[12px]">
        <div className="border-b border-cyan-400/25 px-6 py-4">
          <h3 className="text-xl font-semibold text-slate-100">Nuevo usuario institucional</h3>
          <p className="mt-1 text-xs text-slate-400">Correo @iestpsuiza.edu.pe. Contraseña mínimo 8 caracteres.</p>
        </div>
        <form className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2" onSubmit={submit}>
          {campo("Nombres", "nombres", "Ej. Juan Carlos")}
          {campo("Apellido paterno", "apellidoPaterno", "Ej. Pérez")}
          {campo("Apellido materno (opcional)", "apellidoMaterno", "Ej. García", "text", false)}
          {campo("DNI (8 dígitos)", "dni", "12345678")}
          {campo("Correo institucional", "correo", "usuario@iestpsuiza.edu.pe", "email")}
          {campo("Usuario (login)", "username", "jperez")}
          {campo("Contraseña inicial", "password", "Mínimo 8 caracteres", "password")}
          {campo("Teléfono (opcional)", "telefono", "999999999", "text", false)}
          <div className="flex flex-col gap-1">
            <label htmlFor="select-rol-institucional" className="text-xs font-semibold text-slate-300">Rol institucional <span className="text-cyan-400">*</span></label>
            <select id="select-rol-institucional" value={form.rolClave} onChange={(e) => set("rolClave", e.target.value)} required className={inputCls}>
              {rolesOpciones.map((r) => <option key={r.clave} value={r.clave} className="bg-slate-900">{r.etiqueta}</option>)}
            </select>
          </div>
          {error && <p className="rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200 sm:col-span-2">{error}</p>}
          <div className="mt-2 flex justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-cyan-400/40 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-300 ease-out hover:brightness-110">Cancelar</button>
            <button type="submit" disabled={loading} className="rounded-xl border border-cyan-400/40 bg-cyan-600/25 px-4 py-2 text-sm font-semibold text-cyan-100 transition-all duration-300 ease-out hover:brightness-125 disabled:opacity-60">{loading ? "Guardando..." : "Crear usuario"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
