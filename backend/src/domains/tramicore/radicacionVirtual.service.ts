import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { verificarMagicBytesPdfEnS3 } from '../../core/storage/s3-storage.service.js';
import { ValidationError } from '../../shared/domain/errors/index.js';
import { CutService } from './cut.service.js';
import { calcularHorarioCorte, type ResultadoHorarioCorte } from './horarioCorte.util.js';
import type { RadicacionVirtualInput } from './tramites.schemas.js';

/**
 * T-BE-TC-02 y T-BE-TC-03 · Logica de negocio de la radicacion virtual
 * (Mesa de Partes Virtual 24x7, endpoint #14).
 *
 * ALINEACION CON MIGRACIONES REALES (02_sigd_auth.sql, 04_sigd_doc.sql, 05_sigd_tra.sql):
 *   * `sigd_auth.persona`: valida por `id_persona` (UUID) y `id_documento` (DNI/RUC/CE).
 *   * `sigd_doc.tipo_tramite_tupa`: valida por `tipo_tramite_id` (UUID) y columna `vigente`.
 *   * `sigd_tra.fn_generar_cut(p_anio INT)`: reserva atomicamente el CUT (`EXP-YYYY-XXXXXX`)
 *     sobre `sigd_tra.secuencia_anual_cut` dentro de la misma transaccion ACID.
 *   * `sigd_tra.expediente` y `sigd_doc.expediente`: persiste el expediente sincronizado
 *     con el mismo `expediente_id` (UUID) y `codigo_expediente` (`cut`).
 *   * `sigd_doc.documento_adjunto`: verifica server-side los primeros 5 bytes (`Range: bytes=0-4`)
 *     contra MinIO S3 (`%PDF-`, `[0x25, 0x50, 0x44, 0x46, 0x2D]`) y persiste los metadatos S3.
 *   * `sigd_tra.asiento_registro`, `sigd_tra.tramite` y `sigd_auth.notificacion_casilla`:
 *     asienta la recepcion en el Libro General de Entrada y registra el Cargo Digital CVD.
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
  fecha_radicacion: Date;
}

interface FilaTramiteTupa {
  tipo_tramite_id: string;
  codigo: string;
  denominacion: string;
  plazo_dias: number;
  vigente: boolean;
}

interface FilaPersona {
  id_persona: string;
  tipo: string;
  id_documento: string;
  vigente: boolean;
}

interface FilaTipoDocumento {
  tipo_documental_id: string;
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

  async radicar(
    datos: RadicacionVirtualInput,
    idUsuarioOFecha?: string | Date,
    nowParam?: Date,
  ): Promise<ResultadoRadicacion> {
    const now = idUsuarioOFecha instanceof Date ? idUsuarioOFecha : (nowParam ?? new Date());
    const idUsuario = typeof idUsuarioOFecha === 'string' ? idUsuarioOFecha : datos.idPersona;
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      const tipoTramite = await this.verificarTipoTramite(cliente, datos.idTipoTramiteTupa);
      const persona = await this.verificarAdministrado(
        cliente,
        datos.idPersona ?? (typeof idUsuarioOFecha === 'string' ? idUsuarioOFecha : ''),
      );
      const tipoDocumentalId = await this.resolverTipoDocumentalPorDefecto(cliente);

      const [{ cut, anio }, horario] = await Promise.all([
        this.cutService.generar(anioDeRecepcion(now), cliente),
        this.evaluarHorario(now),
      ]);

      const expediente = await this.insertarExpediente(
        cliente,
        datos,
        cut,
        horario,
        persona,
        tipoTramite,
        tipoDocumentalId,
      );
      await this.insertarAdjuntos(
        cliente,
        expediente.expediente_id,
        tipoDocumentalId,
        anio,
        datos,
      );
      const cargo = await this.emitirCargoDigital(
        cliente,
        expediente.expediente_id,
        cut,
        datos,
        horario,
        now,
      );

      await cliente.query('COMMIT');
      transaccionAbierta = false;

      return {
        expedienteId: expediente.expediente_id,
        cut,
        anio,
        fechaEnvioReal: horario.envioReal.toISOString(),
        fechaRadicacionLegal: expediente.fecha_radicacion.toISOString(),
        fueraDeHorario: horario.requiereProyeccion,
        mensajeLegal: redactarMensajeLegal(horario),
        totalFolios: datos.totalFolios,
        cargoDigital: cargo,
      };
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  private async evaluarHorario(now: Date): Promise<ResultadoHorarioCorte> {
    const feriados = await this.obtenerFeriados();
    return calcularHorarioCorte(now, feriados);
  }

  private async verificarTipoTramite(
    cliente: PoolClient,
    idTipoTramiteTupa: string,
  ): Promise<FilaTramiteTupa> {
    const resultado = await cliente.query<FilaTramiteTupa>(
      `SELECT tipo_tramite_id::text AS tipo_tramite_id,
              codigo,
              denominacion,
              plazo_dias,
              vigente
         FROM sigd_doc.tipo_tramite_tupa
        WHERE tipo_tramite_id = $1::uuid`,
      [idTipoTramiteTupa],
    );
    const tipo = resultado.rows[0];
    if (!tipo) {
      throw new ValidationError({
        invalidParams: [
          {
            name: 'idTipoTramiteTupa',
            reason: 'TIPO_TRAMITE_DESCONOCIDO: el tramite no existe en el catalogo TUPA (sigd_doc.tipo_tramite_tupa).',
          },
        ],
      });
    }
    if (!tipo.vigente) {
      throw new ValidationError({
        invalidParams: [
          {
            name: 'idTipoTramiteTupa',
            reason: 'TIPO_TRAMITE_INACTIVO: el tramite ya no se encuentra vigente para nuevas radicaciones.',
          },
        ],
      });
    }
    return tipo;
  }

  private async verificarAdministrado(
    cliente: PoolClient,
    idPersona: string,
  ): Promise<FilaPersona> {
    const resultado = await cliente.query<FilaPersona>(
      `SELECT p.id_persona::text AS id_persona,
              p.tipo,
              p.id_documento,
              COALESCE(cu.activo, TRUE) AS vigente
         FROM sigd_auth.persona p
         LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_persona = p.id_persona
        WHERE p.id_persona = $1::uuid
        LIMIT 1`,
      [idPersona],
    );
    const persona = resultado.rows[0];
    if (!persona) {
      throw new ValidationError({
        invalidParams: [
          {
            name: 'idPersona',
            reason: 'ADMINISTRADO_NO_REGISTRADO: el UUID no corresponde a una persona en sigd_auth.persona.',
          },
        ],
      });
    }
    if (!persona.vigente) {
      throw new ValidationError({
        invalidParams: [
          {
            name: 'idPersona',
            reason: 'ADMINISTRADO_INACTIVO: la cuenta asociada a la persona esta desactivada y no puede radicar.',
          },
        ],
      });
    }
    return persona;
  }

  /**
   * Obtiene o inicializa el tipo documental base en `sigd_doc.tipo_documento`
   * para garantizar la integridad referencial de `sigd_tra.expediente.tipo_documental_id`
   * y `sigd_doc.documento_adjunto.tipo_documental_id`.
   */
  private async resolverTipoDocumentalPorDefecto(cliente: PoolClient): Promise<string> {
    const existente = await cliente.query<FilaTipoDocumento>(
      `SELECT tipo_documental_id::text AS tipo_documental_id
         FROM sigd_doc.tipo_documento
        WHERE vigente = TRUE
        ORDER BY codigo ASC
        LIMIT 1`,
    );
    if (existente.rows[0]?.tipo_documental_id) {
      return existente.rows[0].tipo_documental_id;
    }

    const creado = await cliente.query<FilaTipoDocumento>(
      `INSERT INTO sigd_doc.tipo_documento
         (codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente)
       VALUES
         ('FUT-MPV', 'Formulario Unico de Tramite / Solicitud MPV', 'pdf', 'application/pdf', 25, FALSE, TRUE)
       ON CONFLICT (codigo) DO UPDATE SET vigente = TRUE
       RETURNING tipo_documental_id::text AS tipo_documental_id`,
    );
    const id = creado.rows[0]?.tipo_documental_id;
    if (!id) {
      throw new Error('No se pudo resolver ni inicializar sigd_doc.tipo_documento.');
    }
    return id;
  }

  private async insertarExpediente(
    cliente: PoolClient,
    datos: RadicacionVirtualInput,
    cut: string,
    horario: ResultadoHorarioCorte,
    persona: FilaPersona,
    tipoTramite: FilaTramiteTupa,
    tipoDocumentalId: string,
  ): Promise<FilaExpediente> {
    const dniSolicitante = /^[0-9]{8}$/.test(persona.id_documento.trim())
      ? persona.id_documento.trim()
      : null;

    const plazoDias = Number(tipoTramite.plazo_dias) > 0 ? Number(tipoTramite.plazo_dias) : 30;
    const fechaLimite = new Date(
      horario.radicacionLegal.getTime() + plazoDias * 24 * 60 * 60 * 1000,
    );

    // 1. Insertar en `sigd_tra.expediente` (05_sigd_tra.sql)
    const resultadoTra = await cliente.query<FilaExpediente>(
      `INSERT INTO sigd_tra.expediente
         (codigo_expediente, numero, dni_solicitante, tipo_documental_id,
          solicitante_id, estado, fecha_radicacion, fecha_limite)
       VALUES ($1, $2, $3, $4::uuid, $5::uuid, 'REGISTRADO', $6, $7)
       RETURNING expediente_id::text AS expediente_id,
                 codigo_expediente AS cut,
                 fecha_radicacion`,
      [
        cut,
        cut,
        dniSolicitante,
        tipoDocumentalId,
        persona.id_persona,
        horario.radicacionLegal,
        fechaLimite,
      ],
    );
    const expediente = resultadoTra.rows[0];
    if (!expediente) {
      throw new Error('La insercion del expediente en sigd_tra.expediente no devolvio fila.');
    }

    // 2. Sincronizar instancia documental en `sigd_doc.expediente` (04_sigd_doc.sql),
    //    requerida por la FK de `sigd_doc.documento_adjunto.expediente_id`.
    await cliente.query(
      `INSERT INTO sigd_doc.expediente
         (expediente_id, tipo_tramite_id, codigo_expediente, asunto,
          solicitante_id, estado, fecha_registro, fecha_limite)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, 'REGISTRADO', $6, $7)`,
      [
        expediente.expediente_id,
        tipoTramite.tipo_tramite_id,
        cut,
        datos.asunto,
        persona.id_persona,
        horario.radicacionLegal,
        fechaLimite,
      ],
    );

    // 3. Registrar instancia de tramitacion en `sigd_tra.tramite` (05_sigd_tra.sql)
    await cliente.query(
      `INSERT INTO sigd_tra.tramite
         (expediente_id, codigo_tramite, asunto, estado, creado_en)
       VALUES ($1::uuid, $2, $3, 'REGISTRADO', $4)`,
      [expediente.expediente_id, cut, datos.asunto, horario.envioReal],
    );

    // 4. Asentar ingreso en el Libro General `sigd_tra.asiento_registro` (05_sigd_tra.sql)
    await cliente.query(
      `INSERT INTO sigd_tra.asiento_registro
         (expediente_id, fecha_ingreso, canal_ingreso, asunto, remitente_id)
       VALUES ($1::uuid, $2, 'MESA_VIRTUAL', $3, $4::uuid)`,
      [expediente.expediente_id, horario.envioReal, datos.asunto, persona.id_persona],
    );

    return expediente;
  }

  private async insertarAdjuntos(
    cliente: PoolClient,
    expedienteId: string,
    tipoDocumentalId: string,
    anio: number,
    datos: RadicacionVirtualInput,
  ): Promise<void> {
    const configS3 = obtenerConfiguracionS3();

    for (const documento of datos.documentos) {
      const claveInformada = (documento.storagePath ?? documento.s3Key)?.trim();
      const s3Bucket = documento.s3Bucket?.trim() || configS3.bucket;
      const s3Key =
        claveInformada && claveInformada.length > 0
          ? claveInformada
          : `expedientes/${anio}/${expedienteId}/${documento.nombreArchivo}`;

      const verificacion = await verificarMagicBytesPdfEnS3(
        s3Key,
        {
          ...configS3,
          bucket: s3Bucket,
        },
        { mimeType: documento.contentType },
      );
      const magicBytes = verificacion.magicBytesHex;

      await cliente.query(
        `INSERT INTO sigd_doc.documento_adjunto
           (expediente_id, tipo_documental_id, nombre_archivo, s3_bucket,
            s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::uuid)`,
        [
          expedienteId,
          tipoDocumentalId,
          documento.nombreArchivo,
          s3Bucket,
          s3Key,
          documento.hashSha256.toLowerCase(),
          documento.tamanoBytes,
          documento.contentType,
          magicBytes,
          datos.idPersona,
        ],
      );
    }
  }

  private async emitirCargoDigital(
    cliente: PoolClient,
    expedienteId: string,
    cut: string,
    datos: RadicacionVirtualInput,
    horario: ResultadoHorarioCorte,
    now: Date,
  ): Promise<ResultadoRadicacion['cargoDigital']> {
    const codigo = `CARGO-${randomUUID().slice(0, 8).toUpperCase()}`;
    const contenido = JSON.stringify({
      codigo,
      expedienteId,
      cut,
      totalFolios: datos.totalFolios,
      emitidoEn: now.toISOString(),
    });
    const hashSha256 = createHash('sha256').update(contenido).digest('hex');
    const qrContenido = `SIGD://cargo/${codigo}?h=${hashSha256.slice(0, 16)}`;

    // Registrar constancia del Cargo Digital en `sigd_auth.notificacion_casilla` (02_sigd_auth.sql)
    await cliente.query(
      `INSERT INTO sigd_auth.notificacion_casilla
         (correo_destinatario, cut, asunto, tipo_acto, numero_documento,
          cuerpo, estado, fecha_deposito, hash_sha256, cvd)
       VALUES ($1, $2, $3, 'Cargo de Recepcion Digital MPV', $4, $5::jsonb, 'NOTIFICADO', $6, $7, $4)`,
      [
        datos.correo,
        cut,
        datos.asunto,
        codigo,
        JSON.stringify({
          expedienteId,
          nombreSolicitante: datos.nombreSolicitante,
          correoNotificacion: datos.correo,
          totalFolios: datos.totalFolios,
          fechaEnvioReal: horario.envioReal.toISOString(),
          fechaRadicacionLegal: horario.radicacionLegal.toISOString(),
          fueraDeHorario: horario.requiereProyeccion,
          qrContenido,
        }),
        now,
        hashSha256,
      ],
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

/**
 * Proveedor por defecto: lee los feriados del calendario laboral si el modulo de
 * OrganiCore ya lo publico. La ausencia del catalogo no debe impedir radicar,
 * por lo que se degrada a un calendario vacio en lugar de fallar.
 */
export function crearProveedorFeriados(pool: Pool): ProveedorFeriados {
  return async function obtenerFeriados(clienteTransaccional?: PoolClient): Promise<string[]> {
    const cliente = clienteTransaccional ?? await pool.connect();
    try {
      const resultado = await cliente.query<{ fecha: string }>(
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha
           FROM sigd_org.calendario_laboral
          WHERE es_feriado = TRUE
            AND activo = TRUE
            AND fecha >= CURRENT_DATE - INTERVAL '1 year'
            AND fecha <= CURRENT_DATE + INTERVAL '5 years'`,
      );
      return resultado.rows.map((fila) => fila.fecha);
    } catch {
      return [];
    } finally {
      if (!clienteTransaccional) cliente.release();
    }
  };
}
