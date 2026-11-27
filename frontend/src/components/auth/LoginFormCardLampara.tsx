/**
 * LoginFormCardLampara.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de Login SIGD con Lámpara Interactiva
 *
 * Características:
 *  - Lámpara SVG con cuerda/interruptor cliclable
 *  - 3 temas de color: Ámbar, Rosa, Verde Neón (+ estado apagado)
 *  - Efecto ambiental glow, blobs y grid de fondo
 *  - Sonido mediante Web Audio API (activable/desactivable)
 *  - Formulario con todos los campos del LoginFormCard original
 *  - Compatible con React + TailwindCSS v4
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User, Lock, Eye, EyeOff, LogIn, ExternalLink,
  AlertCircle, HelpCircle, X, ShieldAlert, ShieldCheck, Volume2, VolumeX,
} from "lucide-react";
import { permisosIniciales } from "../../hooks/useRbacConfig";
import { useAuthStore } from "../../stores/authStore";
import {
  autenticarCredenciales,
  sincronizarRolPorIdentificador,
  type RolCanonicoId,
} from "../../services/authService";
import { obtenerRutaInicialPorRol } from "../../utils/rutasPorRol";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

type TemaId = "off" | "amber" | "rose" | "green";

interface LampTheme {
  id: TemaId;
  label: string;
  vars?: Record<string, string>;
  bulbColor?: string;
  shineColor?: string;
  coneColor?: string;
  blobColors?: string[];
  armColor?: string;
  baseColor?: string;
  shadeColor?: string;
  cardTopBar?: string;
  knobBg?: string;
  lampDropShadow?: string;
  ropeColor?: string;
  accentHex?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMAS DE LÁMPARA
// ─────────────────────────────────────────────────────────────────────────────

const TEMAS: LampTheme[] = [
  { id: "off", label: "Apagada" },
  {
    id: "amber", label: "Luz Cálida ☀️",
    vars: {
      "--lamp-bg":     "#1a1200",
      "--lamp-card":   "#1f1a04",
      "--lamp-border": "rgba(255,183,50,0.22)",
      "--lamp-label":  "#c88a30",
      "--lamp-input":  "rgba(34,25,0,0.5)",
      "--lamp-text":   "#fdf0d5",
      "--lamp-glow":   "rgba(255,165,30,0.25)",
      "--lamp-accent": "#f59e0b",
      "--lamp-link":   "#fbbf24",
    },
    bulbColor: "rgba(255,200,50,0.9)",  shineColor: "rgba(255,240,180,0.95)",
    coneColor: "rgba(255,180,20,0.18)",
    blobColors: ["rgba(255,150,20,0.15)", "rgba(255,100,0,0.1)", "rgba(255,200,80,0.08)"],
    armColor: "#8b6914", baseColor: "#5a4010", shadeColor: "#8b5e1a",
    cardTopBar: "linear-gradient(90deg,#d97706,#fbbf24,#f59e0b)",
    knobBg: "radial-gradient(circle at 35% 35%,#fbbf24,#92400e)",
    lampDropShadow: "drop-shadow(0 0 12px rgba(255,200,50,0.8)) drop-shadow(0 0 4px rgba(255,240,180,0.9))",
    ropeColor: "#92400e", accentHex: "#f59e0b",
  },
  {
    id: "rose", label: "Luz Rosa 🌸",
    vars: {
      "--lamp-bg":     "#1a0012",
      "--lamp-card":   "#200016",
      "--lamp-border": "rgba(255,80,180,0.22)",
      "--lamp-label":  "#d946a8",
      "--lamp-input":  "rgba(42,0,25,0.5)",
      "--lamp-text":   "#ffe0f5",
      "--lamp-glow":   "rgba(236,72,153,0.28)",
      "--lamp-accent": "#ec4899",
      "--lamp-link":   "#f472b6",
    },
    bulbColor: "rgba(255,100,200,0.9)", shineColor: "rgba(255,200,240,0.95)",
    coneColor: "rgba(240,60,180,0.18)",
    blobColors: ["rgba(236,72,153,0.18)", "rgba(190,24,93,0.12)", "rgba(244,114,182,0.08)"],
    armColor: "#7e174a", baseColor: "#4a0d2e", shadeColor: "#7e1d50",
    cardTopBar: "linear-gradient(90deg,#db2777,#f472b6,#ec4899)",
    knobBg: "radial-gradient(circle at 35% 35%,#f472b6,#831843)",
    lampDropShadow: "drop-shadow(0 0 12px rgba(255,100,200,0.8)) drop-shadow(0 0 4px rgba(255,200,240,0.9))",
    ropeColor: "#831843", accentHex: "#ec4899",
  },
  {
    id: "green", label: "Luz Neón 💚",
    vars: {
      "--lamp-bg":     "#001209",
      "--lamp-card":   "#001a0d",
      "--lamp-border": "rgba(52,211,153,0.22)",
      "--lamp-label":  "#10b981",
      "--lamp-input":  "rgba(0,35,14,0.5)",
      "--lamp-text":   "#d1fae5",
      "--lamp-glow":   "rgba(52,211,153,0.28)",
      "--lamp-accent": "#34d399",
      "--lamp-link":   "#6ee7b7",
    },
    bulbColor: "rgba(50,220,150,0.9)", shineColor: "rgba(200,255,230,0.95)",
    coneColor: "rgba(30,200,130,0.18)",
    blobColors: ["rgba(52,211,153,0.15)", "rgba(16,185,129,0.10)", "rgba(110,231,183,0.08)"],
    armColor: "#065f46", baseColor: "#022c22", shadeColor: "#065f46",
    cardTopBar: "linear-gradient(90deg,#059669,#34d399,#10b981)",
    knobBg: "radial-gradient(circle at 35% 35%,#34d399,#022c22)",
    lampDropShadow: "drop-shadow(0 0 12px rgba(50,220,150,0.8)) drop-shadow(0 0 4px rgba(200,255,230,0.9))",
    ropeColor: "#022c22", accentHex: "#34d399",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const CLAVE_TOKEN        = "sigd_token";
const CLAVE_ROL          = "sigd_rol";
const CLAVE_PERMISOS     = "sigd_permisos";
const CLAVE_REMEMBER     = "sigd_remembered_user";

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: WEB AUDIO SOUND EFFECTS
// ─────────────────────────────────────────────────────────────────────────────

function useAudioEffects() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const getCtx = useCallback((): AudioContext | null => {
    if (!ctxRef.current) {
      try {
        ctxRef.current = new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch { return null; }
    }
    return ctxRef.current;
  }, []);

  const playClick = useCallback(() => {
    if (!soundOn) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const data   = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4);
      }
      const src    = ctx.createBufferSource();
      src.buffer   = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type            = "bandpass";
      filter.frequency.value = 1200;
      filter.Q.value         = 2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      src.stop(ctx.currentTime + 0.1);
    } catch {}
  }, [soundOn, getCtx]);

  const playHum = useCallback((themeId: TemaId) => {
    if (!soundOn || themeId === "off") return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const freqMap: Record<TemaId, number> = { off: 0, amber: 60, rose: 80, green: 100 };
      osc.frequency.value = freqMap[themeId];
      osc.type = "sine";
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, [soundOn, getCtx]);

  return { soundOn, setSoundOn, playClick, playHum };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE: LÁMPARA SVG
// ─────────────────────────────────────────────────────────────────────────────

interface LampSvgProps {
  tema: LampTheme;
  isSwinging: boolean;
  isKnobPulsing: boolean;
}

function LampSvgComponent({ tema, isSwinging, isKnobPulsing }: LampSvgProps) {
  const isOn  = tema.id !== "off";
  const armColor   = isOn ? tema.armColor!   : "#3a4155";
  const baseColor  = isOn ? tema.baseColor!  : "#2a2f3e";
  const shadeColor = isOn ? tema.shadeColor! : "#2a2f3e";
  const bulbFill   = isOn ? tema.bulbColor!  : "rgba(255,255,255,0.08)";
  const shineFill  = isOn ? tema.shineColor! : "rgba(255,255,255,0.00)";
  const coneFill   = isOn ? tema.coneColor!  : "rgba(255,255,255,0.00)";
  const knobBg     = isOn ? tema.knobBg!     : "radial-gradient(circle at 35% 35%,#718096,#2d3748)";
  const ropeBg     = isOn
    ? `linear-gradient(to bottom,${tema.ropeColor},${tema.armColor})`
    : "linear-gradient(to bottom,#4a5568,#2d3748)";
  const svgFilter  = isOn ? tema.lampDropShadow : "";

  return (
    <>
      {/* SVG Lámpara */}
      <svg
        viewBox="0 0 160 130"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{
          width: 160, height: 130, overflow: "visible",
          filter: svgFilter,
          transition: "filter 0.5s ease",
        }}
      >
        {/* Base y columna */}
        <ellipse style={{ fill: baseColor, transition: "fill 0.5s ease" }} cx="80" cy="122" rx="30" ry="6" />
        <rect   style={{ fill: baseColor, transition: "fill 0.5s ease" }} x="74" y="100" width="12" height="24" rx="4" />
        {/* Brazos articulados */}
        <line style={{ stroke: armColor, strokeWidth: 5, fill: "none", strokeLinecap: "round", transition: "stroke 0.5s ease" }} x1="80" y1="100" x2="70" y2="68" />
        <line style={{ stroke: armColor, strokeWidth: 5, fill: "none", strokeLinecap: "round", transition: "stroke 0.5s ease" }} x1="70" y1="68"  x2="88" y2="38" />
        {/* Junta */}
        <circle style={{ fill: baseColor, transition: "fill 0.5s ease" }} cx="70" cy="68" r="5" />
        <circle fill="#4a5568" cx="70" cy="68" r="3" />
        {/* Pantalla */}
        <path style={{ fill: shadeColor, transition: "fill 0.5s ease" }} d="M68 42 Q88 24 108 36 L102 52 Q88 42 74 52 Z" />
        <path style={{ fill: shadeColor, transition: "fill 0.5s ease" }} d="M86 36 L90 24 L94 36 Z" />
        {/* Bulbo */}
        <ellipse style={{ fill: bulbFill, transition: "fill 0.5s ease" }} cx="88" cy="46" rx="7" ry="6" />
        <ellipse style={{ fill: shineFill, transition: "fill 0.5s ease" }} cx="85" cy="43" rx="3" ry="2.5" />
        {/* Cono de luz */}
        <path
          style={{ fill: coneFill, opacity: isOn ? 0.35 : 0, transition: "fill 0.5s ease, opacity 0.5s ease" }}
          d="M74 52 Q88 54 102 52 L115 110 Q88 118 61 110 Z"
        />
      </svg>

      {/* Cuerda + Knob */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: -4 }} aria-hidden="true">
        <div
          style={{
            width: 2, height: 36,
            background: ropeBg,
            borderRadius: 1,
            transformOrigin: "top center",
            transition: "background 0.5s ease",
            animation: isSwinging ? "lampRopeSwing 0.5s cubic-bezier(0.4,0,0.2,1) forwards" : undefined,
          }}
        />
        <div
          style={{
            width: 14, height: 14, borderRadius: "50%",
            background: knobBg,
            border: "2px solid #4a5568",
            cursor: "pointer",
            transition: "background 0.5s ease, transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            animation: isKnobPulsing ? "lampKnobPulse 0.3s ease forwards" : undefined,
          }}
        />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginFormCardLamparaProps {
  /**
   * Modo empotrado: omite el wrapper de página completa, blobs fijos y grid.
   * Úsalo cuando el componente se integra en un layout existente (ej. LoginPage).
   * Cuando es `true`, el botón de sonido aparece dentro de la tarjeta.
   * Default: false (modo standalone/página completa).
   */
  embedded?: boolean;
  minimal?: boolean;
}

export default function LoginFormCardLampara({
  embedded = false,
  minimal = false,
}: LoginFormCardLamparaProps): React.JSX.Element {
  const navigate = useNavigate();

  /* ── Estados del formulario ── */
  const [identificador, setIdentificador] = useState<string>(() => {
    try { return window.localStorage.getItem(CLAVE_REMEMBER) ?? ""; } catch { return ""; }
  });
  const [password, setPassword]           = useState("");
  const [remember, setRemember]           = useState<boolean>(() => {
    try { return Boolean(window.localStorage.getItem(CLAVE_REMEMBER)); } catch { return false; }
  });
  const [showPassword, setShowPassword]   = useState(false);
  const [rol, setRol]                     = useState("SUPER_ADMIN");
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [errorMessage, setErrorMessage]   = useState<string | null>(null);
  const [sugerenciaRol, setSugerenciaRol] = useState<RolCanonicoId | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  /* ── Estados de la lámpara ── */
  const [temaIndex,      setTemaIndex]      = useState(0);
  const [isSwinging,     setIsSwinging]     = useState(false);
  const [isKnobPulsing,  setIsKnobPulsing]  = useState(false);
  const [showThemeLabel, setShowThemeLabel] = useState(false);

  /* ── Audio ── */
  const { soundOn, setSoundOn, playClick, playHum } = useAudioEffects();

  const tema = TEMAS[temaIndex];
  const isLampOn = tema.id !== "off";

  /* ── Inyectar keyframes globales (una vez) ── */
  useEffect(() => {
    const styleId = "lamp-keyframes";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id    = styleId;
      style.textContent = `
        @keyframes lampRopeSwing {
          0%   { transform: rotate(0deg); }
          20%  { transform: rotate(18deg); }
          45%  { transform: rotate(-10deg); }
          65%  { transform: rotate(6deg); }
          80%  { transform: rotate(-3deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes lampKnobPulse {
          0%   { transform: scale(1); }
          30%  { transform: scale(0.80); }
          70%  { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes lampCardEnter {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lampLampEnter {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  /* ── Clic en la lámpara ── */
  const handleLampClick = useCallback(() => {
    const nextIndex = (temaIndex + 1) % TEMAS.length;
    setTemaIndex(nextIndex);
    setIsSwinging(true);
    setIsKnobPulsing(true);
    playClick();
    if (nextIndex !== 0) setTimeout(() => playHum(TEMAS[nextIndex].id), 60);
    setTimeout(() => setIsSwinging(false),    520);
    setTimeout(() => setIsKnobPulsing(false), 350);
  }, [temaIndex, playClick, playHum]);

  /* ── Cambio identificador (detecta rol) ── */
  const handleIdentificadorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setIdentificador(val);
    if (errorMessage) { setErrorMessage(null); setSugerenciaRol(null); }
    const rolDetectado = sincronizarRolPorIdentificador(val);
    if (rolDetectado) setRol(rolDetectado);
  };

  /* ── Submit ── */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSugerenciaRol(null);
    const trimmed = identificador.trim();
    if (!trimmed) { setErrorMessage("Por favor, ingrese su usuario, DNI o correo institucional."); return; }
    if (!password) { setErrorMessage("Por favor, ingrese su contraseña de acceso."); return; }
    setIsSubmitting(true);
    try {
      const authResult = await autenticarCredenciales({ identificador: trimmed, password, rolSeleccionado: rol });
      if (!authResult.exito) {
        window.localStorage.removeItem(CLAVE_TOKEN);
        window.localStorage.removeItem("token");
        window.localStorage.removeItem(CLAVE_ROL);
        window.localStorage.removeItem(CLAVE_PERMISOS);
        window.localStorage.removeItem("sigd_usuario_nombre");
        window.localStorage.removeItem("sigd_usuario_correo");
        useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
        setErrorMessage(authResult.mensaje);
        if (authResult.sugerenciaRol) setSugerenciaRol(authResult.sugerenciaRol);
        return;
      }
      if (remember) window.localStorage.setItem(CLAVE_REMEMBER, trimmed);
      else          window.localStorage.removeItem(CLAVE_REMEMBER);
      window.localStorage.setItem(CLAVE_TOKEN,    authResult.token);
      window.localStorage.setItem("token",        authResult.token);
      window.localStorage.setItem(CLAVE_ROL,      authResult.usuario.rol);
      window.localStorage.setItem(CLAVE_PERMISOS, JSON.stringify(permisosIniciales));
      window.localStorage.setItem("sigd_usuario_nombre",  authResult.usuario.nombreCompleto);
      window.localStorage.setItem("sigd_usuario_correo",  authResult.usuario.correo);
      useAuthStore.setState({
        accessToken:  authResult.token,
        refreshToken: `sigd-refresh-${Date.now()}`,
        usuario: { id: authResult.usuario.id, nombreCompleto: authResult.usuario.nombreCompleto, correo: authResult.usuario.correo, rol: authResult.usuario.rol },
        isAuthenticated: true,
      });
      navigate(obtenerRutaInicialPorRol(authResult.usuario.rol), { replace: true });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Ocurrió un error al verificar sus credenciales. Intente nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Derivar colores del tema activo ── */
  const bgColor      = embedded ? "#ffffff" : (isLampOn ? (tema.vars?.["--lamp-bg"]     ?? "#101520") : "#101520");
  const cardColor    = embedded ? "#ffffff" : (isLampOn ? (tema.vars?.["--lamp-card"]   ?? "#141c2e") : "#141c2e");
  const borderColor  = embedded ? "#dbe3ec" : (isLampOn ? (tema.vars?.["--lamp-border"] ?? "rgba(255,255,255,0.06)") : "rgba(255,255,255,0.06)");
  const labelColor   = embedded ? "#64748b" : (isLampOn ? (tema.vars?.["--lamp-label"]  ?? "rgba(255,255,255,0.35)") : "rgba(255,255,255,0.35)");
  const inputBg      = embedded ? "#ffffff" : (isLampOn ? (tema.vars?.["--lamp-input"]  ?? "rgba(255,255,255,0.05)") : "rgba(255,255,255,0.05)");
  const textColor    = embedded ? "#0c2340" : (isLampOn ? (tema.vars?.["--lamp-text"]   ?? "rgba(255,255,255,0.80)") : "rgba(255,255,255,0.80)");
  const glowColor    = embedded ? "rgba(12,35,64,0.08)" : (isLampOn ? (tema.vars?.["--lamp-glow"]   ?? "transparent") : "transparent");
  const accentColor  = embedded ? "#0c2340" : (isLampOn ? (tema.vars?.["--lamp-accent"] ?? "#4a9eff") : "#4a9eff");
  const linkColor    = embedded ? "#0f3261" : (isLampOn ? (tema.vars?.["--lamp-link"]   ?? "#60a5fa") : "#60a5fa");
  const topBarBg     = isLampOn ? (tema.cardTopBar ?? "linear-gradient(90deg,#006EC7,#22d3ee,#38bdf8)") : "linear-gradient(90deg,#006EC7,#22d3ee,#38bdf8)";

  const transition = "all 0.7s cubic-bezier(0.4, 0, 0.2, 1)";

  /* ── Botón de sonido (compartido por ambos modos) ── */
  const soundButton = (
    <button
      type="button"
      onClick={() => setSoundOn(!soundOn)}
      aria-pressed={soundOn}
      aria-label={soundOn ? "Desactivar sonido" : "Activar sonido"}
      title={soundOn ? "Desactivar sonido" : "Activar sonido"}
      style={{
        width: 32, height: 32, borderRadius: "50%",
        border: `1px solid ${borderColor}`,
        background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)",
        color: labelColor, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.3s", flexShrink: 0,
      }}
    >
      {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
    </button>
  );

  /* ── RENDER: modo EMBEDDED ──────────────────────────────────────────────── */
  if (embedded) {
    return (
      <div style={{
        position: "relative",
        display: "flex", flexDirection: "column", alignItems: "center",
        fontFamily: "'Inter', system-ui, sans-serif",
        width: "100%",
      }}>
        {/* Blobs ambientales (absolute, recortados por overflow:hidden del section padre) */}
        {!minimal && isLampOn && tema.blobColors && (
          <>
            <div aria-hidden="true" style={{
              position: "absolute", top: -120, right: -80, width: 300, height: 300,
              borderRadius: "50%", filter: "blur(70px)", background: tema.blobColors[0],
              opacity: 0.6, pointerEvents: "none", zIndex: 0, transition,
            }} />
            <div aria-hidden="true" style={{
              position: "absolute", bottom: -80, left: -60, width: 240, height: 240,
              borderRadius: "50%", filter: "blur(70px)", background: tema.blobColors[1],
              opacity: 0.5, pointerEvents: "none", zIndex: 0, transition,
            }} />
          </>
        )}

        {/* Lámpara */}
        {!minimal && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Lámpara interactiva — haz clic para encender/apagar y cambiar el tema de color"
            onClick={handleLampClick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleLampClick(); } }}
            onMouseEnter={() => setShowThemeLabel(true)}
            onMouseLeave={() => setShowThemeLabel(false)}
            style={{
              position: "relative", cursor: "pointer", userSelect: "none",
              display: "flex", flexDirection: "column", alignItems: "center",
              marginBottom: -8, zIndex: 20, width: 180, height: 160,
              animation: "lampLampEnter 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both",
            }}
          >
            <div style={{
              position: "absolute", top: -28, left: "50%",
              transform: showThemeLabel ? "translateX(-50%) scale(1)" : "translateX(-50%) scale(0.85)",
              background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 4,
              whiteSpace: "nowrap", pointerEvents: "none", backdropFilter: "blur(4px)",
              opacity: showThemeLabel ? 1 : 0, transition: "opacity 0.2s, transform 0.2s",
            }} aria-hidden="true">
              {tema.label}
            </div>
            <LampSvgComponent tema={tema} isSwinging={isSwinging} isKnobPulsing={isKnobPulsing} />
          </div>
        )}

        {/* Tarjeta */}
        <section
          aria-labelledby="lamp-login-titulo"
          style={{
            width: "100%", position: "relative", zIndex: 10,
            background: minimal ? "transparent" : cardColor,
            border: minimal ? "none" : `1px solid ${borderColor}`,
            borderRadius: minimal ? 0 : 24,
            padding: minimal ? 0 : "32px 32px 28px",
            boxShadow: minimal ? "none" : `0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.5), 0 0 80px ${glowColor}`,
            transition,
            overflow: minimal ? "visible" : "hidden",
            animation: "lampCardEnter 0.6s cubic-bezier(0.2,0.75,0.25,1) 0.25s both",
          }}
        >
          {/* Barra superior decorativa */}
          {!minimal && <div aria-hidden="true" style={{
            position: "absolute", top: 0, left: 32, right: 32,
            height: 3, borderRadius: "0 0 6px 6px",
            background: topBarBg, transition,
          }} />}

          {/* Brillo interno ambiental */}
          {!minimal && <div aria-hidden="true" style={{
            position: "absolute", top: -60, right: -60, width: 200, height: 200,
            borderRadius: "50%", background: glowColor, opacity: 0.5, filter: "blur(50px)",
            pointerEvents: "none", transition,
          }} />}

          {/* Encabezado + botón sonido (modo embedded) */}
          <div style={{ marginBottom: 24, position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 id="lamp-login-titulo" style={{
                fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.025em",
                color: textColor, transition, lineHeight: 1.1,
              }}>
                Iniciar Sesión
              </h2>
              <p style={{ fontSize: "0.8rem", color: labelColor, marginTop: 6, lineHeight: 1.6, transition }}>
                Ingrese sus credenciales institucionales para acceder a su casilla y bandeja de gestión.
              </p>
            </div>
            {!minimal && <div style={{ paddingTop: 4, flexShrink: 0 }}>{soundButton}</div>}
          </div>

          {/* Alerta de error */}
          {errorMessage && (
            <div
              role="alert"
              style={{
                display: "flex", flexDirection: "column", gap: 8,
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 12, padding: "12px 14px", marginBottom: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                <span style={{ fontSize: "0.75rem", color: "#fca5a5", lineHeight: 1.5, flex: 1 }}>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => { setErrorMessage(null); setSugerenciaRol(null); }}
                  style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}
                  aria-label="Cerrar mensaje de error"
                >
                  ×
                </button>
              </div>
              {sugerenciaRol && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(239,68,68,0.3)", paddingTop: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "#fca5a5" }}>¿Cambiar al rol autorizado?</span>
                  <button
                    type="button"
                    onClick={() => { setRol(sugerenciaRol); setSugerenciaRol(null); setErrorMessage(null); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#dc2626", border: "none", borderRadius: 8, color: "#fff", fontWeight: 600, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}
                  >
                    <ShieldCheck size={14} aria-hidden="true" />
                    <span>Ajustar a {sugerenciaRol}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FORMULARIO */}
          <form onSubmit={handleSubmit} noValidate style={{ position: "relative" }}>

            {/* Usuario / DNI / Correo */}
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="lamp-identificador"
                style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: labelColor, marginBottom: 6, transition }}
              >
                Usuario, DNI o Correo Institucional
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <User size={16} color={labelColor} style={{ position: "absolute", left: 12, pointerEvents: "none", transition }} aria-hidden="true" />
                <input
                  id="lamp-identificador"
                  name="identificador"
                  type="text"
                  value={identificador}
                  onChange={handleIdentificadorChange}
                  placeholder="30456789 o usuario@iestpsuiza.edu.pe"
                  autoComplete="username"
                  required
                  aria-required="true"
                  style={{
                    width: "100%", background: inputBg, border: `1px solid ${borderColor}`,
                    borderRadius: 12, padding: "11px 14px 11px 40px",
                    fontSize: "0.875rem", fontFamily: "'Inter',system-ui,sans-serif",
                    color: textColor, outline: "none", transition,
                  }}
                  onFocus={(e) => { e.target.style.borderColor = accentColor; e.target.style.boxShadow = `0 0 0 3px ${accentColor}33`; }}
                  onBlur={(e)  => { e.target.style.borderColor = borderColor; e.target.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div style={{ marginBottom: 0 }}>
              <label
                htmlFor="lamp-password"
                style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: labelColor, marginBottom: 6, transition }}
              >
                Contraseña
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Lock size={16} color={labelColor} style={{ position: "absolute", left: 12, pointerEvents: "none", transition }} aria-hidden="true" />
                <input
                  id="lamp-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errorMessage) { setErrorMessage(null); setSugerenciaRol(null); } }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  style={{
                    width: "100%", background: inputBg, border: `1px solid ${borderColor}`,
                    borderRadius: 12, padding: "11px 42px 11px 40px",
                    fontSize: "0.875rem", fontFamily: "'Inter',system-ui,sans-serif",
                    color: textColor, outline: "none", transition,
                  }}
                  onFocus={(e) => { e.target.style.borderColor = accentColor; e.target.style.boxShadow = `0 0 0 3px ${accentColor}33`; }}
                  onBlur={(e)  => { e.target.style.borderColor = borderColor; e.target.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  style={{
                    position: "absolute", right: 10, background: "none", border: "none",
                    cursor: "pointer", color: labelColor, display: "flex", alignItems: "center",
                    justifyContent: "center", padding: 4, borderRadius: 6, transition: "color 0.3s",
                  }}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Recordar + Olvidó */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.8rem", fontWeight: 500, color: labelColor, userSelect: "none", transition }}>
                <input
                  type="checkbox"
                  id="lamp-remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ width: 15, height: 15, borderRadius: 4, accentColor: accentColor, cursor: "pointer" }}
                />
                <span>Recordar sesión</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter',system-ui,sans-serif", fontSize: "0.8rem", fontWeight: 600, color: linkColor, transition: "color 0.3s" }}
              >
                ¿Olvidó su clave?
              </button>
            </div>

            {/* Botón Ingresar */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%", padding: "13px 20px", border: "none", borderRadius: 12,
                fontFamily: "'Inter',system-ui,sans-serif", fontSize: "0.9rem", fontWeight: 700,
                color: "#fff",
                background: isLampOn
                  ? `linear-gradient(135deg, ${tema.vars?.["--lamp-accent"] ?? "#006EC7"}, ${tema.vars?.["--lamp-link"] ?? "#0f3261"})`
                  : "linear-gradient(135deg,#0c2340,#0f3261)",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden",
                opacity: isSubmitting ? 0.65 : 1, transition,
              }}
            >
              <span style={{
                position: "absolute", inset: 0, borderRadius: "inherit",
                background: "linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 60%)",
                pointerEvents: "none",
              }} />
              {isSubmitting ? (
                <>
                  <span style={{
                    width: 16, height: 16, border: "2.5px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }} aria-hidden="true" />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <span>Validando credenciales...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} aria-hidden="true" />
                  <span>Ingresar</span>
                </>
              )}
            </button>
          </form>

          {/* Separador Atención al Ciudadano */}
          <div style={{ position: "relative", margin: "22px 0 18px", display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1, height: 1, background: borderColor, transition }} />
            <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: labelColor, padding: "0 12px", whiteSpace: "nowrap", transition }}>
              Atención al Ciudadano
            </span>
            <div style={{ flex: 1, height: 1, background: borderColor, transition }} />
          </div>

          {/* Bloque Mesa de Partes */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${borderColor}`, borderRadius: 14, padding: "14px 16px", textAlign: "center", transition }}>
            <p style={{ fontSize: "0.75rem", color: labelColor, lineHeight: 1.6, marginBottom: 6, transition }}>
              ¿Es ciudadano o no cuenta con usuario interno?
            </p>
            <Link
              to="/tramite/mesa-partes-virtual"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.78rem", fontWeight: 700, color: linkColor, textDecoration: "none", transition: "color 0.3s" }}
              aria-label="Presentar solicitud en Mesa de Partes Virtual"
            >
              <span>Presentar solicitud en Mesa de Partes Virtual</span>
              <ExternalLink size={13} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* Modal ¿Olvidó su clave? */}
        {showForgotModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lamp-modal-titulo"
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowForgotModal(false); }}
          >
            <div style={{
              background: "#1e2a3e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20,
              padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0" }}>
                  <ShieldAlert size={18} color="#60a5fa" aria-hidden="true" />
                  <h3 id="lamp-modal-titulo">Restablecimiento de Credenciales</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  aria-label="Cerrar ventana de ayuda"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", borderRadius: 8, padding: 4, display: "flex", transition: "all 0.2s" }}
                >
                  <X size={18} />
                </button>
              </div>
              <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.65, marginBottom: 0 }}>
                Por razones de seguridad institucional, las claves de acceso al SIGD no se envían por canales no verificados.
              </p>
              <div style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 10, padding: "12px 14px", marginTop: 14, fontSize: "0.75rem", color: "#93c5fd", lineHeight: 1.6 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <HelpCircle size={16} color="#60a5fa" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                  <p>Para restablecer su contraseña, contacte a la <strong>Oficina de Tecnologías de la Información (OTI)</strong> del IESTP "Suiza" o envíe un correo desde su casilla institucional a:</p>
                </div>
                <p style={{ textAlign: "center", fontFamily: "monospace", fontWeight: 700, fontSize: "0.8rem", color: "#60a5fa", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: 8, margin: "8px 0 6px" }}>
                  soporte.sigd@iestpsuiza.edu.pe
                </p>
                <p style={{ fontSize: "0.7rem", opacity: 0.8 }}>Indique su DNI, nombres completos y cargo o programa de estudio correspondiente.</p>
              </div>
              <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  style={{ padding: "9px 20px", background: "linear-gradient(135deg,#0c2340,#0f3261)", border: "none", borderRadius: 10, fontFamily: "'Inter',system-ui,sans-serif", fontSize: "0.8rem", fontWeight: 700, color: "#fff", cursor: "pointer" }}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── RENDER: modo STANDALONE (página completa) ──────────────────────────── */
  return (
    <div
      style={{
        minHeight: "100vh", width: "100%", display: "flex", alignItems: "center",
        justifyContent: "center", position: "relative", overflow: "hidden",
        background: bgColor, transition,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Blobs ambientales (fixed, cubre toda la pantalla) */}
      {isLampOn && tema.blobColors && (
        <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          {[
            { top: "-80px", right: "-60px", w: 420, h: 420, color: tema.blobColors[0] },
            { bottom: "-60px", left: "20px", w: 320, h: 320, color: tema.blobColors[1] },
            { top: "40%", left: "50%", w: 200, h: 200, color: tema.blobColors[2], transform: "translate(-50%,-50%)" },
          ].map((b, i) => (
            <div key={i} style={{
              position: "absolute", borderRadius: "50%", filter: "blur(80px)",
              width: b.w, height: b.h, background: b.color, opacity: 1,
              ...(b.top    ? { top: b.top }       : {}),
              ...(b.right  ? { right: b.right }   : {}),
              ...(b.bottom ? { bottom: b.bottom } : {}),
              ...(b.left   ? { left: b.left }     : {}),
              ...(b.transform ? { transform: b.transform } : {}),
              transition,
            }} />
          ))}
        </div>
      )}

      {/* Grid de fondo */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)",
        backgroundSize: "40px 40px",
        maskImage: "radial-gradient(ellipse at 60% 40%,black 0%,transparent 70%)",
      }} />

      {/* Botón de sonido (fixed, esquina sup. derecha) */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 100 }}>
        {soundButton}
      </div>

      {/* Wrapper centrado */}
      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 440, padding: "1rem", display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* ── LÁMPARA ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Lámpara interactiva — haz clic para encender/apagar y cambiar el tema de color"
          onClick={handleLampClick}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleLampClick(); } }}
          onMouseEnter={() => setShowThemeLabel(true)}
          onMouseLeave={() => setShowThemeLabel(false)}
          style={{
            position: "relative", cursor: "pointer", userSelect: "none",
            display: "flex", flexDirection: "column", alignItems: "center",
            marginBottom: -8, zIndex: 20, width: 180, height: 160,
            animation: "lampLampEnter 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both",
          }}
        >
          {/* Tooltip */}
          <div style={{
            position: "absolute", top: -28, left: "50%",
            transform: showThemeLabel ? "translateX(-50%) scale(1)" : "translateX(-50%) scale(0.85)",
            background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 4,
            whiteSpace: "nowrap", pointerEvents: "none", backdropFilter: "blur(4px)",
            opacity: showThemeLabel ? 1 : 0, transition: "opacity 0.2s, transform 0.2s",
          }} aria-hidden="true">
            {tema.label}
          </div>

          <LampSvgComponent tema={tema} isSwinging={isSwinging} isKnobPulsing={isKnobPulsing} />
        </div>

        {/* ── LÁMPARA (modo standalone) ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Lámpara interactiva — haz clic para encender/apagar y cambiar el tema de color"
          onClick={handleLampClick}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleLampClick(); } }}
          onMouseEnter={() => setShowThemeLabel(true)}
          onMouseLeave={() => setShowThemeLabel(false)}
          style={{
            position: "relative", cursor: "pointer", userSelect: "none",
            display: "flex", flexDirection: "column", alignItems: "center",
            marginBottom: -8, zIndex: 20, width: 180, height: 160,
            animation: "lampLampEnter 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both",
          }}
        >
          <div style={{
            position: "absolute", top: -28, left: "50%",
            transform: showThemeLabel ? "translateX(-50%) scale(1)" : "translateX(-50%) scale(0.85)",
            background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 4,
            whiteSpace: "nowrap", pointerEvents: "none", backdropFilter: "blur(4px)",
            opacity: showThemeLabel ? 1 : 0, transition: "opacity 0.2s, transform 0.2s",
          }} aria-hidden="true">
            {tema.label}
          </div>
          <LampSvgComponent tema={tema} isSwinging={isSwinging} isKnobPulsing={isKnobPulsing} />
        </div>

        {/* ── TARJETA DE LOGIN (modo standalone) ── */}
        <section
          aria-labelledby="lamp-login-titulo"
          style={{
            width: "100%", maxWidth: 440,
            background: cardColor,
            border: `1px solid ${borderColor}`,
            borderRadius: 24, padding: "32px 32px 28px",
            boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.5), 0 0 80px ${glowColor}`,
            transition,
            position: "relative", overflow: "hidden",
            animation: "lampCardEnter 0.6s cubic-bezier(0.2,0.75,0.25,1) 0.25s both",
          }}
        >
          {/* Barra superior decorativa */}
          <div aria-hidden="true" style={{
            position: "absolute", top: 0, left: 32, right: 32,
            height: 3, borderRadius: "0 0 6px 6px",
            background: topBarBg, transition,
          }} />

          {/* Brillo interno */}
          <div aria-hidden="true" style={{
            position: "absolute", top: -60, right: -60, width: 200, height: 200,
            borderRadius: "50%", background: glowColor, opacity: 0.5, filter: "blur(50px)",
            pointerEvents: "none", transition,
          }} />

          {/* Encabezado */}
          <div style={{ marginBottom: 24, position: "relative" }}>
            <h2 id="lamp-login-titulo" style={{
              fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.025em",
              color: textColor, transition, lineHeight: 1.1,
            }}>
              Iniciar Sesión
            </h2>
            <p style={{ fontSize: "0.8rem", color: labelColor, marginTop: 6, lineHeight: 1.6, transition }}>
              Ingrese sus credenciales institucionales para acceder a su casilla y bandeja de gestión.
            </p>
          </div>

          {/* Alerta de error */}
          {errorMessage && (
            <div
              role="alert"
              style={{
                display: "flex", flexDirection: "column", gap: 8,
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 12, padding: "12px 14px", marginBottom: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                <span style={{ fontSize: "0.75rem", color: "#fca5a5", lineHeight: 1.5, flex: 1 }}>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => { setErrorMessage(null); setSugerenciaRol(null); }}
                  style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}
                  aria-label="Cerrar mensaje de error"
                >
                  ×
                </button>
              </div>
              {sugerenciaRol && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(239,68,68,0.3)", paddingTop: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "#fca5a5" }}>¿Cambiar al rol autorizado?</span>
                  <button
                    type="button"
                    onClick={() => { setRol(sugerenciaRol); setSugerenciaRol(null); setErrorMessage(null); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#dc2626", border: "none", borderRadius: 8, color: "#fff", fontWeight: 600, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}
                  >
                    <ShieldCheck size={14} aria-hidden="true" />
                    <span>Ajustar a {sugerenciaRol}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FORMULARIO */}
          <form onSubmit={handleSubmit} noValidate style={{ position: "relative" }}>

            {/* Usuario / DNI / Correo */}
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="lamp-identificador"
                style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: labelColor, marginBottom: 6, transition }}
              >
                Usuario, DNI o Correo Institucional
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <User size={16} color={labelColor} style={{ position: "absolute", left: 12, pointerEvents: "none", transition }} aria-hidden="true" />
                <input
                  id="lamp-identificador"
                  name="identificador"
                  type="text"
                  value={identificador}
                  onChange={handleIdentificadorChange}
                  placeholder="30456789 o usuario@iestpsuiza.edu.pe"
                  autoComplete="username"
                  required
                  aria-required="true"
                  style={{
                    width: "100%", background: inputBg, border: `1px solid ${borderColor}`,
                    borderRadius: 12, padding: "11px 14px 11px 40px",
                    fontSize: "0.875rem", fontFamily: "'Inter',system-ui,sans-serif",
                    color: textColor, outline: "none", transition,
                  }}
                  onFocus={(e) => { e.target.style.borderColor = accentColor; e.target.style.boxShadow = `0 0 0 3px ${accentColor}33`; }}
                  onBlur={(e)  => { e.target.style.borderColor = borderColor; e.target.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div style={{ marginBottom: 0 }}>
              <label
                htmlFor="lamp-password"
                style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: labelColor, marginBottom: 6, transition }}
              >
                Contraseña
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Lock size={16} color={labelColor} style={{ position: "absolute", left: 12, pointerEvents: "none", transition }} aria-hidden="true" />
                <input
                  id="lamp-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errorMessage) { setErrorMessage(null); setSugerenciaRol(null); } }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  style={{
                    width: "100%", background: inputBg, border: `1px solid ${borderColor}`,
                    borderRadius: 12, padding: "11px 42px 11px 40px",
                    fontSize: "0.875rem", fontFamily: "'Inter',system-ui,sans-serif",
                    color: textColor, outline: "none", transition,
                  }}
                  onFocus={(e) => { e.target.style.borderColor = accentColor; e.target.style.boxShadow = `0 0 0 3px ${accentColor}33`; }}
                  onBlur={(e)  => { e.target.style.borderColor = borderColor; e.target.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  style={{
                    position: "absolute", right: 10, background: "none", border: "none",
                    cursor: "pointer", color: labelColor, display: "flex", alignItems: "center",
                    justifyContent: "center", padding: 4, borderRadius: 6, transition: "color 0.3s",
                  }}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Recordar + Olvidó */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.8rem", fontWeight: 500, color: labelColor, userSelect: "none", transition }}>
                <input
                  type="checkbox"
                  id="lamp-remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ width: 15, height: 15, borderRadius: 4, accentColor: accentColor, cursor: "pointer" }}
                />
                <span>Recordar sesión</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter',system-ui,sans-serif", fontSize: "0.8rem", fontWeight: 600, color: linkColor, transition: "color 0.3s" }}
              >
                ¿Olvidó su clave?
              </button>
            </div>

            {/* Botón Ingresar */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%", padding: "13px 20px", border: "none", borderRadius: 12,
                fontFamily: "'Inter',system-ui,sans-serif", fontSize: "0.9rem", fontWeight: 700,
                color: "#fff",
                background: isLampOn
                  ? `linear-gradient(135deg, ${tema.vars?.["--lamp-accent"] ?? "#006EC7"}, ${tema.vars?.["--lamp-link"] ?? "#0f3261"})`
                  : "linear-gradient(135deg,#0c2340,#0f3261)",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden",
                opacity: isSubmitting ? 0.65 : 1, transition,
              }}
            >
              <span style={{
                position: "absolute", inset: 0, borderRadius: "inherit",
                background: "linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 60%)",
                pointerEvents: "none",
              }} />
              {isSubmitting ? (
                <>
                  <span style={{
                    width: 16, height: 16, border: "2.5px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }} aria-hidden="true" />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <span>Validando credenciales...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} aria-hidden="true" />
                  <span>Ingresar</span>
                </>
              )}
            </button>
          </form>

          {/* Separador Atención al Ciudadano */}
          <div style={{ position: "relative", margin: "22px 0 18px", display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1, height: 1, background: borderColor, transition }} />
            <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: labelColor, padding: "0 12px", whiteSpace: "nowrap", transition }}>
              Atención al Ciudadano
            </span>
            <div style={{ flex: 1, height: 1, background: borderColor, transition }} />
          </div>

          {/* Bloque Mesa de Partes */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${borderColor}`, borderRadius: 14, padding: "14px 16px", textAlign: "center", transition }}>
            <p style={{ fontSize: "0.75rem", color: labelColor, lineHeight: 1.6, marginBottom: 6, transition }}>
              ¿Es ciudadano o no cuenta con usuario interno?
            </p>
            <Link
              to="/tramite/mesa-partes-virtual"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.78rem", fontWeight: 700, color: linkColor, textDecoration: "none", transition: "color 0.3s" }}
              aria-label="Presentar solicitud en Mesa de Partes Virtual"
            >
              <span>Presentar solicitud en Mesa de Partes Virtual</span>
              <ExternalLink size={13} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      {/* Modal ¿Olvidó su clave? */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lamp-modal-titulo"
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForgotModal(false); }}
        >
          <div style={{
            background: "#1e2a3e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20,
            padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0" }}>
                <ShieldAlert size={18} color="#60a5fa" aria-hidden="true" />
                <h3 id="lamp-modal-titulo">Restablecimiento de Credenciales</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                aria-label="Cerrar ventana de ayuda"
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", borderRadius: 8, padding: 4, display: "flex", transition: "all 0.2s" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.65, marginBottom: 0 }}>
              Por razones de seguridad institucional, las claves de acceso al SIGD no se envían por canales no verificados.
            </p>

            <div style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 10, padding: "12px 14px", marginTop: 14, fontSize: "0.75rem", color: "#93c5fd", lineHeight: 1.6 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <HelpCircle size={16} color="#60a5fa" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                <p>Para restablecer su contraseña, contacte a la <strong>Oficina de Tecnologías de la Información (OTI)</strong> del IESTP "Suiza" o envíe un correo desde su casilla institucional a:</p>
              </div>
              <p style={{ textAlign: "center", fontFamily: "monospace", fontWeight: 700, fontSize: "0.8rem", color: "#60a5fa", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: 8, margin: "8px 0 6px" }}>
                soporte.sigd@iestpsuiza.edu.pe
              </p>
              <p style={{ fontSize: "0.7rem", opacity: 0.8 }}>Indique su DNI, nombres completos y cargo o programa de estudio correspondiente.</p>
            </div>

            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                style={{ padding: "9px 20px", background: "linear-gradient(135deg,#0c2340,#0f3261)", border: "none", borderRadius: 10, fontFamily: "'Inter',system-ui,sans-serif", fontSize: "0.8rem", fontWeight: 700, color: "#fff", cursor: "pointer" }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
