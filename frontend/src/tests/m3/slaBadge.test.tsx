import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SlaBadge from "../../components/expedientes/SlaBadge";
import { addBusinessDays } from "../../utils/slaCalculator";

describe("Suite de Pruebas de Componente SlaBadge (ENT-M03-02)", () => {
  it("renderiza correctamente el estado NORMAL (Verde / Al día)", () => {
    const inicio = new Date(2026, 5, 1);
    const hoy = addBusinessDays(inicio, 5); // 25 días restantes

    render(
      <SlaBadge
        fechaIngreso={inicio}
        fechaReferencia={hoy}
        plazoMaximoDiasHabiles={30}
      />,
    );

    const badge = screen.getByLabelText(/25d hábiles \[Al día\]/i);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-emerald-800");
    expect(badge.className).toContain("border-emerald-300");
  });

  it("renderiza correctamente el estado ALERTA (Ámbar / Atención)", () => {
    const inicio = new Date(2026, 5, 1);
    const hoy = addBusinessDays(inicio, 20); // 10 días restantes

    render(
      <SlaBadge
        fechaIngreso={inicio}
        fechaReferencia={hoy}
        plazoMaximoDiasHabiles={30}
      />,
    );

    const badge = screen.getByLabelText(/10d hábiles \[Atención\]/i);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-amber-900");
    expect(badge.className).toContain("border-amber-300");
  });

  it("renderiza correctamente el estado CRITICO (Rojo / Vencimiento inminente)", () => {
    const inicio = new Date(2026, 5, 1);
    const hoy = addBusinessDays(inicio, 28); // 2 días restantes

    render(
      <SlaBadge
        fechaIngreso={inicio}
        fechaReferencia={hoy}
        plazoMaximoDiasHabiles={30}
      />,
    );

    const badge = screen.getByLabelText(/2d hábiles \[Crítico\]/i);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-rose-800");
    expect(badge.className).toContain("border-rose-300");
  });

  it("renderiza correctamente el estado VENCIDO con animación pulse de advertencia legal", () => {
    const inicio = new Date(2026, 5, 1);
    const hoy = addBusinessDays(inicio, 34); // 4 días de mora

    render(
      <SlaBadge
        fechaIngreso={inicio}
        fechaReferencia={hoy}
        plazoMaximoDiasHabiles={30}
      />,
    );

    const badge = screen.getByLabelText(/Vencido \(4d hábiles\)/i);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("animate-pulse");
    expect(badge.className).toContain("text-red-900");
    expect(badge.className).toContain("border-red-500");
  });

  it("despliega la estructura accesible del tooltip con el desglose de días", () => {
    const inicio = new Date(2026, 5, 1);
    const hoy = addBusinessDays(inicio, 10);

    render(
      <SlaBadge
        fechaIngreso={inicio}
        fechaReferencia={hoy}
        plazoMaximoDiasHabiles={30}
      />,
    );

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(/Días hábiles consumidos:/i);
    expect(tooltip).toHaveTextContent(/Días hábiles restantes:/i);
    expect(tooltip).toHaveTextContent(/Vencimiento legal:/i);
  });
});
