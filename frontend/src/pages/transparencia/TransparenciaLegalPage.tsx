import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Shield,
  Lock,
  FileCheck2,
  Scale,
  Building,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileText,
  KeyRound,
} from "lucide-react";
import {
  InformationGlassPanel,
  CapsuleBadge,
} from "../../components/common/GlassPanel";
import { useAuthStore } from "../../stores/authStore";

type SeccionLegal =
  | "privacidad"
  | "datos-personales"
  | "terminos"
  | "seguridad"
  | "firma-digital"
  | "acceso-informacion"
  | "tupa";

interface TabItem {
  id: SeccionLegal;
  titulo: string;
  subtitulo: string;
  icono: typeof Shield;
}

const TABS_LEGALES: readonly TabItem[] = [
  {
    id: "privacidad",
    titulo: "Política de Privacidad",
    subtitulo: "Ley N.° 29733 • D.S. 016-2024-JUS",
    icono: Shield,
  },
  {
    id: "datos-personales",
    titulo: "Datos Personales y Derechos ARCO",
    subtitulo: "Protección y Tratamiento",
    icono: Lock,
  },
  {
    id: "terminos",
    titulo: "Términos de Uso",
    subtitulo: "TUO Ley 27444 (D.S. 006-2026-JUS)",
    icono: Scale,
  },
  {
    id: "seguridad",
    titulo: "Seguridad de la Cuenta",
    subtitulo: "Argon2id / Credenciales",
    icono: KeyRound,
  },
  {
    id: "firma-digital",
    titulo: "Validez de Firma Digital",
    subtitulo: "Ley 27269 / D. Leg. 1412 / CVD",
    icono: FileCheck2,
  },
  {
    id: "acceso-informacion",
    titulo: "Acceso a la Información",
    subtitulo: "Ley N.° 27806 de Transparencia",
    icono: Building,
  },
  {
    id: "tupa",
    titulo: "Catálogo Oficial TUPA 2026",
    subtitulo: "72 Procedimientos Suiza",
    icono: BookOpen,
  },
];

export default function TransparenciaLegalPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const { seccion } = useParams<{ seccion?: string }>();
  const [activeTab, setActiveTab] = useState<SeccionLegal>(
    (seccion as SeccionLegal) && TABS_LEGALES.some((t) => t.id === seccion)
      ? (seccion as SeccionLegal)
      : "privacidad"
  );

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-teal-50/20 py-8 text-slate-900">
      {/* Halo ambiental suave estilo Aqua / Glass */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[400px] w-[900px] max-w-full rounded-full bg-gradient-to-b from-cyan-300/20 via-teal-100/15 to-transparent blur-3xl" />
        <div className="absolute top-1/2 -left-20 h-64 w-64 rounded-full bg-cyan-200/20 blur-2xl" />
      </div>

      <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8">
        {/* Cabecera Principal */}
        <div className="mb-6 sm:mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-cyan-50/80 hover:border-cyan-300 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al Inicio
          </Link>

          <div className="mt-4 flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300 bg-cyan-100/80 px-3 py-0.5 text-xs font-bold text-cyan-950 shadow-[0_2px_8px_-2px_rgba(6,182,212,0.3)] w-fit">
              <Scale className="h-3.5 w-3.5 text-cyan-700" />
              Portal de Transparencia, Legalidad y Estándar Jurídico SIGD
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
              Transparencia, Legalidad y Protección de Datos
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              Consulte las políticas normativas institucionales del IESTP &quot;Suiza&quot;, el marco de protección
              de datos personales, las garantías procesales de la Ley 27444 y el Catálogo Integral TUPA 2026.
            </p>
          </div>
        </div>

        {/* Estructura con Tabs en Panel Aqua / Glass */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Navegación de Tabs Lateral */}
          <nav
            aria-label="Secciones de Transparencia"
            className="lg:col-span-1 rounded-2xl border border-cyan-200/80 bg-white/90 p-2 shadow-xs backdrop-blur-xs flex flex-col space-y-1.5 ring-1 ring-cyan-300/30"
          >
            {TABS_LEGALES.map((tab) => {
              const Icono = tab.icono;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition duration-150 ${
                    isActive
                      ? "bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 border border-cyan-400/50 shadow-md shadow-cyan-600/25 text-white font-bold"
                      : "text-slate-600 hover:bg-cyan-50/70 hover:text-cyan-950 border border-transparent"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      isActive
                        ? "bg-white/20 text-white border-white/30 shadow-2xs"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <Icono className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block truncate">{tab.titulo}</span>
                    <span className={`text-[10px] block leading-tight truncate ${isActive ? "text-cyan-100" : "text-slate-500"}`}>{tab.subtitulo}</span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Panel de Contenido Principal (Liquid Glass Panel) */}
          <div className="relative overflow-hidden lg:col-span-3 rounded-3xl border border-white/85 bg-gradient-to-br from-white/90 via-cyan-50/35 to-teal-50/20 p-6 sm:p-8 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(6,182,212,0.06),0_16px_48px_-8px_rgba(6,182,212,0.14),0_2px_12px_-2px_rgba(0,0,0,0.02)] ring-1 ring-cyan-200/50 backdrop-blur-md before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent after:pointer-events-none after:absolute after:-top-24 after:-right-24 after:h-48 after:w-48 after:rounded-full after:bg-cyan-300/15 after:blur-2xl">
            {/* 1. POLÍTICA DE PRIVACIDAD */}
            {activeTab === "privacidad" && (
              <article id="privacidad" className="scroll-mt-6 sm:scroll-mt-10 space-y-6">
                <div>
                  <CapsuleBadge variant="legal">
                    <Shield className="h-3.5 w-3.5 text-cyan-700" />
                    Ley N.° 29733 • D.S. N.° 016-2024-JUS
                  </CapsuleBadge>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                    Política de Privacidad y Confidencialidad
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  El Instituto de Educación Superior Tecnológico Público &quot;Suiza&quot; garantiza la
                  confidencialidad, integridad y seguridad en el tratamiento de los datos personales
                  suministrados por administrados, estudiantes, docentes y ciudadanos a través de la plataforma
                  SIGD, en estricto cumplimiento de la <strong>Ley N.° 29733 (Ley de Protección de Datos Personales)</strong>{" "}
                  y su <strong>Reglamento aprobado mediante Decreto Supremo N.° 016-2024-JUS</strong>.
                </p>

                {/* Tarjetas Informativas Liquid Glass de Principios Rectores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InformationGlassPanel
                    icon={Scale}
                    title="Principio de Legalidad"
                    summary="El tratamiento se sustenta estrictamente en la legislación vigente y en las atribuciones conferidas por la Ley General de Educación y la Ley 30512."
                    legalReference="Ley 29733 Art. 4"
                    variant="aqua"
                  />
                  <InformationGlassPanel
                    icon={Building}
                    title="Tratamiento por Entidad Pública"
                    summary="Conforme al artículo 14 de la Ley N.° 29733, el tratamiento de datos por entidades públicas para el ejercicio de sus funciones no requiere consentimiento; en los demás supuestos legales se recaba autorización informada."
                    legalReference="Ley 29733 Art. 14"
                    variant="legal"
                  />
                  <InformationGlassPanel
                    icon={FileCheck2}
                    title="Finalidad y Proporcionalidad"
                    summary="Los datos se recaban exclusivamente para la gestión documentaria, tramitación de expedientes, archivo digital y notificaciones oficiales del Instituto."
                    legalReference="D.S. 016-2024-JUS"
                    variant="security"
                  />
                  <InformationGlassPanel
                    icon={Shield}
                    title="Calidad y Seguridad"
                    summary="Se adoptan medidas técnicas y organizativas para evitar accesos no autorizados, pérdidas o alteraciones mediante criptografía de nivel bancario."
                    legalReference="ISO/IEC 27001"
                    variant="aqua"
                  />
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-cyan-200/80 bg-gradient-to-r from-cyan-50/60 to-white/90 p-4.5 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_2px_8px_rgba(6,182,212,0.06)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-cyan-700" /> Banco de Datos Personales Institucional
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Los datos quedan incorporados en los bancos de datos de administración documentaria del Instituto,
                    destinados únicamente al ejercicio de las funciones públicas asignadas por ley.
                  </p>
                </div>
              </article>
            )}

            {/* 2. DATOS PERSONALES Y DERECHOS ARCO */}
            {activeTab === "datos-personales" && (
              <article id="datos-personales" className="scroll-mt-6 sm:scroll-mt-10 space-y-6">
                <div>
                  <CapsuleBadge variant="legal">
                    <Lock className="h-3.5 w-3.5 text-cyan-700" />
                    Derechos de los Titulares de Datos • D.S. N.° 016-2024-JUS
                  </CapsuleBadge>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                    Tratamiento de Datos y Ejercicio de Derechos ARCO
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  Conforme a la Ley N.° 29733 y el <strong>Reglamento de la Ley N.° 29733, aprobado por Decreto Supremo N.° 016-2024-JUS</strong>,
                  todo administrado o titular de datos personales tiene derecho a ejercer el control sobre su información
                  a través de los derechos ARCO ante la Mesa de Partes del IESTP Suiza:
                </p>

                {/* 4 Information Glass Panels de Derechos ARCO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InformationGlassPanel
                    icon={CheckCircle2}
                    title="Derecho de Acceso"
                    summary="Conocer qué datos personales propios obran en los registros del SIGD y su finalidad."
                    legalReference="D.S. 016-2024-JUS Art. 60"
                    variant="legal"
                  />
                  <InformationGlassPanel
                    icon={CheckCircle2}
                    title="Derecho de Rectificación"
                    summary="Solicitar la corrección, actualización o inclusión de datos inexactos o incompletos."
                    legalReference="D.S. 016-2024-JUS Art. 62"
                    variant="aqua"
                  />
                  <InformationGlassPanel
                    icon={CheckCircle2}
                    title="Derecho de Cancelación"
                    summary="Suprimir datos tratados en contravención legal, salvo mandato legal de conservación de expedientes administrativos."
                    legalReference="D.S. 016-2024-JUS Art. 64"
                    variant="subtle"
                  />
                  <InformationGlassPanel
                    icon={CheckCircle2}
                    title="Derecho de Oposición"
                    summary="Oponerse al tratamiento de datos por motivos legítimos y fundados conforme a la normativa aplicable."
                    legalReference="D.S. 016-2024-JUS Art. 66"
                    variant="security"
                  />
                </div>

                <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 p-4 text-xs text-amber-950 shadow-[0_2px_8px_rgba(245,158,11,0.08)] ring-1 ring-amber-100/70">
                  <strong>Aviso legal:</strong> El ejercicio de los derechos ARCO es gratuito y puede radicarse
                  mediante solicitud formal a través de la Mesa de Partes Virtual o Ventanilla Presencial del Instituto.
                </div>
              </article>
            )}

            {/* 3. TÉRMINOS DE USO */}
            {activeTab === "terminos" && (
              <article id="terminos" className="scroll-mt-6 sm:scroll-mt-10 space-y-6">
                <div>
                  <CapsuleBadge variant="legal">
                    <Scale className="h-3.5 w-3.5 text-cyan-700" />
                    TUO Ley N.° 27444 (D.S. N.° 006-2026-JUS) • D. Leg. N.° 1412
                  </CapsuleBadge>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                    Términos y Condiciones de Uso del SIGD
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  El uso de la Mesa de Partes Virtual, Ventanilla Presencial y Casilla Electrónica se rige por el{" "}
                  <strong>Texto Único Ordenado (TUO) de la Ley N.° 27444, Ley del Procedimiento Administrativo General</strong>,
                  aprobado mediante <strong>Decreto Supremo N.° 006-2026-JUS</strong>, y por la <strong>Ley de Gobierno Digital (D. Leg. N.° 1412)</strong>.
                </p>

                <div className="grid grid-cols-1 gap-4">
                  <InformationGlassPanel
                    icon={Scale}
                    title="1. Horario de Recepción y Cómputo de Plazos"
                    summary="La Mesa de Partes Virtual está disponible las 24 horas, los 7 días de la semana. Los documentos presentados en días inhábiles o fuera del horario oficial de atención institucional (corte 16:30 hrs) se consideran presentados a primera hora del día hábil siguiente, en concordancia con el TUO de la Ley N.° 27444."
                    legalReference="Art. 138 TUO Ley 27444"
                    variant="legal"
                  />
                  <InformationGlassPanel
                    icon={CheckCircle2}
                    title="2. Veracidad de la Información (Presunción de Veracidad)"
                    summary="Toda documentación y declaración remitida por el administrado se presume veraz y auténtica. La presentación de información falsa acarrea responsabilidad administrativa y penal conforme a ley."
                    legalReference="Art. 51 TUO Ley 27444"
                    variant="aqua"
                  />
                  <InformationGlassPanel
                    icon={Building}
                    title="3. Casilla Electrónica"
                    summary="Las comunicaciones dirigidas a la Casilla Electrónica pueden corresponder a actuaciones administrativas. El administrado es responsable de revisar periódicamente el contenido de su casilla."
                    legalReference="Art. 20 TUO Ley 27444"
                    ctaText="Ir a Casilla Electrónica"
                    ctaHref="/casilla"
                    variant="security"
                  />
                </div>
              </article>
            )}

            {/* 4. SEGURIDAD DE LA CUENTA */}
            {activeTab === "seguridad" && (
              <article id="seguridad" className="scroll-mt-6 sm:scroll-mt-10 space-y-6">
                <div>
                  <CapsuleBadge variant="security">
                    <KeyRound className="h-3.5 w-3.5 text-cyan-700" />
                    Arquitectura de Ciberseguridad
                  </CapsuleBadge>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                    Seguridad de la Cuenta y Control de Acceso
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  La plataforma SIGD implementa controles técnicos avanzados para salvaguardar la identidad y
                  los accesos de todos los usuarios:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <InformationGlassPanel
                    icon={Lock}
                    title="Criptografía Argon2id de Contraseñas"
                    summary="Las credenciales se almacenan mediante el algoritmo nativo Argon2id (m=65536 KiB, t=3 pasadas, p=4 hilos) conforme a las mejores prácticas criptográficas internacionales."
                    legalReference="OWASP ASVS v4"
                    variant="security"
                  />
                  <InformationGlassPanel
                    icon={Shield}
                    title="Tokens JWT HMAC-SHA256 y Sesiones Efímeras"
                    summary="La autenticación utiliza tokens con caducidad corta y rotación controlada."
                    legalReference="RFC 7519"
                    variant="aqua"
                  />
                  <InformationGlassPanel
                    icon={AlertTriangle}
                    title="Protección BOLA y Control RBAC Fail-Closed"
                    summary="Los accesos a expedientes propios están blindados contra sustitución de identificadores. Rutas no autorizadas bloquean inmediatamente la navegación."
                    legalReference="OWASP API-1"
                    variant="legal"
                  />
                </div>

                <div className="rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50/80 via-white to-rose-50/40 p-4 text-xs text-rose-950 shadow-[0_2px_8px_rgba(244,63,94,0.08)] ring-1 ring-rose-100/70">
                  <strong>Aviso de seguridad obligatorio:</strong> Sus credenciales son personales e intransferibles.
                  Nunca comparta su contraseña ni permita que terceros operen su cuenta. Al utilizar equipos públicos,
                  cierre siempre la sesión.
                </div>
              </article>
            )}

            {/* 5. VALIDEZ DE FIRMA DIGITAL */}
            {activeTab === "firma-digital" && (
              <article id="firma-digital" className="scroll-mt-6 sm:scroll-mt-10 space-y-6">
                <div>
                  <CapsuleBadge variant="legal">
                    <FileCheck2 className="h-3.5 w-3.5 text-cyan-700" />
                    Ley N.° 27269 • D. Leg. N.° 1412
                  </CapsuleBadge>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                    Validez Legal de Firma Digital y Verificación CVD
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  Los documentos oficiales emitidos por el IESTP &quot;Suiza&quot; a través del SIGD cuentan con
                  plena validez y eficacia jurídica equivalente a la firma manuscrita, en el marco de la{" "}
                  <strong>Ley N.° 27269 (Ley de Firmas y Certificados Digitales)</strong> y su Reglamento.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InformationGlassPanel
                    icon={FileCheck2}
                    title="Firma Digital con Certificado"
                    summary="Garantiza la autenticidad del emisor (autoría), la integridad del contenido (inmutabilidad) y el no repudio del acto administrativo expedido."
                    legalReference="Ley N.° 27269"
                    variant="aqua"
                  />
                  <InformationGlassPanel
                    icon={FileText}
                    title="Código de Verificación Digital (CVD)"
                    summary="Cada documento impreso o digital incorpora una representación gráfica con código CVD y código QR para verificación pública instantánea en el Validador Oficial."
                    legalReference="D.S. N.° 070-2013-PCM"
                    variant="legal"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-cyan-200/80 bg-gradient-to-r from-cyan-50/60 to-teal-50/50 p-4.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_2px_8px_rgba(6,182,212,0.08)]">
                  <span className="text-xs text-slate-700 font-medium">¿Desea validar la autenticidad de un documento emitido?</span>
                  <Link
                    to="/validador-cvd"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 hover:from-teal-700 hover:via-cyan-700 hover:to-sky-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:shadow-cyan-600/30"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" /> Ir al Validador CVD
                  </Link>
                </div>
              </article>
            )}

            {/* 6. ACCESO A LA INFORMACIÓN */}
            {activeTab === "acceso-informacion" && (
              <article id="acceso-informacion" className="scroll-mt-6 sm:scroll-mt-10 space-y-6">
                <div>
                  <CapsuleBadge variant="legal">
                    <Building className="h-3.5 w-3.5 text-cyan-700" />
                    Ley N.° 27806
                  </CapsuleBadge>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                    Transparencia y Acceso a la Información Pública
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  En aplicación del principio de publicidad y la <strong>Ley N.° 27806 (Texto Único Ordenado de la Ley de
                  Transparencia y Acceso a la Información Pública)</strong>, toda persona tiene derecho a solicitar y
                  recibir información completa, veraz, oportuna y fehaciente de cualquier entidad de la Administración Pública.
                </p>

                <InformationGlassPanel
                  icon={Info}
                  title="Pautas para la Solicitud de Información"
                  summary={
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                      <li>La solicitud no requiere expresar la causa o motivo que la justifica.</li>
                      <li>Plazo legal de respuesta: máximo 10 días hábiles (prorrogable excepcionalmente conforme a ley).</li>
                      <li>Costo de reproducción: estrictamente limitado al costo real de copias físicas o gratuito en formato digital.</li>
                    </ul>
                  }
                  legalReference="TUO Ley 27806"
                  ctaText="Presentar solicitud por Mesa de Partes"
                  ctaHref="/tramite"
                  variant="aqua"
                />

                <p className="text-xs text-slate-500">
                  Excepciones expresas: información secreta, reservada o confidencial vinculada a la intimidad personal
                  o datos personales protegidos por la Ley N.° 29733.
                </p>
              </article>
            )}

            {/* 7. POLÍTICA Y ACCESO AL CATÁLOGO TUPA 2026 */}
            {activeTab === "tupa" && (
              <article id="tupa" className="scroll-mt-6 sm:scroll-mt-10 space-y-6">
                <div>
                  <CapsuleBadge variant="legal">
                    <BookOpen className="h-3.5 w-3.5 text-cyan-700" />
                    Política de Acceso • D.S. N.° 004-2019-JUS
                  </CapsuleBadge>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                    Catálogo TUPA Institucional 2026
                  </h2>
                </div>

                {/* Panel informativo de acceso restringido conforme al requerimiento */}
                <div className="rounded-3xl border border-cyan-200/90 bg-gradient-to-br from-white/95 via-cyan-50/50 to-teal-50/30 p-6 sm:p-8 shadow-md space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-2xl bg-cyan-100/90 text-cyan-800 shrink-0 border border-cyan-200 shadow-2xs">
                      <Lock className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                        Acceso Restringido al Documento TUPA Institucional
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        Para consultar el documento TUPA institucional completo se requiere una solicitud de acceso,
                        conforme a la política de administración documental y minimización de datos del proyecto SIGD.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-cyan-200/80 bg-white/80 p-5 space-y-3">
                    <h4 className="text-sm font-bold text-cyan-950 flex items-center gap-2">
                      <Info className="h-4 w-4 text-cyan-700" /> Procedimiento para solicitar acceso
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      1. Inicie sesión en la plataforma con sus credenciales de Ciudadano o regístrese si es un nuevo usuario.<br />
                      2. Complete la solicitud de acceso indicando la justificación de consulta y aceptando el aviso de tratamiento de datos personales.<br />
                      3. Una vez aprobada por Mesa de Partes, podrá consultar las 72 entradas completas y completar los formularios dinámicos especializados.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <Link
                      to="/solicitud-acceso-tupa"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 hover:from-teal-700 hover:via-cyan-700 hover:to-sky-700 text-white font-bold text-xs shadow-xs hover:shadow-cyan-600/30 transition"
                    >
                      Solicitar Acceso al Catálogo TUPA <ArrowRight className="h-4 w-4" />
                    </Link>

                    {usuario && (
                      <Link
                        to="/tupa"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-cyan-300 bg-white text-cyan-950 font-bold text-xs hover:bg-cyan-50 transition"
                      >
                        Ir al Catálogo Autorizado (Usuarios Habilitados)
                      </Link>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs text-slate-500 italic">
                  Aviso: La presente restricción de visualización directa corresponde a las políticas de acceso del sistema SIGD 2026.
                </div>
              </article>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
