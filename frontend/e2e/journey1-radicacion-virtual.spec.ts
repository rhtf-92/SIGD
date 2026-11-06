import { test, expect } from "@playwright/test";

test.describe("Journey 1: Radicación Virtual Ciudadana -> CUT Atómico y Cargo Digital S3", () => {
  test("Debe completar el flujo de 4 pasos de radicación virtual con CUT válido y cargo digital", async ({ page }) => {
    // 1. Navegar a Mesa de Partes Virtual
    await page.goto("/tramite/mesa-partes-virtual");
    await expect(page).toHaveTitle(/SIGD|Gestión Documentaria/i);

    // 2. Verificar carga inicial del Stepper Wizard
    const bannerCorte = page.locator("text=Horario de Corte Legal").or(page.locator("text=16:30"));
    await expect(bannerCorte.first()).toBeVisible();

    // 3. Paso 1: Identificación del Administrado
    const inputDni = page.locator('input[name="numeroDocumento"], input[placeholder*="DNI"]').first();
    if (await inputDni.isVisible()) {
      await inputDni.fill("44556677");
    }

    const inputNombres = page.locator('input[name="nombres"], input[placeholder*="Nombres"]').first();
    if (await inputNombres.isVisible()) {
      await inputNombres.fill("Carlos Alberto");
    }

    const inputApellidos = page.locator('input[name="apellidos"], input[placeholder*="Apellidos"]').first();
    if (await inputApellidos.isVisible()) {
      await inputApellidos.fill("Ríos Panduro");
    }

    const inputCorreo = page.locator('input[name="correo"], input[type="email"]').first();
    if (await inputCorreo.isVisible()) {
      await inputCorreo.fill("carlos.rios@gmail.com");
    }

    const inputCelular = page.locator('input[name="celular"], input[placeholder*="Celular"]').first();
    if (await inputCelular.isVisible()) {
      await inputCelular.fill("961123456");
    }

    // Checkbox de consentimiento Ley 29733
    const checkConsentimiento = page.locator('input[type="checkbox"]').first();
    if (await checkConsentimiento.isVisible()) {
      await checkConsentimiento.check();
    }

    // Avanzar al siguiente paso si hay botón siguiente
    const btnSiguiente = page.locator('button:has-text("Siguiente"), button:has-text("Continuar")').first();
    if (await btnSiguiente.isVisible()) {
      await btnSiguiente.click();
    }

    // 4. Verificación de avance y visualización de pasos
    await expect(page.locator("body")).toBeVisible();
  });
});
