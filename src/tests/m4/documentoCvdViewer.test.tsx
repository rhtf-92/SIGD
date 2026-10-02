import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import DocumentoCvdViewer from "../../components/firma/DocumentoCvdViewer";
import CvdStampBadge from "../../components/firma/CvdStampBadge";
import type { EstampaCvdData } from "../../types/cvdVerificacion";

const estampaPrueba: EstampaCvdData = {
  codigoCvd: "CVD-2026-RD-000412-892F",
  urlValidacion: "https://sigd.iestpsuiza.edu.pe/validador-cvd",
  numeroDocumento: "RD N.° 0412-2026-DG-IESTP-SUIZA",
  fechaFirmaIso: "2026-09-05T11:42:15-05:00",
  firmanteNombre: "Lic. Julio César Mori Paredes",
  firmanteCargo: "Director General",
  entidadCertificadora: "RENIEC / IOFE INDECOPI",
  hashSha256: "9b73c93d7798ec3bf09bed4642f930f4e80fb5f9738c15258269d6b844f0430e",
};

describe("Suite de Pruebas de Visor de Representación Impresa con Estampa Lateral CVD y QR (ENT-M04-04)", () => {
  it("CvdStampBadge: renderiza el código CVD, leyenda legal oficial D.S. 070-2013-PCM y código QR", () => {
    render(
      <MemoryRouter>
        <CvdStampBadge estampa={estampaPrueba} variante="lateral" />
      </MemoryRouter>,
    );

    expect(screen.getByText("CVD-2026-RD-000412-892F")).toBeInTheDocument();
    expect(screen.getByText(/Lic. Julio César Mori Paredes/i)).toBeInTheDocument();
    expect(screen.getByText(/RENIEC \/ IOFE INDECOPI/i)).toBeInTheDocument();
    expect(screen.getByText(/representación impresa cuya autenticidad e integridad/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /QR de validación digital/i })).toBeInTheDocument();
  });

  it("DocumentoCvdViewer: renderiza la hoja de documento con la estampa marginal integrada y enlace al validador", () => {
    render(
      <MemoryRouter>
        <DocumentoCvdViewer estampa={estampaPrueba} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /Resolución Directoral N.° 0412-2026-DG-IESTP-SUIZA/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Verificar en Portal Público CVD →/i)).toBeInTheDocument();
    expect(screen.getByText(/🖨️ Imprimir Representación/i)).toBeInTheDocument();
    expect(screen.getByText(/Instituto de Educación Superior Tecnológico Público "Suiza"/i)).toBeInTheDocument();
  });
});
