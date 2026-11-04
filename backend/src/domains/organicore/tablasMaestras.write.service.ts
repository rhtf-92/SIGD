/**
 * Servicio de escritura para Tablas Maestras institucionales (T-BE-OC-17).
 *
 * Operaciones reales sobre sigd_org.tabla_maestra:
 *   - crearRegistro(tipo, codigo, nombre, detalle)
 *   - alternarEstado(id)
 *
 * Cada operación queda registrada en la bitácora de auditoría WORM
 * (sigd_audit.bitacora_auditoria) dentro de la misma transacción, con
 * correlación X-Correlation-ID del contexto AsyncLocalStorage.
 */

import type { Pool, PoolClient } from 'pg';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';

export interface RegistroMaestraEntrada {
  tipo: 'Sedes' | 'Áreas' | 'Tipos documentales';
  codigo: string;
  nombre: string;
  detalle?: string | null;
}

export interface RegistroMaestraSalida {
  id: string;
  tipo: string;
  codigo: string;
  nombre: string;
  detalle: string | null;
  estado: string;
  creado_en: Date;
}

export interface TablaMaestraFila {
  id: string;
  tipo: string;
  codigo: string;
  nombre: string;
  detalle: string | null;
  estado: string;
  creado_en: Date;
  actualizado_en: Date;
}

export class TablasMaestrasWriteService {
  constructor(private readonly pool: Pool) {}

  /* ------------------------------------------------------------------ */
  /* Listar registros de un tipo (con borrado lógico visible)           */
  /* ------------------------------------------------------------------ */

  async listarPorTipo(
    tipo: 'Sedes' | 'Áreas' | 'Tipos documentales',
  ): Promise<TablaMaestraFila[]> {
    const resultado = await this.pool.query<TablaMaestraFila>(
      `SELECT id, tipo, codigo, nombre, detalle, estado, creado_en, actualizado_en
       FROM sigd_org.tabla_maestra
       WHERE tipo = $1
       ORDER BY creado_en DESC`,
      [tipo],
    );
    return resultado.rows;
  }

  /* ------------------------------------------------------------------ */
  /* Crear registro                                                     */
  /* ------------------------------------------------------------------ */

  async crearRegistro(
    entrada: RegistroMaestraEntrada,
  ): Promise<RegistroMaestraSalida> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const resultado = await cliente.query<RegistroMaestraSalida>(
        `INSERT INTO sigd_org.tabla_maestra (tipo, codigo, nombre, detalle, estado)
         VALUES ($1, $2, $3, $4, 'Activo')
         RETURNING id, tipo, codigo, nombre, detalle, estado, creado_en`,
        [entrada.tipo, entrada.codigo.trim().toUpperCase(), entrada.nombre.trim(), entrada.detalle ?? null],
      );

      const fila = resultado.rows[0];

      // Auditoría WORM dentro de la misma transacción
      const contexto = getRequestContext();
      await registrarMutacion(cliente, {
        esquema: 'sigd_org',
        tabla: 'tabla_maestra',
        operacion: 'INSERT',
        datos_antes: null,
        datos_despues: {
          id: fila.id,
          tipo: fila.tipo,
          codigo: fila.codigo,
          nombre: fila.nombre,
          detalle: fila.detalle,
          estado: fila.estado,
          accion: 'CREAR_REGISTRO_TABLA_MAESTRA',
          usuario_id: contexto?.usuario_id ?? null,
          ip_origen: contexto?.ip_origen ?? null,
          correlation_id: contexto?.correlation_id ?? null,
        },
      });

      await cliente.query('COMMIT');
      return fila;
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Alternar estado (Activo <-> Inactivo) — borrado lógico             */
  /* ------------------------------------------------------------------ */

  async alternarEstado(id: string): Promise<TablaMaestraFila> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      // Obtener estado actual antes de cambiar (para auditoría datos_antes)
      const antes = await cliente.query<TablaMaestraFila>(
        `SELECT id, tipo, codigo, nombre, detalle, estado, creado_en, actualizado_en
         FROM sigd_org.tabla_maestra
         WHERE id = $1::uuid`,
        [id],
      );

      if (antes.rows.length === 0) {
        throw new Error(`No existe el registro de tabla maestra con id ${id}`);
      }

      const estadoActual = antes.rows[0].estado;
      const nuevoEstado = estadoActual === 'Activo' ? 'Inactivo' : 'Activo';

      const resultado = await cliente.query<TablaMaestraFila>(
        `UPDATE sigd_org.tabla_maestra
           SET estado = $1, actualizado_en = now()
         WHERE id = $2::uuid
         RETURNING id, tipo, codigo, nombre, detalle, estado, creado_en, actualizado_en`,
        [nuevoEstado, id],
      );

      const fila = resultado.rows[0];

      // Auditoría WORM dentro de la misma transacción
      const contexto = getRequestContext();
      await registrarMutacion(cliente, {
        esquema: 'sigd_org',
        tabla: 'tabla_maestra',
        operacion: 'UPDATE',
        datos_antes: {
          id: antes.rows[0].id,
          tipo: antes.rows[0].tipo,
          codigo: antes.rows[0].codigo,
          nombre: antes.rows[0].nombre,
          detalle: antes.rows[0].detalle,
          estado: antes.rows[0].estado,
        },
        datos_despues: {
          id: fila.id,
          tipo: fila.tipo,
          codigo: fila.codigo,
          nombre: fila.nombre,
          detalle: fila.detalle,
          estado: fila.estado,
          accion: 'ALTERNAR_ESTADO_TABLA_MAESTRA',
          estado_anterior: estadoActual,
          estado_nuevo: nuevoEstado,
          usuario_id: contexto?.usuario_id ?? null,
          ip_origen: contexto?.ip_origen ?? null,
          correlation_id: contexto?.correlation_id ?? null,
        },
      });

      await cliente.query('COMMIT');
      return fila;
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
  }
}

export function crearTablasMaestrasWriteService(
  pool: Pool,
): TablasMaestrasWriteService {
  return new TablasMaestrasWriteService(pool);
}
