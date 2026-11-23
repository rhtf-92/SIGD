import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned, validarMagicBytes } from '../../core/storage/s3-storage.service.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { a4GeneratorService } from './a4Generator.service.js';
import type { ContenidoResolucion } from './types.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/domain/errors/index.js';

export const CODIGO_PROCEDIMIENTO_CERTIFICADO_INGLES = 'SUZ26-006';

export interface ModuloInglesAcreditado {
  modulo: string;
  periodo: string;
  horas: number;
  nota: number;
  estado: string;
}

export interface RegistroEstudiosInglesDTO {
  registroEstudioId: string;
  tipoDocumentoIdentidad: string;
  numeroDocumentoIdentidad: string;
  personaId: string | null;
  apellidosNombres: string;
  codigoMatricula: string | null;
  programaEstudios: string;
  modalidadEstudio: string;
  nivelAlcanzado: string;
  ciclosModulosAprobados: ModuloInglesAcreditado[];
  horasAcademicasTotales: number;
  creditosTotales: number | null;
  promedioFinal: number;
  notaMinimaAprobatoria: number;
  fechaInicio: string;
  fechaTermino: string | null;
  culminado: boolean;
  aprobado: boolean;
  numeroActaFinal: string | null;
  estadoAcademico: 'CULMINADO_APROBADO' | 'INCOMPLETO' | 'DESAPROBADO' | 'ANULADO';
  observaciones: string | null;
}

export interface ResumenPagoTesoreriaCertificado {
  estado: 'VERIFICADO' | 'PENDIENTE_PAGO' | 'SIN_ORDEN';
  ordenId: string | null;
  ordenCodigo: string | null;
  importe: string | null;
  moneda: string | null;
  numeroRecibo: string | null;
  verificadoEn: string | null;
}

export interface VerificacionAcademicaInglesDTO {
  verificacionId: string;
  expedienteId: string;
  registroEstudioId: string | null;
  dniVerificado: string;
  culminadoVerificado: boolean;
  aprobadoVerificado: boolean;
  pagoTesoreriaVerificado: boolean;
  numeroReciboTesoreria: string | null;
  numeroActaReferencia: string | null;
  nivelAcreditado: string | null;
  horasAcademicas: number | null;
  promedioFinal: number | null;
  detalleModulosVerificados: ModuloInglesAcreditado[];
  resultado: 'FAVORABLE' | 'OBSERVADO' | 'IMPROCEDENTE';
  observacionesAcademicas: string;
  verificadoPor: string;
  verificadorNombre: string | null;
  verificadoEn: string;
}

export interface CertificadoInglesDTO {
  certificadoId: string;
  expedienteId: string;
  verificacionId: string;
  numeroBorrador: string;
  numeroCertificado: string | null;
  titularNombre: string;
  titularDocumento: string;
  programaOCentro: string;
  nivelEstudios: string;
  modulosAcreditados: ModuloInglesAcreditado[];
  horasAcademicas: number;
  promedioFinal: number;
  periodoEstudios: string;
  numeroActa: string;
  asunto: string;
  estado: 'BORRADOR_PENDIENTE_FIRMA' | 'EN_FIRMA' | 'EMITIDO_FIRMADO' | 'NOTIFICADO' | 'ANULADO';
  documentoAdjuntoId: string | null;
  fechaProyeccion: string;
  firmadoPor: string | null;
  firmanteNombre: string | null;
  firmadoEn: string | null;
  hashPades: string | null;
  cvd: string | null;
}

export interface EstadoCertificadoInglesExpediente {
  esCertificadoIngles: boolean;
  codigoProcedimiento: string | null;
  procedimientoNombre: string | null;
  expediente: {
    expedienteId: string;
    cut: string;
    estadoActual: string;
    areaActualId: string | null;
    areaActualCodigo: string | null;
    solicitanteId: string;
    solicitanteNombre: string;
    solicitanteDocumento: string | null;
  };
  pagoTesoreria: ResumenPagoTesoreriaCertificado;
  checklistObligatorioCompleto: boolean;
  observacionesPendientes: number;
  registrosAcademicosDisponibles: RegistroEstudiosInglesDTO[];
  verificacionAcademica: VerificacionAcademicaInglesDTO | null;
  certificado: CertificadoInglesDTO | null;
}

type ConexionSql = Pick<Pool | PoolClient, 'query'>;

function toIsoStringOrNull(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  const parsed = Date.parse(String(val));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : String(val);
}

function normalizarModulos(raw: unknown): ModuloInglesAcreditado[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const obj = (item ?? {}) as Record<string, unknown>;
    return {
      modulo: String(obj.modulo ?? 'Módulo de Inglés'),
      periodo: String(obj.periodo ?? ''),
      horas: Number(obj.horas ?? 0),
      nota: Number(obj.nota ?? 0),
      estado: String(obj.estado ?? ''),
    };
  });
}

function formatearFechaLargaEspanol(fecha: Date): string {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const limaStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
  const [anio, mes, dia] = limaStr.split('-').map((n) => parseInt(n, 10));
  return `${dia} de ${meses[(mes || 1) - 1]} de ${anio}`;
}

async function subirPdfCertificadoS3(s3Key: string, pdfBytes: Uint8Array): Promise<{ bucket: string; key: string; sha256: string; tamanoBytes: number }> {
  const buffer = Buffer.from(pdfBytes);
  if (!validarMagicBytes(buffer, 'PDF')) {
    throw new Error('El generador A4 no produjo un PDF válido (%PDF-).');
  }
  const config = obtenerConfiguracionS3();
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const putUrl = generarUrlPresigned(s3Key, config, {
    metodo: 'PUT',
    contentType: 'application/pdf',
    expiraSegundos: 120,
  });

  const respuesta = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: new Uint8Array(buffer),
    signal: AbortSignal.timeout(15000),
  });

  if (!respuesta.ok) {
    const errText = await respuesta.text().catch(() => '');
    throw new Error(`No se pudo almacenar el Certificado de Inglés en MinIO/S3 (HTTP ${respuesta.status}): ${errText}`);
  }

  return {
    bucket: config.bucket,
    key: s3Key,
    sha256,
    tamanoBytes: buffer.byteLength,
  };
}

export async function obtenerResumenPagoTesoreria(
  conexion: ConexionSql,
  expedienteId: string,
): Promise<ResumenPagoTesoreriaCertificado> {
  const res = await conexion.query<{
    orden_id: string | null;
    orden_codigo: string | null;
    importe: string | null;
    moneda: string | null;
    pago_estado: string | null;
    numero_recibo: string | null;
    verificado_en: Date | string | null;
    devolucion_activa: boolean;
  }>(
    `SELECT o.id::text AS orden_id,
            o.codigo AS orden_codigo,
            o.importe::text,
            o.moneda::text,
            p.estado AS pago_estado,
            p.numero_recibo::text AS numero_recibo,
            p.verificado_en,
            EXISTS (
              SELECT 1 FROM sigd_tes.devolucion d
               WHERE d.pago_id = p.id AND d.estado <> 'RECHAZADA'
            ) AS devolucion_activa
       FROM sigd_tes.aplicacion_pago a
       JOIN sigd_tes.orden_pago o ON o.id = a.orden_id
       LEFT JOIN sigd_tes.pago p ON p.orden_id = o.id
      WHERE a.expediente_id = $1::uuid
      ORDER BY (p.estado = 'VERIFICADO') DESC NULLS LAST, p.verificado_en DESC NULLS LAST, o.creado_en DESC
      LIMIT 1`,
    [expedienteId],
  );

  if (res.rowCount === 0) {
    return {
      estado: 'SIN_ORDEN',
      ordenId: null,
      ordenCodigo: null,
      importe: null,
      moneda: null,
      numeroRecibo: null,
      verificadoEn: null,
    };
  }

  const row = res.rows[0];
  const verificado = row.pago_estado === 'VERIFICADO' && !row.devolucion_activa;
  return {
    estado: verificado ? 'VERIFICADO' : 'PENDIENTE_PAGO',
    ordenId: row.orden_id,
    ordenCodigo: row.orden_codigo,
    importe: row.importe,
    moneda: row.moneda,
    numeroRecibo: row.numero_recibo,
    verificadoEn: toIsoStringOrNull(row.verificado_en),
  };
}

export async function obtenerEstadoCertificadoInglesExpediente(
  conexion: ConexionSql,
  expedienteId: string,
): Promise<EstadoCertificadoInglesExpediente | null> {
  const expRes = await conexion.query<{
    expediente_id: string;
    cut: string;
    estado_actual: string;
    area_actual_id: string | null;
    area_actual_codigo: string | null;
    solicitante_id: string;
    solicitante_nombre: string;
    solicitante_dni: string | null;
    codigo_tramite: string | null;
    denominacion_tramite: string | null;
  }>(
    `SELECT e.expediente_id::text,
            e.codigo_expediente AS cut,
            COALESCE(ultimo.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual,
            COALESCE(NULLIF(ultimo.area_actual_id, ''), e.area_destino_id::text) AS area_actual_id,
            area_act.codigo AS area_actual_codigo,
            e.solicitante_id::text,
            COALESCE(pn.nombre_completo, TRIM(COALESCE(pn.nombres, '') || ' ' || COALESCE(pn.apellidos, '')), 'Administrado') AS solicitante_nombre,
            COALESCE(NULLIF(p.id_documento, ''), e.dni_solicitante) AS solicitante_dni,
            tt.codigo AS codigo_tramite,
            tt.denominacion AS denominacion_tramite
       FROM sigd_tra.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
       LEFT JOIN sigd_org.area area_act ON area_act.area_id::text = COALESCE(NULLIF(ultimo.area_actual_id, ''), e.area_destino_id::text)
       LEFT JOIN sigd_doc.expediente doc_exp ON doc_exp.expediente_id = e.expediente_id
       LEFT JOIN sigd_doc.tipo_tramite_tupa tt ON tt.tipo_tramite_id = doc_exp.tipo_tramite_id
       LEFT JOIN sigd_auth.persona p ON p.id_persona = e.solicitante_id
       LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
      WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (expRes.rowCount !== 1) {
    return null;
  }

  const exp = expRes.rows[0];
  const esCertificadoIngles = exp.codigo_tramite === CODIGO_PROCEDIMIENTO_CERTIFICADO_INGLES;
  const pagoTesoreria = await obtenerResumenPagoTesoreria(conexion, expedienteId);

  if (!esCertificadoIngles) {
    return {
      esCertificadoIngles: false,
      codigoProcedimiento: exp.codigo_tramite,
      procedimientoNombre: exp.denominacion_tramite,
      expediente: {
        expedienteId: exp.expediente_id,
        cut: exp.cut,
        estadoActual: exp.estado_actual,
        areaActualId: exp.area_actual_id,
        areaActualCodigo: exp.area_actual_codigo,
        solicitanteId: exp.solicitante_id,
        solicitanteNombre: exp.solicitante_nombre,
        solicitanteDocumento: exp.solicitante_dni,
      },
      pagoTesoreria,
      checklistObligatorioCompleto: false,
      observacionesPendientes: 0,
      registrosAcademicosDisponibles: [],
      verificacionAcademica: null,
      certificado: null,
    };
  }

  const checklistRes = await conexion.query<{ faltantes: string; obs_pendientes: string }>(
    `SELECT (
              SELECT COUNT(*)::text
                FROM sigd_doc.expediente doc_exp
                JOIN sigd_doc.requisito r ON r.tipo_tramite_id = doc_exp.tipo_tramite_id AND r.obligatorio = TRUE
                LEFT JOIN sigd_doc.expediente_requisito er
                  ON er.expediente_id = doc_exp.expediente_id AND er.requisito_id = r.requisito_id
               WHERE doc_exp.expediente_id = $1::uuid
                 AND COALESCE(er.cumplido, FALSE) = FALSE
            ) AS faltantes,
            (
              SELECT COUNT(*)::text
                FROM sigd_rut.expediente_observacion o
               WHERE o.expediente_id = $1::uuid AND o.estado = 'PENDIENTE'
            ) AS obs_pendientes`,
    [expedienteId],
  );

  const checklistObligatorioCompleto = Number(checklistRes.rows[0]?.faltantes ?? '0') === 0;
  const observacionesPendientes = Number(checklistRes.rows[0]?.obs_pendientes ?? '0');

  const regRes = await conexion.query<{
    registro_estudio_id: string;
    tipo_documento_identidad: string;
    numero_documento_identidad: string;
    persona_id: string | null;
    apellidos_nombres: string;
    codigo_matricula: string | null;
    programa_estudios: string;
    modalidad_estudio: string;
    nivel_alcanzado: string;
    ciclos_modulos_aprobados: unknown;
    horas_academicas_totales: number;
    creditos_totales: string | null;
    promedio_final: string;
    nota_minima_aprobatoria: string;
    fecha_inicio: string;
    fecha_termino: string | null;
    culminado: boolean;
    aprobado: boolean;
    numero_acta_final: string | null;
    estado_academico: RegistroEstudiosInglesDTO['estadoAcademico'];
    observaciones: string | null;
  }>(
    `SELECT registro_estudio_id::text,
            tipo_documento_identidad,
            numero_documento_identidad,
            persona_id::text,
            apellidos_nombres,
            codigo_matricula,
            programa_estudios,
            modalidad_estudio,
            nivel_alcanzado,
            ciclos_modulos_aprobados,
            horas_academicas_totales,
            creditos_totales::text,
            promedio_final::text,
            nota_minima_aprobatoria::text,
            fecha_inicio::text,
            fecha_termino::text,
            culminado,
            aprobado,
            numero_acta_final,
            estado_academico,
            observaciones
       FROM sigd_doc.registro_estudios_ingles
      WHERE persona_id = $1::uuid
         OR ($2::text IS NOT NULL AND numero_documento_identidad = $2::text)
      ORDER BY (estado_academico = 'CULMINADO_APROBADO') DESC, fecha_inicio DESC`,
    [exp.solicitante_id, exp.solicitante_dni],
  );

  const registrosAcademicosDisponibles: RegistroEstudiosInglesDTO[] = regRes.rows.map((r) => ({
    registroEstudioId: r.registro_estudio_id,
    tipoDocumentoIdentidad: r.tipo_documento_identidad,
    numeroDocumentoIdentidad: r.numero_documento_identidad,
    personaId: r.persona_id,
    apellidosNombres: r.apellidos_nombres,
    codigoMatricula: r.codigo_matricula,
    programaEstudios: r.programa_estudios,
    modalidadEstudio: r.modalidad_estudio,
    nivelAlcanzado: r.nivel_alcanzado,
    ciclosModulosAprobados: normalizarModulos(r.ciclos_modulos_aprobados),
    horasAcademicasTotales: r.horas_academicas_totales,
    creditosTotales: r.creditos_totales ? Number(r.creditos_totales) : null,
    promedioFinal: Number(r.promedio_final),
    notaMinimaAprobatoria: Number(r.nota_minima_aprobatoria),
    fechaInicio: r.fecha_inicio,
    fechaTermino: r.fecha_termino,
    culminado: r.culminado,
    aprobado: r.aprobado,
    numeroActaFinal: r.numero_acta_final,
    estadoAcademico: r.estado_academico,
    observaciones: r.observaciones,
  }));

  const verifRes = await conexion.query<{
    verificacion_id: string;
    expediente_id: string;
    registro_estudio_id: string | null;
    dni_verificado: string;
    culminado_verificado: boolean;
    aprobado_verificado: boolean;
    pago_tesoreria_verificado: boolean;
    numero_recibo_tesoreria: string | null;
    numero_acta_referencia: string | null;
    nivel_acreditado: string | null;
    horas_academicas: number | null;
    promedio_final: string | null;
    detalle_modulos_verificados: unknown;
    resultado: VerificacionAcademicaInglesDTO['resultado'];
    observaciones_academicas: string;
    verificado_por: string;
    verificador_nombre: string | null;
    verificado_en: Date | string;
  }>(
    `SELECT v.verificacion_id::text,
            v.expediente_id::text,
            v.registro_estudio_id::text,
            v.dni_verificado,
            v.culminado_verificado,
            v.aprobado_verificado,
            v.pago_tesoreria_verificado,
            v.numero_recibo_tesoreria,
            v.numero_acta_referencia,
            v.nivel_acreditado,
            v.horas_academicas,
            v.promedio_final::text,
            v.detalle_modulos_verificados,
            v.resultado,
            v.observaciones_academicas,
            v.verificado_por::text,
            COALESCE(pn.nombre_completo, cu.usuario) AS verificador_nombre,
            v.verificado_en
       FROM sigd_doc.verificacion_academica_ingles v
       LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = v.verificado_por
       LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = cu.id_persona
      WHERE v.expediente_id = $1::uuid AND v.vigente = TRUE
      LIMIT 1`,
    [expedienteId],
  );

  const verificacionAcademica: VerificacionAcademicaInglesDTO | null =
    verifRes.rows.length === 1
      ? {
          verificacionId: verifRes.rows[0].verificacion_id,
          expedienteId: verifRes.rows[0].expediente_id,
          registroEstudioId: verifRes.rows[0].registro_estudio_id,
          dniVerificado: verifRes.rows[0].dni_verificado,
          culminadoVerificado: verifRes.rows[0].culminado_verificado,
          aprobadoVerificado: verifRes.rows[0].aprobado_verificado,
          pagoTesoreriaVerificado: verifRes.rows[0].pago_tesoreria_verificado,
          numeroReciboTesoreria: verifRes.rows[0].numero_recibo_tesoreria,
          numeroActaReferencia: verifRes.rows[0].numero_acta_referencia,
          nivelAcreditado: verifRes.rows[0].nivel_acreditado,
          horasAcademicas: verifRes.rows[0].horas_academicas,
          promedioFinal: verifRes.rows[0].promedio_final ? Number(verifRes.rows[0].promedio_final) : null,
          detalleModulosVerificados: normalizarModulos(verifRes.rows[0].detalle_modulos_verificados),
          resultado: verifRes.rows[0].resultado,
          observacionesAcademicas: verifRes.rows[0].observaciones_academicas,
          verificadoPor: verifRes.rows[0].verificado_por,
          verificadorNombre: verifRes.rows[0].verificador_nombre,
          verificadoEn: toIsoStringOrNull(verifRes.rows[0].verificado_en) ?? '',
        }
      : null;

  const certRes = await conexion.query<{
    certificado_id: string;
    expediente_id: string;
    verificacion_id: string;
    numero_borrador: string;
    numero_certificado: string | null;
    titular_nombre: string;
    titular_documento: string;
    programa_o_centro: string;
    nivel_estudios: string;
    modulos_acreditados: unknown;
    horas_academicas: number;
    promedio_final: string;
    periodo_estudios: string;
    numero_acta: string;
    asunto: string;
    estado: CertificadoInglesDTO['estado'];
    documento_adjunto_id: string | null;
    fecha_proyeccion: string;
    firmado_por: string | null;
    firmante_nombre: string | null;
    firmado_en: Date | string | null;
    hash_pades: string | null;
    cvd: string | null;
  }>(
    `SELECT c.certificado_id::text,
            c.expediente_id::text,
            c.verificacion_id::text,
            c.numero_borrador,
            c.numero_certificado,
            c.titular_nombre,
            c.titular_documento,
            c.programa_o_centro,
            c.nivel_estudios,
            c.modulos_acreditados,
            c.horas_academicas,
            c.promedio_final::text,
            c.periodo_estudios,
            c.numero_acta,
            c.asunto,
            c.estado,
            c.documento_adjunto_id::text,
            c.fecha_proyeccion::text,
            c.firmado_por::text,
            COALESCE(pn.nombre_completo, cu.usuario, fd.firmante) AS firmante_nombre,
            c.firmado_en,
            COALESCE(c.hash_pades, fd.sha256_firmado) AS hash_pades,
            fd.cvd
       FROM sigd_doc.certificado_ingles c
       LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = c.firmado_por
       LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = cu.id_persona
       LEFT JOIN sigd_doc.firma_digital_documento fd
         ON fd.documento_id = c.documento_adjunto_id
        AND fd.estado = 'FIRMADO_DIGITALMENTE'
      WHERE c.expediente_id = $1::uuid AND c.estado <> 'ANULADO'
      ORDER BY c.creado_en DESC
      LIMIT 1`,
    [expedienteId],
  );

  const certificado: CertificadoInglesDTO | null =
    certRes.rows.length === 1
      ? {
          certificadoId: certRes.rows[0].certificado_id,
          expedienteId: certRes.rows[0].expediente_id,
          verificacionId: certRes.rows[0].verificacion_id,
          numeroBorrador: certRes.rows[0].numero_borrador,
          numeroCertificado: certRes.rows[0].numero_certificado,
          titularNombre: certRes.rows[0].titular_nombre,
          titularDocumento: certRes.rows[0].titular_documento,
          programaOCentro: certRes.rows[0].programa_o_centro,
          nivelEstudios: certRes.rows[0].nivel_estudios,
          modulosAcreditados: normalizarModulos(certRes.rows[0].modulos_acreditados),
          horasAcademicas: certRes.rows[0].horas_academicas,
          promedioFinal: Number(certRes.rows[0].promedio_final),
          periodoEstudios: certRes.rows[0].periodo_estudios,
          numeroActa: certRes.rows[0].numero_acta,
          asunto: certRes.rows[0].asunto,
          estado: certRes.rows[0].estado,
          documentoAdjuntoId: certRes.rows[0].documento_adjunto_id,
          fechaProyeccion: certRes.rows[0].fecha_proyeccion,
          firmadoPor: certRes.rows[0].firmado_por,
          firmanteNombre: certRes.rows[0].firmante_nombre,
          firmadoEn: toIsoStringOrNull(certRes.rows[0].firmado_en),
          hashPades: certRes.rows[0].hash_pades,
          cvd: certRes.rows[0].cvd,
        }
      : null;

  return {
    esCertificadoIngles: true,
    codigoProcedimiento: exp.codigo_tramite,
    procedimientoNombre: exp.denominacion_tramite,
    expediente: {
      expedienteId: exp.expediente_id,
      cut: exp.cut,
      estadoActual: exp.estado_actual,
      areaActualId: exp.area_actual_id,
      areaActualCodigo: exp.area_actual_codigo,
      solicitanteId: exp.solicitante_id,
      solicitanteNombre: exp.solicitante_nombre,
      solicitanteDocumento: exp.solicitante_dni,
    },
    pagoTesoreria,
    checklistObligatorioCompleto,
    observacionesPendientes,
    registrosAcademicosDisponibles,
    verificacionAcademica,
    certificado,
  };
}

export interface RegistrarVerificacionAcademicaInput {
  registroEstudioId?: string | null;
  resultado: 'FAVORABLE' | 'OBSERVADO' | 'IMPROCEDENTE';
  observacionesAcademicas: string;
}

async function exigirSecretarioEnCustodiaSec(
  cliente: PoolClient,
  expedienteId: string,
  usuarioId: string,
  roles: readonly string[],
): Promise<{ areaSecId: string; estadoActual: string; cut: string; solicitanteId: string; dniSolicitante: string | null }> {
  if (!roles.includes('SECRETARIO') || roles.some((r) => r === 'ADMINISTRADOR' || r === 'CIUDADANO')) {
    throw new ForbiddenError({
      detail: 'Solo Secretaría Académica (SECRETARIO) puede ejecutar la verificación académica y proyección del Certificado de Inglés.',
    });
  }

  const expRes = await cliente.query<{
    expediente_id: string;
    cut: string;
    estado_actual: string;
    area_actual_id: string | null;
    area_actual_codigo: string | null;
    solicitante_id: string;
    solicitante_dni: string | null;
    codigo_tramite: string | null;
  }>(
    `SELECT e.expediente_id::text,
            e.codigo_expediente AS cut,
            COALESCE(ultimo.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual,
            COALESCE(NULLIF(ultimo.area_actual_id, ''), e.area_destino_id::text) AS area_actual_id,
            area_act.codigo AS area_actual_codigo,
            e.solicitante_id::text,
            COALESCE(NULLIF(p.id_documento, ''), e.dni_solicitante) AS solicitante_dni,
            tt.codigo AS codigo_tramite
       FROM sigd_tra.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
       LEFT JOIN sigd_org.area area_act ON area_act.area_id::text = COALESCE(NULLIF(ultimo.area_actual_id, ''), e.area_destino_id::text)
       LEFT JOIN sigd_doc.expediente doc_exp ON doc_exp.expediente_id = e.expediente_id
       LEFT JOIN sigd_doc.tipo_tramite_tupa tt ON tt.tipo_tramite_id = doc_exp.tipo_tramite_id
       LEFT JOIN sigd_auth.persona p ON p.id_persona = e.solicitante_id
      WHERE e.expediente_id = $1::uuid
        FOR UPDATE OF e`,
    [expedienteId],
  );

  if (expRes.rowCount !== 1) {
    throw new NotFoundError({ detail: 'El expediente especificado no existe.' });
  }

  const exp = expRes.rows[0];
  if (exp.codigo_tramite !== CODIGO_PROCEDIMIENTO_CERTIFICADO_INGLES) {
    throw new ConflictError({
      code: 'PROCEDIMIENTO_NO_CORRESPONDE',
      detail: 'La verificación de estudios de inglés y emisión de certificado aplica exclusivamente al procedimiento TUPA SUZ26-006.',
    });
  }

  if (exp.estado_actual !== 'EN_REVISION') {
    throw new ConflictError({
      code: 'ESTADO_INCOMPATIBLE_VERIFICACION',
      detail: `El expediente debe estar formalmente recepcionado y EN_REVISION en Secretaría Académica. Estado actual: ${exp.estado_actual}.`,
    });
  }

  if (exp.area_actual_codigo !== 'SEC' || !exp.area_actual_id) {
    throw new ForbiddenError({
      detail: `El expediente no se encuentra bajo custodia actual de Secretaría Académica (SEC). Área actual: ${exp.area_actual_codigo ?? 'Sin asignar'}.`,
    });
  }

  const adscripcion = await cliente.query<{ autorizado: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM sigd_org.usuario_rol ur
         JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id AND rs.vigente = TRUE
         JOIN sigd_org.rol_permiso rp ON rp.rol_id = rs.rol_id
         JOIN sigd_org.permiso_sistema ps ON ps.permiso_id = rp.permiso_id
        WHERE ur.id_usuario = $1::uuid
          AND rs.codigo = 'SECRETARIO'
          AND ur.area_id = $2::uuid
          AND ur.vigente_desde <= now()
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
          AND ps.codigo IN ('EXPEDIENTE_EVALUAR', 'EXPEDIENTE_RESOLVER', 'RESOLUCION_EMITIR')
     ) AS autorizado`,
    [usuarioId, exp.area_actual_id],
  );

  if (!adscripcion.rows[0]?.autorizado) {
    throw new ForbiddenError({
      detail: 'El usuario no cuenta con asignación vigente de Secretaría Académica sobre el área SEC.',
    });
  }

  return {
    areaSecId: exp.area_actual_id,
    estadoActual: exp.estado_actual,
    cut: exp.cut,
    solicitanteId: exp.solicitante_id,
    dniSolicitante: exp.solicitante_dni,
  };
}

export async function registrarVerificacionAcademicaIngles(
  cliente: PoolClient,
  expedienteId: string,
  usuarioId: string,
  roles: readonly string[],
  datos: RegistrarVerificacionAcademicaInput,
): Promise<VerificacionAcademicaInglesDTO> {
  if (!datos.observacionesAcademicas || datos.observacionesAcademicas.trim().length < 10) {
    throw new ValidationError({
      invalidParams: [{
        name: 'observacionesAcademicas',
        reason: 'Las observaciones de verificación académica deben tener al menos 10 caracteres.',
      }],
    });
  }

  const contextoSec = await exigirSecretarioEnCustodiaSec(cliente, expedienteId, usuarioId, roles);
  const pagoTesoreria = await obtenerResumenPagoTesoreria(cliente, expedienteId);
  const pagoVerificado = pagoTesoreria.estado === 'VERIFICADO';

  let registro: RegistroEstudiosInglesDTO | null = null;
  if (datos.registroEstudioId) {
    const regRes = await cliente.query<{
      registro_estudio_id: string;
      tipo_documento_identidad: string;
      numero_documento_identidad: string;
      persona_id: string | null;
      apellidos_nombres: string;
      codigo_matricula: string | null;
      programa_estudios: string;
      modalidad_estudio: string;
      nivel_alcanzado: string;
      ciclos_modulos_aprobados: unknown;
      horas_academicas_totales: number;
      creditos_totales: string | null;
      promedio_final: string;
      nota_minima_aprobatoria: string;
      fecha_inicio: string;
      fecha_termino: string | null;
      culminado: boolean;
      aprobado: boolean;
      numero_acta_final: string | null;
      estado_academico: RegistroEstudiosInglesDTO['estadoAcademico'];
      observaciones: string | null;
    }>(
      `SELECT registro_estudio_id::text, tipo_documento_identidad, numero_documento_identidad,
              persona_id::text, apellidos_nombres, codigo_matricula, programa_estudios,
              modalidad_estudio, nivel_alcanzado, ciclos_modulos_aprobados,
              horas_academicas_totales, creditos_totales::text, promedio_final::text,
              nota_minima_aprobatoria::text, fecha_inicio::text, fecha_termino::text,
              culminado, aprobado, numero_acta_final, estado_academico, observaciones
         FROM sigd_doc.registro_estudios_ingles
        WHERE registro_estudio_id = $1::uuid`,
      [datos.registroEstudioId],
    );
    if (regRes.rowCount !== 1) {
      throw new NotFoundError({ detail: 'El registro de estudios de inglés seleccionado no existe.' });
    }
    const r = regRes.rows[0];
    const coincideSolicitante =
      (r.persona_id !== null && r.persona_id === contextoSec.solicitanteId) ||
      (contextoSec.dniSolicitante !== null && r.numero_documento_identidad === contextoSec.dniSolicitante);
    if (!coincideSolicitante) {
      throw new ForbiddenError({
        detail: 'El antecedente académico seleccionado no corresponde al titular del expediente.',
      });
    }
    registro = {
      registroEstudioId: r.registro_estudio_id,
      tipoDocumentoIdentidad: r.tipo_documento_identidad,
      numeroDocumentoIdentidad: r.numero_documento_identidad,
      personaId: r.persona_id,
      apellidosNombres: r.apellidos_nombres,
      codigoMatricula: r.codigo_matricula,
      programaEstudios: r.programa_estudios,
      modalidadEstudio: r.modalidad_estudio,
      nivelAlcanzado: r.nivel_alcanzado,
      ciclosModulosAprobados: normalizarModulos(r.ciclos_modulos_aprobados),
      horasAcademicasTotales: r.horas_academicas_totales,
      creditosTotales: r.creditos_totales ? Number(r.creditos_totales) : null,
      promedioFinal: Number(r.promedio_final),
      notaMinimaAprobatoria: Number(r.nota_minima_aprobatoria),
      fechaInicio: r.fecha_inicio,
      fechaTermino: r.fecha_termino,
      culminado: r.culminado,
      aprobado: r.aprobado,
      numeroActaFinal: r.numero_acta_final,
      estadoAcademico: r.estado_academico,
      observaciones: r.observaciones,
    };
  }

  const modulos = registro?.ciclosModulosAprobados ?? [];
  const modulosTodosAprobados = modulos.length > 0 && modulos.every((m) => m.estado.toUpperCase() === 'APROBADO');
  const promedioAprobado = registro !== null && registro.promedioFinal >= registro.notaMinimaAprobatoria;
  const culminadoVerificado = Boolean(registro?.culminado && registro.estadoAcademico === 'CULMINADO_APROBADO');
  const aprobadoVerificado = Boolean(registro?.aprobado && modulosTodosAprobados && promedioAprobado);

  if (datos.resultado === 'FAVORABLE') {
    if (!pagoVerificado) {
      throw new ConflictError({
        code: 'PAGO_TESORERIA_REQUERIDO',
        detail: 'No se puede emitir verificación favorable: el derecho de S/ 100.00 aún no figura como VERIFICADO en Tesorería.',
      });
    }
    const obsRes = await cliente.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM sigd_rut.expediente_observacion WHERE expediente_id = $1::uuid AND estado = 'PENDIENTE'`,
      [expedienteId],
    );
    if (Number(obsRes.rows[0]?.total ?? '0') > 0) {
      throw new ConflictError({
        code: 'OBSERVACIONES_PENDIENTES',
        detail: 'No se puede emitir verificación favorable mientras existan observaciones administrativas pendientes de subsanación.',
      });
    }
    const checklistRes = await cliente.query<{ faltantes: string }>(
      `SELECT COUNT(*)::text AS faltantes
         FROM sigd_doc.expediente doc_exp
         JOIN sigd_doc.requisito r ON r.tipo_tramite_id = doc_exp.tipo_tramite_id AND r.obligatorio = TRUE
         LEFT JOIN sigd_doc.expediente_requisito er
           ON er.expediente_id = doc_exp.expediente_id AND er.requisito_id = r.requisito_id
        WHERE doc_exp.expediente_id = $1::uuid AND COALESCE(er.cumplido, FALSE) = FALSE`,
      [expedienteId],
    );
    if (Number(checklistRes.rows[0]?.faltantes ?? '0') > 0) {
      throw new ConflictError({
        code: 'CHECKLIST_INCOMPLETO',
        detail: 'Debe completar la calificación favorable de los requisitos TUPA obligatorios (FUT y Pago en Tesorería) antes de aprobar la verificación académica.',
      });
    }
    if (!registro || !culminadoVerificado || !aprobadoVerificado) {
      throw new ConflictError({
        code: 'ANTECEDENTE_ACADEMICO_NO_APTO',
        detail: 'Opción A requiere estudios de inglés formalmente CULMINADOS y APROBADOS en el IESTP Suiza. El antecedente seleccionado no acredita ambos requisitos.',
      });
    }
  }

  // Verificar si ya existe un certificado elevado a firma o emitido que impediría cambiar la verificación
  const certActivo = await cliente.query<{ estado: string }>(
    `SELECT estado FROM sigd_doc.certificado_ingles WHERE expediente_id = $1::uuid AND estado <> 'ANULADO' LIMIT 1`,
    [expedienteId],
  );
  if (certActivo.rows[0] && ['EN_FIRMA', 'EMITIDO_FIRMADO', 'NOTIFICADO'].includes(certActivo.rows[0].estado)) {
    throw new ConflictError({
      code: 'CERTIFICADO_EN_DESPACHO_O_FIRMADO',
      detail: `No es posible alterar la verificación académica porque el certificado ya se encuentra en estado ${certActivo.rows[0].estado}.`,
    });
  }

  await cliente.query(
    `UPDATE sigd_doc.verificacion_academica_ingles SET vigente = FALSE WHERE expediente_id = $1::uuid AND vigente = TRUE`,
    [expedienteId],
  );

  const inserted = await cliente.query<{ verificacion_id: string; verificado_en: Date }>(
    `INSERT INTO sigd_doc.verificacion_academica_ingles (
        expediente_id, registro_estudio_id, dni_verificado,
        culminado_verificado, aprobado_verificado, pago_tesoreria_verificado,
        numero_recibo_tesoreria, numero_acta_referencia, nivel_acreditado,
        horas_academicas, promedio_final, detalle_modulos_verificados,
        resultado, observaciones_academicas, verificado_por, vigente
     ) VALUES (
        $1::uuid, $2::uuid, $3,
        $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12::jsonb,
        $13, $14, $15::uuid, TRUE
     ) RETURNING verificacion_id::text, verificado_en`,
    [
      expedienteId,
      registro?.registroEstudioId ?? null,
      registro?.numeroDocumentoIdentidad ?? contextoSec.dniSolicitante ?? 'NO_ESPECIFICADO',
      culminadoVerificado,
      aprobadoVerificado,
      pagoVerificado,
      pagoTesoreria.numeroRecibo,
      registro?.numeroActaFinal ?? null,
      registro?.nivelAlcanzado ?? null,
      registro?.horasAcademicasTotales ?? null,
      registro?.promedioFinal ?? null,
      JSON.stringify(modulos),
      datos.resultado,
      datos.observacionesAcademicas.trim(),
      usuarioId,
    ],
  );

  await registrarMutacion(cliente, {
    esquema: 'sigd_doc',
    tabla: 'verificacion_academica_ingles',
    operacion: 'INSERT',
    usuario_id: usuarioId,
    datos_despues: {
      verificacion_id: inserted.rows[0].verificacion_id,
      expediente_id: expedienteId,
      cut: contextoSec.cut,
      resultado: datos.resultado,
      culminado_verificado: culminadoVerificado,
      aprobado_verificado: aprobadoVerificado,
      pago_tesoreria_verificado: pagoVerificado,
      numero_acta: registro?.numeroActaFinal ?? null,
    },
  });

  const estadoActualizado = await obtenerEstadoCertificadoInglesExpediente(cliente, expedienteId);
  if (!estadoActualizado?.verificacionAcademica) {
    throw new Error('No se pudo recuperar la verificación académica registrada.');
  }
  return estadoActualizado.verificacionAcademica;
}

export async function proyectarCertificadoIngles(
  cliente: PoolClient,
  expedienteId: string,
  usuarioId: string,
  roles: readonly string[],
  datos?: { asunto?: string; periodoEstudios?: string },
): Promise<CertificadoInglesDTO> {
  const contextoSec = await exigirSecretarioEnCustodiaSec(cliente, expedienteId, usuarioId, roles);
  const estadoPrevio = await obtenerEstadoCertificadoInglesExpediente(cliente, expedienteId);
  if (!estadoPrevio) {
    throw new NotFoundError({ detail: 'Expediente no encontrado.' });
  }

  if (estadoPrevio.pagoTesoreria.estado !== 'VERIFICADO') {
    throw new ConflictError({
      code: 'PAGO_TESORERIA_REQUERIDO',
      detail: 'El pago del derecho de tramitación (S/ 100.00) debe estar VERIFICADO en Tesorería para proyectar el certificado.',
    });
  }

  const verif = estadoPrevio.verificacionAcademica;
  if (!verif || verif.resultado !== 'FAVORABLE' || !verif.culminadoVerificado || !verif.aprobadoVerificado) {
    throw new ConflictError({
      code: 'VERIFICACION_ACADEMICA_FAVORABLE_REQUERIDA',
      detail: 'Secretaría Académica debe registrar previamente la Verificación Académica FAVORABLE acreditando estudios de inglés culminados y aprobados en el IESTP Suiza.',
    });
  }

  if (estadoPrevio.certificado && ['EN_FIRMA', 'EMITIDO_FIRMADO', 'NOTIFICADO'].includes(estadoPrevio.certificado.estado)) {
    throw new ConflictError({
      code: 'CERTIFICADO_YA_ELEVADO_O_EMITIDO',
      detail: `El expediente ya cuenta con el certificado ${estadoPrevio.certificado.numeroCertificado || estadoPrevio.certificado.numeroBorrador} en estado ${estadoPrevio.certificado.estado}.`,
    });
  }

  const reg = estadoPrevio.registrosAcademicosDisponibles.find((r) => r.registroEstudioId === verif.registroEstudioId);
  if (!reg) {
    throw new ConflictError({
      code: 'REGISTRO_ACADEMICO_NO_ENCONTRADO',
      detail: 'No se encontró el registro de estudios vinculado a la verificación académica favorable.',
    });
  }

  const tipoDocRes = await cliente.query<{ tipo_documental_id: string }>(
    `SELECT tipo_documental_id::text FROM sigd_doc.tipo_documento WHERE codigo = 'CERTIFICADO_INGLES' AND vigente = TRUE LIMIT 1`,
  );
  const tipoDocId = tipoDocRes.rows[0]?.tipo_documental_id;
  if (!tipoDocId) {
    throw new Error("El tipo documental 'CERTIFICADO_INGLES' no se encuentra configurado en sigd_doc.tipo_documento.");
  }

  const anio = new Date().getFullYear();
  let numeroBorrador = estadoPrevio.certificado?.numeroBorrador;
  if (!numeroBorrador) {
    await cliente.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`secuencia_certificado_ingles_${anio}`]);
    const seqRes = await cliente.query<{ max_correlativo: string }>(
      `SELECT COALESCE(MAX(
         NULLIF(regexp_replace(numero_borrador, '^.*-([0-9]+)$', '\\1'), numero_borrador)::int
       ), 0)::text AS max_correlativo
         FROM sigd_doc.certificado_ingles
        WHERE EXTRACT(YEAR FROM fecha_proyeccion) = $1`,
      [anio],
    );
    const siguiente = (parseInt(seqRes.rows[0]?.max_correlativo ?? '0', 10) || 0) + 1;
    numeroBorrador = `BORR-CERT-ING-${anio}-${String(siguiente).padStart(6, '0')}`;
  }

  const periodoEstudios =
    datos?.periodoEstudios?.trim() ||
    `${reg.fechaInicio} al ${reg.fechaTermino ?? 'Culminado'}`;
  const asunto =
    datos?.asunto?.trim() ||
    `Certificado de Idioma Inglés por estudios culminados y aprobados en el IESTP "Suiza" (${reg.nivelAlcanzado})`;
  const actaAcademica = reg.numeroActaFinal || `ACT-IDI-${anio}`;
  const nombreDirectorRes = await cliente.query<{ nombre: string }>(
    `SELECT COALESCE(pn.nombre_completo, cu.usuario) AS nombre
       FROM sigd_org.facultad_despacho fd
       JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = fd.usuario_id
       LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = cu.id_persona
      WHERE fd.vigente = TRUE
      ORDER BY fd.emitido_en DESC
      LIMIT 1`,
  );
  const nombreDirector = nombreDirectorRes.rows[0]?.nombre || 'Dirección General — IESTP "Suiza"';

  const contenidoPdf: ContenidoResolucion = {
    titulo: 'CERTIFICADO DE IDIOMA INGLÉS',
    subtitulo: `Documento Proyectado N.° ${numeroBorrador} | Expediente ${contextoSec.cut} | TUPA SUZ26-006 (Opción A)`,
    bloques: [
      {
        tipo: 'parrafo',
        alineacion: 'justificado',
        texto: `La Dirección General del Instituto de Educación Superior Tecnológico Público "Suiza" de Pucallpa, de conformidad con la verificación académica institucional emitida por Secretaría Académica (Acta Final N.° ${actaAcademica}) y habiendo acreditado el derecho de tramitación correspondiente (Recibo de Tesorería N.° ${estadoPrevio.pagoTesoreria.numeroRecibo ?? 'VERIFICADO'}), certifica que:`,
      },
      {
        tipo: 'encabezado',
        nivel: 2,
        alineacion: 'centro',
        texto: `${reg.apellidosNombres.toUpperCase()} — DNI N.° ${reg.numeroDocumentoIdentidad}`,
      },
      {
        tipo: 'parrafo',
        alineacion: 'justificado',
        texto: `Ha culminado y aprobado satisfactoriamente los estudios oficiales de Idioma Inglés cursados en el propio IESTP "Suiza" (${reg.programaEstudios}), alcanzando el nivel: ${reg.nivelAlcanzado}, durante el periodo académico ${periodoEstudios}, con un total de ${reg.horasAcademicasTotales} horas académicas y promedio final de ${reg.promedioFinal.toFixed(2)} (escala vigesimal, nota mínima aprobatoria ${reg.notaMinimaAprobatoria.toFixed(2)}).`,
      },
      {
        tipo: 'encabezado',
        nivel: 3,
        alineacion: 'izquierda',
        texto: 'DETALLE DE MÓDULOS Y UNIDADES ACREDITADAS:',
      },
      {
        tipo: 'tabla',
        columnas: ['Módulo / Nivel', 'Periodo', 'Horas', 'Nota', 'Condición'],
        anchosRelativos: [0.36, 0.18, 0.14, 0.14, 0.18],
        filas: reg.ciclosModulosAprobados.map((m) => [
          m.modulo,
          m.periodo,
          String(m.horas),
          Number(m.nota).toFixed(2),
          m.estado,
        ]),
      },
      {
        tipo: 'parrafo',
        alineacion: 'justificado',
        texto: `Se expide el presente certificado oficial a solicitud del interesado(a) para los fines académicos y laborales pertinentes, sujeto a suscripción digital institucional mediante Pasarela ReFirma y verificación pública por Código de Verificación Digital (CVD).`,
      },
      {
        tipo: 'parrafo',
        alineacion: 'derecha',
        texto: `Pucallpa, ${formatearFechaLargaEspanol(new Date())}.`,
      },
      {
        tipo: 'firma',
        alineacion: 'centro',
        cargo: 'Director General del IESTP "Suiza"',
        nombre: nombreDirector,
      },
    ],
  };

  const pdfGenerado = await a4GeneratorService.generar(contenidoPdf, {
    membrete: {
      institucion: 'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"',
      unidad: 'DIRECCIÓN GENERAL — SECRETARÍA ACADÉMICA',
      direccion: 'Av. Centenario Km 5.200 — Pucallpa, Ucayali, Perú',
      tipoDocumento: 'CERTIFICADO DE INGLÉS (TUPA SUZ26-006)',
      numeroDocumento: numeroBorrador,
      correlativo: `${numeroBorrador} | EXP ${contextoSec.cut}`,
      sigla: `IESTP "Suiza" — ${numeroBorrador}`,
    },
  });

  const s3Key = `certificados/${numeroBorrador}.pdf`;
  const subido = await subirPdfCertificadoS3(s3Key, pdfGenerado.bytes);
  const nombreArchivo = `${numeroBorrador}.pdf`;

  let documentoAdjuntoId: string;
  const existentePdf = await cliente.query<{ documento_adjunto_id: string }>(
    `SELECT documento_adjunto_id::text
       FROM sigd_doc.documento_adjunto
      WHERE expediente_id = $1::uuid AND s3_key = $2
      LIMIT 1`,
    [expedienteId, s3Key],
  );

  if (existentePdf.rows[0]) {
    documentoAdjuntoId = existentePdf.rows[0].documento_adjunto_id;
    await cliente.query(
      `UPDATE sigd_doc.documento_adjunto
          SET sha256 = $2, tamano_bytes = $3, nombre_archivo = $4, mime_type = 'application/pdf'
        WHERE documento_adjunto_id = $1::uuid`,
      [documentoAdjuntoId, subido.sha256, subido.tamanoBytes, nombreArchivo],
    );
  } else {
    const adjInsert = await cliente.query<{ documento_adjunto_id: string }>(
      `INSERT INTO sigd_doc.documento_adjunto (
         expediente_id, nombre_archivo, mime_type, tamano_bytes, sha256,
         s3_bucket, s3_key, tipo_documental_id, subido_por
       ) VALUES (
         $1::uuid, $2, 'application/pdf', $3, $4,
         $5, $6, $7::uuid, $8::uuid
       ) RETURNING documento_adjunto_id::text`,
      [
        expedienteId,
        nombreArchivo,
        subido.tamanoBytes,
        subido.sha256,
        subido.bucket,
        subido.key,
        tipoDocId,
        usuarioId,
      ],
    );
    documentoAdjuntoId = adjInsert.rows[0].documento_adjunto_id;

    const folRes = await cliente.query<{ folio_inicio: number }>(
      `SELECT COALESCE(MAX(folio_fin), 0) + 1 AS folio_inicio
         FROM sigd_tra.expediente_documento_folio
        WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    const folioInicio = Number(folRes.rows[0]?.folio_inicio ?? 1);
    const folioFin = folioInicio + Math.max(1, pdfGenerado.paginas) - 1;
    await cliente.query(
      `INSERT INTO sigd_tra.expediente_documento_folio (
         expediente_id, id_documento, folio_inicio, folio_fin, asignado_por
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid)`,
      [expedienteId, documentoAdjuntoId, folioInicio, folioFin, usuarioId],
    );
  }

  let certificadoId: string;
  if (estadoPrevio.certificado) {
    certificadoId = estadoPrevio.certificado.certificadoId;
    await cliente.query(
      `UPDATE sigd_doc.certificado_ingles
          SET verificacion_id = $2::uuid,
              titular_nombre = $3,
              titular_documento = $4,
              programa_o_centro = $5,
              nivel_estudios = $6,
              modulos_acreditados = $7::jsonb,
              horas_academicas = $8,
              promedio_final = $9,
              periodo_estudios = $10,
              numero_acta = $11,
              asunto = $12,
              documento_adjunto_id = $13::uuid,
              proyectado_por = $14::uuid
        WHERE certificado_id = $1::uuid`,
      [
        certificadoId,
        verif.verificacionId,
        reg.apellidosNombres,
        reg.numeroDocumentoIdentidad,
        reg.programaEstudios,
        reg.nivelAlcanzado,
        JSON.stringify(reg.ciclosModulosAprobados),
        reg.horasAcademicasTotales,
        reg.promedioFinal,
        periodoEstudios,
        actaAcademica,
        asunto,
        documentoAdjuntoId,
        usuarioId,
      ],
    );
  } else {
    const certInsert = await cliente.query<{ certificado_id: string }>(
      `INSERT INTO sigd_doc.certificado_ingles (
         expediente_id, verificacion_id, numero_borrador,
         titular_persona_id, titular_nombre, titular_documento,
         programa_o_centro, nivel_estudios, modulos_acreditados,
         horas_academicas, promedio_final, periodo_estudios,
         numero_acta, asunto, estado, documento_adjunto_id, proyectado_por
       ) VALUES (
         $1::uuid, $2::uuid, $3,
         $4::uuid, $5, $6,
         $7, $8, $9::jsonb,
         $10, $11, $12,
         $13, $14, 'BORRADOR_PENDIENTE_FIRMA', $15::uuid, $16::uuid
       ) RETURNING certificado_id::text`,
      [
        expedienteId,
        verif.verificacionId,
        numeroBorrador,
        contextoSec.solicitanteId,
        reg.apellidosNombres,
        reg.numeroDocumentoIdentidad,
        reg.programaEstudios,
        reg.nivelAlcanzado,
        JSON.stringify(reg.ciclosModulosAprobados),
        reg.horasAcademicasTotales,
        reg.promedioFinal,
        periodoEstudios,
        actaAcademica,
        asunto,
        documentoAdjuntoId,
        usuarioId,
      ],
    );
    certificadoId = certInsert.rows[0].certificado_id;
  }

  await registrarMutacion(cliente, {
    esquema: 'sigd_doc',
    tabla: 'certificado_ingles',
    operacion: estadoPrevio.certificado ? 'UPDATE' : 'INSERT',
    usuario_id: usuarioId,
    datos_despues: {
      certificado_id: certificadoId,
      expediente_id: expedienteId,
      cut: contextoSec.cut,
      numero_borrador: numeroBorrador,
      documento_adjunto_id: documentoAdjuntoId,
      sha256: subido.sha256,
      estado: 'BORRADOR_PENDIENTE_FIRMA',
    },
  });

  await insertarEvento(cliente, {
    agregado: 'certificado_ingles',
    tipo_evento: 'CertificadoInglesProyectado',
    payload: {
      identidad: { expediente_id: expedienteId, cut: contextoSec.cut, certificado_id: certificadoId },
      contexto: { usuario_actor_id: usuarioId, area_id: contextoSec.areaSecId },
      datos_especificos: { numero_borrador: numeroBorrador, documento_adjunto_id: documentoAdjuntoId },
    },
  });

  const actualizado = await obtenerEstadoCertificadoInglesExpediente(cliente, expedienteId);
  if (!actualizado?.certificado) {
    throw new Error('No se pudo recuperar el Certificado de Inglés proyectado.');
  }
  return actualizado.certificado;
}
