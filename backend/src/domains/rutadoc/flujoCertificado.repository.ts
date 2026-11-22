import type { Pool, PoolClient } from 'pg';
import type { EstadoFlujoCertificado, EventoFlujoCertificado } from './flujoCertificado.fsm.js';

export type DbClient = Pool | PoolClient;

export type CanalEntregaCertificado = 'DIGITAL' | 'PRESENCIAL';
export type ModalidadEvaluacion = 'PRESENCIAL' | 'VIRTUAL' | 'MIXTA';
export type AsistenciaEvaluacion = 'ASISTIO' | 'NO_SE_PRESENTO';
export type NivelMcer = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type ResultadoEvaluacion = 'APROBADO' | 'DESAPROBADO' | 'NSP';
export type TipoInformeEvaluacion = 'RESULTADOS' | 'INASISTENCIA_NSP';

export interface FlujoCertificadoRegistro {
  idFlujo: string;
  expedienteId: string;
  codigoProcedimiento: string;
  nombreTramite: string;
  estadoFlujo: EstadoFlujoCertificado;
  canalEntrega: CanalEntregaCertificado;
  requisitosValidados: boolean;
  validadoMpPor: string | null;
  validadoMpEn: string | null;
  especialistaAsignadoUsuarioId: string | null;
  especialistaAsignadoPersonaId: string | null;
  derivadoEspecialistaPor: string | null;
  derivadoEspecialistaEn: string | null;
  fechaEvaluacion: string | null;
  modalidadEvaluacion: ModalidadEvaluacion | null;
  lugarEnlaceEvaluacion: string | null;
  evaluacionObservaciones: string | null;
  evaluacionProgramadaPor: string | null;
  evaluacionProgramadaEn: string | null;
  asistenciaEvaluacion: AsistenciaEvaluacion | null;
  notaEvaluacion: number | null;
  nivelMcer: NivelMcer | null;
  resultadoEvaluacion: ResultadoEvaluacion | null;
  calificacionObservaciones: string | null;
  calificadoPor: string | null;
  calificadoEn: string | null;
  numeroInforme: string | null;
  tipoInforme: TipoInformeEvaluacion | null;
  informeResumen: string | null;
  informeDocumentoId: string | null;
  informeEmitidoPor: string | null;
  informeEmitidoEn: string | null;
  codigoCertificado: string | null;
  selloFirmaSda: string | null;
  certificadoDocumentoId: string | null;
  certificadoEmitidoPor: string | null;
  certificadoEmitidoEn: string | null;
  vistoBuenoDireccion: boolean;
  vistoBuenoPor: string | null;
  vistoBuenoEn: string | null;
  firmaDigitalCvd: string | null;
  firmaDigitalSha256: string | null;
  firmaDigitalDocumentoId: string | null;
  firmaDigitalS3Key: string | null;
  firmadoDigitalPor: string | null;
  firmadoDigitalEn: string | null;
  documentoValido: boolean;
  descargaHabilitada: boolean;
  notificadoEn: string | null;
  plazoRecojoDias: number;
  fechaLimiteRecojo: string | null;
  fechaEntregaPresencial: string | null;
  entregadoADni: string | null;
  entregadoANombre: string | null;
  enCustodia: boolean;
  custodiaUbicacion: Record<string, unknown> | null;
  motivoCierre: string | null;
  creadoEn: string;
  actualizadoEn: string;
  finalizadoEn: string | null;
}

export interface FlujoHistorialRegistro {
  idHistorial: string;
  expedienteId: string;
  secuencia: number;
  estadoAnterior: EstadoFlujoCertificado | null;
  evento: EventoFlujoCertificado;
  estadoNuevo: EstadoFlujoCertificado;
  estadoRutaDocAnterior: string | null;
  estadoRutaDocNuevo: string;
  rolActor: string;
  usuarioActorId: string;
  areaOrigenId: string | null;
  areaDestinoId: string | null;
  idMovimientoRutaDoc: string | null;
  detalle: string | null;
  metadatos: Record<string, unknown>;
  creadoEn: string;
}

export interface CamposActualizablesFlujo {
  canalEntrega?: CanalEntregaCertificado;
  requisitosValidados?: boolean;
  validadoMpPor?: string | null;
  validadoMpEn?: Date | string | null;
  especialistaAsignadoUsuarioId?: string | null;
  especialistaAsignadoPersonaId?: string | null;
  derivadoEspecialistaPor?: string | null;
  derivadoEspecialistaEn?: Date | string | null;
  fechaEvaluacion?: Date | string | null;
  modalidadEvaluacion?: ModalidadEvaluacion | null;
  lugarEnlaceEvaluacion?: string | null;
  evaluacionObservaciones?: string | null;
  evaluacionProgramadaPor?: string | null;
  evaluacionProgramadaEn?: Date | string | null;
  asistenciaEvaluacion?: AsistenciaEvaluacion | null;
  notaEvaluacion?: number | null;
  nivelMcer?: NivelMcer | null;
  resultadoEvaluacion?: ResultadoEvaluacion | null;
  calificacionObservaciones?: string | null;
  calificadoPor?: string | null;
  calificadoEn?: Date | string | null;
  numeroInforme?: string | null;
  tipoInforme?: TipoInformeEvaluacion | null;
  informeResumen?: string | null;
  informeDocumentoId?: string | null;
  informeEmitidoPor?: string | null;
  informeEmitidoEn?: Date | string | null;
  codigoCertificado?: string | null;
  selloFirmaSda?: string | null;
  certificadoDocumentoId?: string | null;
  certificadoEmitidoPor?: string | null;
  certificadoEmitidoEn?: Date | string | null;
  vistoBuenoDireccion?: boolean;
  vistoBuenoPor?: string | null;
  vistoBuenoEn?: Date | string | null;
  firmaDigitalCvd?: string | null;
  firmaDigitalSha256?: string | null;
  firmaDigitalDocumentoId?: string | null;
  firmaDigitalS3Key?: string | null;
  firmadoDigitalPor?: string | null;
  firmadoDigitalEn?: Date | string | null;
  documentoValido?: boolean;
  descargaHabilitada?: boolean;
  notificadoEn?: Date | string | null;
  plazoRecojoDias?: number;
  fechaLimiteRecojo?: Date | string | null;
  fechaEntregaPresencial?: Date | string | null;
  entregadoADni?: string | null;
  entregadoANombre?: string | null;
  enCustodia?: boolean;
  custodiaUbicacion?: Record<string, unknown> | null;
  motivoCierre?: string | null;
  finalizadoEn?: Date | string | null;
}

const COLUMNAS_ACTUALIZABLES: Readonly<Record<keyof CamposActualizablesFlujo, { columna: string; cast?: string }>> = {
  canalEntrega: { columna: 'canal_entrega' },
  requisitosValidados: { columna: 'requisitos_validados' },
  validadoMpPor: { columna: 'validado_mp_por', cast: 'uuid' },
  validadoMpEn: { columna: 'validado_mp_en', cast: 'timestamptz' },
  especialistaAsignadoUsuarioId: { columna: 'especialista_asignado_usuario_id', cast: 'uuid' },
  especialistaAsignadoPersonaId: { columna: 'especialista_asignado_persona_id', cast: 'uuid' },
  derivadoEspecialistaPor: { columna: 'derivado_especialista_por', cast: 'uuid' },
  derivadoEspecialistaEn: { columna: 'derivado_especialista_en', cast: 'timestamptz' },
  fechaEvaluacion: { columna: 'fecha_evaluacion', cast: 'timestamptz' },
  modalidadEvaluacion: { columna: 'modalidad_evaluacion' },
  lugarEnlaceEvaluacion: { columna: 'lugar_enlace_evaluacion' },
  evaluacionObservaciones: { columna: 'evaluacion_observaciones' },
  evaluacionProgramadaPor: { columna: 'evaluacion_programada_por', cast: 'uuid' },
  evaluacionProgramadaEn: { columna: 'evaluacion_programada_en', cast: 'timestamptz' },
  asistenciaEvaluacion: { columna: 'asistencia_evaluacion' },
  notaEvaluacion: { columna: 'nota_evaluacion', cast: 'numeric' },
  nivelMcer: { columna: 'nivel_mcer' },
  resultadoEvaluacion: { columna: 'resultado_evaluacion' },
  calificacionObservaciones: { columna: 'calificacion_observaciones' },
  calificadoPor: { columna: 'calificado_por', cast: 'uuid' },
  calificadoEn: { columna: 'calificado_en', cast: 'timestamptz' },
  numeroInforme: { columna: 'numero_informe' },
  tipoInforme: { columna: 'tipo_informe' },
  informeResumen: { columna: 'informe_resumen' },
  informeDocumentoId: { columna: 'informe_documento_id', cast: 'uuid' },
  informeEmitidoPor: { columna: 'informe_emitido_por', cast: 'uuid' },
  informeEmitidoEn: { columna: 'informe_emitido_en', cast: 'timestamptz' },
  codigoCertificado: { columna: 'codigo_certificado' },
  selloFirmaSda: { columna: 'sello_firma_sda' },
  certificadoDocumentoId: { columna: 'certificado_documento_id', cast: 'uuid' },
  certificadoEmitidoPor: { columna: 'certificado_emitido_por', cast: 'uuid' },
  certificadoEmitidoEn: { columna: 'certificado_emitido_en', cast: 'timestamptz' },
  vistoBuenoDireccion: { columna: 'visto_bueno_direccion' },
  vistoBuenoPor: { columna: 'visto_bueno_por', cast: 'uuid' },
  vistoBuenoEn: { columna: 'visto_bueno_en', cast: 'timestamptz' },
  firmaDigitalCvd: { columna: 'firma_digital_cvd' },
  firmaDigitalSha256: { columna: 'firma_digital_sha256' },
  firmaDigitalDocumentoId: { columna: 'firma_digital_documento_id', cast: 'uuid' },
  firmaDigitalS3Key: { columna: 'firma_digital_s3_key' },
  firmadoDigitalPor: { columna: 'firmado_digital_por', cast: 'uuid' },
  firmadoDigitalEn: { columna: 'firmado_digital_en', cast: 'timestamptz' },
  documentoValido: { columna: 'documento_valido' },
  descargaHabilitada: { columna: 'descarga_habilitada' },
  notificadoEn: { columna: 'notificado_en', cast: 'timestamptz' },
  plazoRecojoDias: { columna: 'plazo_recojo_dias', cast: 'int' },
  fechaLimiteRecojo: { columna: 'fecha_limite_recojo', cast: 'timestamptz' },
  fechaEntregaPresencial: { columna: 'fecha_entrega_presencial', cast: 'timestamptz' },
  entregadoADni: { columna: 'entregado_a_dni' },
  entregadoANombre: { columna: 'entregado_a_nombre' },
  enCustodia: { columna: 'en_custodia' },
  custodiaUbicacion: { columna: 'custodia_ubicacion', cast: 'jsonb' },
  motivoCierre: { columna: 'motivo_cierre' },
  finalizadoEn: { columna: 'finalizado_en', cast: 'timestamptz' },
};

function aIso(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  return new Date(String(valor)).toISOString();
}

function mapearFilaFlujo(r: Record<string, any>): FlujoCertificadoRegistro {
  return {
    idFlujo: r.id_flujo,
    expedienteId: r.expediente_id,
    codigoProcedimiento: r.codigo_procedimiento,
    nombreTramite: r.nombre_tramite,
    estadoFlujo: r.estado_flujo,
    canalEntrega: r.canal_entrega,
    requisitosValidados: Boolean(r.requisitos_validados),
    validadoMpPor: r.validado_mp_por ?? null,
    validadoMpEn: aIso(r.validado_mp_en),
    especialistaAsignadoUsuarioId: r.especialista_asignado_usuario_id ?? null,
    especialistaAsignadoPersonaId: r.especialista_asignado_persona_id ?? null,
    derivadoEspecialistaPor: r.derivado_especialista_por ?? null,
    derivadoEspecialistaEn: aIso(r.derivado_especialista_en),
    fechaEvaluacion: aIso(r.fecha_evaluacion),
    modalidadEvaluacion: r.modalidad_evaluacion ?? null,
    lugarEnlaceEvaluacion: r.lugar_enlace_evaluacion ?? null,
    evaluacionObservaciones: r.evaluacion_observaciones ?? null,
    evaluacionProgramadaPor: r.evaluacion_programada_por ?? null,
    evaluacionProgramadaEn: aIso(r.evaluacion_programada_en),
    asistenciaEvaluacion: r.asistencia_evaluacion ?? null,
    notaEvaluacion: r.nota_evaluacion !== null && r.nota_evaluacion !== undefined ? Number(r.nota_evaluacion) : null,
    nivelMcer: r.nivel_mcer ?? null,
    resultadoEvaluacion: r.resultado_evaluacion ?? null,
    calificacionObservaciones: r.calificacion_observaciones ?? null,
    calificadoPor: r.calificado_por ?? null,
    calificadoEn: aIso(r.calificado_en),
    numeroInforme: r.numero_informe ?? null,
    tipoInforme: r.tipo_informe ?? null,
    informeResumen: r.informe_resumen ?? null,
    informeDocumentoId: r.informe_documento_id ?? null,
    informeEmitidoPor: r.informe_emitido_por ?? null,
    informeEmitidoEn: aIso(r.informe_emitido_en),
    codigoCertificado: r.codigo_certificado ?? null,
    selloFirmaSda: r.sello_firma_sda ?? null,
    certificadoDocumentoId: r.certificado_documento_id ?? null,
    certificadoEmitidoPor: r.certificado_emitido_por ?? null,
    certificadoEmitidoEn: aIso(r.certificado_emitido_en),
    vistoBuenoDireccion: Boolean(r.visto_bueno_direccion),
    vistoBuenoPor: r.visto_bueno_por ?? null,
    vistoBuenoEn: aIso(r.visto_bueno_en),
    firmaDigitalCvd: r.firma_digital_cvd ?? null,
    firmaDigitalSha256: r.firma_digital_sha256 ? String(r.firma_digital_sha256).trim() : null,
    firmaDigitalDocumentoId: r.firma_digital_documento_id ?? null,
    firmaDigitalS3Key: r.firma_digital_s3_key ?? null,
    firmadoDigitalPor: r.firmado_digital_por ?? null,
    firmadoDigitalEn: aIso(r.firmado_digital_en),
    documentoValido: Boolean(r.documento_valido),
    descargaHabilitada: Boolean(r.descarga_habilitada),
    notificadoEn: aIso(r.notificado_en),
    plazoRecojoDias: Number(r.plazo_recojo_dias ?? 30),
    fechaLimiteRecojo: aIso(r.fecha_limite_recojo),
    fechaEntregaPresencial: aIso(r.fecha_entrega_presencial),
    entregadoADni: r.entregado_a_dni ?? null,
    entregadoANombre: r.entregado_a_nombre ?? null,
    enCustodia: Boolean(r.en_custodia),
    custodiaUbicacion: r.custodia_ubicacion ?? null,
    motivoCierre: r.motivo_cierre ?? null,
    creadoEn: aIso(r.creado_en) ?? new Date().toISOString(),
    actualizadoEn: aIso(r.actualizado_en) ?? new Date().toISOString(),
    finalizadoEn: aIso(r.finalizado_en),
  };
}

function mapearFilaHistorial(r: Record<string, any>): FlujoHistorialRegistro {
  return {
    idHistorial: r.id_historial,
    expedienteId: r.expediente_id,
    secuencia: Number(r.secuencia),
    estadoAnterior: r.estado_anterior ?? null,
    evento: r.evento,
    estadoNuevo: r.estado_nuevo,
    estadoRutaDocAnterior: r.estado_rutadoc_anterior ?? null,
    estadoRutaDocNuevo: r.estado_rutadoc_nuevo,
    rolActor: r.rol_actor,
    usuarioActorId: r.usuario_actor_id,
    areaOrigenId: r.area_origen_id ?? null,
    areaDestinoId: r.area_destino_id ?? null,
    idMovimientoRutaDoc: r.id_movimiento_rutadoc ?? null,
    detalle: r.detalle ?? null,
    metadatos: r.metadatos ?? {},
    creadoEn: aIso(r.creado_en) ?? new Date().toISOString(),
  };
}

export class FlujoCertificadoRepository {
  constructor(private readonly pool: Pool) {}

  async obtenerPorExpedienteId(
    expedienteId: string,
    dbParam?: DbClient,
  ): Promise<FlujoCertificadoRegistro | null> {
    const db = dbParam ?? this.pool;
    const { rows } = await db.query<Record<string, any>>(
      `SELECT *
         FROM sigd_rut.expediente_flujo_certificado
        WHERE expediente_id = $1::uuid
        LIMIT 1`,
      [expedienteId],
    );
    return rows.length > 0 ? mapearFilaFlujo(rows[0]) : null;
  }

  async crearFlujo(
    params: {
      expedienteId: string;
      codigoProcedimiento: string;
      nombreTramite: string;
      canalEntrega: CanalEntregaCertificado;
      plazoRecojoDias: number;
    },
    dbParam?: DbClient,
  ): Promise<FlujoCertificadoRegistro> {
    const db = dbParam ?? this.pool;
    const { rows } = await db.query<Record<string, any>>(
      `INSERT INTO sigd_rut.expediente_flujo_certificado (
         expediente_id,
         codigo_procedimiento,
         nombre_tramite,
         estado_flujo,
         canal_entrega,
         plazo_recojo_dias
       ) VALUES ($1::uuid, $2, $3, 'SOLICITUD_INICIADA', $4, $5::int)
       RETURNING *`,
      [
        params.expedienteId,
        params.codigoProcedimiento,
        params.nombreTramite,
        params.canalEntrega,
        params.plazoRecojoDias,
      ],
    );
    return mapearFilaFlujo(rows[0]);
  }

  async actualizarEstadoYCampos(
    expedienteId: string,
    estadoNuevo: EstadoFlujoCertificado,
    campos: CamposActualizablesFlujo,
    dbParam?: DbClient,
  ): Promise<FlujoCertificadoRegistro> {
    const db = dbParam ?? this.pool;
    const clausulas: string[] = ['estado_flujo = $2', 'actualizado_en = now()'];
    const valores: unknown[] = [expedienteId, estadoNuevo];
    let indice = 3;

    for (const [clave, valor] of Object.entries(campos) as Array<[keyof CamposActualizablesFlujo, unknown]>) {
      if (valor === undefined) continue;
      const spec = COLUMNAS_ACTUALIZABLES[clave];
      if (!spec) continue;

      const parametro = spec.cast ? `$${indice}::${spec.cast}` : `$${indice}`;
      clausulas.push(`${spec.columna} = ${parametro}`);

      if (spec.cast === 'jsonb') {
        valores.push(valor === null ? null : JSON.stringify(valor));
      } else if (spec.cast === 'timestamptz' && valor instanceof Date) {
        valores.push(valor.toISOString());
      } else {
        valores.push(valor);
      }
      indice += 1;
    }

    const { rows } = await db.query<Record<string, any>>(
      `UPDATE sigd_rut.expediente_flujo_certificado
          SET ${clausulas.join(', ')}
        WHERE expediente_id = $1::uuid
        RETURNING *`,
      valores,
    );
    return mapearFilaFlujo(rows[0]);
  }

  async registrarHistorial(
    params: {
      expedienteId: string;
      estadoAnterior: EstadoFlujoCertificado | null;
      evento: EventoFlujoCertificado;
      estadoNuevo: EstadoFlujoCertificado;
      estadoRutaDocAnterior: string | null;
      estadoRutaDocNuevo: string;
      rolActor: string;
      usuarioActorId: string;
      areaOrigenId?: string | null;
      areaDestinoId?: string | null;
      idMovimientoRutaDoc?: string | null;
      detalle?: string | null;
      metadatos?: Record<string, unknown>;
    },
    dbParam?: DbClient,
  ): Promise<FlujoHistorialRegistro> {
    const db = dbParam ?? this.pool;
    const { rows } = await db.query<Record<string, any>>(
      `INSERT INTO sigd_rut.expediente_flujo_historial (
         expediente_id,
         secuencia,
         estado_anterior,
         evento,
         estado_nuevo,
         estado_rutadoc_anterior,
         estado_rutadoc_nuevo,
         rol_actor,
         usuario_actor_id,
         area_origen_id,
         area_destino_id,
         id_movimiento_rutadoc,
         detalle,
         metadatos
       ) VALUES (
         $1::uuid,
         COALESCE((SELECT MAX(secuencia) FROM sigd_rut.expediente_flujo_historial WHERE expediente_id = $1::uuid), 0) + 1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8::uuid,
         $9,
         $10,
         $11::uuid,
         $12,
         $13::jsonb
       )
       RETURNING *`,
      [
        params.expedienteId,
        params.estadoAnterior,
        params.evento,
        params.estadoNuevo,
        params.estadoRutaDocAnterior,
        params.estadoRutaDocNuevo,
        params.rolActor,
        params.usuarioActorId,
        params.areaOrigenId ?? null,
        params.areaDestinoId ?? null,
        params.idMovimientoRutaDoc ?? null,
        params.detalle ?? null,
        JSON.stringify(params.metadatos ?? {}),
      ],
    );
    return mapearFilaHistorial(rows[0]);
  }

  async listarHistorial(
    expedienteId: string,
    dbParam?: DbClient,
  ): Promise<FlujoHistorialRegistro[]> {
    const db = dbParam ?? this.pool;
    const { rows } = await db.query<Record<string, any>>(
      `SELECT *
         FROM sigd_rut.expediente_flujo_historial
        WHERE expediente_id = $1::uuid
        ORDER BY secuencia ASC, creado_en ASC`,
      [expedienteId],
    );
    return rows.map(mapearFilaHistorial);
  }
}
