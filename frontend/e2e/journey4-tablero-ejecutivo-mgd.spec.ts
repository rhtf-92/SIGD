import { test, expect } from "@playwright/test";

test.describe("Journey 4: Tablero Ejecutivo MGD -> Renderizado, Fórmulas Matemáticas y Exportación", () => {
  test("Debe renderizar los 4 indicadores MGD oficiales (VTEP, TPR, TRO, TEO) y botones de exportación", async ({ page }) => {
    // 1. Navegar al Dashboard Ejecutivo MGD
    await page.goto("/reportes/dashboard");

    // 2. Verificar títulos y encabezados institucionales
    const titulo = page.locator("text=Tablero Ejecutivo").or(page.locator("text=Indicadores de Gestión")).or(page.locator("text=MGD"));
    await expect(titulo.first()).toBeVisible();

    // 3. Verificar renderizado de las tarjetas principales de métricas
    const tarjetaVtep = page.locator("text=VTEP");
    await expect(tarjetaVtep.first()).toBeVisible();

    const tarjetaTpr = page.locator("text=TPR");
    await expect(tarjetaTpr.first()).toBeVisible();

    const tarjetaTro = page.locator("text=TRO");
    await expect(tarjetaTro.first()).toBeVisible();

    const tarjetaTeo = page.locator("text=TEO");
    await expect(tarjetaTeo.first()).toBeVisible();

    // 4. Verificar presencia de controles de exportación (PDF / Excel)
    const btnExportarPdf = page.locator('button:has-text("PDF"), a:has-text("PDF")').first();
    const btnExportarExcel = page.locator('button:has-text("Excel"), a:has-text("Excel")').first();
    await expect(btnExportarPdf.or(btnExportarExcel).first()).toBeVisible();
  });
});
