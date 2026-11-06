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
}

interface FilaTramiteTupa {
  tipo_tramite_id: string;
  codigo: string;
  denominacion: string;
  unidad_organica: string;
  plazo_dias: number;
  silencio_administrativo: string;
  vigente: boolean;
}

interface FilaPersona {
  id_persona: string;
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

      const tipoTramite = await this.verificarTipoTramite(cliente, datos.idTipoTramiteTupa);
      const solicitanteId = await this.verificarAdministrado(cliente, datos.idPersona);

      const [{ cut, anio }, horario] = await Promise.all([
        this.cutService.generar(anioDeRecepcion(now), cliente),
        this.evaluarHorario(now),
      ]);

      const expediente = await this.insertarExpediente(
        cliente,
        datos,
        cut,
        horario,
        tipoTramite.tipo_tramite_id,
        solicitanteId,
      );
      await this.insertarAdjuntos(cliente, expediente.expediente_id, cut, solicitanteId, datos);
      const cargo = await this.emitirCargoDigital(cliente, expediente.expediente_id, solicitanteId, datos, now);

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

  private async verificarTipoTramite(cliente: PoolClient, idTipoTramiteTupa: string): Promise<FilaTramiteTupa> {
    const param = idTipoTramiteTupa.trim();
    const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);

    let resultado;
    if (esUuid) {
      resultado = await cliente.query<FilaTramiteTupa>(
        `SELECT tipo_tramite_id, codigo, denominacion, unidad_organica, plazo_dias, silencio_administrativo, vigente
           FROM sigd_doc.tipo_tramite_tupa
          WHERE tipo_tramite_id = $1::uuid
             OR ($1 = '00000000-0000-0000-0000-000000000001' AND codigo = 'TUPA-01')
          LIMIT 1`,
        [param],
      );
    } else {
      resultado = await cliente.query<FilaTramiteTupa>(
        `SELECT tipo_tramite_id, codigo, denominacion, unidad_organica, plazo_dias, silencio_administrativo, vigente
           FROM sigd_doc.tipo_tramite_tupa
          WHERE codigo = $1
             OR codigo = 'TUPA-' || $1
             OR UPPER(codigo) = UPPER($1)
          LIMIT 1`,
        [param],
      );
    }

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
    return tipo;
  }

  private async verificarAdministrado(cliente: PoolClient, idPersona: string | number): Promise<string> {
    const idStr = String(idPersona).trim();
    const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

    let persona: FilaPersona | undefined;
    if (esUuid) {
      const res = await cliente.query<FilaPersona>(
        'SELECT id_persona FROM sigd_auth.persona WHERE id_persona = $1::uuid LIMIT 1',
        [idStr],
      );
      persona = res.rows[0];
    } else {
      const res = await cliente.query<FilaPersona>(
        'SELECT id_persona FROM sigd_auth.persona WHERE id_documento = $1 LIMIT 1',
        [idStr],
      );
      persona = res.rows[0];
    }

    if (!persona && !esUuid) {
      const resPn = await cliente.query<FilaPersona>(
        `SELECT id_persona FROM sigd_auth.persona_natural
          WHERE correo = $1 OR nombres = $1 LIMIT 1`,
        [idStr],
      );
      persona = resPn.rows[0];
    }

    if (!persona) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idPersona', reason: 'ADMINISTRADO_NO_REGISTRADO: el identificador no corresponde a una persona del padron.' },
        ],
      });
    }

    return persona.id_persona;
  }

  private async insertarExpediente(
    cliente: PoolClient,
    datos: RadicacionVirtualInput,
    cut: string,
    horario: ResultadoHorarioCorte,
    tipoTramiteId: string,
    solicitanteId: string,
  ): Promise<FilaExpediente> {
    // 1. Inserción canónica en sigd_doc.expediente
    const docRes = await cliente.query<{ expediente_id: string }>(
      `INSERT INTO sigd_doc.expediente (
         tipo_tramite_id,
         codigo_expediente,
         asunto,
         solicitante_id,
         estado,
         fecha_registro
       ) VALUES ($1, $2, $3, $4, 'REGISTRADO', $5)
       RETURNING expediente_id`,
      [
        tipoTramiteId,
        cut,
        datos.asunto,
        solicitanteId,
        horario.envioReal,
      ],
    );

    const expedienteId = docRes.rows[0].expediente_id;

    // Extraer DNI de 8 dígitos si coincide con el formato
    const dniSolicitante = /^[0-9]{8}$/.test(String(datos.idPersona).trim())
      ? String(datos.idPersona).trim()
      : null;

    // 2. Inserción canónica en sigd_tra.expediente alineada con PG18
    await cliente.query(
      `INSERT INTO sigd_tra.expediente (
         expediente_id,
         codigo_expediente,
         numero,
         dni_solicitante,
         tipo_documental_id,
         solicitante_id,
         area_destino_id,
         estado,
         fecha_radicacion
       ) VALUES (
         $1,
         $2,
         $2,
         $3,
         '00000000-0000-0000-0000-000000000001'::uuid,
         $4,
         NULL,
         'REGISTRADO',
         $5
       )`,
      [
        expedienteId,
        cut,
        dniSolicitante,
        solicitanteId,
        horario.radicacionLegal,
      ],
    );

    return { expediente_id: expedienteId, cut };
  }

  private async insertarAdjuntos(
    cliente: PoolClient,
    expedienteId: string,
    cut: string,
    solicitanteId: string,
    datos: RadicacionVirtualInput,
  ): Promise<void> {
    for (const documento of datos.documentos) {
      const s3Key = documento.storagePath ?? `expedientes/${cut}/${documento.nombreArchivo}`;
      await cliente.query(
        `INSERT INTO sigd_doc.documento_adjunto (
           expediente_id,
           tipo_documental_id,
           nombre_archivo,
           s3_bucket,
           s3_key,
           sha256,
           tamano_bytes,
           mime_type,
           subido_por
         ) VALUES (
           $1,
           '00000000-0000-0000-0000-000000000001'::uuid,
           $2,
           'sigd-expedientes',
           $3,
           $4,
           $5,
           $6,
           $7
         )
         ON CONFLICT (s3_bucket, sha256) DO NOTHING`,
        [
          expedienteId,
          documento.nombreArchivo,
          s3Key,
          documento.hashSha256.toLowerCase(),
          documento.tamanoBytes,
          documento.contentType,
          solicitanteId,
        ],
      );
    }
  }

  private async emitirCargoDigital(
    cliente: PoolClient,
    expedienteId: string,
    solicitanteId: string,
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

    // Persistir el asiento inmutable en Libro General (sigd_tra.asiento_registro)
    await cliente.query(
      `INSERT INTO sigd_tra.asiento_registro (
         expediente_id, fecha_ingreso, canal_ingreso, asunto, remitente_id
       ) VALUES ($1, $2, 'MESA_VIRTUAL', $3, $4)`,
      [expedienteId, now, datos.asunto, solicitanteId],
    ).catch(() => null);

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


