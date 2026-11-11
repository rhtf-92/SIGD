import { useSyncExternalStore } from "react";
import { apiClient } from "../api/client";
import { queryClient } from "../queryClient";
import type { RolCanonica } from "../config/navigation.config";
import { limpiarClaveIdempotenciaActiva } from "../utils/idempotency";

export type ContextoOperativo = "PERSONAL" | "INSTITUCIONAL";

export interface ContextoInfo {
  tipo: ContextoOperativo;
  descripcion: string;
  rol?: string;
  areaId?: string;
  perfiles?: string[];
}

export interface UsuarioPerfil {
  id: string;
  idPersona?: string | null;
  nombreCompleto: string;
  correo: string;
  rol: RolCanonica;
  contexto?: ContextoOperativo;
  areaId?: string;
  cargoId?: string;
  perfiles?: string[];
  permisos?: string[];
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
  contextoActivo: ContextoOperativo;
  contextosDisponibles: ContextoInfo[];
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setToken: (accessToken: string, refreshToken?: string | null) => void;
  cambiarContexto: (nuevoContexto: ContextoOperativo) => Promise<void>;
  sincronizarContextos: () => Promise<void>;
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
    contextoActivo: ContextoOperativo;
    contextosDisponibles: ContextoInfo[];
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
            contextoActivo: state.contextoActivo ?? "PERSONAL",
            contextosDisponibles: state.contextosDisponibles ?? [
              { tipo: "PERSONAL", descripcion: "Trámites personales" },
            ],
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
      contextoActivo: "PERSONAL",
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Trámites personales" },
      ],
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
              contextoActivo: state.contextoActivo,
              contextosDisponibles: state.contextosDisponibles,
            },
            version: 1,
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
      const ctxActivo: ContextoOperativo = data.contextoActivo ?? "PERSONAL";
      const ctxDisponibles: ContextoInfo[] = data.contextos ?? [
        { tipo: "PERSONAL", descripcion: "Trámites personales", rol: "CIUDADANO" },
      ];
      const usuarioObj: UsuarioPerfil | null = data.usuario
        ? {
            ...data.usuario,
            perfiles: data.usuario.perfiles ?? (ctxDisponibles.find((c) => c.tipo === "INSTITUCIONAL")?.perfiles),
            ...(data.contextoActivo ? { contexto: ctxActivo } : (data.usuario.contexto ? { contexto: data.usuario.contexto } : {})),
          }
        : null;

      set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        usuario: usuarioObj,
        isAuthenticated: true,
        contextoActivo: ctxActivo,
        contextosDisponibles: ctxDisponibles,
      });

      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("sigd_token", data.accessToken);
          window.localStorage.setItem("token", data.accessToken);
          window.localStorage.setItem("sigd_contexto", ctxActivo);
          if (usuarioObj?.rol) {
            window.localStorage.setItem("sigd_rol", usuarioObj.rol);
          }
        }
      } catch {
        // Ignore storage errors
      }
    },
    logout: () => {
      set({
        accessToken: null,
        refreshToken: null,
        usuario: null,
        isAuthenticated: false,
        contextoActivo: "PERSONAL",
        contextosDisponibles: [
          { tipo: "PERSONAL", descripcion: "Trámites personales", rol: "CIUDADANO" },
        ],
      });
      try {
        queryClient.clear();
      } catch {
        // Ignore
      }
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem("sigd_token");
          window.localStorage.removeItem("token");
          window.localStorage.removeItem("sigd_rol");
          window.localStorage.removeItem("sigd_contexto");
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
    cambiarContexto: async (nuevoContexto: ContextoOperativo) => {
      // Regla PM-5H-29: Purgar clave de idempotencia activa al cambiar contexto
      limpiarClaveIdempotenciaActiva();

      const { data } = await apiClient.post("/api/v1/auth/contexto", {
        contexto: nuevoContexto,
      });

      // Regla 15 (Fase 5H): Al pasar INSTITUCIONAL -> PERSONAL, purgar datos sensibles en memoria
      if (nuevoContexto === "PERSONAL") {
        try {
          queryClient.clear();
        } catch {
          // Ignore
        }
      }

      const rolActualizado: RolCanonica =
        data.usuario?.rol ??
        (nuevoContexto === "PERSONAL" ? "CIUDADANO" : (state.usuario?.rol ?? "ESPECIALISTA"));

      const perfilesActualizados =
        data.usuario?.perfiles ??
        (nuevoContexto === "PERSONAL"
          ? undefined
          : (state.contextosDisponibles.find((c) => c.tipo === "INSTITUCIONAL")?.perfiles ?? state.usuario?.perfiles));

      const usuarioActualizado: UsuarioPerfil = {
        ...(state.usuario ?? {
          id: data.usuario?.id ?? "",
          nombreCompleto: data.usuario?.nombreCompleto ?? "",
          correo: "",
          rol: rolActualizado,
        }),
        id: data.usuario?.id ?? state.usuario?.id ?? "",
        idPersona: data.usuario?.idPersona ?? state.usuario?.idPersona,
        nombreCompleto: data.usuario?.nombreCompleto ?? state.usuario?.nombreCompleto ?? "",
        rol: rolActualizado,
        contexto: nuevoContexto,
        areaId: data.usuario?.areaId ?? (nuevoContexto === "PERSONAL" ? undefined : state.usuario?.areaId),
        perfiles: perfilesActualizados,
      };

      set({
        accessToken: data.accessToken ?? state.accessToken,
        usuario: usuarioActualizado,
        contextoActivo: nuevoContexto,
      });

      try {
        if (typeof window !== "undefined" && window.localStorage) {
          if (data.accessToken) {
            window.localStorage.setItem("sigd_token", data.accessToken);
            window.localStorage.setItem("token", data.accessToken);
          }
          window.localStorage.setItem("sigd_rol", rolActualizado);
          window.localStorage.setItem("sigd_contexto", nuevoContexto);
        }
      } catch {
        // Ignore
      }
    },
    sincronizarContextos: async () => {
      try {
        const { data } = await apiClient.get("/api/v1/auth/me");
        if (data) {
          const tieneInst =
            Array.isArray(data.contextos) &&
            data.contextos.some((c: ContextoInfo) => c.tipo === "INSTITUCIONAL");
          const contextos: ContextoInfo[] = data.contextos ?? [
            { tipo: "PERSONAL", descripcion: "Trámites personales", rol: "CIUDADANO" },
          ];

          // Si el usuario estaba en INSTITUCIONAL pero perdió la capacidad (responsabilidad expirada)
          if (state.contextoActivo === "INSTITUCIONAL" && !tieneInst) {
            queryClient.clear();
            const usuarioCiudadano: UsuarioPerfil = {
              ...(state.usuario ?? {
                id: data.id,
                nombreCompleto: data.nombreCompleto,
                correo: data.correo,
                rol: "CIUDADANO",
              }),
              rol: "CIUDADANO",
              contexto: "PERSONAL",
              areaId: undefined,
            };
            set({
              contextoActivo: "PERSONAL",
              contextosDisponibles: contextos,
              usuario: usuarioCiudadano,
            });
            if (typeof window !== "undefined" && window.localStorage) {
              window.localStorage.setItem("sigd_rol", "CIUDADANO");
              window.localStorage.setItem("sigd_contexto", "PERSONAL");
            }
          } else {
            set({
              contextosDisponibles: contextos,
            });
          }
        }
      } catch {
        // Si /auth/me falla con 401/403, el interceptor de client.ts se encarga
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
