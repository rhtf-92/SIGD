/**
 * ENT-M01-02: Custom Hook para Cascada Territorial Nacional
 * Sistema Integral de Gestión Documentaria (SIGD)
 */

import { useState, useMemo, useCallback } from 'react';
import {
  DEPARTAMENTOS_PERU,
  PROVINCIAS_PERU,
  DISTRITOS_PERU,
  type UbigeoDTO,
} from '../data/ucayali';

export interface UseUbigeoCascadeOptions {
  initialDepartamentoId?: string;
  initialProvinciaId?: string;
  initialDistritoId?: string;
  onChange?: (dto: UbigeoDTO) => void;
}

export const useUbigeoCascade = ({
  initialDepartamentoId = '',
  initialProvinciaId = '',
  initialDistritoId = '',
  onChange,
}: UseUbigeoCascadeOptions = {}) => {
  const [departamentoId, setDepartamentoId] = useState<string>(initialDepartamentoId);
  const [provinciaId, setProvinciaId] = useState<string>(initialProvinciaId);
  const [distritoId, setDistritoId] = useState<string>(initialDistritoId);

  const departamentoSeleccionado = useMemo(
    () => DEPARTAMENTOS_PERU.find((d) => d.id === departamentoId) || null,
    [departamentoId]
  );

  const provinciasDisponibles = useMemo(
    () => (departamentoId ? PROVINCIAS_PERU.filter((p) => p.padreId === departamentoId) : []),
    [departamentoId]
  );

  const provinciaSeleccionada = useMemo(
    () => provinciasDisponibles.find((p) => p.id === provinciaId) || null,
    [provinciasDisponibles, provinciaId]
  );

  const distritosDisponibles = useMemo(
    () => (provinciaId ? DISTRITOS_PERU.filter((d) => d.padreId === provinciaId) : []),
    [provinciaId]
  );

  const distritoSeleccionado = useMemo(
    () => distritosDisponibles.find((d) => d.id === distritoId) || null,
    [distritosDisponibles, distritoId]
  );

  const ubigeoCod = distritoId || provinciaId || departamentoId || '';

  const emitirCambio = useCallback(
    (deptId: string, provId: string, distId: string) => {
      if (!onChange) return;
      const dept = DEPARTAMENTOS_PERU.find((d) => d.id === deptId) || null;
      const prov = PROVINCIAS_PERU.find((p) => p.id === provId) || null;
      const dist = DISTRITOS_PERU.find((d) => d.id === distId) || null;

      onChange({
        departamento: dept,
        provincia: prov,
        distrito: dist,
        ubigeoCod: distId || provId || deptId || '',
      });
    },
    [onChange]
  );

  const seleccionarDepartamento = useCallback(
    (nuevoDeptId: string) => {
      setDepartamentoId(nuevoDeptId);
      setProvinciaId(''); // Bloquea y reinicia Provincia
      setDistritoId('');  // Bloquea y reinicia Distrito
      emitirCambio(nuevoDeptId, '', '');
    },
    [emitirCambio]
  );

  const seleccionarProvincia = useCallback(
    (nuevaProvId: string) => {
      setProvinciaId(nuevaProvId);
      setDistritoId(''); // Bloquea y reinicia Distrito
      emitirCambio(departamentoId, nuevaProvId, '');
    },
    [departamentoId, emitirCambio]
  );

  const seleccionarDistrito = useCallback(
    (nuevoDistId: string) => {
      setDistritoId(nuevoDistId);
      emitirCambio(departamentoId, provinciaId, nuevoDistId);
    },
    [departamentoId, provinciaId, emitirCambio]
  );

  const limpiarSeleccion = useCallback(() => {
    setDepartamentoId('');
    setProvinciaId('');
    setDistritoId('');
    emitirCambio('', '', '');
  }, [emitirCambio]);

  return {
    departamentos: DEPARTAMENTOS_PERU,
    departamento: departamentoSeleccionado, // Alias por retrocompatibilidad
    departamentoSeleccionado,
    provinciaSeleccionada,
    distritoSeleccionado,
    provincias: provinciasDisponibles,      // Alias por retrocompatibilidad
    provinciasDisponibles,
    distritosDisponibles,
    ubigeoCod,
    seleccionarDepartamento,
    seleccionarProvincia,
    seleccionarDistrito,
    limpiarSeleccion,
  };
};