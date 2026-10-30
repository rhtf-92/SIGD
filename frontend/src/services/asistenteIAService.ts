import { BASE_CONOCIMIENTO, RUTAS_MODULOS } from "../data/asistenteConocimiento";
import { asistenteConfig, iaCloudDisponible } from "../config/asistenteConfig";

export interface ContextoIA {
  ruta: string;
  rol: string | null;
}

function construirPromptSistema(ctx: ContextoIA): string {
  const resumen = BASE_CONOCIMIENTO.map(
    (e) => `- ${e.titulo}: ${e.respuesta.slice(0, 220)}${e.enlaces?.length ? ` (ir: ${e.enlaces.map((l) => `${l.etiqueta} ${l.ruta}`).join(", ")})` : ""}`,
  ).join("\n");
  const rutas = RUTAS_MODULOS.map((m) => `${m.etiqueta} -> ${m.ruta}`).join(", ");
  return [
    "Eres SIGI, asistente institucional del SIGD del IESTP Suiza (Pucallpa).",
    "Respondes en español, tono formal y cálido, máximo 120 palabras.",
    "Solo orientas sobre la plataforma SIGD: trámites, CUT, casilla, CVD, registro, titulación, resoluciones, administración, reportes, TUPA 2026.",
    "Si piden ir a un módulo, indica la ruta exacta entre estos destinos:",
    rutas + ".",
    `Página actual del usuario: ${ctx.ruta || "/"}. Rol: ${ctx.rol ?? "sin sesión"}.`,
    "Base de conocimiento oficial:",
    resumen,
    "Si no sabes algo, dilo y sugiere reformular o acudir a Mesa de Partes con DNI.",
  ].join("\n");
}

interface MensajeLLM {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Intenta responder con el LLM en la nube. Devuelve null si no está
 * configurado, falla la red o el usuario cancela (AbortSignal).
 * Nunca lanza: el llamador siempre conserva el fallback local.
 */
export async function responderConIA(
  pregunta: string,
  historial: { rol: "usuario" | "asistente"; texto: string }[],
  ctx: ContextoIA,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!iaCloudDisponible()) return null;
  const mensajes: MensajeLLM[] = [
    { role: "system", content: construirPromptSistema(ctx) },
    ...historial.slice(-6).map((m) => ({
      role: (m.rol === "usuario" ? "user" : "assistant") as "user" | "assistant",
      content: m.texto.slice(0, 800),
    })),
    { role: "user", content: pregunta.slice(0, 1000) },
  ];
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 15000);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const resp = await fetch(asistenteConfig.endpoint, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${asistenteConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: asistenteConfig.modelo,
        messages: mensajes,
        temperature: 0.3,
        max_tokens: 400,
      }),
    });
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const texto = data.choices?.[0]?.message?.content?.trim();
    return texto ? texto.slice(0, 1500) : null;
  } catch {
    return null;
  }
}
