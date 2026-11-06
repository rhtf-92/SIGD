import { useEffect, useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import {
  actualizarRolDirectorio,
  guardarPermisosDeRol,
  listarPermisosDirectorio,
  listarRolesDirectorio,
  mensajeDeError,
  obtenerPermisosDeRol,
  type PermisoDirectorio,
  type RolDirectorio,
} from "../../services/adminDirectorioService";

const CLASE_INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

export default function RolesPermisosDirectorioPage() {
  const [roles, setRoles] = useState<RolDirectorio[]>([]);
  const [permisos, setPermisos] = useState<PermisoDirectorio[]>([]);
  const [rolSel, setRolSel] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let vigente = true;
    Promise.all([listarRolesDirectorio(), listarPermisosDirectorio()])
      .then(([listaRoles, listaPermisos]) => {
        if (!vigente) return;
        setRoles(listaRoles);
        setPermisos(listaPermisos);
        setRolSel((actual) => actual || (listaRoles[0]?.rolId ?? ""));
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
  }, []);

  useEffect(() => {
    if (!rolSel) return;
    const rol = roles.find((r) => r.rolId === rolSel);
    setNombre(rol?.nombre ?? "");
    setDescripcion(rol?.descripcion ?? "");
  }, [rolSel, roles]);

  useEffect(() => {
    if (!rolSel) return;
    let vigente = true;
    obtenerPermisosDeRol(rolSel)
      .then((ids) => {
        if (vigente) setMarcados(ids);
      })
      .catch((e: unknown) => {
        if (vigente) setError(mensajeDeError(e));
      });
    return () => {
      vigente = false;
    };
  }, [rolSel]);

  const rolActual = roles.find((r) => r.rolId === rolSel);

  function alternar(permisoId: string) {
    setMarcados((previo) =>
      previo.includes(permisoId) ? previo.filter((x) => x !== permisoId) : [...previo, permisoId],
    );
  }

  async function guardarPermisos() {
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const ids = await guardarPermisosDeRol(rolSel, marcados);
      setMarcados(ids);
      setRoles(await listarRolesDirectorio());
      setMensaje("Permisos guardados en la base de datos.");
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarDatos() {
    if (!nombre.trim()) {
      setError("El nombre del rol es obligatorio.");
      return;
    }
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await actualizarRolDirectorio(rolSel, { nombre: nombre.trim(), descripcion: descripcion.trim() });
      setRoles(await listarRolesDirectorio());
      setMensaje("Datos del rol guardados.");
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Roles y permisos"
        description="Edite los roles del sistema y asigne permisos por rol. Los cambios se guardan en la base de datos."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {mensaje && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensaje}</div>}
        {cargando && <p className="mb-4 text-sm text-slate-500">Cargando...</p>}

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Roles del sistema</h2>
            <div className="space-y-3">
              {roles.map((r) => (
                <button
                  key={r.rolId}
                  type="button"
                  onClick={() => { setRolSel(r.rolId); setMensaje(""); setError(""); }}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    rolSel === r.rolId ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold">{r.nombre}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {r.totalPermisos ?? 0} permisos
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{r.codigo}{r.vigente ? "" : " (inactivo)"}</p>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Los 6 roles base están definidos por el esquema institucional. Crear roles nuevos requiere una migración aprobada.
            </p>
          </aside>

          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase text-blue-700">Rol seleccionado: {rolActual?.codigo ?? "-"}</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Nombre
                  <input className={`${CLASE_INPUT} mt-1`} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Descripción
                  <input className={`${CLASE_INPUT} mt-1`} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="button" disabled={guardando || !rolSel} onClick={() => void guardarDatos()} className="rounded-lg border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60">
                  Guardar datos del rol
                </button>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h3 className="font-bold">Permisos del rol</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Los permisos quedan guardados por rol. Hoy cada ruta de administración valida el rol; que cada módulo consulte estos permisos es una etapa siguiente.
                </p>
              </div>
              <ul className="divide-y divide-slate-100">
                {permisos.map((p) => (
                  <li key={p.permisoId} className="flex items-center justify-between gap-4 px-6 py-3">
                    <label className="flex flex-1 items-center gap-3 text-sm">
                      <input type="checkbox" checked={marcados.includes(p.permisoId)} onChange={() => alternar(p.permisoId)} className="h-4 w-4 accent-blue-700" />
                      <span>
                        <span className="font-semibold">{p.nombre}</span>
                        <span className="ml-2 text-xs text-slate-500">{p.codigo}</span>
                      </span>
                    </label>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{p.ambito}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end p-5">
                <button type="button" disabled={guardando || !rolSel} onClick={() => void guardarPermisos()} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                  Guardar permisos
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}