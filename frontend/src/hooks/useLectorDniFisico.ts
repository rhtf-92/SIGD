import { useCallback, useEffect, useRef, useState } from "react";

import { extraerDni } from "../data/personaDni";

export type EstadoLectorFisico = "verificando" | "disponible" | "sin-agente" | "error";

export interface LecturaDniFisico {
  dni: string;
  origen: "agente" | "teclado";
}

interface UseLectorDniFisicoOptions {
  activo?: boolean;
  onLeer?: (lectura: LecturaDniFisico) => void;
  intervaloMs?: number;
}

interface WebUsbDeviceLike {
  classCode?: number;
  deviceClass?: number;
}

interface WebUsbLike {
  getDevices?: () => Promise<WebUsbDeviceLike[]>;
  requestDevice?: (options: unknown) => Promise<WebUsbDeviceLike>;
  addEventListener?: (tipo: string, listener: () => void) => void;
  removeEventListener?: (tipo: string, listener: () => void) => void;
}

const AGENTE_URL = (
  import.meta.env.VITE_LECTOR_DNI_AGENTE || "http://127.0.0.1:51234"
).replace(/\/+$/, "");

const DNI_VALIDO = /^\d{8}$/;

function obtenerWebUsb(): WebUsbLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { usb?: WebUsbLike }).usb ?? null;
}

function esLectorUsb(device: WebUsbDeviceLike): boolean {
  return device.classCode === 0x0b || device.deviceClass === 0x0b;
}

function leerBooleano(origen: Record<string, unknown>, claves: string[]): boolean | null {
  for (const clave of claves) {
    const valor = origen[clave];
    if (typeof valor === "boolean") return valor;
  }
  return null;
}

function leerTexto(origen: Record<string, unknown>, claves: string[]): string {
  for (const clave of claves) {
    const valor = origen[clave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return "";
}

async function pedirJson(url: string, init?: RequestInit, timeoutMs = 2500): Promise<unknown> {
  const controlador = new AbortController();
  const temporizador = window.setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const respuesta = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controlador.signal,
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return await respuesta.json().catch(() => null);
  } finally {
    window.clearTimeout(temporizador);
  }
}

export function useLectorDniFisico({
  activo = true,
  onLeer,
  intervaloMs = 1600,
}: UseLectorDniFisicoOptions = {}) {
  const [estado, setEstado] = useState<EstadoLectorFisico>("verificando");
  const [tarjetaPresente, setTarjetaPresente] = useState(false);
  const [mensaje, setMensaje] = useState("Buscando lector físico de DNI…");
  const [lectorUsbAutorizado, setLectorUsbAutorizado] = useState(false);
  const [webUsbDisponible, setWebUsbDisponible] = useState(false);

  const onLeerRef = useRef(onLeer);
  onLeerRef.current = onLeer;

  const montado = useRef(true);
  const presenciaAnterior = useRef(false);
  const ultimaLectura = useRef<{ dni: string; at: number } | null>(null);
  const leyendo = useRef(false);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const emitir = useCallback((dni: string, origen: LecturaDniFisico["origen"]) => {
    if (!DNI_VALIDO.test(dni)) return;
    const ahora = Date.now();
    if (
      ultimaLectura.current &&
      ultimaLectura.current.dni === dni &&
      ahora - ultimaLectura.current.at < 6000
    ) {
      return;
    }
    ultimaLectura.current = { dni, at: ahora };
    onLeerRef.current?.({ dni, origen });
  }, []);

  const leerTarjeta = useCallback(async () => {
    if (leyendo.current) return;
    leyendo.current = true;
    try {
      const cuerpo = await pedirJson(`${AGENTE_URL}/leer`, { method: "POST" });
      const dni = extraerDni(JSON.stringify(cuerpo ?? ""));
      if (dni) emitir(dni, "agente");
    } catch {
      // El sondeo de estado informará la indisponibilidad del agente.
    } finally {
      leyendo.current = false;
    }
  }, [emitir]);

  const verificarAgente = useCallback(async (): Promise<boolean> => {
    try {
      const cuerpo = await pedirJson(`${AGENTE_URL}/estado`);
      const datos = (
        typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}
      ) as Record<string, unknown>;
      const presente =
        leerBooleano(datos, ["tarjetaPresente", "cardPresent", "tarjeta", "presente"]) ?? false;
      const disponible =
        leerBooleano(datos, ["disponible", "ok", "activo", "connected"]) ?? true;

      if (!montado.current) return disponible;
      setEstado(disponible ? "disponible" : "error");
      setTarjetaPresente(presente);
      setMensaje(
        leerTexto(datos, ["mensaje", "message", "lector", "device"]) ||
          (presente
            ? "DNI detectado. Leyendo datos del chip…"
            : "Acerca el DNI electrónico al lector físico."),
      );

      if (presente && !presenciaAnterior.current) {
        void leerTarjeta();
      }
      presenciaAnterior.current = presente;
      return disponible;
    } catch {
      if (!montado.current) return false;
      setEstado("sin-agente");
      setTarjetaPresente(false);
      presenciaAnterior.current = false;
      setMensaje("Agente local no detectado. Puedes usar cámara, archivo o DNI manual.");
      return false;
    }
  }, [leerTarjeta]);

  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    let temporizador: number | null = null;

    const ciclo = async () => {
      const disponible = await verificarAgente();
      if (!cancelado) {
        const espera = disponible ? intervaloMs : Math.max(intervaloMs, 5000);
        temporizador = window.setTimeout(() => void ciclo(), espera);
      }
    };

    void ciclo();
    return () => {
      cancelado = true;
      if (temporizador) window.clearTimeout(temporizador);
    };
  }, [activo, intervaloMs, verificarAgente]);

  useEffect(() => {
    const usb = obtenerWebUsb();
    setWebUsbDisponible(Boolean(usb?.getDevices));
    if (!usb?.getDevices) return;

    let cancelado = false;
    const detectar = async () => {
      try {
        const dispositivos = (await usb.getDevices?.()) ?? [];
        if (!cancelado) {
          setLectorUsbAutorizado(dispositivos.some(esLectorUsb));
        }
      } catch {
        if (!cancelado) setLectorUsbAutorizado(false);
      }
    };

    void detectar();
    const alCambiar = () => void detectar();
    usb.addEventListener?.("connect", alCambiar);
    usb.addEventListener?.("disconnect", alCambiar);

    return () => {
      cancelado = true;
      usb.removeEventListener?.("connect", alCambiar);
      usb.removeEventListener?.("disconnect", alCambiar);
    };
  }, []);

  const solicitarPermisoWebUsb = useCallback(async (): Promise<boolean> => {
    const usb = obtenerWebUsb();
    if (!usb?.requestDevice) return false;
    try {
      const dispositivo = await usb.requestDevice({ filters: [{ classCode: 0x0b }] });
      const autorizado = esLectorUsb(dispositivo);
      setLectorUsbAutorizado(autorizado);
      if (autorizado) {
        setMensaje(
          "Lector USB autorizado. El agente local leerá el chip del DNIe cuando acerques la tarjeta.",
        );
      }
      return autorizado;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!activo) return;

    let buffer = "";
    let temporizador: number | null = null;

    const limpiar = () => {
      if (temporizador) window.clearTimeout(temporizador);
      temporizador = null;
    };

    const evaluar = () => {
      const dni = extraerDni(buffer);
      buffer = "";
      if (dni) emitir(dni, "teclado");
    };

    const reiniciar = () => {
      limpiar();
      temporizador = window.setTimeout(evaluar, 110);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const objetivo = event.target as HTMLElement | null;
      const etiqueta = objetivo?.tagName?.toLowerCase();
      if (
        etiqueta === "input" ||
        etiqueta === "textarea" ||
        etiqueta === "select" ||
        objetivo?.isContentEditable
      ) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        buffer = `${buffer}${event.key}`.slice(-12);
        reiniciar();
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        limpiar();
        evaluar();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      limpiar();
    };
  }, [activo, emitir]);

  return {
    estado,
    tarjetaPresente,
    mensaje,
    agenteUrl: AGENTE_URL,
    webUsbDisponible,
    lectorUsbAutorizado,
    verificarAgente,
    leerTarjeta,
    solicitarPermisoWebUsb,
  };
}
