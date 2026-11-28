import { useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  Square,
  Shield,
  Search,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";

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
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

interface CategoriaDef {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  codigos: string[];
}

const CATEGORIAS_PERMISOS: CategoriaDef[] = [
  {
    id: "TRAMITES",
    nombre: "Trámites, Ventanilla y TUPA",
    descripcion: "Radicación de documentos, apertura de trámites externos y gestión del catálogo TUPA",
    icono: "📋",
    codigos: ["VENTANILLA_RADICAR", "EXPEDIENTE_CREAR", "TRAMITE_CONSULTAR", "TUPA_GESTIONAR"],
  },
  {
    id: "EXPEDIENTES",
    nombre: "Expedientes y Actuaciones Procesales",
    descripcion: "Consulta, pases inter-áreas, foliación y resolución final de expedientes",
    icono: "📁",
    codigos: ["EXPEDIENTE_LEER", "EXPEDIENTE_DERIVAR", "EXPEDIENTE_RESOLVER", "EXPEDIENTE_FOLIAR"],
  },
  {
    id: "DOCUMENTOS",
    nombre: "Documentos Oficiales y Resoluciones",
    descripcion: "Emisión de oficios, firma digital y aprobación de Resoluciones Directorales",
    icono: "📝",
    codigos: ["DOCUMENTO_CREAR", "FIRMA_FIRMAR", "RESOLUCION_PROYECTAR", "RESOLUCION_EMITIR"],
  },
  {
    id: "NOTIFICACIONES",
    nombre: "Casilla Electrónica y Notificaciones",
    descripcion: "Envío de cédulas electrónicas, consulta de casilla y emisión de acuse legal",
    icono: "📬",
    codigos: ["NOTIFICACION_EMITIR", "CASILLA_LEER", "CASILLA_ACUSE"],
  },
  {
    id: "ADMINISTRACION",
    nombre: "Administración, Seguridad y Calendario",
    descripcion: "Gestión de usuarios y accesos, tablas maestras, bitácora forense y calendario laboral",
    icono: "⚙️",
    codigos: ["ADMIN_USUARIOS", "ADMIN_MAESTRAS", "ADMIN_AUDITORIA", "CALENDARIO_GESTIONAR"],
  },
  {
    id: "REPORTES",
    nombre: "Reportes y Monitoreo MGD",
    descripcion: "Visualización de indicadores de gestión documental y exportación de reportes",
    icono: "📊",
    codigos: ["REPORTE_LEER", "REPORTE_EXPORTAR"],
  },
];

const PLANTILLAS_INSTITUCIONALES: Record<string, string[]> = {
  ADMINISTRADOR: [
    "VENTANILLA_RADICAR", "EXPEDIENTE_CREAR", "TRAMITE_CONSULTAR", "TUPA_GESTIONAR",
    "EXPEDIENTE_LEER", "EXPEDIENTE_DERIVAR", "EXPEDIENTE_RESOLVER", "EXPEDIENTE_FOLIAR",
    "DOCUMENTO_CREAR", "FIRMA_FIRMAR", "RESOLUCION_PROYECTAR", "RESOLUCION_EMITIR",
    "NOTIFICACION_EMITIR", "CASILLA_LEER", "CASILLA_ACUSE",
    "ADMIN_USUARIOS", "ADMIN_MAESTRAS", "ADMIN_AUDITORIA", "CALENDARIO_GESTIONAR",
    "REPORTE_LEER", "REPORTE_EXPORTAR",
  ],
  DIRECTOR: [
    "EXPEDIENTE_LEER", "EXPEDIENTE_DERIVAR", "EXPEDIENTE_RESOLVER",
    "DOCUMENTO_CREAR", "FIRMA_FIRMAR", "RESOLUCION_PROYECTAR", "RESOLUCION_EMITIR",
    "NOTIFICACION_EMITIR", "TRAMITE_CONSULTAR",
    "REPORTE_LEER", "REPORTE_EXPORTAR", "ADMIN_AUDITORIA",
  ],
  SECRETARIO: [
    "EXPEDIENTE_LEER", "EXPEDIENTE_DERIVAR", "EXPEDIENTE_FOLIAR",
    "DOCUMENTO_CREAR", "RESOLUCION_PROYECTAR", "FIRMA_FIRMAR", "TUPA_GESTIONAR",
    "NOTIFICACION_EMITIR", "TRAMITE_CONSULTAR",
    "REPORTE_LEER", "REPORTE_EXPORTAR",
  ],
  ESPECIALISTA: [
    "EXPEDIENTE_LEER", "EXPEDIENTE_DERIVAR", "EXPEDIENTE_RESOLVER", "EXPEDIENTE_FOLIAR",
    "DOCUMENTO_CREAR", "TRAMITE_CONSULTAR",
  ],
  MESA_PARTES: [
    "VENTANILLA_RADICAR", "EXPEDIENTE_CREAR", "EXPEDIENTE_LEER", "EXPEDIENTE_DERIVAR", "EXPEDIENTE_FOLIAR",
    "DOCUMENTO_CREAR", "NOTIFICACION_EMITIR", "TRAMITE_CONSULTAR",
  ],
  CIUDADANO: [
    "CASILLA_LEER", "CASILLA_ACUSE", "TRAMITE_CONSULTAR",
  ],
};

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

  // Filtros de búsqueda en la matriz
  const [busqueda, setBusqueda] = useState("");
  const [filtroAmbito, setFiltroAmbito] = useState<"" | "GLOBAL" | "AREA">("");

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

  // Filtrado de permisos en memoria
  const permisosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return permisos.filter((p) => {
      const matchBusqueda =
        !q ||
        p.codigo.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q);
      const matchAmbito = !filtroAmbito || p.ambito === filtroAmbito;
      return matchBusqueda && matchAmbito;
    });
  }, [permisos, busqueda, filtroAmbito]);

  // Agrupamiento por categorías declaradas
  const gruposCategorias = useMemo(() => {
    const codigosCategorizados = new Set(CATEGORIAS_PERMISOS.flatMap((c) => c.codigos));
    
    const grupos = CATEGORIAS_PERMISOS.map((cat) => {
      const items = permisosFiltrados.filter((p) => cat.codigos.includes(p.codigo));
      return {
        ...cat,
        items,
        totalEnSistema: permisos.filter((p) => cat.codigos.includes(p.codigo)).length,
      };
    }).filter((g) => g.items.length > 0);

    const otrosItems = permisosFiltrados.filter((p) => !codigosCategorizados.has(p.codigo));
    if (otrosItems.length > 0) {
      grupos.push({
        id: "OTROS",
        nombre: "Otros Permisos Especiales",
        descripcion: "Permisos adicionales registrados en la base de datos",
        icono: "🔧",
        codigos: otrosItems.map((p) => p.codigo),
        items: otrosItems,
        totalEnSistema: otrosItems.length,
      });
    }

    return grupos;
  }, [permisos, permisosFiltrados]);

  function alternar(permisoId: string) {
    setMarcados((previo) =>
      previo.includes(permisoId) ? previo.filter((x) => x !== permisoId) : [...previo, permisoId],
    );
  }

  function marcarTodos() {
    setMarcados(permisos.map((p) => p.permisoId));
  }

  function desmarcarTodos() {
    setMarcados([]);
  }

  function aplicarPlantillaRecomendada() {
    if (!rolActual) return;
    const codigosRecomendados = PLANTILLAS_INSTITUCIONALES[rolActual.codigo];
    if (!codigosRecomendados) {
      setError(`No existe plantilla estándar configurada para el rol ${rolActual.codigo}.`);
      return;
    }
    const idsRecomendados = permisos
      .filter((p) => codigosRecomendados.includes(p.codigo))
      .map((p) => p.permisoId);
    setMarcados(idsRecomendados);
    setMensaje(
      `Plantilla institucional aplicada para el rol "${rolActual.nombre}" (${idsRecomendados.length} permisos seleccionados). Haga clic en "Guardar permisos" para persistir los cambios.`,
    );
    setError("");
  }

  function alternarGrupo(items: PermisoDirectorio[]) {
    const idsGrupo = items.map((i) => i.permisoId);
    const todosMarcados = idsGrupo.every((id) => marcados.includes(id));
    if (todosMarcados) {
      setMarcados((prev) => prev.filter((id) => !idsGrupo.includes(id)));
    } else {
      setMarcados((prev) => [...new Set([...prev, ...idsGrupo])]);
    }
  }

  async function guardarPermisos() {
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const ids = await guardarPermisosDeRol(rolSel, marcados);
      setMarcados(ids);
      setRoles(await listarRolesDirectorio());
      setMensaje("Permisos guardados y sincronizados exitosamente en la base de datos.");
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
      setMensaje("Datos descriptivos del rol actualizados exitosamente.");
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <AdminPageHeader
        title="Roles y permisos"
        description="Gestión integral de control de acceso basado en roles (RBAC) y asignación normativa de facultades institucionales."
      />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div role="alert" className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}
        {mensaje && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span>{mensaje}</span>
          </div>
        )}
        {cargando && <p className="mb-4 text-sm text-slate-500">Cargando directorio de permisos y roles...</p>}

        <div className="grid gap-6 lg:grid-cols-[330px_1fr]">
          {/* Columna Izquierda: Directorio de Roles */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-700" />
                  <h2 className="text-base font-bold text-slate-800">Roles del sistema</h2>
                </div>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  {roles.length} Roles
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                {roles.map((r) => {
                  const esActivo = rolSel === r.rolId;
                  return (
                    <button
                      key={r.rolId}
                      type="button"
                      onClick={() => {
                        setRolSel(r.rolId);
                        setMensaje("");
                        setError("");
                      }}
                      className={`w-full rounded-xl border p-3.5 text-left transition-all ${
                        esActivo
                          ? "border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-500"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-semibold text-sm ${esActivo ? "text-blue-900" : "text-slate-800"}`}>
                          {r.nombre}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            esActivo
                              ? "bg-blue-200 text-blue-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.totalPermisos ?? 0}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span className="font-mono text-[11px] text-slate-600 font-medium">{r.codigo}</span>
                        <span>{r.vigente ? "Vigente" : "Inactivo"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Normativa Institucional:</p>
                <p className="leading-relaxed">
                  Los 6 roles canónicos rigen las facultades funcionales de acuerdo al Modelo de Gestión Documental (MGD) y LPAG Ley 27444.
                </p>
              </div>
            </div>
          </aside>

          {/* Columna Derecha: Configuración y Asignación de Permisos */}
          <div className="space-y-6">
            {/* Ficha descriptiva del Rol */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-blue-700 px-2 py-0.5 text-xs font-bold text-white tracking-wide">
                    {rolActual?.codigo ?? "-"}
                  </span>
                  <h3 className="text-base font-bold text-slate-800">
                    Propiedades del Rol
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Permisos concedidos:</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                    {marcados.length} de {permisos.length}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Nombre descriptivo
                  <input
                    className={`${CLASE_INPUT} mt-1`}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Mesa de Partes"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Descripción institucional
                  <input
                    className={`${CLASE_INPUT} mt-1`}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Facultades y alcance del rol..."
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={guardando || !rolSel}
                  onClick={() => void guardarDatos()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 disabled:opacity-60"
                >
                  Guardar datos del rol
                </button>
              </div>
            </section>

            {/* Matriz de Permisos por Categorías */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Barra superior de herramientas y filtros */}
              <div className="border-b border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      Matriz de Concesión de Permisos
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Active o desactive las facultades requeridas para el rol seleccionado en la base de datos.
                    </p>
                  </div>

                  {/* Botón de Plantilla Institucional Recomendada */}
                  <button
                    type="button"
                    onClick={aplicarPlantillaRecomendada}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-sm"
                    title="Cargar la configuración oficial recomendada para este rol"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    Cargar plantilla recomendada
                  </button>
                </div>

                {/* Filtros rápidos y acciones masivas */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Buscador */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="search"
                        placeholder="Buscar por código o nombre..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="h-8.5 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 w-56 sm:w-64"
                      />
                    </div>

                    {/* Selector de Ámbito */}
                    <div className="flex items-center gap-1">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 ml-1" />
                      <select
                        value={filtroAmbito}
                        onChange={(e) => setFiltroAmbito(e.target.value as "" | "GLOBAL" | "AREA")}
                        className="h-8.5 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="">Todos los ámbitos</option>
                        <option value="GLOBAL">Ámbito GLOBAL</option>
                        <option value="AREA">Ámbito ÁREA</option>
                      </select>
                    </div>
                  </div>

                  {/* Acciones de marcado masivo */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={marcarTodos}
                      className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                    >
                      <CheckSquare className="h-3.5 w-3.5 text-slate-600" />
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={desmarcarTodos}
                      className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                    >
                      <Square className="h-3.5 w-3.5 text-slate-600" />
                      Ninguno
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de Categorías y Permisos */}
              <div className="divide-y divide-slate-200">
                {gruposCategorias.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Info className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-sm font-medium">No se encontraron permisos coincidentes con los filtros.</p>
                  </div>
                ) : (
                  gruposCategorias.map((cat) => {
                    const marcadosEnGrupo = cat.items.filter((i) => marcados.includes(i.permisoId)).length;
                    const todosMarcados = cat.items.length > 0 && marcadosEnGrupo === cat.items.length;

                    return (
                      <div key={cat.id} className="p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base">{cat.icono}</span>
                              <h4 className="font-bold text-sm text-slate-800">{cat.nombre}</h4>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {marcadosEnGrupo} de {cat.items.length} activos
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 pl-6">
                              {cat.descripcion}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => alternarGrupo(cat.items)}
                            className="text-xs font-medium text-blue-700 hover:text-blue-900 transition underline underline-offset-2"
                          >
                            {todosMarcados ? "Desmarcar bloque" : "Marcar bloque"}
                          </button>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {cat.items.map((p) => {
                            const isChecked = marcados.includes(p.permisoId);
                            const esGlobal = p.ambito === "GLOBAL";

                            return (
                              <label
                                key={p.permisoId}
                                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
                                  isChecked
                                    ? "border-blue-300 bg-blue-50/40"
                                    : "border-slate-200 bg-white hover:bg-slate-50/60"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => alternar(p.permisoId)}
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-bold text-slate-800 truncate">
                                      {p.nombre}
                                    </span>
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider ${
                                        esGlobal
                                          ? "bg-sky-100 text-sky-800"
                                          : "bg-amber-100 text-amber-800"
                                      }`}
                                      title={esGlobal ? "Alcance en toda la institución" : "Alcance restringido a su unidad orgánica"}
                                    >
                                      {p.ambito}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 font-mono text-[11px] text-slate-500 truncate">
                                    {p.codigo}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Botonera de Guardado */}
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{marcados.length}</span> permisos concedidos al rol <span className="font-semibold text-slate-700">{rolActual?.nombre}</span>.
                </div>
                <button
                  type="button"
                  disabled={guardando || !rolSel}
                  onClick={() => void guardarPermisos()}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 transition"
                >
                  {guardando ? (
                    <>
                      <RotateCcw className="h-4 w-4 animate-spin" />
                      Guardando permisos...
                    </>
                  ) : (
                    "Guardar permisos"
                  )}
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
