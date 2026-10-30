/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ARCHIVO: src/components/tramite/SelectorTupaCategorias.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Selector institucional responsivo de procedimientos TUPA organizado por
 * categorías oficiales con buscador reactivo insensible a tildes y mayúsculas.
 *
 * Características:
 * - Búsqueda tolerante a acentos (ej. "ingles" -> Certificado de Inglés).
 * - Búsqueda por código oficial (ej. "p1-fila-06"), denominación o palabra clave.
 * - Clasificación en las 7 categorías oficiales del TUPA 2026.
 * - Accordion colapsable / expandible por categoría con conteo de elementos.
 * - Adaptación 100% responsiva (Desktop, Laptop 1366x768, Tablet, Mobile) sin
 *   desbordamiento horizontal ni truncamiento de títulos.
 * - Soporte para selección de "Trámite no TUPA / Documentación general".
 * ==============================================================================
 */

import React, { useId, useMemo, useState } from 'react';
import { obtenerDefinicionTupa } from '../../data/tupaFormulariosConfig';

export interface ProcedimientoSelectorItem {
  readonly registroVersionId: string;
  readonly codigo?: string | null;
  readonly denominacion: string;
  readonly monto?: string | null;
  readonly plazo?: string | null;
  readonly requisitos?: readonly string[];
  readonly categoria?: string;
  readonly unidadResponsable?: string;
  readonly fuente?: {
    readonly referenciaFila?: string;
    readonly nombre?: string;
    readonly pagina?: number;
  };
}

export interface SelectorTupaCategoriasProps {
  readonly procedimientos: readonly ProcedimientoSelectorItem[];
  readonly value: string;
  readonly onChange: (registroVersionId: string) => void;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly id?: string;
  readonly permitirNoTupa?: boolean;
  readonly onBlur?: () => void;
}

export interface CategoriaConfig {
  readonly id: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly icono: string;
}

export const CATEGORIAS_OFICIALES: readonly CategoriaConfig[] = [
  {
    id: 'PROCEDIMIENTO_APROBADO',
    titulo: 'Procedimientos Administrativos y Certificaciones',
    descripcion: 'Trámites vigentes con CUT institucional y legajo documentario formal.',
    icono: '📜',
  },
  {
    id: 'SERVICIO_ACADEMICO',
    titulo: 'Servicios Académicos y Capacitación',
    descripcion: 'Certificaciones, exámenes de suficiencia, rectificaciones y programas.',
    icono: '🎓',
  },
  {
    id: 'SERVICIO_COMERCIAL',
    titulo: 'Servicios Comerciales y Alquileres',
    descripcion: 'Alquiler de ambientes, auditorio, infraestructura y maquinaria.',
    icono: '🏢',
  },
  {
    id: 'BIEN_PRODUCTIVO',
    titulo: 'Bienes y Productos Agropecuarios',
    descripcion: 'Venta de productos agropecuarios y forestales de los centros productivos.',
    icono: '🌾',
  },
  {
    id: 'ACTUACION_INTERNA',
    titulo: 'Actuaciones y Gestiones Internas',
    descripcion: 'Prácticas iniciales/intermedias, colación y gestiones académicas internas.',
    icono: '🏛️',
  },
  {
    id: 'PROCEDIMIENTO_PENDIENTE',
    titulo: 'Procedimientos en Evaluación',
    descripcion: 'Trámites en fase de homologación normativa y validación directiva.',
    icono: '⏳',
  },
  {
    id: 'OTRO_NO_RADICABLE',
    titulo: 'Otros Trámites y Disposiciones',
    descripcion: 'Disposiciones arancelarias especiales y pagos institucionales complementarios.',
    icono: '📋',
  },
];

/** Normaliza texto removiendo tildes, signos diacríticos y espacios sobrantes para búsqueda */
export function normalizarParaBusqueda(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Resuelve la categoría canónica de un procedimiento */
export function resolverCategoriaProcedimiento(item: ProcedimientoSelectorItem): string {
  if (item.categoria && item.categoria.trim().length > 0) {
    return item.categoria;
  }
  const ref = item.fuente?.referenciaFila || item.codigo || '';
  if (ref) {
    const def = obtenerDefinicionTupa(ref);
    if (def?.categoria) return def.categoria;
  }
  return 'PROCEDIMIENTO_APROBADO';
}

export const SelectorTupaCategorias: React.FC<SelectorTupaCategoriasProps> = ({
  procedimientos,
  value,
  onChange,
  disabled = false,
  error,
  id: idProp,
  permitirNoTupa = true,
  onBlur,
}) => {
  const generatedId = useId();
  const inputId = idProp || `selector-tupa-${generatedId}`;

  const [busqueda, setBusqueda] = useState('');
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<Record<string, boolean>>(() => {
    // Por defecto, categoría PROCEDIMIENTO_APROBADO abierta
    return { PROCEDIMIENTO_APROBADO: true };
  });

  const textoBusquedaNormalizado = useMemo(() => normalizarParaBusqueda(busqueda), [busqueda]);

  // Procedimiento actualmente seleccionado
  const itemSeleccionado = useMemo(() => {
    if (value === 'NO_TUPA') return null;
    return procedimientos.find((p) => p.registroVersionId === value) ?? null;
  }, [procedimientos, value]);

  // Si hay un procedimiento seleccionado al montar o cambiar, asegurarse de que su categoría esté abierta
  React.useEffect(() => {
    if (itemSeleccionado) {
      const cat = resolverCategoriaProcedimiento(itemSeleccionado);
      setCategoriasAbiertas((prev) => ({ ...prev, [cat]: true }));
    }
  }, [itemSeleccionado]);

  // Filtro de procedimientos según texto de búsqueda
  const procedimientosFiltrados = useMemo(() => {
    if (!textoBusquedaNormalizado) return procedimientos;

    const terminos = textoBusquedaNormalizado.split(/\s+/).filter(Boolean);

    return procedimientos.filter((p) => {
      const ref = p.fuente?.referenciaFila || '';
      const cod = p.codigo || '';
      const den = p.denominacion || '';
      const monto = p.monto || '';
      const reqs = (p.requisitos || []).join(' ');
      const def = obtenerDefinicionTupa(ref || cod);
      const unidad = def?.unidadResponsable || '';

      const corpus = normalizarParaBusqueda(`${ref} ${cod} ${den} ${monto} ${reqs} ${unidad}`);
      return terminos.every((termino) => corpus.includes(termino));
    });
  }, [procedimientos, textoBusquedaNormalizado]);

  // Agrupación por categoría
  const agrupadosPorCategoria = useMemo(() => {
    const mapa = new Map<string, ProcedimientoSelectorItem[]>();

    for (const cat of CATEGORIAS_OFICIALES) {
      mapa.set(cat.id, []);
    }

    for (const item of procedimientosFiltrados) {
      const catId = resolverCategoriaProcedimiento(item);
      const lista = mapa.get(catId);
      if (lista) {
        lista.push(item);
      } else {
        // Categoría desconocida fallback a PROCEDIMIENTO_APROBADO
        const fallback = mapa.get('PROCEDIMIENTO_APROBADO');
        if (fallback) fallback.push(item);
      }
    }

    return mapa;
  }, [procedimientosFiltrados]);

  // Conteo total de coincidencias
  const totalCoincidencias = procedimientosFiltrados.length;

  // Si el usuario escribe una búsqueda, expandir automáticamente las categorías que contengan resultados
  React.useEffect(() => {
    if (textoBusquedaNormalizado.length > 0) {
      const nuevoEstado: Record<string, boolean> = {};
      agrupadosPorCategoria.forEach((items, catId) => {
        if (items.length > 0) {
          nuevoEstado[catId] = true;
        }
      });
      setCategoriasAbiertas(nuevoEstado);
    }
  }, [textoBusquedaNormalizado, agrupadosPorCategoria]);

  const toggleCategoria = (catId: string) => {
    setCategoriasAbiertas((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const handleSeleccionar = (registroVersionId: string) => {
    if (disabled) return;
    onChange(registroVersionId);
  };

  const coincideNoTupa = useMemo(() => {
    if (!permitirNoTupa) return false;
    if (!textoBusquedaNormalizado) return true;
    const terminos = textoBusquedaNormalizado.split(/\s+/).filter(Boolean);
    const corpus = normalizarParaBusqueda('tramite no tupa documentacion general oficio petitorio solicitud');
    return terminos.every((t) => corpus.includes(t));
  }, [permitirNoTupa, textoBusquedaNormalizado]);

  return (
    <div className="w-full max-w-full space-y-3" onBlur={onBlur}>
      {/* Campo de Búsqueda reactivo */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          id={inputId}
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          disabled={disabled}
          placeholder="Buscar por trámite (ej. inglés), código (ej. p1-fila-06) o palabra clave..."
          className={`w-full pl-10 pr-20 py-2.5 text-xs sm:text-sm rounded-xl border bg-white shadow-2xs placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
              : 'border-slate-300 focus:border-[#006EC7] focus:ring-[#006EC7]/20 text-slate-900'
          } disabled:bg-slate-100 disabled:cursor-not-allowed`}
          aria-label="Buscar procedimiento en catálogo TUPA"
        />
        {busqueda.length > 0 && (
          <button
            type="button"
            onClick={() => setBusqueda('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-semibold text-slate-400 hover:text-slate-700 transition"
            aria-label="Limpiar búsqueda"
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Indicador de resumen y conteo */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 gap-1">
        <span>
          {textoBusquedaNormalizado
            ? `${totalCoincidencias} ${totalCoincidencias === 1 ? 'coincidencia' : 'coincidencias'} para "${busqueda}"`
            : `${procedimientos.length} procedimientos disponibles en el catálogo`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const allOpen: Record<string, boolean> = {};
              CATEGORIAS_OFICIALES.forEach((c) => (allOpen[c.id] = true));
              setCategoriasAbiertas(allOpen);
            }}
            className="text-[11px] text-[#006EC7] hover:underline font-medium"
          >
            Expandir todo
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => setCategoriasAbiertas({})}
            className="text-[11px] text-slate-500 hover:underline font-medium"
          >
            Colapsar todo
          </button>
        </div>
      </div>

      {/* Contenedor scrolleable con categorías en acordeón */}
      <div
        className="w-full max-w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2 sm:p-3 max-h-[380px] sm:max-h-[420px] overflow-y-auto space-y-2.5 shadow-inner"
        role="region"
        aria-label="Listado de categorías TUPA"
      >
        {/* Opción Trámite no TUPA (si está habilitado y coincide) */}
        {permitirNoTupa && coincideNoTupa && (
          <div
            onClick={() => handleSeleccionar('NO_TUPA')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSeleccionar('NO_TUPA');
              }
            }}
            className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
              value === 'NO_TUPA'
                ? 'border-[#006EC7] bg-blue-50/90 text-blue-950 ring-2 ring-[#006EC7]/20 shadow-xs'
                : 'border-slate-200 bg-white hover:bg-slate-100/80 text-slate-800'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base" aria-hidden="true">
                  📝
                </span>
                <span className="font-bold text-xs sm:text-sm text-slate-900 break-words">
                  Trámite no TUPA / documentación general
                </span>
              </div>
              <p className="text-xs text-slate-500 break-words">
                Para solicitudes dirigidas a la Dirección, oficios administrativos o trámites no tarifados en el TUPA.
              </p>
              <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                  Gratuito / Libre
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">Mesa de Partes</span>
              </div>
            </div>
            <div className="shrink-0 pt-0.5">
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                  value === 'NO_TUPA'
                    ? 'bg-[#006EC7] text-white ring-2 ring-[#006EC7]/30'
                    : 'border border-slate-300 text-transparent'
                }`}
              >
                ✓
              </span>
            </div>
          </div>
        )}

        {/* Categorías Oficiales */}
        {CATEGORIAS_OFICIALES.map((categoria) => {
          const itemsDeCategoria = agrupadosPorCategoria.get(categoria.id) || [];
          if (itemsDeCategoria.length === 0) return null;

          const estaAbierta = Boolean(categoriasAbiertas[categoria.id]);
          const contieneSeleccion = itemsDeCategoria.some((i) => i.registroVersionId === value);

          return (
            <div
              key={categoria.id}
              className={`rounded-xl border transition overflow-hidden ${
                contieneSeleccion
                  ? 'border-blue-300 bg-white shadow-2xs'
                  : 'border-slate-200 bg-white shadow-2xs'
              }`}
            >
              {/* Header de Categoría (botón toggle) */}
              <button
                type="button"
                onClick={() => toggleCategoria(categoria.id)}
                className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 bg-slate-50/80 hover:bg-slate-100 transition focus-visible:outline-2 focus-visible:outline-[#006EC7]"
                aria-expanded={estaAbierta}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0" aria-hidden="true">
                    {categoria.icono}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {categoria.titulo}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-700">
                        {itemsDeCategoria.length}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-slate-400 font-bold text-xs shrink-0">
                  {estaAbierta ? '▾' : '▸'}
                </span>
              </button>

              {/* Items dentro de la categoría */}
              {estaAbierta && (
                <div className="p-2 sm:p-2.5 space-y-2 border-t border-slate-100 bg-white">
                  {itemsDeCategoria.map((item) => {
                    const seleccionado = item.registroVersionId === value;
                    const codigoVisible = item.fuente?.referenciaFila || item.codigo || 'TUPA';
                    const def = obtenerDefinicionTupa(codigoVisible);
                    const unidad = def?.unidadResponsable || item.unidadResponsable || null;
                    const plazo = def?.plazo || item.plazo || null;

                    return (
                      <div
                        key={item.registroVersionId}
                        onClick={() => handleSeleccionar(item.registroVersionId)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSeleccionar(item.registroVersionId);
                          }
                        }}
                        className={`w-full text-left p-2.5 sm:p-3 rounded-lg border transition cursor-pointer flex items-start justify-between gap-3 ${
                          seleccionado
                            ? 'border-[#006EC7] bg-blue-50/90 text-blue-950 ring-2 ring-[#006EC7]/20 shadow-xs'
                            : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100/70 text-slate-800'
                        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-100/80 text-blue-900 border border-blue-200">
                              {codigoVisible}
                            </span>
                            {item.monto ? (
                              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-100/80 text-emerald-900 border border-emerald-200">
                                {item.monto}
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                Gratuito
                              </span>
                            )}
                            {plazo && (
                              <span className="text-[11px] text-slate-500 hidden sm:inline">
                                · {plazo}
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug break-words">
                            {item.denominacion}
                          </h4>

                          {unidad && (
                            <p className="text-[11px] text-slate-500 truncate">
                              Área: <span className="font-medium text-slate-700">{unidad}</span>
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 pt-0.5">
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                              seleccionado
                                ? 'bg-[#006EC7] text-white ring-2 ring-[#006EC7]/30'
                                : 'border border-slate-300 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {totalCoincidencias === 0 && (!permitirNoTupa || !coincideNoTupa) && (
          <div className="p-6 text-center text-slate-500 space-y-1">
            <p className="text-sm font-semibold text-slate-700">No se encontraron procedimientos</p>
            <p className="text-xs">
              No hay trámites que coincidan con &ldquo;{busqueda}&rdquo;. Intente con otro término o seleccione trámite general.
            </p>
          </div>
        )}
      </div>

      {/* Procedimiento actualmente seleccionado (resumen visual de confirmación) */}
      {itemSeleccionado && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 flex items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-blue-800 font-bold">Seleccionado:</span>
              <span className="font-mono font-bold text-blue-900 bg-blue-100 px-1.5 py-0.2 rounded text-[11px]">
                {itemSeleccionado.fuente?.referenciaFila || itemSeleccionado.codigo || 'TUPA'}
              </span>
            </div>
            <p className="font-semibold text-slate-900 truncate">
              {itemSeleccionado.denominacion}
            </p>
          </div>
          <span className="text-emerald-800 font-bold shrink-0 text-xs bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
            {itemSeleccionado.monto || 'Gratuito'}
          </span>
        </div>
      )}

      {value === 'NO_TUPA' && (
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-2.5 flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-slate-800">
            Seleccionado: <strong>Trámite no TUPA / Documentación general</strong>
          </span>
          <span className="text-slate-600 font-bold bg-slate-200 px-2 py-0.5 rounded-full text-[11px]">
            Sin costo TUPA
          </span>
        </div>
      )}
    </div>
  );
};

export default SelectorTupaCategorias;
