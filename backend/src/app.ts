import express, { Express } from 'express';
import type { Pool } from 'pg';
import { contextMiddleware } from './middleware/context-middleware.js';
import { errorMiddleware } from './middleware/error-middleware.js';
import { crearRouterReferencia } from './referencia/expediente.router.js';
import { crearRouterRutaDoc } from './domains/rutadoc/rutadoc.router.js';
import type { ObtenerActorRutaDoc } from './domains/rutadoc/rutadoc.controller.js';
import type { FolioCompensationPort, PoliticaReversionRutaDoc, PrepararCompensacionFolios } from './domains/rutadoc/rutadoc.reversion.types.js';
import type { ActorProviderRutaDoc } from './domains/rutadoc/rutadoc.actor-provider.js';
import type { CalendarioLaboralPort } from './domains/rutadoc/sla.types.js';
import type { ClasificadorCcdPort } from './domains/rutadoc/ccd.types.js';
import type { DocumentoMetadataPort } from './domains/rutadoc/foliacion.types.js';

export function construirApp(pool: Pool, opciones: {
  obtenerActorRutaDoc?: ObtenerActorRutaDoc;
  actorProviderRutaDoc?: ActorProviderRutaDoc;
  politicaReversionRutaDoc?: PoliticaReversionRutaDoc;
  prepararCompensacionFolios?: PrepararCompensacionFolios;
  folioCompensationPort?: FolioCompensationPort;
  calendarioLaboralRutaDoc?: CalendarioLaboralPort;
  clasificadorCcdRutaDoc?: ClasificadorCcdPort;
  documentoMetadataRutaDoc?: DocumentoMetadataPort;
  porcentajeAmarilloSlaRutaDocDesde?: number;
} = {}): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json());
  app.use(contextMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', crearRouterReferencia(pool));
  app.use('/api/v1', crearRouterRutaDoc(pool, opciones.obtenerActorRutaDoc,
    opciones.politicaReversionRutaDoc, opciones.prepararCompensacionFolios,
    opciones.actorProviderRutaDoc, opciones.folioCompensationPort, {
      calendarioLaboral: opciones.calendarioLaboralRutaDoc,
      clasificadorCcd: opciones.clasificadorCcdRutaDoc,
      documentoMetadata: opciones.documentoMetadataRutaDoc,
      porcentajeAmarilloSlaDesde: opciones.porcentajeAmarilloSlaRutaDocDesde,
    }));

  app.use(errorMiddleware);

  return app;
}

export default construirApp;
