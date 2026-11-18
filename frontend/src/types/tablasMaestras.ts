// Modelos de tablas maestras y organigrama Materialized Path (ENT-M05-05)
// Alineado al documento SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-02 y API /api/v1/admin/tablas-maestras

export type TipoTabla = "Sedes" | "Áreas" | "Tipos documentales";
export type EstadoRegistro = "Activo" | "Inactivo";

export interface RegistroMaestro {
  id: number | string;
  tipo: TipoTabla;
  codigo: string;
  nombre: string;
  detalle: string;
  estado: EstadoRegistro;
  disponible?: boolean;
}

export interface AreaOrganica {
  id: number | string;
  codigo: string;
  nombre: string;
  ruta: string;
  detalle: string;
  estado: EstadoRegistro;
}
