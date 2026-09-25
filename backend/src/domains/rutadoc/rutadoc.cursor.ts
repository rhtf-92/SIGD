import { createHash } from 'node:crypto';
import { ValidationError } from '../../shared/domain/errors/validation-error.js';
import type { FiltrosRutaDoc, PosicionCursor } from './rutadoc.types.js';

const MAX_BIGINT = 9223372036854775807n;

export function esIdExpediente(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[1-9]\d{0,18}$/.test(valor) && BigInt(valor) <= MAX_BIGINT;
}

export function huellaFiltros(filtros: FiltrosRutaDoc): string {
  return createHash('sha256').update(JSON.stringify({
    pestana: filtros.pestana,
    terminoBusqueda: filtros.terminoBusqueda ?? null,
    areaId: filtros.areaId ?? null,
    fechaDesde: filtros.fechaDesde ?? null,
    fechaHasta: filtros.fechaHasta ?? null,
  })).digest('hex');
}

function cursorInvalido(): ValidationError {
  return new ValidationError({ invalidParams: [{ name: 'cursor', reason: 'Cursor inválido o incompatible con los filtros.' }] });
}

/** Base64url de JSON v1. No contiene credenciales ni concede visibilidad. */
export function codificarCursor(posicion: PosicionCursor, filtros: FiltrosRutaDoc): string {
  return Buffer.from(JSON.stringify({
    v: 1,
    fecha_radicacion: posicion.fechaRadicacion,
    id_expediente: posicion.idExpediente,
    filtros: huellaFiltros(filtros),
  })).toString('base64url');
}

export function decodificarCursor(valor: string, filtros: FiltrosRutaDoc): PosicionCursor {
  if (valor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(valor)) throw cursorInvalido();
  try {
    const bytes = Buffer.from(valor, 'base64url');
    if (bytes.toString('base64url') !== valor) throw cursorInvalido();
    const dato: unknown = JSON.parse(bytes.toString('utf8'));
    if (!dato || typeof dato !== 'object' || Array.isArray(dato)) throw cursorInvalido();
    const fila = dato as Record<string, unknown>;
    const fecha = fila.fecha_radicacion;
    if (fila.v !== 1 || typeof fecha !== 'string' ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(fecha) ||
        !Number.isFinite(Date.parse(fecha)) || new Date(fecha).toISOString() !== fecha ||
        !esIdExpediente(fila.id_expediente) || fila.filtros !== huellaFiltros(filtros)) {
      throw cursorInvalido();
    }
    return { fechaRadicacion: fecha, idExpediente: fila.id_expediente };
  } catch {
    throw cursorInvalido();
  }
}
