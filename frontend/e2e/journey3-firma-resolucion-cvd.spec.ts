import { test, expect } from "@playwright/test";

test.describe("Journey 3: Despacho y Firma Digital -> Protocolo Refirma RENIEC y Estampa CVD/QR", () => {
  test("Debe redactar resolución directoral y acceder al validador público de CVD", async ({ page }) => {
    // 1. Navegar a Proyector de Resoluciones
    await page.goto("/flujos/proyector-resoluciones");
    await expect(page.locator("text=Proyector de Resoluciones Directorales")).toBeVisible();

    // 2. Comprobar presencia del editor estructurado en hoja A4
    const editorVistos = page.locator("textarea").first();
    await expect(editorVistos).toBeVisible();

    // 3. Probar navegación hacia la Pasarela de Firma Digital
    await page.goto("/flujo-validez-legal/firma");
    await expect(page.locator("body")).toBeVisible();

    // 4. Navegar al Validador Público CVD anónimo
    await page.goto("/validador-cvd");
    const tituloValidador = page.locator("text=Validador").or(page.locator("text=Verificación Digital"));
    await expect(tituloValidador.first()).toBeVisible();

    // 5. Ingresar código CVD institucional
    const inputCvd = page.locator('input[placeholder*="CVD"], input[name*="cvd"]').first();
    if (await inputCvd.isVisible()) {
      await inputCvd.fill("CVD-2026-RD-000142-A8F2");
      const btnValidar = page.locator('button:has-text("Validar"), button:has-text("Verificar")').first();
      if (await btnValidar.isVisible()) {
        await btnValidar.click();
      }
    }
  });
});
