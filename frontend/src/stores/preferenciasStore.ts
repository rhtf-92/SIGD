/**
 * Módulo: Preferencias personales del usuario (ENT-M05-01)
 * Preferencias de casilla, firma y notificaciones persistidas localmente.
 * No reemplaza la configuración institucional del Panel de Administración.
 */

import { useSyncExternalStore } from "react";

export interface PreferenciasUsuario {
  notifCasillaEmail: boolean;
  notifCasillaResumenDiario: boolean;
  firmaPorDefecto: boolean;
}

export const PREFERENCIAS_DEFAULT: PreferenciasUsuario = {
  notifCasillaEmail: true,
  notifCasillaResumenDiario: false,
  firmaPorDefecto: true,
};

export type ClavePreferencia = keyof PreferenciasUsuario;

export interface PreferenciasState {
  preferencias: PreferenciasUsuario;
  setPreferencia: <K extends ClavePreferencia>(
    clave: K,
    valor: PreferenciasUsuario[K]
  ) => void;
}

type SetStateFn = (actualizacion: Partial<PreferenciasState>) => void;

function crearStore() {
  const STORAGE_KEY = "sigd_preferencias";

  const cargar = (): PreferenciasUsuario => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const guardado = window.localStorage.getItem(STORAGE_KEY);
        if (guardado) {
          return { ...PREFERENCIAS_DEFAULT, ...JSON.parse(guardado) };
        }
      }
    } catch {
      // Fallback a valores por omisión
    }
    return { ...PREFERENCIAS_DEFAULT };
  };

  const persistir = (preferencias: PreferenciasUsuario) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferencias));
      }
    } catch {
      // Ignorar errores de almacenamiento
    }
  };

  let state: PreferenciasState = {
    preferencias: cargar(),
    setPreferencia: (clave, valor) => {
      const nuevas = { ...state.preferencias, [clave]: valor };
      persistir(nuevas);
      set({ preferencias: nuevas });
    },
  };

  const listeners = new Set<() => void>();

  const getState = (): PreferenciasState => state;

  const set: SetStateFn = (actualizacion) => {
    state = Object.assign({}, state, actualizacion);
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  function useStore(): PreferenciasState;
  function useStore<U>(selector: (state: PreferenciasState) => U): U;
  function useStore<U>(selector?: (state: PreferenciasState) => U): U | PreferenciasState {
    const slice = useSyncExternalStore(
      subscribe,
      () => (selector ? selector(state) : state),
      () => (selector ? selector(state) : state)
    );
    return slice;
  }

  useStore.getState = getState;
  useStore.setState = set;
  useStore.subscribe = subscribe;

  return useStore;
}

export const usePreferenciasStore = crearStore();