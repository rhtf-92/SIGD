import express from "express";

import correlationIdMiddleware from "./middlewares/correlationId.middleware.js";
import { crearFirmaRouter } from "./domains/docucore/firma.controller.js";
import { InMemoryFirmaSessionStore } from "./domains/docucore/firmaSession.store.js";
import { InMemoryAlmacenDocumentosFirmables } from "./domains/docucore/documentoFirmable.store.js";
import { RefirmaGatewayService } from "./domains/docucore/refirmaGateway.service.js";
import { ServicioFirmaService } from "./domains/docucore/firma.service.js";
import { a4GeneratorService } from "./domains/docucore/a4Generator.service.js";

const app = express();

app.use(express.json());
app.use(correlationIdMiddleware);

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

app.use("/api/v1/firma", crearFirmaRouter(servicio));

export default app;