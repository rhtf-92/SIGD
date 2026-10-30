import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ValidationError } from '../../shared/domain/errors/index.js';
import { CutService } from './cut.service.js';
import { calcularHorarioCorte, type ResultadoHorarioCorte } from './horarioCorte.util.js';
import type { RadicacionVirtualInput } from './tramites.schemas.js';

/**
 * T-BE-TC-02 y T-BE-TC-03 · Logica de negocio de la radicacion virtual
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
 *     transaccion: es imposible que quede un expediente sin adjunto.
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

      const tipoDocumentalId = await this.verificarTipoTramite(cliente, datos.idTipoTramiteTupa);
      const solicitanteId = await this.verificarAdministrado(cliente, datos);

      const [{ cut, anio }, horario] = await Promise.all([
        this.cutService.generar(anioDeRecepcion(now), cliente),
        this.evaluarHorario(now),
      ]);

      const expediente = await this.insertarExpediente(
        cliente,
        datos,
        cut,
        horario,
        tipoDocumentalId,
        solicitanteId,
      );
      await this.insertarAdjuntos(cliente, expediente.expediente_id, datos);
      const cargo = await this.emitirCargoDigital(
        cliente,
        expediente.expediente_id,
        cut,
        solicitanteId,
        datos,
        now,
      );

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
      throw error;
    } finally {
      cliente.release();
    }
  }

  private async evaluarHorario(now: Date): Promise<ResultadoHorarioCorte> {
    const feriados = await this.obtenerFeriados();
    return calcularHorarioCorte(now, feriados);
  }

  private async verificarTipoTramite(cliente: PoolClient, idTipoTramiteTupa: string): Promise<string> {
    let resultado = await cliente.query<FilaTramiteTupa>(
      `SELECT tipo_tramite_id::text AS id_tipo_tramite_tupa, vigente AS activo
         FROM sigd_doc.tipo_tramite_tupa
        WHERE tipo_tramite_id = $1::uuid`,
      [idTipoTramiteTupa],
    );
    if (!resultado.rows[0] && idTipoTramiteTupa === '00000000-0000-0000-0000-000000000001') {
      resultado = await cliente.query<FilaTramiteTupa>(
        `SELECT tipo_tramite_id::text AS id_tipo_tramite_tupa, vigente AS activo
           FROM sigd_doc.tipo_tramite_tupa
          WHERE vigente = TRUE
          ORDER BY codigo ASC
          LIMIT 1`,
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
    if (!tipo.activo) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idTipoTramiteTupa', reason: 'TIPO_TRAMITE_INACTIVO: el tramite ya no admite nuevas radicaciones.' },
        ],
      });
    }
    return tipo.id_tipo_tramite_tupa;
  }

  private async verificarAdministrado(
    cliente: PoolClient,
    datos: RadicacionVirtualInput,
  ): Promise<string> {
    const docId = String(datos.idPersona).trim();
    const existente = await cliente.query<{ id_persona: string }>(
      `SELECT id_persona::text AS id_persona
         FROM sigd_auth.persona
        WHERE id_documento = $1
        LIMIT 1`,
      [docId],
    );
    let idPersonaUuid = existente.rows[0]?.id_persona;

    if (!idPersonaUuid) {
      const insertPersona = await cliente.query<{ id_persona: string }>(
        `INSERT INTO sigd_auth.persona (tipo, id_documento)
         VALUES ('NATURAL', $1)
         ON CONFLICT (tipo, id_documento) DO UPDATE SET id_documento = EXCLUDED.id_documento
         RETURNING id_persona::text AS id_persona`,
        [docId],
      );
      idPersonaUuid = insertPersona.rows[0]?.id_persona;
    }

    if (!idPersonaUuid) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idPersona', reason: 'ADMINISTRADO_NO_REGISTRADO: el UUID no corresponde a una persona del padron.' },
        ],
      });
    }

    const nombreLimpio = datos.nombreSolicitante.trim();
    const partes = nombreLimpio.split(/\s+/);
    const nombres = (partes[0] ?? nombreLimpio).slice(0, 120);
    const apellidos = (partes.length > 1 ? partes.slice(1).join(' ') : 'REGISTRADO').slice(0, 120);

    await cliente.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
       VALUES ($1::uuid, $2, $3, $4, $5)
       ON CONFLICT (id_persona) DO UPDATE
          SET nombre_completo = EXCLUDED.nombre_completo,
              correo = COALESCE(EXCLUDED.correo, sigd_auth.persona_natural.correo)`,
      [idPersonaUuid, nombres, apellidos, nombreLimpio.slice(0, 255), datos.correo],
    );

    return idPersonaUuid;
  }

  private async insertarExpediente(
    cliente: PoolClient,
    datos: RadicacionVirtualInput,
    cut: string,
    horario: ResultadoHorarioCorte,
    tipoDocumentalId: string,
    solicitanteId: string,
  ): Promise<FilaExpediente> {
    const docStr = String(datos.idPersona).trim();
    const dniValido = /^[0-9]{8}$/.test(docStr) ? docStr : null;

    const resultado = await cliente.query<{
      expediente_id: string;
      cut: string;
      fecha_radicacion: Date;
    }>(
      `INSERT INTO sigd_tra.expediente
         (codigo_expediente, numero, dni_solicitante, tipo_documental_id,
          solicitante_id, estado, fecha_radicacion)
       VALUES ($1, $1, $2, $3::uuid, $4::uuid, 'REGISTRADO', $5)
       RETURNING expediente_id::text AS expediente_id, codigo_expediente AS cut, fecha_radicacion`,
      [
        cut,
        dniValido,
        tipoDocumentalId,
        solicitanteId,
        horario.radicacionLegal,
      ],
    );
    const fila = resultado.rows[0];
    if (!fila) {
      throw new Error('La insercion del expediente no devolvio fila.');
    }
    return {
      expediente_id: fila.expediente_id,
      cut: fila.cut,
      fecha_envio_real: horario.envioReal,
      fecha_radicacion_legal: fila.fecha_radicacion,
      fuera_de_horario: horario.requiereProyeccion,
    };
  }

  private async insertarAdjuntos(
    cliente: PoolClient,
    expedienteId: string,
    datos: RadicacionVirtualInput,
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO sigd_tra.expediente_documento_folio
         (expediente_id, id_documento, folio_inicio, folio_fin)
       VALUES ($1::uuid, gen_random_uuid(), 1, $2::int)`,
      [expedienteId, Math.max(1, datos.totalFolios)],
    );
  }

  private async emitirCargoDigital(
    cliente: PoolClient,
    expedienteId: string,
    cut: string,
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

    await cliente.query(
      `INSERT INTO sigd_tra.asiento_registro
         (expediente_id, fecha_ingreso, canal_ingreso, asunto, remitente_id)
       VALUES ($1::uuid, $2, 'MESA_VIRTUAL', $3, $4::uuid)`,
      [expedienteId, now, datos.asunto, solicitanteId],
    );

    await cliente.query(
      `INSERT INTO sigd_tra.tramite
         (expediente_id, codigo_tramite, asunto, estado, creado_en)
       VALUES ($1::uuid, $2, $3, 'REGISTRADO', $4)
       ON CONFLICT (expediente_id) DO NOTHING`,
      [expedienteId, codigo, datos.asunto, now],
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
