import type { PoolClient } from 'pg';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../shared/domain/errors/index.js';

export interface FoliacionAsignada {
  expediente_id: string;
  documento_id: string;
  folio_desde: number;
  folio_hasta: number;
  total_folios: number;
}

/**
 * Asigna un rango F. 1..N sin saltos.
 * El expediente debe permanecer bloqueado durante toda la transacción.
 */
export async function asignarFoliacionContinua(
  cliente: PoolClient,
  expedienteId: string,
  documentoId: string,
  totalFolios: number,
): Promise<FoliacionAsignada> {
  if (!Number.isInteger(totalFolios) || totalFolios < 1) {
    throw new ValidationError({
      invalidParams: [
        {
          name: 'total_folios',
          reason: 'Debe ser un entero mayor que cero.',
        },
      ],
    });
  }

  const expediente = await cliente.query<{ expediente_id: string }>(
    `SELECT expediente_id
       FROM sigd_tra.expediente
      WHERE expediente_id = $1
      FOR UPDATE`,
    [expedienteId],
  );

  if (expediente.rowCount !== 1) {
    throw new NotFoundError({
      detail: 'El expediente indicado no existe.',
    });
  }

  const existente = await cliente.query(
    `SELECT 1
       FROM sigd_doc.foliacion_documento
      WHERE expediente_id = $1
        AND documento_id = $2`,
    [expedienteId, documentoId],
  );

  if (existente.rowCount !== 0) {
    throw new ConflictError({
      code: 'DOCUMENTO_YA_FOLIADO',
      detail: 'El documento ya tiene una foliación inmutable en este expediente.',
    });
  }

  const ultimo = await cliente.query<{ ultimo_folio: number }>(
    `SELECT COALESCE(MAX(folio_hasta), 0)::integer AS ultimo_folio
       FROM sigd_doc.foliacion_documento
      WHERE expediente_id = $1`,
    [expedienteId],
  );

  const folioDesde = ultimo.rows[0].ultimo_folio + 1;
  const folioHasta = folioDesde + totalFolios - 1;

  const creada = await cliente.query<FoliacionAsignada>(
    `INSERT INTO sigd_doc.foliacion_documento
      (
        expediente_id,
        documento_id,
        folio_desde,
        folio_hasta,
        total_folios
      )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       expediente_id,
       documento_id,
       folio_desde,
       folio_hasta,
       total_folios`,
    [
      expedienteId,
      documentoId,
      folioDesde,
      folioHasta,
      totalFolios,
    ],
  );

  return creada.rows[0];
}