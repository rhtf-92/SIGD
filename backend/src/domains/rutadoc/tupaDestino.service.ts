import type { Pool, PoolClient } from 'pg';
import { NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';
import { EnrutabilidadService } from './enrutabilidad.service.js';

const REGEX_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export interface DestinoTupaCalculado {
  expedienteId: string;
  vinculadoTupa: boolean;
  codigoProcedimiento: string | null;
  versionTupa: string | null;
  unidadReceptoraId: string | null;
  unidadReceptoraCodigo: string | null;
  unidadReceptoraNombre: string | null;
  unidadResponsableId: string | null;
  unidadResponsableCodigo: string | null;
  unidadResponsableNombre: string | null;
  perfilResponsableId: number | null;
  perfilResponsableCodigo: string | null;
  perfilResponsableNombre: string | null;
  unidadResolutivaId: string | null;
  unidadResolutivaCodigo: string | null;
  unidadResolutivaNombre: string | null;
  unidadFinancieraId: string | null;
  unidadFinancieraCodigo: string | null;
  unidadFinancieraNombre: string | null;
  intervencionFinanciera: string | null;
  destinoEnrutable: boolean;
  motivoNoEnrutable: string | null;
}

export interface DestinoProcedimientoCalculado {
  idProcedimiento: string;
  codigoRef: string | null;
  denominacion: string | null;
  versionTupa: string | null;
  generaExpediente: boolean | null;
  unidadReceptoraId: string | null;
  unidadReceptoraCodigo: string | null;
  unidadReceptoraNombre: string | null;
  unidadResponsableId: string | null;
  unidadResponsableCodigo: string | null;
  unidadResponsableNombre: string | null;
  perfilResponsableId: number | null;
  perfilResponsableCodigo: string | null;
  perfilResponsableNombre: string | null;
  unidadResolutivaId: string | null;
  unidadResolutivaCodigo: string | null;
  unidadResolutivaNombre: string | null;
  unidadFinancieraId: string | null;
  unidadFinancieraCodigo: string | null;
  unidadFinancieraNombre: string | null;
  intervencionFinanciera: string | null;
  destinoEnrutable: boolean;
  motivoNoEnrutable: string | null;
}

export class TupaDestinoService {
  constructor(
    private readonly pool: Pool,
    private readonly enrutabilidadService: EnrutabilidadService = new EnrutabilidadService(pool),
  ) {}

  /**
   * Resuelve de forma determinista y versionada el destino técnico configurado en el TUPA
   * para un expediente previamente radicado.
   *
   * Principio de Inmutabilidad Contractual:
   * - Resuelve el procedimiento y versión EXACTOS vinculados al expediente en su radicación.
   * - No consulta simplemente la versión "VIGENTE" del sistema.
   * - Evalúa la enrutabilidad de la unidad responsable mediante EnrutabilidadService (FAIL-CLOSED).
   */
  async resolverDestinoTupa(
    expedienteId: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DestinoTupaCalculado> {
    if (!expedienteId || !REGEX_UUID.test(expedienteId)) {
      throw new ValidationError({
        message: 'El identificador del expediente debe ser un UUID válido.',
      });
    }

    const db = clienteParam ?? this.pool;

    // 1. Validar existencia del expediente
    const expRes = await db.query<{ expediente_id: string }>(
      'SELECT expediente_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid',
      [expedienteId],
    );
    if (expRes.rows.length === 0) {
      throw new NotFoundError({
        message: `El expediente ${expedienteId} no existe.`,
      });
    }

    // 2. Consultar vínculo TUPA histórico exacto y su procedimiento correspondiente
    const vinculoRes = await db.query<{
      vinculo_id: string;
      expediente_id: string;
      codigo_ref: string | null;
      version_tupa: string | null;
      unidad_receptora_id: string | null;
      unidad_receptora_codigo: string | null;
      unidad_receptora_nombre: string | null;
      unidad_responsable_id: string | null;
      unidad_responsable_codigo: string | null;
      unidad_responsable_nombre: string | null;
      perfil_responsable_id: number | null;
      perfil_responsable_codigo: string | null;
      perfil_responsable_nombre: string | null;
      unidad_resolutiva_id: string | null;
      unidad_resolutiva_codigo: string | null;
      unidad_resolutiva_nombre: string | null;
      unidad_financiera_id: string | null;
      unidad_financiera_codigo: string | null;
      unidad_financiera_nombre: string | null;
      intervencion_financiera: string | null;
    }>(
      `SELECT
         v.vinculo_id,
         v.expediente_id,
         COALESCE(v.codigo_ref, tp.codigo_ref) AS codigo_ref,
         COALESCE(v.tupa_codigo, tp.version_codigo) AS version_tupa,
         COALESCE(v.unidad_receptora_id, tp.unidad_receptora_id) AS unidad_receptora_id,
         COALESCE(v.unidad_responsable_id, tp.unidad_responsable_id) AS unidad_responsable_id,
         COALESCE(v.perfil_responsable_id, tp.perfil_responsable_id) AS perfil_responsable_id,
         COALESCE(v.unidad_resolutiva_id, tp.unidad_resolutiva_id) AS unidad_resolutiva_id,
         tp.unidad_financiera_id,
         tp.intervencion_financiera,
         rec.nombre AS unidad_receptora_nombre,
         rec.codigo AS unidad_receptora_codigo,
         resp.nombre AS unidad_responsable_nombre,
         resp.codigo AS unidad_responsable_codigo,
         resol.nombre AS unidad_resolutiva_nombre,
         resol.codigo AS unidad_resolutiva_codigo,
         fin.nombre AS unidad_financiera_nombre,
         fin.codigo AS unidad_financiera_codigo,
         po.codigo AS perfil_responsable_codigo,
         po.nombre AS perfil_responsable_nombre
       FROM sigd_doc.expediente_tupa_vinculo v
       LEFT JOIN LATERAL (
         SELECT p.*, tv2.codigo AS version_codigo, tv2.anio AS version_anio
           FROM sigd_doc.tupa_procedimiento p
           JOIN sigd_doc.tupa_version tv2 ON tv2.id_version = p.id_version
          WHERE (
            (v.tupa_codigo IS NOT NULL AND tv2.codigo = v.tupa_codigo AND (p.codigo_ref = v.codigo_ref OR p.registro_version_id = v.registro_version_id))
            OR (v.tupa_codigo IS NULL AND p.registro_version_id = v.registro_version_id)
          )
          ORDER BY p.activo DESC, p.orden ASC
          LIMIT 1
       ) tp ON TRUE
       LEFT JOIN sigd_org.area rec ON rec.area_id = COALESCE(v.unidad_receptora_id, tp.unidad_receptora_id)
       LEFT JOIN sigd_org.area resp ON resp.area_id = COALESCE(v.unidad_responsable_id, tp.unidad_responsable_id)
       LEFT JOIN sigd_org.area resol ON resol.area_id = COALESCE(v.unidad_resolutiva_id, tp.unidad_resolutiva_id)
       LEFT JOIN sigd_org.area fin ON fin.area_id = tp.unidad_financiera_id
       LEFT JOIN sigd_org.perfil_operativo po ON po.perfil_id = COALESCE(v.perfil_responsable_id, tp.perfil_responsable_id)
       WHERE v.expediente_id = $1::uuid
         AND v.reemplaza_vinculo_id IS NULL
       ORDER BY v.vinculado_en DESC, v.vinculo_id DESC
       LIMIT 1`,
      [expedienteId],
    );

    const fila = vinculoRes.rows[0];

    // Caso A: Expediente no posee vínculo TUPA
    if (!fila) {
      return {
        expedienteId,
        vinculadoTupa: false,
        codigoProcedimiento: null,
        versionTupa: null,
        unidadReceptoraId: null,
        unidadReceptoraCodigo: null,
        unidadReceptoraNombre: null,
        unidadResponsableId: null,
        unidadResponsableCodigo: null,
        unidadResponsableNombre: null,
        perfilResponsableId: null,
        perfilResponsableCodigo: null,
        perfilResponsableNombre: null,
        unidadResolutivaId: null,
        unidadResolutivaCodigo: null,
        unidadResolutivaNombre: null,
        unidadFinancieraId: null,
        unidadFinancieraCodigo: null,
        unidadFinancieraNombre: null,
        intervencionFinanciera: null,
        destinoEnrutable: false,
        motivoNoEnrutable: 'VINCULO_TUPA_NO_ENCONTRADO',
      };
    }

    // Caso B: Vínculo existe pero unidad_responsable_id no está configurada (NULL)
    if (!fila.unidad_responsable_id) {
      return {
        expedienteId,
        vinculadoTupa: true,
        codigoProcedimiento: fila.codigo_ref,
        versionTupa: fila.version_tupa,
        unidadReceptoraId: fila.unidad_receptora_id,
        unidadReceptoraCodigo: fila.unidad_receptora_codigo,
        unidadReceptoraNombre: fila.unidad_receptora_nombre,
        unidadResponsableId: null,
        unidadResponsableCodigo: null,
        unidadResponsableNombre: null,
        perfilResponsableId: fila.perfil_responsable_id,
        perfilResponsableCodigo: fila.perfil_responsable_codigo,
        perfilResponsableNombre: fila.perfil_responsable_nombre,
        unidadResolutivaId: fila.unidad_resolutiva_id,
        unidadResolutivaCodigo: fila.unidad_resolutiva_codigo,
        unidadResolutivaNombre: fila.unidad_resolutiva_nombre,
        unidadFinancieraId: fila.unidad_financiera_id,
        unidadFinancieraCodigo: fila.unidad_financiera_codigo,
        unidadFinancieraNombre: fila.unidad_financiera_nombre,
        intervencionFinanciera: fila.intervencion_financiera,
        destinoEnrutable: false,
        motivoNoEnrutable: 'DESTINO_TUPA_NO_CONFIGURADO',
      };
    }

    // Caso C: Evaluar enrutabilidad operativa mediante EnrutabilidadService
    const mapaEnrutabilidad = await this.enrutabilidadService.evaluarEnrutabilidadAreas(
      [fila.unidad_responsable_id],
      db,
    );
    const evalArea = mapaEnrutabilidad.get(fila.unidad_responsable_id);

    let destinoEnrutable = false;
    let motivoNoEnrutable: string | null = null;

    if (!evalArea || !evalArea.existe) {
      destinoEnrutable = false;
      motivoNoEnrutable = 'DESTINO_TUPA_INVALIDO';
    } else if (!evalArea.vigente) {
      destinoEnrutable = false;
      motivoNoEnrutable = 'DESTINO_TUPA_INACTIVO';
    } else if (!evalArea.enrutable) {
      destinoEnrutable = false;
      motivoNoEnrutable = 'AREA_NO_ENRUTABLE';
    } else {
      destinoEnrutable = true;
      motivoNoEnrutable = null;
    }

    return {
      expedienteId,
      vinculadoTupa: true,
      codigoProcedimiento: fila.codigo_ref,
      versionTupa: fila.version_tupa,
      unidadReceptoraId: fila.unidad_receptora_id,
      unidadReceptoraCodigo: fila.unidad_receptora_codigo,
      unidadReceptoraNombre: fila.unidad_receptora_nombre,
      unidadResponsableId: fila.unidad_responsable_id,
      unidadResponsableCodigo: fila.unidad_responsable_codigo ?? evalArea?.codigo ?? null,
      unidadResponsableNombre: fila.unidad_responsable_nombre ?? evalArea?.nombre ?? null,
      perfilResponsableId: fila.perfil_responsable_id,
      perfilResponsableCodigo: fila.perfil_responsable_codigo,
      perfilResponsableNombre: fila.perfil_responsable_nombre,
      unidadResolutivaId: fila.unidad_resolutiva_id,
      unidadResolutivaCodigo: fila.unidad_resolutiva_codigo,
      unidadResolutivaNombre: fila.unidad_resolutiva_nombre,
      unidadFinancieraId: fila.unidad_financiera_id,
      unidadFinancieraCodigo: fila.unidad_financiera_codigo,
      unidadFinancieraNombre: fila.unidad_financiera_nombre,
      intervencionFinanciera: fila.intervencion_financiera,
      destinoEnrutable,
      motivoNoEnrutable,
    };
  }

  /**
   * Resuelve de forma determinista el destino técnico configurado en el TUPA
   * directamente desde la definición del procedimiento (sin requerir expediente previamente radicado).
   *
   * Principio: RESOLVER DESTINO ≠ AUTORIZAR RADICACIÓN.
   * Un procedimiento con genera_expediente = false conserva su información organizacional
   * y destino técnico en TUPA aunque no abra un expediente documentario en SIGD.
   */
  async resolverDestinoProcedimiento(
    procedimientoId: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DestinoProcedimientoCalculado> {
    if (!procedimientoId || !REGEX_UUID.test(procedimientoId)) {
      throw new ValidationError({
        message: 'El identificador del procedimiento debe ser un UUID válido.',
      });
    }

    const db = clienteParam ?? this.pool;

    const res = await db.query<{
      id_procedimiento: string;
      codigo_ref: string | null;
      denominacion: string | null;
      version_tupa: string | null;
      genera_expediente: boolean | null;
      unidad_receptora_id: string | null;
      unidad_receptora_codigo: string | null;
      unidad_receptora_nombre: string | null;
      unidad_responsable_id: string | null;
      unidad_responsable_codigo: string | null;
      unidad_responsable_nombre: string | null;
      perfil_responsable_id: number | null;
      perfil_responsable_codigo: string | null;
      perfil_responsable_nombre: string | null;
      unidad_resolutiva_id: string | null;
      unidad_resolutiva_codigo: string | null;
      unidad_resolutiva_nombre: string | null;
      unidad_financiera_id: string | null;
      unidad_financiera_codigo: string | null;
      unidad_financiera_nombre: string | null;
      intervencion_financiera: string | null;
    }>(
      `SELECT
         p.id_procedimiento,
         p.codigo_ref,
         p.denominacion,
         tv.codigo AS version_tupa,
         p.genera_expediente,
         p.unidad_receptora_id,
         rec.codigo AS unidad_receptora_codigo,
         rec.nombre AS unidad_receptora_nombre,
         p.unidad_responsable_id,
         resp.codigo AS unidad_responsable_codigo,
         resp.nombre AS unidad_responsable_nombre,
         p.perfil_responsable_id,
         po.codigo AS perfil_responsable_codigo,
         po.nombre AS perfil_responsable_nombre,
         p.unidad_resolutiva_id,
         resol.codigo AS unidad_resolutiva_codigo,
         resol.nombre AS unidad_resolutiva_nombre,
         p.unidad_financiera_id,
         fin.codigo AS unidad_financiera_codigo,
         fin.nombre AS unidad_financiera_nombre,
         p.intervencion_financiera
       FROM sigd_doc.tupa_procedimiento p
       JOIN sigd_doc.tupa_version tv ON tv.id_version = p.id_version
       LEFT JOIN sigd_org.area rec ON rec.area_id = p.unidad_receptora_id
       LEFT JOIN sigd_org.area resp ON resp.area_id = p.unidad_responsable_id
       LEFT JOIN sigd_org.area resol ON resol.area_id = p.unidad_resolutiva_id
       LEFT JOIN sigd_org.area fin ON fin.area_id = p.unidad_financiera_id
       LEFT JOIN sigd_org.perfil_operativo po ON po.perfil_id = p.perfil_responsable_id
      WHERE p.id_procedimiento = $1::uuid`,
      [procedimientoId],
    );

    const fila = res.rows[0];
    if (!fila) {
      throw new NotFoundError({
        message: `El procedimiento TUPA ${procedimientoId} no existe.`,
      });
    }

    if (!fila.unidad_responsable_id) {
      return {
        idProcedimiento: fila.id_procedimiento,
        codigoRef: fila.codigo_ref,
        denominacion: fila.denominacion,
        versionTupa: fila.version_tupa,
        generaExpediente: fila.genera_expediente,
        unidadReceptoraId: fila.unidad_receptora_id,
        unidadReceptoraCodigo: fila.unidad_receptora_codigo,
        unidadReceptoraNombre: fila.unidad_receptora_nombre,
        unidadResponsableId: null,
        unidadResponsableCodigo: null,
        unidadResponsableNombre: null,
        perfilResponsableId: null,
        perfilResponsableCodigo: null,
        perfilResponsableNombre: null,
        unidadResolutivaId: fila.unidad_resolutiva_id,
        unidadResolutivaCodigo: fila.unidad_resolutiva_codigo,
        unidadResolutivaNombre: fila.unidad_resolutiva_nombre,
        unidadFinancieraId: fila.unidad_financiera_id,
        unidadFinancieraCodigo: fila.unidad_financiera_codigo,
        unidadFinancieraNombre: fila.unidad_financiera_nombre,
        intervencionFinanciera: fila.intervencion_financiera,
        destinoEnrutable: false,
        motivoNoEnrutable: 'DESTINO_TUPA_NO_CONFIGURADO',
      };
    }

    const enrutabilidad = await this.enrutabilidadService.evaluarEnrutabilidadArea(
      fila.unidad_responsable_id,
      db,
    );

    return {
      idProcedimiento: fila.id_procedimiento,
      codigoRef: fila.codigo_ref,
      denominacion: fila.denominacion,
      versionTupa: fila.version_tupa,
      generaExpediente: fila.genera_expediente,
      unidadReceptoraId: fila.unidad_receptora_id,
      unidadReceptoraCodigo: fila.unidad_receptora_codigo,
      unidadReceptoraNombre: fila.unidad_receptora_nombre,
      unidadResponsableId: fila.unidad_responsable_id,
      unidadResponsableCodigo: fila.unidad_responsable_codigo,
      unidadResponsableNombre: fila.unidad_responsable_nombre,
      perfilResponsableId: fila.perfil_responsable_id ? Number(fila.perfil_responsable_id) : null,
      perfilResponsableCodigo: fila.perfil_responsable_codigo,
      perfilResponsableNombre: fila.perfil_responsable_nombre,
      unidadResolutivaId: fila.unidad_resolutiva_id,
      unidadResolutivaCodigo: fila.unidad_resolutiva_codigo,
      unidadResolutivaNombre: fila.unidad_resolutiva_nombre,
      unidadFinancieraId: fila.unidad_financiera_id,
      unidadFinancieraCodigo: fila.unidad_financiera_codigo,
      unidadFinancieraNombre: fila.unidad_financiera_nombre,
      intervencionFinanciera: fila.intervencion_financiera,
      destinoEnrutable: enrutabilidad.enrutable,
      motivoNoEnrutable: enrutabilidad.enrutable ? null : (enrutabilidad.motivo ?? null),
    };
  }
}
