/**
 * ValidadorPublicoCvdPage — F_ADRIANO / ENT-M04-05 / T-FE-DOC-03.
 * Portal 100% público y anónimo (/validador-cvd): sin login, sin JWT.
 * Máscara guiada CVD-YYYY-RD-XXXXXX-XXXX, escaneo QR con cámara web,
 * carga de PDF y dictamen formal CvdIntegrityReport (D.S. N° 070-2013-PCM).
 * Refinamiento visual Aqua / Glass Panels institucional.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Scale,
  FileText,
  ArrowLeft,
  QrCode,
  Upload,
  Info,
  ExternalLink,
} from "lucide-react";

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
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/35 to-teal-50/20 text-slate-900 pb-12">
      {/* Halo ambiental suave estilo Aqua / Glass */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[860px] max-w-full rounded-full bg-gradient-to-b from-cyan-300/25 via-teal-100/15 to-transparent blur-3xl" />
        <div className="absolute top-1/2 -right-24 h-64 w-64 rounded-full bg-cyan-200/20 blur-2xl" />
      </div>

      <header className="border-b border-cyan-200/70 bg-white/85 backdrop-blur-md shadow-2xs">
        <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-cyan-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-cyan-50/80 hover:border-cyan-300 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al inicio
          </Link>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/80 bg-gradient-to-b from-white/95 via-cyan-50/80 to-sky-50/60 px-3 py-1 text-xs font-bold text-cyan-950 shadow-[0_2px_6px_rgba(6,182,212,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-700" />
              Acceso público y anónimo (sin login)
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ENT-M04-05 · Adriano David Espinoza Ramírez
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Verificador público de Códigos de Verificación Digital (CVD)
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            Empleadores, entidades externas y ciudadanos pueden contrastar la autenticidad, integridad
            y vigencia de resoluciones y actos administrativos emitidos por el IESTP &quot;Suiza&quot; · D.S. N° 070-2013-PCM.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {/* Panel Principal de Verificación (Liquid Glass) */}
        <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-white/90 via-cyan-50/40 to-teal-50/25 p-6 sm:p-8 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(6,182,212,0.06),0_16px_48px_-8px_rgba(6,182,212,0.14),0_2px_12px_-2px_rgba(0,0,0,0.02)] ring-1 ring-cyan-200/50 backdrop-blur-md space-y-6 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent after:pointer-events-none after:absolute after:-top-24 after:-right-24 after:h-48 after:w-48 after:rounded-full after:bg-cyan-300/15 after:blur-2xl">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="codigo-cvd" className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-700" />
                Código CVD del documento
              </label>
              <span className="text-xs text-slate-500">
                Máscara guiada:{" "}
                <code className="font-mono font-bold text-cyan-900 bg-cyan-100/80 px-2 py-0.5 rounded border border-cyan-300 shadow-2xs">
                  {CVD_INPUT_MASK_HINT}
                </code>
              </span>
            </div>
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
                className="min-w-0 flex-1 rounded-2xl border border-cyan-200/90 bg-white/95 px-4.5 py-3 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case shadow-[inset_0_2px_4px_rgba(0,0,0,0.03),0_2px_6px_rgba(6,182,212,0.06)] focus:border-cyan-500 focus:ring-4 focus:ring-cyan-200/50 focus:outline-none transition"
              />
              <button
                type="button"
                onClick={() => verificarCodigo()}
                disabled={isValidando}
                className="rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 hover:from-teal-700 hover:via-cyan-700 hover:to-sky-700 px-7 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(6,182,212,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] transition hover:shadow-[0_6px_20px_rgba(6,182,212,0.45)] focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
              >
                {isValidando ? "Verificando..." : "Verificar"}
              </button>
            </div>
            <p id="ayuda-cvd" className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              El código está impreso en la estampa lateral marginal del documento físico o digital.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                className="rounded-full border border-cyan-200/90 bg-cyan-50/80 px-3 py-1 font-mono text-xs text-cyan-900 transition hover:border-cyan-400 hover:bg-cyan-100 shadow-2xs"
              >
                {ejemplo}
              </button>
            ))}
            <button
              type="button"
              onClick={camaraActiva ? detenerCamara : iniciarCamara}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300 bg-gradient-to-r from-cyan-100 to-teal-50 px-3.5 py-1 text-xs font-bold text-cyan-900 transition hover:bg-cyan-100 shadow-2xs"
            >
              <QrCode className="h-3.5 w-3.5 text-cyan-700" />
              {camaraActiva ? "■ Detener cámara" : "◉ Escanear QR con cámara"}
            </button>
          </div>

          {camaraActiva && (
            <div className="rounded-xl border border-cyan-300 bg-slate-950 p-3 shadow-inner">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-56 w-full rounded-lg object-cover"
                aria-label="Vista previa de la cámara para escanear el QR del documento"
              />
              <p className="mt-2 text-center text-xs text-cyan-200">
                Apunte la cámara al código QR del documento impreso…
              </p>
            </div>
          )}
          {camaraError && (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs sm:text-sm text-amber-900 shadow-2xs">
              {camaraError}
            </p>
          )}

          {/* Área Drag-and-Drop PDF */}
          <div className="border-t border-slate-100 pt-5">
            <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Upload className="h-4 w-4 text-cyan-700" />
              ¿Posee el PDF oficial? Arrástrelo aquí
            </p>
            <label
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  entradaArchivoRef.current?.click();
                }
              }}
              className="mt-3 flex cursor-pointer flex-col sm:flex-row items-center justify-center gap-3.5 rounded-2xl border-2 border-dashed border-cyan-300/80 bg-gradient-to-br from-white/90 via-cyan-50/40 to-teal-50/20 p-6 sm:p-8 text-center sm:text-left text-xs sm:text-sm text-slate-600 transition hover:border-cyan-400 hover:bg-cyan-50/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_2px_10px_rgba(6,182,212,0.05)] backdrop-blur-xs"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-100/90 text-cyan-800 border border-cyan-300 shadow-2xs">
                <Upload className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-800">
                  Seleccionar o soltar el documento <strong>.PDF</strong>
                </p>
                <p className="text-xs text-slate-500">
                  El sistema extraerá automáticamente el código CVD de su firma PAdES y lo validará contra la base de datos institucional.
                </p>
              </div>
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
            <p role="status" className="rounded-xl border border-cyan-200 bg-cyan-50/90 p-3 text-xs sm:text-sm text-cyan-900 shadow-2xs">
              {mensaje}
            </p>
          )}

          {isValidando && (
            <div role="status" className="flex items-center gap-3 rounded-xl border border-cyan-300 bg-cyan-50/70 p-4 text-xs sm:text-sm text-cyan-900 shadow-2xs">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-700 border-t-transparent" />
              Consultando validador institucional en tiempo real…
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50/90 p-4 text-xs sm:text-sm text-red-900 shadow-2xs">
              <p className="font-bold">{error.titulo}</p>
              <p className="mt-1">{error.detalle}</p>
              <p className="mt-2 text-xs opacity-70">Referencia interna: HTTP {error.codigoEstado}</p>
            </div>
          )}

          {resultado && !isValidando && (
            <div className="pt-2">
              <CvdIntegrityReport resultado={resultado} />
            </div>
          )}
        </div>

        {/* Paneles Informativos Aqua / Glass: ¿Qué es el CVD? y Marco Normativo */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Panel: ¿Qué es el CVD? (Liquid Glass) */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/85 bg-gradient-to-br from-white/90 via-cyan-50/40 to-teal-50/25 p-5 sm:p-6 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_12px_36px_-6px_rgba(6,182,212,0.12)] ring-1 ring-cyan-200/50 backdrop-blur-md space-y-3 transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent hover:-translate-y-1 hover:shadow-xl hover:border-cyan-300">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 border border-cyan-200 shadow-2xs group-hover:bg-cyan-200/80 transition">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 block">
                  Seguridad Documental
                </span>
                <h2 className="text-base font-bold text-slate-900">¿Qué es el CVD?</h2>
              </div>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
              El <strong>Código de Verificación Digital (CVD)</strong> es el identificador único e irrepetible
              que el IESTP Suiza estampa sobre todo documento electrónico suscrito con firma digital.
            </p>
            <div className="rounded-xl border border-cyan-200/70 bg-white/80 p-3 text-xs text-slate-600 space-y-1 shadow-2xs">
              <p>• <strong>Autenticidad:</strong> Acredita la identidad de los firmantes mediante certificados RENIEC / IOFE.</p>
              <p>• <strong>Integridad:</strong> Garantiza que el contenido no ha sufrido alteraciones posteriores a su firma.</p>
              <p>• <strong>Sellado TSA:</strong> Prueba de fecha y hora exacta de emisión conforme al estándar RFC 3161.</p>
            </div>
          </div>

          {/* Panel: Marco Normativo Aplicable (Legal Liquid Glass) */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/85 bg-gradient-to-br from-white/90 via-teal-50/40 to-cyan-50/25 p-5 sm:p-6 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_12px_36px_-6px_rgba(20,184,166,0.12)] ring-1 ring-teal-200/50 backdrop-blur-md space-y-3 transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent hover:-translate-y-1 hover:shadow-xl hover:border-teal-300">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-800 border border-teal-200 shadow-2xs">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
                  Base Jurídica
                </span>
                <h2 className="text-base font-bold text-slate-900">Marco normativo aplicable</h2>
              </div>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
              El cotejo público de validez legal y eficacia probatoria se fundamenta en las siguientes normas:
            </p>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex items-start gap-2 rounded-lg bg-white/80 p-2.5 border border-teal-100/90 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
                <div>
                  <strong>Ley N° 27269</strong> — Ley de Firmas y Certificados Digitales (pleno valor probatorio y no repudio).
                </div>
              </li>
              <li className="flex items-start gap-2 rounded-lg bg-white/80 p-2.5 border border-teal-100/90 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-600 mt-1.5 shrink-0" />
                <div>
                  <strong>D.S. N° 070-2013-PCM</strong> — Reglamento de representación impresa y validez del código CVD.
                </div>
              </li>
              <li className="flex items-start gap-2 rounded-lg bg-white/80 p-2.5 border border-teal-100/90 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-600 mt-1.5 shrink-0" />
                <div>
                  <strong>Ley N° 27444</strong> — Ley del Procedimiento Administrativo General (validez de actos emitidos).
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3.5 text-center text-xs text-slate-500 shadow-2xs backdrop-blur-xs flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>Validador CVD · ENT-M04-05 · Módulo 04</span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span>Consulta anónima: no se solicitan credenciales</span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <Link to="/transparencia/firma-digital" className="text-cyan-700 font-semibold hover:underline inline-flex items-center gap-1">
            Validez legal de firma digital <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </section>
    </main>
  );
}
