import { useMemo, useState, useEffect } from "react";
import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import { useRbacConfig, resolverModulo, resolverDescripcion } from "../../hooks/useRbacConfig";

const MODULOS_ORDENADOS = [
  "Administración",
  "Trámite Documentario y RutaDoc",
  "Mesa de Partes",
  "Gestión Documentaria",
  "Tesorería",
  "Reportes",
] as const;

export default function RolesPermisosPage() {
  const {
    roles,
    catalogoPermisos,
    rolSeleccionado,
    setRolSeleccionado,
    rolActual,
    permisosSeleccionados,
    alternarPermiso,
    guardarPermisos,
    descartarCambios,
    hayCambios,
    mensaje,
    setMensaje,
    error,
    cargando,
    guardando,
    recargar,
  } = useRbacConfig();

  // Búsqueda reactiva de roles
  const [busquedaRol, setBusquedaRol] = useState<string>("");

  // Estado interactivo de acordeones por módulo (anulaciones manuales)
  const [modulosAlternados, setModulosAlternados] = useState<Record<string, boolean>>({});

  // Resetear estados manuales al cambiar de rol
  useEffect(() => {
    setModulosAlternados({});
  }, [rolSeleccionado]);

  const esCiudadano = rolActual?.codigo === "CIUDADANO";

  // Enriquecer permisos con modulo y descripción normalizados
  const permisosConMetadatos = useMemo(() => {
    return catalogoPermisos.map(p => ({
      ...p,
      modulo: resolverModulo(p),
      descripcion: resolverDescripcion(p),
    }));
  }, [catalogoPermisos]);

  // Agrupar permisos por módulo oficial
  const permisosPorModulo = useMemo(() => {
    const grupos: Record<string, typeof permisosConMetadatos> = {};
    for (const mod of MODULOS_ORDENADOS) {
      grupos[mod] = [];
    }
    for (const p of permisosConMetadatos) {
      const mod = p.modulo;
      if (!grupos[mod]) {
        grupos[mod] = [];
      }
      grupos[mod].push(p);
    }
    return grupos;
  }, [permisosConMetadatos]);

  // Determinar síncronamente si cada módulo está abierto
  const estaModuloAbierto = (modulo: string): boolean => {
    if (modulosAlternados[modulo] !== undefined) {
      return modulosAlternados[modulo];
    }
    const permisosMod = permisosPorModulo[modulo] ?? [];
    return permisosMod.some(
      p => (rolActual?.permisos ?? []).includes(p.codigo) || permisosSeleccionados.includes(p.id)
    );
  };

  // Alternar acordeón individual
  const alternarModulo = (modulo: string) => {
    const estadoActual = estaModuloAbierto(modulo);
    setModulosAlternados(prev => ({
      ...prev,
      [modulo]: !estadoActual,
    }));
  };

  // Alternar todos los módulos
  const todosAbiertos = MODULOS_ORDENADOS.every(m => estaModuloAbierto(m));
  const alternarTodosLosModulos = () => {
    const nuevoValor = !todosAbiertos;
    const nuevoEstado: Record<string, boolean> = {};
    for (const mod of MODULOS_ORDENADOS) {
      nuevoEstado[mod] = nuevoValor;
    }
    setModulosAlternados(nuevoEstado);
  };

  // Filtrado de roles por búsqueda
  const rolesFiltrados = useMemo(() => {
    const q = busquedaRol.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      r =>
        r.nombre.toLowerCase().includes(q) ||
        r.codigo.toLowerCase().includes(q) ||
        (r.descripcion && r.descripcion.toLowerCase().includes(q))
    );
  }, [roles, busquedaRol]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900" aria-busy={cargando || guardando}>
      <AdminPageHeader
        title="Roles y Permisos"
        description="Control de acceso por rol y alcance institucional del IESTP Público «Suiza»."
      />

      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {cargando && (
          <div className="mb-4 rounded-lg bg-blue-50 p-4 text-blue-800 border border-blue-200 flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <p role="status" className="text-sm font-medium">Consultando roles y permisos institucionales…</p>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-red-800 border border-red-200 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="text-base font-bold text-red-600">⚠</span>
                <div>
                  <p className="font-semibold text-sm">{error}</p>
                  <p className="text-xs text-red-700 mt-0.5">Verifique la conectividad con el servidor o consulte el registro de auditoría.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void recargar()}
                disabled={guardando}
                className="text-xs font-semibold text-red-700 underline hover:text-red-900 whitespace-nowrap"
              >
                Volver a consultar
              </button>
            </div>
          </div>
        )}

        {mensaje && (
          <div role="status" className="mb-4 rounded-lg bg-emerald-50 p-4 text-emerald-800 border border-emerald-200 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base text-emerald-600 font-bold">✓</span>
              <p className="text-sm font-medium">{mensaje}</p>
            </div>
            <button
              type="button"
              onClick={() => setMensaje("")}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-bold px-2 py-0.5 rounded"
            >
              Cerrar
            </button>
          </div>
        )}

        {!cargando && !error && roles.length === 0 && (
          <p className="p-6 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
            No hay roles institucionales disponibles en el sistema.
          </p>
        )}

        {/* Distribución general de 2 columnas con altura común compartida en escritorio */}
        <div className="grid gap-6 lg:grid-cols-[330px_1fr] items-stretch lg:h-[calc(100vh-210px)] lg:min-h-[580px]">
          
          {/* PANEL IZQUIERDO — CATÁLOGO DE ROLES INSTITUCIONALES (30%) */}
          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-900">Roles del sistema</h2>
                <p className="text-xs text-slate-500">{roles.length} perfiles institucionales</p>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                RBAC Oficial
              </span>
            </div>

            {/* Buscador de roles */}
            <div className="mt-3 mb-2 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar rol por nombre o código…"
                  value={busquedaRol}
                  onChange={e => setBusquedaRol(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
                />
                <svg
                  className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {busquedaRol && (
                  <button
                    type="button"
                    onClick={() => setBusquedaRol("")}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>
              {busquedaRol && (
                <p className="mt-1 text-[11px] text-slate-500 px-0.5">
                  {rolesFiltrados.length} de {roles.length} roles encontrados
                </p>
              )}
            </div>

            {/* Lista compacta de roles con scroll vertical independiente que ocupa la altura completa */}
            <div className="mt-2 space-y-2 flex-1 min-h-0 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
              {rolesFiltrados.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                  No se encontraron roles coincidentes.
                </p>
              ) : (
                rolesFiltrados.map(rol => {
                  const rolEsCiudadano = rol.codigo === "CIUDADANO";
                  const seleccionado = rolSeleccionado === rol.id;

                  return (
                    <button
                      key={rol.id}
                      type="button"
                      disabled={guardando}
                      aria-pressed={seleccionado}
                      onClick={() => {
                        setRolSeleccionado(rol.id);
                        setMensaje("");
                      }}
                      className={
                        "w-full rounded-lg border p-3 text-left transition-all " +
                        (seleccionado
                          ? "border-blue-600 bg-blue-50/80 shadow-xs ring-1 ring-blue-600"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80")
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{rol.nombre}</p>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">{rol.codigo}</p>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1">
                          {rolEsCiudadano ? (
                            <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                              EXTERNO
                            </span>
                          ) : !rol.vigente ? (
                            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                              INACTIVO
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                              INTERNO
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{rol.usuarios} cuentas vigentes</span>
                        {rolEsCiudadano && (
                          <span className="text-[10px] font-medium text-amber-700">
                            Solo lectura · Inmutable
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* PANEL DERECHO — CONFIGURACIÓN DEL ROL Y MATRIZ DE PERMISOS (70%) */}
          {rolActual ? (
            <div className="space-y-4 flex flex-col h-full min-h-0">
              
              {/* Encabezado compacto del rol seleccionado */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-slate-900">{rolActual.nombre}</h2>
                      {esCiudadano ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                          ROL EXTERNO · SOLO LECTURA
                        </span>
                      ) : rolActual.codigo === "ADMINISTRADOR" ? (
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
                          PERFIL MAESTRO
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                          PERFIL INSTITUCIONAL
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-mono text-slate-500">
                      Código canónico: {rolActual.codigo} · {rolActual.usuarios} cuentas institucionales asignadas
                    </p>
                  </div>
                </div>

                {rolActual.descripcion && (
                  <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">{rolActual.descripcion}</p>
                )}

                {/* Banners reglamentarios de protección RBAC */}
                {esCiudadano ? (
                  <div className="mt-3 rounded-lg bg-amber-50 p-3.5 border border-amber-200 text-xs text-amber-900">
                    <div className="flex items-start gap-2">
                      <span className="text-base font-bold shrink-0">🛡</span>
                      <div>
                        <p className="font-semibold text-amber-950">Rol de Servicios Externos — Solo Lectura</p>
                        <p className="mt-0.5 text-amber-800 leading-relaxed">
                          Este perfil corresponde a los administrados externos (ciudadanos) que interactúan con el SIGD mediante la Mesa de Partes Virtual y la Casilla Electrónica. Sus permisos son inmutables para garantizar la seguridad del sistema y prevenir la asignación accidental de atribuciones institucionales.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : rolActual.codigo === "ADMINISTRADOR" ? (
                  <div className="mt-3 rounded-lg bg-blue-50 p-3.5 border border-blue-200 text-xs text-blue-900">
                    <div className="flex items-start gap-2">
                      <span className="text-base font-bold shrink-0">🔒</span>
                      <div>
                        <p className="font-semibold text-blue-950">Protección contra Autobloqueo</p>
                        <p className="mt-0.5 text-blue-800 leading-relaxed">
                          El permiso <code className="font-mono font-bold text-blue-900">ADMIN_USUARIOS</code> es obligatorio e inmutable para el Administrador a fin de garantizar el acceso ininterrumpido a la administración del sistema.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              {/* Barra de Acciones Sticky con Detección de Cambios */}
              <div className="sticky top-2 z-10 rounded-xl border border-slate-200 bg-white/95 backdrop-blur p-3 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  {esCiudadano ? (
                    <span className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      Facultades administradas externamente (Solo Lectura)
                    </span>
                  ) : hayCambios ? (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Modificaciones pendientes de guardar
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      {permisosSeleccionados.length} de {catalogoPermisos.length} permisos asignados · Sincronizado
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end">
                  {/* Botón Descartar cambios */}
                  {!esCiudadano && (
                    <button
                      type="button"
                      disabled={!hayCambios || guardando}
                      onClick={() => descartarCambios()}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title={hayCambios ? "Revertir cambios a la última configuración guardada" : "No hay modificaciones pendientes"}
                    >
                      Descartar cambios
                    </button>
                  )}

                  {/* Botón Guardar permisos */}
                  <button
                    type="button"
                    disabled={
                      guardando ||
                      cargando ||
                      !rolActual.vigente ||
                      esCiudadano ||
                      catalogoPermisos.length === 0
                    }
                    onClick={() => void guardarPermisos()}
                    className={
                      "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-xs flex items-center gap-1.5 " +
                      (esCiudadano
                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                        : hayCambios
                        ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                        : "bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50")
                    }
                  >
                    {guardando && (
                      <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                    )}
                    <span>
                      {guardando
                        ? "Guardando…"
                        : esCiudadano
                        ? "Rol de solo lectura"
                        : "Guardar permisos"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Contenedor de Permisos Agrupados por Módulos (Acordeones Independientes con Scroll Propio) */}
              <section className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/70 shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Matriz de Permisos por Módulo</h3>
                    <p className="text-xs text-slate-500">
                      Organización funcional de los 6 módulos institucionales del SIGD
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={alternarTodosLosModulos}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
                  >
                    {todosAbiertos ? "Contraer todos" : "Expandir todos"}
                  </button>
                </div>

                {catalogoPermisos.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">El catálogo institucional no contiene permisos.</p>
                ) : (
                  <div className="divide-y divide-slate-200 flex-1 min-h-0 lg:overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                    {MODULOS_ORDENADOS.map(modulo => {
                      const permisosModulo = permisosPorModulo[modulo] ?? [];
                      if (permisosModulo.length === 0) return null;
                      const asignadosModulo = permisosModulo.filter(p => permisosSeleccionados.includes(p.id)).length;
                      const abierto = estaModuloAbierto(modulo);

                      return (
                        <div key={modulo} className="transition-colors">
                          {/* Cabecera del Acordeón */}
                          <button
                            type="button"
                            onClick={() => alternarModulo(modulo)}
                            aria-expanded={abierto}
                            className="w-full flex items-center justify-between px-5 py-3 text-left bg-white hover:bg-slate-50/80 transition-colors focus:outline-none"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={
                                  "inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-slate-500 transition-transform " +
                                  (abierto ? "rotate-90 text-blue-600" : "")
                                }
                              >
                                ▶
                              </span>
                              <span className="text-sm font-bold text-slate-900">{modulo}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold border " +
                                  (asignadosModulo > 0
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200")
                                }
                              >
                                {asignadosModulo} de {permisosModulo.length} asignados
                              </span>
                            </div>
                          </button>

                          {/* Contenido Desplegable: Tabla de Permisos */}
                          <div className={abierto ? "border-t border-slate-100 bg-slate-50/30 px-5 py-3" : "hidden"}>
                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                                    <th className="p-2.5 w-[28%]">Permiso / Código</th>
                                    <th className="p-2.5 w-[44%]">Acción / Descripción</th>
                                    <th className="p-2.5 w-[16%]">Ámbito</th>
                                    <th className="p-2.5 w-[12%] text-center">Asignado</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {permisosModulo.map(permiso => {
                                    const esAdminBloqueado =
                                      rolActual.codigo === "ADMINISTRADOR" && permiso.codigo === "ADMIN_USUARIOS";
                                    const disabled =
                                      guardando || !rolActual.vigente || esCiudadano || esAdminBloqueado;
                                    const marcado = permisosSeleccionados.includes(permiso.id);

                                    return (
                                      <tr
                                        key={permiso.id}
                                        className={
                                          "transition-colors " +
                                          (marcado ? "bg-blue-50/20 hover:bg-blue-50/40" : "hover:bg-slate-50/80")
                                        }
                                      >
                                        <td className="p-2.5 align-top">
                                          <span className="font-semibold text-slate-900 block leading-snug">
                                            {permiso.nombre}
                                          </span>
                                          <span className="font-mono text-[11px] text-slate-500 block mt-0.5">
                                            {permiso.codigo}
                                          </span>
                                        </td>
                                        <td className="p-2.5 align-top text-slate-600 leading-relaxed">
                                          {permiso.descripcion}
                                        </td>
                                        <td className="p-2.5 align-top">
                                          <span
                                            className={
                                              "inline-flex rounded px-2 py-0.5 text-[10px] font-semibold border " +
                                              (permiso.ambito === "AREA"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : "bg-purple-50 text-purple-700 border-purple-200")
                                            }
                                          >
                                            {permiso.ambito}
                                          </span>
                                        </td>
                                        <td className="p-2.5 align-top text-center">
                                          <input
                                            type="checkbox"
                                            aria-label={permiso.codigo + " / " + permiso.ambito}
                                            checked={marcado}
                                            disabled={disabled}
                                            onChange={() => alternarPermiso(permiso.id)}
                                            title={
                                              esCiudadano
                                                ? "Los permisos del rol Ciudadano son inmutables"
                                                : esAdminBloqueado
                                                ? "ADMIN_USUARIOS es obligatorio para el rol Administrador"
                                                : undefined
                                            }
                                            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pie de Panel Informativo de Auditoría */}
                <div className="border-t border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
                  <span>
                    {esCiudadano
                      ? "Las facultades de este rol externo son gestionadas internamente por el sistema y no admiten cambios."
                      : "Toda modificación quedará registrada de forma inmutable en la bitácora de auditoría WORM."}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    IESTP Suiza · SGID RBAC 2026
                  </span>
                </div>
              </section>

            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">
              Seleccione un rol institucional para visualizar y configurar sus permisos.
            </div>
          )}

        </div>
      </section>
    </main>
  );
}
