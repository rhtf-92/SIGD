/**
 * ENT-M04-03 · Mayra (F_MAYRA) / T-FE-DOC-10 y T-FE-DOC-11.
 * Pasarela Refirma RENIEC: handshake protocolar refirma:// sin recargar la SPA.
 */
import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TIMEOUT_AGENTE_MS,
  construirUriRefirma,
  dispararProtocoloViaIframe,
  generarCvdDocumento,
  useRefirmaGateway,
} from "@/hooks/useRefirmaGateway";
import type { DocumentoOficial } from "@/types/firmaDigital";

const DOCUMENTO: DocumentoOficial = {
  idDocumento: 412,
  idTramite: 155,
  tipoActo: "RD",
  numeroCorrelativo: "RD N.° 0412-2026-DG-IESTP-SUIZA",
  anio: 2026,
  asunto: "Confiere título profesional técnico.",
  urlPdfOriginal: "/pdfs/rd-0412-2026.pdf",
  hashSha256: "9b73c93d7798ec3bf09bed4642f930f4e80fb5f9738c15258269d6b844f0430e",
  estadoFirma: "PENDIENTE",
  fechaGeneracion: "2026-09-05T11:42:15-05:00",
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("Pasarela Refirma RENIEC — ENT-M04-03 (F_MAYRA)", () => {
  it("1. construye la URI refirma://sign con token, hash, callback y documento", () => {
    const uri = construirUriRefirma({
      idDocumento: 412,
      firmanteDni: "40601034",
      tokenSesion: "abc123",
      hashSha256: "deadbeef",
      urlCallback: "http://localhost:5173/firma/callback",
      proveedor: "REFIRMA_RENIEC",
    });
    expect(uri.startsWith("refirma://sign?")).toBe(true);
    const params = new URLSearchParams(uri.replace("refirma://sign?", ""));
    expect(params.get("token")).toBe("abc123");
    expect(params.get("hash")).toBe("deadbeef");
    expect(params.get("documento")).toBe("412");
    expect(params.get("callback")).toContain("/firma/callback");
  });

  it("2. genera el CVD con formato CVD-YYYY-TIPO-XXXXXX-HEX4", () => {
    expect(generarCvdDocumento(DOCUMENTO)).toBe("CVD-2026-RD-000412-9B73");
  });

  it("3. dispara el protocolo con iframe oculto sin navegar la SPA", () => {
    const hrefOriginal = window.location.href;
    dispararProtocoloViaIframe("refirma://sign?token=abc&hash=dead&callback=x&documento=412");
    // El iframe existe de forma efímera y oculto.
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect((iframe as HTMLIFrameElement).style.display).toBe("none");
    // La SPA no pierde la sesión: la URL no cambia.
    expect(window.location.href).toBe(hrefOriginal);
    // Limpieza automática del iframe de corta duración.
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("4. iniciarFirma entra en CONECTANDO con cuenta regresiva de 5 minutos", () => {
    const { result } = renderHook(() => useRefirmaGateway());
    expect(result.current.estado).toBe("INACTIVO");

    act(() => {
      result.current.iniciarFirma(DOCUMENTO, "40601034");
    });

    expect(result.current.estado).toBe("CONECTANDO");
    expect(result.current.pasoActual).toBe("CONECTANDO_AGENTE");
    expect(result.current.documento?.idDocumento).toBe(412);
    expect(result.current.segundosRestantes).toBe(
      Math.floor(TIMEOUT_AGENTE_MS / 1000),
    );
    expect(TIMEOUT_AGENTE_MS).toBe(5 * 60 * 1000);
  });

  it("5. cancelar limpia timers y vuelve a INACTIVO", () => {
    const { result } = renderHook(() => useRefirmaGateway());
    act(() => {
      result.current.iniciarFirma(DOCUMENTO, "40601034");
    });
    expect(result.current.estado).toBe("CONECTANDO");

    act(() => {
      result.current.cancelar();
    });

    expect(result.current.estado).toBe("INACTIVO");
    expect(result.current.pasoActual).toBeNull();
    expect(result.current.documento).toBeNull();
    expect(result.current.segundosRestantes).toBeNull();
  });

  it("6. completa la secuencia PAdES-BES y emite el CVD con callback", () => {
    const onCompletado = vi.fn();
    const { result } = renderHook(() => useRefirmaGateway(onCompletado));

    act(() => {
      result.current.iniciarFirma(DOCUMENTO, "40601034");
    });

    act(() => {
      vi.advanceTimersByTime(4 * 2400 + 1000);
    });

    expect(result.current.estado).toBe("COMPLETADO");
    expect(result.current.resultado?.cvd).toBe("CVD-2026-RD-000412-9B73");
    expect(onCompletado).toHaveBeenCalledTimes(1);
    expect(onCompletado.mock.calls[0][0].cvd).toContain("CVD-2026");
  });

  it("7. reintentar relanza la firma tras cancelar (reusa documento en memoria)", () => {
    const { result } = renderHook(() => useRefirmaGateway());
    act(() => {
      result.current.iniciarFirma(DOCUMENTO, "40601034");
    });
    act(() => {
      result.current.cancelar();
    });
    expect(result.current.estado).toBe("INACTIVO");
    act(() => {
      result.current.reintentar();
    });
    // documentoRef se conserva para reintento: vuelve a CONECTANDO.
    expect(result.current.estado).toBe("CONECTANDO");
    expect(result.current.documento?.idDocumento).toBe(412);
  });
});
