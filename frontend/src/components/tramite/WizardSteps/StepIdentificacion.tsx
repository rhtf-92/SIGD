/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-15 — Subvista Modular 1: Identificación del Solicitante
 * ARCHIVO: src/components/tramite/WizardSteps/StepIdentificacion.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Subvista desacoplada para la captura y validación reactiva de la identidad oficial
 * del administrado (DNI, CE, RUC) conforme a la Ley N° 27444 (LPAG).
 *
 * Características:
 * - Validación reactiva inmediata por tipo de documento oficial.
 * - Accesibilidad WCAG 2.1 AA (etiquetas asociadas, estados de error y foco visible).
 * - Cero 'any', 100% tipado estricto con contratos de tramiteWizardState.ts.
 * ==============================================================================
 */

import React, { useId, useMemo, useState, useRef, useEffect } from 'react';
import type {
  IdentificacionData,
  TipoDocumentoIdentidad,
  WizardAction,
} from '../../../types/tramiteWizardState';

export interface StepIdentificacionProps {
  /** Datos reactivos del paso de identificación */
  data: IdentificacionData;
  /** Despachador de acciones atómicas hacia el reducer del wizard */
  dispatch: React.Dispatch<WizardAction>;
  /** Callback para avanzar al siguiente paso del asistente */
  onNext: () => void;
  /** Callback opcional para retroceder al paso anterior */
  onBack?: () => void;
  /** Indicador de procesamiento asíncrono o bloqueo de formulario */
  isSubmitting?: boolean;
}

export const StepIdentificacion: React.FC<StepIdentificacionProps> = ({
  data,
  dispatch,
  onNext,
  onBack,
  isSubmitting = false,
}) => {
  const formId = useId();
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  // Foco accesible inicial en el primer campo interactivo del formulario
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // ===========================================================================
  // VALIDACIÓN REACTIVA EN TIEMPO REAL
  // ===========================================================================
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};

    // Validación de Número de Documento según el tipo
    const numDoc = data.numeroDocumento.trim();
    if (!numDoc) {
      errs.numeroDocumento = 'El número de documento de identidad es obligatorio.';
    } else {
      switch (data.tipoDocumento) {
        case 'DNI':
          if (!/^[0-9]{8}$/.test(numDoc)) {
            errs.numeroDocumento = 'El DNI debe contener exactamente 8 dígitos numéricos.';
          }
          break;
        case 'RUC':
          if (!/^(10|15|17|20)[0-9]{9}$/.test(numDoc)) {
            errs.numeroDocumento = 'El RUC debe tener 11 dígitos numéricos y comenzar con 10, 15, 17 o 20.';
          }
          break;
        case 'CE':
          if (!/^[a-zA-Z0-9]{6,12}$/.test(numDoc)) {
            errs.numeroDocumento = 'El Carné de Extranjería debe tener entre 6 y 12 caracteres alfanuméricos.';
          }
          break;
      }
    }

    // Nombres / Razón Social
    const nombres = data.nombres.trim();
    if (!nombres) {
      errs.nombres =
        data.tipoDocumento === 'RUC'
          ? 'La Razón Social o denominación institucional es obligatoria.'
          : 'Los nombres completos del administrado son obligatorios.';
    } else if (nombres.length < 2) {
      errs.nombres = 'Debe ingresar al menos 2 caracteres válidos.';
    }

    // Apellidos (Obligatorio salvo que sea RUC)
    const apellidos = data.apellidos.trim();
    if (data.tipoDocumento !== 'RUC') {
      if (!apellidos) {
        errs.apellidos = 'Los apellidos completos del administrado son obligatorios.';
      } else if (apellidos.length < 2) {
        errs.apellidos = 'Debe ingresar al menos 2 caracteres válidos.';
      }
    }

    // Correo Electrónico
    const correo = data.correo.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correo) {
      errs.correo = 'El correo electrónico es obligatorio para recibir notificaciones legales.';
    } else if (!emailRegex.test(correo)) {
      errs.correo = 'Ingrese un formato de correo electrónico válido (ej. usuario@ejemplo.com).';
    }

    // Teléfono / Celular
    const telefono = data.telefono.trim();
    if (!telefono) {
      errs.telefono = 'El teléfono o celular es obligatorio para alertas procesales.';
    } else if (!/^[0-9]{7,12}$/.test(telefono)) {
      errs.telefono = 'Ingrese un número telefónico o celular válido (entre 7 y 12 dígitos).';
    }

    return errs;
  }, [data]);

  const isValid = Object.keys(errors).length === 0;

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleFieldChange = (field: keyof IdentificacionData, value: string) => {
    dispatch({
      type: 'UPDATE_IDENTIFICACION',
      payload: { [field]: value },
    });
  };

  const handleTipoDocChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoTipo = e.target.value as TipoDocumentoIdentidad;
    dispatch({
      type: 'UPDATE_IDENTIFICACION',
      payload: {
        tipoDocumento: nuevoTipo,
        numeroDocumento: '', // Resetea el número para evitar inconsistencias
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Marcar todos como tocados para revelar errores si los hubiera
    setTouched({
      numeroDocumento: true,
      nombres: true,
      apellidos: true,
      correo: true,
      telefono: true,
    });

    if (isValid && !isSubmitting) {
      onNext();
    }
  };

  return (
    <form
      id={`${formId}-form`}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      <header className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
          Paso 1 de 4
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
          Identificación del Solicitante
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Consigne sus datos de identidad oficial y contacto formal. Sus datos están protegidos conforme a la Ley N° 29733 y el TUO de la Ley N° 27444.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* 1. Tipo de Documento */}
        <div>
          <label
            htmlFor={`${formId}-tipoDocumento`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Tipo de Documento Oficial <span className="text-red-600">*</span>
          </label>
          <select
            ref={firstFieldRef}
            autoFocus
            id={`${formId}-tipoDocumento`}
            name="tipoDocumento"
            value={data.tipoDocumento}
            onChange={handleTipoDocChange}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100 cursor-pointer"
          >
            <option value="DNI">DNI — Documento Nacional de Identidad</option>
            <option value="CE">CE — Carné de Extranjería</option>
            <option value="RUC">RUC — Registro Único de Contribuyentes</option>
          </select>
        </div>

        {/* 2. Número de Documento */}
        <div>
          <label
            htmlFor={`${formId}-numeroDocumento`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Número de Documento <span className="text-red-600">*</span>
          </label>
          <input
            id={`${formId}-numeroDocumento`}
            name="numeroDocumento"
            type="text"
            required
            aria-required="true"
            aria-invalid={touched.numeroDocumento && Boolean(errors.numeroDocumento)}
            aria-describedby={
              touched.numeroDocumento && errors.numeroDocumento
                ? `${formId}-numeroDocumento-error`
                : undefined
            }
            maxLength={data.tipoDocumento === 'DNI' ? 8 : data.tipoDocumento === 'RUC' ? 11 : 12}
            placeholder={
              data.tipoDocumento === 'DNI'
                ? '8 dígitos numéricos'
                : data.tipoDocumento === 'RUC'
                ? '11 dígitos (inicia con 10, 15, 17 o 20)'
                : '6 a 12 caracteres alfanuméricos'
            }
            value={data.numeroDocumento}
            onChange={(e) => handleFieldChange('numeroDocumento', e.target.value.trim())}
            onBlur={() => markTouched('numeroDocumento')}
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm font-mono shadow-xs focus:outline-none focus:ring-2 transition ${
              touched.numeroDocumento && errors.numeroDocumento
                ? 'border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-[#006EC7] focus:ring-[#006EC7]/20'
            } disabled:bg-slate-100`}
          />
          {touched.numeroDocumento && errors.numeroDocumento && (
            <p
              id={`${formId}-numeroDocumento-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.numeroDocumento}
            </p>
          )}
        </div>

        {/* 3. Nombres / Razón Social */}
        <div>
          <label
            htmlFor={`${formId}-nombres`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            {data.tipoDocumento === 'RUC' ? 'Razón Social / Denominación' : 'Nombres Completos'}{' '}
            <span className="text-red-600">*</span>
          </label>
          <input
            id={`${formId}-nombres`}
            name="nombres"
            type="text"
            required
            aria-required="true"
            aria-invalid={touched.nombres && Boolean(errors.nombres)}
            aria-describedby={
              touched.nombres && errors.nombres ? `${formId}-nombres-error` : undefined
            }
            placeholder={
              data.tipoDocumento === 'RUC'
                ? 'Ej. Instituto de Educación Superior SAC'
                : 'Ej. Juan Carlos'
            }
            value={data.nombres}
            onChange={(e) => handleFieldChange('nombres', e.target.value)}
            onBlur={() => markTouched('nombres')}
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-xs focus:outline-none focus:ring-2 transition ${
              touched.nombres && errors.nombres
                ? 'border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-[#006EC7] focus:ring-[#006EC7]/20'
            } disabled:bg-slate-100`}
          />
          {touched.nombres && errors.nombres && (
            <p
              id={`${formId}-nombres-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.nombres}
            </p>
          )}
        </div>

        {/* 4. Apellidos Completos */}
        <div>
          <label
            htmlFor={`${formId}-apellidos`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Apellidos Completos{' '}
            {data.tipoDocumento === 'RUC' ? (
              <span className="text-slate-400 font-normal lowercase">(opcional)</span>
            ) : (
              <span className="text-red-600">*</span>
            )}
          </label>
          <input
            id={`${formId}-apellidos`}
            name="apellidos"
            type="text"
            required={data.tipoDocumento !== 'RUC'}
            aria-required={data.tipoDocumento !== 'RUC'}
            aria-invalid={touched.apellidos && Boolean(errors.apellidos)}
            aria-describedby={
              touched.apellidos && errors.apellidos ? `${formId}-apellidos-error` : undefined
            }
            placeholder={data.tipoDocumento === 'RUC' ? 'No requerido para personas jurídicas' : 'Ej. Quispe Morales'}
            value={data.apellidos}
            onChange={(e) => handleFieldChange('apellidos', e.target.value)}
            onBlur={() => markTouched('apellidos')}
            disabled={isSubmitting || data.tipoDocumento === 'RUC'}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-xs focus:outline-none focus:ring-2 transition ${
              touched.apellidos && errors.apellidos
                ? 'border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-[#006EC7] focus:ring-[#006EC7]/20'
            } disabled:bg-slate-100 disabled:text-slate-400`}
          />
          {touched.apellidos && errors.apellidos && (
            <p
              id={`${formId}-apellidos-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.apellidos}
            </p>
          )}
        </div>

        {/* 5. Correo Electrónico */}
        <div>
          <label
            htmlFor={`${formId}-correo`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Correo Electrónico Notificable <span className="text-red-600">*</span>
          </label>
          <input
            id={`${formId}-correo`}
            name="correo"
            type="email"
            required
            aria-required="true"
            aria-invalid={touched.correo && Boolean(errors.correo)}
            aria-describedby={
              touched.correo && errors.correo ? `${formId}-correo-error` : undefined
            }
            placeholder="usuario@ejemplo.com"
            value={data.correo}
            onChange={(e) => handleFieldChange('correo', e.target.value.trim())}
            onBlur={() => markTouched('correo')}
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-xs focus:outline-none focus:ring-2 transition ${
              touched.correo && errors.correo
                ? 'border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-[#006EC7] focus:ring-[#006EC7]/20'
            } disabled:bg-slate-100`}
          />
          {touched.correo && errors.correo ? (
            <p
              id={`${formId}-correo-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.correo}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">
              A esta dirección se enviará el acuse de recibo y decretos resolutivos oficiales.
            </p>
          )}
        </div>

        {/* 6. Teléfono o Celular */}
        <div>
          <label
            htmlFor={`${formId}-telefono`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Teléfono Celular o Fijo <span className="text-red-600">*</span>
          </label>
          <input
            id={`${formId}-telefono`}
            name="telefono"
            type="tel"
            required
            aria-required="true"
            aria-invalid={touched.telefono && Boolean(errors.telefono)}
            aria-describedby={
              touched.telefono && errors.telefono ? `${formId}-telefono-error` : undefined
            }
            maxLength={12}
            placeholder="Ej. 987654321"
            value={data.telefono}
            onChange={(e) => handleFieldChange('telefono', e.target.value.trim())}
            onBlur={() => markTouched('telefono')}
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm font-mono shadow-xs focus:outline-none focus:ring-2 transition ${
              touched.telefono && errors.telefono
                ? 'border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-[#006EC7] focus:ring-[#006EC7]/20'
            } disabled:bg-slate-100`}
          />
          {touched.telefono && errors.telefono ? (
            <p
              id={`${formId}-telefono-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.telefono}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">
              Para notificaciones urgentes y verificación procesal del IESTP &ldquo;Suiza&rdquo;.
            </p>
          )}
        </div>

        {/* 7. Dirección Domiciliaria */}
        <div className="sm:col-span-2">
          <label
            htmlFor={`${formId}-direccion`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Dirección Domiciliaria o Sede Legal{' '}
            <span className="text-slate-400 font-normal lowercase">(opcional)</span>
          </label>
          <input
            id={`${formId}-direccion`}
            name="direccion"
            type="text"
            placeholder="Ej. Av. Túpac Amaru Km 4.5, Manantay, Coronel Portillo, Ucayali"
            value={data.direccion ?? ''}
            onChange={(e) => handleFieldChange('direccion', e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100"
          />
        </div>
      </div>

      {/* BOTONERA DE NAVEGACIÓN ACCESIBLE */}
      <footer className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack || isSubmitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 disabled:border-slate-200 disabled:cursor-not-allowed cursor-pointer"
        >
          ← Anterior
        </button>

        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-xs font-bold text-white shadow-xs transition ${
            isValid && !isSubmitting
              ? 'bg-[#006EC7] hover:bg-[#005ba3] cursor-pointer'
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          Siguiente →
        </button>
      </footer>
    </form>
  );
};

export default StepIdentificacion;
