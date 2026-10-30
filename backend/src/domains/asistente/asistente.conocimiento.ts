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
export const FUENTE_INSTITUCIONAL = 'Tablas maestras SIGD (SED-001) · IESTP "Suiza"';

export const SUGERENCIAS_INICIALES = [
  '¿Qué es esta web y para qué sirve?',
  '¿Cómo funciona la web paso a paso?',
  '¿Cómo llego al instituto?',
  '¿Cómo radico un trámite?',
  '¿Cuánto tarda mi trámite?',
  '¿Cuánto cuesta toda la carrera?',
  '¿Cómo valido un documento firmado?',
] as const;

export const ENTRADAS_CONOCIMIENTO: readonly EntradaConocimiento[] = [
  {
    id: 'saludo',
    intencion: 'saludo',
    palabrasClave: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos', 'hey', 'que tal', 'buen dia'],
    respuesta:
      '¡Hola! Soy el asistente virtual del Sistema Integral de Gestión Documentaria (SIGD) del IESTP "Suiza". ' +
      'Puedo explicarte qué es esta web y cómo usarla, cómo llegar a la sede, y orientarte sobre el TUPA, horarios, ' +
      'plazos, radicación, seguimiento, casilla electrónica y validación de documentos. ¿En qué necesitas ayuda?',
    fuentes: [FUENTE_TUPA, FUENTE_INSTITUCIONAL],
    sugerencias: ['¿Qué es esta web?', '¿Cómo radico un trámite?', '¿Cómo llego al instituto?'],
    enlaces: [
      { etiqueta: 'Ver módulos de la web', ruta: '/' },
      { etiqueta: 'Mesa de Partes Virtual', ruta: '/tramite' },
    ],
  },
  {
    id: 'que_es_sigd',
    intencion: 'que_es_sigd',
    palabrasClave: [
      'que es esta web', 'que es la web', 'que es esta pagina', 'para que es esta web', 'para que sirve esta web',
      'para que sirve la web', 'para que fue creada', 'que es el sigd', 'sistema integral', 'gestion documentaria',
      'gestion documental', 'que hace la web', 'que hace el sistema', 'funcionamiento',
      'como funciona esta web', 'como funciona el sigd', 'que puedo hacer', 'de que trata',
      'objetivo del sistema', 'para que sirve el sigd',
    ],
    respuesta:
      'Esta web es el Sistema Integral de Gestión Documentaria (SIGD) del IESTP "Suiza" de Pucallpa. ' +
      'Permite presentar y radicar trámites académicos y administrativos en la Mesa de Partes Virtual (24/7), ' +
      'consultar el estado de un expediente por CUT, recibir notificaciones en la Casilla Electrónica, validar ' +
      'documentos firmados con CVD/QR y gestionar el flujo documentario interno (bandejas, expedientes, reportes y ' +
      'administración). Se rige por el TUO de la Ley N° 27444 y la Ley N° 29733.',
    fuentes: [FUENTE_INSTITUCIONAL, FUENTE_LPAG, FUENTE_LPDP],
    sugerencias: ['¿Cómo funciona la web paso a paso?', '¿Cómo radico un trámite?', '¿Cómo llego al instituto?'],
    enlaces: [
      { etiqueta: 'Ver módulos en la página de inicio', ruta: '/' },
      { etiqueta: 'Mesa de Partes Virtual', ruta: '/tramite' },
      { etiqueta: 'Consultar el estado de un trámite', ruta: '/consulta' },
      { etiqueta: 'Casilla Electrónica', ruta: '/casilla' },
      { etiqueta: 'Validador CVD', ruta: '/validador-cvd' },
    ],
  },
  {
    id: 'guia_uso_web',
    intencion: 'guia_uso_web',
    palabrasClave: [
      'como funciona la web', 'como uso la web', 'como usar la web', 'como uso el sistema',
      'paso a paso', 'guia', 'manual', 'tutorial', 'instrucciones', 'documentacion',
      'mi documentacion', 'hacer mi documentacion', 'hacer mis documentos', 'primeros pasos',
      'como empiezo', 'que modulos', 'modulos de la web', 'navegar', 'menu de la web',
    ],
    respuesta:
      'Guía rápida del SIGD:\n' +
      '1) Regístrate en "Registro Ciudadano" (persona natural o jurídica) y acepta la declaración jurada y el consentimiento de la Ley N° 29733; se crea tu Casilla Electrónica.\n' +
      '2) Inicia sesión con tu cuenta ciudadana.\n' +
      '3) Ingresa a "Mesa de Partes Virtual" y completa el asistente de 4 pasos: identificación del solicitante, documentos del trámite (procedimiento TUPA, asunto, folios y PDF), declaración jurada y confirmación.\n' +
      '4) Al confirmar se genera tu CUT con formato EXP-AAAA-XXXXXX y el cargo digital.\n' +
      '5) Consulta el estado con tu CUT y revisa tus notificaciones en la Casilla Electrónica.\n' +
      '6) Valida documentos firmados en el Validador CVD. También puedes usar la Ventanilla Presencial en días hábiles.',
    fuentes: [FUENTE_TUPA, FUENTE_MGD, FUENTE_LPDP],
    sugerencias: ['¿Cómo radico un trámite?', '¿Qué es esta web?', '¿Cómo llego al instituto?'],
    enlaces: [
      { etiqueta: 'Registro Ciudadano', ruta: '/registro' },
      { etiqueta: 'Mesa de Partes Virtual', ruta: '/tramite' },
      { etiqueta: 'Consulta Pública (CUT)', ruta: '/consulta' },
      { etiqueta: 'Casilla Electrónica', ruta: '/casilla' },
      { etiqueta: 'Validador CVD', ruta: '/validador-cvd' },
    ],
  },
  {
    id: 'como_llegar_sede',
    intencion: 'como_llegar_sede',
    palabrasClave: [
      'como llego', 'como llegar', 'llegar al instituto', 'llegar al iestp', 'llegar a la sede',
      'ubicacion', 'direccion', 'donde queda', 'donde esta el instituto', 'donde esta la sede',
      'sede central', 'sede principal', 'centenario', 'km 3.5', 'calleria', 'como visito', 'apersonarme',
    ],
    respuesta:
      'La Sede Principal del IESTP "Suiza" es el campus central de Pucallpa (SED-001): Av. Centenario Km 3.5, ' +
      'Pucallpa, provincia de Coronel Portillo, región Ucayali. Allí funcionan la Dirección General, Secretaría ' +
      'Académica, la Mesa de Partes Central y el Archivo Central. Para ubicarla en un mapa, busca ' +
      '"IESTP Suiza Pucallpa". Si no puedes apersonarte, radica en línea por la Mesa de Partes Virtual (24/7).',
    fuentes: [FUENTE_INSTITUCIONAL],
    sugerencias: ['¿Cuál es el horario de atención?', '¿Cómo radico un trámite?', '¿Cuál es el correo de contacto?'],
    enlaces: [
      { etiqueta: 'Ventanilla Presencial', ruta: '/tramite/ventanilla-presencial' },
      { etiqueta: 'Mesa de Partes Virtual', ruta: '/tramite' },
    ],
  },
  {
    id: 'contacto_institucional',
    intencion: 'contacto_institucional',
    palabrasClave: [
      'contacto', 'contactarme', 'comunicarme', 'correo', 'email', 'telefono', 'whatsapp',
      'atencion al ciudadano', 'mesa de partes presencial', 'ventanilla presencial', 'correo institucional',
      'hablar con una persona', 'hablar con alguien', 'persona real', 'atencion humana', 'asesor',
    ],
    respuesta:
      'Canales oficiales: Mesa de Partes Virtual (24/7) para radicar trámites; Ventanilla Presencial en la Sede ' +
      'Principal (Av. Centenario Km 3.5, Pucallpa) en días hábiles; Casilla Electrónica para notificaciones; y el ' +
      'correo de contacto publicado en el portal: contacto@iestpsuiza.edu.pe. Para ejercer tus derechos ARCO sobre ' +
      'datos personales escribe a datos.personales@iestpsuiza.edu.pe (Ley N° 29733). La recepción de documentos ' +
      'cierra a las 16:30 hrs.',
    fuentes: [FUENTE_INSTITUCIONAL, FUENTE_LPDP],
    sugerencias: ['¿Cuál es el horario de atención?', '¿Cómo llego al instituto?', '¿Cómo radico un trámite?'],
    enlaces: [
      { etiqueta: 'Ventanilla Presencial', ruta: '/tramite/ventanilla-presencial' },
      { etiqueta: 'Mesa de Partes Virtual', ruta: '/tramite' },
      { etiqueta: 'Casilla Electrónica', ruta: '/casilla' },
    ],
  },
  {
    id: 'horario_atencion',
    intencion: 'horario_atencion',
    palabrasClave: ['horario', 'atencion', 'atiende', 'abierto', 'cerrado', 'hora', '16:30', '16 30', 'corte', 'dias habiles', 'jornada'],
    respuesta:
      'La recepción de documentos en Mesa de Partes es de lunes a viernes, de 08:00 a 16:30 hrs, en días hábiles. ' +
      'La jornada institucional se extiende hasta las 17:00 hrs. La Mesa de Partes Virtual recibe solicitudes 24/7; ' +
      'lo ingresado después de las 16:30 hrs o en día inhábil se considera presentado a las 08:00 hrs del día hábil ' +
      'siguiente, conforme al TUO de la Ley N° 27444.',
    fuentes: [FUENTE_LPAG, FUENTE_TUPA],
    sugerencias: ['¿Cómo radico un trámite?', '¿Cuánto tarda mi trámite?', '¿Cuáles son los feriados?'],
    enlaces: [
      { etiqueta: 'Mesa de Partes Virtual (24/7)', ruta: '/tramite' },
      { etiqueta: 'Ventanilla Presencial', ruta: '/tramite/ventanilla-presencial' },
    ],
  },
  {
    id: 'plazo_sla',
    intencion: 'plazo_sla',
    palabrasClave: ['plazo', 'demora', 'cuanto tarda', 'cuanto tiempo', 'tarda', '30 dias', 'dias habiles', 'sla', 'resuelto', 'respuesta', 'tiempo maximo'],
    respuesta:
      'Los procedimientos sujetos a evaluación previa tienen un plazo máximo de 30 días hábiles para su resolución, ' +
      'conforme al TUO de la Ley N° 27444, salvo plazo distinto establecido por ley. Se descuentan sábados, domingos ' +
      'y feriados. En el sistema verás un semáforo de SLA: NORMAL (hasta 15 días), ALERTA (16-25), CRÍTICO (26-30) y ' +
      'VENCIDO (más de 30).',
    fuentes: [FUENTE_LPAG, FUENTE_MGD],
    sugerencias: ['¿Cómo consulto el estado de mi expediente?', '¿Cuál es el horario de atención?', '¿Qué es el CUT?'],
    enlaces: [{ etiqueta: 'Consultar el estado de mi trámite', ruta: '/consulta' }],
  },
  {
    id: 'radicar_tramite',
    intencion: 'radicar_tramite',
    palabrasClave: ['radicar', 'radico', 'radique', 'tramitar', 'tramito', 'presentar', 'presento', 'enviar', 'iniciar', 'inicio', 'solicitar', 'solicito', 'mesa de partes', 'mesa partes', 'registrar', 'como empiezo', 'como hago'],
    respuesta:
      'Para radicar un trámite: 1) Regístrate o inicia sesión con tu cuenta ciudadana. 2) Ingresa a la Mesa de Partes ' +
      'Virtual (24/7) y completa el asistente de 4 pasos: identificación, documentos del trámite (procedimiento TUPA, ' +
      'asunto, folios y PDF), declaración jurada y confirmación. 3) Al confirmar obtienes tu CUT (EXP-AAAA-XXXXXX) y el ' +
      'cargo digital. También puedes presentar documentos en la Ventanilla Presencial en días hábiles. La recepción ' +
      'cierra a las 16:30 hrs.',
    fuentes: [FUENTE_TUPA, FUENTE_LPAG, FUENTE_LPDP],
    sugerencias: ['¿Cuáles son los requisitos de un trámite?', '¿Qué es el CUT?', '¿Cuál es el horario de atención?'],
    enlaces: [
      { etiqueta: 'Registrarme como ciudadano', ruta: '/registro' },
      { etiqueta: 'Radicar en Mesa de Partes Virtual', ruta: '/tramite' },
      { etiqueta: 'Consultar el estado de mi trámite', ruta: '/consulta' },
    ],
  },
  {
    id: 'requisitos_tramite',
    intencion: 'requisitos_tramite',
    palabrasClave: ['requisito', 'requisitos', 'necesito', 'que presento', 'documentos', 'que necesito', 'expedicion', 'titulo', 'certificado', 'constancia', 'matricula', 'egresado', 'bachiller', 'fut', 'practicas', 'ingles'],
    respuesta:
      'Los requisitos dependen del procedimiento del TUPA 2026. En el catálogo, la mayoría exige pago en Tesorería y ' +
      'comprobante de pago; algunos añaden Resolución Directoral de Secretaría Académica. Ejemplos: Expedición de título ' +
      '(ACA-05): pago y comprobante, S/. 105.00; Certificado de estudios superiores (ACA-06): pago y comprobante, ' +
      'S/. 124.00; Constancia de egresado (ACA-22): pago, S/. 31.00; Matrículas (ACA-17): ficha de matrícula, pago de ' +
      'adeudos y pago de matrícula. Consulta el detalle en el TUPA dentro de la Mesa de Partes Virtual.',
    fuentes: [FUENTE_TUPA],
    sugerencias: ['¿Cuánto tarda mi trámite?', '¿Cómo radico un trámite?', '¿Cuáles son las tarifas?'],
    enlaces: [{ etiqueta: 'Ver el TUPA en la Mesa de Partes', ruta: '/tramite' }],
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
    enlaces: [{ etiqueta: 'Consulta Pública por CUT', ruta: '/consulta' }],
  },
  {
    id: 'casilla_electronica',
    intencion: 'casilla_electronica',
    palabrasClave: ['casilla', 'notificacion', 'notificaciones', 'notificado', 'acuse', 'cargo', 'notificarme', 'ley 29733'],
    respuesta:
      'La Casilla Electrónica es tu domicilio digital {DNI}@casilla.iestpsuiza.edu.pe (personas naturales) o ' +
      '{RUC}@casilla.iestpsuiza.edu.pe (personas jurídicas). Se asigna al registrarte con tu consentimiento. ' +
      'Conforme al Art. 20 del TUO de la Ley N° 27444, el depósito surte efectos de notificación personal y genera ' +
      'un acuse con sellado de tiempo y hash SHA-256. Si el depósito es después de las 16:30 hrs o en día inhábil, ' +
      'surte efectos a las 08:00 hrs del día hábil siguiente. Recibirás además avisos por correo y SMS.',
    fuentes: [FUENTE_LPAG, FUENTE_LPDP],
    sugerencias: ['¿Cómo valido un documento firmado?', '¿Cuánto tarda mi trámite?', '¿Cómo radico un trámite?'],
    enlaces: [
      { etiqueta: 'Abrir mi Casilla Electrónica', ruta: '/casilla' },
      { etiqueta: 'Registro Ciudadano', ruta: '/registro' },
    ],
  },
  {
    id: 'validar_documento_cvd',
    intencion: 'validar_documento_cvd',
    palabrasClave: ['validar', 'valido', 'autenticidad', 'verificar', 'cvd', 'codigo de verificacion', 'qr', 'falso', 'autentico', 'cotejo'],
    respuesta:
      'Para verificar la autenticidad de un documento oficial usa el Validador Público CVD del SIGD. ' +
      'Escanea el código QR del documento o ingresa el Código de Verificación Digital (CVD), con formato ' +
      'CVD-AAAA-TIPO-CORRELATIVO-CHECK (por ejemplo, CVD-2026-RD-000412-892F). El validador muestra el documento, ' +
      'el firmante, la fecha de expedición y el resultado de integridad (hash SHA-256 y sello de tiempo TSA). ' +
      'Cada consulta queda registrada en la auditoría del sistema.',
    fuentes: [FUENTE_CVD, FUENTE_MGD],
    sugerencias: ['¿Qué es la firma digital?', '¿Cuál es el horario de atención?', '¿Cómo radico un trámite?'],
    enlaces: [{ etiqueta: 'Abrir el Validador CVD', ruta: '/validador-cvd' }],
  },
  {
    id: 'firma_digital',
    intencion: 'firma_digital',
    palabrasClave: ['firma', 'firmar', 'refirma', 'dnie', 'firmante', 'pkcs', 'certificado', 'pades', 'firma digital'],
    respuesta:
      'Los documentos oficiales se firman digitalmente con Refirma (RENIEC) o proveedores acreditados por ' +
      'INDECOPI/IOFE, usando DNI electrónico, token USB o certificado de software. La firma se aplica en PDF/A con ' +
      'PAdES y sellado de tiempo TSA, y tiene la misma validez legal que la firma manuscrita (Ley N° 27269). El ' +
      'documento firmado incluye el CVD y el código QR para su verificación pública.',
    fuentes: [FUENTE_CVD, FUENTE_MGD],
    sugerencias: ['¿Cómo valido un documento firmado?', '¿Qué es el CVD?', '¿Cuál es el horario de atención?'],
    enlaces: [
      { etiqueta: 'Flujo y Validez Legal', ruta: '/flujo-validez-legal' },
      { etiqueta: 'Abrir el Validador CVD', ruta: '/validador-cvd' },
    ],
  },
  {
    id: 'feriados',
    intencion: 'feriados',
    palabrasClave: ['feriado', 'feriados', 'san juan', '24 de junio', '13 de octubre', 'inhabil', 'inhábiles', 'no laborable', 'coronel portillo'],
    respuesta:
      'Además de los feriados nacionales del D. Leg. N° 713, el cómputo de plazos descuenta los feriados regionales no ' +
      'laborables de Ucayali: 24 de junio (Fiesta Patronal de San Juan Bautista) y 13 de octubre (Aniversario de la Provincia ' +
      'de Coronel Portillo / Fundación de Pucallpa). También se consideran los días no laborables compensables que disponga ' +
      'la PCM. Por eso el SLA se mide en días hábiles.',
    fuentes: [FUENTE_LPAG, FUENTE_MGD],
    sugerencias: ['¿Cuánto tarda mi trámite?', '¿Cuál es el horario de atención?', '¿Cómo radico un trámite?'],
    enlaces: [{ etiqueta: 'Consultar el estado de mi trámite', ruta: '/consulta' }],
  },
  {
    id: 'matricula_admision',
    intencion: 'matricula_admision',
    palabrasClave: ['matricula', 'matrícula', 'admsion', 'admision', 'ingreso', 'inscribirme', 'postular', 'cepretec', 'vacante'],
    respuesta:
      'Para matrículas (ACA-17) necesitas la ficha de matrícula, el pago de adeudos y el pago del derecho de matrícula ' +
      '(S/. 200.00). Para Admisión 2026 (ACA-18) el derecho es de S/. 250.00; las guías del postulante (ACA-19) cuestan ' +
      'S/. 50.00 y el ingreso de admisión para titulados (ACA-20) es S/. 500.00. Revisa requisitos y vacantes en el TUPA 2026.',
    fuentes: [FUENTE_TUPA],
    sugerencias: ['¿Cuáles son las tarifas?', '¿Cómo radico un trámite?', '¿Cuánto tarda mi trámite?'],
    enlaces: [{ etiqueta: 'Radicar matrícula o admisión', ruta: '/tramite' }],
  },
  {
    id: 'titulos_certificados',
    intencion: 'titulos_certificados',
    palabrasClave: ['titulo', 'título', 'bachiller', 'certificado', 'egresado', 'constancia', 'colacion', 'graduacion', 'graduarme', 'titularme'],
    respuesta:
      'Trámites frecuentes del TUPA 2026: Expedición de título (ACA-05, S/. 105.00), Duplicado de título (ACA-16, ' +
      'S/. 309.00), Certificado de estudios superiores (ACA-06, S/. 124.00), Certificado de bachillerato (ACA-23, ' +
      'S/. 42.00), Constancia de egresado (ACA-22, S/. 31.00) y Constancia de no adeudar para titulación (ACA-02, ' +
      'S/. 16.50). En el catálogo, estos conceptos requieren pago en Tesorería y comprobante de pago. Verifica el ' +
      'detalle en el TUPA.',
    fuentes: [FUENTE_TUPA],
    sugerencias: ['¿Cuáles son los requisitos de un trámite?', '¿Cuánto tarda mi trámite?', '¿Cómo valido un documento firmado?'],
    enlaces: [
      { etiqueta: 'Radicar en Mesa de Partes Virtual', ruta: '/tramite' },
      { etiqueta: 'Consultar el estado de mi trámite', ruta: '/consulta' },
    ],
  },
  {
    id: 'costo_carrera',
    intencion: 'costo_carrera',
    palabrasClave: [
      'cuanto me costaria', 'cuanto me costoria', 'cuanto costaria', 'cuanto costoria',
      'cuanto cuesta la carrera', 'cuanto cuesta estudiar', 'cuanto cuesta la pension',
      'cuanto cuesta la mensualidad', 'costo de la carrera', 'costo de estudiar la carrera',
      'costo total de la carrera', 'gastos de la carrera', 'toda la carrera',
      'desde el primer ciclo', 'desde que ingreso', 'hasta que me titule',
      'hasta titularme', 'hasta que me titulo', 'pension', 'pension mensual',
      'pension por ciclo', 'pensiones', 'mensualidad', 'mensualidades',
      'costo por ciclo', 'matricula por ciclo', 'tecnico en dsi',
      'tecnico en desarrollo de sistemas',
    ],
    respuesta:
      'La documentación pública no registra una pensión mensual ni un costo total oficial de la carrera. El TUPA ' +
      '2026 solo detalla derechos académicos puntuales: matrícula S/. 200.00 (ACA-17), admisión S/. 250.00 (ACA-18), ' +
      'certificado de estudios superiores de 6 semestres S/. 124.00 (ACA-06) y, para la titulación, FUT S/. 4.00 ' +
      '(ACA-01), constancia de no adeudar S/. 16.50 (ACA-02), trabajo de aplicación profesional o examen de ' +
      'suficiencia S/. 57.00 (ACA-03/04) y expedición de título S/. 105.00 (ACA-05). Si se paga una matrícula por ' +
      'cada uno de los 6 semestres, solo en matrículas serían S/. 1,200.00; si se suman los derechos de titulación ' +
      'indicados (eligiendo una sola modalidad de examen), el subtotal documentado sería S/. 1,382.50. No incluye ' +
      'pensión mensual, prácticas, carnet ni otros conceptos que no figuran en el TUPA. Consulta el monto exacto ' +
      'en Tesorería.',
    fuentes: [FUENTE_TUPA],
    sugerencias: ['¿Cuáles son las tarifas del TUPA?', '¿Qué requisitos tiene la titulación?', '¿Cómo radico un trámite?'],
    enlaces: [{ etiqueta: 'Ver el TUPA en la Mesa de Partes', ruta: '/tramite' }],
  },
  {
    id: 'tarifas',
    intencion: 'tarifas',
    palabrasClave: ['tarifa', 'tarifas', 'costo', 'coste', 'precio', 'cuanto cuesta', 'cuanto vale', 'pago', 'uit', 'tesoreria', 'derecho'],
    respuesta:
      'Los derechos del TUPA 2026 se pagan en Tesorería. La UIT de referencia es S/. 5,500.00 y varios conceptos se ' +
      'expresan como porcentaje de ella. Ejemplos: FUT S/. 4.00; Certificado de estudios superiores S/. 124.00; ' +
      'Expedición de título S/. 105.00; Constancia de egresado S/. 31.00; Matrículas S/. 200.00; Admisión 2026 ' +
      'S/. 250.00; Guías del postulante S/. 50.00; Ingreso de admisión para titulados S/. 500.00. Los códigos ACA son ' +
      'identificadores internos del catálogo, no códigos oficiales del TUPA. Consulta el monto exacto en el TUPA 2026.',
    fuentes: [FUENTE_TUPA],
    sugerencias: ['¿Cuáles son los requisitos de un trámite?', '¿Cómo radico un trámite?', '¿Cuáles son los feriados?'],
    enlaces: [{ etiqueta: 'Ver el TUPA en la Mesa de Partes', ruta: '/tramite' }],
  },
  {
    id: 'datos_personales',
    intencion: 'datos_personales',
    palabrasClave: ['datos personales', 'privacidad', 'ley 29733', 'mis datos', 'proteccion de datos', 'informacion personal', 'consentimiento'],
    respuesta:
      'El SIGD trata tus datos conforme a la Ley N° 29733 y su Reglamento (D.S. N° 003-2013-JUS). El consentimiento ' +
      'se otorga con una casilla desmarcada por defecto y el registro crea tu Casilla Electrónica. Puedes ejercer tus ' +
      'derechos ARCO en la Mesa de Partes o escribiendo a datos.personales@iestpsuiza.edu.pe. El asistente no guarda ' +
      'el texto de tu consulta: registra solo hashes SHA-256 para auditoría.',
    fuentes: [FUENTE_LPDP],
    sugerencias: ['¿Qué es la casilla electrónica?', '¿Cómo valido un documento firmado?', '¿Cuál es el horario de atención?'],
    enlaces: [
      { etiqueta: 'Registro Ciudadano', ruta: '/registro' },
      { etiqueta: 'Casilla Electrónica', ruta: '/casilla' },
      { etiqueta: 'Mesa de Partes Virtual', ruta: '/tramite' },
    ],
  },
  {
    id: 'ayuda_general',
    intencion: 'ayuda_general',
    palabrasClave: ['ayuda', 'help', 'que puedes', 'opciones', 'menu', 'asistencia', 'soporte', 'no se', 'dudas'],
    respuesta:
      'Estos son los temas en los que puedo orientarte: qué es la web y cómo usarla, módulos y enlaces, sede y cómo ' +
      'llegar, TUPA y requisitos, tarifas, horario y corte de las 16:30 hrs, plazos legales (30 días hábiles), ' +
      'radicación, seguimiento por CUT, casilla electrónica, firma digital, validación CVD y feriados de Ucayali. ' +
      'Escribe tu consulta con palabras clave del trámite.',
    fuentes: [FUENTE_TUPA, FUENTE_LPAG, FUENTE_INSTITUCIONAL],
    sugerencias: SUGERENCIAS_INICIALES,
    enlaces: [
      { etiqueta: 'Ver módulos de la web', ruta: '/' },
      { etiqueta: 'Mesa de Partes Virtual', ruta: '/tramite' },
      { etiqueta: 'Consultar el estado de mi trámite', ruta: '/consulta' },
      { etiqueta: 'Casilla Electrónica', ruta: '/casilla' },
      { etiqueta: 'Validador CVD', ruta: '/validador-cvd' },
    ],
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
