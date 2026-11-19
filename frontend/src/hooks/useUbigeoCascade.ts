/**
 * ENT-M01-02 / M01-UBIGEO: Custom Hook de Selector en Cascada de Ubigeo Nacional
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * 
 * Consume la API REST oficial respaldada por PostgreSQL como única fuente de verdad:
 * - 25 Departamentos del Perú (24 + Callao)
 * - 196 Provincias
 * - 1,893 Distritos (con actualizaciones territoriales Ley 32403 y Ley 32729)
 * 
 * Reseteo descendente estricto:
 * - Al cambiar departamento se limpian provincia y distrito.
 * - Al cambiar provincia se limpia distrito.
 * - Cero arrays estáticos en memoria; consulta dinámica 100% persistente en PostgreSQL.
 * - Manejo reactivo de estados de carga (cargando) y errores de red/servicio (error).
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { UbigeoItem, UbigeoDTO } from '../types/ubigeo';
import {
  DEPARTAMENTO_UCAYALI,
  DEPARTAMENTO_UCAYALI_ID,
} from '../data/ucayali';
import {
  fetchDepartamentos,
  fetchProvincias,
  fetchDistritos,
} from '../services/ubigeoService';

export type { UbigeoItem, UbigeoDTO };

export interface UseUbigeoCascadeOptions {
  initialDepartamentoId?: string;
  initialProvinciaId?: string;
  initialDistritoId?: string;
  soloUcayali?: boolean;
  onChange?: (ubigeoCod: string, dto: UbigeoDTO) => void;
}

export interface UseUbigeoCascadeReturn {
  departamento: UbigeoItem | null;
  departamentos: ReadonlyArray<UbigeoItem>;
  provinciaSeleccionada: UbigeoItem | null;
  distritoSeleccionado: UbigeoItem | null;
  provincias: ReadonlyArray<UbigeoItem>;
  distritosDisponibles: ReadonlyArray<UbigeoItem>;
  ubigeoCod: string;
  ubigeoDTO: UbigeoDTO;
  cargando: boolean;
  error: string | null;
  seleccionarDepartamento: (departamentoId: string) => void;
  seleccionarProvincia: (provinciaId: string) => void;
  seleccionarDistrito: (distritoId: string) => void;
  limpiarSeleccion: () => void;
}

export const useUbigeoCascade = (
  options: UseUbigeoCascadeOptions = {}
): UseUbigeoCascadeReturn => {
  const {
    initialDepartamentoId = '',
    initialProvinciaId = '',
    initialDistritoId = '',
    soloUcayali = true,
    onChange,
  } = options;

  const deptoInicial = soloUcayali
    ? DEPARTAMENTO_UCAYALI_ID
    : (initialDepartamentoId || (initialProvinciaId ? initialProvinciaId.slice(0, 2) : ''));

  const [departamentoId, setDepartamentoId] = useState<string>(deptoInicial);
  const [provinciaId, setProvinciaId] = useState<string>(initialProvinciaId);
  const [distritoId, setDistritoId] = useState<string>(initialDistritoId);
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [listaDepartamentos, setListaDepartamentos] = useState<ReadonlyArray<UbigeoItem>>(() => {
    return soloUcayali ? [DEPARTAMENTO_UCAYALI] : [];
  });

  const [listaProvincias, setListaProvincias] = useState<ReadonlyArray<UbigeoItem>>([]);
  const [listaDistritos, setListaDistritos] = useState<ReadonlyArray<UbigeoItem>>([]);

  // Carga inicial de departamentos si es modo nacional
  useEffect(() => {
    if (soloUcayali) {
      setListaDepartamentos([DEPARTAMENTO_UCAYALI]);
      return;
    }
    let activo = true;
    fetchDepartamentos()
      .then((items) => {
        if (activo && items && items.length > 0) {
          setListaDepartamentos(items);
        }
      })
      .catch((err: unknown) => {
        if (activo) {
          const msg = err instanceof Error ? err.message : 'Error al conectar con el catálogo de departamentos';
          setError(msg);
        }
      });
    return () => {
      activo = false;
    };
  }, [soloUcayali]);

  // Carga asíncrona de provincias cuando cambia el departamento o en modo regional Ucayali
  useEffect(() => {
    const targetDeptId = soloUcayali ? DEPARTAMENTO_UCAYALI_ID : departamentoId;
    if (!targetDeptId) {
      setListaProvincias([]);
      return;
    }
    let activo = true;
    setCargando(true);
    fetchProvincias(targetDeptId)
      .then((items) => {
        if (activo) {
          setListaProvincias(items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (activo) {
          const msg = err instanceof Error ? err.message : 'Error al cargar provincias';
          setError(msg);
          setListaProvincias([]);
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [departamentoId, soloUcayali]);

  // Carga asíncrona de distritos cuando cambia la provincia
  useEffect(() => {
    if (!provinciaId) {
      setListaDistritos([]);
      return;
    }
    let activo = true;
    setCargando(true);
    fetchDistritos(provinciaId)
      .then((items) => {
        if (activo) {
          setListaDistritos(items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (activo) {
          const msg = err instanceof Error ? err.message : 'Error al cargar distritos';
          setError(msg);
          setListaDistritos([]);
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [provinciaId]);

  // Resolución de objetos seleccionados
  const departamento = useMemo<UbigeoItem | null>(() => {
    if (soloUcayali) return DEPARTAMENTO_UCAYALI;
    if (!departamentoId) return null;
    return listaDepartamentos.find((d) => d.id === departamentoId) || { id: departamentoId, nombre: 'DEPARTAMENTO ' + departamentoId };
  }, [soloUcayali, departamentoId, listaDepartamentos]);

  const provinciaSeleccionada = useMemo<UbigeoItem | null>(() => {
    if (!provinciaId) return null;
    return listaProvincias.find((p) => p.id === provinciaId) || null;
  }, [provinciaId, listaProvincias]);

  const distritoSeleccionado = useMemo<UbigeoItem | null>(() => {
    if (!distritoId) return null;
    return listaDistritos.find((d) => d.id === distritoId) || null;
  }, [distritoId, listaDistritos]);

  // Código INEI de 6 dígitos
  const ubigeoCod = useMemo<string>(() => {
    if (distritoId && distritoId.length === 6) return distritoId;
    if (distritoSeleccionado) return distritoSeleccionado.id;
    if (provinciaId && provinciaId.length === 4) return `${provinciaId}00`;
    if (provinciaSeleccionada) return `${provinciaSeleccionada.id}00`;
    if (departamento) return `${departamento.id}0000`;
    if (departamentoId && departamentoId.length === 2) return `${departamentoId}0000`;
    return '000000';
  }, [distritoId, distritoSeleccionado, provinciaId, provinciaSeleccionada, departamento, departamentoId]);

  const ubigeoDTO = useMemo<UbigeoDTO>(() => {
    return {
      departamento: departamento || (soloUcayali ? DEPARTAMENTO_UCAYALI : null),
      provincia: provinciaSeleccionada,
      distrito: distritoSeleccionado,
      ubigeoCod,
    };
  }, [departamento, soloUcayali, provinciaSeleccionada, distritoSeleccionado, ubigeoCod]);

  // Cambio de Departamento -> Limpia provincia y distrito descendente
  const seleccionarDepartamento = useCallback(
    (nuevoDepartamentoId: string) => {
      if (soloUcayali) return;
      setDepartamentoId(nuevoDepartamentoId);
      setProvinciaId('');
      setDistritoId('');
      setListaDistritos([]);
      setError(null);

      if (onChange) {
        const depObj = listaDepartamentos.find((d) => d.id === nuevoDepartamentoId) || null;
        const cod = depObj ? `${depObj.id}0000` : '000000';
        onChange(cod, {
          departamento: depObj,
          provincia: null,
          distrito: null,
          ubigeoCod: cod,
        });
      }
    },
    [listaDepartamentos, soloUcayali, onChange]
  );

  // Cambio de Provincia -> Limpia distrito descendente
  const seleccionarProvincia = useCallback(
    (nuevaProvinciaId: string) => {
      setProvinciaId(nuevaProvinciaId);
      setDistritoId('');
      setError(null);

      if (onChange) {
        const provObj = listaProvincias.find((p) => p.id === nuevaProvinciaId) || null;
        const depActual = soloUcayali ? DEPARTAMENTO_UCAYALI : departamento;
        const codTemp = provObj ? `${provObj.id}00` : (depActual ? `${depActual.id}0000` : '000000');
        onChange(codTemp, {
          departamento: depActual,
          provincia: provObj,
          distrito: null,
          ubigeoCod: codTemp,
        });
      }
    },
    [soloUcayali, listaProvincias, departamento, onChange]
  );

  // Cambio de Distrito -> Emite DTO completo
  const seleccionarDistrito = useCallback(
    (nuevoDistritoId: string) => {
      setDistritoId(nuevoDistritoId);

      if (onChange && nuevoDistritoId) {
        const distObj = listaDistritos.find((d) => d.id === nuevoDistritoId) || null;
        const depActual = soloUcayali ? DEPARTAMENTO_UCAYALI : departamento;
        onChange(nuevoDistritoId, {
          departamento: depActual,
          provincia: provinciaSeleccionada,
          distrito: distObj,
          ubigeoCod: nuevoDistritoId,
        });
      }
    },
    [soloUcayali, listaDistritos, departamento, provinciaSeleccionada, onChange]
  );

  const limpiarSeleccion = useCallback(() => {
    if (!soloUcayali) {
      setDepartamentoId('');
      setListaProvincias([]);
    }
    setProvinciaId('');
    setDistritoId('');
    setListaDistritos([]);
    setError(null);

    if (onChange) {
      const depDefault = soloUcayali ? DEPARTAMENTO_UCAYALI : null;
      onChange(depDefault ? `${depDefault.id}0000` : '000000', {
        departamento: depDefault,
        provincia: null,
        distrito: null,
        ubigeoCod: depDefault ? `${depDefault.id}0000` : '000000',
      });
    }
  }, [soloUcayali, onChange]);

  return {
    departamento,
    departamentos: listaDepartamentos,
    provinciaSeleccionada,
    distritoSeleccionado,
    provincias: listaProvincias,
    distritosDisponibles: listaDistritos,
    ubigeoCod,
    ubigeoDTO,
    cargando,
    error,
    seleccionarDepartamento,
    seleccionarProvincia,
    seleccionarDistrito,
    limpiarSeleccion,
  };
};
