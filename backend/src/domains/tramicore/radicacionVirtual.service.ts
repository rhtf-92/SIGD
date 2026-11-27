import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ValidationError } from '../../shared/domain/errors/index.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
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
 *   * `fecha_envio_real` (metadato pericial) y `fecha_radicacion_legal`
 *     (inicio del computo de plazos) se persisten por separado, conforme al
 *     Art. 138 LPAG implementado en `horarioCorte.util.ts`.
 *   * La cabecera, los adjuntos y el cargo digital se escriben en una sola
 *     transaccion: es imposible que quede un expediente sin adjunto (el trigger
 *     diferido `trg_expediente_exigir_adjunto` lo revalida en el COMMIT).
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
}

interface FilaTramiteTupa {
  tipo_tramite_id: string;
  vigente: boolean;
}

interface FilaPersona {
  id_persona: string;
}

interface FilaTipoDocumental {
  tipo_documental_id: string;
}

/** Origen del calendario de feriados. Inyectable para poder testear sin BD. */
export type ProveedorFeriados = () => Promise<string[]>;

export class RadicacionVirtualService {
  private readonly cutService: CutService;
  private readonly obtenerFeriados: ProveedorFeriados;

  constructor(private readonly pool: Pool, obtenerFeriados?: ProveedorFeriados) {
    this.cutService = new CutService(pool);
    this.obtenerFeriados = obtenerFeriados ?? crearProveedorFeriados(pool);
  }

  async radicar(datos: RadicacionVirtualInput, now: Date = new Date()): Promise<ResultadoRadicacion> {
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      await this.verificarTipoTramite(cliente, datos.idTipoTramiteTupa);
      await this.verificarAdministrado(cliente, datos.idPersona);

      const [{ cut, anio }, horario] = await Promise.all([
        this.cutService.generar(anioDeRecepcion(now), cliente),
        this.evaluarHorario(now),
      ]);

      const expediente = await this.insertarExpediente(cliente, datos, cut, horario);
      await this.insertarAdjuntos(cliente, expediente.expediente_id, datos);
      const cargo = this.emitirCargoDigital(expediente.expediente_id, datos, now);

      await cliente.query('COMMIT');
      transaccionAbierta = false;

      return {
        expedienteId: expediente.expediente_id,
        cut,
        anio,
        fechaEnvioReal: horario.envioReal.toISOString(),
        fechaRadicacionLegal: horario.radicacionLegal.toISOString(),
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

  private async evaluarHorario(now: Date): Promise<ResultadoHorarioCorte> {
    const feriados = await this.obtenerFeriados();
    return calcularHorarioCorte(now, feriados);
  }

  private async verificarTipoTramite(cliente: PoolClient, idTipoTramiteTupa: string): Promise<void> {
    const resultado = await cliente.query<FilaTramiteTupa>(
      `SELECT tipo_tramite_id, vigente
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
    if (!tipo.vigente) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idTipoTramiteTupa', reason: 'TIPO_TRAMITE_INACTIVO: el tramite ya no admite nuevas radicaciones.' },
        ],
      });
    }
  }

  private async verificarAdministrado(cliente: PoolClient, idPersona: string): Promise<void> {
    const resultado = await cliente.query<FilaPersona>(
      'SELECT id_persona::text AS id_persona FROM sigd_auth.persona WHERE id_persona = $1',
      [idPersona],
    );
    if (!resultado.rows[0]) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idPersona', reason: 'ADMINISTRADO_NO_REGISTRADO: el UUID no corresponde a una persona del padrón.' },
        ],
      });
    }
  }

  private async obtenerTipoDocumental(cliente: PoolClient): Promise<string> {
    const resultado = await cliente.query<FilaTipoDocumental>(
      `SELECT tipo_documental_id::text AS tipo_documental_id
         FROM sigd_doc.tipo_documento
        WHERE codigo = 'SOLICITUD' AND vigente = TRUE
        LIMIT 1`,
    );
    const tipoDocumentalId = resultado.rows[0]?.tipo_documental_id;
    if (!tipoDocumentalId) {
      throw new ValidationError({
        invalidParams: [
          { name: 'documentos', reason: 'TIPO_DOCUMENTAL_NO_CONFIGURADO: falta el tipo documental SOLICITUD en el catálogo.' },
        ],
      });
    }
    return tipoDocumentalId;
  }

  private async insertarExpediente(
    cliente: PoolClient,
    datos: RadicacionVirtualInput,
    cut: string,
    horario: ResultadoHorarioCorte,
  ): Promise<FilaExpediente> {
    const documento = await cliente.query<FilaExpediente>(
      `INSERT INTO sigd_doc.expediente
         (tipo_tramite_id, codigo_expediente, asunto, solicitante_id, estado, fecha_registro, fecha_limite)
       VALUES ($1, $2, $3, $4, 'REGISTRADO', $5, NULL)
       RETURNING expediente_id::text AS expediente_id`,
      [datos.idTipoTramiteTupa, cut, datos.asunto, datos.idPersona, horario.envioReal],
    );
    const expediente = documento.rows[0];
    if (!expediente) {
      throw new Error('La inserción del expediente documental no devolvió fila.');
    }

    const tipoDocumentalId = await this.obtenerTipoDocumental(cliente);
    const registro = await cliente.query<FilaExpediente>(
      `INSERT INTO sigd_tra.expediente
         (codigo_expediente, numero, dni_solicitante, tipo_documental_id, solicitante_id, estado, fecha_radicacion)
       VALUES ($1, $1, NULL, $2, $3, 'REGISTRADO', $4)
       RETURNING expediente_id::text AS expediente_id`,
      [cut, tipoDocumentalId, datos.idPersona, horario.radicacionLegal],
    );
    const expedienteTramiteId = registro.rows[0]?.expediente_id;
    if (!expedienteTramiteId) {
      throw new Error('La inserción del expediente de trámite no devolvió fila.');
    }

    await cliente.query(
      `INSERT INTO sigd_tra.tramite
         (expediente_id, codigo_tramite, asunto, estado)
       VALUES ($1, $2, $3, 'REGISTRADO')`,
      [expedienteTramiteId, cut, datos.asunto],
    );

    return expediente;
  }

  private async insertarAdjuntos(
    cliente: PoolClient,
    expedienteId: string,
    datos: RadicacionVirtualInput,
  ): Promise<void> {
    const tipoDocumentalId = await this.obtenerTipoDocumental(cliente);
    const bucket = obtenerConfiguracionS3().bucket;
    for (const documento of datos.documentos) {
      if (!documento.storagePath) {
        throw new ValidationError({
          invalidParams: [
            { name: 'documentos', reason: `ARCHIVO_SIN_OBJETO_ALMACENADO: ${documento.nombreArchivo} no tiene una ruta de almacenamiento real.` },
          ],
        });
      }
      await cliente.query(
        `INSERT INTO sigd_doc.documento_adjunto
           (expediente_id, tipo_documental_id, nombre_archivo, s3_bucket, s3_key, sha256, tamano_bytes, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          expedienteId,
          tipoDocumentalId,
          documento.nombreArchivo,
          bucket,
          documento.storagePath,
          documento.hashSha256.toLowerCase(),
          documento.tamanoBytes,
          documento.contentType,
        ],
      );
    }
  }

  private emitirCargoDigital(
    expedienteId: string,
    datos: RadicacionVirtualInput,
    now: Date,
  ): ResultadoRadicacion['cargoDigital'] {
    const codigo = `CARGO-${randomUUID().slice(0, 8).toUpperCase()}`;
    const contenido = JSON.stringify({
      codigo,
      expedienteId,
      totalFolios: datos.totalFolios,
      emitidoEn: now.toISOString(),
    });
    const hashSha256 = createHash('sha256').update(contenido).digest('hex');
    const qrContenido = `SIGD://cargo/${codigo}?h=${hashSha256.slice(0, 16)}`;

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
  return async function obtenerFeriados(): Promise<string[]> {
    const cliente = await pool.connect();
    try {
      const resultado = await cliente.query<{ fecha: string }>(
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha
           FROM sigd_org.calendario_laboral
          WHERE es_feriado = TRUE
            AND fecha >= CURRENT_DATE - INTERVAL '1 year'
            AND fecha <= CURRENT_DATE + INTERVAL '5 years'`,
      );
      return resultado.rows.map((fila) => fila.fecha);
    } catch {
      return [];
    } finally {
      cliente.release();
    }
  };
}


