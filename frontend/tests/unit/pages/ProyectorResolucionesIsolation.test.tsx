import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";

import ProyectorResolucionesPage, {
  obtenerClaveBorrador,
  recuperarBorradorSeguro,
} from "../../../src/pages/flujos/ProyectorResolucionesPage";
import {
  validarResolucionDirectoralBorrador,
  type ResolucionDirectoral,
} from "../../../src/types/resolucionAcademica";
import { useAuthStore } from "../../../src/stores/authStore";
import { apiClient } from "../../../src/api/client";

const BORRADOR_VALIDO_EJEMPLO: ResolucionDirectoral = {
  id: "RD-TMP-2026-001",
  numeroResolucion: "RD N.° 0412-2026-DG-IESTP-SUIZA",
  anio: 2026,
  tipo: "TITULACION",
  asunto: "Conferir Título Profesional Técnico en DSI",
  unidadOrganica: "Dirección General",
  fechaEmision: "2026-03-01T10:00:00.000Z",
  administradoNombre: "Carlos Mendoza",
  administradoDocumento: "74561238",
  programaEstudios: "Desarrollo de Sistemas de Información",
  visto: "El expediente EXP-2026-000155 y actuados.",
  considerandos: ["Que la ley 30512 regula los institutos."],
  articulos: [{ id: "art-1", numero: 1, texto: "CONFERIR el título profesional." }],
  firmanteCargo: "Director General",
  firmanteNombre: "Lic. Julio César Mori Paredes",
  estado: "BORRADOR",
};

describe("BJ-01 & BJ-02: Aislamiento por usuario y validación estricta de borrador local", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      usuario: null,
      accessToken: null,
      isAuthenticated: false,
    });
    vi.spyOn(apiClient, "get").mockRejectedValue(new Error("Network offline"));
    vi.spyOn(apiClient, "post").mockRejectedValue(new Error("Network offline"));
  });

  // --- BJ-02: Pruebas unitarias del validador de contrato ---
  describe("BJ-02: Validador de contrato validarResolucionDirectoralBorrador", () => {
    it("valida exitosamente un borrador completo conforme al contrato", () => {
      const res = validarResolucionDirectoralBorrador(BORRADOR_VALIDO_EJEMPLO);
      expect(res).not.toBeNull();
      expect(res?.numeroResolucion).toBe(BORRADOR_VALIDO_EJEMPLO.numeroResolucion);
    });

    it("rechaza valor null o undefined", () => {
      expect(validarResolucionDirectoralBorrador(null)).toBeNull();
      expect(validarResolucionDirectoralBorrador(undefined)).toBeNull();
    });

    it("rechaza arreglos o primitivos", () => {
      expect(validarResolucionDirectoralBorrador([])).toBeNull();
      expect(validarResolucionDirectoralBorrador("texto")).toBeNull();
      expect(validarResolucionDirectoralBorrador(12345)).toBeNull();
    });

    it("rechaza objetos sin campos obligatorios", () => {
      const incompleto = { id: "RD-1", numeroResolucion: "RD N. 1" };
      expect(validarResolucionDirectoralBorrador(incompleto)).toBeNull();
    });

    it("rechaza tipos incompatibles (ej. año string o tipo inexistente)", () => {
      const anioInvalido = { ...BORRADOR_VALIDO_EJEMPLO, anio: "2026" };
      expect(validarResolucionDirectoralBorrador(anioInvalido)).toBeNull();

      const tipoInvalido = { ...BORRADOR_VALIDO_EJEMPLO, tipo: "TIPO_INEXISTENTE" };
      expect(validarResolucionDirectoralBorrador(tipoInvalido)).toBeNull();

      const estadoInvalido = { ...BORRADOR_VALIDO_EJEMPLO, estado: "ESTADO_INVENTADO" };
      expect(validarResolucionDirectoralBorrador(estadoInvalido)).toBeNull();
    });

    it("rechaza artículos o considerandos mal estructurados", () => {
      const considerandosNoArray = { ...BORRADOR_VALIDO_EJEMPLO, considerandos: "No es array" };
      expect(validarResolucionDirectoralBorrador(considerandosNoArray)).toBeNull();

      const articulosSinNumero = {
        ...BORRADOR_VALIDO_EJEMPLO,
        articulos: [{ id: "art-1", texto: "Falta numero" }],
      };
      expect(validarResolucionDirectoralBorrador(articulosSinNumero)).toBeNull();
    });

    it("rechaza contenido que supere límites de longitud razonables para evitar DoS en render", () => {
      const vistoGigante = { ...BORRADOR_VALIDO_EJEMPLO, visto: "A".repeat(25000) };
      expect(validarResolucionDirectoralBorrador(vistoGigante)).toBeNull();
    });
  });

  // --- BJ-01: Pruebas de aislamiento entre usuarios y sesiones ---
  describe("BJ-01: Aislamiento por identidad (T1 a T8)", () => {
    it("T1: Usuario A guarda borrador y lo recupera bajo su namespace", () => {
      const claveA = obtenerClaveBorrador("usr-a", "RD-TMP-2026-001");
      expect(claveA).toBe("sigd_rd_borrador_usr_usr-a_RD-TMP-2026-001");

      const borradorA = { ...BORRADOR_VALIDO_EJEMPLO, visto: "Visto privado de usuario A." };
      localStorage.setItem(claveA, JSON.stringify(borradorA));

      const recuperado = recuperarBorradorSeguro("usr-a", "RD-TMP-2026-001");
      expect(recuperado?.visto).toBe("Visto privado de usuario A.");
    });

    it("T2: Usuario B en el mismo navegador no visualiza el borrador de Usuario A", () => {
      const claveA = obtenerClaveBorrador("usr-a", "RD-TMP-2026-001");
      localStorage.setItem(claveA, JSON.stringify({ ...BORRADOR_VALIDO_EJEMPLO, visto: "Visto privado de A." }));

      // Usuario B consulta
      const recuperadoB = recuperarBorradorSeguro("usr-b", "RD-TMP-2026-001");
      expect(recuperadoB).toBeUndefined();
    });

    it("T3: Logout no expone el contenido privado en sesión anónima", () => {
      const claveA = obtenerClaveBorrador("usr-a", "RD-TMP-2026-001");
      localStorage.setItem(claveA, JSON.stringify({ ...BORRADOR_VALIDO_EJEMPLO, visto: "Visto confidencial de A." }));

      // Sesión anónima (usuario null)
      const recuperadoAnon = recuperarBorradorSeguro(null, "RD-TMP-2026-001");
      expect(recuperadoAnon).toBeUndefined();
    });

    it("T4: JSON corrupto no rompe React y retorna undefined limpiamente", () => {
      const claveA = obtenerClaveBorrador("usr-a", "RD-TMP-2026-001");
      localStorage.setItem(claveA, "{ json corrupto sin cerrar: ");

      expect(() => {
        const recuperado = recuperarBorradorSeguro("usr-a", "RD-TMP-2026-001");
        expect(recuperado).toBeUndefined();
      }).not.toThrow();
    });

    it("T5: Borrador de versión incompatible se rechaza de forma segura", () => {
      const claveA = obtenerClaveBorrador("usr-a", "RD-TMP-2026-001");
      localStorage.setItem(claveA, JSON.stringify({ versionVieja: 1, textoPlano: "Incompatible" }));

      const recuperado = recuperarBorradorSeguro("usr-a", "RD-TMP-2026-001");
      expect(recuperado).toBeUndefined();
    });

    it("T6 & T7: Guardado exitoso y guardado fallido en interfaz ProyectorResolucionesPage", async () => {
      const user = userEvent.setup();
      useAuthStore.setState({
        usuario: { id: "user-test-123", nombreCompleto: "Operador Test", correo: "op@test.pe", rol: "OPERADOR" },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <ProyectorResolucionesPage />
        </MemoryRouter>
      );

      // Guardado exitoso
      const botonGuardar = screen.getByRole("button", { name: /Guardar Borrador/i });
      await user.click(botonGuardar);

      const alertaExito = await screen.findByRole("status");
      expect(alertaExito).toHaveTextContent(/Borrador de trabajo guardado localmente en este navegador/i);
      expect(alertaExito).toHaveTextContent(/No se ha registrado en PostgreSQL/i);

      const claveEsperada = obtenerClaveBorrador("user-test-123", "RD-TMP-2026-001");
      expect(localStorage.getItem(claveEsperada)).not.toBeNull();

      // Guardado fallido (simulando QuotaExceededError)
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("QuotaExceeded", "QuotaExceededError");
      });

      await user.click(botonGuardar);
      const alertaFallo = await screen.findByRole("alert");
      expect(alertaFallo).toHaveTextContent(/No fue posible guardar el borrador en el almacenamiento local del navegador/i);
      expect(alertaFallo).toHaveTextContent(/permanece visible en pantalla/i);

      vi.restoreAllMocks();
    });

    it("T8: No modifica PostgreSQL ni genera llamadas de red de persistencia", async () => {
      const user = userEvent.setup();
      const spyFetch = vi.spyOn(window, "fetch");

      render(
        <MemoryRouter>
          <ProyectorResolucionesPage />
        </MemoryRouter>
      );

      const botonGuardar = screen.getByRole("button", { name: /Guardar Borrador/i });
      await user.click(botonGuardar);

      // Ninguna llamada POST/PUT fue enviada al backend
      expect(spyFetch).not.toHaveBeenCalled();
      spyFetch.mockRestore();
    });

    it("BJ-11: Ignora completamente claves legacy no aisladas (sigd_rd_borrador_*) incluso en sesión anónima", () => {
      // Se almacena bajo la clave legacy no protegida
      const legacyKey = "sigd_rd_borrador_RD-TMP-2026-001";
      localStorage.setItem(legacyKey, JSON.stringify(BORRADOR_VALIDO_EJEMPLO));

      // Tanto un usuario autenticado como uno anónimo deben ignorar la clave legacy
      expect(recuperarBorradorSeguro("usr-cualquiera", "RD-TMP-2026-001")).toBeUndefined();
      expect(recuperarBorradorSeguro(null, "RD-TMP-2026-001")).toBeUndefined();
      expect(recuperarBorradorSeguro(undefined, "RD-TMP-2026-001")).toBeUndefined();
    });

    it("BJ-12: Fuerza estado BORRADOR y neutraliza hash si localStorage contiene un estado alterado como FIRMADO_DIGITALMENTE", () => {
      const claveUsr = obtenerClaveBorrador("usr-directivo", "RD-TMP-2026-001");
      const borradorAlterado = {
        ...BORRADOR_VALIDO_EJEMPLO,
        estado: "FIRMADO_DIGITALMENTE",
        hashBorradorSha256: "malicious_fake_hash_value_12345",
      };
      localStorage.setItem(claveUsr, JSON.stringify(borradorAlterado));

      const recuperado = recuperarBorradorSeguro("usr-directivo", "RD-TMP-2026-001");
      expect(recuperado).toBeDefined();
      expect(recuperado?.estado).toBe("BORRADOR");
      expect(recuperado?.hashBorradorSha256).toBeUndefined();
    });

    it("DEF-01: Al hacer clic en Aprobar y Pasar a Firma Digital navega tras elevación formal sin inyectar metadatos ni hashes ficticios", async () => {
      function DestinoFirma() {
        const location = useLocation();
        return (
          <div>
            <p data-testid="destino-ruta">{location.pathname}</p>
            <p data-testid="destino-state">{JSON.stringify(location.state)}</p>
          </div>
        );
      }

      const user = userEvent.setup();
      useAuthStore.setState({
        usuario: { id: "user-test-123", nombreCompleto: "Operador Test", correo: "op@test.pe", rol: "OPERADOR" },
        isAuthenticated: true,
      });

      const resolucionUuid = "a1111111-2222-4333-8444-555555555555";
      const expedienteUuid = "b1111111-2222-4333-8444-555555555555";

      vi.spyOn(apiClient, "get").mockResolvedValue({
        data: {
          id: resolucionUuid,
          numero: "RD N.° 0412-2026-DG-IESTP-SUIZA",
          expedienteId: expedienteUuid,
          tipoResolucion: "DIRECTORAL_TITULACION",
          visto: "El Expediente N.° EXP-2026-000155.",
          considerandos: ["Que la ley 30512 regula los institutos."],
          articulos: [{ numero: 1, texto: "CONFERIR el título profesional técnico." }],
        },
      } as any);

      const spyPost = vi.spyOn(apiClient, "post").mockResolvedValue({
        data: { ok: true, mensaje: "Atención resolutiva registrada exitosamente." },
      } as any);

      render(
        <MemoryRouter initialEntries={[`/proyector?id=${resolucionUuid}&expedienteId=${expedienteUuid}`]}>
          <Routes>
            <Route path="/proyector" element={<ProyectorResolucionesPage />} />
            <Route path="/flujo-validez-legal/firma" element={<DestinoFirma />} />
          </Routes>
        </MemoryRouter>
      );

      const botonPasarFirma = screen.getByRole("button", {
        name: /Aprobar y Pasar a Firma Digital/i,
      });
      await user.click(botonPasarFirma);

      expect(spyPost).toHaveBeenCalledWith(
        `/api/v1/expedientes/${expedienteUuid}/atender`,
        expect.objectContaining({
          resultado_resumen: expect.stringContaining("elevado a Despacho de Dirección General para firma digital"),
        })
      );

      expect(await screen.findByTestId("destino-ruta")).toHaveTextContent("/flujo-validez-legal/firma");
      const stateContent = (await screen.findByTestId("destino-state")).textContent;
      expect(stateContent).toBe("null");
      expect(stateContent).not.toContain("245760");
      expect(stateContent).not.toContain("hashSha256");
      expect(stateContent).not.toContain("a1b2c3d4");
    });

    it("DEF-02: Bloquea el pase a firma si la resolución no ha sido guardada en base de datos", async () => {
      const user = userEvent.setup();
      useAuthStore.setState({
        usuario: { id: "user-test-123", nombreCompleto: "Operador Test", correo: "op@test.pe", rol: "OPERADOR" },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter initialEntries={["/proyector"]}>
          <Routes>
            <Route path="/proyector" element={<ProyectorResolucionesPage />} />
          </Routes>
        </MemoryRouter>
      );

      const botonPasarFirma = screen.getByRole("button", {
        name: /Aprobar y Pasar a Firma Digital/i,
      });
      await user.click(botonPasarFirma);

      expect(
        screen.getByText(/Debe guardar y generar la resolución institucional en base de datos antes de proceder/i)
      ).toBeInTheDocument();
    });
  });
});
