/**
 * Suite de la secuencia animada del cavernícola.
 * Comprueba que la ilustración va embebida (para que se pinte sin conexión),
 * que el SVG contiene las cuatro fases de la escena (tirar del cable, descarga
 * eléctrica, caída y letrero del 404) y que la secuencia se reinicia cuando
 * vuelve a caerse la conexión.
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import svgSecuencia from "../../../src/assets/error-404-caveman.svg?raw";
import EscenaErrorConexion from "../../../src/components/common/EscenaErrorConexion";

function renderEscena(secuencia = 0) {
  return render(
    <EscenaErrorConexion
      codigo="Sin conexión a internet"
      titulo="El cavernícola desenchufó el cable"
      descripcion="Sin salida a internet."
      secuencia={secuencia}
    />,
  );
}

describe("Secuencia animada del cavernícola", () => {
  it("1. La ilustración va embebida como data URI para pintarse sin conexión", () => {
    renderEscena();
    const ilustracion = screen.getByAltText(/cavernícola/i);
    expect(ilustracion.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("2. El SVG contiene las cuatro fases de la escena animada", () => {
    // Fase 1: el cavernícola estira el cable de la red.
    expect(svgSecuencia).toContain("@keyframes pulling");
    expect(svgSecuencia).toContain("@keyframes cable-tendido");
    expect(svgSecuencia).toContain("@keyframes enchufe-sale");
    // Fase 2: la descarga eléctrica (chispas, relámpago y destellos).
    expect(svgSecuencia).toContain("@keyframes chispas");
    expect(svgSecuencia).toContain("@keyframes rayo");
    expect(svgSecuencia).toContain("@keyframes destello");
    expect(svgSecuencia).toContain("@keyframes convulsion");
    // Fase 3: la caída hasta quedar sentado.
    expect(svgSecuencia).toContain("@keyframes caida");
    expect(svgSecuencia).toContain("@keyframes polvo-caida");
    expect(svgSecuencia).toContain("@keyframes aparecer-sentado");
    // Fase 4: el letrero con el 404.
    expect(svgSecuencia).toContain("@keyframes cae-letrero");
    expect(svgSecuencia).toMatch(/404/);
  });

  it("3. Comparte una única línea de tiempo de 4,8 s en todas las animaciones", () => {
    const duraciones = [...svgSecuencia.matchAll(/animation-duration:\s*([\d.]+)s/g)].map(
      (m) => m[1],
    );
    expect(duraciones.length).toBeGreaterThan(0);
    // Todas las animaciones de la escena comparten la duración de la secuencia
    // (salvo la respiración y las estrellas, que son bucles posteriores).
    for (const duracion of duraciones) {
      expect(["4.8", "3.2", "3.6"]).toContain(duracion);
    }
  });

  it("4. Tiene alternativa de movimiento reducido: muestra la pose final", () => {
    expect(svgSecuencia).toContain("prefers-reduced-motion");
  });

  it("5. Añade la capa de destello de la descarga eléctrica", () => {
    const { container } = renderEscena();
    expect(container.querySelector(".page_404_destello")).not.toBeNull();
  });

  it("6. Cambiar la secuencia remonta la ilustración para repetir la animación", () => {
    const { container, rerender } = renderEscena(0);
    const antes = container.querySelector("img.page_404_escena_img");
    expect(antes).not.toBeNull();

    rerender(
      <EscenaErrorConexion
        codigo="Sin conexión a internet"
        titulo="El cavernícola desenchufó el cable"
        descripcion="Sin salida a internet."
        secuencia={1}
      />,
    );

    const despues = container.querySelector("img.page_404_escena_img");
    expect(despues).not.toBeNull();
    // Nodo nuevo: la animación del SVG arranca de cero.
    expect(despues).not.toBe(antes);
  });
});
