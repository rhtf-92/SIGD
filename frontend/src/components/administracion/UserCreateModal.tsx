import { useState } from "react";
import { crearUsuario } from "../../services/adminUsuariosService";

interface Props { onClose: () => void; onCreated: () => void; }

export default function UserCreateModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    nombres: "", apellidoPaterno: "", apellidoMaterno: "", dni: "",
    correo: "", username: "", password: "", telefono: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await crearUsuario({
        tipoDocumentoId: 21,
        numeroDocumento: form.dni,
        nombres: form.nombres,
        apellidoPaterno: form.apellidoPaterno,
        apellidoMaterno: form.apellidoMaterno || null,
        telefono: form.telefono || null,
        correo: form.correo,
        username: form.username,
        passwordInicial: form.password,
        puestoLaboralId: "50000000-0000-0000-0000-000000000001",
        rolId: "7ee18ddf-98e4-42ef-b846-3de3922a8bac",
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Error al crear");
    } finally { setLoading(false); }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const campo = (label: string, key: string, placeholder: string, tipo = "text", requerido = true) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600">{label}{requerido && <span className="text-red-500"> *</span>}</label>
      <input
        type={tipo}
        placeholder={placeholder}
        value={(form as any)[key]}
        onChange={(e) => set(key, e.target.value)}
        required={requerido}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-4">
          <h3 className="text-xl font-bold text-white">Nuevo usuario institucional</h3>
          <p className="text-xs text-blue-100 mt-1">Complete los datos. El correo debe ser @iestpsuiza.edu.pe. Contraseña mínimo 8 caracteres.</p>
        </div>
        <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6" onSubmit={submit}>
          {campo("Nombres", "nombres", "Ej. Juan Carlos")}
          {campo("Apellido paterno", "apellidoPaterno", "Ej. Pérez")}
          {campo("Apellido materno (opcional)", "apellidoMaterno", "Ej. García", "text", false)}
          {campo("DNI (8 dígitos)", "dni", "12345678")}
          {campo("Correo institucional", "correo", "usuario@iestpsuiza.edu.pe", "email")}
          {campo("Usuario (login)", "username", "jperez")}
          {campo("Contraseña inicial", "password", "Mínimo 8 caracteres", "password")}
          {campo("Teléfono (opcional)", "telefono", "999999999", "text", false)}
          {error && <p className="sm:col-span-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 transition">Cancelar</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition">{loading ? "Guardando..." : "Crear usuario"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
