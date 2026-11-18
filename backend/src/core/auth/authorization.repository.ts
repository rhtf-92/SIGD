/**
-- =============================================================================
-- Repositorio de Persistencia para Autorización Contextual (Fase 5D)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Modelo Canónico de Autorización Contextual, Scopes y Segregación SIGD 2026
-- =============================================================================
*/

import type { Pool, PoolClient } from 'pg';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import type {
  AsignacionPerfilOperativo,
  EstadoAsignacionPerfil,
  PerfilOperativoCatalogo,
  ScopeOperativo,
} from './authorization.types.js';

export class AuthorizationRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Obtiene la cuenta de usuario activa/inactiva de la BD física.
   */
  async obtenerCuentaPorId(idUsuario: string): Promise<{
    idUsuario: string;
    usuario: string;
    correo: string;
    activo: boolean;
  } | null> {
    const { rows } = await this.pool.query<{
      id_usuario: string;
      usuario: string;
      correo: string;
      activo: boolean;
    }>(
      `SELECT id_usuario, usuario, correo, activo
         FROM sigd_auth.cuenta_usuario
        WHERE id_usuario = $1::uuid
        LIMIT 1`,
      [idUsuario],
    );
    if (rows.length === 0) return null;
    return {
      idUsuario: rows[0].id_usuario,
      usuario: rows[0].usuario,
      correo: rows[0].correo,
      activo: rows[0].activo,
    };
  }

  /**
   * Obtiene los datos de la persona asociada a la cuenta.
   */
  async obtenerPersonaPorCuenta(idUsuario: string): Promise<{
    idPersona: string;
    nombres: string;
    primerApellido: string;
    segundoApellido: string | null;
    tipoDocumento: number | null;
    numeroDocumento: string | null;
  } | null> {
    const { rows } = await this.pool.query<{
      id_persona: string;
      nombres: string;
      primer_apellido: string;
      segundo_apellido: string | null;
      id_tipo_documento: number | null;
      numero_documento: string | null;
    }>(
      `SELECT p.id_persona,
              COALESCE(pn.nombres, pj.razon_social, '') AS nombres,
              COALESCE(pn.apellidos, '') AS primer_apellido,
              NULL::text AS segundo_apellido,
              NULL::int AS id_tipo_documento,
              p.id_documento AS numero_documento
         FROM sigd_auth.cuenta_usuario c
         JOIN sigd_auth.persona p ON p.id_persona = c.id_persona
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
    LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
        WHERE c.id_usuario = $1::uuid
        LIMIT 1`,
      [idUsuario],
    );
    if (rows.length === 0) return null;
    return {
      idPersona: rows[0].id_persona,
      nombres: rows[0].nombres,
      primerApellido: rows[0].primer_apellido,
      segundoApellido: rows[0].segundo_apellido,
      tipoDocumento: rows[0].id_tipo_documento,
      numeroDocumento: rows[0].numero_documento,
    };
  }

  /**
   * Lista vínculos institucionales vigentes a la fecha de corte.
   */
  async listarVinculosUsuario(
    idUsuario: string,
    fechaCorte: Date,
  ): Promise<
    Array<{
      idVinculo: string;
      codigoTipo: string;
      nombreTipo: string;
      categoria: string;
      estado: string;
      vigenteDesde: string;
      vigenteHasta: string | null;
    }>
  > {
    const { rows } = await this.pool.query<{
      id_vinculo: string;
      codigo: string;
      nombre: string;
      categoria_actor: string;
      estado: string;
      vigente_desde: string;
      vigente_hasta: string | null;
    }>(
      `SELECT v.id_vinculo, t.codigo, t.nombre, t.categoria_actor, v.estado,
              v.vigente_desde::text, v.vigente_hasta::text
         FROM sigd_auth.cuenta_usuario c
         JOIN sigd_auth.vinculo_institucional v ON v.id_persona = c.id_persona
         JOIN sigd_auth.tipo_vinculo_institucional t ON t.id_tipo_vinculo = v.id_tipo_vinculo
        WHERE c.id_usuario = $1::uuid
          AND v.estado = 'ACTIVO'
          AND v.vigente_desde <= $2::timestamptz
          AND (v.vigente_hasta IS NULL OR v.vigente_hasta > $2::timestamptz)
        ORDER BY v.vigente_desde DESC`,
      [idUsuario, fechaCorte.toISOString()],
    );
    return rows.map((r) => ({
      idVinculo: r.id_vinculo,
      codigoTipo: r.codigo,
      nombreTipo: r.nombre,
      categoria: r.categoria_actor,
      estado: r.estado,
      vigenteDesde: r.vigente_desde,
      vigenteHasta: r.vigente_hasta,
    }));
  }

  /**
   * Lista asignaciones ordinarias de personal vigentes a la fecha.
   */
  async listarAsignacionesUsuario(
    idUsuario: string,
    fechaCorte: Date,
  ): Promise<
    Array<{
      idAsignacion: string;
      cargoId: string;
      cargoCodigo: string;
      cargoNombre: string;
      areaId: string;
      areaCodigo: string;
      areaNombre: string;
      areaJerarquia: string | null;
      estado: string;
      vigenteDesde: string;
      vigenteHasta: string | null;
    }>
  > {
    const { rows } = await this.pool.query<{
      id_asignacion: string;
      cargo_id: string;
      cargo_codigo: string;
      cargo_nombre: string;
      area_id: string;
      area_codigo: string;
      area_nombre: string;
      jerarquia: string | null;
      estado: string;
      vigente_desde: string;
      vigente_hasta: string | null;
    }>(
      `SELECT a.id_asignacion, a.cargo_id, c.codigo AS cargo_codigo, c.nombre AS cargo_nombre,
              a.area_id, ar.codigo AS area_codigo, ar.nombre AS area_nombre, ar.path::text AS jerarquia,
              a.estado, a.vigente_desde::text, a.vigente_hasta::text
         FROM sigd_org.asignacion_personal a
         JOIN sigd_org.cargo c ON c.cargo_id = a.cargo_id
         JOIN sigd_org.area ar ON ar.area_id = a.area_id
         JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = $1::uuid
        WHERE (a.id_usuario = $1::uuid OR a.id_persona = cu.id_persona)
          AND a.estado = 'ACTIVO'
          AND a.vigente_desde <= $2::timestamptz
          AND (a.vigente_hasta IS NULL OR a.vigente_hasta > $2::timestamptz)
        ORDER BY a.vigente_desde DESC`,
      [idUsuario, fechaCorte.toISOString()],
    );
    return rows.map((r) => ({
      idAsignacion: r.id_asignacion,
      cargoId: r.cargo_id,
      cargoCodigo: r.cargo_codigo,
      cargoNombre: r.cargo_nombre,
      areaId: r.area_id,
      areaCodigo: r.area_codigo,
      areaNombre: r.area_nombre,
      areaJerarquia: r.jerarquia,
      estado: r.estado,
      vigenteDesde: r.vigente_desde,
      vigenteHasta: r.vigente_hasta,
    }));
  }

  /**
   * Lista responsabilidades temporales vigentes (encargaturas, suplencias, delegaciones).
   */
  async listarResponsabilidadesUsuario(
    idUsuario: string,
    fechaCorte: Date,
  ): Promise<
    Array<{
      idResponsabilidad: string;
      tipo: 'ENCARGATURA' | 'SUPLENCIA' | 'DELEGACION' | 'DESIGNACION_ESPECIFICA';
      titularUsuarioId: string | null;
      cargoId: string;
      areaId: string;
      estado: string;
      vigenteDesde: string;
      vigenteHasta: string | null;
      alcance: Record<string, unknown> | null;
    }>
  > {
    const { rows } = await this.pool.query<{
      id_responsabilidad: string;
      tipo_responsabilidad: string;
      titular_usuario_id: string | null;
      cargo_id: string;
      area_id: string;
      estado: string;
      vigente_desde: string;
      vigente_hasta: string | null;
      alcance: Record<string, unknown> | null;
    }>(
      `SELECT r.id_responsabilidad, r.tipo_responsabilidad, r.titular_usuario_id, r.cargo_id, r.area_id,
              r.estado, r.vigente_desde::text, r.vigente_hasta::text, r.alcance
         FROM sigd_org.responsabilidad_temporal r
         JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = $1::uuid
        WHERE (r.id_usuario = $1::uuid OR r.id_persona = cu.id_persona)
          AND r.estado = 'ACTIVO'
          AND r.vigente_desde <= $2::timestamptz
          AND (r.vigente_hasta IS NULL OR r.vigente_hasta > $2::timestamptz)
        ORDER BY r.vigente_desde DESC`,
      [idUsuario, fechaCorte.toISOString()],
    );
    return rows.map((r) => ({
      idResponsabilidad: r.id_responsabilidad,
      tipo: r.tipo_responsabilidad as
        | 'ENCARGATURA'
        | 'SUPLENCIA'
        | 'DELEGACION'
        | 'DESIGNACION_ESPECIFICA',
      titularUsuarioId: r.titular_usuario_id,
      cargoId: r.cargo_id,
      areaId: r.area_id,
      estado: r.estado,
      vigenteDesde: r.vigente_desde,
      vigenteHasta: r.vigente_hasta,
      alcance: r.alcance,
    }));
  }

  /**
   * Lista asignaciones ordinarias de personal directamente por idPersona (sin requerir cuenta).
   */
  async listarAsignacionesPorPersona(
    idPersona: string,
    fechaCorte: Date,
  ): Promise<
    Array<{
      idAsignacion: string;
      cargoId: string;
      cargoCodigo: string;
      cargoNombre: string;
      areaId: string;
      areaCodigo: string;
      areaNombre: string;
      areaJerarquia: string | null;
      estado: string;
      vigenteDesde: string;
      vigenteHasta: string | null;
    }>
  > {
    const { rows } = await this.pool.query<{
      id_asignacion: string;
      cargo_id: string;
      cargo_codigo: string;
      cargo_nombre: string;
      area_id: string;
      area_codigo: string;
      area_nombre: string;
      jerarquia: string | null;
      estado: string;
      vigente_desde: string;
      vigente_hasta: string | null;
    }>(
      `SELECT a.id_asignacion, a.cargo_id, c.codigo AS cargo_codigo, c.nombre AS cargo_nombre,
              a.area_id, ar.codigo AS area_codigo, ar.nombre AS area_nombre, ar.path::text AS jerarquia,
              a.estado, a.vigente_desde::text, a.vigente_hasta::text
         FROM sigd_org.asignacion_personal a
         JOIN sigd_org.cargo c ON c.cargo_id = a.cargo_id
         JOIN sigd_org.area ar ON ar.area_id = a.area_id
        WHERE a.id_persona = $1::uuid
          AND a.estado = 'ACTIVO'
          AND a.vigente_desde <= $2::timestamptz
          AND (a.vigente_hasta IS NULL OR a.vigente_hasta > $2::timestamptz)
        ORDER BY a.vigente_desde DESC`,
      [idPersona, fechaCorte.toISOString()],
    );
    return rows.map((r) => ({
      idAsignacion: r.id_asignacion,
      cargoId: r.cargo_id,
      cargoCodigo: r.cargo_codigo,
      cargoNombre: r.cargo_nombre,
      areaId: r.area_id,
      areaCodigo: r.area_codigo,
      areaNombre: r.area_nombre,
      areaJerarquia: r.jerarquia,
      estado: r.estado,
      vigenteDesde: r.vigente_desde,
      vigenteHasta: r.vigente_hasta,
    }));
  }

  /**
   * Lista responsabilidades temporales directamente por idPersona.
   */
  async listarResponsabilidadesPorPersona(
    idPersona: string,
    fechaCorte: Date,
  ): Promise<
    Array<{
      idResponsabilidad: string;
      tipo: 'ENCARGATURA' | 'SUPLENCIA' | 'DELEGACION' | 'DESIGNACION_ESPECIFICA';
      titularUsuarioId: string | null;
      cargoId: string;
      areaId: string;
      estado: string;
      vigenteDesde: string;
      vigenteHasta: string | null;
      alcance: Record<string, unknown> | null;
    }>
  > {
    const { rows } = await this.pool.query<{
      id_responsabilidad: string;
      tipo_responsabilidad: string;
      titular_usuario_id: string | null;
      cargo_id: string;
      area_id: string;
      estado: string;
      vigente_desde: string;
      vigente_hasta: string | null;
      alcance: Record<string, unknown> | null;
    }>(
      `SELECT r.id_responsabilidad, r.tipo_responsabilidad, r.titular_usuario_id, r.cargo_id, r.area_id,
              r.estado, r.vigente_desde::text, r.vigente_hasta::text, r.alcance
         FROM sigd_org.responsabilidad_temporal r
        WHERE r.id_persona = $1::uuid
          AND r.estado = 'ACTIVO'
          AND r.vigente_desde <= $2::timestamptz
          AND (r.vigente_hasta IS NULL OR r.vigente_hasta > $2::timestamptz)
        ORDER BY r.vigente_desde DESC`,
      [idPersona, fechaCorte.toISOString()],
    );
    return rows.map((r) => ({
      idResponsabilidad: r.id_responsabilidad,
      tipo: r.tipo_responsabilidad as
        | 'ENCARGATURA'
        | 'SUPLENCIA'
        | 'DELEGACION'
        | 'DESIGNACION_ESPECIFICA',
      titularUsuarioId: r.titular_usuario_id,
      cargoId: r.cargo_id,
      areaId: r.area_id,
      estado: r.estado,
      vigenteDesde: r.vigente_desde,
      vigenteHasta: r.vigente_hasta,
      alcance: r.alcance,
    }));
  }

  /**
   * Lista perfiles operativos asignados a la cuenta con sus permisos asociados.
   */
  async listarPerfilesAsignadosUsuario(
    idUsuario: string,
    fechaCorte: Date,
  ): Promise<
    Array<{
      idAsignacionPerfil: string;
      perfilId: number;
      perfilCodigo: string;
      perfilNombre: string;
      areaId: string | null;
      scope: ScopeOperativo;
      idResponsabilidad: string | null;
      estado: string;
      vigenteDesde: string;
      vigenteHasta: string | null;
      permisos: string[];
      alcance: Record<string, unknown> | null;
    }>
  > {
    const { rows } = await this.pool.query<{
      id_asignacion_perfil: string;
      perfil_id: number;
      perfil_codigo: string;
      perfil_nombre: string;
      area_id: string | null;
      scope: string;
      id_responsabilidad: string | null;
      estado: string;
      vigente_desde: string;
      vigente_hasta: string | null;
      permisos: string[];
      alcance: Record<string, unknown> | null;
    }>(
      `SELECT ap.id_asignacion_perfil, ap.perfil_id, p.codigo AS perfil_codigo,
              p.nombre AS perfil_nombre, ap.area_id, ap.scope, ap.id_responsabilidad,
              ap.estado, ap.vigente_desde::text, ap.vigente_hasta::text,
              COALESCE(
                array_agg(ps.codigo) FILTER (WHERE ps.codigo IS NOT NULL),
                '{}'::text[]
              ) AS permisos,
              ap.alcance
         FROM sigd_org.asignacion_perfil_operativo ap
         JOIN sigd_org.perfil_operativo p ON p.perfil_id = ap.perfil_id
         LEFT JOIN sigd_org.perfil_permiso pp ON pp.perfil_id = p.perfil_id
         LEFT JOIN sigd_org.permiso_sistema ps ON ps.permiso_id = pp.permiso_id
        WHERE ap.id_usuario = $1::uuid
          AND ap.estado = 'ACTIVO'
          AND p.vigente = TRUE
          AND ap.vigente_desde <= $2::timestamptz
          AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > $2::timestamptz)
        GROUP BY ap.id_asignacion_perfil, ap.perfil_id, p.codigo, p.nombre,
                 ap.area_id, ap.scope, ap.id_responsabilidad, ap.estado,
                 ap.vigente_desde, ap.vigente_hasta, ap.alcance
        ORDER BY ap.vigente_desde DESC`,
      [idUsuario, fechaCorte.toISOString()],
    );
    return rows.map((r) => ({
      idAsignacionPerfil: r.id_asignacion_perfil,
      perfilId: r.perfil_id,
      perfilCodigo: r.perfil_codigo,
      perfilNombre: r.perfil_nombre,
      areaId: r.area_id,
      scope: r.scope as ScopeOperativo,
      idResponsabilidad: r.id_responsabilidad,
      estado: r.estado,
      vigenteDesde: r.vigente_desde,
      vigenteHasta: r.vigente_hasta,
      permisos: r.permisos,
      alcance: r.alcance,
    }));
  }

  /**
   * Catálogo de perfiles operativos.
   */
  async listarCatalogoPerfiles(soloVigentes = true): Promise<PerfilOperativoCatalogo[]> {
    const { rows } = await this.pool.query<{
      perfil_id: number;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      vigente: boolean;
      creado_en: string;
    }>(
      `SELECT perfil_id, codigo, nombre, descripcion, vigente, creado_en::text
         FROM sigd_org.perfil_operativo
        WHERE ($1::boolean = FALSE OR vigente = TRUE)
        ORDER BY perfil_id ASC`,
      [soloVigentes],
    );
    return rows.map((r) => ({
      perfilId: r.perfil_id,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      vigente: r.vigente,
      creadoEn: r.creado_en,
    }));
  }

  async obtenerPerfilPorCodigo(codigo: string): Promise<PerfilOperativoCatalogo | null> {
    const { rows } = await this.pool.query<{
      perfil_id: number;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      vigente: boolean;
      creado_en: string;
    }>(
      `SELECT perfil_id, codigo, nombre, descripcion, vigente, creado_en::text
         FROM sigd_org.perfil_operativo
        WHERE codigo = $1
        LIMIT 1`,
      [codigo],
    );
    if (rows.length === 0) return null;
    return {
      perfilId: rows[0].perfil_id,
      codigo: rows[0].codigo,
      nombre: rows[0].nombre,
      descripcion: rows[0].descripcion,
      vigente: rows[0].vigente,
      creadoEn: rows[0].creado_en,
    };
  }

  /**
   * Obtiene una asignación de perfil por su ID.
   */
  async obtenerAsignacionPerfilPorId(id: string): Promise<AsignacionPerfilOperativo | null> {
    const { rows } = await this.pool.query<{
      id_asignacion_perfil: string;
      id_usuario: string;
      perfil_id: number;
      perfil_codigo: string;
      perfil_nombre: string;
      area_id: string | null;
      area_codigo: string | null;
      area_nombre: string | null;
      scope: string;
      id_responsabilidad: string | null;
      estado: string;
      vigente_desde: string;
      vigente_hasta: string | null;
      tipo_documento_sustento: string | null;
      numero_documento_sustento: string | null;
      fecha_documento_sustento: string | null;
      alcance: Record<string, unknown> | null;
      motivo_finalizacion: string | null;
      motivo_revocacion: string | null;
      motivo_anulacion: string | null;
      anulado_en: string | null;
      anulado_por: string | null;
      creado_en: string;
      actualizado_en: string;
    }>(
      `SELECT ap.id_asignacion_perfil, ap.id_usuario, ap.perfil_id, p.codigo AS perfil_codigo,
              p.nombre AS perfil_nombre, ap.area_id, ar.codigo AS area_codigo, ar.nombre AS area_nombre,
              ap.scope, ap.id_responsabilidad, ap.estado, ap.vigente_desde::text,
              ap.vigente_hasta::text, ap.tipo_documento_sustento, ap.numero_documento_sustento,
              ap.fecha_documento_sustento::text, ap.alcance, ap.motivo_finalizacion,
              ap.motivo_revocacion, ap.motivo_anulacion, ap.anulado_en::text, ap.anulado_por,
              ap.creado_en::text, ap.actualizado_en::text
         FROM sigd_org.asignacion_perfil_operativo ap
         JOIN sigd_org.perfil_operativo p ON p.perfil_id = ap.perfil_id
         LEFT JOIN sigd_org.area ar ON ar.area_id = ap.area_id
        WHERE ap.id_asignacion_perfil = $1::uuid
        LIMIT 1`,
      [id],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      idAsignacionPerfil: r.id_asignacion_perfil,
      idUsuario: r.id_usuario,
      perfilId: r.perfil_id,
      perfilCodigo: r.perfil_codigo,
      perfilNombre: r.perfil_nombre,
      areaId: r.area_id,
      areaCodigo: r.area_codigo,
      areaNombre: r.area_nombre,
      scope: r.scope as ScopeOperativo,
      idResponsabilidad: r.id_responsabilidad,
      estado: r.estado as EstadoAsignacionPerfil,
      vigenteDesde: r.vigente_desde,
      vigenteHasta: r.vigente_hasta,
      tipoDocumentoSustento: r.tipo_documento_sustento,
      numeroDocumentoSustento: r.numero_documento_sustento,
      fechaDocumentoSustento: r.fecha_documento_sustento,
      alcance: r.alcance,
      motivoFinalizacion: r.motivo_finalizacion,
      motivoRevocacion: r.motivo_revocacion,
      motivoAnulacion: r.motivo_anulacion,
      anuladoEn: r.anulado_en,
      anuladoPor: r.anulado_por,
      creadoEn: r.creado_en,
      actualizadoEn: r.actualizado_en,
    };
  }

  /**
   * Crea una nueva asignación de perfil operativo con auditoría.
   */
  async crearAsignacionPerfil(
    cliente: PoolClient,
    datos: {
      idUsuario: string;
      perfilId: number;
      areaId: string | null;
      scope: ScopeOperativo;
      idResponsabilidad: string | null;
      vigenteDesde: Date;
      vigenteHasta: Date | null;
      tipoDocumentoSustento?: string | null;
      numeroDocumentoSustento?: string | null;
      fechaDocumentoSustento?: string | null;
      alcance?: Record<string, unknown> | null;
    },
    autorId: string,
  ): Promise<AsignacionPerfilOperativo> {
    const { rows } = await cliente.query<{
      id_asignacion_perfil: string;
      id_usuario: string;
      perfil_id: number;
      area_id: string | null;
      scope: string;
      id_responsabilidad: string | null;
      estado: string;
      vigente_desde: string;
      vigente_hasta: string | null;
      tipo_documento_sustento: string | null;
      numero_documento_sustento: string | null;
      fecha_documento_sustento: string | null;
      alcance: Record<string, unknown> | null;
      creado_en: string;
      actualizado_en: string;
    }>(
      `INSERT INTO sigd_org.asignacion_perfil_operativo (
         id_usuario, perfil_id, area_id, scope, id_responsabilidad,
         estado, vigente_desde, vigente_hasta, tipo_documento_sustento,
         numero_documento_sustento, fecha_documento_sustento, alcance
       ) VALUES (
         $1::uuid, $2, $3, $4, $5,
         'ACTIVO', $6::timestamptz, $7, $8,
         $9, $10, $11
       )
       RETURNING id_asignacion_perfil, id_usuario, perfil_id, area_id, scope,
                 id_responsabilidad, estado, vigente_desde::text, vigente_hasta::text,
                 tipo_documento_sustento, numero_documento_sustento,
                 fecha_documento_sustento::text, alcance, creado_en::text, actualizado_en::text`,
      [
        datos.idUsuario,
        datos.perfilId,
        datos.areaId,
        datos.scope,
        datos.idResponsabilidad,
        datos.vigenteDesde.toISOString(),
        datos.vigenteHasta ? datos.vigenteHasta.toISOString() : null,
        datos.tipoDocumentoSustento ?? null,
        datos.numeroDocumentoSustento ?? null,
        datos.fechaDocumentoSustento ?? null,
        datos.alcance ? JSON.stringify(datos.alcance) : null,
      ],
    );

    const r = rows[0];

    await registrarMutacion(cliente, {
      esquema: 'sigd_org',
      tabla: 'asignacion_perfil_operativo',
      operacion: 'INSERT',
      datos_antes: null,
      datos_despues: r as unknown as Record<string, unknown>,
    });

    // Re-consultar para enriquecer con metadatos de nombre
    const full = await this.obtenerAsignacionPerfilPorId(r.id_asignacion_perfil);
    return full!;
  }

  /**
   * Finaliza una asignación de perfil de forma inmutable.
   */
  async finalizarAsignacionPerfil(
    cliente: PoolClient,
    id: string,
    fechaFinalizacion: Date,
    motivo: string | null,
    autorId: string,
  ): Promise<AsignacionPerfilOperativo> {
    const antes = await this.obtenerAsignacionPerfilPorId(id);
    const { rows } = await cliente.query<{ id_asignacion_perfil: string }>(
      `UPDATE sigd_org.asignacion_perfil_operativo
          SET estado = 'FINALIZADO',
              vigente_hasta = $2::timestamptz,
              motivo_finalizacion = $3,
              actualizado_en = now()
        WHERE id_asignacion_perfil = $1::uuid
        RETURNING id_asignacion_perfil`,
      [id, fechaFinalizacion.toISOString(), motivo],
    );

    const despues = await this.obtenerAsignacionPerfilPorId(rows[0].id_asignacion_perfil);

    await registrarMutacion(cliente, {
      esquema: 'sigd_org',
      tabla: 'asignacion_perfil_operativo',
      operacion: 'UPDATE',
      datos_antes: antes as unknown as Record<string, unknown>,
      datos_despues: despues as unknown as Record<string, unknown>,
    });

    return despues!;
  }

  /**
   * Revoca una asignación de perfil.
   */
  async revocarAsignacionPerfil(
    cliente: PoolClient,
    id: string,
    fechaRevocacion: Date,
    motivo: string,
    autorId: string,
  ): Promise<AsignacionPerfilOperativo> {
    const antes = await this.obtenerAsignacionPerfilPorId(id);
    const { rows } = await cliente.query<{ id_asignacion_perfil: string }>(
      `UPDATE sigd_org.asignacion_perfil_operativo
          SET estado = 'REVOCADO',
              vigente_hasta = $2::timestamptz,
              motivo_revocacion = $3,
              actualizado_en = now()
        WHERE id_asignacion_perfil = $1::uuid
        RETURNING id_asignacion_perfil`,
      [id, fechaRevocacion.toISOString(), motivo],
    );

    const despues = await this.obtenerAsignacionPerfilPorId(rows[0].id_asignacion_perfil);

    await registrarMutacion(cliente, {
      esquema: 'sigd_org',
      tabla: 'asignacion_perfil_operativo',
      operacion: 'UPDATE',
      datos_antes: antes as unknown as Record<string, unknown>,
      datos_despues: despues as unknown as Record<string, unknown>,
    });

    return despues!;
  }

  /**
   * Anula una asignación de perfil con registro del anulador y motivo mandatorio.
   */
  async anularAsignacionPerfil(
    cliente: PoolClient,
    id: string,
    anuladoPor: string,
    motivo: string,
  ): Promise<AsignacionPerfilOperativo> {
    const antes = await this.obtenerAsignacionPerfilPorId(id);
    const { rows } = await cliente.query<{ id_asignacion_perfil: string }>(
      `UPDATE sigd_org.asignacion_perfil_operativo
          SET estado = 'ANULADO',
              anulado_por = $2::uuid,
              anulado_en = now(),
              motivo_anulacion = $3,
              actualizado_en = now()
        WHERE id_asignacion_perfil = $1::uuid
        RETURNING id_asignacion_perfil`,
      [id, anuladoPor, motivo],
    );

    const despues = await this.obtenerAsignacionPerfilPorId(rows[0].id_asignacion_perfil);

    await registrarMutacion(cliente, {
      esquema: 'sigd_org',
      tabla: 'asignacion_perfil_operativo',
      operacion: 'UPDATE',
      datos_antes: antes as unknown as Record<string, unknown>,
      datos_despues: despues as unknown as Record<string, unknown>,
    });

    return despues!;
  }

  /**
   * Verifica si un área destino está dentro del subárbol de un área base mediante ltree.
   */
  async verificarJerarquiaSubarbol(areaBaseId: string, areaDestinoId: string): Promise<boolean> {
    if (areaBaseId === areaDestinoId) return true;
    const { rows } = await this.pool.query<{ coincide: boolean }>(
      `SELECT (hijo.path <@ padre.path) AS coincide /* hijo.jerarquia <@ padre.jerarquia */
         FROM sigd_org.area padre, sigd_org.area hijo
        WHERE padre.area_id = $1::uuid
          AND hijo.area_id = $2::uuid
        LIMIT 1`,
      [areaBaseId, areaDestinoId],
    );
    return rows[0]?.coincide ?? false;
  }
}
