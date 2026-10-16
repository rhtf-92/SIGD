# Codigo de IA de frontend — JARVIS SIGD

Paquete extraído tal cual del frontend SIGD. Contiene SOLO el asistente IA con todas sus funciones.
Pásale esta carpeta completa a tu amigo.

## Contenido (5 archivos, copia exacta)

```
Codigo de ia de fronted/
├── README-INSTALACION.md
├── .env.example
├── src/
│   ├── components/asistente/AsistenteIA.tsx  → burbuja flotante + ventana chat + voz + feedback
│   ├── hooks/useAsistenteIA.ts               → cerebro: NLU local, navegación, memoria, historial
│   ├── services/asistenteIAService.ts         → puente a nube OpenAI-compatible (fallback seguro)
│   ├── config/asistenteConfig.ts             → lee VITE_AI_* y decide si hay nube
│   └── data/asistenteConocimiento.ts          → base de conocimiento, rutas, sinónimos, TUPA
└── ejemplo-integracion/
    ├── MainLayout.ejemplo.tsx                → cómo montarlo en tu layout
    └── App-minimo.ejemplo.tsx                 → app mínima solo con el chat
```

## Funciones incluidas

- Chat flotante 🤖 (abrir/cerrar, evento `sigd:abrir-ayuda`)
- Motor local 100% offline: normalización, sinónimos, radicalización, Levenshtein, Jaccard, CUT, seguimiento
- Navegación por voz/texto: "llévame a mi casilla", logout, scroll-arriba
- Ayuda contextual por ruta + sugerencias por página
- Historial en localStorage (`sigd_asistente_historial_v1`) + votos (`sigd_asistente_feedback_v1`)
- Voz con SpeechRecognition (`es-PE`) + hora de mensajes
- Nube opcional: si hay `VITE_AI_API_KEY`, usa LLM solo cuando el motor local no está seguro; si falla, vuelve a local sin romper

## Instalación en 3 pasos (para tu amigo)

1. Copiar los 5 archivos a su proyecto manteniendo la misma estructura `src/...`:
   - `src/components/asistente/AsistenteIA.tsx`
   - `src/hooks/useAsistenteIA.ts`
   - `src/services/asistenteIAService.ts`
   - `src/config/asistenteConfig.ts`
   - `src/data/asistenteConocimiento.ts`

2. Instalar dependencias (ya las usa el SIGD):
```bash
npm i react react-dom react-router-dom
npm i -D typescript @types/react @types/react-dom
# Tailwind es solo estilos, funciona sin él pero se ve mejor con él
```

3. Montarlo en su layout (ver `ejemplo-integracion/MainLayout.ejemplo.tsx`):
```tsx
import AsistenteIA from "./components/asistente/AsistenteIA";
export default function Layout({ children }) {
  return (<>{children}<AsistenteIA /></>);
}
```
Debe estar dentro de `<BrowserRouter>` porque el hook usa `useNavigate` / `useLocation`.

## Variables .env (opcional)

Sin esto funciona 100% local. Para nube:
```
VITE_AI_ENABLED=true
VITE_AI_ENDPOINT=https://api.openai.com/v1/chat/completions
VITE_AI_API_KEY=sk-...
VITE_AI_MODEL=gpt-4o-mini
```

## Adaptarlo a otro proyecto

- Cambia `RUTAS_MODULOS` y `BASE_CONOCIMIENTO` en `data/asistenteConocimiento.ts` por tus rutas/temas.
- Cambia textos "JARVIS / SIGD / IESTP Suiza" en `useAsistenteIA.ts` y `asistenteIAService.ts`.
- Si no quieres navegación automática, quita `ejecutarAccion(r.accion)`.

Origen: `frontend/src/...` del SIGD, extraído el 2026-10-16 sin modificaciones.
