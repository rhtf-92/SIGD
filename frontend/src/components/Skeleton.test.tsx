import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Skeleton, { SkeletonCard, SkeletonLine, SkeletonLines } from "./Skeleton";

describe("Skeleton", () => {
  it("renderiza una línea individual accesible", () => {
    render(<SkeletonLine aria-label="Cargando dato" />);
    const elemento = screen.getByRole("status");
    expect(elemento).toBeInTheDocument();
    expect(elemento).toHaveAttribute("aria-busy", "true");
    expect(elemento).toHaveAttribute("aria-label", "Cargando dato");
    expect(elemento).toHaveClass("sigd-skeleton", "sigd-skeleton-line");
  });

  it("renderiza múltiples líneas con SkeletonLines", () => {
    const { container } = render(<SkeletonLines lines={4} />);
    expect(container.querySelectorAll(".sigd-skeleton-line").length).toBe(4);
  });

  it("renderiza una tarjeta skeleton con animación pulse", () => {
    render(<SkeletonCard aria-label="Cargando tarjeta" />);
    const card = screen.getByRole("status");
    expect(card).toHaveClass("animate-pulse", "sigd-skeleton-card");
  });

  it("renderiza lista de tarjetas con count > 1", () => {
    const { container } = render(<Skeleton variant="card" count={3} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBe(3);
  });
});
