export type CalificacionTupa = 'EVALUACION_PREVIA' | 'APROBACION_AUTOMATICA' | 'NO_APLICA';
export type SilencioTupa = 'POSITIVO' | 'NEGATIVO' | 'NO_APLICA';

export interface TramiteTupaParseado {
  codigo: string;
  denominacion: string;
  rubro: string;
  descripcion: string | null;
  derecho_monto: number | null;
  derecho_porcentaje_uit: number | null;
  derecho_texto: string | null;
  cuenta_pago: string | null;
  plazo_texto: string | null;
  plazo_dias_habiles: number | null;
  calificacion: CalificacionTupa;
  silencio_administrativo: SilencioTupa;
  unidad_recibe: string | null;
  autoridad_resuelve: string | null;
  recursos: string | null;
  base_legal: string | null;
  observaciones: string | null;
  requisitos: string[];
}

const MARCADOR_POR_DEFINIR = /\[POR DEFINIR\]/i;
const ENCABEZADO_FICHA = /^##\s+(TUPA-(?:PRO|ACA)-\d{3})\s+—\s+(.+)$/gm;

function textoUtil(texto: string | undefined): string | null {
  const limpio = texto?.trim();
  return !limpio || MARCADOR_POR_DEFINIR.test(limpio) ? null : limpio;
}

function extraerCampos(contenido: string): Map<string, string[]> {
  const campos = new Map<string, string[]>();
  let campoActual: string | null = null;

  for (const linea of contenido.split(/\r?\n/)) {
    const coincidencia = linea.match(/^\s*-\s+([^:]+):\s*(.*)$/);
    if (coincidencia) {
      campoActual = coincidencia[1].trim().toLocaleLowerCase('es');
      campos.set(campoActual, [coincidencia[2].trim()]);
      continue;
    }
    if (campoActual && /^\s+\d+\.\s+/.test(linea)) {
      campos.get(campoActual)?.push(linea.trim());
    }
  }

  return campos;
}

function campo(campos: Map<string, string[]>, nombre: string): string | undefined {
  return campos.get(nombre)?.[0];
}

function parseDerecho(texto: string | undefined): {
  monto: number | null;
  porcentaje: number | null;
  derechoTexto: string | null;
} {
  const original = textoUtil(texto);
  if (!original) return { monto: null, porcentaje: null, derechoTexto: null };

  const montos = [...original.matchAll(/S\/\s*([\d,]+(?:\.\d{1,2})?)/gi)];
  const porcentaje = original.match(/\(\s*([\d,]+(?:\.\d{1,2})?)\s*%\s*UIT\s*\)/i);
  const porcentajeNumero = porcentaje ? Number(porcentaje[1].replaceAll(',', '')) : null;

  if (montos.length !== 1 || /de acuerdo al mercado/i.test(original)) {
    return { monto: null, porcentaje: null, derechoTexto: original };
  }

  return {
    monto: Number(montos[0][1].replaceAll(',', '')),
    porcentaje: porcentajeNumero,
    derechoTexto: null,
  };
}

function parsePlazo(texto: string | undefined): { texto: string | null; dias: number | null } {
  const original = textoUtil(texto);
  const coincidencia = original?.match(/^(?:hasta\s+)?(\d+)\s+d[ií]as?\s+h[aá]biles?\b/i);
  return {
    texto: original,
    dias: coincidencia ? Number(coincidencia[1]) : null,
  };
}

function parseCalificacion(texto: string | undefined): CalificacionTupa {
  const valor = textoUtil(texto)?.toLocaleLowerCase('es') ?? '';
  if (valor.startsWith('no aplica')) return 'NO_APLICA';
  if (valor.startsWith('evaluación previa') || valor.startsWith('evaluacion previa')) {
    return 'EVALUACION_PREVIA';
  }
  if (valor.startsWith('aprobación automática') || valor.startsWith('aprobacion automatica')) {
    return 'APROBACION_AUTOMATICA';
  }
  throw new Error(`Calificación TUPA no reconocida: "${texto ?? '(vacía)'}".`);
}

function parseSilencio(texto: string | undefined): SilencioTupa {
  const valor = textoUtil(texto)?.toLocaleLowerCase('es') ?? '';
  if (valor.startsWith('positivo')) return 'POSITIVO';
  if (valor.startsWith('negativo')) return 'NEGATIVO';
  if (valor.startsWith('no aplica')) return 'NO_APLICA';
  throw new Error(`Silencio administrativo TUPA no reconocido: "${texto ?? '(vacío)'}".`);
}

function obtenerRequisitos(campos: Map<string, string[]>): string[] {
  const lineas = campos.get('requisitos') ?? [];
  if (lineas.some((linea) => /no figuran/i.test(linea))) return [];
  return lineas
    .map((linea) => linea.match(/^\d+\.\s+(.+)$/)?.[1]?.trim())
    .filter((linea): linea is string => typeof linea === 'string' && !MARCADOR_POR_DEFINIR.test(linea));
}

export function parsearTupaMarkdown(contenido: string): TramiteTupaParseado[] {
  const encabezados = [...contenido.matchAll(ENCABEZADO_FICHA)];
  const tramites: TramiteTupaParseado[] = [];

  for (let indice = 0; indice < encabezados.length; indice += 1) {
    const actual = encabezados[indice];
    const inicio = actual.index! + actual[0].length;
    const fin = encabezados[indice + 1]?.index ?? contenido.length;
    const bloque = contenido.slice(inicio, fin);
    const campos = extraerCampos(bloque);
    const rubro = textoUtil(campo(campos, 'rubro'));
    const plazo = parsePlazo(campo(campos, 'plazo de atención'));
    const derecho = parseDerecho(campo(campos, 'derecho de tramitación'));

    if (!rubro) throw new Error(`La ficha ${actual[1]} no tiene un rubro válido.`);

    const observaciones = bloque
      .split(/\r?\n/)
      .filter((linea) => /\[(?:REVISAR|VALIDAR)(?:\s*:|\])/i.test(linea))
      .map((linea) => linea.trim())
      .filter((linea, posicion, todas) => todas.indexOf(linea) === posicion)
      .join('\n');

    tramites.push({
      codigo: actual[1],
      denominacion: actual[2].trim(),
      rubro,
      descripcion: textoUtil(campo(campos, 'descripción') ?? campo(campos, 'descripcion')),
      derecho_monto: derecho.monto,
      derecho_porcentaje_uit: derecho.porcentaje,
      derecho_texto: derecho.derechoTexto,
      cuenta_pago: textoUtil(campo(campos, 'cuenta de pago')),
      plazo_texto: plazo.texto,
      plazo_dias_habiles: plazo.dias,
      calificacion: parseCalificacion(campo(campos, 'calificación') ?? campo(campos, 'calificacion')),
      silencio_administrativo: parseSilencio(campo(campos, 'silencio administrativo')),
      unidad_recibe: textoUtil(campo(campos, 'unidad que recibe')),
      autoridad_resuelve: textoUtil(campo(campos, 'autoridad que resuelve')),
      recursos: textoUtil(
        campo(campos, 'recursos (reconsideración / apelación)') ??
          campo(campos, 'recursos (reconsideracion / apelacion)') ??
          campo(campos, 'recursos'),
      ),
      base_legal: textoUtil(campo(campos, 'base legal')),
      observaciones: observaciones || null,
      requisitos: obtenerRequisitos(campos),
    });
  }

  return tramites;
}
