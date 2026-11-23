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

export const CODIGOS_PROCEDIMIENTO_CERTIFICADO_ESTUDIOS = ['SUZ26-034', 'SUZ26-035'] as const;
export const PROCEDIMIENTO_ID_CERTIFICADO_ESTUDIOS = '3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd';

export interface AsignaturaAcreditada {
  codigo: string;
  nombre: string;
  creditos: number;
  horas: number;
  nota: number;
  estado: string;
}

export interface SemestreAcreditado {
  semestre: string;
  periodo: string;
  creditos: number;
  horas: number;
  promedioSemestre: number;
  asignaturas: AsignaturaAcreditada[];
}

export interface RegistroEstudiosSuperioresDTO {
  registroEstudioId: string;
  tipoDocumentoIdentidad: string;
  numeroDocumentoIdentidad: string;
  personaId: string | null;
  apellidosNombres: string;
  codigoMatricula: string | null;
  programaEstudios: string;
  planEstudios: string;
  periodoIngreso: string;
  periodoEgreso: string | null;
  totalSemestres: number;
  semestresAprobados: SemestreAcreditado[];
  horasAcademicasTotales: number;
  creditosTotales: number;
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

export interface VerificacionAcademicaEstudiosDTO {
  verificacionId: string;
  expedienteId: string;
  registroEstudioId: string | null;
  dniVerificado: string;
  semestresVerificados: number;
  culminadoVerificado: boolean;
  aprobadoVerificado: boolean;
  pagoTesoreriaVerificado: boolean;
  numeroReciboTesoreria: string | null;
  numeroActaReferencia: string | null;
  programaAcreditado: string | null;
  horasAcademicas: number | null;
  creditosTotales: number | null;
  promedioFinal: number | null;
  detalleSemestresVerificados: SemestreAcreditado[];
  resultado: 'FAVORABLE' | 'OBSERVADO' | 'IMPROCEDENTE';
  observacionesAcademicas: string;
  verificadoPor: string;
  verificadorNombre: string | null;
  verificadoEn: string;
  vigente: boolean;
}

export interface CertificadoEstudiosSuperioresDTO {
  certificadoId: string;
  expedienteId: string;
  verificacionId: string;
  numeroBorrador: string;
  numeroCertificado: string | null;
  titularNombre: string;
  titularDocumento: string;
  programaEstudios: string;
  planEstudios: string;
  semestresAcreditados: SemestreAcreditado[];
  horasAcademicas: number;
  creditosTotales: number;
  promedioFinal: number;
  periodoEstudios: string;
  numeroActa: string;
  asunto: string;
  estado: 'BORRADOR_PENDIENTE_FIRMA' | 'EN_FIRMA' | 'EMITIDO_FIRMADO' | 'NOTIFICADO' | 'ANULADO';
  documentoAdjuntoId: string | null;
  proyectadoPor: string;
  fechaProyeccion: string;
  firmadoPor: string | null;
  firmanteNombre?: string | null;
  firmadoEn: string | null;
  hashPades: string | null;
  cvd: string | null;
}

export interface EstadoCertificadoEstudiosExpediente {
  esCertificadoEstudios: boolean;
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
  registrosAcademicosDisponibles: RegistroEstudiosSuperioresDTO[];
  verificacionAcademica: VerificacionAcademicaEstudiosDTO | null;
  certificado: CertificadoEstudiosSuperioresDTO | null;
}

type ConexionSql = Pool | PoolClient;

function toIsoStringOrNull(valor: Date | string | null | undefined): string | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString();
  return String(valor);
}

function normalizarSemestres(raw: unknown): SemestreAcreditado[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const it = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const asignaturasRaw = Array.isArray(it.asignaturas) ? it.asignaturas : [];
    const asignaturas: AsignaturaAcreditada[] = asignaturasRaw.map((a: unknown) => {
      const asig = (typeof a === 'object' && a !== null ? a : {}) as Record<string, unknown>;
      return {
        codigo: String(asig.codigo ?? ''),
        nombre: String(asig.nombre ?? ''),
        creditos: Number(asig.creditos ?? 0),
        horas: Number(asig.horas ?? 0),
        nota: Number(asig.nota ?? 0),
        estado: String(asig.estado ?? 'APROBADO'),
      };
    });
    return {
      semestre: String(it.semestre ?? ''),
      periodo: String(it.periodo ?? ''),
      creditos: Number(it.creditos ?? 0),
      horas: Number(it.horas ?? 0),
      promedioSemestre: Number(it.promedioSemestre ?? 0),
      asignaturas,
    };
  });
}

function formatearFechaEspanol(fecha: Date): string {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
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

async function subirPdfCertificadoS3(
  s3Key: string,
  pdfBytes: Uint8Array,
): Promise<{ bucket: string; key: string; sha256: string; tamanoBytes: number }> {
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
    throw new Error(`No se pudo almacenar el Certificado de Estudios Superiores en MinIO/S3 (HTTP ${respuesta.status}): ${errText}`);
  }

  return {
    bucket: config.bucket,
    key: s3Key,
    sha256,
    tamanoBytes: buffer.byteLength,
  };
}

export async function obtenerResumenPagoTesoreriaEstudios(
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

export async function obtenerEstadoCertificadoEstudiosExpediente(
  conexion: ConexionSql,
  expedienteId: string,
): Promise<EstadoCertificadoEstudiosExpediente | null> {
  const expRes = await conexion.query<{
    expediente_id: string;
    cut: string;
    estado: string;
    area_actual_id: string | null;
    area_codigo: string | null;
    solicitante_id: string;
    solicitante_nombre: string;
    solicitante_documento: string | null;
    tipo_tramite_id: string | null;
    procedimiento_codigo: string | null;
    procedimiento_nombre: string | null;
  }>(
    `SELECT e.expediente_id::text,
            e.codigo_expediente AS cut,
            COALESCE(ultimo.estado_nuevo, e.estado) AS estado,
            COALESCE(ultimo.area_actual_id::text, e.area_actual_id::text) AS area_actual_id,
            a.codigo AS area_codigo,
            e.solicitante_id::text,
            COALESCE(pn.nombre_completo, pj.razon_social, cu.usuario, 'Administrado') AS solicitante_nombre,
            COALESCE(NULLIF(p.id_documento, ''), cu.usuario) AS solicitante_documento,
            e.tipo_tramite_id::text,
            t.codigo AS procedimiento_codigo,
            t.denominacion AS procedimiento_nombre
       FROM sigd_doc.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id::text = e.expediente_id::text
       LEFT JOIN sigd_org.area a ON a.area_id::text = COALESCE(ultimo.area_actual_id::text, e.area_actual_id::text)
       LEFT JOIN sigd_auth.persona p ON p.id_persona = e.solicitante_id
       LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
       LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = e.solicitante_id
       LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_persona = e.solicitante_id
       LEFT JOIN sigd_doc.tipo_tramite_tupa t ON t.tipo_tramite_id = e.tipo_tramite_id
      WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (expRes.rowCount === 0) return null;
  const exp = expRes.rows[0];

  const esCertificado =
    exp.tipo_tramite_id === PROCEDIMIENTO_ID_CERTIFICADO_ESTUDIOS ||
    (exp.procedimiento_codigo !== null &&
      (CODIGOS_PROCEDIMIENTO_CERTIFICADO_ESTUDIOS as readonly string[]).includes(exp.procedimiento_codigo)) ||
    (exp.procedimiento_nombre !== null && /certificado.*estudios.*(6\s*semestres)?/i.test(exp.procedimiento_nombre));

  const pagoTesoreria = await obtenerResumenPagoTesoreriaEstudios(conexion, expedienteId);

  const checklistRes = await conexion.query<{ pendientes: number }>(
    `SELECT COUNT(*)::int AS pendientes
       FROM sigd_doc.requisito r
       JOIN sigd_doc.expediente e ON e.tipo_tramite_id = r.tipo_tramite_id
       LEFT JOIN sigd_doc.expediente_requisito er
         ON er.expediente_id = e.expediente_id AND er.requisito_id = r.requisito_id
      WHERE e.expediente_id = $1::uuid
        AND r.obligatorio = TRUE
        AND r.codigo <> 'COMPROBANTE_PAGO'
        AND COALESCE(er.cumplido, FALSE) = FALSE`,
    [expedienteId],
  );
  const checklistObligatorioCompleto = (checklistRes.rows[0]?.pendientes ?? 0) === 0;

  const obsRes = await conexion.query<{ activas: number }>(
    `SELECT COUNT(*)::int AS activas
       FROM sigd_rut.expediente_observacion
      WHERE expediente_id = $1::uuid AND estado = 'PENDIENTE'`,
    [expedienteId],
  );
  const observacionesPendientes = obsRes.rows[0]?.activas ?? 0;

  const numDoc = exp.solicitante_documento ? exp.solicitante_documento.replace(/\D/g, '') : '';
  const acadRes = await conexion.query<{
    registro_estudio_id: string;
    tipo_documento_identidad: string;
    numero_documento_identidad: string;
    persona_id: string | null;
    apellidos_nombres: string;
    codigo_matricula: string | null;
    programa_estudios: string;
    plan_estudios: string;
    periodo_ingreso: string;
    periodo_egreso: string | null;
    total_semestres: number;
    semestres_aprobados: unknown;
    horas_academicas_totales: number;
    creditos_totales: string;
    promedio_final: string;
    nota_minima_aprobatoria: string;
    fecha_inicio: string;
    fecha_termino: string | null;
    culminado: boolean;
    aprobado: boolean;
    numero_acta_final: string | null;
    estado_academico: 'CULMINADO_APROBADO' | 'INCOMPLETO' | 'DESAPROBADO' | 'ANULADO';
    observaciones: string | null;
  }>(
    `SELECT registro_estudio_id::text,
            tipo_documento_identidad,
            numero_documento_identidad,
            persona_id::text,
            apellidos_nombres,
            codigo_matricula,
            programa_estudios,
            plan_estudios,
            periodo_ingreso,
            periodo_egreso,
            total_semestres,
            semestres_aprobados,
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
       FROM sigd_doc.registro_estudios_superiores
      WHERE persona_id = $1::uuid
         OR (numero_documento_identidad = $2 AND $2 <> '')
      ORDER BY (estado_academico = 'CULMINADO_APROBADO') DESC, fecha_inicio DESC`,
    [exp.solicitante_id, numDoc],
  );

  const registrosAcademicosDisponibles: RegistroEstudiosSuperioresDTO[] = acadRes.rows.map((row) => ({
    registroEstudioId: row.registro_estudio_id,
    tipoDocumentoIdentidad: row.tipo_documento_identidad,
    numeroDocumentoIdentidad: row.numero_documento_identidad,
    personaId: row.persona_id,
    apellidosNombres: row.apellidos_nombres,
    codigoMatricula: row.codigo_matricula,
    programaEstudios: row.programa_estudios,
    planEstudios: row.plan_estudios,
    periodoIngreso: row.periodo_ingreso,
    periodoEgreso: row.periodo_egreso,
    totalSemestres: row.total_semestres,
    semestresAprobados: normalizarSemestres(row.semestres_aprobados),
    horasAcademicasTotales: row.horas_academicas_totales,
    creditosTotales: Number(row.creditos_totales),
    promedioFinal: Number(row.promedio_final),
    notaMinimaAprobatoria: Number(row.nota_minima_aprobatoria),
    fechaInicio: row.fecha_inicio,
    fechaTermino: row.fecha_termino,
    culminado: row.culminado,
    aprobado: row.aprobado,
    numeroActaFinal: row.numero_acta_final,
    estadoAcademico: row.estado_academico,
    observaciones: row.observaciones,
  }));

  const verifRes = await conexion.query<{
    verificacion_id: string;
    expediente_id: string;
    registro_estudio_id: string | null;
    dni_verificado: string;
    semestres_verificados: number;
    culminado_verificado: boolean;
    aprobado_verificado: boolean;
    pago_tesoreria_verificado: boolean;
    numero_recibo_tesoreria: string | null;
    numero_acta_referencia: string | null;
    programa_acreditado: string | null;
    horas_academicas: number | null;
    creditos_totales: string | null;
    promedio_final: string | null;
    detalle_semestres_verificados: unknown;
    resultado: 'FAVORABLE' | 'OBSERVADO' | 'IMPROCEDENTE';
    observaciones_academicas: string;
    verificado_por: string;
    verificador_nombre: string | null;
    verificado_en: Date | string;
    vigente: boolean;
  }>(
    `SELECT v.verificacion_id::text,
            v.expediente_id::text,
            v.registro_estudio_id::text,
            v.dni_verificado,
            v.semestres_verificados,
            v.culminado_verificado,
            v.aprobado_verificado,
            v.pago_tesoreria_verificado,
            v.numero_recibo_tesoreria,
            v.numero_acta_referencia,
            v.programa_acreditado,
            v.horas_academicas,
            v.creditos_totales::text,
            v.promedio_final::text,
            v.detalle_semestres_verificados,
            v.resultado,
            v.observaciones_academicas,
            v.verificado_por::text,
            COALESCE(pn.nombre_completo, cu.usuario) AS verificador_nombre,
            v.verificado_en,
            v.vigente
       FROM sigd_doc.verificacion_academica_estudios v
       LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = v.verificado_por
       LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = cu.id_persona
      WHERE v.expediente_id = $1::uuid AND v.vigente = TRUE
      ORDER BY v.verificado_en DESC
      LIMIT 1`,
    [expedienteId],
  );

  const verificacionAcademica: VerificacionAcademicaEstudiosDTO | null =
    verifRes.rows.length === 1
      ? {
          verificacionId: verifRes.rows[0].verificacion_id,
          expedienteId: verifRes.rows[0].expediente_id,
          registroEstudioId: verifRes.rows[0].registro_estudio_id,
          dniVerificado: verifRes.rows[0].dni_verificado,
          semestresVerificados: verifRes.rows[0].semestres_verificados,
          culminadoVerificado: verifRes.rows[0].culminado_verificado,
          aprobadoVerificado: verifRes.rows[0].aprobado_verificado,
          pagoTesoreriaVerificado: verifRes.rows[0].pago_tesoreria_verificado,
          numeroReciboTesoreria: verifRes.rows[0].numero_recibo_tesoreria,
          numeroActaReferencia: verifRes.rows[0].numero_acta_referencia,
          programaAcreditado: verifRes.rows[0].programa_acreditado,
          horasAcademicas: verifRes.rows[0].horas_academicas,
          creditosTotales: verifRes.rows[0].creditos_totales ? Number(verifRes.rows[0].creditos_totales) : null,
          promedioFinal: verifRes.rows[0].promedio_final ? Number(verifRes.rows[0].promedio_final) : null,
          detalleSemestresVerificados: normalizarSemestres(verifRes.rows[0].detalle_semestres_verificados),
          resultado: verifRes.rows[0].resultado,
          observacionesAcademicas: verifRes.rows[0].observaciones_academicas,
          verificadoPor: verifRes.rows[0].verificado_por,
          verificadorNombre: verifRes.rows[0].verificador_nombre,
          verificadoEn: toIsoStringOrNull(verifRes.rows[0].verificado_en)!,
          vigente: verifRes.rows[0].vigente,
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
    programa_estudios: string;
    plan_estudios: string;
    semestres_acreditados: unknown;
    horas_academicas: number;
    creditos_totales: string;
    promedio_final: string;
    periodo_estudios: string;
    numero_acta: string;
    asunto: string;
    cvd: string | null;
    estado: 'BORRADOR_PENDIENTE_FIRMA' | 'EN_FIRMA' | 'EMITIDO_FIRMADO' | 'NOTIFICADO' | 'ANULADO';
    documento_adjunto_id: string | null;
    proyectado_por: string;
    fecha_proyeccion: string;
    firmado_por: string | null;
    firmante_nombre: string | null;
    firmado_en: Date | string | null;
    hash_pades: string | null;
  }>(
    `SELECT c.certificado_id::text,
            c.expediente_id::text,
            c.verificacion_id::text,
            c.numero_borrador,
            c.numero_certificado,
            c.titular_nombre,
            c.titular_documento,
            c.programa_estudios,
            c.plan_estudios,
            c.semestres_acreditados,
            c.horas_academicas,
            c.creditos_totales::text,
            c.promedio_final::text,
            c.periodo_estudios,
            c.numero_acta,
            c.asunto,
            COALESCE(c.cvd, fd.cvd) AS cvd,
            c.estado,
            c.documento_adjunto_id::text,
            c.proyectado_por::text,
            c.fecha_proyeccion::text,
            c.firmado_por::text,
            COALESCE(pn.nombre_completo, cu.usuario, fd.firmante) AS firmante_nombre,
            c.firmado_en,
            COALESCE(c.hash_pades, fd.sha256_firmado) AS hash_pades
       FROM sigd_doc.certificado_estudios_superiores c
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

  const certificado: CertificadoEstudiosSuperioresDTO | null =
    certRes.rows.length === 1
      ? {
          certificadoId: certRes.rows[0].certificado_id,
          expedienteId: certRes.rows[0].expediente_id,
          verificacionId: certRes.rows[0].verificacion_id,
          numeroBorrador: certRes.rows[0].numero_borrador,
          numeroCertificado: certRes.rows[0].numero_certificado,
          titularNombre: certRes.rows[0].titular_nombre,
          titularDocumento: certRes.rows[0].titular_documento,
          programaEstudios: certRes.rows[0].programa_estudios,
          planEstudios: certRes.rows[0].plan_estudios,
          semestresAcreditados: normalizarSemestres(certRes.rows[0].semestres_acreditados),
          horasAcademicas: certRes.rows[0].horas_academicas,
          creditosTotales: Number(certRes.rows[0].creditos_totales),
          promedioFinal: Number(certRes.rows[0].promedio_final),
          periodoEstudios: certRes.rows[0].periodo_estudios,
          numeroActa: certRes.rows[0].numero_acta,
          asunto: certRes.rows[0].asunto,
          cvd: certRes.rows[0].cvd,
          estado: certRes.rows[0].estado,
          documentoAdjuntoId: certRes.rows[0].documento_adjunto_id,
          proyectadoPor: certRes.rows[0].proyectado_por,
          fechaProyeccion: certRes.rows[0].fecha_proyeccion,
          firmadoPor: certRes.rows[0].firmado_por,
          firmanteNombre: certRes.rows[0].firmante_nombre,
          firmadoEn: toIsoStringOrNull(certRes.rows[0].firmado_en),
          hashPades: certRes.rows[0].hash_pades,
        }
      : null;

  return {
    esCertificadoEstudios: esCertificado,
    codigoProcedimiento: exp.procedimiento_codigo,
    procedimientoNombre: exp.procedimiento_nombre,
    expediente: {
      expedienteId: exp.expediente_id,
      cut: exp.cut,
      estadoActual: exp.estado,
      areaActualId: exp.area_actual_id,
      areaActualCodigo: exp.area_codigo,
      solicitanteId: exp.solicitante_id,
      solicitanteNombre: exp.solicitante_nombre,
      solicitanteDocumento: exp.solicitante_documento,
    },
    pagoTesoreria,
    checklistObligatorioCompleto,
    observacionesPendientes,
    registrosAcademicosDisponibles,
    verificacionAcademica,
    certificado,
  };
}

async function exigirSecretarioEnCustodiaSec(
  conexion: ConexionSql,
  expedienteId: string,
  usuarioId: string,
  roles: readonly string[],
): Promise<{ cut: string; areaSecId: string | null; solicitanteId: string; solicitanteNombre: string; solicitanteDocumento: string }> {
  const tieneRolSecretario = roles.includes('SECRETARIO') || roles.includes('ADMINISTRADOR');
  if (!tieneRolSecretario) {
    throw new ForbiddenError({
      detail: 'Se requiere el rol SECRETARIO (Secretaría Académica) para esta actuación.',
    });
  }

  const expRes = await conexion.query<{
    expediente_id: string;
    codigo_expediente: string;
    area_id: string | null;
    area_codigo: string | null;
    solicitante_id: string;
    solicitante_nombre: string;
    solicitante_documento: string | null;
  }>(
    `SELECT e.expediente_id,
            e.codigo_expediente,
            COALESCE(ultimo.area_actual_id::text, e.area_actual_id::text) AS area_id,
            a.codigo AS area_codigo,
            e.solicitante_id,
            COALESCE(pn.nombre_completo, pj.razon_social, cu.usuario, 'Administrado') AS solicitante_nombre,
            COALESCE(NULLIF(p.id_documento, ''), cu.usuario) AS solicitante_documento
       FROM sigd_doc.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id::text = e.expediente_id::text
       LEFT JOIN sigd_org.area a ON a.area_id::text = COALESCE(ultimo.area_actual_id::text, e.area_actual_id::text)
       LEFT JOIN sigd_auth.persona p ON p.id_persona = e.solicitante_id
       LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
       LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = e.solicitante_id
       LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_persona = e.solicitante_id
      WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (expRes.rowCount === 0) {
    throw new NotFoundError({ detail: 'Expediente no encontrado.' });
  }

  const exp = expRes.rows[0];
  if (exp.area_codigo !== 'SEC' && !roles.includes('ADMINISTRADOR')) {
    throw new ConflictError({
      code: 'EXPEDIENTE_NO_EN_SECRETARIA_ACADEMICA',
      detail: `El expediente se encuentra actualmente en el área '${exp.area_codigo ?? 'SIN_AREA'}'. Debe estar en Secretaría Académica (SEC) para calificarlo.`,
    });
  }

  return {
    cut: exp.codigo_expediente,
    areaSecId: exp.area_id,
    solicitanteId: exp.solicitante_id,
    solicitanteNombre: exp.solicitante_nombre,
    solicitanteDocumento: exp.solicitante_documento ?? '',
  };
}

export async function registrarVerificacionAcademicaEstudios(
  cliente: PoolClient,
  expedienteId: string,
  usuarioId: string,
  roles: readonly string[],
  datos: {
    registroEstudioId?: string | null;
    resultado: 'FAVORABLE' | 'OBSERVADO' | 'IMPROCEDENTE';
    observacionesAcademicas: string;
  },
): Promise<VerificacionAcademicaEstudiosDTO> {
  const contextoSec = await exigirSecretarioEnCustodiaSec(cliente, expedienteId, usuarioId, roles);
  const estadoPrevio = await obtenerEstadoCertificadoEstudiosExpediente(cliente, expedienteId);
  if (!estadoPrevio) {
    throw new NotFoundError({ detail: 'Expediente no encontrado.' });
  }

  let registroSeleccionado: RegistroEstudiosSuperioresDTO | null = null;
  if (datos.registroEstudioId) {
    registroSeleccionado =
      estadoPrevio.registrosAcademicosDisponibles.find((r) => r.registroEstudioId === datos.registroEstudioId) ?? null;
    if (!registroSeleccionado) {
      throw new ValidationError({
        invalidParams: [{ name: 'registroEstudioId', reason: 'El registro de estudios seleccionado no corresponde a este administrado.' }],
      });
    }
  }

  const pagoVerificado = estadoPrevio.pagoTesoreria.estado === 'VERIFICADO';
  const culminadoVerificado = Boolean(registroSeleccionado?.culminado);
  const aprobadoVerificado = Boolean(registroSeleccionado?.aprobado);
  const semestresVerificados = Number(
    registroSeleccionado?.totalSemestres ??
    (registroSeleccionado?.semestresAprobados ? registroSeleccionado.semestresAprobados.length : 0)
  );

  if (datos.resultado === 'FAVORABLE') {
    if (!registroSeleccionado) {
      throw new ValidationError({
        invalidParams: [{ name: 'registroEstudioId', reason: 'La verificación favorable exige seleccionar los antecedentes académicos de los 6 semestres.' }],
      });
    }
    if (semestresVerificados !== 6 || !culminadoVerificado || !aprobadoVerificado || registroSeleccionado.estadoAcademico !== 'CULMINADO_APROBADO') {
      throw new ConflictError({
        code: 'ESTUDIOS_NO_CULMINADOS_O_DESAPROBADOS',
        detail: `No es posible emitir verificación FAVORABLE: el administrado registra ${semestresVerificados} semestres cursados (requiere 6) y estado académico '${registroSeleccionado.estadoAcademico}'.`,
      });
    }
    if (!pagoVerificado) {
      throw new ConflictError({
        code: 'PAGO_TESORERIA_NO_VERIFICADO',
        detail: 'El pago del derecho de tramitación en Tesorería (S/ 124.00) debe estar VERIFICADO para emitir una calificación favorable.',
      });
    }
  }

  await cliente.query(
    `UPDATE sigd_doc.verificacion_academica_estudios SET vigente = FALSE WHERE expediente_id = $1::uuid AND vigente = TRUE`,
    [expedienteId],
  );

  const insRes = await cliente.query<{
    verificacion_id: string;
    expediente_id: string;
    registro_estudio_id: string | null;
    dni_verificado: string;
    semestres_verificados: number;
    culminado_verificado: boolean;
    aprobado_verificado: boolean;
    pago_tesoreria_verificado: boolean;
    numero_recibo_tesoreria: string | null;
    numero_acta_referencia: string | null;
    programa_acreditado: string | null;
    horas_academicas: number | null;
    creditos_totales: string | null;
    promedio_final: string | null;
    detalle_semestres_verificados: unknown;
    resultado: 'FAVORABLE' | 'OBSERVADO' | 'IMPROCEDENTE';
    observaciones_academicas: string;
    verificado_por: string;
    verificado_en: Date;
    vigente: boolean;
  }>(
    `INSERT INTO sigd_doc.verificacion_academica_estudios (
       expediente_id, registro_estudio_id, dni_verificado,
       semestres_verificados, culminado_verificado, aprobado_verificado, pago_tesoreria_verificado,
       numero_recibo_tesoreria, numero_acta_referencia, programa_acreditado,
       horas_academicas, creditos_totales, promedio_final, detalle_semestres_verificados,
       resultado, observaciones_academicas, verificado_por, verificado_en, vigente
     ) VALUES (
       $1::uuid, $2::uuid, $3,
       $4, $5, $6, $7,
       $8, $9, $10,
       $11, $12, $13, $14::jsonb,
       $15, $16, $17::uuid, clock_timestamp(), TRUE
     ) RETURNING *`,
    [
      expedienteId,
      registroSeleccionado?.registroEstudioId ?? null,
      contextoSec.solicitanteDocumento,
      semestresVerificados,
      culminadoVerificado,
      aprobadoVerificado,
      pagoVerificado,
      estadoPrevio.pagoTesoreria.numeroRecibo ?? null,
      registroSeleccionado?.numeroActaFinal ?? null,
      registroSeleccionado?.programaEstudios ?? null,
      registroSeleccionado?.horasAcademicasTotales ?? null,
      registroSeleccionado?.creditosTotales ?? null,
      registroSeleccionado?.promedioFinal ?? null,
      JSON.stringify(registroSeleccionado?.semestresAprobados ?? []),
      datos.resultado,
      datos.observacionesAcademicas,
      usuarioId,
    ],
  );

  const row = insRes.rows[0];

  // Si es FAVORABLE, marcar el requisito FUT como cumplido en el expediente
  if (datos.resultado === 'FAVORABLE') {
    await cliente.query(
      `INSERT INTO sigd_doc.expediente_requisito (expediente_id, requisito_id, cumplido, verificado_en)
       SELECT $1::uuid, r.requisito_id, TRUE, clock_timestamp()
         FROM sigd_doc.requisito r
        WHERE r.tipo_tramite_id = (SELECT tipo_tramite_id FROM sigd_doc.expediente WHERE expediente_id = $1::uuid)
          AND r.codigo IN ('FUT', 'COMPROBANTE_PAGO')
       ON CONFLICT (expediente_id, requisito_id)
       DO UPDATE SET cumplido = TRUE, verificado_en = clock_timestamp()`,
      [expedienteId],
    );
  }

  await registrarMutacion(cliente, {
    esquema: 'sigd_doc',
    tabla: 'verificacion_academica_estudios',
    operacion: 'INSERT',
    usuario_id: usuarioId,
    datos_despues: {
      verificacion_id: row.verificacion_id,
      expediente_id: expedienteId,
      cut: contextoSec.cut,
      resultado: datos.resultado,
      semestres: semestresVerificados,
      pago_verificado: pagoVerificado,
    },
  });

  return {
    verificacionId: row.verificacion_id,
    expedienteId: row.expediente_id,
    registroEstudioId: row.registro_estudio_id,
    dniVerificado: row.dni_verificado,
    semestresVerificados: row.semestres_verificados,
    culminadoVerificado: row.culminado_verificado,
    aprobadoVerificado: row.aprobado_verificado,
    pagoTesoreriaVerificado: row.pago_tesoreria_verificado,
    numeroReciboTesoreria: row.numero_recibo_tesoreria,
    numeroActaReferencia: row.numero_acta_referencia,
    programaAcreditado: row.programa_acreditado,
    horasAcademicas: row.horas_academicas,
    creditosTotales: row.creditos_totales ? Number(row.creditos_totales) : null,
    promedioFinal: row.promedio_final ? Number(row.promedio_final) : null,
    detalleSemestresVerificados: normalizarSemestres(row.detalle_semestres_verificados),
    resultado: row.resultado,
    observacionesAcademicas: row.observaciones_academicas,
    verificadoPor: row.verificado_por,
    verificadorNombre: null,
    verificadoEn: row.verificado_en.toISOString(),
    vigente: row.vigente,
  };
}

export async function proyectarCertificadoEstudios(
  cliente: PoolClient,
  expedienteId: string,
  usuarioId: string,
  roles: readonly string[],
  datos?: { asunto?: string; periodoEstudios?: string },
): Promise<CertificadoEstudiosSuperioresDTO> {
  const contextoSec = await exigirSecretarioEnCustodiaSec(cliente, expedienteId, usuarioId, roles);
  const estadoPrevio = await obtenerEstadoCertificadoEstudiosExpediente(cliente, expedienteId);
  if (!estadoPrevio) {
    throw new NotFoundError({ detail: 'Expediente no encontrado.' });
  }

  if (estadoPrevio.pagoTesoreria.estado !== 'VERIFICADO') {
    throw new ConflictError({
      code: 'PAGO_TESORERIA_REQUERIDO',
      detail: 'El pago del derecho de tramitación (S/ 124.00) debe estar VERIFICADO en Tesorería para proyectar el certificado.',
    });
  }

  const verif = estadoPrevio.verificacionAcademica;
  if (!verif || verif.resultado !== 'FAVORABLE' || !verif.culminadoVerificado || !verif.aprobadoVerificado || verif.semestresVerificados !== 6) {
    throw new ConflictError({
      code: 'VERIFICACION_ACADEMICA_FAVORABLE_REQUERIDA',
      detail: 'Secretaría Académica debe registrar previamente la Verificación Académica FAVORABLE acreditando los 6 semestres culminados y aprobados en el IESTP Suiza.',
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
    `SELECT tipo_documental_id::text FROM sigd_doc.tipo_documento WHERE codigo = 'CERTIFICADO_ESTUDIOS' AND vigente = TRUE LIMIT 1`,
  );
  const tipoDocId = tipoDocRes.rows[0]?.tipo_documental_id;
  if (!tipoDocId) {
    throw new Error("El tipo documental 'CERTIFICADO_ESTUDIOS' no se encuentra configurado en sigd_doc.tipo_documento.");
  }

  const anio = new Date().getFullYear();
  let numeroBorrador = estadoPrevio.certificado?.numeroBorrador;
  if (!numeroBorrador) {
    await cliente.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`secuencia_certificado_estudios_${anio}`]);
    const seqRes = await cliente.query<{ max_correlativo: string }>(
      `SELECT COALESCE(MAX(
         NULLIF(regexp_replace(numero_borrador, '^.*-([0-9]+)$', '\\1'), numero_borrador)::int
       ), 0)::text AS max_correlativo
         FROM sigd_doc.certificado_estudios_superiores
        WHERE numero_borrador LIKE 'BORR-EST-' || $1 || '-%'`,
      [String(anio)],
    );
    const siguiente = parseInt(seqRes.rows[0]?.max_correlativo || '0', 10) + 1;
    numeroBorrador = `BORR-EST-${anio}-${String(siguiente).padStart(4, '0')}`;
  }

  const asunto = datos?.asunto?.trim() || `Certificado de Estudios Superiores (6 semestres) — ${reg.apellidosNombres} (${reg.programaEstudios})`;
  const periodoEstudios = datos?.periodoEstudios?.trim() || `${reg.periodoIngreso} a ${reg.periodoEgreso ?? '2023-II'}`;
  const actaAcademica = reg.numeroActaFinal ?? 'ACTA-CONS-INSTITUCIONAL';
  const fechaHoy = new Date();
  const fechaTexto = formatearFechaEspanol(fechaHoy);

  // Generación de CVD preliminar para trazabilidad documental
  const cvd = `CVD-EST-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

  // Preparar tabla de los 6 semestres
  const filasSemestres: string[][] = [];
  for (const sem of reg.semestresAprobados) {
    filasSemestres.push([
      `Semestre ${sem.semestre}`,
      sem.periodo,
      String(sem.creditos),
      String(sem.horas),
      sem.promedioSemestre.toFixed(2),
      'APROBADO',
    ]);
  }

  const contenidoPdf: ContenidoResolucion = {
    titulo: 'CERTIFICADO OFICIAL DE ESTUDIOS SUPERIORES',
    subtitulo: `Documento Proyectado N.° ${numeroBorrador} | Expediente ${contextoSec.cut} | TUPA SUZ26-034`,
    bloques: [
      {
        tipo: 'parrafo',
        alineacion: 'justificado',
        texto: `La Dirección General del Instituto de Educación Superior Tecnológico Público "Suiza" de Pucallpa, de conformidad con la verificación de antecedentes académicos emitida por Secretaría Académica (Acta Consolidada N.° ${actaAcademica}) y habiendo acreditado el derecho de tramitación correspondiente en Tesorería (S/ 124.00, Recibo N.° ${estadoPrevio.pagoTesoreria.numeroRecibo ?? 'VERIFICADO'}), certifica que:`,
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
        texto: `Ha cursado y aprobado satisfactoriamente los SEIS (06) SEMESTRES ACADÉMICOS correspondientes al Programa de Estudios de ${reg.programaEstudios.toUpperCase()} (${reg.planEstudios}), Código de Matrícula N.° ${reg.codigoMatricula ?? 'S/N'}, durante el periodo comprendido entre ${periodoEstudios}, habiendo acumulado un total de ${reg.creditosTotales.toFixed(2)} créditos y ${reg.horasAcademicasTotales} horas académicas reglamentarias, obteniendo un Promedio Ponderado General de ${reg.promedioFinal.toFixed(2)} (escala vigesimal, nota mínima aprobatoria ${reg.notaMinimaAprobatoria.toFixed(2)}).`,
      },
      {
        tipo: 'encabezado',
        nivel: 3,
        alineacion: 'izquierda',
        texto: 'CUADRO CONSOLIDADO DE CALIFICACIONES POR SEMESTRE ACADÉMICO:',
      },
      {
        tipo: 'tabla',
        columnas: ['Semestre', 'Periodo', 'Créditos', 'Horas', 'Promedio', 'Condición'],
        anchosRelativos: [0.22, 0.18, 0.15, 0.15, 0.15, 0.15],
        filas: filasSemestres,
      },
      {
        tipo: 'parrafo',
        alineacion: 'justificado',
        texto: `Total General: 6 semestres aprobados | ${reg.creditosTotales.toFixed(2)} Créditos Académicos | ${reg.horasAcademicasTotales} Horas | Promedio Final: ${reg.promedioFinal.toFixed(2)}.`,
      },
      {
        tipo: 'parrafo',
        alineacion: 'justificado',
        texto: `Se expide el presente certificado oficial a solicitud del interesado(a) para los fines que estime conveniente, sujeto a suscripción digital institucional mediante firma electrónica conforme a la Ley N.° 27269 y verificación pública mediante Código de Verificación Digital (CVD).`,
      },
      {
        tipo: 'parrafo',
        alineacion: 'derecha',
        texto: `Pucallpa, ${fechaTexto}.`,
      },
      {
        tipo: 'separador',
      },
      {
        tipo: 'parrafo',
        alineacion: 'centro',
        cuerpo: 9,
        texto: `Código de Verificación Digital (CVD): ${cvd}\nVerifique la autenticidad e integridad de este documento electrónico en la plataforma oficial del SIGD IESTP Suiza.`,
      },
    ],
  };

  const pdfGenerado = await a4GeneratorService.generar(contenidoPdf, {
    membrete: {
      institucion: 'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"',
      unidad: 'DIRECCIÓN GENERAL — SECRETARÍA ACADÉMICA',
      direccion: 'Av. Centenario Km. 3.500 — Pucallpa, Ucayali, Perú',
      tipoDocumento: 'CERTIFICADO DE ESTUDIOS SUPERIORES',
      numeroDocumento: numeroBorrador,
      correlativo: `EXP-${contextoSec.cut}`,
      sigla: 'IESTP-SUIZA-SEC',
    },
  });

  const s3Key = `certificados-estudios/${numeroBorrador}.pdf`;
  const subido = await subirPdfCertificadoS3(s3Key, pdfGenerado.bytes);
  const nombreArchivo = `${numeroBorrador}.pdf`;

  let documentoAdjuntoId: string;
  if (estadoPrevio.certificado?.documentoAdjuntoId) {
    documentoAdjuntoId = estadoPrevio.certificado.documentoAdjuntoId;
    await cliente.query(
      `UPDATE sigd_doc.documento_adjunto
          SET sha256 = $2, tamano_bytes = $3, nombre_archivo = $4, mime_type = 'application/pdf'
        WHERE documento_adjunto_id = $1::uuid`,
      [documentoAdjuntoId, subido.sha256, subido.tamanoBytes, nombreArchivo],
    );
  } else {
    const foliosActuales = await cliente.query<{ max_folio: number }>(
      `SELECT COALESCE(MAX(folio_fin), 0)::int AS max_folio FROM sigd_doc.documento_adjunto WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    const folioInicio = (foliosActuales.rows[0]?.max_folio || 0) + 1;
    const folioFin = folioInicio + Math.max(1, pdfGenerado.paginas) - 1;

    const adjRes = await cliente.query<{ documento_adjunto_id: string }>(
      `INSERT INTO sigd_doc.documento_adjunto (
         expediente_id, tipo_documental_id, s3_bucket, s3_key,
         nombre_archivo, mime_type, tamano_bytes, sha256,
         folio_inicio, folio_fin, subido_por, hash_original
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4,
         $5, 'application/pdf', $6, $7,
         $8, $9, $10::uuid, $7
       ) RETURNING documento_adjunto_id::text`,
      [
        expedienteId,
        tipoDocId,
        subido.bucket,
        subido.key,
        nombreArchivo,
        subido.tamanoBytes,
        subido.sha256,
        folioInicio,
        folioFin,
        usuarioId,
      ],
    );
    documentoAdjuntoId = adjRes.rows[0].documento_adjunto_id;
  }

  const titularPersonaIdRes = await cliente.query<{ solicitante_id: string }>(
    `SELECT solicitante_id::text FROM sigd_doc.expediente WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );
  const titularPersonaId = titularPersonaIdRes.rows[0]?.solicitante_id;

  const certUpsert = await cliente.query<{
    certificado_id: string;
    expediente_id: string;
    verificacion_id: string;
    numero_borrador: string;
    numero_certificado: string | null;
    titular_persona_id: string;
    titular_nombre: string;
    titular_documento: string;
    programa_estudios: string;
    plan_estudios: string;
    semestres_acreditados: unknown;
    horas_academicas: number;
    creditos_totales: string;
    promedio_final: string;
    periodo_estudios: string;
    numero_acta: string;
    asunto: string;
    cvd: string;
    estado: 'BORRADOR_PENDIENTE_FIRMA' | 'EN_FIRMA' | 'EMITIDO_FIRMADO' | 'NOTIFICADO' | 'ANULADO';
    documento_adjunto_id: string;
    proyectado_por: string;
    fecha_proyeccion: string;
    firmado_por: string | null;
    firmado_en: Date | null;
    hash_pades: string | null;
  }>(
    `INSERT INTO sigd_doc.certificado_estudios_superiores (
       expediente_id, verificacion_id, numero_borrador,
       titular_persona_id, titular_nombre, titular_documento,
       programa_estudios, plan_estudios, semestres_acreditados,
       horas_academicas, creditos_totales, promedio_final,
       periodo_estudios, numero_acta, asunto, cvd, estado,
       documento_adjunto_id, proyectado_por, fecha_proyeccion
     ) VALUES (
       $1::uuid, $2::uuid, $3,
       $4::uuid, $5, $6,
       $7, $8, $9::jsonb,
       $10, $11, $12,
       $13, $14, $15, $16, 'BORRADOR_PENDIENTE_FIRMA',
       $17::uuid, $18::uuid, (now() AT TIME ZONE 'America/Lima')::date
     )
     ON CONFLICT (expediente_id) WHERE estado <> 'ANULADO'
     DO UPDATE SET
       verificacion_id = EXCLUDED.verificacion_id,
       asunto = EXCLUDED.asunto,
       semestres_acreditados = EXCLUDED.semestres_acreditados,
       horas_academicas = EXCLUDED.horas_academicas,
       creditos_totales = EXCLUDED.creditos_totales,
       promedio_final = EXCLUDED.promedio_final,
       periodo_estudios = EXCLUDED.periodo_estudios,
       numero_acta = EXCLUDED.numero_acta,
       cvd = EXCLUDED.cvd,
       documento_adjunto_id = EXCLUDED.documento_adjunto_id,
       fecha_proyeccion = EXCLUDED.fecha_proyeccion
     RETURNING *`,
    [
      expedienteId,
      verif.verificacionId,
      numeroBorrador,
      titularPersonaId,
      reg.apellidosNombres,
      reg.numeroDocumentoIdentidad,
      reg.programaEstudios,
      reg.planEstudios,
      JSON.stringify(reg.semestresAprobados),
      reg.horasAcademicasTotales,
      reg.creditosTotales,
      reg.promedioFinal,
      periodoEstudios,
      actaAcademica,
      asunto,
      cvd,
      documentoAdjuntoId,
      usuarioId,
    ],
  );

  const row = certUpsert.rows[0];

  await registrarMutacion(cliente, {
    esquema: 'sigd_doc',
    tabla: 'certificado_estudios_superiores',
    operacion: estadoPrevio.certificado ? 'UPDATE' : 'INSERT',
    usuario_id: usuarioId,
    datos_despues: {
      certificado_id: row.certificado_id,
      expediente_id: expedienteId,
      numero_borrador: numeroBorrador,
      cvd,
      sha256: subido.sha256,
      s3_key: subido.key,
      estado: 'BORRADOR_PENDIENTE_FIRMA',
    },
  });

  await insertarEvento(cliente, {
    agregado: 'certificado_estudios',
    tipo_evento: 'CertificadoEstudiosProyectado',
    payload: {
      identidad: { expediente_id: expedienteId, cut: contextoSec.cut, certificado_id: row.certificado_id },
      contexto: { usuario_actor_id: usuarioId, area_id: contextoSec.areaSecId },
      datos_especificos: { numero_borrador: numeroBorrador, documento_adjunto_id: documentoAdjuntoId },
    },
  });

  return {
    certificadoId: row.certificado_id,
    expedienteId: row.expediente_id,
    verificacionId: row.verificacion_id,
    numeroBorrador: row.numero_borrador,
    numeroCertificado: row.numero_certificado,
    titularNombre: row.titular_nombre,
    titularDocumento: row.titular_documento,
    programaEstudios: row.programa_estudios,
    planEstudios: row.plan_estudios,
    semestresAcreditados: normalizarSemestres(row.semestres_acreditados),
    horasAcademicas: row.horas_academicas,
    creditosTotales: Number(row.creditos_totales),
    promedioFinal: Number(row.promedio_final),
    periodoEstudios: row.periodo_estudios,
    numeroActa: row.numero_acta,
    asunto: row.asunto,
    cvd: row.cvd,
    estado: row.estado,
    documentoAdjuntoId: row.documento_adjunto_id,
    proyectadoPor: row.proyectado_por,
    fechaProyeccion: String(row.fecha_proyeccion),
    firmadoPor: row.firmado_por,
    firmadoEn: toIsoStringOrNull(row.firmado_en),
    hashPades: row.hash_pades,
  };
}
