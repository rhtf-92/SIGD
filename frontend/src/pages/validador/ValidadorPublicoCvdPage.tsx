/**
 * ValidadorPublicoCvdPage — F_ADRIANO / ENT-M04-05 / T-FE-DOC-03.
 * Portal 100% público y anónimo (/validador-cvd): sin login, sin JWT.
 * Máscara guiada CVD-YYYY-RD-XXXXXX-XXXX, escaneo QR con cámara web,
 * carga de PDF y dictamen formal CvdIntegrityReport (D.S. N° 070-2013-PCM).
 * Maquillado: glassmorphism / neón — consistente con el prototipo SIGD.
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

/* ─── KPIs estáticos del validador ─── */
const KPI_DATA = [
  { label: "Documentos validados", valor: "12 847", icono: "🗂️", color: "from-blue-600 to-indigo-700" },
  { label: "Válidos hoy", valor: "218", icono: "✅", color: "from-emerald-500 to-teal-600" },
  { label: "Alertas detectadas", valor: "4", icono: "⚠️", color: "from-amber-500 to-orange-600" },
  { label: "Tiempo promedio", valor: "0.8 s", icono: "⚡", color: "from-violet-500 to-purple-700" },
];

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
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-slate-100">

      {/* ── Barra de acento institucional ── */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

      {/* ── Header glassmorphism ── */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-200 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
          >
            ← Volver al inicio
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-blue-400/40 bg-blue-500/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-300">
              ENT-M04-05 · Acceso público y anónimo
            </span>
            <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-300">
              D.S. N° 070-2013-PCM
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            <span className="bg-gradient-to-r from-blue-300 to-violet-300 bg-clip-text text-transparent">
              Validador CVD
            </span>{" "}
            — Verificación Digital Institucional
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Empleadores y entidades externas pueden contrastar la autenticidad de
            resoluciones impresas · IESTP Suiza — Pucallpa
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">

        {/* ── KPIs superiores ── */}
        <section aria-label="Indicadores del validador CVD" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPI_DATA.map((kpi) => (
            <article
              key={kpi.label}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-sm transition hover:bg-white/10"
            >
              {/* fondo neón sutil */}
              <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br ${kpi.color} opacity-20 blur-2xl`} />
              <span className="text-2xl" aria-hidden="true">{kpi.icono}</span>
              <p className="mt-2 text-2xl font-extrabold text-white">{kpi.valor}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-400">{kpi.label}</p>
            </article>
          ))}
        </section>

        {/* ── Panel principal de verificación ── */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg shadow-lg shadow-blue-500/30">
              🔍
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Ingresar código CVD</h2>
              <p className="text-xs text-slate-400">
                Máscara guiada:{" "}
                <code className="font-mono font-bold text-blue-300">{CVD_INPUT_MASK_HINT}</code>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
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
              aria-label="Código CVD del documento"
              aria-describedby="ayuda-cvd"
              aria-invalid={mensaje ? true : undefined}
              className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-mono text-sm uppercase text-white placeholder:font-sans placeholder:normal-case placeholder:text-slate-500 backdrop-blur-sm transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 focus:outline-none"
            />
            <button
              type="button"
              id="btn-verificar-cvd"
              onClick={() => verificarCodigo()}
              disabled={isValidando}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-500 hover:to-indigo-500 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isValidando ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verificando…
                </span>
              ) : (
                "Verificar CVD"
              )}
            </button>
          </div>
          <p id="ayuda-cvd" className="mt-1.5 text-xs text-slate-500">
            El código está impreso en la estampa lateral marginal del documento físico.
          </p>

          {/* ejemplos y cámara */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Ejemplos:</span>
            {[CVD_VALIDO, CVD_ALTERADO].map((ejemplo) => (
              <button
                key={ejemplo}
                type="button"
                onClick={() => {
                  setCodigo(ejemplo);
                  verificarCodigo(ejemplo);
                }}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1 font-mono text-xs text-slate-300 transition hover:border-blue-400/50 hover:bg-blue-500/10 hover:text-blue-300"
              >
                {ejemplo}
              </button>
            ))}
            <button
              type="button"
              id="btn-camara-qr"
              onClick={camaraActiva ? detenerCamara : iniciarCamara}
              className="rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-300 transition hover:bg-violet-500/20 hover:text-violet-200"
            >
              {camaraActiva ? "■ Detener cámara" : "◉ Escanear QR"}
            </button>
          </div>

          {/* vista de cámara */}
          {camaraActiva && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-violet-500/30 bg-black/50 p-3 shadow-lg shadow-violet-500/10">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-56 w-full rounded-xl object-cover"
                aria-label="Vista previa de la cámara para escanear el QR del documento"
              />
              <p className="mt-2 text-center text-xs text-slate-400">
                Apunte la cámara al código QR del documento impreso…
              </p>
            </div>
          )}
          {camaraError && (
            <p role="status" className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              {camaraError}
            </p>
          )}

          {/* carga PDF */}
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-sm font-bold text-white">¿Posee el PDF oficial? Arrástrelo aquí</p>
            <label
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  entradaArchivoRef.current?.click();
                }
              }}
              className="mt-3 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 px-6 py-8 text-sm text-slate-400 transition hover:border-blue-400/50 hover:bg-blue-500/5 hover:text-slate-200"
            >
              <span aria-hidden="true" className="text-2xl">📄</span>
              <span>
                Seleccionar o soltar el documento <b className="text-white">.PDF</b> — el sistema
                extraerá automáticamente el CVD de su firma PAdES y lo validará.
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

          {/* mensajes */}
          {mensaje && (
            <p role="status" className="mt-4 rounded-xl border border-blue-400/30 bg-blue-500/10 p-3 text-sm text-blue-300">
              {mensaje}
            </p>
          )}

          {error && (
            <div role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-300">
              <p className="font-bold">{error.titulo}</p>
              <p className="mt-1 opacity-80">{error.detalle}</p>
              <p className="mt-2 text-xs opacity-50">Referencia: HTTP {error.codigoEstado}</p>
            </div>
          )}
        </section>

        {/* ── Resultado de verificación ── */}
        {resultado && !isValidando && (
          <section className="animate-fade-in">
            <CvdIntegrityReport resultado={resultado} />
          </section>
        )}

        {/* ── Información normativa ── */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <span className="text-base">📋</span> ¿Qué es el CVD?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              El Código de Verificación Digital es el identificador único que el IESTP Suiza
              estampa sobre todo documento electrónico suscrito. Resuelto contra el repositorio
              institucional, permite comprobar autenticidad, integridad y vigencia, identidad de
              firmantes y sello de tiempo TSA.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <span className="text-base">⚖️</span> Marco normativo aplicable
            </h2>
            <ul className="mt-2 space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                Ley N° 27269 — Firmas y Certificados Digitales.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                D.S. N° 070-2013-PCM — Representación impresa y CVD.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                Ley N° 27444 — Ley del Procedimiento Administrativo General.
              </li>
            </ul>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600">
          Validador CVD · ENT-M04-05 · Módulo 04 · Consulta anónima: no se solicitan credenciales
        </p>
      </div>
    </main>
  );
}
