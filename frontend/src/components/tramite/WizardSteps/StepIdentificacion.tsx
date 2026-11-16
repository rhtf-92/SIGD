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
import { useAuthStore } from '../../../stores/authStore';
import { apiClient } from '../../../api/client';

/**
 * Descompone de forma determinista el nombre completo registrado en nombres y apellidos.
 * Si el nombre tiene 4 partes (ej. "Sr. Ciudadano Administrado Demo" o "Juan Carlos Pérez García"):
 * divide 2 y 2. Si tiene 3: 1 y 2. Si tiene 2: 1 y 1.
 */
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

  const { isAuthenticated, usuario } = useAuthStore();

  const esOperadorMesaPartes = useMemo(() => {
    if (!usuario) return false;
    return (
      usuario.rol === 'MESA_PARTES' ||
      (Array.isArray(usuario.roles) && usuario.roles.includes('MESA_PARTES'))
    );
  }, [usuario]);

  const esCiudadanoRegistrado = useMemo(() => Boolean(usuario && (
    usuario.rol === 'CIUDADANO' || usuario.roles?.includes('CIUDADANO')
  )), [usuario]);
  const [perfilCargado, setPerfilCargado] = useState<{ cuenta: string; error: boolean; nacimiento: string | null } | null>(null);
  const identidadCargada = Boolean(perfilCargado && perfilCargado.cuenta === usuario?.id && !perfilCargado.error);
  const errorIdentidad = perfilCargado?.cuenta === usuario?.id && perfilCargado?.error;
  const identidadCargando = isAuthenticated && esCiudadanoRegistrado && !identidadCargada && !errorIdentidad;
  const [reintentoIdentidad, setReintentoIdentidad] = useState(0);
  const fechaNacimientoPerfil = identidadCargada ? perfilCargado?.nacimiento : null;

  // Recupera la identidad del perfil autenticado del servidor; no la infiere
  // del nombre visible ni de un documento escrito en el navegador.
  useEffect(() => {
    if (!isAuthenticated || !esCiudadanoRegistrado || !usuario) {
      return;
    }

    let active = true;

    apiClient.get<{
      id: string;
      roles?: string[];
      rol?: string;
      identidad?: {
        tipoDocumento?: string | null;
        numeroDocumento?: string | null;
        nombres?: string | null;
        apellidos?: string | null;
        razonSocial?: string | null;
        direccion?: string | null;
        fechaNacimiento?: string | null;
        correo?: string | null;
        telefono?: string | null;
      };
    }>('/api/v1/auth/me').then(({ data: profile }) => {
      const identity = profile.identidad;
      const documentType = identity?.tipoDocumento;
      const validDocumentType = documentType === 'DNI' || documentType === 'CE' || documentType === 'RUC';
      const names = documentType === 'RUC' ? identity?.razonSocial : identity?.nombres;
      const surnames = documentType === 'RUC' ? '' : identity?.apellidos;
      const citizenRole = profile.rol === 'CIUDADANO' || profile.roles?.includes('CIUDADANO');

      if (profile.id !== usuario.id || !citizenRole || !validDocumentType || !identity?.numeroDocumento ||
          !names?.trim() || (documentType !== 'RUC' && !surnames?.trim())) {
        throw new Error('El perfil autenticado no contiene una identidad completa.');
      }
      if (!active) return;
      dispatch({
        type: 'UPDATE_IDENTIFICACION',
        payload: {
          tipoDocumento: documentType,
          numeroDocumento: identity.numeroDocumento,
          nombres: names.trim(),
          apellidos: surnames?.trim() ?? '',
          correo: identity.correo?.trim() ?? '',
          telefono: identity.telefono?.trim() ?? '',
          direccion: identity.direccion?.trim() ?? '',
        },
      });
      setPerfilCargado({ cuenta: usuario.id, error: false, nacimiento: identity.fechaNacimiento ?? null });
    }).catch(() => {
      if (active) setPerfilCargado({ cuenta: usuario.id, error: true, nacimiento: null });
    });

    return () => { active = false; };
  }, [isAuthenticated, esCiudadanoRegistrado, usuario, dispatch, reintentoIdentidad]);

  // Foco accesible inicial en el primer campo interactivo del formulario
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // ===========================================================================
  // VALIDACIÓN REACTIVA EN TIEMPO REAL
  // ===========================================================================
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!isAuthenticated && data.tipoDocumento === 'RUC') errs.numeroDocumento = 'La representación de personas jurídicas requiere validación institucional en ventanilla.';

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
  }, [data, isAuthenticated]);

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

    if (isValid && !isSubmitting && (!esCiudadanoRegistrado || identidadCargada)) {
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

      {/* TARJETA INFORMATIVA DE SESIÓN E IDENTIDAD INSTITUCIONAL */}
      {isAuthenticated && usuario ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-blue-200/60 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              <span className="font-bold text-blue-950 uppercase tracking-wide text-[11px]">
                Sesión Institucional Activa
              </span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Rol: {usuario.rol || 'AUTENTICADO'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-600 block text-[11px]">Titular autenticado:</span>
              <strong className="text-slate-900 text-sm font-bold block">{usuario.nombreCompleto}</strong>
            </div>
            <div>
              <span className="text-slate-600 block text-[11px]">Correo de la cuenta:</span>
              <span className="font-mono text-slate-800 text-xs block">{usuario.correo || 'No registrado'}</span>
            </div>
          </div>

          {/* Advertencia especial si es operador MESA_PARTES */}
          {esOperadorMesaPartes && (
            <div
              role="alert"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-2 mt-2"
            >
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">⚠️</span>
                <div>
                  <strong className="font-bold block">Atención — Rol de Operador de Mesa de Partes detectado:</strong>
                  <p className="mt-0.5 text-amber-800">
                    Ha iniciado sesión con una cuenta de operador institucional (<strong>{usuario.nombreCompleto}</strong>).
                    La Mesa de Partes Virtual es de uso exclusivo para trámites que usted radique a su <em>propio nombre</em> como administrado.
                  </p>
                  <p className="mt-1 text-amber-800">
                    Si necesita registrar una solicitud física presentada por un ciudadano o tercero en ventanilla, debe utilizar el módulo institucional de{' '}
                    <a
                      href="/tramite/ventanilla-presencial"
                      className="font-bold underline text-amber-950 hover:text-amber-800"
                    >
                      Ventanilla Presencial
                    </a>
                    . La Mesa Virtual rechazará cualquier solicitud cuyos datos no coincidan con su cuenta.
                  </p>
                  <div className="mt-2">
                    <a
                      href="/tramite/ventanilla-presencial"
                      className="inline-flex items-center gap-1.5 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 transition"
                    >
                      Ir a Ventanilla Presencial →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-blue-200/70 bg-white/70 p-2.5 text-[11px] text-slate-600 space-y-1">
            {identidadCargando && <p role="status">Cargando identidad de la cuenta...</p>}
            {identidadCargada && (
              <div role="status">
                <p>Datos de identidad cargados desde su perfil autenticado. Los campos de identidad estan protegidos.</p>
                {fechaNacimientoPerfil && <p className="mt-1">Fecha de nacimiento registrada: <strong>{fechaNacimientoPerfil}</strong></p>}
              </div>
            )}
            {errorIdentidad && (
              <div role="alert" className="space-y-2">
                <p>No fue posible recuperar una identidad completa para esta cuenta. No puede continuar con una identidad manual.</p>
                <button type="button" onClick={() => { setPerfilCargado(null); setReintentoIdentidad(value => value + 1); }} className="font-semibold text-[#006EC7] underline" disabled={identidadCargando}>
                  Reintentar carga de identidad
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 text-[11px]">
            <span className="text-slate-500">
              Protección contra suplantación: el servidor valida los datos contra la identidad vinculada a esta sesión.
            </span>
          </div>
        </div>
      ) : (
        <div
          role="status"
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">👤</span>
            <strong className="font-bold text-slate-900">Mesa de Partes Virtual de acceso público</strong>
          </div>
          <p className="text-slate-600">
            Puede presentar una solicitud sin iniciar sesión ni crear una cuenta. Consigne sus datos y declare su veracidad. La recepción no acredita la identidad ni la aprobación del trámite; la institución realizará la verificación correspondiente.
          </p>
        </div>
      )}

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
            disabled={isSubmitting || esCiudadanoRegistrado}
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
            disabled={isSubmitting || esCiudadanoRegistrado}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm font-mono shadow-xs focus:outline-none focus:ring-2 transition ${
              touched.numeroDocumento && errors.numeroDocumento
                ? 'border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-[#006EC7] focus:ring-[#006EC7]/20'
            } disabled:bg-slate-100`}
          />
          {touched.numeroDocumento && errors.numeroDocumento ? (
            <p
              id={`${formId}-numeroDocumento-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.numeroDocumento}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">
              {isAuthenticated && usuario
                ? `Ingrese el documento oficial correspondiente al titular (${usuario.nombreCompleto}).`
                : 'Consigne el número exacto del documento oficial seleccionado.'}
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
            disabled={isSubmitting || esCiudadanoRegistrado}
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
            disabled={isSubmitting || esCiudadanoRegistrado || data.tipoDocumento === 'RUC'}
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
          disabled={!isValid || isSubmitting || (esCiudadanoRegistrado && !identidadCargada)}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-xs font-bold text-white shadow-xs transition ${
            isValid && !isSubmitting && (!esCiudadanoRegistrado || identidadCargada)
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
