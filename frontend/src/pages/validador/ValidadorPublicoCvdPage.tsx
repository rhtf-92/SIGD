import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import CvdVerificationResult from "../../components/validador/CvdVerificationResult";
import {
  CVD_ALTERADO,
  CVD_VALIDO,
  useCvdPublicVerification,
} from "../../hooks/useCvdPublicVerification";

const PATRON_CVD = /CVD-\d{4}-[A-Z]{2,6}-\d{6}-[A-F0-9]{4}/g;

export default function ValidadorPublicoCvdPage() {
  const [codigo, setCodigo] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const { resultado, error, isValidando, verificar, limpiar } =
    useCvdPublicVerification();
  const entradaArchivoRef = useRef<HTMLInputElement | null>(null);

  const verificarCodigo = (valor?: string) => {
    const codigoFinal = (valor ?? codigo).trim().toUpperCase();
    if (!codigoFinal) {
      setMensaje("Ingrese un código CVD para verificar.");
      return;
    }
    setMensaje(null);
    verificar(codigoFinal);
  };

  const manejarArchivoPdf = (archivo: File) => {
    const lector = new FileReader();
    lector.onload = () => {
      const texto = String(lector.result ?? "");
      const coincidencias = texto.match(PATRON_CVD);
      if (coincidencias && coincidencias.length > 0) {
        const encontrado = coincidencias[0];
        setCodigo(encontrado);
        setMensaje(null);
        verificar(encontrado);
      } else {
        setMensaje(
          "No se identificó un código CVD en el archivo y/o su texto está comprimido (PDF firmado). Puede pegar o escribir el código manualmente.",
        );
      }
    };
    lector.readAsText(archivo);
  };

  const estiloError: Record<number, string> = {
    404: "border-amber-200 bg-amber-50 text-amber-800",
    400: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <Link
            to="/flujo-validez-legal"
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Volver
          </Link>
          <p className="text-sm font-bold text-blue-700">
            ENT-M04-05 · Adriano David Espinoza Ramírez (R/A) · Mayra (R)
          </p>
          <h1 className="text-2xl font-bold">
            Verificador público de Códigos de Verificación Digital (CVD)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Servicio de consulta para egresados, empleadores y entidades
            externas. Los documentos firmados digitalmente por el IESTP Suiza
            pueden autenticarse sin necesidad de cuenta.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label
            htmlFor="codigo-cvd"
            className="text-sm font-bold text-slate-700"
          >
            Código CVD del documento
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="codigo-cvd"
              type="text"
              value={codigo}
              onChange={(evento) => {
                setCodigo(evento.target.value.toUpperCase());
                limpiar();
              }}
              onKeyDown={(evento) => {
                if (evento.key === "Enter") verificarCodigo();
              }}
              placeholder="CVD-2026-RD-000412-892F"
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => verificarCodigo()}
              disabled={isValidando}
              className="rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isValidando ? "Verificando..." : "Verificar"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Ejemplos:
            </span>
            {[CVD_VALIDO, CVD_ALTERADO].map((ejemplo) => (
              <button
                key={ejemplo}
                type="button"
                onClick={() => {
                  setCodigo(ejemplo);
                  verificarCodigo(ejemplo);
                }}
                className="rounded-full border border-slate-300 px-3 py-1 font-mono text-xs text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
              >
                {ejemplo}
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-sm font-bold text-slate-700">
              ¿Posee el PDF oficial? Arrástrelo aquí
            </p>
            <label
              role="button"
              tabIndex={0}
              onKeyDown={(evento) => {
                if (evento.key === "Enter" || evento.key === " ") {
                  evento.preventDefault();
                  entradaArchivoRef.current?.click();
                }
              }}
              className="mt-3 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-sm text-slate-500 transition hover:border-blue-400 hover:bg-blue-50"
            >
              <span aria-hidden="true" className="text-2xl">
                ⬆
              </span>
              <span>
                Seleccionar o soltar el documento <b>.PDF</b> — el sistema
                extraerá automáticamente el CVD de su firma PAdES y lo
                validará.
              </span>
              <input
                ref={entradaArchivoRef}
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(evento) => {
                  const archivo = evento.target.files?.[0];
                  if (archivo) manejarArchivoPdf(archivo);
                  evento.target.value = "";
                }}
              />
            </label>
          </div>

          {mensaje && (
            <p
              role="status"
              className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
            >
              {mensaje}
            </p>
          )}

          {isValidando && (
            <div
              role="status"
              className="mt-5 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
              Consultando validador institucional…
            </div>
          )}

          {error && (
            <div
              role="alert"
              className={`mt-5 rounded-lg border p-4 text-sm ${
                estiloError[error.codigoEstado] ?? "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <p className="font-bold">{error.titulo}</p>
              <p className="mt-1">{error.detalle}</p>
              <p className="mt-2 text-xs opacity-70">
                Referencia interna: HTTP {error.codigoEstado}
              </p>
            </div>
          )}

          {resultado && !isValidando && (
            <div className="mt-5">
              <CvdVerificationResult resultado={resultado} />
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-800">
              ¿Qué es el CVD?
            </h2>
            <p className="mt-2 text-sm leading-5 text-slate-600">
              El Código de Verificación Digital es el identificador único que
              el IESTP Suiza estampa sobre todo documento electrónico
              suscrito. Resuelto contra el repositorio institucional, permite
              comprobar la autenticidad, integridad y vigencia del documento,
              así como la identidad de sus firmantes y el sello de tiempo
              TSA.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-800">
              Marco normativo aplicable
            </h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-5 text-slate-600">
              <li>Ley N° 27269 — Firmas y Certificados Digitales.</li>
              <li>D.S. N° 052-2008-PCM — Reglamento de la Ley de Firmas.</li>
              <li>Ley N° 27444 — Ley del Procedimiento Administrativo General.</li>
            </ul>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Validador CVD · ENT-M04-05 · Módulo 04: Flujo y Validez Legal de
          Documentos Digitales
        </p>
      </section>
    </main>
  );
}