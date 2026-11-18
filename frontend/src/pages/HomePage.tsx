import { Link } from "react-router-dom";
import {
  Laptop,
  Search,
  Layers,
  ShieldCheck,
  ArrowRight,
  FileText,
} from "lucide-react";
import estudiantesImg from "../assets/sigd/estudiantes-sigd.webp";
import entradaInstitutoImg from "../assets/sigd/entrada-instituto.webp";

export default function HomePage() {
  return (
    <main className="w-full flex-1 flex flex-col justify-start" id="inicio">
      {/* 1. Hero Panorámico Institucional Oficial (Traslado de Maqueta index.html) */}
      <section className="sigd-hero" aria-labelledby="hero-title">
        {/* Fachada panorámica auténtica del IESTP SUIZA */}
        <div className="sigd-hero-building" role="img" aria-label="Entrada del Instituto Superior Tecnológico Suiza">
          <img
            src={entradaInstitutoImg}
            alt="Entrada del Instituto Superior Tecnológico Suiza"
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </div>

        {/* Degradado luminoso institucional: Cerúleo y azul regio en texto con desvanecimiento suave */}
        <div className="sigd-hero-shade" aria-hidden="true" />

        {/* Curvas fluidas decorativas con degradados celestes/azules (Ribbons Glass) */}
        <svg
          className="sigd-hero-ribbons"
          viewBox="0 0 600 450"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="ribbonCyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#0284c7" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="ribbonDeep" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#0369a1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#075985" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ribbonGlow" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path
            d="M -50 0 C 150 80, 260 220, 220 450 L 160 450 C 200 240, 100 120, -50 40 Z"
            fill="url(#ribbonCyan)"
          />
          <path
            d="M 50 0 C 230 110, 320 280, 260 450 L 220 450 C 280 300, 190 140, 0 30 Z"
            fill="url(#ribbonDeep)"
          />
          <path
            d="M -30 20 C 140 90, 235 210, 205 450"
            stroke="url(#ribbonGlow)"
            strokeWidth="3.5"
            fill="none"
            opacity="0.85"
          />
        </svg>

        {/* Reflejo geométrico diagonal institucional */}
        <div className="sigd-hero-diagonal" aria-hidden="true" />

        {/* Tres Estudiantes Institucionales */}
        <img
          className="sigd-hero-students"
          src={estudiantesImg}
          alt="Estudiantes del IESTP Suiza"
          fetchPriority="high"
          width={1448}
          height={1086}
          loading="eager"
          decoding="async"
        />

        {/* Contenido / Textos y Acciones en Glass Card */}
        <div className="sigd-hero-copy">
          <span className="sr-only">Sistema Integral de Gestión Documentaria</span>
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-amber-300/95 text-blue-950 px-3.5 py-1 text-[11px] sm:text-xs font-black uppercase tracking-wider shadow-sm mb-2">
            <span>IESTP &quot;SUIZA&quot; · Pucallpa, Ucayali</span>
            <span className="opacity-60">•</span>
            <span>R.D. N° 0778-2006-ED</span>
          </div>
          <h1 id="hero-title">
            Trámites Documentarios <br />del IESTP SUIZA
          </h1>
          <p>
            Plataforma oficial del Instituto de Educación Superior Tecnológico Público &quot;Suiza&quot; de Pucallpa. Presenta solicitudes, consulta tu CUT y valida documentos con valor legal.
          </p>
          <div className="sigd-hero-actions">
            <Link to="/mesa-partes" className="sigd-cta sigd-cta-light">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
              <span>Iniciar trámite</span>
            </Link>
            <Link to="/consulta" className="sigd-cta sigd-cta-outline">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
              <span>Consultar CUT</span>
            </Link>
          </div>
        </div>

        {/* Ondas decorativas fluidas (Juego enriquecido de 5 capas armónicas con relieve y transparencias) */}
        <svg
          className="sigd-hero-waves"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1672 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            {/* Gradiente 1: Celeste cielo luminoso para capa trasera */}
            <linearGradient id="sigdWaveSky" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
              <stop offset="30%" stopColor="#7dd3fc" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.60" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.70" />
            </linearGradient>

            {/* Gradiente 2: Cinta azul institucional vibrante con volumen */}
            <linearGradient id="sigdWaveVibrant" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.96" />
              <stop offset="25%" stopColor="#039ae8" stopOpacity="0.94" />
              <stop offset="65%" stopColor="#0284c7" stopOpacity="0.96" />
              <stop offset="100%" stopColor="#005ea6" stopOpacity="0.98" />
            </linearGradient>

            {/* Gradiente 3: Turquesa/celeste translúcido con reflejo */}
            <linearGradient id="sigdWaveCyanIce" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.65" />
              <stop offset="45%" stopColor="#bae6fd" stopOpacity="0.50" />
              <stop offset="80%" stopColor="#7dd3fc" stopOpacity="0.60" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.65" />
            </linearGradient>

            {/* Gradiente 4: Velo de luz blanco-hielo suave */}
            <linearGradient id="sigdWaveIce" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.80" />
              <stop offset="50%" stopColor="#f0f9ff" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.80" />
            </linearGradient>

            {/* Gradiente 5: Base blanca luminosa que fluye hacia servicios */}
            <linearGradient id="sigdWaveBase" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
              <stop offset="45%" stopColor="#edf8ff" stopOpacity="1" />
              <stop offset="100%" stopColor="#e1f2fd" stopOpacity="1" />
            </linearGradient>

            {/* Sombra de relieve volumétrica para la cinta azul */}
            <filter id="sigdWaveShadow" x="-2%" y="-10%" width="104%" height="130%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#002855" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* 1. Capa trasera celeste cielo translúcida (asoma en las crestas superiores) */}
          <path
            d="M0 20 C 140 6, 360 62, 580 60 C 780 58, 1040 32, 1280 20 C 1420 12, 1540 6, 1672 16 V 100 H 0 Z"
            fill="url(#sigdWaveSky)"
          />

          {/* 2. Cinta azul vibrante institucional continua con relieve */}
          <path
            d="M0 26 C 120 10, 340 70, 640 70 C 880 70, 1140 44, 1380 24 C 1500 14, 1600 6, 1672 14 V 36 C 1600 28, 1500 36, 1380 48 C 1140 68, 880 88, 640 88 C 340 86, 120 26, 0 42 Z"
            fill="url(#sigdWaveVibrant)"
            filter="url(#sigdWaveShadow)"
          />

          {/* 3. Onda intermedia cian/hielo translúcida con fase desplazada (segundo oleaje visible) */}
          <path
            d="M0 36 C 220 18, 420 80, 720 78 C 960 76, 1200 48, 1420 30 C 1520 22, 1610 16, 1672 24 V 100 H 0 Z"
            fill="url(#sigdWaveCyanIce)"
          />

          {/* 4. Velo suave blanco-hielo superpuesto */}
          <path
            d="M0 46 C 200 28, 400 84, 680 84 C 920 84, 1160 56, 1380 38 C 1500 28, 1600 22, 1672 32 V 100 H 0 Z"
            fill="url(#sigdWaveIce)"
          />

          {/* 5. Onda base blanca luminosa que conecta a 0px con servicios */}
          <path
            d="M0 54 C 180 36, 380 90, 640 90 C 880 90, 1120 64, 1340 48 C 1480 38, 1590 28, 1672 38 V 100 H 0 Z"
            fill="url(#sigdWaveBase)"
          />
        </svg>
      </section>

      {/* 2. Cuatro Tarjetas de Servicios Públicos (Composición vertical según boceto) */}
      <section className="sigd-services" id="servicios" aria-label="Servicios públicos del SIGD">
        <div className="sigd-services-grid">
          {/* Tarjeta 1: Mesa de Partes Digital */}
          <Link to="/mesa-partes" className="sigd-service-card group">
            <div className="sigd-service-top">
              <div className="sigd-service-icon">
                <Laptop className="sigd-icon-svg" />
              </div>
              <span className="sigd-service-badge">Atención 24/7</span>
            </div>
            <div className="sigd-service-content">
              <h2 className="sigd-service-title">Mesa de Partes Digital</h2>
              <p className="sigd-service-desc">Presenta tus trámites y adjunta documentos.</p>
            </div>
            <div className="sigd-service-action">
              <span className="sigd-service-arrow" aria-hidden="true">
                <ArrowRight className="sigd-arrow-svg" />
              </span>
              <span className="sigd-service-cta-label">Iniciar solicitud</span>
            </div>
            <svg className="sigd-card-corner" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="cardCornerWaveBack1" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#7dd3fc" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="cardCornerWaveFront1" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#0284c7" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#0066b2" stopOpacity="0.98" />
                </linearGradient>
              </defs>
              <path
                d="M 0 70 C 26 69, 54 55, 74 38 C 86 26, 94 14, 100 0 L 100 70 Z"
                fill="url(#cardCornerWaveBack1)"
              />
              <path
                d="M 32 70 C 52 69, 72 57, 84 43 C 92 33, 97 22, 100 12 L 100 70 Z"
                fill="url(#cardCornerWaveFront1)"
              />
            </svg>
          </Link>

          {/* Tarjeta 2: Consulta por CUT */}
          <Link to="/consulta" className="sigd-service-card group">
            <div className="sigd-service-top">
              <div className="sigd-service-icon">
                <Search className="sigd-icon-svg" />
              </div>
              <span className="sigd-service-badge">En tiempo real</span>
            </div>
            <div className="sigd-service-content">
              <h2 className="sigd-service-title">Consulta por CUT</h2>
              <p className="sigd-service-desc">Revisa el estado de tu trámite en línea.</p>
            </div>
            <div className="sigd-service-action">
              <span className="sigd-service-arrow" aria-hidden="true">
                <ArrowRight className="sigd-arrow-svg" />
              </span>
              <span className="sigd-service-cta-label">Rastrear trámite</span>
            </div>
            <svg className="sigd-card-corner" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="cardCornerWaveBack2" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#7dd3fc" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="cardCornerWaveFront2" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#0284c7" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#0066b2" stopOpacity="0.98" />
                </linearGradient>
              </defs>
              <path
                d="M 0 70 C 26 69, 54 55, 74 38 C 86 26, 94 14, 100 0 L 100 70 Z"
                fill="url(#cardCornerWaveBack2)"
              />
              <path
                d="M 32 70 C 52 69, 72 57, 84 43 C 92 33, 97 22, 100 12 L 100 70 Z"
                fill="url(#cardCornerWaveFront2)"
              />
            </svg>
          </Link>

          {/* Tarjeta 3: Catálogo TUPA */}
          <Link to="/tupa" className="sigd-service-card group">
            <div className="sigd-service-top">
              <div className="sigd-service-icon">
                <Layers className="sigd-icon-svg" />
              </div>
              <span className="sigd-service-badge">72 Procedimientos</span>
            </div>
            <div className="sigd-service-content">
              <h2 className="sigd-service-title">Catálogo TUPA</h2>
              <p className="sigd-service-desc">Consulta requisitos, costos y plazos oficiales.</p>
            </div>
            <div className="sigd-service-action">
              <span className="sigd-service-arrow" aria-hidden="true">
                <ArrowRight className="sigd-arrow-svg" />
              </span>
              <span className="sigd-service-cta-label">Ver catálogo</span>
            </div>
            <svg className="sigd-card-corner" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="cardCornerWaveBack3" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#7dd3fc" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="cardCornerWaveFront3" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#0284c7" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#0066b2" stopOpacity="0.98" />
                </linearGradient>
              </defs>
              <path
                d="M 0 70 C 26 69, 54 55, 74 38 C 86 26, 94 14, 100 0 L 100 70 Z"
                fill="url(#cardCornerWaveBack3)"
              />
              <path
                d="M 32 70 C 52 69, 72 57, 84 43 C 92 33, 97 22, 100 12 L 100 70 Z"
                fill="url(#cardCornerWaveFront3)"
              />
            </svg>
          </Link>

          {/* Tarjeta 4: Validador CVD */}
          <Link to="/validador-cvd" className="sigd-service-card group">
            <div className="sigd-service-top">
              <div className="sigd-service-icon">
                <ShieldCheck className="sigd-icon-svg" />
              </div>
              <span className="sigd-service-badge">Verificación QR</span>
            </div>
            <div className="sigd-service-content">
              <h2 className="sigd-service-title">Validador CVD</h2>
              <p className="sigd-service-desc">Verifica la autenticidad de documentos emitidos.</p>
            </div>
            <div className="sigd-service-action">
              <span className="sigd-service-arrow" aria-hidden="true">
                <ArrowRight className="sigd-arrow-svg" />
              </span>
              <span className="sigd-service-cta-label">Validar código</span>
            </div>
            <svg className="sigd-card-corner" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="cardCornerWaveBack4" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#7dd3fc" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="cardCornerWaveFront4" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#0284c7" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#0066b2" stopOpacity="0.98" />
                </linearGradient>
              </defs>
              <path
                d="M 0 70 C 26 69, 54 55, 74 38 C 86 26, 94 14, 100 0 L 100 70 Z"
                fill="url(#cardCornerWaveBack4)"
              />
              <path
                d="M 32 70 C 52 69, 72 57, 84 43 C 92 33, 97 22, 100 12 L 100 70 Z"
                fill="url(#cardCornerWaveFront4)"
              />
            </svg>
          </Link>
        </div>

        {/* Barra Institucional IESTP "Suiza" de Pucallpa */}
        <div className="mx-auto mt-3 w-full max-w-[1580px] rounded-2xl border border-sky-200/80 bg-white/85 px-4 py-2.5 shadow-2xs backdrop-blur-xs">
          <div className="flex flex-wrap items-center justify-center lg:justify-between gap-2.5 text-xs font-semibold text-[#062144]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 px-3 py-1">
              <span>📍</span>
              <span>Sede Central: Av. Túpac Amaru s/n, Pucallpa – Ucayali</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-950 px-3 py-1">
              <span>🎓</span>
              <span>11 Carreras Profesionales Técnicas · Instituto de Excelencia</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-950 px-3 py-1">
              <span>🕘</span>
              <span>Ventanilla Presencial: Lun a Vie 8:00 a.m. – 4:30 p.m. · Tel. (061) 280665</span>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
