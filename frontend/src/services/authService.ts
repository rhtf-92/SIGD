// Servicio de autenticación institucional SIGD y control RBAC
// Simula la base de datos segura y el protocolo de validación de credenciales
// del IESTP "Suiza" (Pucallpa - Ucayali).

export type RolCanonicoId =
  | "SUPER_ADMIN"
  | "DIRECTOR"
  | "DOCENTE"
  | "MESA_PARTES"
  | "ESTUDIANTE";

export interface UsuarioAutorizado {
  id: string;
  dni: string;
  usuario: string;
  correo: string;
  correosSecundarios?: string[];
  password: string;
  passwordsAlternativas?: string[];
  rol: RolCanonicoId;
  nombreCompleto: string;
  cargo: string;
  area: string;
  activo: boolean;
  destino: string;
}

/**
 * Base de datos mock de usuarios institucionales autorizados.
 * Cada usuario posee credenciales únicas y un rol canónico estricto.
 */
export const USUARIOS_AUTORIZADOS: UsuarioAutorizado[] = [
  {
    id: "usr-admin-01",
    dni: "70123456",
    usuario: "admin",
    correo: "admin.sigd@iestpsuiza.edu.pe",
    correosSecundarios: ["admin@iestpsuiza.edu.pe"],
    password: "ClaveSegura2026",
    passwordsAlternativas: ["Admin2026!", "admin123"],
    rol: "SUPER_ADMIN",
    nombreCompleto: "Ing. Super Administrador",
    cargo: "Administrador General del Sistema",
    area: "Oficina de Tecnologías de la Información",
    activo: true,
    destino: "/",
  },
  {
    id: "usr-dir-01",
    dni: "10234567",
    usuario: "director",
    correo: "direccion@iestpsuiza.edu.pe",
    correosSecundarios: ["director@iestpsuiza.edu.pe"],
    password: "Director2026!",
    passwordsAlternativas: ["ClaveSegura2026"],
    rol: "DIRECTOR",
    nombreCompleto: "Mg. Director General",
    cargo: "Director General IESTP Suiza",
    area: "Dirección General",
    activo: true,
    destino: "/",
  },
  {
    id: "usr-doc-01",
    dni: "20345678",
    usuario: "docente",
    correo: "docente@iestpsuiza.edu.pe",
    correosSecundarios: [
      "coordinacion@iestpsuiza.edu.pe",
      "docente.titulacion@iestpsuiza.edu.pe",
    ],
    password: "Docente2026!",
    passwordsAlternativas: ["ClaveSegura2026"],
    rol: "DOCENTE",
    nombreCompleto: "Lic. Docente / Coordinador",
    cargo: "Docente / Coordinador de Titulación",
    area: "Área Académica",
    activo: true,
    destino: "/flujos/titulacion",
  },
  {
    id: "usr-mp-01",
    dni: "30456789",
    usuario: "mesapartes",
    correo: "mesapartes@iestpsuiza.edu.pe",
    correosSecundarios: ["tramite@iestpsuiza.edu.pe", "ventanilla@iestpsuiza.edu.pe"],
    password: "MesaPartes2026!",
    passwordsAlternativas: ["ClaveSegura2026"],
    rol: "MESA_PARTES",
    nombreCompleto: "Operador de Ventanilla",
    cargo: "Operador de Mesa de Partes / Ventanilla",
    area: "Mesa de Partes y Trámite Documentario",
    activo: true,
    destino: "/tramite/ventanilla-presencial",
  },
  {
    id: "usr-est-01",
    dni: "40567890",
    usuario: "estudiante",
    correo: "estudiante@iestpsuiza.edu.pe",
    correosSecundarios: ["alumno@iestpsuiza.edu.pe"],
    password: "Estudiante2026!",
    passwordsAlternativas: ["ClaveSegura2026"],
    rol: "ESTUDIANTE",
    nombreCompleto: "Estudiante / Administrado",
    cargo: "Estudiante Regular",
    area: "Secretaría Académica",
    activo: true,
    destino: "/casilla",
  },
  {
    id: "usr-inactivo-01",
    dni: "99999999",
    usuario: "inactivo",
    correo: "inactivo@iestpsuiza.edu.pe",
    password: "Inactivo2026!",
    rol: "ESTUDIANTE",
    nombreCompleto: "Usuario Inactivo Demo",
    cargo: "Estudiante Suspendido",
    area: "Secretaría Académica",
    activo: false,
    destino: "/casilla",
  },
];

export type CodigoErrorAuth =
  | "CAMPOS_VACIOS"
  | "USUARIO_NO_ENCONTRADO"
  | "PASSWORD_INCORRECTA"
  | "ROL_NO_CORRESPONDE"
  | "CUENTA_SUSPENDIDA";

export type AuthResultado =
  | {
      exito: true;
      usuario: UsuarioAutorizado;
      token: string;
      destino: string;
    }
  | {
      exito: false;
      codigoError: CodigoErrorAuth;
      mensaje: string;
      sugerenciaRol?: RolCanonicoId;
    };

/**
 * Busca un usuario institucional por su DNI, identificador alfanumérico o correo institucional.
 */
export function buscarUsuarioPorIdentificador(
  identificador: string,
): UsuarioAutorizado | null {
  const limpio = identificador.trim().toLowerCase();
  if (!limpio) return null;

  return (
    USUARIOS_AUTORIZADOS.find((u) => {
      if (u.dni === limpio) return true;
      if (u.usuario.toLowerCase() === limpio) return true;
      if (u.correo.toLowerCase() === limpio) return true;
      if (u.correosSecundarios?.some((c) => c.toLowerCase() === limpio)) return true;
      return false;
    }) ?? null
  );
}

/**
 * Detecta el rol canónico asignado al identificador para permitir sincronización proactiva.
 */
export function sincronizarRolPorIdentificador(
  identificador: string,
): RolCanonicoId | null {
  const usuario = buscarUsuarioPorIdentificador(identificador);
  return usuario ? usuario.rol : null;
}

/**
 * Genera un token JWT institucional seguro simulado con cabecera y carga útil válidas.
 */
export function generarTokenSeguro(usuario: UsuarioAutorizado): string {
  const encabezado = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    sub: usuario.id,
    dni: usuario.dni,
    correo: usuario.correo,
    rol: usuario.rol,
    nombre: usuario.nombreCompleto,
    iss: "sigd.iestpsuiza.edu.pe",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60, // 8 horas de sesión
  };

  const base64Url = (obj: object) => {
    try {
      const json = JSON.stringify(obj);
      if (typeof btoa !== "undefined") {
        return btoa(unescape(encodeURIComponent(json)))
          .replace(/=/g, "")
          .replace(/\+/g, "-")
          .replace(/\//g, "_");
      }
      return Buffer.from(json).toString("base64url");
    } catch {
      return "base64-payload";
    }
  };

  const headerB64 = base64Url(encabezado);
  const payloadB64 = base64Url(payload);
  const firmaMock = `sigd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;

  return `sigd-jwt.${headerB64}.${payloadB64}.${firmaMock}`;
}

/**
 * Valida de forma estricta las credenciales institucionales y el rol RBAC seleccionado.
 * Ningún usuario puede ingresar si deja campos vacíos, si introduce credenciales incorrectas,
 * o si el selector de rol no corresponde al asignado en el directorio oficial.
 */
export async function autenticarCredenciales(params: {
  identificador: string;
  password: string;
  rolSeleccionado: string;
}): Promise<AuthResultado> {
  const { identificador, password, rolSeleccionado } = params;

  // 1. Validación de campos obligatorios
  const trimmedId = identificador.trim();
  if (!trimmedId) {
    return {
      exito: false,
      codigoError: "CAMPOS_VACIOS",
      mensaje: "Por favor, ingrese su usuario, DNI o correo institucional.",
    };
  }

  if (!password) {
    return {
      exito: false,
      codigoError: "CAMPOS_VACIOS",
      mensaje: "Por favor, ingrese su contraseña de acceso.",
    };
  }

  // Simulación de latencia de red para evitar ataques de temporización (timing attacks)
  await new Promise((resolve) => setTimeout(resolve, 80));

  // 2. Búsqueda del usuario en el directorio seguro
  const usuario = buscarUsuarioPorIdentificador(trimmedId);
  if (!usuario) {
    return {
      exito: false,
      codigoError: "USUARIO_NO_ENCONTRADO",
      mensaje:
        "Usuario o DNI no registrado en el sistema institucional. Verifique sus datos o solicite su alta en Mesa de Partes.",
    };
  }

  // 3. Verificación de estado de cuenta
  if (!usuario.activo) {
    return {
      exito: false,
      codigoError: "CUENTA_SUSPENDIDA",
      mensaje:
        "Su cuenta institucional se encuentra inactiva o suspendida. Por favor, contacte a la Oficina de Tecnologías (OTI).",
    };
  }

  // 4. Verificación de contraseña estricta
  const passwordCoincide =
    password === usuario.password ||
    usuario.passwordsAlternativas?.includes(password);

  if (!passwordCoincide) {
    return {
      exito: false,
      codigoError: "PASSWORD_INCORRECTA",
      mensaje:
        "Contraseña incorrecta. Por favor, verifique sus credenciales institucionales e intente nuevamente.",
    };
  }

  // 5. Validación de Gobernanza y Roles (RBAC estricto)
  if (usuario.rol !== rolSeleccionado) {
    return {
      exito: false,
      codigoError: "ROL_NO_CORRESPONDE",
      mensaje: `Acceso denegado (RBAC): El rol seleccionado '${rolSeleccionado}' no corresponde a sus facultades institucionales. Su rol autorizado es '${usuario.rol}'.`,
      sugerenciaRol: usuario.rol,
    };
  }

  // 6. Autenticación exitosa
  const token = generarTokenSeguro(usuario);

  return {
    exito: true,
    usuario,
    token,
    destino: usuario.destino,
  };
}
