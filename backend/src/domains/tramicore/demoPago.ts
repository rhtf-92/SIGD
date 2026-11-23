import type { Pool, PoolClient } from 'pg';
import { AppError } from '../../shared/domain/errors/index.js';

type Conexion = Pick<Pool | PoolClient, 'query'>;
export const MARCA_PAGO_DEMO = 'RADICACIÓN DEMOSTRATIVA SIN VERIFICACIÓN DE PAGO';

/** The flag alone is insufficient: verify the effective backend connection. */
export async function omitirPagoDemo(conexion: Conexion): Promise<boolean> {
  if (process.env.SIGD_DEMO_OMITIR_PAGO !== 'true' || process.env.NODE_ENV === 'production') return false;
  const identidad = await conexion.query<{ db: string }>('SELECT current_database() AS db');
  return identidad.rows[0]?.db === 'sigd_jacobo_demo';
}

export type EstadoPago =
  | 'SIN_ORDEN'
  | 'VERIFICADO'
  | 'PENDIENTE'
  | 'PARCIAL'
  | 'EXONERADO'
  | 'ANULADO';

export interface ResultadoEstadoPago {
  tieneOrden: boolean;
  estado: EstadoPago;
  importe: number;
  importePagado: number;
  permiteDerivacion: boolean;
  mensajeBloqueo: string | null;
}

/**
 * Obtiene el estado efectivo de pago de un expediente consultando Tesorería.
 * Retorna un objeto estructurado que cubre todos los escenarios:
 *   SIN_ORDEN   → tramite sin costo o sin orden emitida (permite derivar)
 *   EXONERADO   → orden emitida con importe 0 (exoneración / gratuito, permite derivar)
 *   VERIFICADO  → pago completo certificado sin devolución activa (permite derivar)
 *   PARCIAL     → pago registrado pero importe_aplicado < importe de la orden (bloquea)
 *   ANULADO     → pago verificado pero con devolución aceptada activa (bloquea)
 *   PENDIENTE   → orden emitida, pago no recibido o no verificado (bloquea)
 *
 * Solo aplica a sigd_jacobo_demo; para otras bases retorna SIN_ORDEN permisivo.
 */
export async function obtenerEstadoPago(
  conexion: Conexion,
  expedienteId: string,
): Promise<ResultadoEstadoPago> {
  // Fuera de la base demo no aplica ninguna restricción
  const identidad = await conexion.query<{ db: string }>('SELECT current_database() AS db');
  if (identidad.rows[0]?.db !== 'sigd_jacobo_demo') {
    return { tieneOrden: false, estado: 'SIN_ORDEN', importe: 0, importePagado: 0, permiteDerivacion: true, mensajeBloqueo: null };
  }

  // Verificar que el módulo de Tesorería esté instalado
  const instalada = await conexion.query<{ tabla: string | null }>(
    "SELECT to_regclass('sigd_tes.aplicacion_pago')::text tabla",
  );

  if (!instalada.rows[0]?.tabla) {
    return { tieneOrden: false, estado: 'SIN_ORDEN', importe: 0, importePagado: 0, permiteDerivacion: true, mensajeBloqueo: null };
  }

  return _consultarEstadoEnTesoreria(conexion, expedienteId);
}

/**
 * Consulta detallada a Tesorería para clasificar el estado de pago.
 * Extiende la consulta original con columnas adicionales para cubrir:
 * EXONERADO (importe=0), PARCIAL (pago insuficiente) y ANULADO (devolución activa).
 *
 * Mantiene compatibilidad con el campo `verificado` para tests heredados.
 */
async function _consultarEstadoEnTesoreria(
  conexion: Conexion,
  expedienteId: string,
): Promise<ResultadoEstadoPago> {
  const res = await conexion.query<{
    tiene_orden: boolean;
    verificado: boolean;
    importe: string | null;
    importe_pagado: string | null;
    tiene_devolucion_activa: boolean;
  }>(`SELECT
    EXISTS(SELECT 1 FROM sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o ON o.id=a.orden_id WHERE a.expediente_id=$1 AND o.importe > 0) tiene_orden,
    EXISTS(SELECT 1 FROM sigd_tes.aplicacion_pago a JOIN sigd_tes.pago p ON p.orden_id=a.orden_id WHERE a.expediente_id=$1 AND p.estado='VERIFICADO'
      AND NOT EXISTS(SELECT 1 FROM sigd_tes.devolucion d WHERE d.pago_id=p.id AND d.estado<>'RECHAZADA')) verificado,
    (SELECT o.importe::text FROM sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o ON o.id=a.orden_id WHERE a.expediente_id=$1 LIMIT 1) importe,
    (SELECT COALESCE(SUM(p.importe_aplicado),0)::text FROM sigd_tes.aplicacion_pago a JOIN sigd_tes.pago p ON p.orden_id=a.orden_id
      WHERE a.expediente_id=$1 AND p.estado='VERIFICADO') importe_pagado,
    EXISTS(SELECT 1 FROM sigd_tes.aplicacion_pago a JOIN sigd_tes.pago p ON p.orden_id=a.orden_id
      JOIN sigd_tes.devolucion d ON d.pago_id=p.id
      WHERE a.expediente_id=$1 AND p.estado='VERIFICADO' AND d.estado<>'RECHAZADA') tiene_devolucion_activa`,
  [expedienteId]);

  const row = res.rows[0];

  // Pago verificado completo sin devolución activa
  if (row?.verificado === true) {
    const importe = parseFloat(row.importe ?? '0');
    const importePagado = parseFloat(row.importe_pagado ?? '0');
    return { tieneOrden: true, estado: 'VERIFICADO', importe, importePagado, permiteDerivacion: true, mensajeBloqueo: null };
  }

  // Sin orden de pago activa (tramite gratuito según columna o sin orden emitida)
  if (!row?.tiene_orden) {
    // Verificar si hay orden con importe 0 (EXONERADO)
    const importe = parseFloat(row?.importe ?? '0');
    if (importe === 0 && row?.importe !== null && row?.importe !== undefined) {
      return { tieneOrden: true, estado: 'EXONERADO', importe: 0, importePagado: 0, permiteDerivacion: true, mensajeBloqueo: null };
    }
    return { tieneOrden: false, estado: 'SIN_ORDEN', importe: 0, importePagado: 0, permiteDerivacion: true, mensajeBloqueo: null };
  }

  const importe = parseFloat(row.importe ?? '0');
  const importePagado = parseFloat(row.importe_pagado ?? '0');

  // Anulado: pago verificado pero con devolución activa (reversión aceptada)
  if (row.tiene_devolucion_activa) {
    return {
      tieneOrden: true,
      estado: 'ANULADO',
      importe,
      importePagado,
      permiteDerivacion: false,
      mensajeBloqueo:
        'Expediente con devolución de pago aceptada: el pago fue revertido. No puede avanzar hasta regularizar el estado en Tesorería.',
    };
  }

  // Parcial: hay pago verificado pero el importe cubierto es insuficiente
  if (importePagado > 0 && importePagado < importe) {
    return {
      tieneOrden: true,
      estado: 'PARCIAL',
      importe,
      importePagado,
      permiteDerivacion: false,
      mensajeBloqueo: `Pago parcial: se recibió ${importePagado.toFixed(2)} de ${importe.toFixed(2)} requerido. No puede avanzar hasta completar el pago en Tesorería.`,
    };
  }

  // Pendiente: orden emitida, sin pago verificado suficiente
  return {
    tieneOrden: true,
    estado: 'PENDIENTE',
    importe,
    importePagado,
    permiteDerivacion: false,
    mensajeBloqueo:
      'Expediente con orden de pago pendiente: el pago NO ha sido verificado en Tesorería. No puede avanzar ni generar resolución hasta su verificación institucional.',
  };
}

/** Durable hold survives disabling the flag. No inference of payment from a PDF. */
export async function exigirSinPagoDemoPendiente(conexion: Conexion, expedienteId: string): Promise<void> {
  const identidad = await conexion.query<{ db: string }>('SELECT current_database() AS db');
  if (identidad.rows[0]?.db !== 'sigd_jacobo_demo') return;

  // El hecho inicial sigue inmutable; el estado actual se deriva de Tesorería.
  const instalada = await conexion.query<{ tabla: string | null }>(
    "SELECT to_regclass('sigd_tes.aplicacion_pago')::text tabla",
  );

  if (instalada.rows[0]?.tabla) {
    const resultado = await _consultarEstadoEnTesoreria(conexion, expedienteId);
    // Bloqueo definitivo por Tesorería (PENDIENTE, PARCIAL o ANULADO)
    if (!resultado.permiteDerivacion && resultado.mensajeBloqueo) {
      throw new AppError({ status: 422, code: 'DEMO_PAYMENT_PENDING', message: resultado.mensajeBloqueo });
    }
    // Tesorería es autoritativa cuando está instalada:
    // VERIFICADO, EXONERADO o SIN_ORDEN → permite avanzar sin consultar el control legado.
    return;
  }

  // Control legado: radicacion_publica / bitacora para instancias sin sigd_tes instalado
  const pendiente = await conexion.query(`SELECT 1 AS pendiente FROM sigd_tra.radicacion_publica
    WHERE expediente_id=$1::uuid AND datos_declarados->>'estado_economico'='NO_VERIFICADO'
      AND datos_declarados->>'modalidad'=$2
    UNION ALL SELECT 1 FROM sigd_audit.bitacora_auditoria
    WHERE esquema='sigd_tra' AND tabla='radicacion_virtual'
      AND datos_despues->>'expediente_id'=$1::text
      AND datos_despues->>'estado_economico'='NO_VERIFICADO'
      AND datos_despues->>'modalidad'=$2`, [expedienteId, MARCA_PAGO_DEMO]);
  if (pendiente.rows.length) throw new AppError({ status: 422, code: 'DEMO_PAYMENT_PENDING',
    message: 'Radicación demostrativa: pago NO VERIFICADO. No puede avanzar ni generar resolución hasta su verificación institucional.' });
}

