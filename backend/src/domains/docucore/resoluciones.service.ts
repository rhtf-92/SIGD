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
  estado: 'BORRADOR';
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

interface FilaProyecto {
  id_proyecto: string;
  numero_resolucion: string;
  tipo_resolucion: TipoResolucion;
  id_expediente: string;
  estado: string;
  visto: string;
  considerandos: unknown;
  articulos: unknown;
  distribucion: unknown;
  html_renderizado: string;
  fecha_creacion: string;
}

// --- Persistencia (patrón repositorio, mismo estilo que crearCargadorDesdePool)

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
     * Asigna el siguiente número correlativo del año fiscal de forma atómica.
     * El UPDATE sobre la fila del año adquiere su lock de fila, de modo que dos
     * proyecciones concurrentes jamás reciben el mismo número. (Configuración
     * READ COMMITTED; patrón equivalente a sigd_tra.generar_cut_expediente.)
     */
    async asignarNumeroAnual(anio: number): Promise<string> {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await cliente.query(
          `INSERT INTO sigd_doc.secuencia_anual_resolucion (anio_fiscal, secuencia)
           VALUES ($1, 0)
           ON CONFLICT (anio_fiscal) DO NOTHING`,
          [anio],
        );
        const actualizado = await cliente.query<{ numero: string }>(
          `UPDATE sigd_doc.secuencia_anual_resolucion
              SET secuencia = secuencia + 1,
                  ultimo_numero_generado = 'RD-' || anio_fiscal || '-' || lpad((secuencia + 1)::text, 6, '0')
            WHERE anio_fiscal = $1
          RETURNING ultimo_numero_generado AS numero`,
          [anio],
        );
        if (!actualizado.rows[0]) {
          throw new Error(`No se pudo inicializar la secuencia de resolución del año ${anio}.`);
        }
        await cliente.query('COMMIT');
        return actualizado.rows[0].numero;
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
        const insertado = await cliente.query<FilaProyecto>(
          `INSERT INTO sigd_doc.proyecto_resolucion
             (numero_resolucion, tipo_resolucion, id_expediente, estado,
              visto, considerandos, articulos, distribucion, html_renderizado,
              id_usuario_creador)
           VALUES ($1, $2, $3, 'BORRADOR', $4, $5, $6, $7, $8, $9)
           RETURNING id_proyecto, numero_resolucion, tipo_resolucion, id_expediente,
                     estado, visto, considerandos, articulos, distribucion,
                     html_renderizado, fecha_creacion`,
          [
            proyecto.numero,
            proyecto.tipoResolucion,
            proyecto.expedienteId,
            proyecto.visto,
            JSON.stringify(proyecto.considerandos),
            JSON.stringify(proyecto.articulos),
            JSON.stringify(proyecto.distribucion),
            proyecto.html,
            proyecto.usuarioId ?? null,
          ],
        );
        return mapearFilaProyecto(insertado.rows[0]);
      } finally {
        cliente.release();
      }
    },

    async obtenerPorId(id: string): Promise<ProyectoResolucion | null> {
      const resultado = await pool.query<FilaProyecto>(
        `SELECT id_proyecto, numero_resolucion, tipo_resolucion, id_expediente,
                estado, visto, considerandos, articulos, distribucion,
                html_renderizado, fecha_creacion
           FROM sigd_doc.proyecto_resolucion
          WHERE id_proyecto = $1`,
        [id],
      );
      const fila = resultado.rows[0];
      return fila ? mapearFilaProyecto(fila) : null;
    },
  };
}

function mapearFilaProyecto(fila: FilaProyecto): ProyectoResolucion {
  return {
    id: fila.id_proyecto,
    numero: fila.numero_resolucion,
    tipoResolucion: fila.tipo_resolucion,
    expedienteId: fila.id_expediente,
    estado: 'BORRADOR',
    visto: fila.visto,
    considerandos: Array.isArray(fila.considerandos)
      ? fila.considerandos.map(String)
      : [],
    articulos: Array.isArray(fila.articulos)
      ? (fila.articulos as ArticuloResolutivo[])
      : [],
    distribucion: Array.isArray(fila.distribucion) ? fila.distribucion.map(String) : [],
    html: fila.html_renderizado,
    creadoEn: fila.fecha_creacion,
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