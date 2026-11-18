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

const BASE_INPUT_CLASSES =
  'w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-all duration-150 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 focus:outline-hidden';

export const StepIdentificacion: React.FC<StepIdentificacionProps> = ({
  data,
  dispatch,
  onNext,
  onBack,
  isSubmitting = false,
}) => {
  const formId = useId();
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isConsulting, setIsConsulting] = useState(false);
  const [consultMessage, setConsultMessage] = useState<{ tipo: 'success' | 'info' | 'error'; texto: string } | null>(null);
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

  const handleConsultarIdentidad = async () => {
    const doc = data.numeroDocumento.trim();
    if (!doc || errors.numeroDocumento) return;

    setIsConsulting(true);
    setConsultMessage(null);

    // Simulación de latencia de red (400ms)
    await new Promise((res) => setTimeout(res, 400));

    // Padrón institucional demostrativo / institucional base
    const padronPruebas: Record<string, { nombres: string; apellidos: string }> = {
      '70123456': { nombres: 'JUAN CARLOS', apellidos: 'QUISPE MORALES' },
      '45891234': { nombres: 'MARÍA ELENA', apellidos: 'RODRÍGUEZ SÁNCHEZ' },
      '09876543': { nombres: 'ANLLELY', apellidos: 'MELGAREJO VARGAS' },
      '20123456789': { nombres: 'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO SUIZA', apellidos: '' },
      '10701234561': { nombres: 'JUAN CARLOS QUISPE MORALES', apellidos: '' }
    };

    const match = padronPruebas[doc];

    if (match) {
      dispatch({
        type: 'UPDATE_IDENTIFICACION',
        payload: {
          nombres: match.nombres,
          apellidos: data.tipoDocumento === 'RUC' ? '' : match.apellidos
        }
      });
      setConsultMessage({
        tipo: 'success',
        texto: 'Datos validados y autocompletados correctamente desde el padrón institucional.'
      });
    } else {
      // Si no está en el mock, se orienta al administrado a consignar sus datos manualmente
      setConsultMessage({
        tipo: 'info',
        texto: 'Documento no registrado en padrón automático. Por favor, consigne sus nombres y apellidos manualmente.'
      });
    }

    setIsConsulting(false);
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

  const handleLimpiarTodoElTramite = () => {
    // 1. Restablecer todo el trámite (identificación, documentos, declaración jurada y paso activo)
    dispatch({ type: 'RESET_WIZARD' });

    // 2. Limpiar mensajes de consulta previa y validaciones tocadas
    setConsultMessage(null);
    setTouched({});

    // 3. Devolver el foco al primer elemento para accesibilidad
    firstFieldRef.current?.focus();
  };

  return (
    <form
      id={`${formId}-form`}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      <header>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-blue-50 text-blue-700 border border-blue-200/60 shadow-xs mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          PASO 1 DE 4
        </span>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Identificación del Solicitante
        </h2>
        <div className="mt-3 mb-6 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
          <svg
            aria-hidden="true"
            className="h-4 w-4 text-[#006EC7] shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span>
            Consigne sus datos de identidad oficial y contacto formal. Sus datos están protegidos conforme a la Ley N° 29733 y el TUO de la Ley N° 27444.
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* 1. Tipo de Documento */}
        <div>
          <label
            htmlFor={`${formId}-tipoDocumento`}
            className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1.5"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0"
              />
            </svg>
            <span>Tipo de Documento Oficial</span>
            <span className="text-red-500 font-bold">*</span>
          </label>
          <select
            ref={firstFieldRef}
            autoFocus
            id={`${formId}-tipoDocumento`}
            name="tipoDocumento"
            value={data.tipoDocumento}
            onChange={handleTipoDocChange}
            disabled={isSubmitting}
            className={`${BASE_INPUT_CLASSES} disabled:bg-slate-100 cursor-pointer`}
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
            className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1.5"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
              />
            </svg>
            <span>Número de Documento</span>
            <span className="text-red-500 font-bold">*</span>
          </label>
          <div className="flex items-start gap-2">
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
              className={`${BASE_INPUT_CLASSES} flex-1 font-mono ${
                touched.numeroDocumento && errors.numeroDocumento
                  ? 'border-red-400 bg-red-50/40 text-red-900 focus:border-red-500 focus:ring-red-500/10'
                  : ''
              } disabled:bg-slate-100`}
            />
            <button
              type="button"
              onClick={handleConsultarIdentidad}
              disabled={isSubmitting || isConsulting || Boolean(errors.numeroDocumento) || !data.numeroDocumento.trim()}
              className="h-[42px] px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs hover:shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Consultar datos de identidad"
            >
              {isConsulting ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-4.35-4.35M16.65 10.825a5.825 5.825 0 11-11.65 0 5.825 5.825 0 0111.65 0z"
                    />
                  </svg>
                  <span>Consultar</span>
                </>
              )}
            </button>
          </div>
          {touched.numeroDocumento && errors.numeroDocumento && (
            <p
              id={`${formId}-numeroDocumento-error`}
              role="alert"
              className="text-xs font-medium text-red-600 mt-1 flex items-center gap-1"
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>{errors.numeroDocumento}</span>
            </p>
          )}
          {consultMessage && (
            <p
              className={`mt-1.5 text-xs font-medium flex items-center gap-1 ${
                consultMessage.tipo === 'success'
                  ? 'text-emerald-700'
                  : consultMessage.tipo === 'error'
                  ? 'text-red-600'
                  : 'text-blue-700'
              }`}
            >
              <span>{consultMessage.texto}</span>
            </p>
          )}
        </div>

        {/* 3. Nombres / Razón Social */}
        <div>
          <label
            htmlFor={`${formId}-nombres`}
            className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1.5"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>{data.tipoDocumento === 'RUC' ? 'Razón Social / Denominación' : 'Nombres Completos'}</span>
            <span className="text-red-500 font-bold">*</span>
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
            className={`${BASE_INPUT_CLASSES} ${
              touched.nombres && errors.nombres
                ? 'border-red-400 bg-red-50/40 text-red-900 focus:border-red-500 focus:ring-red-500/10'
                : ''
            } disabled:bg-slate-100`}
          />
          {touched.nombres && errors.nombres && (
            <p
              id={`${formId}-nombres-error`}
              role="alert"
              className="text-xs font-medium text-red-600 mt-1 flex items-center gap-1"
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>{errors.nombres}</span>
            </p>
          )}
        </div>

        {/* 4. Apellidos Completos */}
        <div>
          <label
            htmlFor={`${formId}-apellidos`}
            className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1.5"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>Apellidos Completos</span>
            {data.tipoDocumento === 'RUC' ? (
              <span className="text-slate-400 font-normal lowercase">(opcional)</span>
            ) : (
              <span className="text-red-500 font-bold">*</span>
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
            className={`${BASE_INPUT_CLASSES} ${
              touched.apellidos && errors.apellidos
                ? 'border-red-400 bg-red-50/40 text-red-900 focus:border-red-500 focus:ring-red-500/10'
                : ''
            } disabled:bg-slate-100 disabled:text-slate-400`}
          />
          {touched.apellidos && errors.apellidos && (
            <p
              id={`${formId}-apellidos-error`}
              role="alert"
              className="text-xs font-medium text-red-600 mt-1 flex items-center gap-1"
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>{errors.apellidos}</span>
            </p>
          )}
        </div>

        {/* 5. Correo Electrónico */}
        <div>
          <label
            htmlFor={`${formId}-correo`}
            className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1.5"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span>Correo Electrónico Notificable</span>
            <span className="text-red-500 font-bold">*</span>
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
            className={`${BASE_INPUT_CLASSES} ${
              touched.correo && errors.correo
                ? 'border-red-400 bg-red-50/40 text-red-900 focus:border-red-500 focus:ring-red-500/10'
                : ''
            } disabled:bg-slate-100`}
          />
          {touched.correo && errors.correo ? (
            <p
              id={`${formId}-correo-error`}
              role="alert"
              className="text-xs font-medium text-red-600 mt-1 flex items-center gap-1"
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>{errors.correo}</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <svg aria-hidden="true" className="h-3 w-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>A esta dirección se enviará el acuse de recibo y decretos resolutivos oficiales.</span>
            </p>
          )}
        </div>

        {/* 6. Teléfono o Celular */}
        <div>
          <label
            htmlFor={`${formId}-telefono`}
            className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1.5"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <span>Teléfono Celular o Fijo</span>
            <span className="text-red-500 font-bold">*</span>
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
            className={`${BASE_INPUT_CLASSES} font-mono ${
              touched.telefono && errors.telefono
                ? 'border-red-400 bg-red-50/40 text-red-900 focus:border-red-500 focus:ring-red-500/10'
                : ''
            } disabled:bg-slate-100`}
          />
          {touched.telefono && errors.telefono ? (
            <p
              id={`${formId}-telefono-error`}
              role="alert"
              className="text-xs font-medium text-red-600 mt-1 flex items-center gap-1"
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>{errors.telefono}</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <svg aria-hidden="true" className="h-3 w-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Para notificaciones urgentes y verificación procesal del IESTP &ldquo;Suiza&rdquo;.</span>
            </p>
          )}
        </div>

        {/* 7. Dirección Domiciliaria */}
        <div className="sm:col-span-2">
          <label
            htmlFor={`${formId}-direccion`}
            className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1.5"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>Dirección Domiciliaria o Sede Legal</span>
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
            className={`${BASE_INPUT_CLASSES} disabled:bg-slate-100`}
          />
        </div>
      </div>

      {/* BOTONERA DE NAVEGACIÓN ACCESIBLE */}
      <footer className="flex items-center justify-between pt-6 border-t border-slate-200/80 mt-8">
        {/* Botón Anterior */}
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack || isSubmitting}
          className="group relative px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold shadow-xs transition-all duration-150 ease-out hover:bg-slate-50 hover:border-slate-400 hover:shadow-md active:scale-95 active:bg-slate-100 active:ring-2 active:ring-slate-300/60 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none select-none"
        >
          <span className="transition-transform duration-150 group-hover:-translate-x-1 group-active:-translate-x-1.5">←</span>
          <span>Anterior</span>
        </button>

        {/* Agrupación derecha: Limpiar datos + Siguiente */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleLimpiarTodoElTramite}
            disabled={isSubmitting}
            className="group relative px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold shadow-xs transition-all duration-150 ease-out hover:bg-red-50/80 hover:text-red-600 hover:border-red-200 hover:shadow-red-500/10 active:scale-95 active:bg-red-100 active:border-red-400 active:text-red-700 active:ring-2 active:ring-red-400/30 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none"
            title="Borrar todos los datos y reiniciar el trámite"
          >
            <span className="transition-transform duration-200 group-hover:scale-110 group-active:-rotate-12">🗑️</span>
            <span>Limpiar datos</span>
          </button>

          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="group relative px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white text-sm font-bold shadow-md shadow-blue-600/25 transition-all duration-150 ease-out hover:shadow-lg hover:shadow-blue-600/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 active:ring-4 active:ring-blue-400/40 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none"
          >
            <span>Siguiente</span>
            <span className="transition-transform duration-150 group-hover:translate-x-1 group-active:translate-x-1.5">→</span>
          </button>
        </div>
      </footer>
    </form>
  );
};

export default StepIdentificacion;
