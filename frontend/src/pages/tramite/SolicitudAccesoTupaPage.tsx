import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  LogIn,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function SolicitudAccesoTupaPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const token = useAuthStore((s) => s.accessToken);
  const esAutenticado = Boolean(token && usuario);
  const esInstitucional =
    usuario?.rol &&
    ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'ESPECIALISTA', 'SECRETARIO'].includes(usuario.rol);

  // Estados de solicitud
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [estadoAutorizacion, setEstadoAutorizacion] = useState<{
    autenticado: boolean;
    autorizado: boolean;
    estado: string;
    solicitud: any | null;
  }>({
    autenticado: false,
    autorizado: false,
    estado: 'ANONIMO',
    solicitud: null,
  });

  const [motivo, setMotivo] = useState('');
  const [correo, setCorreo] = useState(usuario?.correo || '');
  const [aceptaTratamientoDatos, setAceptaTratamientoDatos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Consultar estado de acceso
  useEffect(() => {
    let activo = true;
    async function consultarEstado() {
      if (!token) {
        setCargandoEstado(false);
        return;
      }
      try {
        const res = await fetch('/api/v1/tramites/tupa/acceso/estado', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (activo) setEstadoAutorizacion(data);
        }
      } catch {
        // Modo resiliente si no responde endpoint
      } finally {
        if (activo) setCargandoEstado(false);
      }
    }
    consultarEstado();
    return () => {
      activo = false;
    };
  }, [token]);

  const handleSubmitSolicitud = async (e: FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    if (!motivo.trim() || motivo.trim().length < 10) {
      setMensajeError('Debe indicar un motivo o justificación de al menos 10 caracteres.');
      return;
    }

    if (!aceptaTratamientoDatos) {
      setMensajeError('Debe aceptar el aviso de tratamiento de datos personales conforme a la Ley 29733.');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch('/api/v1/tramites/tupa/acceso/solicitar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          motivo: motivo.trim(),
          correoContacto: correo.trim() || undefined,
          aceptaTratamientoDatos: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || 'Error al procesar la solicitud de acceso.');
      }

      setMensajeExito('Solicitud de acceso radicada con éxito. Será evaluada por la Mesa de Partes Institucional.');
      setEstadoAutorizacion((prev) => ({
        ...prev,
        estado: 'PENDIENTE',
        solicitud: data.solicitud ?? { motivo: motivo.trim() },
      }));
    } catch (err: unknown) {
      setMensajeError(err instanceof Error ? err.message : 'No se pudo registrar la solicitud de acceso.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabecera Principal */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900 mb-2">
                <FileText className="h-3.5 w-3.5 text-blue-700" /> Política Institucional de Acceso SIGD 2026
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Acceso al Catálogo Integral TUPA 2026
              </h1>
            </div>
            <Link
              to="/tupa"
              className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-slate-100 hover:text-slate-900 transition shrink-0 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver al Catálogo
            </Link>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
            Para consultar el documento TUPA institucional completo (72 entradas oficiales) se requiere una
            solicitud de acceso, conforme a la política de administración documental del IESTP &quot;Suiza&quot; para el año
            académico 2026.
          </p>
        </section>

        {/* 1. Usuario Rol Institucional (Acceso Directo) */}
        {esInstitucional && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 flex items-center justify-center font-bold">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Usuario Institucional Autorizado</h3>
                <p className="text-xs text-slate-500">Rol detectado: {usuario?.rol}</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Como miembro de la institución con rol administrativo o de despacho, usted cuenta con autorización directa
              para consultar las 72 entradas completas del TUPA 2026 sin formular solicitud previa.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                to="/tupa"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-2xs transition"
              >
                Consultar Catálogo TUPA Autorizado <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              {['MESA_PARTES', 'ADMINISTRADOR'].includes(usuario?.rol ?? '') && (
                <Link
                  to="/administracion/solicitudes-tupa"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 font-bold text-xs hover:bg-slate-50 transition"
                >
                  Gestionar Solicitudes de Ciudadanos
                </Link>
              )}
            </div>
          </div>
        )}

        {/* 2. Usuario No Autenticado (Anónimo) */}
        {!esAutenticado && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 shrink-0">
                <LogIn className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Identificación de Usuario Requerida</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Para formalizar la solicitud de acceso al documento TUPA completo en PDF, el sistema requiere que el
                  ciudadano inicie sesión con su cuenta digital o complete el registro previo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-blue-700" /> ¿Ya cuenta con credenciales?
                </h4>
                <p className="text-xs text-slate-500">
                  Acceda con su documento de identidad y contraseña para solicitar acceso inmediato.
                </p>
                <Link
                  to="/login?intent=SOLICITAR_ACCESO_TUPA&from=/solicitud-acceso-tupa"
                  state={{ from: '/solicitud-acceso-tupa', intent: 'SOLICITAR_ACCESO_TUPA' }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-900 text-white font-bold text-xs shadow-2xs hover:bg-blue-800 transition"
                >
                  Iniciar Sesión <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-blue-700" /> ¿Es un nuevo usuario?
                </h4>
                <p className="text-xs text-slate-500">
                  Regístrese gratuitamente con su DNI y obtenga su Casilla Electrónica Ciudadana.
                </p>
                <Link
                  to="/registro?returnUrl=/solicitud-acceso-tupa"
                  state={{ from: '/solicitud-acceso-tupa', intent: 'SOLICITAR_ACCESO_TUPA' }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 font-bold text-xs hover:bg-slate-50 transition"
                >
                  Registrarse como Ciudadano <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 3. Usuario Ciudadano Autenticado */}
        {esAutenticado && !esInstitucional && (
          <div className="space-y-6">
            {cargandoEstado && (
              <p className="text-xs text-slate-500 animate-pulse">Consultando estado de autorización institucional...</p>
            )}

            {mensajeExito && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 shadow-2xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{mensajeExito}</span>
              </div>
            )}

            {/* Estado APROBADA */}
            {estadoAutorizacion.estado === 'APROBADA' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-emerald-950">¡Acceso al TUPA Institucional Autorizado!</h3>
                    <p className="text-xs text-emerald-700">
                      Su solicitud fue aprobada exitosamente por Mesa de Partes.
                    </p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  Ya puede consultar las 72 entradas completas del TUPA 2026, sus requisitos, costos oficiales y
                  completar los formularios correspondientes.
                </p>
                <div className="pt-2">
                  <Link
                    to="/tupa"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-2xs transition"
                  >
                    Consultar Catálogo TUPA Completo (72 Entradas) <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Estado PENDIENTE */}
            {estadoAutorizacion.estado === 'PENDIENTE' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">Solicitud en Revisión por Mesa de Partes</h3>
                    <p className="text-xs text-slate-500">Estado: PENDIENTE DE RESOLUCIÓN</p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Su solicitud de acceso al catálogo TUPA ha sido radicada y se encuentra en evaluación por el operador
                  de Mesa de Partes. Recibirá una notificación en su Casilla Electrónica una vez resuelta.
                </p>
                <div className="p-3.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700">
                  Motivo registrado: {estadoAutorizacion.solicitud?.motivo ?? motivo}
                </div>
              </div>
            )}

            {/* Estado RECHAZADA */}
            {estadoAutorizacion.estado === 'RECHAZADA' && (
              <div className="p-6 rounded-xl border border-rose-200 bg-rose-50/80 space-y-3">
                <div className="flex items-center gap-2.5 text-rose-800 font-bold text-xs sm:text-sm">
                  <AlertCircle className="h-4 w-4 text-rose-600" /> Solicitud Observada / Rechazada
                </div>
                <p className="text-xs text-slate-700">
                  Observaciones de la entidad:{' '}
                  <strong>{estadoAutorizacion.solicitud?.observacionResolucion || 'No especificada'}</strong>
                </p>
                <p className="text-xs text-slate-500">
                  Puede formular una nueva solicitud subsanando los puntos observados a continuación.
                </p>
              </div>
            )}

            {/* Formulario de Solicitud (si no tiene solicitud o fue rechazada) */}
            {(estadoAutorizacion.estado === 'NINGUNA' ||
              estadoAutorizacion.estado === 'RECHAZADA' ||
              estadoAutorizacion.estado === 'EXPIRADA') && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Formulario de Solicitud de Acceso</h3>
                  <p className="text-xs text-slate-500">
                    Complete los campos a continuación para solicitar habilitación de consulta en el portal TUPA.
                  </p>
                </div>

                {mensajeError && (
                  <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {mensajeError}
                  </div>
                )}

                <form onSubmit={handleSubmitSolicitud} className="space-y-4">
                  <div>
                    <label htmlFor="motivo-solicitud" className="block text-xs font-bold text-slate-800 mb-1">
                      Motivo o Justificación de la Solicitud <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="motivo-solicitud"
                      required
                      rows={4}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Indique con claridad la finalidad de la consulta (ej. Trámite de grado académico, investigación formativa, consulta de tarifas institucionales)..."
                      className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="correo-contacto" className="block text-xs font-bold text-slate-800 mb-1">
                      Correo Electrónico de Notificación
                    </label>
                    <input
                      id="correo-contacto"
                      type="email"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      placeholder="su-correo@ejemplo.com"
                      className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Aviso de Tratamiento de Datos Ley 29733 */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aceptaTratamientoDatos}
                        onChange={(e) => setAceptaTratamientoDatos(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                      />
                      <span className="text-slate-700 leading-snug">
                        <strong>Consentimiento de Datos Personales (Ley N° 29733):</strong> Autorizo al IESTP &quot;Suiza&quot;
                        al tratamiento exclusivo de mis datos personales para fines de verificación de identidad,
                        gestión de solicitudes y trazabilidad en el Sistema Integral de Gestión Documentaria.
                      </span>
                    </label>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={enviando}
                      className="px-5 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-2xs disabled:opacity-50 transition cursor-pointer"
                    >
                      {enviando ? 'Enviando Solicitud...' : 'Enviar Solicitud de Acceso'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Bloque Explicativo de la Política */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 text-xs text-slate-600 shadow-xs">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-blue-700" /> Acerca de la Política de Consulta del TUPA Institucional
          </h4>
          <p>
            El catálogo TUPA del IESTP &quot;Suiza&quot; comprende 72 entradas debidamente clasificadas entre procedimientos
            administrativos, servicios académicos, servicios comerciales, bienes de producción y actuaciones internas.
          </p>
          <p>
            Para garantizar la integridad documental, la minimización de datos conforme a la Ley N° 29733 y el uso
            ordenado de los canales institucionales, la consulta de la copia oficial escaneada en formato PDF se encuentra sujeta a
            acreditación ciudadana mediante solicitud previa.
          </p>
        </section>
      </div>
    </main>
  );
}
