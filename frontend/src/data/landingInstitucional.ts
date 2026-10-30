import { MODULOS_VISIBLES, type DefinicionModulo } from "../config/accesoModulos";
import { BASE_CONOCIMIENTO } from "./asistenteConocimiento";

export interface EnlaceInstitucional {
  etiqueta: string;
  to?: string;
  href?: string;
  descripcion?: string;
}

export interface GrupoMenu {
  etiqueta: string;
  to?: string;
  enlaces?: EnlaceInstitucional[];
}

export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

export interface ColumnaPie {
  titulo: string;
  enlaces: EnlaceInstitucional[];
}

export function imagenPlaceholder(texto: string, ancho = 800, alto = 520): string {
  const fondo = "003366";
  return `https://via.placeholder.com/${ancho}x${alto}/${fondo}/FFFFFF?text=${encodeURIComponent(texto)}`;
}

/**
 * Módulos del SIGD ordenados según la matriz institucional.
 * Fuente única de verdad: src/config/accesoModulos.ts (MODULOS_VISIBLES).
 */
export const MODULOS_SIGD: DefinicionModulo[] = [...MODULOS_VISIBLES].sort(
  (a, b) => a.orden - b.orden,
);

/** Módulos marcados como destacados en la matriz institucional. */
export const MODULOS_DESTACADOS: DefinicionModulo[] = MODULOS_SIGD.filter(
  (m) => m.destacado,
);

/** Enlaces de la barra superior (accesos públicos rápidos del SIGD). */
export const ENLACES_SUPERIORES: EnlaceInstitucional[] = MODULOS_SIGD.filter(
  (m) => m.publico,
).map((m) => ({ etiqueta: m.titulo, to: m.ruta }));

const modulo = (id: string): DefinicionModulo | undefined =>
  MODULOS_SIGD.find((m) => m.id === id);

const enlaceModulo = (id: string): EnlaceInstitucional | null => {
  const m = modulo(id);
  return m ? { etiqueta: m.titulo, to: m.ruta } : null;
};

const agrupar = (ids: string[]): EnlaceInstitucional[] =>
  ids
    .map(enlaceModulo)
    .filter((e): e is EnlaceInstitucional => e !== null);

/**
 * Menú principal con la estructura de la referencia (grupos desplegables),
 * construido únicamente con los módulos reales del SIGD.
 */
export const MENU_PRINCIPAL: GrupoMenu[] = [
  { etiqueta: "Inicio", to: "/" },
  {
    etiqueta: "Mesa de Partes",
    enlaces: agrupar(["mesa-virtual", "ventanilla", "registro", "consulta"]),
  },
  {
    etiqueta: "Documentos",
    enlaces: agrupar(["casilla", "expedientes", "flujo-validez", "titulacion", "proyector"]),
  },
  {
    etiqueta: "Verificación",
    enlaces: agrupar(["validador"]),
  },
  {
    etiqueta: "Gestión",
    enlaces: agrupar(["administracion", "reportes"]),
  },
  { etiqueta: "Ayuda", to: "#ayuda-pagina" },
];

/** Preguntas frecuentes construidas desde la base de conocimiento institucional. */
const IDS_FAQ = [
  "que-es-sigd",
  "mesa-partes-virtual",
  "consulta-cut",
  "casilla-electronica",
  "validador-cvd",
  "registro-login",
] as const;

export const PREGUNTAS_FRECUENTES: PreguntaFrecuente[] = IDS_FAQ.map((id) => {
  const entrada = BASE_CONOCIMIENTO.find((e) => e.id === id);
  return entrada
    ? { pregunta: entrada.ejemplos[0] ?? entrada.titulo, respuesta: entrada.respuesta }
    : null;
}).filter((p): p is PreguntaFrecuente => p !== null);

/**
 * Datos de la institución (identidad y ubicación). Sin datos de contacto
 * fabricados: solo la información institucional vigente en el sistema.
 */
export const CONTACTO = {
  institucion: 'IESTP "Suiza"',
  sistema: "Sistema Integral de Gestión Documentaria (SIGD)",
  ubicacion: "Pucallpa, Ucayali",
  referencia:
    "Atención presencial en Mesa de Partes / Ventanilla del IESTP “Suiza”, Pucallpa.",
};

export const COLUMNAS_PIE: ColumnaPie[] = [
  {
    titulo: "Mesa de Partes",
    enlaces: agrupar(["mesa-virtual", "ventanilla", "registro", "consulta"]),
  },
  {
    titulo: "Documentos y Verificación",
    enlaces: agrupar(["casilla", "expedientes", "validador", "flujo-validez"]),
  },
];

export const NAVEGACION_PIE: EnlaceInstitucional[] = [
  { etiqueta: "Inicio", to: "/" },
  { etiqueta: "Acceso al Sistema", to: "/login" },
];

export interface TemaAyuda {
  id: string;
  titulo: string;
  respuesta: string;
  enlaces: { etiqueta: string; to: string }[];
}

/** Centro de ayuda: temas reales extraídos de la base de conocimiento institucional. */
const IDS_AYUDA = [
  "que-es-sigd",
  "mesa-partes-virtual",
  "consulta-cut",
  "casilla-electronica",
  "validador-cvd",
  "firma-validez-legal",
  "titulacion",
  "registro-login",
] as const;

export const CENTRO_AYUDA: TemaAyuda[] = IDS_AYUDA.flatMap((id) => {
  const entrada = BASE_CONOCIMIENTO.find((e) => e.id === id);
  if (!entrada) return [];
  return [
    {
      id: entrada.id,
      titulo: entrada.titulo,
      respuesta: entrada.respuesta,
      enlaces: (entrada.enlaces ?? []).map((e) => ({ etiqueta: e.etiqueta, to: e.ruta })),
    },
  ];
});
