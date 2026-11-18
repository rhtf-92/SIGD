import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  Lock,
  ArrowRight,
  Database,
  Clock,
  Coins,
  Building,
  FileText,
  ChevronDown,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  TUPA_FORMULARIOS_CONFIG,
  obtenerDefinicionTupa,
} from '../../data/tupaFormulariosConfig';
import type { CategoriaTupa } from '../../data/tupaSuiza2026CatalogoCompleto';
import type { TupaFormDefinition } from '../../types/tupaFormulario.types';
import TupaDynamicFormModal from '../../components/tramite/TupaDynamicFormModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { TechnicalDetails } from '../../components/ui/TechnicalDetails';
import { ContextualHelp } from '../../components/ui/ContextualHelp';

interface RawTupaItem {
  id?: string;
  id_procedimiento?: string;
  codigo?: string;
  codigoRef?: string;
  denominacion?: string;
  categoria?: string;
  clasificacion?: string;
  requisitos?: string[];
  monto?: number | string;
  costoSoles?: number;
  plazoDiasHabiles?: number;
  plazo_dias_habiles?: number;
  autoridadCompetente?: string;
  autoridad_competente?: string;
  admiteRadicacionSigd?: boolean;
  admite_radicacion_sigd?: boolean;
  generaExpediente?: boolean;
}

export default function CatalogoTupaPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const token = useAuthStore((s) => s.accessToken);
  const esInstitucional =
    usuario?.rol &&
    ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'ESPECIALISTA', 'SECRETARIO'].includes(usuario.rol);

  const [cargando, setCargando] = useState(true);
  const [tieneAccesoPdfOficial, setTieneAccesoPdfOficial] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [codigoModal, setCodigoModal] = useState<string>('p1-fila-05');
  const [requisitosExpandidos, setRequisitosExpandidos] = useState<Record<string, boolean>>({});

  // Datos vivos desde la API PostgreSQL
  const [procedimientosDb, setProcedimientosDb] = useState<TupaFormDefinition[] | null>(null);
  const [versionActiva, setVersionActiva] = useState<{ codigo: string; anio: number } | null>(null);
  const [origenDatos, setOrigenDatos] = useState<'BASE_DE_DATOS' | 'CATALOGO_CANONICO'>('CATALOGO_CANONICO');

  const [searchParams] = useSearchParams();
  const paramProcedimiento = searchParams.get('procedimiento') || searchParams.get('search') || '';

  // Filtros
  const [busqueda, setBusqueda] = useState(paramProcedimiento);
  const [busquedaDebounced, setBusquedaDebounced] = useState(paramProcedimiento);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<CategoriaTupa | 'TODAS'>('TODAS');
  const [filtroRadicacion, setFiltroRadicacion] = useState<'TODOS' | 'SI' | 'NO'>('TODOS');

  // Sincronizar con cambios en la URL
  useEffect(() => {
    if (paramProcedimiento) {
      setBusqueda(paramProcedimiento);
      setBusquedaDebounced(paramProcedimiento);
    }
  }, [paramProcedimiento]);

  // Debounce de 250ms en la búsqueda de procedimientos
  useEffect(() => {
    const handler = setTimeout(() => {
      setBusquedaDebounced(busqueda);
    }, 250);
    return () => clearTimeout(handler);
  }, [busqueda]);

  // 1. Cargar catálogo de procedimientos TUPA (público sin requerir autenticación)
  useEffect(() => {
    let activo = true;

    async function cargarCatalogo() {
      setCargando(true);
      try {
        const url = token && esInstitucional
          ? '/api/v1/tramites/tupa'
          : '/api/v1/tramites/tupa?publico=true';

        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.ok) {
          const data = await res.json();
          if (!activo) return;

          const rawList: RawTupaItem[] = Array.isArray(data) ? data : data.procedimientos || [];
          if (rawList.length > 0) {
            const mapeados: TupaFormDefinition[] = rawList
              .filter((raw) => esInstitucional || raw.categoria !== 'ACTUACION_INTERNA')
              .map((raw) => {
                const codRef = raw.codigoRef || raw.codigo || raw.id || '';
                const defBase = obtenerDefinicionTupa(codRef);

                const montoNum = Number(raw.costoSoles ?? (typeof raw.monto === 'number' ? raw.monto : 0));
                const montoTexto =
                  typeof raw.monto === 'string' && raw.monto.length > 0
                    ? raw.monto
                    : montoNum > 0
                    ? `S/ ${montoNum.toFixed(2)}`
                    : 'Gratuito';

                const plazoNum = raw.plazoDiasHabiles ?? raw.plazo_dias_habiles;
                const plazoTexto = plazoNum ? `${plazoNum} días hábiles` : defBase?.plazo || '30 días hábiles';
                const reqs = Array.isArray(raw.requisitos) ? raw.requisitos : defBase?.requisitos || [];
                const generaExp = Boolean(
                  raw.generaExpediente ??
                  raw.admiteRadicacionSigd ??
                  raw.admite_radicacion_sigd ??
                  defBase?.generaExpediente ??
                  false
                );
                const unidad =
                  raw.autoridadCompetente ||
                  raw.autoridad_competente ||
                  defBase?.unidadResponsable ||
                  'IESTP Suiza';
                const cat = (raw.categoria || raw.clasificacion || defBase?.categoria || 'PROCEDIMIENTO_APROBADO') as CategoriaTupa;

                if (defBase) {
                  return {
                    ...defBase,
                    denominacion: raw.denominacion || defBase.denominacion,
                    categoria: cat,
                    requisitos: reqs,
                    monto: montoNum,
                    montoTexto,
                    plazo: plazoTexto,
                    unidadResponsable: unidad,
                    generaExpediente: generaExp,
                  };
                }

                return {
                  codigoRef: codRef,
                  denominacion: raw.denominacion || 'Procedimiento sin denominación',
                  categoria: cat,
                  tipoFormulario: 'DOCUMENTARIO',
                  campos: [],
                  requisitos: reqs,
                  monto: montoNum,
                  montoTexto,
                  unidadCobro: 'Trámite',
                  generaExpediente: generaExp,
                  flujoDestino: '/mesa-partes',
                  plazo: plazoTexto,
                  unidadResponsable: unidad,
                  baseLegal: '',
                  bloqueadoParaCiudadano: false,
                  observacion: '',
                };
              });

            setProcedimientosDb(mapeados);
            setOrigenDatos('BASE_DE_DATOS');
            if (data.version) {
              setVersionActiva({
                codigo: data.version.codigo,
                anio: Number(data.version.anio),
              });
            }
          }
        } else {
          // Fallback a catálogo canónico local si la API no está disponible
          if (activo) {
            setProcedimientosDb(
              TUPA_FORMULARIOS_CONFIG.filter((p) => esInstitucional || p.categoria !== 'ACTUACION_INTERNA')
            );
            setOrigenDatos('CATALOGO_CANONICO');
          }
        }
      } catch {
        if (activo) {
          setProcedimientosDb(
            TUPA_FORMULARIOS_CONFIG.filter((p) => esInstitucional || p.categoria !== 'ACTUACION_INTERNA')
          );
          setOrigenDatos('CATALOGO_CANONICO');
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    void cargarCatalogo();
    return () => {
      activo = false;
    };
  }, [token, esInstitucional]);

  // 2. Verificar si el usuario tiene acceso formal para descargar el PDF oficial escaneado
  useEffect(() => {
    let activo = true;

    async function verificarAccesoPdf() {
      if (esInstitucional) {
        if (activo) setTieneAccesoPdfOficial(true);
        return;
      }
      if (!token) {
        if (activo) setTieneAccesoPdfOficial(false);
        return;
      }
      try {
        const res = await fetch('/api/v1/tramites/tupa/acceso/estado', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (activo) setTieneAccesoPdfOficial(Boolean(data.autorizado));
        } else {
          if (activo) setTieneAccesoPdfOficial(false);
        }
      } catch {
        if (activo) setTieneAccesoPdfOficial(false);
      }
    }

    void verificarAccesoPdf();
    return () => {
      activo = false;
    };
  }, [token, esInstitucional]);

  const catalogoBase = useMemo(() => {
    const lista = procedimientosDb || TUPA_FORMULARIOS_CONFIG;
    return esInstitucional ? lista : lista.filter((p) => p.categoria !== 'ACTUACION_INTERNA');
  }, [procedimientosDb, esInstitucional]);

  const tupaFiltrado = useMemo(() => {
    return catalogoBase.filter((item) => {
      // 1. Filtro por texto
      if (busquedaDebounced.trim()) {
        const q = busquedaDebounced.toLowerCase().trim();
        const coincideDenom = item.denominacion.toLowerCase().includes(q);
        const coincideCodigo = item.codigoRef.toLowerCase().includes(q);
        const coincideRequisitos = item.requisitos.some((r) => r.toLowerCase().includes(q));
        if (!coincideDenom && !coincideCodigo && !coincideRequisitos) return false;
      }

      // 2. Filtro por categoría
      if (categoriaSeleccionada !== 'TODAS' && item.categoria !== categoriaSeleccionada) {
        return false;
      }

      // 3. Filtro por radicación SIGD
      if (filtroRadicacion === 'SI' && !item.generaExpediente) return false;
      if (filtroRadicacion === 'NO' && item.generaExpediente) return false;

      return true;
    });
  }, [catalogoBase, busquedaDebounced, categoriaSeleccionada, filtroRadicacion]);

  const handleAbrirFormulario = (codigoRef: string) => {
    setCodigoModal(codigoRef);
    setModalAbierto(true);
  };

  const toggleRequisitos = (codigoRef: string) => {
    setRequisitosExpandidos((prev) => ({
      ...prev,
      [codigoRef]: !prev[codigoRef],
    }));
  };

  const getCategoriaBadge = (cat: CategoriaTupa) => {
    switch (cat) {
      case 'PROCEDIMIENTO_APROBADO':
        return <Badge variant="success">Trámite Oficial</Badge>;
      case 'PROCEDIMIENTO_PENDIENTE':
        return <Badge variant="warning">En Homologación</Badge>;
      case 'SERVICIO_ACADEMICO':
        return <Badge variant="info">Servicio Académico</Badge>;
      case 'SERVICIO_COMERCIAL':
        return <Badge variant="neutral">Alquiler y Servicios</Badge>;
      case 'BIEN_PRODUCTIVO':
        return <Badge variant="warning">Venta de Productos</Badge>;
      case 'ACTUACION_INTERNA':
        return <Badge variant="neutral">Gestión Interna</Badge>;
      default:
        return <Badge variant="neutral">Trámites y Constancias</Badge>;
    }
  };

  const categoriasDisponibles = useMemo(() => {
    const todas = [
      { key: 'PROCEDIMIENTO_APROBADO', label: 'Trámites Oficiales' },
      { key: 'SERVICIO_ACADEMICO', label: 'Servicios Académicos' },
      { key: 'BIEN_PRODUCTIVO', label: 'Venta de Productos' },
      { key: 'SERVICIO_COMERCIAL', label: 'Alquiler y Servicios' },
      { key: 'PROCEDIMIENTO_PENDIENTE', label: 'Trámites en Homologación' },
      { key: 'OTRO_NO_RADICABLE', label: 'Trámites y Orientaciones' },
    ];
    if (esInstitucional) {
      todas.push({ key: 'ACTUACION_INTERNA', label: 'Gestión Interna' });
    }
    return todas;
  }, [esInstitucional]);

  return (
    <main className="w-full bg-surface-page py-4 sm:py-6 px-4 sm:px-6 lg:px-8 text-slate-900">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Cabecera del Catálogo TUPA Oficial */}
        <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xs space-y-3">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Catálogo Público ({catalogoBase.length} Entradas)
                </Badge>
                {esInstitucional && <Badge variant="info">Rol: {usuario?.rol}</Badge>}
                {origenDatos === 'BASE_DE_DATOS' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                    <Database className="h-3 w-3" /> Datos en vivo (DB)
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Catálogo de Procedimientos y Servicios {versionActiva ? versionActiva.codigo : 'TUPA 2026'} — IESTP &quot;Suiza&quot;
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-3xl mt-1 leading-relaxed">
                Consulte requisitos, costos oficiales, plazos de atención y radicación documentaria para todos los procedimientos del instituto.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
              {tieneAccesoPdfOficial ? (
                <a
                  href="/api/v1/tramites/tupa/documento-oficial/descargar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button variant="secondary" size="sm" className="w-full">
                    <FileText className="h-3.5 w-3.5 mr-1" /> Descargar PDF Oficial
                  </Button>
                </a>
              ) : (
                <Link to="/solicitud-acceso-tupa" className="w-full sm:w-auto">
                  <Button variant="secondary" size="sm" className="w-full">
                    <Lock className="h-3.5 w-3.5 mr-1" /> Solicitar Copia Escaneada (PDF)
                  </Button>
                </Link>
              )}
              <Link to="/mesa-partes" className="w-full sm:w-auto">
                <Button variant="primary" size="sm" className="w-full">
                  Mesa de Partes Digital <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
              <Link to="/" className="w-full sm:w-auto">
                <Button variant="ghost" size="sm" className="w-full">
                  ← Volver al inicio
                </Button>
              </Link>
            </div>
          </div>

          {/* Filtros dinámicos estructurados */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
            <div>
              <label htmlFor="busqueda-tupa" className="text-xs font-semibold text-slate-700 block mb-1">
                Buscar por denominación o código:
              </label>
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
                <input
                  id="busqueda-tupa"
                  type="text"
                  placeholder="Ej. Certificado, Inglés, Galpón, Matrícula..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full h-11 min-h-[44px] rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="filtro-categoria-tupa" className="text-xs font-semibold text-slate-700 block mb-1">
                Filtrar por Categoría:
              </label>
              <select
                id="filtro-categoria-tupa"
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value as CategoriaTupa | 'TODAS')}
                className="w-full h-11 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20 focus:outline-none transition"
              >
                <option value="TODAS">Todas las categorías ({catalogoBase.length})</option>
                {categoriasDisponibles.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label} ({catalogoBase.filter((item) => item.categoria === cat.key).length})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1">
                <label htmlFor="filtro-radicacion-tupa" className="text-xs font-semibold text-slate-700">
                  Modalidad de atención:
                </label>
                <ContextualHelp
                  title="Modalidad de atención"
                  content="Los trámites con expediente digital generan un código CUT para seguimiento en línea; los servicios y venta de bienes se gestionan de forma presencial o directa según directiva."
                />
              </div>
              <select
                id="filtro-radicacion-tupa"
                value={filtroRadicacion}
                onChange={(e) => setFiltroRadicacion(e.target.value as 'TODOS' | 'SI' | 'NO')}
                className="w-full h-11 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20 focus:outline-none transition"
              >
                <option value="TODOS">Todas las modalidades ({catalogoBase.length})</option>
                <option value="SI">
                  Con expediente digital / CUT ({catalogoBase.filter((item) => item.generaExpediente).length})
                </option>
                <option value="NO">
                  Atención directa o presencial ({catalogoBase.filter((item) => !item.generaExpediente).length})
                </option>
              </select>
            </div>
          </div>
        </header>

        {/* Estado de Carga con Skeletons */}
        {cargando ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : tupaFiltrado.length === 0 ? (
          <EmptyState
            title="No encontramos procedimientos"
            description="Prueba con otra palabra o restablece los filtros de búsqueda aplicados."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setBusqueda('');
                  setCategoriaSeleccionada('TODAS');
                  setFiltroRadicacion('TODOS');
                }}
              >
                Restablecer filtros
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tupaFiltrado.map((def) => {
              const expandido = Boolean(requisitosExpandidos[def.codigoRef]);

              return (
                <div
                  key={def.codigoRef}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-suiza-primary/40 hover:shadow-xs transition duration-150 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Encabezado de la tarjeta: Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      {getCategoriaBadge(def.categoria)}
                      {def.generaExpediente ? (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                          Genera CUT
                        </span>
                      ) : def.categoria === 'PROCEDIMIENTO_PENDIENTE' ? (
                        <span className="inline-flex items-center rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-bold">
                          Pendiente
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[10px] font-medium">
                          Ficha Informativa
                        </span>
                      )}
                    </div>

                    {/* Denominación Principal */}
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {def.denominacion}
                      </h3>
                    </div>

                    {/* Ficha Resumen de Parámetros: Costo, Plazo, Área */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Coins className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">Costo</p>
                          <p className="font-bold text-slate-900">{def.montoTexto}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">Plazo</p>
                          <p className="font-semibold text-slate-800">{def.plazo}</p>
                        </div>
                      </div>

                      <div className="col-span-2 flex items-center gap-1.5 text-slate-700 pt-1">
                        <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Área Responsable</p>
                          <p className="font-medium text-slate-800 truncate">{def.unidadResponsable}</p>
                        </div>
                      </div>
                    </div>

                    {/* Requisitos / Desplegable Ciudadano */}
                    {def.requisitos.length > 0 ? (
                      <div className="pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleRequisitos(def.codigoRef)}
                          className="w-full flex items-center justify-between text-xs font-semibold text-suiza-primary hover:text-suiza-primary/80 transition cursor-pointer py-1"
                        >
                          <span className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            {expandido ? 'Ocultar requisitos' : `Ver requisitos (${def.requisitos.length})`}
                          </span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform duration-150 ${expandido ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {expandido && (
                          <ul className="mt-2 text-xs text-slate-600 space-y-1 list-disc pl-4 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 animate-in fade-in duration-100">
                            {def.requisitos.map((req, rIdx) => (
                              <li key={rIdx} className="leading-snug">{req}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic pt-1">
                        Sin requisitos documentarios adicionales
                      </p>
                    )}

                    {/* Detalle Técnico: reservado para operadores institucionales */}
                    {esInstitucional && (
                      <div className="pt-2">
                        <TechnicalDetails title="Detalle técnico">
                          <p className="text-xs font-mono text-slate-500">
                            Código de catálogo: {def.codigoRef}
                          </p>
                        </TechnicalDetails>
                      </div>
                    )}
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div className="mt-5 pt-3 border-t border-slate-100">
                    {def.categoria === 'ACTUACION_INTERNA' ? (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-center">
                        <p className="text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 text-slate-500" />
                          Gestión Interna Institucional
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          Actuación administrativa interna del personal del IESTP Suiza. No sujeta a trámite externo.
                        </p>
                      </div>
                    ) : def.categoria === 'PROCEDIMIENTO_PENDIENTE' ? (
                      <div className="rounded-lg bg-amber-50 border border-amber-200/80 p-2.5 text-center">
                        <p className="text-xs font-semibold text-amber-800 flex items-center justify-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          Radicación Digital No Habilitada
                        </p>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-snug">
                          Procedimiento en proceso de homologación técnica reglamentaria para radicación en SIGD.
                        </p>
                      </div>
                    ) : def.generaExpediente ? (
                      <Link
                        to={`/mesa-partes?procedimiento=${encodeURIComponent(def.codigoRef)}`}
                        className="w-full block"
                      >
                        <Button variant="primary" size="md" className="w-full">
                          Iniciar Trámite con CUT <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    ) : esInstitucional ? (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => handleAbrirFormulario(def.codigoRef)}
                        className="w-full"
                      >
                        Registrar en Ventanilla <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Info className="h-3.5 w-3.5 text-suiza-primary shrink-0" />
                          <span className="text-xs font-semibold text-slate-800">
                            Ficha Informativa de Atención
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          Área responsable: <span className="font-medium text-slate-800">{def.unidadResponsable}</span>.
                        </p>
                        {def.plazo && (
                          <p className="text-[11px] text-slate-500 leading-snug">
                            Modalidad / Plazo: {def.plazo}.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Dinámico TUPA */}
      <TupaDynamicFormModal
        key={codigoModal}
        isOpen={modalAbierto}
        codigoInicial={codigoModal}
        onClose={() => setModalAbierto(false)}
      />
    </main>
  );
}
