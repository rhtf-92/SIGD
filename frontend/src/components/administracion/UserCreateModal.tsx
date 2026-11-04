import { useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import { crearUsuario } from "../../services/adminUsuariosService";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

interface RolOpcion {
  clave: string;
  etiqueta: string;
  codigosCompatibles: string[];
  fallbackId: string;
  rolId: string;
}

const ROLES_CANONICOS_CONFIG: Omit<RolOpcion, "rolId">[] = [
  {
    clave: "SUPER_ADMIN",
    etiqueta: "Super Admin",
    codigosCompatibles: ["SUPER_ADMIN", "ADMINISTRADOR"],
    fallbackId: "22222222-2222-2222-2222-222222222001",
  },
  {
    clave: "DIRECTOR",
    etiqueta: "Director",
    codigosCompatibles: ["DIRECTOR"],
    fallbackId: "22222222-2222-2222-2222-222222222002",
  },
  {
    clave: "DOCENTE",
    etiqueta: "Docente",
    codigosCompatibles: ["DOCENTE", "ESPECIALISTA", "SECRETARIO"],
    fallbackId: "22222222-2222-2222-2222-222222222003",
  },
  {
    clave: "MESA_PARTES",
    etiqueta: "Mesa de Partes",
    codigosCompatibles: ["MESA_PARTES"],
    fallbackId: "22222222-2222-2222-2222-222222222004",
  },
  {
    clave: "ESTUDIANTE",
    etiqueta: "Estudiante",
    codigosCompatibles: ["ESTUDIANTE", "CIUDADANO"],
    fallbackId: "22222222-2222-2222-2222-222222222005",
  },
];

export default function UserCreateModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    nombres: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    dni: "",
    correo: "",
    username: "",
    password: "",
    telefono: "",
    rolClave: "SUPER_ADMIN",
  });

  const [rolesOpciones, setRolesOpciones] = useState<RolOpcion[]>(() =>
    ROLES_CANONICOS_CONFIG.map((cfg) => ({
      ...cfg,
      rolId: cfg.fallbackId,
    }))
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let montado = true;
    apiClient
      .get<{ roles: { rol_id: string; codigo: string }[] }>("/api/v1/admin/roles-permisos")
      .then((r) => {
        if (!montado) return;
        const list = r.data?.roles ?? [];
        if (!list.length) return;

        setRolesOpciones((prev) =>
          prev.map((opt) => {
            const encontrado = list.find((item) =>
              opt.codigosCompatibles.includes(item.codigo?.toUpperCase?.() ?? "")
            );
            return {
              ...opt,
              rolId: encontrado?.rol_id || opt.fallbackId,
            };
          })
        );
      })
      .catch(() => {
        // En caso de que el backend esté offline o sin DB, se conservan los fallbackId certificados
      });

    return () => {
      montado = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const rolSeleccionado =
      rolesOpciones.find((r) => r.clave === form.rolClave) ?? rolesOpciones[0];

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
        rolId: rolSeleccionado.rolId,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const campo = (
    label: string,
    key: string,
    placeholder: string,
    tipo = "text",
    requerido = true
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600">
        {label}
        {requerido && <span className="text-red-500"> *</span>}
      </label>
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
          <p className="text-xs text-blue-100 mt-1">
            Complete los datos. El correo debe ser @iestpsuiza.edu.pe. Contraseña mínimo 8 caracteres.
          </p>
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

          <div className="flex flex-col gap-1">
            <label htmlFor="select-rol-institucional" className="text-xs font-semibold text-slate-600">
              Rol institucional <span className="text-red-500">*</span>
            </label>
            <select
              id="select-rol-institucional"
              value={form.rolClave}
              onChange={(e) => set("rolClave", e.target.value)}
              required
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition bg-white"
            >
              {rolesOpciones.map((r) => (
                <option key={r.clave} value={r.clave}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="sm:col-span-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition"
            >
              {loading ? "Guardando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
