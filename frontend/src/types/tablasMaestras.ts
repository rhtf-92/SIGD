export type TipoTabla = "Sedes" | "Áreas" | "Cargos" | "Roles" | "Tipos documentales";
export type EstadoRegistro = "Activo" | "Inactivo";

export interface RegistroMaestro {
  id: string;
  tipo: TipoTabla;
  codigo: string;
  nombre: string;
  detalle: string;
  padreId?: string | null;
  estado: EstadoRegistro;
}

export interface AreaOrganica {
  id: string;
  codigo: string;
  nombre: string;
  ruta: string;
  padreId?: string | null;
  detalle: string;
  estado: EstadoRegistro;
}
