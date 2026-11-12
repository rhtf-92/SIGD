import { normalizarTexto, textoCoincideBusqueda } from "./normalizarTexto";
import { tupaApi, type TupaTramite } from "./tupaApi";
import { buscarConocimiento, type ConocimientoEntrada } from "./conocimiento";
import baseJson from "../data/conocimiento/base.json";

const basePorDefecto: ConocimientoEntrada[] = baseJson;

export type AssistantIntent = "casilla" | "expediente" | "registro" | "buscar" | "desconocida";

export type AssistantOutcome =
  | { tipo: "ruta"; ruta: string; mensaje: string }
  | { tipo: "resultados"; tramites: TupaTramite[] }
  | { tipo: "desconocida"; mensaje: string }
  | { tipo: "conocimiento"; respuestas: { texto: string; fuente: string; validado: boolean }[] };

const palabrasIgnoradas = new Set([
  "busca", "buscar", "tramite", "tramites", "tupa", "por", "favor", "quiero",
  "quisiera", "saber", "cuanto", "cuesta", "costo", "precio", "del", "de",
  "la", "el", "un", "una", "mi", "que", "para", "informacion", "sobre",
  "duplicado", "duplicada", "necesito",
]);

function tramiteCoincideConsulta(tramite: TupaTramite, consulta: string): boolean {
  return [tramite.codigo, tramite.denominacion, tramite.rubro, tramite.descripcion ?? ""]
    .some((campo) => textoCoincideBusqueda(campo, consulta));
}

export function detectarIntencion(texto: string): AssistantIntent {
  const normalizado = normalizarTexto(texto);
  if (/\b(casilla|notificacion|notificaciones)\b/.test(normalizado)) return "casilla";
  if (/\b(expediente|cut|seguimiento)\b/.test(normalizado)) return "expediente";
  if (/\b(registro|registrarme|registrar|cuenta)\b/.test(normalizado)) return "registro";
  if (/\b(buscar|busca|tramite|tramites|tupa|cuesta|costo|precio|duplicado|titulo|certificado)\b/.test(normalizado)) {
    return "buscar";
  }
  return "desconocida";
}

export function extraerPalabrasClave(texto: string): string {
  return texto
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((palabra) => normalizarTexto(palabra))
    .filter((palabra) => palabra && !palabrasIgnoradas.has(palabra))
    .join(" ")
    .trim();
}

function formatoFuente(fuente: { documento: string; seccion?: string; fecha?: string }): string {
  const partes = [fuente.documento];
  if (fuente.seccion) partes.push(fuente.seccion);
  if (fuente.fecha) partes.push(fuente.fecha);
  return partes.join(", ");
}

export async function resolverConsultaAsistente(
  texto: string,
  listar: typeof tupaApi.listarVigente = tupaApi.listarVigente,
  base: ConocimientoEntrada[] = basePorDefecto,
): Promise<AssistantOutcome> {
  const coincidencias = buscarConocimiento(texto, base);
  if (coincidencias.length > 0) {
    return {
      tipo: "conocimiento",
      respuestas: coincidencias.slice(0, 2).map((c) => ({
        texto: c.entrada.respuesta,
        fuente: formatoFuente(c.entrada.fuente),
        validado: c.entrada.validado,
      })),
    };
  }

  const intencion = detectarIntencion(texto);
  if (intencion === "casilla") {
    return { tipo: "ruta", ruta: "/casilla", mensaje: "Tu Casilla Electrónica está protegida. Si no tienes sesión, el sistema te llevará al inicio de sesión." };
  }
  if (intencion === "expediente") {
    return { tipo: "ruta", ruta: "/consulta", mensaje: "Puedes consultar el estado desde la página pública de consulta de expediente. El asistente no solicita ni recibe tu CUT." };
  }
  if (intencion === "registro") {
    return { tipo: "ruta", ruta: "/registro", mensaje: "El registro ciudadano está disponible en la página de registro." };
  }
  if (intencion === "desconocida") {
    return {
      tipo: "desconocida",
      mensaje: "No entendí la consulta. Puedo buscar trámites del TUPA o llevarte a Registro, Consulta de expediente o Casilla.",
    };
  }

  const q = extraerPalabrasClave(texto);
  if (!q) {
    return { tipo: "desconocida", mensaje: "Escribe palabras del nombre o código del trámite que buscas." };
  }
  const respuesta = await listar({ q, rubro: "", pagina: 1 });
  let tramites = respuesta.tramites;
  if (tramites.length === 0) {
    const amplia = await listar({ q: "", rubro: "", pagina: 1 });
    tramites = amplia.tramites.filter((tramite) => tramiteCoincideConsulta(tramite, q));
  }
  return { tipo: "resultados", tramites: tramites.slice(0, 5) };
}

export function detalleAsistente(tramite: TupaTramite): string {
  const requisitos = tramite.requisitos.length
    ? tramite.requisitos.map((requisito) => `${requisito.orden}. ${requisito.texto}`).join("\n")
    : "No figuran requisitos.";
  const derecho = tramite.derecho_monto !== null
    ? `S/ ${Number(tramite.derecho_monto).toFixed(2)}`
    : tramite.derecho_texto || "No especificado";
  const validacion = tramite.observaciones?.includes("[VALIDAR]")
    ? "\nPendiente de validación por la dirección."
    : "";

  return [
    tramite.denominacion,
    `Derecho de tramitación: ${derecho}${tramite.derecho_porcentaje_uit != null ? ` (${tramite.derecho_porcentaje_uit} % UIT)` : ""}`,
    `Requisitos:\n${requisitos}`,
    `Plazo: ${tramite.plazo_texto || "No especificado"}`,
    `Silencio administrativo: ${tramite.silencio_administrativo || "No especificado"}`,
    `Autoridad que resuelve: ${tramite.autoridad_resuelve || "No especificada"}`,
    validacion,
  ].filter(Boolean).join("\n");
}
