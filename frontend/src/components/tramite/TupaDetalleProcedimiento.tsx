/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ARCHIVO: src/components/tramite/TupaDetalleProcedimiento.tsx
 * ==============================================================================
 * Tarjeta de solo lectura con la información oficial del procedimiento TUPA.
 * Reutilizada por el asistente (/tramite) y la ventanilla para no duplicar la
 * visualización de datos.
 *
 * NO inventar datos: los campos ausentes simplemente no se renderizan. La fuente
 * nunca se inventa; si el backend no la provee se muestra "No disponible".
 * ==============================================================================
 */

import React from 'react';

import type { ProcedimientoTupa } from '../../types/procedimientoTupa';

export interface TupaDetalleProcedimientoProps {
  procedimiento: ProcedimientoTupa;
  /** Renderiza la lista de requisitos como texto (modo lectura). */
  mostrarRequisitos?: boolean;
  /** Contenido adicional (ej. checklist interactiva de requisitos del profesor). */
  children?: React.ReactNode;
}

export const TupaDetalleProcedimiento: React.FC<TupaDetalleProcedimientoProps> = ({
  procedimiento,
  mostrarRequisitos = true,
  children,
}) => {
  const {
    codigo,
    denominacion,
    requisitos,
    monto,
    fuente,
    version,
    vigencia,
    dependencia,
    autoridad,
    tiempoMaximo,
    detalleTarifas,
    nota,
  } = procedimiento;

  const tieneMetadatos = Boolean(dependencia || autoridad || tiempoMaximo || version || vigencia);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-200 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            TUPA {codigo}: {denominacion}
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Fuente: {fuente && fuente.trim().length > 0 ? fuente : 'No disponible'}
          </p>
        </div>
        {monto && (
          <p className="max-w-xl text-sm font-semibold text-slate-800">Derecho de pago: {monto}</p>
        )}
      </div>

      {mostrarRequisitos && requisitos.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-2 text-xs font-bold uppercase text-slate-700">Requisitos documentarios</h4>
          <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            {requisitos.map((requisito, index) => (
              <li key={`${codigo}-req-${index}`}>{requisito}</li>
            ))}
          </ul>
        </div>
      )}

      {children}

      {detalleTarifas && detalleTarifas.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-2 text-xs font-bold uppercase text-slate-700">Servicios y tarifas</h4>
          <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            {detalleTarifas.map((tarifa) => (
              <li key={`${codigo}-${tarifa}`}>{tarifa}</li>
            ))}
          </ul>
        </div>
      )}

      {tieneMetadatos && (
        <dl className="mt-3 grid gap-2 border-t border-blue-200 pt-3 text-xs sm:grid-cols-3">
          {version && (
            <div>
              <dt className="font-bold text-slate-700">Versión</dt>
              <dd className="mt-0.5 text-slate-600">{version}</dd>
            </div>
          )}
          {vigencia && (
            <div>
              <dt className="font-bold text-slate-700">Vigencia</dt>
              <dd className="mt-0.5 text-slate-600">{vigencia}</dd>
            </div>
          )}
          {dependencia && (
            <div>
              <dt className="font-bold text-slate-700">Dependencia</dt>
              <dd className="mt-0.5 text-slate-600">{dependencia}</dd>
            </div>
          )}
          {autoridad && (
            <div>
              <dt className="font-bold text-slate-700">Autoridad</dt>
              <dd className="mt-0.5 text-slate-600">{autoridad}</dd>
            </div>
          )}
          {tiempoMaximo && (
            <div>
              <dt className="font-bold text-slate-700">Tiempo máximo</dt>
              <dd className="mt-0.5 text-slate-600">{tiempoMaximo}</dd>
            </div>
          )}
        </dl>
      )}

      {nota && <p className="mt-3 text-xs text-slate-600">{nota}</p>}
    </div>
  );
};

export default TupaDetalleProcedimiento;
