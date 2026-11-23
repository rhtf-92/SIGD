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
  useCvdPublicVerification,
} from "../../hooks/useCvdPublicVerification";
import {
  CVD_INPUT_MASK_HINT,
  aplicarMascaraCvd,
  extraerCvdDeTexto,
  validarCvd,
} from "../../utils/cvdValidator";

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
      const encontrado = extraerCvdDeTexto(texto);
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
          const cvd = texto ? extraerCvdDeTexto(texto) : null;
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
    <div
      className="relative w-full min-h-[calc(100vh-96px)] text-slate-800 flex flex-col overflow-x-hidden bg-[#eef4fb] bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/images/fondo-validadorcvd.png')",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 1. Fondo fijo de respaldo continuo con fondo-validadorcvd.png */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/fondo-validadorcvd.png')",
        }}
        aria-hidden="true"
      />

      {/* 2. Área principal de contenido */}
      <main className="relative z-10 w-full pt-6 sm:pt-10 pb-16 px-4 sm:px-6 lg:px-8 flex-1">
        <div className="mx-auto w-[94%] max-w-[1180px] space-y-8">
          {/* Cabecera superior del módulo */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 bg-white/85 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-sky-100/80 shadow-[0_8px_30px_rgba(2,30,80,0.06)]">
            <div className="flex items-center gap-5 sm:gap-6 min-w-0">
              {/* Ícono / Ilustración de escudo azul con check */}
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-50/90 border border-blue-200/80 text-[#0073E6] shadow-sm">
                <svg
                  className="w-9 h-9 sm:w-11 sm:h-11 text-[#0073E6]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>

              {/* Línea vertical divisoria */}
              <div className="hidden sm:block h-16 sm:h-20 w-px bg-slate-200 shrink-0" />

              {/* Bloque de Título y Subtítulo */}
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#082F7C] tracking-tight leading-tight">
                  Verificador público de <br className="hidden sm:inline" />
                  Códigos de Verificación Digital (CVD)
                </h1>
                <p className="mt-1.5 text-sm sm:text-base text-slate-600 font-normal leading-relaxed">
                  Consulte el registro institucional del CVD y coteje la integridad del documento almacenado.
                </p>
                <div className="w-14 sm:w-16 h-1 bg-[#0073E6] rounded-full mt-3" />
              </div>
            </div>

            {/* Botón superior derecho "← Volver al Portal" */}
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border-2 border-[#0073E6] text-[#0073E6] hover:bg-[#0073E6] hover:text-white font-semibold text-xs sm:text-sm transition-all duration-200 shadow-2xs group shrink-0 self-start md:self-center bg-white"
            >
              <span className="transition-transform group-hover:-translate-x-0.5 font-bold">←</span>
              <span>Volver al Portal</span>
            </Link>
          </div>

          {/* Disposición en dos columnas: Tarjetas informativas a la izquierda y Tarjeta principal desplazada a la derecha */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Columna Izquierda: Tarjetas informativas apiladas verticalmente en la parte superior */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 self-start order-2 lg:order-1">
              <div className="rounded-2xl border border-sky-100 bg-white/95 p-6 shadow-sm">
                <h2 className="text-sm font-bold text-[#082F7C] uppercase tracking-wider">¿Qué es el CVD?</h2>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                  El Código de Verificación Digital es el identificador único que el IESTP Suiza estampa
                  sobre documentos electrónicos suscritos. Esta consulta muestra la evidencia registrada
                  y coteja el PDF con su SHA-256. No determina la vigencia del certificado ni sustituye
                  una validación criptográfica de la firma.
                </p>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-white/95 p-6 shadow-sm">
                <h2 className="text-sm font-bold text-[#082F7C] uppercase tracking-wider">Marco normativo aplicable</h2>
                <ul className="mt-2.5 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-slate-600">
                  <li>Ley N° 27269 — Firmas y Certificados Digitales.</li>
                  <li>D.S. N° 070-2013-PCM — Representación impresa y CVD.</li>
                  <li>Ley N° 27444 — Ley del Procedimiento Administrativo General.</li>
                </ul>
              </div>
            </div>

            {/* Columna Derecha: Tarjeta Principal de Verificación y Carga de PDF */}
            <div className="lg:col-span-7 xl:col-span-8 order-1 lg:order-2">
              <div className="rounded-3xl border border-sky-100/90 bg-white shadow-[0_16px_40px_-8px_rgba(2,30,80,0.1),0_4px_16px_-2px_rgba(2,30,80,0.05)] p-6 sm:p-8 lg:p-10 space-y-6 transition-all duration-300">
                {/* Sección Superior: Título con ícono de documento y máscara guiada */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#0073E6] shadow-2xs">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <label htmlFor="codigo-cvd" className="text-base sm:text-lg font-extrabold text-[#082F7C]">
                      Código CVD del documento
                    </label>
                  </div>

                  <p className="text-xs text-slate-500 pl-10.5">
                    Máscara guiada: <code className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{CVD_INPUT_MASK_HINT}</code>
                  </p>
                </div>

                {/* Input con Botón Azul Sólido "Verificar" */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
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
                      maxLength={40}
                      aria-describedby="ayuda-cvd"
                      aria-invalid={mensaje ? true : undefined}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 sm:py-3.5 font-mono text-sm sm:text-base uppercase placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 focus:border-[#0073E6] focus:ring-2 focus:ring-[#0073E6]/25 focus:outline-none shadow-2xs transition"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => verificarCodigo()}
                    disabled={isValidando}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0073E6] hover:bg-[#005fb8] px-8 py-3 sm:py-3.5 text-sm sm:text-base font-bold text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>{isValidando ? "Verificando..." : "Verificar"}</span>
                  </button>
                </div>

                {/* Debajo del input: Texto informativo con ícono circular azul "i" y botón "Escanear QR con cámara" */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0073E6] text-white text-[10px] font-serif font-bold shrink-0">
                      i
                    </span>
                    <p id="ayuda-cvd" className="text-xs text-slate-500">
                      El código está impreso en la estampa lateral marginal del documento físico.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={camaraActiva ? detenerCamara : iniciarCamara}
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50/90 hover:bg-blue-100 px-4 py-1.5 text-xs font-bold text-[#0073E6] transition shadow-2xs cursor-pointer self-start sm:self-auto"
                  >
                    <span>{camaraActiva ? "■ Detener cámara" : "◉ Escanear QR con cámara"}</span>
                  </button>
                </div>

                {/* Vista previa de cámara */}
                {camaraActiva && (
                  <div className="rounded-2xl border border-blue-200 bg-slate-950 p-4 animate-fadeIn">
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className="h-60 w-full rounded-xl object-cover"
                      aria-label="Vista previa de la cámara para escanear el QR del documento"
                    />
                    <p className="mt-2.5 text-center text-xs text-slate-300 font-medium">
                      Apunte la cámara al código QR del documento impreso…
                    </p>
                  </div>
                )}
                {camaraError && (
                  <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800 animate-fadeIn">
                    {camaraError}
                  </p>
                )}

                {/* Franja/zona inferior dentro de la tarjeta: Recuadro suave con ícono circular azul "!", título y caja punteada */}
                <div className="rounded-2xl border border-sky-100 bg-[#f8fafc]/95 p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0073E6] text-white text-xs font-bold shadow-2xs shrink-0">
                      !
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-[#082F7C]">
                      ¿Posee el PDF oficial? Arrástrelo aquí
                    </h3>
                  </div>

                  {/* Caja punteada interior con el ícono/insignia 'PDF' y texto explicativo */}
                  <label
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        entradaArchivoRef.current?.click();
                      }
                    }}
                    className="flex cursor-pointer items-center gap-4 sm:gap-6 rounded-xl border-2 border-dashed border-sky-200 hover:border-[#0073E6] bg-white p-5 sm:p-6 text-slate-600 transition-all duration-200 hover:bg-blue-50/40 shadow-2xs group"
                  >
                    <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-600 font-black text-sm sm:text-base shadow-xs group-hover:scale-105 transition-transform">
                      <div className="flex flex-col items-center">
                        <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[10px] font-bold tracking-wider mt-0.5">PDF</span>
                      </div>
                    </div>

                    <div className="text-xs sm:text-sm leading-relaxed text-slate-600 min-w-0">
                      <span className="font-semibold text-slate-900">
                        Seleccionar o soltar el documento .PDF
                      </span>{" "}
                      — el sistema extraerá automáticamente el CVD si aparece como texto legible y lo consultará en el registro institucional.
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

                {/* Mensajes de feedback */}
                {mensaje && (
                  <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 animate-fadeIn">
                    {mensaje}
                  </p>
                )}

                {isValidando && (
                  <div role="status" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 animate-fadeIn">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0073E6] border-t-transparent" />
                    Consultando validador institucional…
                  </div>
                )}

                {error && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 animate-fadeIn">
                    <p className="font-bold">{error.titulo}</p>
                    <p className="mt-1">{error.detalle}</p>
                    <p className="mt-2 text-xs opacity-70">Referencia interna: HTTP {error.codigoEstado}</p>
                  </div>
                )}

                {resultado && !isValidando && (
                  <div className="mt-6 animate-fadeIn">
                    <CvdIntegrityReport resultado={resultado} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400">
            Validador CVD · Sede Digital IESTP Suiza · Consulta pública y anónima (sin credenciales)
          </p>
        </div>
      </main>
    </div>
  );
}
