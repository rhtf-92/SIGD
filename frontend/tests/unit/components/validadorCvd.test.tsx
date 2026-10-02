/**
 * Suite ENT-M04-05 · F_ADRIANO (Adriano David Espinoza Ramírez) / T-FE-DOC-05.
 * 8 casos: códigos CVD válidos vs. apócrifos, máscara guiada, cronómetro de
 * días hábiles, bloqueo FSM sin actas y dictamen CvdIntegrityReport
 * (titular RENIEC + sellado TSA + alerta roja de adulteración).
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CvdIntegrityReport from "../../components/cvd/CvdIntegrityReport";
import { requisitosPendientesDe } from "../../hooks/useWorkflowAcademico";
import type { ValidacionCVDResult } from "../../types/validadorCvd";
import type { WorkflowAcademico } from "../../types/workflowAcademico";
import {
  aplicarMascaraCvd,
  extraerCvdDeTexto,
  validarCvd,
} from "../../utils/cvdValidator";
import { diasHabilesEntre } from "../../utils/diasHabiles";

const RESULTADO_VALIDO: ValidacionCVDResult = {
  esValido: true,
  cvd: "CVD-2026-RD-000412-892F",
  documento: {
    numeroDocumento: "RD N.° 0412-2026-DG-IESTP-SUIZA",
    tipo: "RD",
    asunto: "Confiere Título Profesional Técnico en DSI.",
    fechaEmision: "2026-09-05T11:42:15-05:00",
    firmantes: [
      {
        nombre: "Lic. Julio César Mori Paredes",
        cargo: "Director General",
        fechaFirma: "2026-09-05T11:42:15-05:00",
        entidadCertificadora: "RENIEC / IOFE INDECOPI",
      },
    ],
    hashIntegridadSha256: "c1f2".repeat(16),
    urlDescargaAutentica: "https://tramite.institutosuiza.edu.pe/rd-0412-2026.pdf",
  },
  selloTiempoTsa: "2026-09-05T11:42:16-05:00",
  mensajeSeguridad: "Documento oficial válido.",
};

const RESULTADO_ADULTERADO: ValidacionCVDResult = {
  esValido: false,
  cvd: "CVD-2026-RD-000413-ALTE",
  documento: null,
  selloTiempoTsa: null,
  mensajeSeguridad: "Contenido alterado tras la emisión.",
};

describe("Validador público CVD — ENT-M04-05 (F_ADRIANO)", () => {
  it("1. acepta un CVD válido con formato CVD-YYYY-RD-XXXXXX-XXXX", () => {
    const r = validarCvd("CVD-2026-RD-000412-892F");
    expect(r.valido).toBe(true);
    expect(r.normalizado).toBe("CVD-2026-RD-000412-892F");
  });

  it("2. rechaza un código apócrifo sin formato con mensaje de máscara guiada", () => {
    const r = validarCvd("FAKE-123");
    expect(r.valido).toBe(false);
    expect(r.motivo).toMatch(/CVD-YYYY-RD-XXXXXX-XXXX/);
  });

  it("3. rechaza un CVD con año fuera de rango institucional (posible apócrifo)", () => {
    const r = validarCvd("CVD-1990-RD-000001-AAAA");
    expect(r.valido).toBe(false);
    expect(r.motivo).toMatch(/fuera de rango/);
  });

  it("4. la máscara guía el tipeo y el extractor rescata el CVD de un texto QR", () => {
    expect(aplicarMascaraCvd("cvd2026rd000412892f")).toContain("CVD-2026");
    expect(
      extraerCvdDeTexto("https://validador.suiza.edu.pe/CVD-2026-RD-000412-892F"),
    ).toBe("CVD-2026-RD-000412-892F");
    expect(extraerCvdDeTexto("sin código aquí")).toBeNull();
  });

  it("5. el cronómetro cuenta solo días hábiles (excluye sábado y domingo)", () => {
    // Lun 2026-09-07 → Lun 2026-09-14: 5 hábiles (lun–vie), fin de semana excluido
    expect(diasHabilesEntre("2026-09-07T08:00:00-05:00", "2026-09-14T08:00:00-05:00")).toBe(5);
    expect(diasHabilesEntre(undefined)).toBe(0);
  });

  it("6. detecta requisitos pendientes de jurado (bloqueo FSM previo a etapa resolutiva)", () => {
    const tramite = {
      etapaActualId: 3,
      etapas: [
        {
          idEtapa: 3,
          requisitos: [
            { idRequisito: 301, descripcion: "Resolución de designación de jurado", cumplido: true },
            { idRequisito: 302, descripcion: "Acta de examen profesional firmada", cumplido: false },
          ],
        },
      ],
    } as unknown as WorkflowAcademico;
    expect(requisitosPendientesDe(tramite, 3)).toEqual(["Acta de examen profesional firmada"]);
  });

  it("7. el dictamen válido exhibe titular RENIEC y fecha/hora del sellado TSA", () => {
    render(<CvdIntegrityReport resultado={RESULTADO_VALIDO} />);
    expect(screen.getByText("Lic. Julio César Mori Paredes")).toBeInTheDocument();
    expect(screen.getByText(/RENIEC \/ IOFE INDECOPI/)).toBeInTheDocument();
    expect(screen.getByText(/Sellado de tiempo TSA/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Descargar dictamen cotejado/i })).toBeInTheDocument();
  });

  it("8. el dictamen apócrifo despliega alerta roja de no reconocido o adulterado", () => {
    render(<CvdIntegrityReport resultado={RESULTADO_ADULTERADO} />);
    const alerta = screen.getByRole("alert");
    expect(alerta).toBeInTheDocument();
    expect(alerta.textContent).toMatch(/adulterado/i);
    expect(screen.getByText(/Documento no reconocido o adulterado/i)).toBeInTheDocument();
  });
});
