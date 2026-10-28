/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ARCHIVO: src/hooks/useProcedimientosTupa.ts
 * ==============================================================================
 * ESTADO: CONTRATO VERSIONADO INTEGRADO
 *
 * Hook único (reutilizado por /tramite y /ventanilla) para cargar el catálogo
 * TUPA del backend, exponiendo los estados UX exigidos:
 *   - cargando
 *   - listo con datos
 *   - listo pero vacío (sin registros aprobados)
 *   - error de red
 *   - error 401/403 (autorización)
 *   - error de servidor
 *
 * NUNCA reemplaza un error por un catálogo mock.
 * ==============================================================================
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { obtenerCatalogoProcedimientosTupa } from '../services/procedimientosTupa.service';
import { ApiHttpError } from '../types/api';
import type { ProcedimientoTupa } from '../types/procedimientoTupa';

export type EstadoCatalogoTupa = 'cargando' | 'listo' | 'error';

export type TipoErrorCatalogoTupa = 'red' | 'autorizacion' | 'servidor' | 'desconocido';

export interface ErrorCatalogoTupa {
  readonly tipo: TipoErrorCatalogoTupa;
  readonly mensaje: string;
  readonly status?: number;
}

export interface UseProcedimientosTupaResultado {
  readonly procedimientos: readonly ProcedimientoTupa[];
  readonly estado: EstadoCatalogoTupa;
  readonly error: ErrorCatalogoTupa | null;
  readonly cargando: boolean;
  readonly estaVacio: boolean;
  readonly recargar: () => void;
}

/**
 * Traduce el error del cliente API a un estado de UI tipado.
 */
export function clasificarErrorCatalogoTupa(err: unknown): ErrorCatalogoTupa {
  if (err instanceof ApiHttpError) {
    const status = typeof err.status === 'number' && Number.isFinite(err.status) ? err.status : undefined;

    if (status === 401 || status === 403) {
      return {
        tipo: 'autorizacion',
        status,
        mensaje:
          'No tiene autorización para consultar el catálogo TUPA (sesión expirada o permisos insuficientes).',
      };
    }
    if (typeof status === 'number' && status >= 500) {
      return {
        tipo: 'servidor',
        status,
        mensaje:
          'El servicio de catálogo TUPA no está disponible en este momento. Intente nuevamente en unos minutos.',
      };
    }
    if (status === undefined || status === 0) {
      return {
        tipo: 'red',
        mensaje: 'No se pudo conectar con el servicio de catálogo TUPA. Verifique su conexión a la red.',
      };
    }
    return {
      tipo: 'desconocido',
      status,
      mensaje: err.problemDetails?.detail || 'Ocurrió un error al consultar el catálogo TUPA.',
    };
  }

  return {
    tipo: 'red',
    mensaje: 'No se pudo conectar con el servicio de catálogo TUPA. Verifique su conexión a la red.',
  };
}

/**
 * Carga el catálogo TUPA al montar y expone un `recargar()` para reintentos.
 */
export function useProcedimientosTupa(): UseProcedimientosTupaResultado {
  const [procedimientos, setProcedimientos] = useState<ProcedimientoTupa[]>([]);
  const [estado, setEstado] = useState<EstadoCatalogoTupa>('cargando');
  const [error, setError] = useState<ErrorCatalogoTupa | null>(null);
  const [intento, setIntento] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    let activo = true;

    obtenerCatalogoProcedimientosTupa(controller.signal)
      .then((lista) => {
        if (!activo) return;
        setProcedimientos(lista);
        setEstado('listo');
      })
      .catch((err: unknown) => {
        if (!activo || controller.signal.aborted) return;
        setProcedimientos([]);
        setError(clasificarErrorCatalogoTupa(err));
        setEstado('error');
      });

    return () => {
      activo = false;
      controller.abort();
    };
  }, [intento]);

  const recargar = useCallback(() => {
    setEstado('cargando');
    setError(null);
    setIntento((previo) => previo + 1);
  }, []);

  return {
    procedimientos,
    estado,
    error,
    cargando: estado === 'cargando',
    estaVacio: estado === 'listo' && procedimientos.length === 0,
    recargar,
  };
}
