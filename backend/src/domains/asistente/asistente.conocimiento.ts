/**
 * ==============================================================================
 * Base de Conocimiento del Asistente Virtual (AsistenteCore)
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * ==============================================================================
 * Descripción:
 * Catálogo determinista de intenciones y respuestas fundamentadas en el TUPA
 * 2026 y en el marco normativo vigente. Cada respuesta cita su fuente y ofrece
 * sugerencias de continuación, de modo que el asistente nunca inventa trámites.
 *
 * Mantenimiento: al actualizar el TUPA o la normativa, actualizar este catálogo.
 */

import type { EntradaConocimiento } from './asistente.types.js';

export const FUENTE_TUPA = 'TUPA IESTP "Suiza" 2026';
export const FUENTE_LPAG = 'TUO de la Ley N° 27444 (LPAG)';
export const FUENTE_MGD = 'D.S. N° 026-2016-PCM / R.S.G. N° 001-2017-PCM (MGD)';
export const FUENTE_LPDP = 'Ley N° 29733 (Protección de Datos Personales)';
export const FUENTE_AGN = 'Directiva N° 001-2019-AGN/DDPA';
export const FUENTE_CVD = 'D.S. N° 070-2013-PCM (Firma Digital)';

export const SUGERENCIAS_INICIALES = [
  '¿Cuál es el horario de atención?',
  '¿Cómo radico un trámite?',
  '¿Cuánto tarda mi trámite?',
  '¿Cómo consulto el estado de mi expediente?',
  '¿Cómo valido un documento firmado?',
] as const;

export const ENTRADAS_CONOCIMIENTO: readonly EntradaConocimiento[] = [
  {
    id: 'saludo',
    intencion: 'saludo',
    palabrasClave: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos', 'hey', 'que tal', 'buen dia'],
    respuesta:
      '¡Hola! Soy el asistente virtual del Sistema Integral de Gestión Documentaria (SIGD) del IESTP "Suiza". ' +
      'Puedo orientarte sobre el TUPA, horarios de atención, plazos legales, radicación de trámites, ' +
      'seguimiento de expedientes, casilla electrónica y validación de documentos firmados. ¿En qué trámite necesitas ayuda?',
    fuentes: [FUENTE_TUPA],
    sugerencias: ['¿Cómo radico un trámite?', '¿Cuál es el horario de atención?', '¿Cuánto tarda mi trámite?'],
  },
  {
    id: 'horario_atencion',
    intencion: 'horario_atencion',
    palabrasClave: ['horario', 'atencion', 'atiende', 'abierto', 'cerrado', 'hora', '16:30', '16 30', 'corte', 'dias habiles', 'jornada'],
    respuesta:
      'La atención presencial y la Mesa de Partes Virtual operan en días hábiles. La jornada concluye a las 16:30 hrs. ' +
      'Conforme al Art. 138 del TUO de la Ley N° 27444, los documentos presentados después de las 16:30 hrs o en día inhábil ' +
      'se consideran presentados a las 08:00:00 hrs del día hábil inmediato posterior. La Mesa de Partes Virtual está ' +
      'disponible 24x7 para la recepción de solicitudes.',
    fuentes: [FUENTE_LPAG, FUENTE_TUPA],
    sugerencias: ['¿Cómo radico un trámite?', '¿Cuánto tarda mi trámite?', '¿Cuáles son los feriados?'],
  },
  {
    id: 'plazo_sla',
    intencion: 'plazo_sla',
    palabrasClave: ['plazo', 'demora', 'cuanto tarda', 'cuanto tiempo', 'tarda', '30 dias', 'dias habiles', 'sla', 'resuelto', 'respuesta', 'tiempo maximo'],
    respuesta:
      'Los procedimientos sujetos a evaluación previa tienen un plazo máximo de 30 días hábiles para su resolución ' +
      '(Art. 142 y 143 del TUO de la Ley N° 27444), salvo prórroga expresa legal. Se descuentan sábados, domingos y feriados. ' +
      'En el sistema verás un semáforo de SLA: NORMAL (hasta 15 días), ALERTA (16-25), CRÍTICO (26-30) y VENCIDO (más de 30).',
    fuentes: [FUENTE_LPAG, FUENTE_MGD],
    sugerencias: ['¿Cómo consulto el estado de mi expediente?', '¿Cuál es el horario de atención?', '¿Qué es el CUT?'],
  },
  {
    id: 'radicar_tramite',
    intencion: 'radicar_tramite',
    palabrasClave: ['radicar', 'presentar', 'enviar', 'iniciar', 'tramitar', 'mesa de partes', 'mesa partes', 'registrar', 'solicitar', 'como empiezo', 'como hago'],
    respuesta:
      'Para radicar un trámite ingresa a la Mesa de Partes Virtual (24x7) o a la Ventanilla Presencial en días hábiles. ' +
      'Completa el Formulario Único de Trámite (FUT), selecciona el procedimiento del TUPA, adjunta los requisitos en PDF, ' +
      'brinda el consentimiento de datos (Ley N° 29733) y confirma. Obtendrás un Código Único de Trámite (CUT) con el que ' +
      'podrás hacer seguimiento. Recuerda que el corte legal es a las 16:30 hrs.',
    fuentes: [FUENTE_TUPA, FUENTE_LPAG, FUENTE_LPDP],
    sugerencias: ['¿Cuáles son los requisitos de un trámite?', '¿Qué es el CUT?', '¿Cuál es el horario de atención?'],
  },
  {
    id: 'requisitos_tramite',
    intencion: 'requisitos_tramite',
    palabrasClave: ['requisito', 'requisitos', 'necesito', 'que presento', 'documentos', 'que necesito', 'expedicion', 'titulo', 'certificado', 'constancia', 'matricula', 'egresado', 'bachiller', 'fut', 'practicas', 'ingles'],
    respuesta:
      'Los requisitos dependen del procedimiento. En general, los trámites académicos del TUPA 2026 exigen el FUT y el pago ' +
      'del derecho correspondiente en Tesorería (algunos incluyen Resolución Directoral de Secretaría Académica). ' +
      'Ejemplos: Expedición de título (ACA-05): FUT, pago y comprobante. Certificado de estudios superiores (ACA-06): FUT, ' +
      'pago y comprobante. Constancia de egresado (ACA-22): FUT y pago. Matrículas (ACA-17): ficha de matrícula y pagos de ' +
      'matrícula y adeudos. Consulta el detalle en el TUPA dentro de la Mesa de Partes Virtual.',
    fuentes: [FUENTE_TUPA],
    sugerencias: ['¿Cuánto tarda mi trámite?', '¿Cómo radico un trámite?', '¿Cuáles son las tarifas?'],
  },
  {
    id: 'seguimiento_cut',
    intencion: 'seguimiento_cut',
    palabrasClave: ['cut', 'seguimiento', 'estado', 'consulta', 'expediente', 'en que esta', 'mi tramite', 'consulta publica', 'exp-2026', 'tracking'],
    respuesta:
      'El CUT (Código Único de Trámite) tiene el formato EXP-YYYY-XXXXXX y se genera de forma atómica al radicar. ' +
      'Para consultar el estado de tu trámite usa la Consulta Pública del SIGD con tu CUT, donde verás los movimientos ' +
      'y el semáforo de SLA. El CUT es único e irrepetible (D.S. N° 026-2016-PCM, MGD).',
    fuentes: [FUENTE_MGD, FUENTE_LPAG],
    sugerencias: ['¿Cómo radico un trámite?', '¿Cuánto tarda mi trámite?', '¿Qué es la casilla electrónica?'],
  },
  {
    id: 'casilla_electronica',
    intencion: 'casilla_electronica',
    palabrasClave: ['casilla', 'notificacion', 'notificaciones', 'notificado', 'acuse', 'cargo', 'notificarme', 'ley 29733'],
    respuesta:
      'La Casilla Electrónica es tu domicilio digital {DNI}@casilla.iestpsuiza.edu.pe (personas naturales) o ' +
      '{RUC}@casilla.iestpsuiza.edu.pe (personas jurídicas). Al radicar se te asigna automáticamente con tu consentimiento. ' +
      'Conforme al Art. 20 del TUO de la Ley N° 27444, el depósito del acto en la casilla surte efectos de notificación ' +
      'personal y genera un acuse digital con sellado de tiempo y hash SHA-256. Puedes revisar tus notificaciones y ' +
      'descargar el acuse en el módulo Casilla.',
    fuentes: [FUENTE_LPAG, FUENTE_LPDP],
    sugerencias: ['¿Cómo valido un documento firmado?', '¿Cuánto tarda mi trámite?', '¿Cómo radico un trámite?'],
  },
  {
    id: 'validar_documento_cvd',
    intencion: 'validar_documento_cvd',
    palabrasClave: ['validar', 'valido', 'autenticidad', 'verificar', 'cvd', 'codigo de verificacion', 'qr', 'falso', 'autentico', 'cotejo'],
    respuesta:
      'Para verificar la autenticidad de un documento oficial usa el Validador Público CVD del SIGD. ' +
      'Escanea el código QR del documento o ingresa el Código de Verificación Digital (CVD, 16 caracteres). ' +
      'El validador devuelve el dictamen: autoridad firmante, cargo, fecha cierta (sello de tiempo TSA) y el PDF original, ' +
      'conforme al D.S. N° 070-2013-PCM. El validador oculta datos personales de terceros (principio de disociación, LPDP).',
    fuentes: [FUENTE_CVD, FUENTE_LPDP],
    sugerencias: ['¿Qué es la firma digital?', '¿Cuál es el horario de atención?', '¿Cómo radico un trámite?'],
  },
  {
    id: 'firma_digital',
    intencion: 'firma_digital',
    palabrasClave: ['firma', 'firmar', 'refirma', 'dnie', 'firmante', 'pkcs', 'certificado', 'pades', 'firma digital'],
    respuesta:
      'Los actos administrativos se firman digitalmente con Refirma Suite de RENIEC, invocado mediante el protocolo ' +
      'refirma://. Soporta DNI electrónico (DNIe), tokens PKCS#11 y certificados de software acreditados. La firma ' +
      'tiene la misma validez legal que la manuscrita (Ley N° 27269) y el documento firmado incorpora el CVD, el QR de ' +
      'cotejo y el estampado marginal (D.S. N° 070-2013-PCM).',
    fuentes: [FUENTE_CVD],
    sugerencias: ['¿Cómo valido un documento firmado?', '¿Qué es el CVD?', '¿Cuál es el horario de atención?'],
  },
  {
    id: 'feriados',
    intencion: 'feriados',
    palabrasClave: ['feriado', 'feriados', 'san juan', '24 de junio', '13 de octubre', 'inhabil', 'inhábiles', 'no laborable', 'coronel portillo'],
    respuesta:
      'Además de los feriados nacionales del D. Leg. N° 713, el cómputo de plazos descuenta los feriados regionales no ' +
      'laborables de Ucayali: 24 de junio (Fiesta Patronal de San Juan Bautista) y 13 de octubre (Aniversario de la Provincia ' +
      'de Coronel Portillo / Fundación de Pucallpa). Por eso el SLA se mide en días hábiles.',
    fuentes: [FUENTE_LPAG, FUENTE_MGD],
    sugerencias: ['¿Cuánto tarda mi trámite?', '¿Cuál es el horario de atención?', '¿Cómo radico un trámite?'],
  },
  {
    id: 'matricula_admision',
    intencion: 'matricula_admision',
    palabrasClave: ['matricula', 'matrícula', 'admsion', 'admision', 'ingreso', 'inscribirme', 'postular', 'cepretec', 'vacante'],
    respuesta:
      'Para matrículas (ACA-17) necesitas la ficha de matrícula y los pagos de matrícula y adeudos en Tesorería. ' +
      'Para Admisión 2026 (ACA-18) el derecho es de S/. 250.00; el ingreso de titulados (ACA-20) es S/. 500.00 y las guías ' +
      'del postulante (ACA-19) cuestan S/. 50.00. Revisa disponibilidad de vacantes y requisitos en el TUPA 2026.',
    fuentes: [FUENTE_TUPA],
    sugerencias: ['¿Cuáles son las tarifas?', '¿Cómo radico un trámite?', '¿Cuánto tarda mi trámite?'],
  },
  {
    id: 'titulos_certificados',
    intencion: 'titulos_certificados',
    palabrasClave: ['titulo', 'título', 'bachiller', 'certificado', 'egresado', 'constancia', 'colacion', 'graduacion', 'graduarme', 'titularme'],
    respuesta:
      'Trámites frecuentes: Expedición de título (ACA-05, S/. 105.00), Duplicado de título (ACA-16, S/. 309.00), ' +
      'Certificado de estudios superiores (ACA-06, S/. 124.00), Certificado de bachillerato (ACA-23, S/. 42.00), ' +
      'Constancia de egresado (ACA-22, S/. 31.00) y Constancia de no adeudar para titulación (ACA-02, S/. 16.50). ' +
      'Todos requieren FUT y pago en Tesorería. Verifica el detalle en el TUPA.',
    fuentes: [FUENTE_TUPA],
    sugerencias: ['¿Cuáles son los requisitos de un trámite?', '¿Cuánto tarda mi trámite?', '¿Cómo valido un documento firmado?'],
  },
  {
    id: 'tarifas',
    intencion: 'tarifas',
    palabrasClave: ['tarifa', 'tarifas', 'costo', 'coste', 'precio', 'cuanto cuesta', 'cuanto vale', 'pago', 'uit', 'tesoreria', 'derecho'],
    respuesta:
      'Los derechos se expresan como porcentaje de la UIT vigente o monto fijo, y se pagan en Tesorería. ' +
      'Por ejemplo: FUT S/. 4.00, Certificado de estudios S/. 124.00, Expedición de título S/. 105.00, ' +
      'Constancia de egresado S/. 31.00, Matrícula S/. 200.00 y Admisión 2026 S/. 250.00. ' +
      'Consulta el monto exacto y actualizado en el TUPA 2026.',
    fuentes: [FUENTE_TUPA],
    sugerencias: ['¿Cuáles son los requisitos de un trámite?', '¿Cómo radico un trámite?', '¿Cuáles son los feriados?'],
  },
  {
    id: 'datos_personales',
    intencion: 'datos_personales',
    palabrasClave: ['datos personales', 'privacidad', 'ley 29733', 'mis datos', 'proteccion de datos', 'informacion personal', 'consentimiento'],
    respuesta:
      'El SIGD trata tus datos personales conforme a la Ley N° 29733 (LPDP) y su reglamento. Al registrarte otorgas ' +
      'consentimiento expreso mediante casilla desmarcada por defecto. El Validador CVD y la consulta pública ocultan ' +
      'teléfonos, correos y domicilios particulares (principio de disociación). El asistente no almacena tu mensaje: ' +
      'solo registra un hash anonimizado para auditoría.',
    fuentes: [FUENTE_LPDP],
    sugerencias: ['¿Qué es la casilla electrónica?', '¿Cómo valido un documento firmado?', '¿Cuál es el horario de atención?'],
  },
  {
    id: 'ayuda_general',
    intencion: 'ayuda_general',
    palabrasClave: ['ayuda', 'help', 'que puedes', 'opciones', 'menu', 'asistencia', 'soporte', 'no se', 'dudas'],
    respuesta:
      'Estos son los temas en los que puedo orientarte: TUPA y requisitos, tarifas, horario de atención y corte de las ' +
      '16:30 hrs, plazos legales (30 días hábiles), radicación en Mesa de Partes Virtual, seguimiento por CUT, ' +
      'casilla electrónica y acuses, firma digital (Refirma), validación de documentos (CVD/QR) y feriados de Ucayali. ' +
      'Escribe tu consulta con palabras clave del trámite.',
    fuentes: [FUENTE_TUPA, FUENTE_LPAG],
    sugerencias: SUGERENCIAS_INICIALES,
  },
];

/**
 * Subconjunto curado de procedimientos del TUPA 2026 para consulta rápida
 * por nombre o código. Si el usuario pregunta por un procedimiento no listado,
 * el motor invita a revisar el TUPA completo en la Mesa de Partes Virtual.
 */
export interface ProcedimientoAsistente {
  readonly codigo: string;
  readonly nombre: string;
  readonly sinonimos: readonly string[];
  readonly requisitos: readonly string[];
  readonly derechoPago: string;
}

export const PROCEDIMIENTOS_ASISTENTE: readonly ProcedimientoAsistente[] = [
  {
    codigo: 'ACA-01',
    nombre: 'FUT',
    sinonimos: ['fut', 'formulario unico de tramite', 'formulario unico'],
    requisitos: ['Pago del derecho en Tesorería', 'Comprobante de pago'],
    derechoPago: 'S/. 4.00',
  },
  {
    codigo: 'ACA-02',
    nombre: 'Constancia de no adeudar para fines de titulación',
    sinonimos: ['no adeudar', 'no deudo', 'al dia', 'sin adeudos'],
    requisitos: ['Pago del derecho en Tesorería', 'Comprobante de pago'],
    derechoPago: 'S/. 16.50',
  },
  {
    codigo: 'ACA-05',
    nombre: 'Expedición de título',
    sinonimos: ['titulo', 'titulación', 'expedicion de titulo'],
    requisitos: ['Pago del derecho en Tesorería', 'Comprobante de pago'],
    derechoPago: 'S/. 105.00',
  },
  {
    codigo: 'ACA-06',
    nombre: 'Certificado de estudios superiores (6 semestres)',
    sinonimos: ['certificado de estudios', 'certificado de estudios superiores'],
    requisitos: ['Pago del derecho en Tesorería', 'Comprobante de pago'],
    derechoPago: 'S/. 124.00',
  },
  {
    codigo: 'ACA-16',
    nombre: 'Derecho de duplicado de título',
    sinonimos: ['duplicado de titulo', 'duplicado', 'segunda copia de titulo'],
    requisitos: ['Pago del derecho en Tesorería', 'Comprobante de pago'],
    derechoPago: 'S/. 309.00',
  },
  {
    codigo: 'ACA-17',
    nombre: 'Matrículas',
    sinonimos: ['matricula', 'matrícula', 'inscripcion'],
    requisitos: ['Ficha de matrícula', 'Pago de adeudos en Tesorería', 'Pago del derecho de matrícula en Tesorería'],
    derechoPago: 'S/. 200.00',
  },
  {
    codigo: 'ACA-18',
    nombre: 'Admisión 2026',
    sinonimos: ['admision', 'admisión', 'ingreso', 'postular'],
    requisitos: ['Pago en el Área de Tesorería'],
    derechoPago: 'S/. 250.00',
  },
  {
    codigo: 'ACA-22',
    nombre: 'Constancia de egresado',
    sinonimos: ['egresado', 'constancia de egresado'],
    requisitos: ['Pago del derecho en Tesorería'],
    derechoPago: 'S/. 31.00',
  },
  {
    codigo: 'ACA-23',
    nombre: 'Certificado de bachillerato',
    sinonimos: ['bachiller', 'bachillerato', 'certificado de bachillerato'],
    requisitos: ['Pago del derecho en Tesorería', 'Comprobante de pago'],
    derechoPago: 'S/. 42.00',
  },
  {
    codigo: 'ACA-25',
    nombre: 'Convalidación entre planes de estudios',
    sinonimos: ['convalidacion', 'convalidación', 'convalidar cursos', 'equivalencias'],
    requisitos: ['Pago del derecho en Tesorería'],
    derechoPago: 'S/. 46.50',
  },
  {
    codigo: 'ACA-26',
    nombre: 'Convalidación por unidades de competencia',
    sinonimos: ['unidades de competencia', 'convalidacion por competencia'],
    requisitos: ['Pago del derecho en Tesorería', 'Comprobante de pago'],
    derechoPago: 'S/. 46.50',
  },
  {
    codigo: 'ACA-29',
    nombre: 'Evaluación extraordinaria (RM 069)',
    sinonimos: ['evaluacion extraordinaria', 'extraordinaria', 'rm 069'],
    requisitos: ['Pago del derecho en Tesorería', 'Comprobante de pago'],
    derechoPago: 'S/. 70.00',
  },
  {
    codigo: 'ACA-30',
    nombre: 'Examen de recuperación',
    sinonimos: ['recuperacion', 'recuperación', 'examen de recuperacion'],
    requisitos: ['Pago del derecho en Tesorería', 'Comprobante de pago'],
    derechoPago: 'S/. 70.00',
  },
  {
    codigo: 'PRO-05',
    nombre: 'Certificado modular (I, II, III y IV)',
    sinonimos: ['certificado modular', 'modular'],
    requisitos: ['Pago en el Área de Tesorería', 'Emisión de la boleta de venta'],
    derechoPago: 'S/. 100.00 por módulo',
  },
];
