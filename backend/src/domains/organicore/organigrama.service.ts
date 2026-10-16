/**
 * Organigrama institucional de OrganiCore.
 *
 * TABLA REAL: `sigd_org.area`. No existe `sigd_org.unidad_organica`: el modelo
 * aprobado en la migración 03_sigd_org.sql modela las unidades orgánicas como
 * nodos de un árbol `ltree`, donde:
 *
 *   unidad_organica.id        -> area.area_id
 *   unidad_organica.sigla     -> area.codigo
 *   unidad_organica.nombre    -> area.nombre
 *   unidad_organica.padre_id  -> area.area_padre_id
 *   unidad_organica.path      -> area.path        (ltree)
 *   unidad_organica.estado    -> area.vigente
 *
 * `path` y `nivel` NUNCA se escriben desde la aplicación: los calcula el trigger
 * `tr_area_set_path` a partir de `area_padre_id` y `codigo`, de modo que no
 * puede existir una ruta huérfana ni desalineada con la jerarquía real.
 * `sigd_org.area` tampoco tiene columna `actualizado_en`, por lo que el alta y la
 * actualización se fecha con `creado_en` y con la bitácora WORM, no con la fila.
 */

import type { Pool } from 'pg';
import { DomainError } from '../../shared/domain/errors/index.js';

export interface UnidadOrganica {
  id: string;
  sigla: string;
  nombre: string;
  padre_id: string | null;
  path: string;
  nivel: number;
  estado: boolean;
}

export interface UnidadOrganicaAnidada extends UnidadOrganica {
  children: UnidadOrganicaAnidada[];
}

export interface CrearUnidadDTO {
  sigla: string;
  nombre: string;
  padre_id: string | null;
}

export interface ActualizarUnidadDTO {
  nombre?: string;
  padre_id?: string | null;
}

const SELECCION = `
  SELECT area_id::text        AS id,
         codigo               AS sigla,
         nombre,
         area_padre_id::text  AS padre_id,
         path::text           AS path,
         nivel,
         vigente              AS estado
    FROM sigd_org.area`;

export class OrganigramaService {
  constructor(private readonly pool: Pool) {}

  async obtenerOrganigrama(): Promise<UnidadOrganicaAnidada[]> {
    const { rows } = await this.pool.query<UnidadOrganica>(
      `${SELECCION} WHERE vigente = TRUE ORDER BY path ASC`,
    );

    const planas = rows;
    const mapa = new Map<string, UnidadOrganicaAnidada>();
    const raices: UnidadOrganicaAnidada[] = [];

    // Primera pasada: crear los nodos.
    for (const nodo of planas) {
      mapa.set(nodo.id, { ...nodo, children: [] });
    }

    // Segunda pasada: ensamblar el árbol en O(N) usando `path` como orden natural.
    for (const nodo of planas) {
      const nodoAnidado = mapa.get(nodo.id);
      if (!nodoAnidado) continue;
      if (nodo.padre_id && mapa.has(nodo.padre_id)) {
        mapa.get(nodo.padre_id)!.children.push(nodoAnidado);
      } else {
        raices.push(nodoAnidado);
      }
    }

    return raices;
  }

  async crearUnidad(dto: CrearUnidadDTO): Promise<UnidadOrganica> {
    const { sigla, nombre, padre_id } = dto;
    try {
      const { rows } = await this.pool.query<UnidadOrganica>(
        `INSERT INTO sigd_org.area (codigo, nombre, area_padre_id)
         VALUES ($1, $2, $3::uuid)
         RETURNING area_id::text AS id,
                   codigo AS sigla,
                   nombre,
                   area_padre_id::text AS padre_id,
                   path::text AS path,
                   nivel,
                   vigente AS estado`,
        [sigla, nombre, padre_id],
      );
      return rows[0];
    } catch (error: unknown) {
      throw this.traducirErrorOrganigrama(error);
    }
  }

  async actualizarUnidad(id: string, dto: ActualizarUnidadDTO): Promise<UnidadOrganica> {
    const { nombre, padre_id } = dto;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (nombre !== undefined) {
      values.push(nombre);
      setClauses.push(`nombre = $${values.length}`);
    }
    if (padre_id !== undefined) {
      values.push(padre_id);
      setClauses.push(`area_padre_id = $${values.length}::uuid`);
    }

    if (setClauses.length === 0) {
      throw new DomainError({
        code: 'ACTUALIZACION_SIN_CAMBIOS',
        message: 'No se proporcionaron datos para actualizar la unidad orgánica.',
      });
    }

    // `tr_area_set_path` no detecta ciclos: si `area_padre_id` apuntara a un
    // descendiente de la propia unidad, el árbol quedaría circular. Se rechaza
    // antes de escribir, comparando el `ltree` del padre candidato contra el
    // subárbol de la unidad que se reubica.
    if (padre_id !== undefined && padre_id !== null) {
      const yaEsDescendiente = await this.padreEsDescendiente(id, padre_id);
      if (yaEsDescendiente) {
        throw this.errorCiclo();
      }
    }

    values.push(id);
    try {
      const { rows } = await this.pool.query<UnidadOrganica>(
        `UPDATE sigd_org.area
            SET ${setClauses.join(', ')}
          WHERE area_id = $${values.length}::uuid
         RETURNING area_id::text AS id,
                   codigo AS sigla,
                   nombre,
                   area_padre_id::text AS padre_id,
                   path::text AS path,
                   nivel,
                   vigente AS estado`,
        values,
      );
      if (rows.length === 0) {
        throw new DomainError({
          code: 'UNIDAD_ORGANICA_NO_ENCONTRADA',
          message: 'La unidad orgánica indicada no existe.',
        });
      }
      return rows[0];
    } catch (error: unknown) {
      throw this.traducirErrorOrganigrama(error);
    }
  }

  /**
   * ¿El candidato `candidatoId` es la propia unidad o uno de sus descendientes?
   * Se resuelve en SQL con el operador `@>` de ltree sobre el `path` materializado.
   */
  private async padreEsDescendiente(unidadId: string, candidatoId: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ es_descendiente: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM sigd_org.area hijo
           JOIN sigd_org.area padre ON padre.area_id = $2::uuid
          WHERE hijo.area_id = $1::uuid
            AND hijo.path @> padre.path
       ) AS es_descendiente`,
      [unidadId, candidatoId],
    );
    return rows[0]?.es_descendiente === true;
  }

  private errorCiclo(): DomainError {
    return new DomainError({
      code: 'JERARQUIA_CICLO_INVALIDO',
      message: 'Operación rechazada: se ha detectado un ciclo jerárquico en la reubicación de la unidad orgánica.',
      detail: 'Una unidad no puede ser asignada como hija de uno de sus propios descendientes.',
    });
  }

  /** Traduce errores de PostgreSQL a errores de dominio del módulo. */
  private traducirErrorOrganigrama(error: unknown): unknown {
    const codigo = (error as { code?: string }).code;
    const mensaje = (error as { message?: string }).message ?? '';

    if (codigo === '23503' || /area padre.*no existe/i.test(mensaje)) {
      return new DomainError({
        code: 'PADRE_INVALIDO',
        message: 'El área padre indicada no existe o no está vigente.',
        detail: mensaje,
      });
    }
    if (codigo === '23505') {
      return new DomainError({
        code: 'UNIDAD_ORGANICA_DUPLICADA',
        message: 'Ya existe una unidad orgánica con ese código o esa ruta.',
        detail: mensaje,
      });
    }
    return error;
  }
}