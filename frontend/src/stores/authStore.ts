import { useSyncExternalStore } from "react";
import { apiClient } from "../api/client";

export const AUTH_RETURN_TO_STORAGE_KEY = "SIGD_AUTH_RETURN_TO";

export interface ContextoUsuario {
  idAsignacion: string;
  tipo: 'ROL' | 'CAPACIDAD';
  codigo: string;
  nombre: string;
  areaId: string | null;
  areaCodigo?: string | null;
  areaNombre: string | null;
  permisos: { codigo: string; ambito: 'GLOBAL' | 'AREA'; areaId: string | null }[];
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
  esPredeterminado?: boolean;
}

export interface UsuarioPerfil {
  id: string;
  nombreCompleto: string;
  correo: string;
  rol: string;
  roles?: string[];
  permisos?: { codigo: string; ambito: 'GLOBAL' | 'AREA'; areaId: string | null }[];
  areaId?: string;
  contextoActivo?: ContextoUsuario;
  contextosDisponibles?: ContextoUsuario[];
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
  cerrarSesion: () => Promise<void>;
  verificarSesion: () => Promise<void>;
  seleccionarContexto: (idAsignacion: string) => Promise<void>;
  setToken: (accessToken: string, refreshToken?: string | null, autorizacion?: Pick<UsuarioPerfil, 'roles' | 'permisos'>) => void;
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
  let cierrePendiente: Promise<void> | null = null;

  let state: AuthState = {
    ...initialPersisted,
    cerrarSesion: () => {
      if (cierrePendiente) return cierrePendiente;
      const refreshToken = state.refreshToken;
      cierrePendiente = (async () => {
        if (refreshToken) {
          const respuesta = await apiClient.post('/api/v1/auth/logout', { refreshToken });
          if (respuesta.status !== 200 || respuesta.data?.ok !== true) {
            throw new Error('El servidor no confirmó el cierre de sesión.');
          }
        }
        state.logout();
      })().finally(() => { cierrePendiente = null; });
      return cierrePendiente;
    },
    verificarSesion: async () => {
      const token = state.accessToken;
      if (!token) return;
      try {
        const respuesta = await apiClient.get<{
          id: string;
          nombreCompleto: string;
          correo: string;
          rol: string;
          roles?: string[];
          permisos?: { codigo: string; ambito: 'GLOBAL' | 'AREA'; areaId: string | null }[];
          areaId?: string;
          contextoActivo?: ContextoUsuario;
          contextosDisponibles?: ContextoUsuario[];
          contextoRevocado?: boolean;
          requiereSeleccionContexto?: boolean;
        }>('/api/v1/auth/me');
        if (respuesta.status === 200 && respuesta.data) {
          const d = respuesta.data;
          set((s) => ({
            ...s,
            usuario: {
              id: d.id,
              nombreCompleto: d.nombreCompleto,
              correo: d.correo,
              rol: d.rol,
              roles: Array.isArray(d.roles) ? d.roles : (d.rol ? [d.rol] : []),
              permisos: Array.isArray(d.permisos) ? d.permisos : [],
              areaId: d.areaId,
              contextoActivo: d.contextoRevocado ? undefined : d.contextoActivo,
              contextosDisponibles: d.contextosDisponibles,
            },
            isAuthenticated: true,
          }));
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              if (d.rol) window.localStorage.setItem("sigd_rol", d.rol);
              if (Array.isArray(d.roles)) window.localStorage.setItem("sigd_roles", JSON.stringify(d.roles));
              if (Array.isArray(d.permisos)) window.localStorage.setItem("sigd_facultades", JSON.stringify(d.permisos));
              if (d.contextoActivo && !d.contextoRevocado) {
                window.localStorage.setItem("sigd_contexto_activo", JSON.stringify(d.contextoActivo));
              } else {
                window.localStorage.removeItem("sigd_contexto_activo");
              }
            }
          } catch {
            // Ignorar errores de almacenamiento local
          }
        }
      } catch {
        // En caso de 401, apiClient se encarga de renovar o llamar a logout().
        // Si hay error de red o servidor, preservamos el estado local para resiliencia offline.
      }
    },
    seleccionarContexto: async (idAsignacion: string) => {
      const { data } = await apiClient.post<{
        ok: boolean;
        contextoActivo: ContextoUsuario;
        accessToken: string;
        mensaje: string;
      }>('/api/v1/auth/seleccionar-contexto', { idAsignacion });

      if (data?.ok && data.contextoActivo) {
        const nuevoCtx = data.contextoActivo;
        set((s) => ({
          ...s,
          accessToken: data.accessToken,
          usuario: s.usuario
            ? {
                ...s.usuario,
                rol: nuevoCtx.codigo,
                roles: [nuevoCtx.codigo],
                permisos: nuevoCtx.permisos,
                areaId: nuevoCtx.areaId ?? undefined,
                contextoActivo: nuevoCtx,
              }
            : null,
        }));
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('sigd_token', data.accessToken);
            window.localStorage.setItem('token', data.accessToken);
            window.localStorage.setItem('sigd_rol', nuevoCtx.codigo);
            window.localStorage.setItem('sigd_facultades', JSON.stringify(nuevoCtx.permisos));
            window.localStorage.setItem('sigd_contexto_activo', JSON.stringify(nuevoCtx));
          }
        } catch {
          // ignore
        }
      }
    },
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
          } else window.localStorage.removeItem("sigd_rol");
          window.localStorage.setItem("sigd_facultades", JSON.stringify(data.usuario?.permisos ?? []));
          if (Array.isArray(data.usuario?.roles)) window.localStorage.setItem("sigd_roles", JSON.stringify(data.usuario.roles));
          else window.localStorage.removeItem("sigd_roles");
          if (data.usuario?.contextoActivo) {
            window.localStorage.setItem("sigd_contexto_activo", JSON.stringify(data.usuario.contextoActivo));
          }
          window.localStorage.removeItem("sigd_permisos");
        }
      } catch {
        // Ignore storage errors
      }
    },
    logout: () => {
      set({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
      try {
        window.sessionStorage.removeItem('sigd_token');
        window.sessionStorage.removeItem('token');
      } catch {
        // El cierre local también funciona cuando el navegador restringe el almacenamiento.
      }
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem("sigd_token");
          window.localStorage.removeItem("token");
          window.localStorage.removeItem("sigd_rol");
          window.localStorage.removeItem("sigd_permisos");
          window.localStorage.removeItem("sigd_facultades");
          window.localStorage.removeItem("sigd_roles");
          window.localStorage.removeItem("sigd_contexto_activo");
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
    setToken: (accessToken: string, refreshToken: string | null = null, autorizacion?: Pick<UsuarioPerfil, 'roles' | 'permisos'>) => {
      if (autorizacion && typeof window !== 'undefined') {
        window.localStorage.setItem('sigd_facultades', JSON.stringify(autorizacion.permisos ?? []));
        window.localStorage.setItem('sigd_roles', JSON.stringify(autorizacion.roles ?? []));
      }
      set((s) => ({
        accessToken,
        refreshToken: refreshToken ?? s.refreshToken,
        isAuthenticated: true,
        ...(autorizacion && s.usuario ? { usuario: { ...s.usuario, ...autorizacion } } : {}),
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
