import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearPool } from '../src/database.js';

const CODIGO_VERSION = 'TUPA-2026-v1.0';
const FUENTE = 'TUPA 2026 del sistema';
const VALIDADO = 'no';
const directorioActual = path.dirname(fileURLToPath(import.meta.url));
const rutaSalida = path.resolve(directorioActual, '../../docs/ia/fuentes/tupa_2026_fichas.json');

interface RequisitoFila {
  orden: number;
  texto: string;
}

interface TramiteFila {
  codigo: string;
  denominacion: string;
  descripcion: string | null;
  rubro: string;
  derecho_monto: string | null;
  derecho_porcentaje_uit: string | null;
  derecho_texto: string | null;
  cuenta_pago: string | null;
  plazo_texto: string | null;
  plazo_dias_habiles: number | null;
  calificacion: string;
  silencio_administrativo: string;
  unidad_recibe: string | null;
  autoridad_resuelve: string | null;
  recursos: string | null;
  base_legal: string | null;
  observaciones: string | null;
  requisitos: RequisitoFila[];
}

interface FichaConocimiento {
  id: string;
  tema: string;
  preguntas_ejemplo: string[];
  palabras_clave: string[];
  respuesta: string;
  fuente: string;
  validado: string;
}

const PALABRAS_IGNORADAS = new Set([
  'a', 'al', 'ante', 'bajo', 'cabe', 'con', 'contra', 'cual', 'cuales', 'cuando',
  'de', 'del', 'desde', 'donde', 'durante', 'el', 'en', 'entre', 'es', 'esta',
  'estas', 'este', 'estos', 'favor', 'hacia', 'hasta', 'la', 'las', 'le', 'les',
  'lo', 'los', 'mas', 'mediante', 'me', 'mi', 'mis', 'no', 'nos', 'o', 'para',
  'pero', 'por', 'proceso', 'procesos', 'que', 'se', 'segun', 'ser', 'servicio',
  'servicios', 'si', 'sin', 'sobre', 'son', 'su', 'sus', 'te', 'tras', 'tu',
  'tus', 'un', 'una', 'unas', 'uno', 'unos', 'y',
]);

const CALIFICACIONES: Record<string, string> = {
  EVALUACION_PREVIA: 'Evaluación previa',
  APROBACION_AUTOMATICA: 'Aprobación automática',
  NO_APLICA: 'No aplica',
};

const SILENCIOS: Record<string, string> = {
  POSITIVO: 'Positivo',
  NEGATIVO: 'Negativo',
  NO_APLICA: 'No aplica',
};

function limpiarTexto(texto: string): string {
  return texto
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es');
}

function quitarAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function agregarVariantes(palabra: string, destino: Set<string>): void {
  if (!palabra) return;
  destino.add(palabra);

  if (palabra.length < 4) return;

  const terminaEnSConAcento = /[áéíóú]s$/.test(palabra);

  if (!terminaEnSConAcento) {
    if (palabra.endsWith('ciones')) {
      destino.add(`${palabra.slice(0, -6)}ción`);
    } else if (palabra.endsWith('siones')) {
      destino.add(`${palabra.slice(0, -6)}sión`);
    } else if (palabra.endsWith('ces')) {
      destino.add(`${palabra.slice(0, -3)}z`);
    } else if (palabra.endsWith('es')) {
      const raiz = palabra.slice(0, -2);
      destino.add(/[lndrzj]$/.test(raiz) || raiz.endsWith('s') ? raiz : palabra.slice(0, -1));
    } else if (palabra.endsWith('s')) {
      destino.add(palabra.slice(0, -1));
    }
  }

  if (terminaEnSConAcento) {
    destino.add(`${quitarAcentos(palabra)}es`);
  } else if (palabra.endsWith('ción')) {
    destino.add(`${palabra.slice(0, -4)}ciones`);
  } else if (palabra.endsWith('sión')) {
    destino.add(`${palabra.slice(0, -4)}siones`);
  } else if (palabra.endsWith('cion')) {
    destino.add(`${palabra.slice(0, -4)}ciones`);
  } else if (palabra.endsWith('sion')) {
    destino.add(`${palabra.slice(0, -4)}siones`);
  } else if (palabra.endsWith('z')) {
    destino.add(`${palabra.slice(0, -1)}ces`);
  } else if (/[aeiouáéíóúü]$/.test(palabra)) {
    destino.add(`${palabra}s`);
  } else if (!palabra.endsWith('s')) {
    destino.add(`${palabra}es`);
  }
}

function construirPalabrasClave(tramite: TramiteFila): string[] {
  const palabras = new Set<string>();
  const codigo = limpiarTexto(tramite.codigo);
  const denominacion = limpiarTexto(tramite.denominacion);
  const rubro = limpiarTexto(tramite.rubro);

  if (codigo) palabras.add(codigo);
  if (denominacion) palabras.add(denominacion);
  if (rubro) palabras.add(rubro);

  for (const texto of [tramite.denominacion, tramite.rubro, tramite.descripcion ?? '']) {
    for (const palabra of limpiarTexto(texto).split(' ')) {
      if (palabra.length < 3 || PALABRAS_IGNORADAS.has(palabra)) continue;
      agregarVariantes(palabra, palabras);
    }
  }

  return [...palabras].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
}

function construirPreguntas(tramite: TramiteFila): string[] {
  const tema = limpiarTexto(tramite.denominacion);
  const codigo = limpiarTexto(tramite.codigo);
  const preguntas = [
    `qué es ${tema}`,
    `cómo tramito ${tema}`,
    `cuánto cuesta ${tema}`,
    `cuáles son los requisitos de ${tema}`,
    `qué necesito para ${tema}`,
    `cuánto demora ${tema}`,
    `dónde presento ${tema}`,
    `código ${codigo}`,
  ];

  return [...new Set(preguntas.map(limpiarTexto).filter(Boolean))];
}

function formatearDerecho(tramite: TramiteFila): string | null {
  const partes: string[] = [];

  if (tramite.derecho_monto !== null) {
    const monto = Number(tramite.derecho_monto);
    if (Number.isFinite(monto)) partes.push(`S/ ${monto.toFixed(2)}`);
  }

  if (tramite.derecho_porcentaje_uit !== null) {
    const porcentaje = Number(tramite.derecho_porcentaje_uit);
    if (Number.isFinite(porcentaje)) partes.push(`${porcentaje} % UIT`);
  }

  if (tramite.derecho_texto) partes.push(tramite.derecho_texto);

  return partes.length ? partes.join(' · ') : null;
}

function formatearPlazo(tramite: TramiteFila): string | null {
  if (tramite.plazo_texto) return tramite.plazo_texto;
  if (tramite.plazo_dias_habiles !== null) return `${tramite.plazo_dias_habiles} días hábiles`;
  return null;
}

function agregarParte(partes: string[], etiqueta: string, valor: string | null): void {
  if (!valor) return;
  const limpio = valor.trim().replace(/[.\s]+$/, '');
  if (limpio) partes.push(`${etiqueta}: ${limpio}.`);
}

function construirRespuesta(tramite: TramiteFila): string {
  const partes: string[] = [];
  const derecho = formatearDerecho(tramite);
  const plazo = formatearPlazo(tramite);
  const requisitos = tramite.requisitos
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((requisito, indice) => `${indice + 1}. ${requisito.texto.trim().replace(/[.\s]+$/, '')}`);

  const titulo = `${tramite.denominacion} (${tramite.codigo})`.trim().replace(/[.\s]+$/, '');
  partes.push(`${titulo}.`);
  agregarParte(partes, 'Descripción', tramite.descripcion);
  agregarParte(partes, 'Rubro', tramite.rubro);
  agregarParte(partes, 'Derecho de tramitación', derecho ?? 'No registrado en el TUPA 2026');
  agregarParte(partes, 'Cuenta de pago', tramite.cuenta_pago);
  agregarParte(partes, 'Plazo', plazo ?? 'No registrado en el TUPA 2026');
  agregarParte(partes, 'Calificación', CALIFICACIONES[tramite.calificacion] ?? tramite.calificacion);
  agregarParte(
    partes,
    'Silencio administrativo',
    SILENCIOS[tramite.silencio_administrativo] ?? tramite.silencio_administrativo,
  );
  agregarParte(partes, 'Unidad que recibe', tramite.unidad_recibe);
  agregarParte(partes, 'Autoridad que resuelve', tramite.autoridad_resuelve);
  agregarParte(
    partes,
    'Requisitos',
    requisitos.length ? requisitos.join(' ') : 'No figuran requisitos en el TUPA 2026',
  );
  agregarParte(partes, 'Recursos', tramite.recursos);
  agregarParte(partes, 'Base legal', tramite.base_legal);
  agregarParte(partes, 'Observaciones', tramite.observaciones);

  return partes.join(' ');
}

function construirFicha(tramite: TramiteFila): FichaConocimiento {
  return {
    id: tramite.codigo,
    tema: tramite.denominacion,
    preguntas_ejemplo: construirPreguntas(tramite),
    palabras_clave: construirPalabrasClave(tramite),
    respuesta: construirRespuesta(tramite),
    fuente: FUENTE,
    validado: VALIDADO,
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL no está configurada; no se iniciará ninguna conexión.');

  const pool = crearPool(databaseUrl);

  try {
    const version = await pool.query<{ codigo: string; nombre: string }>(
      'SELECT codigo, nombre FROM sigd_tupa.version WHERE codigo = $1',
      [CODIGO_VERSION],
    );

    if (!version.rowCount) {
      throw new Error(`No existe la versión ${CODIGO_VERSION} en sigd_tupa.version.`);
    }

    const resultado = await pool.query<TramiteFila>(
      `SELECT t.codigo,
              t.denominacion,
              t.descripcion,
              t.rubro,
              t.derecho_monto,
              t.derecho_porcentaje_uit,
              t.derecho_texto,
              t.cuenta_pago,
              t.plazo_texto,
              t.plazo_dias_habiles,
              t.calificacion,
              t.silencio_administrativo,
              t.unidad_recibe,
              t.autoridad_resuelve,
              t.recursos,
              t.base_legal,
              t.observaciones,
              COALESCE(
                json_agg(json_build_object('orden', r.orden, 'texto', r.texto) ORDER BY r.orden)
                  FILTER (WHERE r.requisito_id IS NOT NULL),
                '[]'::json
              ) AS requisitos
         FROM sigd_tupa.tramite_version t
         JOIN sigd_tupa.version v ON v.version_id = t.version_id
         LEFT JOIN sigd_tupa.tramite_requisito r ON r.tramite_version_id = t.tramite_version_id
        WHERE v.codigo = $1
        GROUP BY t.tramite_version_id
        ORDER BY t.codigo`,
      [CODIGO_VERSION],
    );

    const fichas = resultado.rows.map(construirFicha);
    await fs.mkdir(path.dirname(rutaSalida), { recursive: true });
    await fs.writeFile(rutaSalida, `${JSON.stringify(fichas, null, 2)}\n`, 'utf8');

    console.log(`[TUPA-IA] ${fichas.length} fichas generadas desde ${version.rows[0].codigo}.`);
    console.log(`[TUPA-IA] Archivo: ${rutaSalida}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[TUPA-IA] Error al generar las fichas de conocimiento:', error);
  process.exitCode = 1;
});
