import { useState } from 'react';
import { Link } from 'react-router-dom';
import SelloInstitucional from '../../components/common/SelloInstitucional';
import { apiClient } from '../../api/client';

export default function RecuperarPasswordPage() {
  const [identificador, setIdentificador] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [etapa, setEtapa] = useState<'solicitar' | 'verificar' | 'hecho'>('solicitar');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function solicitarRecuperacion(event?: React.FormEvent) {
    event?.preventDefault();
    setError('');
    if (!identificador.trim()) {
      setError('Por favor, ingrese su correo vinculado o DNI.');
      return;
    }
    setCargando(true);
    try {
      await apiClient.post('/api/v1/auth/recuperar-password', { identificador });
      setEtapa('verificar');
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
        e?.message ||
        'No se pudo enviar el código de recuperación. Inténtelo nuevamente.',
      );
    } finally {
      setCargando(false);
    }
  }

  async function restablecerPassword(event?: React.FormEvent) {
    event?.preventDefault();
    setError('');
    if (!codigo.trim()) {
      setError('Ingrese el código de recuperación.');
      return;
    }
    if (!nuevaPassword || nuevaPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setCargando(true);
    try {
      await apiClient.post('/api/v1/auth/restablecer-password', {
        identificador,
        codigo,
        password: nuevaPassword,
      });
      setEtapa('hecho');
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
        e?.message ||
        'El código es inválido o expiró. Solicite uno nuevo.',
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className='lienzo-oficio flex min-h-screen items-center justify-center px-4 py-10 text-vault-tinta'>
      <section className='w-full max-w-md overflow-hidden rounded-xl border border-vault-papel-3 bg-white shadow-[var(--shadow-ficha)]'>
        <header className='flex items-center gap-3 border-b border-vault-papel-2 bg-vault-papel px-7 py-6'>
          <span className='shrink-0 text-vault-azul'>
            <SelloInstitucional className='h-11 w-11' />
          </span>
          <div className='min-w-0'>
            <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-vault-azul-tinta'>IESTP Publico Suiza · Pucallpa</p>
            <p className='mt-1 text-[13px] font-semibold leading-snug text-vault-tinta'>Sistema Integral de Gestion Documentaria</p>
          </div>
        </header>
        <div className='px-7 py-6'>
          <Link to='/login' className='inline-flex items-center gap-1.5 rounded-md border border-vault-papel-3 bg-white px-3 py-1.5 text-xs font-semibold text-tinta-600 transition hover:bg-vault-papel hover:text-vault-tinta'>← Volver al inicio de sesión</Link>
          {etapa === 'solicitar' && (
            <>
              <h1 className='mt-5 text-xl font-extrabold tracking-tight text-vault-tinta'>Soporte / Recuperación de Cuenta</h1>
              <p className='mt-1.5 text-[13px] leading-5 text-tinta-500'>Ingrese su correo vinculado o DNI para iniciar el proceso de restablecimiento.</p>
              <form onSubmit={solicitarRecuperacion} className='mt-6 space-y-4'>
                <div>
                  <label htmlFor='identificador' className='mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-tinta-500'>Correo vinculado o DNI</label>
                  <input id='identificador' type='text' value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder='Ingrese su correo o DNI' className='input-sigd' required />
                </div>
                {error && (<p role='alert' className='rounded-lg border border-estado-error/25 bg-estado-error-lavado px-3 py-2 text-xs font-semibold text-estado-error'>{error}</p>)}
                <button type='submit' disabled={cargando} className='btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60'>{cargando ? 'Enviando...' : 'Enviar código de recuperación'}</button>
              </form>
            </>
          )}
          {etapa === 'verificar' && (
            <>
              <h1 className='mt-5 text-xl font-extrabold tracking-tight text-vault-tinta'>Verificar Código</h1>
              <p className='mt-1.5 text-[13px] leading-5 text-tinta-500'>Ingrese el código que recibió en su correo y su nueva contraseña.</p>
              <form onSubmit={restablecerPassword} className='mt-6 space-y-4'>
                <div>
                  <label htmlFor='codigo' className='mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-tinta-500'>Código de recuperación</label>
                  <input id='codigo' type='text' value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder='Código de 6 o más caracteres' className='input-sigd' required />
                </div>
                <div>
                  <label htmlFor='nuevaPassword' className='mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-tinta-500'>Nueva contraseña</label>
                  <input id='nuevaPassword' type='password' value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} placeholder='Mínimo 6 caracteres' className='input-sigd' required />
                </div>
                {error && (<p role='alert' className='rounded-lg border border-estado-error/25 bg-estado-error-lavado px-3 py-2 text-xs font-semibold text-estado-error'>{error}</p>)}
                <button type='submit' disabled={cargando} className='btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60'>{cargando ? 'Restableciendo...' : 'Restablecer contraseña'}</button>
              </form>
            </>
          )}
          {etapa === 'hecho' && (
            <div className='mt-6 rounded-lg border border-estado-ok/25 bg-estado-ok-lavado px-3 py-3 text-sm text-estado-ok'>
              Su contraseña se ha restablecido correctamente. Puede iniciar sesión con su nueva contraseña.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
