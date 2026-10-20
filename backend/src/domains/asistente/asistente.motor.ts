/**
 * ==============================================================================
 * Motor del Asistente Virtual (AsistenteCore)
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * ==============================================================================
 * Descripción:
 * Implementación determinista del asistente mediante coincidencia ponderada de
 * palabras clave sobre la base de conocimiento. La interfaz `AsistenteMotor`
 * permite enchufar un motor LLM (RAG) como respaldo sin cambiar el transporte.
 *
 * Principio de legalidad: nunca se inventa un trámite; si no hay coincidencia
 * suficiente se devuelve una respuesta de "no encontrado" con orientación.
 */

import type {
  AsistenteMotor,
  EntradaConocimiento,
  ResultadoAsistente,
} from './asistente.types.js';
import {
  ENTRADAS_CONOCIMIENTO,
  FUENTE_TUPA,
  PROCEDIMIENTOS_ASISTENTE,
  SUGERENCIAS_INICIALES,
  type ProcedimientoAsistente,
} from './asistente.conocimiento.js';

/** Umbral mínimo de puntaje para aceptar una intención. */
const UMBRAL_PUNTAJE = 1;
/** Peso base por palabra clave coincidente. */
const PESO_BASE = 1;
/** Peso extra para palabras clave largas (>= 6 caracteres). */
const PESO_LARGO = 1.5;
/** Peso para frases compuestas (más de una palabra). */
const PESO_FRASE = 1;
/** Peso para código de procedimiento (p. ej. `ACA-05`). */
const PESO_CODIGO = 4;

const PATRON_CODIGO = /^[a-z]{2,4}-\d{2,3}$/;

/** Normaliza un texto para comparación: minúsculas, sin tildes ni puntuación. */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizar(texto: string): Set<string> {
  return new Set(texto.split(' ').filter((t) => t.length > 0));
}

/** Normaliza preservando guiones, para comparar códigos como `ACA-05`. */
function normalizarCodigo(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Puntaje de una entrada de conocimiento para un mensaje dado. */
function puntuarEntrada(entrada: EntradaConocimiento, texto: string, tokens: Set<string>): number {
  let puntaje = 0;

  for (const palabra of entrada.palabrasClave) {
    const clave = normalizarTexto(palabra);
    if (clave.length === 0) continue;

    if (PATRON_CODIGO.test(clave)) {
      if (tokens.has(clave)) puntaje += PESO_CODIGO;
      continue;
    }

    if (texto.includes(clave)) {
      const peso = clave.length >= 6 ? PESO_LARGO : PESO_BASE;
      const esFrase = clave.includes(' ');
      puntaje += peso + (esFrase ? PESO_FRASE : 0);
    }
  }

  return puntaje;
}

/** Detecta un procedimiento del TUPA por código o sinónimo. */
export function detectarProcedimiento(mensaje: string): ProcedimientoAsistente | null {
  const texto = normalizarTexto(mensaje);
  const textoConCodigos = normalizarCodigo(mensaje);

  for (const procedimiento of PROCEDIMIENTOS_ASISTENTE) {
    const codigo = procedimiento.codigo.toLowerCase();
    const escaped = codigo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patron = new RegExp(`(^|\\s)${escaped}(\\s|$)`);
    if (patron.test(textoConCodigos)) return procedimiento;
  }

  let mejor: ProcedimientoAsistente | null = null;
  let mejorLongitud = 0;
  for (const procedimiento of PROCEDIMIENTOS_ASISTENTE) {
    for (const sinonimo of procedimiento.sinonimos) {
      const clave = normalizarTexto(sinonimo);
      if (clave.length > mejorLongitud && texto.includes(clave)) {
        mejor = procedimiento;
        mejorLongitud = clave.length;
      }
    }
  }

  return mejor;
}

function construirRespuestaProcedimiento(procedimiento: ProcedimientoAsistente): ResultadoAsistente {
  const requisitos = procedimiento.requisitos.map((r) => `- ${r}`).join('\n');
  return {
    respuesta:
      `Trámite: ${procedimiento.nombre} (${procedimiento.codigo}).\n` +
      `Requisitos:\n${requisitos}\n` +
      `Derecho de pago: ${procedimiento.derechoPago}.\n` +
      'Radícalo por la Mesa de Partes Virtual con el FUT y el comprobante de pago.',
    intencion: 'requisitos_tramite',
    confianza: 0.95,
    fuentes: [FUENTE_TUPA],
    sugerencias: ['¿Cómo radico un trámite?', '¿Cuánto tarda mi trámite?', '¿Cuál es el horario de atención?'],
    motor: '',
  };
}

const RESULTADO_NO_ENCONTRADO: Omit<ResultadoAsistente, 'motor'> = {
  respuesta:
    'No encontré información suficiente sobre tu consulta. Puedo orientarte sobre el TUPA, requisitos, tarifas, ' +
    'horarios y corte de las 16:30 hrs, plazos legales (30 días hábiles), radicación, seguimiento por CUT, ' +
    'casilla electrónica, firma digital y validación de documentos (CVD). Intenta escribir el nombre del trámite ' +
    '(por ejemplo "título" o "certificado de estudios") o su código (por ejemplo "ACA-05").',
  intencion: 'no_encontrado',
  confianza: 0,
  fuentes: [],
  sugerencias: [...SUGERENCIAS_INICIALES],
};

/**
 * Motor FAQ determinista. Implementa `AsistenteMotor` para poder sustituirse
 * por un motor LLM sin alterar la capa de transporte.
 */
export class MotorFAQ implements AsistenteMotor {
  readonly nombre = 'faq';

  async responder(mensaje: string): Promise<ResultadoAsistente> {
    const texto = normalizarTexto(mensaje);
    if (texto.length === 0) {
      return { ...RESULTADO_NO_ENCONTRADO, motor: this.nombre };
    }

    const tokens = tokenizar(texto);
    let mejorEntrada: EntradaConocimiento | null = null;
    let mejorPuntaje = 0;

    for (const entrada of ENTRADAS_CONOCIMIENTO) {
      const puntaje = puntuarEntrada(entrada, texto, tokens);
      if (puntaje > mejorPuntaje) {
        mejorPuntaje = puntaje;
        mejorEntrada = entrada;
      }
    }

    if (mejorEntrada && mejorPuntaje >= UMBRAL_PUNTAJE) {
      const procedimiento = detectarProcedimiento(mensaje);
      const esConsultaDeRequisitos = mejorEntrada.intencion === 'requisitos_tramite';
      const esConsultaDeTarifas = mejorEntrada.intencion === 'tarifas';
      const esConsultaDeTitulos = mejorEntrada.intencion === 'titulos_certificados';

      if (procedimiento && (esConsultaDeRequisitos || esConsultaDeTarifas || esConsultaDeTitulos)) {
        return { ...construirRespuestaProcedimiento(procedimiento), motor: this.nombre };
      }

      const confianza = Math.min(1, mejorPuntaje / 4);
      return {
        respuesta: mejorEntrada.respuesta,
        intencion: mejorEntrada.intencion,
        confianza,
        fuentes: [...mejorEntrada.fuentes],
        sugerencias: [...mejorEntrada.sugerencias],
        motor: this.nombre,
      };
    }

    return { ...RESULTADO_NO_ENCONTRADO, motor: this.nombre };
  }
}

/**
 * Motor compuesto híbrido. Atiende primero con el motor principal (FAQ) y, si
 * la confianza es insuficient y hay un motor secundario (LLM), escala a este.
 * Es el punto de extensión para habilitar el modo RAG sin reescribir el router.
 */
export class MotorCompuesto implements AsistenteMotor {
  readonly nombre = 'compuesto';

  constructor(
    private readonly principal: AsistenteMotor,
    private readonly secundario: AsistenteMotor | null = null,
    private readonly umbral = 0.6,
  ) {}

  async responder(mensaje: string): Promise<ResultadoAsistente> {
    const primario = await this.principal.responder(mensaje);

    if (primario.confianza >= this.umbral || !this.secundario) {
      return primario;
    }

    try {
      return await this.secundario.responder(mensaje);
    } catch {
      return primario;
    }
  }
}

/**
 * Fábrica del motor por defecto del asistente.
 * Para activar el modo LLM (RAG), implementa `AsistenteMotor` con el proveedor
 * elegido, indícalo en `AsistenteOpciones.motorSecundario` y configura la API key
 * en el entorno del backend (nunca en el frontend).
 */
export function crearMotorAsistente(
  opciones: { motorSecundario?: AsistenteMotor | null } = {},
): AsistenteMotor {
  const faq = new MotorFAQ();
  const secundario = opciones.motorSecundario ?? null;
  return secundario ? new MotorCompuesto(faq, secundario) : faq;
}
