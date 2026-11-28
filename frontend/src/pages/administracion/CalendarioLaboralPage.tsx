import { useMemo, useState } from "react";
import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import {
  type Feriado,
  type NuevoFeriadoInput,
  type TipoFeriado,
  type UnidadTerritorial,
  useCalendarioLaboral,
} from "../../hooks/useCalendarioLaboral";

export default function CalendarioLaboralPage() {
  const {
    feriados,
    todosLosDias,
    aniosDisponibles,
    anioSeleccionado,
    setAnioSeleccionado,
    cargando,
    guardando,
    error,
    mensajeExito,
    setMensajeExito,
    cargarFeriados,
    agregarFeriado,
    editarFeriado,
    eliminarFeriado,
  } = useCalendarioLaboral();

  // Estados de filtros y vistas
  const [tipoFiltro, setTipoFiltro] = useState<string>("TODOS");
  const [busqueda, setBusqueda] = useState<string>("");
  const [pestañaActiva, setPestañaActiva] = useState<"NO_LABORABLES" | "LABORABLES" | "TODOS">("NO_LABORABLES");

  // Estados de modales
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [modoEdicion, setModoEdicion] = useState<boolean>(false);
  const [feriadoSeleccionado, setFeriadoSeleccionado] = useState<Feriado | null>(null);

  // Formulario de modal
  const [formFecha, setFormFecha] = useState<string>("");
  const [formDescripcion, setFormDescripcion] = useState<string>("");
  const [formTipo, setFormTipo] = useState<TipoFeriado>("NACIONAL");
  const [formUnidad, setFormUnidad] = useState<UnidadTerritorial>("NACIONAL");
  const [formEsLaborable, setFormEsLaborable] = useState<boolean>(false);
  const [formBaseLegal, setFormBaseLegal] = useState<string>("");
  const [errorModal, setErrorModal] = useState<string>("");

  // Modal de confirmación de eliminación
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState<boolean>(false);
  const [feriadoAEliminar, setFeriadoAEliminar] = useState<Feriado | null>(null);

  // Calcular métricas
  const metricas = useMemo(() => {
    const listado = todosLosDias.length > 0 ? todosLosDias : feriados;
    return {
      totalNoLaborables: listado.filter((d) => !d.es_laborable && d.activo !== false).length,
      nacionales: listado.filter((d) => d.tipo_feriado === "NACIONAL" && !d.es_laborable).length,
      regionalesUcayali: listado.filter((d) => d.tipo_feriado === "REGIONAL_UCAYALI" && !d.es_laborable).length,
      institucionales: listado.filter((d) => (d.tipo_feriado === "INSTITUCIONAL" || d.tipo_feriado === "DUELO_NACIONAL") && !d.es_laborable).length,
      laborablesExcepcionales: listado.filter((d) => d.es_laborable && d.activo !== false).length,
    };
  }, [todosLosDias, feriados]);

  // Filtrado de elementos
  const diasFiltrados = useMemo(() => {
    let fuente: Feriado[];
    if (pestañaActiva === "NO_LABORABLES") {
      fuente = feriados.filter((d) => !d.es_laborable);
    } else if (pestañaActiva === "LABORABLES") {
      fuente = todosLosDias.filter((d) => d.es_laborable);
    } else {
      fuente = todosLosDias.length > 0 ? todosLosDias : feriados;
    }

    return fuente.filter((dia) => {
      // Filtro por tipo
      if (tipoFiltro !== "TODOS" && dia.tipo_feriado !== tipoFiltro) {
        return false;
      }
      // Filtro por búsqueda
      if (busqueda.trim() !== "") {
        const query = busqueda.toLowerCase();
        const coincideFecha = dia.fecha.toLowerCase().includes(query);
        const coincideDesc = (dia.descripcion || dia.nombre || "").toLowerCase().includes(query);
        const coincideBase = (dia.base_legal || "").toLowerCase().includes(query);
        const coincideUnidad = (dia.unidad_territorial || "").toLowerCase().includes(query);
        return coincideFecha || coincideDesc || coincideBase || coincideUnidad;
      }
      return true;
    });
  }, [feriados, todosLosDias, pestañaActiva, tipoFiltro, busqueda]);

  // Manejadores de modales
  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setFeriadoSeleccionado(null);
    setFormFecha(`${anioSeleccionado}-01-01`);
    setFormDescripcion("");
    setFormTipo("NACIONAL");
    setFormUnidad("NACIONAL");
    setFormEsLaborable(false);
    setFormBaseLegal("");
    setErrorModal("");
    setModalAbierto(true);
  };

  const abrirModalEditar = (f: Feriado) => {
    setModoEdicion(true);
    setFeriadoSeleccionado(f);
    setFormFecha(f.fecha);
    setFormDescripcion(f.descripcion || f.nombre || "");
    setFormTipo(f.tipo_feriado || "NACIONAL");
    setFormUnidad(f.unidad_territorial || "NACIONAL");
    setFormEsLaborable(Boolean(f.es_laborable));
    setFormBaseLegal(f.base_legal || "");
    setErrorModal("");
    setModalAbierto(true);
  };

  const abrirModalEliminar = (f: Feriado) => {
    setFeriadoAEliminar(f);
    setModalEliminarAbierto(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFecha || !formDescripcion.trim()) {
      setErrorModal("La fecha y la descripción son obligatorias.");
      return;
    }

    try {
      if (modoEdicion && feriadoSeleccionado) {
        const idIdentificador = feriadoSeleccionado.id_calendario || feriadoSeleccionado.id || feriadoSeleccionado.fecha;
        await editarFeriado(idIdentificador, {
          fecha: formFecha,
          descripcion: formDescripcion.trim(),
          tipo_feriado: formEsLaborable ? null : formTipo,
          unidad_territorial: formUnidad,
          es_laborable: formEsLaborable,
          base_legal: formBaseLegal.trim() || null,
        });
      } else {
        const nuevo: NuevoFeriadoInput = {
          fecha: formFecha,
          descripcion: formDescripcion.trim(),
          tipo_feriado: formEsLaborable ? null : formTipo,
          unidad_territorial: formUnidad,
          es_laborable: formEsLaborable,
          base_legal: formBaseLegal.trim() || null,
        };
        await agregarFeriado(nuevo);
      }
      setModalAbierto(false);
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : "Error al procesar la solicitud.");
    }
  };

  const handleConfirmarEliminar = async () => {
    if (!feriadoAEliminar) return;
    try {
      const idIdentificador = feriadoAEliminar.id_calendario || feriadoAEliminar.id || feriadoAEliminar.fecha;
      await eliminarFeriado(idIdentificador);
      setModalEliminarAbierto(false);
      setFeriadoAEliminar(null);
    } catch {
      // El error ya es manejado en el hook
    }
  };

  // Helper de badges
  const renderBadgeTipo = (tipo: TipoFeriado | null | undefined, esLaborable?: boolean) => {
    if (esLaborable) {
      return (
        <span className="inline-flex items-center rounded-md border border-purple-300 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
          Laborable Excepcional
        </span>
      );
    }
    switch (tipo) {
      case "NACIONAL":
        return (
          <span className="inline-flex items-center rounded-md border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
            Feriado Nacional (D.L. 713)
          </span>
        );
      case "REGIONAL_UCAYALI":
        return (
          <span className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            Regional Ucayali (Ley 29001)
          </span>
        );
      case "INSTITUCIONAL":
        return (
          <span className="inline-flex items-center rounded-md border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            Institucional (IESTP Suiza)
          </span>
        );
      case "DUELO_NACIONAL":
        return (
          <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
            Duelo Nacional
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            Feriado
          </span>
        );
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 pb-16">
      <AdminPageHeader
        title="Calendario Laboral"
        description="Feriados registrados en el calendario laboral y cómputo de plazos según LPAG Art. 143."
      />

      <section className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Banner de Marco Normativo */}
        <div
          className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 shadow-sm"
          role="region"
          aria-label="Marco normativo institucional"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  ✓
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Calendario Laboral Oficial — Instituto de Educación Superior Tecnológico Público Suiza
                </h2>
              </div>
              <p className="text-sm text-slate-600">
                Pucallpa, Coronel Portillo, Ucayali. Base Jurídica: D. Leg. N° 713, Ley N° 29001 (Feriados de Ucayali) y TUO de la Ley N° 27444 (Plazo máximo de 30 días hábiles en tramitación documentaria).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-800 shadow-sm">
                Sede Central Ucayali
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm">
                SLA LPAG Activo
              </span>
            </div>
          </div>
        </div>

        {/* Tarjetas de Métricas (KPIs) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Días No Laborables ({anioSeleccionado})
            </p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">
              {metricas.totalNoLaborables}
            </p>
            <p className="mt-1 text-xs text-slate-500">Suspenden cómputo de plazos</p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">
              Feriados Nacionales
            </p>
            <p className="mt-2 text-3xl font-extrabold text-rose-900">
              {metricas.nacionales}
            </p>
            <p className="mt-1 text-xs text-rose-600">D. Leg. N° 713 y leyes especiales</p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Feriados Ucayali
            </p>
            <p className="mt-2 text-3xl font-extrabold text-emerald-900">
              {metricas.regionalesUcayali}
            </p>
            <p className="mt-1 text-xs text-emerald-600">Ley N° 29001 (San Juan / Pucallpa)</p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Institucionales / Duelo
            </p>
            <p className="mt-2 text-3xl font-extrabold text-blue-900">
              {metricas.institucionales}
            </p>
            <p className="mt-1 text-xs text-blue-600">Aniversario IESTP Suiza</p>
          </div>
        </div>

        {/* Mensajes de notificación */}
        {mensajeExito && (
          <div
            className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900"
            role="status"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold">✓ Éxito:</span>
              <span>{mensajeExito}</span>
            </div>
            <button
              type="button"
              onClick={() => setMensajeExito("")}
              className="text-emerald-700 hover:text-emerald-900 font-bold"
              aria-label="Cerrar mensaje de éxito"
            >
              ✕
            </button>
          </div>
        )}

        {/* Barra Principal de Gestión y Filtros */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Feriados y días no laborables</h2>
              <p className="mt-1 text-sm text-slate-500">
                Administre los días no laborables, agregue excepciones extraordinarias o edite fechas según resoluciones oficiales.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Selector de Año */}
              <div className="flex items-center gap-2">
                <label htmlFor="select-anio" className="text-xs font-bold text-slate-600">
                  Año:
                </label>
                <select
                  id="select-anio"
                  value={anioSeleccionado}
                  onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {aniosDisponibles.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón Refrescar */}
              <button
                type="button"
                onClick={() => void cargarFeriados(anioSeleccionado)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                title="Recargar datos desde la base de datos"
              >
                ↻ Sincronizar
              </button>

              {/* Botón Nuevo Feriado */}
              <button
                type="button"
                onClick={abrirModalNuevo}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 shadow-sm transition"
              >
                <span>+</span> Registrar Nuevo Feriado
              </button>
            </div>
          </div>

          {/* Barra de Filtros secundarios y Pestañas */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Pestañas de Ámbito */}
            <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPestañaActiva("NO_LABORABLES")}
                className={`rounded-md px-3 py-1.5 transition ${
                  pestañaActiva === "NO_LABORABLES"
                    ? "bg-white text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Feriados y No Laborables ({metricas.totalNoLaborables})
              </button>
              <button
                type="button"
                onClick={() => setPestañaActiva("LABORABLES")}
                className={`rounded-md px-3 py-1.5 transition ${
                  pestañaActiva === "LABORABLES"
                    ? "bg-white text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Habilitaciones Laborables ({metricas.laborablesExcepcionales})
              </button>
              <button
                type="button"
                onClick={() => setPestañaActiva("TODOS")}
                className={`rounded-md px-3 py-1.5 transition ${
                  pestañaActiva === "TODOS"
                    ? "bg-white text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Todos los Registros
              </button>
            </div>

            {/* Buscador y filtro por tipo */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="TODOS">Todos los tipos</option>
                <option value="NACIONAL">Nacional (D.L. 713)</option>
                <option value="REGIONAL_UCAYALI">Regional Ucayali</option>
                <option value="INSTITUCIONAL">Institucional (IESTP Suiza)</option>
                <option value="DUELO_NACIONAL">Duelo Nacional</option>
              </select>

              <input
                type="search"
                placeholder="Buscar por nombre, fecha o base legal..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Estado de Carga */}
          {cargando ? (
            <p className="mt-5 text-sm text-slate-600" role="status">
              Cargando calendario laboral...
            </p>
          ) : error ? (
            /* Estado de Error */
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
              <p className="text-sm font-semibold text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => void cargarFeriados(anioSeleccionado)}
                className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 transition"
              >
                Reintentar
              </button>
            </div>
          ) : diasFiltrados.length === 0 ? (
            /* Estado Vacío */
            <p className="mt-5 text-sm text-slate-600">
              No hay feriados registrados en el calendario laboral.
            </p>
          ) : (
            /* Tabla Interactiva de Feriados */
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600 tracking-wider">
                  <tr>
                    <th scope="col" className="px-4 py-3.5">
                      Fecha
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Denominación / Motivo
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Tipo de Feriado
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Unidad Territorial
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Base Legal
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Régimen Cómputo
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {diasFiltrados.map((feriado) => {
                    const claveFila = feriado.id || `${feriado.fecha}-${feriado.nombre}`;
                    return (
                      <tr key={claveFila} className="hover:bg-slate-50 transition">
                        {/* Fecha */}
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-bold text-slate-900">
                          {feriado.fecha}
                        </td>

                        {/* Denominación */}
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{feriado.nombre}</p>
                          {feriado.activo === false && (
                            <span className="text-xs text-red-600 font-semibold">(Inactivo)</span>
                          )}
                        </td>

                        {/* Tipo de Feriado */}
                        <td className="whitespace-nowrap px-4 py-3">
                          {renderBadgeTipo(feriado.tipo_feriado, feriado.es_laborable)}
                        </td>

                        {/* Unidad Territorial */}
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-600">
                          {feriado.unidad_territorial || "NACIONAL"}
                        </td>

                        {/* Base Legal */}
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {feriado.base_legal || "—"}
                        </td>

                        {/* Régimen de Cómputo */}
                        <td className="whitespace-nowrap px-4 py-3 text-xs">
                          {feriado.es_laborable ? (
                            <span className="font-semibold text-emerald-700">
                              ✓ Habilita día hábil
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-800">
                              ⏸ Suspende cómputo LPAG
                            </span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => abrirModalEditar(feriado)}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                              title="Editar este feriado"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirModalEliminar(feriado)}
                              className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition shadow-sm"
                              title="Eliminar este feriado"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {/* Modal de Registro y Edición */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-titulo"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="modal-titulo" className="text-lg font-bold text-slate-900">
                {modoEdicion ? "Editar Feriado / Excepción" : "Registrar Nuevo Feriado / Excepción"}
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {errorModal && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleSubmitModal} className="space-y-4">
              {/* Fecha */}
              <div>
                <label htmlFor="modal-fecha" className="block text-xs font-bold text-slate-700 mb-1">
                  Fecha del Feriado *
                </label>
                <input
                  id="modal-fecha"
                  type="date"
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Denominación */}
              <div>
                <label htmlFor="modal-descripcion" className="block text-xs font-bold text-slate-700 mb-1">
                  Denominación / Motivo *
                </label>
                <input
                  id="modal-descripcion"
                  type="text"
                  placeholder="Ej. Aniversario de Ucayali o Festividad Institucional"
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Conmutador de Día Laborable Excepcional */}
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  id="modal-laborable"
                  type="checkbox"
                  checked={formEsLaborable}
                  onChange={(e) => setFormEsLaborable(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="modal-laborable" className="text-xs text-slate-700">
                  <span className="font-bold">Habilitación Laborable Excepcional:</span> Marcar si este día se declara laborable de forma extraordinaria a pesar de ser feriado o fin de semana.
                </label>
              </div>

              {!formEsLaborable && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tipo de Feriado */}
                  <div>
                    <label htmlFor="modal-tipo" className="block text-xs font-bold text-slate-700 mb-1">
                      Tipo de Feriado *
                    </label>
                    <select
                      id="modal-tipo"
                      value={formTipo}
                      onChange={(e) => {
                        const nuevoTipo = e.target.value as TipoFeriado;
                        setFormTipo(nuevoTipo);
                        if (nuevoTipo === "REGIONAL_UCAYALI") {
                          setFormUnidad("UCAYALI");
                          if (!formBaseLegal || formBaseLegal === "D. Leg. N° 713") {
                            setFormBaseLegal("Ley N° 29001");
                          }
                        } else if (nuevoTipo === "NACIONAL") {
                          setFormUnidad("NACIONAL");
                          if (!formBaseLegal || formBaseLegal === "Ley N° 29001") {
                            setFormBaseLegal("D. Leg. N° 713");
                          }
                        } else if (nuevoTipo === "INSTITUCIONAL") {
                          setFormUnidad("IESTP_SUIZA");
                          if (!formBaseLegal) {
                            setFormBaseLegal("Resolución Directoral IESTP Suiza");
                          }
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="NACIONAL">Nacional (D.L. 713)</option>
                      <option value="REGIONAL_UCAYALI">Regional Ucayali (Ley 29001)</option>
                      <option value="INSTITUCIONAL">Institucional (IESTP Suiza)</option>
                      <option value="DUELO_NACIONAL">Duelo Nacional</option>
                    </select>
                  </div>

                  {/* Unidad Territorial */}
                  <div>
                    <label htmlFor="modal-unidad" className="block text-xs font-bold text-slate-700 mb-1">
                      Unidad Territorial *
                    </label>
                    <select
                      id="modal-unidad"
                      value={formUnidad}
                      onChange={(e) => setFormUnidad(e.target.value as UnidadTerritorial)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="NACIONAL">NACIONAL</option>
                      <option value="UCAYALI">UCAYALI</option>
                      <option value="IESTP_SUIZA">IESTP_SUIZA</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Base Legal */}
              <div>
                <label htmlFor="modal-base-legal" className="block text-xs font-bold text-slate-700 mb-1">
                  Base Legal {formEsLaborable ? "*" : "(Opcional)"}
                </label>
                <input
                  id="modal-base-legal"
                  type="text"
                  placeholder="Ej. Ley N° 29001, D. Leg. N° 713, R.D. N° 045-2026"
                  value={formBaseLegal}
                  onChange={(e) => setFormBaseLegal(e.target.value)}
                  required={formEsLaborable}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 transition shadow disabled:opacity-50"
                >
                  {guardando
                    ? "Guardando..."
                    : modoEdicion
                    ? "Guardar Cambios"
                    : "Guardar Feriado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {modalEliminarAbierto && feriadoAEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-eliminar-titulo"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <h3 id="modal-eliminar-titulo" className="text-lg font-bold text-slate-900">
              ¿Eliminar feriado del calendario laboral?
            </h3>
            <p className="text-sm text-slate-600">
              Está a punto de eliminar el feriado <strong className="text-slate-900">"{feriadoAEliminar.nombre}"</strong> programado para el <span className="font-mono font-bold text-blue-700">{feriadoAEliminar.fecha}</span>.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              ⚠️ <strong>Impacto SLA:</strong> La eliminación de este feriado recalculará automáticamente los semáforos y plazos de atención de los expedientes en trámite conforme al Art. 143 del TUO de la Ley N° 27444.
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalEliminarAbierto(false);
                  setFeriadoAEliminar(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={handleConfirmarEliminar}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 transition shadow disabled:opacity-50"
              >
                {guardando ? "Eliminando..." : "Confirmar Eliminación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
