import { describe, it, expect } from "vitest";
import {
  autenticarCredenciales,
  buscarUsuarioPorIdentificador,
  sincronizarRolPorIdentificador,
  generarTokenSeguro,
  USUARIOS_AUTORIZADOS,
} from "../../../src/services/authService";

describe("authService — Base de datos mock y validación segura de autenticación SIGD", () => {
  describe("1. Directorio de Usuarios Institucionales Autorizados", () => {
    it("incluye exactamente los usuarios autorizados para los 5 roles canónicos", () => {
      const rolesPresentes = USUARIOS_AUTORIZADOS.map((u) => u.rol);
      expect(rolesPresentes).toContain("SUPER_ADMIN");
      expect(rolesPresentes).toContain("DIRECTOR");
      expect(rolesPresentes).toContain("DOCENTE");
      expect(rolesPresentes).toContain("MESA_PARTES");
      expect(rolesPresentes).toContain("ESTUDIANTE");
    });

    it("permite buscar usuarios por DNI, nombre de usuario y correo institucional", () => {
      // Búsqueda por DNI
      const porDni = buscarUsuarioPorIdentificador("70123456");
      expect(porDni?.rol).toBe("SUPER_ADMIN");
      expect(porDni?.nombreCompleto).toContain("Super Administrador");

      // Búsqueda por username (case-insensitive)
      const porUsuario = buscarUsuarioPorIdentificador("DIRECTOR");
      expect(porUsuario?.rol).toBe("DIRECTOR");

      // Búsqueda por correo institucional
      const porCorreo = buscarUsuarioPorIdentificador("docente@iestpsuiza.edu.pe");
      expect(porCorreo?.rol).toBe("DOCENTE");

      // Búsqueda por correo secundario
      const porSecundario = buscarUsuarioPorIdentificador("coordinacion@iestpsuiza.edu.pe");
      expect(porSecundario?.rol).toBe("DOCENTE");

      // Identificador no existente
      const noExiste = buscarUsuarioPorIdentificador("99990000");
      expect(noExiste).toBeNull();
    });

    it("sincroniza el rol institucional correcto a partir del identificador", () => {
      expect(sincronizarRolPorIdentificador("70123456")).toBe("SUPER_ADMIN");
      expect(sincronizarRolPorIdentificador("10234567")).toBe("DIRECTOR");
      expect(sincronizarRolPorIdentificador("20345678")).toBe("DOCENTE");
      expect(sincronizarRolPorIdentificador("30456789")).toBe("MESA_PARTES");
      expect(sincronizarRolPorIdentificador("40567890")).toBe("ESTUDIANTE");
      expect(sincronizarRolPorIdentificador("usuario_fantasma")).toBeNull();
    });

    it("genera un token JWT con cabecera y payload estructurados", () => {
      const usuario = USUARIOS_AUTORIZADOS[0];
      const token = generarTokenSeguro(usuario);

      expect(token).toMatch(/^sigd-jwt\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.sigd-[a-z0-9-]+$/);
    });
  });

  describe("2. Validación Estricta de Credenciales (Empty, Missing, Wrong)", () => {
    it("deniega el acceso si el identificador está vacío", async () => {
      const res = await autenticarCredenciales({
        identificador: "   ",
        password: "ClaveSegura2026",
        rolSeleccionado: "SUPER_ADMIN",
      });

      expect(res.exito).toBe(false);
      if (!res.exito) {
        expect(res.codigoError).toBe("CAMPOS_VACIOS");
        expect(res.mensaje).toMatch(/ingrese su usuario, DNI o correo/i);
      }
    });

    it("deniega el acceso si la contraseña está vacía", async () => {
      const res = await autenticarCredenciales({
        identificador: "70123456",
        password: "",
        rolSeleccionado: "SUPER_ADMIN",
      });

      expect(res.exito).toBe(false);
      if (!res.exito) {
        expect(res.codigoError).toBe("CAMPOS_VACIOS");
        expect(res.mensaje).toMatch(/ingrese su contraseña/i);
      }
    });

    it("deniega el acceso si el usuario o DNI no existe en el sistema", async () => {
      const res = await autenticarCredenciales({
        identificador: "00001111",
        password: "ClaveSegura2026",
        rolSeleccionado: "SUPER_ADMIN",
      });

      expect(res.exito).toBe(false);
      if (!res.exito) {
        expect(res.codigoError).toBe("USUARIO_NO_ENCONTRADO");
        expect(res.mensaje).toMatch(/no registrado en el sistema institucional/i);
      }
    });

    it("deniega el acceso si la contraseña es incorrecta", async () => {
      const res = await autenticarCredenciales({
        identificador: "70123456",
        password: "PasswordErronea!",
        rolSeleccionado: "SUPER_ADMIN",
      });

      expect(res.exito).toBe(false);
      if (!res.exito) {
        expect(res.codigoError).toBe("PASSWORD_INCORRECTA");
        expect(res.mensaje).toMatch(/contraseña incorrecta/i);
      }
    });

    it("deniega el acceso si la cuenta se encuentra suspendida o inactiva", async () => {
      const res = await autenticarCredenciales({
        identificador: "99999999",
        password: "Inactivo2026!",
        rolSeleccionado: "ESTUDIANTE",
      });

      expect(res.exito).toBe(false);
      if (!res.exito) {
        expect(res.codigoError).toBe("CUENTA_SUSPENDIDA");
        expect(res.mensaje).toMatch(/inactiva o suspendida/i);
      }
    });
  });

  describe("3. Validación de Roles RBAC y Sincronización Estricta", () => {
    it("deniega el acceso si el rol seleccionado no corresponde a las facultades del usuario", async () => {
      // Usuario es SUPER_ADMIN pero intenta ingresar como DOCENTE
      const res = await autenticarCredenciales({
        identificador: "70123456",
        password: "ClaveSegura2026",
        rolSeleccionado: "DOCENTE",
      });

      expect(res.exito).toBe(false);
      if (!res.exito) {
        expect(res.codigoError).toBe("ROL_NO_CORRESPONDE");
        expect(res.mensaje).toMatch(/Acceso denegado \(RBAC\)/i);
        expect(res.mensaje).toContain("DOCENTE");
        expect(res.mensaje).toContain("SUPER_ADMIN");
        expect(res.sugerenciaRol).toBe("SUPER_ADMIN");
      }
    });

    it("autentica con éxito para cada uno de los 5 roles canónicos con sus credenciales y destino respectivo", async () => {
      const casos = [
        {
          id: "70123456",
          clave: "ClaveSegura2026",
          rol: "SUPER_ADMIN",
          destino: "/",
        },
        {
          id: "10234567",
          clave: "Director2026!",
          rol: "DIRECTOR",
          destino: "/",
        },
        {
          id: "20345678",
          clave: "Docente2026!",
          rol: "DOCENTE",
          destino: "/flujos/titulacion",
        },
        {
          id: "30456789",
          clave: "MesaPartes2026!",
          rol: "MESA_PARTES",
          destino: "/tramite/ventanilla-presencial",
        },
        {
          id: "40567890",
          clave: "Estudiante2026!",
          rol: "ESTUDIANTE",
          destino: "/casilla",
        },
      ];

      for (const caso of casos) {
        const res = await autenticarCredenciales({
          identificador: caso.id,
          password: caso.clave,
          rolSeleccionado: caso.rol,
        });

        expect(res.exito).toBe(true);
        if (res.exito) {
          expect(res.usuario.rol).toBe(caso.rol);
          expect(res.token).toBeTruthy();
          expect(res.destino).toBe(caso.destino);
        }
      }
    });
  });
});
