import express, { Express } from "express";
import type { Pool } from "pg";

import correlationIdMiddleware from "./middlewares/correlationId.middleware.js";
import { contextMiddleware } from "./middleware/context-middleware.js";
import { errorMiddleware } from "./middleware/error-middleware.js";
import { crearRouterReferencia } from "./referencia/expediente.router.js";

// Módulos de DocuCore / Firma Digital
import { crearFirmaRouter } from "./domains/docucore/firma.controller.js";
import { InMemoryFirmaSessionStore } from "./domains/docucore/firmaSession.store.js";
import { InMemoryAlmacenDocumentosFirmables } from "./domains/docucore/documentoFirmable.store.js";
import { RefirmaGatewayService } from "./domains/docucore/refirmaGateway.service.js";
import { ServicioFirmaService } from "./domains/docucore/firma.service.js";

export async function construirApp(pool: Pool): Promise<Express> {
  const app = express();
  app.disable("x-powered-by");

  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use(contextMiddleware);

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Configuración de Pasarela y Sesiones de Firma
  const hostsPermitidos = (process.env.REFIRMA_HOSTS_PERMITIDOS ?? "sigd.iestp-suiza.edu.pe")
    .split(",")
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  const pasarela = new RefirmaGatewayService({
    hostsPermitidos,
    exigirHttps: process.env.REFIRMA_EXIGIR_HTTPS !== "false",
  });

  let sesiones: InMemoryFirmaSessionStore | import("./domains/docucore/firmaSession.store.js").RedisFirmaSessionStore;
  try {
    const { RedisFirmaSessionStore } = await import("./domains/docucore/firmaSession.store.js");
    sesiones = RedisFirmaSessionStore.desdeEntorno();
  } catch {
    sesiones = new InMemoryFirmaSessionStore();
  }

  const almacen = new InMemoryAlmacenDocumentosFirmables(sesiones);
  const servicio = new ServicioFirmaService({ sesiones, almacen, pasarela });

  // Rutas
  app.use("/api/v1/firma", crearFirmaRouter(servicio));
  app.use("/api", crearRouterReferencia(pool));

  app.use(errorMiddleware);

  return app;
}

export default construirApp;