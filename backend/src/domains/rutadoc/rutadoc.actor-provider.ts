import type { Request } from 'express';
import type { ActorRutaDoc } from './rutadoc.types.js';

/** Punto de conexión de IdentiCore: sólo acepta una sesión/token ya verificado. */
export interface ActorProviderRutaDoc {
  obtenerActor(req: Request): ActorRutaDoc | null | Promise<ActorRutaDoc | null>;
}

/** Adaptador productivo mientras IdentiCore no publique su middleware: falla cerrado. */
export const actorProviderNoConfigurado: ActorProviderRutaDoc = Object.freeze({
  obtenerActor: () => null,
});
