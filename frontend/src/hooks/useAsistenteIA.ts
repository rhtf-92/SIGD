import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { iaCloudDisponible } from "../config/asistenteConfig";
import { responderConIA } from "../services/asistenteIAService";
import {
  BASE_CONOCIMIENTO,
  PALABRAS_VACIAS,
  RESPUESTA_POR_DEFECTO,
  RUTAS_MODULOS,
  SINONIMOS,
  type AccionPagina,
  type EntradaConocimiento,
} from "../data/asistenteConocimiento";

export interface SugerenciaTema {
  titulo: string;
  ejemplo: string;
}

export interface ResultadoRespuesta {
  texto: string;
  enlaces?: { etiqueta: string; ruta: string }[];
  sugerencias?: SugerenciaTema[];
  temaId?: string;
  accion?: AccionPagina;
}

export interface MensajeChat {
  id: string;
  rol: "usuario" | "asistente";
  texto: string;
  enlaces?: { etiqueta: string; ruta: string }[];
  sugerencias?: SugerenciaTema[];
  /** De dónde vino la respuesta: motor local o nube (LLM). */
  origen?: "local" | "ia";
  hora: number;
}

// ---------- Utilidades de lenguaje natural ----------

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aplicarSinonimo(token: string): string {
  return SINONIMOS[token] ?? token;
}

/** Radicalización ligera en español para que “trámites” ≈ “tramite”. */
function radicalizar(token: string): string {
  if (token.length <= 4) return token;
  const reglas: [RegExp, string][] = [
    [/ciones$/, "cion"],
    [/siones$/, "sion"],
    [/(adora|ador|acion|encia|encia)$/, ""],
    [/(ando|iendo|ado|ido)$/, ""],
    [/(es)$/, ""],
    [/(s)$/, ""],
  ];
  for (const [re, rep] of reglas) {
    if (re.test(token)) {
      const r = token.replace(re, rep);
      if (r.length >= 3) return r;
    }
  }
  return token;
}

export function tokenizar(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .map((t) => aplicarSinonimo(t))
    .filter((t) => t && !PALABRAS_VACIAS.has(t))
    .map(radicalizar)
    .filter(Boolean);
}

function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

/** 1 = igual, 0.85 = contiene, 0.7 = typo leve, 0 en otro caso. */
function similitudTokens(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a))) return 0.85;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 4) return 0;
  const d = distanciaLevenshtein(a, b);
  const tolerancia = maxLen <= 6 ? 1 : 2;
  if (d <= tolerancia) return 0.7;
  return 0;
}

function puntajeFraseExacta(preguntaNorm: string, frase: string): number {
  const f = normalizar(frase);
  if (!f) return 0;
  if (preguntaNorm.includes(f)) return f.includes(" ") ? 4 : 1.5;
  return 0;
}

function puntuarEntrada(tokensPregunta: string[], preguntaNorm: string, entrada: EntradaConocimiento): number {
  if (tokensPregunta.length === 0) return 0;
  let puntaje = 0;

  for (const clave of entrada.palabrasClave) {
    puntaje += puntajeFraseExacta(preguntaNorm, clave);
  }

  const tokensClave = new Set<string>();
  for (const clave of entrada.palabrasClave) {
    for (const t of tokenizar(clave)) tokensClave.add(t);
  }
  for (const tPreg of tokensPregunta) {
    let mejor = 0;
    for (const tClave of tokensClave) {
      const s = similitudTokens(tPreg, tClave);
      if (s > mejor) mejor = s;
      if (mejor === 1) break;
    }
    puntaje += mejor * 1.2;
  }

  let mejorJaccard = 0;
  for (const ejemplo of entrada.ejemplos) {
    const tokensEj = tokenizar(ejemplo);
    if (tokensEj.length === 0) continue;
    let coincidencias = 0;
    for (const tPreg of tokensPregunta) {
      for (const tEj of tokensEj) {
        if (similitudTokens(tPreg, tEj) >= 0.7) {
          coincidencias += 1;
          break;
        }
      }
    }
    const union = new Set([...tokensPregunta, ...tokensEj]).size || 1;
    const j = coincidencias / union;
    if (j > mejorJaccard) mejorJaccard = j;
  }
  puntaje += mejorJaccard * 5;

  return puntaje;
}

const REGEX_CUT = /\bcut[\s-]*(\d[\d-]*)/i;
const REGEX_SEGUIMIENTO = /^(y )?(eso )?(donde|dónde|c[oó]mo|cu[aá]ndo|y despu[eé]s|y luego|y eso).*(\?)?$/;
const REGEX_SOLO_SEGUIMIENTO = /^(eso|esto|ahi|ahí|ahi mismo|ese|esa|ello|eso donde|y eso)$/;

// Preguntas de cortesía (respuesta corta, sin repetir saludo institucional)
const CORTESIA_PATRONES = [
  "como estas", "como esta", "que tal", "que tal estas", "todo bien",
  "estas bien", "estás bien", "está bien", "como andas", "que cuentas",
];

function esSaludoCortesia(preguntaNorm: string): boolean {
  return CORTESIA_PATRONES.some((p) => preguntaNorm === p || preguntaNorm.includes(p));
}

function respuestaCortesia(): string {
  return "¡Hola! Estoy muy bien, gracias por preguntar. Listo para ayudarte con tus trámites del SIGD. ¿Qué necesitas hoy?";
}

// Verbos de manipulación de página (el asistente navega por usted)
const VERBOS_NAVEGACION = [
  "llevame", "lleve", "llevar", "dirigeme", "dirija", "abreme", "abre", "abrir",
  "ir", "vamos", "muestrame", "muestre", "enviame", "envie", "quiero ir", "quiero ver",
  "quiero entrar", "entra", "navega", "redigirige",
];
const VERBOS_LOGOUT = ["cerrar sesion", "cierra sesion", "salir", "desconecta", "cierra mi sesion"];
const VERBOS_ARRIBA = ["sube arriba", "ir arriba", "volver arriba", "scroll arriba", "subir"];

function detectarAccionPagina(original: string, preguntaNorm: string): AccionPagina | null {
  const norm = ` ${preguntaNorm} `;

  if (VERBOS_LOGOUT.some((v) => norm.includes(` ${normalizar(v)} `) || norm.includes(` ${normalizar(v)}`))) {
    if (norm.includes("sesion") || norm.includes("salir") || norm.includes("desconec") || norm.includes("cuenta")) {
      return { tipo: "logout" };
    }
  }
  if (VERBOS_ARRIBA.some((v) => norm.includes(normalizar(v)))) {
    return { tipo: "scroll-arriba" };
  }

  const quiereNavegar =
    VERBOS_NAVEGACION.some((v) => norm.includes(normalizar(v))) ||
    /^(a (la|el) |al |a mi |a mis )/.test(preguntaNorm);

  // Mención directa de un módulo aunque no haya verbo explícito ("mi casilla", "el validador")
  let destino = RUTAS_MODULOS.find((m) =>
    m.claves.some((c) => norm.includes(` ${normalizar(c)} `) || norm.includes(` ${normalizar(c)}`)),
  );

  // "inicio" / "principal" como destino
  if (!destino && (norm.includes(" inicio ") || norm.includes(" principal ") || norm.includes(" home "))) {
    destino = RUTAS_MODULOS.find((m) => m.ruta === "/");
  }

  if (destino && (quiereNavegar || norm.includes("donde") || norm.includes("como llego") || norm.includes("casilla") || norm.includes("quiero"))) {
    void original;
    return { tipo: "navegar", ruta: destino.ruta, etiquetaDestino: destino.etiqueta };
  }
  return null;
}

function rolSesion(): string | null {
  try {
    return window.localStorage.getItem("sigd_rol");
  } catch {
    return null;
  }
}

function personalizarPorRol(texto: string): string {
  const rol = rolSesion();
  if (!rol) return texto;
  const nota: Record<string, string> = {
    ESTUDIANTE: "\n\nNota: como estudiante, usted dispone de Mesa Virtual, Casilla, Consulta y Validador.",
    DOCENTE: "\n\nNota: como docente, usted dispone además de Expedientes, Firma, Titulación y Proyector.",
    MESA_PARTES: "\n\nNota: como Mesa de Partes, usted gestiona Ventanilla, Expedientes y recepción de trámites.",
    DIRECTOR: "\n\nNota: como director, usted posee acceso integral, incluida Administración y Reportes.",
    SUPER_ADMIN: "\n\nNota: como Super Administrador, usted posee gobernanza total del sistema.",
  };
  return texto + (nota[rol] ?? "");
}

/** Tema canónico de conocimiento correspondiente a cada ruta de navegación. */
const TEMA_POR_RUTA: Record<string, string> = {
  "/tramite": "mesa-partes-virtual",
  "/tramite/ventanilla-presencial": "ventanilla-presencial",
  "/casilla": "casilla-electronica",
  "/consulta": "consulta-cut",
  "/validador-cvd": "validador-cvd",
  "/expedientes": "expedientes",
  "/flujo-validez-legal": "firma-validez-legal",
  "/flujo-validez-legal/firma": "firma-validez-legal",
  "/flujos/titulacion": "titulacion",
  "/flujos/proyector-resoluciones": "proyector-resoluciones",
  "/administracion": "administracion",
  "/reportes/dashboard": "reportes",
  "/registro": "registro-login",
  "/login": "registro-login",
  "/": "que-es-sigd",
};

function topSugerencias(excluirId?: string, n = 3): SugerenciaTema[] {
  const fijas = ["consulta-cut", "casilla-electronica", "validador-cvd", "registro-login", "mesa-partes-virtual"];
  return fijas
    .filter((id) => id !== excluirId)
    .slice(0, n)
    .map((id) => {
      const e = BASE_CONOCIMIENTO.find((x) => x.id === id)!;
      return { titulo: e.titulo, ejemplo: e.ejemplos[0] ?? e.titulo };
    });
}

export function buscarRespuesta(pregunta: string, ultimoTemaId?: string | null): ResultadoRespuesta {
  const original = pregunta.trim();
  if (!original) {
    return { texto: "Con gusto le asisto. Por favor, descríbame su requerimiento; por ejemplo: «¿dónde consulto mis notificaciones?» o «llévame a mesa de partes»." };
  }
  const preguntaNorm = normalizar(original);
  const tokens = tokenizar(original);

  // Respuesta corta de cortesía (no saludo institucional, no navega).
  if (esSaludoCortesia(preguntaNorm)) {
    return { texto: respuestaCortesia() };
  }

  // 0) Manipulación de página: navegación directa por orden del usuario
  const accion = detectarAccionPagina(original, preguntaNorm);
  if (accion?.tipo === "logout") {
    return {
      texto: "Entendido. Procederé a cerrar su sesión institucional de forma segura y le dirigiré a la pantalla de acceso. Gracias por utilizar el SIGD.",
      accion,
      temaId: "registro-login",
    };
  }
  if (accion?.tipo === "scroll-arriba") {
    return {
      texto: "Con gusto. Desplazaré la página hacia la parte superior para facilitar su lectura.",
      accion,
    };
  }
  if (accion?.tipo === "navegar" && accion.ruta) {
    const entradaRel = BASE_CONOCIMIENTO.find((e) => e.enlaces?.some((l) => l.ruta === accion.ruta));
    return {
      texto: `Con todo gusto. Le estoy dirigiendo al módulo «${accion.etiquetaDestino}». En breve visualizará la página correspondiente. Si requiere orientación adicional sobre dicho módulo, quedo a su disposición.`,
      enlaces: [{ etiqueta: accion.etiquetaDestino ?? "Abrir módulo", ruta: accion.ruta }],
      accion,
      temaId: TEMA_POR_RUTA[accion.ruta] ?? entradaRel?.id,
    };
  }

  // Detección directa de CUT
  const mCut = original.match(REGEX_CUT);
  if (mCut) {
    const entrada = BASE_CONOCIMIENTO.find((e) => e.id === "consulta-cut")!;
    return {
      texto: personalizarPorRol(
        `Gracias por facilitarme su código ${mCut[0].toUpperCase()}. Le invito a acceder al módulo Consulta Pública e ingresarlo textualmente para visualizar el estado de su trámite: registrado, en revisión, observado o atendido. Si el sistema indica «no encontrado», le sugiero verificar que no falte ningún dígito. Puedo dirigirle allí si usted lo desea.`,
      ),
      enlaces: entrada.enlaces,
      temaId: entrada.id,
      accion: { tipo: "navegar", ruta: "/consulta", etiquetaDestino: "Consulta Pública" },
    };
  }

  // Pregunta de seguimiento corta
  if (ultimoTemaId && (REGEX_SEGUIMIENTO.test(preguntaNorm) || REGEX_SOLO_SEGUIMIENTO.test(preguntaNorm))) {
    const anterior = BASE_CONOCIMIENTO.find((e) => e.id === ultimoTemaId);
    if (anterior) {
      const textoSeg = anterior.seguimiento ?? anterior.respuesta;
      const enlacePrincipal = anterior.enlaces?.[0];
      return {
        texto: `En relación con su consulta anterior (${anterior.titulo.toLowerCase()}): ${textoSeg}`,
        enlaces: anterior.enlaces,
        temaId: anterior.id,
        accion: enlacePrincipal ? { tipo: "navegar", ruta: enlacePrincipal.ruta, etiquetaDestino: enlacePrincipal.etiqueta } : undefined,
      };
    }
  }

  if (tokens.length === 0) {
    const ayuda = BASE_CONOCIMIENTO.find((e) => e.id === "ayuda-general")!;
    return {
      texto: `${RESPUESTA_POR_DEFECTO} Por ejemplo: «¿dónde consulto mis notificaciones?», «deseo presentar un trámite» o «llévame al validador».`,
      enlaces: ayuda.enlaces,
      sugerencias: topSugerencias(),
    };
  }

  let mejor: EntradaConocimiento | null = null;
  let mejorPuntaje = 0;
  let segundoPuntaje = 0;
  for (const entrada of BASE_CONOCIMIENTO) {
    const p = puntuarEntrada(tokens, ` ${preguntaNorm} `, entrada);
    if (p > mejorPuntaje) {
      segundoPuntaje = mejorPuntaje;
      mejorPuntaje = p;
      mejor = entrada;
    } else if (p > segundoPuntaje) {
      segundoPuntaje = p;
    }
  }

  const UMBRAL = 1.6;
  if (mejor && mejorPuntaje >= UMBRAL) {
    const esAmbiguo = mejorPuntaje - segundoPuntaje < 0.6 && segundoPuntaje >= UMBRAL;
    if (esAmbiguo) {
      return {
        texto: personalizarPorRol(`${mejor.respuesta}\n\nSi su requerimiento corresponde a otro tema, le agradeceré precisar su solicitud; por ejemplo:`),
        enlaces: mejor.enlaces,
        sugerencias: topSugerencias(mejor.id),
        temaId: mejor.id,
      };
    }
    return { texto: personalizarPorRol(mejor.respuesta), enlaces: mejor.enlaces, temaId: mejor.id };
  }

  return {
    texto: RESPUESTA_POR_DEFECTO,
    sugerencias: topSugerencias(),
  };
}

// ---------- Hook con memoria conversacional + control de página ----------

function ayudaContextual(pathname: string): string | null {
  if (pathname.startsWith("/tramite")) return "Observo que usted se encuentra en Trámites: puedo asistirle con TUPA, requisitos o su código CUT, o dirigirle a otro módulo.";
  if (pathname.startsWith("/casilla")) return "Observo que usted se encuentra en Casilla: puedo orientarle sobre sus notificaciones electrónicas.";
  if (pathname.startsWith("/expedientes")) return "Observo que usted se encuentra en Expedientes: puedo orientarle sobre trazabilidad, providencias o derivaciones.";
  if (pathname.startsWith("/validador")) return "Observo que usted se encuentra en el Validador: facilíteme su código CVD y le explicaré el procedimiento.";
  if (pathname.startsWith("/consulta")) return "Observo que usted se encuentra en Consulta: facilíteme su CUT y le explicaré cada estado.";
  if (pathname.startsWith("/registro")) return "Observo que usted se encuentra en Registro: puedo asistirle con DNI, cuenta o contraseña institucional.";
  if (pathname.startsWith("/flujo")) return "Observo que usted se encuentra en Validez Legal: puedo orientarle sobre firma digital o código CVD.";
  if (pathname.startsWith("/reportes")) return "Observo que usted se encuentra en Reportes: puedo explicarle los indicadores ejecutivos.";
  if (pathname.startsWith("/admin")) return "Observo que usted se encuentra en Administración: puedo orientarle sobre usuarios, roles o auditoría.";
  return null;
}

let contadorId = 0;
function nuevoId(): string {
  contadorId += 1;
  return `msg-${Date.now()}-${contadorId}`;
}

/** Sugerencias rápidas según la página actual (atajos contextuales). */
export function sugerenciasParaRuta(pathname: string): SugerenciaTema[] {
  if (pathname.startsWith("/tramite"))
    return [
      { titulo: "Requisitos", ejemplo: "¿Qué requisitos necesito?" },
      { titulo: "Costos TUPA", ejemplo: "¿Cuánto cuesta mi trámite?" },
      { titulo: "Mi CUT", ejemplo: "¿Dónde consulto mi trámite?" },
    ];
  if (pathname.startsWith("/casilla"))
    return [
      { titulo: "Notificaciones", ejemplo: "¿Dónde veo mis notificaciones?" },
      { titulo: "Resolución", ejemplo: "No encuentro mi resolución" },
    ];
  if (pathname.startsWith("/consulta"))
    return [
      { titulo: "Estados", ejemplo: "¿Qué significa observado?" },
      { titulo: "Perdí CUT", ejemplo: "Perdí mi CUT, ¿qué hago?" },
    ];
  if (pathname.startsWith("/validador"))
    return [
      { titulo: "Validar", ejemplo: "Tengo un código CVD, ¿qué hago?" },
      { titulo: "QR", ejemplo: "¿Cómo verifico con el QR?" },
    ];
  if (pathname.startsWith("/expedientes"))
    return [
      { titulo: "Derivar", ejemplo: "¿Cómo derivo un expediente?" },
      { titulo: "Trazabilidad", ejemplo: "¿Dónde veo la trazabilidad?" },
    ];
  if (pathname.startsWith("/registro") || pathname.startsWith("/login"))
    return [
      { titulo: "Registrarme", ejemplo: "¿Cómo me registro?" },
      { titulo: "Contraseña", ejemplo: "Olvidé mi contraseña" },
    ];
  return [
    { titulo: "Trámite", ejemplo: "Quiero presentar un trámite" },
    { titulo: "Notificaciones", ejemplo: "¿Dónde veo mis notificaciones?" },
    { titulo: "Validar", ejemplo: "¿Cómo sé si mi documento es verdadero?" },
  ];
}

const CLAVE_HISTORIAL = "sigd_asistente_historial_v1";

export function useAsistenteIA() {
  const location = useLocation();
  const navigate = useNavigate();
  const ultimoTema = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>(() => {
    const yaSaludo = typeof sessionStorage !== "undefined" && sessionStorage.getItem("sigd_saludo_mostrado") === "1";
    if (yaSaludo) return [];
    return [
      {
        id: nuevoId(),
        rol: "asistente",
        hora: Date.now(),
        texto:
          "Buenos días. Soy SIGI, asistente institucional del SIGD. Puedo orientarle con rigor profesional y, si usted lo autoriza, dirigirle al módulo correspondiente, por ejemplo: «llévame a mi casilla» o «abre el validador». ¿En qué puedo servirle?",
        sugerencias: [
          { titulo: "Presentar trámite", ejemplo: "Llévame a Mesa de Partes Virtual" },
          { titulo: "Ver notificaciones", ejemplo: "¿Dónde consulto mis notificaciones?" },
          { titulo: "Recuperar CUT", ejemplo: "Perdí mi CUT, ¿cómo lo recupero?" },
        ],
      },
    ];
  });
  const [escribiendo, setEscribiendo] = useState(false);
  const [fuenteIA, setFuenteIA] = useState<"local" | "ia" | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(mensajes.slice(-30)));
    } catch { /* almacenamiento lleno o bloqueado */ }
  }, [mensajes]);

  const contexto = useMemo(() => ayudaContextual(location.pathname), [location.pathname]);
  const sugerenciasRuta = useMemo(() => sugerenciasParaRuta(location.pathname), [location.pathname]);

  const ejecutarAccion = (accion?: AccionPagina) => {
    if (!accion) return;
    if (accion.tipo === "navegar" && accion.ruta) {
      window.setTimeout(() => navigate(accion.ruta!), 900);
    } else if (accion.tipo === "logout") {
      window.setTimeout(() => {
        try {
          window.localStorage.removeItem("sigd_token");
          window.localStorage.removeItem("token");
          window.localStorage.removeItem("sigd_rol");
          window.localStorage.removeItem("sigd_permisos");
          window.dispatchEvent(new Event("sigd:sesion"));
        } catch { /* noop */ }
        navigate("/login");
      }, 1200);
    } else if (accion.tipo === "scroll-arriba") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 400);
    }
  };

  const enviar = (textoUsuario: string) => {
    const texto = textoUsuario.trim();
    if (!texto || escribiendo) return;
    const msgUsuario: MensajeChat = { id: nuevoId(), rol: "usuario", texto, hora: Date.now() };
    const historialPrevio = [...mensajes, msgUsuario];
    setMensajes(historialPrevio);
    setEscribiendo(true);
    setFuenteIA(null);

    window.setTimeout(() => {
      void (async () => {
        const r = buscarRespuesta(texto, ultimoTema.current);
        if (r.temaId) ultimoTema.current = r.temaId;

        // Si el motor local no está seguro y hay IA en la nube, intentar ahí.
        let textoFinal = r.texto;
        let origen: "local" | "ia" = "local";
        let enlacesFinal = r.enlaces;
        if (!r.temaId && iaCloudDisponible()) {
          abortRef.current?.abort();
          abortRef.current = new AbortController();
          const nube = await responderConIA(
            texto,
            historialPrevio.map((m) => ({ rol: m.rol, texto: m.texto })),
            { ruta: location.pathname, rol: rolSesion() },
            abortRef.current.signal,
          );
          if (nube) {
            textoFinal = nube;
            origen = "ia";
            enlacesFinal = r.enlaces;
          }
        }

        const esPrimera = mensajes.length <= 1;
        const extra = contexto && esPrimera ? `\n\n${contexto}` : "";
        const msgIA: MensajeChat = {
          id: nuevoId(),
          rol: "asistente",
          texto: textoFinal + extra,
          enlaces: enlacesFinal,
          sugerencias: r.sugerencias,
          origen,
          hora: Date.now(),
        };
        setMensajes((prev) => [...prev, msgIA]);
        if (esPrimera) {
          try {
            sessionStorage.setItem("sigd_saludo_mostrado", "1");
          } catch { /* noop */ }
        }
        setFuenteIA(origen);
        setEscribiendo(false);
        ejecutarAccion(r.accion);
      })();
    }, 550);
  };

  const elegirSugerencia = (ejemplo: string) => enviar(ejemplo);

  const irA = (ruta: string) => navigate(ruta);

  const limpiar = () => {
    ultimoTema.current = null;
    abortRef.current?.abort();
    try {
      window.localStorage.removeItem(CLAVE_HISTORIAL);
    } catch { /* noop */ }
    setMensajes([
      {
        id: nuevoId(),
        rol: "asistente",
        hora: Date.now(),
        texto: "He reiniciado nuestra conversación. Quedo a su disposición; por favor, indíqueme en qué puedo servirle.",
      },
    ]);
  };

  return { mensajes, escribiendo, enviar, elegirSugerencia, irA, limpiar, fuenteIA, sugerenciasRuta, iaDisponible: iaCloudDisponible() };
}
