import type { ActorProviderRutaDoc } from '../../src/domains/rutadoc/rutadoc.actor-provider.js';
import type { ActorRutaDoc } from '../../src/domains/rutadoc/rutadoc.types.js';

/** Únicamente para pruebas; la aplicación productiva nunca importa este módulo. */
export function actorProviderDePrueba(actor: ActorRutaDoc | null): ActorProviderRutaDoc {
  return { obtenerActor: () => actor };
}
