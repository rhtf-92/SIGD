import {
  ACLARACION, ACCESO, ADJUNTOS, BIENVENIDA, DERIVACION, ESTADOS,
  FUERA_DE_AMBITO, GUIAS, OBSERVACION, PRIVACIDAD, SIN_INFORMACION,
  type RespuestaOrientacion,
} from './conocimiento';

export function normalizarPregunta(texto: string): string {
  return texto.normalize('NFKD').replace(/[\u0300-\u036f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export type Intencion = 'menu' | 'catalogo' | 'presentar' | 'consulta' | 'casilla' | 'cvd'
  | 'adjuntos' | 'derivado' | 'observado' | 'estados' | 'acceso'
  | 'rechazo' | 'ambiguo' | 'noDisponible' | 'privacidad';

/** Lista cerrada de intenciones: no hay generación libre ni ejecución de instrucciones. */
export function identificarIntencion(texto: string): Intencion {
  const t = normalizarPregunta(texto);
  if (/\d(?:[\s.-]*\d){6,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|eyJ[a-zA-Z0-9_-]+\.|bearer\s+\S+|(?:contrase[ñn]a|password|token|pin|clave de acceso)\s*(?:es\s+|[:=]\s*)\S+/i.test(texto)
    || /\b(mi contrasena es|mi clave es|mi pin es|mi token es|mi codigo de acceso es)\b/.test(t)) return 'privacidad';
  if (!t || t.length > 600) return 'ambiguo';
  // La protección se evalúa ANTES de buscar palabras institucionales.
  if (/(ignora|omite|elude|salta|desactiva|olvida|cambia|ignore|override).*(instruccion|restriccion|regla|configuracion|seguridad|instruction|rule)|actua como|chatgpt|system prompt|revela.*(prompt|secreto)|responde (cualquier|todo)|jailbreak/.test(t)) return 'rechazo';
  if (/\b(futbol|partido|politica|presidente|elecciones|noticias|deporte|pelicula|chiste|horoscopo|novia|pareja|receta|diagnostico|medicamento|matematica|ecuacion|programacion|javascript|python|sql|bitcoin|inversion|tarea escolar|capital de|historia universal)\b/.test(t)) return 'rechazo';
  if (/(muestra|consulta|descarga|accede|dame|ver|lista).*(ajeno|terceros|otra persona|otro ciudadano|otros expedientes|todos los expedientes|bandeja interna)|\b(aprueba|rechaza|firma|deriva|borra|elimina|modifica|archiva)\b.*\b(solicitud|expediente|documento|resolucion)|\b(privilegios|administrador|superadmin|funciones internas|base de datos)\b/.test(t)) return 'rechazo';
  if (/^(hola|buenos dias|buenas tardes|buenas noches|ayuda|menu|inicio|gracias)$/.test(t)) return 'menu';
  if (/\b(sigd|suiza|institucional|tramite|solicitud|expediente|casilla|cvd|mesa de partes)\b/.test(t)
    && /\b(horario|telefono|direccion|correo|apelacion|urgente|porque|motivo)\b/.test(t)) return 'noDisponible';
  if (/\b(cvd|codigo de verificacion|verificaci[o]?n digital)\b/.test(t)
    || /\b(verificar|verifico|verifica|validar|valido|autenticidad|integridad)\b.*\b(documento|resolucion|firma|pdf)\b/.test(t)) return 'cvd';
  if (/\b(casilla|notificacion|notificaciones|acuse|acuses)\b/.test(t)) {
    if (/\b(acceder|acceso|ingresar|entrar|error|problema|contrasena|clave)\b/.test(t) && /\b(no|error|problema|olvide|recuperar|olvidado)\b/.test(t)) return 'acceso';
    return 'casilla';
  }
  const expediente = /\b(expediente|expedientes|tramite|solicitud|cut|seguimiento)\b/.test(t);
  if (expediente && /\b(derivado|derivada|derivacion)\b/.test(t)) return 'derivado';
  if (expediente && /\b(observado|observada|observacion|subsanar)\b/.test(t)) return 'observado';
  if (expediente && /\b(significa|significado|interpretar)\b/.test(t) && /\b(estado|registrado|recepcionado|resuelto|archivado)\b/.test(t)) return 'estados';
  if ((expediente && /\b(consultar|consulto|consulta|revisar|reviso|revis(o|ar)|seguir|ver|va|estado|responsable|seguimiento)\b/.test(t))
    || /codigo unico de tramite/.test(t)) return 'consulta';
  if (/\b(adjuntar|adjunto|adjuntos|subir|cargar|anexar|carga)\b/.test(t) && /\b(documento|documentos|archivo|archivos|pdf|solicitud|anexo|anexos)\b/.test(t)) return 'adjuntos';
  if (/\b(tupa|requisitos|requisito|certificado|constancia|convalidacion|reincorporacion|traslado)\b/.test(t)
    || (/\b(costo|costos|cuesta|tarifa|tasa|plazo|pago|documentos|procedimientos)\b/.test(t) && /\b(tramite|procedimiento|necesito|solicitud|presentar)\b/.test(t))) return 'catalogo';
  if (/\b(presentar|presento|registrar|registro|enviar|envio|ingresar|iniciar|hacer|tramitar)\b/.test(t)
    && /\b(solicitud|tramite|documento|expediente|mesa de partes)\b/.test(t)) return 'presentar';
  if (/\b(mesa de partes)\b/.test(t)) return 'presentar';
  if (/\b(sigd|suiza|institucional|tramite|solicitud|expediente)\b/.test(t)
    && /\b(horario|telefono|direccion|correo|atencion|apelacion|recurso|urgente|porque|motivo)\b/.test(t)) return 'noDisponible';
  if (/\b(documento|documentos|resolucion|tramite|expediente|solicitud|ayuda)\b/.test(t)) return 'ambiguo';
  return 'rechazo';
}

export function responderPregunta(texto: string): { intencion: Intencion; respuesta: RespuestaOrientacion } {
  const intencion = identificarIntencion(texto);
  const respuestas: Record<Intencion, RespuestaOrientacion> = {
    menu: BIENVENIDA, ...GUIAS, adjuntos: ADJUNTOS, derivado: DERIVACION,
    observado: OBSERVACION, estados: ESTADOS, acceso: ACCESO, rechazo: FUERA_DE_AMBITO,
    ambiguo: ACLARACION, noDisponible: SIN_INFORMACION, privacidad: PRIVACIDAD,
  };
  return { intencion, respuesta: respuestas[intencion] };
}
