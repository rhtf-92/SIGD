import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  Lock,
  ArrowRight,
  Database,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  TUPA_FORMULARIOS_CONFIG,
  obtenerDefinicionTupa,
} from '../../data/tupaFormulariosConfig';
import type { CategoriaTupa } from '../../data/tupaSuiza2026CatalogoCompleto';
import type { TupaFormDefinition } from '../../types/tupaFormulario.types';
import { CapsuleBadge } from '../../components/common/GlassPanel';
import TupaDynamicFormModal from '../../components/tramite/TupaDynamicFormModal';

export default function CatalogoTupaPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const token = useAuthStore((s) => s.accessToken);
  const esInstitucional =
    usuario?.rol &&
    ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'ESPECIALISTA', 'SECRETARIO'].includes(usuario.rol);

  const [cargando, setCargando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [codigoModal, setCodigoModal] = useState<string>('p1-fila-05');

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

  // Sincronizar con cambios en la URL (ej. navegación desde el Asistente Público)
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

  // 1. Verificar autorización de acceso
  useEffect(() => {
    let activo = true;
    async function verificar() {
      if (!token) {
        setCargando(false);
        setAutorizado(false);
        return;
      }

      if (esInstitucional) {
        if (activo) {
          setAutorizado(true);
          setCargando(false);
        }
        return;
      }

      try {
        const res = await fetch('/api/v1/tramites/tupa/acceso/estado', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (activo) setAutorizado(Boolean(data.autorizado));
        } else {
          if (activo) setAutorizado(false);
        }
      } catch {
        if (activo) setAutorizado(false);
      } finally {
        if (activo) setCargando(false);
      }
    }
    verificar();
    return () => {
      activo = false;
    };
  }, [token, esInstitucional]);

  // 2. Cargar catálogo Data-Driven desde backend si está autorizado
  useEffect(() => {
    if (!autorizado) return;
    let activo = true;

    async function cargarTupaApi() {
      try {
        const res = await fetch('/api/v1/tramites/tupa', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!activo) return;

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

        const rawList: RawTupaItem[] = Array.isArray(data) ? data : data.procedimientos || [];
        if (rawList.length > 0) {
          const mapeados: TupaFormDefinition[] = rawList.map((raw) => {
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
            const generaExp = Boolean(raw.generaExpediente ?? raw.admiteRadicacionSigd ?? raw.admite_radicacion_sigd ?? defBase?.generaExpediente ?? false);
            const unidad = raw.autoridadCompetente || raw.autoridad_competente || defBase?.unidadResponsable || 'IESTP Suiza';
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
              flujoDestino: '/tramite',
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
      } catch {
        // Fallback a catálogo canónico local
      }
    }

    void cargarTupaApi();
    return () => {
      activo = false;
    };
  }, [autorizado, token]);

  const catalogoBase = procedimientosDb || TUPA_FORMULARIOS_CONFIG;

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

  const getCategoriaBadge = (cat: CategoriaTupa) => {
    switch (cat) {
      case 'PROCEDIMIENTO_APROBADO':
        return <CapsuleBadge variant="approved">Procedimiento Aprobado</CapsuleBadge>;
      case 'PROCEDIMIENTO_PENDIENTE':
        return <CapsuleBadge variant="pending">Procedimiento Pendiente</CapsuleBadge>;
      case 'SERVICIO_ACADEMICO':
        return <CapsuleBadge variant="sky">Servicio Académico</CapsuleBadge>;
      case 'SERVICIO_COMERCIAL':
        return <CapsuleBadge variant="legal">Servicio Comercial</CapsuleBadge>;
      case 'BIEN_PRODUCTIVO':
        return <CapsuleBadge variant="amber">Venta de Bien</CapsuleBadge>;
      case 'ACTUACION_INTERNA':
        return <CapsuleBadge variant="slate">Gestión Interna</CapsuleBadge>;
      default:
        return <CapsuleBadge variant="slate">Otro No Radicable</CapsuleBadge>;
    }
  };

  if (cargando) {
    return (
      <main className="min-h-screen min-h-dvh flex items-center justify-center p-4 bg-slate-50">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-cyan-600 border-r-transparent" />
          <p className="text-xs font-semibold text-slate-500">Verificando autorización de acceso al TUPA...</p>
        </div>
      </main>
    );
  }

  // Si no está autorizado -> Bloqueo con enlace a solicitar acceso
  if (!autorizado) {
    return (
      <main className="min-h-screen min-h-dvh flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-cyan-50/20 to-teal-50/15">
        <div className="max-w-lg w-full text-center p-8 rounded-3xl border border-white/80 bg-white/95 shadow-xl space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 border border-rose-200">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Acceso Denegado / Solicitud Requerida</h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              El Catálogo Integral TUPA 2026 no es público y requiere una solicitud de acceso previa debidamente
              autorizada por Mesa de Partes.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 text-left space-y-1">
            <strong>¿Cómo acceder al documento completo?</strong>
            <p>
              Inicie sesión como Ciudadano y formule su solicitud en el portal. Una vez aprobada, podrá consultar las 72
              entradas y completar los formularios dinámicos.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              to="/solicitud-acceso-tupa"
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 text-white font-bold text-xs shadow-xs hover:shadow-cyan-600/30"
            >
              Solicitar Acceso al TUPA <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/tramite"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Volver
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Usuario Autorizado -> Visualización completa de las 72 entradas
  return (
    <main className="min-h-screen min-h-dvh bg-gradient-to-br from-slate-50 via-cyan-50/25 to-teal-50/15 py-10 px-4 sm:px-6 lg:px-8 text-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Cabecera del Catálogo Autorizado */}
        <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-white/90 via-cyan-50/40 to-teal-50/25 p-6 sm:p-8 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_16px_48px_-8px_rgba(6,182,212,0.14)] ring-1 ring-cyan-200/50 backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <CapsuleBadge variant="approved">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Acceso Autorizado ({catalogoBase.length} Entradas Completas)
                </CapsuleBadge>
                {esInstitucional && <CapsuleBadge variant="role">Rol: {usuario?.rol}</CapsuleBadge>}
                {origenDatos === 'BASE_DE_DATOS' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100/80 px-2.5 py-0.5 text-[10px] font-bold text-cyan-800 border border-cyan-300/60">
                    <Database className="h-3 w-3" /> Datos en vivo (DB)
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Catálogo Integral {versionActiva ? versionActiva.codigo : 'TUPA 2026'} — IESTP &quot;Suiza&quot;
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-3xl mt-1">
                Catálogo institucional con las {catalogoBase.length} entradas físicas oficiales debidamente clasificadas y habilitadas con
                el motor de formularios dinámicos especializados.
              </p>
            </div>
            <Link
              to="/tramite"
              className="text-xs font-semibold text-cyan-900 bg-white/90 border border-cyan-200/80 px-4 py-2 rounded-xl shadow-2xs hover:bg-cyan-50 transition shrink-0"
            >
              ← Volver
            </Link>
          </div>

          {/* Filtros dinámicos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-cyan-100">
            <div>
              <label htmlFor="busqueda-tupa" className="text-[11px] font-bold text-slate-700 block mb-1">
                Buscar por denominación o código:
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="busqueda-tupa"
                  type="text"
                  placeholder="Ej. Certificado, Mango, Auditorio, Examen..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full text-xs rounded-xl border border-cyan-200/90 pl-9 pr-3 py-2 bg-white shadow-2xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200/50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="filtro-categoria-tupa" className="text-[11px] font-bold text-slate-700 block mb-1">
                Filtrar por Categoría:
              </label>
              <select
                id="filtro-categoria-tupa"
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value as CategoriaTupa | 'TODAS')}
                className="w-full text-xs rounded-xl border border-cyan-200/90 px-3 py-2 bg-white shadow-2xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200/50"
              >
                <option value="TODAS">Todas las categorías ({catalogoBase.length})</option>
                {(['PROCEDIMIENTO_APROBADO', 'PROCEDIMIENTO_PENDIENTE', 'SERVICIO_ACADEMICO', 'SERVICIO_COMERCIAL', 'BIEN_PRODUCTIVO', 'ACTUACION_INTERNA', 'OTRO_NO_RADICABLE'] as const).map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria} ({catalogoBase.filter((item) => item.categoria === categoria).length})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filtro-radicacion-tupa" className="text-[11px] font-bold text-slate-700 block mb-1">
                ¿Genera Expediente SIGD?:
              </label>
              <select
                id="filtro-radicacion-tupa"
                value={filtroRadicacion}
                onChange={(e) => setFiltroRadicacion(e.target.value as 'TODOS' | 'SI' | 'NO')}
                className="w-full text-xs rounded-xl border border-cyan-200/90 px-3 py-2 bg-white shadow-2xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200/50"
              >
                <option value="TODOS">Todos los tipos ({catalogoBase.length})</option>
                <option value="SI">
                  Sí — Genera Expediente / CUT ({catalogoBase.filter((item) => item.generaExpediente).length})
                </option>
                <option value="NO">
                  No — Servicios, bienes y trámites no radicables ({catalogoBase.filter((item) => !item.generaExpediente).length})
                </option>
              </select>
            </div>
          </div>
        </section>

        {/* Tabla de 72 entradas en contenedor Liquid Glass */}
        <div className="overflow-x-auto rounded-3xl border border-cyan-300/80 shadow-md bg-white/95 ring-1 ring-cyan-400/20 backdrop-blur-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gradient-to-r from-cyan-100/70 via-teal-50/50 to-sky-100/60 text-cyan-950 font-bold border-b border-cyan-200/80">
              <tr>
                <th className="py-3 px-3 w-20">Código</th>
                <th className="py-3 px-3 min-w-[240px]">Denominación y Requisitos</th>
                <th className="py-3 px-3 w-36">Categoría</th>
                <th className="py-3 px-3 w-28">Tipo Formulario</th>
                <th className="py-3 px-3 w-24">Precio Real</th>
                <th className="py-3 px-3 w-24">Unidad</th>
                <th className="py-3 px-3 w-28">Expediente</th>
                <th className="py-3 px-3 w-36 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-100/60 text-slate-700">
              {tupaFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No se encontraron procedimientos o conceptos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                tupaFiltrado.map((def) => (
                  <tr key={def.codigoRef} className="hover:bg-cyan-50/40 transition-colors">
                    {/* Código */}
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap font-bold">
                      {def.codigoRef}
                    </td>

                    {/* Denominación */}
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-900 block leading-snug">{def.denominacion}</span>
                      {def.requisitos.length > 0 ? (
                        <ul className="mt-1 text-[10px] text-slate-500 space-y-0.5 list-disc pl-3">
                          {def.requisitos.map((req, rIdx) => (
                            <li key={rIdx}>{req}</li>
                          ))}
                        </ul>
                      ) : def.bloqueadoParaCiudadano ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold">
                          Interno
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic block mt-0.5">
                          Sin requisitos documentarios
                        </span>
                      )}
                    </td>

                    {/* Categoría */}
                    <td className="py-3 px-3 whitespace-nowrap">{getCategoriaBadge(def.categoria)}</td>

                    {/* Tipo Formulario */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <CapsuleBadge variant="public" className="text-[10px]">
                        {def.tipoFormulario}
                      </CapsuleBadge>
                    </td>

                    {/* Precio Real */}
                    <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                      {def.montoTexto}
                    </td>

                    {/* Unidad */}
                    <td className="py-3 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                      {def.unidadCobro}
                    </td>

                    {/* Genera Expediente */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {def.generaExpediente ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold">
                          Sí (CUT)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 text-[10px] font-semibold">
                          No (SOL)
                        </span>
                      )}
                    </td>

                    {/* Acción / Abrir formulario dinámico */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleAbrirFormulario(def.codigoRef)}
                        disabled={def.bloqueadoParaCiudadano && !esInstitucional}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 hover:from-teal-700 hover:via-cyan-700 hover:to-sky-700 text-white font-bold text-[11px] shadow-xs disabled:opacity-40 transition"
                      >
                        {def.bloqueadoParaCiudadano && !esInstitucional ? (
                          <>
                            <Lock className="h-3 w-3" /> Bloqueado
                          </>
                        ) : (
                          <>
                            Iniciar Trámite <ArrowRight className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
