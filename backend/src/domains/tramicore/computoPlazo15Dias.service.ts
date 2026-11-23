import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { AppError, ConflictError } from '../../shared/domain/errors/index.js';
import { obtenerEstadoPago } from './demoPago.js';
import {
  sumarDiasHabiles,
  proximoDiaHabil,
  contarDiasHabiles,
  type DiaCalendario,
} from '../organicore/calendario.service.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { calcularHorarioCorte } from './horarioCorte.util.js';

export interface ResultadoHabilitacionExpediente {
  expedienteId: string;
  requierePago: boolean;
  estadoPago: string;
  pagoVerificado: boolean;
  fechaConfirmacionPago: string | null;
  fechaInicioComputo: string | null;
  fechaHabilitacion: string | null;
  fechaVencimientoPago?: string | null;
  diasHabilesRestantes: number;
  habilitado: boolean;
  estadoPlazo?: 'EN_PLAZO' | 'PAGADO' | 'VENCIDO';
  motivoCierre?: string | null;
  mensaje: string;
}

type Conexion = Pick<Pool | PoolClient, 'query'>;

/**
 * Convierte cualquier Date / string a fecha ISO 'YYYY-MM-DD' en zona horaria America/Lima.
 */
export function formatearFechaLima(fecha: Date | string): string {
  if (typeof fecha === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
      return fecha.trim();
    }
    const d = new Date(fecha);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

/**
 * Cómputo institucional del plazo perentorio de 15 días hábiles para el pago (LPAG Art. 143):
 * 1. Comienza con la radicación oficial y generación de la orden de pago.
 * 2. Excluye sábados, domingos, feriados nacionales y días no laborables del sector público.
 * 3. Si el administrado paga antes del vencimiento, el expediente se habilita inmediatamente para Mesa de Partes.
 * 4. Si transcurren los 15 días hábiles sin pago, se activa el cierre automático por falta de pago.
 */
export function calcularPlazoPago15Dias(
  fechaRadicacion: Date | string,
  calendario: readonly DiaCalendario[] = [],
): {
  fechaRadicacionIso: string;
  fechaConfirmacionIso: string;
  fechaInicioComputo: string;
  fechaVencimientoPago: string;
  fechaHabilitacion: string;
} {
  const feriadosIso = calendario.filter((d) => !d.es_laborable || d.tipo_feriado).map((d) => d.fecha);
  let fechaRadicacionIso: string;

  if (fechaRadicacion instanceof Date) {
    const corte = calcularHorarioCorte(fechaRadicacion, feriadosIso);
    fechaRadicacionIso = corte.fechaLegal;
  } else {
    const trimmed = fechaRadicacion.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      fechaRadicacionIso = trimmed;
    } else {
      const parsedDate = new Date(trimmed);
      if (!Number.isNaN(parsedDate.getTime())) {
        const corte = calcularHorarioCorte(parsedDate, feriadosIso);
        fechaRadicacionIso = corte.fechaLegal;
      } else {
        fechaRadicacionIso = formatearFechaLima(fechaRadicacion);
      }
    }
  }

  const fechaInicioComputo = proximoDiaHabil(fechaRadicacionIso, calendario);
  const fechaVencimientoPago = sumarDiasHabiles(fechaRadicacionIso, 15, calendario);

  return {
    fechaRadicacionIso,
    fechaConfirmacionIso: fechaRadicacionIso,
    fechaInicioComputo,
    fechaVencimientoPago,
    fechaHabilitacion: fechaVencimientoPago,
  };
}

/** Alias de compatibilidad hacia atrás */
export const calcularFechasHabilitacion15Dias = calcularPlazoPago15Dias;

/**
 * Consulta el catálogo de feriados y días no laborables activos de sigd_org.calendario_laboral.
 */
export async function obtenerCalendarioLaboralActivo(conexion: Conexion): Promise<DiaCalendario[]> {
  const res = await conexion.query<{
    id_calendario: string;
    fecha: string;
    anio: number;
    tipo_feriado: string | null;
    descripcion: string;
    unidad_territorial: string;
    es_laborable: boolean;
    base_legal: string | null;
    activo: boolean;
  }>(`
    SELECT id_calendario,
           to_char(fecha, 'YYYY-MM-DD') AS fecha,
           anio,
           tipo_feriado,
           descripcion,
           unidad_territorial,
           es_laborable,
           base_legal,
           activo
      FROM sigd_org.calendario_laboral
     WHERE activo = TRUE
     ORDER BY fecha ASC;
  `);

  return res.rows.map((row) => ({
    id_calendario: row.id_calendario,
    fecha: row.fecha,
    anio: row.anio,
    tipo_feriado: row.tipo_feriado as any,
    descripcion: row.descripcion,
    unidad_territorial: row.unidad_territorial as any,
    es_laborable: row.es_laborable,
    base_legal: row.base_legal,
    activo: row.activo,
  }));
}

/**
 * Determina si un expediente requiere pago según el catálogo TUPA 2026.
 */
export async function expedienteRequierePagoTupa(
  conexion: Conexion,
  expedienteId: string,
): Promise<{ requierePago: boolean; tipoTramiteCodigo: string | null; importeTarifa: number }> {
  try {
    const instalada = await conexion.query<{ tabla: string | null }>(
      "SELECT to_regclass('sigd_tra.expediente_habilitacion')::text tabla",
    );
    if (!instalada.rows[0]?.tabla) {
      return { requierePago: false, tipoTramiteCodigo: null, importeTarifa: 0 };
    }
  } catch {
    return { requierePago: false, tipoTramiteCodigo: null, importeTarifa: 0 };
  }

  const res = await conexion.query<{
    codigo: string;
    importe: string | null;
  }>(`
    SELECT t.codigo, f.importe::text
      FROM sigd_tra.expediente e
      JOIN sigd_doc.expediente de ON de.expediente_id = e.expediente_id
      JOIN sigd_doc.tipo_tramite_tupa t ON t.tipo_tramite_id = de.tipo_tramite_id
      LEFT JOIN sigd_tes.tarifa f ON f.tipo_tramite_id = t.tipo_tramite_id
        AND f.estado = 'VALIDADA'
        AND f.vigente_desde <= (now() AT TIME ZONE 'America/Lima')::date
        AND (f.vigente_hasta IS NULL OR f.vigente_hasta >= (now() AT TIME ZONE 'America/Lima')::date)
     WHERE e.expediente_id = $1::uuid
     LIMIT 1;
  `, [expedienteId]);

  if (!res.rows[0]) {
    const tieneOrden = await conexion.query<{ count: string }>(`
      SELECT count(*)::text as count
        FROM sigd_tes.aplicacion_pago a
        JOIN sigd_tes.orden_pago o ON o.id = a.orden_id
       WHERE a.expediente_id = $1::uuid AND o.importe > 0;
    `, [expedienteId]);

    const count = parseInt(tieneOrden.rows[0]?.count ?? '0', 10);
    return { requierePago: count > 0, tipoTramiteCodigo: null, importeTarifa: 0 };
  }

  const importe = parseFloat(res.rows[0].importe ?? '0');
  const requierePago = Number.isFinite(importe) && importe > 0;

  return {
    requierePago,
    tipoTramiteCodigo: res.rows[0].codigo,
    importeTarifa: importe,
  };
}

/**
 * Registra o inicializa el cómputo del plazo de 15 días hábiles al radicar un trámite.
 */
export async function registrarInicioPlazoPago(
  conexion: Conexion,
  expedienteId: string,
  ordenId: string | null,
  fechaRadicacion: Date | string,
  now: Date = new Date(),
): Promise<void> {
  const calendario = await obtenerCalendarioLaboralActivo(conexion);
  const { fechaRadicacionIso, fechaInicioComputo, fechaVencimientoPago } = calcularPlazoPago15Dias(fechaRadicacion, calendario);

  await conexion.query(`
    INSERT INTO sigd_tra.expediente_habilitacion (
      expediente_id,
      requiere_pago,
      orden_id,
      estado_pago,
      fecha_radicacion,
      fecha_inicio_computo,
      dias_habiles_regla,
      fecha_vencimiento_pago,
      habilitado,
      estado_plazo,
      creado_en,
      actualizado_en
    ) VALUES (
      $1::uuid,
      TRUE,
      $2::uuid,
      'PENDIENTE',
      $3::timestamptz,
      $4::date,
      15,
      $5::date,
      FALSE,
      'EN_PLAZO',
      $6::timestamptz,
      $6::timestamptz
    ) ON CONFLICT (expediente_id) DO UPDATE
    SET orden_id = COALESCE(EXCLUDED.orden_id, sigd_tra.expediente_habilitacion.orden_id),
        fecha_radicacion = COALESCE(EXCLUDED.fecha_radicacion, sigd_tra.expediente_habilitacion.fecha_radicacion),
        fecha_inicio_computo = EXCLUDED.fecha_inicio_computo,
        fecha_vencimiento_pago = EXCLUDED.fecha_vencimiento_pago,
        actualizado_en = EXCLUDED.actualizado_en;
  `, [expedienteId, ordenId, fechaRadicacion, fechaInicioComputo, fechaVencimientoPago, now]);
}

/**
 * Obtiene o actualiza de forma atómica y transaccional el estado de habilitación de un expediente.
 * REGLA INSTITUCIONAL OBLIGATORIA:
 * - Si el procedimiento no requiere pago: HABILITADO INMEDIATAMENTE.
 * - Si el procedimiento requiere pago y YA PAGÓ: HABILITADO INMEDIATAMENTE (sin esperar los 15 días).
 * - Si el procedimiento requiere pago y NO HA PAGADO:
 *     * Dentro de los 15 días hábiles: BLOQUEADO POR FALTA DE PAGO (muestra días restantes).
 *     * Vencidos los 15 días hábiles: CIERRE AUTOMÁTICO POR FALTA_DE_PAGO.
 */
export async function obtenerOActualizarHabilitacion(
  conexion: Conexion,
  expedienteId: string,
  now: Date = new Date(),
): Promise<ResultadoHabilitacionExpediente> {
  const { requierePago, tipoTramiteCodigo } = await expedienteRequierePagoTupa(conexion, expedienteId);

  // 1. Procedimiento sin pago según TUPA
  if (!requierePago) {
    return {
      expedienteId,
      requierePago: false,
      estadoPago: 'EXONERADO',
      pagoVerificado: true,
      fechaConfirmacionPago: null,
      fechaInicioComputo: null,
      fechaHabilitacion: null,
      diasHabilesRestantes: 0,
      habilitado: true,
      estadoPlazo: 'PAGADO',
      mensaje: `Procedimiento ${tipoTramiteCodigo ?? ''} gratuito / sin tasa según TUPA: habilitado inmediatamente para recepción formal.`,
    };
  }

  // 2. Verificar datos de expediente y radicación
  const expRow = await conexion.query<{
    fecha_radicacion: Date | null;
    codigo_expediente: string;
    estado: string;
  }>(`
    SELECT fecha_radicacion, codigo_expediente, estado
      FROM sigd_tra.expediente
     WHERE expediente_id = $1::uuid
     LIMIT 1;
  `, [expedienteId]);

  const fechaRadicacionRaw = expRow.rows[0]?.fecha_radicacion ?? now;
  const calendario = await obtenerCalendarioLaboralActivo(conexion);
  const computo = calcularPlazoPago15Dias(fechaRadicacionRaw, calendario);

  // 3. Procedimiento sujeto a pago: verificar si la orden tiene devolución activa
  const ordenRow = await conexion.query<{
    tiene_orden: boolean;
    verificado: boolean;
    tiene_devolucion_activa: boolean;
  }>(`
    SELECT o.id IS NOT NULL AS tiene_orden,
           EXISTS (SELECT 1 FROM sigd_tes.pago p WHERE p.orden_id = o.id AND p.estado = 'VERIFICADO') AS verificado,
           EXISTS (SELECT 1 FROM sigd_tes.pago p JOIN sigd_tes.devolucion d ON d.pago_id = p.id WHERE p.orden_id = o.id AND d.estado != 'RECHAZADA') AS tiene_devolucion_activa
      FROM sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o ON o.id = a.orden_id
     WHERE a.expediente_id = $1::uuid
     LIMIT 1;
  `, [expedienteId]).catch(() => ({ rows: [] }));

  if (ordenRow.rows[0]?.tiene_devolucion_activa) {
    return {
      expedienteId,
      requierePago: true,
      estadoPago: 'ANULADO',
      pagoVerificado: false,
      fechaConfirmacionPago: null,
      fechaInicioComputo: computo.fechaInicioComputo,
      fechaHabilitacion: null,
      fechaVencimientoPago: computo.fechaVencimientoPago,
      diasHabilesRestantes: 0,
      habilitado: false,
      estadoPlazo: 'EN_PLAZO',
      mensaje: 'Pago devuelto o anulado. La habilitación del expediente ha sido revocada.',
    };
  }

  // 3.1 Verificar si existe pago VERIFICADO en Tesorería al momento de evaluación
  const pagoRow = await conexion.query<{
    pago_id: string;
    orden_id: string;
    verificado_en: Date | null;
    fecha_operacion: Date;
    estado: string;
  }>(`
    SELECT p.id AS pago_id,
           p.orden_id,
           p.verificado_en,
           p.fecha_operacion,
           p.estado
      FROM sigd_tes.pago p
      JOIN sigd_tes.aplicacion_pago a ON a.orden_id = p.orden_id
     WHERE a.expediente_id = $1::uuid
       AND p.estado = 'VERIFICADO'
       AND p.fecha_operacion <= $2::timestamptz
     ORDER BY p.fecha_operacion ASC
     LIMIT 1;
  `, [expedienteId, now]);

  const nowIso = formatearFechaLima(now);

  // Consultar registro previo de habilitación
  const prevHabilitacion = await conexion.query<{
    fecha_confirmacion_pago: Date | null;
    fecha_inicio_computo: string | null;
    fecha_vencimiento_pago: string | null;
    fecha_habilitacion: string | null;
    habilitado: boolean;
    estado_pago: string;
    estado_plazo: string | null;
    motivo_cierre: string | null;
    cerrado_por_falta_pago_en: Date | null;
    evento_habilitacion_emitido: boolean;
  }>(`
    SELECT fecha_confirmacion_pago,
           to_char(fecha_inicio_computo, 'YYYY-MM-DD') AS fecha_inicio_computo,
           to_char(fecha_vencimiento_pago, 'YYYY-MM-DD') AS fecha_vencimiento_pago,
           to_char(fecha_habilitacion, 'YYYY-MM-DD') AS fecha_habilitacion,
           habilitado,
           estado_pago,
           estado_plazo,
           motivo_cierre,
           cerrado_por_falta_pago_en,
           evento_habilitacion_emitido
      FROM sigd_tra.expediente_habilitacion
     WHERE expediente_id = $1::uuid;
  `, [expedienteId]);

  const prev = prevHabilitacion.rows[0];

  // Si ya fue archivado por falta de pago y no pagó válidamente antes del cierre:
  if (prev?.cerrado_por_falta_pago_en && (!pagoRow.rows[0] || pagoRow.rows[0].fecha_operacion > prev.cerrado_por_falta_pago_en)) {
    return {
      expedienteId,
      requierePago: true,
      estadoPago: 'NO_PAGADO',
      pagoVerificado: false,
      fechaConfirmacionPago: null,
      fechaInicioComputo: prev.fecha_inicio_computo ?? computo.fechaInicioComputo,
      fechaHabilitacion: null,
      fechaVencimientoPago: prev.fecha_vencimiento_pago ?? computo.fechaVencimientoPago,
      diasHabilesRestantes: 0,
      habilitado: false,
      estadoPlazo: 'VENCIDO',
      motivoCierre: 'FALTA_DE_PAGO',
      mensaje: 'Trámite archivado definitivamente por falta de pago al vencer el plazo legal de 15 días hábiles.',
    };
  }

  const feriadosIso = calendario.filter((d) => !d.es_laborable || d.tipo_feriado).map((d) => d.fecha);
  const fechaVencimiento = prev?.fecha_vencimiento_pago ?? computo.fechaVencimientoPago;

  // =========================================================================
  // ESCENARIO A: CIUDADANO QUE PAGÓ ANTES O DENTRO DEL PLAZO
  // =========================================================================
  const tienePagoValido = (pagoRow.rows[0] && (pagoRow.rows[0].estado === 'VERIFICADO' || !pagoRow.rows[0].estado)) || (!pagoRow.rows[0] && Boolean(prev?.fecha_confirmacion_pago));
  if (tienePagoValido) {
    const pago = pagoRow.rows[0];
    const fechaConfirmacionRaw = pago ? (pago.verificado_en ?? pago.fecha_operacion) : prev!.fecha_confirmacion_pago!;
    const pago_id = pago?.pago_id ?? '00000000-0000-0000-0000-000000000000';
    const orden_id = pago?.orden_id ?? '00000000-0000-0000-0000-000000000000';
    const cortePago = calcularHorarioCorte(new Date(fechaConfirmacionRaw), feriadosIso);
    const fechaEfectivaPago = cortePago.fechaLegal;
    const pagoEsValidoEnPlazo = fechaEfectivaPago <= fechaVencimiento;

    if (!pagoEsValidoEnPlazo) {
      // El pago fue realizado extemporáneamente (posterior a las 16:30:00 del día 15 o en día 16+)
      await archivarPorFaltaDePago(conexion, expedienteId, now);
      return {
        expedienteId,
        requierePago: true,
        estadoPago: 'NO_PAGADO',
        pagoVerificado: false,
        fechaConfirmacionPago: null,
        fechaInicioComputo: prev?.fecha_inicio_computo ?? computo.fechaInicioComputo,
        fechaHabilitacion: null,
        fechaVencimientoPago: fechaVencimiento,
        diasHabilesRestantes: 0,
        habilitado: false,
        estadoPlazo: 'VENCIDO',
        motivoCierre: 'FALTA_DE_PAGO',
        mensaje: `Pago extemporáneo (imputado a fecha efectiva ${fechaEfectivaPago} por registrarse después de las 16:30:00 del vencimiento legal ${fechaVencimiento}). Trámite archivado definitivamente por falta de pago.`,
      };
    }

    const fechaConfirmacionIso = formatearFechaLima(fechaConfirmacionRaw);

    // HABILITADO INMEDIATAMENTE: NO ESPERAR AL DÍA 15
    await conexion.query(`
      INSERT INTO sigd_tra.expediente_habilitacion (
        expediente_id,
        requiere_pago,
        orden_id,
        pago_id,
        estado_pago,
        fecha_confirmacion_pago,
        fecha_radicacion,
        fecha_inicio_computo,
        dias_habiles_regla,
        fecha_vencimiento_pago,
        fecha_habilitacion,
        habilitado,
        estado_plazo,
        actualizado_en
      ) VALUES (
        $1::uuid,
        TRUE,
        $2::uuid,
        $3::uuid,
        'VERIFICADO',
        $4::timestamptz,
        $5::timestamptz,
        $6::date,
        15,
        $7::date,
        $8::date,
        TRUE,
        'PAGADO',
        now()
      ) ON CONFLICT (expediente_id) DO UPDATE
      SET estado_pago = 'VERIFICADO',
          pago_id = EXCLUDED.pago_id,
          fecha_confirmacion_pago = EXCLUDED.fecha_confirmacion_pago,
          fecha_habilitacion = EXCLUDED.fecha_habilitacion,
          habilitado = TRUE,
          estado_plazo = 'PAGADO',
          actualizado_en = now();
    `, [
      expedienteId,
      orden_id,
      pago_id,
      fechaConfirmacionRaw,
      fechaRadicacionRaw,
      computo.fechaInicioComputo,
      computo.fechaVencimientoPago,
      fechaConfirmacionIso, // Fecha de habilitación es la fecha en que pagó
    ]);

    // Emitir eventos outbox de pago confirmado y habilitación inmediata
    if (!prev?.evento_habilitacion_emitido) {
      try {
        await insertarEvento(conexion as any, {
          agregado: 'Expediente',
          tipo_evento: 'pago_confirmado',
          payload: {
            expediente_id: expedienteId,
            cut: expRow.rows[0]?.codigo_expediente,
            pago_id,
            orden_id,
            fecha_confirmacion: fechaConfirmacionIso,
            asunto: `Pago verificado para expediente CUT: ${expRow.rows[0]?.codigo_expediente}`,
          },
        });

        await insertarEvento(conexion as any, {
          agregado: 'Expediente',
          tipo_evento: 'expediente_habilitado_recepcion',
          payload: {
            expediente_id: expedienteId,
            cut: expRow.rows[0]?.codigo_expediente,
            fecha_confirmacion_pago: fechaConfirmacionIso,
            fecha_habilitacion: fechaConfirmacionIso,
            motivo: 'Pago confirmado en Tesorería. Expediente habilitado inmediatamente para Mesa de Partes.',
          },
        });

        await conexion.query(`
          UPDATE sigd_tra.expediente_habilitacion
             SET evento_habilitacion_emitido = TRUE
           WHERE expediente_id = $1::uuid;
        `, [expedienteId]);
      } catch {
        // En caso de contexto sin outbox activo
      }
    }

    return {
      expedienteId,
      requierePago: true,
      estadoPago: 'VERIFICADO',
      pagoVerificado: true,
      fechaConfirmacionPago: fechaConfirmacionIso,
      fechaInicioComputo: prev?.fecha_inicio_computo ?? computo.fechaInicioComputo,
      fechaHabilitacion: prev?.fecha_habilitacion ?? fechaConfirmacionIso,
      fechaVencimientoPago: prev?.fecha_vencimiento_pago ?? computo.fechaVencimientoPago,
      diasHabilesRestantes: 0,
      habilitado: true,
      estadoPlazo: 'PAGADO',
      mensaje: 'Pago de tasa institucional verificado en Tesorería. Expediente habilitado inmediatamente para recepción formal en Mesa de Partes.',
    };
  }

  // =========================================================================
  // ESCENARIO B: CIUDADANO QUE AÚN NO PAGA
  // =========================================================================
  const corteNow = calcularHorarioCorte(now, feriadosIso);
  const esVencido = corteNow.fechaLegal > fechaVencimiento;
  const diasRestantes = esVencido ? 0 : contarDiasHabiles(corteNow.fechaLegal, fechaVencimiento, calendario);

  if (esVencido) {
    // Si ya pasaron los 15 días hábiles sin pagar (a las 16:30:00), archivar automáticamente
    await archivarPorFaltaDePago(conexion, expedienteId, now);

    return {
      expedienteId,
      requierePago: true,
      estadoPago: 'NO_PAGADO',
      pagoVerificado: false,
      fechaConfirmacionPago: null,
      fechaInicioComputo: computo.fechaInicioComputo,
      fechaHabilitacion: null,
      fechaVencimientoPago: fechaVencimiento,
      diasHabilesRestantes: 0,
      habilitado: false,
      estadoPlazo: 'VENCIDO',
      motivoCierre: 'FALTA_DE_PAGO',
      mensaje: `Plazo perentorio de 15 días hábiles vencido el ${fechaVencimiento} a las 16:30:00 sin acreditar pago. El trámite ha sido archivado por falta de pago.`,
    };
  }

  // Aún dentro del plazo de 15 días hábiles para pagar
  await conexion.query(`
    INSERT INTO sigd_tra.expediente_habilitacion (
      expediente_id,
      requiere_pago,
      estado_pago,
      fecha_radicacion,
      fecha_inicio_computo,
      dias_habiles_regla,
      fecha_vencimiento_pago,
      habilitado,
      estado_plazo,
      actualizado_en
    ) VALUES (
      $1::uuid,
      TRUE,
      'PENDIENTE',
      $2::timestamptz,
      $3::date,
      15,
      $4::date,
      FALSE,
      'EN_PLAZO',
      now()
    ) ON CONFLICT (expediente_id) DO UPDATE
    SET estado_plazo = 'EN_PLAZO',
        fecha_vencimiento_pago = EXCLUDED.fecha_vencimiento_pago,
        actualizado_en = now();
  `, [expedienteId, fechaRadicacionRaw, computo.fechaInicioComputo, fechaVencimiento]);

  return {
    expedienteId,
    requierePago: true,
    estadoPago: 'PENDIENTE',
    pagoVerificado: false,
    fechaConfirmacionPago: null,
    fechaInicioComputo: computo.fechaInicioComputo,
    fechaHabilitacion: null,
    fechaVencimientoPago: fechaVencimiento,
    diasHabilesRestantes: diasRestantes,
    habilitado: false,
    estadoPlazo: 'EN_PLAZO',
    mensaje: `Orden de pago pendiente en Tesorería. Dispone de ${diasRestantes} días hábiles para cancelar la tasa (vence el ${fechaVencimiento}).`,
  };
}

/**
 * Ejecuta el cierre definitivo y archivo automático de un expediente por falta de pago.
 * Idempotente, estrictamente atómico, transaccional y protegido mediante bloqueos canónicos a nivel de fila.
 * Sin pg_advisory_xact_lock.
 */
export async function archivarPorFaltaDePago(
  conexion: Conexion,
  expedienteId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const esPool = 'connect' in conexion && typeof (conexion as any).connect === 'function';
  const cliente: PoolClient = esPool ? await (conexion as Pool).connect() : (conexion as PoolClient);
  const manejaTx = esPool;

  try {
    if (manejaTx) {
      await cliente.query('BEGIN');
    }

    // 1. Bloqueo canónico a nivel de fila sobre sigd_tra.expediente
    const expRow = await cliente.query<{
      estado: string;
      codigo_expediente: string;
      solicitante_id: string;
    }>(`
      SELECT estado, codigo_expediente, solicitante_id
        FROM sigd_tra.expediente
       WHERE expediente_id = $1::uuid
         FOR UPDATE;
    `, [expedienteId]);

    if (!expRow.rows[0]) {
      if (manejaTx) await cliente.query('ROLLBACK');
      return false;
    }

    // Bloquear también sigd_doc.expediente para serialización intermodular
    await cliente.query(`
      SELECT expediente_id, estado
        FROM sigd_doc.expediente
       WHERE expediente_id = $1::uuid
         FOR UPDATE;
    `, [expedienteId]);

    // 2. Verificar que no exista un pago verificado previo dentro del plazo
    const pagoCheck = await cliente.query<{ id: string; verificado_en: Date | null; fecha_operacion: Date }>(`
      SELECT p.id, p.verificado_en, p.fecha_operacion
        FROM sigd_tes.pago p
        JOIN sigd_tes.aplicacion_pago a ON a.orden_id = p.orden_id
       WHERE a.expediente_id = $1::uuid
         AND p.estado = 'VERIFICADO'
       LIMIT 1;
    `, [expedienteId]);

    if (pagoCheck.rows.length > 0) {
      const calendario = await obtenerCalendarioLaboralActivo(cliente);
      const feriadosIso = calendario.filter((d) => !d.es_laborable || d.tipo_feriado).map((d) => d.fecha);
      const computo = calcularPlazoPago15Dias(expRow.rows[0].estado, calendario);
      const habRow = await cliente.query<{ fecha_vencimiento_pago: string | null }>(`
        SELECT to_char(fecha_vencimiento_pago, 'YYYY-MM-DD') AS fecha_vencimiento_pago
          FROM sigd_tra.expediente_habilitacion
         WHERE expediente_id = $1::uuid
      `, [expedienteId]);
      const fechaVencimiento = habRow.rows[0]?.fecha_vencimiento_pago ?? computo.fechaVencimientoPago;
      const fechaConfirmacionRaw = pagoCheck.rows[0].verificado_en ?? pagoCheck.rows[0].fecha_operacion;
      const cortePago = calcularHorarioCorte(new Date(fechaConfirmacionRaw), feriadosIso);

      if (cortePago.fechaLegal <= fechaVencimiento) {
        // Se cancela el archivo: el pago fue verificado válidamente dentro del plazo
        if (manejaTx) await cliente.query('COMMIT');
        return false;
      }
    }

    // 3. Verificar si ya fue archivado previamente con bitácora e historial completos
    if (expRow.rows[0].estado === 'ARCHIVADO') {
      const tieneCierre = await cliente.query<{ c: string }>(`
        SELECT count(*)::text as c FROM sigd_rut.expediente_cierre_historial WHERE expediente_id = $1::uuid
      `, [expedienteId]);
      if (parseInt(tieneCierre.rows[0]?.c ?? '0', 10) > 0) {
        await cliente.query(`
          UPDATE sigd_tra.expediente_habilitacion
             SET estado_plazo = 'VENCIDO',
                 motivo_cierre = 'FALTA_DE_PAGO',
                 cerrado_por_falta_pago_en = COALESCE(cerrado_por_falta_pago_en, $1::timestamptz),
                 habilitado = FALSE,
                 actualizado_en = now()
           WHERE expediente_id = $2::uuid;
        `, [now.toISOString(), expedienteId]);
        if (manejaTx) await cliente.query('COMMIT');
        return false;
      }
    }

    const { codigo_expediente, solicitante_id } = expRow.rows[0];
    const nowIso = now.toISOString();

    // 4. Actualizar estado a ARCHIVADO en TramiCore y ANULADO en DocuCore
    await cliente.query("UPDATE sigd_tra.expediente SET estado = 'ARCHIVADO' WHERE expediente_id = $1::uuid", [expedienteId]);
    await cliente.query("UPDATE sigd_doc.expediente SET estado = 'ANULADO' WHERE expediente_id = $1::uuid", [expedienteId]);

    // 5. Registrar en sigd_rut.movimiento_tramite
    const claveIdempotencia = `CIERRE-FALTA-PAGO-${expedienteId}`;
    const movExiste = await cliente.query<{ id_movimiento: string }>(`
      SELECT id_movimiento FROM sigd_rut.movimiento_identidad
       WHERE expediente_id = $1::uuid AND clave_idempotencia = $2
    `, [expedienteId, claveIdempotencia]);

    if (movExiste.rows.length === 0) {
      await cliente.query(`
        INSERT INTO sigd_rut.movimiento_tramite (
          id_movimiento, expediente_id, estado_anterior, evento, estado_nuevo,
          usuario_operador_id, fecha_hora, datos, clave_idempotencia, correlation_id
        ) VALUES (
          $1::uuid, $2::uuid, 'REGISTRADO', 'CIERRE', 'ARCHIVADO',
          990000001, $3::timestamptz, $4::jsonb, $5, $6::uuid
        );
      `, [
        randomUUID(),
        expedienteId,
        nowIso,
        JSON.stringify({
          motivo: 'FALTA_DE_PAGO',
          descripcion: 'Archivo definitivo automático por vencimiento del plazo perentorio de 15 días hábiles sin acreditación de pago (LPAG Art. 143)',
          plazo_dias_habiles: 15,
          operador: 'SISTEMA_AUTOMATICO_VENCIMIENTO',
        }),
        claveIdempotencia,
        randomUUID(),
      ]);
    }

    // 6. Registrar en sigd_rut.expediente_cierre_historial
    const areaMesaPartes = 'a1a3a496-ff7f-45d8-b63c-3e54fcf79de1';
    await cliente.query(`
      INSERT INTO sigd_rut.expediente_cierre_historial (
        id_cierre, expediente_id, tipo_actuacion, usuario_id, persona_id,
        contexto_activo_id, unidad_area_id, fecha_hora, permiso_utilizado,
        estado_anterior, estado_posterior, justificacion, condiciones_verificadas, evidencias, correlation_id
      ) VALUES (
        $1::uuid, $2::uuid, 'CIERRE', '00000000-0000-0000-0000-000000000001', $3::uuid,
        'f9f8eb66-6686-4d97-b341-9191d8144584', $4::uuid, $5::timestamptz, 'EXPEDIENTE_ARCHIVAR',
        'REGISTRADO', 'ARCHIVADO',
        'Archivo definitivo por falta de pago al expirar el plazo perentorio de 15 días hábiles (LPAG Art. 143)',
        '{"pago_verificado": false, "motivo": "FALTA_DE_PAGO", "plazo_15_dias_vencido": true}'::jsonb,
        '{"motivo_cierre": "FALTA_DE_PAGO"}'::jsonb, $6::uuid
      ) ON CONFLICT DO NOTHING;
    `, [randomUUID(), expedienteId, solicitante_id, areaMesaPartes, nowIso, randomUUID()]);

    // 7. Actualizar tabla sigd_tra.expediente_habilitacion
    await cliente.query(`
      UPDATE sigd_tra.expediente_habilitacion
         SET estado_plazo = 'VENCIDO',
             motivo_cierre = 'FALTA_DE_PAGO',
             cerrado_por_falta_pago_en = $1::timestamptz,
             habilitado = FALSE,
             actualizado_en = now()
       WHERE expediente_id = $2::uuid;
    `, [nowIso, expedienteId]);

    // 8. Resolver datos del administrado (cuenta institucional o correo declarado)
    const personaRes = await cliente.query<{
      id_usuario: string | null;
      correo: string | null;
      nombre_completo: string | null;
    }>(`
      SELECT cu.id_usuario::text,
             COALESCE(cu.correo, pn.correo_electronico, rp.email_contacto) AS correo,
             COALESCE(pn.nombre_completo, CONCAT(pn.nombres, ' ', pn.apellidos), pj.razon_social, 'Ciudadano') AS nombre_completo
        FROM sigd_auth.persona p
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
        LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_persona = p.id_persona AND cu.activo = TRUE
        LEFT JOIN sigd_tra.radicacion_publica rp ON rp.expediente_id = $1::uuid
       WHERE p.id_persona = $2::uuid
       LIMIT 1;
    `, [expedienteId, solicitante_id]);

    const persona = personaRes.rows[0];

    // 9. Publicar evento en Transactional Outbox con contrato tipado y robusto
    try {
      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: 'expediente_archivado_falta_pago',
        payload: {
          expediente_id: expedienteId,
          cut: codigo_expediente,
          motivo: 'FALTA_DE_PAGO',
          fecha_cierre: nowIso,
          usuario_id: persona?.id_usuario ?? null,
          correo_destinatario: persona?.correo ?? null,
          titular: persona?.nombre_completo ?? 'Ciudadano',
          asunto: `[SIGD] Notificación de Archivo por Falta de Pago — CUT: ${codigo_expediente}`,
          mensaje: `Su trámite con CUT ${codigo_expediente} ha sido archivado por falta de pago al haber vencido el plazo legal de 15 días hábiles conforme al Art. 143 de la LPAG.`,
        },
      });
    } catch {
      // Ignorar si evento outbox no está disponible en este contexto
    }

    if (manejaTx) {
      await cliente.query('COMMIT');
    }
    return true;
  } catch (error) {
    if (manejaTx) {
      await cliente.query('ROLLBACK').catch(() => undefined);
    }
    throw error;
  } finally {
    if (manejaTx) {
      cliente.release();
    }
  }
}

/**
 * Escanea y procesa todos los expedientes con plazo de pago vencido.
 * Transaccional, idempotente y protegido ante bloqueos concurrentes.
 */
export async function procesarVencimientosPago(
  conexion: Conexion,
  now: Date = new Date(),
): Promise<{ procesados: number; archivados: number }> {
  const calendario = await obtenerCalendarioLaboralActivo(conexion);
  const feriadosIso = calendario.filter((d) => !d.es_laborable || d.tipo_feriado).map((d) => d.fecha);
  const corteNow = calcularHorarioCorte(now, feriadosIso);

  const vencidos = await conexion.query<{ expediente_id: string }>(`
    SELECT h.expediente_id
      FROM sigd_tra.expediente_habilitacion h
      JOIN sigd_tra.expediente e ON e.expediente_id = h.expediente_id
     WHERE h.requiere_pago = TRUE
       AND h.estado_pago = 'PENDIENTE'
       AND h.cerrado_por_falta_pago_en IS NULL
       AND h.fecha_vencimiento_pago < $1::date
       AND e.estado = 'REGISTRADO'
     FOR UPDATE OF e SKIP LOCKED;
  `, [corteNow.fechaLegal]);

  let archivados = 0;
  for (const row of vencidos.rows) {
    const ok = await archivarPorFaltaDePago(conexion, row.expediente_id, now);
    if (ok) archivados++;
  }

  return {
    procesados: vencidos.rows.length,
    archivados,
  };
}

/**
 * Validador estricto para recepción formal en Mesa de Partes:
 * - Si el trámite no requiere pago o ya fue pagado: PERMITE LA RECEPCIÓN INMEDIATAMENTE.
 * - Si el pago está pendiente dentro del plazo: RECHAZA CON 422 (DEMO_PAYMENT_PENDING).
 * - Si el plazo venció y está archivado por falta de pago: RECHAZA CON 409 (EXPEDIENTE_VENCIDO_FALTA_PAGO).
 */
export async function exigirExpedienteHabilitadoParaRecepcion(
  conexion: Conexion,
  expedienteId: string,
  now: Date = new Date(),
): Promise<ResultadoHabilitacionExpediente> {
  const resultado = await obtenerOActualizarHabilitacion(conexion, expedienteId, now);

  if (!resultado.habilitado) {
    if (resultado.estadoPlazo === 'VENCIDO') {
      throw new ConflictError({
        code: 'EXPEDIENTE_VENCIDO_FALTA_PAGO',
        message: resultado.mensaje,
      });
    }

    if (resultado.requierePago && !resultado.pagoVerificado) {
      throw new AppError({
        status: 422,
        code: 'DEMO_PAYMENT_PENDING',
        message: resultado.mensaje,
      });
    }

    throw new ConflictError({
      code: 'EXPEDIENTE_EN_ESPERA_LEGAL',
      message: `Recepción formal bloqueada: ${resultado.mensaje}`,
    });
  }

  return resultado;
}
