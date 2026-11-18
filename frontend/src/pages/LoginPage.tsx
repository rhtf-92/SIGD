import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";

import { useAuthStore } from "../stores/authStore";
import { ApiHttpError } from "../types/api";
import { canAccessRoute, DESTINO_POR_ROL, type RolCanonica } from "../config/navigation.config";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import logoSuiza from "../assets/sigd/logo-suiza.webp";

const ROLES_INSTITUCIONALES: RolCanonica[] = [
  'ADMINISTRADOR',
  'MESA_PARTES',
  'DIRECTOR',
  'SECRETARIO',
  'ESPECIALISTA',
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Intent y from capturados de location.state o querystring
  const locationState = location.state as {
    from?: string | { pathname?: string };
    intent?: string;
  } | null;
  const searchParams = new URLSearchParams(location.search);
  const intent = locationState?.intent || searchParams.get('intent') || undefined;
  const fromPath =
    (typeof locationState?.from === 'string'
      ? locationState.from
      : locationState?.from?.pathname) ||
    searchParams.get('from') ||
    searchParams.get('returnUrl') ||
    undefined;

  // Estado para desplegar aviso cuando una cuenta institucional inicia sesión con intención TUPA
  const [avisoInstitucional, setAvisoInstitucional] = useState<{
    rol: string;
  } | null>(() => {
    const isAuth = useAuthStore.getState().isAuthenticated;
    const user = useAuthStore.getState().usuario;
    const reqIntent = (location.state as any)?.intent || new URLSearchParams(location.search).get('intent');
    if (
      isAuth &&
      user?.rol &&
      ROLES_INSTITUCIONALES.includes(user.rol as RolCanonica) &&
      reqIntent === 'SOLICITAR_ACCESO_TUPA'
    ) {
      return { rol: user.rol };
    }
    return null;
  });

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await login({ identificador: identificador.trim(), password });
      const rol = useAuthStore.getState().usuario?.rol as RolCanonica | undefined;

      const esSolicitudTupa =
        intent === 'SOLICITAR_ACCESO_TUPA' ||
        fromPath === '/solicitud-acceso-tupa' ||
        searchParams.get('intent') === 'SOLICITAR_ACCESO_TUPA';

      if (esSolicitudTupa) {
        if (rol === 'CIUDADANO') {
          navigate('/solicitud-acceso-tupa', { replace: true });
          return;
        }

        if (rol && ROLES_INSTITUCIONALES.includes(rol)) {
          setAvisoInstitucional({ rol });
          return;
        }
      }

      const contextosDisponibles = useAuthStore.getState().contextosDisponibles;
      const tieneMultiplesContextos = contextosDisponibles && contextosDisponibles.length > 1;
      const contexto = useAuthStore.getState().contextoActivo;

      const contextoEfectivo = tieneMultiplesContextos ? contexto : undefined;
      const destinoCanonico = (tieneMultiplesContextos && contexto === 'PERSONAL')
        ? '/mesa-partes'
        : (rol ? DESTINO_POR_ROL[rol] : '/');

      navigate(
        rol && fromPath && canAccessRoute(rol, fromPath, contextoEfectivo)
          ? fromPath
          : destinoCanonico,
        { replace: true }
      );
    } catch (cause) {
      setError(cause instanceof ApiHttpError
        ? cause.problemDetails.detail || "No fue posible iniciar sesión."
        : "No se pudo conectar con el servicio de autenticación.");
    } finally {
      setEnviando(false);
    }
  }

  // Pantalla Informativa de Acceso Institucional Detectado
  if (avisoInstitucional) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-8 text-slate-900">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-sky-50 text-suiza-primary flex items-center justify-center font-bold shadow-2xs shrink-0">
              <ShieldCheck className="h-6 w-6 text-suiza-primary" />
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                Rol: {avisoInstitucional.rol}
              </span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
                Acceso institucional detectado
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Tu cuenta pertenece al personal del instituto y ya cuenta con acceso al Catálogo TUPA institucional. No necesitas solicitar autorización.
          </p>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <Link to="/tupa" className="w-full sm:w-auto">
              <Button variant="primary" size="md" className="w-full">
                Ir al Catálogo TUPA <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <Link to="/" className="w-full sm:w-auto">
              <Button variant="secondary" size="md" className="w-full">
                Volver al inicio
              </Button>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-surface-page px-4 py-6 sm:py-8 text-slate-900 w-full">
      <section className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs">
        <div className="mb-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-suiza-primary transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio
          </Link>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <img
              src={logoSuiza}
              alt="IESTP Suiza"
              width={40}
              height={41}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="h-10 w-auto object-contain aspect-[256/261]"
            />
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              <span className="h-2 w-2 rounded-full bg-suiza-primary" />
              IESTP &quot;Suiza&quot;
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight pt-1">Iniciar sesión</h1>
          <p className="text-xs text-slate-500">Sistema Integral de Gestión Documentaria</p>
        </div>

        <form onSubmit={iniciarSesion} className="mt-4 space-y-3.5">
          <Input
            id="identificador"
            name="identificador"
            label="Usuario o correo electrónico"
            autoComplete="username"
            required
            value={identificador}
            onChange={(event) => setIdentificador(event.target.value)}
            placeholder="usuario@iestp-suiza.edu.pe o tu correo"
            helperText="Ingresa tu usuario o correo registrado"
          />

          <Input
            id="password"
            name="password"
            type="password"
            label="Contraseña"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={enviando}
            isLoading={enviando}
            loadingText="Ingresando…"
            aria-label="Ingresar al sistema"
            className="w-full mt-1"
          >
            Iniciar sesión
          </Button>
        </form>

        {/* Separación conceptual visual para administrados */}
        <div className="mt-4 pt-3.5 border-t border-slate-200 text-center space-y-1.5">
          <p className="text-xs text-slate-600 font-medium">
            ¿Eres ciudadano y deseas realizar un trámite?
          </p>
          <Link to="/registro" className="block">
            <Button variant="secondary" size="sm" className="w-full">
              Registrarme
            </Button>
          </Link>
          <p className="text-[11px] text-slate-400">
            El personal del instituto accede con su cuenta institucional.
          </p>
        </div>
      </section>
    </main>
  );
}
