import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
  FileCode2,
} from "lucide-react";

type SeccionLegal =
  | "normativa"
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
    id: "normativa",
    titulo: "Normativa y Bases Legales",
    subtitulo: "Marco Jurídico del SIGD",
    icono: Scale,
  },
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
    icono: FileText,
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
  const { seccion } = useParams<{ seccion?: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<SeccionLegal>(() => {
    if (seccion && TABS_LEGALES.some((t) => t.id === seccion)) {
      return seccion as SeccionLegal;
    }
    return "normativa";
  });

  useEffect(() => {
    if (seccion && TABS_LEGALES.some((t) => t.id === seccion)) {
      setActiveTab(seccion as SeccionLegal);
    } else if (!seccion) {
      setActiveTab("normativa");
    }
  }, [seccion]);

  const handleSelectTab = (tabId: SeccionLegal) => {
    setActiveTab(tabId);
    navigate(`/transparencia/${tabId}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        {/* Cabecera Principal Institucional */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al Inicio
          </Link>

          <div className="mt-4 flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-900 w-fit">
              <Scale className="h-3.5 w-3.5 text-blue-700" />
              Portal de Transparencia, Legalidad y Estándar Jurídico SIGD
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Transparencia, Legalidad y Protección de Datos
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              Consulte las políticas normativas del IESTP &quot;Suiza&quot;, el marco de protección
              de datos personales, las garantías procesales del TUO de la Ley 27444 y el Catálogo Integral TUPA 2026.
            </p>
          </div>
        </div>

        {/* Estructura con Navegación Lateral y Panel de Contenido */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Navegación de Secciones Lateral */}
          <nav
            aria-label="Secciones de Transparencia"
            className="lg:col-span-1 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs flex flex-col space-y-1"
          >
            {TABS_LEGALES.map((tab) => {
              const Icono = tab.icono;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition duration-150 cursor-pointer ${
                    isActive
                      ? "bg-[#003882] text-white shadow-2xs font-semibold"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      isActive
                        ? "bg-white/20 text-white border-white/30"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    <Icono className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block truncate">{tab.titulo}</span>
                    <span
                      className={`text-[10px] block leading-tight truncate ${
                        isActive ? "text-blue-100" : "text-slate-500"
                      }`}
                    >
                      {tab.subtitulo}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Panel de Contenido Principal */}
          <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
            {/* 0. NORMATIVA Y BASES LEGALES */}
            {activeTab === "normativa" && (
              <article id="normativa" className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                    <Scale className="h-3.5 w-3.5 text-blue-700" />
                    Marco Jurídico de la Gestión Documentaria Digital
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                    Normativa y Bases Legales del SIGD
                  </h2>
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-600 mt-1">
                    El Sistema Integral de Gestión Documentaria (SIGD) del Instituto de Educación Superior Tecnológico Público &quot;Suiza&quot; fundamenta sus operaciones en la legislación nacional peruana que rige el procedimiento administrativo, el gobierno digital y la validez probatoria de los documentos electrónicos.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Base Legal 1: Ley 27444 */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 hover:border-slate-300 transition">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        <Scale className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-blue-950">TUO de la Ley N.° 27444</span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Ley del Procedimiento Administrativo General (D.S. N.° 006-2026-JUS)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sustenta la legalidad de los expedientes digitales, la generación del Código Único de Trámite (CUT), el cómputo de plazos hábiles, las notificaciones y los derechos de los administrados. (Actualiza el D.S. N.° 004-2019-JUS).
                    </p>
                  </div>

                  {/* Base Legal 2: Ley 27269 */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 hover:border-slate-300 transition">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        <FileCheck2 className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-blue-950">Ley N.° 27269 y D.S. N.° 052-2008-PCM</span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Ley de Firmas y Certificados Digitales
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Otorga a la firma digital emitida con DNI electrónico (DNIe) y certificados de la Infraestructura Oficial de Firma Electrónica (IOFE / RENIEC) la misma validez y eficacia jurídica que una firma manuscrita.
                    </p>
                  </div>

                  {/* Base Legal 3: D. Leg. 1412 */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 hover:border-slate-300 transition">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        <Building className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-blue-950">Decreto Legislativo N.° 1412</span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Ley de Gobierno Digital (D.S. N.° 029-2021-PCM)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Establece el marco de gobernanza digital, interoperabilidad institucional, seguridad y prestación de servicios digitales orientados a facilitar el acceso de la ciudadanía a trámites transparentes.
                    </p>
                  </div>

                  {/* Base Legal 4: D.S. 070-2013-PCM */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 hover:border-slate-300 transition">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        <FileCode2 className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-blue-950">Decreto Supremo N.° 070-2013-PCM</span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Código de Verificación Digital (CVD)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Norma técnica para la validación pública de autenticidad e integridad de documentos emitidos por la entidad pública mediante código de verificación y código QR en el Portal Validador Institucional.
                    </p>
                  </div>

                  {/* Base Legal 5: Ley 29733 */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 hover:border-slate-300 transition">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        <Lock className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-blue-950">Ley N.° 29733 y D.S. N.° 016-2024-JUS</span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Protección de Datos Personales y Derechos ARCO
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Garantiza la minimización y protección de datos personales en consultas públicas, el resguardo de la confidencialidad y el pleno ejercicio de los derechos de acceso, rectificación, cancelación y oposición.
                    </p>
                  </div>

                  {/* Base Legal 6: RVM 177-2021-MINEDU */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 hover:border-slate-300 transition">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-blue-950">RVM N.° 177-2021-MINEDU</span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Lineamientos Académicos de Educación Superior Tecnológica
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Regula los procedimientos y requisitos oficiales para la emisión de certificados modulares, constancias de egresado, convalidaciones y titulación profesional técnica en institutos públicos.
                    </p>
                  </div>
                </div>

                {/* Directivas Institucionales Internas */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-700" />
                    <span className="text-xs font-bold text-slate-900">
                      Reglamentos y Directivas Internas del IESTP &quot;Suiza&quot;
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Las directivas internas complementarias de administración de archivo digital, mesa de partes y uso de casilla electrónica se encuentran <em>en proceso de formulación y aprobación institucional mediante resolución directoral</em>.
                  </p>
                </div>

                {/* Accesos rápidos de orientación */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-700" /> Servicios y Canales de Consulta Directa
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Puede acceder directamente a los servicios orientados a la ciudadanía soportados por este marco normativo:
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      to="/tupa"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-blue-700" /> Catálogo TUPA
                    </Link>
                    <Link
                      to="/mesa-partes"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition"
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-700" /> Mesa de Partes Digital
                    </Link>
                    <Link
                      to="/consulta"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition"
                    >
                      <Scale className="h-3.5 w-3.5 text-blue-700" /> Consultar CUT
                    </Link>
                    <Link
                      to="/validador-cvd"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition"
                    >
                      <FileCheck2 className="h-3.5 w-3.5 text-blue-700" /> Validador CVD
                    </Link>
                  </div>
                </div>
              </article>
            )}

            {/* 1. POLÍTICA DE PRIVACIDAD */}
            {activeTab === "privacidad" && (
              <article id="privacidad" className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                    <Shield className="h-3.5 w-3.5 text-blue-700" />
                    Ley N.° 29733 • D.S. N.° 016-2024-JUS
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                    Política de Privacidad y Confidencialidad
                  </h2>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
                  El Instituto de Educación Superior Tecnológico Público &quot;Suiza&quot; garantiza la
                  confidencialidad, integridad y seguridad en el tratamiento de los datos personales
                  suministrados por administrados, estudiantes, docentes y ciudadanos a través de la plataforma
                  SIGD, en estricto cumplimiento de la <strong>Ley N.° 29733 (Ley de Protección de Datos Personales)</strong>{" "}
                  y su <strong>Reglamento aprobado mediante Decreto Supremo N.° 016-2024-JUS</strong>.
                </p>

                {/* Tarjetas Informativas de Principios Rectores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        <Scale className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">Principio de Legalidad</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      El tratamiento se sustenta estrictamente en la legislación vigente y en las atribuciones conferidas por la Ley General de Educación y la Ley 30512.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">Ley 29733 Art. 4</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        <Building className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">Tratamiento por Entidad Pública</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Conforme al artículo 14 de la Ley N.° 29733, el tratamiento de datos por entidades públicas para el ejercicio de sus funciones no requiere consentimiento; en supuestos adicionales se recaba autorización informada.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">Ley 29733 Art. 14</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        <FileCheck2 className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">Finalidad y Proporcionalidad</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Los datos se recaban exclusivamente para la gestión documentaria, tramitación de expedientes, archivo digital y notificaciones oficiales del Instituto.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">D.S. 016-2024-JUS</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        <Shield className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">Calidad y Seguridad</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Se adoptan medidas técnicas y organizativas para evitar accesos no autorizados, pérdidas o alteraciones mediante criptografía de estándar moderno.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">Estándar ISO/IEC 27001</span>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-950">
                  <h3 className="font-bold flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-blue-700" /> Banco de Datos Personales Institucional
                  </h3>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    Los datos quedan incorporados en los bancos de datos de administración documentaria del Instituto,
                    destinados únicamente al ejercicio de las funciones públicas asignadas por ley.
                  </p>
                </div>
              </article>
            )}

            {/* 2. DATOS PERSONALES Y DERECHOS ARCO */}
            {activeTab === "datos-personales" && (
              <article id="datos-personales" className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                    <Lock className="h-3.5 w-3.5 text-blue-700" />
                    Derechos de los Titulares de Datos • D.S. N.° 016-2024-JUS
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                    Tratamiento de Datos y Ejercicio de Derechos ARCO
                  </h2>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
                  Conforme a la Ley N.° 29733 y el <strong>Reglamento de la Ley N.° 29733, aprobado por Decreto Supremo N.° 016-2024-JUS</strong>,
                  todo administrado o titular de datos personales tiene derecho a ejercer el control sobre su información
                  a través de los derechos ARCO ante el IESTP Suiza:
                </p>

                {/* 4 Paneles de Derechos ARCO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-700" />
                      <span className="text-xs font-bold text-slate-900">Derecho de Acceso</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Conocer qué datos personales propios obran en los registros del SIGD y su finalidad de tratamiento.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">D.S. 016-2024-JUS Art. 60</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-700" />
                      <span className="text-xs font-bold text-slate-900">Derecho de Rectificación</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Solicitar la corrección, actualización o inclusión de datos inexactos o incompletos.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">D.S. 016-2024-JUS Art. 62</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-700" />
                      <span className="text-xs font-bold text-slate-900">Derecho de Cancelación</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Suprimir datos tratados en contravención legal, salvo mandato legal de conservación de expedientes administrativos.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">D.S. 016-2024-JUS Art. 64</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-700" />
                      <span className="text-xs font-bold text-slate-900">Derecho de Oposición</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Oponerse al tratamiento de datos por motivos legítimos y fundados conforme a la normativa aplicable.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">D.S. 016-2024-JUS Art. 66</span>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 space-y-1">
                  <strong>Aviso legal:</strong> El ejercicio de los derechos ARCO es gratuito y puede radicarse
                  mediante solicitud formal a través de la Mesa de Partes Digital o Ventanilla Presencial del Instituto.
                  Los plazos de atención son de hasta 20 días hábiles para Acceso y 10 días hábiles para Rectificación, Cancelación u Oposición.
                </div>
              </article>
            )}

            {/* 3. TÉRMINOS DE USO */}
            {activeTab === "terminos" && (
              <article id="terminos" className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                    <Scale className="h-3.5 w-3.5 text-blue-700" />
                    TUO Ley N.° 27444 (D.S. N.° 006-2026-JUS) • D. Leg. N.° 1412
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                    Términos y Condiciones de Uso del SIGD
                  </h2>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
                  El uso de la Mesa de Partes Digital, Ventanilla Presencial y Casilla Electrónica se rige por el{" "}
                  <strong>Texto Único Ordenado (TUO) de la Ley N.° 27444, Ley del Procedimiento Administrativo General</strong>,
                  aprobado mediante <strong>Decreto Supremo N.° 006-2026-JUS</strong>, y por la <strong>Ley de Gobierno Digital (D. Leg. N.° 1412)</strong>.
                </p>

                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">1. Horario de Recepción y Cómputo de Plazos</span>
                      <span className="text-[11px] font-semibold text-blue-800">Art. 138 TUO Ley 27444</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      La Mesa de Partes Digital está disponible las 24 horas, los 7 días de la semana. Los documentos presentados en días inhábiles o fuera del horario oficial de atención institucional (corte 16:30 hrs) se consideran presentados a primera hora del día hábil siguiente, en concordancia con el TUO de la Ley N.° 27444.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">2. Veracidad de la Información (Presunción de Veracidad)</span>
                      <span className="text-[11px] font-semibold text-blue-800">Art. 51 TUO Ley 27444</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Toda documentación y declaración remitida por el administrado se presume veraz y auténtica. La presentación de información falsa acarrea responsabilidad administrativa y penal conforme a ley.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">3. Casilla Electrónica</span>
                      <span className="text-[11px] font-semibold text-blue-800">Art. 20 TUO Ley 27444</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Las comunicaciones dirigidas a la Casilla Electrónica corresponden a actos administrativos válidamente notificados. El administrado es responsable de revisar periódicamente el contenido de su casilla.
                    </p>
                    <div className="pt-1">
                      <Link
                        to="/casilla"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 transition"
                      >
                        Ir a Casilla Electrónica <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* 4. SEGURIDAD DE LA CUENTA */}
            {activeTab === "seguridad" && (
              <article id="seguridad" className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                    <KeyRound className="h-3.5 w-3.5 text-blue-700" />
                    Arquitectura de Ciberseguridad
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                    Seguridad de la Cuenta y Control de Acceso
                  </h2>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
                  La plataforma SIGD implementa controles técnicos rigurosos para salvaguardar la identidad y
                  los accesos de todos los usuarios:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-blue-700" />
                      <span className="text-xs font-bold text-slate-900">Criptografía Argon2id</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Las credenciales se almacenan mediante el algoritmo nativo Argon2id (m=65536 KiB, t=3, p=4) conforme a estándares OWASP.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">OWASP ASVS v4</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-700" />
                      <span className="text-xs font-bold text-slate-900">Tokens JWT Efímeros</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Autenticación con HMAC-SHA256, caducidad de 15 minutos y separación estricta de contextos personal e institucional.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">RFC 7519</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-xs font-bold text-slate-900">Protección BOLA / RBAC</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Acceso estricto a expedientes propios blindado contra sustitución de IDs. Rutas deniegan acceso fail-closed.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">OWASP API-1</span>
                  </div>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-950 space-y-1">
                  <strong>Aviso de seguridad obligatorio:</strong> Sus credenciales son personales e intransferibles.
                  Nunca comparta su contraseña ni permita que terceros operen su cuenta. Al utilizar equipos públicos,
                  cierre siempre la sesión.
                </div>
              </article>
            )}

            {/* 5. VALIDEZ DE FIRMA DIGITAL */}
            {activeTab === "firma-digital" && (
              <article id="firma-digital" className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                    <FileCheck2 className="h-3.5 w-3.5 text-blue-700" />
                    Ley N.° 27269 • D. Leg. N.° 1412
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                    Validez Legal de Firma Digital y Verificación CVD
                  </h2>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
                  Los documentos oficiales emitidos por el IESTP &quot;Suiza&quot; a través del SIGD cuentan con
                  plena validez y eficacia jurídica equivalente a la firma manuscrita, en el marco de la{" "}
                  <strong>Ley N.° 27269 (Ley de Firmas y Certificados Digitales)</strong> y su Reglamento.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-blue-700" />
                      <span className="text-xs font-bold text-slate-900">Firma Digital con Certificado</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Garantiza la autenticidad del emisor (autoría), la integridad del contenido (inmutabilidad) y el no repudio del acto administrativo expedido.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">Ley N.° 27269</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-700" />
                      <span className="text-xs font-bold text-slate-900">Código de Verificación Digital (CVD)</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cada documento impreso o digital incorpora una representación gráfica con código CVD y código QR para verificación pública instantánea en el Validador Oficial.
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800 block">D.S. N.° 070-2013-PCM</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs text-slate-700 font-medium">¿Desea validar la autenticidad de un documento emitido?</span>
                  <Link
                    to="/validador-cvd"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 px-4 py-2 text-xs font-bold text-white shadow-2xs transition"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" /> Ir al Validador CVD
                  </Link>
                </div>
              </article>
            )}

            {/* 6. ACCESO A LA INFORMACIÓN */}
            {activeTab === "acceso-informacion" && (
              <article id="acceso-informacion" className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                    <Building className="h-3.5 w-3.5 text-blue-700" />
                    Ley N.° 27806
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                    Transparencia y Acceso a la Información Pública
                  </h2>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
                  En aplicación del principio de publicidad y la <strong>Ley N.° 27806 (Texto Único Ordenado de la Ley de
                  Transparencia y Acceso a la Información Pública, D.S. N.° 021-2019-JUS)</strong>, toda persona tiene derecho a solicitar y
                  recibir información completa, veraz, oportuna y fehaciente de cualquier entidad de la Administración Pública.
                </p>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Pautas para la Solicitud de Información</span>
                    <span className="text-[11px] font-semibold text-blue-800">TUO Ley 27806</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 leading-relaxed">
                    <li>La solicitud no requiere expresar la causa o motivo que la justifica.</li>
                    <li>Plazo legal de respuesta: máximo 10 días hábiles (prorrogable excepcionalmente por razones debidamente motivadas).</li>
                    <li>Costo de reproducción: estrictamente limitado al costo real de copias físicas o gratuito en formato digital remitido a correo o casilla.</li>
                  </ul>
                  <div className="pt-2">
                    <Link
                      to="/mesa-partes"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 transition"
                    >
                      Presentar solicitud por Mesa de Partes <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Excepciones expresas: información secreta, reservada o confidencial vinculada a la intimidad personal
                  o datos personales protegidos por la Ley N.° 29733.
                </p>
              </article>
            )}

            {/* 7. POLÍTICA Y ACCESO AL CATÁLOGO TUPA 2026 */}
            {activeTab === "tupa" && (
              <article id="tupa" className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                    <BookOpen className="h-3.5 w-3.5 text-blue-700" />
                    Catálogo Oficial • D.S. N.° 006-2026-JUS
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                    Catálogo TUPA Institucional 2026
                  </h2>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-900 shrink-0 border border-blue-200">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-900">
                        Copia Oficial del Documento TUPA y Catálogo de Servicios
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        El Catálogo de Procedimientos y Servicios del IESTP Suiza se encuentra disponible para consulta pública abierta. La descarga de la copia oficial escaneada en formato PDF requiere una solicitud de acceso registrada en Mesa de Partes.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-blue-700" /> Opciones de consulta y descarga oficial
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      1. <strong>Consulta pública inmediata:</strong> Ingrese libremente al Catálogo TUPA para verificar requisitos, costos, plazos y radicar trámites en línea sin necesidad de solicitud previa.<br />
                      2. <strong>Copia escaneada en PDF:</strong> Formule su solicitud formal de acceso si requiere la copia digital íntegra del documento administrativo TUPA oficial.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                    <Link
                      to="/tupa"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-2xs transition"
                    >
                      Consultar Catálogo Público TUPA <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                    <Link
                      to="/solicitud-acceso-tupa"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 font-bold text-xs hover:bg-slate-50 transition"
                    >
                      Solicitar Copia Escaneada Oficial (PDF)
                    </Link>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500 italic">
                  Aviso: La presente política de acceso corresponde a las directrices oficiales del sistema SIGD 2026.
                </div>
              </article>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
