/**
 * Módulo: Ajustes y preferencias personales del usuario (ENT-M05-01)
 * No modifica la configuración institucional (Panel de Administración);
 * solo preferencias de sesión individuales como la ley N° 29733 lo dispone.
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

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
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <span>
        <span className="block text-sm font-bold text-slate-900">{titulo}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{descripcion}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={activo}
        checked={activo}
        onChange={(evento) => onChange(evento.target.checked)}
        className="relative mt-1 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition-colors checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] checked:after:translate-x-4"
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

  const rolCanonico: RolCanonicoId | null = rol;
  const administraSeguridad = puedeAcceder(rol, "administracion");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ajustes-titulo"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 pt-16 pb-8"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="ajustes-titulo" className="text-lg font-black text-slate-900">
              Ajustes y Preferencias
            </h2>
            <p className="text-xs text-slate-500">
              Preferencias personales de su cuenta SIGD
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de ajustes"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <section className="flex items-center gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 p-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 font-bold text-white shadow-sm">
              {inicialesNombre(usuario?.nombreCompleto)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {usuario?.nombreCompleto ?? "Usuario"}
              </p>
              <p className="truncate text-xs text-slate-500">{usuario?.correo}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-blue-700">
                {rolCanonico ? ETIQUETA_ROL[rolCanonico] : "Sin sesión"}
              </p>
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Notificaciones de Casilla Electrónica
            </h3>
            <FilaPreferencia
              titulo="Avisos por correo electrónico"
              descripcion="Recibir alerta en su correo personal al llegar una notificación."
              activo={preferencias.notifCasillaEmail}
              onChange={(valor) => setPreferencia("notifCasillaEmail", valor)}
            />
            <FilaPreferencia
              titulo="Resumen diario"
              descripcion="Recibir cada día un resumen de las notificaciones no leídas."
              activo={preferencias.notifCasillaResumenDiario}
              onChange={(valor) => setPreferencia("notifCasillaResumenDiario", valor)}
            />
          </section>

          <section className="space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Firma Digital
            </h3>
            <FilaPreferencia
              titulo="Usar mi firma por defecto"
              descripcion="Precargar su firma digital en los actos resolutivos y documentos."
              activo={preferencias.firmaPorDefecto}
              onChange={(valor) => setPreferencia("firmaPorDefecto", valor)}
            />
          </section>

          <section className="space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Privacidad y Seguridad
            </h3>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600 shadow-xs">
              <p className="font-bold text-slate-800">Ley N° 29733 · Protección de Datos Personales</p>
              <p className="mt-1 leading-relaxed">
                Sus datos personales se tratan conforme a la ley. La casilla
                electrónica vinculada y homologada custodia la información con
                confidencialidad. Revise sus preferencias de notificación y
                contáctese con la institución para modificar sus datos.
              </p>
            </div>
            {administraSeguridad ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/administracion/seguridad");
                }}
                className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
              >
                Gestionar seguridad de la cuenta
              </button>
            ) : (
              <p className="text-[11px] text-slate-400">
                Cambio de contraseña y 2FA disponibles por solicitud en Mesa de Partes.
              </p>
            )}
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-900"
          >
            Hecho
          </button>
        </div>
      </div>
    </div>
  );
}