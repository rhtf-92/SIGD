/**
 * Tipos canónicos del Asistente Público Guiado del SIGD (V2)
 * IESTP "Suiza" - 2026
 */

export interface GuidedOption {
  id: string;
  label: string;
  nextNode?: string;
  route?: string;
  requiresAuth?: boolean;
  isBack?: boolean;
  isHome?: boolean;
}

export interface GuidedNode {
  id: string;
  title: string;
  subtitle?: string;
  message: string;
  options: GuidedOption[];
  isTupaSearch?: boolean;
}

export interface ProcedimientoTupaBusqueda {
  registroVersionId: string;
  codigoRef: string;
  codigo: string;
  denominacion: string;
  categoria: string;
  tipoLegible: string;
  monto: string;
  plazo: string;
  requisitos: readonly string[];
}
