import { describe, expect, it, vi, beforeEach } from "vitest";
import { apiClient } from "../api/client";
import { useAuthStore } from "./authStore";

vi.mock("../api/client", () => ({
  apiClient: { post: vi.fn(), defaults: { baseURL: "https://sigd.example/api" } },
}));

describe("authStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false,
      selectionToken: null, rolesDisponibles: [], usuarioPendiente: null });
  });

  it("login() exitoso guarda accessToken, refreshToken, usuario e isAuthenticated en true", async () => {
    const mockUsuario = { id: "u1", nombreCompleto: "Juan Perez", correo: "juan@inst.edu.pe", rol: "DOCENTE", permisos: {} };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { requiresRoleSelection: false, accessToken: "tok-1", refreshToken: "rtok-1", usuario: mockUsuario },
    });

    await useAuthStore.getState().login({ identificador: "juan", password: "pass" });

    expect(useAuthStore.getState().accessToken).toBe("tok-1");
    expect(useAuthStore.getState().refreshToken).toBe("rtok-1");
    expect(useAuthStore.getState().usuario).toEqual(mockUsuario);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/auth/login", { identificador: "juan", password: "pass" });
    expect(localStorage.getItem('sigd_rol')).toBeNull();
    expect(localStorage.getItem('sigd_permisos')).toBeNull();
  });

  it('con varios roles conserva una identidad pendiente sin autenticar hasta la selección', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: {
      requiresRoleSelection: true, selectionToken: 'selection-1', rolesDisponibles: ['DOCENTE', 'DIRECTOR'],
      usuario: { id: 'u1', nombreCompleto: 'Persona', correo: 'p@suiza.edu.pe' },
    } });
    const resultado = await useAuthStore.getState().login({ identificador: 'persona', password: 'pass123' });
    expect(resultado.requiresRoleSelection).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().rolesDisponibles).toEqual(['DOCENTE', 'DIRECTOR']);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('selecciona el perfil mediante el servidor y rechaza uno no ofrecido', async () => {
    useAuthStore.setState({ selectionToken: 'selection-1', rolesDisponibles: ['DOCENTE'] });
    await expect(useAuthStore.getState().seleccionarPerfil('DIRECTOR')).rejects.toThrow('Perfil no autorizado');
    expect(apiClient.post).not.toHaveBeenCalled();

    const usuario = { id: 'u1', nombreCompleto: 'Persona', correo: 'p@suiza.edu.pe', rol: 'DOCENTE' as const,
      rolesAutorizados: ['DOCENTE' as const], permisos: ['expedientes:leer'] };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: {
      requiresRoleSelection: false, accessToken: 'tok-doc', refreshToken: 'ref-doc', usuario,
    } });
    await useAuthStore.getState().seleccionarPerfil('DOCENTE');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/auth/select-role', {
      selectionToken: 'selection-1', rol: 'DOCENTE',
    });
    expect(useAuthStore.getState().usuario).toEqual(usuario);
    expect(useAuthStore.getState().selectionToken).toBeNull();
  });

  it('cambia de perfil solo a través del endpoint autenticado', async () => {
    useAuthStore.setState({ accessToken: 'tok', refreshToken: 'ref', isAuthenticated: true,
      usuario: { id: 'u1', nombreCompleto: 'Persona', correo: 'p@suiza.edu.pe', rol: 'DOCENTE',
        rolesAutorizados: ['DOCENTE', 'DIRECTOR'] } });
    const usuarioDirector = { id: 'u1', nombreCompleto: 'Persona', correo: 'p@suiza.edu.pe', rol: 'DIRECTOR' as const,
      rolesAutorizados: ['DOCENTE' as const, 'DIRECTOR' as const], permisos: ['reportes:leer'] };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: {
      requiresRoleSelection: false, accessToken: 'tok-dir', refreshToken: 'ref-dir', usuario: usuarioDirector,
    } });
    await useAuthStore.getState().cambiarPerfil('DIRECTOR');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/auth/switch-role', { rol: 'DIRECTOR', refreshToken: 'ref' });
    expect(useAuthStore.getState().usuario?.rol).toBe('DIRECTOR');
  });

  it("logout() limpia todos los campos a null/false", () => {
    useAuthStore.setState({ accessToken: "tok", refreshToken: "rtok", usuario: { id: "1", nombreCompleto: "X", correo: "x@x.pe", rol: "DOCENTE" }, isAuthenticated: true });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().usuario).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("setToken() no autentica sin un perfil de usuario confirmado", () => {
    useAuthStore.setState({ accessToken: "old", refreshToken: "old-rt", isAuthenticated: false });

    useAuthStore.getState().setToken("new");

    expect(useAuthStore.getState().accessToken).toBe("new");
    expect(useAuthStore.getState().refreshToken).toBe("old-rt");
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
