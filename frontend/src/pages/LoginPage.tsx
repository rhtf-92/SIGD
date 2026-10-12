import {
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import sigdLogoHeader from '../assets/sigd-logo-header.png';
import sigdLogoPrincipal from '../assets/sigd-logo-3d.png';
import { useAuthStore, type UsuarioPerfil } from '../stores/authStore';

const ROLES_INSTITUCIONALES = [
  { value: 'SUPER_ADMIN', label: 'Superadministrador' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'DOCENTE', label: 'Docente' },
  { value: 'MESA_PARTES', label: 'Mesa de Partes' },
  { value: 'ESTUDIANTE', label: 'Estudiante' },
] as const;

const ESTRELLAS = [
  [5, 15, 1.5, 0.2], [13, 37, 1, 1.6], [20, 8, 2, 2.4], [28, 68, 1.5, 0.8],
  [37, 21, 1, 3.1], [45, 85, 2, 1.2], [54, 10, 1.5, 2.8], [62, 47, 1, 0.4],
  [70, 19, 2, 1.9], [78, 72, 1.5, 3.3], [86, 34, 1, 0.9], [94, 12, 2, 2.1],
  [8, 84, 1, 2.7], [18, 56, 2, 0.5], [35, 44, 1.5, 1.7], [50, 63, 1, 3.5],
  [65, 91, 1.5, 1.1], [74, 53, 1, 2.5], [88, 86, 2, 0.7], [96, 62, 1, 1.4],
] as const;

const DESTINO_POR_ROL: Record<UsuarioPerfil['rol'], string> = {
  SUPER_ADMIN: '/administracion',
  DIRECTOR: '/reportes/dashboard',
  DOCENTE: '/expedientes',
  MESA_PARTES: '/tramite/ventanilla-presencial',
  ESTUDIANTE: '/casilla',
};

type FaseValidacion = 'idle' | 'validando' | 'verificando' | 'autorizado' | 'rechazado';

const MENSAJE_VALIDACION: Record<Exclude<FaseValidacion, 'idle'>, { titulo: string; detalle: string }> = {
  validando: {
    titulo: 'Validando contraseña...',
    detalle: 'Protegiendo la comunicación con el servidor institucional',
  },
  verificando: {
    titulo: 'Verificando credenciales...',
    detalle: 'Confirmando identidad, permisos y rol institucional',
  },
  autorizado: {
    titulo: '¡Acceso autorizado!',
    detalle: 'Credenciales confirmadas por el servidor SIGD',
  },
  rechazado: {
    titulo: 'Correo o contraseña incorrectos',
    detalle: 'Revisa tus credenciales e inténtalo nuevamente',
  },
};

function esperar(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

type EscenaStyle = CSSProperties & {
  '--auth-x'?: string;
  '--auth-y'?: string;
  '--auth-rx'?: string;
  '--auth-ry'?: string;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const escenaRef = useRef<HTMLElement>(null);
  const usuarioRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [rol, setRol] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [faseValidacion, setFaseValidacion] = useState<FaseValidacion>('idle');

  async function ingresar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');

    if (!rol) {
      setError('Selecciona tu rol institucional para continuar.');
      return;
    }

    setBusy(true);
    setFaseValidacion('validando');
    const movimientoReducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const duracionFase = movimientoReducido ? 100 : 720;
    const resultadoAutenticacion = login({ identificador, password })
      .then(() => ({ autorizado: true as const }))
      .catch((loginError: unknown) => ({ autorizado: false as const, error: loginError }));

    await esperar(duracionFase);
    setFaseValidacion('verificando');
    const [resultado] = await Promise.all([
      resultadoAutenticacion,
      esperar(movimientoReducido ? 120 : 880),
    ]);

    if (!resultado.autorizado) {
      setError('Correo o contraseña incorrectos');
      setFaseValidacion('rechazado');
      setBusy(false);
      return;
    }

    const usuarioAutenticado = useAuthStore.getState().usuario;
    if (!usuarioAutenticado) {
      setError('No fue posible confirmar el perfil institucional.');
      setFaseValidacion('rechazado');
      setBusy(false);
      return;
    }

    setFaseValidacion('autorizado');
    await esperar(movimientoReducido ? 150 : 1050);
    navigate(DESTINO_POR_ROL[usuarioAutenticado.rol], { replace: true });
  }

  function cerrarValidacionRechazada() {
    if (faseValidacion !== 'rechazado') return;
    setFaseValidacion('idle');
    window.requestAnimationFrame(() => passwordRef.current?.focus());
  }

  function seleccionarRol(value: string) {
    setRol(value);
    setError('');
    if (value) window.requestAnimationFrame(() => usuarioRef.current?.focus());
  }

  function actualizarPerspectiva(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') return;
    const escena = escenaRef.current;
    if (!escena) return;

    const rect = escena.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    escena.style.setProperty('--auth-x', `${(x * 100).toFixed(2)}%`);
    escena.style.setProperty('--auth-y', `${(y * 100).toFixed(2)}%`);
    escena.style.setProperty('--auth-ry', `${((x - 0.5) * 10).toFixed(2)}deg`);
    escena.style.setProperty('--auth-rx', `${((0.5 - y) * 8).toFixed(2)}deg`);
  }

  function reiniciarPerspectiva() {
    const escena = escenaRef.current;
    if (!escena) return;
    escena.style.setProperty('--auth-x', '50%');
    escena.style.setProperty('--auth-y', '50%');
    escena.style.setProperty('--auth-rx', '0deg');
    escena.style.setProperty('--auth-ry', '0deg');
  }

  const escenaStyle: EscenaStyle = {
    '--auth-x': '50%',
    '--auth-y': '50%',
    '--auth-rx': '0deg',
    '--auth-ry': '0deg',
  };

  return (
    <main
      ref={escenaRef}
      className="sigd-auth"
      style={escenaStyle}
      onPointerMove={actualizarPerspectiva}
      onPointerLeave={reiniciarPerspectiva}
    >
      <div className="sigd-auth__aurora" aria-hidden="true" />
      <div className="sigd-auth__grid" aria-hidden="true" />
      <div className="sigd-auth__stars" aria-hidden="true">
        {ESTRELLAS.map(([left, top, size, delay]) => (
          <span
            key={`${left}-${top}`}
            style={{
              left: `${left}%`, top: `${top}%`, width: `${size}px`, height: `${size}px`,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>

      <nav className="sigd-auth__nav" aria-label="Navegación de acceso">
        <Link to="/" className="sigd-auth__brand" aria-label="SIGD SUIZA, ir al inicio">
          <img src={sigdLogoHeader} alt="" />
          <span>
            <strong>SIGD SUIZA</strong>
            <small>Sistema Integrado de Gestión Documental</small>
          </span>
        </Link>
        <div className="sigd-auth__nav-actions">
          <Link to="/">Inicio</Link>
          <span><ShieldCheck aria-hidden="true" size={16} /> Acceso seguro</span>
        </div>
      </nav>

      <div className="sigd-auth__layout">
        <section className="sigd-auth__hero" aria-labelledby="sigd-auth-hero-title">
          <div className="sigd-auth__copy">
            <span className="sigd-auth__eyebrow"><Sparkles aria-hidden="true" size={15} /> Ecosistema documental</span>
            <h1 id="sigd-auth-hero-title">Tu gestión institucional, <em>conectada.</em></h1>
            <p>
              Centraliza documentos, procesos y seguimiento académico en una plataforma
              segura, trazable y diseñada para la comunidad SUIZA.
            </p>
          </div>

          <div className="sigd-auth__logo-stage" aria-label="Identidad visual SIGD SUIZA">
            <div className="sigd-auth__orbit sigd-auth__orbit--one" aria-hidden="true" />
            <div className="sigd-auth__orbit sigd-auth__orbit--two" aria-hidden="true" />
            <div className="sigd-auth__platform" aria-hidden="true" />
            <img src={sigdLogoPrincipal} alt="Logotipo principal SIGD SUIZA" />
            <p>Mueve el cursor: el logo responde con profundidad 3D</p>
          </div>
        </section>

        <section className="sigd-auth__access" aria-labelledby="sigd-auth-title">
          <div className="sigd-auth__card">
            <Link to="/" className="sigd-auth__back"><ArrowLeft aria-hidden="true" size={17} /> Volver al inicio</Link>
            <span className="sigd-auth__tag"><Sparkles aria-hidden="true" size={14} /> Acceso institucional</span>
            <h2 id="sigd-auth-title">Iniciar sesión</h2>
            <p className="sigd-auth__intro">
              Selecciona tu rol e ingresa con tus credenciales institucionales.
            </p>

            <form onSubmit={ingresar} className="sigd-auth__form">
              <label className="sigd-auth__field">
                <span>Rol institucional</span>
                <span className="sigd-auth__control">
                  <Building2 aria-hidden="true" size={18} />
                  <select value={rol} onChange={(event) => seleccionarRol(event.target.value)} disabled={busy} required>
                    <option value="">Selecciona tu rol</option>
                    {ROLES_INSTITUCIONALES.map((opcion) => (
                      <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                    ))}
                  </select>
                </span>
              </label>

              <div className={`sigd-auth__credentials${rol ? ' is-visible' : ''}`} aria-hidden={!rol}>
                <label className="sigd-auth__field">
                  <span>Usuario o correo</span>
                  <span className="sigd-auth__control">
                    <UserRound aria-hidden="true" size={18} />
                    <input
                      ref={usuarioRef}
                      required={Boolean(rol)}
                      tabIndex={rol ? 0 : -1}
                      autoComplete="username"
                      value={identificador}
                      onChange={(event) => setIdentificador(event.target.value)}
                      placeholder="Usuario institucional"
                      disabled={busy || !rol}
                    />
                  </span>
                </label>

                <label className="sigd-auth__field">
                  <span>Contraseña</span>
                  <span className="sigd-auth__control">
                    <LockKeyhole aria-hidden="true" size={18} />
                    <input
                      ref={passwordRef}
                      required={Boolean(rol)}
                      tabIndex={rol ? 0 : -1}
                      type={mostrarPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Contraseña"
                      disabled={busy || !rol}
                    />
                    <button
                      type="button"
                      className="sigd-auth__password-toggle"
                      onClick={() => setMostrarPassword((visible) => !visible)}
                      aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={mostrarPassword}
                      disabled={busy || !rol}
                      tabIndex={rol ? 0 : -1}
                    >
                      {mostrarPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                    </button>
                  </span>
                </label>

                {error && <p className="sigd-auth__error" role="alert">{error}</p>}

                <button type="submit" disabled={busy || !rol} className="sigd-auth__submit">
                  {busy ? <><span className="sigd-auth__spinner" aria-hidden="true" /> Validando acceso…</> : <>Ingresar al sistema <ArrowRight aria-hidden="true" size={19} /></>}
                </button>
              </div>

              {!rol && error && <p className="sigd-auth__error" role="alert">{error}</p>}
            </form>

            <div className="sigd-auth__security">
              <ShieldCheck aria-hidden="true" size={19} />
              <span><strong>Conexión protegida</strong><small>La autorización final se valida de forma segura en el servidor.</small></span>
            </div>
          </div>
        </section>
      </div>

      {faseValidacion !== 'idle' ? (
        <div
          className="sigd-auth-validation"
          data-phase={faseValidacion}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sigd-auth-validation-title"
          aria-describedby="sigd-auth-validation-detail"
        >
          <div className="sigd-auth-validation__card">
            <div className="sigd-auth-validation__device" aria-hidden="true">
              <span className="sigd-auth-validation__halo" />
              <span className="sigd-auth-validation__ring sigd-auth-validation__ring--outer" />
              <span className="sigd-auth-validation__ring sigd-auth-validation__ring--inner" />
              <svg className="sigd-auth-validation__scanner" viewBox="0 0 100 100">
                <path d="M31 14h-7c-6 0-10 4-10 10v8M69 14h7c6 0 10 4 10 10v8M14 68v8c0 6 4 10 10 10h7M86 68v8c0 6-4 10-10 10h-7" />
                <path className="sigd-auth-validation__key" d="M50 31a12 12 0 0 0-6 22v15h12V53a12 12 0 0 0-6-22Z" />
              </svg>
              <svg className="sigd-auth-validation__result" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" />
                {faseValidacion === 'rechazado'
                  ? <path d="m35 35 30 30M65 35 35 65" />
                  : <path d="m29 52 14 14 29-31" />}
              </svg>
              <span className="sigd-auth-validation__scanline" />
            </div>

            <p className="sigd-auth-validation__status">
              {faseValidacion === 'rechazado' ? 'Acceso rechazado' : 'Seguridad SIGD'}
            </p>
            <h2 id="sigd-auth-validation-title">{MENSAJE_VALIDACION[faseValidacion].titulo}</h2>
            <p id="sigd-auth-validation-detail">{MENSAJE_VALIDACION[faseValidacion].detalle}</p>

            {faseValidacion === 'rechazado' ? (
              <button type="button" onClick={cerrarValidacionRechazada}>Intentar nuevamente</button>
            ) : null}
          </div>
        </div>
      ) : null}

      <footer className="sigd-auth__footer">© {new Date().getFullYear()} SIGD SUIZA · Gestión documental institucional</footer>
    </main>
  );
}
