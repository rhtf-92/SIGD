// Modelos de tablas maestras y organigrama Materialized Path (ENT-M05-05)
// Alineado al documento SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-02

export type TipoTabla = "Sedes" | "Áreas" | "Tipos documentales";
export type EstadoRegistro = "Activo" | "Inactivo";

export interface RegistroMaestro {
  id: number;
  tipo: TipoTabla;
  codigo: string;
  nombre: string;
  detalle: string;
  estado: EstadoRegistro;
}

export interface AreaOrganica {
  id: number;
  codigo: string;
  nombre: string;
  ruta: string;
  detalle: string;
  estado: EstadoRegistro;
}