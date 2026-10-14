import { useSyncExternalStore } from 'react';
import { apiClient } from '../api/client';

export type RolInstitucional = 'SUPER_ADMIN' | 'DIRECTOR' | 'DOCENTE' | 'MESA_PARTES' | 'ESTUDIANTE';

export interface UsuarioPerfil {
  id: string;
  idPersona?: string;
  nombreCompleto: string;
  correo: string;
  rol: RolInstitucional;
  rolesAutorizados?: RolInstitucional[];
  permisos?: string[];
  areaId?: string;
}

interface UsuarioPendiente {
  id: string;
  idPersona?: string;
  nombreCompleto: string;
  correo: string;
}

interface LoginCredentials {
  identificador: string;
  password: string;
}

interface SesionResponse {
  requiresRoleSelection: false;
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioPerfil;
}

interface SeleccionResponse {
  requiresRoleSelection: true;
  selectionToken: string;
  rolesDisponibles: RolInstitucional[];
  usuario: UsuarioPendiente;
}

export type LoginResult = { requiresRoleSelection: boolean };

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  usuario: UsuarioPerfil | null;
  isAuthenticated: boolean;
  selectionToken: string | null;
  rolesDisponibles: RolInstitucional[];
  usuarioPendiente: UsuarioPendiente | null;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  seleccionarPerfil: (rol: RolInstitucional) => Promise<void>;
  cambiarPerfil: (rol: RolInstitucional) => Promise<void>;
  logout: () => void;
  setToken: (accessToken: string, refreshToken?: string | null) => void;
}

type SetStateFn = (updater: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>)) => void;

function createStore() {
  const STORAGE_KEY = 'sigd_auth';

  const loadInitialState = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(STORAGE_KEY);
        if (item) {
          const parsed = JSON.parse(item);
          const persisted = parsed.state ?? parsed;
          return {
            accessToken: persisted.accessToken ?? null,
            refreshToken: persisted.refreshToken ?? null,
            usuario: persisted.usuario ?? null,
            isAuthenticated: Boolean(persisted.accessToken && persisted.usuario),
          };
        }
      }
    } catch {
      // Un almacenamiento corrupto no debe conceder acceso.
    }
    return { accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false };
  };

  const persistState = (current: AuthState) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          state: {
            accessToken: current.accessToken,
            refreshToken: current.refreshToken,
            usuario: current.usuario,
          },
          version: 1,
        }));
        if (current.accessToken) window.localStorage.setItem('sigd_token', current.accessToken);
        else window.localStorage.removeItem('sigd_token');
        window.localStorage.removeItem('token');
        window.localStorage.removeItem('sigd_rol');
        window.localStorage.removeItem('sigd_permisos');
      }
    } catch {
      // El estado en memoria sigue siendo válido aunque falle la persistencia.
    }
  };

  const initialPersisted = loadInitialState();
  let state: AuthState;
  const listeners = new Set<() => void>();

  const set: SetStateFn = (updater) => {
    const nextPartial = typeof updater === 'function' ? updater(state) : updater;
    state = Object.assign({}, state, nextPartial);
    persistState(state);
    listeners.forEach((listener) => listener());
  };

  const aplicarSesion = (data: SesionResponse) => {
    set({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      usuario: data.usuario,
      isAuthenticated: true,
      selectionToken: null,
      rolesDisponibles: [],
      usuarioPendiente: null,
    });
  };

  state = {
    ...initialPersisted,
    selectionToken: null,
    rolesDisponibles: [],
    usuarioPendiente: null,
    login: async (credentials) => {
      const { data } = await apiClient.post<SesionResponse | SeleccionResponse>('/api/v1/auth/login', credentials);
      if (data.requiresRoleSelection) {
        set({
          accessToken: null,
          refreshToken: null,
          usuario: null,
          isAuthenticated: false,
          selectionToken: data.selectionToken,
          rolesDisponibles: data.rolesDisponibles,
          usuarioPendiente: data.usuario,
        });
        return { requiresRoleSelection: true };
      }
      aplicarSesion(data);
      return { requiresRoleSelection: false };
    },
    seleccionarPerfil: async (rol) => {
      const selectionToken = state.selectionToken;
      if (!selectionToken || !state.rolesDisponibles.includes(rol)) {
        throw new Error('Perfil no autorizado por el servidor.');
      }
      const { data } = await apiClient.post<SesionResponse>('/api/v1/auth/select-role', { selectionToken, rol });
      aplicarSesion(data);
    },
    cambiarPerfil: async (rol) => {
      if (!state.isAuthenticated || !(state.usuario?.rolesAutorizados ?? [state.usuario?.rol]).includes(rol)) {
        throw new Error('Perfil no autorizado por el servidor.');
      }
      const { data } = await apiClient.post<SesionResponse>('/api/v1/auth/switch-role', {
        rol,
        refreshToken: state.refreshToken,
      });
      aplicarSesion(data);
    },
    logout: () => {
      set({
        accessToken: null,
        refreshToken: null,
        usuario: null,
        isAuthenticated: false,
        selectionToken: null,
        rolesDisponibles: [],
        usuarioPendiente: null,
      });
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        window.location.href = '/login';
      } catch {
        // Entornos de prueba sin navegación real.
      }
    },
    setToken: (accessToken, refreshToken = null) => {
      set((current) => ({
        accessToken,
        refreshToken: refreshToken ?? current.refreshToken,
        isAuthenticated: Boolean(current.usuario),
      }));
    },
  };

  function useStore(): AuthState;
  function useStore<U>(selector: (current: AuthState) => U): U;
  function useStore<U>(selector?: (current: AuthState) => U): U | AuthState {
    return useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => (selector ? selector(state) : state),
      () => (selector ? selector(state) : state),
    );
  }

  useStore.getState = () => state;
  useStore.setState = set;
  useStore.subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return useStore;
}

export const useAuthStore = createStore();
