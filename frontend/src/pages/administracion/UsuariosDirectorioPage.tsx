import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import {
  actualizarUsuarioDirectorio,
  crearUsuarioDirectorio,
  listarRolesDirectorio,
  listarUsuariosDirectorio,
  mensajeDeError,
  type CambiosUsuarioDirectorio,
  type NuevoUsuarioDirectorio,
  type RolDirectorio,
  type UsuarioDirectorio,
} from "../../services/adminDirectorioService";

const LIMITE = 20;
const RE_USUARIO = /^[A-Za-z0-9._-]{3,50}$/;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLASE_INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500";

interface FormUsuario {
  usuario: string;
  dni: string;
  nombres: string;
  apellidos: string;
  correo: string;
  celular: string;
  password: string;
  rolId: string;
  activo: boolean;
}

const FORM_VACIO: FormUsuario = {
  usuario: "",
  dni: "",
  nombres: "",
  apellidos: "",
  correo: "",
  celular: "",
  password: "",
  rolId: "",
  activo: true,
};

type ModoModal = { modo: "crear" } | { modo: "editar"; usuario: UsuarioDirectorio };

function formDesdeUsuario(u: UsuarioDirectorio): FormUsuario {
  return {
    usuario: u.usuario,
    dni: u.documento ?? "",
    nombres: u.nombres ?? "",
    apellidos: u.apellidos ?? "",
    correo: u.correo,
    celular: u.celular ?? "",
    password: "",
    rolId: u.rolId ?? "",
    activo: u.activo,
  };
}

function formatearFecha(valor: string | null): string {
  if (!valor) return "Nunca";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "-";
  return fecha.toLocaleString("es-PE", { timeZone: "America/Lima" });
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {etiqueta}
      <div className="mt-1">{children}</div>
    </label>
  );
}

interface ModalUsuarioProps {
  modal: ModoModal;
  roles: RolDirectorio[];
  onCerrar: () => void;
  onGuardado: (mensaje: string) => void;
}

function ModalUsuario({ modal, roles, onCerrar, onGuardado }: ModalUsuarioProps) {
  const crear = modal.modo === "crear";
  const [form, setForm] = useState<FormUsuario>(
    modal.modo === "editar" ? formDesdeUsuario(modal.usuario) : FORM_VACIO,
  );
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);

  function cambiar<K extends keyof FormUsuario>(campo: K, valor: FormUsuario[K]) {
    setForm((previo) => ({ ...previo, [campo]: valor }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const problemas: string[] = [];
    if (modal.modo === "crear") {
      if (!RE_USUARIO.test(form.usuario.trim())) problemas.push("Usuario: 3 a 50 caracteres (letras, números, punto, guion).");
      if (!/^\d{8}$/.test(form.dni.trim())) problemas.push("DNI: 8 dígitos.");
      if (!form.rolId) problemas.push("Rol: seleccione un rol.");
      if (form.password.length < 8) problemas.push("Contraseña: mínimo 8 caracteres.");
    }
    if (!form.nombres.trim()) problemas.push("Nombres: obligatorio.");
    if (!form.apellidos.trim()) problemas.push("Apellidos: obligatorio.");
    if (!RE_CORREO.test(form.correo.trim())) problemas.push("Correo: formato inválido.");
    if (form.celular.trim() && !/^\d{9}$/.test(form.celular.trim())) problemas.push("Celular: 9 dígitos.");
    if (problemas.length > 0) {
      setErrorForm(problemas.join(" "));
      return;
    }

    setGuardando(true);
    setErrorForm("");
    try {
      if (modal.modo === "crear") {
        const nuevo: NuevoUsuarioDirectorio = {
          usuario: form.usuario.trim(),
          correo: form.correo.trim().toLowerCase(),
          password: form.password,
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          dni: form.dni.trim(),
        };
        if (form.celular.trim()) nuevo.celular = form.celular.trim();
        if (form.rolId) nuevo.rolId = form.rolId;
        await crearUsuarioDirectorio(nuevo);
        onGuardado(`Usuario ${nuevo.usuario} creado.`);
      } else {
        const cambios: CambiosUsuarioDirectorio = {
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          correo: form.correo.trim().toLowerCase(),
          celular: form.celular.trim(),
          activo: form.activo,
        };
        if (form.rolId && form.rolId !== (modal.usuario.rolId ?? "")) cambios.rolId = form.rolId;
        await actualizarUsuarioDirectorio(modal.usuario.idUsuario, cambios);
        onGuardado(`Usuario ${modal.usuario.usuario} actualizado.`);
      }
    } catch (error) {
      setErrorForm(mensajeDeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label={crear ? "Nuevo usuario" : "Editar usuario"}>
      <form onSubmit={(e) => void enviar(e)} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-slate-900">{crear ? "Nuevo usuario" : "Editar usuario"}</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Usuario">
            <input className={CLASE_INPUT} value={form.usuario} disabled={!crear} onChange={(e) => cambiar("usuario", e.target.value)} />
          </Campo>
          <Campo etiqueta="DNI">
            <input className={CLASE_INPUT} value={form.dni} disabled={!crear} maxLength={8} inputMode="numeric" onChange={(e) => cambiar("dni", e.target.value)} />
          </Campo>
          <Campo etiqueta="Nombres">
            <input className={CLASE_INPUT} value={form.nombres} onChange={(e) => cambiar("nombres", e.target.value)} />
          </Campo>
          <Campo etiqueta="Apellidos">
            <input className={CLASE_INPUT} value={form.apellidos} onChange={(e) => cambiar("apellidos", e.target.value)} />
          </Campo>
          <Campo etiqueta="Correo">
            <input className={CLASE_INPUT} type="email" value={form.correo} onChange={(e) => cambiar("correo", e.target.value)} />
          </Campo>
          <Campo etiqueta="Celular">
            <input className={CLASE_INPUT} value={form.celular} maxLength={9} inputMode="numeric" onChange={(e) => cambiar("celular", e.target.value)} />
          </Campo>
          <Campo etiqueta="Rol">
            <select className={CLASE_INPUT} value={form.rolId} onChange={(e) => cambiar("rolId", e.target.value)}>
              <option value="">{crear ? "Seleccione un rol" : "Sin rol"}</option>
              {roles.filter((r) => r.vigente).map((r) => (
                <option key={r.rolId} value={r.rolId}>{r.nombre}</option>
              ))}
            </select>
          </Campo>
          {crear ? (
            <Campo etiqueta="Contraseña inicial">
              <input className={CLASE_INPUT} type="password" autoComplete="new-password" value={form.password} onChange={(e) => cambiar("password", e.target.value)} />
            </Campo>
          ) : (
            <label className="flex items-center gap-2 pt-7 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.activo} onChange={(e) => cambiar("activo", e.target.checked)} className="h-4 w-4" />
              Cuenta activa
            </label>
          )}
        </div>

        {errorForm && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorForm}</div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancelar</button>
          <button type="submit" disabled={guardando} className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function UsuariosDirectorioPage() {
  const [usuarios, setUsuarios] = useState<UsuarioDirectorio[]>([]);
  const [roles, setRoles] = useState<RolDirectorio[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [estado, setEstado] = useState<"" | "activo" | "inactivo">("");
  const [rolId, setRolId] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [modal, setModal] = useState<ModoModal | null>(null);

  useEffect(() => {
    let vigente = true;
    listarRolesDirectorio()
      .then((lista) => {
        if (vigente) setRoles(lista);
      })
      .catch((e: unknown) => {
        if (vigente) setError(mensajeDeError(e));
      });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (busqueda === busquedaAplicada) return;
    const temporizador = setTimeout(() => {
      setBusquedaAplicada(busqueda);
      setPagina(1);
    }, 300);
    return () => clearTimeout(temporizador);
  }, [busqueda, busquedaAplicada]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    listarUsuariosDirectorio({ busqueda: busquedaAplicada, estado, rolId, pagina, limite: LIMITE })
      .then((r) => {
        if (!vigente) return;
        setUsuarios(r.items);
        setTotal(r.total);
        setError("");
      })
      .catch((e: unknown) => {
        if (vigente) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [busquedaAplicada, estado, rolId, pagina, recarga]);

  async function alternarActivo(u: UsuarioDirectorio) {
    setError("");
    setMensaje("");
    try {
      await actualizarUsuarioDirectorio(u.idUsuario, { activo: !u.activo });
      setMensaje(`Cuenta ${u.usuario} ${u.activo ? "desactivada" : "activada"}.`);
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Directorio de usuarios"
        description="Crear, editar y asignar roles a los usuarios del sistema. Los datos se guardan en la base de datos."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-slate-700">
            Buscar
            <input className={`${CLASE_INPUT} mt-1 w-64`} value={busqueda} placeholder="Usuario, nombre, correo o DNI" onChange={(e) => setBusqueda(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Rol
            <select className={`${CLASE_INPUT} mt-1`} value={rolId} onChange={(e) => { setRolId(e.target.value); setPagina(1); }}>
              <option value="">Todos</option>
              {roles.map((r) => (
                <option key={r.rolId} value={r.rolId}>{r.nombre}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Estado
            <select className={`${CLASE_INPUT} mt-1`} value={estado} onChange={(e) => { setEstado(e.target.value as "" | "activo" | "inactivo"); setPagina(1); }}>
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </label>
          <button type="button" onClick={() => { setMensaje(""); setModal({ modo: "crear" }); }} className="ml-auto rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
            Nuevo usuario
          </button>
        </div>

        {mensaje && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensaje}</div>}
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Celular</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Último acceso</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.map((u) => (
                <tr key={u.idUsuario}>
                  <td className="px-4 py-3 font-semibold">{u.usuario}</td>
                  <td className="px-4 py-3">{u.nombreCompleto ?? "-"}</td>
                  <td className="px-4 py-3">{u.documento ?? "-"}</td>
                  <td className="px-4 py-3">{u.correo}</td>
                  <td className="px-4 py-3">{u.celular ?? "-"}</td>
                  <td className="px-4 py-3">{u.rolNombre ?? "Sin rol"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${u.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatearFecha(u.ultimoAcceso)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setMensaje(""); setModal({ modo: "editar", usuario: u }); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Editar</button>
                      <button type="button" onClick={() => void alternarActivo(u)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!cargando && usuarios.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">No hay usuarios con esos filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
          {cargando && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Cargando...</p>}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>{total} usuarios en total</span>
          <div className="flex items-center gap-3">
            <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">Anterior</button>
            <span>Página {pagina} de {totalPaginas}</span>
            <button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      </section>

      {modal && (
        <ModalUsuario
          modal={modal}
          roles={roles}
          onCerrar={() => setModal(null)}
          onGuardado={(texto) => {
            setModal(null);
            setMensaje(texto);
            setRecarga((n) => n + 1);
          }}
        />
      )}
    </main>
  );
}