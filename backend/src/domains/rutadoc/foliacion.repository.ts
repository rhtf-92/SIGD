import type { Pool } from 'pg';
import type { RepositorioFoliacionRutaDoc } from './foliacion.types.js';

export class RepositorioPostgresFoliacionRutaDoc implements RepositorioFoliacionRutaDoc {
  constructor(private readonly pool: Pool) {}

  async existeExpediente(idExpediente: string): Promise<boolean> {
    const resultado = await this.pool.query<{ existe: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente WHERE expediente_id = $1::uuid) AS existe',
      [idExpediente]);
    return resultado.rows[0].existe;
  }

  async listar(idExpediente: string) {
    const resultado = await this.pool.query<{
      id_documento: string; folio_inicio: number; folio_fin: number; total_folios: number;
    }>(`
      SELECT id_documento::text, folio_inicio, folio_fin,
             (folio_fin - folio_inicio + 1) AS total_folios
        FROM sigd_tra.expediente_documento_folio
       WHERE expediente_id = $1::uuid
       ORDER BY folio_inicio ASC`, [idExpediente]);
    return resultado.rows.map((fila) => ({ idDocumento: fila.id_documento,
      folioInicio: fila.folio_inicio, folioFin: fila.folio_fin, cantidadFolios: fila.total_folios }));
  }
}
