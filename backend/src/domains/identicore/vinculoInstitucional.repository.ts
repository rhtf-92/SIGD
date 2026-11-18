import type { Pool, PoolClient } from 'pg';
import { ConflictError } from '../../shared/domain/errors/index.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import type {
  CategoriaActor,
  EstadoVinculo,
  FiltroVinculosInput,
  TipoVinculoInstitucional,
  VinculoInstitucional,
} from './vinculoInstitucional.types.js';

interface FilaTipoVinculo {
  id_tipo_vinculo: number;
  codigo: string;
  nombre: string;
  categoria_actor: string;
  descripcion: string | null;
  vigente: boolean;
  creado_en: Date;
}

interface FilaVinculo {
  id_vinculo: string;
  id_persona: string;
  id_tipo_vinculo: number;
  codigo_tipo: string;
  nombre_tipo: string;
  categoria_actor: string;
  estado: string;
  vigente_desde: Date;
  vigente_hasta: Date | null;
  motivo_finalizacion: string | null;
  motivo_anulacion: string | null;
  anulado_en: Date | null;
  anulado_por: string | null;
  creado_en: Date;
  actualizado_en: Date;
}

function aIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  try {
    return new Date(val as string).toISOString();
  } catch {
    return String(val);
  }
}

function aIsoStringNullable(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  try {
    return new Date(val as string).toISOString();
  } catch {
    return String(val);
  }
}

function mapearTipoVinculo(fila: FilaTipoVinculo): TipoVinculoInstitucional {
  return {
    idTipoVinculo: fila.id_tipo_vinculo,
    codigo: fila.codigo,
    nombre: fila.nombre,
    categoriaActor: fila.categoria_actor as CategoriaActor,
    descripcion: fila.descripcion,
    vigente: fila.vigente,
    creadoEn: aIsoString(fila.creado_en),
  };
}

function mapearVinculo(fila: FilaVinculo): VinculoInstitucional {
  return {
    idVinculo: fila.id_vinculo,
    idPersona: fila.id_persona,
    idTipoVinculo: fila.id_tipo_vinculo,
    codigoTipo: fila.codigo_tipo,
    nombreTipo: fila.nombre_tipo,
    categoriaActor: fila.categoria_actor as CategoriaActor,
    estado: fila.estado as EstadoVinculo,
    vigenteDesde: aIsoString(fila.vigente_desde),
    vigenteHasta: aIsoStringNullable(fila.vigente_hasta),
    motivoFinalizacion: fila.motivo_finalizacion,
    motivoAnulacion: fila.motivo_anulacion,
    anuladoEn: aIsoStringNullable(fila.anulado_en),
    anuladoPor: fila.anulado_por,
    creadoEn: aIsoString(fila.creado_en),
    actualizadoEn: aIsoString(fila.actualizado_en),
  };
}

export class VinculoInstitucionalRepository {
  async listarCatalogoTipos(cliente: Pool | PoolClient): Promise<TipoVinculoInstitucional[]> {
    const res = await cliente.query<FilaTipoVinculo>(
      `SELECT id_tipo_vinculo, codigo, nombre, categoria_actor, descripcion, vigente, creado_en
         FROM sigd_auth.tipo_vinculo_institucional
        ORDER BY id_tipo_vinculo ASC`,
    );
    return res.rows.map(mapearTipoVinculo);
  }

  async obtenerTipoPorCodigoOId(
    cliente: Pool | PoolClient,
    identificador: string | number,
  ): Promise<TipoVinculoInstitucional | null> {
    const esNumero = typeof identificador === 'number' || /^\d+$/.test(String(identificador));
    const query = esNumero
      ? `SELECT id_tipo_vinculo, codigo, nombre, categoria_actor, descripcion, vigente, creado_en
           FROM sigd_auth.tipo_vinculo_institucional
          WHERE id_tipo_vinculo = $1`
      : `SELECT id_tipo_vinculo, codigo, nombre, categoria_actor, descripcion, vigente, creado_en
           FROM sigd_auth.tipo_vinculo_institucional
          WHERE UPPER(codigo) = UPPER($1)`;

    const res = await cliente.query<FilaTipoVinculo>(query, [identificador]);
    if (res.rows.length === 0) return null;
    return mapearTipoVinculo(res.rows[0]);
  }

  async existePersona(cliente: Pool | PoolClient, personaId: string): Promise<boolean> {
    const res = await cliente.query<{ existe: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM sigd_auth.persona WHERE id_persona = $1) AS existe`,
      [personaId],
    );
    return Boolean(res.rows[0]?.existe);
  }

  async obtenerPersonaIdPorUsuarioId(cliente: Pool | PoolClient, usuarioId: string): Promise<string | null> {
    const res = await cliente.query<{ id_persona: string }>(
      `SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1`,
      [usuarioId],
    );
    return res.rows[0]?.id_persona ?? null;
  }

  async insertarVinculo(
    cliente: PoolClient,
    params: {
      personaId: string;
      idTipoVinculo: number;
      vigenteDesde: Date;
      vigenteHasta: Date | null;
      estado: EstadoVinculo;
    },
  ): Promise<VinculoInstitucional> {
    const res = await cliente.query<FilaVinculo>(
      `INSERT INTO sigd_auth.vinculo_institucional
         (id_persona, id_tipo_vinculo, vigente_desde, vigente_hasta, estado)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         id_vinculo, id_persona, id_tipo_vinculo,
         (SELECT codigo FROM sigd_auth.tipo_vinculo_institucional WHERE id_tipo_vinculo = $2) AS codigo_tipo,
         (SELECT nombre FROM sigd_auth.tipo_vinculo_institucional WHERE id_tipo_vinculo = $2) AS nombre_tipo,
         (SELECT categoria_actor FROM sigd_auth.tipo_vinculo_institucional WHERE id_tipo_vinculo = $2) AS categoria_actor,
         estado, vigente_desde, vigente_hasta, motivo_finalizacion, motivo_anulacion,
         anulado_en, anulado_por, creado_en, actualizado_en`,
      [params.personaId, params.idTipoVinculo, params.vigenteDesde, params.vigenteHasta, params.estado],
    );

    const vinculo = mapearVinculo(res.rows[0]);

    await registrarMutacion(cliente, {
      esquema: 'sigd_auth',
      tabla: 'vinculo_institucional',
      operacion: 'INSERT',
      datos_antes: null,
      datos_despues: vinculo,
    });

    return vinculo;
  }

  async obtenerVinculoPorId(cliente: Pool | PoolClient, vinculoId: string): Promise<VinculoInstitucional | null> {
    const res = await cliente.query<FilaVinculo>(
      `SELECT
         v.id_vinculo, v.id_persona, v.id_tipo_vinculo,
         t.codigo AS codigo_tipo, t.nombre AS nombre_tipo, t.categoria_actor,
         v.estado, v.vigente_desde, v.vigente_hasta, v.motivo_finalizacion,
         v.motivo_anulacion, v.anulado_en, v.anulado_por, v.creado_en, v.actualizado_en
       FROM sigd_auth.vinculo_institucional v
       JOIN sigd_auth.tipo_vinculo_institucional t ON v.id_tipo_vinculo = t.id_tipo_vinculo
       WHERE v.id_vinculo = $1`,
      [vinculoId],
    );
    if (res.rows.length === 0) return null;
    return mapearVinculo(res.rows[0]);
  }

  async listarVinculosPorPersona(
    cliente: Pool | PoolClient,
    personaId: string,
    filtro?: FiltroVinculosInput,
  ): Promise<VinculoInstitucional[]> {
    const params: unknown[] = [personaId];
    let whereClausula = 'WHERE v.id_persona = $1';

    if (filtro?.soloVigentes) {
      const fechaComparar = filtro.fechaCorte ? new Date(filtro.fechaCorte) : new Date();
      params.push(fechaComparar);
      const paramIdx = params.length;
      whereClausula += ` AND v.estado = 'ACTIVO' AND v.vigente_desde <= $${paramIdx} AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= $${paramIdx})`;
    } else if (filtro?.fechaCorte) {
      const fechaComparar = new Date(filtro.fechaCorte);
      params.push(fechaComparar);
      const paramIdx = params.length;
      whereClausula += ` AND v.estado <> 'ANULADO' AND v.vigente_desde <= $${paramIdx} AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= $${paramIdx})`;
    }

    const res = await cliente.query<FilaVinculo>(
      `SELECT
         v.id_vinculo, v.id_persona, v.id_tipo_vinculo,
         t.codigo AS codigo_tipo, t.nombre AS nombre_tipo, t.categoria_actor,
         v.estado, v.vigente_desde, v.vigente_hasta, v.motivo_finalizacion,
         v.motivo_anulacion, v.anulado_en, v.anulado_por, v.creado_en, v.actualizado_en
       FROM sigd_auth.vinculo_institucional v
       JOIN sigd_auth.tipo_vinculo_institucional t ON v.id_tipo_vinculo = t.id_tipo_vinculo
       ${whereClausula}
       ORDER BY v.vigente_desde DESC, v.creado_en DESC`,
      params,
    );

    return res.rows.map(mapearVinculo);
  }

  async actualizarFinalizacion(
    cliente: PoolClient,
    params: {
      vinculoId: string;
      vigenteHasta: Date;
      motivoFinalizacion?: string;
    },
  ): Promise<VinculoInstitucional> {
    const previo = await this.obtenerVinculoPorId(cliente, params.vinculoId);

    const res = await cliente.query<FilaVinculo>(
      `UPDATE sigd_auth.vinculo_institucional
          SET estado = 'FINALIZADO',
              vigente_hasta = $2,
              motivo_finalizacion = $3,
              actualizado_en = now()
        WHERE id_vinculo = $1 AND estado = 'ACTIVO'
        RETURNING
          id_vinculo, id_persona, id_tipo_vinculo,
          (SELECT codigo FROM sigd_auth.tipo_vinculo_institucional WHERE id_tipo_vinculo = vinculo_institucional.id_tipo_vinculo) AS codigo_tipo,
          (SELECT nombre FROM sigd_auth.tipo_vinculo_institucional WHERE id_tipo_vinculo = vinculo_institucional.id_tipo_vinculo) AS nombre_tipo,
          (SELECT categoria_actor FROM sigd_auth.tipo_vinculo_institucional WHERE id_tipo_vinculo = vinculo_institucional.id_tipo_vinculo) AS categoria_actor,
          estado, vigente_desde, vigente_hasta, motivo_finalizacion, motivo_anulacion,
          anulado_en, anulado_por, creado_en, actualizado_en`,
      [params.vinculoId, params.vigenteHasta, params.motivoFinalizacion ?? null],
    );

    if (res.rows.length === 0) {
      throw new ConflictError({
        message: 'El vínculo no pudo ser finalizado porque ya no se encuentra en estado ACTIVO o no existe.',
      });
    }

    const actualizado = mapearVinculo(res.rows[0]);

    await registrarMutacion(cliente, {
      esquema: 'sigd_auth',
      tabla: 'vinculo_institucional',
      operacion: 'UPDATE',
      datos_antes: previo,
      datos_despues: actualizado,
    });

    return actualizado;
  }

  async actualizarAnulacion(
    cliente: PoolClient,
    params: {
      vinculoId: string;
      motivoAnulacion: string;
      anuladoPor?: string;
    },
  ): Promise<VinculoInstitucional> {
    const previo = await this.obtenerVinculoPorId(cliente, params.vinculoId);

    const res = await cliente.query<FilaVinculo>(
      `UPDATE sigd_auth.vinculo_institucional
          SET estado = 'ANULADO',
              motivo_anulacion = $2,
              anulado_en = now(),
              anulado_por = $3,
              actualizado_en = now()
        WHERE id_vinculo = $1 AND estado <> 'ANULADO'
        RETURNING
          id_vinculo, id_persona, id_tipo_vinculo,
          (SELECT codigo FROM sigd_auth.tipo_vinculo_institucional WHERE id_tipo_vinculo = vinculo_institucional.id_tipo_vinculo) AS codigo_tipo,
          (SELECT nombre FROM sigd_auth.tipo_vinculo_institucional WHERE id_tipo_vinculo = vinculo_institucional.id_tipo_vinculo) AS nombre_tipo,
          (SELECT categoria_actor FROM sigd_auth.tipo_vinculo_institucional WHERE id_tipo_vinculo = vinculo_institucional.id_tipo_vinculo) AS categoria_actor,
          estado, vigente_desde, vigente_hasta, motivo_finalizacion, motivo_anulacion,
          anulado_en, anulado_por, creado_en, actualizado_en`,
      [params.vinculoId, params.motivoAnulacion, params.anuladoPor ?? null],
    );

    if (res.rows.length === 0) {
      throw new ConflictError({
        message: 'El vínculo no pudo ser anulado porque ya se encuentra en estado ANULADO o no existe.',
      });
    }

    const actualizado = mapearVinculo(res.rows[0]);

    await registrarMutacion(cliente, {
      esquema: 'sigd_auth',
      tabla: 'vinculo_institucional',
      operacion: 'UPDATE',
      datos_antes: previo,
      datos_despues: actualizado,
    });

    return actualizado;
  }
}
