import { useSyncExternalStore } from "react";
import { apiClient } from "../api/client";
import { permisosIniciales } from "../hooks/useRbacConfig";

export interface UsuarioPerfil {
  id: string;
  nombreCompleto: string;
  correo: string;
  rol: 'SUPER_ADMIN' | 'DIRECTOR' | 'DOCENTE' | 'MESA_PARTES' | 'ESTUDIANTE';
  areaId?: string;
}

interface LoginCredentials {
  identificador: string;
  password: string;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  usuario: UsuarioPerfil | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setToken: (accessToken: string, refreshToken?: string | null) => void;
}

type SetStateFn = (
  updater: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>)
) => void;

function createStore() {
  const STORAGE_KEY = "sigd_auth";

  const loadInitialState = (): {
    accessToken: string | null;
    refreshToken: string | null;
    usuario: UsuarioPerfil | null;
    isAuthenticated: boolean;
  } => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const item = window.localStorage.getItem(STORAGE_KEY);
        if (item) {
          const parsed = JSON.parse(item);
          const state = parsed.state ?? parsed;
          return {
            accessToken: state.accessToken ?? null,
            refreshToken: state.refreshToken ?? null,
            usuario: state.usuario ?? null,
            isAuthenticated: state.isAuthenticated ?? Boolean(state.accessToken),
          };
        }
      }
    } catch {
      // Fallback
    }
    return {
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    };
  };

  const persistState = (state: AuthState) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            state: {
              accessToken: state.accessToken,
              refreshToken: state.refreshToken,
              usuario: state.usuario,
              isAuthenticated: state.isAuthenticated,
            },
            version: 0,
          })
        );
      }
    } catch {
      // Ignore
    }
  };

  const initialPersisted = loadInitialState();

  let state: AuthState = {
    ...initialPersisted,
    login: async (credentials: LoginCredentials) => {
      const { data } = await apiClient.post("/api/v1/auth/login", credentials);
      set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        usuario: data.usuario,
        isAuthenticated: true,
      });
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("sigd_token", data.accessToken);
          window.localStorage.setItem("token", data.accessToken);
          if (data.usuario?.rol) {
            window.localStorage.setItem("sigd_rol", data.usuario.rol);
          }
          if (!window.localStorage.getItem("sigd_permisos")) {
            window.localStorage.setItem("sigd_permisos", JSON.stringify(permisosIniciales));
          }
        }
      } catch {
        // Ignore storage errors
      }
    },
    logout: () => {
      set({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem("sigd_token");
          window.localStorage.removeItem("token");
          window.localStorage.removeItem("sigd_rol");
          window.localStorage.removeItem("sigd_permisos");
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }
      try {
        if (typeof window !== "undefined" && window.location) {
          window.location.href = "/login";
        }
      } catch {
        // Ignore navigation error in test environments
      }
    },
    setToken: (accessToken: string, refreshToken: string | null = null) => {
      set((s) => ({
        accessToken,
        refreshToken: refreshToken ?? s.refreshToken,
        isAuthenticated: true,
      }));
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("sigd_token", accessToken);
          window.localStorage.setItem("token", accessToken);
        }
      } catch {
        // Ignore storage errors
      }
    },
  };

  const listeners = new Set<() => void>();

  const getState = (): AuthState => state;

  const set: SetStateFn = (updater) => {
    const nextPartial = typeof updater === "function" ? updater(state) : updater;
    state = Object.assign({}, state, nextPartial);
    persistState(state);
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  function useStore(): AuthState;
  function useStore<U>(selector: (state: AuthState) => U): U;
  function useStore<U>(selector?: (state: AuthState) => U): U | AuthState {
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

export const useAuthStore = createStore();