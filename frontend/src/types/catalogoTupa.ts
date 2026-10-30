export type TipoCatalogo = "PROCEDIMIENTO_ADMINISTRATIVO" | "BIEN_SERVICIO_PRODUCTIVO";

export interface CatalogoTupa {
  catalogo_id: string;
  codigo: string;
  nombre: string;
  tipo_catalogo: TipoCatalogo;
  rubro: string | null;
  sub_rubro: string | null;
  dependencia: string | null;
  autoridad: string | null;
  vigente: boolean;
  version_publicada_id: string | null;
  version_publicada_numero?: number | null;
  requisitos?: unknown[];
  tarifas?: unknown[];
  monto_texto?: string | null;
  base_legal?: string | null;
  fuente?: string | null;
  vigente_desde?: string;
  vigente_hasta?: string | null;
}

export interface CatalogoTupaInput {
  codigo: string;
  nombre: string;
  tipo_catalogo: TipoCatalogo;
  rubro?: string | null;
  sub_rubro?: string | null;
  dependencia?: string | null;
  autoridad?: string | null;
  motivo: string;
}

export interface VersionCatalogoInput {
  requisitos: unknown[];
  tarifas: unknown[];
  monto_texto?: string | null;
  base_legal?: string | null;
  fuente?: string | null;
  motivo: string;
  vigente_desde: string;
  vigente_hasta?: string | null;
}
