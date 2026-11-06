import type { Pool } from 'pg';
import { NotFoundError } from '../../shared/domain/errors/index.js';

// =============================================================================
// DocuCore · Servicio de proyección de Resoluciones Directorales (A4)
// Autor: Christian Jhoel Rodríguez Cari (B_CHRISTIAN) · Sprint 4 · T-BE-DC-03
// Estados: #32 (POST /api/v1/resoluciones/proyectar) y
//          #33 (GET /api/v1/resoluciones/proyectos/:id)
// =============================================================================
// Ensambla el membrete institucional del IESTP "Suiza", asigna el número
// correlativo anual de resolución de forma atómica (seguro ante concurrencia,
// patrón secuencia_anual_* + FOR UPDATE heredado de TramiCore) y compone las
// secciones normativas: Vistos, Considerando, Artículos Resolutivos y
// Distribución, en tipografía normalizada para hoja A4.
// =============================================================================

export const TIPOS_RESOLUCION = [
  'DIRECTORAL_TITULACION',
  'DIRECTORAL_CONVALIDACION',
  'DIRECTORAL_ADMINISTRATIVA',
] as const;

export type TipoResolucion = (typeof TIPOS_RESOLUCION)[number];

export interface ArticuloResolutivo {
  numero: number;
  texto: string;
}

export interface DatosProyectarResolucion {
  expedienteId: string;
  tipoResolucion: TipoResolucion;
  visto: string;
  considerandos: string[];
  articulos: ArticuloResolutivo[];
  distribucion?: string[];
  usuarioId?: string | null;
}

export interface ProyectoResolucion {
  id: string;
  numero: string;
  tipoResolucion: TipoResolucion;
  expedienteId: string;
  estado: string;
  visto: string;
  considerandos: string[];
  articulos: ArticuloResolutivo[];
  distribucion: string[];
  html: string;
  creadoEn: string;
}

export type ProyectoResolucionAGuardar = Omit<ProyectoResolucion, 'creadoEn'> & {
  usuarioId?: string | null;
};

interface FilaResolucion {
  resolucion_id: string;
  expediente_id: string;
  numero_borrador: string;
  numero_resolucion: string | null;
  tipo_resolucion: TipoResolucion;
  asunto: string;
  estado: string;
  fecha_proyeccion: string | Date;
  proyectado_por: string | null;
  creado_en: string | Date;
}

// --- Persistencia (patrón repositorio, alineado con sigd_doc.resolucion)

export interface RepositorioProyectoResolucion {
  asignarNumeroAnual(anio: number): Promise<string>;
  guardar(proyecto: ProyectoResolucionAGuardar): Promise<ProyectoResolucion>;
  obtenerPorId(id: string): Promise<ProyectoResolucion | null>;
}

const ANSI_NOMBRE_INSTITUCION =
  'INSTITUTO DE EDUCACI\u00d3N SUPERIOR TECNOL\u00d3GICO P\u00daBLICO "SUIZA"';

function formatearNumeroResolucion(anio: number, secuencia: number): string {
  return `RD-${anio}-${String(secuencia).padStart(6, '0')}`;
}

export function crearRepositorioResoluciones(pool: Pool): RepositorioProyectoResolucion {
  return {
    /**
     * Asigna el siguiente número correlativo anual de resolución de forma atómica
     * usando lock consultivo transaccional en PostgreSQL sobre el año fiscal.
     */
    async asignarNumeroAnual(anio: number): Promise<string> {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await cliente.query(`SELECT pg_advisory_xact_lock(hashtext('resolucion_' || $1::text))`, [anio]);
        const res = await cliente.query<{ siguiente: number }>(
          `SELECT COALESCE(
             MAX(
               CAST(SUBSTRING(numero_borrador FROM '[0-9]+$') AS INTEGER)
             ),
             0
           ) + 1 AS siguiente
           FROM sigd_doc.resolucion
           WHERE EXTRACT(YEAR FROM fecha_proyeccion) = $1`,
          [anio],
        );
        const siguiente = res.rows[0]?.siguiente ?? 1;
        await cliente.query('COMMIT');
        return formatearNumeroResolucion(anio, siguiente);
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
      } finally {
        cliente.release();
      }
    },

    async guardar(proyecto: ProyectoResolucionAGuardar): Promise<ProyectoResolucion> {
      const cliente = await pool.connect();
      try {
        const usuarioValido =
          proyecto.usuarioId && /^[0-9a-fA-F-]{36}$/.test(proyecto.usuarioId)
            ? proyecto.usuarioId
            : null;
        const asunto = (proyecto.visto || 'Proyecto de resolución directoral').slice(0, 500);

        const insertado = await cliente.query<FilaResolucion>(
          `INSERT INTO sigd_doc.resolucion
             (expediente_id, numero_borrador, numero_resolucion, tipo_resolucion,
              asunto, estado, fecha_proyeccion, proyectado_por)
           VALUES ($1, $2, $3, $4, $5, 'BORRADOR_PENDIENTE_FIRMA', CURRENT_DATE, $6)
           RETURNING resolucion_id, expediente_id, numero_borrador, numero_resolucion,
                     tipo_resolucion, asunto, estado, fecha_proyeccion, proyectado_por,
                     creado_en`,
          [
            proyecto.expedienteId,
            proyecto.numero,
            proyecto.numero,
            proyecto.tipoResolucion,
            asunto,
            usuarioValido,
          ],
        );
        const fila = insertado.rows[0];
        return {
          id: fila.resolucion_id,
          numero: fila.numero_borrador,
          tipoResolucion: fila.tipo_resolucion,
          expedienteId: fila.expediente_id,
          estado: fila.estado,
          visto: proyecto.visto,
          considerandos: proyecto.considerandos,
          articulos: proyecto.articulos,
          distribucion: proyecto.distribucion,
          html: proyecto.html,
          creadoEn: fila.creado_en instanceof Date ? fila.creado_en.toISOString() : String(fila.creado_en),
        };
      } finally {
        cliente.release();
      }
    },

    async obtenerPorId(id: string): Promise<ProyectoResolucion | null> {
      const resultado = await pool.query<FilaResolucion>(
        `SELECT resolucion_id, expediente_id, numero_borrador, numero_resolucion,
                tipo_resolucion, asunto, estado, fecha_proyeccion, proyectado_por,
                creado_en
           FROM sigd_doc.resolucion
          WHERE resolucion_id = $1`,
        [id],
      );
      const fila = resultado.rows[0];
      if (!fila) return null;
      const html = renderizarResolucionHTML({
        numero: fila.numero_borrador,
        tipoResolucion: fila.tipo_resolucion,
        visto: fila.asunto,
        considerandos: [fila.asunto],
        articulos: [{ numero: 1, texto: fila.asunto }],
        distribucion: ['Dirección General'],
      });
      return {
        id: fila.resolucion_id,
        numero: fila.numero_borrador,
        tipoResolucion: fila.tipo_resolucion,
        expedienteId: fila.expediente_id,
        estado: fila.estado,
        visto: fila.asunto,
        considerandos: [fila.asunto],
        articulos: [{ numero: 1, texto: fila.asunto }],
        distribucion: ['Dirección General'],
        html,
        creadoEn: fila.creado_en instanceof Date ? fila.creado_en.toISOString() : String(fila.creado_en),
      };
    },
  };
}

// --- Renderizado tipográfico A4 -------------------------------------------------

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ETIQUETA_TIPO_RESOLUCION: Record<TipoResolucion, string> = {
  DIRECTORAL_TITULACION: 'RESOLUCION DIRECTORAL DE TITULACION',
  DIRECTORAL_CONVALIDACION: 'RESOLUCION DIRECTORAL DE CONVALIDACION',
  DIRECTORAL_ADMINISTRATIVA: 'RESOLUCION DIRECTORAL ADMINISTRATIVA',
};

function fechaEnMayusculas(fecha: Date): string {
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  return `${fecha.getDate()} DE ${meses[fecha.getMonth()]} DE ${fecha.getFullYear()}`;
}

export function renderizarResolucionHTML(proyecto: {
  numero: string;
  tipoResolucion: TipoResolucion;
  visto: string;
  considerandos: string[];
  articulos: ArticuloResolutivo[];
  distribucion: string[];
}): string {
  const fecha = fechaEnMayusculas(new Date());
  const considerandos = proyecto.considerandos
    .map((texto) => `<p class="texto jd">${escaparHtml(texto)}</p>`)
    .join('\n      ');
  const articulos = proyecto.articulos
    .map(
      (articulo) =>
        `<div class="articulo">\n        <p class="articulo-num">${articulo.numero}.&nbsp;</p>\n        <p class="texto jd">${escaparHtml(articulo.texto)}</p>\n      </div>`,
    )
    .join('\n      ');
  const distribucion = proyecto.distribucion
    .map((d) => `<li>${escaparHtml(d)}</li>`)
    .join('\n          ');

  const distribucionHtml =
    proyecto.distribucion.length > 0
      ? `<h3 class="seccion">DISTRIBUCION</h3>
      <ul class="distribucion">
          ${distribucion}
        </ul>
      `
      : '';

  return `<!DOCTYPE html>
<html lang="es-PE">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escaparHtml(proyecto.numero)}</title>
    <style>
      :root { color-scheme: light; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 794px;
        min-height: 1122px;
        margin: 0 auto;
        padding: 56px 60px;
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        line-height: 1.6;
        color: #000;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .membrete { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; }
      .membrete .institucion {
        font-size: 13pt;
        font-weight: normal;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .membrete .anio { font-size: 11pt; margin-top: 2px; }
      .folio {
        position: absolute;
        top: 40px;
        right: 56px;
        font-size: 10pt;
      }
      .nomenclatura { text-align: center; margin-top: 26px; }
      .nomenclatura .tipo {
        font-size: 12pt;
        font-weight: bold;
        letter-spacing: 0.5px;
      }
      .nomenclatura .numero { font-size: 13pt; font-weight: bold; margin-top: 4px; }
      .ciudad-fecha { text-align: right; margin: 24px 0 18px; font-size: 12pt; }
      h2.seccion {
        font-size: 12pt;
        text-align: center;
        margin: 16px 0 8px;
      }
      h3.seccion { font-size: 12pt; text-align: left; margin: 16px 0 8px; }
      p.texto { text-align: justify; text-indent: 2.5em; margin-bottom: 8px; }
      .articulo { display: flex; align-items: flex-start; margin-bottom: 8px; }
      .articulo-num { flex: 0 0 auto; padding-right: 4px; }
      ul.distribucion { margin: 6px 0 0 2.5em; list-style: none; }
      ul.distribucion li::before { content: "→ "; }
      .firma {
        margin-top: 46px;
        text-align: center;
      }
      .firma .cargo { font-size: 11pt; }
      @media print {
        body { width: 210mm; min-height: 297mm; padding: 20mm 22mm 18mm; }
        @page { size: A4 portrait; margin: 0; }
      }
    </style>
  </head>
  <body>
    <header class="membrete">
      <p class="institucion">${ANSI_NOMBRE_INSTITUCION}</p>
      <p class="anio">GESTION ${new Date().getFullYear()}</p>
    </header>

    <section class="nomenclatura">
      <p class="tipo">${ETIQUETA_TIPO_RESOLUCION[proyecto.tipoResolucion]}</p>
      <p class="numero">N° ${escaparHtml(proyecto.numero)}</p>
    </section>

    <p class="ciudad-fecha">Arequipa, ${fecha}</p>

    <h2 class="seccion">VISTO:</h2>
    <p class="texto jd">${escaparHtml(proyecto.visto)}</p>

    <h2 class="seccion">CONSIDERANDO:</h2>
    ${considerandos}

    <h2 class="seccion" style="text-align:left;">SE RESUELVE:</h2>
    ${articulos}

    ${distribucionHtml}

    <footer class="firma">
      <p class="texto" style="text-indent:0;text-align:center;margin-top:16px;">REGISTRESE, COMUNIQUESE Y ARCHIVESE.</p>
    </footer>
  </body>
</html>`;
}

// --- Servicio ---------------------------------------------------------------------

export interface ServicioResoluciones {
  proyectar(datos: DatosProyectarResolucion): Promise<ProyectoResolucion>;
  obtenerProyectoPorId(id: string): Promise<ProyectoResolucion>;
}

export function crearServicioResoluciones(
  pool: Pool,
  repositorio: RepositorioProyectoResolucion = crearRepositorioResoluciones(pool),
): ServicioResoluciones {
  return {
    async proyectar(datos: DatosProyectarResolucion): Promise<ProyectoResolucion> {
      const anio = new Date().getFullYear();
      const numero = await repositorio.asignarNumeroAnual(anio);
      const html = renderizarResolucionHTML({
        numero,
        tipoResolucion: datos.tipoResolucion,
        visto: datos.visto,
        considerandos: datos.considerandos,
        articulos: datos.articulos,
        distribucion: datos.distribucion ?? [],
      });
      const guardado = await repositorio.guardar({
        id: '',
        numero,
        tipoResolucion: datos.tipoResolucion,
        expedienteId: datos.expedienteId,
        estado: 'BORRADOR',
        visto: datos.visto,
        considerandos: datos.considerandos,
        articulos: datos.articulos,
        distribucion: datos.distribucion ?? [],
        html,
        usuarioId: datos.usuarioId,
      });
      return guardado;
    },

    async obtenerProyectoPorId(id: string): Promise<ProyectoResolucion> {
      const proyecto = await repositorio.obtenerPorId(id);
      if (!proyecto) {
        throw new NotFoundError({ message: 'Proyecto de resolución no encontrado.' });
      }
      return proyecto;
    },
  };
}