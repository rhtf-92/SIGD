// Orientación de uso, contrastada con AppRouter y las pantallas públicas.
// Los requisitos y tarifas se recuperan del catálogo vivo, nunca de este texto.
export type Tema = 'catalogo' | 'presentar' | 'consulta' | 'casilla' | 'cvd';
export interface EnlaceOrientacion { texto: string; ruta: '/tramite' | '/consulta' | '/casilla' | '/validador-cvd' }
export interface RespuestaOrientacion {
  texto: string;
  enlace?: EnlaceOrientacion;
  catalogo?: boolean;
  menu?: boolean;
}

export const OPCIONES: readonly { tema: Tema; texto: string }[] = [
  { tema: 'catalogo', texto: 'Información de trámites y requisitos' },
  { tema: 'presentar', texto: 'Presentar una solicitud' },
  { tema: 'consulta', texto: 'Consultar mi expediente' },
  { tema: 'casilla', texto: 'Casilla electrónica' },
  { tema: 'cvd', texto: 'Validar mi documento (CVD)' },
];

export const BIENVENIDA: RespuestaOrientacion = {
  texto: '¡Hola! Soy el asistente virtual del SIGD del IESTP Suiza.\n\nEstoy aquí para orientarte sobre los trámites y servicios de gestión documentaria.\n\n¿Sobre qué tema necesitas ayuda?\n\nSelecciona una opción para continuar',
  menu: true,
};
export const FUERA_DE_AMBITO: RespuestaOrientacion = {
  texto: 'Disculpa, soy el asistente virtual del SIGD del IESTP Suiza. Mi función es orientarte exclusivamente sobre los trámites, requisitos y servicios de gestión documentaria.\n\nPuedo ayudarte con:\n\n- Información de trámites y requisitos.\n- Presentación de solicitudes.\n- Consulta de expedientes.\n- Casilla electrónica.\n- Validación de documentos mediante CVD.\n\nSelecciona una opción del menú para continuar',
  menu: true,
};
export const SIN_INFORMACION: RespuestaOrientacion = {
  texto: 'Por el momento no cuento con información oficial suficiente para responder esa consulta.\n\nTe recomiendo comunicarte con el canal institucional de atención correspondiente',
  menu: true,
};
export const ACLARACION: RespuestaOrientacion = {
  texto: '¡Claro! Puedo ayudarte, pero necesito saber qué deseas realizar.\n\nPuedes preguntarme:\n\n- ¿Cómo consulto mi expediente?\n- ¿Cómo verifico una resolución?\n- ¿Cómo reviso una notificación?\n- ¿Cómo presento un documento?\n\nSelecciona la opción que corresponda a tu consulta',
  menu: true,
};
export const PRIVACIDAD: RespuestaOrientacion = {
  texto: 'No compartas contraseñas, códigos de acceso ni datos personales en este chat. No los guardaré en el historial. Soy un orientador: no consulto expedientes privados ni ejecuto acciones administrativas. Utiliza las pantallas institucionales para identificarte o consultar tu CUT.',
  menu: true,
};

export const GUIAS: Record<Tema, RespuestaOrientacion> = {
  catalogo: {
    texto: 'Consulta los procedimientos vigentes del catálogo formal. Selecciona uno para revisar la información publicada y sus documentos clasificados. Los conceptos informativos de Ventanilla no equivalen automáticamente a procedimientos radicables.',
    catalogo: true,
  },
  presentar: {
    texto: 'Para presentar una solicitud:\n\n1. Ingresa a Mesa de Partes Virtual.\n2. Selecciona el procedimiento vigente.\n3. Revisa sus requisitos.\n4. Completa los datos solicitados e identifícate cuando el sistema lo requiera.\n5. Adjunta y clasifica los documentos.\n6. Revisa la información y las declaraciones.\n7. Presenta la solicitud desde el formulario.\n8. Conserva el CUT y el cargo que el sistema entregue después de confirmar el registro.\n\nEste chat no presenta solicitudes ni genera expedientes.',
    enlace: { texto: 'Ir a Mesa de Partes Virtual', ruta: '/tramite' },
  },
  consulta: {
    texto: 'Para revisar cómo va tu trámite:\n\n1. Ingresa a Consulta de Trámite.\n2. Introduce el Código Único de Trámite (CUT) de tu cargo.\n3. Realiza la consulta.\n4. Revisa el estado y la información pública disponible.\n\nSolo la pantalla de consulta confirma el estado real. No consulto códigos desde el chat ni muestro datos privados. La unidad responsable se consulta únicamente si el módulo la informa.',
    enlace: { texto: 'Consultar mi expediente', ruta: '/consulta' },
  },
  casilla: {
    texto: 'Ingresa a tu Casilla Electrónica con tu cuenta en la pantalla institucional. Revisa el listado, los filtros y la fecha de depósito de tus notificaciones. Abre una comunicación para leer su detalle y descargar los documentos autorizados. La disponibilidad de constancias y acuses depende de que exista su referencia documental registrada.\n\nNunca compartas tu contraseña ni códigos de autenticación en este chat. No puedo abrir comunicaciones ni generar acuses por ti.',
    enlace: { texto: 'Ir a Casilla Electrónica', ruta: '/casilla' },
  },
  cvd: {
    texto: 'El Código de Verificación Digital (CVD) permite consultar la evidencia registrada de un documento.\n\n1. Abre el Validador CVD.\n2. Escribe el código tal como aparece en el documento.\n3. Verifica y revisa el resultado del sistema.\n\nSi el formato es inválido, revisa los caracteres. Si no se encuentra, comprueba el código y consulta al emisor. La integridad del archivo y la validez criptográfica de su firma son comprobaciones distintas: un hash coincidente no acredita por sí solo una firma digital auténtica. Este chat no valida ni declara firmado un documento.',
    enlace: { texto: 'Ir al Validador CVD', ruta: '/validador-cvd' },
  },
};

export const ADJUNTOS: RespuestaOrientacion = {
  texto: 'En el paso de documentos de Mesa de Partes Virtual, selecciona el procedimiento y revisa los requisitos publicados. El formulario admite archivos PDF de hasta 20 MB por archivo; adjúntalos y asigna su clasificación documental cuando corresponda. Espera a que termine la carga antes de continuar. La exigencia técnica de un PDF no sustituye los requisitos institucionales.\n\nNo envíes archivos ni datos personales por este chat.',
  enlace: GUIAS.presentar.enlace,
};
export const ESTADOS: RespuestaOrientacion = {
  texto: 'Un estado describe una etapa, no garantiza una aprobación:\n\n- Registrado: la solicitud fue registrada.\n- Recepcionado: se registró su recepción.\n- En calificación o revisión: está siendo evaluada.\n- Derivado: fue remitida a otra unidad para su atención.\n- Observado: existe una observación que debes revisar en la comunicación correspondiente.\n- Resuelto: se registró una decisión.\n- Archivado: se registró el cierre y archivo.\n\nConsulta tu CUT para conocer el estado real. No deduzcas plazos ni resultados a partir de esta orientación.',
  enlace: GUIAS.consulta.enlace,
};
export const DERIVACION: RespuestaOrientacion = {
  texto: 'Derivado significa que el expediente fue remitido a otra unidad para continuar su atención; no significa que haya sido aprobado. Revisa tu CUT en Consulta de Trámite y la información de seguimiento que publique el módulo.',
  enlace: GUIAS.consulta.enlace,
};
export const OBSERVACION: RespuestaOrientacion = {
  texto: 'Observado indica que se registró una observación. Revisa su comunicación en la Casilla Electrónica y sigue las indicaciones oficiales para subsanarla. No puedo determinar el documento faltante ni el plazo de tu caso desde el chat.',
  enlace: GUIAS.casilla.enlace,
};
export const ACCESO: RespuestaOrientacion = {
  texto: 'Si no puedes acceder a la Casilla Electrónica, revisa que estés utilizando tu cuenta en la pantalla institucional. Si persiste el error, comunícate con el canal institucional de atención correspondiente. No cuento con una dirección o teléfono oficial verificado para indicarte aquí. No solicito contraseñas ni puedo cambiarlas.',
  enlace: GUIAS.casilla.enlace,
};
