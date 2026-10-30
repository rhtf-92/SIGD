import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { usernameSchema } from '../../schemas/registroCiudadano.schema';

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
      headers: { Authorization: `Bearer ${token}` }, signal,
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
    cargarPerfil(controller.signal).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(mensajeError(cause));
    }).finally(() => {
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
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Nombre de usuario inválido.'); return; }
      cambios.username = parsed.data;
    }
    const correoNormalizado = correo.trim().toLowerCase();
    if (correoNormalizado !== perfil.correo) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado)) { setError('Ingrese un correo válido.'); return; }
      cambios.correo = correoNormalizado;
    }
    if (telefono !== (perfil.telefono ?? '')) {
      if (!/^9[0-9]{8}$/.test(telefono)) { setError('Ingrese un celular de nueve dígitos que empiece en 9.'); return; }
      cambios.telefono = telefono;
    }
    if (direccion.trim() !== (perfil.direccion ?? '')) {
      if (direccion.trim().length < 5 || direccion.trim().length > 250) { setError('La dirección debe tener entre 5 y 250 caracteres.'); return; }
      cambios.direccion = direccion.trim();
    }
    if (Object.keys(cambios).length === 0) { setExito('No hay cambios para guardar.'); return; }
    setGuardando(true);
    try {
      await apiClient.patch('/api/v1/auth/me', cambios, { headers: { Authorization: `Bearer ${token}` } });
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
    if (passwordNueva.length < 8 || passwordNueva.length > 128 || passwordNueva !== confirmarPassword) {
      setError('Revise la nueva contraseña y su confirmación.');
      return;
    }
    setGuardando(true);
    try {
      await apiClient.patch('/api/v1/auth/me/password', { passwordActual, passwordNueva, confirmarPassword },
        { headers: { Authorization: `Bearer ${token}` } });
      useAuthStore.getState().logout();
    } catch (cause) {
      setError(mensajeError(cause));
      setGuardando(false);
    }
  };

  if (cargando) return <p role="status" className="mx-auto max-w-3xl p-6">Cargando mi perfil...</p>;
  if (!perfil) return <p role="alert" className="mx-auto max-w-3xl p-6">{error ?? 'No se pudo cargar el perfil.'}</p>;

  return <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-slate-900">Mi perfil</h1>
      <Link to="/tramite" className="text-sm font-semibold text-cyan-800">{volverAlTramite ? 'Volver al trámite' : 'Volver a trámites'}</Link>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {exito && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{exito}</p>}

    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <h2 className="font-bold text-slate-900">Identidad</h2>
      <p className="text-xs text-slate-600">Tus datos de identidad están protegidos. Identifican tu cuenta y no se modifican directamente desde el perfil.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Tipo de documento<input aria-label="Tipo de documento" value={perfil.tipoDocumento} readOnly className="mt-1 w-full rounded border p-2 bg-slate-50" /></label>
        <label className="text-sm">Número de documento<input aria-label="Número de documento" value={perfil.numeroDocumento} readOnly className="mt-1 w-full rounded border p-2 bg-slate-50" /></label>
        <label className="text-sm">Nombres<input aria-label="Nombres" value={perfil.nombres} readOnly className="mt-1 w-full rounded border p-2 bg-slate-50" /></label>
        <label className="text-sm">Apellidos<input aria-label="Apellidos" value={perfil.apellidos} readOnly className="mt-1 w-full rounded border p-2 bg-slate-50" /></label>
      </div>
    </section>

    <form onSubmit={guardar} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="font-bold text-slate-900">Cuenta y contacto</h2>
      <label className="block text-sm font-medium">Nombre de usuario
        {perfil.usernameConfigurado ?
          <input value={perfil.username ?? ''} readOnly className="mt-1 w-full rounded border p-2 bg-slate-50" /> :
          <><p className="mt-1 text-sm font-normal text-slate-500">No configurado</p>
            <input value={username} onChange={(event) => setUsername(event.target.value)}
              placeholder="Agregar nombre de usuario (opcional)" autoComplete="username"
              className="mt-1 w-full rounded border p-2" />
            <p className="mt-1 text-xs font-normal text-slate-500">Podrá usarlo para iniciar sesión. El correo seguirá funcionando.</p></>}
      </label>
      <label className="block text-sm font-medium">Correo
        <input type="email" value={correo} onChange={(event) => setCorreo(event.target.value)}
          autoComplete="email" className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="block text-sm font-medium">Teléfono
        <input type="tel" value={telefono} onChange={(event) => setTelefono(event.target.value)}
          autoComplete="tel" className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="block text-sm font-medium">Dirección
        <input value={direccion} onChange={(event) => setDireccion(event.target.value)}
          autoComplete="street-address" className="mt-1 w-full rounded border p-2" />
      </label>
      <button type="submit" disabled={guardando} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Guardar cambios</button>
    </form>

    <form onSubmit={cambiarPassword} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="font-bold text-slate-900">Cambiar contraseña</h2>
      <p className="text-xs text-slate-600">Después del cambio deberá iniciar sesión nuevamente.</p>
      <label className="block text-sm font-medium">Contraseña actual
        <input type="password" value={passwordActual} onChange={(event) => setPasswordActual(event.target.value)}
          autoComplete="current-password" required className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="block text-sm font-medium">Nueva contraseña
        <input type="password" value={passwordNueva} onChange={(event) => setPasswordNueva(event.target.value)}
          autoComplete="new-password" required className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="block text-sm font-medium">Confirmar nueva contraseña
        <input type="password" value={confirmarPassword} onChange={(event) => setConfirmarPassword(event.target.value)}
          autoComplete="new-password" required className="mt-1 w-full rounded border p-2" />
      </label>
      <button type="submit" disabled={guardando} className="rounded-lg border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-900 disabled:opacity-50">Cambiar contraseña</button>
    </form>
  </main>;
}
