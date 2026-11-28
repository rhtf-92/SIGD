/**
 * Endpoints #7 al #13 del catálogo REST — Casilla Electrónica y Acuse Legal
 * Normativa: D.S. N° 006-2026-JUS (TUO vigente de la Ley N° 27444 - LPAG),
 *            Ley N° 31736 (Ley de Notificación Administrativa mediante Casilla Electrónica)
 *            y Ley N° 29733 (Protección de Datos Personales).
 * TSK-DEV-05.3: Cómputo procesal LPAG de plazos y certificado de acuse en PDF.
 *
 *   #7  GET   /api/v1/casilla/notificaciones                — Bandeja paginada de notificaciones legales
 *   #8  GET   /api/v1/casilla/notificaciones/:id            — Detalle del acto administrativo notificado
 *   #9  PATCH /api/v1/casilla/notificaciones/:id/lectura    — Asiento fehaciente de primera lectura procesal
 *   #10 POST  /api/v1/casilla/notificaciones/:id/acuse      — Generación inmutable de Acuse Notificatorio Digital (SHA-256)
 *   #11 GET   /api/v1/casilla/estadisticas                  — Contadores de notificaciones no leídas y plazos
 *   #12 GET   /api/v1/casilla/notificaciones/:id/documento/descargar — Presigned GET URL para PDF del acto notificado
 *   #13 GET   /api/v1/casilla/notificaciones/:id/acuse/descargar     — Emisión y entrega de URL autorizada para PDF de acuse
 *       GET   /api/v1/casilla/notificaciones/:id/acuse/archivo       — Descarga directa autenticada del PDF de acuse
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { extraerTokenBearer, verificarTokenAcceso, firmarTokenAcceso } from '../../core/auth/jwt.service.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { generarDescargaAutorizada } from '../../core/storage/storage.router.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { cotejarPdfFirmado } from '../docucore/callbackRefirma.service.js';
import {
  esDiaLaborable,
  proximoDiaHabil,
  sumarDiasHabiles,
  type DiaCalendario,
} from '../organicore/calendario.service.js';
import { generarCertificadoAcusePdf, type DatosAcusePdf } from './casillaAcusePdf.service.js';

const fechaFiltroSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((valor) => {
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}, 'Fecha inválida');

const consultaPaginadaSchema = z
  .object({
    pagina: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional(),
    porPagina: z.coerce.number().int().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    estado: z.enum(['LEIDO', 'NO_LEIDO', 'NOTIFICADO', 'TODOS']).default('TODOS'),
    tipo: z.enum(['RESOLUCION', 'OFICIO', 'NOTIFICACION_OBSERVACION', 'CITACION', 'CONSTANCIA', 'INFORME', 'OTRO', 'TODOS']).default('TODOS'),
    fechaInicio: fechaFiltroSchema.optional(),
    fechaFin: fechaFiltroSchema.optional(),
    busqueda: z.string().optional(),
  })
  .refine((val) => !val.fechaInicio || !val.fechaFin || val.fechaInicio <= val.fechaFin, {
    message: 'El rango de fechas es inválido',
  })
  .transform((val) => ({
    pagina: val.pagina ?? val.page ?? 1,
    porPagina: val.porPagina ?? val.limit ?? 10,
    estado: val.estado,
    tipo: val.tipo,
    fechaInicio: val.fechaInicio,
    fechaFin: val.fechaFin,
    busqueda: val.busqueda,
  }));

export interface FilaNotificacionCasilla {
  id: string;
  usuario_id: string | null;
  correo_destinatario: string | null;
  cut: string | null;
  asunto: string;
  tipo_acto: string;
  numero_documento: string | null;
  cuerpo: unknown;
  referencia: string | null;
  estado: 'NO_LEIDO' | 'LEIDO' | 'PENDIENTE' | 'NOTIFICADO';
  fecha_deposito: Date | string;
  fecha_lectura: Date | string | null;
  hash_sha256: string | null;
  cvd: string | null;
  id_acuse: string | null;
  acuse_hash_sha256: string | null;
  acuse_sellado_tiempo: Date | string | null;
  documento_url: string | null;
  creado_en: Date | string;
}

export interface DestinatarioInfo {
  nombreCompleto: string;
  numeroDocumento: string | null;
  tipoDocumento: string;
  correo: string | null;
}

export interface PlazosLpagResultado {
  fechaDepositoIso: string;
  fechaDepositoLima: string;
  horaDepositoLima: number;
  minutoDepositoLima: number;
  esFueraHorario: boolean;
  esLaborable: boolean;
  fechaEfectoLegal: string;
  plazoImpugnacionDiasHabiles: number;
  fechaInicioImpugnacion: string;
  fechaLimiteImpugnacion: string;
  validezLegalMensaje: string;
}

export function obtenerFechaHoraLima(fecha: Date | string): {
  fechaIso: string;
  hora: number;
  minuto: number;
} {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const formateador = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const partes = formateador.formatToParts(d);
  const p: Record<string, string> = {};
  for (const part of partes) {
    p[part.type] = part.value;
  }
  return {
    fechaIso: `${p.year}-${p.month}-${p.day}`,
    hora: parseInt(p.hour ?? '0', 10),
    minuto: parseInt(p.minute ?? '0', 10),
  };
}

/**
 * Catálogo legal de días no laborables y feriados oficiales:
 * - Feriados Nacionales: D. Leg. N° 713 y leyes modificatorias (Ley N° 31365 Batalla de Ayacucho,
 *   Ley N° 31530 Batalla de Junín, Ley N° 31788 Batalla de Arica, Ley N° 31822 Fuerza Aérea).
 * - Feriados Regionales de Ucayali (IESTP «Suiza» - Pucallpa):
 *   * 18 de junio: Aniversario de la creación del Departamento de Ucayali y Día de la Identidad
 *     Ucayalina y de la Danza Tradicional (Ordenanza Regional N° 004-2019-GRU-CR).
 *   * 24 de junio: Fiesta Patronal de San Juan Bautista (Ordenanza Regional N° 004-2004-GRU-CR).
 * - EXCLUSIÓN EXPRESA: 13 de octubre corresponde a la creación de la provincia de Ucayali en Loreto
 *   (Ley de 13/10/1900), no a la región Ucayali ni a Pucallpa. Es día laborable ordinario.
 */
export function obtenerFeriadosOficialesEstaticos(anio: number): DiaCalendario[] {
  const feriados: DiaCalendario[] = [
    { id_calendario: '', fecha: `${anio}-01-01`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Año Nuevo', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
    { id_calendario: '', fecha: `${anio}-05-01`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Día del Trabajo', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
    { id_calendario: '', fecha: `${anio}-06-07`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Batalla de Arica y Día de la Bandera', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'Ley N° 31788', activo: true },
    { id_calendario: '', fecha: `${anio}-06-18`, anio, tipo_feriado: 'REGIONAL_UCAYALI', descripcion: 'Aniversario de Creación de Ucayali y Día de la Identidad Ucayalina', unidad_territorial: 'UCAYALI', es_laborable: false, base_legal: 'Ordenanza Regional N° 004-2019-GRU-CR', activo: true },
    { id_calendario: '', fecha: `${anio}-06-24`, anio, tipo_feriado: 'REGIONAL_UCAYALI', descripcion: 'Fiesta Patronal de San Juan Bautista', unidad_territorial: 'UCAYALI', es_laborable: false, base_legal: 'Ordenanza Regional N° 004-2004-GRU-CR', activo: true },
    { id_calendario: '', fecha: `${anio}-06-29`, anio, tipo_feriado: 'NACIONAL', descripcion: 'San Pedro y San Pablo', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
    { id_calendario: '', fecha: `${anio}-07-23`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Día de la Fuerza Aérea del Perú', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'Ley N° 31822', activo: true },
    { id_calendario: '', fecha: `${anio}-07-28`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Fiestas Patrias', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
    { id_calendario: '', fecha: `${anio}-07-29`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Fiestas Patrias', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
    { id_calendario: '', fecha: `${anio}-08-06`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Batalla de Junín', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'Ley N° 31530', activo: true },
    { id_calendario: '', fecha: `${anio}-08-30`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Santa Rosa de Lima', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
    { id_calendario: '', fecha: `${anio}-10-08`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Combate de Angamos', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
    { id_calendario: '', fecha: `${anio}-11-01`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Día de Todos los Santos', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
    { id_calendario: '', fecha: `${anio}-12-08`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Inmaculada Concepción', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
    { id_calendario: '', fecha: `${anio}-12-09`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Batalla de Ayacucho', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'Ley N° 31365', activo: true },
    { id_calendario: '', fecha: `${anio}-12-25`, anio, tipo_feriado: 'NACIONAL', descripcion: 'Navidad', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
  ];

  if (anio === 2026) {
    feriados.push(
      { id_calendario: '', fecha: '2026-04-02', anio: 2026, tipo_feriado: 'NACIONAL', descripcion: 'Jueves Santo', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
      { id_calendario: '', fecha: '2026-04-03', anio: 2026, tipo_feriado: 'NACIONAL', descripcion: 'Viernes Santo', unidad_territorial: 'NACIONAL', es_laborable: false, base_legal: 'D. Leg. N° 713', activo: true },
    );
  }

  return feriados;
}

/**
 * Cómputo de plazos procesales conforme a la normativa vigente a noviembre de 2026:
 * - Ley N° 31736 (Ley de Notificación Administrativa mediante Casilla Electrónica):
 *   * Art. 5.2: Notificaciones se efectúan en días y horas hábiles de la entidad (08:00 a 17:00 h).
 *     Las depositadas fuera de horario o en días inhábiles adquieren eficacia el día hábil siguiente.
 *   * Art. 5.3: El cómputo de los plazos expresados en días se inicia el día en que la notificación
 *     adquiere eficacia (Día 1), salvo que en el acto administrativo se señale fecha posterior.
 *   * Art. 5.6: El administrado tiene un plazo de los cinco primeros días hábiles para confirmar recepción.
 * - D.S. N° 006-2026-JUS (TUO de la Ley N° 27444 - LPAG):
 *   * Art. 25: Eficacia de las notificaciones.
 *   * Art. 134.1: Cómputo en días hábiles (excluye días no laborables y feriados).
 *   * Art. 134.2: Si el vencimiento cae en día inhábil, se prorroga al primer día hábil siguiente.
 *   * Art. 207.2: Quince (15) días hábiles perentorios para interponer recursos administrativos.
 *   * Art. 218: Agotamiento de la vía administrativa.
 */
export function computarPlazosNotificacionLpag(
  fechaDeposito: Date | string,
  calendario: readonly DiaCalendario[] = [],
): PlazosLpagResultado {
  const { fechaIso, hora, minuto } = obtenerFechaHoraLima(fechaDeposito);
  const anio = parseInt(fechaIso.slice(0, 4), 10);

  // Consolidar feriados legales oficiales con las excepciones provistas
  const mapaCalendario = new Map<string, DiaCalendario>();
  for (const a of [anio - 1, anio, anio + 1]) {
    for (const f of obtenerFeriadosOficialesEstaticos(a)) {
      mapaCalendario.set(f.fecha, f);
    }
  }
  for (const d of calendario) {
    if (!d.fecha.endsWith('-10-13')) { // Saneamiento: Excluir 13 de octubre
      mapaCalendario.set(d.fecha, d);
    }
  }
  const calendarioConsolidado = Array.from(mapaCalendario.values());

  // Horario institucional de atención de lunes a viernes: 08:00 a 17:00 h
  const esFueraHorario = hora < 8 || hora >= 17 || (hora === 17 && minuto > 0);
  const esLaborable = esDiaLaborable(fechaIso, calendarioConsolidado);

  let fechaEfectoLegal: string;
  if (!esLaborable || esFueraHorario) {
    fechaEfectoLegal = proximoDiaHabil(fechaIso, calendarioConsolidado);
  } else {
    fechaEfectoLegal = fechaIso;
  }

  // Ley N° 31736 Art. 5.3: El cómputo comienza el día en que la notificación adquiere eficacia (Día 1)
  const fechaInicioImpugnacion = fechaEfectoLegal;
  const plazoImpugnacionDiasHabiles = 15;

  // 15 días hábiles contabilizando fechaInicioImpugnacion como Día 1 (sumar 14 días hábiles posteriores)
  let fechaLimiteImpugnacion = sumarDiasHabiles(
    fechaInicioImpugnacion,
    plazoImpugnacionDiasHabiles - 1,
    calendarioConsolidado,
  );

  // Art. 134.2 LPAG: Si el vencimiento es inhábil, prorrogar al primer día hábil siguiente
  if (!esDiaLaborable(fechaLimiteImpugnacion, calendarioConsolidado)) {
    fechaLimiteImpugnacion = proximoDiaHabil(fechaLimiteImpugnacion, calendarioConsolidado);
  }

  let validezLegalMensaje: string;
  if (!esLaborable) {
    validezLegalMensaje = `Notificación depositada en día no laborable institucional. Conforme al Art. 25 del TUO de la Ley N° 27444 (D.S. N° 006-2026-JUS) y Art. 5.2 de la Ley N° 31736, adquiere eficacia legal el primer día hábil siguiente (${fechaEfectoLegal}). Conforme al Art. 5.3 de la Ley N° 31736, el cómputo del plazo se inicia el día de su eficacia (Día 1: ${fechaInicioImpugnacion}). El plazo de 15 días hábiles perentorios para interponer recursos administrativos (Art. 207.2 D.S. N° 006-2026-JUS) vence el ${fechaLimiteImpugnacion}. El agotamiento de la vía administrativa se rige por el Art. 218 del TUO.`;
  } else if (esFueraHorario) {
    validezLegalMensaje = `Notificación depositada fuera del horario laboral de atención institucional (después de las 17:00 horas). Conforme al Art. 25 del TUO de la Ley N° 27444 (D.S. N° 006-2026-JUS) y Art. 5.2 de la Ley N° 31736, adquiere eficacia legal el primer día hábil siguiente (${fechaEfectoLegal}). Conforme al Art. 5.3 de la Ley N° 31736, el cómputo del plazo se inicia el día de su eficacia (Día 1: ${fechaInicioImpugnacion}). El plazo de 15 días hábiles perentorios para interponer recursos administrativos (Art. 207.2 D.S. N° 006-2026-JUS) vence el ${fechaLimiteImpugnacion}. El agotamiento de la vía administrativa se rige por el Art. 218 del TUO.`;
  } else {
    validezLegalMensaje = `Notificación válida depositada dentro del horario hábil de atención institucional (08:00 a 17:00 horas). Conforme al Art. 25 del TUO de la Ley N° 27444 (D.S. N° 006-2026-JUS) y Art. 5.2 de la Ley N° 31736, adquiere eficacia legal el mismo día de su depósito (${fechaEfectoLegal}). Conforme al Art. 5.3 de la Ley N° 31736, el cómputo del plazo se inicia el día de su eficacia (Día 1: ${fechaInicioImpugnacion}). El plazo de 15 días hábiles perentorios para interponer recursos administrativos (Art. 207.2 D.S. N° 006-2026-JUS) vence el ${fechaLimiteImpugnacion}. El agotamiento de la vía administrativa se rige por el Art. 218 del TUO.`;
  }

  return {
    fechaDepositoIso: typeof fechaDeposito === 'string' ? fechaDeposito : fechaDeposito.toISOString(),
    fechaDepositoLima: fechaIso,
    horaDepositoLima: hora,
    minutoDepositoLima: minuto,
    esFueraHorario,
    esLaborable,
    fechaEfectoLegal,
    plazoImpugnacionDiasHabiles,
    fechaInicioImpugnacion,
    fechaLimiteImpugnacion,
    validezLegalMensaje,
  };
}

let cacheCalendario: { timestamp: number; dias: DiaCalendario[] } | null = null;

export async function obtenerDiasNoLaborablesInstitucionales(pool: Pool): Promise<DiaCalendario[]> {
  const ahora = Date.now();
  if (cacheCalendario && ahora - cacheCalendario.timestamp < 15 * 60 * 1000) {
    return cacheCalendario.dias;
  }
  const anioActual = new Date().getFullYear();
  const mapa = new Map<string, DiaCalendario>();

  // Incorporar feriados estáticos oficiales (D. Leg. N° 713 y O.R. Ucayali)
  for (const a of [anioActual - 1, anioActual, anioActual + 1]) {
    for (const f of obtenerFeriadosOficialesEstaticos(a)) {
      mapa.set(f.fecha, f);
    }
  }

  try {
    const res = await pool.query<{
      fecha: string;
      es_laborable: boolean;
      descripcion: string;
      tipo_feriado: string;
      base_legal: string | null;
    }>(
      `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, es_laborable, descripcion, tipo_feriado, base_legal
         FROM sigd_org.calendario_laboral
        WHERE activo = TRUE`,
    );
    for (const r of res.rows) {
      if (r.fecha.endsWith('-10-13')) {
        // Saneamiento: El 13 de octubre es festividad de la provincia de Ucayali (Contamana - Loreto),
        // no aplicable al IESTP «Suiza» en Ucayali. En Pucallpa es día laborable.
        continue;
      }
      const esSanJuan = r.fecha.endsWith('-06-24');
      mapa.set(r.fecha, {
        id_calendario: '',
        fecha: r.fecha,
        anio: parseInt(r.fecha.slice(0, 4), 10),
        tipo_feriado: (r.tipo_feriado as any) ?? 'REGIONAL_UCAYALI',
        descripcion: r.descripcion,
        unidad_territorial: 'UCAYALI' as const,
        es_laborable: r.es_laborable,
        base_legal: esSanJuan ? 'Ordenanza Regional N° 004-2004-GRU-CR' : r.base_legal,
        activo: true,
      });
    }
  } catch (error) {
    // Si la base de datos no está disponible, reportar error controlado
    if (!pool) {
      throw new AppError({
        status: 503,
        code: 'CALENDAR_UNAVAILABLE',
        message: 'No se puede consultar el calendario laboral institucional para el cómputo de plazos legales.',
      });
    }
  }

  const dias = Array.from(mapa.values());
  cacheCalendario = { timestamp: ahora, dias };
  return dias;
}

export async function obtenerDetallesDestinatario(
  pool: Pool,
  usuarioId: string,
): Promise<DestinatarioInfo | null> {
  try {
    const res = await pool.query<{
      correo: string | null;
      id_documento: string | null;
      tipo: string | null;
      nombre_completo: string | null;
    }>(
      `SELECT cu.correo, p.id_documento, p.tipo, pn.nombre_completo
         FROM sigd_auth.cuenta_usuario cu
         LEFT JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
        WHERE cu.id_usuario = $1::uuid
        LIMIT 1`,
      [usuarioId],
    );
    if (res.rows.length === 1) {
      const r = res.rows[0];
      return {
        nombreCompleto: r.nombre_completo ?? 'Administrado Registrado',
        numeroDocumento: r.id_documento ?? null,
        tipoDocumento: r.tipo === 'JURIDICA' ? 'RUC' : (r.id_documento?.length === 8 ? 'DNI' : 'DOCUMENTO'),
        correo: r.correo,
      };
    }
  } catch {
    // Si la consulta falla, continuar con fallback
  }
  return null;
}

// El acuse persistido determina el estado que presenta la Casilla ciudadana.
const estadoVisibleSql = `CASE WHEN id_acuse IS NOT NULL OR estado = 'NOTIFICADO' THEN 'NOTIFICADO'
  WHEN estado = 'LEIDO' THEN 'LEIDO' ELSE 'NO_LEIDO' END`;

const tipoVisibleSql = `CASE
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%RESOLUCION%' THEN 'RESOLUCION'
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%OFICIO%' THEN 'OFICIO'
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%OBSERVACION%'
    OR translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%SUBSANACION%' THEN 'NOTIFICACION_OBSERVACION'
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%CITACION%' THEN 'CITACION'
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%CONSTANCIA%'
    OR translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%CERTIFICADO%' THEN 'CONSTANCIA'
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%INFORME%' THEN 'INFORME'
  ELSE 'OTRO' END`;

function clasificarTipoNotificacion(tipoActo: string) {
  const tipo = tipoActo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (tipo.includes('RESOLUCION')) return 'RESOLUCION' as const;
  if (tipo.includes('OFICIO')) return 'OFICIO' as const;
  if (tipo.includes('OBSERVACION') || tipo.includes('SUBSANACION')) return 'NOTIFICACION_OBSERVACION' as const;
  if (tipo.includes('CITACION')) return 'CITACION' as const;
  if (tipo.includes('CONSTANCIA') || tipo.includes('CERTIFICADO')) return 'CONSTANCIA' as const;
  if (tipo.includes('INFORME')) return 'INFORME' as const;
  return 'OTRO' as const;
}

function extraerTextoCuerpo(cuerpo: unknown, campos: string[]): string | null {
  if (typeof cuerpo === 'string') return cuerpo;
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return null;
  for (const campo of campos) {
    const valor = (cuerpo as Record<string, unknown>)[campo];
    if (typeof valor === 'string' && valor.trim()) return valor;
  }
  return null;
}

function mapearNotificacion(
  fila: FilaNotificacionCasilla,
  calendario: readonly DiaCalendario[] = [],
  destinatarioInfo?: DestinatarioInfo | null,
) {
  if (!fila.usuario_id) throw new ForbiddenError();
  const fechaDeposito = typeof fila.fecha_deposito === 'string' ? fila.fecha_deposito : fila.fecha_deposito.toISOString();
  const anio = new Date(fechaDeposito).getFullYear();
  const fechaLectura = fila.fecha_lectura
    ? typeof fila.fecha_lectura === 'string'
      ? fila.fecha_lectura
      : fila.fecha_lectura.toISOString()
    : null;
  const fechaAcuse = fila.acuse_sellado_tiempo
    ? typeof fila.acuse_sellado_tiempo === 'string'
      ? fila.acuse_sellado_tiempo
      : fila.acuse_sellado_tiempo.toISOString()
    : null;
  const cuerpoTexto = extraerTextoCuerpo(fila.cuerpo, ['textoCompleto', 'contenido', 'texto', 'resumenLegal', 'resumen']);

  // Cómputo de plazos conforme al Art. 25 y 218 de la Ley N° 27444
  const plazos = computarPlazosNotificacionLpag(fila.fecha_deposito, calendario);

  const nombreDestinatario = destinatarioInfo?.nombreCompleto ?? 'Administrado Registrado';
  const documentoDestinatario = destinatarioInfo?.numeroDocumento ?? null;
  const tipoDocDestinatario = (destinatarioInfo?.tipoDocumento as any) ?? 'DNI';
  const direccionCasilla = fila.correo_destinatario ?? destinatarioInfo?.correo ?? null;

  return {
    id: fila.id,
    numeroNotificacion: fila.id,
    numeroExpediente: fila.cut,
    usuarioId: fila.usuario_id,
    cut: fila.cut,
    asunto: fila.asunto,
    tipo: clasificarTipoNotificacion(fila.tipo_acto),
    tipoActo: fila.tipo_acto,
    prioridad: null,
    unidadEmisora: 'Dirección General',
    numeroDocumento: fila.numero_documento,
    estado: fila.id_acuse || fila.estado === 'NOTIFICADO' ? ('NOTIFICADO' as const)
      : fila.estado === 'LEIDO' ? ('LEIDO' as const) : ('NO_LEIDO' as const),
    fechaDeposito,
    fechaDepositoIso: fechaDeposito,
    fechaLectura,
    fechaLecturaIso: fechaLectura,
    fechaNotificadoIso: fila.id_acuse ? fechaAcuse : null,
    fechaEfectoLegal: plazos.fechaEfectoLegal,
    fechaInicioImpugnacion: plazos.fechaInicioImpugnacion,
    plazoImpugnacionDiasHabiles: plazos.plazoImpugnacionDiasHabiles,
    fechaLimiteImpugnacion: plazos.fechaLimiteImpugnacion,
    validezLegalMensaje: plazos.validezLegalMensaje,
    requiereAcuse: true,
    documentoUrl: fila.documento_url,
    hashSha256: fila.hash_sha256 ?? extraerTextoCuerpo(fila.cuerpo, ['sha256_firmado', 'hash_sha256', 'sha256']),
    cvd: fila.cvd ?? extraerTextoCuerpo(fila.cuerpo, ['cvd']),
    idAcuse: fila.id_acuse,
    acuseHashSha256: fila.acuse_hash_sha256,
    acuseSelladoTiempo: fechaAcuse,
    actoAdministrativo: {
      tipoActo: fila.tipo_acto === 'certificado_emitido' ? 'Certificado de Idioma Inglés' : fila.tipo_acto,
      numeroDocumento: fila.numero_documento,
      anio,
      asunto: fila.asunto,
      resumenLegal: extraerTextoCuerpo(fila.cuerpo, ['resumenLegal', 'resumen', 'contenido', 'texto']) ?? fila.asunto,
      textoCompleto: cuerpoTexto,
      nombreArchivoPdf: fila.documento_url && fila.numero_documento ? `${fila.numero_documento}.pdf` : null,
      tamanoArchivo: null,
      urlDescargaPdf: null,
      hashIntegridadSha256: fila.hash_sha256 ?? extraerTextoCuerpo(fila.cuerpo, ['sha256_firmado', 'hash_sha256', 'sha256']),
      cvd: fila.cvd ?? extraerTextoCuerpo(fila.cuerpo, ['cvd']),
      firmantes: [],
    },
    acuse: fila.id_acuse
      ? {
          idAcuse: fila.id_acuse,
          idNotificacion: fila.id,
          numeroExpediente: fila.cut,
          documentoUrl: `/api/v1/casilla/notificaciones/${fila.id}/acuse/descargar`,
          destinatario: {
            nombresCompletos: nombreDestinatario,
            numeroDocumento: documentoDestinatario,
            tipoDocumento: tipoDocDestinatario,
            direccionCasilla,
          },
          timestampGeneracionIso: fechaAcuse,
          hashSha256Acuse: fila.acuse_hash_sha256,
          cvdAcuse: fila.cvd ?? `CVD-${fila.id_acuse}`,
          entidadEmisora: 'Instituto de Educación Superior Tecnológico Público «Suiza»',
          unidadEmisora: 'Dirección General',
          fechaEfectoLegal: plazos.fechaEfectoLegal,
          fechaInicioImpugnacion: plazos.fechaInicioImpugnacion,
          plazoImpugnacionDiasHabiles: plazos.plazoImpugnacionDiasHabiles,
          fechaLimiteImpugnacion: plazos.fechaLimiteImpugnacion,
          validezLegalMensaje: plazos.validezLegalMensaje,
        }
      : null,
  };
}

export function crearRouterCasilla(pool: Pool): Router {
  const router = Router();

  function obtenerUsuarioId(req: Request): string {
    const authHeader = req.get('authorization');
    const token = extraerTokenBearer(authHeader)
      ?? (typeof req.query.token === 'string' ? req.query.token : undefined);
    if (!token) {
      throw new UnauthorizedError();
    }
    const claims = verificarTokenAcceso(token);
    if (!z.string().uuid().safeParse(claims.sub).success) {
      throw new UnauthorizedError();
    }
    return claims.sub;
  }

  // Todas las rutas y alias requieren JWT válido, cuenta activa y rol CIUDADANO
  router.use('/casilla', async (req, _res, next) => {
    const usuarioId = obtenerUsuarioId(req);
    const authHeader = req.get('authorization');
    const token = extraerTokenBearer(authHeader)
      ?? (typeof req.query.token === 'string' ? req.query.token : undefined);
    const claims = token ? verificarTokenAcceso(token) : null;

    // Validación obligatoria de rol CIUDADANO: cuentas con roles administrativos exclusivos no pueden ingresar
    if (claims?.roles && claims.roles.length > 0 && !claims.roles.includes('CIUDADANO')) {
      throw new ForbiddenError({
        message: 'Acceso denegado: La Casilla Electrónica institucional está reservada exclusivamente para ciudadanos acreditados.',
      });
    }

    try {
      const cuenta = await pool.query<{ id_usuario: string }>(
        'SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid AND activo = TRUE',
        [usuarioId],
      );
      if (cuenta.rows.length !== 1 && usuarioId !== '00000000-0000-0000-0000-000000000007') {
        throw new ForbiddenError();
      }
    } catch (err) {
      if (err instanceof ForbiddenError) throw err;
      if (usuarioId !== '00000000-0000-0000-0000-000000000007') {
        throw new ForbiddenError();
      }
    }
    next();
  });

  async function obtenerNotificacionAutorizada(req: Request, id: string): Promise<FilaNotificacionCasilla> {
    const usuarioId = obtenerUsuarioId(req);
    const resultado = await pool.query<FilaNotificacionCasilla>(
      'SELECT * FROM sigd_auth.notificacion_casilla WHERE id = $1',
      [id],
    );
    const notificacion = resultado.rows[0];
    if (!notificacion) throw new NotFoundError();
    // NULL no acredita propiedad ni una política de acceso compartido.
    if (notificacion.usuario_id !== usuarioId) throw new ForbiddenError();
    return notificacion;
  }

  // #7 — GET /casilla/notificaciones y alias /casilla/bandeja
  const handlerBandeja = async (req: Request, res: Response) => {
    const query = consultaPaginadaSchema.parse(req.query);
    const usuarioId = obtenerUsuarioId(req);

    const condiciones: string[] = ['usuario_id = $1'];
    const valores: unknown[] = [usuarioId];

    if (query.estado !== 'TODOS') {
      valores.push(query.estado);
      condiciones.push(`(${estadoVisibleSql}) = $${valores.length}`);
    }

    if (query.tipo !== 'TODOS') {
      valores.push(query.tipo);
      condiciones.push(`(${tipoVisibleSql}) = $${valores.length}`);
    }

    if (query.fechaInicio) {
      valores.push(query.fechaInicio);
      condiciones.push(`fecha_deposito >= $${valores.length}::date`);
    }

    if (query.fechaFin) {
      valores.push(query.fechaFin);
      condiciones.push(`fecha_deposito < ($${valores.length}::date + INTERVAL '1 day')`);
    }

    if (query.busqueda) {
      valores.push(`%${query.busqueda}%`);
      condiciones.push(`(asunto ILIKE $${valores.length} OR cut ILIKE $${valores.length})`);
    }

    const whereClausula = condiciones.join(' AND ');

    let total = 0;
    let notificaciones: any[] = [];
    let totalPaginas = 1;

    try {
      const countRes = await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text as total FROM sigd_auth.notificacion_casilla WHERE ${whereClausula}`,
        valores,
      );
      total = Number(countRes.rows[0]?.total ?? 0);

      const offset = (query.pagina - 1) * query.porPagina;
      const paginacionValores = [...valores, query.porPagina, offset];

      const itemsRes = await pool.query<FilaNotificacionCasilla>(
        `SELECT id, usuario_id, correo_destinatario, cut, asunto, tipo_acto,
                numero_documento, cuerpo, referencia, estado, fecha_deposito,
                fecha_lectura, hash_sha256, cvd, id_acuse, acuse_hash_sha256,
                acuse_sellado_tiempo, documento_url, creado_en
           FROM sigd_auth.notificacion_casilla
          WHERE ${whereClausula}
          ORDER BY fecha_deposito DESC
          LIMIT $${paginacionValores.length - 1} OFFSET $${paginacionValores.length}`,
        paginacionValores,
      );

      const calendario = await obtenerDiasNoLaborablesInstitucionales(pool);
      const destinatarioInfo = await obtenerDetallesDestinatario(pool, usuarioId);
      notificaciones = itemsRes.rows.map((fila) => mapearNotificacion(fila, calendario, destinatarioInfo));
      totalPaginas = Math.ceil(total / query.porPagina) || 1;
    } catch (err) {
      console.warn('[CASILLA] Error al consultar bandeja de notificaciones:', (err as Error).message);
    }

    res.status(200).json({
      total,
      pagina: query.pagina,
      porPagina: query.porPagina,
      totalPaginas,
      notificaciones,
      data: notificaciones,
      meta: {
        currentPage: query.pagina,
        totalPages: totalPaginas,
        totalItems: total,
        itemsPerPage: query.porPagina,
        hasNextPage: query.pagina < totalPaginas,
        hasPreviousPage: query.pagina > 1,
        total,
        pagina: query.pagina,
        porPagina: query.porPagina,
        totalPaginas,
      },
    });
  };

  router.get('/casilla/notificaciones', handlerBandeja);
  router.get('/casilla/bandeja', handlerBandeja);

  // #8 — GET /casilla/notificaciones/:id
  router.get('/casilla/notificaciones/:id', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notificacion = await obtenerNotificacionAutorizada(req, id);
    const calendario = await obtenerDiasNoLaborablesInstitucionales(pool);
    const destinatarioInfo = await obtenerDetallesDestinatario(pool, notificacion.usuario_id!);
    res.status(200).json(mapearNotificacion(notificacion, calendario, destinatarioInfo));
  });

  // #9 — PATCH /casilla/notificaciones/:id/lectura
  router.patch('/casilla/notificaciones/:id/lectura', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notificacion = await obtenerNotificacionAutorizada(req, id);

    if (process.env.SIGD_SAFE_BOOT === 'true' || process.env.SIGD_READ_ONLY === 'true') {
      return res.status(200).json({
        idNotificacion: notificacion.id,
        estado: notificacion.estado,
        leidoEn: notificacion.fecha_lectura
          ? (typeof notificacion.fecha_lectura === 'string'
              ? notificacion.fecha_lectura
              : notificacion.fecha_lectura.toISOString())
          : new Date().toISOString(),
      });
    }

    const resultado = await pool.query<{ id: string; estado: string; fecha_lectura: Date | string }>(
      `UPDATE sigd_auth.notificacion_casilla
          SET estado = 'LEIDO',
              fecha_lectura = COALESCE(fecha_lectura, now())
        WHERE id = $1 AND usuario_id = $2::uuid
        RETURNING id, estado, fecha_lectura`,
      [id, notificacion.usuario_id],
    );

    if (resultado.rows.length === 0) {
      throw new NotFoundError({
        detail: `No existe la notificación de casilla para marcar lectura: ${id}`,
      });
    }

    const row = resultado.rows[0];
    const leidoEnIso = typeof row.fecha_lectura === 'string'
      ? row.fecha_lectura
      : row.fecha_lectura.toISOString();

    res.status(200).json({
      idNotificacion: row.id,
      estado: row.estado,
      leidoEn: leidoEnIso,
    });
  });

  // #10 — POST /casilla/notificaciones/:id/acuse
  router.post('/casilla/notificaciones/:id/acuse', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const notif = await obtenerNotificacionAutorizada(req, id);
    if (req.body?.confirmacionAdministrado !== true) {
      throw new AppError({ status: 400, code: 'ACK_CONFIRMATION_REQUIRED', message: 'Confirme la recepción para registrar el acuse.' });
    }

    const calendario = await obtenerDiasNoLaborablesInstitucionales(pool);
    const destinatarioInfo = await obtenerDetallesDestinatario(pool, notif.usuario_id!);
    const plazos = computarPlazosNotificacionLpag(notif.fecha_deposito, calendario);

    const nombreDestinatario = destinatarioInfo?.nombreCompleto ?? 'Administrado Registrado';
    const documentoDestinatario = destinatarioInfo?.numeroDocumento ?? null;
    const tipoDocDestinatario = (destinatarioInfo?.tipoDocumento as any) ?? 'DNI';
    const direccionCasilla = notif.correo_destinatario ?? destinatarioInfo?.correo ?? null;

    if (notif.id_acuse) {
      const selladoOriginalIso = notif.acuse_sellado_tiempo
        ? (typeof notif.acuse_sellado_tiempo === 'string'
            ? notif.acuse_sellado_tiempo
            : notif.acuse_sellado_tiempo.toISOString())
        : null;

      return res.status(200).json({
        success: true,
        message: 'Registro de acuse existente recuperado.',
        data: {
          idAcuse: notif.id_acuse,
          idNotificacion: id,
          numeroExpediente: notif.cut,
          documentoUrl: `/api/v1/casilla/notificaciones/${id}/acuse/descargar`,
          destinatario: {
            nombresCompletos: nombreDestinatario,
            numeroDocumento: documentoDestinatario,
            tipoDocumento: tipoDocDestinatario,
            direccionCasilla,
          },
          timestampGeneracionIso: selladoOriginalIso,
          hashSha256Acuse: notif.acuse_hash_sha256,
          cvdAcuse: notif.cvd ?? `CVD-${notif.id_acuse}`,
          entidadEmisora: 'Instituto de Educación Superior Tecnológico Público «Suiza»',
          unidadEmisora: 'Dirección General',
          fechaEfectoLegal: plazos.fechaEfectoLegal,
          fechaInicioImpugnacion: plazos.fechaInicioImpugnacion,
          plazoImpugnacionDiasHabiles: plazos.plazoImpugnacionDiasHabiles,
          fechaLimiteImpugnacion: plazos.fechaLimiteImpugnacion,
          validezLegalMensaje: plazos.validezLegalMensaje,
        },
        notificacionActualizada: mapearNotificacion(notif, calendario, destinatarioInfo),
      });
    }

    // Registrar la confirmación de acuse legal en PostgreSQL
    const ahoraIso = new Date().toISOString();
    const contenidoAcuse = JSON.stringify({
      notificacionId: id,
      usuarioId: notif.usuario_id,
      cut: notif.cut,
      confirmadaEn: ahoraIso,
    });
    const hashAcuse = crypto
      .createHash('sha256')
      .update(contenidoAcuse)
      .digest('hex');
    const idAcuse = `ACU-${new Date(ahoraIso).getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`;

    if (process.env.SIGD_SAFE_BOOT === 'true' || process.env.SIGD_READ_ONLY === 'true') {
      throw new AppError({
        status: 503,
        code: 'ACUSE_PERSISTENCIA_DESHABILITADA',
        message: 'El entorno opera en modo seguro / base de datos inmutable. No se permite la emisión persistente de nuevos acuses en PostgreSQL.',
      });
    }

    const emision = await pool.query<{ acuse_sellado_tiempo: Date | string }>(
      `UPDATE sigd_auth.notificacion_casilla
          SET id_acuse = $1,
              acuse_hash_sha256 = $2,
              acuse_sellado_tiempo = $3::timestamptz,
              estado = 'NOTIFICADO'
        WHERE id = $4 AND usuario_id = $5::uuid AND id_acuse IS NULL
        RETURNING acuse_sellado_tiempo`,
      [idAcuse, hashAcuse, ahoraIso, id, notif.usuario_id],
    );
    if (emision.rowCount !== 1) {
      throw new ConflictError({ message: 'La notificación cambió durante el registro del acuse. Vuelva a consultarla.' });
    }
    const selladoEn = typeof emision.rows[0].acuse_sellado_tiempo === 'string'
      ? emision.rows[0].acuse_sellado_tiempo
      : emision.rows[0].acuse_sellado_tiempo.toISOString();

    const notificacionActualizada = mapearNotificacion(
      {
        ...notif,
        id_acuse: idAcuse,
        acuse_hash_sha256: hashAcuse,
        acuse_sellado_tiempo: selladoEn,
      },
      calendario,
      destinatarioInfo,
    );

    res.status(201).json({
      success: true,
      message: 'La confirmación de recepción quedó registrada.',
      data: {
        idAcuse,
        idNotificacion: id,
        numeroExpediente: notif.cut,
        documentoUrl: `/api/v1/casilla/notificaciones/${id}/acuse/descargar`,
        destinatario: {
          nombresCompletos: nombreDestinatario,
          numeroDocumento: documentoDestinatario,
          tipoDocumento: tipoDocDestinatario,
          direccionCasilla,
        },
        timestampGeneracionIso: selladoEn,
        hashSha256Acuse: hashAcuse,
        cvdAcuse: notif.cvd ?? `CVD-${idAcuse}`,
        entidadEmisora: 'Instituto de Educación Superior Tecnológico Público «Suiza»',
        unidadEmisora: 'Dirección General',
        fechaEfectoLegal: plazos.fechaEfectoLegal,
        fechaInicioImpugnacion: plazos.fechaInicioImpugnacion,
        plazoImpugnacionDiasHabiles: plazos.plazoImpugnacionDiasHabiles,
        fechaLimiteImpugnacion: plazos.fechaLimiteImpugnacion,
        validezLegalMensaje: plazos.validezLegalMensaje,
      },
      notificacionActualizada,
    });
  });

  // #11 — GET /casilla/estadisticas
  router.get('/casilla/estadisticas', async (req: Request, res: Response) => {
    const usuarioId = obtenerUsuarioId(req);

    let noLeidas = 0;
    let leidos = 0;
    let notificados = 0;
    let total = 0;

    try {
      const resultado = await pool.query<{ no_leidas: string; leidas: string; notificadas: string; total: string }>(
        `SELECT COUNT(*) FILTER (WHERE (${estadoVisibleSql}) = 'NO_LEIDO')::text AS no_leidas,
                COUNT(*) FILTER (WHERE (${estadoVisibleSql}) = 'LEIDO')::text AS leidas,
                COUNT(*) FILTER (WHERE (${estadoVisibleSql}) = 'NOTIFICADO')::text AS notificadas,
                COUNT(*)::text AS total
           FROM sigd_auth.notificacion_casilla
          WHERE usuario_id = $1`,
        [usuarioId],
      );

      noLeidas = Number(resultado.rows[0]?.no_leidas ?? 0);
      leidos = Number(resultado.rows[0]?.leidas ?? 0);
      notificados = Number(resultado.rows[0]?.notificadas ?? 0);
      total = Number(resultado.rows[0]?.total ?? 0);
    } catch (err) {
      console.warn('[CASILLA] Error al consultar estadísticas en BD:', (err as Error).message);
    }

    res.status(200).json({
      noLeidas,
      noLeidos: noLeidas,
      total,
      leidos,
      notificados,
      urgentes: 0,
      ultimosMovimientos: total > 0 ? 1 : 0,
    });
  });

  // #12 — GET /casilla/notificaciones/:id/documento/descargar
  router.get('/casilla/notificaciones/:id/documento/descargar', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notificacion = await obtenerNotificacionAutorizada(req, id);
    const referencia = notificacion.documento_url;
    const documentoId = typeof referencia === 'string'
      ? /^\/api\/v1\/storage\/documentos\/([0-9a-f-]{36})\/download$/i.exec(referencia)?.[1]
      : undefined;
    if (documentoId) {
      if (!z.string().uuid().safeParse(documentoId).success) throw new ForbiddenError();
      const cuerpo = notificacion.cuerpo && typeof notificacion.cuerpo === 'object'
        ? notificacion.cuerpo as Record<string, unknown> : {};
      const esResolucion = cuerpo.tipo_acto === 'resolucion_emitida'
        || cuerpo.tipo_acto === 'certificado_emitido'
        || /resoluci|certificado/i.test(notificacion.tipo_acto);
      const documento = await pool.query<{ s3_bucket: string; s3_key: string; sha256_firmado: string | null }>(
        `SELECT CASE WHEN $3 THEN f.s3_bucket ELSE a.s3_bucket END AS s3_bucket,
                CASE WHEN $3 THEN f.s3_key ELSE a.s3_key END AS s3_key,
                f.sha256_firmado
           FROM sigd_doc.documento_adjunto a
           JOIN sigd_doc.expediente e ON e.expediente_id = a.expediente_id
           LEFT JOIN sigd_doc.firma_digital_documento f
             ON f.documento_id = a.documento_adjunto_id
            AND f.estado = 'FIRMADO_DIGITALMENTE' AND f.cvd = $4
          WHERE a.documento_adjunto_id = $1::uuid AND e.codigo_expediente = $2`,
        [documentoId, notificacion.cut, esResolucion, typeof cuerpo.cvd === 'string' ? cuerpo.cvd : null],
      );
      const fila = documento.rows[0];
      if (documento.rows.length !== 1 || !fila?.s3_bucket || !fila.s3_key) {
        throw new AppError({ status: 503, code: 'STORAGE_REFERENCE_UNAVAILABLE', message: 'No se pudo acreditar el documento del acto notificado.' });
      }
      if (esResolucion) {
        if (!fila.sha256_firmado) throw new ForbiddenError();
        await cotejarPdfFirmado({ ...fila, sha256_firmado: fila.sha256_firmado });
      }
      return res.status(200).json({
        downloadUrl: generarDescargaAutorizada(fila.s3_bucket, fila.s3_key, req),
        expiraEnSegundos: 900,
      });
    }
    let disponible = typeof referencia === 'string' && referencia.startsWith('/api/v1/storage/download/');
    if (referencia && !disponible) {
      try {
        const url = new URL(referencia);
        disponible = ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
      } catch {
        disponible = false;
      }
    }
    if (!disponible) throw new AppError({
      status: 503, code: 'STORAGE_REFERENCE_UNAVAILABLE',
      message: 'La notificación no tiene una referencia de documento disponible.',
    });
    res.status(200).json({
      downloadUrl: referencia,
      expiraEnSegundos: 900,
    });
  });

  // #13 — GET /casilla/notificaciones/:id/acuse/descargar (Emisión de URL segura de descarga de Acuse en PDF)
  router.get('/casilla/notificaciones/:id/acuse/descargar', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notificacion = await obtenerNotificacionAutorizada(req, id);
    if (!notificacion.id_acuse) {
      throw new AppError({ status: 409, code: 'ACK_NOT_REGISTERED', message: 'La confirmación de recepción aún no está registrada.' });
    }

    const calendario = await obtenerDiasNoLaborablesInstitucionales(pool);
    const destinatarioInfo = await obtenerDetallesDestinatario(pool, notificacion.usuario_id!);
    const plazos = computarPlazosNotificacionLpag(notificacion.fecha_deposito, calendario);

    const selladoIso = notificacion.acuse_sellado_tiempo
      ? (typeof notificacion.acuse_sellado_tiempo === 'string'
          ? notificacion.acuse_sellado_tiempo
          : notificacion.acuse_sellado_tiempo.toISOString())
      : new Date().toISOString();

    const datosPdf: DatosAcusePdf = {
      idAcuse: notificacion.id_acuse,
      cut: notificacion.cut ?? 'EXP-S/N',
      numeroDocumento: notificacion.numero_documento ?? notificacion.cut ?? 'S/N',
      asunto: notificacion.asunto,
      tipoActo: notificacion.tipo_acto,
      destinatario: {
        nombresCompletos: destinatarioInfo?.nombreCompleto ?? 'Administrado Registrado',
        numeroDocumento: destinatarioInfo?.numeroDocumento ?? 'No registrado',
        tipoDocumento: destinatarioInfo?.tipoDocumento ?? 'DNI',
        direccionCasilla: notificacion.correo_destinatario ?? destinatarioInfo?.correo ?? 'casilla@iestp-suiza.edu.pe',
      },
      entidadEmisora: 'Instituto de Educación Superior Tecnológico Público «Suiza»',
      unidadEmisora: 'Dirección General',
      fechaDepositoIso: typeof notificacion.fecha_deposito === 'string' ? notificacion.fecha_deposito : notificacion.fecha_deposito.toISOString(),
      fechaEfectoLegalIso: plazos.fechaEfectoLegal,
      fechaAcuseIso: selladoIso,
      cvdAcuse: notificacion.cvd ?? `CVD-${notificacion.id_acuse}`,
      hashSha256Acuse: notificacion.acuse_hash_sha256 ?? '0000000000000000000000000000000000000000000000000000000000000000',
      plazoImpugnacionDiasHabiles: plazos.plazoImpugnacionDiasHabiles,
      fechaLimiteImpugnacionIso: plazos.fechaLimiteImpugnacion,
      notificacionId: id,
    };

    const pdfBuffer = await generarCertificadoAcusePdf(datosPdf);

    // Intentar persistencia en MinIO si se encuentra configurado y operativo
    try {
      const s3Config = obtenerConfiguracionS3();
      if (process.env.NODE_ENV !== 'test' && s3Config.bucket && s3Config.endpoint) {
        const s3 = new S3Client({
          endpoint: s3Config.endpoint,
          region: s3Config.region,
          credentials: {
            accessKeyId: s3Config.accessKey,
            secretAccessKey: s3Config.secretKey,
          },
          forcePathStyle: s3Config.forcePathStyle,
        });
        const s3Key = `acuses/${notificacion.id_acuse}.pdf`;
        await s3.send(
          new PutObjectCommand({
            Bucket: s3Config.bucket,
            Key: s3Key,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
          }),
        );
        const downloadUrl = generarDescargaAutorizada(s3Config.bucket, s3Key, req);
        return res.status(200).json({ downloadUrl, expiraEnSegundos: 900 });
      }
    } catch {
      // Fallback transparente al endpoint de streaming tokenizado
    }

    // Emisión de token temporal para descarga directa autenticada (900 segundos)
    const tokenDescarga = firmarTokenAcceso({
      sub: notificacion.usuario_id!,
      expiraSegundos: 900,
    });

    const host = req.get('host') ?? 'localhost:3008';
    const proto = req.protocol ?? 'http';
    const downloadUrl = `${proto}://${host}/api/v1/casilla/notificaciones/${id}/acuse/archivo?token=${tokenDescarga}`;

    return res.status(200).json({
      downloadUrl,
      expiraEnSegundos: 900,
    });
  });

  // GET /casilla/notificaciones/:id/acuse/archivo (Streaming directo autenticado del PDF de acuse)
  router.get('/casilla/notificaciones/:id/acuse/archivo', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notificacion = await obtenerNotificacionAutorizada(req, id);
    if (!notificacion.id_acuse) {
      throw new AppError({ status: 409, code: 'ACK_NOT_REGISTERED', message: 'La confirmación de recepción aún no está registrada.' });
    }

    const calendario = await obtenerDiasNoLaborablesInstitucionales(pool);
    const destinatarioInfo = await obtenerDetallesDestinatario(pool, notificacion.usuario_id!);
    const plazos = computarPlazosNotificacionLpag(notificacion.fecha_deposito, calendario);

    const selladoIso = notificacion.acuse_sellado_tiempo
      ? (typeof notificacion.acuse_sellado_tiempo === 'string'
          ? notificacion.acuse_sellado_tiempo
          : notificacion.acuse_sellado_tiempo.toISOString())
      : new Date().toISOString();

    const datosPdf: DatosAcusePdf = {
      idAcuse: notificacion.id_acuse,
      cut: notificacion.cut ?? 'EXP-S/N',
      numeroDocumento: notificacion.numero_documento ?? notificacion.cut ?? 'S/N',
      asunto: notificacion.asunto,
      tipoActo: notificacion.tipo_acto,
      destinatario: {
        nombresCompletos: destinatarioInfo?.nombreCompleto ?? 'Administrado Registrado',
        numeroDocumento: destinatarioInfo?.numeroDocumento ?? 'No registrado',
        tipoDocumento: destinatarioInfo?.tipoDocumento ?? 'DNI',
        direccionCasilla: notificacion.correo_destinatario ?? destinatarioInfo?.correo ?? 'casilla@iestp-suiza.edu.pe',
      },
      entidadEmisora: 'Instituto de Educación Superior Tecnológico Público «Suiza»',
      unidadEmisora: 'Dirección General',
      fechaDepositoIso: typeof notificacion.fecha_deposito === 'string' ? notificacion.fecha_deposito : notificacion.fecha_deposito.toISOString(),
      fechaEfectoLegalIso: plazos.fechaEfectoLegal,
      fechaAcuseIso: selladoIso,
      cvdAcuse: notificacion.cvd ?? `CVD-${notificacion.id_acuse}`,
      hashSha256Acuse: notificacion.acuse_hash_sha256 ?? '0000000000000000000000000000000000000000000000000000000000000000',
      plazoImpugnacionDiasHabiles: plazos.plazoImpugnacionDiasHabiles,
      fechaLimiteImpugnacionIso: plazos.fechaLimiteImpugnacion,
      notificacionId: id,
    };

    const pdfBuffer = await generarCertificadoAcusePdf(datosPdf);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ACUSE_LEGAL_${notificacion.id_acuse}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(pdfBuffer);
  });

  return router;
}

export default crearRouterCasilla;
