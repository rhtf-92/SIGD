/**
 * ValidadorPublicoCvdPage — F_ADRIANO / ENT-M04-05 / T-FE-DOC-03.
 * Portal 100% público y anónimo (/validador-cvd): sin login, sin JWT.
 * Máscara guiada CVD-YYYY-RD-XXXXXX-XXXX, escaneo QR con cámara web,
 * carga de PDF y dictamen formal CvdIntegrityReport (D.S. N° 070-2013-PCM).
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import CvdIntegrityReport from "../../components/cvd/CvdIntegrityReport";
import {
  CVD_ALTERADO,
  CVD_VALIDO,
  useCvdPublicVerification,
} from "../../hooks/useCvdPublicVerification";
import {
  CVD_INPUT_MASK_HINT,
  aplicarMascaraCvd,
  extraerCvdDeTexto,
  validarCvd,
} from "../../utils/cvdValidator";

const PATRON_CVD = /CVD-\d{2,4}-[A-Z]{2,6}-\d{4,6}-[A-F0-9]{4}/;

export default function ValidadorPublicoCvdPage() {
  const [codigo, setCodigo] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [camaraError, setCamaraError] = useState<string | null>(null);
  const { resultado, error, isValidando, verificar, limpiar } =
    useCvdPublicVerification();
  const entradaArchivoRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const escaneoRef = useRef<number | null>(null);

  const detenerCamara = () => {
    if (escaneoRef.current) cancelAnimationFrame(escaneoRef.current);
    escaneoRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamaraActiva(false);
  };

  useEffect(() => () => detenerCamara(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const verificarCodigo = (valor?: string) => {
    const crudo = (valor ?? codigo).trim().toUpperCase();
    if (!crudo) {
      setMensaje("Ingrese un código CVD para verificar.");
      return;
    }
    const chequeo = validarCvd(crudo);
    if (!chequeo.valido) {
      setMensaje(chequeo.motivo ?? "Código CVD inválido.");
      return;
    }
    setMensaje(null);
    setCodigo(chequeo.normalizado);
    verificar(chequeo.normalizado);
  };

  const manejarArchivoPdf = (archivo: File) => {
    const lector = new FileReader();
    lector.onload = () => {
      const texto = String(lector.result ?? "").toUpperCase();
      const coincidencias = texto.match(PATRON_CVD) ?? extraerCvdDeTexto(texto);
      const encontrado = Array.isArray(coincidencias) ? coincidencias[0] : coincidencias;
      if (encontrado) {
        setCodigo(encontrado);
        setMensaje(null);
        verificar(encontrado);
      } else {
        setMensaje(
          "No se identificó un código CVD en el archivo y/o su texto está comprimido (PDF firmado). Pegue o escriba el código manualmente.",
        );
      }
    };
    lector.readAsText(archivo);
  };

  /** Escaneo QR con cámara: BarcodeDetector nativo (Chromium/Edge). */
  const iniciarCamara = async () => {
    setCamaraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamaraError("Este navegador no permite acceso a la cámara. Escriba el CVD manualmente.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCamaraActiva(true);
      // Espera al siguiente tick para que el <video> exista en el DOM
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => undefined);
          bucleEscaneo(video);
        }
      });
    } catch {
      setCamaraError(
        "No se pudo acceder a la cámara (permiso denegado o sin cámara). Escriba el CVD manualmente.",
      );
    }
  };

  const bucleEscaneo = (video: HTMLVideoElement) => {
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (o: object) => {
          detect(v: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;
    if (!Detector) {
      setCamaraError(
        "Su navegador no trae lector QR nativo. Apunte el QR y transcriba el CVD, o suba el PDF.",
      );
      return;
    }
    const detector = new Detector({ formats: ["qr_code"] });
    const escanearFrame = async () => {
      try {
        if (video.readyState >= 2) {
          const texto = (await detector.detect(video))?.[0]?.rawValue ?? "";
          const cvd = texto ? (extraerCvdDeTexto(texto) ?? texto.match(PATRON_CVD)?.[0]) : null;
          if (cvd) {
            detenerCamara();
            setCodigo(cvd);
            setMensaje(null);
            verificar(cvd);
            return;
          }
        }
      } catch {
        /* reintenta en el siguiente frame */
      }
      escaneoRef.current = requestAnimationFrame(escanearFrame);
    };
    escaneoRef.current = requestAnimationFrame(escanearFrame);
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Volver al inicio
          </Link>
          <p className="text-sm font-bold text-blue-700">
            ENT-M04-05 · Adriano David Espinoza Ramírez · Acceso público y anónimo (sin login)
          </p>
          <h1 className="text-2xl font-bold">
            Verificador público de Códigos de Verificación Digital (CVD)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Empleadores y entidades externas pueden contrastar la autenticidad de resoluciones
            impresas sin apersonarse a Pucallpa · D.S. N° 070-2013-PCM.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label htmlFor="codigo-cvd" className="text-sm font-bold text-slate-700">
            Código CVD del documento
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Máscara guiada: <code className="font-mono font-bold">{CVD_INPUT_MASK_HINT}</code>
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="codigo-cvd"
              type="text"
              value={codigo}
              onChange={(e) => {
                setCodigo(aplicarMascaraCvd(e.target.value));
                limpiar();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") verificarCodigo();
              }}
              placeholder="CVD-2026-RD-000412-892F"
              spellCheck={false}
              autoComplete="off"
              maxLength={26}
              aria-describedby="ayuda-cvd"
              aria-invalid={mensaje ? true : undefined}
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
          <p id="ayuda-cvd" className="mt-1 text-xs text-slate-400">
            El código está impreso en la estampa lateral marginal del documento físico.
          </p>

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
            <button
              type="button"
              onClick={camaraActiva ? detenerCamara : iniciarCamara}
              className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
            >
              {camaraActiva ? "■ Detener cámara" : "◉ Escanear QR con cámara"}
            </button>
          </div>

          {camaraActiva && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-slate-950 p-3">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-56 w-full rounded-lg object-cover"
                aria-label="Vista previa de la cámara para escanear el QR del documento"
              />
              <p className="mt-2 text-center text-xs text-slate-300">
                Apunte la cámara al código QR del documento impreso…
              </p>
            </div>
          )}
          {camaraError && (
            <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {camaraError}
            </p>
          )}

          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-sm font-bold text-slate-700">¿Posee el PDF oficial? Arrástrelo aquí</p>
            <label
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  entradaArchivoRef.current?.click();
                }
              }}
              className="mt-3 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-sm text-slate-500 transition hover:border-blue-400 hover:bg-blue-50"
            >
              <span aria-hidden="true" className="text-2xl">⬆</span>
              <span>
                Seleccionar o soltar el documento <b>.PDF</b> — el sistema extraerá automáticamente
                el CVD de su firma PAdES y lo validará.
              </span>
              <input
                ref={entradaArchivoRef}
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  if (archivo) manejarArchivoPdf(archivo);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {mensaje && (
            <p role="status" className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              {mensaje}
            </p>
          )}

          {isValidando && (
            <div role="status" className="mt-5 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
              Consultando validador institucional…
            </div>
          )}

          {error && (
            <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-bold">{error.titulo}</p>
              <p className="mt-1">{error.detalle}</p>
              <p className="mt-2 text-xs opacity-70">Referencia interna: HTTP {error.codigoEstado}</p>
            </div>
          )}

          {resultado && !isValidando && (
            <div className="mt-5">
              <CvdIntegrityReport resultado={resultado} />
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-800">¿Qué es el CVD?</h2>
            <p className="mt-2 text-sm leading-5 text-slate-600">
              El Código de Verificación Digital es el identificador único que el IESTP Suiza estampa
              sobre todo documento electrónico suscrito. Resuelto contra el repositorio
              institucional, permite comprobar autenticidad, integridad y vigencia, identidad de
              firmantes y sello de tiempo TSA.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-800">Marco normativo aplicable</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-5 text-slate-600">
              <li>Ley N° 27269 — Firmas y Certificados Digitales.</li>
              <li>D.S. N° 070-2013-PCM — Representación impresa y CVD.</li>
              <li>Ley N° 27444 — Ley del Procedimiento Administrativo General.</li>
            </ul>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Validador CVD · ENT-M04-05 · Módulo 04 · Consulta anónima: no se solicitan credenciales
        </p>
      </section>
    </main>
  );
}
