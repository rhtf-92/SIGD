import { apiClient } from "../api/client";
import { ApiHttpError } from "../types/api";

export type RolCanonicoId =
  | "SUPER_ADMIN"
  | "DIRECTOR"
  | "DOCENTE"
  | "MESA_PARTES"
  | "ESTUDIANTE";

export interface UsuarioAutorizado {
  id: string;
  usuario: string;
  correo: string;
  rol: RolCanonicoId;
  nombreCompleto: string;
  areaId?: string;
  activo: boolean;
}

export type CodigoErrorAuth =
  | "CAMPOS_VACIOS"
  | "CREDENCIALES_INVALIDAS"
  | "CUENTA_SUSPENDIDA"
  | "ERROR_SERVIDOR";

export type AuthResultado =
  | {
      exito: true;
      usuario: UsuarioAutorizado;
      token: string;
      refreshToken: string;
      destino: string;
    }
  | {
      exito: false;
      codigoError: CodigoErrorAuth;
      mensaje: string;
    };

const DESTINO_POR_ROL: Record<RolCanonicoId, string> = {
  SUPER_ADMIN: "/",
  DIRECTOR: "/",
  DOCENTE: "/flujos/titulacion",
  MESA_PARTES: "/tramite/ventanilla-presencial",
  ESTUDIANTE: "/casilla",
};

const ROLES_CONOCIDOS: RolCanonicoId[] = [
  "SUPER_ADMIN",
  "DIRECTOR",
  "DOCENTE",
  "MESA_PARTES",
  "ESTUDIANTE",
];

const MAPEO_ROLES_BACKEND: Record<string, RolCanonicoId> = {
  ADMINISTRADOR: "SUPER_ADMIN",
  DIRECTOR: "DIRECTOR",
  SECRETARIO: "DOCENTE",
  ESPECIALISTA: "DOCENTE",
  MESA_PARTES: "MESA_PARTES",
  CIUDADANO: "ESTUDIANTE",
};

function normalizarRol(rol: string): RolCanonicoId {
  const rolNormalizado = rol.trim().toUpperCase();
  if (ROLES_CONOCIDOS.includes(rolNormalizado as RolCanonicoId)) {
    return rolNormalizado as RolCanonicoId;
  }
  return MAPEO_ROLES_BACKEND[rolNormalizado] ?? "ESTUDIANTE";
}

export function destinoPorRol(rol: string): string {
  return DESTINO_POR_ROL[normalizarRol(rol)];
}

export async function autenticarCredenciales(params: {
  identificador: string;
  password: string;
}): Promise<AuthResultado> {
  const identificador = params.identificador.trim();
  if (!identificador) {
    return {
      exito: false,
      codigoError: "CAMPOS_VACIOS",
      mensaje: "Por favor, ingrese su usuario, DNI o correo institucional.",
    };
  }
  if (!params.password) {
    return {
      exito: false,
      codigoError: "CAMPOS_VACIOS",
      mensaje: "Por favor, ingrese su contraseña de acceso.",
    };
  }

  try {
    const { data } = await apiClient.post<{
      accessToken: string;
      refreshToken: string;
      usuario: {
        id: string;
        nombreCompleto: string;
        correo: string;
        rol: string;
        areaId?: string;
      };
    }>("/api/v1/auth/login", {
      identificador,
      password: params.password,
    });

    const rol = normalizarRol(data.usuario.rol);
    return {
      exito: true,
      token: data.accessToken,
      refreshToken: data.refreshToken,
      usuario: {
        id: data.usuario.id,
        usuario: data.usuario.correo.split("@")[0],
        correo: data.usuario.correo,
        rol,
        nombreCompleto: data.usuario.nombreCompleto,
        areaId: data.usuario.areaId,
        activo: true,
      },
      destino: DESTINO_POR_ROL[rol],
    };
  } catch (error: unknown) {
    if (error instanceof ApiHttpError) {
      if (error.status === 403 && error.problemDetails.code === "ACCOUNT_DISABLED") {
        return {
          exito: false,
          codigoError: "CUENTA_SUSPENDIDA",
          mensaje: "Su cuenta institucional se encuentra suspendida o deshabilitada.",
        };
      }
      if (error.status === 401) {
        return {
          exito: false,
          codigoError: "CREDENCIALES_INVALIDAS",
          mensaje: "Credenciales inválidas. Verifique su usuario o contraseña institucional.",
        };
      }
      return {
        exito: false,
        codigoError: "ERROR_SERVIDOR",
        mensaje: error.problemDetails.detail || "No fue posible validar sus credenciales.",
      };
    }
    return {
      exito: false,
      codigoError: "ERROR_SERVIDOR",
      mensaje: "No fue posible conectar con el servicio de autenticación del SIGD.",
    };
  }
}
