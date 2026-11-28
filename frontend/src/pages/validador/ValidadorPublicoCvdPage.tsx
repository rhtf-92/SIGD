/**
 * ValidadorPublicoCvdPage — F_ADRIANO / ENT-M04-05 / T-FE-DOC-03.
 * Portal 100% público y anónimo (/validador-cvd): sin login, sin JWT.
 * Máscara guiada CVD-YYYY-RD-XXXXXX-XXXX, escaneo QR con cámara web,
 * carga de PDF y dictamen formal CvdIntegrityReport (D.S. N° 070-2013-PCM).
 */
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Keyboard,
  Camera,
  FileText,
  Info,
  CheckCircle2,
  Scale,
  ShieldCheck,
  Loader2,
  Check,
} from "lucide-react";

import CvdIntegrityReport from "../../components/cvd/CvdIntegrityReport";
import {
  useCvdPublicVerification,
} from "../../hooks/useCvdPublicVerification";
import {
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
      className="relative w-full min-h-[calc(100vh-96px)] flex-1 text-slate-800 flex flex-col overflow-x-hidden bg-[#eef4fb] bg-cover bg-center bg-no-repeat selection:bg-[#0073E6]/20"
      style={{
        backgroundImage: "url('/fondo-validadorcvd.png')",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 1. Fondo fijo de respaldo con fondo-validadorcvd.png */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/fondo-validadorcvd.png')",
        }}
        aria-hidden="true"
      />

      {/* 2. Área principal de contenido */}
      <main className="relative z-10 w-full pt-4 sm:pt-6 pb-6 sm:pb-8 px-4 sm:px-6 lg:px-8 flex-1">
        <div className="mx-auto w-[94%] max-w-[1240px] space-y-6">
          
          {/* Fila Superior: Encabezado Hero a la izquierda y Botón "← Volver al Portal" a la derecha */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
            <div className="max-w-3xl">
              <h1 className="text-2xl sm:text-3xl lg:text-[38px] font-extrabold text-white tracking-tight leading-[1.18] drop-shadow-sm">
                Verificador público de <br className="hidden sm:inline" />
                Códigos de Verificación Digital (CVD)
              </h1>
              <p className="mt-2 text-sm sm:text-base lg:text-lg text-blue-100/95 font-normal leading-relaxed drop-shadow-xs">
                Consulte el registro institucional del CVD y coteja la integridad del documento almacenado.
              </p>
            </div>

            {/* Botón tipo píldora "← Volver al Portal" en esquina superior derecha */}
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/95 hover:bg-white text-[#082F7C] hover:text-[#0052CC] border border-blue-200 shadow-xs hover:shadow-md text-xs sm:text-sm font-semibold transition-all group shrink-0 self-start cursor-pointer"
              aria-label="Volver a la portada principal"
            >
              <span className="transition-transform group-hover:-translate-x-0.5 font-bold">←</span>
              <span>Volver al Portal</span>
            </Link>
          </div>

          {/* Grid de 2 columnas: Columna izquierda (tarjetas azul-celeste brillante) y Columna derecha (tarjeta blanca) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            
            {/* COLUMNA IZQUIERDA: 2 tarjetas con degradado/vidrio azul-celeste brillante, bordes luminosos celestes y sombra suave */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              
              {/* Tarjeta 1: "¿Qué es el CVD?" */}
              <div className="rounded-3xl border-2 border-sky-300/80 bg-gradient-to-br from-[#08358D] via-[#0C4ABF] to-[#062973] text-white p-6 sm:p-7 shadow-[0_16px_40px_rgba(8,47,124,0.25)] relative overflow-hidden backdrop-blur-md group hover:border-sky-300 transition-all duration-300">
                {/* Reflejo/borde de luz superior */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-80" />
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-sky-400/20 rounded-full blur-2xl pointer-events-none" />

                {/* Encabezado con ícono circular "i" */}
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-10 h-10 rounded-full bg-sky-400/25 border-2 border-sky-300 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <Info className="w-5 h-5 text-sky-100" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                    ¿Qué es el CVD?
                  </h2>
                </div>

                {/* Gráfico de documento verificado acompañando el bloque explicativo */}
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  {/* Ilustración de documento con check */}
                  <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-sky-400/30 to-blue-600/40 border-2 border-sky-300/80 shadow-md text-white">
                    <div className="flex flex-col items-center">
                      <ShieldCheck className="w-8 h-8 sm:w-9 sm:h-9 text-sky-200 drop-shadow-sm" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-200 mt-0.5">CVD</span>
                    </div>
                  </div>

                  {/* Párrafo explicativo completo */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-sky-50 leading-relaxed font-normal">
                      El Código de Verificación Digital es el identificador único que el IESTP Suiza estampa sobre documentos electrónicos suscritos. Esta consulta muestra la evidencia registrada y coteja el PDF con su SHA-256. No determina la vigencia del certificado ni sustituye una validación criptográfica de la firma.
                    </p>
                  </div>
                </div>

                {/* Pie con hash SHA-256 inmutable */}
                <div className="mt-4 pt-3.5 border-t border-sky-300/30 flex items-center gap-2.5 text-xs font-semibold text-sky-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Evidencia registrada con SHA-256 e integridad garantizada</span>
                </div>
              </div>

              {/* Tarjeta 2: "Marco Normativo Aplicable" */}
              <div className="rounded-3xl border-2 border-sky-300/80 bg-gradient-to-br from-[#08358D] via-[#0C4ABF] to-[#062973] text-white p-6 sm:p-7 shadow-[0_16px_40px_rgba(8,47,124,0.25)] relative overflow-hidden backdrop-blur-md group hover:border-sky-300 transition-all duration-300">
                {/* Reflejo/borde de luz superior */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-80" />
                <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-sky-400/20 rounded-full blur-2xl pointer-events-none" />

                {/* Encabezado con ícono circular de balanza */}
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-10 h-10 rounded-full bg-sky-400/25 border-2 border-sky-300 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <Scale className="w-5 h-5 text-sky-100" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                    Marco Normativo Aplicable
                  </h2>
                </div>

                {/* Lista con checks definidos */}
                <ul className="space-y-3 text-xs sm:text-sm text-sky-50 font-normal">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-sky-400/30 border border-sky-300 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    </div>
                    <span>Ley N° 27269 – Firmas y Certificados Digitales.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-sky-400/30 border border-sky-300 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    </div>
                    <span>D.S. N° 070-2013-PCM – Representación impresa y CVD.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-sky-400/30 border border-sky-300 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    </div>
                    <span>Ley N° 27444 – Ley del Procedimiento Administrativo General.</span>
                  </li>
                </ul>
              </div>

            </div>

            {/* COLUMNA DERECHA: Tarjeta blanca principal con acento celeste superior y controles bien proporcionados */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border-2 border-blue-100/90 bg-white shadow-[0_20px_60px_rgba(8,47,124,0.14)] p-6 sm:p-7 lg:p-8 space-y-5 relative overflow-hidden">
                {/* Acento luminoso/celeste en el borde superior de la tarjeta */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#00A3FF] via-[#38BDF8] to-[#0052CC]" />
                <div className="absolute top-2 left-0 right-0 h-6 bg-gradient-to-b from-sky-100/40 to-transparent pointer-events-none" />

                {/* Bloque superior: Código CVD del documento */}
                <div className="space-y-3.5 pt-1">
                  {/* Encabezado del bloque con lupa azul */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 border border-blue-200/80 text-[#0073E6] shadow-xs">
                      <Search className="w-5 h-5 text-[#0073E6]" aria-hidden="true" />
                    </div>
                    <label htmlFor="codigo-cvd" className="text-lg sm:text-xl font-extrabold text-[#082F7C] tracking-tight">
                      Código CVD del documento
                    </label>
                  </div>

                  {/* Fila de referencia con ícono de teclado y chips celestes */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pl-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700 mr-1">
                      <Keyboard className="w-4 h-4 text-slate-500" aria-hidden="true" />
                      <span>Máscara guiada:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCodigo("CVD-2026-");
                        limpiar();
                      }}
                      className="inline-flex items-center px-2.5 py-1 rounded-md bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-mono text-xs font-bold transition cursor-pointer"
                      title="Ejemplo de formato general"
                    >
                      CVD-YYYY-XXXXXXXXXXXXXXXX
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCodigo("CVD-2026-RD-");
                        limpiar();
                      }}
                      className="inline-flex items-center px-2.5 py-1 rounded-md bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-mono text-xs font-bold transition cursor-pointer"
                      title="Ejemplo de formato resolutivo"
                    >
                      CVD-YYYY-RD-XXXXX-XXXX
                    </button>
                  </div>

                  {/* Campo de entrada amplio a la izquierda y botón principal azul degradado a la derecha */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
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
                        className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 sm:px-5 py-3 sm:py-3.5 font-mono text-sm sm:text-base font-bold uppercase text-slate-800 placeholder:font-sans placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 focus:border-[#0073E6] focus:ring-4 focus:ring-[#0073E6]/15 outline-none shadow-xs transition"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => verificarCodigo()}
                      disabled={isValidando}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0038A8] via-[#0052CC] to-[#0073E6] hover:from-[#002D88] hover:via-[#0047AB] hover:to-[#005fb8] px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isValidando ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Verificando…</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-5 h-5 text-white stroke-[2.5]" aria-hidden="true" />
                          <span>Verificar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Debajo del input: Nota informativa a la izquierda y botón "Escanear QR con cámara" a la derecha */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0073E6] text-white text-[10px] font-serif font-bold shrink-0">
                        i
                      </span>
                      <p id="ayuda-cvd" className="text-xs text-slate-500 font-medium">
                        El código está impreso en la estampa lateral marginal del documento físico.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={camaraActiva ? detenerCamara : iniciarCamara}
                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#0052CC] px-4 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer shrink-0 whitespace-nowrap self-start sm:self-auto"
                    >
                      <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{camaraActiva ? "Detener cámara" : "Escanear QR con cámara"}</span>
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
                </div>

                {/* Línea divisoria horizontal sutil */}
                <div className="border-t border-slate-200/80 my-3" />

                {/* Bloque inferior: ¿Posee el PDF oficial? Arrástrelo aquí */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0073E6] text-white text-xs font-bold shadow-2xs shrink-0">
                      !
                    </span>
                    <h3 className="text-base sm:text-lg font-extrabold text-[#082F7C]">
                      ¿Posee el PDF oficial? Arrástrelo aquí
                    </h3>
                  </div>

                  {/* Zona interactiva de drag & drop con borde redondeado celeste suave */}
                  <label
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        entradaArchivoRef.current?.click();
                      }
                    }}
                    onDragOver={(e: DragEvent<HTMLLabelElement>) => {
                      e.preventDefault();
                    }}
                    onDrop={(e: DragEvent<HTMLLabelElement>) => {
                      e.preventDefault();
                      const archivo = e.dataTransfer.files?.[0];
                      if (archivo) manejarArchivoPdf(archivo);
                    }}
                    className="flex cursor-pointer items-center gap-4 sm:gap-6 rounded-2xl border-2 border-dashed border-sky-300 hover:border-[#0073E6] bg-gradient-to-br from-white to-blue-50/40 hover:bg-blue-50/70 p-5 sm:p-6 text-slate-600 transition-all duration-200 shadow-xs group"
                  >
                    {/* Ícono de documento PDF en azul a la izquierda */}
                    <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200/90 text-[#0073E6] font-black text-sm sm:text-base shadow-xs group-hover:scale-105 transition-transform">
                      <div className="flex flex-col items-center">
                        <FileText className="w-6 h-6 text-[#0073E6]" />
                        <span className="text-[10px] font-extrabold tracking-wider mt-0.5 text-[#0052CC]">PDF</span>
                      </div>
                    </div>

                    {/* Separador vertical */}
                    <div className="w-[1.5px] h-12 bg-slate-200/90 shrink-0 hidden sm:block" />

                    {/* Texto explicativo */}
                    <div className="text-xs sm:text-sm leading-relaxed text-slate-600 min-w-0">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
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
                  <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 flex items-start gap-2.5 animate-fadeIn">
                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <span>{mensaje}</span>
                  </div>
                )}

                {isValidando && (
                  <div role="status" className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-900 animate-fadeIn">
                    <Loader2 className="w-5 h-5 text-[#0073E6] animate-spin shrink-0" />
                    <span>Consultando validador institucional…</span>
                  </div>
                )}

                {error && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 animate-fadeIn">
                    <p className="font-bold">{error.titulo}</p>
                    <p className="mt-1">{error.detalle}</p>
                    <p className="mt-2 text-xs opacity-70">Referencia interna: HTTP {error.codigoEstado}</p>
                  </div>
                )}

                {/* Resultado de validación formal */}
                {resultado && !isValidando && (
                  <div className="mt-6 animate-fadeIn">
                    <CvdIntegrityReport resultado={resultado} />
                  </div>
                )}
              </div>
            </div>

          </div>

          <p className="text-center text-xs text-sky-200/80 pt-1 sm:pt-2 drop-shadow-2xs">
            Validador CVD · Sede Digital IESTP Suiza · Consulta pública y anónima conforme a D.S. N° 070-2013-PCM
          </p>
        </div>
      </main>
    </div>
  );
}
