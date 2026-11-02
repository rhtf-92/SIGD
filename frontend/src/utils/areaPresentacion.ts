export interface InfoAreaPresentacion {
  codigo: string;
  nombre: string;
  badgeClase: string;
  descripcion: string;
}

export const AREA_ID_SDA = 'a0000000-0000-0000-0000-000000000001';
export const AREA_ID_DIR = 'a0000000-0000-0000-0000-000000000002';

export const AREAS_INSTITUCIONALES = [
  { id: AREA_ID_SDA, codigo: 'SDA', nombre: 'Subdirección Académica' },
  { id: AREA_ID_DIR, codigo: 'DIR', nombre: 'Dirección General' },
] as const;

export function obtenerInfoArea(
  areaId?: string | null,
  areaNombre?: string | null,
  rol?: string | null,
): InfoAreaPresentacion {
  const normalizado = (areaId ?? '').trim().toLowerCase();

  // Si coincide con Subdirección Académica
  if (normalizado === AREA_ID_SDA || normalizado === 'sda' || areaNombre?.toLowerCase().includes('acad')) {
    return {
      codigo: 'SDA',
      nombre: areaNombre?.trim() || 'Subdirección Académica',
      badgeClase: 'bg-sky-50 text-sky-800 border-sky-300',
      descripcion: 'Subdirección Académica (SDA) — Gestión académica, planes y evaluación.',
    };
  }

  // Si coincide con Dirección General o áreas asociadas a DIR
  if (normalizado === AREA_ID_DIR || normalizado === 'dir' || areaNombre?.toLowerCase().includes('direcc')) {
    if (rol === 'MESA_PARTES') {
      return {
        codigo: 'MESA',
        nombre: 'Mesa de Partes',
        badgeClase: 'bg-blue-50 text-blue-800 border-blue-300',
        descripcion: 'Mesa de Partes — Recepción y despacho inicial de trámites.',
      };
    }
    if (rol === 'TESORERIA') {
      return {
        codigo: 'TES',
        nombre: 'Tesorería',
        badgeClase: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        descripcion: 'Tesorería — Control de pagos y recaudación institucional.',
      };
    }
    return {
      codigo: 'DIR',
      nombre: areaNombre?.trim() || 'Dirección General',
      badgeClase: 'bg-indigo-50 text-indigo-800 border-indigo-300',
      descripcion: 'Dirección General (DIR) — Conducción y supervisión institucional.',
    };
  }

  // Si no hay área asignada o es nula (trámite en radicación inicial / Mesa de Partes)
  if (!areaId) {
    return {
      codigo: 'MESA',
      nombre: 'Mesa de Partes',
      badgeClase: 'bg-blue-50 text-blue-700 border-blue-200',
      descripcion: 'Mesa de Partes — En radicación o calificación inicial.',
    };
  }

  // Si vino un nombre explicito desde base de datos
  if (areaNombre && areaNombre.trim().length > 0) {
    return {
      codigo: 'AREA',
      nombre: areaNombre.trim(),
      badgeClase: 'bg-slate-100 text-slate-800 border-slate-300',
      descripcion: `Área institucional: ${areaNombre.trim()}`,
    };
  }

  // Fallback si es un UUID desconocido
  return {
    codigo: 'INST',
    nombre: 'Área Institucional',
    badgeClase: 'bg-slate-100 text-slate-800 border-slate-300',
    descripcion: `Área institucional asignada: ${areaId}`,
  };
}

export function formatearNombreArea(areaId?: string | null, areaNombre?: string | null): string {
  return obtenerInfoArea(areaId, areaNombre).nombre;
}

export function formatearCodigoArea(areaId?: string | null, rol?: string | null): string {
  return obtenerInfoArea(areaId, null, rol).codigo;
}
