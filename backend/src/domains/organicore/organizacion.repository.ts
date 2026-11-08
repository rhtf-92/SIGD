/**
 * Repositorio de Persistencia para Organización y Responsabilidades Temporales (Fase 5C)
 * Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
 */

import type { Pool, PoolClient } from 'pg';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import type {
  UnidadOrganicaModel,
  CargoInstitucionalModel,
  AsignacionPersonalModel,
  ResponsabilidadTemporalModel,
  FiltroConsultaOrg,
  AlcanceDelegacion,
} from './organizacion.types.js';

type ClientOrPool = Pool | PoolClient;

function aIsoString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return new Date(val).toISOString();
  return String(val);
}

function aIsoStringNullable(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? val : d.toISOString();
  }
  return null;
}

export class OrganizacionRepository {
  // ===========================================================================
  // 1. UNIDADES ORGÁNICAS (sigd_org.area)
  // ===========================================================================

  async obtenerUnidadPorId(c: ClientOrPool, areaId: string): Promise<UnidadOrganicaModel | null> {
    const res = await c.query(
      `SELECT area_id::text AS "areaId",
              codigo,
              nombre,
              COALESCE(tipo_unidad, 'AREA') AS "tipoUnidad",
              area_padre_id::text AS "areaPadreId",
              path::text AS path,
              nivel,
              vigente,
              creado_en AS "creadoEn"
         FROM sigd_org.area
        WHERE area_id = $1::uuid`,
      [areaId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return { ...r, creadoEn: aIsoString(r.creadoEn) };
  }

  async obtenerUnidadPorCodigo(c: ClientOrPool, codigo: string): Promise<UnidadOrganicaModel | null> {
    const res = await c.query(
      `SELECT area_id::text AS "areaId",
              codigo,
              nombre,
              COALESCE(tipo_unidad, 'AREA') AS "tipoUnidad",
              area_padre_id::text AS "areaPadreId",
              path::text AS path,
              nivel,
              vigente,
              creado_en AS "creadoEn"
         FROM sigd_org.area
        WHERE UPPER(codigo) = UPPER($1)`,
      [codigo]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return { ...r, creadoEn: aIsoString(r.creadoEn) };
  }

  async listarUnidades(c: ClientOrPool, soloVigentes: boolean = true): Promise<UnidadOrganicaModel[]> {
    const sql = `
      SELECT area_id::text AS "areaId",
             codigo,
             nombre,
             COALESCE(tipo_unidad, 'AREA') AS "tipoUnidad",
             area_padre_id::text AS "areaPadreId",
             path::text AS path,
             nivel,
             vigente,
             creado_en AS "creadoEn"
        FROM sigd_org.area
       ${soloVigentes ? 'WHERE vigente = TRUE' : ''}
       ORDER BY nivel ASC, path ASC
    `;
    const res = await c.query(sql);
    return res.rows.map((r) => ({ ...r, creadoEn: aIsoString(r.creadoEn) }));
  }

  async insertarUnidad(
    c: PoolClient,
    datos: {
      codigo: string;
      nombre: string;
      tipoUnidad: string;
      areaPadreId: string | null;
      path: string;
      nivel: number;
    },
    usuarioIdAudit?: string
  ): Promise<UnidadOrganicaModel> {
    const res = await c.query(
      `INSERT INTO sigd_org.area (codigo, nombre, tipo_unidad, area_padre_id, path, nivel, vigente)
       VALUES ($1, $2, $3, $4::uuid, $5::ltree, $6, TRUE)
       RETURNING area_id::text AS "areaId",
                 codigo,
                 nombre,
                 tipo_unidad AS "tipoUnidad",
                 area_padre_id::text AS "areaPadreId",
                 path::text AS path,
                 nivel,
                 vigente,
                 creado_en AS "creadoEn"`,
      [datos.codigo, datos.nombre, datos.tipoUnidad, datos.areaPadreId, datos.path, datos.nivel]
    );
    const r = res.rows[0];
    const item: UnidadOrganicaModel = { ...r, creadoEn: aIsoString(r.creadoEn) };

    await registrarMutacion(c, {
      esquema: 'sigd_org',
      tabla: 'area',
      operacion: 'INSERT',
      datos_antes: null,
      datos_despues: item,
    });

    return item;
  }

  // ===========================================================================
  // 2. CARGOS INSTITUCIONALES (sigd_org.cargo)
  // ===========================================================================

  async obtenerCargoPorId(c: ClientOrPool, cargoId: string): Promise<CargoInstitucionalModel | null> {
    const res = await c.query(
      `SELECT cargo_id::text AS "cargoId",
              codigo,
              nombre,
              descripcion,
              vigente
         FROM sigd_org.cargo
        WHERE cargo_id = $1::uuid`,
      [cargoId]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async obtenerCargoPorCodigo(c: ClientOrPool, codigo: string): Promise<CargoInstitucionalModel | null> {
    const res = await c.query(
      `SELECT cargo_id::text AS "cargoId",
              codigo,
              nombre,
              descripcion,
              vigente
         FROM sigd_org.cargo
        WHERE UPPER(codigo) = UPPER($1)`,
      [codigo]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async listarCargos(c: ClientOrPool, soloVigentes: boolean = true): Promise<CargoInstitucionalModel[]> {
    const res = await c.query(
      `SELECT cargo_id::text AS "cargoId",
              codigo,
              nombre,
              descripcion,
              vigente
         FROM sigd_org.cargo
        ${soloVigentes ? 'WHERE vigente = TRUE' : ''}
        ORDER BY nombre ASC`
    );
    return res.rows;
  }

  async insertarCargo(
    c: PoolClient,
    datos: { codigo: string; nombre: string; descripcion?: string | null },
    usuarioIdAudit?: string
  ): Promise<CargoInstitucionalModel> {
    const res = await c.query(
      `INSERT INTO sigd_org.cargo (codigo, nombre, descripcion, vigente)
       VALUES ($1, $2, $3, TRUE)
       RETURNING cargo_id::text AS "cargoId", codigo, nombre, descripcion, vigente`,
      [datos.codigo, datos.nombre, datos.descripcion ?? null]
    );
    const cargo = res.rows[0];

    await registrarMutacion(c, {
      esquema: 'sigd_org',
      tabla: 'cargo',
      operacion: 'INSERT',
      datos_antes: null,
      datos_despues: cargo,
    });

    return cargo;
  }

  // ===========================================================================
  // 3. ASIGNACIÓN PERSONAL (TITULARIDAD BASE) (sigd_org.asignacion_personal)
  // ===========================================================================

  async obtenerAsignacionPorId(c: ClientOrPool, idAsignacion: string): Promise<AsignacionPersonalModel | null> {
    const res = await c.query(
      `SELECT a.id_asignacion::text AS "idAsignacion",
              a.id_usuario::text AS "idUsuario",
              u.usuario AS "usuarioUsername",
              TRIM(CONCAT(p.nombres, ' ', p.primer_apellido, ' ', COALESCE(p.segundo_apellido, ''))) AS "usuarioNombre",
              a.cargo_id::text AS "cargoId",
              cg.codigo AS "cargoCodigo",
              cg.nombre AS "cargoNombre",
              a.area_id::text AS "areaId",
              ar.codigo AS "areaCodigo",
              ar.nombre AS "areaNombre",
              a.estado,
              a.vigente_desde AS "vigenteDesde",
              a.vigente_hasta AS "vigenteHasta",
              a.tipo_documento_sustento AS "tipoDocumentoSustento",
              a.numero_documento_sustento AS "numeroDocumentoSustento",
              a.fecha_documento_sustento AS "fechaDocumentoSustento",
              a.motivo_finalizacion AS "motivoFinalizacion",
              a.motivo_anulacion AS "motivoAnulacion",
              a.anulado_en AS "anuladoEn",
              a.anulado_por::text AS "anuladoPor",
              a.creado_en AS "creadoEn",
              a.actualizado_en AS "actualizadoEn"
         FROM sigd_org.asignacion_personal a
         JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = a.id_usuario
         JOIN sigd_auth.persona p ON p.id_persona = u.id_persona
         JOIN sigd_org.cargo cg ON cg.cargo_id = a.cargo_id
         JOIN sigd_org.area ar ON ar.area_id = a.area_id
        WHERE a.id_asignacion = $1::uuid`,
      [idAsignacion]
    );
    if (res.rows.length === 0) return null;
    return this.mapearAsignacion(res.rows[0]);
  }

  async listarAsignaciones(c: ClientOrPool, filtro?: FiltroConsultaOrg): Promise<AsignacionPersonalModel[]> {
    const conds: string[] = [];
    const params: unknown[] = [];

    if (filtro?.areaId) {
      params.push(filtro.areaId);
      conds.push(`a.area_id = $${params.length}::uuid`);
    }

    if (filtro?.idUsuario) {
      params.push(filtro.idUsuario);
      conds.push(`a.id_usuario = $${params.length}::uuid`);
    }

    if (filtro?.cargoId) {
      params.push(filtro.cargoId);
      conds.push(`a.cargo_id = $${params.length}::uuid`);
    }

    if (filtro?.soloActivos) {
      conds.push(`a.estado = 'ACTIVO' AND (a.vigente_hasta IS NULL OR a.vigente_hasta > now())`);
    } else if (filtro?.fechaCorte) {
      params.push(filtro.fechaCorte);
      conds.push(`a.estado <> 'ANULADO' AND a.vigente_desde <= $${params.length}::timestamptz AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= $${params.length}::timestamptz)`);
    }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const sql = `
      SELECT a.id_asignacion::text AS "idAsignacion",
             a.id_usuario::text AS "idUsuario",
             u.usuario AS "usuarioUsername",
             TRIM(CONCAT(p.nombres, ' ', p.primer_apellido, ' ', COALESCE(p.segundo_apellido, ''))) AS "usuarioNombre",
             a.cargo_id::text AS "cargoId",
             cg.codigo AS "cargoCodigo",
             cg.nombre AS "cargoNombre",
             a.area_id::text AS "areaId",
             ar.codigo AS "areaCodigo",
             ar.nombre AS "areaNombre",
             a.estado,
             a.vigente_desde AS "vigenteDesde",
             a.vigente_hasta AS "vigenteHasta",
             a.tipo_documento_sustento AS "tipoDocumentoSustento",
             a.numero_documento_sustento AS "numeroDocumentoSustento",
             a.fecha_documento_sustento AS "fechaDocumentoSustento",
             a.motivo_finalizacion AS "motivoFinalizacion",
             a.motivo_anulacion AS "motivoAnulacion",
             a.anulado_en AS "anuladoEn",
             a.anulado_por::text AS "anuladoPor",
             a.creado_en AS "creadoEn",
             a.actualizado_en AS "actualizadoEn"
        FROM sigd_org.asignacion_personal a
        JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = a.id_usuario
        JOIN sigd_auth.persona p ON p.id_persona = u.id_persona
        JOIN sigd_org.cargo cg ON cg.cargo_id = a.cargo_id
        JOIN sigd_org.area ar ON ar.area_id = a.area_id
       ${where}
       ORDER BY a.vigente_desde DESC
    `;
    const res = await c.query(sql, params);
    return res.rows.map((r) => this.mapearAsignacion(r));
  }

  async insertarAsignacion(
    c: PoolClient,
    datos: {
      idUsuario: string;
      cargoId: string;
      areaId: string;
      vigenteDesde: Date;
      vigenteHasta: Date | null;
      tipoDocumentoSustento?: string | null;
      numeroDocumentoSustento?: string | null;
      fechaDocumentoSustento?: string | null;
    },
    usuarioIdAudit?: string
  ): Promise<AsignacionPersonalModel> {
    const res = await c.query(
      `INSERT INTO sigd_org.asignacion_personal (
         id_usuario, cargo_id, area_id, vigente_desde, vigente_hasta,
         estado, tipo_documento_sustento, numero_documento_sustento, fecha_documento_sustento
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, 'ACTIVO', $6, $7, $8)
       RETURNING id_asignacion::text AS "idAsignacion"`,
      [
        datos.idUsuario,
        datos.cargoId,
        datos.areaId,
        datos.vigenteDesde,
        datos.vigenteHasta,
        datos.tipoDocumentoSustento ?? null,
        datos.numeroDocumentoSustento ?? null,
        datos.fechaDocumentoSustento ?? null,
      ]
    );
    const idAsignacion = res.rows[0].idAsignacion;
    const asignacion = (await this.obtenerAsignacionPorId(c, idAsignacion))!;

    await registrarMutacion(c, {
      esquema: 'sigd_org',
      tabla: 'asignacion_personal',
      operacion: 'INSERT',
      datos_antes: null,
      datos_despues: asignacion,
    });

    return asignacion;
  }

  async actualizarFinalizacionAsignacion(
    c: PoolClient,
    datos: {
      idAsignacion: string;
      vigenteHasta: Date;
      motivoFinalizacion?: string | null;
    },
    usuarioIdAudit?: string
  ): Promise<AsignacionPersonalModel | null> {
    const anterior = await this.obtenerAsignacionPorId(c, datos.idAsignacion);
    if (!anterior) return null;

    const res = await c.query(
      `UPDATE sigd_org.asignacion_personal
          SET estado = 'FINALIZADO',
              vigente_hasta = $2,
              motivo_finalizacion = $3,
              actualizado_en = now()
        WHERE id_asignacion = $1::uuid
          AND estado = 'ACTIVO'
        RETURNING id_asignacion::text AS "idAsignacion"`,
      [datos.idAsignacion, datos.vigenteHasta, datos.motivoFinalizacion ?? 'Finalización de asignación']
    );

    if (res.rows.length === 0) return null;
    const actualizado = (await this.obtenerAsignacionPorId(c, datos.idAsignacion))!;

    await registrarMutacion(c, {
      esquema: 'sigd_org',
      tabla: 'asignacion_personal',
      operacion: 'UPDATE',
      datos_antes: anterior,
      datos_despues: actualizado,
    });

    return actualizado;
  }

  // ===========================================================================
  // 4. RESPONSABILIDAD TEMPORAL (sigd_org.responsabilidad_temporal)
  // ===========================================================================

  async obtenerResponsabilidadPorId(c: ClientOrPool, idResponsabilidad: string): Promise<ResponsabilidadTemporalModel | null> {
    const res = await c.query(
      `SELECT r.id_responsabilidad::text AS "idResponsabilidad",
              r.tipo_responsabilidad AS "tipoResponsabilidad",
              r.id_usuario::text AS "idUsuario",
              u.usuario AS "usuarioUsername",
              TRIM(CONCAT(p.nombres, ' ', p.primer_apellido, ' ', COALESCE(p.segundo_apellido, ''))) AS "usuarioNombre",
              r.titular_usuario_id::text AS "titularUsuarioId",
              ut.usuario AS "titularUsername",
              TRIM(CONCAT(pt.nombres, ' ', pt.primer_apellido, ' ', COALESCE(pt.segundo_apellido, ''))) AS "titularNombre",
              r.cargo_id::text AS "cargoId",
              cg.codigo AS "cargoCodigo",
              cg.nombre AS "cargoNombre",
              r.area_id::text AS "areaId",
              ar.codigo AS "areaCodigo",
              ar.nombre AS "areaNombre",
              r.estado,
              r.vigente_desde AS "vigenteDesde",
              r.vigente_hasta AS "vigenteHasta",
              r.tipo_documento_sustento AS "tipoDocumentoSustento",
              r.numero_documento_sustento AS "numeroDocumentoSustento",
              r.fecha_documento_sustento AS "fechaDocumentoSustento",
              r.alcance,
              r.motivo_finalizacion AS "motivoFinalizacion",
              r.motivo_revocacion AS "motivoRevocacion",
              r.motivo_anulacion AS "motivoAnulacion",
              r.anulado_en AS "anuladoEn",
              r.anulado_por::text AS "anuladoPor",
              r.creado_en AS "creadoEn",
              r.actualizado_en AS "actualizadoEn"
         FROM sigd_org.responsabilidad_temporal r
         JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = r.id_usuario
         JOIN sigd_auth.persona p ON p.id_persona = u.id_persona
         LEFT JOIN sigd_auth.cuenta_usuario ut ON ut.id_usuario = r.titular_usuario_id
         LEFT JOIN sigd_auth.persona pt ON pt.id_persona = ut.id_persona
         JOIN sigd_org.cargo cg ON cg.cargo_id = r.cargo_id
         JOIN sigd_org.area ar ON ar.area_id = r.area_id
        WHERE r.id_responsabilidad = $1::uuid`,
      [idResponsabilidad]
    );
    if (res.rows.length === 0) return null;
    return this.mapearResponsabilidad(res.rows[0]);
  }

  async listarResponsabilidadesTemporales(c: ClientOrPool, filtro?: FiltroConsultaOrg): Promise<ResponsabilidadTemporalModel[]> {
    const conds: string[] = [];
    const params: unknown[] = [];

    if (filtro?.tipoResponsabilidad) {
      params.push(filtro.tipoResponsabilidad);
      conds.push(`r.tipo_responsabilidad = $${params.length}`);
    }

    if (filtro?.areaId) {
      params.push(filtro.areaId);
      conds.push(`r.area_id = $${params.length}::uuid`);
    }

    if (filtro?.idUsuario) {
      params.push(filtro.idUsuario);
      conds.push(`(r.id_usuario = $${params.length}::uuid OR r.titular_usuario_id = $${params.length}::uuid)`);
    }

    if (filtro?.cargoId) {
      params.push(filtro.cargoId);
      conds.push(`r.cargo_id = $${params.length}::uuid`);
    }

    if (filtro?.soloActivos) {
      conds.push(`r.estado = 'ACTIVO' AND (r.vigente_hasta IS NULL OR r.vigente_hasta > now())`);
    } else if (filtro?.fechaCorte) {
      params.push(filtro.fechaCorte);
      conds.push(`r.estado <> 'ANULADO' AND r.vigente_desde <= $${params.length}::timestamptz AND (r.vigente_hasta IS NULL OR r.vigente_hasta >= $${params.length}::timestamptz)`);
    }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const sql = `
      SELECT r.id_responsabilidad::text AS "idResponsabilidad",
             r.tipo_responsabilidad AS "tipoResponsabilidad",
             r.id_usuario::text AS "idUsuario",
             u.usuario AS "usuarioUsername",
             TRIM(CONCAT(p.nombres, ' ', p.primer_apellido, ' ', COALESCE(p.segundo_apellido, ''))) AS "usuarioNombre",
             r.titular_usuario_id::text AS "titularUsuarioId",
             ut.usuario AS "titularUsername",
             TRIM(CONCAT(pt.nombres, ' ', pt.primer_apellido, ' ', COALESCE(pt.segundo_apellido, ''))) AS "titularNombre",
             r.cargo_id::text AS "cargoId",
             cg.codigo AS "cargoCodigo",
             cg.nombre AS "cargoNombre",
             r.area_id::text AS "areaId",
             ar.codigo AS "areaCodigo",
             ar.nombre AS "areaNombre",
             r.estado,
             r.vigente_desde AS "vigenteDesde",
             r.vigente_hasta AS "vigenteHasta",
             r.tipo_documento_sustento AS "tipoDocumentoSustento",
             r.numero_documento_sustento AS "numeroDocumentoSustento",
             r.fecha_documento_sustento AS "fechaDocumentoSustento",
             r.alcance,
             r.motivo_finalizacion AS "motivoFinalizacion",
             r.motivo_revocacion AS "motivoRevocacion",
             r.motivo_anulacion AS "motivoAnulacion",
             r.anulado_en AS "anuladoEn",
             r.anulado_por::text AS "anuladoPor",
             r.creado_en AS "creadoEn",
             r.actualizado_en AS "actualizadoEn"
        FROM sigd_org.responsabilidad_temporal r
        JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = r.id_usuario
        JOIN sigd_auth.persona p ON p.id_persona = u.id_persona
        LEFT JOIN sigd_auth.cuenta_usuario ut ON ut.id_usuario = r.titular_usuario_id
        LEFT JOIN sigd_auth.persona pt ON pt.id_persona = ut.id_persona
        JOIN sigd_org.cargo cg ON cg.cargo_id = r.cargo_id
        JOIN sigd_org.area ar ON ar.area_id = r.area_id
       ${where}
       ORDER BY r.vigente_desde DESC
    `;
    const res = await c.query(sql, params);
    return res.rows.map((r) => this.mapearResponsabilidad(r));
  }

  async insertarResponsabilidadTemporal(
    c: PoolClient,
    datos: {
      tipoResponsabilidad: string;
      idUsuario: string;
      titularUsuarioId?: string | null;
      cargoId: string;
      areaId: string;
      vigenteDesde: Date;
      vigenteHasta: Date | null;
      tipoDocumentoSustento?: string | null;
      numeroDocumentoSustento?: string | null;
      fechaDocumentoSustento?: string | null;
      alcance?: AlcanceDelegacion | null;
    },
    usuarioIdAudit?: string
  ): Promise<ResponsabilidadTemporalModel> {
    const res = await c.query(
      `INSERT INTO sigd_org.responsabilidad_temporal (
         tipo_responsabilidad, id_usuario, titular_usuario_id, cargo_id, area_id,
         vigente_desde, vigente_hasta, tipo_documento_sustento, numero_documento_sustento,
         fecha_documento_sustento, alcance, estado
       ) VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8, $9, $10, $11, 'ACTIVO')
       RETURNING id_responsabilidad::text AS "idResponsabilidad"`,
      [
        datos.tipoResponsabilidad,
        datos.idUsuario,
        datos.titularUsuarioId ?? null,
        datos.cargoId,
        datos.areaId,
        datos.vigenteDesde,
        datos.vigenteHasta,
        datos.tipoDocumentoSustento ?? null,
        datos.numeroDocumentoSustento ?? null,
        datos.fechaDocumentoSustento ?? null,
        datos.alcance ? JSON.stringify(datos.alcance) : null,
      ]
    );
    const idResp = res.rows[0].idResponsabilidad;
    const resp = (await this.obtenerResponsabilidadPorId(c, idResp))!;

    await registrarMutacion(c, {
      esquema: 'sigd_org',
      tabla: 'responsabilidad_temporal',
      operacion: 'INSERT',
      datos_antes: null,
      datos_despues: resp,
    });

    return resp;
  }

  async actualizarFinalizacionResponsabilidad(
    c: PoolClient,
    datos: {
      idResponsabilidad: string;
      vigenteHasta: Date;
      motivoFinalizacion?: string | null;
    },
    usuarioIdAudit?: string
  ): Promise<ResponsabilidadTemporalModel | null> {
    const anterior = await this.obtenerResponsabilidadPorId(c, datos.idResponsabilidad);
    if (!anterior) return null;

    const res = await c.query(
      `UPDATE sigd_org.responsabilidad_temporal
          SET estado = 'FINALIZADO',
              vigente_hasta = $2,
              motivo_finalizacion = $3,
              actualizado_en = now()
        WHERE id_responsabilidad = $1::uuid
          AND estado = 'ACTIVO'
        RETURNING id_responsabilidad::text AS "idResponsabilidad"`,
      [datos.idResponsabilidad, datos.vigenteHasta, datos.motivoFinalizacion ?? 'Finalización de responsabilidad temporal']
    );

    if (res.rows.length === 0) return null;
    const actualizado = (await this.obtenerResponsabilidadPorId(c, datos.idResponsabilidad))!;

    await registrarMutacion(c, {
      esquema: 'sigd_org',
      tabla: 'responsabilidad_temporal',
      operacion: 'UPDATE',
      datos_antes: anterior,
      datos_despues: actualizado,
    });

    return actualizado;
  }

  async actualizarRevocacionResponsabilidad(
    c: PoolClient,
    datos: {
      idResponsabilidad: string;
      vigenteHasta: Date;
      motivoRevocacion: string;
    },
    usuarioIdAudit?: string
  ): Promise<ResponsabilidadTemporalModel | null> {
    const anterior = await this.obtenerResponsabilidadPorId(c, datos.idResponsabilidad);
    if (!anterior) return null;

    const res = await c.query(
      `UPDATE sigd_org.responsabilidad_temporal
          SET estado = 'REVOCADO',
              vigente_hasta = $2,
              motivo_revocacion = $3,
              actualizado_en = now()
        WHERE id_responsabilidad = $1::uuid
          AND estado = 'ACTIVO'
        RETURNING id_responsabilidad::text AS "idResponsabilidad"`,
      [datos.idResponsabilidad, datos.vigenteHasta, datos.motivoRevocacion]
    );

    if (res.rows.length === 0) return null;
    const actualizado = (await this.obtenerResponsabilidadPorId(c, datos.idResponsabilidad))!;

    await registrarMutacion(c, {
      esquema: 'sigd_org',
      tabla: 'responsabilidad_temporal',
      operacion: 'UPDATE',
      datos_antes: anterior,
      datos_despues: actualizado,
    });

    return actualizado;
  }

  async actualizarAnulacionResponsabilidad(
    c: PoolClient,
    datos: {
      idResponsabilidad: string;
      anuladoPor: string;
      motivoAnulacion: string;
    },
    usuarioIdAudit?: string
  ): Promise<ResponsabilidadTemporalModel | null> {
    const anterior = await this.obtenerResponsabilidadPorId(c, datos.idResponsabilidad);
    if (!anterior) return null;

    const res = await c.query(
      `UPDATE sigd_org.responsabilidad_temporal
          SET estado = 'ANULADO',
              anulado_en = now(),
              anulado_por = $2::uuid,
              motivo_anulacion = $3,
              actualizado_en = now()
        WHERE id_responsabilidad = $1::uuid
          AND estado = 'ACTIVO'
        RETURNING id_responsabilidad::text AS "idResponsabilidad"`,
      [datos.idResponsabilidad, datos.anuladoPor, datos.motivoAnulacion]
    );

    if (res.rows.length === 0) return null;
    const actualizado = (await this.obtenerResponsabilidadPorId(c, datos.idResponsabilidad))!;

    await registrarMutacion(c, {
      esquema: 'sigd_org',
      tabla: 'responsabilidad_temporal',
      operacion: 'UPDATE',
      datos_antes: anterior,
      datos_despues: actualizado,
    });

    return actualizado;
  }

  // ===========================================================================
  // 5. VALIDACIÓN DE CUENTA DE USUARIO
  // ===========================================================================

  async obtenerCuentaUsuario(c: ClientOrPool, idUsuario: string): Promise<{ idUsuario: string; usuario: string; activo: boolean; personaId: string } | null> {
    const res = await c.query(
      `SELECT id_usuario::text AS "idUsuario", usuario, activo, id_persona::text AS "personaId"
         FROM sigd_auth.cuenta_usuario
        WHERE id_usuario = $1::uuid`,
      [idUsuario]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  // ===========================================================================
  // HELPERS PRIVADOS
  // ===========================================================================

  private mapearAsignacion(r: any): AsignacionPersonalModel {
    return {
      ...r,
      vigenteDesde: aIsoString(r.vigenteDesde),
      vigenteHasta: aIsoStringNullable(r.vigenteHasta),
      creadoEn: aIsoString(r.creadoEn),
      actualizadoEn: aIsoString(r.actualizadoEn),
      anuladoEn: aIsoStringNullable(r.anuladoEn),
      fechaDocumentoSustento: r.fechaDocumentoSustento ? String(r.fechaDocumentoSustento) : null,
    };
  }

  private mapearResponsabilidad(r: any): ResponsabilidadTemporalModel {
    return {
      ...r,
      vigenteDesde: aIsoString(r.vigenteDesde),
      vigenteHasta: aIsoStringNullable(r.vigenteHasta),
      creadoEn: aIsoString(r.creadoEn),
      actualizadoEn: aIsoString(r.actualizadoEn),
      anuladoEn: aIsoStringNullable(r.anuladoEn),
      fechaDocumentoSustento: r.fechaDocumentoSustento ? String(r.fechaDocumentoSustento) : null,
      alcance: r.alcance ? (typeof r.alcance === 'string' ? JSON.parse(r.alcance) : r.alcance) : null,
    };
  }
}
