import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import type { DocumentoOficial, EstadoGatewayRefirma, PasoProcesoFirma, RefirmaRespuestaDTO, EstadoFirmaPersistidaDTO } from "../types/firmaDigital";

export const TIMEOUT_AGENTE_MS = 5 * 60 * 1000;
const IFRAME_LIMPIEZA_MS = 2000;

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
  consultarEstado: (documento: DocumentoOficial) => void;
  reintentar: () => void;
  cancelar: () => void;
}

export const INTERVALO_ESTADO_FIRMA_MS = 2000;

export function useRefirmaGateway(
  onCompletado?: (resultado: RefirmaRespuestaDTO) => void,
): UseRefirmaGatewayResultado {
  const [estado, setEstado] = useState<EstadoGatewayRefirma>("INACTIVO");
  const [documento, setDocumento] = useState<DocumentoOficial | null>(null);
  const [resultado, setResultado] = useState<RefirmaRespuestaDTO | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);
  const documentoRef = useRef<DocumentoOficial | null>(null);
  const ejecucion = useRef(0);
  const ocupado = useRef(false);
  const abortar = useRef<AbortController | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sondeo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalo = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompletadoRef = useRef(onCompletado);
  useEffect(() => { onCompletadoRef.current = onCompletado; }, [onCompletado]);
  const limpiar = useCallback(() => {
    if (timeout.current !== null) clearTimeout(timeout.current);
    if (sondeo.current !== null) clearTimeout(sondeo.current);
    if (intervalo.current !== null) clearInterval(intervalo.current);
    timeout.current = sondeo.current = intervalo.current = null;
    abortar.current?.abort();
    abortar.current = null;
  }, []);
  useEffect(() => () => { ejecucion.current++; ocupado.current = false; limpiar(); }, [limpiar]);

  const ejecutar = useCallback((doc: DocumentoOficial, solicitar: boolean, firmanteDni = "") => {
    if (ocupado.current) return;
    const usuario = useAuthStore.getState().usuario;
    if (!usuario) {
      setMensajeError("Debe autenticarse antes de consultar o solicitar la firma.");
      setEstado("ERROR");
      return;
    }
    ocupado.current = true;
    const actual = ++ejecucion.current;
    documentoRef.current = doc;
    limpiar();
    const controller = new AbortController();
    abortar.current = controller;
    setDocumento(doc);
    setResultado(null);
    setMensajeError(null);
    setEstado("PREPARANDO");
    setSegundosRestantes(null);
    const vigente = () => actual === ejecucion.current && !controller.signal.aborted;
    const fallar = (error: unknown) => {
      if (!vigente()) return;
      ocupado.current = false;
      limpiar();
      setSegundosRestantes(null);
      setMensajeError(error instanceof Error ? error.message : "No se pudo consultar el resultado de firma.");
      setEstado("ERROR");
    };
    const consultar = async (): Promise<boolean> => {
      const { data } = await apiClient.get<EstadoFirmaPersistidaDTO>(
        `/api/v1/firma/documento/${encodeURIComponent(String(doc.idDocumento))}/estado`,
        { signal: controller.signal },
      );
      if (!vigente()) return true;
      if (data.documentoId !== String(doc.idDocumento)) throw new Error("El resultado no corresponde al documento solicitado.");
      if (data.estado === null && data.resultado === null && data.integridadVerificada === false) return false;
      const evidencia = data.resultado;
      const fecha = evidencia?.timestamp ? Date.parse(evidencia.timestamp) : NaN;
      let urlValida = false;
      try {
        const url = new URL(evidencia?.urlFirmado ?? "");
        urlValida = url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
      } catch { /* No se acepta una URL vacia o un protocolo ejecutable. */ }
      if (data.estado !== "FIRMADO_DIGITALMENTE" || data.integridadVerificada !== true ||
          !evidencia || !/^CVD-[A-Z0-9-]{6,36}$/.test(evidencia.cvd) || !Number.isFinite(fecha) || !urlValida) {
        throw new Error("El backend no confirmó evidencia de firma completa y cotejada.");
      }
      ocupado.current = false;
      limpiar();
      setResultado(evidencia);
      setEstado("COMPLETADO");
      setSegundosRestantes(null);
      onCompletadoRef.current?.(evidencia);
      return true;
    };
    const vigilar = async () => {
      try {
        if (await consultar() || !vigente()) return;
        // Se programa solo al terminar el GET anterior: sin consultas solapadas.
        sondeo.current = setTimeout(() => { void vigilar(); }, INTERVALO_ESTADO_FIRMA_MS);
      } catch (error) { fallar(error); }
    };
    void (async () => {
      try {
        // Antes de una nueva invocacion se recupera cualquier evidencia ya persistida.
        if (await consultar() || !vigente()) return;
        if (!solicitar) {
          ocupado.current = false;
          limpiar();
          setEstado("INACTIVO");
          return;
        }
        const { data } = await apiClient.post<{ uriProtocolar: string; expiraEn: string }>(
          "/api/v1/firma/invocar-refirma", {
            documentoId: String(doc.idDocumento),
            firmante: { id: usuario.id, nombre: usuario.nombreCompleto, documento: firmanteDni },
          }, { signal: controller.signal },
        );
        if (!vigente()) return;
        const fin = Date.parse(data.expiraEn);
        if (!/^refirma:\/\/sign\?arguments=\[[A-Za-z0-9_-]+\]$/.test(data.uriProtocolar) ||
            !Number.isFinite(fin) || fin <= Date.now() || fin > Date.now() + TIMEOUT_AGENTE_MS + 5000) {
          throw new Error("El backend no devolvió una invocación y vigencia válidas.");
        }
        setEstado("CONECTANDO");
        setSegundosRestantes(Math.ceil((fin - Date.now()) / 1000));
        // El reloj solo limita la espera. Nunca acredita una firma completada.
        timeout.current = setTimeout(() => {
          if (!vigente()) return;
          ejecucion.current++;
          ocupado.current = false;
          limpiar();
          setSegundosRestantes(null);
          setMensajeError("Venció la espera sin confirmación persistida. Consulte el estado antes de solicitar otra firma.");
          setEstado("TIMEOUT");
        }, fin - Date.now());
        intervalo.current = setInterval(() => setSegundosRestantes(Math.max(0, Math.ceil((fin - Date.now()) / 1000))), 1000);
        dispararProtocoloViaIframe(data.uriProtocolar);
        void vigilar();
      } catch (error) { fallar(error); }
    })();
  }, [limpiar]);
  const iniciarFirma = useCallback((doc: DocumentoOficial, dni: string) => {
    if (doc.estadoFirma === "FIRMADO") return;
    ejecutar(doc, true, dni);
  }, [ejecutar]);
  const consultarEstado = useCallback((doc: DocumentoOficial) => ejecutar(doc, false), [ejecutar]);
  const cancelar = useCallback(() => {
    ejecucion.current++;
    ocupado.current = false;
    limpiar();
    setEstado("INACTIVO");
    setDocumento(null);
    setResultado(null);
    setMensajeError(null);
    setSegundosRestantes(null);
  }, [limpiar]);
  // Tras error o vencimiento, reintentar significa leer, nunca repetir el POST.
  const reintentar = useCallback(() => {
    if (documentoRef.current) consultarEstado(documentoRef.current);
  }, [consultarEstado]);
  return { estado, pasoActual: estado === "CONECTANDO" ? "CONECTANDO_AGENTE" : null,
    documento, resultado, mensajeError, segundosRestantes, timeoutMs: TIMEOUT_AGENTE_MS,
    iniciarFirma, consultarEstado, reintentar, cancelar };
}
