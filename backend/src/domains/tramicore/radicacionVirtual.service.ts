import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned, validarMagicBytes } from '../../core/storage/s3-storage.service.js';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../shared/domain/errors/index.js';
import { CutService } from './cut.service.js';
import { calcularHorarioCorte, type ResultadoHorarioCorte } from './horarioCorte.util.js';
import type { RadicacionVirtualInput } from './tramites.schemas.js';

/**
 * T-BE-TC-02 y T-BE-TC-03 Â· Logica de negocio de la radicacion virtual
 * (Mesa de Partes Virtual 24x7, endpoint #14).
 *
 * Garantias que ofrece este servicio:
 *   * La asignacion del CUT ocurre DENTRO de la misma transaccion que la
 *     escritura del expediente. Si algo posterior falla, el ROLLBACK libera el
 *     correlativo y no se quema un numero que el ciudadano nunca vio.
 *   * DocuCore conserva fecha_registro y TramiCore fecha_radicacion. Los alias
 *     internos mantienen la respuesta HTTP existente.
 *   * Expedientes, adjunto, foliacion y asiento se escriben con el mismo cliente.
 *     El cargo se obtiene del asiento, como en la ventanilla presencial.
 */

export interface ResultadoRadicacion {
  expedienteId: string;
  cut: string;
  anio: number;
  fechaEnvioReal: string;
  fechaRadicacionLegal: string;
  fueraDeHorario: boolean;
  mensajeLegal: string;
  totalFolios: number;
  cargoDigital: {
    codigo: string;
    hashSha256: string;
    qrContenido: string;
  };
}

interface FilaExpediente {
  expediente_id: string;
  cut: string;
  fecha_envio_real: Date;
  fecha_radicacion_legal: Date;
  fuera_de_horario: boolean;
}

interface FilaTramiteTupa {
  id_tipo_tramite_tupa: string;
  activo: boolean;
}

/** Origen del calendario de feriados. Inyectable para poder testear sin BD. */
export type ProveedorFeriados = (clienteTransaccional?: PoolClient) => Promise<string[]>;

export class RadicacionVirtualService {
  private readonly cutService: CutService;
  private readonly obtenerFeriados: ProveedorFeriados;

  constructor(private readonly pool: Pool, obtenerFeriados?: ProveedorFeriados) {
    this.cutService = new CutService(pool);
    this.obtenerFeriados = obtenerFeriados ?? crearProveedorFeriados(pool);
  }

  async radicar(datos: RadicacionVirtualInput, idUsuarioAutenticado: string, now: Date = new Date()): Promise<ResultadoRadicacion> {
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      await this.verificarTipoTramite(cliente, datos.idTipoTramiteTupa);
      const idPersona = await this.resolverPersonaAutenticada(
        cliente,
        idUsuarioAutenticado,
        datos.tipoDocumento,
        datos.numeroDocumento,
        datos.nombreSolicitante,
      );
      const tipoDocumentalId = await this.resolverTipoDocumental(cliente, datos);
      const archivo = await this.verificarArchivo(datos.documentos[0]);

      const horario = await this.evaluarHorario(now, cliente);
      const { cut, anio } = await this.cutService.generar(anioDeRecepcion(now), cliente);

      const expediente = await this.insertarExpediente(cliente, datos, idPersona, cut, horario, tipoDocumentalId);
      await this.insertarAdjuntos(cliente, expediente.expediente_id, datos, tipoDocumentalId, archivo, idUsuarioAutenticado);
      const cargo = await this.emitirCargoDigital(cliente, expediente.expediente_id, datos, now, cut, idPersona);

      await cliente.query('COMMIT');
      transaccionAbierta = false;

      return {
        expedienteId: expediente.expediente_id,
        cut,
        anio,
        fechaEnvioReal: expediente.fecha_envio_real.toISOString(),
        fechaRadicacionLegal: expediente.fecha_radicacion_legal.toISOString(),
        fueraDeHorario: horario.requiereProyeccion,
        mensajeLegal: redactarMensajeLegal(horario),
        totalFolios: datos.totalFolios,
        cargoDigital: cargo,
      };
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      // La traduccion de SQLSTATE a respuesta HTTP la hace el middleware de
      // errores de la plataforma (23505 -> 409, 23503 -> 400, P0001 -> 422),
      // de modo que aqui solo se garantiza que la transaccion no queda abierta.
      throw error;
    } finally {
      cliente.release();
    }
  }

  private async evaluarHorario(now: Date, cliente: PoolClient): Promise<ResultadoHorarioCorte> {
    const feriados = await this.obtenerFeriados(cliente);
    return calcularHorarioCorte(now, feriados);
  }

  private async verificarTipoTramite(cliente: PoolClient, idTipoTramiteTupa: string): Promise<void> {
    const resultado = await cliente.query<FilaTramiteTupa>(
      `SELECT tipo_tramite_id AS id_tipo_tramite_tupa,
              vigente AS activo
         FROM sigd_doc.tipo_tramite_tupa
        WHERE tipo_tramite_id = $1`,
      [idTipoTramiteTupa],
    );
    const tipo = resultado.rows[0];
    if (!tipo) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idTipoTramiteTupa', reason: 'TIPO_TRAMITE_DESCONOCIDO: el tramite no existe en el catalogo TUPA.' },
        ],
      });
    }
    if (!tipo.activo) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idTipoTramiteTupa', reason: 'TIPO_TRAMITE_INACTIVO: el tramite ya no admite nuevas radicaciones.' },
        ],
      });
    }
  }

  private async resolverPersonaAutenticada(
    cliente: PoolClient,
    idUsuario: string,
    tipoDocumento: string,
    numeroDocumento: string,
    nombreSolicitante: string,
  ): Promise<string> {
    const resultado = await cliente.query<{
      id_persona: string | null;
      id_documento: string | null;
      tipo_persona: string | null;
      nombre_identidad: string | null;
      activo: boolean;
    }>(
      `SELECT c.id_persona,
              p.id_documento,
              p.tipo AS tipo_persona,
              COALESCE(pn.nombre_completo, pj.razon_social) AS nombre_identidad,
              c.activo
         FROM sigd_auth.cuenta_usuario c
         LEFT JOIN sigd_auth.persona p ON p.id_persona = c.id_persona
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
        WHERE c.id_usuario = $1::uuid
        LIMIT 1`,
      [idUsuario],
    );
    const cuenta = resultado.rows[0];
    if (!cuenta) {
      throw new UnauthorizedError({
        detail: 'La sesión no corresponde a una cuenta vigente.',
      });
    }
    if (
      !cuenta.activo ||
      !cuenta.id_persona ||
      !cuenta.id_documento ||
      !cuenta.tipo_persona ||
      !cuenta.nombre_identidad
    ) {
      throw new ForbiddenError({
        detail: 'La cuenta no está habilitada o no tiene una identidad registrada para radicar.',
      });
    }
    const tipoPersonaEsperado = tipoDocumento === 'RUC' ? 'JURIDICA' : 'NATURAL';
    if (
      normalizarDocumento(cuenta.id_documento) !== normalizarDocumento(numeroDocumento) ||
      cuenta.tipo_persona !== tipoPersonaEsperado ||
      normalizarIdentidad(cuenta.nombre_identidad) !== normalizarIdentidad(nombreSolicitante)
    ) {
      throw new ForbiddenError({
        detail: 'Los datos declarados no coinciden con la identidad vinculada a la sesión.',
      });
    }
    return cuenta.id_persona;
  }

  /** Solo el caso autorizado: un archivo y un único tipo vigente configurado. */
  private async resolverTipoDocumental(cliente: PoolClient, datos: RadicacionVirtualInput): Promise<string> {
    if (datos.documentos.length !== 1) {
      throw new ValidationError({
        invalidParams: [{ name: 'documentos', reason: 'CLASIFICACION_DOCUMENTAL_AMBIGUA: no existe una regla para clasificar varios archivos.' }],
      });
    }
    const resultado = await cliente.query<{ tipo_documental_id: string; requiere_condicion: boolean }>(
      `SELECT td.tipo_documental_id,
              bool_or(dr.condicion_json_pointer IS NOT NULL) AS requiere_condicion
         FROM sigd_doc.requisito r
         JOIN sigd_doc.tipo_documento_requisito dr ON dr.requisito_id = r.requisito_id
         JOIN sigd_doc.tipo_documento td ON td.tipo_documental_id = dr.tipo_documental_id
        WHERE r.tipo_tramite_id = $1::uuid AND td.vigente = TRUE
        GROUP BY td.tipo_documental_id`,
      [datos.idTipoTramiteTupa],
    );
    if (resultado.rows.length !== 1 || resultado.rows[0].requiere_condicion) {
      throw new ValidationError({
        invalidParams: [{
          name: 'documentos',
          reason: resultado.rows.length === 0
            ? 'CLASIFICACION_DOCUMENTAL_NO_CONFIGURADA: el procedimiento no tiene un tipo documental vigente asociado.'
            : 'CLASIFICACION_DOCUMENTAL_AMBIGUA: la arquitectura actual no contiene información suficiente para distinguir los tipos documentales.',
        }],
      });
    }
    return resultado.rows[0].tipo_documental_id;
  }

  private async insertarExpediente(
    cliente: PoolClient,
    datos: RadicacionVirtualInput,
    idPersona: string,
    cut: string,
    horario: ResultadoHorarioCorte,
    tipoDocumentalId: string,
  ): Promise<FilaExpediente> {
    const resultado = await cliente.query<{ expediente_id: string; fecha_registro: Date }>(
      `INSERT INTO sigd_doc.expediente
         (tipo_tramite_id, codigo_expediente, asunto, solicitante_id, fecha_registro)
       VALUES ($1::uuid, $2, $3, $4::uuid, $5)
       RETURNING expediente_id, fecha_registro`,
      [datos.idTipoTramiteTupa, cut, datos.asunto, idPersona, horario.envioReal],
    );
    const expediente = resultado.rows[0];
    if (!expediente) {
      throw new Error('La insercion del expediente no devolvio fila.');
    }
    // firma.routes.ts ya consulta ambos dominios con esta identidad compartida.
    await cliente.query(
      `INSERT INTO sigd_tra.expediente
         (expediente_id, codigo_expediente, numero, dni_solicitante,
          tipo_documental_id, solicitante_id, fecha_radicacion)
       VALUES ($1::uuid, $2, $2, $3, $4::uuid, $5::uuid, $6)`,
      [expediente.expediente_id, cut, datos.tipoDocumento === 'DNI' ? datos.numeroDocumento : null,
        tipoDocumentalId, idPersona, horario.radicacionLegal],
    );
    await cliente.query(
      `INSERT INTO sigd_tra.tramite (expediente_id, asunto)
       VALUES ($1::uuid, $2)`,
      [expediente.expediente_id, datos.asunto],
    );
    return {
      expediente_id: expediente.expediente_id,
      cut,
      fecha_envio_real: expediente.fecha_registro,
      fecha_radicacion_legal: horario.radicacionLegal,
      fuera_de_horario: horario.requiereProyeccion,
    };
  }

  /** Verifica el objeto existente; nunca crea claves ni acepta una URL blob. */
  private async verificarArchivo(documento: RadicacionVirtualInput['documentos'][number]): Promise<{ bucket: string; key: string }> {
    const config = obtenerConfiguracionS3();
    const key = documento.storagePath;
    if (!key || !/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i.test(key)) {
      throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'ARCHIVO_NO_ALMACENADO: falta la clave devuelta por storage/presigned-url.' }] });
    }
    const url = generarUrlPresigned(key, config, { metodo: 'GET', expiraSegundos: 60 });
    // La URL prefirmada GET contiene la autenticación en su query.
    const respuesta = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });
    if (!respuesta.ok || !respuesta.body) {
      await respuesta.body?.cancel();
      throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'ARCHIVO_NO_DISPONIBLE: storage no permite verificar el objeto.' }] });
    }
    const lector = respuesta.body.getReader();
    const hash = createHash('sha256');
    let tamano = 0;
    let prefijo = Buffer.alloc(0);
    try {
      while (true) {
        const { done, value } = await lector.read();
        if (done) break;
        tamano += value.byteLength;
        if (tamano > documento.tamanoBytes) {
          throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'ARCHIVO_NO_COINCIDE: tamaño distinto del objeto almacenado.' }] });
        }
        if (prefijo.length < 5) {
          prefijo = Buffer.concat([prefijo, Buffer.from(value.subarray(0, 5 - prefijo.length))]);
        }
        hash.update(value);
      }
      if (tamano !== documento.tamanoBytes || hash.digest('hex') !== documento.hashSha256.toLowerCase()
          || respuesta.headers.get('content-type')?.split(';')[0].trim() !== documento.contentType) {
        throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'ARCHIVO_NO_COINCIDE: hash, tamaño o MIME distintos del objeto almacenado.' }] });
      }
      if (documento.contentType === 'application/pdf' && !validarMagicBytes(prefijo, 'PDF')) {
        throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'ARCHIVO_NO_VALIDO: el objeto almacenado no tiene la firma binaria PDF.' }] });
      }
    } finally {
      await lector.cancel();
      lector.releaseLock();
    }
    return { bucket: config.bucket, key };
  }

  private async insertarAdjuntos(
    cliente: PoolClient,
    expedienteId: string,
    datos: RadicacionVirtualInput,
    tipoDocumentalId: string,
    archivo: { bucket: string; key: string },
    idUsuario: string,
  ): Promise<void> {
    for (const documento of datos.documentos) {
      const resultado = await cliente.query<{ documento_adjunto_id: string }>(
        `INSERT INTO sigd_doc.documento_adjunto
           (expediente_id, nombre_archivo, mime_type, tamano_bytes, sha256,
            s3_bucket, s3_key, tipo_documental_id, subido_por)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid, $9::uuid)
         RETURNING documento_adjunto_id`,
        [
          expedienteId,
          documento.nombreArchivo,
          documento.contentType,
          documento.tamanoBytes,
          documento.hashSha256.toLowerCase(),
          archivo.bucket,
          archivo.key,
          tipoDocumentalId,
          idUsuario,
        ],
      );
      if (!resultado.rows[0]) throw new Error('La insercion del adjunto no devolvio fila.');
      // La función existente falla por la ambigüedad de folio_fin entre su
      // parámetro RETURNS TABLE y la columna. Reproducimos aquí su algoritmo
      // sobre las mismas tablas y dentro de esta transacción.
      const expedienteBloqueado = await cliente.query<{ expediente_id: string }>(
        `SELECT expediente_id
           FROM sigd_tra.expediente
          WHERE expediente_id = $1::uuid
          FOR UPDATE`,
        [expedienteId],
      );
      if (!expedienteBloqueado.rows[0]) {
        throw new Error('No se encontró el expediente de TramiCore para asignar folios.');
      }
      const siguienteFolio = await cliente.query<{ folio_inicio: number }>(
        `SELECT COALESCE(MAX(f.folio_fin), 0) + 1 AS folio_inicio
           FROM sigd_tra.expediente_documento_folio AS f
          WHERE f.expediente_id = $1::uuid`,
        [expedienteId],
      );
      const folioInicio = Number(siguienteFolio.rows[0]?.folio_inicio);
      if (!Number.isSafeInteger(folioInicio) || folioInicio < 1) {
        throw new Error('No se pudo determinar el folio inicial del documento.');
      }
      await cliente.query(
        `INSERT INTO sigd_tra.expediente_documento_folio
           (expediente_id, id_documento, folio_inicio, folio_fin, asignado_por)
         VALUES ($1::uuid, $2::uuid, $3::integer, $4::integer, $5::uuid)`,
        [expedienteId, resultado.rows[0].documento_adjunto_id, folioInicio,
          folioInicio + datos.totalFolios - 1, idUsuario],
      );
    }
  }

  private async emitirCargoDigital(
    cliente: PoolClient,
    expedienteId: string,
    datos: RadicacionVirtualInput,
    now: Date,
    cut: string,
    idPersona: string,
  ): Promise<ResultadoRadicacion['cargoDigital']> {
    const codigo = cut;
    const contenido = JSON.stringify({
      codigo,
      expedienteId,
      totalFolios: datos.totalFolios,
      emitidoEn: now.toISOString(),
    });
    const hashSha256 = createHash('sha256').update(contenido).digest('hex');
    const qrContenido = `https://sigd.iestp-suiza.edu.pe/consulta/${encodeURIComponent(cut)}`;

    await cliente.query(
      `INSERT INTO sigd_tra.asiento_registro
         (expediente_id, fecha_ingreso, canal_ingreso, asunto, remitente_id)
       VALUES ($1::uuid, $2, 'MESA_VIRTUAL', $3, $4::uuid)`,
      [expedienteId, now, datos.asunto, idPersona],
    );

    return { codigo, hashSha256, qrContenido };
  }
}

/**
 * El ejercicio fiscal del CUT sigue al ano de la recepcion tecnica, no al ano
 * de la fecha legal proyectada: un documento recibido el 31 de diciembre a las
 * 18:00 conserva el correlativo de diciembre aunque su computo de plazos
 * arranque en enero.
 */
function anioDeRecepcion(now: Date): number {
  return CutService.anioFiscalCorriente(now);
}

function redactarMensajeLegal(horario: ResultadoHorarioCorte): string {
  if (!horario.requiereProyeccion) {
    return 'Radicacion dentro del horario de atencion. El computo de plazos comienza de inmediato.';
  }
  if (horario.diaNoHabil) {
    return `Recibido en dia no habil. Por Art. 138 de la LPAG el computo de plazos comienza el ${horario.fechaLegal} a las 08:00.`;
  }
  return `Recibido despues del corte de las 16:30. Por Art. 138 de la LPAG el computo de plazos comienza el ${horario.fechaLegal} a las 08:00.`;
}

function normalizarDocumento(documento: string): string {
  return documento.trim().toLocaleUpperCase('es-PE');
}

function normalizarIdentidad(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('es-PE')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Proveedor por defecto: lee los feriados del calendario laboral existente.
 * Los errores de lectura se propagan para impedir generar un CUT sin haber
 * comprobado el calendario. Un resultado vacío válido sigue siendo admisible.
 */
export function crearProveedorFeriados(pool: Pool): ProveedorFeriados {
  return async function obtenerFeriados(clienteTransaccional?: PoolClient): Promise<string[]> {
    const cliente = clienteTransaccional ?? await pool.connect();
    try {
      const resultado = await cliente.query<{ fecha: string }>(
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha
           FROM sigd_org.calendario_laboral
          WHERE es_feriado = TRUE
            AND fecha >= CURRENT_DATE - INTERVAL '1 year'
            AND fecha <= CURRENT_DATE + INTERVAL '5 years'`,
      );
      return resultado.rows.map((fila) => fila.fecha);
    } finally {
      if (!clienteTransaccional) cliente.release();
    }
  };
}


