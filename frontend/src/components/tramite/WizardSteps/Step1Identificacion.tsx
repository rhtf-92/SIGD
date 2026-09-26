/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * SUBVISTA: Paso 1 — Identificación del Solicitante
 * ARCHIVO: src/components/tramite/wizardSteps/Step1Identificacion.tsx
 * ==============================================================================
 */

import React from 'react';
import type { IdentificacionData, TipoDocumentoIdentidad } from '../../../types/tramiteWizardState';

interface Step1IdentificacionProps {
  data: IdentificacionData;
  onChange: (fields: Partial<IdentificacionData>) => void;
  disabled?: boolean;
}

export const Step1Identificacion: React.FC<Step1IdentificacionProps> = ({
  data,
  onChange,
  disabled = false,
}) => {
  const handleTipoDocChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      tipoDocumento: e.target.value as TipoDocumentoIdentidad,
      numeroDocumento: '', // Reiniciar número al cambiar tipo
    });
  };

  const getDocPlaceholder = () => {
    switch (data.tipoDocumento) {
      case 'DNI':
        return '8 dígitos numéricos';
      case 'RUC':
        return '11 dígitos numéricos';
      case 'CE':
        return '9 dígitos alfanuméricos';
      default:
        return 'Número de documento';
    }
  };

  const getMaxDocLength = () => {
    switch (data.tipoDocumento) {
      case 'DNI':
        return 8;
      case 'RUC':
        return 11;
      case 'CE':
        return 12;
      default:
        return 15;
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="text-lg font-bold text-slate-900">
          Paso 1: Identificación del Solicitante
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Ingrese los datos oficiales del administrado conforme al Documento Nacional de Identidad o RUC institucional.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Tipo de Documento */}
        <div>
          <label
            htmlFor="tipoDocumento"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Tipo de Documento *
          </label>
          <select
            id="tipoDocumento"
            name="tipoDocumento"
            value={data.tipoDocumento}
            onChange={handleTipoDocChange}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100"
          >
            <option value="DNI">DNI — Documento Nacional de Identidad</option>
            <option value="CE">CE — Carné de Extranjería</option>
            <option value="RUC">RUC — Registro Único de Contribuyentes</option>
          </select>
        </div>

        {/* Número de Documento */}
        <div>
          <label
            htmlFor="numeroDocumento"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Número de Documento *
          </label>
          <input
            id="numeroDocumento"
            name="numeroDocumento"
            type="text"
            required
            maxLength={getMaxDocLength()}
            placeholder={getDocPlaceholder()}
            value={data.numeroDocumento}
            onChange={(e) => onChange({ numeroDocumento: e.target.value.trim() })}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100 font-mono"
          />
        </div>

        {/* Nombres */}
        <div>
          <label
            htmlFor="nombres"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Nombres Completos / Razón Social *
          </label>
          <input
            id="nombres"
            name="nombres"
            type="text"
            required
            placeholder="Ej. Juan Carlos o Empresa SAC"
            value={data.nombres}
            onChange={(e) => onChange({ nombres: e.target.value })}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100"
          />
        </div>

        {/* Apellidos */}
        <div>
          <label
            htmlFor="apellidos"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Apellidos Completos {data.tipoDocumento === 'RUC' ? '(Opcional)' : '*'}
          </label>
          <input
            id="apellidos"
            name="apellidos"
            type="text"
            placeholder={data.tipoDocumento === 'RUC' ? 'No requerido para RUC' : 'Ej. Pérez Quispe'}
            value={data.apellidos}
            onChange={(e) => onChange({ apellidos: e.target.value })}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100"
          />
        </div>

        {/* Correo Electrónico */}
        <div>
          <label
            htmlFor="correo"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Correo Electrónico Notificable *
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            required
            placeholder="administrado@ejemplo.com"
            value={data.correo}
            onChange={(e) => onChange({ correo: e.target.value.trim() })}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            A este correo se remitirán los acuses de recibo y decretos resolutivos.
          </p>
        </div>

        {/* Teléfono / Celular */}
        <div>
          <label
            htmlFor="telefono"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Teléfono o Celular *
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            required
            maxLength={12}
            placeholder="987654321"
            value={data.telefono}
            onChange={(e) => onChange({ telefono: e.target.value.trim() })}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100 font-mono"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Para avisos y coordinación institucional rápida.
          </p>
        </div>

        {/* Dirección Domiciliaria */}
        <div className="sm:col-span-2">
          <label
            htmlFor="direccion"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Dirección Domiciliaria (Opcional)
          </label>
          <input
            id="direccion"
            name="direccion"
            type="text"
            placeholder="Av. Principal N° 123, Pucallpa, Ucayali"
            value={data.direccion ?? ''}
            onChange={(e) => onChange({ direccion: e.target.value })}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100"
          />
        </div>
      </div>
    </div>
  );
};

export default Step1Identificacion;
