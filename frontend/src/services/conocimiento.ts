import { normalizarTexto } from "./normalizarTexto";

export interface ConocimientoFuente {
  documento: string;
  seccion?: string;
  fecha?: string;
}

export interface ConocimientoEntrada {
  id: string;
  tema: string;
  preguntas_ejemplo: string[];
  palabras_clave: string[];
  respuesta: string;
  fuente: ConocimientoFuente;
  validado: boolean;
}

export interface ConocimientoResultado {
  entrada: ConocimientoEntrada;
  puntaje: number;
}

export const UMBRAL_FUERTE = 0.5;

const PALABRAS_VACIAS = new Set([
  "a", "ante", "bajo", "cabe", "con", "contra", "de", "desde", "el", "en",
  "entre", "hacia", "hasta", "la", "las", "los", "mediante", "mi", "mis",
  "para", "por", "segun", "sin", "sobre", "so", "su", "sus", "tras", "un",
  "una", "unos", "unas", "y", "o", "u", "ni", "que", "como", "cual", "cuales",
  "quien", "quienes", "donde", "cuando", "porque", "al", "del", "lo", "esta",
  "estas", "este", "estos", "eso", "esa", "eses", "esas", "esto", "tu", "tus",
  "quiero", "quisiera", "necesito", "buscar", "busca", "saber", "cuanto",
  "cuesta", "costo", "precio", "informacion", "tramite", "tramites", "tupa",
  "favor", "por", "favor",
]);

function palabrasLimpas(texto: string): string[] {
  return normalizarTexto(texto)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((palabra) => palabra.length > 0);
}

function palabrasSignificativas(texto: string): string[] {
  return palabrasLimpas(texto).filter(
    (palabra) => !PALABRAS_VACIAS.has(palabra),
  );
}

export function buscarConocimiento(
  texto: string,
  base: ConocimientoEntrada[] = [],
): ConocimientoResultado[] {
  const consulta = palabrasSignificativas(texto);
  if (consulta.length === 0) return [];

  const resultados = base.map((entrada) => {
    const palabrasEntrada = new Set(
      palabrasLimpas([
        entrada.tema,
        ...entrada.palabras_clave,
        ...entrada.preguntas_ejemplo,
      ].join(" ")),
    );

    let coincidencias = 0;
    for (const palabra of consulta) {
      if (palabrasEntrada.has(palabra)) coincidencias++;
    }

    const puntaje = coincidencias / consulta.length;
    return { entrada, puntaje };
  });

  return resultados
    .filter((r) => r.puntaje >= UMBRAL_FUERTE)
    .sort((a, b) => b.puntaje - a.puntaje);
}

export function validarBase(base: ConocimientoEntrada[]): string[] {
  const errores: string[] = [];
  const ids = new Set<string>();

  for (const entrada of base) {
    const ref = entrada.id || "(sin id)";

    if (!entrada.id) {
      errores.push("Falta id obligatorio en una entrada");
    } else if (ids.has(entrada.id)) {
      errores.push(`Id duplicado: ${entrada.id}`);
    }
    ids.add(entrada.id);

    if (!entrada.tema) {
      errores.push(`Entrada ${ref}: falta tema`);
    }
    if (!entrada.respuesta) {
      errores.push(`Entrada ${ref}: falta respuesta`);
    }
    if (!entrada.fuente || !entrada.fuente.documento) {
      errores.push(`Entrada ${ref}: falta fuente.documento`);
    }
  }

  return errores;
}