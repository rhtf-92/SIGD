import type { Pool, PoolClient } from 'pg';
import crypto from 'node:crypto';
import { AppError } from '../../shared/domain/errors/index.js';
import {
  TransaccionalTokenService,
  type TokenTransaccionalInput,
} from '../../core/auth/transaccional-token.service.js';

export interface ResultadoAutorizacionSuplencia {
  autorizado: boolean;
  usuarioSuplenteId?: string;
  titularUsuarioId?: string;
  cargoId?: string;
  areaDespachoId?: string;
  institucionId?: string;
  documentoSustentoTipo?: string;
  documentoSustentoNum?: string;
  correlationId?: string;
}

export interface InputRectificarEncargatura {
  encargaturaId: string;
  campo: string;
  valorAnterior?: string | null;
  valorNuevo: string;
  documentoSustentoTipo: string;
  documentoSustentoNum: string;
  justificacion: string;
  actorUsuarioId: string;
  institucionId: string;
  correlationId: string;
}

export interface InputRevocarPermiso {
  encargaturaId: string;
  permisoId: string;
  motivo: string;
  actorUsuarioId: string;
  institucionId: string;
  correlationId: string;
}

export interface InputAsignarPermiso {
  encargaturaId: string;
  permisoId: string;
  actorUsuarioId: string;
  institucionId: string;
  correlationId: string;
}

/**
 * Servicio de Negocio de Encargaturas, Suplencias y Rectificaciones Institucionales
 * Implementa el protocolo transaccional determinista con reintentos controlados para 40P01/40001 (TSK-1.2-M).
 */
export class EncargaturaService {
  constructor(
    private readonly pool: Pool,
    private readonly kidActivo: string = process.env.SIGD_CRYPTO_KID ?? 'sigd_k2026_primary_a1b2',
    private readonly secretoTransaccional: string = process.env.SIGD_CRYPTO_SECRET ?? 'sigd_secret_demo_master_key_2026_suiza_ucayali',
  ) {}

  /**
   * Ejecutor con política de reintentos para 40P01 (Deadlock) y 40001 (Serialization Failure)
   */
  private async ejecutarConReintentos<T>(
    operacion: (cliente: PoolClient) => Promise<T>,
    maxIntentos: number = 3,
  ): Promise<T> {
    let intento = 0;
    for (;;) {
      intento += 1;
      const cliente = await this.pool.connect();
      try {
        const resultado = await operacion(cliente);
        return resultado;
      } catch (error: any) {
        const esReintentable = error?.code === '40P01' || error?.code === '40001';
        if (esReintentable && intento < maxIntentos) {
          const esperaMs = Math.floor(Math.random() * (Math.min(200, 50 * Math.pow(2, intento)) - 50 + 1)) + 50;
          await new Promise((resolve) => setTimeout(resolve, esperaMs));
          continue;
        }
        throw error;
      } finally {
        cliente.release();
      }
    }
  }

  /**
   * Adquiere la autorización efectiva de suplencia invocando fn_adquirir_autorizacion_suplencia
   */
  async adquirirAutorizacionSuplencia(params: {
    encargaturaId: string;
    codigoPermiso: string;
    tipoDocumento?: string | null;
    usuarioId: string;
    institucionId: string;
    correlationId: string;
  }): Promise<ResultadoAutorizacionSuplencia> {
    const contentHash = TransaccionalTokenService.calcularContentHashSuplencia({
      encargaturaId: params.encargaturaId,
      codigoPermiso: params.codigoPermiso,
      tipoDocumento: params.tipoDocumento,
    });

    const tokenInput: TokenTransaccionalInput = {
      kid: this.kidActivo,
      userId: params.usuarioId,
      op: 'AUTORIZAR_SUPLENCIA',
      targetId: params.encargaturaId,
      subTargetId: params.codigoPermiso,
      contentHash,
      institucionId: params.institucionId,
      correlationId: params.correlationId,
      ventanaSegundos: 30,
    };

    const authToken = TransaccionalTokenService.generarToken(tokenInput, this.secretoTransaccional);

    return this.ejecutarConReintentos(async (cliente) => {
      const res = await cliente.query<{
        autorizado: boolean;
        usuario_suplente_id: string;
        titular_usuario_id: string;
        cargo_id: string;
        area_despacho_id: string;
        institucion_id: string;
        documento_sustento_tipo: string;
        documento_sustento_num: string;
        correlation_id: string;
      }>(
        `SELECT autorizado, usuario_suplente_id, titular_usuario_id, cargo_id,
                area_despacho_id, institucion_id, documento_sustento_tipo,
                documento_sustento_num, correlation_id
           FROM sigd_org.fn_adquirir_autorizacion_suplencia($1, $2, $3, $4)`,
        [authToken, params.encargaturaId, params.codigoPermiso, params.tipoDocumento ?? null],
      );

      if (res.rowCount === 0 || !res.rows[0]?.autorizado) {
        return { autorizado: false };
      }

      const fila = res.rows[0];
      return {
        autorizado: true,
        usuarioSuplenteId: fila.usuario_suplente_id,
        titularUsuarioId: fila.titular_usuario_id,
        cargoId: fila.cargo_id,
        areaDespachoId: fila.area_despacho_id,
        institucionId: fila.institucion_id,
        documentoSustentoTipo: fila.documento_sustento_tipo,
        documentoSustentoNum: fila.documento_sustento_num,
        correlationId: fila.correlation_id,
      };
    });
  }

  /**
   * Ejecuta la rectificación administrativa de encargatura
   */
  async rectificarEncargatura(input: InputRectificarEncargatura): Promise<any> {
    const contentHash = TransaccionalTokenService.calcularContentHashRectificar({
      encargaturaId: input.encargaturaId,
      campo: input.campo,
      valorAnterior: input.valorAnterior,
      valorNuevo: input.valorNuevo,
      documentoSustentoTipo: input.documentoSustentoTipo,
      documentoSustentoNumero: input.documentoSustentoNum,
      justificacion: input.justificacion,
    });

    const tokenInput: TokenTransaccionalInput = {
      kid: this.kidActivo,
      userId: input.actorUsuarioId,
      op: 'RECTIFICAR_ENCARGATURA',
      targetId: input.encargaturaId,
      subTargetId: input.campo,
      contentHash,
      institucionId: input.institucionId,
      correlationId: input.correlationId,
      ventanaSegundos: 45,
    };

    const authToken = TransaccionalTokenService.generarToken(tokenInput, this.secretoTransaccional);

    return this.ejecutarConReintentos(async (cliente) => {
      const res = await cliente.query<{ fn_rectificar_encargatura: any }>(
        `SELECT sigd_org.fn_rectificar_encargatura($1, $2, $3, $4, $5, $6, $7, $8) AS fn_rectificar_encargatura`,
        [
          authToken,
          input.encargaturaId,
          input.campo,
          input.valorAnterior ?? null,
          input.valorNuevo,
          input.documentoSustentoTipo,
          input.documentoSustentoNum,
          input.justificacion,
        ],
      );
      return res.rows[0]?.fn_rectificar_encargatura;
    });
  }

  /**
   * Ejecuta la revocación formal de un permiso delegado
   */
  async revocarPermisoEncargatura(input: InputRevocarPermiso): Promise<any> {
    const contentHash = TransaccionalTokenService.calcularContentHashRevocar({
      encargaturaId: input.encargaturaId,
      permisoId: input.permisoId,
      motivo: input.motivo,
    });

    const tokenInput: TokenTransaccionalInput = {
      kid: this.kidActivo,
      userId: input.actorUsuarioId,
      op: 'REVOCAR_PERMISO',
      targetId: input.encargaturaId,
      subTargetId: input.permisoId,
      contentHash,
      institucionId: input.institucionId,
      correlationId: input.correlationId,
      ventanaSegundos: 45,
    };

    const authToken = TransaccionalTokenService.generarToken(tokenInput, this.secretoTransaccional);

    return this.ejecutarConReintentos(async (cliente) => {
      const res = await cliente.query<{ fn_revocar_permiso_encargatura: any }>(
        `SELECT sigd_org.fn_revocar_permiso_encargatura($1, $2, $3, $4) AS fn_revocar_permiso_encargatura`,
        [authToken, input.encargaturaId, input.permisoId, input.motivo],
      );
      return res.rows[0]?.fn_revocar_permiso_encargatura;
    });
  }

  /**
   * Asigna un permiso a una encargatura vigente
   */
  async asignarPermisoEncargatura(input: InputAsignarPermiso): Promise<any> {
    const contentHash = TransaccionalTokenService.calcularContentHashAsignar({
      encargaturaId: input.encargaturaId,
      permisoId: input.permisoId,
    });

    const tokenInput: TokenTransaccionalInput = {
      kid: this.kidActivo,
      userId: input.actorUsuarioId,
      op: 'ASIGNAR_PERMISO',
      targetId: input.encargaturaId,
      subTargetId: input.permisoId,
      contentHash,
      institucionId: input.institucionId,
      correlationId: input.correlationId,
      ventanaSegundos: 45,
    };

    const authToken = TransaccionalTokenService.generarToken(tokenInput, this.secretoTransaccional);

    return this.ejecutarConReintentos(async (cliente) => {
      const res = await cliente.query<{ fn_asignar_permiso_encargatura: any }>(
        `SELECT sigd_org.fn_asignar_permiso_encargatura($1, $2, $3) AS fn_asignar_permiso_encargatura`,
        [authToken, input.encargaturaId, input.permisoId],
      );
      return res.rows[0]?.fn_asignar_permiso_encargatura;
    });
  }
}
