import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../src/api/client";
import { useAuthStore, type ContextoUsuario } from "../../../src/stores/authStore";

describe("TSK-DEV-02B: Desacoplamiento de Roles y Capacidades en authStore", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({
      accessToken: "token-sesion-inicial",
      refreshToken: "refresh-sesion-inicial",
      usuario: {
        id: "usr-unit-test",
        nombreCompleto: "Usuario Prueba",
        correo: "usuario@iestp.edu.pe",
        rol: "DOCENTE",
        roles: ["DOCENTE"],
      },
      isAuthenticated: true,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  const contextoRolCoordinador: ContextoUsuario = {
    idAsignacion: "asig-rol-coord-uuid",
    tipo: "ROL",
    codigo: "COORDINADOR_AREA",
    nombre: "Coordinador de Área",
    areaId: "area-sistemas-uuid",
    areaNombre: "Desarrollo de Sistemas",
    permisos: [
      { codigo: "EXPEDIENTE_LEER", ambito: "GLOBAL", areaId: null },
      { codigo: "EXPEDIENTE_ASIGNAR", ambito: "AREA", areaId: "area-sistemas-uuid" },
      { codigo: "EXPEDIENTE_REASIGNAR", ambito: "AREA", areaId: "area-sistemas-uuid" },
    ],
    vigenteDesde: "2026-01-01T00:00:00Z",
    vigenteHasta: null,
    activo: true,
  };

  const contextoCapacidadApoyo: ContextoUsuario = {
    idAsignacion: "asig-cap-apoyo-uuid",
    tipo: "CAPACIDAD",
    codigo: "GESTOR_APOYO_AREA",
    nombre: "Apoyo de Área",
    areaId: "area-sistemas-uuid",
    areaNombre: "Desarrollo de Sistemas",
    permisos: [
      { codigo: "EXPEDIENTE_LEER", ambito: "GLOBAL", areaId: null },
      { codigo: "EXPEDIENTE_RECEPCIONAR", ambito: "AREA", areaId: "area-sistemas-uuid" },
      { codigo: "EXPEDIENTE_DERIVAR", ambito: "AREA", areaId: "area-sistemas-uuid" },
      { codigo: "EXPEDIENTE_ADJUNTAR", ambito: "AREA", areaId: "area-sistemas-uuid" },
    ],
    vigenteDesde: "2026-01-01T00:00:00Z",
    vigenteHasta: null,
    activo: true,
  };

  // 1. Selección de contexto ROL
  it("1. Selecciona contexto ROL: establece rol institucional y limpia capacidades", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        contextoActivo: contextoRolCoordinador,
        accessToken: "jwt-token-coord",
        mensaje: "Contexto cambiado a Coordinador de Área",
      },
    });

    await useAuthStore.getState().seleccionarContexto("asig-rol-coord-uuid");

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("jwt-token-coord");
    expect(state.usuario?.rol).toBe("COORDINADOR_AREA");
    expect(state.usuario?.roles).toEqual(["COORDINADOR_AREA"]);
    expect(state.usuario?.capacidadActiva).toBeUndefined();
    expect(state.usuario?.capacidades).toEqual([]);
    expect(state.usuario?.permisos).toHaveLength(3);

    expect(localStorage.getItem("sigd_rol")).toBe("COORDINADOR_AREA");
    expect(localStorage.getItem("sigd_roles")).toBe(JSON.stringify(["COORDINADOR_AREA"]));
    expect(localStorage.getItem("sigd_capacidad")).toBeNull();
  });

  // 2. Selección de contexto CAPACIDAD
  it("2. Selecciona contexto CAPACIDAD: identifica capacidad y NO la inyecta como rol", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        contextoActivo: contextoCapacidadApoyo,
        accessToken: "jwt-token-apoyo",
        mensaje: "Contexto cambiado a Apoyo de Área",
      },
    });

    await useAuthStore.getState().seleccionarContexto("asig-cap-apoyo-uuid");

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("jwt-token-apoyo");
    expect(state.usuario?.rol).toBe("");
    expect(state.usuario?.roles).toEqual([]);
    expect(state.usuario?.capacidadActiva).toBe("GESTOR_APOYO_AREA");
    expect(state.usuario?.capacidades).toEqual(["GESTOR_APOYO_AREA"]);
    expect(state.usuario?.permisos).toHaveLength(4);

    expect(localStorage.getItem("sigd_rol")).toBeNull();
    expect(localStorage.getItem("sigd_roles")).toBe("[]");
    expect(localStorage.getItem("sigd_capacidad")).toBe("GESTOR_APOYO_AREA");
  });

  // 3. Cambio de ROL a CAPACIDAD
  it("3. Conmuta de ROL a CAPACIDAD: remueve roles institucionales previos", async () => {
    // Estado inicial en ROL
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        contextoActivo: contextoRolCoordinador,
        accessToken: "jwt-token-coord",
        mensaje: "OK",
      },
    });
    await useAuthStore.getState().seleccionarContexto("asig-rol-coord-uuid");
    expect(useAuthStore.getState().usuario?.rol).toBe("COORDINADOR_AREA");

    // Conmuta a CAPACIDAD
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        contextoActivo: contextoCapacidadApoyo,
        accessToken: "jwt-token-apoyo",
        mensaje: "OK",
      },
    });
    await useAuthStore.getState().seleccionarContexto("asig-cap-apoyo-uuid");

    const state = useAuthStore.getState();
    expect(state.usuario?.rol).toBe("");
    expect(state.usuario?.roles).toEqual([]);
    expect(state.usuario?.capacidadActiva).toBe("GESTOR_APOYO_AREA");
    expect(localStorage.getItem("sigd_rol")).toBeNull();
    expect(localStorage.getItem("sigd_capacidad")).toBe("GESTOR_APOYO_AREA");
  });

  // 4. Cambio de CAPACIDAD a ROL
  it("4. Conmuta de CAPACIDAD a ROL: remueve capacidades previas", async () => {
    // Estado inicial en CAPACIDAD
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        contextoActivo: contextoCapacidadApoyo,
        accessToken: "jwt-token-apoyo",
        mensaje: "OK",
      },
    });
    await useAuthStore.getState().seleccionarContexto("asig-cap-apoyo-uuid");
    expect(useAuthStore.getState().usuario?.capacidadActiva).toBe("GESTOR_APOYO_AREA");

    // Conmuta a ROL
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        contextoActivo: contextoRolCoordinador,
        accessToken: "jwt-token-coord",
        mensaje: "OK",
      },
    });
    await useAuthStore.getState().seleccionarContexto("asig-rol-coord-uuid");

    const state = useAuthStore.getState();
    expect(state.usuario?.rol).toBe("COORDINADOR_AREA");
    expect(state.usuario?.roles).toEqual(["COORDINADOR_AREA"]);
    expect(state.usuario?.capacidadActiva).toBeUndefined();
    expect(state.usuario?.capacidades).toEqual([]);
    expect(localStorage.getItem("sigd_rol")).toBe("COORDINADOR_AREA");
    expect(localStorage.getItem("sigd_capacidad")).toBeNull();
  });

  // 5. Ausencia de inyección de capacidades en roles
  it("5. GESTOR_APOYO_AREA nunca aparece dentro del array 'roles'", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        accessToken: "tok-1",
        refreshToken: "ref-1",
        usuario: {
          id: "u1",
          nombreCompleto: "Apoyo Test",
          correo: "apoyo@iestp.edu.pe",
          rol: "GESTOR_APOYO_AREA",
          roles: ["GESTOR_APOYO_AREA"],
          contextoActivo: contextoCapacidadApoyo,
        },
      },
    });

    await useAuthStore.getState().login({ identificador: "apoyo", password: "pwd" });

    const state = useAuthStore.getState();
    expect(state.usuario?.roles).not.toContain("GESTOR_APOYO_AREA");
    expect(state.usuario?.rol).not.toBe("GESTOR_APOYO_AREA");
    expect(state.usuario?.capacidadActiva).toBe("GESTOR_APOYO_AREA");
    expect(state.usuario?.capacidades).toContain("GESTOR_APOYO_AREA");
  });

  // 6. Limpieza de claves de persistencia anteriores
  it("6. Limpia claves anteriores en localStorage al cambiar de tipo de contexto", async () => {
    localStorage.setItem("sigd_rol", "DOCENTE");
    localStorage.setItem("sigd_roles", JSON.stringify(["DOCENTE"]));

    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        contextoActivo: contextoCapacidadApoyo,
        accessToken: "jwt-token-apoyo",
        mensaje: "OK",
      },
    });

    await useAuthStore.getState().seleccionarContexto("asig-cap-apoyo-uuid");

    expect(localStorage.getItem("sigd_rol")).toBeNull();
    expect(localStorage.getItem("sigd_roles")).toBe("[]");
    expect(localStorage.getItem("sigd_capacidad")).toBe("GESTOR_APOYO_AREA");
  });

  // 7. Recuperación del contexto después de recargar
  it("7. Sincroniza y normaliza contexto autenticado al invocar verificarSesion()", async () => {
    useAuthStore.setState({ accessToken: "jwt-valido", isAuthenticated: true });

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      status: 200,
      data: {
        id: "usr-id-1",
        nombreCompleto: "Usuario Apoyo",
        correo: "apoyo@iestp.edu.pe",
        rol: "GESTOR_APOYO_AREA",
        roles: ["GESTOR_APOYO_AREA"],
        contextoActivo: contextoCapacidadApoyo,
      },
    });

    await useAuthStore.getState().verificarSesion();

    const state = useAuthStore.getState();
    expect(state.usuario?.rol).toBe("");
    expect(state.usuario?.roles).toEqual([]);
    expect(state.usuario?.capacidadActiva).toBe("GESTOR_APOYO_AREA");
    expect(localStorage.getItem("sigd_capacidad")).toBe("GESTOR_APOYO_AREA");
    expect(localStorage.getItem("sigd_rol")).toBeNull();
  });

  // 8. Ausencia de acumulación de permisos
  it("8. No acumula permisos al cambiar de contexto", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        contextoActivo: contextoRolCoordinador,
        accessToken: "jwt-token-coord",
        mensaje: "OK",
      },
    });
    await useAuthStore.getState().seleccionarContexto("asig-rol-coord-uuid");
    expect(useAuthStore.getState().usuario?.permisos).toHaveLength(3);

    // Conmuta a capacidad (que tiene 4 permisos propios diferentes)
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        contextoActivo: contextoCapacidadApoyo,
        accessToken: "jwt-token-apoyo",
        mensaje: "OK",
      },
    });
    await useAuthStore.getState().seleccionarContexto("asig-cap-apoyo-uuid");

    const perms = useAuthStore.getState().usuario?.permisos ?? [];
    expect(perms).toHaveLength(4);
    // Verificar que los permisos exclusivos de Coordinador no se hayan acumulado
    expect(perms.some((p) => p.codigo === "EXPEDIENTE_ASIGNAR")).toBe(false);
    expect(perms.some((p) => p.codigo === "EXPEDIENTE_REASIGNAR")).toBe(false);
  });

  // 9. Manejo de contextos inválidos
  it("9. Falla controlada si el backend rechaza la conmutación de contexto", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValueOnce(new Error("Contexto revocado o inválido"));

    await expect(
      useAuthStore.getState().seleccionarContexto("uuid-inexistente"),
    ).rejects.toThrow("Contexto revocado o inválido");
  });

  // 10. Cierre de sesión y limpieza del estado
  it("10. logout() purga totalmente el estado y las claves de almacenamiento", () => {
    useAuthStore.setState({
      accessToken: "token-activo",
      refreshToken: "refresh-activo",
      isAuthenticated: true,
      usuario: {
        id: "u1",
        nombreCompleto: "Test",
        correo: "test@iestp.edu.pe",
        rol: "",
        roles: [],
        capacidadActiva: "GESTOR_APOYO_AREA",
        capacidades: ["GESTOR_APOYO_AREA"],
      },
    });

    localStorage.setItem("sigd_token", "token-activo");
    localStorage.setItem("sigd_capacidad", "GESTOR_APOYO_AREA");
    localStorage.setItem("sigd_facultades", "[]");

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.usuario).toBeNull();
    expect(state.isAuthenticated).toBe(false);

    expect(localStorage.getItem("sigd_token")).toBeNull();
    expect(localStorage.getItem("sigd_capacidad")).toBeNull();
    expect(localStorage.getItem("sigd_rol")).toBeNull();
    expect(localStorage.getItem("sigd_roles")).toBeNull();
    expect(localStorage.getItem("sigd_facultades")).toBeNull();
  });
});
