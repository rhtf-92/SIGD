import { NotFoundError } from '../../shared/domain/errors/not-found-error.js';
import type { Pool } from 'pg';
import type { CalendarioLaboralPort, EntradaSla, ResultadoSla } from './sla.types.js';
import { calendarioLaboralPredeterminadoRutaDoc } from './sla.calendario.js';

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 86_400_000;

function validarFecha(fecha: string): number {
  if (!ISO_DIA.test(fecha)) throw new RangeError(`Fecha civil inválida: ${fecha}`);
  const ms = Date.parse(`${fecha}T00:00:00.000Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== fecha) {
    throw new RangeError(`Fecha civil inválida: ${fecha}`);
  }
  return ms;
}

function sumarDiasHabiles(fechaInicio: string, cantidad: number, noLaborables: ReadonlySet<string>): string {
  let fechaMs = validarFecha(fechaInicio);
  let contados = 0;
  while (contados < cantidad) {
    fechaMs += MS_DIA;
    const iso = new Date(fechaMs).toISOString().slice(0, 10);
    const diaSemana = new Date(fechaMs).getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6 && !noLaborables.has(iso)) contados++;
  }
  return new Date(fechaMs).toISOString().slice(0, 10);
}

/** Cómputo puro: fechas civiles UTC; el día inicial no consume plazo. */
export function calcularSla(entrada: EntradaSla): ResultadoSla {
  const inicioMs = validarFecha(entrada.fechaInicio);
  const actualMs = validarFecha(entrada.fechaActual);
  // La radicación fuera de horario puede comenzar legalmente el siguiente día hábil.
  // Hasta ese inicio, el plazo permanece en cero sin invalidar la consulta.
  const limite = entrada.diasHabilesLimite ?? 30;
  const umbralAmarillo = entrada.porcentajeAmarilloDesde ?? 80;
  if (!Number.isInteger(limite) || limite <= 0) throw new RangeError('El límite debe ser entero positivo.');
  if (!Number.isFinite(umbralAmarillo) || umbralAmarillo < 0 || umbralAmarillo > 100) {
    throw new RangeError('El umbral amarillo debe estar entre 0 y 100.');
  }

  const noLaborables = entrada.diasNoLaborables ?? new Set<string>();
  let transcurridos = 0;
  for (let fechaMs = inicioMs + MS_DIA; fechaMs <= actualMs; fechaMs += MS_DIA) {
    const fecha = new Date(fechaMs);
    const iso = fecha.toISOString().slice(0, 10);
    const semana = fecha.getUTCDay();
    if (semana !== 0 && semana !== 6 && !noLaborables.has(iso)) transcurridos++;
  }

  const porcentaje = Math.round((transcurridos / limite) * 10000) / 100;
  const estado = transcurridos > limite ? 'ROJO' : porcentaje >= umbralAmarillo ? 'AMARILLO' : 'VERDE';
  return {
    fechaInicio: entrada.fechaInicio,
    fechaCalculo: entrada.fechaActual,
    fechaLimite: sumarDiasHabiles(entrada.fechaInicio, limite, noLaborables),
    diasHabilesLimite: limite,
    diasHabilesTranscurridos: transcurridos,
    diasHabilesRestantes: Math.max(0, limite - transcurridos),
    porcentaje,
    estado,
  };
}

interface FilaFechaExpediente { fecha_inicio: string }

function fechaHoyLima(): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

export interface DatosSlaExpediente {
  fechaInicio: string | null;
  plazoDias: number;
}

export class RepositorioSlaRutaDoc {
  constructor(private readonly pool: Pool) {}

  async obtenerDatosExpediente(idExpediente: string): Promise<DatosSlaExpediente | null> {
    const resultado = await this.pool.query<{
      fecha_inicio: string | null;
      plazo_dias: number | null;
    }>(`
      SELECT (e.fecha_radicacion AT TIME ZONE 'America/Lima')::date::text AS fecha_inicio,
             COALESCE(tp.plazo_dias, 30)::int AS plazo_dias
        FROM sigd_tra.expediente e
   LEFT JOIN sigd_doc.expediente_tupa_vinculo v ON v.expediente_id = e.expediente_id AND v.reemplaza_vinculo_id IS NULL
   LEFT JOIN LATERAL (
     SELECT p.plazo_dias
       FROM sigd_doc.tupa_procedimiento p
       JOIN sigd_doc.tupa_version tv2 ON tv2.id_version = p.id_version
      WHERE (
        (v.tupa_codigo IS NOT NULL AND tv2.codigo = v.tupa_codigo AND (p.codigo_ref = v.codigo_ref OR p.registro_version_id = v.registro_version_id))
        OR (v.tupa_codigo IS NULL AND p.registro_version_id = v.registro_version_id)
      )
      ORDER BY p.activo DESC, p.orden ASC
      LIMIT 1
   ) tp ON TRUE
       WHERE e.expediente_id = $1::uuid
       ORDER BY v.vinculado_en DESC NULLS LAST
       LIMIT 1`, [idExpediente]);
    if (resultado.rows.length === 0) return null;
    return {
      fechaInicio: resultado.rows[0].fecha_inicio,
      plazoDias: resultado.rows[0].plazo_dias ?? 30,
    };
  }

  async obtenerFechaInicio(idExpediente: string): Promise<string | null> {
    const datos = await this.obtenerDatosExpediente(idExpediente);
    return datos?.fechaInicio ?? null;
  }
}

export class ServicioSlaRutaDoc {
  constructor(private readonly repositorio: RepositorioSlaRutaDoc,
    private readonly calendario: CalendarioLaboralPort = calendarioLaboralPredeterminadoRutaDoc,
    private readonly hoy: () => string = fechaHoyLima,
    private readonly politica: { porcentajeAmarilloDesde: number } = { porcentajeAmarilloDesde: 80 }) {}

  fechaInicio(idExpediente: string): Promise<string | null> {
    return this.repositorio.obtenerFechaInicio(idExpediente);
  }

  async obtener(idExpediente: string): Promise<ResultadoSla> {
    const repoAny = this.repositorio as {
      obtenerDatosExpediente?: (id: string) => Promise<DatosSlaExpediente | null>;
      obtenerFechaInicio: (id: string) => Promise<string | null>;
    };
    const datos = typeof repoAny.obtenerDatosExpediente === 'function'
      ? await repoAny.obtenerDatosExpediente(idExpediente)
      : null;
    const fechaInicio = datos ? datos.fechaInicio : await this.fechaInicio(idExpediente);
    if (!fechaInicio) throw new NotFoundError({ detail: 'El expediente no existe.' });
    const limitePlazo = datos?.plazoDias && datos.plazoDias > 0 ? datos.plazoDias : 30;
    const fechaActual = this.hoy();
    const hasta = new Date(validarFecha(fechaInicio) + 150 * MS_DIA).toISOString().slice(0, 10);
    const diasNoLaborables = await this.calendario.obtenerDiasNoLaborables(fechaInicio,
      fechaActual > hasta ? fechaActual : hasta);
    return calcularSla({ fechaInicio, fechaActual, diasNoLaborables: new Set(diasNoLaborables),
      diasHabilesLimite: limitePlazo,
      porcentajeAmarilloDesde: this.politica.porcentajeAmarilloDesde });
  }
}
