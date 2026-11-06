/**
 * ValidadorPublicoCvdPage — F_ADRIANO / ENT-M04-05 / T-FE-DOC-03.
 * Portal 100% público y anónimo (/validador-cvd): sin login, sin JWT.
 * Máscara guiada CVD-YYYY-RD-XXXXXX-XXXX, escaneo QR con cámara web,
 * carga de PDF y dictamen formal CvdIntegrityReport (D.S. N° 070-2013-PCM).
 *
 * Responsive Web Design (RWD) Full-Width Fluid Container Architecture:
 * - w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 sin restricciones rígidas laterales.
 * - Disposición ajustada y balanceada en monitores panorámicos (1080p, 2K, 4K),
 *   tablets y dispositivos móviles sin scroll horizontal espurio.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import CvdIntegrityReport from "../../components/cvd/CvdIntegrityReport";
import PublicCitizenNav from "../../components/common/PublicCitizenNav";
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
  const [searchParams] = useSearchParams();
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

  // Autoverificación opcional si se recibe ?cvd=... en los parámetros de la URL
  useEffect(() => {
    const cvdParam = searchParams.get("cvd");
    if (cvdParam) {
      const limpio = cvdParam.trim().toUpperCase();
      const chequeo = validarCvd(limpio);
      if (chequeo.valido) {
        setCodigo(chequeo.normalizado);
        setMensaje(null);
        verificar(chequeo.normalizado);
      } else {
        setCodigo(limpio);
        setMensaje(chequeo.motivo ?? "Código CVD inválido.");
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="flex-1 w-full bg-slate-100 text-slate-900">
      {/* Cabecera Fluida Institucional — 100% de ancho útil */}
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-4 sm:py-6">
          {/* Migajas de pan canónicas */}
          <nav
            aria-label="Migajas de pan del validador público"
            className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500"
          >
            <Link to="/" className="hover:text-blue-700 hover:underline transition-colors">
              Inicio
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600">Transparencia</span>
            <span className="text-slate-300">/</span>
            <span aria-current="page" className="font-semibold text-blue-700">
              Validador Público CVD
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                Verificador público de Códigos de Verificación Digital (CVD)
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-4xl">
                Cotejo fehaciente de autenticidad e integridad de resoluciones y documentos institucionales emitidos (D.S. N° 070-2013-PCM).
              </p>
            </div>
            <Link
              to="/"
              className="self-start sm:self-auto shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-blue-700 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              ← Volver al inicio
            </Link>
          </div>

          {/* Navegación unificada de servicios ciudadanos */}
          <PublicCitizenNav currentPath="/validador-cvd" className="mt-4 pt-3 border-t border-slate-100" />
        </div>
      </header>

      {/* Contenedor Principal de Operaciones RWD Full-Width Fluid */}
      <section className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Rejilla de Métodos de Validación: Código Manual / QR y Carga de PDF */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
          {/* Panel Izquierdo: Formulario de Código CVD + Escáner de Cámara */}
          <div className="lg:col-span-7 xl:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm space-y-5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="codigo-cvd" className="text-sm font-bold text-slate-800">
                  Código CVD del documento
                </label>
                <span className="text-xs text-slate-500">
                  Máscara guiada: <code className="font-mono font-bold text-blue-700">{CVD_INPUT_MASK_HINT}</code>
                </span>
              </div>

              <div className="mt-3 flex flex-col sm:flex-row gap-3">
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
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition"
                />
                <button
                  type="button"
                  onClick={() => verificarCodigo()}
                  disabled={isValidando}
                  className="shrink-0 rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isValidando ? "Verificando..." : "Verificar"}
                </button>
              </div>

              <p id="ayuda-cvd" className="mt-2 text-xs text-slate-400">
                El código está impreso en la estampa lateral marginal del documento físico.
              </p>
            </div>

            {/* Accesos rápidos y activación de lector óptico */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
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
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 shadow-2xs"
                >
                  {ejemplo}
                </button>
              ))}
              <button
                type="button"
                onClick={camaraActiva ? detenerCamara : iniciarCamara}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition shadow-2xs flex items-center gap-1.5 ${
                  camaraActiva
                    ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                <span>{camaraActiva ? "■" : "◉"}</span>
                <span>{camaraActiva ? "Detener cámara" : "Escanear QR con cámara"}</span>
              </button>
            </div>

            {/* Visor interactivo de escaneo QR */}
            {camaraActiva && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-slate-950 p-3 sm:p-4 shadow-inner">
                <div className="relative aspect-video max-h-72 w-full overflow-hidden rounded-lg bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                    aria-label="Vista previa de la cámara para escanear el QR del documento"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-44 w-44 rounded-lg border-2 border-dashed border-blue-400/80 bg-blue-500/10" />
                  </div>
                </div>
                <p className="mt-2 text-center text-xs text-slate-300">
                  Apunte la cámara al código QR del documento impreso…
                </p>
              </div>
            )}

            {camaraError && (
              <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs sm:text-sm text-amber-800">
                {camaraError}
              </p>
            )}
          </div>

          {/* Panel Derecho: Validador por PDF y Drag & Drop */}
          <div className="lg:col-span-5 xl:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-700 text-sm font-bold">
                  📄
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">¿Posee el PDF oficial? Arrástrelo aquí</h2>
                  <p className="text-xs text-slate-500">Extracción automática de firma y estampa CVD</p>
                </div>
              </div>

              <label
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    entradaArchivoRef.current?.click();
                  }
                }}
                className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 sm:p-8 text-center text-slate-600 transition hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer focus-within:ring-2 focus-within:ring-blue-400 group"
              >
                <span aria-hidden="true" className="text-3xl text-slate-400 group-hover:text-blue-600 transition group-hover:scale-110 duration-200">
                  ⬆
                </span>
                <p className="mt-2 text-xs sm:text-sm font-bold text-slate-800">
                  Arrastre o seleccione el documento <b>.PDF</b>
                </p>
                <span className="mt-1 text-xs text-slate-500 max-w-xs">
                  El sistema extraerá automáticamente el CVD de su firma PAdES y lo validará de inmediato.
                </span>
                <span className="mt-3 inline-flex items-center rounded-lg bg-white px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200 shadow-2xs group-hover:border-blue-300">
                  Examinar archivo local
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

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500">
              <span className="text-blue-600 text-sm shrink-0">💡</span>
              <span>
                Cotejo fehaciente en tiempo real conforme a la Ley N° 27269 de Firmas y Certificados Digitales.
              </span>
            </div>
          </div>
        </div>

        {/* Notificaciones y Estados de Validación a Ancho Completo */}
        {mensaje && (
          <p role="status" className="w-full rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs sm:text-sm text-blue-800 shadow-2xs">
            {mensaje}
          </p>
        )}

        {isValidando && (
          <div role="status" className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs sm:text-sm text-slate-700 shadow-2xs">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-700 border-t-transparent shrink-0" />
            <span>Consultando validador institucional…</span>
          </div>
        )}

        {error && (
          <div role="alert" className="w-full rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5 text-xs sm:text-sm text-red-800 shadow-2xs">
            <p className="font-bold text-base text-red-900">{error.titulo}</p>
            <p className="mt-1">{error.detalle}</p>
            <p className="mt-2 text-xs font-mono opacity-70">Referencia interna: HTTP {error.codigoEstado}</p>
          </div>
        )}

        {/* Dictamen Formal de Integridad Criptográfica a Ancho Completo */}
        {resultado && !isValidando && (
          <div className="w-full">
            <CvdIntegrityReport resultado={resultado} />
          </div>
        )}

        {/* Tarjetas Informativas y Marco Legal — Distribuidas de forma balanceada */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>🔍</span> ¿Qué es el CVD?
            </h2>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
              El Código de Verificación Digital es el identificador único que el IESTP Suiza estampa
              sobre todo documento electrónico suscrito. Resuelto contra el repositorio
              institucional, permite comprobar autenticidad, integridad y vigencia, identidad de
              firmantes y sello de tiempo TSA.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>⚖️</span> Marco normativo aplicable
            </h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs sm:text-sm leading-relaxed text-slate-600">
              <li>Ley N° 27269 — Firmas y Certificados Digitales.</li>
              <li>D.S. N° 070-2013-PCM — Representación impresa y CVD.</li>
              <li>Ley N° 27444 — Ley del Procedimiento Administrativo General.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs md:col-span-2 lg:col-span-1">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>🛡️</span> Garantía de Cero Repudio
            </h2>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
              Las firmas digitales estampadas cuentan con acreditación oficial de RENIEC y sellado de
              tiempo TSA RFC 3161, dotando a la representación impresa del mismo valor probatorio
              que el original electrónico en cualquier sede judicial o administrativa.
            </p>
          </div>
        </div>

        {/* Pie Oficial del Módulo */}
        <p className="text-center text-xs text-slate-400 pt-2 pb-4">
          Validador CVD Institucional · Consulta pública y fehaciente (D.S. N° 070-2013-PCM · Ley N° 27269)
        </p>
      </section>
    </div>
  );
}
