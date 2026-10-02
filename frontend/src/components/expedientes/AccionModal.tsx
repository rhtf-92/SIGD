import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import "./expedientes.css";

interface AccionModalProps {
  titulo: string;
  descripcion: string;
  pending: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Base local de M03: el repositorio no dispone de un Modal compartido. */
export default function AccionModal({ titulo, descripcion, pending, onClose, children }: AccionModalProps) {
  const id = useId();
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const elemento = dialogo.current;
    const previo = document.activeElement;
    elemento?.showModal();
    elemento?.querySelector<HTMLElement>("[data-foco-inicial]")?.focus();
    return () => {
      elemento?.close();
      if (previo instanceof HTMLElement && previo.isConnected) previo.focus();
    };
  }, []);
  return <dialog ref={dialogo} className="m03 m03-dialog" aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-descripcion`} aria-modal="true" aria-busy={pending}
    onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <div className="m03-dialog-content">
      <div className="m03-dialog-header"><h2 className="m03-heading" id={`${id}-titulo`}>{titulo}</h2><button type="button" className="btn-secondary" disabled={pending} onClick={onClose} aria-label={`Cerrar ${titulo.toLocaleLowerCase("es")}`}>Cerrar</button></div>
      <p id={`${id}-descripcion`} className="m03-help">{descripcion}</p>
      {children}
    </div>
  </dialog>;
}
