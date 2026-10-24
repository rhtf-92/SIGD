// Sesión del SIGD: lectura única del almacenamiento local.
// El login demo y el authStore persisten las mismas claves, por lo que
// este hook es la fuente de verdad para el menú y las vistas.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const CLAVE_TOKEN = "sigd_token";
const CLAVE_ROL = "sigd_rol";
const CLAVE_PERMISOS = "sigd_permisos";
const CLAVE_AUTH = "sigd_auth";
const CLAVE_TOKEN_ALT = "token";

export interface Sesion {
  token: string | null;
  rol: string;
  isAuthenticated: boolean;
}

export function leerSesion(): Sesion {
  if (typeof window === "undefined" || !window.localStorage) {
    return { token: null, rol: "", isAuthenticated: false };
  }
  const token =
    window.localStorage.getItem(CLAVE_TOKEN) ??
    window.localStorage.getItem(CLAVE_TOKEN_ALT);
  const rol = window.localStorage.getItem(CLAVE_ROL) ?? "";
  return { token, rol, isAuthenticated: Boolean(token) };
}

export function limpiarSesion(): void {
  try {
    window.localStorage.removeItem(CLAVE_TOKEN);
    window.localStorage.removeItem(CLAVE_TOKEN_ALT);
    window.localStorage.removeItem(CLAVE_ROL);
    window.localStorage.removeItem(CLAVE_PERMISOS);
    window.localStorage.removeItem(CLAVE_AUTH);
  } catch {
    // Sin almacenamiento disponible: no hay nada que limpiar.
  }
}

export function useSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);

  // Solo suscribe al almacenamiento externo; la sesión se deriva en el
  // render para no encadenar renders desde efectos.
  useEffect(() => {
    const alCambiar = () => setVersion((v) => v + 1);
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, []);

  const sesion = useMemo(
    () => leerSesion(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.pathname, version],
  );

  const logout = useCallback(() => {
    limpiarSesion();
    setVersion((v) => v + 1);
    navigate("/", { replace: true });
  }, [navigate]);

  return { ...sesion, logout };
}
