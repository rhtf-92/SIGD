/**
 * ==============================================================================
 * Auditoría del Asistente Virtual (AsistenteCore)
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * ==============================================================================
 * Descripción:
 * Implementación por defecto del puerto `AsistenteAuditPort` sobre la bitácora
 * WORM `sigd_audit.bitacora_auditoria`. Conforme a la Ley N° 29733 (LPDP), jamás
 * no se almacena el texto plano de la consulta. El hash SHA-256 sin sal es
 * determinístico y puede ser vulnerable a ataques de diccionario; por eso el
 * registro es seudonimizado, no anónimo. Además se vincula con metadatos de
 * solicitud (usuario, IP y agente de usuario) de la bitácora general.
 *
 * La tabla WORM no tiene expiración automática ni borrado desde esta aplicación.
 * La retención debe regirse por la política institucional de auditoría y privacidad.
 */

import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import type { AsistenteAuditPort, RegistroConsultaAsistente } from './asistente.types.js';

export function hashSha256(texto: string): string {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

/** Puerto sin persistencia, útil en pruebas y en modo solo-desarrollo. */
export class AuditAsistenteNoOp implements AsistenteAuditPort {
  readonly registros: RegistroConsultaAsistente[] = [];

  async registrarConsulta(registro: RegistroConsultaAsistente): Promise<void> {
    this.registros.push(registro);
  }
}

/** Persistencia seudonimizada en la bitácora forense WORM del SIGD. */
export class AuditAsistentePg implements AsistenteAuditPort {
  constructor(private readonly pool: Pool) {}

  async registrarConsulta(registro: RegistroConsultaAsistente): Promise<void> {
    const cliente: PoolClient = await this.pool.connect();
    try {
      const contexto = getRequestContext();
      await cliente.query(
        `INSERT INTO sigd_audit.bitacora_auditoria
           (correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_antes, datos_despues)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          contexto?.correlation_id ?? null,
          contexto?.usuario_id ?? null,
          contexto?.ip_origen ?? null,
          contexto?.user_agent ?? null,
          'sigd_asistente',
          'consulta_asistente',
          'INSERT',
          null,
          JSON.stringify(registro),
        ],
      );
    } finally {
      cliente.release();
    }
  }
}
