import { useState, useEffect, useCallback, type FormEvent } from "react";
import { apiClient } from "../../api/client";
import { useNavigate } from "react-router-dom";
import BandejaTabFilter from "../../components/expedientes/BandejaTabFilter";
import ExpedienteTable from "../../components/expedientes/ExpedienteTable";
import { useBandejaExpedientes } from "../../hooks/useBandejaExpedientes";
import { useAuthStore } from "../../stores/authStore";
import { AREA_ID_DIR, AREA_ID_SDA } from "../../utils/areaPresentacion";
import type { Filtros } from "./rutadoc/rutadoc.dto";
import RutaDocEstado from "./rutadoc/RutaDocEstado";
import { tesoreriaService, type DtoSolicitudDevolucion } from "../../services/tesoreria.service";

export interface SolicitudVinculacionPendiente {
  solicitudId: string;
  expedienteId: string;
  cut: string;
  idUsuario: string;
  motivo: string | null;
  estado: string;
  fechaSolicitud: string;
  solicitanteNombre: string | null;
  solicitanteDocumento: string | null;
  solicitanteTipoDocumento: string | null;
  usuarioLogin: string;
  usuarioCorreo: string;
}

export default function BandejaExpedientesPage() {
  const navigate = useNavigate();
  const usuario = useAuthStore((state) => state.usuario);
  const rol = usuario?.rol;

  const esAdminOGlobal = rol === "ADMINISTRADOR" || rol === "DIRECTOR";
  const esOperadorSDA = rol === "ESPECIALISTA" || rol === "SECRETARIO";

  const [tipoBandeja, setTipoBandeja] = useState<"AREA" | "PERSONAL">("AREA");

  const [filtros, setFiltros] = useState<Filtros>(() => ({
    pestana: "PENDIENTES",
    limite: 20,
    areaId: undefined,
    bandeja: "AREA",
  }));

  const handleCambiarTipoBandeja = (nuevoTipo: "AREA" | "PERSONAL") => {
    setTipoBandeja(nuevoTipo);
    setAnteriores([]);
    setFiltros((prev) => ({
      ...prev,
      bandeja: nuevoTipo,
      cursor: undefined,
    }));
  };

  const [anteriores, setAnteriores] = useState<(string | undefined)[]>([]);
  const consulta = useBandejaExpedientes(filtros);

  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudVinculacionPendiente[]>([]);
  const [modalVinculacionesOpen, setModalVinculacionesOpen] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [motivoRechazoInput, setMotivoRechazoInput] = useState<string>('');
  const [solicitudARechazar, setSolicitudARechazar] = useState<SolicitudVinculacionPendiente | null>(null);
  const [mensajeVinculacion, setMensajeVinculacion] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [mostrarDevoluciones, setMostrarDevoluciones] = useState(false);
  const [estadoDevoluciones, setEstadoDevoluciones] = useState('SOLICITADA');
  const [devoluciones, setDevoluciones] = useState<DtoSolicitudDevolucion[]>([]);
  const [errorDevoluciones, setErrorDevoluciones] = useState<string | null>(null);
  const [buscarDevoluciones, setBuscarDevoluciones] = useState('');
  const [paginaDevoluciones, setPaginaDevoluciones] = useState(1);
  const [totalPaginasDevoluciones, setTotalPaginasDevoluciones] = useState(1);

  const cargarDevoluciones = useCallback(async (estado: string, pagina = 1, buscar = '') => {
    if (rol !== 'MESA_PARTES' && rol !== 'ADMINISTRADOR') return;
    setErrorDevoluciones(null);
    try {
      const respuesta = await tesoreriaService.listarDevoluciones({ estado, buscar, page: pagina, limit: 20 });
      setDevoluciones(respuesta.items);
      setPaginaDevoluciones(pagina);
      setTotalPaginasDevoluciones(Math.max(1, respuesta.totalPages));
    } catch (error) {
      setErrorDevoluciones(error instanceof Error ? error.message : 'No se pudieron cargar las solicitudes.');
    }
  }, [rol]);

  const cargarSolicitudesPendientes = useCallback(async () => {
    if (rol !== 'MESA_PARTES' && rol !== 'ADMINISTRADOR') return;
    try {
      const resp = await apiClient.get<SolicitudVinculacionPendiente[]>('/api/v1/tramites/vinculaciones/pendientes');
      if (resp && Array.isArray(resp.data)) {
        setSolicitudesPendientes(resp.data);
      }
    } catch {
      // Ignorar si no está mockeado en tests o si hay falla de red
    }
  }, [rol]);

  useEffect(() => {
    void cargarSolicitudesPendientes();
  }, [cargarSolicitudesPendientes]);

  const resolverSolicitud = async (solicitudId: string, decision: 'APROBADA' | 'RECHAZADA', motivoRechazo?: string) => {
    setProcesandoId(solicitudId);
    setMensajeVinculacion(null);
    try {
      await apiClient.post(`/api/v1/tramites/vinculaciones/${solicitudId}/resolver`, {
        decision,
        motivoRechazo,
      });
      setMensajeVinculacion({
        tipo: 'exito',
        texto: decision === 'APROBADA' ? 'Solicitud aprobada y expediente vinculado con éxito.' : 'Solicitud rechazada.',
      });
      setSolicitudARechazar(null);
      setMotivoRechazoInput('');
      await cargarSolicitudesPendientes();
      void consulta.refetch();
    } catch (err: any) {
      setMensajeVinculacion({
        tipo: 'error',
        texto: err.response?.data?.message || err.message || 'Error al resolver la solicitud de vinculación.',
      });
    } finally {
      setProcesandoId(null);
    }
  };

  function filtrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datos = new FormData(event.currentTarget);
    const texto = (nombre: string) => String(datos.get(nombre) ?? "").trim() || undefined;
    setAnteriores([]);

    let areaIdFiltro = texto("areaId");
    if (areaIdFiltro) {
      const limpia = areaIdFiltro.trim().toUpperCase();
      if (limpia === "SDA" || limpia.includes("SUBDIRECCIÓN ACADÉMICA")) {
        areaIdFiltro = AREA_ID_SDA;
      } else if (limpia === "DIR" || limpia.includes("DIRECCIÓN GENERAL")) {
        areaIdFiltro = AREA_ID_DIR;
      }
    }

    setFiltros({
      pestana: filtros.pestana,
      limite: Number(datos.get("limite")) || 20,
      terminoBusqueda: texto("terminoBusqueda"),
      areaId: areaIdFiltro,
      fechaDesde: texto("fechaDesde"),
      fechaHasta: texto("fechaHasta"),
      bandeja: tipoBandeja,
    });
  }

  const handleVolver = () => {
    if (typeof window !== "undefined" && window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const obtenerInfoRolBandeja = () => {
    switch (rol) {
      case "ESPECIALISTA":
        return {
          titulo: "Bandeja de expedientes — Despacho y Calificación",
          subtitulo: "Subdirección Académica (SDA) — Evaluación, atención y resolución técnica de expedientes",
          badge: "Especialista SDA",
          badgeClase: "bg-sky-100 text-sky-800 border-sky-300",
        };
      case "SECRETARIO":
        return {
          titulo: "Bandeja de expedientes — Trámite y Derivación",
          subtitulo: "Subdirección Académica (SDA) — Gestión, providencias y despacho documental",
          badge: "Secretaría SDA",
          badgeClase: "bg-sky-100 text-sky-800 border-sky-300",
        };
      case "MESA_PARTES":
        return {
          titulo: "Bandeja de expedientes — Entrada y Derivación",
          subtitulo: "Mesa de Partes (DIR) — Control de radicaciones, pagos y derivación a áreas",
          badge: "Mesa de Partes",
          badgeClase: "bg-blue-100 text-blue-800 border-blue-300",
        };
      case "DIRECTOR":
        return {
          titulo: "Bandeja de expedientes — Control Directivo",
          subtitulo: "Dirección General (DIR) — Supervisión ejecutiva y control integral institucional",
          badge: "Dirección General",
          badgeClase: "bg-indigo-100 text-indigo-800 border-indigo-300",
        };
      case "ADMINISTRADOR":
        return {
          titulo: "Bandeja de expedientes — Supervisión Institucional Global",
          subtitulo: "Supervisión global y trazabilidad integral del IESTP \"Suiza\"",
          badge: "Supervisión Global (Administración)",
          badgeClase: "bg-amber-100 text-amber-900 border-amber-300",
        };
      default:
        return {
          titulo: "Bandeja de expedientes",
          subtitulo: "Gestión y seguimiento de trámites institucionales",
          badge: "Institucional",
          badgeClase: "bg-slate-100 text-slate-800 border-slate-300",
        };
    }
  };

  const infoRol = obtenerInfoRolBandeja();

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          className="rounded px-2 py-1 text-blue-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          onClick={handleVolver}
        >
          ← Volver
        </button>
        <div className="flex items-center gap-2">
          {(rol === 'MESA_PARTES' || rol === 'ADMINISTRADOR') && (
            <button type="button" onClick={() => { setMostrarDevoluciones(true); void cargarDevoluciones(estadoDevoluciones, 1, buscarDevoluciones); }} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              Solicitudes de devolución
            </button>
          )}
          {(rol === 'MESA_PARTES' || rol === 'ADMINISTRADOR') && (
            <button
              type="button"
              onClick={() => {
                setModalVinculacionesOpen(true);
                setMensajeVinculacion(null);
                void cargarSolicitudesPendientes();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 shadow-2xs hover:bg-cyan-100 transition cursor-pointer"
            >
              <span>🔗 Solicitudes de Vinculación</span>
              {solicitudesPendientes.length > 0 && (
                <span className="rounded-full bg-cyan-700 text-white px-1.5 py-0.2 text-[10px] font-bold">
                  {solicitudesPendientes.length}
                </span>
              )}
            </button>
          )}
          <span className={`inline-block rounded px-2.5 py-1 text-xs font-bold border uppercase tracking-wide ${infoRol.badgeClase}`}>
            {infoRol.badge}
          </span>
        </div>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">{infoRol.titulo}</h1>
        <p className="text-sm text-slate-600">{infoRol.subtitulo}</p>
      </header>

      {/* Selector de Bandeja de Área vs Mi Bandeja (Regla 22 y 23 Fase 5H) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div
          role="tablist"
          aria-label="Tipo de bandeja institucional"
          className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tipoBandeja === "AREA"}
            onClick={() => handleCambiarTipoBandeja("AREA")}
            className={`rounded-lg px-3.5 py-1.5 transition cursor-pointer ${
              tipoBandeja === "AREA"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🏢 Bandeja de Área (Custodia)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tipoBandeja === "PERSONAL"}
            onClick={() => handleCambiarTipoBandeja("PERSONAL")}
            className={`rounded-lg px-3.5 py-1.5 transition cursor-pointer ${
              tipoBandeja === "PERSONAL"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            👤 Mi Bandeja (Asignados a Mí)
          </button>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {tipoBandeja === "AREA"
            ? "Mostrando expedientes bajo custodia formal de la unidad orgánica"
            : "Mostrando únicamente expedientes asignados para su despacho personal"}
        </span>
      </div>

      {mostrarDevoluciones && (rol === 'MESA_PARTES' || rol === 'ADMINISTRADOR') && (
        <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Bandeja de devoluciones">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Solicitudes de devolución</h2>
            <button type="button" onClick={() => setMostrarDevoluciones(false)} aria-label="Cerrar devoluciones">Cerrar</button>
          </div>
          <label className="mt-3 block text-sm">Estado
            <select className="ml-2 rounded border p-1" value={estadoDevoluciones} onChange={(event) => { setEstadoDevoluciones(event.target.value); void cargarDevoluciones(event.target.value, 1, buscarDevoluciones); }}>
              <option value="SOLICITADA">Pendientes</option>
              <option value="EN_REVISION">En revisión</option>
              <option value="OBSERVADA">Observadas</option>
              <option value="APROBADA">Aprobadas</option>
              <option value="PENDIENTE_TESORERIA">Pendientes de Tesorería</option>
              <option value="RECHAZADA">Rechazadas</option>
            </select>
          </label>
          <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); void cargarDevoluciones(estadoDevoluciones, 1, buscarDevoluciones); }}>
            <label className="text-sm">Buscar DEV, PAG, EXP o nombre
              <input className="ml-2 rounded border p-1" value={buscarDevoluciones} onChange={(event) => setBuscarDevoluciones(event.target.value)} />
            </label>
            <button type="submit" className="rounded border px-2">Buscar</button>
          </form>
          {errorDevoluciones && <p role="alert" className="mt-2 text-rose-700">{errorDevoluciones}</p>}
          {!errorDevoluciones && devoluciones.length === 0 && <p className="mt-2 text-sm text-slate-600">No hay solicitudes en este estado.</p>}
          <ul className="mt-3 divide-y divide-slate-100">
            {devoluciones.map((dev) => (
              <li key={dev.solicitudDevolucionId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><strong>{dev.codigoDev}</strong> · {dev.codigoExpediente} · S/ {dev.montoSolicitado.toFixed(2)} · {dev.estado}</span>
                <button type="button" className="text-blue-800 underline" onClick={() => navigate(`/expedientes/${dev.expedienteId}`)}>Abrir expediente</button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <button type="button" disabled={paginaDevoluciones <= 1} onClick={() => void cargarDevoluciones(estadoDevoluciones, paginaDevoluciones - 1, buscarDevoluciones)}>Anterior</button>
            <span>Página {paginaDevoluciones} de {totalPaginasDevoluciones}</span>
            <button type="button" disabled={paginaDevoluciones >= totalPaginasDevoluciones} onClick={() => void cargarDevoluciones(estadoDevoluciones, paginaDevoluciones + 1, buscarDevoluciones)}>Siguiente</button>
          </div>
        </section>
      )}

      <form
        onSubmit={filtrar}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&_label]:flex [&_label]:min-w-0 [&_label]:flex-col [&_label]:gap-1 [&_input]:min-w-0 [&_input]:w-full [&_input]:rounded [&_input]:border [&_input]:border-slate-500 [&_input]:bg-white [&_input]:px-3 [&_input]:py-2 [&_select]:w-full [&_select]:rounded [&_select]:border [&_select]:border-slate-500 [&_select]:bg-white [&_select]:px-3 [&_select]:py-2 [&_input:focus-visible]:outline-2 [&_input:focus-visible]:outline-offset-2 [&_input:focus-visible]:outline-blue-700 [&_select:focus-visible]:outline-2 [&_select:focus-visible]:outline-offset-2 [&_select:focus-visible]:outline-blue-700"
      >
        <label>
          <span className="text-sm font-medium text-slate-700">Buscar CUT o asunto</span>
          <input name="terminoBusqueda" maxLength={100} type="search" placeholder="Ej: EXP-2026-000001 o constancia" />
        </label>

        {esAdminOGlobal ? (
          <label>
            <span className="text-sm font-medium text-slate-700">Área o Unidad Orgánica</span>
            <select name="areaId" defaultValue={filtros.areaId ?? ""} aria-label="Área UUID">
              <option value="">Todas las áreas (Institucional Global)</option>
              <option value={AREA_ID_SDA}>Subdirección Académica (SDA)</option>
              <option value={AREA_ID_DIR}>Dirección General (DIR)</option>
            </select>
          </label>
        ) : (
          <label>
            <span className="text-sm font-medium text-slate-700">
              Área institucional {esOperadorSDA && <span className="text-xs font-semibold text-sky-700">(Subdirección Académica)</span>}
            </span>
            <input
              name="areaId"
              aria-label="Área UUID"
              defaultValue={filtros.areaId ?? ""}
              placeholder={esOperadorSDA ? "Subdirección Académica (SDA)" : "Código o identificador de área"}
            />
          </label>
        )}

        <label>
          <span className="text-sm font-medium text-slate-700">Desde</span>
          <input name="fechaDesde" type="date" />
        </label>
        <label>
          <span className="text-sm font-medium text-slate-700">Hasta</span>
          <input name="fechaHasta" type="date" />
        </label>
        <label>
          <span className="text-sm font-medium text-slate-700">Por página</span>
          <select name="limite" defaultValue="20">
            <option>1</option>
            <option>20</option>
            <option>50</option>
            <option>100</option>
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded border border-blue-800 bg-blue-800 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Aplicar filtros
        </button>
      </form>

      <BandejaTabFilter
        estadoActivo={filtros.pestana}
        conteos={consulta.data?.contadores}
        estadoConteos={consulta.isPending ? "cargando" : consulta.isError ? "error" : "disponible"}
        onCambiarEstado={(pestana) => {
          setAnteriores([]);
          setFiltros((f) => ({ ...f, pestana, cursor: undefined }));
        }}
      />

      <RutaDocEstado
        pendiente={consulta.isPending}
        error={consulta.error}
        reintentar={() => {
          void consulta.refetch();
        }}
      >
        {consulta.data && (
          <>
            <ExpedienteTable
              expedientes={consulta.data.elementos}
              onVerExpediente={(e) => navigate(`/expedientes/${encodeURIComponent(e.idExpediente)}`)}
            />
            <nav
              aria-label="Paginación"
              className="flex gap-4 [&_button]:rounded [&_button]:border [&_button]:border-slate-500 [&_button]:px-3 [&_button]:py-2 [&_button]:text-slate-900 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:bg-slate-100 [&_button:disabled]:text-slate-600 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-blue-700"
            >
              <button
                type="button"
                disabled={!anteriores.length}
                onClick={() => {
                  const copia = [...anteriores];
                  const cursor = copia.pop();
                  setAnteriores(copia);
                  setFiltros((f) => ({ ...f, cursor }));
                }}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!consulta.data.tieneMas || consulta.isFetching}
                onClick={() => {
                  const cursor = consulta.data?.siguienteCursor;
                  if (!cursor) return;
                  setAnteriores((a) => [...a, filtros.cursor]);
                  setFiltros((f) => ({ ...f, cursor }));
                }}
              >
                Siguiente
              </button>
            </nav>
          </>
        )}
      </RutaDocEstado>
      {/* MODAL MESA DE PARTES / ADMIN: GESTIÓN DE VINCULACIONES HISTÓRICAS */}
      {modalVinculacionesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-800">
                  Control Documental & Identidad (Fase 2)
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Solicitudes de Vinculación de Trámites Previos
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalVinculacionesOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {mensajeVinculacion && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  mensajeVinculacion.tipo === 'exito'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {mensajeVinculacion.texto}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {solicitudesPendientes.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <span className="text-2xl block mb-2">✓</span>
                  <p className="font-semibold text-sm text-slate-700">No hay solicitudes pendientes</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Todas las solicitudes de vinculación histórica han sido resueltas.
                  </p>
                </div>
              ) : (
                solicitudesPendientes.map((sol) => (
                  <div
                    key={sol.solicitudId}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                      <div>
                        <span className="font-mono font-bold text-sm text-cyan-900">{sol.cut}</span>
                        <span className="text-slate-400 mx-2">•</span>
                        <span className="text-xs text-slate-500">
                          {new Date(sol.fechaSolicitud).toLocaleString('es-PE')}
                        </span>
                      </div>
                      <span className="inline-block rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[11px] font-bold">
                        Pendiente de Revisión
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-600 uppercase text-[10px] block">
                          Titular en Expediente:
                        </span>
                        <p className="font-semibold text-slate-800 mt-0.5">
                          {sol.solicitanteNombre || 'Sin nombre'}
                        </p>
                        <p className="text-slate-500 font-mono text-[11px]">
                          {sol.solicitanteTipoDocumento}: {sol.solicitanteDocumento}
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-600 uppercase text-[10px] block">
                          Cuenta Ciudadana Solicitante:
                        </span>
                        <p className="font-semibold text-slate-800 mt-0.5">{sol.usuarioLogin}</p>
                        <p className="text-slate-500 text-[11px]">{sol.usuarioCorreo}</p>
                      </div>
                    </div>

                    {sol.motivo && (
                      <p className="text-xs text-slate-600 bg-cyan-50/50 p-2 rounded-lg border border-cyan-100 italic">
                        &quot;{sol.motivo}&quot;
                      </p>
                    )}

                    {solicitudARechazar?.solicitudId === sol.solicitudId ? (
                      <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 space-y-2">
                        <label className="block text-xs font-bold text-rose-900">
                          Motivo del Rechazo:
                        </label>
                        <input
                          type="text"
                          value={motivoRechazoInput}
                          onChange={(e) => setMotivoRechazoInput(e.target.value)}
                          placeholder="Ejemplo: El documento de identidad no coincide con el expediente físico."
                          className="w-full px-3 py-1.5 rounded-lg border border-rose-300 bg-white text-xs focus:outline-rose-500"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setSolicitudARechazar(null)}
                            className="px-3 py-1 rounded bg-slate-200 text-xs font-semibold text-slate-700"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={procesandoId === sol.solicitudId}
                            onClick={() =>
                              void resolverSolicitud(sol.solicitudId, 'RECHAZADA', motivoRechazoInput)
                            }
                            className="px-3 py-1 rounded bg-rose-700 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-50"
                          >
                            Confirmar Rechazo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          disabled={procesandoId === sol.solicitudId}
                          onClick={() => {
                            setSolicitudARechazar(sol);
                            setMotivoRechazoInput('');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          disabled={procesandoId === sol.solicitudId}
                          onClick={() => void resolverSolicitud(sol.solicitudId, 'APROBADA')}
                          className="px-4 py-1.5 rounded-lg bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 transition disabled:opacity-50 shadow-2xs"
                        >
                          {procesandoId === sol.solicitudId ? 'Aprobando...' : '✓ Aprobar Vinculación'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setModalVinculacionesOpen(false)}
                className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
