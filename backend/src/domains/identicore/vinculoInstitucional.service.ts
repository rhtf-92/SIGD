import type { Pool } from 'pg';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../shared/domain/errors/index.js';
import { VinculoInstitucionalRepository } from './vinculoInstitucional.repository.js';
import type {
  AnularVinculoInput,
  CrearVinculoInput,
  FiltroVinculosInput,
  FinalizarVinculoInput,
  TipoVinculoInstitucional,
  VinculoInstitucional,
} from './vinculoInstitucional.types.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class VinculoInstitucionalService {
  constructor(
    private readonly pool: Pool,
    private readonly repo: VinculoInstitucionalRepository = new VinculoInstitucionalRepository(),
  ) {}

  async listarCatalogoTipos(): Promise<TipoVinculoInstitucional[]> {
    return this.repo.listarCatalogoTipos(this.pool);
  }

  async crearVinculo(input: CrearVinculoInput): Promise<VinculoInstitucional> {
    if (!input.personaId || !UUID_REGEX.test(input.personaId)) {
      throw new ValidationError({
        message: 'El identificador de persona proporcionado no es un UUID válido.',
        invalidParams: [{ name: 'personaId', reason: 'UUID v4 inválido o ausente' }],
      });
    }

    const existePersona = await this.repo.existePersona(this.pool, input.personaId);
    if (!existePersona) {
      throw new NotFoundError({
        message: 'La persona indicada no existe en el registro del sistema.',
        detail: `No se encontró sigd_auth.persona con id: ${input.personaId}`,
      });
    }

    if (!input.tipoVinculo) {
      throw new ValidationError({
        message: 'Debe especificar el tipo de vínculo institucional.',
        invalidParams: [{ name: 'tipoVinculo', reason: 'Requerido' }],
      });
    }

    const tipoCat = await this.repo.obtenerTipoPorCodigoOId(this.pool, input.tipoVinculo);
    if (!tipoCat || !tipoCat.vigente) {
      throw new ValidationError({
        message: 'El tipo de vínculo institucional indicado no es válido o no está vigente.',
        invalidParams: [{ name: 'tipoVinculo', reason: `Tipo no reconocido: ${input.tipoVinculo}` }],
      });
    }

    const fechaDesde = input.vigenteDesde ? new Date(input.vigenteDesde) : new Date();
    if (isNaN(fechaDesde.getTime())) {
      throw new ValidationError({
        message: 'La fecha vigente_desde proporcionada es inválida.',
        invalidParams: [{ name: 'vigenteDesde', reason: 'Formato de fecha inválido' }],
      });
    }

    let fechaHasta: Date | null = null;
    if (input.vigenteHasta !== undefined && input.vigenteHasta !== null) {
      fechaHasta = new Date(input.vigenteHasta);
      if (isNaN(fechaHasta.getTime())) {
        throw new ValidationError({
          message: 'La fecha vigente_hasta proporcionada es inválida.',
          invalidParams: [{ name: 'vigenteHasta', reason: 'Formato de fecha inválido' }],
        });
      }

      if (fechaHasta.getTime() <= fechaDesde.getTime()) {
        throw new ValidationError({
          message: 'La fecha de fin de vigencia debe ser estrictamente posterior a la fecha de inicio.',
          invalidParams: [
            { name: 'vigenteHasta', reason: 'vigente_hasta debe ser mayor que vigente_desde' },
          ],
        });
      }
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const vinculo = await this.repo.insertarVinculo(cliente, {
        personaId: input.personaId,
        idTipoVinculo: tipoCat.idTipoVinculo,
        vigenteDesde: fechaDesde,
        vigenteHasta: fechaHasta,
        estado: 'ACTIVO',
      });
      await cliente.query('COMMIT');
      return vinculo;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async obtenerVinculoPorId(vinculoId: string): Promise<VinculoInstitucional> {
    if (!vinculoId || !UUID_REGEX.test(vinculoId)) {
      throw new ValidationError({
        message: 'El identificador de vínculo no es un UUID válido.',
        invalidParams: [{ name: 'vinculoId', reason: 'UUID v4 inválido o ausente' }],
      });
    }

    const vinculo = await this.repo.obtenerVinculoPorId(this.pool, vinculoId);
    if (!vinculo) {
      throw new NotFoundError({
        message: 'El vínculo institucional solicitado no existe.',
        detail: `No se encontró vínculo con id: ${vinculoId}`,
      });
    }
    return vinculo;
  }

  async listarVinculosPorPersona(
    personaId: string,
    filtro?: FiltroVinculosInput,
  ): Promise<VinculoInstitucional[]> {
    if (!personaId || !UUID_REGEX.test(personaId)) {
      throw new ValidationError({
        message: 'El identificador de persona no es un UUID válido.',
        invalidParams: [{ name: 'personaId', reason: 'UUID v4 inválido o ausente' }],
      });
    }

    const existePersona = await this.repo.existePersona(this.pool, personaId);
    if (!existePersona) {
      throw new NotFoundError({
        message: 'La persona indicada no existe en el registro del sistema.',
        detail: `No se encontró sigd_auth.persona con id: ${personaId}`,
      });
    }

    if (filtro?.fechaCorte) {
      const parsed = new Date(filtro.fechaCorte);
      if (isNaN(parsed.getTime())) {
        throw new ValidationError({
          message: 'El parámetro fecha_corte no tiene un formato de fecha válido.',
          invalidParams: [{ name: 'fechaCorte', reason: 'Formato de fecha inválido' }],
        });
      }
    }

    return this.repo.listarVinculosPorPersona(this.pool, personaId, filtro);
  }

  async listarMisVinculos(
    usuarioId: string,
    filtro?: FiltroVinculosInput,
  ): Promise<VinculoInstitucional[]> {
    if (!usuarioId || !UUID_REGEX.test(usuarioId)) {
      throw new ValidationError({
        message: 'El identificador de usuario no es un UUID válido.',
        invalidParams: [{ name: 'usuarioId', reason: 'UUID inválido' }],
      });
    }

    const personaId = await this.repo.obtenerPersonaIdPorUsuarioId(this.pool, usuarioId);
    if (!personaId) {
      throw new NotFoundError({
        message: 'La cuenta de usuario no tiene una persona civil vinculada.',
      });
    }

    if (filtro?.fechaCorte) {
      const parsed = new Date(filtro.fechaCorte);
      if (isNaN(parsed.getTime())) {
        throw new ValidationError({
          message: 'El parámetro fecha_corte no tiene un formato de fecha válido.',
          invalidParams: [{ name: 'fechaCorte', reason: 'Formato de fecha inválido' }],
        });
      }
    }

    const vinculos = await this.repo.listarVinculosPorPersona(this.pool, personaId, filtro);
    // Minimización de datos (Ley 29733): no exponer id_usuario administrativo al ciudadano
    return vinculos.map((v) => ({ ...v, anuladoPor: null }));
  }

  async finalizarVinculo(input: FinalizarVinculoInput): Promise<VinculoInstitucional> {
    if (!input.vinculoId || !UUID_REGEX.test(input.vinculoId)) {
      throw new ValidationError({
        message: 'El identificador de vínculo no es un UUID válido.',
        invalidParams: [{ name: 'vinculoId', reason: 'UUID v4 inválido o ausente' }],
      });
    }

    const vinculo = await this.repo.obtenerVinculoPorId(this.pool, input.vinculoId);
    if (!vinculo) {
      throw new NotFoundError({
        message: 'El vínculo institucional indicado no existe.',
        detail: `No existe vínculo con id: ${input.vinculoId}`,
      });
    }

    if (vinculo.estado !== 'ACTIVO') {
      throw new ConflictError({
        message: `El vínculo institucional ya se encuentra ${vinculo.estado.toLowerCase()}.`,
        detail: `Estado actual: ${vinculo.estado}`,
      });
    }

    const fechaFinal = input.fechaFinalizacion ? new Date(input.fechaFinalizacion) : new Date();
    if (isNaN(fechaFinal.getTime())) {
      throw new ValidationError({
        message: 'La fecha de finalización indicada no es válida.',
        invalidParams: [{ name: 'fechaFinalizacion', reason: 'Fecha inválida' }],
      });
    }

    const fechaDesde = new Date(vinculo.vigenteDesde);
    if (fechaFinal.getTime() <= fechaDesde.getTime()) {
      throw new ValidationError({
        message: 'La fecha de finalización debe ser estrictamente posterior al inicio del vínculo.',
        invalidParams: [
          { name: 'fechaFinalizacion', reason: 'fecha_finalizacion debe ser mayor que vigente_desde' },
        ],
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const actualizado = await this.repo.actualizarFinalizacion(cliente, {
        vinculoId: input.vinculoId,
        vigenteHasta: fechaFinal,
        motivoFinalizacion: input.motivoFinalizacion,
      });
      await cliente.query('COMMIT');
      return actualizado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async anularVinculo(input: AnularVinculoInput): Promise<VinculoInstitucional> {
    if (!input.vinculoId || !UUID_REGEX.test(input.vinculoId)) {
      throw new ValidationError({
        message: 'El identificador de vínculo no es un UUID válido.',
        invalidParams: [{ name: 'vinculoId', reason: 'UUID v4 inválido o ausente' }],
      });
    }

    const motivo = (input.motivoAnulacion ?? '').trim();
    if (!motivo) {
      throw new ValidationError({
        message: 'Debe especificar obligatoriamente un motivo para anular el vínculo institucional.',
        invalidParams: [{ name: 'motivoAnulacion', reason: 'Motivo requerido' }],
      });
    }

    const vinculo = await this.repo.obtenerVinculoPorId(this.pool, input.vinculoId);
    if (!vinculo) {
      throw new NotFoundError({
        message: 'El vínculo institucional indicado no existe.',
        detail: `No existe vínculo con id: ${input.vinculoId}`,
      });
    }

    if (vinculo.estado === 'ANULADO') {
      throw new ConflictError({
        message: 'El vínculo institucional ya se encuentra anulado.',
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const actualizado = await this.repo.actualizarAnulacion(cliente, {
        vinculoId: input.vinculoId,
        motivoAnulacion: motivo,
        anuladoPor: input.anuladoPor,
      });
      await cliente.query('COMMIT');
      return actualizado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }
}
