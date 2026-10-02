import { ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type { DocumentoMetadataPort, FolioExpediente, RepositorioFoliacionRutaDoc } from './foliacion.types.js';

const metadataNoDisponible: DocumentoMetadataPort = Object.freeze({
  obtenerMetadataDocumento: async () => ({ checksumSha256: null, nombre: null, tipo: null }),
});

export class ServicioFoliacionRutaDoc {
  constructor(private readonly repositorio: RepositorioFoliacionRutaDoc,
    private readonly metadata: DocumentoMetadataPort = metadataNoDisponible) {}

  async obtener(idExpediente: string, actor: ActorRutaDoc): Promise<readonly FolioExpediente[]> {
    if (!await this.repositorio.existeExpediente(idExpediente)) throw new NotFoundError({ detail: 'El expediente no existe.' });
    if (!actor.puedeVerExpediente || !await actor.puedeVerExpediente(idExpediente)) throw new ForbiddenError();
    const folios = await this.repositorio.listar(idExpediente);
    return Promise.all(folios.map(async (folio) => {
      const metadata = await this.metadata.obtenerMetadataDocumento(folio.idDocumento);
      return { ...folio, nombre: metadata.nombre ?? null, tipo: metadata.tipo ?? null,
        rango: `F. ${String(folio.folioInicio).padStart(4, '0')} a F. ${String(folio.folioFin).padStart(4, '0')}`,
        checksumSha256: metadata.checksumSha256 ?? null };
    }));
  }
}
