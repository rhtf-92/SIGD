import { useEffect, useRef, useState } from "react";

import { generarCvdDocumento } from "../../hooks/useRefirmaGateway";
import type {
  DocumentoOficial,
  EstadoFirmaLote,
} from "../../types/firmaDigital";

interface ItemLote {
  documento: DocumentoOficial;
  estado: EstadoFirmaLote;
  cvd: string | null;
}

interface FirmaBatchDrawerProps {
  abierto: boolean;
  documentos: DocumentoOficial[];
  onCerrar: () => void;
}

const ESTILOS_ESTADO_LOTE: Record<EstadoFirmaLote, string> = {
  PENDIENTE: "border-slate-200 bg-slate-50 text-slate-500",
  EN_FIRMA: "border-blue-200 bg-blue-50 text-blue-700",
  FIRMADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ERROR: "border-red-200 bg-red-50 text-red-700",
};

const ETIQUETA_ESTADO_LOTE: Record<EstadoFirmaLote, string> = {
  PENDIENTE: "Pendiente",
  EN_FIRMA: "En firma",
  FIRMADO: "Firmado",
  ERROR: "Error",
};

export default function FirmaBatchDrawer({
  abierto,
  documentos,
  onCerrar,
}: FirmaBatchDrawerProps) {
  const [items, setItems] = useState<ItemLote[]>([]);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [procesando, setProcesando] = useState(false);
  const cronometroRef = useRef<number | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setItems(
      documentos.map((documento) => ({
        documento,
        estado: "PENDIENTE" as const,
        cvd: null,
      })),
    );
    setSeleccionados(documentos.map((documento) => documento.idDocumento));
    setProcesando(false);
  }, [abierto, documentos]);

  useEffect(() => {
    return () => {
      if (cronometroRef.current !== null) {
        window.clearTimeout(cronometroRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const manejador = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", manejador);
    return () => window.removeEventListener("keydown", manejador);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const alternarSeleccion = (idDocumento: number) => {
    if (procesando) return;
    setSeleccionados((actuales) =>
      actuales.includes(idDocumento)
        ? actuales.filter((id) => id !== idDocumento)
        : [...actuales, idDocumento],
    );
  };

  const iniciarProcesoLote = () => {
    if (procesando) return;
    const seleccion = [...seleccionados];
    if (seleccion.length === 0) return;

    setProcesando(true);
    let indice = 0;

    const paso = (): void => {
      if (indice >= seleccion.length) {
        setProcesando(false);
        return;
      }
      const idDocumento = seleccion[indice];
      setItems((actuales) =>
        actuales.map((item) =>
          item.documento.idDocumento === idDocumento
            ? { ...item, estado: "EN_FIRMA", cvd: null }
            : item,
        ),
      );

      cronometroRef.current = window.setTimeout(() => {
        setItems((actuales) =>
          actuales.map((item) =>
            item.documento.idDocumento === idDocumento
              ? {
                  ...item,
                  estado: "FIRMADO",
                  cvd: generarCvdDocumento(item.documento),
                }
              : item,
          ),
        );
        indice += 1;
        cronometroRef.current = window.setTimeout(paso, 1100);
      }, 1100);
    };

    cronometroRef.current = window.setTimeout(paso, 350);
  };

  const firmados = items.filter((item) => item.estado === "FIRMADO").length;
  const totalSeleccionados = seleccionados.length;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="lote-drawer-titulo">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onCerrar} aria-hidden="true" />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="lote-drawer-titulo" className="text-lg font-bold text-slate-900">
                Firma de documentos en lote
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Emisión masiva de actas · Secretaría Académica
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar cajón de firma en lote"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              PAdES-BES
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              TSA RFC 3161
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
              Refirma RENIEC
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay documentos disponibles para firmar.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.documento.idDocumento}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(item.documento.idDocumento)}
                        onChange={() => alternarSeleccion(item.documento.idDocumento)}
                        disabled={procesando}
                        className="mt-0.5 h-4 w-4 accent-blue-700"
                      />
                      <span>
                        <span className="font-bold text-slate-800">
                          {item.documento.tipoActo} · {item.documento.numeroCorrelativo}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {item.documento.asunto}
                        </span>
                      </span>
                    </label>

                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.65rem] font-bold ${ESTILOS_ESTADO_LOTE[item.estado]}`}
                    >
                      {ETIQUETA_ESTADO_LOTE[item.estado]}
                    </span>
                  </div>

                  {item.cvd && (
                    <p className="mt-2 break-all text-xs font-semibold text-emerald-700">
                      CVD: {item.cvd}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-slate-100 p-5">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-600">
            <span aria-live="polite">
              {procesando
                ? `Firmando ${firmados} de ${totalSeleccionados}...`
                : `${firmados} de ${totalSeleccionados} documentos firmados`}
            </span>
            <span className="text-xs font-bold text-slate-500">
              Temporizador: {totalSeleccionados > 0 ? `~${totalSeleccionados * 1.1}s` : "—"}
            </span>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={iniciarProcesoLote}
              disabled={procesando || totalSeleccionados === 0}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              Firmar seleccionados ({totalSeleccionados})
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}