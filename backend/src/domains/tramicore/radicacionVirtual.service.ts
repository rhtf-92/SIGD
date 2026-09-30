import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ValidationError } from '../../shared/domain/errors/index.js';
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
  cut: string;
  fecha_envio_real: Date;
  fecha_radicacion_legal: Date;
  fuera_de_horario: boolean;
}

interface FilaTramiteTupa {
  id_tipo_tramite_tupa: string;
  activo: boolean;
}

interface FilaPersona {
  id: string;
  estado: boolean;
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
      const cargo = await this.emitirCargoDigital(cliente, expediente.expediente_id, datos, now);

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

  private async evaluarHorario(now: Date): Promise<ResultadoHorarioCorte> {
    const feriados = await this.obtenerFeriados();
    return calcularHorarioCorte(now, feriados);
  }

  private async verificarTipoTramite(cliente: PoolClient, idTipoTramiteTupa: string): Promise<void> {
    const resultado = await cliente.query<FilaTramiteTupa>(
      `SELECT id_tipo_tramite_tupa, activo
         FROM sigd_doc.tipo_tramite_tupa
        WHERE id_tipo_tramite_tupa = $1`,
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

  private async verificarAdministrado(cliente: PoolClient, idPersona: number): Promise<void> {
    const resultado = await cliente.query<FilaPersona>(
      'SELECT id::text AS id, estado FROM sigd_auth.persona WHERE id = $1',
      [idPersona],
    );
    const persona = resultado.rows[0];
    if (!persona) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idPersona', reason: 'ADMINISTRADO_NO_REGISTRADO: el UUID no corresponde a una persona del padron.' },
        ],
      });
    }
    if (!persona.estado) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idPersona', reason: 'ADMINISTRADO_INACTIVO: la persona esta desactivada y no puede radicar.' },
        ],
      });
    }
  }

  private async insertarExpediente(
    cliente: PoolClient,
    datos: RadicacionVirtualInput,
    cut: string,
    horario: ResultadoHorarioCorte,
  ): Promise<FilaExpediente> {
    const resultado = await cliente.query<FilaExpediente>(
      `INSERT INTO sigd_tra.expediente
         (cut, id_persona, id_tipo_tramite_tupa, nombre_solicitante,
          correo_notificacion, asunto, canal_recepcion,
          estado_tramite, total_folios, fecha_envio_real, fecha_radicacion_legal,
          fuera_de_horario)
       VALUES ($1, $2, $3, $4, $5, $6, 'MESA_VIRTUAL', 'REGISTRADO', $7, $8, $9, $10)
       RETURNING expediente_id, cut, fecha_envio_real, fecha_radicacion_legal, fuera_de_horario`,
      [
        cut,
        datos.idPersona,
        datos.idTipoTramiteTupa,
        datos.nombreSolicitante,
        datos.correo,
        datos.asunto,
        datos.totalFolios,
        horario.envioReal,
        horario.radicacionLegal,
        horario.requiereProyeccion,
      ],
    );
    const expediente = resultado.rows[0];
    if (!expediente) {
      throw new Error('La insercion del expediente no devolvio fila.');
    }
    return expediente;
  }

  private async insertarAdjuntos(
    cliente: PoolClient,
    expedienteId: string,
    datos: RadicacionVirtualInput,
  ): Promise<void> {
    for (const documento of datos.documentos) {
      await cliente.query(
        `INSERT INTO sigd_tra.documento_adjunto
           (expediente_id, nombre_archivo, content_type, tamano_bytes, hash_sha256, storage_path)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          expedienteId,
          documento.nombreArchivo,
          documento.contentType,
          documento.tamanoBytes,
          documento.hashSha256.toLowerCase(),
          documento.storagePath ?? null,
        ],
      );
    }
  }

  private async emitirCargoDigital(
    cliente: PoolClient,
    expedienteId: string,
    datos: RadicacionVirtualInput,
    now: Date,
  ): Promise<ResultadoRadicacion['cargoDigital']> {
    const codigo = `CARGO-${randomUUID().slice(0, 8).toUpperCase()}`;
    const contenido = JSON.stringify({
      codigo,
      expedienteId,
      totalFolios: datos.totalFolios,
      emitidoEn: now.toISOString(),
    });
    const hashSha256 = createHash('sha256').update(contenido).digest('hex');
    const qrContenido = `SIGD://cargo/${codigo}?h=${hashSha256.slice(0, 16)}`;

    await cliente.query(
      `INSERT INTO sigd_tra.cargo_digital
         (expediente_id, codigo_cargo, hash_sha256, qr_contenido, emitido_en)
       VALUES ($1, $2, $3, $4, $5)`,
      [expedienteId, codigo, hashSha256, qrContenido, now],
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


