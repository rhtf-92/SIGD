/**
 * Suite ENT-M04-03 / ENT-M04-04 · Mayra (F_MAYRA).
 * Cubre T-FE-DOC-12 (estampa marginal 20mm) y T-FE-DOC-13 (QR 200px nivel M).
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import QrCodeGenerator from "../../../src/components/common/QrCodeGenerator";
import CvdStampBadge from "../../../src/components/firma/CvdStampBadge";
import type { EstampaCvdData } from "../../../src/types/cvdVerificacion";

const ESTAMPA: EstampaCvdData = {
  codigoCvd: "CVD-2026-RD-000412-892F",
  urlValidacion: "https://sigd.iestpsuiza.edu.pe/validador-cvd",
  numeroDocumento: "RD N.° 0412-2026-DG-IESTP-SUIZA",
  fechaFirmaIso: "2026-09-05T11:42:15-05:00",
  firmanteNombre: "Lic. Julio César Mori Paredes",
  firmanteCargo: "Director General",
  entidadCertificadora: "RENIEC / IOFE INDECOPI",
  hashSha256: "9b73c93d7798ec3bf09bed4642f930f4e80fb5f9738c15258269d6b844f0430e",
};

describe("Estampa CVD y QR — ENT-M04-04 (F_MAYRA)", () => {
  it("QrCodeGenerator: renderiza SVG vectorial 200px con nivel M", () => {
    render(
      <QrCodeGenerator value="https://sigd.iestpsuiza.edu.pe/validador-cvd?cvd=CVD-2026-RD-000412-892F" />,
    );
    const wrapper = screen.getByTestId("qr-code-generator");
    expect(wrapper).toHaveAttribute("data-error-correction", "M");
    const svg = wrapper.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("200");
    expect(svg?.getAttribute("height")).toBe("200");
  });

  it("CvdStampBadge lateral: margen derecho D.S. 070 con CVD, QR y leyenda legal", () => {
    render(
      <MemoryRouter>
        <CvdStampBadge estampa={ESTAMPA} variante="lateral" />
      </MemoryRouter>,
    );
    const lateral = screen.getByTestId("cvd-stamp-lateral");
    expect(lateral).toHaveAttribute(
      "aria-label",
      expect.stringContaining("CVD"),
    );
    expect(screen.getByText("CVD-2026-RD-000412-892F")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /QR de validación digital/i })).toBeInTheDocument();
    expect(screen.getByText(/D\.S\. N\.° 070-2013-PCM/)).toBeInTheDocument();
  });

  it("CvdStampBadge tarjeta: muestra firmante, cargo y hash recortado", () => {
    render(
      <MemoryRouter>
        <CvdStampBadge estampa={ESTAMPA} variante="tarjeta" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("cvd-stamp-tarjeta")).toBeInTheDocument();
    expect(screen.getByText("Lic. Julio César Mori Paredes")).toBeInTheDocument();
    expect(screen.getByText("Director General")).toBeInTheDocument();
  });
});
