import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CreditCard,
  Fingerprint,
  History,
  Keyboard,
  Loader2,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  buscarPersonaDni,
  esDniValido,
  extraerDni,
  guardarPersonaDni,
  obtenerDnisGuardados,
  type PersonaDniDemo,
} from "../../data/padronDniDemo";

interface BarcodeDetectorLike {
  detect(source: unknown): Promise<Array<{ rawValue: string }>>;
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type Vista = "inicio" | "camara" | "manual" | "exito";

export interface LectorDniDigitalProps {
  onDetected?: (persona: PersonaDniDemo) => void;
  label?: string;
  variant?: "solid" | "ghost" | "inline";
  triggerClassName?: string;
  hideTrigger?: boolean;
}

const FORMATOS = ["pdf417", "qr_code", "code_128", "code_39"];

function obtenerDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

function formatearFecha(fecha: string): string {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.split("-");
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

function iniciales(nombres: string, apellidos: string): string {
  return `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
}

export default function LectorDniDigital({
  onDetected,
  label = "Escanear DNI digital",
  variant = "ghost",
  triggerClassName,
  hideTrigger = false,
}: LectorDniDigitalProps) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista>("inicio");
  const [cargando, setCargando] = useState(false);
  const [persona, setPersona] = useState<PersonaDniDemo | null>(null);
  const [error, setError] = useState("");
  const [dniManual, setDniManual] = useState("");
  const [guardados, setGuardados] = useState<PersonaDniDemo[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [camaraLista, setCamaraLista] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const limpiarCamara = () => {
    if (loopRef.current) {
      window.clearTimeout(loopRef.current);
      loopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamaraLista(false);
  };

  const limpiarTemporizador = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      limpiarCamara();
      limpiarTemporizador();
    };
  }, []);

  const abrir = () => {
    setGuardados(obtenerDnisGuardados());
    setVista("inicio");
    setError("");
    setCargando(false);
    setDniManual("");
    setAbierto(true);
  };

  const cerrar = () => {
    limpiarCamara();
    limpiarTemporizador();
    setAbierto(false);
    setCargando(false);
    setError("");
  };

  useEffect(() => {
    const abrirPorEvento = () => abrir();
    window.addEventListener("sigd:abrir-lector-dni", abrirPorEvento);
    return () => window.removeEventListener("sigd:abrir-lector-dni", abrirPorEvento);
  });

  useEffect(() => {
    if (!abierto) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (vista !== "camara") limpiarCamara();
  }, [vista]);

  const consultarDni = (valor: string) => {
    const dni = valor.replace(/\D/g, "").slice(0, 8);
    if (!esDniValido(dni)) {
      setError("El DNI debe contener exactamente 8 dígitos numéricos.");
      setVista("manual");
      return;
    }

    setError("");
    setCargando(true);
    limpiarTemporizador();
    timerRef.current = window.setTimeout(() => {
      const encontrado = buscarPersonaDni(dni);
      if (!encontrado) {
        setError("No se encontraron datos para ese DNI en el padrón demo.");
        setCargando(false);
        setVista("manual");
        return;
      }
      guardarPersonaDni(encontrado);
      setPersona(encontrado);
      setGuardados(obtenerDnisGuardados());
      setCargando(false);
      setVista("exito");
    }, 900);
  };

  const detectarEnFuente = async (fuente: unknown): Promise<boolean> => {
    const Detector = obtenerDetector();
    if (!Detector) return false;
    try {
      const detector = new Detector({ formats: FORMATOS });
      const resultados = await detector.detect(fuente);
      for (const resultado of resultados) {
        const dni = extraerDni(resultado.rawValue);
        if (dni) {
          consultarDni(dni);
          return true;
        }
      }
    } catch {
      return false;
    }
    return false;
  };

  const procesarArchivo = async (archivo: File) => {
    setError("");
    setVista("inicio");
    setCargando(true);

    const dniEnNombre = extraerDni(archivo.name);
    let detectado = false;

    if (typeof createImageBitmap === "function" && archivo.type.startsWith("image/")) {
      try {
        const bitmap = await createImageBitmap(archivo);
        detectado = await detectarEnFuente(bitmap);
        bitmap.close?.();
      } catch {
        detectado = false;
      }
    }

    if (detectado) return;

    if (dniEnNombre) {
      consultarDni(dniEnNombre);
      return;
    }

    setCargando(false);
    setVista("manual");
    setError(
      obtenerDetector()
        ? "No se pudo leer un código PDF417 legible. Acerca la imagen o ingresa el DNI manualmente."
        : "Este navegador no puede leer PDF417 automáticamente. Ingresa el DNI manualmente para consultar el padrón demo.",
    );
  };

  const iniciarCamara = async () => {
    setVista("camara");
    setError("");
    setCargando(false);
    setCamaraLista(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setVista("manual");
      setError("Tu navegador no expone acceso a cámara. Ingresa el DNI manualmente.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      await new Promise((resolve) => window.setTimeout(resolve, 80));
      const video = videoRef.current;
      if (!video) {
        limpiarCamara();
        setVista("manual");
        setError("No se pudo inicializar la vista de cámara. Ingresa el DNI manualmente.");
        return;
      }

      video.srcObject = stream;
      await video.play();
      setCamaraLista(true);

      const Detector = obtenerDetector();
      if (!Detector) {
        setError(
          "La cámara está activa, pero este navegador no lee PDF417 automáticamente. Captura una foto o ingresa el DNI manualmente.",
        );
        return;
      }

      const detector = new Detector({ formats: FORMATOS });
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const resultados = await detector.detect(videoRef.current);
          for (const resultado of resultados) {
            const dni = extraerDni(resultado.rawValue);
            if (dni) {
              limpiarCamara();
              consultarDni(dni);
              return;
            }
          }
        } catch {
          // Cuadro sin código legible: continuar escaneando.
        }
        loopRef.current = window.setTimeout(tick, 520);
      };
      loopRef.current = window.setTimeout(tick, 520);
    } catch {
      limpiarCamara();
      setVista("manual");
      setError("No se pudo acceder a la cámara. Verifica los permisos o ingresa el DNI manualmente.");
    }
  };

  const capturarFoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("La cámara aún no está lista. Espera un momento e inténtalo de nuevo.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const contexto = canvas.getContext("2d");
    if (!contexto) return;
    contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const archivo = new File([blob], `dni-${Date.now()}.jpg`, { type: "image/jpeg" });
        limpiarCamara();
        void procesarArchivo(archivo);
      },
      "image/jpeg",
      0.92,
    );
  };

  const usarDatos = () => {
    if (!persona) return;
    onDetected?.(persona);
    cerrar();
  };

  const triggerClass =
    triggerClassName ??
    (variant === "solid"
      ? "btn-cyber"
      : variant === "inline"
        ? "inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/35 hover:bg-white/10"
        : "btn-ghost-cyber");

  const modal = abierto
    ? createPortal(
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cerrar();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lector-dni-titulo"
            className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#09090b] shadow-[0_40px_120px_-40px_rgba(0,0,0,1)]"
          >
            <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/10 bg-[#09090b]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/[0.05]">
                  <Fingerprint className="h-5 w-5 text-white" />
                </span>
                <div>
                  <h2 id="lector-dni-titulo" className="text-base font-bold text-white">
                    Lector de DNI digital
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse-soft" />
                    Modo demostración · padrón local
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar lector de DNI"
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/30 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="relative p-5 sm:p-6">
              {cargando && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#09090b]/92 backdrop-blur-sm">
                  <span className="relative grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/[0.04]">
                    <Loader2 className="h-7 w-7 animate-spin text-white" />
                    <span className="absolute inset-x-2 h-px bg-white/70 animate-scan" />
                  </span>
                  <p className="text-sm font-semibold text-white">Leyendo código PDF417…</p>
                  <p className="text-xs text-zinc-500">Verificando identidad en el padrón demo</p>
                </div>
              )}

              {vista === "inicio" && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm leading-relaxed text-zinc-400">
                      Acerca el DNI electrónico a la cámara o sube una foto del reverso. Al detectar
                      el código <span className="font-semibold text-white">PDF417</span> se mostrarán
                      todos los datos y quedarán guardados en este dispositivo.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setArrastrando(true);
                    }}
                    onDragLeave={() => setArrastrando(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setArrastrando(false);
                      const archivo = event.dataTransfer.files?.[0];
                      if (archivo) void procesarArchivo(archivo);
                    }}
                    className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 py-9 text-center transition ${
                      arrastrando
                        ? "border-white/60 bg-white/[0.08]"
                        : "border-white/15 bg-white/[0.02] hover:border-white/35 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/[0.04]">
                      <Upload className="h-6 w-6 text-white" />
                    </span>
                    <span className="text-sm font-semibold text-white">
                      Arrastra o selecciona una imagen del DNI
                    </span>
                    <span className="text-xs text-zinc-500">JPG, PNG o WEBP · reverso con PDF417</span>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const archivo = event.target.files?.[0];
                      if (archivo) void procesarArchivo(archivo);
                      event.target.value = "";
                    }}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => void iniciarCamara()} className="btn-ghost-cyber justify-start px-4 py-3">
                      <Camera className="h-4 w-4" />
                      Usar cámara
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVista("manual");
                        setError("");
                      }}
                      className="btn-ghost-cyber justify-start px-4 py-3"
                    >
                      <Keyboard className="h-4 w-4" />
                      Ingresar DNI manual
                    </button>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                      <ScanLine className="h-3.5 w-3.5" />
                      Probar demo rápida
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["12345678", "74561234", "45678912"].map((dni) => (
                        <button
                          key={dni}
                          type="button"
                          onClick={() => consultarDni(dni)}
                          className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-xs font-semibold text-zinc-200 transition hover:border-white/40 hover:bg-white/10"
                        >
                          {dni}
                        </button>
                      ))}
                    </div>
                  </div>

                  {guardados.length > 0 && (
                    <div>
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        <History className="h-3.5 w-3.5" />
                        DNI guardados en este dispositivo
                      </p>
                      <div className="mt-3 space-y-2">
                        {guardados.map((item) => (
                          <button
                            key={item.dni}
                            type="button"
                            onClick={() => {
                              setPersona(item);
                              setVista("exito");
                            }}
                            className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-white/30 hover:bg-white/[0.06]"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-white">
                                {item.nombreCompleto}
                              </span>
                              <span className="block font-mono text-[11px] text-zinc-500">
                                DNI {item.dni}
                              </span>
                            </span>
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-white/60" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {error && (
                    <p className="flex items-start gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-zinc-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {error}
                    </p>
                  )}
                </div>
              )}

              {vista === "camara" && (
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" />
                    {camaraLista && (
                      <>
                        <div className="pointer-events-none absolute inset-6 rounded-xl border border-white/40">
                          <span className="absolute -left-px -top-px h-5 w-5 border-l-2 border-t-2 border-white" />
                          <span className="absolute -right-px -top-px h-5 w-5 border-r-2 border-t-2 border-white" />
                          <span className="absolute -bottom-px -left-px h-5 w-5 border-b-2 border-l-2 border-white" />
                          <span className="absolute -bottom-px -right-px h-5 w-5 border-b-2 border-r-2 border-white" />
                        </div>
                        <div className="pointer-events-none absolute inset-x-6 h-px bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.9)] animate-scan" />
                        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
                          Apunta al código PDF417
                        </span>
                      </>
                    )}
                  </div>

                  {error && (
                    <p className="flex items-start gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-zinc-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {error}
                    </p>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={capturarFoto} className="btn-cyber" disabled={!camaraLista}>
                      <Camera className="h-4 w-4" />
                      Capturar y leer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        limpiarCamara();
                        setVista("manual");
                        setError("");
                      }}
                      className="btn-ghost-cyber"
                    >
                      <Keyboard className="h-4 w-4" />
                      Ingresar DNI manual
                    </button>
                  </div>
                </div>
              )}

              {vista === "manual" && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    consultarDni(dniManual);
                  }}
                  className="space-y-5"
                >
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm leading-relaxed text-zinc-400">
                      Ingresa el DNI de 8 dígitos. El padrón demo generará una identidad completa y
                      la guardará localmente para futuras lecturas.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="dni-manual" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                      Número de DNI
                    </label>
                    <input
                      id="dni-manual"
                      value={dniManual}
                      onChange={(event) => {
                        setDniManual(event.target.value.replace(/\D/g, "").slice(0, 8));
                        setError("");
                      }}
                      inputMode="numeric"
                      maxLength={8}
                      autoFocus
                      placeholder="12345678"
                      className="input-cyber font-mono text-lg tracking-[0.3em]"
                    />
                    {error && (
                      <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-zinc-300">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {["12345678", "74561234", "45678912"].map((dni) => (
                      <button
                        key={dni}
                        type="button"
                        onClick={() => {
                          setDniManual(dni);
                          consultarDni(dni);
                        }}
                        className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-xs font-semibold text-zinc-200 transition hover:border-white/40 hover:bg-white/10"
                      >
                        {dni}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button type="submit" className="btn-cyber flex-1" disabled={dniManual.length !== 8}>
                      <ScanLine className="h-4 w-4" />
                      Consultar padrón demo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVista("inicio");
                        setError("");
                      }}
                      className="btn-ghost-cyber flex-1"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Volver
                    </button>
                  </div>
                </form>
              )}

              {vista === "exito" && persona && (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 rounded-xl border border-white/20 bg-white/[0.06] p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-white" />
                    <div>
                      <p className="text-sm font-bold text-white">Datos guardados exitosamente</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        El DNI fue detectado y la identidad quedó almacenada en este dispositivo.
                        Revisa la información antes de usarla.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03]">
                    <div className="flex items-center gap-4 border-b border-white/10 p-4">
                      <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/[0.06] text-xl font-black text-white">
                        {iniciales(persona.nombres, persona.apellidos)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-white">{persona.nombreCompleto}</p>
                        <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.18em] text-zinc-400">
                          DNI {persona.dni}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Verificado · padrón demo
                        </p>
                      </div>
                    </div>

                    <dl className="grid gap-x-5 gap-y-3 p-4 sm:grid-cols-2">
                      {[
                        ["Fecha de nacimiento", formatearFecha(persona.fechaNacimiento)],
                        ["Sexo", persona.sexo],
                        ["Estado civil", persona.estadoCivil],
                        ["Nacionalidad", persona.nacionalidad],
                        ["Teléfono", persona.telefono],
                        ["Correo", persona.correo],
                        ["Dirección", persona.direccion],
                        ["Distrito / provincia", `${persona.distrito} / ${persona.provincia}`],
                        ["Ubigeo", persona.ubigeo],
                        ["Emisión", formatearFecha(persona.fechaEmision)],
                        ["Caducidad", formatearFecha(persona.fechaCaducidad)],
                        ["Código de verificación", persona.codigoVerificacion],
                      ].map(([rotulo, valor]) => (
                        <div key={rotulo} className={rotulo === "Dirección" ? "sm:col-span-2" : ""}>
                          <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                            {rotulo}
                          </dt>
                          <dd className="mt-1 break-words text-sm text-zinc-200">{valor}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={usarDatos} className="btn-cyber flex-1">
                      <CreditCard className="h-4 w-4" />
                      Usar estos datos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPersona(null);
                        setVista("inicio");
                        setError("");
                      }}
                      className="btn-ghost-cyber flex-1"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Escanear otro DNI
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {!hideTrigger && (
        <button type="button" onClick={abrir} className={triggerClass}>
          <Fingerprint className="h-4 w-4" />
          {label}
        </button>
      )}
      {modal}
    </>
  );
}
