import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, RotateCcw, Search, X } from 'lucide-react';
import {
  buscarProcedimientosEnCatalogo,
  obtenerCatalogoVigenteAsistente,
} from '../../../services/procedimientosTupa.service';
import type { ProcedimientoTupaBusqueda } from '../types';
import { TupaResultCard } from './TupaResultCard';

interface TupaSearchInlineProps {
  onBack: () => void;
  onClose: () => void;
  onErrorChange?: (hasError: boolean) => void;
}

export const TupaSearchInline: React.FC<TupaSearchInlineProps> = ({
  onBack,
  onClose,
  onErrorChange,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [termino, setTermino] = useState('');
  const [catalogo, setCatalogo] = useState<ProcedimientoTupaBusqueda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);

  const cargarCatalogo = useCallback((forzar = false) => {
    if (forzar) {
      setCargando(true);
      setErrorCarga(false);
    }
    onErrorChange?.(false);
    obtenerCatalogoVigenteAsistente(undefined, forzar)
      .then((datos) => {
        setCatalogo(datos);
        setCargando(false);
        onErrorChange?.(false);
      })
      .catch(() => {
        setErrorCarga(true);
        setCargando(false);
        onErrorChange?.(true);
      });
  }, [onErrorChange]);

  // Cargar el catálogo al montar
  useEffect(() => {
    cargarCatalogo(false);
  }, [cargarCatalogo]);

  const resultados = buscarProcedimientosEnCatalogo(catalogo, termino);
  const busquedaActiva = termino.trim().length > 0;
  const sinResultados = busquedaActiva && resultados.length === 0 && !cargando && !errorCarga;

  const handleLimpiar = () => {
    setTermino('');
    inputRef.current?.focus();
  };

  const handleVerCompleto = () => {
    navigate('/tupa');
    onClose();
  };

  return (
    <div className="space-y-3.5 my-2">
      {/* Estado error al cargar catálogo — Cumplimiento estricto Sección 15 */}
      {errorCarga ? (
        <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-4 text-center space-y-3 shadow-2xs">
          <div className="flex items-center justify-center gap-2 text-rose-800 text-xs sm:text-sm font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>No fue posible consultar el Catálogo TUPA en este momento.</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => cargarCatalogo(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition min-h-[40px] shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
            <button
              type="button"
              onClick={handleVerCompleto}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition min-h-[40px]"
            >
              <span>Ir al Catálogo TUPA</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition min-h-[40px]"
            >
              <span>← Volver</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Campo de búsqueda controlado (único input del asistente) */}
          <div className="relative">
            <label
              htmlFor="chatbot-tupa-search-input"
              className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
            >
              Buscar procedimiento TUPA
            </label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                id="chatbot-tupa-search-input"
                ref={inputRef}
                type="text"
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
                placeholder="Ej. certificado ingles, mango, p2-fila-09..."
                aria-label="Buscar procedimiento TUPA"
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl pl-9 pr-9 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition min-h-[44px]"
              />
              {termino && (
                <button
                  type="button"
                  onClick={handleLimpiar}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-md transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Estado cargando catálogo */}
          {cargando && (
            <div className="text-center py-4 text-xs text-slate-500 font-medium">
              Cargando catálogo oficial TUPA...
            </div>
          )}

          {/* Resultados encontrados */}
          {busquedaActiva && resultados.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[11px] font-medium text-slate-500">
                {resultados.length}{' '}
                {resultados.length === 1 ? 'procedimiento encontrado' : 'procedimientos encontrados'}:
              </p>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {resultados.map((proc) => (
                  <TupaResultCard
                    key={proc.codigoRef || proc.registroVersionId}
                    procedimiento={proc}
                    onSelect={onClose}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Estado sin resultados */}
          {sinResultados && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-center space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-amber-800 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>No encontré un procedimiento con ese término en el Catálogo TUPA vigente.</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleLimpiar}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition min-h-[40px]"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Intentar otra búsqueda</span>
                </button>
                <button
                  type="button"
                  onClick={handleVerCompleto}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition min-h-[40px]"
                >
                  <span>Ver Catálogo TUPA completo</span>
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition min-h-[40px]"
                >
                  <span>← Volver</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
