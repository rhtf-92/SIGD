/**
 * Módulo: Ajustes y preferencias personales del usuario (ENT-M05-01)
 * No modifica la configuración institucional (Panel de Administración);
 * solo preferencias de sesión individuales como la ley N° 29733 lo dispone.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  FileCheck2,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";

import { useAuthStore } from "../../stores/authStore";
import { usePreferenciasStore } from "../../stores/preferenciasStore";
import { useRolActual } from "../../hooks/useModulosVisibles";
import { puedeAcceder } from "../../config/modulos";
import { ETIQUETA_ROL } from "../../utils/etiquetaRol";
import { inicialesNombre } from "../../utils/iniciales";
import type { RolCanonicoId } from "../../types/rbacRoles";

interface AjustesUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function FilaPreferencia({
  titulo,
  descripcion,
  activo,
  onChange,
}: {
  titulo: string;
  descripcion: string;
  activo: boolean;
  onChange: (nuevoValor: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 transition-all hover:bg-white hover:shadow-sm">
      <span className="pr-2">
        <span className="block text-xs font-bold text-slate-900">{titulo}</span>
        <span className="mt-0.5 block text-xs text-slate-500 leading-relaxed font-medium">
          {descripcion}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={activo}
        checked={activo}
        onChange={(evento) => onChange(evento.target.checked)}
        className="relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition-colors checked:bg-emerald-600 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-md after:transition-transform after:content-[''] checked:after:translate-x-5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      />
    </label>
  );
}

export default function AjustesUsuarioModal({
  isOpen,
  onClose,
}: AjustesUsuarioModalProps) {
  const navigate = useNavigate();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const usuario = useAuthStore((state) => state.usuario);
  const rol = useRolActual();
  const preferencias = usePreferenciasStore((state) => state.preferencias);
  const setPreferencia = usePreferenciasStore((state) => state.setPreferencia);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    const timeout = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeout);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const rolCanonico: RolCanonicoId | null = rol;
  const administraSeguridad = puedeAcceder(rol, "administracion");

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ajustes-titulo"
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onClose();
      }}
    >
      <div 
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-950/30 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
                Mi Cuenta
              </span>
              <h2 id="ajustes-titulo" className="text-base font-black text-slate-900">
                Ajustes y Preferencias
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              Gestione sus preferencias de sesión y notificaciones institucionales
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de ajustes"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* User Profile Card */}
          <section className="flex items-center gap-3.5 rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-blue-50/80 p-4 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 font-black text-white shadow-md shadow-blue-600/20 ring-2 ring-white">
              {inicialesNombre(usuario?.nombreCompleto)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-bold text-slate-900">
                  {usuario?.nombreCompleto ?? "Usuario"}
                </p>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.2 text-[10px] font-bold text-emerald-700">
                  Activo
                </span>
              </div>
              <p className="truncate text-xs text-slate-500 font-medium">{usuario?.correo}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-blue-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{rolCanonico ? ETIQUETA_ROL[rolCanonico] : "Sin sesión"}</span>
              </div>
            </div>
          </section>

          {/* Section: Casilla Electronica */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-slate-700">
              <Bell className="h-4 w-4 text-blue-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Notificaciones de Casilla Electrónica
              </h3>
            </div>
            <FilaPreferencia
              titulo="Avisos por correo electrónico"
              descripcion="Recibir alerta instantánea en su correo al llegar una notificación con valor legal."
              activo={preferencias.notifCasillaEmail}
              onChange={(valor) => setPreferencia("notifCasillaEmail", valor)}
            />
            <FilaPreferencia
              titulo="Resumen diario consolidado"
              descripcion="Recibir cada mañana un resumen con los expedientes pendientes y notificaciones no leídas."
              activo={preferencias.notifCasillaResumenDiario}
              onChange={(valor) => setPreferencia("notifCasillaResumenDiario", valor)}
            />
          </section>

          {/* Section: Firma Digital */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-slate-700">
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Firma Digital y Documentos
              </h3>
            </div>
            <FilaPreferencia
              titulo="Usar mi firma por defecto"
              descripcion="Precargar su firma digital en los actos resolutivos y visados institucionales asignados."
              activo={preferencias.firmaPorDefecto}
              onChange={(valor) => setPreferencia("firmaPorDefecto", valor)}
            />
          </section>

          {/* Section: Privacidad & Seguridad */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-slate-700">
              <Lock className="h-4 w-4 text-slate-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Privacidad y Seguridad
              </h3>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs text-slate-600">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Ley N° 29733 · Protección de Datos Personales
              </p>
              <p className="mt-1.5 leading-relaxed text-slate-500 font-medium">
                Sus datos personales y credenciales institucionales están protegidos bajo estrictos protocolos de confidencialidad y custodia segura conforme a la normativa de Gobierno Digital.
              </p>
            </div>

            {administraSeguridad ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/administracion/seguridad");
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99]"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Gestionar seguridad y 2FA de la cuenta</span>
              </button>
            ) : (
              <p className="text-[11px] text-slate-400 font-medium px-1">
                Para cambio de contraseña o activación de 2FA, contacte a Mesa de Partes o Administración.
              </p>
            )}
          </section>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <span className="text-[11px] text-slate-400 font-medium">
            Los cambios se guardan automáticamente
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-slate-900/10 transition hover:bg-slate-800 active:scale-95"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Hecho</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}