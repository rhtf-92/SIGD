import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import {
  IdCard,
  Mail,
  UserRoundCog,
  ShieldCheck,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { usernameSchema } from '../../schemas/registroCiudadano.schema';
import avatarPerfil from '../../assets/sigd/avatar-perfil.webp';
import { Button } from '../../components/ui/Button';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { obtenerInfoArea } from '../../utils/areaPresentacion';

interface PerfilCiudadano {
  id: string;
  idPersona: string;
  username: string | null;
  usernameConfigurado: boolean;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  direccion: string | null;
}

function mensajeError(error: unknown): string {
  if (axios.isAxiosError<{ detail?: string; message?: string }>(error)) {
    return error.response?.data?.detail ?? error.response?.data?.message ?? 'No se pudo completar la operación.';
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

export default function MiPerfilPage() {
  const location = useLocation();
  const volverAlTramite = new URLSearchParams(location.search).get('returnTo') === '/tramite';
  const token = useAuthStore((state) => state.accessToken);
  const usuario = useAuthStore((state) => state.usuario);

  const [perfil, setPerfil] = useState<PerfilCiudadano | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');

  const cargarPerfil = async (signal?: AbortSignal) => {
    const response = await apiClient.get<PerfilCiudadano>('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (signal?.aborted) return;
    const data = response.data;
    setPerfil(data);
    setCorreo(data.correo ?? '');
    setTelefono(data.telefono ?? '');
    setDireccion(data.direccion ?? '');
    setUsername('');
    useAuthStore.setState((state) => ({
      usuario: state.usuario ? { ...state.usuario, correo: data.correo } : null,
    }));
  };

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setCargando(true);
    cargarPerfil(controller.signal)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(mensajeError(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [token]);

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!perfil || !token || guardando) return;
    setError(null);
    setExito(null);
    const cambios: Record<string, string> = {};
    if (!perfil.usernameConfigurado && username.trim()) {
      const parsed = usernameSchema.safeParse(username);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Nombre de usuario inválido.');
        return;
      }
      cambios.username = parsed.data;
    }
    const correoNormalizado = correo.trim().toLowerCase();
    if (correoNormalizado !== perfil.correo) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado)) {
        setError('Ingrese un correo válido.');
        return;
      }
      cambios.correo = correoNormalizado;
    }
    if (telefono !== (perfil.telefono ?? '')) {
      if (!/^9[0-9]{8}$/.test(telefono)) {
        setError('Ingrese un celular de nueve dígitos que empiece en 9.');
        return;
      }
      cambios.telefono = telefono;
    }
    if (direccion.trim() !== (perfil.direccion ?? '')) {
      if (direccion.trim().length < 5 || direccion.trim().length > 250) {
        setError('La dirección debe tener entre 5 y 250 caracteres.');
        return;
      }
      cambios.direccion = direccion.trim();
    }
    if (Object.keys(cambios).length === 0) {
      setExito('No hay cambios para guardar.');
      return;
    }
    setGuardando(true);
    try {
      await apiClient.patch('/api/v1/auth/me', cambios, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await cargarPerfil();
      setExito('Perfil actualizado correctamente.');
    } catch (cause) {
      setError(mensajeError(cause));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || guardando) return;
    setError(null);
    setExito(null);
    if (
      passwordNueva.length < 8 ||
      passwordNueva.length > 128 ||
      passwordNueva !== confirmarPassword
    ) {
      setError('Revise la nueva contraseña y su confirmación.');
      return;
    }
    setGuardando(true);
    try {
      await apiClient.patch(
        '/api/v1/auth/me/password',
        { passwordActual, passwordNueva, confirmarPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      useAuthStore.getState().logout();
    } catch (cause) {
      setError(mensajeError(cause));
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6" role="status">
        <p className="sr-only">Cargando mi perfil...</p>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="h-6 w-48 rounded bg-slate-200" />
              <div className="h-3 w-24 rounded bg-slate-100" />
            </div>
          </div>
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </main>
    );
  }

  if (!perfil) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error ?? 'No se pudo cargar el perfil.'}
        </div>
      </main>
    );
  }

  const infoArea = usuario && usuario.rol !== 'CIUDADANO'
    ? obtenerInfoArea(usuario.areaId, null, usuario.rol)
    : null;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 text-slate-900">
      {/* 1. Cabecera Ficha de Perfil con Avatar Oficial */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5">
            <img
              src={avatarPerfil}
              alt="Avatar institucional"
              width={96}
              height={96}
              loading="lazy"
              decoding="async"
              className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover border-2 border-slate-100 shadow-xs shrink-0 bg-slate-50 aspect-square"
            />
            <div>
              <h2 className="sr-only">Mi perfil</h2>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center rounded-md bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-bold">
                  {usuario?.rol === 'CIUDADANO' ? 'Usuario externo' : usuario?.rol || 'Personal institucional'}
                </span>
                {infoArea?.nombre && (
                  <span className="inline-flex items-center rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold">
                    {infoArea.nombre}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                {perfil.nombres} {perfil.apellidos}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-mono mt-0.5">
                {perfil.username ? `@${perfil.username}` : (usuario?.correo || perfil.correo)}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto flex justify-end">
            <Link
              to="/tramite"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-suiza-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              {volverAlTramite ? 'Volver al trámite' : 'Volver a trámites'}
            </Link>
          </div>
        </div>
      </section>

      {/* Alertas de Notificación */}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs sm:text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {exito && (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs sm:text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{exito}</span>
        </div>
      )}

      {/* Aviso Contextual de Identidad Protegida */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-2xs">
        <ShieldCheck className="h-5 w-5 text-suiza-primary shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Identidad protegida
          </h3>
          <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
            Tus datos de identidad están protegidos. Identifican tu cuenta y no se modifican directamente desde el perfil.
          </p>
        </div>
      </div>

      {/* 2. Panel Identidad (IdCard) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <IdCard className="h-5 w-5 text-suiza-primary" />
          <h2 className="font-bold text-slate-900 text-sm sm:text-base">Identidad</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700 block">
            Tipo de documento
            <input
              aria-label="Tipo de documento"
              value={perfil.tipoDocumento}
              readOnly
              className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 cursor-not-allowed focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700 block">
            Número de documento
            <input
              aria-label="Número de documento"
              value={perfil.numeroDocumento}
              readOnly
              className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 cursor-not-allowed focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700 block">
            Nombres
            <input
              aria-label="Nombres"
              value={perfil.nombres}
              readOnly
              className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 cursor-not-allowed focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700 block">
            Apellidos
            <input
              aria-label="Apellidos"
              value={perfil.apellidos}
              readOnly
              className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 cursor-not-allowed focus:outline-none"
            />
          </label>
        </div>
      </section>

      {/* 3. Panel Contacto y Cuenta (Mail, Phone, UserRoundCog) */}
      <form onSubmit={guardar} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Mail className="h-5 w-5 text-suiza-primary" />
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">Datos de contacto</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Correo
              <input
                type="email"
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
                autoComplete="email"
                className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20 focus:outline-none transition"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Teléfono
              <input
                type="tel"
                value={telefono}
                onChange={(event) => setTelefono(event.target.value)}
                autoComplete="tel"
                className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20 focus:outline-none transition"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
              Dirección
              <input
                value={direccion}
                onChange={(event) => setDireccion(event.target.value)}
                autoComplete="street-address"
                className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20 focus:outline-none transition"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserRoundCog className="h-5 w-5 text-suiza-primary" />
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">Cuenta y usuario</h2>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Nombre de usuario
            {perfil.usernameConfigurado ? (
              <input
                value={perfil.username ?? ''}
                readOnly
                className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 cursor-not-allowed focus:outline-none"
              />
            ) : (
              <>
                <p className="mt-1 text-sm font-normal text-slate-500">No configurado</p>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Agregar nombre de usuario (opcional)"
                  autoComplete="username"
                  className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20 focus:outline-none transition"
                />
                <p className="mt-1.5 text-xs font-normal text-slate-500">
                  Podrá usarlo para iniciar sesión. El correo seguirá funcionando.
                </p>
              </>
            )}
          </label>
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={guardando}
              isLoading={guardando}
              loadingText="Guardando cambios..."
            >
              Guardar cambios
            </Button>
          </div>
        </section>
      </form>

      {/* 4. Panel Seguridad (Lock) */}
      <form onSubmit={cambiarPassword} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Lock className="h-5 w-5 text-suiza-primary" />
          <div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">Seguridad</h2>
            <p className="text-xs text-slate-500">Cambio seguro de contraseña</p>
          </div>
        </div>
        <p className="text-xs text-slate-600">Después del cambio deberá iniciar sesión nuevamente.</p>
        <div className="grid gap-4">
          <label className="block text-xs font-semibold text-slate-700">
            Contraseña actual
            <input
              type="password"
              value={passwordActual}
              onChange={(event) => setPasswordActual(event.target.value)}
              autoComplete="current-password"
              required
              className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20 focus:outline-none transition"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Nueva contraseña
              <input
                type="password"
                value={passwordNueva}
                onChange={(event) => setPasswordNueva(event.target.value)}
                autoComplete="new-password"
                required
                className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20 focus:outline-none transition"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Confirmar nueva contraseña
              <input
                type="password"
                value={confirmarPassword}
                onChange={(event) => setConfirmarPassword(event.target.value)}
                autoComplete="new-password"
                required
                className="mt-1.5 w-full h-11 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20 focus:outline-none transition"
              />
            </label>
          </div>
        </div>
        <div className="pt-2">
          <Button
            type="submit"
            variant="secondary"
            size="md"
            disabled={guardando}
          >
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </main>
  );
}
