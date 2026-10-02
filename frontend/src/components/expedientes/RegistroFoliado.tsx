import { useState } from "react";
import AccionModal from "./AccionModal";
import { calcularRangoFolios, validarNuevoDocumento } from "../../utils/foliadoValidator";

interface Props {
  ultimoFolio: number;
  disponible?: boolean;
  onConfirmar: (rango: { inicio: number; fin: number }) => Promise<void>;
}
/** El padre proporciona el último folio confirmado por el servidor y persiste el documento. */
export default function RegistroFoliado({ ultimoFolio, onConfirmar, disponible = true }: Props) {
  const [paginas, setPaginas] = useState("1");
  const [inicio, setInicio] = useState(String(ultimoFolio + 1));
  const [advertencia, setAdvertencia] = useState(false);
  const [pending, setPending] = useState(false);
  const [mensaje, setMensaje] = useState("");
  let rango: { inicio: number; fin: number } | null = null;
  try { rango = calcularRangoFolios(ultimoFolio, Number(paginas)); } catch { /* Entrada incompleta. */ }
  const valido = Boolean(rango && inicio.trim() && validarNuevoDocumento(ultimoFolio, Number(paginas), Number(inicio)).valido);
  async function confirmar() {
    if (!disponible || !valido || !rango || pending) return;
    setPending(true); setMensaje("");
    try { await onConfirmar(rango); setMensaje("Documento confirmado correctamente."); }
    catch { setMensaje("No se pudo confirmar el documento. Actualice el último folio antes de reintentar."); }
    finally { setPending(false); }
  }
  return <section className="m03 m03-panel" aria-label="Validación de nuevo documento">
    <h2 className="m03-heading">Incorporar documento con foliación continua</h2>
    <p>Último folio consolidado: {ultimoFolio}</p>
    <label className="block">Cantidad de páginas <input type="number" min="1" step="1" value={paginas} disabled={pending} onChange={e => setPaginas(e.target.value)} /></label>
    <label className="block">Folio inicial <input type="number" min="1" step="1" value={inicio} disabled={pending} onChange={e => setInicio(e.target.value)} /></label>
    <p role="status">{rango ? `Rango requerido: F. ${rango.inicio} a F. ${rango.fin}.` : "Ingrese una cantidad válida de páginas."}</p>
    <div className="m03-actions">
      <button type="button" className="btn-secondary" disabled={!rango || pending} onClick={() => rango && setInicio(String(rango.inicio))}>Asignar rango correlativo</button>
      <button type="button" className="btn-secondary" disabled={valido || pending} onClick={() => setAdvertencia(true)}>Revisar inconsistencia</button>
      <button type="button" className="btn-primary" disabled={!disponible || !valido || pending} onClick={confirmar}>{pending ? "Confirmando…" : "Confirmar documento"}</button>
    </div>
    {mensaje ? <p role="status">{mensaje}</p> : null}
    {advertencia ? <AccionModal titulo="Inconsistencia de foliación" descripcion="Los folios del nuevo documento deben continuar inmediatamente después de los ya consolidados, sin saltos ni solapamientos." pending={false} onClose={() => setAdvertencia(false)}>
      <p aria-hidden="true" className="text-3xl">⚠</p>
      <p>{rango ? `Este documento debe ocupar F. ${rango.inicio} a F. ${rango.fin}. El registro permanece bloqueado hasta corregir el folio inicial.` : "Indique una cantidad entera y positiva de páginas para calcular el rango."}</p>
      {rango ? <button type="button" data-foco-inicial className="btn-primary" onClick={() => { setInicio(String(rango.inicio)); setAdvertencia(false); }}>Aplicar rango sugerido</button> : null}
    </AccionModal> : null}
  </section>;
}
