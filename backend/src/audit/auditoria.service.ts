import type { Pool, PoolClient } from 'pg';
import {
  registrarAcceso as repoRegistrarAcceso,
  type RegistrarAccesoParams,
} from './auditoria.repository.js';
import {
  registrarAccion as repoRegistrarAccion,
  type RegistrarAccionParams,
} from './auditoria.repository.js';
import {
  listarAuditoria,
  type FiltrosAuditoria,
  obtenerAuditoriaPorId,
  obtenerResumenAuditoria,
  type ResumenAuditoria,
  validarCadenaWorm,
  type ValidacionWorm,
} from './auditoria.repository.js';
import { getRequestContext } from '../shared/request-context/request-context.js';

/* -------------------------------------------------------------------------- */
/* Servicio de Auditoría Forense                                              */
/* -------------------------------------------------------------------------- */

/**
 * Capa de servicio del módulo Logs de Auditoría. Expone operaciones reales
 * (no mocks) sobre la bitácora WORM `sigd_audit.bitacora_auditoria`:
 *
 * 1. registrarAcceso   -> registra accesos (login, lectura, intento fallido, denegado)
 * 2. registrarAccion   -> registra acciones de negocio (crear, derivar, archivar, firmar)
 * 3. listarAuditoria   -> consulta paginada con filtros
 * 4. obtenerResumen    -> estadísticas para tarjetas resumen
 * 5. validarWorm       -> verifica integridad criptográfica de la cadena
 */
export class AuditoriaService {
  constructor(private readonly pool: Pool) {}

  /* ------------------------------------------------------------------ */
  /* Escritura: acceso                                                    */
  /* ------------------------------------------------------------------ */

  async registrarAcceso(params: RegistrarAccesoParams): Promise<string> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const id = await repoRegistrarAcceso(cliente, params);
      await cliente.query('COMMIT');
      return id;
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Escritura: acción de negocio                                       */
  /* ------------------------------------------------------------------ */

  async registrarAccion(params: RegistrarAccionParams): Promise<string> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const id = await repoRegistrarAccion(cliente, params);
      await cliente.query('COMMIT');
      return id;
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
  }

  /**
   * Registra una acción de negocio dentro de una transacción ya abierta
   * (útil para acoplar la auditoría al commit de una mutación de negocio).
   */
  async registrarAccionEnTransaccion(
    cliente: PoolClient,
    params: RegistrarAccionParams,
  ): Promise<string> {
    return repoRegistrarAccion(cliente, params);
  }

  /**
   * Registra un acceso dentro de una transacción ya abierta.
   */
  async registrarAccesoEnTransaccion(
    cliente: PoolClient,
    params: RegistrarAccesoParams,
  ): Promise<string> {
    return repoRegistrarAcceso(cliente, params);
  }

  /* ------------------------------------------------------------------ */
  /* Lectura: listado                                                   */
  /* ------------------------------------------------------------------ */

  async listar(filtros: FiltrosAuditoria) {
    const cliente = await this.pool.connect();
    try {
      return await listarAuditoria(cliente, filtros);
    } finally {
      cliente.release();
    }
  }

  async obtenerPorId(idAuditoria: string) {
    const cliente = await this.pool.connect();
    try {
      return await obtenerAuditoriaPorId(cliente, idAuditoria);
    } finally {
      cliente.release();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Lectura: resumen                                                   */
  /* ------------------------------------------------------------------ */

  async resumen(
    filtros: Pick<FiltrosAuditoria, 'fecha_desde' | 'fecha_hasta' | 'usuario_id'> = {},
  ): Promise<ResumenAuditoria> {
    const cliente = await this.pool.connect();
    try {
      return await obtenerResumenAuditoria(cliente, filtros);
    } finally {
      cliente.release();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Lectura: validación WORM                                           */
  /* ------------------------------------------------------------------ */

  async validarIntegridadWorm(): Promise<ValidacionWorm> {
    const cliente = await this.pool.connect();
    try {
      return await validarCadenaWorm(cliente);
    } finally {
      cliente.release();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers de contexto                                                */
  /* ------------------------------------------------------------------ */

  /** Devuelve el correlation_id de la petición actual (si hay una activa). */
  obtenerCorrelationId(): string | null {
    const contexto = getRequestContext();
    return contexto?.correlation_id ?? null;
  }

  /** Devuelve el usuario_id de la petición actual (si hay una activa). */
  obtenerUsuarioId(): string | null {
    const contexto = getRequestContext();
    return contexto?.usuario_id ?? null;
  }
}

export type { FiltrosAuditoria, RegistrarAccesoParams, RegistrarAccionParams };
