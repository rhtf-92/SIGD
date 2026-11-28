// Modelos de tablas maestras y trazabilidad institucional (ENT-M05-05)
// Alineado al Modelo de Gestión Documental (MGD) y LPAG Ley 27444

export type TipoTabla =
  | "Tipos documentales"
  | "Áreas y Organigrama"
  | "Estados de trámite (FSM)"
  | "Acciones de trazabilidad"
  | "Transiciones de flujo";

export type EstadoRegistro = "Activo" | "Inactivo";

export interface RegistroMaestro {
  id: number;
  tipo: TipoTabla;
  codigo: string;
  nombre: string;
  detalle: string;
  estado: EstadoRegistro;
  // Atributos especializados de trazabilidad procesal:
  exigeFirma?: boolean;
  tamanoMaximoMb?: number;
  esTerminal?: boolean;
  faseProcesal?: string;
  eventoTransicion?: string;
  estadoDestino?: string;
}

export interface AreaOrganica {
  id: number;
  codigo: string;
  nombre: string;
  ruta: string;
  detalle: string;
  estado: EstadoRegistro;
}
