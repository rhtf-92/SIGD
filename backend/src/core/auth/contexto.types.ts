import type { PermisoInstitucional } from './auth.guard.js';

export type TipoContexto = 'ROL' | 'CAPACIDAD';

export interface ContextoUsuario {
  idAsignacion: string; // UUID de usuario_rol o usuario_capacidad
  tipo: TipoContexto;
  codigo: string; // e.g. DOCENTE, COORDINADOR_AREA, GESTOR_APOYO_AREA
  nombre: string;
  areaId: string | null;
  areaCodigo?: string | null;
  areaNombre: string | null;
  permisos: PermisoInstitucional[];
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
  esPredeterminado?: boolean;
}

export interface ActorContextual {
  idUsuario: string;
  contextoActivo: ContextoUsuario;
  contextosDisponibles: ContextoUsuario[];
}

export interface CambioContextoResult {
  ok: boolean;
  contextoActivo: ContextoUsuario;
  accessToken: string;
  mensaje: string;
}
