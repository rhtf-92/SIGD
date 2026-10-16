/**
 * Configuración del asistente IA.
 * - Sin claves: funciona 100% local (motor NLU del hook).
 * - Con claves (opcional): usa un LLM compatible con OpenAI para preguntas
 *   que el motor local no resuelve con confianza.
 */
function leerEnv(nombre: string): string {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> }).env?.[nombre];
    return (v ?? "").trim();
  } catch {
    return "";
  }
}

export const asistenteConfig = {
  iaHabilitada: leerEnv("VITE_AI_ENABLED") === "true",
  endpoint: leerEnv("VITE_AI_ENDPOINT") || "https://api.openai.com/v1/chat/completions",
  apiKey: leerEnv("VITE_AI_API_KEY"),
  modelo: leerEnv("VITE_AI_MODEL") || "gpt-4o-mini",
} as const;

export function iaCloudDisponible(): boolean {
  return asistenteConfig.iaHabilitada && asistenteConfig.apiKey.length > 10;
}
