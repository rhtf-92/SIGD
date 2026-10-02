import { useEffect, useState } from "react";

import { useRefirmaGateway } from "../../hooks/useRefirmaGateway";
import type {
  DocumentoOficial,
  MecanismoFirma,
  PasoProcesoFirma,
  RefirmaRespuestaDTO,
} from "../../types/firmaDigital";

const MECANISMOS: ReadonlyArray<{ clave: MecanismoFirma; etiqueta: string }> = [
  { clave: "DNIE", etiqueta: "DNI Electrónico (DNIe / Lector USB)" },
  { clave: "TOKEN_USB", etiqueta: "Certificado en Token Criptográfico" },
  { clave: "CERTIFICADO_SOFTWARE", etiqueta: "Certificado en Software (IOFE)" },
];

const PASOS: ReadonlyArray<{ clave: PasoProcesoFirma; etiqueta: string }> = [
  {
    clave: "CONECTANDO_AGENTE",
    etiqueta: "Conectando con el servicio local Refirma...",
  },
  {
    clave: "ESPERANDO_PIN",
    etiqueta: "Esperando confirmación de PIN en dispositivo seguro...",
  },
  {
    clave: "SOLICITANDO_TSA",
    etiqueta: "Solicitando estampillado de tiempo oficial (TSA)...",
  },
  {
    clave: "SELLANDO_CVD",
    etiqueta: "Sellando Código de Verificación Digital (CVD)...",
  },
];

interface RefirmaConnectorModalProps {
  abierto: boolean;
  documento: DocumentoOficial | null;
  firmanteDni?: string;
  onCerrar: () => void;
  onFirmado: (resultado: RefirmaRespuestaDTO) => void;
}

function IconoCerradura() {
  return (
    <svg
      className="h-5 w-5 text-red-500"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function EstadoCasilla({ fase, indice }: { fase: number; indice: number }) {
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
        indice < fase
          ? "bg-emerald-100 text-emerald-700"
          : indice === fase
            ? "bg-blue-600 text-white"
            : "border border-slate-200 bg-slate-50 text-slate-400"
      }`}
      aria-hidden="true"
    >
      {indice < fase ? "✓" : indice + 1}
    </span>
  );
}

export default function RefirmaConnectorModal({
  abierto,
  documento,
  firmanteDni = "00000000",
  onCerrar,
  onFirmado,
}: RefirmaConnectorModalProps) {
  const [mecanismo, setMecanismo] = useState<MecanismoFirma>("DNIE");
  const {
    estado,
    pasoActual,
    resultado,
    mensajeError,
    iniciarFirma,
    reintentar,
  } = useRefirmaGateway(onFirmado);

  const fase = pasoActual ? PASOS.findIndex((paso) => paso.clave === pasoActual) : -1;

  useEffect(() => {
    if (!abierto) return;
    const manejador = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", manejador);
    return () => window.removeEventListener("keydown", manejador);
  }, [abierto, onCerrar]);

  if (!abierto || !documento) return null;

  const enProceso =
    estado === "PREPARANDO" ||
    estado === "CONECTANDO" ||
    estado === "ESPERANDO_PIN" ||
    estado === "SOLICITANDO_TSA" ||
    estado === "SELLANDO_CVD";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refirma-modal-titulo"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-slate-100 p-5">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
            <IconoCerradura />
          </span>
          <div>
            <h2
              id="refirma-modal-titulo"
              className="text-lg font-bold text-slate-900"
            >
              Firma Digital con Refirma RENIEC
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              La suscripción digital ostenta plena validez conforme a la Ley N°
              27269 (Firmas y Certificados Digitales) y su Reglamento D.S. N°
              052-2008-PCM. Las claves privadas nunca abandonan el dispositivo
              seguro.
            </p>
          </div>
        </header>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Documento a firmar
            </p>
            <p className="mt-1 font-bold text-slate-800">
              {documento.tipoActo} · {documento.numeroCorrelativo}
            </p>
            <p className="text-xs text-slate-500">{documento.asunto}</p>
          </div>

          {estado === "INACTIVO" && (
            <fieldset>
              <legend className="mb-2 text-sm font-bold text-slate-700">
                Mecanismo de firma
              </legend>
              <div className="space-y-2">
                {MECANISMOS.map((opcion) => (
                  <label
                    key={opcion.clave}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm transition hover:border-blue-300 has-checked:border-blue-500 has-checked:bg-blue-50"
                  >
                    <input
                      type="radio"
                      name="mecanismo-firma"
                      value={opcion.clave}
                      checked={mecanismo === opcion.clave}
                      onChange={() => setMecanismo(opcion.clave)}
                      className="h-4 w-4 accent-blue-700"
                    />
                    <span className="font-semibold text-slate-700">
                      {opcion.etiqueta}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {(estado === "CONECTANDO" ||
            estado === "ESPERANDO_PIN" ||
            estado === "SOLICITANDO_TSA" ||
            estado === "SELLANDO_CVD" ||
            estado === "PREPARANDO") && (
            <div aria-live="polite" className="space-y-2.5">
              {PASOS.map((paso, indice) => (
                <div key={paso.clave} className="flex items-center gap-3">
                  <EstadoCasilla fase={fase} indice={indice} />
                  <span
                    className={`text-sm ${
                      indice < fase
                        ? "text-slate-500 line-through"
                        : indice === fase
                          ? "font-semibold text-slate-900"
                          : "text-slate-400"
                    }`}
                  >
                    {paso.etiqueta}
                  </span>
                </div>
              ))}
              <p className="pt-1 text-xs text-slate-400" role="status">
                Firma PAdES-BES · Sellado de tiempo criptográfico TSA (RFC 3161)
              </p>
            </div>
          )}

          {(estado === "TIMEOUT" || estado === "ERROR") && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <p className="font-bold">No fue posible firmar el documento</p>
              <p className="mt-1">{mensajeError}</p>
            </div>
          )}

          {estado === "COMPLETADO" && resultado && (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
            >
              <p className="font-bold">Documento firmado exitosamente</p>
              <p className="mt-1">
                CVD: <code className="font-bold">{resultado.cvd}</code>
              </p>
              <p className="text-xs">
                Sello de tiempo: {new Date(resultado.timestamp).toLocaleString("es-PE")}
              </p>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-100 p-5">
          {estado === "INACTIVO" && (
            <>
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => iniciarFirma(documento, firmanteDni)}
                className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              >
                Conectar con Refirma
              </button>
            </>
          )}

          {enProceso && (
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              Cancelar
            </button>
          )}

          {(estado === "TIMEOUT" || estado === "ERROR") && (
            <>
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={reintentar}
                className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              >
                Reintentar conexión
              </button>
            </>
          )}

          {estado === "COMPLETADO" && (
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
            >
              Finalizar
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}