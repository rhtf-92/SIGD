import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Shield,
  Lock,
  FileCheck2,
  Search,
  Scale,
  Building,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import {
  TUPA_SUIZA_2026_COMPLETO,
  type CategoriaTupa,
} from "../../data/tupaSuiza2026CatalogoCompleto";

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
    icono: Lock,
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
  const [activeTab, setActiveTab] = useState<SeccionLegal>(
    (seccion as SeccionLegal) && TABS_LEGALES.some((t) => t.id === seccion)
      ? (seccion as SeccionLegal)
      : "privacidad"
  );

  // Estados para filtro de TUPA
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "APROBADO" | "PENDIENTE_VALIDACION">("TODOS");
  const [filtroCategoria, setFiltroCategoria] = useState<"TODAS" | CategoriaTupa>("TODAS");
  const [filtroRadicacion, setFiltroRadicacion] = useState<"TODOS" | "SI" | "NO">("TODOS");

  const tupaFiltrado = TUPA_SUIZA_2026_COMPLETO.filter((item) => {
    const coincideTexto =
      item.denominacion.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      item.referenciaFila.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      item.monto.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      item.unidadResponsable.toLowerCase().includes(filtroTexto.toLowerCase());
    const coincideEstado = filtroEstado === "TODOS" || item.estadoValidacion === filtroEstado;
    const coincideCategoria = filtroCategoria === "TODAS" || item.categoria === filtroCategoria;
    const coincideRadicacion =
      filtroRadicacion === "TODOS" ||
      (filtroRadicacion === "SI" && item.admiteRadicacionSigd) ||
      (filtroRadicacion === "NO" && !item.admiteRadicacionSigd);

    return coincideTexto && coincideEstado && coincideCategoria && coincideRadicacion;
  });

  const getCategoriaBadge = (cat: CategoriaTupa) => {
    switch (cat) {
      case "PROCEDIMIENTO_APROBADO":
        return <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800">PROCEDIMIENTO_APROBADO</span>;
      case "PROCEDIMIENTO_PENDIENTE":
        return <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800">PROCEDIMIENTO_PENDIENTE</span>;
      case "SERVICIO_ACADEMICO":
        return <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800">SERVICIO_ACADEMICO</span>;
      case "SERVICIO_COMERCIAL":
        return <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800">SERVICIO_COMERCIAL</span>;
      case "BIEN_PRODUCTIVO":
        return <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-800">BIEN_PRODUCTIVO</span>;
      case "ACTUACION_INTERNA":
        return <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800">ACTUACION_INTERNA</span>;
      case "OTRO_NO_RADICABLE":
        return <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-800">OTRO_NO_RADICABLE</span>;
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header Institucional de Transparencia */}
      <section className="bg-gradient-to-r from-blue-900 to-slate-900 text-white py-6 sm:py-10 px-4 sm:px-6 lg:px-8 border-b border-blue-800">
        <div className="max-w-6xl mx-auto space-y-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al Inicio
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-700/80 px-2 py-0.5 text-[11px] font-bold text-blue-100 uppercase tracking-wider">
              Marco Legal y Transparencia
            </span>
            <span className="text-xs text-blue-200">IESTP &quot;Suiza&quot; — Pucallpa</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
            Transparencia, Legalidad y Protección de Datos
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 max-w-3xl leading-relaxed">
            Consulte la base jurídica, los términos de seguridad, el tratamiento de datos personales y
            el catálogo oficial del Texto Único de Procedimientos Administrativos (TUPA 2026) conforme al
            ordenamiento legal de la República del Perú.
          </p>
        </div>
      </section>

      {/* Contenido con Tabs */}
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 mt-6 sm:mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Menú lateral de pestañas */}
          <nav aria-label="Secciones de transparencia legal" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {TABS_LEGALES.map((tab) => {
              const Icono = tab.icono;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition border ${
                    isActive
                      ? "bg-white border-blue-600 text-blue-900 shadow-sm"
                      : "bg-white/60 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300"
                  }`}
                >
                  <div
                    className={`mt-0.5 p-1.5 rounded-lg ${
                      isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Icono className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">{tab.titulo}</span>
                    <span className="text-[10px] text-slate-500 block leading-tight">{tab.subtitulo}</span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Panel de Contenido Principal */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
            {/* 1. POLÍTICA DE PRIVACIDAD */}
            {activeTab === "privacidad" && (
              <article className="space-y-6">
                <div>
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                    Ley N.° 29733 • D.S. N.° 016-2024-JUS
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
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

                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-2">
                  <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-700" /> Principios Rectores del Tratamiento
                  </h3>
                  <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-5">
                    <li><strong>Principio de Legalidad:</strong> El tratamiento se sustenta estrictamente en la legislación vigente.</li>
                    <li><strong>Tratamiento por Entidad Pública:</strong> Conforme al artículo 14 de la Ley N.° 29733, el tratamiento de datos por entidades públicas para el ejercicio de sus funciones no requiere consentimiento; en los demás supuestos legales se recaba autorización informada.</li>
                    <li><strong>Principio de Finalidad y Proporcionalidad:</strong> Los datos se recaban exclusivamente para la gestión documentaria, tramitación de expedientes y notificaciones oficiales del Instituto.</li>
                    <li><strong>Principio de Calidad y Seguridad:</strong> Se adoptan medidas técnicas y organizativas para evitar accesos no autorizados, pérdidas o alteraciones.</li>
                  </ul>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-bold text-slate-900">Banco de Datos Personales Institucional</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Los datos quedan incorporados en los bancos de datos de administración documentaria del Instituto,
                    destinados únicamente al ejercicio de las funciones públicas asignadas por ley.
                  </p>
                </div>
              </article>
            )}

            {/* 2. DATOS PERSONALES Y DERECHOS ARCO */}
            {activeTab === "datos-personales" && (
              <article className="space-y-6">
                <div>
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                    Derechos de los Titulares de Datos • D.S. N.° 016-2024-JUS
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                    Tratamiento de Datos y Ejercicio de Derechos ARCO
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  Conforme a la Ley N.° 29733 y el <strong>Reglamento de la Ley N.° 29733, aprobado por Decreto Supremo N.° 016-2024-JUS</strong>,
                  todo administrado o titular de datos personales tiene derecho a ejercer el control sobre su información
                  a través de los derechos ARCO ante la Mesa de Partes del IESTP Suiza:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Derecho de Acceso
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Conocer qué datos personales propios obran en los registros del SIGD y su finalidad.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" /> Derecho de Rectificación
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Solicitar la corrección, actualización o inclusión de datos inexactos o incompletos.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-amber-600" /> Derecho de Cancelación
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Suprimir datos tratados en contravención legal, salvo mandato legal de conservación de expedientes administrativos.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-600" /> Derecho de Oposición
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Oponerse al tratamiento de datos por motivos legítimos y fundados conforme a la normativa aplicable.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                  <strong>Aviso legal:</strong> El ejercicio de los derechos ARCO es gratuito y puede radicarse
                  mediante solicitud formal a través de la Mesa de Partes Virtual o Ventanilla Presencial del Instituto.
                </div>
              </article>
            )}

            {/* 3. TÉRMINOS DE USO */}
            {activeTab === "terminos" && (
              <article className="space-y-6">
                <div>
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                    TUO Ley N.° 27444 (D.S. N.° 006-2026-JUS) • D. Leg. N.° 1412
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                    Términos y Condiciones de Uso del SIGD
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  El uso de la Mesa de Partes Virtual, Ventanilla Presencial y Casilla Electrónica se rige por el{" "}
                  <strong>Texto Único Ordenado (TUO) de la Ley N.° 27444, Ley del Procedimiento Administrativo General</strong>,
                  aprobado mediante <strong>Decreto Supremo N.° 006-2026-JUS</strong>, y por la <strong>Ley de Gobierno Digital (D. Leg. N.° 1412)</strong>.
                </p>

                <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                  <div className="border-l-2 border-blue-600 pl-3">
                    <h3 className="font-bold text-slate-900 text-sm">1. Horario de Recepción y Cómputo de Plazos</h3>
                    <p className="mt-0.5">
                      La Mesa de Partes Virtual está disponible las 24 horas, los 7 días de la semana. Los documentos
                      presentados en días inhábiles o fuera del horario oficial de atención institucional (corte 16:30 hrs)
                      se consideran presentados a primera hora del día hábil siguiente, en concordancia con el TUO de la Ley N.° 27444.
                    </p>
                  </div>

                  <div className="border-l-2 border-blue-600 pl-3">
                    <h3 className="font-bold text-slate-900 text-sm">2. Veracidad de la Información (Presunción de Veracidad)</h3>
                    <p className="mt-0.5">
                      Toda documentación y declaración remitida por el administrado se presume veraz y auténtica.
                      La presentación de información falsa acarrea responsabilidad administrativa y penal conforme a ley.
                    </p>
                  </div>

                  <div className="border-l-2 border-blue-600 pl-3">
                    <h3 className="font-bold text-slate-900 text-sm">3. Casilla Electrónica</h3>
                    <p className="mt-0.5">
                      Las comunicaciones dirigidas a la Casilla Electrónica pueden corresponder a actuaciones administrativas.
                      El administrado es responsable de revisar periódicamente el contenido de su casilla.
                    </p>
                  </div>
                </div>
              </article>
            )}

            {/* 4. SEGURIDAD DE LA CUENTA */}
            {activeTab === "seguridad" && (
              <article className="space-y-6">
                <div>
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                    Arquitectura de Ciberseguridad
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                    Seguridad de la Cuenta y Control de Acceso
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  La plataforma SIGD implementa controles técnicos avanzados para salvaguardar la identidad y
                  los accesos de todos los usuarios:
                </p>

                <ul className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-start gap-2 border border-slate-200 p-3 rounded-lg bg-slate-50">
                    <Lock className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Criptografía Argon2id de Contraseñas:</strong> Las credenciales se almacenan mediante
                      el algoritmo nativo Argon2id (m=65536 KiB, t=3 pasadas, p=4 hilos) conforme a las mejores
                      prácticas criptográficas internacionales.
                    </div>
                  </li>
                  <li className="flex items-start gap-2 border border-slate-200 p-3 rounded-lg bg-slate-50">
                    <Shield className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Tokens JWT HMAC-SHA256 y Sesiones Efímeras:</strong> La autenticación utiliza tokens
                      con caducidad corta y rotación controlada.
                    </div>
                  </li>
                  <li className="flex items-start gap-2 border border-slate-200 p-3 rounded-lg bg-slate-50">
                    <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Protección BOLA y Control RBAC Fail-Closed:</strong> Los accesos a expedientes propios
                      están blindados contra sustitución de identificadores. Rutas no autorizadas bloquean inmediatamente la navegación.
                    </div>
                  </li>
                </ul>

                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
                  <strong>Aviso de seguridad obligatorio:</strong> Sus credenciales son personales e intransferibles.
                  Nunca comparta su contraseña ni permita que terceros operen su cuenta. Al utilizar equipos públicos,
                  cierre siempre la sesión.
                </div>
              </article>
            )}

            {/* 5. VALIDEZ DE FIRMA DIGITAL */}
            {activeTab === "firma-digital" && (
              <article className="space-y-6">
                <div>
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                    Ley N.° 27269 • D. Leg. N.° 1412
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                    Validez Legal de Firma Digital y Verificación CVD
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  Los documentos oficiales emitidos por el IESTP &quot;Suiza&quot; a través del SIGD cuentan con
                  plena validez y eficacia jurídica equivalente a la firma manuscrita, en el marco de la{" "}
                  <strong>Ley N.° 27269 (Ley de Firmas y Certificados Digitales)</strong> y su Reglamento.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <h3 className="font-bold text-slate-900 text-sm">Firma Digital con Certificado</h3>
                    <p className="text-slate-600 mt-1">
                      Garantiza la autenticidad del emisor (autoría), la integridad del contenido (inmutabilidad) y
                      el no repudio del acto administrativo expedido.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <h3 className="font-bold text-slate-900 text-sm">Código de Verificación Digital (CVD)</h3>
                    <p className="text-slate-600 mt-1">
                      Cada documento impreso o digital incorpora una representación gráfica con código CVD y código QR
                      para verificación pública instantánea en el Validador Oficial.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-xs text-slate-600">¿Desea validar la autenticidad de un documento?</span>
                  <Link
                    to="/validador-cvd"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800 transition"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" /> Ir al Validador CVD
                  </Link>
                </div>
              </article>
            )}

            {/* 6. ACCESO A LA INFORMACIÓN */}
            {activeTab === "acceso-informacion" && (
              <article className="space-y-6">
                <div>
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                    Ley N.° 27806
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                    Transparencia y Acceso a la Información Pública
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  En aplicación del principio de publicidad y la <strong>Ley N.° 27806 (Texto Único Ordenado de la Ley de
                  Transparencia y Acceso a la Información Pública)</strong>, toda persona tiene derecho a solicitar y
                  recibir información completa, veraz, oportuna y fehaciente de cualquier entidad de la Administración Pública.
                </p>

                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-2 text-xs text-slate-700">
                  <h3 className="font-bold text-blue-900 text-sm">Pautas para la Solicitud de Información:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>La solicitud no requiere expresar la causa o motivo que la justifica.</li>
                    <li>Plazo legal de respuesta: máximo 10 días hábiles (prorrogable excepcionalmente conforme a ley).</li>
                    <li>Costo de reproducción: estrictamente limitado al costo real de copias físicas o gratuito en formato digital.</li>
                  </ul>
                </div>

                <p className="text-xs text-slate-500">
                  Excepciones expresas: información secreta, reservada o confidencial vinculada a la intimidad personal
                  o datos personales protegidos por la Ley N.° 29733.
                </p>
              </article>
            )}

            {/* 7. CATÁLOGO OFICIAL TUPA 2026 */}
            {activeTab === "tupa" && (
              <article className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                      Fuente Oficial: TUPA_2026_IESTP_Suiza.pdf (SHA-256: 377dd8e1...)
                    </span>
                    <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                      Catálogo Integral TUPA 2026 (72 Entradas Oficiales)
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Visualización clasificada con denominación, código/ref, categoría, estado de validación, derecho de pago, requisitos, plazo, unidad responsable, base legal y admisión de radicación SIGD.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      18 Aprobados
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                      54 Pendientes
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                      18 Radicables
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                      54 No Radicables
                    </span>
                  </div>
                </div>

                {/* Filtros de búsqueda y segmentación */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por denominación, código/ref, monto o unidad responsable..."
                      value={filtroTexto}
                      onChange={(e) => setFiltroTexto(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label htmlFor="filtro-categoria-tupa" className="text-[11px] font-bold text-slate-700 block mb-1">
                        Categoría:
                      </label>
                      <select
                        id="filtro-categoria-tupa"
                        value={filtroCategoria}
                        onChange={(e) => setFiltroCategoria(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="TODAS">Todas las categorías (72)</option>
                        <option value="PROCEDIMIENTO_APROBADO">PROCEDIMIENTO_APROBADO (18)</option>
                        <option value="PROCEDIMIENTO_PENDIENTE">PROCEDIMIENTO_PENDIENTE (5)</option>
                        <option value="SERVICIO_ACADEMICO">SERVICIO_ACADEMICO (17)</option>
                        <option value="SERVICIO_COMERCIAL">SERVICIO_COMERCIAL (9)</option>
                        <option value="BIEN_PRODUCTIVO">BIEN_PRODUCTIVO (9)</option>
                        <option value="ACTUACION_INTERNA">ACTUACION_INTERNA (5)</option>
                        <option value="OTRO_NO_RADICABLE">OTRO_NO_RADICABLE (9)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="filtro-estado-tupa" className="text-[11px] font-bold text-slate-700 block mb-1">
                        Estado de Validación:
                      </label>
                      <select
                        id="filtro-estado-tupa"
                        value={filtroEstado}
                        onChange={(e) => setFiltroEstado(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="TODOS">Todos los estados (72)</option>
                        <option value="APROBADO">APROBADO (18)</option>
                        <option value="PENDIENTE_VALIDACION">PENDIENTE_VALIDACION (54)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="filtro-radicacion-tupa" className="text-[11px] font-bold text-slate-700 block mb-1">
                        ¿Admite Radicación SIGD?:
                      </label>
                      <select
                        id="filtro-radicacion-tupa"
                        value={filtroRadicacion}
                        onChange={(e) => setFiltroRadicacion(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="TODOS">Todos (72)</option>
                        <option value="SI">Sí — Radicables (18)</option>
                        <option value="NO">No — No Radicables (54)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Tabla de 72 procedimientos con los 10 campos requeridos */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-20">Código / Ref</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Denominación y Requisitos</th>
                        <th className="py-2.5 px-3 w-40">Categoría</th>
                        <th className="py-2.5 px-3 w-28">Estado Validación</th>
                        <th className="py-2.5 px-3 w-24">Derecho Pago</th>
                        <th className="py-2.5 px-3 w-28">Plazo</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Unidad Responsable</th>
                        <th className="py-2.5 px-3 min-w-[160px]">Base Legal</th>
                        <th className="py-2.5 px-3 w-28 text-center">Radica SIGD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {tupaFiltrado.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500">
                            No se encontraron procedimientos o conceptos con los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        tupaFiltrado.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition">
                            {/* 1. Código/Ref */}
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {item.codigo}
                              <span className="block text-[9px] text-slate-400">Pág. {item.pagina}</span>
                            </td>

                            {/* 2. Denominación y Requisitos */}
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-900 block leading-snug">{item.denominacion}</span>
                              {item.requisitos.length > 0 ? (
                                <ul className="mt-1 text-[10px] text-slate-500 space-y-0.5 list-disc pl-3">
                                  {item.requisitos.map((req, rIdx) => (
                                    <li key={`${item.id}-req-${rIdx}`}>{req}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic block mt-0.5">Sin requisitos documentarios adicionales</span>
                              )}
                            </td>

                            {/* 3. Categoría */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {getCategoriaBadge(item.categoria)}
                            </td>

                            {/* 4. Estado de Validación */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {item.estadoValidacion === "APROBADO" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  <CheckCircle2 className="h-3 w-3" /> APROBADO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                  <AlertTriangle className="h-3 w-3 text-slate-500" /> PENDIENTE
                                </span>
                              )}
                            </td>

                            {/* 5. Derecho de Pago */}
                            <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                              {item.monto === "0" || item.monto === "S/ 0.00" ? "Gratuito" : item.monto}
                            </td>

                            {/* 6. Plazo */}
                            <td className="py-2.5 px-3 text-[11px] text-slate-600">
                              {item.plazo}
                            </td>

                            {/* 7. Unidad Responsable */}
                            <td className="py-2.5 px-3 text-[11px] text-slate-600">
                              {item.unidadResponsable}
                            </td>

                            {/* 8. Base Legal */}
                            <td className="py-2.5 px-3 text-[10px] text-slate-500 leading-tight">
                              {item.baseLegal ?? "Reglamento Institucional"}
                            </td>

                            {/* 9. ¿Admite radicación SIGD?: Sí / No */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {item.admiteRadicacionSigd ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold shadow-2xs">
                                  Sí
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 text-[10px] font-semibold">
                                  No
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 space-y-1">
                  <p>
                    <strong>Política Oficial de Radicación SIGD:</strong> Únicamente los procedimientos clasificados como{" "}
                    <em>PROCEDIMIENTO_APROBADO</em> (18 entradas) pueden radicarse formalmente en la Mesa de Partes Virtual y Ventanilla Presencial con generación de Código Único de Trámite (CUT) y formación de expediente institucional.
                  </p>
                  <p>
                    Las categorías <em>PROCEDIMIENTO_PENDIENTE</em> (5 entradas), <em>SERVICIO_ACADEMICO</em> (17 entradas),{" "}
                    <em>SERVICIO_COMERCIAL</em> (9 entradas), <em>BIEN_PRODUCTIVO</em> (9 entradas), <em>ACTUACION_INTERNA</em> (5 entradas) y{" "}
                    <em>OTRO_NO_RADICABLE</em> (9 entradas) se exhiben con fines de publicidad y transparencia institucional conforme al principio de publicidad, no siendo radicables en la plataforma de expedientes SIGD.
                  </p>
                </div>
              </article>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
