/**
 * T-BE-TC-06 / Endpoint #15 — Ventanilla Presencial y Cargo de Recepción Física
 * Responsable: Leysglin Riquelmer Rojas Fachin (B_RIQUELMER) / Grupo 2 TramiCore
 * Esquema: sigd_tra (DDL 05_sigd_tra.sql)
 *
 * Refactorización: Reemplaza la generación provisional Math.random() por la llamada
 * atómica PL/pgSQL a sigd_tra.generar_cut_expediente (consecutivo EXP-YYYY-XXXXXX con
 * bloqueo pesimista FOR UPDATE), registra el asiento institucional inmutable en
 * sigd_tra.asiento_registro y formatea el ticket térmico de 80mm/58mm.
 */

import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { TicketTermicoUtil } from './ticketTermico.util.js';
import { AppError, ValidationError } from '../../shared/domain/errors/index.js';
import { validarDni } from '../identicore/modulo11.validator.js';

export const identidadNaturalVentanillaSchema = z.object({
  tipoPersona: z.literal('NATURAL'),
  tipoDocumento: z.literal('DNI'),
  dniSolicitante: z.string().refine((dni) => validarDni(dni).valido, 'El DNI debe contener exactamente 8 dígitos.'),
  nombres: z.string({ required_error: 'Indique los nombres.' }).trim().min(1, 'Indique los nombres.').max(120),
  apellidos: z.string({ required_error: 'Indique los apellidos.' }).trim().min(1, 'Indique los apellidos.').max(120),
  correo: z.string().trim().email().max(160).optional(),
  telefono: z.string().trim().min(1).max(20).optional(),
});

export interface DatosRecepcionFisica extends z.infer<typeof identidadNaturalVentanillaSchema> {
  asunto: string;
  foliosTotales: number;
  idOperadorVentanilla?: string;
  areaDestinoId?: string;
  // El transporte aún lo declara opcional; el registro exige un UUID vigente
  // de sigd_doc.tipo_documento. No se deduce del DNI ni de un código de React.
  tipoDocumentalId?: string;
}

export interface ResultadoVentanilla {
  expedienteId: string;
  cut: string;
  anioFiscal: number;
  fechaRadicacion: string;
  ticketImpresion: string;
  cargo: {
    cut: string;
    remitente: string;
    dni: string;
    asunto: string;
    folios: number;
    fechaRecepcion: string;
    hashSha256: string;
    qrSeguimientoUrl: string;
  };
}

export class VentanillaPresencialService {
  constructor(private readonly pool: Pool) {}

  public async registrarExpedienteVentanilla(
    datos: DatosRecepcionFisica,
    clienteTransaccional?: PoolClient,
  ): Promise<ResultadoVentanilla> {
    const validacionIdentidad = identidadNaturalVentanillaSchema.safeParse(datos);
    if (!validacionIdentidad.success) {
      throw new ValidationError({
        invalidParams: validacionIdentidad.error.issues.map((issue) => ({ name: issue.path.join('.'), reason: issue.message })),
      });
    }
    const solicitante = validacionIdentidad.data;
    // Orden existente en IdentiCore: nombres seguidos de los apellidos explícitos.
    const nombreCompleto = [solicitante.nombres, solicitante.apellidos].join(' ');

    if (!datos.asunto || datos.asunto.trim().length < 5) {
      throw new ValidationError({
        invalidParams: [{ name: 'asunto', reason: 'El asunto debe tener al menos 5 caracteres.' }],
      });
    }

    if (datos.foliosTotales <= 0) {
      throw new ValidationError({
        invalidParams: [{ name: 'foliosTotales', reason: 'El número de folios debe ser mayor a 0.' }],
      });
    }

    const validacionTipoDocumental = z.string().uuid().safeParse(datos.tipoDocumentalId);
    if (!validacionTipoDocumental.success) {
      throw new ValidationError({
        invalidParams: [{
          name: 'tipoDocumentalId',
          reason: 'Indique el UUID de un tipo documental vigente del catálogo sigd_doc.tipo_documento.',
        }],
      });
    }
    const tipoDocumentalId = validacionTipoDocumental.data;

    const cliente = clienteTransaccional ?? (await this.pool.connect());
    const debeManejarTx = !clienteTransaccional;

    try {
      if (debeManejarTx) await cliente.query('BEGIN');

      // Validar antes de generar el CUT (su función escribe en la secuencia)
      // o registrar identidades. El bloqueo conserva la vigencia hasta el cierre
      // de la transacción; no reemplaza la FK que debe garantizar PostgreSQL.
      const tipoDocumental = await cliente.query<{ tipo_documental_id: string }>(
        `SELECT tipo_documental_id
           FROM sigd_doc.tipo_documento
          WHERE tipo_documental_id = $1::uuid AND vigente = TRUE
          FOR SHARE;`,
        [tipoDocumentalId],
      );
      if (!tipoDocumental.rows[0]) {
        throw new ValidationError({
          invalidParams: [{
            name: 'tipoDocumentalId',
            reason: 'El tipo documental no existe o no está vigente en sigd_doc.tipo_documento. Seleccione un tipo válido del catálogo institucional.',
          }],
        });
      }

      const anioActual = new Date().getFullYear();

      // 1. Asignación atómica de CUT universal mediante función PL/pgSQL
      const cutRes = await cliente.query<{ cut: string }>(
        'SELECT sigd_tra.generar_cut_expediente($1::INT) AS cut;',
        [anioActual],
      );
      const cut = cutRes.rows[0]?.cut;

      if (!cut) {
        throw new AppError({
          status: 500,
          code: 'CUT_GENERATION_FAILED',
          message: 'Error al generar el Código Único de Trámite.',
        });
      }

      // 2. Resolver la identidad V2. El contrato actual admite solo DNI.
      const buscarPersona = () => cliente.query<{
        id_persona: string;
        id_persona_natural: string | null;
        nombre_completo: string | null;
      }>(
        `SELECT p.id_persona, pn.id_persona AS id_persona_natural, pn.nombre_completo
           FROM sigd_auth.persona p
           LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
          WHERE p.tipo = $1 AND p.id_documento = $2`,
        [solicitante.tipoPersona, solicitante.dniSolicitante],
      );

      let persona = (await buscarPersona()).rows[0];
      if (!persona) {
        const base = await cliente.query<{ id_persona: string }>(
          `INSERT INTO sigd_auth.persona (tipo, id_documento)
           VALUES ($1, $2)
           ON CONFLICT (tipo, id_documento) DO NOTHING
           RETURNING id_persona;`,
          [solicitante.tipoPersona, solicitante.dniSolicitante],
        );
        if (base.rowCount === 0) {
          // Otra transacción pudo registrar el mismo documento: releer, sin actualizarlo.
          persona = (await buscarPersona()).rows[0];
        } else {
          const idPersona = base.rows[0]?.id_persona;
          if (base.rowCount !== 1 || !idPersona) {
            throw new AppError({ status: 500, code: 'IDENTITY_CREATION_FAILED', message: 'No se pudo registrar la identidad del solicitante.' });
          }
          const extension = await cliente.query<{ id_persona: string }>(
            `INSERT INTO sigd_auth.persona_natural
               (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
             VALUES ($1::uuid, $2, $3, $4, $5, $6)
             RETURNING id_persona;`,
            [idPersona, solicitante.nombres, solicitante.apellidos, nombreCompleto, solicitante.correo ?? null, solicitante.telefono ?? null],
          );
          if (extension.rowCount !== 1 || extension.rows[0]?.id_persona !== idPersona) {
            throw new AppError({ status: 500, code: 'IDENTITY_CREATION_FAILED', message: 'No se pudo completar la identidad del solicitante.' });
          }
          persona = { id_persona: idPersona, id_persona_natural: extension.rows[0].id_persona, nombre_completo: nombreCompleto };
        }
      }
      if (!persona?.id_persona_natural || !persona.nombre_completo?.trim()) {
        throw new ValidationError({
          message: 'La identidad del solicitante está incompleta.',
          invalidParams: [{
            name: 'dniSolicitante',
            reason: 'La persona existe, pero no tiene una extensión persona_natural registrada. IdentiCore debe completarla con datos legítimos antes de continuar.',
          }],
        });
      }
      const solicitanteId = persona.id_persona;
      const nombreRemitente = persona.nombre_completo;

      // 3. Insertar expediente formal en sigd_tra.expediente
      const ahora = new Date();
      const expRes = await cliente.query<{ expediente_id: string }>(
        `INSERT INTO sigd_tra.expediente (
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
           $1,
           $2,
           $3::uuid,
           $4,
           $5::uuid,
           'RECEPCIONADO',
           $6
         ) RETURNING expediente_id;`,
        [
          cut,
          datos.dniSolicitante,
          tipoDocumentalId,
          solicitanteId,
          datos.areaDestinoId ?? null,
          ahora,
        ],
      );
      const expedienteId = expRes.rows[0].expediente_id;

      // 4. Asentar en libro de registro institucional inmutable
      await cliente.query(
        `INSERT INTO sigd_tra.asiento_registro (
           expediente_id,
           fecha_ingreso,
           canal_ingreso,
           asunto,
           remitente_id
         ) VALUES (
           $1::uuid,
           $2,
           'MESA_PRESENCIAL',
           $3,
           $4::uuid
         );`,
        [expedienteId, ahora, datos.asunto, solicitanteId],
      );

      if (debeManejarTx) await cliente.query('COMMIT');

      // 5. Generar cargo y ticket térmico
      const hashSeguridad = crypto
        .createHash('sha256')
        .update(`${cut}:${ahora.toISOString()}:${datos.dniSolicitante}`)
        .digest('hex');

      const qrUrlSeguimiento = `https://sigd.iestp-suiza.edu.pe/consulta/${encodeURIComponent(cut)}`;

      const ticketImpresion = TicketTermicoUtil.generarTicketVentanilla({
        cut,
        timestamp: ahora,
        folios: datos.foliosTotales,
        hashSha256: hashSeguridad,
        qrUrlSeguimiento,
      });

      return {
        expedienteId,
        cut,
        anioFiscal: anioActual,
        fechaRadicacion: ahora.toISOString(),
        ticketImpresion,
        cargo: {
          cut,
          remitente: nombreRemitente,
          dni: datos.dniSolicitante,
          asunto: datos.asunto,
          folios: datos.foliosTotales,
          fechaRecepcion: ahora.toISOString(),
          hashSha256: hashSeguridad,
          qrSeguimientoUrl: qrUrlSeguimiento,
        },
      };
    } catch (error) {
      if (debeManejarTx) await cliente.query('ROLLBACK');
      throw error;
    } finally {
      if (debeManejarTx) cliente.release();
    }
  }

  public static async registrarExpediente(datos: any, dbClient: any): Promise<string> {
    const canalEntrada = 'VENTANILLA_PRESENCIAL';
    const anioActual = new Date().getFullYear();
    const cutGenerado = `CUT-${anioActual}-${Math.floor(Math.random() * 9000) + 1000}`;

    const queryExpediente = `
      INSERT INTO sigd_tra.expediente (
        cut, 
        canal_recepcion, 
        id_operador_ventanilla,
        datos_remitente,
        asunto,
        folios,
        estado_tramite, 
        fecha_radicacion
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'RECEPCIONADO', NOW()
      ) RETURNING id_expediente;
    `;
    
    const valores = [
      cutGenerado, 
      canalEntrada, 
      datos.idOperadorVentanilla,
      datos.datosRemitente,
      datos.asunto,
      datos.foliosTotales
    ];

    await dbClient.query(queryExpediente, valores);
    return cutGenerado;
  }
}

export default VentanillaPresencialService;
