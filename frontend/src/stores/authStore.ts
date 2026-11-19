import { useSyncExternalStore } from "react";
import { apiClient } from "../api/client";
import type { CapacidadOperativaId, TipoContextoInstitucional } from "../types/rbacRoles";

export const AUTH_RETURN_TO_STORAGE_KEY = "SIGD_AUTH_RETURN_TO";

export interface ContextoUsuario {
  idAsignacion: string;
  tipo: TipoContextoInstitucional;
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
  capacidadActiva?: CapacidadOperativaId | string;
  capacidades?: (CapacidadOperativaId | string)[];
  permisos?: { codigo: string; ambito: 'GLOBAL' | 'AREA'; areaId: string | null }[];
  areaId?: string;
  contextoActivo?: ContextoUsuario;
  contextosDisponibles?: ContextoUsuario[];
}

export function esCapacidadOperativa(codigo?: string | null): boolean {
  return codigo === 'GESTOR_APOYO_AREA';
}

export function normalizarPerfilContexto(perfil: Partial<UsuarioPerfil>): UsuarioPerfil {
  const ctx = perfil.contextoActivo;
  const esContextoCapacidad = ctx
    ? (ctx.tipo === 'CAPACIDAD' || esCapacidadOperativa(ctx.codigo))
    : (esCapacidadOperativa(perfil.rol) || esCapacidadOperativa(perfil.capacidadActiva));

  let rol = perfil.rol ?? '';
  let roles = Array.isArray(perfil.roles)
    ? perfil.roles.filter(r => typeof r === 'string' && !esCapacidadOperativa(r))
    : (rol && !esCapacidadOperativa(rol) ? [rol] : []);

  let capacidadActiva: string | undefined = perfil.capacidadActiva;
  let capacidades: string[] = Array.isArray(perfil.capacidades) ? [...perfil.capacidades] : [];

  if (esContextoCapacidad) {
    const codCapacidad: string =
      (ctx?.codigo && esCapacidadOperativa(ctx.codigo) ? ctx.codigo : null) ??
      (perfil.capacidadActiva && esCapacidadOperativa(perfil.capacidadActiva) ? perfil.capacidadActiva : null) ??
      (perfil.rol && esCapacidadOperativa(perfil.rol) ? perfil.rol : 'GESTOR_APOYO_AREA');

    capacidadActiva = codCapacidad;
    capacidades = [codCapacidad];
    rol = '';
    roles = [];
  } else {
    capacidadActiva = undefined;
    capacidades = [];
    if (ctx?.codigo && !esCapacidadOperativa(ctx.codigo)) {
      rol = ctx.codigo;
      roles = [ctx.codigo];
    } else if (esCapacidadOperativa(rol)) {
      rol = '';
    }
  }

  return {
    id: perfil.id ?? '',
    nombreCompleto: perfil.nombreCompleto ?? '',
    correo: perfil.correo ?? '',
    rol,
    roles,
    capacidadActiva,
    capacidades,
    permisos: Array.isArray(perfil.permisos) ? perfil.permisos : (ctx?.permisos ?? []),
    areaId: ctx?.areaId ?? perfil.areaId,
    contextoActivo: ctx,
    contextosDisponibles: perfil.contextosDisponibles,
  };
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
          const ctx = d.contextoRevocado ? undefined : d.contextoActivo;
          const esCapacidad = ctx?.tipo === 'CAPACIDAD' || esCapacidadOperativa(ctx?.codigo) || esCapacidadOperativa(d.rol);

          const rolFinal = esCapacidad ? '' : (ctx?.codigo || d.rol || '');
          const rolesFinales = esCapacidad
            ? []
            : (Array.isArray(d.roles) ? d.roles.filter(r => !esCapacidadOperativa(r)) : (rolFinal ? [rolFinal] : []));
          const capacidadActivaFinal = esCapacidad ? (ctx?.codigo || d.rol || 'GESTOR_APOYO_AREA') : undefined;
          const capacidadesFinales = esCapacidad ? [capacidadActivaFinal!] : [];

          const usuarioActualizado: UsuarioPerfil = {
            id: d.id,
            nombreCompleto: d.nombreCompleto,
            correo: d.correo,
            rol: rolFinal,
            roles: rolesFinales,
            capacidadActiva: capacidadActivaFinal,
            capacidades: capacidadesFinales,
            permisos: Array.isArray(d.permisos) ? d.permisos : (ctx?.permisos ?? []),
            areaId: ctx?.areaId ?? d.areaId,
            contextoActivo: ctx,
            contextosDisponibles: d.contextosDisponibles,
          };

          set((s) => ({
            ...s,
            usuario: usuarioActualizado,
            isAuthenticated: true,
          }));

          try {
            if (typeof window !== "undefined" && window.localStorage) {
              if (rolFinal) {
                window.localStorage.setItem("sigd_rol", rolFinal);
                window.localStorage.removeItem("sigd_capacidad");
              } else if (capacidadActivaFinal) {
                window.localStorage.removeItem("sigd_rol");
                window.localStorage.setItem("sigd_capacidad", capacidadActivaFinal);
              } else {
                window.localStorage.removeItem("sigd_rol");
                window.localStorage.removeItem("sigd_capacidad");
              }

              if (Array.isArray(d.roles)) {
                window.localStorage.setItem("sigd_roles", JSON.stringify(rolesFinales));
              } else {
                window.localStorage.removeItem("sigd_roles");
              }

              window.localStorage.setItem("sigd_facultades", JSON.stringify(usuarioActualizado.permisos ?? []));
              if (usuarioActualizado.contextoActivo) {
                window.localStorage.setItem("sigd_contexto_activo", JSON.stringify(usuarioActualizado.contextoActivo));
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
        const esCapacidad = nuevoCtx.tipo === 'CAPACIDAD' || esCapacidadOperativa(nuevoCtx.codigo);

        const rolActualizado = esCapacidad ? '' : nuevoCtx.codigo;
        const rolesActualizados = esCapacidad ? [] : [nuevoCtx.codigo];
        const capacidadActivaActualizada = esCapacidad ? nuevoCtx.codigo : undefined;
        const capacidadesActualizadas = esCapacidad ? [nuevoCtx.codigo] : [];

        set((s) => {
          const baseUsuario = s.usuario ?? {
            id: '',
            nombreCompleto: '',
            correo: '',
            rol: '',
          };

          const usuarioActualizado: UsuarioPerfil = {
            ...baseUsuario,
            rol: rolActualizado,
            roles: rolesActualizados,
            capacidadActiva: capacidadActivaActualizada,
            capacidades: capacidadesActualizadas,
            permisos: nuevoCtx.permisos,
            areaId: nuevoCtx.areaId ?? undefined,
            contextoActivo: nuevoCtx,
          };

          return {
            ...s,
            accessToken: data.accessToken,
            usuario: usuarioActualizado,
          };
        });

        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('sigd_token', data.accessToken);
            window.localStorage.setItem('token', data.accessToken);
            if (!esCapacidad) {
              window.localStorage.setItem('sigd_rol', nuevoCtx.codigo);
              window.localStorage.setItem('sigd_roles', JSON.stringify([nuevoCtx.codigo]));
              window.localStorage.removeItem('sigd_capacidad');
            } else {
              window.localStorage.removeItem('sigd_rol');
              window.localStorage.setItem('sigd_roles', '[]');
              window.localStorage.setItem('sigd_capacidad', nuevoCtx.codigo);
            }
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
      const rawUser = data.usuario ? { ...data.usuario } : null;

      let usuarioFinal = rawUser;
      if (rawUser) {
        const esCapacidad =
          rawUser.contextoActivo?.tipo === 'CAPACIDAD' ||
          esCapacidadOperativa(rawUser.contextoActivo?.codigo) ||
          esCapacidadOperativa(rawUser.rol);

        if (esCapacidad) {
          const codCapacidad =
            rawUser.contextoActivo?.codigo ||
            (esCapacidadOperativa(rawUser.rol) ? rawUser.rol : 'GESTOR_APOYO_AREA');
          usuarioFinal = {
            ...rawUser,
            rol: '',
            roles: Array.isArray(rawUser.roles) ? rawUser.roles.filter((r: string) => !esCapacidadOperativa(r)) : [],
            capacidadActiva: codCapacidad,
            capacidades: [codCapacidad],
          };
        } else if (rawUser.contextoActivo?.tipo === 'ROL') {
          usuarioFinal = {
            ...rawUser,
            rol: rawUser.contextoActivo.codigo,
            roles: Array.isArray(rawUser.roles)
              ? rawUser.roles.filter((r: string) => !esCapacidadOperativa(r))
              : [rawUser.contextoActivo.codigo],
            capacidadActiva: undefined,
            capacidades: [],
          };
        }
      }

      set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        usuario: usuarioFinal,
        isAuthenticated: true,
      });

      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("sigd_token", data.accessToken);
          window.localStorage.setItem("token", data.accessToken);

          if (usuarioFinal?.rol) {
            window.localStorage.setItem("sigd_rol", usuarioFinal.rol);
            window.localStorage.removeItem("sigd_capacidad");
          } else if (usuarioFinal?.capacidadActiva) {
            window.localStorage.removeItem("sigd_rol");
            window.localStorage.setItem("sigd_capacidad", usuarioFinal.capacidadActiva);
          } else {
            window.localStorage.removeItem("sigd_rol");
            window.localStorage.removeItem("sigd_capacidad");
          }

          if (Array.isArray(usuarioFinal?.roles)) {
            window.localStorage.setItem("sigd_roles", JSON.stringify(usuarioFinal.roles.filter((r: string) => !esCapacidadOperativa(r))));
          } else {
            window.localStorage.removeItem("sigd_roles");
          }

          window.localStorage.setItem("sigd_facultades", JSON.stringify(usuarioFinal?.permisos ?? []));
          if (usuarioFinal?.contextoActivo) {
            window.localStorage.setItem("sigd_contexto_activo", JSON.stringify(usuarioFinal.contextoActivo));
          } else {
            window.localStorage.removeItem("sigd_contexto_activo");
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
          window.localStorage.removeItem("sigd_capacidad");
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
      let filteredRoles: string[] = [];
      let detectedCapacidad: string | undefined = undefined;

      if (autorizacion?.roles) {
        filteredRoles = autorizacion.roles.filter(r => !esCapacidadOperativa(r));
        if (autorizacion.roles.some(r => esCapacidadOperativa(r))) {
          detectedCapacidad = 'GESTOR_APOYO_AREA';
        }
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('sigd_facultades', JSON.stringify(autorizacion?.permisos ?? []));
        if (autorizacion?.roles) {
          window.localStorage.setItem('sigd_roles', JSON.stringify(filteredRoles));
        }
        if (detectedCapacidad) {
          window.localStorage.setItem('sigd_capacidad', detectedCapacidad);
          window.localStorage.removeItem('sigd_rol');
        }
      }

      set((s) => {
        const baseUsuario = s.usuario;
        const usuarioActualizado = baseUsuario
          ? {
              ...baseUsuario,
              ...(autorizacion ? {
                roles: filteredRoles,
                permisos: autorizacion.permisos,
                ...(detectedCapacidad ? { capacidadActiva: detectedCapacidad, capacidades: [detectedCapacidad], rol: '' } : {})
              } : {})
            }
          : null;

        return {
          accessToken,
          refreshToken: refreshToken ?? s.refreshToken,
          isAuthenticated: true,
          usuario: usuarioActualizado,
        };
      });

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
