import type { Pool, QueryResultRow } from 'pg';

import { ConflictError, DomainError, NotFoundError } from '../../shared/domain/errors/index.js';

export interface AreaOrganica extends QueryResultRow {
  id: string;
  codigo: string;
  nombre: string;
  padreId: string | null;
  path: string;
  nivel: number;
  vigente: boolean;
}

export interface AreaOrganicaAnidada extends AreaOrganica {
  children: AreaOrganicaAnidada[];
}

export interface CrearUnidadDTO { codigo: string; nombre: string; padreId: string | null }
export interface ActualizarUnidadDTO { nombre?: string; padreId?: string | null; vigente?: boolean }

const PROYECCION = `area_id AS id, codigo, nombre, area_padre_id AS "padreId",
  path::text AS path, nivel, vigente`;

function traducirError(error: unknown): never {
  const postgres = error as { code?: string };
  if (postgres.code === '23505') throw new ConflictError({ message: 'Ya existe un área con el mismo código.' });
  if (postgres.code === '23503') {
    throw new DomainError({ code: 'AREA_PADRE_INVALIDA', message: 'El área padre indicada no existe.' });
  }
  throw error;
}

export class OrganigramaService {
  constructor(private readonly pool: Pool) {}

  async obtenerOrganigrama(): Promise<AreaOrganicaAnidada[]> {
    const { rows } = await this.pool.query<AreaOrganica>(
      `SELECT ${PROYECCION} FROM sigd_org.area ORDER BY path ASC`,
    );
    const mapa = new Map<string, AreaOrganicaAnidada>();
    const raices: AreaOrganicaAnidada[] = [];
    for (const area of rows) mapa.set(area.id, { ...area, children: [] });
    for (const area of rows) {
      const nodo = mapa.get(area.id)!;
      const padre = area.padreId ? mapa.get(area.padreId) : undefined;
      if (padre) padre.children.push(nodo);
      else raices.push(nodo);
    }
    return raices;
  }

  async crearUnidad(dto: CrearUnidadDTO): Promise<AreaOrganica> {
    try {
      const { rows } = await this.pool.query<AreaOrganica>(
        `INSERT INTO sigd_org.area (codigo, nombre, area_padre_id, path)
         VALUES ($1, $2, $3, 'temporal'::ltree)
         RETURNING ${PROYECCION}`,
        [dto.codigo.trim().toUpperCase(), dto.nombre.trim(), dto.padreId],
      );
      return rows[0];
    } catch (error) {
      return traducirError(error);
    }
  }

  async actualizarUnidad(id: string, dto: ActualizarUnidadDTO): Promise<AreaOrganica> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const actual = await cliente.query<{ path: string }>(
        'SELECT path::text AS path FROM sigd_org.area WHERE area_id = $1 FOR UPDATE', [id],
      );
      if (!actual.rows[0]) throw new NotFoundError({ message: 'El área indicada no existe.' });
      if (dto.padreId === id) {
        throw new DomainError({ code: 'JERARQUIA_CICLO_INVALIDO', message: 'Un área no puede depender de sí misma.' });
      }
      if (dto.padreId) {
        const ciclo = await cliente.query(
          'SELECT 1 FROM sigd_org.area WHERE area_id = $1 AND path <@ $2::ltree',
          [dto.padreId, actual.rows[0].path],
        );
        if (ciclo.rowCount) {
          throw new DomainError({
            code: 'JERARQUIA_CICLO_INVALIDO',
            message: 'Un área no puede depender de uno de sus descendientes.',
          });
        }
      }

      const valores: unknown[] = [];
      const cambios: string[] = [];
      const agregar = (valor: unknown): string => { valores.push(valor); return `$${valores.length}`; };
      if (dto.nombre !== undefined) cambios.push(`nombre = ${agregar(dto.nombre.trim())}`);
      if (dto.padreId !== undefined) cambios.push(`area_padre_id = ${agregar(dto.padreId)}`);
      if (dto.vigente !== undefined) cambios.push(`vigente = ${agregar(dto.vigente)}`);
      if (!cambios.length) {
        throw new DomainError({ code: 'DATOS_REQUERIDOS', message: 'No hay cambios para guardar.' });
      }

      valores.push(id);
      const actualizado = await cliente.query<AreaOrganica>(
        `UPDATE sigd_org.area SET ${cambios.join(', ')} WHERE area_id = $${valores.length}
         RETURNING ${PROYECCION}`,
        valores,
      );
      const area = actualizado.rows[0];
      if (!area) throw new NotFoundError({ message: 'El área indicada no existe.' });
      if (dto.padreId !== undefined && area.path !== actual.rows[0].path) {
        await cliente.query(
          `UPDATE sigd_org.area
           SET path = $2::ltree || subpath(path, nlevel($1::ltree)),
               nivel = nlevel($2::ltree || subpath(path, nlevel($1::ltree)))
           WHERE path <@ $1::ltree AND area_id <> $3`,
          [actual.rows[0].path, area.path, id],
        );
      }
      await cliente.query('COMMIT');
      return area;
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      return traducirError(error);
    } finally {
      cliente.release();
    }
  }
}
