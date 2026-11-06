/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual y Ventanilla Presencial
 * TAREA: Hook Reactivo y Resiliente del Catálogo Institucional TUPA 2026
 * ARCHIVO: frontend/src/hooks/useCatalogoTupa.ts
 * ==============================================================================
 * DESCRIPCIÓN:
 * Hook reactivo para la consulta unificada del catálogo oficial de procedimientos
 * TUPA institucional (48 modalidades canónicas + Trámite Libre Institucional).
 *
 * Características:
 * - Consulta remota a `GET /api/v1/tramites/tipos` con cache y reconciliación.
 * - Resiliente fallback offline inmediato a `PROCEDIMIENTOS_TUPA_2026` + `LIBRE-01`.
 * - Mapeo y normalización rigurosa de propiedades: id (UUID), código, nombre,
 *   requisitos documentarios, derecho de pago / arancel, dependencia receptora,
 *   tiempo máximo legal y bandera esTupa.
 * - Soporte bidireccional de búsqueda por UUID, código canónico ("TUPA-01")
 *   y código numérico corto ("01").
 * - Cero 'any', 100% TypeScript estricto con garantías de accesibilidad y estabilidad.
 * ==============================================================================
 */

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import {
  PROCEDIMIENTOS_TUPA_2026,
  type ProcedimientoTupa2026,
} from '../data/tupaPasco2026';

/**
 * Contrato canónico de un procedimiento en el catálogo unificado
 */
export interface ProcedimientoCatalogo {
  /** Identificador único (UUID de persistencia en PostgreSQL 18) */
  readonly id: string;
  /** Código formal estandarizado (ej: "TUPA-01", "TUPA-48", "LIBRE-01") */
  readonly codigo: string;
  /** Código numérico corto o alias de ventanilla (ej: "01", "48", "LIBRE") */
  readonly codigoCorto: string;
  /** Denominación oficial del procedimiento según TUPA institucional */
  readonly nombre: string;
  /** Lista de requisitos documentarios requeridos para la admisibilidad */
  readonly requisitos: readonly string[];
  /** Tasa, arancel o derecho de trámite oficial (en soles o gratuidad) */
  readonly derechoPago: string;
  /** Unidad orgánica o dependencia receptora competente */
  readonly dependencia: string;
  /** Plazo legal máximo de atención (según TUPA y TUO Ley N° 27444) */
  readonly tiempoMaximo: string;
  /** Indicador de si corresponde al marco TUPA institucional */
  readonly esTupa: boolean;
  /** Autoridad que emite el pronunciamiento o acto resolutivo */
  readonly autoridad?: string;
  /** Desglose específico de tarifas o modalidades cuando aplica */
  readonly detalleTarifas?: readonly string[];
  /** Notas jurídicas o precisiones normativas */
  readonly nota?: string;
}

/**
 * Genera el UUID canónico determinista para un código TUPA o trámite general,
 * asegurando correspondencia 1:1 con el seeding DDL de `04_sigd_doc.sql`.
 */
export function getCanonicalUuidForCodigo(codigo: string): string {
  const limpio = (codigo || '').trim().toUpperCase();
  if (limpio.startsWith('LIBRE') || limpio === 'NO_TUPA') {
    return '00000000-0000-0000-0001-000000000099';
  }
  const match = limpio.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (num >= 1 && num <= 999) {
      return `00000000-0000-0000-0001-${String(num).padStart(12, '0')}`;
    }
  }
  return '00000000-0000-0000-0001-000000000001';
}

/**
 * Trámite Libre Institucional oficial (No TUPA / Solicitudes generales no tarifadas)
 */
export const TRAMITE_LIBRE_INSTITUCIONAL: ProcedimientoCatalogo = {
  id: '00000000-0000-0000-0001-000000000099',
  codigo: 'LIBRE-01',
  codigoCorto: 'LIBRE',
  nombre: 'Solicitud Formal General / Trámite Libre Institucional',
  requisitos: [
    'Solicitud formal dirigida a la Dirección General o Formato Único de Trámite (FUT)',
    'Copia legible de DNI o documento de identidad oficial del administrado',
    'Documentación probatoria o antecedentes de sustento que respalden la pretensión',
  ],
  derechoPago: 'Gratuito',
  dependencia: 'Mesa de Partes General',
  tiempoMaximo: '30 días hábiles (LPAG Ley N° 27444)',
  esTupa: false,
  autoridad: 'Dirección General / Secretaría General',
  nota: 'Trámite libre general no sujeto a tasa arancelaria, amparado en el Art. 117 del TUO de la Ley N° 27444.',
};

/**
 * Catálogo completo offline de 48 trámites TUPA + Trámite Libre General
 */
export const CATALOGO_TUPA_COMPLETO_FALLBACK: readonly ProcedimientoCatalogo[] = [
  ...PROCEDIMIENTOS_TUPA_2026.map((p: ProcedimientoTupa2026): ProcedimientoCatalogo => {
    const codigoPad = p.codigo.padStart(2, '0');
    return {
      id: getCanonicalUuidForCodigo(codigoPad),
      codigo: `TUPA-${codigoPad}`,
      codigoCorto: codigoPad,
      nombre: p.nombre,
      requisitos: p.requisitos ?? [],
      derechoPago:
        p.derechoPago ??
        (p.detalleTarifas && p.detalleTarifas.length > 0
          ? 'Tarifas según servicio y alquiler'
          : 'Gratuito'),
      dependencia: p.dependencia ?? 'Mesa de Partes / Secretaría Académica',
      tiempoMaximo: p.tiempoMaximo ?? '30 días hábiles',
      esTupa: true,
      autoridad: p.autoridad,
      detalleTarifas: p.detalleTarifas,
      nota: p.nota,
    };
  }),
  TRAMITE_LIBRE_INSTITUCIONAL,
];

interface FilaBackendTipoTramite {
  readonly id?: string;
  readonly id_tipo_tramite?: string;
  readonly id_tipo_tramite_tupa?: string;
  readonly codigo?: string;
  readonly denominacion?: string;
  readonly nombre?: string;
  readonly descripcion?: string;
  readonly unidad_organica?: string;
  readonly dependencia?: string;
  readonly plazo_dias?: number;
  readonly tiempoMaximo?: string;
  readonly silencio_administrativo?: string;
  readonly base_legal?: string;
  readonly derecho_pago?: string;
  readonly derechoPago?: string;
  readonly arancel?: string;
  readonly requisitos?: readonly string[];
  readonly es_tupa?: boolean;
  readonly esTupa?: boolean;
}

/**
 * Normaliza las filas devueltas por el endpoint Express `/api/v1/tramites/tipos`
 */
function normalizarProcedimientosBackend(
  filas: readonly FilaBackendTipoTramite[],
): readonly ProcedimientoCatalogo[] {
  const normalizados: ProcedimientoCatalogo[] = [];
  let tieneLibre = false;

  for (const fila of filas) {
    const rawCodigo = String(fila.codigo ?? '').trim();
    if (!rawCodigo) continue;

    const rawId = String(
      fila.id ?? fila.id_tipo_tramite ?? fila.id_tipo_tramite_tupa ?? '',
    ).trim();
    const codigoCorto = rawCodigo.replace(/^TUPA-?/i, '');
    const esLibre = rawCodigo.toUpperCase().startsWith('LIBRE');
    if (esLibre) tieneLibre = true;

    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)
        ? rawId
        : getCanonicalUuidForCodigo(rawCodigo);

    // Enlace de enriquecimiento con el diccionario local de respaldo
    const fallbackItem = PROCEDIMIENTOS_TUPA_2026.find(
      (p) => p.codigo === codigoCorto || `TUPA-${p.codigo}` === rawCodigo,
    );

    const requisitosBackend = Array.isArray(fila.requisitos)
      ? fila.requisitos
      : [];
    const requisitosFinales =
      requisitosBackend.length > 0
        ? requisitosBackend
        : fallbackItem?.requisitos ??
          (esLibre ? TRAMITE_LIBRE_INSTITUCIONAL.requisitos : []);

    const derechoPagoFinal = String(
      fila.derechoPago ??
        fila.derecho_pago ??
        fila.arancel ??
        fallbackItem?.derechoPago ??
        (esLibre ? 'Gratuito' : 'Gratuito'),
    );

    const dependenciaFinal = String(
      fila.dependencia ??
        fila.unidad_organica ??
        fallbackItem?.dependencia ??
        'Mesa de Partes',
    );

    const plazoDias =
      typeof fila.plazo_dias === 'number' ? fila.plazo_dias : undefined;
    const tiempoMaximoFinal = String(
      fila.tiempoMaximo ??
        (plazoDias ? `${plazoDias} días hábiles` : undefined) ??
        fallbackItem?.tiempoMaximo ??
        '30 días hábiles',
    );

    normalizados.push({
      id: uuid,
      codigo:
        rawCodigo.toUpperCase().startsWith('TUPA-') || esLibre
          ? rawCodigo
          : `TUPA-${rawCodigo}`,
      codigoCorto,
      nombre: String(
        fila.nombre ?? fila.denominacion ?? fallbackItem?.nombre ?? '',
      ),
      requisitos: requisitosFinales,
      derechoPago: derechoPagoFinal,
      dependencia: dependenciaFinal,
      tiempoMaximo: tiempoMaximoFinal,
      esTupa: typeof fila.esTupa === 'boolean' ? fila.esTupa : !esLibre,
      autoridad: fallbackItem?.autoridad,
      detalleTarifas: fallbackItem?.detalleTarifas,
      nota:
        typeof fila.descripcion === 'string' && fila.descripcion.trim().length > 0
          ? fila.descripcion
          : fallbackItem?.nota,
    });
  }

  // Si el backend aún no sembró el trámite libre, lo incorporamos al final
  if (!tieneLibre) {
    normalizados.push(TRAMITE_LIBRE_INSTITUCIONAL);
  }

  return normalizados;
}

export interface UseCatalogoTupaReturn {
  /** Colección inmutable y normalizada de procedimientos institucionales */
  readonly catalogo: readonly ProcedimientoCatalogo[];
  /** Indicador de carga asíncrona de datos desde el backend */
  readonly cargando: boolean;
  /** Mensaje de error de sincronización de red si se activó el fallback */
  readonly error: string | null;
  /** Busca un procedimiento por código ("TUPA-01", "01", "LIBRE-01") o UUID */
  readonly obtenerPorCodigo: (codigo: string) => ProcedimientoCatalogo | undefined;
  /** Busca un procedimiento por UUID exacto */
  readonly obtenerPorId: (id: string) => ProcedimientoCatalogo | undefined;
}

/**
 * Hook reactivo para el consumo unificado del catálogo institucional TUPA 2026
 */
export function useCatalogoTupa(): UseCatalogoTupaReturn {
  const [catalogo, setCatalogo] = useState<readonly ProcedimientoCatalogo[]>(
    CATALOGO_TUPA_COMPLETO_FALLBACK,
  );
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargarCatalogoRemoto() {
      setCargando(true);
      try {
        const respuesta = await apiClient.get<readonly FilaBackendTipoTramite[]>(
          '/api/v1/tramites/tipos',
        );

        if (activo && Array.isArray(respuesta?.data) && respuesta.data.length > 0) {
          const normalizados = normalizarProcedimientosBackend(respuesta.data);
          if (normalizados.length > 0) {
            setCatalogo(normalizados);
            setError(null);
          }
        }
      } catch (err: unknown) {
        if (activo) {
          // Activación silenciosa y defensiva del fallback offline
          const mensaje =
            err instanceof Error ? err.message : 'Error al conectar con /tramites/tipos';
          setError(mensaje);
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargarCatalogoRemoto();

    return () => {
      activo = false;
    };
  }, []);

  const obtenerPorCodigo = useCallback(
    (codigo: string): ProcedimientoCatalogo | undefined => {
      if (!codigo) return undefined;
      const codLimpio = codigo.trim().toLowerCase();

      return catalogo.find((p) => {
        const pCodigo = p.codigo.toLowerCase();
        const pCorto = p.codigoCorto.toLowerCase();
        const pId = p.id.toLowerCase();

        return (
          pCodigo === codLimpio ||
          pCorto === codLimpio ||
          `tupa-${pCorto}` === codLimpio ||
          pId === codLimpio ||
          (codLimpio === 'no_tupa' && !p.esTupa)
        );
      });
    },
    [catalogo],
  );

  const obtenerPorId = useCallback(
    (id: string): ProcedimientoCatalogo | undefined => {
      if (!id) return undefined;
      const idLimpio = id.trim().toLowerCase();
      return catalogo.find((p) => p.id.toLowerCase() === idLimpio);
    },
    [catalogo],
  );

  return {
    catalogo,
    cargando,
    error,
    obtenerPorCodigo,
    obtenerPorId,
  };
}
