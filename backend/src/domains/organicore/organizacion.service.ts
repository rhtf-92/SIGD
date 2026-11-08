/**
 * Servicio de Dominio para Organización y Responsabilidades Temporales (Fase 5C)
 * Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
 */

import type { Pool } from 'pg';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../../shared/domain/errors/index.js';
import { OrganizacionRepository } from './organizacion.repository.js';
import type {
  UnidadOrganicaModel,
  UnidadOrganicaArbol,
  CargoInstitucionalModel,
  AsignacionPersonalModel,
  ResponsabilidadTemporalModel,
  CrearUnidadInput,
  CrearCargoInput,
  CrearAsignacionInput,
  FinalizarAsignacionInput,
  CrearResponsabilidadTemporalInput,
  FinalizarResponsabilidadInput,
  RevocarResponsabilidadInput,
  AnularResponsabilidadInput,
  FiltroConsultaOrg,
  TipoUnidadOrganica,
} from './organizacion.types.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS_UNIDAD_VALIDOS: TipoUnidadOrganica[] = [
  'DIRECCION',
  'UNIDAD',
  'AREA',
  'OFICINA',
  'SECRETARIA',
  'SERVICIO',
  'OTRO',
];

export class OrganizacionService {
  constructor(
    private readonly pool: Pool,
    private readonly repo: OrganizacionRepository = new OrganizacionRepository()
  ) {}

  // ===========================================================================
  // 1. UNIDADES ORGÁNICAS
  // ===========================================================================

  async listarUnidades(soloVigentes: boolean = true): Promise<UnidadOrganicaModel[]> {
    return this.repo.listarUnidades(this.pool, soloVigentes);
  }

  async obtenerArbolOrganico(): Promise<UnidadOrganicaArbol[]> {
    const unidades = await this.repo.listarUnidades(this.pool, true);
    const mapa = new Map<string, UnidadOrganicaArbol>();
    const raices: UnidadOrganicaArbol[] = [];

    for (const u of unidades) {
      mapa.set(u.areaId, { ...u, hijos: [] });
    }

    for (const u of unidades) {
      const nodo = mapa.get(u.areaId)!;
      if (u.areaPadreId && mapa.has(u.areaPadreId)) {
        mapa.get(u.areaPadreId)!.hijos.push(nodo);
      } else {
        raices.push(nodo);
      }
    }

    return raices;
  }

  async crearUnidad(input: CrearUnidadInput, usuarioIdAudit?: string): Promise<UnidadOrganicaModel> {
    if (!input.codigo || input.codigo.trim().length === 0) {
      throw new ValidationError({
        message: 'El código de la unidad orgánica es requerido.',
        invalidParams: [{ name: 'codigo', reason: 'Requerido' }],
      });
    }

    if (!input.nombre || input.nombre.trim().length === 0) {
      throw new ValidationError({
        message: 'El nombre de la unidad orgánica es requerido.',
        invalidParams: [{ name: 'nombre', reason: 'Requerido' }],
      });
    }

    const codigoLimpio = input.codigo.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const existe = await this.repo.obtenerUnidadPorCodigo(this.pool, codigoLimpio);
    if (existe) {
      throw new ConflictError({
        message: `Ya existe una unidad orgánica con el código '${codigoLimpio}'.`,
      });
    }

    const tipoUnidad: TipoUnidadOrganica = input.tipoUnidad ?? 'AREA';
    if (!TIPOS_UNIDAD_VALIDOS.includes(tipoUnidad)) {
      throw new ValidationError({
        message: `El tipo de unidad '${tipoUnidad}' no es válido.`,
        invalidParams: [{ name: 'tipoUnidad', reason: `Valores permitidos: ${TIPOS_UNIDAD_VALIDOS.join(', ')}` }],
      });
    }

    let nivel = 1;
    let path = `a.${codigoLimpio}`;
    let padreId: string | null = null;

    if (input.areaPadreId) {
      if (!UUID_REGEX.test(input.areaPadreId)) {
        throw new ValidationError({
          message: 'El identificador del área padre no es un UUID válido.',
          invalidParams: [{ name: 'areaPadreId', reason: 'UUID v4 inválido' }],
        });
      }
      const padre = await this.repo.obtenerUnidadPorId(this.pool, input.areaPadreId);
      if (!padre) {
        throw new NotFoundError({
          message: 'La unidad orgánica superior (padre) no existe.',
          detail: `No se encontró área con id: ${input.areaPadreId}`,
        });
      }
      if (!padre.vigente) {
        throw new ConflictError({
          message: 'No se puede asociar una unidad a un área superior inactiva.',
        });
      }
      nivel = padre.nivel + 1;
      path = `${padre.path}.${codigoLimpio}`;
      padreId = padre.areaId;
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const unidad = await this.repo.insertarUnidad(
        cliente,
        {
          codigo: codigoLimpio,
          nombre: input.nombre.trim(),
          tipoUnidad,
          areaPadreId: padreId,
          path,
          nivel,
        },
        usuarioIdAudit
      );
      await cliente.query('COMMIT');
      return unidad;
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

  // ===========================================================================
  // 2. CARGOS INSTITUCIONALES
  // ===========================================================================

  async listarCargos(soloVigentes: boolean = true): Promise<CargoInstitucionalModel[]> {
    return this.repo.listarCargos(this.pool, soloVigentes);
  }

  async crearCargo(input: CrearCargoInput, usuarioIdAudit?: string): Promise<CargoInstitucionalModel> {
    if (!input.codigo || input.codigo.trim().length === 0) {
      throw new ValidationError({
        message: 'El código del cargo es requerido.',
        invalidParams: [{ name: 'codigo', reason: 'Requerido' }],
      });
    }
    if (!input.nombre || input.nombre.trim().length === 0) {
      throw new ValidationError({
        message: 'El nombre del cargo es requerido.',
        invalidParams: [{ name: 'nombre', reason: 'Requerido' }],
      });
    }

    const codigoLimpio = input.codigo.trim().toUpperCase();
    const existe = await this.repo.obtenerCargoPorCodigo(this.pool, codigoLimpio);
    if (existe) {
      throw new ConflictError({
        message: `Ya existe un cargo institucional con el código '${codigoLimpio}'.`,
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const cargo = await this.repo.insertarCargo(
        cliente,
        {
          codigo: codigoLimpio,
          nombre: input.nombre.trim(),
          descripcion: input.descripcion?.trim() ?? null,
        },
        usuarioIdAudit
      );
      await cliente.query('COMMIT');
      return cargo;
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

  // ===========================================================================
  // 3. ASIGNACIÓN PERSONAL (TITULARIDAD BASE)
  // ===========================================================================

  async listarAsignaciones(filtro?: FiltroConsultaOrg): Promise<AsignacionPersonalModel[]> {
    this.validarFiltroConsulta(filtro);
    return this.repo.listarAsignaciones(this.pool, filtro);
  }

  async crearAsignacion(input: CrearAsignacionInput, usuarioIdAudit?: string): Promise<AsignacionPersonalModel> {
    this.validarUuid(input.idUsuario, 'idUsuario');
    this.validarUuid(input.cargoId, 'cargoId');
    this.validarUuid(input.areaId, 'areaId');

    const cuenta = await this.repo.obtenerCuentaUsuario(this.pool, input.idUsuario);
    if (!cuenta) {
      throw new NotFoundError({
        message: 'La cuenta de usuario especificada no existe.',
        detail: `id_usuario: ${input.idUsuario}`,
      });
    }
    if (!cuenta.activo) {
      throw new ConflictError({
        message: 'No se puede asignar un puesto o cargo a una cuenta de usuario inactiva o deshabilitada.',
      });
    }

    const cargo = await this.repo.obtenerCargoPorId(this.pool, input.cargoId);
    if (!cargo || !cargo.vigente) {
      throw new NotFoundError({
        message: 'El cargo institucional especificado no existe o no está vigente.',
        detail: `cargo_id: ${input.cargoId}`,
      });
    }

    const area = await this.repo.obtenerUnidadPorId(this.pool, input.areaId);
    if (!area || !area.vigente) {
      throw new NotFoundError({
        message: 'El área institucional especificada no existe o no está vigente.',
        detail: `area_id: ${input.areaId}`,
      });
    }

    const fechaDesde = input.vigenteDesde ? new Date(input.vigenteDesde) : new Date();
    if (isNaN(fechaDesde.getTime())) {
      throw new ValidationError({
        message: 'La fecha de inicio de vigencia es inválida.',
        invalidParams: [{ name: 'vigenteDesde', reason: 'Fecha inválida' }],
      });
    }

    let fechaHasta: Date | null = null;
    if (input.vigenteHasta !== undefined && input.vigenteHasta !== null) {
      fechaHasta = new Date(input.vigenteHasta);
      if (isNaN(fechaHasta.getTime())) {
        throw new ValidationError({
          message: 'La fecha de fin de vigencia es inválida.',
          invalidParams: [{ name: 'vigenteHasta', reason: 'Fecha inválida' }],
        });
      }
      if (fechaHasta.getTime() <= fechaDesde.getTime()) {
        throw new ValidationError({
          message: 'La fecha de fin de vigencia debe ser estrictamente posterior a la fecha de inicio.',
          invalidParams: [{ name: 'vigenteHasta', reason: 'vigente_hasta debe ser mayor que vigente_desde' }],
        });
      }
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const asignacion = await this.repo.insertarAsignacion(
        cliente,
        {
          idUsuario: input.idUsuario,
          cargoId: input.cargoId,
          areaId: input.areaId,
          vigenteDesde: fechaDesde,
          vigenteHasta: fechaHasta,
          tipoDocumentoSustento: input.tipoDocumentoSustento,
          numeroDocumentoSustento: input.numeroDocumentoSustento,
          fechaDocumentoSustento: input.fechaDocumentoSustento,
        },
        usuarioIdAudit
      );
      await cliente.query('COMMIT');
      return asignacion;
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

  async finalizarAsignacion(input: FinalizarAsignacionInput, usuarioIdAudit?: string): Promise<AsignacionPersonalModel> {
    this.validarUuid(input.idAsignacion, 'idAsignacion');

    const asignacion = await this.repo.obtenerAsignacionPorId(this.pool, input.idAsignacion);
    if (!asignacion) {
      throw new NotFoundError({
        message: 'La asignación de personal indicada no existe.',
        detail: `id_asignacion: ${input.idAsignacion}`,
      });
    }

    if (asignacion.estado !== 'ACTIVO') {
      throw new ConflictError({
        message: `La asignación ya se encuentra ${asignacion.estado.toLowerCase()}.`,
        detail: `Estado actual: ${asignacion.estado}`,
      });
    }

    const fechaFinal = input.fechaFinalizacion ? new Date(input.fechaFinalizacion) : new Date();
    if (isNaN(fechaFinal.getTime())) {
      throw new ValidationError({
        message: 'La fecha de finalización indicada no es válida.',
        invalidParams: [{ name: 'fechaFinalizacion', reason: 'Fecha inválida' }],
      });
    }

    const fechaDesde = new Date(asignacion.vigenteDesde);
    if (fechaFinal.getTime() <= fechaDesde.getTime()) {
      throw new ValidationError({
        message: 'La fecha de finalización debe ser estrictamente posterior al inicio de la asignación.',
        invalidParams: [{ name: 'fechaFinalizacion', reason: 'fecha_finalizacion debe ser mayor que vigente_desde' }],
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const actualizado = await this.repo.actualizarFinalizacionAsignacion(
        cliente,
        {
          idAsignacion: input.idAsignacion,
          vigenteHasta: fechaFinal,
          motivoFinalizacion: input.motivoFinalizacion,
        },
        usuarioIdAudit
      );
      if (!actualizado) {
        throw new ConflictError({
          message: 'No se pudo finalizar la asignación (posible modificación concurrente).',
        });
      }
      await cliente.query('COMMIT');
      return actualizado;
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

  // ===========================================================================
  // 4. RESPONSABILIDADES TEMPORALES (ENCARGATURA / SUPLENCIA / DELEGACIÓN)
  // ===========================================================================

  async listarResponsabilidadesTemporales(filtro?: FiltroConsultaOrg): Promise<ResponsabilidadTemporalModel[]> {
    this.validarFiltroConsulta(filtro);
    return this.repo.listarResponsabilidadesTemporales(this.pool, filtro);
  }

  async crearResponsabilidadTemporal(
    input: CrearResponsabilidadTemporalInput,
    usuarioIdAudit?: string
  ): Promise<ResponsabilidadTemporalModel> {
    const tiposPermitidos = ['ENCARGATURA', 'SUPLENCIA', 'DELEGACION', 'DESIGNACION_ESPECIFICA'];
    if (!input.tipoResponsabilidad || !tiposPermitidos.includes(input.tipoResponsabilidad)) {
      throw new ValidationError({
        message: 'El tipo de responsabilidad temporal no es válido.',
        invalidParams: [{ name: 'tipoResponsabilidad', reason: `Valores permitidos: ${tiposPermitidos.join(', ')}` }],
      });
    }

    this.validarUuid(input.idUsuario, 'idUsuario');
    this.validarUuid(input.cargoId, 'cargoId');
    this.validarUuid(input.areaId, 'areaId');

    const cuenta = await this.repo.obtenerCuentaUsuario(this.pool, input.idUsuario);
    if (!cuenta) {
      throw new NotFoundError({
        message: 'La cuenta de usuario designada no existe.',
        detail: `id_usuario: ${input.idUsuario}`,
      });
    }
    if (!cuenta.activo) {
      throw new ConflictError({
        message: 'No se puede encomendar una responsabilidad temporal a una cuenta de usuario inactiva o deshabilitada.',
      });
    }

    // Regla Suplencia: Titular obligatorio
    if (input.tipoResponsabilidad === 'SUPLENCIA') {
      if (!input.titularUsuarioId) {
        throw new ValidationError({
          message: 'La suplencia temporal requiere obligatoriamente identificar al titular ausente reemplazado.',
          invalidParams: [{ name: 'titularUsuarioId', reason: 'Requerido para suplencia' }],
        });
      }
      this.validarUuid(input.titularUsuarioId, 'titularUsuarioId');
      const titular = await this.repo.obtenerCuentaUsuario(this.pool, input.titularUsuarioId);
      if (!titular) {
        throw new NotFoundError({
          message: 'La cuenta de usuario del titular a suplir no existe.',
          detail: `titular_usuario_id: ${input.titularUsuarioId}`,
        });
      }
    }

    // Regla Anti-Auto-Reemplazo
    if (input.titularUsuarioId && input.titularUsuarioId === input.idUsuario) {
      throw new ValidationError({
        message: 'Un usuario no puede ser titular y reemplazante/suplente de sí mismo simultáneamente.',
        invalidParams: [{ name: 'titularUsuarioId', reason: 'titular y suplente deben ser distintos' }],
      });
    }

    const cargo = await this.repo.obtenerCargoPorId(this.pool, input.cargoId);
    if (!cargo || !cargo.vigente) {
      throw new NotFoundError({
        message: 'El cargo especificado no existe o no está vigente.',
        detail: `cargo_id: ${input.cargoId}`,
      });
    }

    const area = await this.repo.obtenerUnidadPorId(this.pool, input.areaId);
    if (!area || !area.vigente) {
      throw new NotFoundError({
        message: 'El área especificada no existe o no está vigente.',
        detail: `area_id: ${input.areaId}`,
      });
    }

    const fechaDesde = input.vigenteDesde ? new Date(input.vigenteDesde) : new Date();
    if (isNaN(fechaDesde.getTime())) {
      throw new ValidationError({
        message: 'La fecha de inicio de vigencia es inválida.',
        invalidParams: [{ name: 'vigenteDesde', reason: 'Fecha inválida' }],
      });
    }

    let fechaHasta: Date | null = null;
    if (input.vigenteHasta !== undefined && input.vigenteHasta !== null) {
      fechaHasta = new Date(input.vigenteHasta);
      if (isNaN(fechaHasta.getTime())) {
        throw new ValidationError({
          message: 'La fecha de fin de vigencia es inválida.',
          invalidParams: [{ name: 'vigenteHasta', reason: 'Fecha inválida' }],
        });
      }
      if (fechaHasta.getTime() <= fechaDesde.getTime()) {
        throw new ValidationError({
          message: 'La fecha de fin de vigencia debe ser estrictamente posterior a la fecha de inicio.',
          invalidParams: [{ name: 'vigenteHasta', reason: 'vigente_hasta debe ser mayor que vigente_desde' }],
        });
      }
    }

    // Regla Delegación: Alcance estructurado obligatorio
    if (input.tipoResponsabilidad === 'DELEGACION') {
      if (!input.alcance || !input.alcance.tipoActuacion || input.alcance.tipoActuacion.trim().length === 0) {
        throw new ValidationError({
          message: 'La delegación de funciones requiere definir el alcance estructurado con tipo de actuación.',
          invalidParams: [{ name: 'alcance.tipoActuacion', reason: 'Requerido para delegación' }],
        });
      }
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resp = await this.repo.insertarResponsabilidadTemporal(
        cliente,
        {
          tipoResponsabilidad: input.tipoResponsabilidad,
          idUsuario: input.idUsuario,
          titularUsuarioId: input.titularUsuarioId,
          cargoId: input.cargoId,
          areaId: input.areaId,
          vigenteDesde: fechaDesde,
          vigenteHasta: fechaHasta,
          tipoDocumentoSustento: input.tipoDocumentoSustento,
          numeroDocumentoSustento: input.numeroDocumentoSustento,
          fechaDocumentoSustento: input.fechaDocumentoSustento,
          alcance: input.alcance,
        },
        usuarioIdAudit
      );
      await cliente.query('COMMIT');
      return resp;
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

  async finalizarResponsabilidad(
    input: FinalizarResponsabilidadInput,
    usuarioIdAudit?: string
  ): Promise<ResponsabilidadTemporalModel> {
    this.validarUuid(input.idResponsabilidad, 'idResponsabilidad');

    const resp = await this.repo.obtenerResponsabilidadPorId(this.pool, input.idResponsabilidad);
    if (!resp) {
      throw new NotFoundError({
        message: 'La responsabilidad temporal indicada no existe.',
        detail: `id_responsabilidad: ${input.idResponsabilidad}`,
      });
    }

    if (resp.estado !== 'ACTIVO') {
      throw new ConflictError({
        message: `La responsabilidad temporal ya se encuentra ${resp.estado.toLowerCase()}.`,
        detail: `Estado actual: ${resp.estado}`,
      });
    }

    const fechaFinal = input.fechaFinalizacion ? new Date(input.fechaFinalizacion) : new Date();
    if (isNaN(fechaFinal.getTime())) {
      throw new ValidationError({
        message: 'La fecha de finalización indicada no es válida.',
        invalidParams: [{ name: 'fechaFinalizacion', reason: 'Fecha inválida' }],
      });
    }

    const fechaDesde = new Date(resp.vigenteDesde);
    if (fechaFinal.getTime() <= fechaDesde.getTime()) {
      throw new ValidationError({
        message: 'La fecha de finalización debe ser estrictamente posterior al inicio de la responsabilidad.',
        invalidParams: [{ name: 'fechaFinalizacion', reason: 'fecha_finalizacion debe ser mayor que vigente_desde' }],
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const actualizado = await this.repo.actualizarFinalizacionResponsabilidad(
        cliente,
        {
          idResponsabilidad: input.idResponsabilidad,
          vigenteHasta: fechaFinal,
          motivoFinalizacion: input.motivoFinalizacion,
        },
        usuarioIdAudit
      );
      if (!actualizado) {
        throw new ConflictError({
          message: 'No se pudo finalizar la responsabilidad (posible modificación concurrente).',
        });
      }
      await cliente.query('COMMIT');
      return actualizado;
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

  async revocarResponsabilidad(
    input: RevocarResponsabilidadInput,
    usuarioIdAudit?: string
  ): Promise<ResponsabilidadTemporalModel> {
    this.validarUuid(input.idResponsabilidad, 'idResponsabilidad');

    if (!input.motivoRevocacion || input.motivoRevocacion.trim().length === 0) {
      throw new ValidationError({
        message: 'Debe especificar el motivo formal de la revocación.',
        invalidParams: [{ name: 'motivoRevocacion', reason: 'Requerido' }],
      });
    }

    const resp = await this.repo.obtenerResponsabilidadPorId(this.pool, input.idResponsabilidad);
    if (!resp) {
      throw new NotFoundError({
        message: 'La responsabilidad temporal indicada no existe.',
        detail: `id_responsabilidad: ${input.idResponsabilidad}`,
      });
    }

    if (resp.estado !== 'ACTIVO') {
      throw new ConflictError({
        message: `La responsabilidad temporal ya se encuentra ${resp.estado.toLowerCase()}.`,
        detail: `Estado actual: ${resp.estado}`,
      });
    }

    const fechaRevocacion = input.fechaRevocacion ? new Date(input.fechaRevocacion) : new Date();
    if (isNaN(fechaRevocacion.getTime())) {
      throw new ValidationError({
        message: 'La fecha de revocación indicada no es válida.',
        invalidParams: [{ name: 'fechaRevocacion', reason: 'Fecha inválida' }],
      });
    }

    const fechaDesde = new Date(resp.vigenteDesde);
    if (fechaRevocacion.getTime() <= fechaDesde.getTime()) {
      throw new ValidationError({
        message: 'La fecha de revocación debe ser estrictamente posterior al inicio de la responsabilidad.',
        invalidParams: [{ name: 'fechaRevocacion', reason: 'fecha_revocacion debe ser mayor que vigente_desde' }],
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const actualizado = await this.repo.actualizarRevocacionResponsabilidad(
        cliente,
        {
          idResponsabilidad: input.idResponsabilidad,
          vigenteHasta: fechaRevocacion,
          motivoRevocacion: input.motivoRevocacion.trim(),
        },
        usuarioIdAudit
      );
      if (!actualizado) {
        throw new ConflictError({
          message: 'No se pudo revocar la responsabilidad (posible modificación concurrente).',
        });
      }
      await cliente.query('COMMIT');
      return actualizado;
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

  async anularResponsabilidad(
    input: AnularResponsabilidadInput,
    usuarioIdAudit?: string
  ): Promise<ResponsabilidadTemporalModel> {
    this.validarUuid(input.idResponsabilidad, 'idResponsabilidad');
    this.validarUuid(input.usuarioEjecutorId, 'usuarioEjecutorId');

    if (!input.motivoAnulacion || input.motivoAnulacion.trim().length === 0) {
      throw new ValidationError({
        message: 'Debe especificar el motivo formal de la anulación.',
        invalidParams: [{ name: 'motivoAnulacion', reason: 'Requerido' }],
      });
    }

    const resp = await this.repo.obtenerResponsabilidadPorId(this.pool, input.idResponsabilidad);
    if (!resp) {
      throw new NotFoundError({
        message: 'La responsabilidad temporal indicada no existe.',
        detail: `id_responsabilidad: ${input.idResponsabilidad}`,
      });
    }

    if (resp.estado !== 'ACTIVO') {
      throw new ConflictError({
        message: `La responsabilidad temporal no está activa (estado actual: ${resp.estado}).`,
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const actualizado = await this.repo.actualizarAnulacionResponsabilidad(
        cliente,
        {
          idResponsabilidad: input.idResponsabilidad,
          anuladoPor: input.usuarioEjecutorId,
          motivoAnulacion: input.motivoAnulacion.trim(),
        },
        usuarioIdAudit
      );
      if (!actualizado) {
        throw new ConflictError({
          message: 'No se pudo anular la responsabilidad (posible modificación concurrente).',
        });
      }
      await cliente.query('COMMIT');
      return actualizado;
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

  // ===========================================================================
  // HELPERS DE VALIDACIÓN
  // ===========================================================================

  private validarUuid(val: string, campo: string): void {
    if (!val || !UUID_REGEX.test(val)) {
      throw new ValidationError({
        message: `El parámetro '${campo}' no es un UUID válido.`,
        invalidParams: [{ name: campo, reason: 'UUID v4 inválido o ausente' }],
      });
    }
  }

  private validarFiltroConsulta(filtro?: FiltroConsultaOrg): void {
    if (!filtro) return;
    if (filtro.areaId) this.validarUuid(filtro.areaId, 'areaId');
    if (filtro.idUsuario) this.validarUuid(filtro.idUsuario, 'idUsuario');
    if (filtro.cargoId) this.validarUuid(filtro.cargoId, 'cargoId');
    if (filtro.fechaCorte) {
      const parsed = new Date(filtro.fechaCorte);
      if (isNaN(parsed.getTime())) {
        throw new ValidationError({
          message: 'El parámetro fecha_corte no tiene un formato de fecha válido.',
          invalidParams: [{ name: 'fechaCorte', reason: 'Formato ISO-8601 esperado' }],
        });
      }
    }
  }
}
