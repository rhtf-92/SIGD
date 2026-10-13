export type TipoTabla = "Áreas" | "Cargos" | "Roles" | "Tipos documentales";
export type EstadoRegistro = "Activo" | "Inactivo";

export interface RegistroMaestro {
  id: string;
  tipo: TipoTabla;
  codigo: string;
  nombre: string;
  detalle: string;
  estado: EstadoRegistro;
}

export interface AreaOrganica {
  id: string;
  codigo: string;
  nombre: string;
  ruta: string;
  detalle: string;
  estado: EstadoRegistro;
}
