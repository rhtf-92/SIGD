export interface EnlaceAyuda {
  etiqueta: string;
  ruta: string;
}

export interface EntradaConocimiento {
  id: string;
  titulo: string;
  /** Palabras y frases clave (pueden escribirse con tildes, se normalizan solas). */
  palabrasClave: string[];
  /** Preguntas naturales de ejemplo */
  ejemplos: string[];
  respuesta: string;
  enlaces?: EnlaceAyuda[];
  /** Respuesta corta de seguimiento cuando el usuario dice “¿y eso dónde queda?” */
  seguimiento?: string;
}

export interface AccionPagina {
  tipo: "navegar" | "logout" | "scroll-arriba" | "inicio";
  ruta?: string;
  etiquetaDestino?: string;
}

export const RESPUESTA_POR_DEFECTO =
  "Gracias por su consulta. No he logrado identificar con precisión el tema de su solicitud. Puedo asistirle con trámites y TUPA, consulta de CUT, Casilla Electrónica, validación CVD, registro y acceso, titulación, resoluciones, administración o reportes. ¿Podría reformular su pregunta con mayor detalle?";

export const SUGERENCIAS_INICIALES: string[] = [
  "Llévame a Mesa de Partes Virtual",
  "¿Dónde consulto mis notificaciones?",
  "Perdí mi CUT, ¿cómo lo recupero?",
  "¿Cómo valido un documento por CVD?",
  "No puedo acceder a mi cuenta",
  "Soy estudiante y deseo titularme",
];

/** Destinos oficiales de la plataforma (manipulación de página por el asistente). */
export const RUTAS_MODULOS: { ruta: string; etiqueta: string; claves: string[] }[] = [
  { ruta: "/tramite", etiqueta: "Mesa de Partes Virtual", claves: ["mesa de partes", "mesa virtual", "tramite", "tupa", "solicitud", "radicar", "fut"] },
  { ruta: "/tramite/ventanilla-presencial", etiqueta: "Ventanilla Presencial", claves: ["ventanilla", "presencial", "oficina", "foliado"] },
  { ruta: "/casilla", etiqueta: "Casilla Electrónica", claves: ["casilla", "notificacion", "buzon", "bandeja", "aviso", "resolucion me llego"] },
  { ruta: "/consulta", etiqueta: "Consulta Pública", claves: ["consulta", "cut", "seguimiento", "estado de mi tramite", "rastrear"] },
  { ruta: "/validador-cvd", etiqueta: "Validador CVD", claves: ["validador", "cvd", "validar", "verificar", "autenticidad", "qr", "codigo de verificacion"] },
  { ruta: "/expedientes", etiqueta: "Bandeja de Expedientes", claves: ["expediente", "bandeja de expedientes", "trazabilidad", "derivar", "providencia"] },
  { ruta: "/flujo-validez-legal", etiqueta: "Flujo y Validez Legal", claves: ["validez legal", "firma", "firmar", "visar", "refirma", "flujo"] },
  { ruta: "/flujo-validez-legal/firma", etiqueta: "Pasarela de Firma", claves: ["pasarela de firma", "firmar documento", "sala de firma"] },
  { ruta: "/flujos/titulacion", etiqueta: "Workflow de Titulación", claves: ["titulacion", "tesis", "titulo", "bachiller", "actuados", "proyecto"] },
  { ruta: "/flujos/proyector-resoluciones", etiqueta: "Proyector de Resoluciones", claves: ["proyector", "resolucion", "correlativo", "directoral", "rd"] },
  { ruta: "/administracion", etiqueta: "Panel de Administración", claves: ["administracion", "usuarios", "roles", "permisos", "auditoria", "tablas maestras", "calendario"] },
  { ruta: "/reportes/dashboard", etiqueta: "Reportes y Tablero", claves: ["reporte", "tablero", "dashboard", "indicador", "estadistica"] },
  { ruta: "/registro", etiqueta: "Registro Ciudadano", claves: ["registro", "crear cuenta", "registrarme", "dni", "ruc"] },
  { ruta: "/login", etiqueta: "Inicio de Sesión", claves: ["ingresar", "iniciar sesion", "entrar", "acceder", "login"] },
  { ruta: "/", etiqueta: "Página Principal", claves: ["inicio", "principal", "home", "portada"] },
];

/** Sinónimos → término canónico. Permite entender lenguaje natural. */
export const SINONIMOS: Record<string, string> = {
  tramites: "tramite",
  solicitud: "tramite",
  solicitudes: "tramite",
  gestion: "tramite",
  expediente: "expediente",
  expedientes: "expediente",
  mesadepartes: "mesa",
  notificaciones: "notificacion",
  aviso: "notificacion",
  avisos: "notificacion",
  buzon: "casilla",
  buzón: "casilla",
  correo: "casilla",
  bandeja: "casilla",
  verificar: "validar",
  validar: "validar",
  autentico: "autentico",
  verdadero: "autentico",
  falso: "autentico",
  qr: "cvd",
  codigo: "cvd",
  logearme: "entrar",
  loguearme: "entrar",
  ingresar: "entrar",
  acceder: "entrar",
  acceso: "entrar",
  clave: "contrasena",
  password: "contrasena",
  cuenta: "registro",
  registrarme: "registro",
  inscribirme: "registro",
  crearcuenta: "registro",
  firmar: "firma",
  firmado: "firma",
  visar: "firma",
  refrendar: "firma",
  tesis: "titulacion",
  titularme: "titulacion",
  titulo: "titulacion",
  bachiller: "titulacion",
  proyecto: "titulacion",
  resoluciones: "resolucion",
  rd: "resolucion",
  directoral: "resolucion",
  alumno: "estudiante",
  alumnos: "estudiante",
  profesor: "docente",
  profesores: "docente",
  donde: "donde",
  ubicación: "donde",
  ubicacion: "donde",
  encontrar: "donde",
  ver: "donde",
  consultar: "consultar",
  revisar: "consultar",
  seguimiento: "consultar",
  rastrear: "consultar",
  estado: "consultar",
  presentar: "presentar",
  iniciar: "presentar",
  hacer: "presentar",
  subir: "presentar",
  enviar: "presentar",
  llevame: "llevar",
  llévame: "llevar",
  abreme: "abrir",
  abre: "abrir",
  dirigeme: "llevar",
  muestrame: "mostrar",
  error: "problema",
  falla: "problema",
  nologra: "problema",
  denegado: "denegado",
  bloqueado: "denegado",
  olvide: "olvido",
  perdi: "olvido",
  extravie: "olvido",
  precio: "costo",
  precios: "costo",
  tarifa: "costo",
  tarifas: "costo",
  cuesta: "costo",
  costar: "costo",
  pagar: "pago",
  pagos: "pago",
  observacion: "observado",
  observaciones: "observado",
  subsanar: "observado",
  demora: "plazo",
  demoran: "plazo",
  archivo: "pdf",
  adjuntar: "pdf",
  documento: "pdf",
};

/** Palabras que no aportan significado y se ignoran al puntuar. */
export const PALABRAS_VACIAS = new Set([
  "que", "qué", "de", "la", "el", "en", "y", "a", "los", "las", "un", "una",
  "unos", "unas", "por", "para", "con", "mi", "mis", "me", "se", "es", "son",
  "esta", "está", "estan", "están", "este", "esto", "esta", "como", "cómo",
  "donde", "dónde", "cuando", "cuándo", "cual", "cuál", "quiero", "quisiera",
  "necesito", "puedes", "puedo", "puede", "podrias", "podrías", "hacer",
  "hago", "tengo", "tiene", "hay", "del", "al", "lo", "le", "les", "the",
  "to", "porque", "porqué", "usted", "tu", "ustedes", "sobre", "respecto",
  "tema", "algo", "eso", "esta", "otra", "otro", "favor",
]);
// NOTA: "gracias" NO es palabra vacía: constituye la intención de
// agradecimiento (tema "gracias") y debe conservarse para su detección.

export const BASE_CONOCIMIENTO: EntradaConocimiento[] = [
  {
    id: "saludo",
    titulo: "Saludo institucional",
    palabrasClave: ["hola", "buenas", "buenos dias", "buenas tardes", "hey", "saludos", "buenos días"],
    ejemplos: ["hola", "buenas tardes", "buenos días, ¿me ayuda?", "hola, necesito orientación"],
    respuesta:
      "Buenos días. Soy JARVIS, el asistente institucional del Sistema Integral de Gestión Documentaria (SIGD) del IESTP “Suiza”. Será un placer asistirle con trámites, notificaciones, validación documental o acceso al sistema. ¿En qué puedo servirle el día de hoy?",
  },
  {
    id: "ayuda-general",
    titulo: "Alcance del asistente",
    palabrasClave: ["ayuda", "que puedes hacer", "que sabes", "opciones", "menu", "para que sirves", "quien eres", "funciones"],
    ejemplos: [
      "¿qué puede hacer usted por mí?",
      "¿en qué me puede asistir?",
      "¿quién es usted?",
      "no sé por dónde empezar",
      "necesito ayuda",
    ],
    respuesta:
      "Con todo gusto. Puedo orientarle de manera profesional sobre: (1) presentación de trámites en Mesa de Partes Virtual; (2) seguimiento de su expediente mediante el código CUT; (3) consulta de su Casilla Electrónica; (4) validación de autenticidad documental con código CVD; (5) registro y acceso a su cuenta; (6) titulación y resoluciones directorales; y (7) administración y reportes ejecutivos. Asimismo, puedo dirigirle directamente al módulo correspondiente si usted me lo solicita; por ejemplo: «llévame a mi casilla».",
    enlaces: [
      { etiqueta: "Mesa de Partes", ruta: "/tramite" },
      { etiqueta: "Consulta con CUT", ruta: "/consulta" },
      { etiqueta: "Validador CVD", ruta: "/validador-cvd" },
    ],
  },
  {
    id: "que-es-sigd",
    titulo: "Presentación del SIGD",
    palabrasClave: ["sigd", "sistema", "instituto", "suiza", "para que sirve", "que es esta pagina", "plataforma"],
    ejemplos: [
      "¿qué es el SIGD?",
      "¿para qué sirve esta plataforma?",
      "información del sistema",
      "¿qué es esto?",
    ],
    respuesta:
      "El SIGD es el Sistema Integral de Gestión Documentaria del Instituto de Educación Superior Tecnológico Público “Suiza” (Pucallpa, Ucayali). Constituye la plataforma oficial para la presentación de trámites, el seguimiento de expedientes con código CUT, la notificación electrónica con plena validez legal y la verificación pública de documentos mediante código CVD, en concordancia con el TUO de la Ley N.º 27444 y la Ley N.º 27269 de Firmas y Certificados Digitales.",
    enlaces: [
      { etiqueta: "Ir al inicio", ruta: "/" },
      { etiqueta: "Mesa de Partes Virtual", ruta: "/tramite" },
    ],
  },
  {
    id: "mesa-partes-virtual",
    titulo: "Presentación de trámites",
    palabrasClave: [
      "mesa de partes", "tramite", "tupa", "presentar", "solicitar",
      "requisito", "anexo", "radicar", "pdf", "fut",
    ],
    ejemplos: [
      "¿cómo presento un trámite?",
      "deseo ingresar una solicitud",
      "¿dónde adjunto mis documentos?",
      "necesito iniciar un trámite TUPA",
      "¿cuáles son los requisitos de mi trámite?",
    ],
    respuesta:
      "Será un placer guiarle. El procedimiento formal es el siguiente: (1) acceda al módulo Mesa de Partes Virtual; (2) seleccione el procedimiento TUPA correspondiente; (3) complete sus datos personales y adjunte los requisitos en formato PDF; (4) remita su solicitud y conserve el código CUT asignado. Dicho código le permitirá efectuar el seguimiento en el módulo Consulta Pública. Si usted lo desea, puedo dirigirle ahora mismo a dicho módulo.",
    enlaces: [
      { etiqueta: "Mesa de Partes Virtual", ruta: "/tramite" },
      { etiqueta: "Consultar mi trámite", ruta: "/consulta" },
    ],
    seguimiento: "Se encuentra en el menú principal como «Mesa de Partes Virtual» (ruta /tramite). ¿Desea que le dirija allí?",
  },
  {
    id: "ventanilla-presencial",
    titulo: "Atención presencial",
    palabrasClave: ["ventanilla", "presencial", "oficina", "foliado", "atencion presencial", "horario"],
    ejemplos: [
      "¿brindan atención en oficina?",
      "deseo apersonarme presencialmente",
      "¿dónde se ubica ventanilla?",
    ],
    respuesta:
      "La Ventanilla Presencial brinda atención en oficina y está reservada al personal de Mesa de Partes y Dirección, quienes efectúan el foliado y la asignación del código CUT. Si usted es estudiante o administrado, le recomiendo utilizar la Mesa de Partes Virtual, disponible las 24 horas desde cualquier dispositivo.",
    enlaces: [{ etiqueta: "Ventanilla Presencial", ruta: "/tramite/ventanilla-presencial" }],
  },
  {
    id: "consulta-cut",
    titulo: "Seguimiento con CUT",
    palabrasClave: ["cut", "consulta", "seguimiento", "estado", "rastrear", "codigo de tramite"],
    ejemplos: [
      "¿dónde consulto mi trámite?",
      "¿cuál es el estado de mi expediente?",
      "deseo conocer el estado de mi solicitud",
      "¿dónde ingreso mi CUT?",
      "perdí mi CUT, ¿qué hago?",
      "no recuerdo mi código",
    ],
    respuesta:
      "Usted puede efectuar el seguimiento sin necesidad de iniciar sesión, a través del módulo Consulta Pública. Ingrese su código CUT (formato CUT-2026-000123) y el sistema le mostrará el estado: registrado, en revisión, observado o atendido. En caso de extravío del código, le sugiero revisar el correo electrónico con el cual presentó el trámite o apersonarse a Mesa de Partes con su DNI para la recuperación correspondiente.",
    enlaces: [{ etiqueta: "Consulta Pública", ruta: "/consulta" }],
    seguimiento: "Corresponde al módulo «Consulta Pública» (ruta /consulta). Únicamente requiere su código CUT.",
  },
  {
    id: "casilla-electronica",
    titulo: "Casilla Electrónica",
    palabrasClave: ["casilla", "notificacion", "buzon", "aviso", "resolucion me llego", "bandeja"],
    ejemplos: [
      "¿dónde consulto mis notificaciones?",
      "¿dónde recibo los avisos?",
      "no encuentro mi resolución",
      "¿qué es la casilla electrónica?",
      "me indicaron que fui notificado, ¿dónde lo verifico?",
    ],
    respuesta:
      "Su Casilla Electrónica constituye su domicilio digital oficial con plena validez legal. Para consultarla, usted deberá iniciar sesión según su rol. En ella recibirá resoluciones, proveídos y comunicaciones del Instituto. La notificación surte efectos desde su depósito, por lo cual le recomiendo revisarla periódicamente. Si me lo autoriza, puedo dirigirle a su casilla en este momento.",
    enlaces: [{ etiqueta: "Mi Casilla", ruta: "/casilla" }],
    seguimiento: "Acceda al módulo «Casilla Electrónica» (/casilla) con su sesión iniciada. ¿Desea que le dirija allí?",
  },
  {
    id: "validador-cvd",
    titulo: "Validación documental CVD",
    palabrasClave: ["cvd", "validar", "verificar", "autentico", "qr", "falso", "codigo de verificacion"],
    ejemplos: [
      "¿cómo verifico la autenticidad de mi documento?",
      "¿dónde valido mi certificado?",
      "poseo un código CVD, ¿qué debo hacer?",
      "¿cómo verifico mediante QR?",
      "deseo comprobar la autenticidad",
    ],
    respuesta:
      "El procedimiento es sencillo y no requiere cuenta de usuario: (1) acceda al módulo Validador CVD; (2) ingrese el código consignado en su documento PDF o escanee el código QR con su teléfono móvil. El sistema le confirmará la autenticidad, la identidad del firmante y si el documento ha sufrido alguna alteración.",
    enlaces: [{ etiqueta: "Validador CVD", ruta: "/validador-cvd" }],
    seguimiento: "Corresponde al módulo público «Validador CVD» (/validador-cvd). Tenga su código a la mano.",
  },
  {
    id: "firma-validez-legal",
    titulo: "Firma digital y validez legal",
    palabrasClave: ["firma", "firmar", "validez legal", "visor", "visar", "refirma"],
    ejemplos: [
      "¿cómo firmo un documento?",
      "¿dónde se efectúa la firma?",
      "necesito visar un documento",
      "¿qué es la validez legal?",
    ],
    respuesta:
      "La firma digital se efectúa en el módulo Flujo y Validez Legal, habilitado para los roles Director, Docente y Super Administrador. En dicho módulo usted podrá firmar, re-firmar y visualizar el documento con su código CVD. Cada documento firmado genera un código verificable públicamente en el Validador institucional.",
    enlaces: [
      { etiqueta: "Flujo y Validez Legal", ruta: "/flujo-validez-legal" },
      { etiqueta: "Firmar documento", ruta: "/flujo-validez-legal/firma" },
    ],
  },
  {
    id: "expedientes",
    titulo: "Bandeja de Expedientes",
    palabrasClave: ["expediente", "trazabilidad", "providencia", "derivar", "folio", "atender"],
    ejemplos: [
      "¿dónde gestiono expedientes?",
      "¿cómo derivo un expediente?",
      "¿dónde consulto la trazabilidad?",
      "deseo agregar una providencia",
    ],
    respuesta:
      "La Bandeja de Expedientes está destinada al personal interno autorizado. En ella usted podrá consultar la trazabilidad integral, registrar providencias, efectuar el foliado, derivar y atender expedientes. Si usted es estudiante, le corresponde efectuar el seguimiento de su caso mediante la Consulta Pública con su código CUT.",
    enlaces: [
      { etiqueta: "Bandeja de Expedientes", ruta: "/expedientes" },
      { etiqueta: "Consulta Pública", ruta: "/consulta" },
    ],
  },
  {
    id: "titulacion",
    titulo: "Proceso de titulación",
    palabrasClave: ["titulacion", "tesis", "bachiller", "actuados", "academico", "titulo"],
    ejemplos: [
      "deseo titularme, ¿cuál es el procedimiento?",
      "¿cómo presento mi tesis?",
      "¿dónde remito mi proyecto de titulación?",
      "requiero mi título profesional",
    ],
    respuesta:
      "Si usted es estudiante y desea obtener su título, deberá presentar su solicitud mediante la Mesa de Partes Virtual adjuntando los requisitos académicos. El jurado evaluador y los docentes revisarán su proyecto en el Workflow de Titulación y efectuarán la derivación de sus actuados. Toda notificación será remitida a su Casilla Electrónica.",
    enlaces: [
      { etiqueta: "Workflow Titulación", ruta: "/flujos/titulacion" },
      { etiqueta: "Mesa de Partes", ruta: "/tramite" },
    ],
  },
  {
    id: "proyector-resoluciones",
    titulo: "Proyector de Resoluciones",
    palabrasClave: ["resolucion", "proyector", "correlativo", "directoral"],
    ejemplos: [
      "¿dónde redacto una resolución?",
      "¿cómo obtengo el correlativo?",
      "necesito proyectar una resolución directoral",
    ],
    respuesta:
      "El Proyector de Resoluciones es el módulo especializado para la redacción de proyectos de Resolución Directoral con correlativo automático. El flujo contempla las etapas de borrador, revisión y firma, para su posterior notificación a la Casilla del interesado.",
    enlaces: [{ etiqueta: "Proyector de Resoluciones", ruta: "/flujos/proyector-resoluciones" }],
  },
  {
    id: "registro-login",
    titulo: "Registro y acceso al sistema",
    palabrasClave: [
      "registro", "reniec", "sunat", "entrar", "contrasena", "dni",
      "ruc", "cuenta", "denegado", "olvido",
    ],
    ejemplos: [
      "no puedo acceder a mi cuenta",
      "¿cómo me registro?",
      "olvidé mi contraseña",
      "el sistema muestra acceso denegado",
      "no me permite ingresar",
      "¿cómo creo mi usuario con DNI?",
    ],
    respuesta:
      "Con gusto le asisto. (1) Si aún no posee cuenta, regístrese en el módulo Registro Ciudadano con su DNI o RUC (validado con RENIEC/SUNAT). (2) Posteriormente acceda mediante Inicio de Sesión: seleccione su rol institucional; el personal (Super Admin, Director, Docente, Mesa de Partes) ingresa con la clave institucional «123», mientras que el estudiante ingresa de forma directa. Si el sistema muestra «Acceso denegado», ello indica que su rol no posee facultad sobre dicho módulo, no un error de contraseña.",
    enlaces: [
      { etiqueta: "Registro Ciudadano", ruta: "/registro" },
      { etiqueta: "Iniciar sesión", ruta: "/login" },
    ],
    seguimiento: "El registro se efectúa en /registro y el ingreso en /login. ¿Desea que le dirija a alguno de ellos?",
  },
  {
    id: "roles-permisos",
    titulo: "Roles y facultades",
    palabrasClave: ["rol", "permiso", "director", "docente", "mesa_partes", "estudiante", "super_admin", "denegado", "modulo"],
    ejemplos: [
      "¿cuáles son las facultades de cada rol?",
      "soy estudiante, ¿qué puedo consultar?",
      "¿por qué no tengo acceso?",
      "¿qué funciones tiene el docente?",
    ],
    respuesta:
      "El sistema contempla cinco roles institucionales: ESTUDIANTE (sus trámites y casilla personal); MESA DE PARTES (recepción y gestión de expedientes); DOCENTE (expedientes, firma y titulación); DIRECTOR y SUPER ADMINISTRADOR (acceso integral, administración y reportes ejecutivos). Al iniciar sesión, cada usuario visualiza únicamente los módulos correspondientes a su rol, conforme a la matriz RBAC institucional.",
    enlaces: [
      { etiqueta: "Iniciar sesión", ruta: "/login" },
      { etiqueta: "Administración", ruta: "/administracion" },
    ],
  },
  {
    id: "administracion",
    titulo: "Administración del sistema",
    palabrasClave: ["administracion", "usuarios", "auditoria", "calendario", "tablas maestras"],
    ejemplos: [
      "¿dónde creo un usuario?",
      "necesito modificar un rol",
      "¿dónde consulto la auditoría?",
    ],
    respuesta:
      "El Panel de Administración, reservado a los roles Director y Super Administrador, permite la gestión de usuarios, la asignación de roles y permisos, la consulta de auditoría, las tablas maestras y el calendario laboral. Si usted requiere la creación de un usuario o una modificación de rol, le sugiero canalizarlo mediante el área de Administración.",
    enlaces: [{ etiqueta: "Administración", ruta: "/administracion" }],
  },
  {
    id: "reportes",
    titulo: "Reportes y tablero ejecutivo",
    palabrasClave: ["reporte", "tablero", "dashboard", "indicador", "estadistica"],
    ejemplos: [
      "¿dónde consulto las estadísticas?",
      "¿cuál es el estado de los expedientes?",
      "deseo ver el tablero ejecutivo",
    ],
    respuesta:
      "El módulo Reportes y Tablero de Control, habilitado para Director y Super Administrador, presenta los expedientes por estado, los tiempos de atención, los cuellos de botella y las tendencias de gestión, como soporte a la toma de decisiones institucionales.",
    enlaces: [{ etiqueta: "Reportes", ruta: "/reportes/dashboard" }],
  },
  {
    id: "gracias",
    titulo: "Agradecimiento",
    palabrasClave: ["gracias", "genial", "perfecto", "entendido", "claro", "excelente"],
    ejemplos: ["gracias", "muchas gracias", "excelente, entendido", "perfecto, gracias"],
    respuesta: "Ha sido un placer asistirle. Quedo a su entera disposición para cualquier consulta adicional sobre el SIGD. ¿Desea que le apoye en algún otro trámite?",
  },
  {
    id: "despedida",
    titulo: "Despedida institucional",
    palabrasClave: ["adios", "chao", "hasta luego", "nos vemos", "bye"],
    ejemplos: ["adiós", "hasta luego", "nos vemos", "gracias, hasta pronto"],
    respuesta: "Gracias por su visita. Quedo atento en la burbuja inferior derecha ante cualquier requerimiento. Le deseo éxito en sus gestiones institucionales.",
  },
  {
    id: "tupa-costos",
    titulo: "Costos y procedimientos TUPA 2026",
    palabrasClave: [
      "tupa", "costo", "precio", "cuanto cuesta", "cuánto cuesta", "tarifa", "pago",
      "uit", "tesoreria", "practicas", "certificado", "ingles", "cepretec", "matricula",
      "constancia", "titulo profesional", "duplicado",
    ],
    ejemplos: [
      "¿cuánto cuesta mi trámite?",
      "¿cuánto pago por prácticas?",
      "¿dónde pago mi trámite?",
      "¿cuánto cuesta el certificado?",
      "¿cuánto es la matrícula CEPRETEC?",
      "¿qué es el TUPA?",
    ],
    respuesta:
      "El TUPA 2026 del IESTP “Suiza” (UIT S/ 5,500) fija los costos oficiales. Referencias frecuentes: Prácticas Iniciales S/ 35, Intermedias S/ 45, Finales S/ 60; Certificado Modular o de Inglés S/ 100; Idiomas (4 meses, alumnos) S/ 300 y externos S/ 350; CEPRETEC matrícula S/ 400. Todo derecho se paga en Tesorería (Cta. Cte. Banco de la Nación 0512-039170) y el comprobante se adjunta en Mesa de Partes Virtual. El monto exacto depende del procedimiento elegido en el TUPA.",
    enlaces: [
      { etiqueta: "Mesa de Partes Virtual", ruta: "/tramite" },
      { etiqueta: "Consultar mi trámite", ruta: "/consulta" },
    ],
    seguimiento: "Los costos están en el TUPA 2026 y se pagan en Tesorería. Presente el comprobante por Mesa de Partes Virtual (/tramite).",
  },
  {
    id: "estados-tramite",
    titulo: "Estados del trámite y plazos",
    palabrasClave: [
      "estado", "observado", "plazo", "cuanto demora", "cuánto demora", "dias", "horas",
      "registrado", "revision", "atendido", "rechazado", "subsanar",
    ],
    ejemplos: [
      "¿qué significa observado?",
      "¿cuánto demora mi trámite?",
      "mi trámite está en revisión, ¿qué sigue?",
      "¿qué hago si me observan?",
      "¿cuáles son los estados?",
    ],
    respuesta:
      "Su trámite pasa por: registrado (ingresó bien) → en revisión (lo evalúa el área) → observado (falta algo: lea la observación en su Casilla o Consulta y subsane por Mesa de Partes) → atendido (finalizó, descargue el documento y valídelo con su CVD). Los plazos dependen del TUPA de cada procedimiento; si está “observado”, subsane cuanto antes para no retrasarlo.",
    enlaces: [
      { etiqueta: "Consulta Pública", ruta: "/consulta" },
      { etiqueta: "Mi Casilla", ruta: "/casilla" },
    ],
  },
  {
    id: "requisitos-pdf",
    titulo: "Requisitos y archivos PDF",
    palabrasClave: [
      "requisito", "pdf", "adjunto", "anexo", "archivo", "tamaño", "formato", "foto", "dni escaneado",
    ],
    ejemplos: [
      "¿en qué formato subo mis documentos?",
      "no me deja subir el PDF",
      "¿qué archivos necesito?",
      "¿cuánto debe pesar el archivo?",
    ],
    respuesta:
      "Adjunte sus requisitos en PDF legible (idealmente menor a 10 MB por archivo): DNI, comprobante de pago de Tesorería y los anexos del TUPA. Si el sistema rechaza el archivo, revise que sea PDF (no foto suelta ni Word), que no esté dañado y que el nombre no tenga símbolos raros. Luego envíe y guarde su CUT.",
    enlaces: [{ etiqueta: "Mesa de Partes Virtual", ruta: "/tramite" }],
  },
  {
    id: "ayuda-humana",
    titulo: "Ayuda humana y contacto",
    palabrasClave: ["persona", "humano", "telefono", "contacto", "oficina", "horario", "ayuda presencial", "quien me atiende"],
    ejemplos: [
      "¿puedo hablar con una persona?",
      "¿dónde los ubico?",
      "¿cuál es el horario de atención?",
      "necesito ayuda presencial",
    ],
    respuesta:
      "Por supuesto. Para atención humana acérquese a Mesa de Partes / Ventanilla del IESTP “Suiza” en Pucallpa con su DNI y su CUT si ya tiene trámite. Lleve sus documentos y comprobantes. Para consultas de sistema, también puede escribir por Mesa de Partes Virtual y le responderán a su Casilla Electrónica.",
    enlaces: [
      { etiqueta: "Mesa de Partes", ruta: "/tramite" },
      { etiqueta: "Consulta Pública", ruta: "/consulta" },
    ],
  },
];
