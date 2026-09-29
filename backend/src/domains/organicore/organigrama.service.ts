import type { Pool } from 'pg';
import { DomainError } from '../../shared/domain/errors/index.js';

export interface UnidadOrganica {
  id: string;
  sigla: string;
  nombre: string;
  padre_id: string | null;
  path: string;
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

export class OrganigramaService {
  constructor(private readonly pool: Pool) {}

  async obtenerOrganigrama(): Promise<UnidadOrganicaAnidada[]> {
    const { rows } = await this.pool.query(
      'SELECT id, sigla, nombre, padre_id, path, estado FROM sigd_org.unidad_organica WHERE estado = TRUE ORDER BY path ASC'
    );

    const planas = rows as UnidadOrganica[];
    const mapa = new Map<string, UnidadOrganicaAnidada>();
    const raices: UnidadOrganicaAnidada[] = [];

    // Primera pasada: Crear nodos
    for (const nodo of planas) {
      mapa.set(nodo.id, { ...nodo, children: [] });
    }

    // Segunda pasada: Ensamblar árbol O(N)
    for (const nodo of planas) {
      const nodoAnidado = mapa.get(nodo.id)!;
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
    const query = `
      INSERT INTO sigd_org.unidad_organica (sigla, nombre, padre_id)
      VALUES ($1, $2, $3)
      RETURNING id, sigla, nombre, padre_id, path, estado
    `;
    const { rows } = await this.pool.query(query, [sigla, nombre, padre_id]);
    return rows[0];
  }

  async actualizarUnidad(id: string, dto: ActualizarUnidadDTO): Promise<UnidadOrganica> {
    const { nombre, padre_id } = dto;
    
    const setClauses: string[] = [];
    const values: any[] = [];
    
    if (nombre !== undefined) {
      values.push(nombre);
      setClauses.push(`nombre = $${values.length}`);
    }
    if (padre_id !== undefined) {
      values.push(padre_id);
      setClauses.push(`padre_id = $${values.length}`);
    }

    if (setClauses.length === 0) throw new Error('No se proporcionaron datos para actualizar');

    values.push(id);
    const query = `
      UPDATE sigd_org.unidad_organica 
      SET ${setClauses.join(', ')}, actualizado_en = now()
      WHERE id = $${values.length}
      RETURNING id, sigla, nombre, padre_id, path, estado
    `;

    try {
      const { rows } = await this.pool.query(query, values);
      if (rows.length === 0) throw new Error('Unidad orgánica no encontrada');
      return rows[0];
    } catch (error: any) {
      if (error.message?.includes('JERARQUIA_CICLO_INVALIDO')) {
        throw new DomainError({
          code: 'JERARQUIA_CICLO_INVALIDO',
          message: 'Operación rechazada: se ha detectado un ciclo jerárquico en la reubicación de la unidad orgánica.',
          detail: 'Una unidad no puede ser asignada como hija de uno de sus propios descendientes.'
        });
      }
      throw error;
    }
  }
}
