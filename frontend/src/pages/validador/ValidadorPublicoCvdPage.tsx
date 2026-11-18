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
import { Button } from "../../components/ui/Button";
import { ContextualHelp } from "../../components/ui/ContextualHelp";

const PATRON_CVD = /CVD-(?:19|20)\d{2}-(?:[A-Z]{2,6}-\d{6}-[A-F0-9]{4}|[A-Z0-9]{2,16}(?:-[A-Z0-9]{2,16})*)/;

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
          "No se identificó un código CVD en el archivo y/o su texto está comprimido (PDF firmado). Pegue o escriba el código manualmente."
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
        "No se pudo acceder a la cámara (permiso denegado o sin cámara). Escriba el CVD manualmente."
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
        "Su navegador no trae lector QR nativo. Apunte el QR y transcriba el CVD, o suba el PDF."
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
    <main className="min-h-screen bg-surface-page text-slate-900 pb-12">
      <header className="border-b border-slate-200 bg-white shadow-2xs">
        <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-suiza-primary transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al inicio
          </Link>

          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-suiza-primary" />
              Verificador público de Códigos de Verificación Digital (CVD)
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Verificar documento
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            Ingresa el CVD o escanea el código QR para contrastar la autenticidad, integridad y vigencia de resoluciones y actos emitidos por el IESTP &quot;Suiza&quot;.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {/* Panel Principal de Verificación */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="codigo-cvd" className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-suiza-primary" />
                Código de Verificación Digital (CVD)
                <ContextualHelp
                  title="¿Qué es el código CVD?"
                  content="Es una clave alfanumérica única impresa en la estampa marginal de cada documento firmado digitalmente. Permite corroborar su autenticidad y verificar que no haya sido alterado."
                />
              </label>
              <span className="text-xs text-slate-500">
                Máscara guiada:{" "}
                <code className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
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
                maxLength={42}
                aria-describedby="ayuda-cvd"
                aria-invalid={mensaje ? true : undefined}
                className="h-11 min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20 focus:outline-none transition"
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => verificarCodigo()}
                disabled={isValidando}
                isLoading={isValidando}
                loadingText="Verificando..."
                className="shrink-0"
              >
                Verificar
              </Button>
            </div>

            <p id="ayuda-cvd" className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
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
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-xs text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                {ejemplo}
              </button>
            ))}
            <button
              type="button"
              onClick={camaraActiva ? detenerCamara : iniciarCamara}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1 text-xs font-bold text-slate-800 transition hover:bg-slate-50 cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5 text-suiza-primary" />
              {camaraActiva ? "■ Detener cámara" : "◉ Escanear QR con cámara"}
            </button>
          </div>

          {camaraActiva && (
            <div className="rounded-xl border border-slate-300 bg-slate-950 p-3 shadow-inner">
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
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs sm:text-sm text-amber-900">
              {camaraError}
            </p>
          )}

          {/* Área Drag-and-Drop PDF */}
          <div className="border-t border-slate-100 pt-5">
            <p className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
              <Upload className="h-4 w-4 text-suiza-primary" />
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
              className="flex cursor-pointer flex-col sm:flex-row items-center justify-center gap-3.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center sm:text-left text-xs sm:text-sm text-slate-600 transition hover:border-suiza-primary hover:bg-slate-50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-suiza-primary border border-slate-200 shadow-2xs">
                <Upload className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="font-semibold text-slate-800">
                  Seleccionar o soltar el documento <strong>.PDF</strong>
                </p>
                <p className="text-xs text-slate-500">
                  El sistema extraerá automáticamente el código CVD de su firma digital y lo validará contra el registro oficial.
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
            <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs sm:text-sm text-sky-900">
              {mensaje}
            </p>
          )}

          {isValidando && (
            <div role="status" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:text-sm text-slate-800">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-suiza-primary border-t-transparent" />
              Consultando validador institucional en tiempo real…
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-900">
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

        {/* Paneles Informativos Institucionales */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Panel: ¿Qué es el CVD? */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-suiza-primary border border-sky-100">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Seguridad Documental
                </span>
                <h2 className="text-base font-bold text-slate-900">¿Qué es el CVD?</h2>
              </div>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
              El <strong>Código de Verificación Digital (CVD)</strong> es el identificador único e irrepetible
              que el IESTP Suiza estampa sobre todo documento electrónico suscrito con firma digital.
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <p>• <strong>Autenticidad:</strong> Acredita la identidad de los firmantes mediante certificados RENIEC / IOFE.</p>
              <p>• <strong>Integridad:</strong> Garantiza que el contenido no ha sufrido alteraciones posteriores a su firma.</p>
              <p>• <strong>Sellado TSA:</strong> Prueba de fecha y hora exacta de emisión conforme al estándar RFC 3161.</p>
            </div>
          </div>

          {/* Panel: Marco Normativo Aplicable */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Base Jurídica
                </span>
                <h2 className="text-base font-bold text-slate-900">Marco normativo aplicable</h2>
              </div>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
              El cotejo público de validez legal y eficacia probatoria se fundamenta en las siguientes normas:
            </p>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-suiza-primary mt-1.5 shrink-0" />
                <div>
                  <strong>Ley N° 27269</strong> — Ley de Firmas y Certificados Digitales (pleno valor probatorio y no repudio).
                </div>
              </li>
              <li className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-suiza-primary mt-1.5 shrink-0" />
                <div>
                  <strong>D.S. N° 070-2013-PCM</strong> — Reglamento de representación impresa y validez del código CVD.
                </div>
              </li>
              <li className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-suiza-primary mt-1.5 shrink-0" />
                <div>
                  <strong>Ley N° 27444</strong> — Ley del Procedimiento Administrativo General (validez de actos emitidos).
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Pie Institucional Sin Códigos de Módulo Ni Nombres Internos */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-center text-xs text-slate-500 shadow-2xs flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>Validador CVD · IESTP &quot;Suiza&quot;</span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span>Consulta pública y anónima: no requiere credenciales</span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <Link to="/flujo-validez-legal" className="text-suiza-primary font-semibold hover:underline inline-flex items-center gap-1">
            Validez legal de firma digital <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </section>
    </main>
  );
}
