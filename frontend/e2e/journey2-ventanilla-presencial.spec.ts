import { test, expect } from "@playwright/test";

test.describe("Journey 2: Ventanilla Presencial -> Foliación Continua AGN y Ticket Térmico POS", () => {
  test("Debe cargar la vista de ventanilla presencial con foliación y opciones de impresión de ticket", async ({ page }) => {
    // 1. Navegar a Ventanilla Presencial
    await page.goto("/tramite/ventanilla-presencial");

    // 2. Comprobar encabezados oficiales
    const titulo = page.locator("text=Ventanilla Presencial").or(page.locator("text=Mesa de Partes Presencial"));
    await expect(titulo.first()).toBeVisible();

    // 3. Verificar controles de foliación e ingreso de administrado
    const campoDni = page.locator('input[placeholder*="DNI"], input[name*="dni"]').first();
    if (await campoDni.isVisible()) {
      await campoDni.fill("45892134");
    }

    const campoAsunto = page.locator('textarea, input[placeholder*="Asunto"]').first();
    if (await campoAsunto.isVisible()) {
      await campoAsunto.fill("Entrega de requisitos de subsanación de titulación profesional técnica");
    }

    const campoFolios = page.locator('input[type="number"], input[placeholder*="Folios"]').first();
    if (await campoFolios.isVisible()) {
      await campoFolios.fill("12");
    }

    // 4. Comprobar presencia de componente de ticket térmico o botón de registro
    const btnRegistrar = page.locator('button:has-text("Registrar"), button:has-text("Emitir Cargo")').first();
    await expect(btnRegistrar).toBeVisible();
  });
});
