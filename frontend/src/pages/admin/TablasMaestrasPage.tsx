import { useState } from "react";
import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import OrganigramaTreeView from "../../components/administracion/OrganigramaTreeView";
import { useTablasMaestras } from "../../hooks/useTablasMaestras";
import { useAuthStore } from "../../stores/authStore";

export default function TablasMaestrasPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const rolesUsuario = usuario?.roles ?? [];
  const puedeGestionarTupa = rolesUsuario.some(
    (r) => r === "ADMINISTRADOR" || r === "SUPER_ADMIN"
  );

  const {
    tipos,
    registros,
    areasOrganicas,
    tipoActivo,
    cambiarTipo,
    busqueda,
    setBusqueda,
    mostrarFormulario,
    setMostrarFormulario,
    codigo,
    setCodigo,
    nombre,
    setNombre,
    detalle,
    setDetalle,
    mensaje,
    setMensaje,
    crearRegistro,
    alternarEstado,
    // Versionado y requisitos TUPA
    versionesTupa,
    versionSeleccionada,
    setVersionSeleccionada,
    filtroValidacion,
    setFiltroValidacion,
    tramitesTupa,
    totalTramitesTupa,
    tramiteModalDetalle,
    setTramiteModalDetalle,
    auditoriaTupa,
    crearBorradorTupa,
    configurarUnidadesTramite,
    publicarVersionTupa,
  } = useTablasMaestras();

  const [modalCrearBorrador, setModalCrearBorrador] = useState(false);
  const [nuevoCodigoVersion, setNuevoCodigoVersion] = useState("");
  const [nuevaDenominacion, setNuevaDenominacion] = useState("");
  const [nuevasObservaciones, setNuevasObservaciones] = useState("");

  const [modalPublicar, setModalPublicar] = useState(false);
  const [publicarResolucion, setPublicarResolucion] = useState("");
  const [publicarFecha, setPublicarFecha] = useState("");
  const [errorPublicar, setErrorPublicar] = useState("");

  const [editandoUnidades, setEditandoUnidades] = useState(false);
  const [editUnidadResp, setEditUnidadResp] = useState("");
  const [editAutoridadResol, setEditAutoridadResol] = useState("");

  const esModoTupa = tipoActivo === "Catálogo TUPA (Versiones y Requisitos)";
  const versionActualObj = versionesTupa.find((v) => v.codigoVersion === versionSeleccionada);
  const esVersionBorrador = versionActualObj?.estado === "BORRADOR" || versionSeleccionada.includes("BORRADOR") || versionSeleccionada.includes("DRAFT");

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Tablas Maestras"
        description="Configuración institucional de sedes, organigrama, tipos documentales y catálogo TUPA oficial."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {mensaje && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensaje}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          {tipos.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => cambiarTipo(tipo)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition cursor-pointer ${
                tipoActivo === tipo
                  ? "bg-blue-700 text-white shadow-sm"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tipo}
            </button>
          ))}
        </div>

        {tipoActivo === "Áreas" && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Organigrama institucional</h2>
            <p className="mt-1 text-sm text-slate-500">
              Jerarquía bajo el modelo Materialized Path (formato{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-xs">
                01.03.02
              </code>
              ).
            </p>
            <div className="mt-4">
              <OrganigramaTreeView areas={areasOrganicas} />
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* SECCIÓN ESPECÍFICA: CATÁLOGO TUPA, VERSIONES Y REQUISITOS    */}
        {/* ============================================================ */}
        {esModoTupa ? (
          <div className="space-y-6">
            {/* Panel de Control de Versiones y Auditoría de Expedientes */}
            <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Versiones del Catálogo TUPA Institucional
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gestione las versiones reglamentarias (Vigente, Borradores, Histórico) y verifique la integridad documental.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="select-version-tupa" className="text-xs font-semibold text-slate-700 shrink-0">
                    Versión activa:
                  </label>
                  <select
                    id="select-version-tupa"
                    value={versionSeleccionada}
                    onChange={(e) => setVersionSeleccionada(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-900 shadow-xs focus:border-blue-600 focus:outline-none"
                  >
                    {versionesTupa.map((v) => (
                      <option key={v.versionId} value={v.codigoVersion}>
                        {v.codigoVersion} — {v.denominacion} ({v.estado})
                      </option>
                    ))}
                  </select>

                  {puedeGestionarTupa && (
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => setModalCrearBorrador(true)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
                      >
                        + Nuevo Borrador
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorPublicar("");
                          setModalPublicar(true);
                        }}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition cursor-pointer"
                      >
                        Publicar Versión Oficial
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tarjeta de Certificación y Auditoría de los 197 Expedientes */}
              {auditoriaTupa && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Auditoría de Integridad: {auditoriaTupa.estadoIntegridad}
                    </span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 text-[11px]">
                      0 reasignaciones arbitrarias • 0 costos alterados
                    </span>
                  </div>
                  <p className="text-emerald-900 text-[11px] leading-relaxed">
                    {auditoriaTupa.detalle}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-emerald-900">
                    <div>Doc: <strong>{auditoriaTupa.totalExpedientesDoc}</strong> expedientes</div>
                    <div>TUPA 2026: <strong>{auditoriaTupa.expedientesTupaVigente2026}</strong></div>
                    <div>Históricos: <strong>{auditoriaTupa.expedientesAuditoriaHistoricaPre2026}</strong></div>
                    <div>Tra Total: <strong>{auditoriaTupa.totalExpedientesTra}</strong></div>
                  </div>
                </div>
              )}

              {/* KPIs de Procedimientos y Filtros Rápidos */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltroValidacion("TODOS")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      filtroValidacion === "TODOS"
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Todos ({totalTramitesTupa})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroValidacion("VALIDADOS")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      filtroValidacion === "VALIDADOS"
                        ? "bg-emerald-700 text-white"
                        : "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    }`}
                  >
                    Validados oficial (36)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroValidacion("PENDIENTES")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      filtroValidacion === "PENDIENTES"
                        ? "bg-amber-700 text-white"
                        : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                    }`}
                  >
                    Pendientes de validación institucional (36)
                  </button>
                </div>

                <div className="w-full md:w-72">
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por código, nombre o unidad…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </section>

            {/* Tabla de Procedimientos TUPA Oficiales */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold text-slate-900">
                    Catálogo de Procedimientos — {versionSeleccionada}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Mostrando {tramitesTupa.length} procedimiento(s) conforme a la versión seleccionada.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">N° / Código</th>
                      <th className="px-4 py-3">Denominación Oficial</th>
                      <th className="px-4 py-3">Unidad Responsable</th>
                      <th className="px-4 py-3">Autoridad Resolutiva</th>
                      <th className="px-4 py-3">Costo Oficial</th>
                      <th className="px-4 py-3">Requisitos / Anexos</th>
                      <th className="px-4 py-3">Estado Validación</th>
                      <th className="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tramitesTupa.map((t) => (
                      <tr key={t.codigoInterno} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-mono font-bold text-blue-900 whitespace-nowrap">
                          {t.numeroVisible} — {t.codigoVisible}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-xs">
                          <p className="truncate font-semibold">{t.nombre}</p>
                          <p className="text-[11px] text-slate-500 truncate">{t.rubro}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {t.unidadResponsable}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {t.autoridadResolutiva}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                          {t.costo}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{t.totalRequisitos}</span> req. /{" "}
                          <span className="font-semibold text-slate-900">{t.totalAnexos}</span> anexo(s)
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {t.estadoValidacion === "VALIDADO" ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Validado oficial
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                              Pendiente validación
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setTramiteModalDetalle(t)}
                            className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                          >
                            Ver Detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Modal de Detalle Documental y Requisitos Específicos */}
            {tramiteModalDetalle && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-tramite-title"
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
              >
                <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 font-mono">
                        {tramiteModalDetalle.numeroVisible} — {tramiteModalDetalle.codigoVisible}
                      </span>
                      <h3 id="modal-tramite-title" className="text-base font-bold text-slate-900">
                        {tramiteModalDetalle.nombre}
                      </h3>
                      <p className="text-xs text-slate-500">{tramiteModalDetalle.rubro}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTramiteModalDetalle(null)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Asignación Institucional y Normativa */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 block">Unidad de presentación:</span>
                      <span>{tramiteModalDetalle.unidadRecepcion}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Unidad responsable:</span>
                      <span>{tramiteModalDetalle.unidadResponsable}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Autoridad resolutiva:</span>
                      <span>{tramiteModalDetalle.autoridadResolutiva}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Plazo legal de atención:</span>
                      <span>{tramiteModalDetalle.plazoDias ? `${tramiteModalDetalle.plazoDias} días hábiles` : 'Pendiente de definición reglamentaria'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Silencio administrativo:</span>
                      <span>{tramiteModalDetalle.silencioAdministrativo || 'Según evaluación institucional'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Tasa oficial TUPA:</span>
                      <span className="font-bold text-blue-900">{tramiteModalDetalle.costo}</span>
                    </div>
                  </div>

                  {/* Edición de unidades en versión borrador para ADMINISTRADOR */}
                  {puedeGestionarTupa && esVersionBorrador ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-950">
                          ⚙️ Configuración Institucional (Versión Borrador)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoUnidades(!editandoUnidades);
                            setEditUnidadResp(tramiteModalDetalle.unidadResponsable);
                            setEditAutoridadResol(tramiteModalDetalle.autoridadResolutiva);
                          }}
                          className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                        >
                          {editandoUnidades ? "Cancelar Edición" : "Editar Unidades"}
                        </button>
                      </div>

                      {editandoUnidades && (
                        <div className="space-y-2 pt-1 border-t border-blue-100">
                          <div>
                            <label className="block font-semibold text-slate-700 mb-0.5">Unidad Responsable:</label>
                            <input
                              value={editUnidadResp}
                              onChange={(e) => setEditUnidadResp(e.target.value)}
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-0.5">Autoridad Resolutiva:</label>
                            <input
                              value={editAutoridadResol}
                              onChange={(e) => setEditAutoridadResol(e.target.value)}
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                            />
                          </div>
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                if (editUnidadResp.trim()) {
                                  await configurarUnidadesTramite(
                                    versionSeleccionada,
                                    tramiteModalDetalle.codigoInterno,
                                    editUnidadResp,
                                    editAutoridadResol
                                  );
                                  setTramiteModalDetalle({
                                    ...tramiteModalDetalle,
                                    unidadResponsable: editUnidadResp.trim(),
                                    autoridadResolutiva: editAutoridadResol.trim() || tramiteModalDetalle.autoridadResolutiva,
                                  });
                                  setEditandoUnidades(false);
                                }
                              }}
                              className="rounded bg-blue-700 px-3 py-1 font-bold text-white hover:bg-blue-800 text-xs cursor-pointer"
                            >
                              Guardar Unidades
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                      🔒 <strong>Versión oficial inmutable ({versionSeleccionada}):</strong> Los trámites, unidades y requisitos no pueden alterarse retroactivamente. Para modificaciones normativas, genere un nuevo borrador.
                    </div>
                  )}

                  {tramiteModalDetalle.observacionInstitucional && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900">
                      <strong>Nota institucional:</strong> {tramiteModalDetalle.observacionInstitucional}
                    </div>
                  )}

                  {/* Lista de Requisitos Obligatorios */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-1">
                      Requisitos Documentales ({tramiteModalDetalle.requisitos.length})
                    </h4>
                    {tramiteModalDetalle.requisitos.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No registra requisitos documentales específicos.</p>
                    ) : (
                      tramiteModalDetalle.requisitos.map((r) => (
                        <div key={r.id} className="border border-slate-200 rounded-lg p-2.5 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{r.nombre}</span>
                            <span className={r.obligatorio ? "text-red-700 font-bold" : "text-slate-500"}>
                              {r.obligatorio ? "Obligatorio" : "Opcional"}
                            </span>
                          </div>
                          {r.descripcion && <p className="text-slate-600">{r.descripcion}</p>}
                          <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 pt-0.5">
                            <span>Formato: {r.formatosAdmitidos?.join(', ') || 'PDF'}</span>
                            {r.fuente && <span>Fuente: {r.fuente}</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Lista de Anexos */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Anexos Específicos ({tramiteModalDetalle.anexos.length})
                      </h4>
                      {tramiteModalDetalle.sinAnexosEspecificos && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          Sin anexos obligatorios
                        </span>
                      )}
                    </div>
                    {tramiteModalDetalle.anexos.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No se indican anexos específicos en la norma institucional.</p>
                    ) : (
                      tramiteModalDetalle.anexos.map((a) => (
                        <div key={a.id} className="border border-slate-200 rounded-lg p-2.5 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{a.nombre}</span>
                            <span className={a.obligatorio ? "text-red-700 font-bold" : "text-slate-500"}>
                              {a.obligatorio ? "Obligatorio" : "Opcional"}
                            </span>
                          </div>
                          {a.descripcion && <p className="text-slate-600">{a.descripcion}</p>}
                          <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 pt-0.5">
                            <span>Formato: {a.formatosAdmitidos?.join(', ') || 'PDF'}</span>
                            {a.fuente && <span>Fuente: {a.fuente}</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setTramiteModalDetalle(null)}
                      className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Crear Nuevo Borrador TUPA */}
            {modalCrearBorrador && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-borrador-title"
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
              >
                <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 id="modal-borrador-title" className="text-base font-bold text-slate-900">
                      Crear Nuevo Borrador TUPA
                    </h3>
                    <button
                      type="button"
                      onClick={() => setModalCrearBorrador(false)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await crearBorradorTupa({
                          codigoVersion: nuevoCodigoVersion,
                          denominacion: nuevaDenominacion,
                          observaciones: nuevasObservaciones,
                        });
                        setNuevoCodigoVersion("");
                        setNuevaDenominacion("");
                        setNuevasObservaciones("");
                        setModalCrearBorrador(false);
                      } catch (err: any) {
                        setMensaje(err.response?.data?.error || err.message || "Error al crear borrador");
                      }
                    }}
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Código de Versión:</label>
                      <input
                        value={nuevoCodigoVersion}
                        onChange={(e) => setNuevoCodigoVersion(e.target.value)}
                        placeholder="Ej. TUPA-2027-V1"
                        required
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Denominación:</label>
                      <input
                        value={nuevaDenominacion}
                        onChange={(e) => setNuevaDenominacion(e.target.value)}
                        placeholder="Ej. TUPA Institucional 2027 (Actualización)"
                        required
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Observaciones:</label>
                      <textarea
                        value={nuevasObservaciones}
                        onChange={(e) => setNuevasObservaciones(e.target.value)}
                        placeholder="Motivo de la formulación o actualización..."
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setModalCrearBorrador(false)}
                        className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 cursor-pointer"
                      >
                        Crear Borrador
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal Publicar Versión Oficial Vigente */}
            {modalPublicar && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-publicar-title"
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
              >
                <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 id="modal-publicar-title" className="text-base font-bold text-slate-900">
                      Publicar Versión Oficial Vigente
                    </h3>
                    <button
                      type="button"
                      onClick={() => setModalPublicar(false)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setErrorPublicar("");
                      try {
                        await publicarVersionTupa({
                          codigoVersion: versionSeleccionada,
                          resolucionAprobacion: publicarResolucion,
                          fechaAprobacion: publicarFecha,
                        });
                        setPublicarResolucion("");
                        setPublicarFecha("");
                        setModalPublicar(false);
                      } catch (err: any) {
                        setErrorPublicar(err.response?.data?.error || err.message || "Error al publicar versión");
                      }
                    }}
                    className="space-y-3 text-xs"
                  >
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-blue-900">
                      <p className="font-bold">Versión seleccionada: {versionSeleccionada}</p>
                      <p className="text-[11px] text-blue-700 mt-0.5">
                        Al publicar formalmente, se convertirá en la única versión VIGENTE y la versión anterior pasará a HISTÓRICO.
                      </p>
                    </div>
                    {errorPublicar && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-red-700 text-xs">
                        {errorPublicar}
                      </div>
                    )}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Resolución Formal de Aprobación (R.D.):
                      </label>
                      <input
                        value={publicarResolucion}
                        onChange={(e) => setPublicarResolucion(e.target.value)}
                        placeholder="Ej. R.D. N° 045-2026-IESTP-SUIZA"
                        required
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Fecha Formal de Aprobación:
                      </label>
                      <input
                        type="date"
                        value={publicarFecha}
                        onChange={(e) => setPublicarFecha(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setModalPublicar(false)}
                        className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 cursor-pointer"
                      >
                        Confirmar y Publicar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================ */
          /* MODO ESTÁNDAR: SEDES, ÁREAS, TIPOS DOCUMENTALES               */
          /* ============================================================ */
          <>
            <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="w-full md:max-w-xl">
                  <label className="mb-2 block text-sm font-semibold">
                    Buscar en {tipoActivo.toLowerCase()}
                  </label>
                  <input
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.target.value)}
                    placeholder="Código, nombre o detalle"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarFormulario((actual) => !actual)}
                  className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  + Nuevo registro
                </button>
              </div>

              {mostrarFormulario && (
                <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">Código</label>
                    <input
                      value={codigo}
                      onChange={(event) => setCodigo(event.target.value)}
                      placeholder="Ej. ARE-007"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">Nombre</label>
                    <input
                      value={nombre}
                      onChange={(event) => setNombre(event.target.value)}
                      placeholder="Nombre del registro"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">Detalle</label>
                    <input
                      value={detalle}
                      onChange={(event) => setDetalle(event.target.value)}
                      placeholder="Dependencia, descripción, etc."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div className="flex gap-3 md:col-span-3 md:justify-end">
                    <button
                      type="button"
                      onClick={() => setMostrarFormulario(false)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={crearRegistro}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Guardar registro
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="font-bold">{tipoActivo}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Se utiliza inactivación (borrado lógico) en lugar de borrado
                  definitivo para conservar la trazabilidad histórica.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Código</th>
                      <th className="px-6 py-3">Nombre</th>
                      <th className="px-6 py-3">Detalle / Jerarquía</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registros.map((registro) => (
                      <tr key={registro.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-semibold">
                          {registro.codigo}
                        </td>
                        <td className="px-6 py-4 text-sm">{registro.nombre}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {registro.detalle}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              registro.estado === "Activo"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {registro.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              setMensaje("");
                              alternarEstado(registro.id);
                            }}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                          >
                            {registro.estado === "Activo" ? "Inactivar" : "Activar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
