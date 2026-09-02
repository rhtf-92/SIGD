import { useMemo, useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";

type EstadoUsuario = "Activo" | "Inactivo" | "Bloqueado";

interface Usuario {
  id: number;
  nombre: string;
  dni: string;
  correo: string;
  sede: string;
  area: string;
  cargo: string;
  rol: string;
  estado: EstadoUsuario;
  ultimoAcceso: string;
}

const usuariosIniciales: Usuario[] = [
  {
    id: 1,
    nombre: "Juan Carlos Pérez",
    dni: "71234567",
    correo: "jperez@institutosuiza.edu.pe",
    sede: "Sede Principal",
    area: "Mesa de Partes",
    cargo: "Asistente Administrativo",
    rol: "Operador",
    estado: "Activo",
    ultimoAcceso: "29/08/2026 09:42",
  },
  {
    id: 2,
    nombre: "María Fernanda López",
    dni: "74561238",
    correo: "mlopez@institutosuiza.edu.pe",
    sede: "Sede Principal",
    area: "Secretaría Académica",
    cargo: "Secretaria",
    rol: "Responsable de Área",
    estado: "Activo",
    ultimoAcceso: "29/08/2026 08:35",
  },
  {
    id: 3,
    nombre: "Luis Alberto Ramos",
    dni: "70124589",
    correo: "lramos@institutosuiza.edu.pe",
    sede: "Sede Principal",
    area: "Archivo Central",
    cargo: "Encargado de Archivo",
    rol: "Archivador",
    estado: "Inactivo",
    ultimoAcceso: "25/08/2026 16:20",
  },
  {
    id: 4,
    nombre: "Ana Torres García",
    dni: "73654821",
    correo: "atorres@institutosuiza.edu.pe",
    sede: "Sede Principal",
    area: "Administración",
    cargo: "Administradora",
    rol: "Administrador",
    estado: "Bloqueado",
    ultimoAcceso: "28/08/2026 14:12",
  },
];

const roles = [
  "Administrador",
  "Responsable de Área",
  "Operador",
  "Archivador",
  "Consulta",
];

const areas = [
  "Administración",
  "Mesa de Partes",
  "Secretaría Académica",
  "Archivo Central",
];

function estiloEstado(estado: EstadoUsuario) {
  if (estado === "Activo") return "bg-emerald-100 text-emerald-700";
  if (estado === "Bloqueado") return "bg-red-100 text-red-700";
  return "bg-slate-200 text-slate-700";
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState(usuariosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoUsuario | "Todos">("Todos");
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [mensaje, setMensaje] = useState("");

  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return usuarios.filter((usuario) => {
      const coincideBusqueda =
        texto === "" ||
        usuario.nombre.toLowerCase().includes(texto) ||
        usuario.dni.includes(texto) ||
        usuario.correo.toLowerCase().includes(texto) ||
        usuario.area.toLowerCase().includes(texto);

      const coincideEstado = estado === "Todos" || usuario.estado === estado;
      return coincideBusqueda && coincideEstado;
    });
  }, [busqueda, estado, usuarios]);

  function actualizarUsuario() {
    if (!usuarioEditando) return;

    setUsuarios((actuales) =>
      actuales.map((usuario) =>
        usuario.id === usuarioEditando.id ? usuarioEditando : usuario,
      ),
    );
    setMensaje("Cambios aplicados en la vista de demostración.");
    setUsuarioEditando(null);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Gestión de Usuarios"
        description="Administración de cuentas, áreas, cargos, roles y estados."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Usuarios</h2>
            <p className="mt-2 text-sm text-slate-600">
              Este módulo administra cuentas existentes. El registro inicial de
              usuarios puede integrarse con el módulo de registro del sistema.
            </p>
          </div>
          <span className="rounded-lg bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
            Datos de demostración hasta integrar el backend
          </span>
        </div>

        {mensaje && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensaje}
          </div>
        )}

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="busqueda" className="mb-2 block text-sm font-semibold">
                Buscar usuario
              </label>
              <input
                id="busqueda"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Nombre, DNI, correo o área"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label htmlFor="estado" className="mb-2 block text-sm font-semibold">
                Estado
              </label>
              <select
                id="estado"
                value={estado}
                onChange={(event) =>
                  setEstado(event.target.value as EstadoUsuario | "Todos")
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="Todos">Todos</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
                <option value="Bloqueado">Bloqueado</option>
              </select>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="font-bold">Usuarios registrados</h3>
            <p className="mt-1 text-xs text-slate-500">
              {usuariosFiltrados.length} resultado
              {usuariosFiltrados.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Usuario</th>
                  <th className="px-6 py-3">DNI</th>
                  <th className="px-6 py-3">Área</th>
                  <th className="px-6 py-3">Cargo</th>
                  <th className="px-6 py-3">Rol</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Último acceso</th>
                  <th className="px-6 py-3">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold">{usuario.nombre}</p>
                      <p className="text-xs text-slate-500">{usuario.correo}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">{usuario.dni}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{usuario.area}</p>
                      <p className="text-xs text-slate-500">{usuario.sede}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {usuario.cargo}
                    </td>
                    <td className="px-6 py-4 text-sm">{usuario.rol}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estiloEstado(
                          usuario.estado,
                        )}`}
                      >
                        {usuario.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {usuario.ultimoAcceso}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          setMensaje("");
                          setUsuarioEditando({ ...usuario });
                        }}
                        className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        Administrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {usuarioEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Administrar cuenta</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {usuarioEditando.nombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUsuarioEditando(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Área</label>
                <select
                  value={usuarioEditando.area}
                  onChange={(event) =>
                    setUsuarioEditando({
                      ...usuarioEditando,
                      area: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                >
                  {areas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Rol</label>
                <select
                  value={usuarioEditando.rol}
                  onChange={(event) =>
                    setUsuarioEditando({
                      ...usuarioEditando,
                      rol: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                >
                  {roles.map((rol) => (
                    <option key={rol} value={rol}>
                      {rol}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Estado</label>
                <select
                  value={usuarioEditando.estado}
                  onChange={(event) =>
                    setUsuarioEditando({
                      ...usuarioEditando,
                      estado: event.target.value as EstadoUsuario,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                  <option value="Bloqueado">Bloqueado</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setUsuarioEditando(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={actualizarUsuario}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
