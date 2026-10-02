import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "../api/client";

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

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  usuario: UsuarioPerfil | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setToken: (accessToken: string, refreshToken?: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,

      login: async (credentials) => {
        const { data } = await apiClient.post("/api/v1/auth/login", credentials);
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          usuario: data.usuario,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
      },

      setToken: (accessToken, refreshToken = null) => {
        set((state) => ({
          accessToken,
          refreshToken: refreshToken ?? state.refreshToken,
          isAuthenticated: true,
        }));
      },
    }),
    { name: "sigd_auth" }
  )
);