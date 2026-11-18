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
 * Características de diseño institucional:
 * - Título con barra vertical azul institucional (#1877f2) y subtítulo legal gris.
 * - Grid de 2 columnas en escritorio (gap-6).
 * - Etiquetas en mayúsculas pequeñas y negrita con asterisco rojo.
 * - Inputs redondeados (rounded-xl), fondo gris tenue o blanco con ícono ilustrativo en su interior izquierdo.
 * - Foco accesible WCAG 2.1 AA inicial en el primer campo interactivo.
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

  // Foco accesible inicial en el primer campo interactivo del formulario (Requisito WCAG)
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // ===========================================================================
  // VALIDACIÓN REACTIVA EN TIEMPO REAL
  // ===========================================================================
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};

    // 1. Validación de Documento de Identidad Oficial
    const docNum = data.numeroDocumento.trim();
    if (!docNum) {
      errs.numeroDocumento = 'El número de documento de identidad es obligatorio.';
    } else {
      switch (data.tipoDocumento) {
        case 'DNI':
          if (!/^\d{8}$/.test(docNum)) {
            errs.numeroDocumento = 'El DNI debe contener exactamente 8 dígitos numéricos.';
          }
          break;
        case 'RUC':
          if (!/^(10|15|17|20)\d{9}$/.test(docNum)) {
            errs.numeroDocumento = 'El RUC debe tener 11 dígitos e iniciar con 10, 15, 17 o 20.';
          }
          break;
        case 'CE':
          if (!/^[a-zA-Z0-9]{6,12}$/.test(docNum)) {
            errs.numeroDocumento = 'El Carné de Extranjería debe contener entre 6 y 12 caracteres alfanuméricos.';
          }
          break;
        default:
          break;
      }
    }

    // 2. Validación de Nombres o Razón Social
    const nombresTrim = data.nombres.trim();
    if (!nombresTrim) {
      errs.nombres =
        data.tipoDocumento === 'RUC'
          ? 'La razón social o denominación jurídica es obligatoria.'
          : 'Los nombres del solicitante son obligatorios.';
    } else if (nombresTrim.length < 2) {
      errs.nombres = 'Debe ingresar al menos 2 caracteres.';
    } else if (nombresTrim.length > 150) {
      errs.nombres = 'No puede exceder los 150 caracteres.';
    }

    // 3. Validación de Apellidos Completos (Opcional solo si es RUC / Persona Jurídica)
    const apellidosTrim = data.apellidos.trim();
    if (data.tipoDocumento !== 'RUC') {
      if (!apellidosTrim) {
        errs.apellidos = 'Los apellidos completos son obligatorios para personas naturales.';
      } else if (apellidosTrim.length < 2) {
        errs.apellidos = 'Debe ingresar al menos 2 caracteres en los apellidos.';
      } else if (apellidosTrim.length > 150) {
        errs.apellidos = 'Los apellidos no pueden exceder los 150 caracteres.';
      }
    }

    // 4. Correo Electrónico Institucional o Personal (Validación estricta RFC 5322 simplificada)
    const correoTrim = data.correo.trim();
    const regexEmail = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!correoTrim) {
      errs.correo = 'El correo electrónico para notificaciones oficiales es obligatorio.';
    } else if (!regexEmail.test(correoTrim)) {
      errs.correo = 'Ingrese una dirección de correo electrónico válida (ejemplo: usuario@correo.com).';
    }

    // 5. Teléfono o Celular (7 a 12 dígitos)
    const telTrim = data.telefono.trim();
    if (!telTrim) {
      errs.telefono = 'El teléfono o número celular de contacto es obligatorio.';
    } else if (!/^\+?[0-9]{7,12}$/.test(telTrim)) {
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
      {/* CUERPO DEL FORMULARIO: TÍTULO CON BARRA VERTICAL AZUL Y SUBTÍTULO LEGAL */}
      <header className="border-b border-slate-200/80 pb-5 mb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-6 bg-[#1877f2] rounded-full shrink-0" />
          <h2 className="text-xl sm:text-2xl font-black text-[#062856]">
            Identificación del Solicitante
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-slate-500 pl-4">
          Consigne sus datos de identidad oficial y contacto formal. Sus datos están protegidos conforme a la Ley N° 29733 y el TUO de la Ley N° 27444.
        </p>
      </header>

      {/* CAMPOS: GRID DE 2 COLUMNAS EN ESCRITORIO (GAP-6) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Tipo de Documento */}
        <div>
          <label
            htmlFor={`${formId}-tipoDocumento`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
          >
            TIPO DE DOCUMENTO OFICIAL <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <select
              ref={firstFieldRef}
              autoFocus
              id={`${formId}-tipoDocumento`}
              name="tipoDocumento"
              value={data.tipoDocumento}
              onChange={handleTipoDocChange}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 shadow-2xs focus:bg-white focus:border-[#1877f2] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20 disabled:bg-slate-100 cursor-pointer transition"
            >
              <option value="DNI">DNI — Documento Nacional de Identidad</option>
              <option value="CE">CE — Carné de Extranjería</option>
              <option value="RUC">RUC — Registro Único de Contribuyentes</option>
            </select>
          </div>
        </div>

        {/* 2. Número de Documento */}
        <div>
          <label
            htmlFor={`${formId}-numeroDocumento`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
          >
            NÚMERO DE DOCUMENTO <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </div>
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
              className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm font-mono shadow-2xs focus:outline-none focus:ring-2 transition ${
                touched.numeroDocumento && errors.numeroDocumento
                  ? 'border-red-400 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-200 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-[#1877f2]/20'
              } disabled:bg-slate-100`}
            />
          </div>
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
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
          >
            {data.tipoDocumento === 'RUC' ? 'RAZÓN SOCIAL / DENOMINACIÓN' : 'NOMBRES COMPLETOS'}{' '}
            <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              {data.tipoDocumento === 'RUC' ? (
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
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
              className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm shadow-2xs focus:outline-none focus:ring-2 transition ${
                touched.nombres && errors.nombres
                  ? 'border-red-400 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-200 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-[#1877f2]/20'
              } disabled:bg-slate-100`}
            />
          </div>
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
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
          >
            APELLIDOS COMPLETOS{' '}
            {data.tipoDocumento === 'RUC' ? (
              <span className="text-slate-400 font-normal lowercase">(opcional)</span>
            ) : (
              <span className="text-red-500">*</span>
            )}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
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
              className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm shadow-2xs focus:outline-none focus:ring-2 transition ${
                touched.apellidos && errors.apellidos
                  ? 'border-red-400 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-200 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-[#1877f2]/20'
              } disabled:bg-slate-100 disabled:text-slate-400`}
            />
          </div>
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
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
          >
            CORREO ELECTRÓNICO NOTIFICABLE <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
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
              className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm shadow-2xs focus:outline-none focus:ring-2 transition ${
                touched.correo && errors.correo
                  ? 'border-red-400 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-200 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-[#1877f2]/20'
              } disabled:bg-slate-100`}
            />
          </div>
          {touched.correo && errors.correo ? (
            <p
              id={`${formId}-correo-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.correo}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-slate-500">
              A esta dirección se enviará el acuse de recibo y decretos resolutivos oficiales.
            </p>
          )}
        </div>

        {/* 6. Teléfono o Celular */}
        <div>
          <label
            htmlFor={`${formId}-telefono`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
          >
            TELÉFONO CELULAR O FIJO <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
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
              className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm font-mono shadow-2xs focus:outline-none focus:ring-2 transition ${
                touched.telefono && errors.telefono
                  ? 'border-red-400 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-200 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-[#1877f2]/20'
              } disabled:bg-slate-100`}
            />
          </div>
          {touched.telefono && errors.telefono ? (
            <p
              id={`${formId}-telefono-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.telefono}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Para notificaciones urgentes y verificación procesal del IESTP &ldquo;Suiza&rdquo;.
            </p>
          )}
        </div>

        {/* 7. Dirección Domiciliaria */}
        <div className="md:col-span-2">
          <label
            htmlFor={`${formId}-direccion`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
          >
            DIRECCIÓN DOMICILIARIA O SEDE LEGAL{' '}
            <span className="text-slate-400 font-normal lowercase">(opcional)</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <input
              id={`${formId}-direccion`}
              name="direccion"
              type="text"
              placeholder="Ej. Av. Túpac Amaru Km 4.5, Manantay, Coronel Portillo, Ucayali"
              value={data.direccion ?? ''}
              onChange={(e) => handleFieldChange('direccion', e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 shadow-2xs focus:bg-white focus:border-[#1877f2] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20 disabled:bg-slate-100 transition"
            />
          </div>
        </div>
      </div>

      {/* BOTONERA DE NAVEGACIÓN ACCESIBLE */}
      <footer className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/80 pt-6">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack || isSubmitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 disabled:border-slate-200 disabled:cursor-not-allowed cursor-pointer"
        >
          ← Anterior
        </button>

        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-7 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition ${
            isValid && !isSubmitting
              ? 'bg-[#1877f2] hover:bg-[#166fe5] cursor-pointer'
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
