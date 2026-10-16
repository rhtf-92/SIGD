import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import express from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';
import { validarMagicBytes } from '../../core/storage/s3-storage.service.js';
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { crearAlmacenResolucionTupa } from './tupa.resolucion-storage.js';
import { exigirPdfParaPublicar, exigirVersionBorrador } from './tupa.rules.js';

const versionIdSchema = z.string().uuid();
const pageSchema = z.coerce.number().int().min(1).max(10_000).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const crearVersionSchema = z.object({
  codigo: z.string().trim().min(1).max(30),
  nombre: z.string().trim().min(1).max(200),
  fecha_vigencia: z.string().date().nullable().optional(),
  uit_vigente: z.number().positive().max(1_000_000),
  copiarDesdeVersionId: versionIdSchema.optional(),
});
const publicarSchema = z.object({
  resolucion_numero: z.string().trim().min(1).max(100),
  resolucion_fecha: z.string().date(),
  fecha_vigencia: z.string().date(),
});
const tramiteSchema = z.object({
  codigo: z.string().trim().min(1).max(30),
  denominacion: z.string().trim().min(1).max(300),
  rubro: z.string().trim().min(1).max(200),
  descripcion: z.string().nullable().optional(),
  derecho_monto: z.number().nonnegative().nullable().optional(),
  derecho_porcentaje_uit: z.number().nonnegative().nullable().optional(),
  derecho_texto: z.string().max(100).nullable().optional(),
  cuenta_pago: z.string().max(60).nullable().optional(),
  plazo_texto: z.string().max(300).nullable().optional(),
  plazo_dias_habiles: z.number().int().positive().nullable().optional(),
  calificacion: z.enum(['EVALUACION_PREVIA', 'APROBACION_AUTOMATICA', 'NO_APLICA']),
  silencio_administrativo: z.enum(['POSITIVO', 'NEGATIVO', 'NO_APLICA']),
  unidad_recibe: z.string().max(200).nullable().optional(),
  autoridad_resuelve: z.string().max(200).nullable().optional(),
  recursos: z.string().nullable().optional(),
  base_legal: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
});
const requisitoSchema = z.object({
  orden: z.number().int().min(1).max(32767),
  texto: z.string().trim().min(1),
});

const columnasTramite = [
  'codigo',
  'denominacion',
  'rubro',
  'descripcion',
  'derecho_monto',
  'derecho_porcentaje_uit',
  'derecho_texto',
  'cuenta_pago',
  'plazo_texto',
  'plazo_dias_habiles',
  'calificacion',
  'silencio_administrativo',
  'unidad_recibe',
  'autoridad_resuelve',
  'recursos',
  'base_legal',
  'observaciones',
] as const;

type CampoTramite = (typeof columnasTramite)[number];
type DatosTramite = z.infer<typeof tramiteSchema>;

function validarUuid(valor: unknown, nombre: string): string {
  const resultado = versionIdSchema.safeParse(String(valor));
  if (!resultado.success) {
    throw new AppError({
      status: 400,
      code: 'INVALID_IDENTIFIER',
      message: `El identificador ${nombre} no es válido.`,
    });
  }
  return resultado.data.toLowerCase();
}

function obtenerIdUsuario(req: Request): { id: string; roles: string[] } {
  const token = extraerTokenBearer(req.get('authorization'));
  if (!token) throw new UnauthorizedError({ detail: 'Debe iniciar sesión para administrar versiones TUPA.' });
  const claims = verificarTokenAcceso(token);
  return { id: claims.sub, roles: claims.roles };
}

function exigirAdministrador(req: Request, _res: Response, next: (error?: unknown) => void): void {
  try {
    const { roles } = obtenerIdUsuario(req);
    // ADMINISTRADOR es el rol administrativo más privilegiado definido por la migración 03.
    if (!roles.some((rol) => ['ADMINISTRADOR', 'SUPERADMINISTRADOR', 'SUPER_ADMINISTRADOR', 'SUPER_ADMIN'].includes(rol))) {
      throw new ForbiddenError({ detail: 'La gestión de versiones TUPA requiere el rol administrador.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

function parsearCuerpo<T>(schema: z.ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

function comprobarVersionPresente<T extends { version_id: string }>(filas: T[], versionId: string): T {
  const version = filas.find((fila) => fila.version_id === versionId);
  if (!version) throw new NotFoundError({ detail: 'La versión TUPA solicitada no existe.' });
  return version;
}

async function buscarVersion(client: Pool | PoolClient, versionId: string, bloquear = false) {
  const resultado = await client.query(
    `SELECT version_id, codigo, nombre, fecha_vigencia, uit_vigente, resolucion_numero,
            resolucion_fecha, resolucion_pdf_ref, resolucion_pdf_sha256, estado,
            version_anterior_id, creado_en
       FROM sigd_tupa.version
      WHERE version_id = $1${bloquear ? ' FOR UPDATE' : ''}`,
    [versionId],
  );
  if (!resultado.rows[0]) throw new NotFoundError({ detail: 'La versión TUPA solicitada no existe.' });
  return resultado.rows[0] as {
    version_id: string;
    codigo: string;
    estado: string;
    resolucion_pdf_ref: string | null;
  };
}

async function exigirBorrador(client: Pool | PoolClient, versionId: string) {
  const version = await buscarVersion(client, versionId, true);
  exigirVersionBorrador(version.estado, version.codigo);
  return version;
}

async function transaccion<T>(pool: Pool, operacion: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await operacion(client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError: unknown) => {
      console.error('[TUPA] Error al revertir transacción:', rollbackError);
    });
    throw error;
  } finally {
    client.release();
  }
}

function construirCamposUpdate(datos: Partial<DatosTramite>, indiceInicial: number): {
  fragmento: string;
  valores: unknown[];
} {
  const presentes = columnasTramite.filter((columna) => Object.hasOwn(datos, columna));
  if (presentes.length === 0) {
    throw new AppError({ status: 400, code: 'EMPTY_UPDATE', message: 'Debe enviar al menos un campo para actualizar.' });
  }
  const valores = presentes.map((columna) => datos[columna as CampoTramite] ?? null);
  return {
    fragmento: presentes.map((columna, indice) => `${columna} = $${indiceInicial + indice}`).join(', '),
    valores,
  };
}

export function crearRouterTupa(pool: Pool): Router {
  const router = Router();
  const almacen = crearAlmacenResolucionTupa();

  router.get('/tupa/vigente', async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT version_id, codigo, nombre, fecha_vigencia, uit_vigente, resolucion_numero,
              resolucion_fecha, resolucion_pdf_sha256, creado_en
         FROM sigd_tupa.version
        WHERE estado = 'VIGENTE'`,
    );
    if (!rows[0]) throw new NotFoundError({ detail: 'No hay una versión vigente del TUPA.' });
    res.json({ version: rows[0] });
  });

  router.get('/tupa/vigente/tramites', async (req, res) => {
    const pagina = pageSchema.parse(req.query.pagina ?? req.query.page);
    const porPagina = limitSchema.parse(req.query.porPagina ?? req.query.limit);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 150) : '';
    const rubro = typeof req.query.rubro === 'string' ? req.query.rubro.trim().slice(0, 200) : '';
    const parametros: unknown[] = [q, rubro];
    const filtro = `WHERE v.estado = 'VIGENTE'
      AND ($1 = '' OR t.codigo ILIKE '%' || $1 || '%' OR t.denominacion ILIKE '%' || $1 || '%')
      AND ($2 = '' OR t.rubro = $2)`;
    const total = await pool.query(
      `SELECT count(*)::int AS total
         FROM sigd_tupa.tramite_version t
         JOIN sigd_tupa.version v ON v.version_id = t.version_id
        ${filtro}`,
      parametros,
    );
    const listado = await pool.query(
      `SELECT t.tramite_version_id, t.codigo, t.denominacion, t.rubro, t.derecho_monto,
              t.derecho_porcentaje_uit, t.derecho_texto, t.plazo_texto, t.plazo_dias_habiles
         FROM sigd_tupa.tramite_version t
         JOIN sigd_tupa.version v ON v.version_id = t.version_id
        ${filtro}
        ORDER BY t.codigo
        LIMIT $3 OFFSET $4`,
      [...parametros, porPagina, (pagina - 1) * porPagina],
    );
    const rubros = await pool.query(
      `SELECT DISTINCT t.rubro
         FROM sigd_tupa.tramite_version t
         JOIN sigd_tupa.version v ON v.version_id = t.version_id
        WHERE v.estado = 'VIGENTE'
        ORDER BY t.rubro`,
    );
    res.json({ tramites: listado.rows, total: total.rows[0].total, pagina, porPagina, rubros: rubros.rows.map((fila) => fila.rubro) });
  });

  router.get('/tupa/vigente/tramites/:codigo', async (req, res) => {
    const codigo = String(req.params.codigo);
    const resultado = await pool.query(
      `SELECT t.*,
              COALESCE(json_agg(json_build_object('requisito_id', r.requisito_id, 'orden', r.orden, 'texto', r.texto)
                                ORDER BY r.orden) FILTER (WHERE r.requisito_id IS NOT NULL), '[]') AS requisitos
         FROM sigd_tupa.tramite_version t
         JOIN sigd_tupa.version v ON v.version_id = t.version_id
         LEFT JOIN sigd_tupa.tramite_requisito r ON r.tramite_version_id = t.tramite_version_id
        WHERE v.estado = 'VIGENTE' AND t.codigo = $1
        GROUP BY t.tramite_version_id`,
      [codigo],
    );
    if (!resultado.rows[0]) throw new NotFoundError({ detail: 'No existe ese código en el TUPA vigente.' });
    res.json({ tramite: resultado.rows[0] });
  });

  router.use('/tupa/versiones', exigirAdministrador);

  router.get('/tupa/versiones', async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT v.version_id, v.codigo, v.nombre, v.fecha_vigencia, v.uit_vigente,
              v.resolucion_numero, v.resolucion_fecha, v.resolucion_pdf_ref IS NOT NULL AS tiene_resolucion,
              v.estado, v.version_anterior_id, v.creado_en,
              count(t.tramite_version_id)::int AS total_tramites
         FROM sigd_tupa.version v
         LEFT JOIN sigd_tupa.tramite_version t ON t.version_id = v.version_id
        GROUP BY v.version_id
        ORDER BY v.creado_en DESC`,
    );
    res.json({ versiones: rows });
  });

  router.post('/tupa/versiones', async (req, res) => {
    const actor = obtenerIdUsuario(req);
    const datos = parsearCuerpo(crearVersionSchema, req.body);
    const nueva = await transaccion(pool, async (client) => {
      await client.query(`SELECT set_config('sigd_tupa.usuario_id', $1, true)`, [actor.id]);
      const anterior = datos.copiarDesdeVersionId
        ? await buscarVersion(client, datos.copiarDesdeVersionId, true)
        : null;
      const insertada = await client.query(
        `INSERT INTO sigd_tupa.version (codigo, nombre, fecha_vigencia, uit_vigente, version_anterior_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING version_id, codigo, nombre, fecha_vigencia, uit_vigente, estado, version_anterior_id, creado_en`,
        [
          datos.codigo,
          datos.nombre,
          datos.fecha_vigencia ?? null,
          datos.uit_vigente,
          anterior?.version_id ?? null,
        ],
      );
      const version = insertada.rows[0] as { version_id: string };

      if (anterior) {
        await client.query(
          `INSERT INTO sigd_tupa.tramite_version (
             version_id, codigo, denominacion, descripcion, rubro, derecho_monto, derecho_porcentaje_uit,
             derecho_texto, cuenta_pago, plazo_texto, plazo_dias_habiles, calificacion,
             silencio_administrativo, unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
           )
           SELECT $1, codigo, denominacion, descripcion, rubro, derecho_monto, derecho_porcentaje_uit,
                  derecho_texto, cuenta_pago, plazo_texto, plazo_dias_habiles, calificacion,
                  silencio_administrativo, unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
             FROM sigd_tupa.tramite_version
            WHERE version_id = $2`,
          [version.version_id, anterior.version_id],
        );
        await client.query(
          `INSERT INTO sigd_tupa.tramite_requisito (tramite_version_id, orden, texto)
           SELECT nuevo.tramite_version_id, requisito.orden, requisito.texto
             FROM sigd_tupa.tramite_version anterior
             JOIN sigd_tupa.tramite_version nuevo
               ON nuevo.version_id = $1 AND nuevo.codigo = anterior.codigo
             JOIN sigd_tupa.tramite_requisito requisito
               ON requisito.tramite_version_id = anterior.tramite_version_id
            WHERE anterior.version_id = $2`,
          [version.version_id, anterior.version_id],
        );
      }
      return insertada.rows[0];
    });
    res.status(201).json({ version: nueva });
  });

  router.get('/tupa/versiones/:id', async (req, res) => {
    const versionId = validarUuid(req.params.id, 'de versión');
    const { rows } = await pool.query(
      `SELECT v.*,
              (SELECT count(*)::int FROM sigd_tupa.tramite_version t WHERE t.version_id = v.version_id) AS total_tramites
         FROM sigd_tupa.version v
        WHERE v.version_id = $1`,
      [versionId],
    );
    res.json({ version: comprobarVersionPresente(rows, versionId) });
  });

  router.get('/tupa/versiones/:id/tramites', async (req, res) => {
    const versionId = validarUuid(req.params.id, 'de versión');
    await buscarVersion(pool, versionId);
    const { rows } = await pool.query(
      `SELECT t.*,
              COALESCE(json_agg(json_build_object('requisito_id', r.requisito_id, 'orden', r.orden, 'texto', r.texto)
                                ORDER BY r.orden) FILTER (WHERE r.requisito_id IS NOT NULL), '[]') AS requisitos
         FROM sigd_tupa.tramite_version t
         LEFT JOIN sigd_tupa.tramite_requisito r ON r.tramite_version_id = t.tramite_version_id
        WHERE t.version_id = $1
        GROUP BY t.tramite_version_id
        ORDER BY t.codigo`,
      [versionId],
    );
    res.json({ tramites: rows });
  });

  router.post('/tupa/versiones/:id/tramites', async (req, res) => {
    const versionId = validarUuid(req.params.id, 'de versión');
    const datos = parsearCuerpo(tramiteSchema, req.body);
    const insertada = await transaccion(pool, async (client) => {
      await exigirBorrador(client, versionId);
      const { rows } = await client.query(
        `INSERT INTO sigd_tupa.tramite_version (version_id, ${columnasTramite.join(', ')})
         VALUES ($1, ${columnasTramite.map((_col, indice) => `$${indice + 2}`).join(', ')})
         RETURNING *`,
        [versionId, ...columnasTramite.map((columna) => datos[columna] ?? null)],
      );
      return rows[0];
    });
    res.status(201).json({ tramite: insertada });
  });

  router.patch('/tupa/versiones/:id/tramites/:tramiteId', async (req, res) => {
    const versionId = validarUuid(req.params.id, 'de versión');
    const tramiteId = validarUuid(req.params.tramiteId, 'de trámite');
    const datos = parsearCuerpo(tramiteSchema.partial(), req.body);
    const cambio = construirCamposUpdate(datos, 3);
    const actualizado = await transaccion(pool, async (client) => {
      await exigirBorrador(client, versionId);
      const { rows } = await client.query(
        `UPDATE sigd_tupa.tramite_version SET ${cambio.fragmento}
          WHERE version_id = $1 AND tramite_version_id = $2 RETURNING *`,
        [versionId, tramiteId, ...cambio.valores],
      );
      if (!rows[0]) throw new NotFoundError({ detail: 'El trámite no existe en esa versión.' });
      return rows[0];
    });
    res.json({ tramite: actualizado });
  });

  router.delete('/tupa/versiones/:id/tramites/:tramiteId', async (req, res) => {
    const versionId = validarUuid(req.params.id, 'de versión');
    const tramiteId = validarUuid(req.params.tramiteId, 'de trámite');
    await transaccion(pool, async (client) => {
      await exigirBorrador(client, versionId);
      const { rowCount } = await client.query(
        'DELETE FROM sigd_tupa.tramite_version WHERE version_id = $1 AND tramite_version_id = $2',
        [versionId, tramiteId],
      );
      if (!rowCount) throw new NotFoundError({ detail: 'El trámite no existe en esa versión.' });
    });
    res.status(204).end();
  });

  router.post('/tupa/versiones/:id/tramites/:tramiteId/requisitos', async (req, res) => {
    const versionId = validarUuid(req.params.id, 'de versión');
    const tramiteId = validarUuid(req.params.tramiteId, 'de trámite');
    const datos = parsearCuerpo(requisitoSchema, req.body);
    const insertado = await transaccion(pool, async (client) => {
      await exigirBorrador(client, versionId);
      const tramite = await client.query(
        'SELECT 1 FROM sigd_tupa.tramite_version WHERE version_id = $1 AND tramite_version_id = $2',
        [versionId, tramiteId],
      );
      if (!tramite.rowCount) throw new NotFoundError({ detail: 'El trámite no existe en esa versión.' });
      const { rows } = await client.query(
        `INSERT INTO sigd_tupa.tramite_requisito (tramite_version_id, orden, texto)
         VALUES ($1, $2, $3) RETURNING *`,
        [tramiteId, datos.orden, datos.texto],
      );
      return rows[0];
    });
    res.status(201).json({ requisito: insertado });
  });

  router.patch('/tupa/versiones/:id/tramites/:tramiteId/requisitos/:requisitoId', async (req, res) => {
    const versionId = validarUuid(req.params.id, 'de versión');
    const tramiteId = validarUuid(req.params.tramiteId, 'de trámite');
    const requisitoId = validarUuid(req.params.requisitoId, 'de requisito');
    const datos = parsearCuerpo(requisitoSchema.partial(), req.body);
    if (!Object.keys(datos).length) {
      throw new AppError({ status: 400, code: 'EMPTY_UPDATE', message: 'Debe enviar orden o texto del requisito.' });
    }
    const actualizado = await transaccion(pool, async (client) => {
      await exigirBorrador(client, versionId);
      const { rows } = await client.query(
        `UPDATE sigd_tupa.tramite_requisito r
            SET orden = COALESCE($4, r.orden), texto = COALESCE($5, r.texto)
           FROM sigd_tupa.tramite_version t
          WHERE r.requisito_id = $1 AND r.tramite_version_id = t.tramite_version_id
            AND t.version_id = $2 AND t.tramite_version_id = $3
          RETURNING r.*`,
        [requisitoId, versionId, tramiteId, datos.orden ?? null, datos.texto ?? null],
      );
      if (!rows[0]) throw new NotFoundError({ detail: 'El requisito no existe en ese trámite.' });
      return rows[0];
    });
    res.json({ requisito: actualizado });
  });

  router.delete('/tupa/versiones/:id/tramites/:tramiteId/requisitos/:requisitoId', async (req, res) => {
    const versionId = validarUuid(req.params.id, 'de versión');
    const tramiteId = validarUuid(req.params.tramiteId, 'de trámite');
    const requisitoId = validarUuid(req.params.requisitoId, 'de requisito');
    await transaccion(pool, async (client) => {
      await exigirBorrador(client, versionId);
      const { rowCount } = await client.query(
        `DELETE FROM sigd_tupa.tramite_requisito r
          USING sigd_tupa.tramite_version t
          WHERE r.requisito_id = $1 AND r.tramite_version_id = t.tramite_version_id
            AND t.version_id = $2 AND t.tramite_version_id = $3`,
        [requisitoId, versionId, tramiteId],
      );
      if (!rowCount) throw new NotFoundError({ detail: 'El requisito no existe en ese trámite.' });
    });
    res.status(204).end();
  });

  router.put(
    '/tupa/versiones/:id/resolucion',
    express.raw({ type: 'application/pdf', limit: '10mb' }),
    async (req, res) => {
      const versionId = validarUuid(req.params.id, 'de versión');
      const actor = obtenerIdUsuario(req);
      const nombre = req.get('x-nombre-archivo')?.trim();
      if (!nombre || nombre.length > 255) {
        throw new AppError({
          status: 400,
          code: 'INVALID_FILENAME',
          message: 'La cabecera X-Nombre-Archivo es obligatoria y no debe superar 255 caracteres.',
        });
      }
      if (!Buffer.isBuffer(req.body) || !validarMagicBytes(req.body, 'PDF')) {
        throw new AppError({ status: 422, code: 'INVALID_PDF', message: 'El archivo enviado no tiene firma PDF válida.' });
      }
      await buscarVersion(pool, versionId);
      const referencia = await almacen.guardar(versionId, req.body);
      const sha256 = crypto.createHash('sha256').update(req.body).digest('hex');
      try {
        const actualizada = await transaccion(pool, async (client) => {
          await exigirBorrador(client, versionId);
          await client.query(`SELECT set_config('sigd_tupa.usuario_id', $1, true)`, [actor.id]);
          const { rows } = await client.query(
            `UPDATE sigd_tupa.version
                SET resolucion_pdf_ref = $2, resolucion_pdf_sha256 = $3
              WHERE version_id = $1
              RETURNING version_id, codigo, resolucion_pdf_sha256`,
            [versionId, referencia, sha256],
          );
          return rows[0];
        });
        res.json({ version: actualizada, nombreArchivo: nombre, sha256 });
      } catch (error) {
        await almacen.eliminar(referencia).catch((storageError: unknown) => {
          console.error('[TUPA] No se pudo limpiar un PDF cuyo registro falló:', storageError);
        });
        throw error;
      }
    },
  );

  router.post('/tupa/versiones/:id/publicar', async (req, res) => {
    const versionId = validarUuid(req.params.id, 'de versión');
    const actor = obtenerIdUsuario(req);
    const datos = parsearCuerpo(publicarSchema, req.body);
    const publicada = await transaccion(pool, async (client) => {
      const borrador = await exigirBorrador(client, versionId);
      exigirPdfParaPublicar(borrador.resolucion_pdf_ref);
      await client.query(`SELECT set_config('sigd_tupa.usuario_id', $1, true)`, [actor.id]);
      const vigente = await client.query(
        `SELECT version_id FROM sigd_tupa.version WHERE estado = 'VIGENTE' FOR UPDATE`,
      );
      if (vigente.rows[0]) {
        await client.query(
          `UPDATE sigd_tupa.version SET estado = 'SUPERSEDIDA' WHERE version_id = $1`,
          [vigente.rows[0].version_id],
        );
      }
      const resultado = await client.query(
        `UPDATE sigd_tupa.version
            SET resolucion_numero = $2, resolucion_fecha = $3, fecha_vigencia = $4, estado = 'VIGENTE'
          WHERE version_id = $1
          RETURNING version_id, codigo, nombre, estado, fecha_vigencia, resolucion_numero,
                    resolucion_fecha, resolucion_pdf_sha256`,
        [versionId, datos.resolucion_numero, datos.resolucion_fecha, datos.fecha_vigencia],
      );
      return resultado.rows[0];
    });
    res.json({ version: publicada });
  });

  router.get('/tupa/versiones/:id/bitacora', async (req, res) => {
    const versionId = validarUuid(req.params.id, 'de versión');
    await buscarVersion(pool, versionId);
    const { rows } = await pool.query(
      `SELECT bitacora_id, accion, estado_anterior, estado_nuevo, usuario_id, detalle, fecha_hora
         FROM sigd_tupa.bitacora
        WHERE version_id = $1
        ORDER BY fecha_hora DESC, bitacora_id DESC`,
      [versionId],
    );
    res.json({ bitacora: rows });
  });

  router.get('/tupa/versiones/:id/resolucion', async (req, res) => {
    const versionId = validarUuid(req.params.id, 'de versión');
    const version = await buscarVersion(pool, versionId);
    if (!version.resolucion_pdf_ref) {
      throw new NotFoundError({ detail: 'La versión no tiene un PDF de resolución cargado.' });
    }
    const contenido = await almacen.leer(version.resolucion_pdf_ref);
    res.type('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resolucion-${version.codigo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`);
    res.send(contenido);
  });

  return router;
}
