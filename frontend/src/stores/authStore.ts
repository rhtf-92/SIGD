import { isAxiosError } from "axios";
import { useSyncExternalStore } from "react";

import { apiClient } from "../api/client";
import { notificarCambioSesion } from "../config/accesoModulos";
import { permisosIniciales } from "../hooks/useRbacConfig";

export interface UsuarioPerfil {
  id: string;
  nombreCompleto: string;
  correo: string;
  rol: 'SUPER_ADMIN' | 'DIRECTOR' | 'DOCENTE' | 'MESA_PARTES' | 'ESTUDIANTE';
  rolCodigo?: string;
  areaId?: string;
  dni?: string;
  numeroDocumento?: string;
}

interface LoginCredentials {
  identificador: string;
  password: string;
}

// Los roles canónicos del frontend (entorno RBAC ENT-M05-03) se expresan con
// los códigos del backend (migraciones 03/08). Se normaliza para que
// ProtectedRoute y la matriz `permisosIniciales` encuentren su fila.
const ROL_CANONICO: Record<string, UsuarioPerfil['rol']> = {
  ADMIN: 'SUPER_ADMIN',
  ADMINISTRADOR: 'SUPER_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  DIRECTOR: 'DIRECTOR',
  DOCENTE: 'DOCENTE',
  SECRETARIO: 'DOCENTE',
  ESPECIALISTA: 'DOCENTE',
  MESA_PARTES: 'MESA_PARTES',
  ESTUDIANTE: 'ESTUDIANTE',
  CIUDADANO: 'ESTUDIANTE',
  OTROS: 'ESTUDIANTE',
  INVITADO: 'ESTUDIANTE',
};

function normalizarRol(rol: string | null | undefined): UsuarioPerfil['rol'] {
  return ROL_CANONICO[(rol ?? '').toUpperCase()] ?? 'ESTUDIANTE';
}

function mensajeDeError(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: string; message?: string; error?: string }
      | undefined;
    const detalle = data?.detail ?? data?.message ?? data?.error;
    if (detalle) return detalle;
    if (error.code === 'ECONNABORTED') {
      return 'El servidor tardó demasiado en responder. Inténtalo nuevamente.';
    }
    if (!error.response) {
      return 'No se pudo conectar con el servidor SIGD. Verifica que el backend esté en línea.';
    }
    if (error.response.status === 401) {
      return 'Credenciales inválidas. Verifica tu usuario o contraseña institucional.';
    }
    if (error.response.status === 403) {
      return 'Tu cuenta se encuentra deshabilitada o sin permisos para ingresar.';
    }
    return `No se pudo iniciar sesión (HTTP ${error.response.status}).`;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'No se pudo iniciar sesión. Inténtalo nuevamente.';
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
          const tokenDirecto = window.localStorage.getItem("sigd_token");
          const accessToken = state.accessToken ?? tokenDirecto ?? null;
          return {
            accessToken,
            refreshToken: state.refreshToken ?? null,
            usuario: state.usuario ?? null,
            isAuthenticated: state.isAuthenticated ?? Boolean(accessToken),
          };
        }
      }
    } catch {
      // Almacenamiento no disponible: se opera en memoria.
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
      // Ignorar cuotas o modo privado.
    }
  };

  const persistirSesionLocal = (
    accessToken: string,
    usuario: UsuarioPerfil | null,
  ) => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.setItem("sigd_token", accessToken);
      window.localStorage.setItem("token", accessToken);
      window.localStorage.setItem("sigd_rol", usuario?.rol ?? "ESTUDIANTE");
      if (!window.localStorage.getItem("sigd_permisos")) {
        window.localStorage.setItem("sigd_permisos", JSON.stringify(permisosIniciales));
      }
    } catch {
      // Ignorar errores de almacenamiento.
    }
  };

  const initialPersisted = loadInitialState();

  let state: AuthState = {
    ...initialPersisted,
    login: async (credentials: LoginCredentials) => {
      try {
        const { data } = await apiClient.post("/api/v1/auth/login", credentials);

        const accessToken: string | null =
          data?.accessToken ?? data?.access_token ?? data?.token ?? null;
        const refreshToken: string | null =
          data?.refreshToken ?? data?.refresh_token ?? null;

        if (!accessToken) {
          throw new Error(
            'El servidor autenticó la solicitud pero no devolvió un token de acceso válido.',
          );
        }

        const perfil = data?.usuario ?? data?.user ?? null;
        const usuarioCanonico: UsuarioPerfil | null = perfil
          ? {
              ...(perfil as Omit<UsuarioPerfil, "rol">),
              rol: normalizarRol(perfil.rolCodigo ?? perfil.rol),
            }
          : null;

        set({
          accessToken,
          refreshToken,
          usuario: usuarioCanonico,
          isAuthenticated: true,
        });

        persistirSesionLocal(accessToken, usuarioCanonico);
        notificarCambioSesion();
      } catch (error) {
        throw new Error(mensajeDeError(error));
      }
    },
    logout: () => {
      const refreshToken = state.refreshToken;
      if (refreshToken) {
        void apiClient
          .post("/api/v1/auth/logout", { refreshToken })
          .catch(() => {
            // La revocación es best-effort: la sesión local se cierra igual.
          });
      }

      set({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem("sigd_token");
          window.localStorage.removeItem("token");
          window.localStorage.removeItem("sigd_rol");
          window.localStorage.removeItem("sigd_permisos");
          window.localStorage.removeItem(STORAGE_KEY);
        }
        notificarCambioSesion();
      } catch {
        // Ignorar errores de almacenamiento.
      }
      // Sin window.location.href: la navegación la hace el llamador con
      // navigate("/login") para evitar recarga completa de página.
    },
    setToken: (accessToken: string, refreshToken: string | null = null) => {
      set((s) => ({
        accessToken,
        refreshToken: refreshToken ?? s.refreshToken,
        isAuthenticated: true,
      }));
      persistirSesionLocal(accessToken, state.usuario);
      notificarCambioSesion();
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
