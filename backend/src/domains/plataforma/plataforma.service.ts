/**
 * Plataforma RBAC Service — Administración Global SaaS
 * SIGD · IESTP «Suiza» · B_JACOBO
 *
 * Implementa aprovisionamiento institucional multi-tenant, gestión de roles de
 * plataforma (SUPER_ADMIN) delegando en funciones SECURITY DEFINER con auditoría WORM.
 */

import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { AppError, ForbiddenError, ValidationError } from '../../shared/domain/errors/index.js';
import { esSuperAdmin } from '../../core/auth/auth.guard.js';

export interface InstitucionResumen {
  institucionId: string;
  codigo: string;
  nombre: string;
  abreviatura: string;
  ruc: string | null;
  ubigeoInei: string | null;
  activo: boolean;
  creadoEn: string;
}

export interface CrearInstitucionInput {
  codigo: string;
  nombre: string;
  abreviatura: string;
  ruc?: string | null;
  ubigeoInei?: string | null;
  actorId: string;
  motivoJustificacion: string;
  ipOrigen?: string | null;
  userAgent?: string | null;
}

export interface ActualizarEstadoInstitucionInput {
  institucionId: string;
  activo: boolean;
  actorId: string;
  motivoJustificacion: string;
  ipOrigen?: string | null;
  userAgent?: string | null;
}

export interface AsignarRolPlataformaInput {
  actorId?: string | null;
  targetUserId: string;
  rolPlataforma: string;
  motivoJustificacion: string;
  esBreakGlass?: boolean;
  breakGlassKey?: string | null;
  ipOrigen?: string | null;
  userAgent?: string | null;
}

export interface RevocarRolPlataformaInput {
  actorId: string;
  targetUserId: string;
  rolPlataforma: string;
  motivoJustificacion: string;
  ipOrigen?: string | null;
  userAgent?: string | null;
}

export interface AuditoriaPlataformaItem {
  idOperacion: string;
  correlationId: string;
  actorId: string;
  operacion: string;
  entidadTipo: string;
  entidadId: string;
  motivoJustificacion: string;
  datosAntes: any;
  datosDespues: any;
  ipOrigen: string | null;
  userAgent: string | null;
  fechaOperacion: string;
}

export class PlataformaService {
  constructor(private readonly pool: Pool) {}

  /**
   * Lista todas las instituciones (tenants) registradas en la plataforma.
   */
  async listarInstituciones(): Promise<InstitucionResumen[]> {
    const res = await this.pool.query<{
      institucion_id: string;
      codigo: string;
      nombre: string;
      abreviatura: string;
      ruc: string | null;
      ubigeo_inei: string | null;
      activo: boolean;
      creado_en: Date;
    }>(`
      SELECT institucion_id, codigo, nombre, abreviatura, ruc, ubigeo_inei, activo, creado_en
        FROM sigd_org.institucion
       ORDER BY creado_en ASC
    `);

    return res.rows.map((r) => ({
      institucionId: r.institucion_id,
      codigo: r.codigo,
      nombre: r.nombre,
      abreviatura: r.abreviatura,
      ruc: r.ruc,
      ubigeoInei: r.ubigeo_inei,
      activo: r.activo,
      creadoEn: r.creado_en.toISOString(),
    }));
  }

  /**
   * Aprovisiona una nueva institución en la plataforma con auditoría WORM inmutable.
   */
  async crearInstitucion(input: CrearInstitucionInput): Promise<InstitucionResumen> {
    const esAdmin = await esSuperAdmin(this.pool, input.actorId);
    if (!esAdmin) {
      throw new ForbiddenError({ message: 'Se requieren facultades vigentes de SUPER_ADMIN de plataforma.' });
    }

    if (!input.motivoJustificacion || input.motivoJustificacion.trim().length < 15) {
      throw new ValidationError({
        invalidParams: [{ name: 'motivoJustificacion', reason: 'El motivo debe contener al menos 15 caracteres para auditoría WORM.' }],
      });
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const correlationId = crypto.randomUUID();

      const insertRes = await client.query<{
        institucion_id: string;
        codigo: string;
        nombre: string;
        abreviatura: string;
        ruc: string | null;
        ubigeo_inei: string | null;
        activo: boolean;
        creado_en: Date;
      }>(`
        INSERT INTO sigd_org.institucion (codigo, nombre, abreviatura, ruc, ubigeo_inei, activo)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING institucion_id, codigo, nombre, abreviatura, ruc, ubigeo_inei, activo, creado_en
      `, [
        input.codigo.trim().toUpperCase(),
        input.nombre.trim(),
        input.abreviatura.trim().toUpperCase(),
        input.ruc ? input.ruc.trim() : null,
        input.ubigeoInei ? input.ubigeoInei.trim() : null,
      ]);

      const nueva = insertRes.rows[0];

      // Inserción obligatoria en bitácora WORM de plataforma
      await client.query(`
        INSERT INTO sigd_audit.auditoria_plataforma_log (
          correlation_id, actor_id, operacion, institucion_afectada_id,
          entidad_tipo, entidad_id, datos_antes, datos_despues,
          motivo_justificacion, ip_origen, user_agent
        ) VALUES (
          $1::uuid, $2::uuid, 'CREACION_INSTITUCION', $3::uuid,
          'institucion', $4, NULL, $5::jsonb,
          $6, $7::inet, $8
        )
      `, [
        correlationId,
        input.actorId,
        nueva.institucion_id,
        nueva.institucion_id,
        JSON.stringify(nueva),
        input.motivoJustificacion.trim(),
        input.ipOrigen ?? null,
        input.userAgent ?? 'SIGD-Platform/Service',
      ]);

      await client.query('COMMIT');

      return {
        institucionId: nueva.institucion_id,
        codigo: nueva.codigo,
        nombre: nueva.nombre,
        abreviatura: nueva.abreviatura,
        ruc: nueva.ruc,
        ubigeoInei: nueva.ubigeo_inei,
        activo: nueva.activo,
        creadoEn: nueva.creado_en.toISOString(),
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        throw new AppError({
          status: 409,
          code: 'INSTITUCION_DUPLICADA',
          message: 'El código o RUC de la institución ya se encuentra registrado.',
        });
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Modifica el estado de activación de un tenant institucional con trazabilidad WORM.
   */
  async actualizarEstadoInstitucion(input: ActualizarEstadoInstitucionInput): Promise<InstitucionResumen> {
    const esAdmin = await esSuperAdmin(this.pool, input.actorId);
    if (!esAdmin) {
      throw new ForbiddenError({ message: 'Se requieren facultades vigentes de SUPER_ADMIN de plataforma.' });
    }

    if (!input.motivoJustificacion || input.motivoJustificacion.trim().length < 15) {
      throw new ValidationError({
        invalidParams: [{ name: 'motivoJustificacion', reason: 'El motivo debe contener al menos 15 caracteres.' }],
      });
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const prevRes = await client.query<{
        institucion_id: string;
        codigo: string;
        nombre: string;
        abreviatura: string;
        ruc: string | null;
        ubigeo_inei: string | null;
        activo: boolean;
        creado_en: Date;
      }>('SELECT * FROM sigd_org.institucion WHERE institucion_id = $1::uuid FOR UPDATE', [input.institucionId]);

      if (prevRes.rowCount === 0) {
        throw new AppError({ status: 404, code: 'INSTITUCION_NOT_FOUND', message: 'Institución no encontrada.' });
      }

      const datosAntes = prevRes.rows[0];
      const correlationId = crypto.randomUUID();

      const updateRes = await client.query<{
        institucion_id: string;
        codigo: string;
        nombre: string;
        abreviatura: string;
        ruc: string | null;
        ubigeo_inei: string | null;
        activo: boolean;
        creado_en: Date;
      }>(`
        UPDATE sigd_org.institucion
           SET activo = $2
         WHERE institucion_id = $1::uuid
        RETURNING *
      `, [input.institucionId, input.activo]);

      const datosDespues = updateRes.rows[0];

      await client.query(`
        INSERT INTO sigd_audit.auditoria_plataforma_log (
          correlation_id, actor_id, operacion, institucion_afectada_id,
          entidad_tipo, entidad_id, datos_antes, datos_despues,
          motivo_justificacion, ip_origen, user_agent
        ) VALUES (
          $1::uuid, $2::uuid, 'CAMBIO_ESTADO_INSTITUCION', $3::uuid,
          'institucion', $4, $5::jsonb, $6::jsonb,
          $7, $8::inet, $9
        )
      `, [
        correlationId,
        input.actorId,
        input.institucionId,
        input.institucionId,
        JSON.stringify(datosAntes),
        JSON.stringify(datosDespues),
        input.motivoJustificacion.trim(),
        input.ipOrigen ?? null,
        input.userAgent ?? 'SIGD-Platform/Service',
      ]);

      await client.query('COMMIT');

      return {
        institucionId: datosDespues.institucion_id,
        codigo: datosDespues.codigo,
        nombre: datosDespues.nombre,
        abreviatura: datosDespues.abreviatura,
        ruc: datosDespues.ruc,
        ubigeoInei: datosDespues.ubigeo_inei,
        activo: datosDespues.activo,
        creadoEn: datosDespues.creado_en.toISOString(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Lista usuarios con asignación de roles de plataforma.
   */
  async listarUsuariosPlataforma(): Promise<any[]> {
    const res = await this.pool.query(`
      SELECT urp.id_asignacion,
             urp.id_usuario,
             cu.usuario,
             cu.correo,
             urp.rol_plataforma,
             urp.vigente_desde,
             urp.vigente_hasta,
             sigd_auth.fn_es_super_admin(urp.id_usuario) AS es_super_admin_efectivo
        FROM sigd_auth.usuario_rol_plataforma urp
        JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = urp.id_usuario
       ORDER BY urp.vigente_desde DESC
    `);

    return res.rows.map((r) => ({
      idAsignacion: r.id_asignacion,
      idUsuario: r.id_usuario,
      usuario: r.usuario,
      correo: r.correo,
      rolPlataforma: r.rol_plataforma,
      vigenteDesde: r.vigente_desde.toISOString(),
      vigenteHasta: r.vigente_hasta ? r.vigente_hasta.toISOString() : null,
      esSuperAdminEfectivo: r.es_super_admin_efectivo,
    }));
  }

  /**
   * Invoca la función SECURITY DEFINER para asignar rol de plataforma con auditoría WORM atómica.
   */
  async asignarRolPlataforma(input: AsignarRolPlataformaInput): Promise<{ correlationId: string }> {
    const res = await this.pool.query<{ fn_asignar_rol_plataforma: string }>(
      `SELECT sigd_auth.fn_asignar_rol_plataforma(
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7::inet, $8
       ) AS fn_asignar_rol_plataforma`,
      [
        input.actorId ?? null,
        input.targetUserId,
        input.rolPlataforma,
        input.motivoJustificacion.trim(),
        Boolean(input.esBreakGlass),
        input.breakGlassKey ?? null,
        input.ipOrigen ?? null,
        input.userAgent ?? 'SIGD-Platform/Service',
      ],
    );

    return {
      correlationId: res.rows[0].fn_asignar_rol_plataforma,
    };
  }

  /**
   * Invoca la función SECURITY DEFINER para revocar rol de plataforma.
   */
  async revocarRolPlataforma(input: RevocarRolPlataformaInput): Promise<{ correlationId: string }> {
    const res = await this.pool.query<{ fn_revocar_rol_plataforma: string }>(
      `SELECT sigd_auth.fn_revocar_rol_plataforma(
         $1::uuid, $2::uuid, $3, $4, $5::inet, $6
       ) AS fn_revocar_rol_plataforma`,
      [
        input.actorId,
        input.targetUserId,
        input.rolPlataforma,
        input.motivoJustificacion.trim(),
        input.ipOrigen ?? null,
        input.userAgent ?? 'SIGD-Platform/Service',
      ],
    );

    return {
      correlationId: res.rows[0].fn_revocar_rol_plataforma,
    };
  }

  /**
   * Consulta la bitácora WORM de auditoría de plataforma.
   */
  async listarAuditoriaPlataforma(limite: number = 50): Promise<AuditoriaPlataformaItem[]> {
    const res = await this.pool.query<{
      id_operacion: string;
      correlation_id: string;
      actor_id: string;
      operacion: string;
      entidad_tipo: string;
      entidad_id: string;
      motivo_justificacion: string;
      datos_antes: any;
      datos_despues: any;
      ip_origen: string | null;
      user_agent: string | null;
      fecha_operacion: Date;
    }>(`
      SELECT id_operacion, correlation_id, actor_id, operacion, entidad_tipo, entidad_id,
             motivo_justificacion, datos_antes, datos_despues, ip_origen, user_agent, fecha_operacion
        FROM sigd_audit.auditoria_plataforma_log
       ORDER BY fecha_operacion DESC
       LIMIT $1
    `, [Math.min(limite, 200)]);

    return res.rows.map((r) => ({
      idOperacion: r.id_operacion,
      correlationId: r.correlation_id,
      actorId: r.actor_id,
      operacion: r.operacion,
      entidadTipo: r.entidad_tipo,
      entidadId: r.entidad_id,
      motivoJustificacion: r.motivo_justificacion,
      datosAntes: r.datos_antes,
      datosDespues: r.datos_despues,
      ipOrigen: r.ip_origen,
      userAgent: r.user_agent,
      fechaOperacion: r.fecha_operacion.toISOString(),
    }));
  }
}
