import { createHash, randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { resolverIdentidad } from '../../core/auth/auth.guard.js';
import { ValidationError } from '../../shared/domain/errors/index.js';
import { calcularHorarioCorte } from './horarioCorte.util.js';
import { crearProveedorFeriados } from './radicacionVirtual.service.js';
import { TicketTermicoUtil } from './ticketTermico.util.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES_VENTANILLA = ['ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'MESA_PARTES'];

function enviarError(res: Response, status: number, codigo: string, mensaje: string): void {
  res.status(status).json({ code: codigo, title: mensaje, detail: mensaje, error: { codigo, mensaje } });
}

function exigirInterno(req: Request, res: Response, next: NextFunction): void {
  try {
    const identidad = resolverIdentidad(req);
    if (identidad.via !== 'bearer') {
      enviarError(res, 401, 'NO_AUTENTICADO', 'Debe iniciar sesion.');
      return;
    }
    if (!identidad.roles.some((r: string) => ROLES_VENTANILLA.includes(r))) {
      enviarError(res, 403, 'SIN_PERMISO', 'Se requiere un rol interno.');
      return;
    }
  } catch {
    enviarError(res, 401, 'NO_AUTENTICADO', 'Debe iniciar sesion.');
    return;
  }
  next();
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * POST /api/v1/tramites/ventanilla-presencial
 * Radicacion fisica en ventanilla sobre el esquema real: persona natural por DNI,
 * expediente con el tramite del TUPA vigente y asiento en el canal MESA_PRESENCIAL.
 */
export function crearRouterVentanillaReal(pool: Pool): Router {
  const router = Router();

  router.post(
    '/tramites/ventanilla-presencial',
    exigirInterno,
    async (req: Request, res: Response): Promise<void> => {
      const cuerpo = (req.body ?? {}) as Record<string, unknown>;
      const dni = texto(cuerpo['dniSolicitante']);
      const nombres = texto(cuerpo['nombres']);
      const apellidos = texto(cuerpo['apellidos']);
      const asunto = texto(cuerpo['asunto']);
      const correo = texto(cuerpo['correo']);
      const telefono = texto(cuerpo['telefono']);
      const idTramite = texto(cuerpo['idTipoTramiteTupa']);
      const folios = Number(cuerpo['foliosTotales']);

      const invalidos: Array<{ name: string; reason: string }> = [];
      if (!/^[0-9]{8}$/.test(dni)) invalidos.push({ name: 'dniSolicitante', reason: 'El DNI debe tener exactamente 8 digitos.' });
      if (nombres.length < 2 || nombres.length > 120) invalidos.push({ name: 'nombres', reason: 'Ingrese los nombres del solicitante.' });
      if (apellidos.length < 2 || apellidos.length > 120) invalidos.push({ name: 'apellidos', reason: 'Ingrese los apellidos del solicitante.' });
      if (asunto.length < 10 || asunto.length > 500) invalidos.push({ name: 'asunto', reason: 'El asunto debe tener entre 10 y 500 caracteres.' });
      if (!UUID_RE.test(idTramite)) invalidos.push({ name: 'idTipoTramiteTupa', reason: 'Seleccione un tramite del TUPA.' });
      if (!Number.isInteger(folios) || folios < 1 || folios > 5000) invalidos.push({ name: 'foliosTotales', reason: 'Los folios deben ser un entero entre 1 y 5000.' });
      if (correo !== '' && (!correo.includes('@') || correo.length > 160)) invalidos.push({ name: 'correo', reason: 'El correo no es valido.' });
      if (telefono.length > 20) invalidos.push({ name: 'telefono', reason: 'El telefono no puede superar 20 caracteres.' });
      if (invalidos.length > 0) throw new ValidationError({ invalidParams: invalidos });

      const feriados = await crearProveedorFeriados(pool)();
      const horario = calcularHorarioCorte(new Date(), feriados);

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');

        const tramite = await cliente.query<{ tramite_version_id: string }>(
          `SELECT tv.tramite_version_id
             FROM sigd_tupa.tramite_version tv
             JOIN sigd_tupa.version v ON v.version_id = tv.version_id
            WHERE tv.tramite_version_id = $1
              AND v.estado = 'VIGENTE'
            LIMIT 1`,
          [idTramite],
        );
        if (!tramite.rows[0]) {
          throw new ValidationError({
            invalidParams: [{ name: 'idTipoTramiteTupa', reason: 'TRAMITE_TUPA_DESCONOCIDO: el tramite no existe en el TUPA vigente.' }],
          });
        }

        let personaId: string;
        let remitente = `${nombres} ${apellidos}`;
        const existente = await cliente.query<{ id_persona: string; nombre_completo: string | null }>(
          `SELECT p.id_persona, pn.nombre_completo
             FROM sigd_auth.persona p
             LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
            WHERE p.tipo = 'NATURAL' AND p.id_documento = $1
            LIMIT 1`,
          [dni],
        );
        if (existente.rows[0]) {
          personaId = existente.rows[0].id_persona;
          remitente = existente.rows[0].nombre_completo ?? remitente;
        } else {
          const nueva = await cliente.query<{ id_persona: string }>(
            `INSERT INTO sigd_auth.persona (tipo, id_documento) VALUES ('NATURAL', $1) RETURNING id_persona`,
            [dni],
          );
          personaId = nueva.rows[0]!.id_persona;
          await cliente.query(
            `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [personaId, nombres, apellidos, remitente, correo === '' ? null : correo, telefono === '' ? null : telefono],
          );
        }

        const numeroTemporal = `TMP-${randomUUID().slice(0, 12)}`;
        const expediente = await cliente.query<{ expediente_id: string; cut: string }>(
          `INSERT INTO sigd_tra.expediente
             (numero, dni_solicitante, tipo_documental_id, solicitante_id,
              area_destino_id, estado, fecha_radicacion, fecha_limite, tramite_version_id)
           VALUES ($1, $2, NULL, $3, NULL, 'REGISTRADO', $4, NULL, $5)
           RETURNING expediente_id, codigo_expediente AS cut`,
          [numeroTemporal, dni, personaId, horario.radicacionLegal, idTramite],
        );
        const fila = expediente.rows[0]!;
        await cliente.query(`UPDATE sigd_tra.expediente SET numero = $1 WHERE expediente_id = $2`, [
          fila.cut,
          fila.expediente_id,
        ]);

        await cliente.query(
          `INSERT INTO sigd_tra.asiento_registro
             (expediente_id, fecha_ingreso, canal_ingreso, asunto, remitente_id)
           VALUES ($1, $2, 'MESA_PRESENCIAL', $3, $4)`,
          [fila.expediente_id, horario.envioReal, asunto, personaId],
        );

        await cliente.query('COMMIT');

        const hashSha256 = createHash('sha256')
          .update(`${fila.cut}:${horario.envioReal.toISOString()}:${dni}`)
          .digest('hex');
        const qrSeguimientoUrl = `/consulta/${encodeURIComponent(fila.cut)}`;
        const ticketImpresion = TicketTermicoUtil.generarTicketVentanilla({
          cut: fila.cut,
          timestamp: horario.envioReal,
          folios,
          hashSha256,
          qrUrlSeguimiento: qrSeguimientoUrl,
        });

        res.status(201).json({
          expedienteId: fila.expediente_id,
          cut: fila.cut,
          anioFiscal: Number(fila.cut.slice(4, 8)),
          fechaRadicacion: horario.radicacionLegal.toISOString(),
          ticketImpresion,
          cargo: {
            cut: fila.cut,
            remitente,
            dni,
            asunto,
            folios,
            fechaRecepcion: horario.envioReal.toISOString(),
            hashSha256,
            qrSeguimientoUrl,
          },
        });
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
      } finally {
        cliente.release();
      }
    },
  );

  return router;
}