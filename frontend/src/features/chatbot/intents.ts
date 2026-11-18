/**
 * Motor determinista de Intents para el Asistente SIGD (IESTP "Suiza" - 2026).
 * Clasifica consultas y comandos en 15 intenciones institucionales canónicas.
 * No utiliza LLM ni APIs externas. Arquitectura 100% determinista y trazable.
 */

import { normalizarTexto } from './normalizer';

export type IntentType =
  | 'SALUDO'
  | 'OBSERVACION'
  | 'SUBSANACION'
  | 'VALIDAR_CVD'
  | 'CONSULTAR_CUT'
  | 'PRESENTAR_TRAMITE'
  | 'BUSCAR_TUPA'
  | 'REQUISITOS'
  | 'COSTO'
  | 'PLAZO'
  | 'ESTADO_TRAMITE'
  | 'ACCESO_LOGIN'
  | 'AYUDA'
  | 'DESPEDIDA'
  | 'FUERA_DE_ALCANCE';

export interface IntentResult {
  intent: IntentType;
  respuesta: string;
  nodoSugerido?: string;
  rutaSugerida?: string;
  esFueraDeAlcance: boolean;
}

const RESPUESTA_FUERA_DE_ALCANCE =
  'Puedo ayudarte únicamente con trámites, servicios y uso del Sistema de Gestión Documentaria del IESTP "Suiza".';

const RESPUESTA_NO_CONFIRMADA =
  'No tengo información confirmada sobre ese punto. Puedes revisar el Catálogo TUPA o consultar con la institución.';

/**
 * Diccionario de patrones léxicos para cada intent institucional.
 * Ordenados por especificidad (los más específicos primero).
 */
interface ReglaIntent {
  intent: IntentType;
  palabrasClave: string[];
  respuesta: string;
  nodoSugerido?: string;
  rutaSugerida?: string;
}

const REGLAS_INTENTS: ReglaIntent[] = [
  {
    intent: 'SALUDO',
    palabrasClave: ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos', 'que tal', 'buen dia'],
    respuesta:
      'Hola. Puedo orientarte sobre trámites y el uso del Sistema de Gestión Documentaria (SIGD) del IESTP "Suiza". ¿Qué necesitas consultar?',
    nodoSugerido: 'ROOT',
  },
  {
    intent: 'OBSERVACION',
    palabrasClave: ['observado', 'observacion', 'expediente observado', 'tramite observado', 'por que me observaron', 'que es una observacion'],
    respuesta:
      'Si un expediente es observado por Mesa de Partes o por el Especialista, significa que falta un requisito o documento aclaratorio. Se te notificará el plazo para subsanar.',
    nodoSugerido: 'ESTADOS_TRAMITE',
  },
  {
    intent: 'SUBSANACION',
    palabrasClave: ['subsanar', 'subsanacion', 'levantar observacion', 'corregir documento', 'como subsano'],
    respuesta:
      'Para subsanar un trámite observado, debes presentar los documentos requeridos a través de la Mesa de Partes haciendo referencia al número de expediente o CUT correspondiente.',
    nodoSugerido: 'REALIZAR_TRAMITE',
    rutaSugerida: '/mesa-partes',
  },
  {
    intent: 'VALIDAR_CVD',
    palabrasClave: ['cvd', 'validar documento', 'verificar documento', 'codigo de verificacion', 'autenticidad', 'integridad digital', 'qr documento', 'validar cvd'],
    respuesta:
      'Puedes verificar la autenticidad e integridad de cualquier resolución o documento oficial emitido por el IESTP "Suiza" ingresando su Código de Verificación Digital (CVD).',
    rutaSugerida: '/validador-cvd',
  },
  {
    intent: 'CONSULTAR_CUT',
    palabrasClave: ['cut', 'consultar cut', 'codigo cut', 'mi cut', 'buscar expediente', 'seguimiento tramite', 'consultar tramite', 'donde esta mi tramite'],
    respuesta:
      'Para consultar el avance de tu trámite, ingresa a Consulta CUT con el código de expediente (ejemplo: EXP-2026-000001) y tu número de documento de identidad oficial.',
    nodoSugerido: 'CONSULTAR_TRAMITE',
    rutaSugerida: '/consulta',
  },
  {
    intent: 'PRESENTAR_TRAMITE',
    palabrasClave: ['presentar tramite', 'iniciar tramite', 'radicar', 'mesa de partes', 'nuevo tramite', 'ingresar documento', 'solicitar tramite', 'como tramito', 'radicacion'],
    respuesta:
      'Puedes radicar tu trámite de manera digital las 24 horas a través de la Mesa de Partes Digital. Necesitas tener tus documentos en formato PDF y tu documento de identidad.',
    nodoSugerido: 'REALIZAR_TRAMITE',
    rutaSugerida: '/mesa-partes',
  },
  {
    intent: 'ESTADO_TRAMITE',
    palabrasClave: ['estado de mi tramite', 'que significa el estado', 'estados de tramite', 'en tramite', 'derivado', 'registrado', 'atendido', 'archivado'],
    respuesta:
      'Un expediente avanza por etapas formales: REGISTRADO (ingreso oficial), DERIVADO (enviado al área), EN EVALUACIÓN (revisión técnica), ATENDIDO (resuelto) y ARCHIVADO.',
    nodoSugerido: 'ESTADOS_TRAMITE',
    rutaSugerida: '/consulta',
  },
  {
    intent: 'REQUISITOS',
    palabrasClave: ['requisito', 'requisitos', 'que requisitos', 'que piden', 'documentos que piden', 'anexos requeridos'],
    respuesta:
      'Cada procedimiento administrativo cuenta con requisitos documentarios aprobados en el Catálogo TUPA. Puedes buscar el trámite específico para ver la lista completa de requisitos.',
    nodoSugerido: 'BUSCAR_TUPA',
    rutaSugerida: '/tupa',
  },
  {
    intent: 'COSTO',
    palabrasClave: ['costo', 'precio', 'arancel', 'cuanto cuesta', 'pago', 'tasa', 'monto', 'derecho de tramite', 'cuanto se paga'],
    respuesta:
      'Los costos y aranceles están regulados según el procedimiento en el Catálogo TUPA institucional. Los pagos confirmados por Tesorería se acreditan automáticamente.',
    nodoSugerido: 'BUSCAR_TUPA',
    rutaSugerida: '/tupa',
  },
  {
    intent: 'PLAZO',
    palabrasClave: ['plazo', 'cuanto demora', 'tiempo de atencion', 'dias habiles', 'cuantos dias', 'cuando me responden', 'duracion'],
    respuesta:
      'Los plazos de atención se computan en días hábiles institucionales (lunes a viernes, excluyendo sábados, domingos y feriados oficiales de Ucayali).',
    nodoSugerido: 'BUSCAR_TUPA',
  },
  {
    intent: 'BUSCAR_TUPA',
    palabrasClave: ['catalogo tupa', 'buscar tupa', 'procedimientos tupa', 'tramites tupa', 'tupa', 'tupa 2026', 'catalogo de servicios'],
    respuesta:
      'El Catálogo Integral TUPA 2026 del IESTP "Suiza" contiene la lista oficial de procedimientos administrativos, servicios académicos y tasas aprobadas.',
    nodoSugerido: 'BUSCAR_TUPA',
    rutaSugerida: '/tupa',
  },
  {
    intent: 'ACCESO_LOGIN',
    palabrasClave: ['iniciar sesion', 'login', 'ingresar', 'entrar al sistema', 'olvide mi clave', 'recuperar contraseña', 'problemas para entrar', 'mi clave', 'contraseña'],
    respuesta:
      'Puedes ingresar con tu documento y contraseña. Si eres usuario externo y no tienes cuenta, puedes registrarte en el portal público.',
    nodoSugerido: 'INICIAR_SESION',
    rutaSugerida: '/login',
  },
  {
    intent: 'AYUDA',
    palabrasClave: ['ayuda', 'orientacion', 'como funciona el sigd', 'que es el sigd', 'para que sirve', 'guia de tramites', 'soporte'],
    respuesta:
      'El SIGD es el Sistema Integral de Gestión Documentaria del IESTP "Suiza". Te permite presentar trámites digitales, consultar tu CUT, revisar el TUPA y validar documentos.',
    nodoSugerido: 'ROOT',
  },
  {
    intent: 'DESPEDIDA',
    palabrasClave: ['gracias', 'muchas gracias', 'adios', 'hasta luego', 'chau', 'nos vemos', 'excelente gracias'],
    respuesta:
      'Gracias por consultar con el Asistente SIGD del IESTP "Suiza". Que tengas un buen día.',
    nodoSugerido: 'ROOT',
  },
];

/**
 * Palabras clave que indican inequívocamente temas fuera de alcance del SIGD.
 */
const TEMAS_FUERA_DE_ALCANCE = [
  'politica', 'elecciones', 'presidente', 'congreso', 'partido',
  'noticias', 'futbol', 'deporte', 'clima',
  'salud', 'medicina', 'dolor', 'enfermedad', 'medico', 'sintomas',
  'programacion', 'javascript', 'python', 'react', 'software',
  'tarea', 'matematicas', 'algebra', 'historia del peru',
  'amor', 'novio', 'novia', 'relaciones', 'cita',
  'sexo', 'sexual', 'pornografia',
  'insulto', 'idiota', 'tonto', 'estupido',
  'receta', 'cocina', 'restaurante', 'chiste', 'cuentame un chiste',
];

function coincideFrase(textoNorm: string, clave: string): boolean {
  const claveNorm = normalizarTexto(clave);
  if (!claveNorm) return false;
  if (textoNorm === claveNorm || textoNorm.includes(claveNorm)) {
    return true;
  }
  const palabrasClave = claveNorm.split(' ').filter((p) => p.length > 2);
  if (palabrasClave.length > 1 && palabrasClave.every((p) => textoNorm.includes(p))) {
    return true;
  }
  return false;
}

/**
 * Clasificador determinista de intención a partir de la entrada del usuario.
 */
export function clasificarIntent(texto: string): IntentResult {
  const normalizado = normalizarTexto(texto);

  if (!normalizado || normalizado.length < 2) {
    return {
      intent: 'AYUDA',
      respuesta:
        'Por favor ingresa tu consulta sobre trámites, procedimientos TUPA, CUT o servicios del IESTP "Suiza".',
      nodoSugerido: 'ROOT',
      esFueraDeAlcance: false,
    };
  }

  // 1. Detección prioritaria de temas fuera de alcance
  const esFuera = TEMAS_FUERA_DE_ALCANCE.some((patron) =>
    normalizado.includes(patron)
  );
  if (esFuera) {
    return {
      intent: 'FUERA_DE_ALCANCE',
      respuesta: RESPUESTA_FUERA_DE_ALCANCE,
      nodoSugerido: 'ROOT',
      esFueraDeAlcance: true,
    };
  }

  // 2. Coincidencia por reglas institucionales priorizadas
  for (const regla of REGLAS_INTENTS) {
    const coincide = regla.palabrasClave.some((clave) =>
      coincideFrase(normalizado, clave)
    );

    if (coincide) {
      return {
        intent: regla.intent,
        respuesta: regla.respuesta,
        nodoSugerido: regla.nodoSugerido,
        rutaSugerida: regla.rutaSugerida,
        esFueraDeAlcance: false,
      };
    }
  }

  // 3. Fallback controlado sin inventar datos
  return {
    intent: 'FUERA_DE_ALCANCE',
    respuesta: RESPUESTA_NO_CONFIRMADA,
    nodoSugerido: 'ROOT',
    esFueraDeAlcance: true,
  };
}
