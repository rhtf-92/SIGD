/**
 * Servicio de Dominio para Organización y Responsabilidades Temporales (Fase 5C)
 * Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
 */

import type { Pool } from 'pg';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
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
    if (!input.idUsuario && !input.idPersona) {
      throw new ValidationError({
        message: 'Debe especificar al menos un identificador de persona (idPersona) o de cuenta (idUsuario).',
        invalidParams: [{ name: 'idPersona', reason: 'Requerido si no se envía idUsuario' }],
      });
    }

    let idPersonaEfectivo = input.idPersona ?? null;
    let idUsuarioEfectivo = input.idUsuario ?? null;


    if (idUsuarioEfectivo) {
      this.validarUuid(idUsuarioEfectivo, 'idUsuario');
      const cuenta = await this.repo.obtenerCuentaUsuario(this.pool, idUsuarioEfectivo);
      if (!cuenta) {
        throw new NotFoundError({
          message: 'La cuenta de usuario especificada no existe.',
          detail: `id_usuario: ${idUsuarioEfectivo}`,
        });
      }
      if (!cuenta.activo) {
        throw new ConflictError({
          message: 'No se puede asignar un puesto o cargo a una cuenta de usuario inactiva o deshabilitada.',
        });
      }
      idPersonaEfectivo = cuenta.personaId;
    } else if (idPersonaEfectivo) {
      this.validarUuid(idPersonaEfectivo, 'idPersona');
      const { rows: pRows } = await this.pool.query('SELECT id_persona FROM sigd_auth.persona WHERE id_persona = $1::uuid', [idPersonaEfectivo]);
      if (pRows.length === 0) {
        throw new NotFoundError({
          message: 'La persona especificada no existe.',
          detail: `id_persona: ${idPersonaEfectivo}`,
        });
      }
    }

    if (input.idVinculo) {
      this.validarUuid(input.idVinculo, 'idVinculo');
      const { rows: vRows } = await this.pool.query(
        'SELECT id_vinculo, id_persona, estado FROM sigd_auth.vinculo_institucional WHERE id_vinculo = $1::uuid',
        [input.idVinculo]
      );
      if (vRows.length === 0) {
        throw new NotFoundError({
          message: 'El vínculo institucional especificado no existe.',
          detail: `id_vinculo: ${input.idVinculo}`,
        });
      }
      if (idPersonaEfectivo && vRows[0].id_persona !== idPersonaEfectivo) {
        throw new ValidationError({
          message: 'El vínculo institucional no pertenece a la persona asignada.',
          invalidParams: [{ name: 'idVinculo', reason: 'Vínculo pertenece a otra persona' }],
        });
      }
    }

    this.validarUuid(input.cargoId, 'cargoId');
    this.validarUuid(input.areaId, 'areaId');

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
          idUsuario: idUsuarioEfectivo,
          idPersona: idPersonaEfectivo,
          idVinculo: input.idVinculo ?? null,
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

    if (!input.idUsuario && !input.idPersona) {
      throw new ValidationError({
        message: 'Debe especificar al menos un identificador de persona (idPersona) o de cuenta (idUsuario).',
        invalidParams: [{ name: 'idPersona', reason: 'Requerido si no se envía idUsuario' }],
      });
    }

    let idPersonaEfectivo = input.idPersona ?? null;
    let idUsuarioEfectivo = input.idUsuario ?? null;

    let idPersonaAudit: string | null = null;
    if (usuarioIdAudit) {
      this.validarUuid(usuarioIdAudit, 'usuarioIdAudit');
      const cuentaAudit = await this.repo.obtenerCuentaUsuario(this.pool, usuarioIdAudit);
      if (cuentaAudit) {
        idPersonaAudit = cuentaAudit.personaId;
      }
    }

    if (idUsuarioEfectivo) {
      this.validarUuid(idUsuarioEfectivo, 'idUsuario');
      const cuenta = await this.repo.obtenerCuentaUsuario(this.pool, idUsuarioEfectivo);
      if (!cuenta) {
        throw new NotFoundError({
          message: 'La cuenta de usuario designada no existe.',
          detail: `id_usuario: ${idUsuarioEfectivo}`,
        });
      }
      if (!cuenta.activo) {
        throw new ConflictError({
          message: 'No se puede encomendar una responsabilidad temporal a una cuenta de usuario inactiva o deshabilitada.',
        });
      }
      idPersonaEfectivo = cuenta.personaId;
    } else if (idPersonaEfectivo) {
      this.validarUuid(idPersonaEfectivo, 'idPersona');
      const { rows: pRows } = await this.pool.query('SELECT id_persona FROM sigd_auth.persona WHERE id_persona = $1::uuid', [idPersonaEfectivo]);
      if (pRows.length === 0) {
        throw new NotFoundError({
          message: 'La persona designada no existe.',
          detail: `id_persona: ${idPersonaEfectivo}`,
        });
      }
    }

    let titularPersonaIdEfectivo = input.titularPersonaId ?? null;
    let titularUsuarioIdEfectivo = input.titularUsuarioId ?? null;

    if (titularUsuarioIdEfectivo) {
      this.validarUuid(titularUsuarioIdEfectivo, 'titularUsuarioId');
      const titularCuenta = await this.repo.obtenerCuentaUsuario(this.pool, titularUsuarioIdEfectivo);
      if (titularCuenta) {
        titularPersonaIdEfectivo = titularCuenta.personaId;
      }
    }

    this.validarUuid(input.cargoId, 'cargoId');
    this.validarUuid(input.areaId, 'areaId');

    // Regla Anti-Auto-Reemplazo (a nivel de cuenta y a nivel de persona)
    if (input.titularUsuarioId && input.idUsuario && input.titularUsuarioId === input.idUsuario) {
      throw new ValidationError({
        message: 'Un usuario no puede ser titular y reemplazante/suplente de sí mismo simultáneamente.',
        invalidParams: [{ name: 'titularUsuarioId', reason: 'titular y suplente deben ser distintos' }],
      });
    }

    if (input.titularPersonaId && input.idPersona && input.titularPersonaId === input.idPersona) {
      throw new ValidationError({
        message: 'Una persona no puede ser titular y reemplazante/suplente de sí misma simultáneamente.',
        invalidParams: [{ name: 'titularPersonaId', reason: 'titular y suplente deben corresponder a personas distintas' }],
      });
    }

    if (input.titularPersonaId && idPersonaEfectivo && input.titularPersonaId === idPersonaEfectivo) {
      throw new ValidationError({
        message: 'Una persona no puede ser titular y reemplazante/suplente de sí misma simultáneamente.',
        invalidParams: [{ name: 'titularPersonaId', reason: 'titular y suplente corresponden a la misma persona' }],
      });
    }

    if (input.idPersona && titularPersonaIdEfectivo && input.idPersona === titularPersonaIdEfectivo) {
      throw new ValidationError({
        message: 'Una persona no puede ser titular y reemplazante/suplente de sí misma simultáneamente.',
        invalidParams: [{ name: 'idPersona', reason: 'titular y suplente corresponden a la misma persona' }],
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

    // Auditoría de Seguridad: Concesión de facultaFirma (Fail-Closed)
    if (input.alcance && (input.alcance as any).facultaFirma === true) {
      throw new ForbiddenError({
        message: 'Concesión de facultad de firma no autorizada.',
        detail: 'La autoridad institucional para delegar la potestad de firma documental (facultaFirma: true) se encuentra NO_DETERMINADA. Principio de menor privilegio (fail-closed).',
      });
    }

    // Auditoría de Seguridad: Prevención de asignación o encargatura de Dirección General (Fail-Closed)
    const esMismoUsuario = Boolean(
      usuarioIdAudit &&
      idUsuarioEfectivo &&
      idUsuarioEfectivo === usuarioIdAudit
    );

    const esMismaPersona = Boolean(
      idPersonaAudit &&
      idPersonaEfectivo &&
      idPersonaEfectivo === idPersonaAudit
    );

    if (cargo.codigo === 'DIRECTOR') {
      if (esMismoUsuario || esMismaPersona) {
        throw new ForbiddenError({
          message: 'Autoasignación de cargo directivo prohibida.',
          detail: 'No está permitido autoasignarse la responsabilidad temporal del cargo DIRECTOR. Principio de separación de funciones.',
        });
      }
      throw new ForbiddenError({
        message: 'Designación de cargo directivo no autorizada.',
        detail: 'La autoridad institucional para encargar, suplir o delegar el cargo DIRECTOR se encuentra NO_DETERMINADA. El permiso de administración técnica ORGANIZACION_GESTIONAR no confiere potestad para originar autoridad directiva sustantiva.',
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resp = await this.repo.insertarResponsabilidadTemporal(
        cliente,
        {
          tipoResponsabilidad: input.tipoResponsabilidad,
          idUsuario: idUsuarioEfectivo,
          idPersona: idPersonaEfectivo,
          titularUsuarioId: titularUsuarioIdEfectivo,
          titularPersonaId: titularPersonaIdEfectivo,
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

  // ===========================================================================
  // 5. GOBIERNO DE CICLO LABORAL — DESVINCULACIÓN (OFFBOARDING SEGURO)
  // ===========================================================================

  async desvincularPersonal(
    input: {
      idPersona: string;
      idVinculoLaboral: string;
      fechaFin?: string | Date;
      motivo?: string;
    },
    usuarioIdAudit?: string
  ): Promise<{
    idPersona: string;
    idVinculoLaboral: string;
    asignacionesFinalizadas: number;
    responsabilidadesFinalizadas: number;
    perfilesFinalizados: number;
    sesionesRevocadas: number;
  }> {
    this.validarUuid(input.idPersona, 'idPersona');
    this.validarUuid(input.idVinculoLaboral, 'idVinculoLaboral');

    const fechaCese = input.fechaFin ? new Date(input.fechaFin) : new Date();
    const motivoCese = input.motivo ?? 'Cese / Fin de contrato laboral';

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      // 1. Verificar persona
      const { rows: pRows } = await cliente.query(
        'SELECT id_persona FROM sigd_auth.persona WHERE id_persona = $1::uuid',
        [input.idPersona]
      );
      if (pRows.length === 0) {
        throw new NotFoundError({
          message: 'La persona indicada no existe.',
          detail: `id_persona: ${input.idPersona}`,
        });
      }

      // 2. Verificar vínculo laboral (debe ser de categoría PERSONAL_INSTITUCIONAL)
      const { rows: vRows } = await cliente.query(
        `SELECT v.id_vinculo, t.codigo, t.categoria_actor, v.estado
           FROM sigd_auth.vinculo_institucional v
           JOIN sigd_auth.tipo_vinculo_institucional t ON t.id_tipo_vinculo = v.id_tipo_vinculo
          WHERE v.id_vinculo = $1::uuid AND v.id_persona = $2::uuid`,
        [input.idVinculoLaboral, input.idPersona]
      );
      if (vRows.length === 0) {
        throw new NotFoundError({
          message: 'El vínculo institucional indicado no pertenece a la persona o no existe.',
          detail: `id_vinculo: ${input.idVinculoLaboral}`,
        });
      }
      const vinculo = vRows[0];
      if (vinculo.categoria_actor !== 'PERSONAL_INSTITUCIONAL') {
        throw new ValidationError({
          message: `El vínculo seleccionado (${vinculo.codigo}) no es de naturaleza laboral (${vinculo.categoria_actor}).`,
          invalidParams: [{ name: 'idVinculoLaboral', reason: 'Debe ser de categoría PERSONAL_INSTITUCIONAL' }],
        });
      }

      // 3. Finalizar el vínculo laboral (NO afecta vínculos académicos como TITULADO o EGRESADO)
      await cliente.query(
        `UPDATE sigd_auth.vinculo_institucional
             SET estado = 'FINALIZADO',
                 vigente_hasta = $2,
                 motivo_finalizacion = $3,
                 actualizado_en = now()
           WHERE id_vinculo = $1::uuid`,
        [input.idVinculoLaboral, fechaCese, motivoCese]
      );

      // 4. Finalizar asignaciones ordinarias de personal activas
      const resAsigs = await cliente.query(
        `UPDATE sigd_org.asignacion_personal
             SET estado = 'FINALIZADO',
                 vigente_hasta = $2,
                 motivo_finalizacion = $3,
                 actualizado_en = now()
           WHERE (id_persona = $1::uuid OR id_usuario IN (SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_persona = $1::uuid))
             AND estado = 'ACTIVO'`,
        [input.idPersona, fechaCese, motivoCese]
      );

      // 5. Finalizar responsabilidades temporales activas (encargaturas, suplencias, delegaciones)
      const resResps = await cliente.query(
        `UPDATE sigd_org.responsabilidad_temporal
             SET estado = 'FINALIZADO',
                 vigente_hasta = $2,
                 motivo_finalizacion = $3,
                 actualizado_en = now()
           WHERE (id_persona = $1::uuid OR id_usuario IN (SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_persona = $1::uuid))
             AND estado = 'ACTIVO'`,
        [input.idPersona, fechaCese, motivoCese]
      );

      // 6. Finalizar asignaciones de perfiles operativos institucionales
      const resPerfiles = await cliente.query(
        `UPDATE sigd_org.asignacion_perfil_operativo
             SET estado = 'FINALIZADO',
                 vigente_hasta = $2,
                 motivo_finalizacion = $3,
                 actualizado_en = now()
           WHERE id_usuario IN (SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_persona = $1::uuid)
             AND estado = 'ACTIVO'`,
        [input.idPersona, fechaCese, motivoCese]
      );

      // 7. Finalizar roles RBAC vigentes
      await cliente.query(
        `UPDATE sigd_org.usuario_rol
             SET vigente_hasta = $2
           WHERE id_usuario IN (SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_persona = $1::uuid)
             AND (vigente_hasta IS NULL OR vigente_hasta > $2)`,
        [input.idPersona, fechaCese]
      );

      // 8. Revocar sesiones activas registrando motivo y autor (sin DELETE para preservar auditoría)
      const resSesiones = await cliente.query(
        `UPDATE sigd_auth.sesion_usuario
             SET revocado_en = now(),
                 motivo_revocacion = $2,
                 revocado_por = $3
           WHERE id_usuario IN (SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_persona = $1::uuid)
             AND revocado_en IS NULL`,
        [input.idPersona, motivoCese, usuarioIdAudit ?? null]
      );

      await cliente.query('COMMIT');

      return {
        idPersona: input.idPersona,
        idVinculoLaboral: input.idVinculoLaboral,
        asignacionesFinalizadas: resAsigs.rowCount ?? 0,
        responsabilidadesFinalizadas: resResps.rowCount ?? 0,
        perfilesFinalizados: resPerfiles.rowCount ?? 0,
        sesionesRevocadas: resSesiones.rowCount ?? 0,
      };
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

}
