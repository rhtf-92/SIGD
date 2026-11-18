import type { PoolClient } from 'pg';

/** Contrato de escritores RutaDoc/TramiCore: bloquear antes de releer el estado.
 * El cliente recibido debe ser el de la transacción que reserva e inserta movimientos.
 */
export async function bloquearExpedienteRutaDoc(cliente: PoolClient, expedienteId: string): Promise<void> {
  await cliente.query("SELECT pg_advisory_xact_lock(hashtext('exp_' || $1::text))", [expedienteId]);
}
