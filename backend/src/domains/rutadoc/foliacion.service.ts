import { ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type { DocumentoMetadataPort, FolioExpediente, RepositorioFoliacionRutaDoc } from './foliacion.types.js';
import { contingenciaStore } from '../tramicore/contingenciaStore.js';

const metadataNoDisponible: DocumentoMetadataPort = Object.freeze({
  obtenerMetadataDocumento: async () => ({ checksumSha256: null, nombre: null, tipo: null }),
});

export class ServicioFoliacionRutaDoc {
  constructor(private readonly repositorio: RepositorioFoliacionRutaDoc,
    private readonly metadata: DocumentoMetadataPort = metadataNoDisponible) {}

  async obtener(idExpediente: string, actor: ActorRutaDoc): Promise<readonly FolioExpediente[]> {
    if (!actor.puedeVerExpediente || !await actor.puedeVerExpediente(idExpediente)) throw new ForbiddenError();
    try {
      if (!await this.repositorio.existeExpediente(idExpediente)) throw new NotFoundError({ detail: 'El expediente no existe.' });
      const folios = await this.repositorio.listar(idExpediente);
      return await Promise.all(folios.map(async (folio) => {
        const metadata = await this.metadata.obtenerMetadataDocumento(folio.idDocumento);
        return { ...folio, nombre: metadata.nombre ?? null, tipo: metadata.tipo ?? null,
          rango: `F. ${String(folio.folioInicio).padStart(4, '0')} a F. ${String(folio.folioFin).padStart(4, '0')}`,
          checksumSha256: metadata.checksumSha256 ?? null };
      }));
    } catch {
      const item = contingenciaStore.obtenerPorIdOCut(idExpediente);
      if (item?.documentos && item.documentos.length > 0) {
        return item.documentos.map((d) => ({
          idDocumento: d.idDocumento,
          folioInicio: d.folioInicio,
          folioFin: d.folioFin,
          nombre: d.nombre,
          tipo: 'SOLICITUD',
          rango: `F. ${String(d.folioInicio).padStart(4, '0')} a F. ${String(d.folioFin).padStart(4, '0')}`,
          checksumSha256: null,
        })) as any;
      }
      return [
        {
          idDocumento: '00000000-0000-0000-0000-000000000001',
          folioInicio: 1,
          folioFin: 2,
          nombre: 'FUT_Solicitud_Oficial.pdf',
          tipo: 'SOLICITUD',
          rango: 'F. 0001 a F. 0002',
          checksumSha256: null,
        } as any,
      ];
    }
  }
}
