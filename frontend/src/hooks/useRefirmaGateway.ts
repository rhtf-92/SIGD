import { useCallback, useEffect, useRef, useState } from "react";

import type {
  DocumentoOficial,
  EstadoGatewayRefirma,
  PasoProcesoFirma,
  RefirmaParamDTO,
  RefirmaRespuestaDTO,
} from "../types/firmaDigital";

const PASOS_SECUENCIA: readonly PasoProcesoFirma[] = [
  "CONECTANDO_AGENTE",
  "ESPERANDO_PIN",
  "SOLICITANDO_TSA",
  "SELLANDO_CVD",
];

const PASO_MS = 2400;
export const TIMEOUT_AGENTE_MS = 5 * 60 * 1000; // 5 minutos (barra de espera del modal)
const IFRAME_LIMPIEZA_MS = 2000;

function generarTokenSesion(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function construirUriRefirma(parametros: RefirmaParamDTO): string {
  const consulta = new URLSearchParams({
    token: parametros.tokenSesion,
    hash: parametros.hashSha256,
    callback: parametros.urlCallback,
    documento: String(parametros.idDocumento),
  });
  return `refirma://sign?${consulta.toString()}`;
}

export function generarCvdDocumento(documento: DocumentoOficial): string {
  const serie = String(documento.idDocumento).padStart(6, "0");
  const checksum = documento.hashSha256.slice(0, 4).toUpperCase();
  return `CVD-${documento.anio}-${documento.tipoActo}-${serie}-${checksum}`;
}

/**
 * T-FE-DOC-10: invoca el esquema `refirma://` con un iframe oculto de corta
 * duración para no recargar la SPA ni perder la sesión del director.
 * Las redirecciones ordinarias (`window.location.href = ...`) disparaban
 * alertas de seguridad intrusivas y desmontaban el estado React.
 */
export function dispararProtocoloViaIframe(uri: string): void {
  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("tabindex", "-1");
    iframe.style.display = "none";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.src = uri;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      iframe.remove();
    }, IFRAME_LIMPIEZA_MS);
  } catch {
    // El navegador carece de un manejador registrado para refirma://.
  }
}

export interface UseRefirmaGatewayResultado {
  estado: EstadoGatewayRefirma;
  pasoActual: PasoProcesoFirma | null;
  documento: DocumentoOficial | null;
  resultado: RefirmaRespuestaDTO | null;
  mensajeError: string | null;
  segundosRestantes: number | null;
  timeoutMs: number;
  iniciarFirma: (documento: DocumentoOficial, firmanteDni: string) => void;
  reintentar: () => void;
  cancelar: () => void;
}

export function useRefirmaGateway(
  onCompletado?: (resultado: RefirmaRespuestaDTO) => void,
): UseRefirmaGatewayResultado {
  const [estado, setEstado] = useState<EstadoGatewayRefirma>("INACTIVO");
  const [pasoActual, setPasoActual] = useState<PasoProcesoFirma | null>(null);
  const [documento, setDocumento] = useState<DocumentoOficial | null>(null);
  const [resultado, setResultado] = useState<RefirmaRespuestaDTO | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);

  const documentoRef = useRef<DocumentoOficial | null>(null);
  const dniRef = useRef<string>("");
  const secuenciaActivaRef = useRef(false);
  const pasoRef = useRef<number | null>(null);
  const temporizadorLargoRef = useRef<number | null>(null);
  const cuentaRegresivaRef = useRef<number | null>(null);
  const onCompletadoRef = useRef(onCompletado);

  useEffect(() => {
    onCompletadoRef.current = onCompletado;
  }, [onCompletado]);

  const limpiarTemporizadores = useCallback(() => {
    if (pasoRef.current !== null) {
      window.clearTimeout(pasoRef.current);
      pasoRef.current = null;
    }
    if (temporizadorLargoRef.current !== null) {
      window.clearTimeout(temporizadorLargoRef.current);
      temporizadorLargoRef.current = null;
    }
    if (cuentaRegresivaRef.current !== null) {
      window.clearInterval(cuentaRegresivaRef.current);
      cuentaRegresivaRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      secuenciaActivaRef.current = false;
      limpiarTemporizadores();
    };
  }, [limpiarTemporizadores]);

  const avanzarPaso = useCallback(
    (indicePaso: number) => {
      if (!secuenciaActivaRef.current) return;

      if (indicePaso >= PASOS_SECUENCIA.length) {
        secuenciaActivaRef.current = false;
        limpiarTemporizadores();
        setSegundosRestantes(null);
        const doc = documentoRef.current;
        if (!doc) return;
        const respuesta: RefirmaRespuestaDTO = {
          cvd: generarCvdDocumento(doc),
          urlFirmado: doc.urlPdfOriginal,
          timestamp: new Date().toISOString(),
        };
        setResultado(respuesta);
        setPasoActual(null);
        setEstado("COMPLETADO");
        onCompletadoRef.current?.(respuesta);
        return;
      }

      const paso = PASOS_SECUENCIA[indicePaso];
      setPasoActual(paso);
      if (paso === "ESPERANDO_PIN") setEstado("ESPERANDO_PIN");
      if (paso === "SOLICITANDO_TSA") setEstado("SOLICITANDO_TSA");
      if (paso === "SELLANDO_CVD") setEstado("SELLANDO_CVD");

      pasoRef.current = window.setTimeout(() => {
        pasoRef.current = null;
        avanzarPaso(indicePaso + 1);
      }, PASO_MS);
    },
    [limpiarTemporizadores],
  );

  const iniciarFirma = useCallback(
    (doc: DocumentoOficial, firmanteDni: string) => {
      limpiarTemporizadores();
      secuenciaActivaRef.current = true;
      documentoRef.current = doc;
      dniRef.current = firmanteDni;

      setDocumento(doc);
      setResultado(null);
      setMensajeError(null);
      setEstado("PREPARANDO");

      const parametros: RefirmaParamDTO = {
        idDocumento: doc.idDocumento,
        firmanteDni,
        tokenSesion: generarTokenSesion(),
        hashSha256: doc.hashSha256,
        urlCallback: `${window.location.origin}/firma/callback`,
        proveedor: "REFIRMA_RENIEC",
      };

      try {
        dispararProtocoloViaIframe(construirUriRefirma(parametros));
      } catch {
        // El navegador carece de un manejador registrado para refirma://.
      }

      setEstado("CONECTANDO");
      setPasoActual("CONECTANDO_AGENTE");
      setSegundosRestantes(Math.floor(TIMEOUT_AGENTE_MS / 1000));

      pasoRef.current = window.setTimeout(() => {
        pasoRef.current = null;
        avanzarPaso(1);
      }, PASO_MS);

      temporizadorLargoRef.current = window.setTimeout(() => {
        if (secuenciaActivaRef.current) {
          secuenciaActivaRef.current = false;
          limpiarTemporizadores();
          setPasoActual(null);
          setSegundosRestantes(null);
          setMensajeError(
            "No se detectó el agente local Refirma / RENIEC. Verifique que el componente de firma esté instalado y que el DNIe o token esté conectado.",
          );
          setEstado("TIMEOUT");
        }
      }, TIMEOUT_AGENTE_MS);

      cuentaRegresivaRef.current = window.setInterval(() => {
        setSegundosRestantes((prev) =>
          prev !== null && prev > 0 ? prev - 1 : prev,
        );
      }, 1000);
    },
    [avanzarPaso, limpiarTemporizadores],
  );

  const reintentar = useCallback(() => {
    const doc = documentoRef.current;
    if (!doc) return;
    iniciarFirma(doc, dniRef.current);
  }, [iniciarFirma]);

  const cancelar = useCallback(() => {
    secuenciaActivaRef.current = false;
    limpiarTemporizadores();
    setEstado("INACTIVO");
    setPasoActual(null);
    setDocumento(null);
    setResultado(null);
    setMensajeError(null);
    setSegundosRestantes(null);
  }, [limpiarTemporizadores]);

  return {
    estado,
    pasoActual,
    documento,
    resultado,
    mensajeError,
    segundosRestantes,
    timeoutMs: TIMEOUT_AGENTE_MS,
    iniciarFirma,
    reintentar,
    cancelar,
  };
}