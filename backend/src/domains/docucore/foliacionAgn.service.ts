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
  usuarioId: string | null = null,
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
       FROM sigd_tra.expediente_documento_folio
      WHERE expediente_id = $1
        AND id_documento = $2`,
    [expedienteId, documentoId],
  );

  if (existente.rowCount !== 0) {
    throw new ConflictError({
      code: 'DOCUMENTO_YA_FOLIADO',
      detail: 'El documento ya tiene una foliación inmutable en este expediente.',
    });
  }

  const creada = await cliente.query<{ folio_inicio: number; folio_fin: number }>(
    `SELECT folio_inicio, folio_fin
       FROM sigd_tra.agregar_folio_expediente($1, $2, $3, $4)`,
    [expedienteId, documentoId, totalFolios, usuarioId],
  );

  return {
    expediente_id: expedienteId,
    documento_id: documentoId,
    folio_desde: creada.rows[0].folio_inicio,
    folio_hasta: creada.rows[0].folio_fin,
    total_folios: totalFolios,
  };
}