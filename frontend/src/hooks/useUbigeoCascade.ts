/**
 * ENT-M01-02: Custom Hook de Selector en Cascada de Ubigeo
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * 
 * Maneja la lógica de selección encadenada para el departamento de Ucayali (25),
 * filtrado por caché en memoria de provincias/distritos y reseteo descendente automático.
 * 
 * @author Ángel Jesús Vásquez Godoy (F_JESUS)
 * @role Especialista de Integración (Ubigeo y SIAGIE) - Sub-equipo Grupo 2
 * @version 1.0.1
 */

import { useState, useMemo, useCallback } from 'react';
import {
  DEPARTAMENTO_UCAYALI,
  PROVINCIAS_UCAYALI,
  DISTRITOS_UCAYALI,
} from '../data/ucayali';
import type { UbigeoItem, UbigeoDTO } from '../data/ucayali';

export interface UseUbigeoCascadeOptions {
  initialProvinciaId?: string;
  initialDistritoId?: string;
  onChange?: (ubigeoCod: string, dto: UbigeoDTO) => void;
}

export interface UseUbigeoCascadeReturn {
  departamento: UbigeoItem;
  provinciaSeleccionada: UbigeoItem | null;
  distritoSeleccionado: UbigeoItem | null;
  provincias: ReadonlyArray<UbigeoItem>;
  distritosDisponibles: ReadonlyArray<UbigeoItem>;
  ubigeoCod: string;
  ubigeoDTO: UbigeoDTO;
  seleccionarProvincia: (provinciaId: string) => void;
  seleccionarDistrito: (distritoId: string) => void;
  limpiarSeleccion: () => void;
}

export const useUbigeoCascade = (
  options: UseUbigeoCascadeOptions = {}
): UseUbigeoCascadeReturn => {
  const { initialProvinciaId = '', initialDistritoId = '', onChange } = options;

  const [provinciaId, setProvinciaId] = useState<string>(initialProvinciaId);
  const [distritoId, setDistritoId] = useState<string>(initialDistritoId);

  // Caché local síncrona de provincias
  const provincias = useMemo<ReadonlyArray<UbigeoItem>>(() => {
    return PROVINCIAS_UCAYALI;
  }, []);

  // Caché local síncrona: Filtrado dinámico de distritos según provincia seleccionada
  const distritosDisponibles = useMemo<ReadonlyArray<UbigeoItem>>(() => {
    if (!provinciaId) return [];
    return DISTRITOS_UCAYALI.filter((d) => d.padreId === provinciaId);
  }, [provinciaId]);

  // Resolución de objetos seleccionados
  const provinciaSeleccionada = useMemo<UbigeoItem | null>(() => {
    if (!provinciaId) return null;
    return provincias.find((p) => p.id === provinciaId) || null;
  }, [provinciaId, provincias]);

  const distritoSeleccionado = useMemo<UbigeoItem | null>(() => {
    if (!distritoId) return null;
    return distritosDisponibles.find((d) => d.id === distritoId) || null;
  }, [distritoId, distritosDisponibles]);

  // Cálculo del código INEI de 6 dígitos oficial
  const ubigeoCod = useMemo<string>(() => {
    if (distritoSeleccionado) return distritoSeleccionado.id;
    if (provinciaSeleccionada) return `${provinciaSeleccionada.id}00`;
    return `${DEPARTAMENTO_UCAYALI.id}0000`;
  }, [distritoSeleccionado, provinciaSeleccionada]);

  // Objeto DTO completo resultante
  const ubigeoDTO = useMemo<UbigeoDTO>(() => {
    return {
      departamento: DEPARTAMENTO_UCAYALI,
      provincia: provinciaSeleccionada,
      distrito: distritoSeleccionado,
      ubigeoCod,
    };
  }, [provinciaSeleccionada, distritoSeleccionado, ubigeoCod]);

  // Reseteo automático descendente al cambiar provincia
  const seleccionarProvincia = useCallback(
    (nuevaProvinciaId: string) => {
      setProvinciaId(nuevaProvinciaId);
      setDistritoId(''); // Resetea el distrito automáticamente

      if (onChange) {
        const prov = provincias.find((p) => p.id === nuevaProvinciaId) || null;
        const codTemp = prov ? `${prov.id}00` : `${DEPARTAMENTO_UCAYALI.id}0000`;
        const dtoTemp: UbigeoDTO = {
          departamento: DEPARTAMENTO_UCAYALI,
          provincia: prov,
          distrito: null,
          ubigeoCod: codTemp,
        };
        onChange(codTemp, dtoTemp);
      }
    },
    [provincias, onChange]
  );

  const seleccionarDistrito = useCallback(
    (nuevoDistritoId: string) => {
      setDistritoId(nuevoDistritoId);

      if (onChange) {
        const dist = DISTRITOS_UCAYALI.find((d) => d.id === nuevoDistritoId) || null;
        const codTemp = dist ? dist.id : provinciaSeleccionada ? `${provinciaSeleccionada.id}00` : `${DEPARTAMENTO_UCAYALI.id}0000`;
        const dtoTemp: UbigeoDTO = {
          departamento: DEPARTAMENTO_UCAYALI,
          provincia: provinciaSeleccionada,
          distrito: dist,
          ubigeoCod: codTemp,
        };
        onChange(codTemp, dtoTemp);
      }
    },
    [provinciaSeleccionada, onChange]
  );

  const limpiarSeleccion = useCallback(() => {
    setProvinciaId('');
    setDistritoId('');
    if (onChange) {
      const dtoVacio: UbigeoDTO = {
        departamento: DEPARTAMENTO_UCAYALI,
        provincia: null,
        distrito: null,
        ubigeoCod: `${DEPARTAMENTO_UCAYALI.id}0000`,
      };
      onChange(`${DEPARTAMENTO_UCAYALI.id}0000`, dtoVacio);
    }
  }, [onChange]);

  return {
    departamento: DEPARTAMENTO_UCAYALI,
    provinciaSeleccionada,
    distritoSeleccionado,
    provincias,
    distritosDisponibles,
    ubigeoCod,
    ubigeoDTO,
    seleccionarProvincia,
    seleccionarDistrito,
    limpiarSeleccion,
  };
};