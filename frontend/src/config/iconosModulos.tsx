// Registro de iconos del catálogo de módulos.
// Compartido por el rail lateral, el panel de cabecera y las fichas de la
// portada, para que un módulo conserve siempre la misma señal gráfica.
import {
  BadgeCheck,
  CircleGauge,
  FolderKanban,
  GraduationCap,
  Inbox,
  Landmark,
  LayoutDashboard,
  ScrollText,
  Search,
  Send,
  ShieldCheck,
  Stamp,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

export const ICONOS_MODULO: Record<string, LucideIcon> = {
  // Catálogo principal (config/modulos.ts)
  registro: UserPlus,
  casilla: Inbox,
  "mesa-partes": Send,
  ventanilla: Landmark,
  expedientes: FolderKanban,
  "validez-legal": ShieldCheck,
  titulacion: GraduationCap,
  resoluciones: Stamp,
  reportes: CircleGauge,
  "validador-cvd": BadgeCheck,
  administracion: LayoutDashboard,

  // Catálogo de navegación (config/accesoModulos.ts)
  "mesa-virtual": Send,
  consulta: Search,
  validador: BadgeCheck,
  "flujo-validez": ShieldCheck,
  proyector: Stamp,
};

/** Resuelve el icono de un módulo; cae en un sello genérico si no existe. */
export function iconoDeModulo(id: string): LucideIcon {
  return ICONOS_MODULO[id] ?? ScrollText;
}

/**
 * Devuelve el icono ya renderizado para incrustarlo en JSX.
 *
 * Evita resolver el componente dentro del cuerpo de render de una ficha
 * (el icono se elige por dato, no por posición en el árbol).
 */
export function elementoIconoModulo(id: string, className?: string) {
  const Icono = ICONOS_MODULO[id] ?? ScrollText;
  return <Icono className={className} aria-hidden="true" />;
}
