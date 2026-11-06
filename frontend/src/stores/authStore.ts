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

function normalizarRol(rol: string): UsuarioPerfil['rol'] {
  return ROL_CANONICO[rol?.toUpperCase()] ?? 'ESTUDIANTE';
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
      // Modo local: si el backend no responde, usar autenticación local
      const credencialesDemo: Record<string, string> = {
        admin: "123",
        director: "123",
        docente: "123",
        mesa_partes: "123",
        estudiante: "123",
      };

      const tokenLocal = `sigd_token_${credentials.identificador}_${Date.now()}`;
      const usuarioLocal: UsuarioPerfil = {
        id: `usr_${credentials.identificador}`,
        nombreCompleto: credentials.identificador.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        correo: `${credentials.identificador}@iestp-suiza.edu.pe`,
        rol: credentials.identificador === "admin" ? "SUPER_ADMIN"
          : credentials.identificador === "director" ? "DIRECTOR"
          : credentials.identificador === "docente" ? "DOCENTE"
          : credentials.identificador === "mesa_partes" ? "MESA_PARTES"
          : "ESTUDIANTE",
        rolCodigo: credentials.identificador.toUpperCase(),
      };

      try {
        const { data } = await apiClient.post("/api/v1/auth/login", credentials);
        const usuarioCanonico: UsuarioPerfil | null = data.usuario
          ? {
              ...(data.usuario as UsuarioPerfil),
              rol: normalizarRol(data.usuario.rol),
            }
          : null;
        const accessToken = data.access_token ?? data.token ?? null;
        const refreshToken = data.refresh_token ?? null;
        set({
          accessToken,
          refreshToken,
          usuario: usuarioCanonico,
          isAuthenticated: true,
        });
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            if (accessToken) {
              window.localStorage.setItem("sigd_token", accessToken);
              window.localStorage.setItem("token", accessToken);
            }
            const rolCanonico = usuarioCanonico?.rol ?? "ESTUDIANTE";
            window.localStorage.setItem("sigd_rol", rolCanonico);
            if (!window.localStorage.getItem("sigd_permisos")) {
              window.localStorage.setItem("sigd_permisos", JSON.stringify(permisosIniciales));
            }
          }
          notificarCambioSesion();
        } catch {
          // Ignore storage errors
        }
      } catch {
        // Fallback local: autenticación sin backend
        const passwordValida = credencialesDemo[credentials.identificador];
        if (passwordValida && credentials.password === passwordValida) {
          set({
            accessToken: tokenLocal,
            refreshToken: tokenLocal,
            usuario: usuarioLocal,
            isAuthenticated: true,
          });
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              window.localStorage.setItem("sigd_token", tokenLocal);
              window.localStorage.setItem("token", tokenLocal);
              window.localStorage.setItem("sigd_rol", usuarioLocal.rol);
              if (!window.localStorage.getItem("sigd_permisos")) {
                window.localStorage.setItem("sigd_permisos", JSON.stringify(permisosIniciales));
              }
            }
            notificarCambioSesion();
          } catch {
            // Ignore storage errors
          }
        } else {
          throw new Error("Credenciales inválidas");
        }
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
        notificarCambioSesion();
      } catch {
        // Ignore storage errors
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
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("sigd_token", accessToken);
          window.localStorage.setItem("token", accessToken);
        }
        notificarCambioSesion();
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