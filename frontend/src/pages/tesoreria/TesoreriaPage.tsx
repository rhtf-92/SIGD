import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  tesoreriaService,
  type DtoConfiguracionDemoQr,
  type DtoOrdenPago,
  type DtoResumenDashboardTesoreria,
  type EstadoOrdenPago,
  type MetodoPago,
} from "../../services/tesoreria.service";

const YAPE_QR_SRC = import.meta.env.VITE_YAPE_QR_PATH || "/local-assets/qr_original.jpeg";

export default function TesoreriaPage() {
  const [metricas, setMetricas] = useState<DtoResumenDashboardTesoreria>({
    pendientes: 0,
    confirmadosHoy: 0,
    vencidos: 0,
  });
  const [ordenes, setOrdenes] = useState<DtoOrdenPago[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<EstadoOrdenPago | "TODOS">("TODOS");
  const [busqueda, setBusqueda] = useState<string>("");
  const [pagina, setPagina] = useState<number>(1);
  const [totalPaginas, setTotalPaginas] = useState<number>(1);
  const [totalRegistros, setTotalRegistros] = useState<number>(0);

  // Modales
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<DtoOrdenPago | null>(null);
  const [modalConfirmarAbierto, setModalConfirmarAbierto] = useState<boolean>(false);
  const [modalRechazarAbierto, setModalRechazarAbierto] = useState<boolean>(false);
  const [modalReciboAbierto, setModalReciboAbierto] = useState<boolean>(false);

  // Estados del modal de confirmación
  const [metodoPago, setMetodoPago] = useState<Exclude<MetodoPago, "QR_AUTOMATICO_SANDBOX"> | "DEMO_QR">("EFECTIVO");
  const [montoRecibido, setMontoRecibido] = useState<string>("");
  const [referenciaYape, setReferenciaYape] = useState<string>("");
  const [qrNoDisponible, setQrNoDisponible] = useState(false);
  const [qrAmpliado, setQrAmpliado] = useState(false);

  // Estado del QR automático del simulador
  const [configDemoQr, setConfigDemoQr] = useState<DtoConfiguracionDemoQr | null>(null);
  const [generandoQr, setGenerandoQr] = useState<boolean>(false);
  const [errorQr, setErrorQr] = useState<string | null>(null);
  const [qrExpirado, setQrExpirado] = useState<boolean>(false);

  useEffect(() => {
    void tesoreriaService.obtenerConfiguracionDemoQr()
      .then(setConfigDemoQr)
      .catch(() => setConfigDemoQr({ configured: false, sandbox: true, publicUrl: null }));
  }, []);

  useEffect(() => {
    if (!qrAmpliado) return;
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQrAmpliado(false);
    };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [qrAmpliado]);
  const [procesandoPago, setProcesandoPago] = useState<boolean>(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);

  // Estados del modal de rechazo
  const [motivoRechazo, setMotivoRechazo] = useState<string>("");
  const [procesandoRechazo, setProcesandoRechazo] = useState<boolean>(false);
  const [errorRechazo, setErrorRechazo] = useState<string | null>(null);

  // Recibo emitido
  const [reciboData, setReciboData] = useState<DtoOrdenPago | null>(null);

  const cargarDashboard = useCallback(async () => {
    try {
      const data = await tesoreriaService.obtenerDashboard();
      if (data) setMetricas(data);
    } catch (e: unknown) {
      console.error("Error al cargar dashboard de tesorería:", e);
    }
  }, []);

  const cargarOrdenes = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await tesoreriaService.listarOrdenes({
        estado: filtroEstado,
        buscar: busqueda,
        page: pagina,
        limit: 10,
      });
      setOrdenes(Array.isArray(data?.items) ? data.items : []);
      setTotalPaginas(data?.totalPages || 1);
      setTotalRegistros(data?.total || 0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al consultar las órdenes de pago.";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, busqueda, pagina]);

  useEffect(() => {
    void cargarDashboard();
  }, [cargarDashboard]);

  useEffect(() => {
    void cargarOrdenes();
  }, [cargarOrdenes]);

  // Polling mientras el modal del simulador esté abierto y pendiente
  useEffect(() => {
    if (
      !modalConfirmarAbierto ||
      !ordenSeleccionada ||
      metodoPago !== "DEMO_QR" ||
      ordenSeleccionada.estado === "CONFIRMADO"
    ) {
      return;
    }

    const consultarEstado = async () => {
      try {
        const ordenActualizada = await tesoreriaService.obtenerOrdenPorId(ordenSeleccionada.ordenPagoId);
        if (ordenActualizada) {
          if (ordenActualizada.estado === "CONFIRMADO") {
            setOrdenSeleccionada(ordenActualizada);
            void cargarDashboard();
            void cargarOrdenes();
          } else if (
            ordenActualizada.providerExpiresAt &&
            new Date() > new Date(ordenActualizada.providerExpiresAt)
          ) {
            setQrExpirado(true);
          }
        }
      } catch {
        // Polling silencioso
      }
    };

    void consultarEstado();
    const intervalId = setInterval(consultarEstado, 2500);

    return () => clearInterval(intervalId);
  }, [modalConfirmarAbierto, ordenSeleccionada, metodoPago, cargarDashboard, cargarOrdenes]);

  const generarQrDemo = async (ordenPagoId: string) => {
    setGenerandoQr(true);
    setErrorQr(null);
    setQrExpirado(false);
    try {
      const res = await tesoreriaService.crearPagoDemoQr(ordenPagoId);
      if (res?.orden) setOrdenSeleccionada(res.orden);
    } catch {
      setErrorQr("No se pudo generar el QR de simulación. Puede usar Efectivo o Yape asistido.");
    } finally {
      setGenerandoQr(false);
    }
  };

  const handleSeleccionarMetodo = (metodo: Exclude<MetodoPago, "QR_AUTOMATICO_SANDBOX"> | "DEMO_QR") => {
    setMetodoPago(metodo);
    setErrorPago(null);
    if (metodo === "DEMO_QR" && ordenSeleccionada) {
      if (!ordenSeleccionada.providerQrImage || ordenSeleccionada.paymentProvider !== "DEMO_QR" ||
          (ordenSeleccionada.providerExpiresAt && new Date() >= new Date(ordenSeleccionada.providerExpiresAt))) {
        void generarQrDemo(ordenSeleccionada.ordenPagoId);
      }
    }
  };

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    void cargarOrdenes();
  };

  const handleAbrirConfirmar = (orden: DtoOrdenPago) => {
    setOrdenSeleccionada(orden);
    setMetodoPago("EFECTIVO");
    setMontoRecibido(String(orden.monto));
    setReferenciaYape("");
    setQrNoDisponible(false);
    setQrAmpliado(false);
    setErrorPago(null);
    setErrorQr(null);
    setQrExpirado(false);
    setModalConfirmarAbierto(true);
  };

  const handleAbrirRechazar = (orden: DtoOrdenPago) => {
    setOrdenSeleccionada(orden);
    setMotivoRechazo("");
    setErrorRechazo(null);
    setModalRechazarAbierto(true);
  };

  const handleAbrirRecibo = (orden: DtoOrdenPago) => {
    setReciboData(orden);
    setModalReciboAbierto(true);
  };

  const vueltoCalculado = () => {
    if (!ordenSeleccionada) return 0;
    const recibido = parseFloat(montoRecibido);
    if (isNaN(recibido)) return 0;
    const diff = recibido - ordenSeleccionada.monto;
    return diff > 0 ? diff : 0;
  };

  const ejecutarConfirmarPago = async () => {
    if (!ordenSeleccionada) return;
    if (metodoPago === "DEMO_QR") return;
    setErrorPago(null);

    if (metodoPago === "EFECTIVO") {
      const recibido = parseFloat(montoRecibido);
      if (isNaN(recibido) || recibido < ordenSeleccionada.monto) {
        setErrorPago(`El monto recibido debe ser al menos S/ ${ordenSeleccionada.monto.toFixed(2)}.`);
        return;
      }
    } else {
      if (!referenciaYape.trim() || referenciaYape.trim().length < 4) {
        setErrorPago("Debe ingresar el número de referencia u operación de Yape (mínimo 4 caracteres).");
        return;
      }
    }

    setProcesandoPago(true);
    try {
      const resp = await tesoreriaService.confirmarPago(ordenSeleccionada.ordenPagoId, {
        metodoPago,
        montoRecibido: metodoPago === "EFECTIVO" ? parseFloat(montoRecibido) : undefined,
        referenciaOperacion: metodoPago === "YAPE" ? referenciaYape.trim() : undefined,
      });

      setModalConfirmarAbierto(false);
      setReciboData(resp.orden);
      setModalReciboAbierto(true);
      void cargarDashboard();
      void cargarOrdenes();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al confirmar el pago.";
      setErrorPago(msg);
    } finally {
      setProcesandoPago(false);
    }
  };

  const ejecutarRechazarPago = async () => {
    if (!ordenSeleccionada) return;
    if (!motivoRechazo.trim() || motivoRechazo.trim().length < 5) {
      setErrorRechazo("Debe especificar un motivo formal de al menos 5 caracteres.");
      return;
    }

    setProcesandoRechazo(true);
    setErrorRechazo(null);
    try {
      await tesoreriaService.rechazarPago(ordenSeleccionada.ordenPagoId, motivoRechazo.trim());
      setModalRechazarAbierto(false);
      void cargarDashboard();
      void cargarOrdenes();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al rechazar la orden de pago.";
      setErrorRechazo(msg);
    } finally {
      setProcesandoRechazo(false);
    }
  };

  const badgeEstado = (estado: EstadoOrdenPago) => {
    switch (estado) {
      case "PENDIENTE":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "CONFIRMADO":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "RECHAZADO":
        return "bg-rose-50 text-rose-800 border-rose-200";
      case "VENCIDO":
        return "bg-slate-100 text-slate-700 border-slate-300";
      case "ANULADO":
        return "bg-red-50 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const formatearFecha = (str: string) => {
    if (!str) return "-";
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 py-6 px-3.5 sm:px-6 sm:py-8 lg:px-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Cabecera */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-950 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Caja y Tesorería Institucional
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Módulo de Tesorería — IESTP &quot;Suiza&quot;
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Control de órdenes de pago, recaudación presencial/digital y emisión de recibos oficiales.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/expedientes"
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              ← Bandeja de Expedientes
            </Link>
          </div>
        </header>

        {/* Tarjetas Métricas Dashboard */}
        <section aria-label="Métricas de recaudación" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/40 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Órdenes Pendientes</span>
              <span className="rounded-full bg-amber-100 p-2 text-amber-800 text-sm">⏳</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold text-amber-900">{metricas.pendientes}</p>
            <p className="text-xs text-amber-700/80 mt-1">Por cobrar en ventanilla o confirmar</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Confirmados Hoy</span>
              <span className="rounded-full bg-emerald-100 p-2 text-emerald-800 text-sm">✓</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold text-emerald-900">{metricas.confirmadosHoy}</p>
            <p className="text-xs text-emerald-700/80 mt-1">Pagos recaudados durante la jornada</p>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-white to-rose-50/40 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Órdenes Vencidas</span>
              <span className="rounded-full bg-rose-100 p-2 text-rose-800 text-sm">⚠️</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold text-rose-900">{metricas.vencidos}</p>
            <p className="text-xs text-rose-700/80 mt-1">Plazo de 7 días hábiles expirado</p>
          </div>
        </section>

        {/* Barra de Filtros y Búsqueda */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Pestañas de Estado */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(["TODOS", "PENDIENTE", "CONFIRMADO", "RECHAZADO", "VENCIDO"] as const).map((estado) => (
                <button
                  key={estado}
                  type="button"
                  onClick={() => {
                    setFiltroEstado(estado);
                    setPagina(1);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    filtroEstado === estado
                      ? "bg-blue-800 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {estado}
                </button>
              ))}
            </div>

            {/* Buscador */}
            <form onSubmit={handleBuscar} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Buscar por PAG-..., DNI, CUT..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full sm:w-64 rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <button
                type="submit"
                className="rounded-xl bg-blue-800 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-900 transition shadow-xs"
              >
                Buscar
              </button>
            </form>
          </div>
        </div>

        {/* Tabla de Órdenes de Pago */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {cargando ? (
            <div className="p-12 text-center text-slate-500">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-700 border-r-transparent align-[-0.125em]" />
              <p className="mt-3 text-sm font-medium">Cargando órdenes de pago...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-rose-700 bg-rose-50 border-b border-rose-200">
              <p className="text-sm font-semibold">{error}</p>
              <button
                type="button"
                onClick={() => void cargarOrdenes()}
                className="mt-2 rounded-lg bg-rose-700 px-3 py-1 text-xs text-white hover:bg-rose-800"
              >
                Reintentar
              </button>
            </div>
          ) : (!ordenes || ordenes.length === 0) ? (
            <div className="p-12 text-center text-slate-500">
              <p className="text-base font-semibold text-slate-700">No se encontraron órdenes de pago</p>
              <p className="text-xs text-slate-400 mt-1">
                {filtroEstado !== "TODOS"
                  ? `No existen órdenes en estado ${filtroEstado}.`
                  : "No hay registros disponibles con el criterio de búsqueda."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase text-[11px] font-bold text-slate-700">
                  <tr>
                    <th scope="col" className="px-4 py-3">Código Pago</th>
                    <th scope="col" className="px-4 py-3">Expediente</th>
                    <th scope="col" className="px-4 py-3">Administrado</th>
                    <th scope="col" className="px-4 py-3">Concepto TUPA</th>
                    <th scope="col" className="px-4 py-3">Monto</th>
                    <th scope="col" className="px-4 py-3">Vencimiento</th>
                    <th scope="col" className="px-4 py-3">Estado</th>
                    <th scope="col" className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ordenes.map((ord) => (
                    <tr key={ord.ordenPagoId} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-mono font-bold text-blue-900 whitespace-nowrap">
                        {ord.codigoPago}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                        <Link
                          to={`/expedientes/${ord.expedienteId}`}
                          className="hover:underline text-blue-700 font-semibold"
                        >
                          {ord.codigoExpediente}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{ord.solicitanteNombre}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{ord.documentoEnmascarado}</p>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-slate-800 truncate" title={ord.concepto}>
                          {ord.concepto}
                        </p>
                        {ord.codigoTupa && (
                          <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                            {ord.codigoTupa}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {ord.moneda} {ord.monto.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {formatearFecha(ord.fechaVencimiento)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badgeEstado(ord.estado)}`}>
                          {ord.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                        {ord.estado === "PENDIENTE" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAbrirConfirmar(ord)}
                              className="rounded-xl border border-emerald-700 bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-xs"
                            >
                              Cobrar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAbrirRechazar(ord)}
                              className="rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        {ord.estado === "CONFIRMADO" && (
                          <button
                            type="button"
                            onClick={() => handleAbrirRecibo(ord)}
                            className="rounded-xl border border-blue-700 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 hover:bg-blue-100 transition"
                          >
                            Ver Recibo
                          </button>
                        )}
                        {ord.estado === "RECHAZADO" && ord.motivoRechazo && (
                          <span className="text-[11px] text-rose-600 italic truncate max-w-xs inline-block" title={ord.motivoRechazo}>
                            {ord.motivoRechazo}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3 flex items-center justify-between text-xs text-slate-600">
            <span>
              Total: <strong>{totalRegistros}</strong> registros (Página {pagina} de {totalPaginas})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(p - 1, 1))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: CONFIRMAR PAGO (EFECTIVO O YAPE ASISTIDO) */}
      {modalConfirmarAbierto && ordenSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className={`w-full ${metodoPago === "YAPE" ? "max-w-2xl" : "max-w-lg"} max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Caja / Ventanilla</span>
                <h2 className="text-lg font-bold text-slate-900">
                  Confirmar Cobro — {ordenSeleccionada.codigoPago}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalConfirmarAbierto(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Resumen de la Orden */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Administrado:</span>
                <span className="font-bold text-slate-900">{ordenSeleccionada.solicitanteNombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expediente:</span>
                <span className="font-mono font-semibold text-slate-800">{ordenSeleccionada.codigoExpediente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Concepto:</span>
                <span className="font-medium text-slate-800">{ordenSeleccionada.concepto}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm">
                <span className="font-bold text-slate-900">Total a Pagar:</span>
                <span className="font-mono font-extrabold text-blue-900">
                  {ordenSeleccionada.moneda} {ordenSeleccionada.monto.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Selección de Método de Pago */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Medio de Recaudación</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleSeleccionarMetodo("EFECTIVO")}
                  className={`rounded-xl border p-3 text-left transition ${
                    metodoPago === "EFECTIVO"
                      ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-bold text-xs text-slate-900">💵 Efectivo en Ventanilla</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Control de monto y cálculo de vuelto</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleSeleccionarMetodo("YAPE")}
                  className={`rounded-xl border p-3 text-left transition ${
                    metodoPago === "YAPE"
                      ? "border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-bold text-xs text-slate-900">📱 Yape / QR Asistido</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Validación de nro. de operación</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleSeleccionarMetodo("DEMO_QR")}
                  className={`rounded-xl border p-3 text-left transition ${metodoPago === "DEMO_QR"
                    ? "border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20"
                    : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <p className="font-bold text-xs text-slate-900">QR Automático — Simulador</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Sandbox demo · no procesa dinero real</p>
                </button>
              </div>
            </div>

            {/* Detalle según método */}
            {metodoPago === "EFECTIVO" && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs">
                <div>
                  <label htmlFor="input-monto-recibido" className="font-bold text-slate-700 block mb-1">
                    Monto Recibido del Administrado (S/)
                  </label>
                  <input
                    id="input-monto-recibido"
                    type="number"
                    step="0.10"
                    min={ordenSeleccionada.monto}
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div className="flex justify-between items-center rounded-lg bg-emerald-100/70 border border-emerald-200 p-2.5">
                  <span className="font-semibold text-emerald-900">Vuelto a entregar:</span>
                  <span className="font-mono text-base font-extrabold text-emerald-950">
                    S/ {vueltoCalculado().toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {metodoPago === "YAPE" && (
              <div className="space-y-3 rounded-xl border border-purple-200 bg-purple-50/40 p-4 text-xs">
                {/* Header descriptivo del método */}
                <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                  <span className="font-bold text-purple-900 uppercase tracking-wider text-[11px]">
                    Pago Yape asistido — Validación por Tesorería
                  </span>
                  <span className="font-mono font-bold text-purple-950 text-xs">
                    Monto exacto: S/ {ordenSeleccionada.monto.toFixed(2)}
                  </span>
                </div>

                {/* QR Local y Datos de la Orden */}
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-purple-200 bg-white p-3">
                  {qrNoDisponible ? (
                    <p role="alert" className="py-8 text-center font-semibold text-rose-800">
                      No se pudo cargar el QR de Yape. Verifique el activo local o utilice pago en efectivo.
                    </p>
                  ) : (
                    <div className="w-full bg-white text-center">
                      <img
                        src={YAPE_QR_SRC}
                        alt="QR Yape para pago asistido"
                        className="mx-auto block h-auto w-[480px] max-w-full bg-white object-contain"
                        onError={() => setQrNoDisponible(true)}
                      />
                    </div>
                  )}
                  {!qrNoDisponible && (
                    <button type="button" onClick={() => setQrAmpliado(true)} className="font-semibold text-purple-800 underline underline-offset-2">
                      Ver QR ampliado
                    </button>
                  )}
                  <div className="text-center">
                    <p className="font-extrabold text-purple-950 text-xs">
                      Código de Orden: <span className="font-mono text-purple-800">{ordenSeleccionada.codigoPago}</span>
                    </p>
                    <p className="text-[11px] text-slate-700 mt-1 italic font-medium">
                      Realice el pago con Yape y presente el número de operación al personal de Tesorería.
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="input-referencia-yape" className="font-bold text-slate-700 block mb-1">
                    Número de operación <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="input-referencia-yape"
                    type="text"
                    placeholder="Ej. 8493021"
                    value={referenciaYape}
                    onChange={(e) => setReferenciaYape(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Ingrese el número de operación emitido por el aplicativo Yape para su validación manual.
                  </p>
                </div>
              </div>
            )}

            {metodoPago === "DEMO_QR" && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-xs">
                {/* Header descriptivo */}
                <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
                      QR Automático — Simulador
                    </span>
                    <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 uppercase">
                      Sandbox
                    </span>
                  </div>
                  <span className="font-mono font-bold text-amber-950 text-xs">
                    Monto: S/ {ordenSeleccionada.monto.toFixed(2)}
                  </span>
                </div>

                <p className="rounded-lg bg-white p-2 text-center font-semibold text-amber-950">
                  SIMULACIÓN · No procesa dinero real.
                </p>

                {configDemoQr && !configDemoQr.configured && (
                  <div className="rounded-xl border border-amber-300 bg-amber-100/70 p-3 text-amber-900">
                    El simulador necesita una URL pública HTTPS para abrirse desde el celular.
                  </div>
                )}

                {errorQr && (
                  <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-800">
                    <p className="font-semibold text-xs">{errorQr}</p>
                    <button
                      type="button"
                      onClick={() => void generarQrDemo(ordenSeleccionada.ordenPagoId)}
                      className="mt-1.5 text-xs font-bold text-rose-900 underline underline-offset-2 hover:text-rose-950"
                    >
                      [Reintentar generación de QR]
                    </button>
                  </div>
                )}

                {generandoQr && (
                  <div className="flex flex-col items-center justify-center p-8 bg-white border border-amber-200 rounded-xl space-y-2">
                    <span className="animate-spin text-2xl text-amber-700">⏳</span>
                    <p className="font-semibold text-xs text-slate-700">
                      Generando enlace de pago simulado...
                    </p>
                  </div>
                )}

                {!generandoQr && ordenSeleccionada.estado === "CONFIRMADO" && (
                  <div className="flex flex-col items-center justify-center p-6 bg-emerald-50 border border-emerald-300 rounded-xl text-center space-y-3">
                    <span className="rounded-full bg-emerald-100 p-3 text-2xl text-emerald-800 font-bold">✓</span>
                    <div>
                      <h3 className="text-sm font-extrabold text-emerald-950">
                        Pago confirmado automáticamente
                      </h3>
                      <p className="text-xs text-emerald-800 mt-1">
                        {ordenSeleccionada.paymentProvider === "DEMO_QR"
                          ? "Confirmación recibida mediante webhook del simulador. No se procesó dinero real."
                          : "El pago fue confirmado automáticamente mediante webhook."}
                      </p>
                      {ordenSeleccionada.codigoRecibo && (
                        <p className="font-mono font-bold text-xs text-emerald-900 mt-1">
                          Comprobante emitido: {ordenSeleccionada.codigoRecibo}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAbrirRecibo(ordenSeleccionada)}
                      className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow-xs"
                    >
                      Ver constancia de pago
                    </button>
                  </div>
                )}

                {!generandoQr && ordenSeleccionada.estado !== "CONFIRMADO" && qrExpirado && (
                  <div className="flex flex-col items-center justify-center p-6 bg-rose-50 border border-rose-300 rounded-xl text-center space-y-2">
                    <p className="text-xs font-bold text-rose-900">QR expirado</p>
                    <p className="text-[11px] text-rose-700">El plazo de 15 minutos del QR ha expirado.</p>
                    <button
                      type="button"
                      onClick={() => void generarQrDemo(ordenSeleccionada.ordenPagoId)}
                      className="rounded-xl bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-800"
                    >
                      Generar nuevo QR
                    </button>
                  </div>
                )}

                {!generandoQr && ordenSeleccionada.estado !== "CONFIRMADO" && !qrExpirado && (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-white p-4">
                    {/* Código QR Dinámico */}
                    <div className="w-full bg-white text-center">
                      {ordenSeleccionada.providerQrImage && ordenSeleccionada.paymentProvider === "DEMO_QR" ? (
                        <img
                          src={ordenSeleccionada.providerQrImage}
                          alt="QR del simulador de pago"
                          className="mx-auto block h-auto w-80 max-w-full object-contain"
                        />
                      ) : (
                        <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-amber-900">
                          El QR aún no está disponible.
                        </p>
                      )}
                    </div>

                    <div className="text-center space-y-1">
                      <p className="font-extrabold text-slate-900 text-xs">
                        Código de Orden: <span className="font-mono text-amber-800">{ordenSeleccionada.codigoPago}</span>
                      </p>
                      <p className="text-xs font-semibold text-slate-800">
                        Escanee este QR desde un celular para abrir el simulador de pago.
                      </p>
                      {ordenSeleccionada.paymentProvider === "DEMO_QR" && ordenSeleccionada.providerCheckoutUrl && (
                        <a href={ordenSeleccionada.providerCheckoutUrl} target="_blank" rel="noreferrer" className="block text-xs font-semibold text-teal-800 underline">
                          Abrir checkout de simulación
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-1.5 text-xs text-amber-900">
                      <span className="animate-spin text-amber-700">⏳</span>
                      <span className="font-medium">Esperando confirmación del pago...</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {errorPago && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800 font-medium">
                {errorPago}
              </div>
            )}

            {/* Acciones */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {metodoPago === "DEMO_QR" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setModalConfirmarAbierto(false)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                  {ordenSeleccionada.estado === "CONFIRMADO" && (
                    <button
                      type="button"
                      onClick={() => handleAbrirRecibo(ordenSeleccionada)}
                      className="rounded-xl bg-blue-800 px-5 py-2 text-xs font-bold text-white hover:bg-blue-900 transition shadow-xs"
                    >
                      Ver constancia
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setModalConfirmarAbierto(false)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={procesandoPago}
                    onClick={() => void ejecutarConfirmarPago()}
                    className="rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition disabled:opacity-50 shadow-xs"
                  >
                    {procesandoPago ? "Validando en Caja..." : "Confirmar pago"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {qrAmpliado && modalConfirmarAbierto && metodoPago === "YAPE" && !qrNoDisponible && (
        <div role="dialog" aria-modal="true" aria-label="QR Yape ampliado" className="fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden bg-slate-900/80 p-4" onClick={() => setQrAmpliado(false)}>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-2xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setQrAmpliado(false)} className="self-end rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800" aria-label="Cerrar QR ampliado">
              ✕
            </button>
            <img src={YAPE_QR_SRC} alt="QR Yape ampliado para pago asistido" className="block h-auto w-[640px] max-w-full object-contain" onError={() => { setQrNoDisponible(true); setQrAmpliado(false); }} />
            <p className="text-center font-medium text-slate-900">Escanee este QR desde Yape y registre el número de operación.</p>
          </div>
        </div>
      )}

      {/* MODAL 2: RECHAZAR ORDEN DE PAGO */}
      {modalRechazarAbierto && ordenSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-base font-bold text-rose-900">
                Rechazar Orden de Pago — {ordenSeleccionada.codigoPago}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Esta acción cancelará la orden actual y quedará registrada en auditoría.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Motivo formal del rechazo:
              </label>
              <textarea
                rows={3}
                placeholder="Indique la causa del rechazo (ej. duplicidad, error en monto o desistimiento del administrado)..."
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-600"
              />
            </div>

            {errorRechazo && (
              <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                {errorRechazo}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalRechazarAbierto(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesandoRechazo}
                onClick={() => void ejecutarRechazarPago()}
                className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 transition disabled:opacity-50"
              >
                {procesandoRechazo ? "Rechazando..." : "Confirmar Rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RECIBO OFICIAL DE TESORERÍA (PRINTABLE VOUCHER) */}
      {modalReciboAbierto && reciboData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4">
            {/* Cabecera del comprobante */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
              <div className="inline-block text-[11px] font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-full mb-1">
                IESTP &quot;SUIZA&quot; — PUCALLPA
              </div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                CONSTANCIA DE PAGO
              </h2>
              <p className="text-xs font-semibold text-slate-600">
                RECIBO INTERNO DE TESORERÍA
              </p>
              <p className="text-[11px] font-mono text-slate-500">RUC: 20496155601</p>
              <p className="text-xs font-mono font-bold text-emerald-800">
                N° COMPROBANTE: {reciboData.codigoRecibo || "REC-2026-PENDIENTE"}
              </p>
            </div>

            {/* Datos del pago */}
            <div className="space-y-2 text-xs text-slate-700 border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha y Hora:</span>
                <span className="font-semibold text-slate-800">{formatearFecha(reciboData.fechaPago || reciboData.fechaCreacion)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Código Orden:</span>
                <span className="font-mono font-bold text-slate-900">{reciboData.codigoPago}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expediente CUT:</span>
                <span className="font-mono font-semibold text-blue-800">{reciboData.codigoExpediente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Administrado:</span>
                <span className="font-semibold text-slate-900">{reciboData.solicitanteNombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Documento:</span>
                <span className="font-mono text-slate-700">{reciboData.documentoEnmascarado}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Concepto:</span>
                <span className="font-medium text-slate-800 text-right">{reciboData.concepto}</span>
              </div>
              {reciboData.codigoTupa && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Procedimiento TUPA:</span>
                  <span className="font-mono text-slate-800">{reciboData.codigoTupa}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Medio de Pago:</span>
                <span className="font-semibold text-slate-900">
                  {reciboData.metodoPago === "EFECTIVO"
                    ? "Efectivo en Ventanilla"
                    : reciboData.metodoPago === "YAPE"
                      ? "Yape / Digital Asistido"
                      : reciboData.paymentProvider === "DEMO_QR"
                        ? "QR Automático — Simulador (sin dinero real)"
                        : "QR Automático — TAYPI Sandbox"}
                </span>
              </div>
              {reciboData.metodoPago === "YAPE" && reciboData.referenciaOperacion && (
                <div className="flex justify-between">
                  <span className="text-slate-500">N° Operación Yape:</span>
                  <span className="font-mono font-bold text-purple-900">{reciboData.referenciaOperacion}</span>
                </div>
              )}
              {reciboData.metodoPago === "QR_AUTOMATICO_SANDBOX" && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Origen confirmación:</span>
                  <span className="font-mono font-bold text-amber-900">
                    {reciboData.paymentProvider === "DEMO_QR" ? "Webhook del simulador" : "Webhook TAYPI"}
                  </span>
                </div>
              )}
              {reciboData.metodoPago === "EFECTIVO" && reciboData.montoRecibido && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Efectivo Entregado:</span>
                  <span className="font-mono">S/ {Number(reciboData.montoRecibido).toFixed(2)}</span>
                </div>
              )}
              {reciboData.metodoPago === "EFECTIVO" && reciboData.vuelto !== null && Number(reciboData.vuelto) > 0 && (
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>Vuelto:</span>
                  <span className="font-mono">S/ {Number(reciboData.vuelto).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Operador:</span>
                <span className="font-semibold text-slate-800">{reciboData.tesoreroNombre || "Tesorería — IESTP Suiza"}</span>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-900 text-sm">TOTAL CANCELADO:</span>
              <span className="font-mono text-lg font-extrabold text-blue-900">
                {reciboData.moneda} {reciboData.monto.toFixed(2)}
              </span>
            </div>

            <div className="text-center text-[10px] text-slate-400">
              ✓ Pago validado por Tesorería. El expediente se encuentra desbloqueado para continuar su trámite.
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalReciboAbierto(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-blue-800 px-4 py-2 text-xs font-bold text-white hover:bg-blue-900 shadow-xs"
              >
                🖨️ Imprimir Recibo
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
