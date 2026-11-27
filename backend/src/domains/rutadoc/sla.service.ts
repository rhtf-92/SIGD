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
  if (actualMs < inicioMs) throw new RangeError('La fecha de cálculo no puede preceder al inicio.');
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
interface FechaExpedienteActivo { fecha_inicio: string }

function fechaHoyLima(): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

export class RepositorioSlaRutaDoc {
  constructor(private readonly pool: Pool) {}

  async obtenerFechaInicio(idExpediente: string): Promise<string | null> {
    const resultado = await this.pool.query<FilaFechaExpediente>(`
      SELECT (fecha_radicacion AT TIME ZONE 'America/Lima')::date::text AS fecha_inicio
        FROM sigd_tra.expediente
       WHERE expediente_id = $1::uuid`, [idExpediente]);
    return resultado.rows[0]?.fecha_inicio ?? null;
  }

  async listarFechasActivas(areaId?: string | null): Promise<FechaExpedienteActivo[]> {
    const resultado = await this.pool.query<FechaExpedienteActivo>(`
      SELECT (e.fecha_radicacion AT TIME ZONE 'America/Lima')::date::text AS fecha_inicio
        FROM sigd_tra.expediente e
        LEFT JOIN sigd_rut.estado_actual_expediente actual
          ON actual.expediente_id = e.expediente_id
       WHERE ($1::uuid IS NULL OR COALESCE(actual.area_actual_id, e.area_destino_id) = $1::uuid)
         AND COALESCE(actual.estado_nuevo, 'REGISTRADO') NOT IN ('RESUELTO', 'ARCHIVADO')`,
    [areaId ?? null]);
    return resultado.rows;
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
    const fechaInicio = await this.fechaInicio(idExpediente);
    if (!fechaInicio) throw new NotFoundError({ detail: 'El expediente no existe.' });
    const fechaActual = this.hoy();
    const hasta = new Date(validarFecha(fechaInicio) + 150 * MS_DIA).toISOString().slice(0, 10);
    const diasNoLaborables = await this.calendario.obtenerDiasNoLaborables(fechaInicio,
      fechaActual > hasta ? fechaActual : hasta);
    return calcularSla({ fechaInicio, fechaActual, diasNoLaborables: new Set(diasNoLaborables),
      diasHabilesLimite: 30,
      porcentajeAmarilloDesde: this.politica.porcentajeAmarilloDesde });
  }

  async obtenerIndicadores(areaId?: string | null) {
    const filas = await this.repositorio.listarFechasActivas(areaId);
    if (filas.length === 0) return { volumenActivo: 0, urgentes: 0, proximosAVencer: 0 };

    const fechaActual = this.hoy();
    const inicioMasAntiguo = filas.reduce((anterior, fila) =>
      fila.fecha_inicio < anterior ? fila.fecha_inicio : anterior, filas[0].fecha_inicio);
    const hasta = new Date(validarFecha(fechaActual) + 150 * MS_DIA).toISOString().slice(0, 10);
    const diasNoLaborables = new Set(await this.calendario.obtenerDiasNoLaborables(
      inicioMasAntiguo,
      fechaActual > hasta ? fechaActual : hasta,
    ));
    let urgentes = 0;
    let proximosAVencer = 0;
    for (const fila of filas) {
      const resultado = calcularSla({
        fechaInicio: fila.fecha_inicio,
        fechaActual,
        diasNoLaborables,
        diasHabilesLimite: 30,
        porcentajeAmarilloDesde: this.politica.porcentajeAmarilloDesde,
      });
      if (resultado.diasHabilesRestantes <= 4) urgentes++;
      else if (resultado.estado === 'AMARILLO') proximosAVencer++;
    }
    return { volumenActivo: filas.length, urgentes, proximosAVencer };
  }
}
