import { useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  Users,
  FileText,
  Monitor,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import AsistenteVirtual from "../components/asistente/AsistenteVirtual";

interface PublicCard {
  titulo: string;
  descripcion: string;
  accion: string;
  ruta: string;
  imagen: string;
}

interface SeccionModulo {
  titulo: string;
  subtitulo: string;
  descripcion: string;
  ruta: string;
  destacado?: boolean;
}

const SERVICIOS_PUBLICOS: PublicCard[] = [
  {
    titulo: "Mesa de Partes Virtual",
    descripcion:
      "Presentación y radicación digital de trámites, requisitos formales TUPA y anexos documentales.",
    accion: "Acceder al servicio",
    ruta: "/tramite",
    imagen: "/images/mesa-partes.png",
  },
  {
    titulo: "Casilla Electrónica",
    descripcion:
      "Consulta y recepción de notificaciones electrónicas institucionales con plena validez legal.",
    accion: "Ingresar al servicio",
    ruta: "/casilla",
    imagen: "/images/casilla-electronica.png",
  },
  {
    titulo: "Consulta de Trámite",
    descripcion:
      "Consulta en línea del estado procesal del expediente mediante el Código Único de Trámite (CUT).",
    accion: "Consultar trámite",
    ruta: "/consulta",
    imagen: "/images/consulta-tramite.png",
  },
  {
    titulo: "Validador CVD",
    descripcion:
      "Valida la autenticidad e integridad de documentos firmados digitalmente mediante el Código de Verificación Digital.",
    accion: "Verificar documento",
    ruta: "/validador-cvd",
    imagen: "/images/validador-cvd.png",
  },
];

export default function HomePage() {
  const { isAuthenticated, usuario } = useAuthStore();
  const location = useLocation();
  const mostrarPortadaAdministrador =
    (location.state as { mostrarPortadaAdministrador?: boolean } | null)
      ?.mostrarPortadaAdministrador === true;

  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      void useAuthStore.getState().verificarSesion?.();
    }
  }, []);

  let roles: string[] = usuario?.roles ?? (usuario?.rol ? [usuario.rol] : []);
  if (roles.length === 0 && typeof window !== "undefined") {
    try {
      const stored = JSON.parse(window.localStorage.getItem("sigd_roles") ?? "null");
      if (Array.isArray(stored)) {
        roles = stored.filter((r): r is string => typeof r === "string");
      } else {
        const r = window.localStorage.getItem("sigd_rol");
        if (r) roles = [r];
      }
    } catch {
      // fallback
    }
  }

  const tienePermiso = (codigo: string, ambitoGlobalSolo = false): boolean => {
    let facultades = usuario?.permisos;
    if (!facultades && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("sigd_facultades");
        if (raw) facultades = JSON.parse(raw);
      } catch {
        facultades = [];
      }
    }
    if (!Array.isArray(facultades)) return false;
    return facultades.some(
      (p: any) =>
        p &&
        p.codigo === codigo &&
        (!ambitoGlobalSolo || (p.ambito === "GLOBAL" && p.areaId === null))
    );
  };

  const esAdmin =
    roles.includes("ADMINISTRADOR") ||
    roles.includes("SUPER_ADMIN") ||
    tienePermiso("ADMIN_USUARIOS", true);

  // El administrador tiene un único punto de entrada: el panel centralizado.
  // Los demás roles conservan la portada y su cuadrícula de accesos autorizados.
  if (isAuthenticated && esAdmin && !mostrarPortadaAdministrador) {
    return <Navigate to="/administracion" replace />;
  }

  const puedeFirmar =
    roles.includes("DIRECTOR") ||
    roles.includes("ADMINISTRADOR") ||
    tienePermiso("FIRMA_FIRMAR", true);

  const puedeReportes =
    esAdmin || puedeFirmar || tienePermiso("REPORTE_LEER", true);

  const esVentanilla = roles.includes("MESA_PARTES");

  const puedeProyectar =
    esAdmin ||
    roles.includes("SECRETARIO") ||
    roles.includes("COORDINADOR_AREA") ||
    roles.includes("JEFE_UNIDAD_ACADEMICA");

  const esPersonal =
    esAdmin ||
    puedeFirmar ||
    esVentanilla ||
    puedeProyectar ||
    roles.some((r) =>
      [
        "DOCENTE",
        "COORDINADOR_AREA",
        "JEFE_UNIDAD_ACADEMICA",
        "GESTOR_APOYO_AREA",
      ].includes(r)
    );

  const esCiudadano = roles.includes("CIUDADANO") || (!esPersonal && isAuthenticated);

  // Módulos para usuario autenticado
  const modulosAutenticados: SeccionModulo[] = [];

  const esSoloTesoreria = roles.some(r => ['CAJERO','TESORERO','SUPERVISOR_TESORERIA','APROBADOR_DEVOLUCIONES'].includes(r)) &&
    !esAdmin && !roles.some(r => ['DIRECTOR','SECRETARIO','MESA_PARTES','CIUDADANO','DOCENTE'].includes(r));
  if (isAuthenticated && !esSoloTesoreria) {
    if (esCiudadano && !esPersonal) {
      modulosAutenticados.push(
        {
          titulo: "Casilla Electrónica",
          subtitulo: "ENT-M01-03 / Notificaciones",
          descripcion:
            "Revisa y gestiona los actos administrativos notificados formalmente a tu casilla digital.",
          ruta: "/casilla",
          destacado: true,
        },
        {
          titulo: "Mis Expedientes",
          subtitulo: "Trámites Vinculados",
          descripcion:
            "Revisa tus expedientes institucionales y gestiona solicitudes de vinculación de trámites históricos.",
          ruta: "/mis-expedientes",
          destacado: true,
        },
        {
          titulo: "Nuevo Trámite",
          subtitulo: "ENT-M02 / TUPA 2026",
          descripcion:
            "Presenta solicitudes académicas, certificados, traslados y trámites conforme al TUPA vigente.",
          ruta: "/tramite",
          destacado: true,
        },
        {
          titulo: "Consulta de Trámite",
          subtitulo: "Seguimiento en Línea",
          descripcion:
            "Monitorea el avance de tus expedientes en tiempo real utilizando tu Código Único de Trámite.",
          ruta: "/consulta",
        },
        {
          titulo: "Validador CVD",
          subtitulo: "MOD-04 / Verificación",
          descripcion:
            "Verifica la autenticidad e integridad de constancias y resoluciones institucionales emitidas.",
          ruta: "/validador-cvd",
        }
      );
    } else {
      if (esAdmin) {
        modulosAutenticados.push({
          titulo: "Panel de Administración",
          subtitulo: "ENT-M05-01 / RBAC",
          descripcion:
            "Gestión de cuentas institucionales, roles, permisos del sistema, tablas maestras y auditoría.",
          ruta: "/administracion",
          destacado: true,
        });
      }

      if (esVentanilla || esAdmin) {
        modulosAutenticados.push({
          titulo: "Ventanilla Presencial",
          subtitulo: "ENT-M02-05 / Mesa de Partes",
          descripcion:
            "Recepción física presencial de expedientes, captura de DNI y emisión de cargo foliado con CUT.",
          ruta: "/tramite/ventanilla-presencial",
          destacado: true,
        });
      }

      modulosAutenticados.push({
        titulo: "Bandeja de Expedientes",
        subtitulo: "ENT-M05 / RutaDoc",
        descripcion:
          "Gestión de expedientes asignados a su área, recepción, derivación, providencias y foliado.",
        ruta: "/expedientes",
        destacado: true,
      });

      if (puedeFirmar) {
        modulosAutenticados.push({
          titulo: "Firma Digital",
          subtitulo: "MOD-04 / Despacho Directoral",
          descripcion:
            "Bandeja de despacho directoral para suscripción digital con PAdES y ReFirma.",
          ruta: "/flujo-validez-legal/firma",
          destacado: true,
        });
      }

      if (puedeProyectar) {
        modulosAutenticados.push({
          titulo: "Resoluciones",
          subtitulo: "DocuCore / Proyección",
          descripcion:
            "Proyección y redacción técnica de proyectos de resolución académica y administrativa.",
          ruta: "/flujos/proyector-resoluciones",
        });
      }

      if (puedeReportes) {
        modulosAutenticados.push({
          titulo: "Reportes y Tableros de Control",
          subtitulo: "06_reportes-tablero-control",
          descripcion:
            "Tablero de control gerencial, indicadores MGD, tiempos de atención y distribución de carga.",
          ruta: "/reportes/dashboard",
        });
      }

      modulosAutenticados.push({
        titulo: "Validador CVD",
        subtitulo: "MOD-04 / Verificación",
        descripcion:
          "Valida la autenticidad e integridad de actos administrativos firmados digitalmente.",
        ruta: "/validador-cvd",
      });
    }
  }

  if (isAuthenticated && (esAdmin || roles.includes('CIUDADANO') || roles.includes('TESORERO') || usuario?.permisos?.some(p => p.codigo.startsWith('TESORERIA_') && p.ambito === 'GLOBAL' && p.areaId === null))) {
    modulosAutenticados.push({ titulo: roles.includes('CIUDADANO') ? 'Mis pagos y devoluciones' : 'Tesorería',
      subtitulo: 'M10 / Gestión económica', descripcion: 'Órdenes de pago, comprobantes, verificación y solicitudes de devolución.', ruta: '/tesoreria' });
  }
  return (
    <main className="w-full bg-[#E8F4FE] min-h-[calc(100vh-96px)] flex flex-col justify-between">
      {/* ------------------------------------------------------------------ */}
      {/* MODO AUTENTICADO: Banner de sesión y tarjetas de gestión interna    */}
      {/* ------------------------------------------------------------------ */}
      {isAuthenticated && usuario && !mostrarPortadaAdministrador && (
        <div className="w-full bg-[#E8F4FE] py-8">
          <div className="mx-auto w-[92%] max-w-[1600px] px-2 sm:px-4 lg:px-6">
            {/* Banner de bienvenida y rol */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-200 bg-white/90 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-900 font-bold text-lg">
                  {usuario.nombreCompleto?.charAt(0) || "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      Sesión institucional activa
                    </span>
                    <span className="rounded-full bg-blue-700 px-2.5 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider">
                      {roles.join(", ") || usuario.rol}
                    </span>
                  </div>
                  <h1 className="text-lg font-bold text-slate-900">
                    {usuario.nombreCompleto || usuario.correo}
                  </h1>
                </div>
              </div>
            </div>

            {/* Cuadrícula de módulos autorizados */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-[#082F7C] mb-4">
                Módulos de Gestión Autorizados
              </h2>
              <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {modulosAutenticados.map((mod) => (
                  <Link
                    key={mod.ruta}
                    to={mod.ruta}
                    className="group rounded-xl border border-[#D8E6F5] bg-white p-6 shadow-sm transition duration-200 hover:shadow-md hover:-translate-y-1"
                  >
                    {mod.subtitulo && (
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                        {mod.subtitulo}
                      </span>
                    )}
                    <h3 className="mt-1 text-lg font-bold text-[#082F7C] group-hover:text-blue-700">
                      {mod.titulo}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {mod.descripcion}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* PORTADA INSTITUCIONAL FIEL (Pública cuando no autenticado)          */}
      {/* ------------------------------------------------------------------ */}
      {(!isAuthenticated || mostrarPortadaAdministrador) && (
        <div className="w-full flex flex-col">
          {/* B. Fotografía principal del instituto y el equipo (Hero Ancho Completo) */}
          <section className="relative w-full h-[565px] overflow-hidden bg-[#E8F4FE]">
            {/* Fotografía a la derecha, separada del bloque textual en escritorio */}
            <div
              className="absolute top-0 right-0 w-[1043px] h-[521px] overflow-hidden pointer-events-none"
              style={{ clipPath: "url(#hero-photo-contour)" }}
            >
              <img
                src="/images/equipo-institucional.png"
                alt="Equipo institucional frente al Instituto Suiza"
                className="w-full h-full object-cover object-[50%_28%]"
                loading="eager"
              />
            </div>

            {/* Gradiente izquierdo para legibilidad total del título */}
            <div
              className="absolute inset-0 pointer-events-none z-[4] w-[608px] ![background:linear-gradient(90deg,#E8F4FE_0%,#E8F4FE_67%,rgba(232,244,254,0.82)_70%,rgba(232,244,254,0.50)_74%,rgba(232,244,254,0.22)_80%,rgba(232,244,254,0.06)_88%,rgba(232,244,254,0)_94%)]"
            />
            {/* Continuidad del cielo hacia el fondo celeste, sin mover la fotografía. */}
            <div
              aria-hidden="true"
              className="absolute left-0 top-0 h-[521px] w-[500px] pointer-events-none z-[5]"
              style={{
                background:
                  "linear-gradient(180deg, #ACD8F6 0%, #D6EDFC 23%, #E8F4FE 54%)",
                maskImage:
                  "linear-gradient(90deg, black 0%, black 52%, rgba(0, 0, 0, 0.55) 68%, rgba(0, 0, 0, 0.18) 82%, transparent 92%)",
              }}
            />
            {/* Solo el follaje del árbol derecho original; sin repetir la fachada. */}
            <div
              aria-hidden="true"
              className="absolute -left-[87px] top-0 h-[232px] w-[434px] pointer-events-none z-[5]"
              style={{
                backgroundImage: 'url("/images/equipo-institucional.png")',
                backgroundSize: "2085px auto",
                backgroundPosition: "right 116px top -116px",
                backgroundRepeat: "no-repeat",
                maskImage:
                  "radial-gradient(ellipse 72% 100% at 50% 0%, black 0%, black 50%, transparent 100%), linear-gradient(90deg, black 0%, black 52%, transparent 72%), linear-gradient(180deg, black 0%, black 30%, transparent 90%)",
                maskComposite: "intersect",
              }}
            />

            {/* Título y descripción institucional */}
            <div className="absolute left-[72px] top-1/2 -translate-y-1/2 z-10 w-[390px] m-0 p-0 text-left">
              <div className="w-[390px] text-left">
                <h1 className="text-[36px] font-bold text-[#082F7C] leading-[1.12] tracking-tight max-w-[390px]">
                  Sistema Integral de{" "}
                  <br />
                  Gestión Documentaria
                </h1>
                <div className="w-[104px] h-[4px] bg-[#005bb5] my-4 rounded-full" />
                <p className="text-[16px] text-[#082F7C] leading-[1.45] font-medium max-w-[370px]">
                  Plataforma institucional para la atención de trámites, servicios digitales y notificaciones electrónicas con validez legal.
                </p>
              </div>
            </div>

            {/* Dos ondas superpuestas que enlazan la fotografía con Servicios Digitales */}
            <div className="absolute bottom-[24px] left-0 w-full overflow-visible leading-none z-10 pointer-events-none">
              <svg
                aria-hidden="true"
                viewBox="0 0 1440 108"
                preserveAspectRatio="none"
                className="block w-full h-[76px] overflow-visible"
              >
                <defs>
                  <clipPath id="hero-photo-contour" clipPathUnits="objectBoundingBox">
                    <path d="M0,0 H1 V0.872 C0.96,0.872 0.92,0.94 0.70,0.94 C0.45,0.94 0.20,0.92 0,0.91 Z" />
                  </clipPath>
                  <linearGradient id="hero-onda-clara" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F7FBFF" />
                    <stop offset="100%" stopColor="#E8F4FE" />
                  </linearGradient>
                  <linearGradient id="hero-onda-celeste" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#C8E4FC" />
                    <stop offset="35%" stopColor="#C8E4FC" stopOpacity="0.85" />
                    <stop offset="70%" stopColor="#C8E4FC" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#C8E4FC" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,-56 C180,-16 340,8 500,18 C760,24 1110,34 1280,24 C1360,18 1390,-14 1440,-14 L1440,108 L0,108 Z"
                  fill="url(#hero-onda-clara)"
                />
                <path
                  d="M0,-42 C180,-2 340,22 500,32 C760,38 1110,48 1280,38 C1360,32 1390,0 1440,0 L1440,26 C1390,26 1360,58 1280,64 C1110,74 760,64 500,58 C340,48 180,24 0,-16 Z"
                  fill="url(#hero-onda-celeste)"
                />
              </svg>
            </div>
          </section>

          {/* C. Sección «Servicios digitales» y D. Cuatro Tarjetas (Ampliadas 92% max 1600px) */}
          <section className="w-full bg-[#E8F4FE] pt-5 pb-12 sm:pb-14">
            <div className="mx-auto w-[92%] max-w-[1600px] px-2 sm:px-4 lg:px-6">
              {/* Encabezado de la sección */}
              <div className="flex items-start gap-3.5 mb-7">
                <div className="w-[4.5px] h-[40px] bg-[#005bb5] rounded-full mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-[28px] sm:text-[30px] font-bold text-[#082F7C] leading-none">
                    Servicios digitales
                  </h2>
                  <p className="text-[14.5px] sm:text-[15.5px] text-[#082F7C]/80 mt-1.5 font-normal">
                    Accede a nuestros servicios públicos y realiza tus trámites de forma rápida, segura y confiable.
                  </p>
                </div>
              </div>

              {/* Cuatro tarjetas de servicios públicos de ancho óptimo y homogéneo */}
              <div className="grid grid-cols-4 gap-5 lg:gap-6">
                {SERVICIOS_PUBLICOS.map((card) => (
                  <Link
                    key={card.ruta}
                    to={card.ruta}
                    className="group flex flex-col justify-between bg-white rounded-[14px] border border-[#D7E8F8] shadow-[0_2px_10px_rgba(8,47,124,0.05)] hover:shadow-[0_8px_24px_rgba(8,47,124,0.12)] hover:-translate-y-1 transition duration-200 ease-out overflow-hidden min-h-[265px] lg:min-h-[275px] p-3 sm:p-3.5"
                  >
                    <div>
                      {/* Fotografía panorámica con relación ~3.4:1 */}
                      <div className="w-full h-[96px] sm:h-[102px] overflow-hidden rounded-[8px] bg-slate-100">
                        <img
                          src={card.imagen}
                          alt={card.titulo}
                          className="w-full h-full object-cover object-center group-hover:scale-102 transition duration-300"
                        />
                      </div>

                      {/* Textos de la tarjeta */}
                      <div className="pt-3 px-1">
                        <h3 className="text-[17.5px] sm:text-[18.5px] font-bold text-[#082F7C] leading-snug group-hover:text-[#005bb5] transition">
                          {card.titulo}
                        </h3>
                        <p className="mt-1.5 text-[13.5px] sm:text-[14px] text-[#334E68] leading-relaxed">
                          {card.descripcion}
                        </p>
                      </div>
                    </div>

                    {/* CTA en la parte inferior alineado */}
                    <div className="flex items-center justify-between pt-3 pb-1 px-1 border-t border-slate-100/70 mt-3">
                      <span className="text-[14px] font-semibold text-[#005bb5] group-hover:underline">
                        {card.accion}
                      </span>
                      <div className="w-9 h-9 rounded-full bg-[#0073E6] group-hover:bg-[#005bb5] flex items-center justify-center text-white shadow-sm transition shrink-0">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* E. Franja inferior de beneficios institucionales (Ancho completo 92% max 1600px) */}
          <section className="w-full bg-[#D6EAFC] border-y border-[#BBD5EE] py-4 sm:py-5">
            <div className="mx-auto w-[92%] max-w-[1600px] px-2 sm:px-4 lg:px-6">
              <div className="grid grid-cols-4 gap-0 divide-x divide-[#BDD8F1]">
                {/* Beneficio 1 */}
                <div className="flex items-center gap-3.5 px-3 py-2 justify-center">
                  <div className="w-11 h-11 rounded-full bg-white/80 flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck className="w-7 h-7 text-[#005bb5]" />
                  </div>
                  <span className="text-[14px] sm:text-[15px] font-medium text-[#082F7C] leading-snug">
                    Trámites seguros
                    <br />
                    y confiables
                  </span>
                </div>

                {/* Beneficio 2 */}
                <div className="flex items-center gap-3.5 px-3 py-2 justify-center">
                  <div className="w-11 h-11 rounded-full bg-white/80 flex items-center justify-center shrink-0 shadow-xs">
                    <Users className="w-7 h-7 text-[#005bb5]" />
                  </div>
                  <span className="text-[14px] sm:text-[15px] font-medium text-[#082F7C] leading-snug">
                    Atención transparente
                    <br />
                    y eficiente
                  </span>
                </div>

                {/* Beneficio 3 */}
                <div className="flex items-center gap-3.5 px-3 py-2 justify-center">
                  <div className="w-11 h-11 rounded-full bg-white/80 flex items-center justify-center shrink-0 shadow-xs">
                    <FileText className="w-7 h-7 text-[#005bb5]" />
                  </div>
                  <span className="text-[14px] sm:text-[15px] font-medium text-[#082F7C] leading-snug">
                    Servicio con validez legal
                  </span>
                </div>

                {/* Beneficio 4 */}
                <div className="flex items-center gap-3.5 px-3 py-2 justify-center">
                  <div className="w-11 h-11 rounded-full bg-white/80 flex items-center justify-center shrink-0 shadow-xs">
                    <Monitor className="w-7 h-7 text-[#005bb5]" />
                  </div>
                  <span className="text-[14px] sm:text-[15px] font-medium text-[#082F7C] leading-snug">
                    Al servicio de la
                    <br />
                    comunidad educativa
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Espacio visual inferior con fondo celeste claro */}
          <div className="w-full h-12 bg-[#E8F4FE]" />
          <AsistenteVirtual />
        </div>
      )}
    </main>
  );
}
