import type { ReactNode } from 'react';
import logoSuiza from '../../assets/sigd/logo-suiza.webp';

/**
 * Engranaje tecnológico de 16 dientes del escudo del IESTP "Suiza" (marca de agua).
 */
function SuizaGearWatermark() {
  const teeth = Array.from({ length: 16 }, (_, idx) => idx * 22.5);
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 text-white/[0.06]"
    >
      <g fill="currentColor">
        {teeth.map((deg) => (
          <rect
            key={deg}
            x="92"
            y="6"
            width="16"
            height="22"
            rx="3"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
        <circle cx="100" cy="100" r="76" />
      </g>
      <circle cx="100" cy="100" r="52" fill="#00559e" />
      <circle cx="100" cy="100" r="44" fill="none" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

/**
 * Mini insignia del engranaje, aro magenta y antorcha dorada del IESTP "Suiza".
 */
function MiniSuizaCrest({ cx, cy, scale = 1 }: { cx: number; cy: number; scale?: number }) {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      <g fill="#0072bc">
        {angles.map((a) => (
          <rect key={a} x="-2.5" y="-14.5" width="5" height="6" rx="1" transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="11.5" />
      </g>
      <circle cx="0" cy="0" r="8.5" fill="#ffffff" />
      <circle cx="0" cy="0" r="7" fill="none" stroke="#e6007e" strokeWidth="1.6" />
      {/* Antorcha y llama dorada */}
      <path d="M-1.5 5.5L-2.5 0h5L1.5 5.5z" fill="#92400e" />
      <path d="M0 -6.5c2 2.2 2.8 4.4 0 6.5-2.8-2.1-2-4.3 0-6.5z" fill="#f9e000" stroke="#f59e0b" strokeWidth="0.6" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Banner de módulo reutilizable (identidad IESTP "Suiza" Pucallpa)   */
/* ------------------------------------------------------------------ */
export function ModuleHero({
  eyebrow,
  title,
  subtitle,
  illustration,
  actions,
  footer,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  illustration: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#042454] via-[#00559e] to-[#0072bc] text-white shadow-lg ring-1 ring-white/15">
      {/* Cinta tricolor institucional superior */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0072bc] via-[#e6007e] to-[#f9e000]" />

      {/* Marca de agua del engranaje institucional */}
      <SuizaGearWatermark />
      <div className="pointer-events-none absolute -left-16 -bottom-20 h-48 w-48 rounded-full bg-[#e6007e]/10" />
      <div className="pointer-events-none absolute left-1/3 -bottom-20 h-44 w-44 rounded-full bg-[#f9e000]/10" />

      <div className="relative flex flex-col gap-5 px-6 py-6 sm:px-9 sm:py-7 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <img
              src={logoSuiza}
              alt='Escudo oficial del IESTP "Suiza" de Pucallpa'
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full bg-white object-contain p-0.5 shadow-sm ring-2 ring-[#e6007e]/70"
            />
            <span className="inline-flex items-center rounded-full border border-[#f9e000]/40 bg-[#f9e000]/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#fef08a]">
              IESTP &quot;SUIZA&quot; · PUCALLPA
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f9e000]" />
              {eyebrow}
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-xs text-blue-100 sm:text-sm leading-relaxed">{subtitle}</p>}
          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        <div className="flex justify-center shrink-0">
          <div className="rounded-2xl border border-white/25 bg-white/10 p-2.5 shadow-inner backdrop-blur-sm">
            {illustration}
          </div>
        </div>
      </div>

      {footer && <div className="relative border-t border-white/15 bg-[#03193b]/55 px-6 py-3 sm:px-9">{footer}</div>}

      {/* Franja inferior tricolor */}
      <div className="h-1 w-full bg-gradient-to-r from-[#f9e000] via-[#e6007e] to-[#0072bc]" />
    </section>
  );
}

const Defs = ({ id }: { id: string }) => (
  <defs>
    <linearGradient id={`${id}-w`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="1" stopColor="#e2eeff" />
    </linearGradient>
    <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#fde047" />
      <stop offset="1" stopColor="#f59e0b" />
    </linearGradient>
    <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#0072bc" />
      <stop offset="1" stopColor="#042454" />
    </linearGradient>
    <linearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f43f8e" />
      <stop offset="1" stopColor="#e6007e" />
    </linearGradient>
  </defs>
);

/* 1. Ventanilla Presencial: Sede Av. Túpac Amaru, escáner DNI, sello y ticket QR CUT */
export function VentanillaIllustration({ className = 'h-40 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} role="img" aria-label="Ventanilla presencial IESTP Suiza Pucallpa con escáner DNI, sello y ticket QR">
      <Defs id="vp" />
      <ellipse cx="120" cy="174" rx="104" ry="8" fill="#031636" opacity="0.4" />

      {/* Cabina de atención */}
      <rect x="24" y="22" width="152" height="114" rx="12" fill="#edf4ff" stroke="#bfd7fa" />
      <rect x="24" y="22" width="152" height="18" rx="10" fill="url(#vp-b)" />
      <text x="100" y="34" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff" fontFamily="system-ui">SEDE AV. TÚPAC AMARU · PUCALLPA</text>

      {/* Ventana interior + Operador */}
      <rect x="34" y="46" width="132" height="68" rx="8" fill="#c7e0fc" />
      <circle cx="96" cy="70" r="13" fill="#fcd9b6" />
      <path d="M90 59c5-6 14-5 19 1-6-3-13-3-19-1z" fill="#1e293b" />
      <path d="M72 114c0-15 10-25 24-25s24 10 24 25z" fill="#042454" />
      <path d="M91 90l5 11 5-11" fill="#fff" />
      {/* Credencial operador */}
      <rect x="104" y="96" width="10" height="13" rx="2" fill="#f9e000" />
      <MiniSuizaCrest cx={146} cy={66} scale={0.78} />

      {/* Escáner DNI */}
      <rect x="38" y="98" width="28" height="16" rx="3" fill="#1e293b" />
      <rect x="42" y="101" width="20" height="7" rx="1.5" fill="#38bdf8" opacity="0.85" />
      <line x1="41" y1="104.5" x2="63" y2="104.5" stroke="#e6007e" strokeWidth="1.5" />

      {/* Mostrador y sello rojo */}
      <rect x="16" y="114" width="168" height="22" rx="6" fill="url(#vp-g)" />
      <rect x="16" y="136" width="168" height="28" rx="5" fill="#042454" />
      <rect x="16" y="136" width="168" height="4" fill="url(#vp-m)" />
      <rect x="122" y="100" width="22" height="14" rx="3" fill="#e6007e" />
      <rect x="129" y="92" width="8" height="9" rx="2" fill="#881337" />

      {/* Ticket QR impreso */}
      <g transform="rotate(7 192 112)">
        <rect x="160" y="60" width="66" height="92" rx="8" fill="url(#vp-w)" stroke="#93c5fd" />
        <rect x="160" y="60" width="66" height="18" rx="8" fill="url(#vp-b)" />
        <text x="193" y="72" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#fef08a" fontFamily="ui-monospace, monospace">TICKET CUT</text>
        <text x="193" y="86" textAnchor="middle" fontSize="6" fontWeight="700" fill="#042454" fontFamily="system-ui">PUCALLPA</text>
        <g fill="#042454">
          <rect x="174" y="93" width="14" height="14" rx="2" />
          <rect x="196" y="93" width="14" height="14" rx="2" />
          <rect x="174" y="115" width="14" height="14" rx="2" />
          <rect x="196" y="115" width="6" height="6" />
          <rect x="204" y="123" width="6" height="6" />
          <rect x="196" y="123" width="6" height="6" />
        </g>
        <g fill="#fff">
          <rect x="177" y="96" width="8" height="8" rx="1" />
          <rect x="199" y="96" width="8" height="8" rx="1" />
          <rect x="177" y="118" width="8" height="8" rx="1" />
        </g>
        <rect x="170" y="136" width="46" height="6" rx="3" fill="url(#vp-g)" />
      </g>
    </svg>
  );
}

/* 2. Bandeja de Expedientes: carpetas DIR, SDA, TUPA y flecha de derivación */
export function BandejaIllustration({ className = 'h-40 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} role="img" aria-label="Bandeja de expedientes DIR, SDA y TUPA con derivación y SLA">
      <Defs id="bj" />
      <ellipse cx="116" cy="174" rx="100" ry="8" fill="#031636" opacity="0.4" />

      {/* Carpetas por área con pestañas tricolor */}
      <rect x="44" y="28" width="112" height="76" rx="8" fill="#f9e000" />
      <rect x="44" y="28" width="40" height="14" rx="6" fill="#d97706" />
      <text x="64" y="38" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#fff" fontFamily="ui-monospace, monospace">DIR</text>

      <rect x="60" y="44" width="112" height="76" rx="8" fill="url(#bj-m)" />
      <rect x="60" y="44" width="40" height="14" rx="6" fill="#9d174d" />
      <text x="80" y="54" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#fff" fontFamily="ui-monospace, monospace">SDA</text>

      <rect x="76" y="60" width="112" height="78" rx="8" fill="url(#bj-w)" stroke="#bfd7fa" />
      <rect x="76" y="60" width="44" height="14" rx="6" fill="#0072bc" />
      <text x="98" y="70" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#fff" fontFamily="ui-monospace, monospace">TUPA</text>
      <MiniSuizaCrest cx={166} cy={80} scale={0.75} />

      <rect x="88" y="84" width="58" height="6" rx="3" fill="#042454" />
      <rect x="88" y="96" width="44" height="5" rx="2.5" fill="#64748b" />
      <rect x="88" y="108" width="56" height="5" rx="2.5" fill="#94a3b8" />

      {/* Bandeja receptora */}
      <path d="M32 130h136l16 32a8 8 0 0 1-7 12H23a8 8 0 0 1-7-12z" fill="url(#bj-b)" />
      <rect x="38" y="130" width="124" height="4" fill="#f9e000" />

      {/* Flecha de derivación */}
      <circle cx="202" cy="64" r="24" fill="url(#bj-g)" />
      <path d="M190 64h22m0 0l-8-8m8 8l-8 8" stroke="#042454" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* Badge SLA en tiempo */}
      <rect x="136" y="146" width="56" height="18" rx="9" fill="#16a34a" />
      <text x="164" y="158" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff" fontFamily="system-ui">SLA 100%</text>
      <circle cx="182" cy="36" r="11" fill="#e6007e" />
      <text x="182" y="40" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff" fontFamily="system-ui">3</text>
    </svg>
  );
}

/* 3. Catálogo TUPA 2026: compendio empastado del IESTP Suiza Pucallpa + S/ + plazo */
export function CatalogoIllustration({ className = 'h-40 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} role="img" aria-label="Catálogo TUPA 2026 del IESTP Suiza con costos y plazos">
      <Defs id="ct" />
      <ellipse cx="118" cy="174" rx="102" ry="8" fill="#031636" opacity="0.4" />

      {/* Libro abierto */}
      <path d="M118 48C98 34 62 34 36 42v114c26-8 62-8 82 6z" fill="url(#ct-b)" stroke="#93c5fd" />
      <path d="M118 48c20-14 56-14 82-6v114c-26-8-62-8-82 6z" fill="url(#ct-w)" stroke="#bfd7fa" />
      <path d="M118 48v114" stroke="#f9e000" strokeWidth="2.5" />

      {/* Portada izquierda azul con escudo */}
      <MiniSuizaCrest cx={77} cy={82} scale={1.15} />
      <text x="77" y="114" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#fef08a" fontFamily="system-ui">TUPA 2026</text>
      <text x="77" y="126" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#e0f2fe" fontFamily="system-ui">IESTP SUIZA</text>

      {/* Página derecha con requisitos verificados */}
      <rect x="132" y="54" width="66" height="5.5" rx="2.5" fill="#042454" />
      {[72, 94, 116].map((y, idx) => (
        <g key={y}>
          <circle cx="138" cy={y} r="6.5" fill={idx === 2 ? '#e6007e' : '#16a34a'} />
          <path d={`M135 ${y}l2 2 4-4`} stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="150" y={y - 3} width={44 - idx * 5} height="5" rx="2.5" fill="#64748b" />
        </g>
      ))}

      {/* Etiqueta de costo S/ */}
      <g transform="rotate(-10 190 36)">
        <path d="M168 20h40l14 16-14 16h-40z" fill="url(#ct-g)" />
        <circle cx="176" cy="36" r="3" fill="#fff" />
        <text x="196" y="41" textAnchor="middle" fontSize="13" fontWeight="900" fill="#7c2d12" fontFamily="system-ui">S/</text>
      </g>

      {/* Reloj de plazo */}
      <circle cx="44" cy="144" r="19" fill="url(#ct-m)" />
      <circle cx="44" cy="144" r="14" fill="#fff" />
      <path d="M44 135v9l6 4" stroke="#042454" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/* 4. Mesa de Partes Digital: expediente PDF, FOLIO 001, CUT EXP-2026, carga y escudo */
export function MesaPartesIllustration({ className = 'h-40 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} role="img" aria-label="Mesa de Partes Digital IESTP Suiza con PDF, foliación y CUT">
      <Defs id="mp" />
      <ellipse cx="120" cy="174" rx="102" ry="8" fill="#031636" opacity="0.4" />

      <rect x="34" y="34" width="128" height="120" rx="12" fill="#00559e" opacity="0.55" />
      <rect x="44" y="42" width="128" height="120" rx="12" fill="#60a5fa" opacity="0.35" />

      {/* Hoja expediente */}
      <rect x="52" y="22" width="128" height="142" rx="12" fill="url(#mp-w)" stroke="#bfd7fa" />
      <rect x="52" y="22" width="128" height="28" rx="12" fill="url(#mp-b)" />
      <rect x="52" y="36" width="128" height="14" fill="url(#mp-b)" />
      <text x="90" y="39" fontSize="8" fontWeight="800" fill="#ffffff" fontFamily="system-ui">IESTP SUIZA</text>
      <MiniSuizaCrest cx={70} cy={36} scale={0.62} />

      {/* Insignias PDF y FOLIO 001 */}
      <rect x="64" y="58" width="32" height="14" rx="4" fill="url(#mp-m)" />
      <text x="80" y="68" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff" fontFamily="system-ui">PDF</text>
      <rect x="102" y="58" width="66" height="14" rx="4" fill="#e0f2fe" stroke="#93c5fd" />
      <text x="135" y="68" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#042454" fontFamily="ui-monospace, monospace">FOLIO 001</text>

      <rect x="64" y="82" width="84" height="5.5" rx="2.5" fill="#042454" />
      <rect x="64" y="94" width="102" height="4.5" rx="2" fill="#64748b" />
      <rect x="64" y="104" width="90" height="4.5" rx="2" fill="#94a3b8" />

      <rect x="64" y="118" width="104" height="24" rx="6" fill="#eaf2ff" stroke="#0072bc" />
      <text x="116" y="133" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#042454" fontFamily="ui-monospace, monospace">CUT EXP-2026</text>

      {/* Flecha subida + sello dorado */}
      <circle cx="194" cy="52" r="21" fill="url(#mp-g)" />
      <path d="M194 62V42m0 0l-7 7m7-7l7 7" stroke="#042454" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      <g transform="rotate(-10 186 128)">
        <circle cx="186" cy="128" r="21" fill="url(#mp-g)" />
        <circle cx="186" cy="128" r="16" fill="none" stroke="#fffbeb" strokeWidth="1.5" strokeDasharray="2 2.5" />
        <path d="M178 128l5.5 5.5 10.5-11" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/* 5. Tesorería Institucional: Caja Pucallpa, recibo REC-2026, S/, QR Yape y monedas */
export function TesoreriaIllustration({ className = 'h-40 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} role="img" aria-label="Tesorería IESTP Suiza Pucallpa con recibo oficial, S/ y QR">
      <Defs id="ts" />
      <ellipse cx="120" cy="174" rx="102" ry="8" fill="#031636" opacity="0.4" />

      {/* Comprobante */}
      <path d="M46 22h124a10 10 0 0 1 10 10v130l-12-7-11 7-11-7-11 7-11-7-11 7-11-7-11 7-11-7-11 7-11-7-12 7V32a10 10 0 0 1 10-10z" fill="url(#ts-w)" stroke="#bfd7fa" />
      <rect x="46" y="22" width="134" height="30" rx="10" fill="url(#ts-b)" />
      <rect x="46" y="38" width="134" height="14" fill="url(#ts-b)" />
      <text x="122" y="40" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#fef08a" fontFamily="ui-monospace, monospace">CAJA PUCALLPA · REC</text>
      <MiniSuizaCrest cx={64} cy={37} scale={0.62} />

      {/* Medallón S/ con aro magenta */}
      <circle cx="82" cy="84" r="19" fill="url(#ts-g)" stroke="#e6007e" strokeWidth="2.5" />
      <text x="82" y="90" textAnchor="middle" fontSize="15" fontWeight="900" fill="#7c2d12" fontFamily="system-ui">S/</text>

      {/* QR de pago */}
      <rect x="114" y="62" width="46" height="46" rx="6" fill="#fff" stroke="#93c5fd" />
      <g fill="#042454">
        <rect x="120" y="68" width="11" height="11" rx="1.5" />
        <rect x="142" y="68" width="11" height="11" rx="1.5" />
        <rect x="120" y="90" width="11" height="11" rx="1.5" />
        <rect x="135" y="84" width="5" height="5" />
        <rect x="142" y="90" width="11" height="5" />
        <rect x="135" y="96" width="6" height="5" />
      </g>
      <g fill="#fff">
        <rect x="122.5" y="70.5" width="6" height="6" />
        <rect x="144.5" y="70.5" width="6" height="6" />
        <rect x="122.5" y="92.5" width="6" height="6" />
      </g>

      <rect x="64" y="118" width="96" height="5" rx="2.5" fill="#94a3b8" />
      <rect x="64" y="130" width="76" height="20" rx="6" fill="#dcfce7" stroke="#86efac" />
      <circle cx="78" cy="140" r="6" fill="#16a34a" />
      <path d="M75 140l2 2 4-4" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="112" y="143.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#166534" fontFamily="system-ui">CONFIRMADO</text>

      {/* Monedas doradas */}
      {[150, 136, 122].map((cy) => (
        <g key={cy}>
          <ellipse cx="198" cy={cy} rx="21" ry="6.5" fill="#d97706" />
          <rect x="177" y={cy - 8} width="42" height="8" fill="#f59e0b" />
          <ellipse cx="198" cy={cy - 8} rx="21" ry="6.5" fill="url(#ts-g)" />
        </g>
      ))}
    </svg>
  );
}

/* 6. Validador CVD: escudo criptográfico con engranaje Suiza, R.D. y lector QR */
export function ValidadorCvdIllustration({ className = 'h-40 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} role="img" aria-label="Validador CVD y código QR con sello de autenticidad del IESTP Suiza">
      <Defs id="cv" />
      <ellipse cx="120" cy="174" rx="102" ry="8" fill="#031636" opacity="0.4" />

      {/* Resolución oficial al fondo */}
      <rect x="34" y="26" width="128" height="136" rx="12" fill="url(#cv-w)" stroke="#bfd7fa" />
      <rect x="34" y="26" width="128" height="24" rx="12" fill="url(#cv-b)" />
      <rect x="34" y="38" width="128" height="12" fill="url(#cv-b)" />
      <text x="98" y="41" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fef08a" fontFamily="ui-monospace, monospace">R.D. IESTP SUIZA</text>
      <rect x="48" y="60" width="76" height="5" rx="2.5" fill="#042454" />
      <rect x="48" y="72" width="96" height="4.5" rx="2" fill="#94a3b8" />
      <rect x="48" y="82" width="82" height="4.5" rx="2" fill="#cbd5e1" />

      {/* Bloque QR escaneado */}
      <rect x="48" y="98" width="42" height="42" rx="6" fill="#fff" stroke="#0072bc" />
      <g fill="#042454">
        <rect x="54" y="104" width="10" height="10" rx="1.5" />
        <rect x="74" y="104" width="10" height="10" rx="1.5" />
        <rect x="54" y="124" width="10" height="10" rx="1.5" />
        <rect x="68" y="120" width="6" height="6" />
        <rect x="76" y="126" width="8" height="6" />
      </g>
      <line x1="46" y1="119" x2="92" y2="119" stroke="#e6007e" strokeWidth="2.5" strokeLinecap="round" />

      {/* Etiqueta SHA-256 / CVD */}
      <rect x="48" y="146" width="96" height="11" rx="4" fill="#eaf2ff" />
      <text x="96" y="154" textAnchor="middle" fontSize="6.8" fontWeight="800" fill="#042454" fontFamily="ui-monospace, monospace">CVD · SHA-256</text>

      {/* Escudo de integridad con engranaje Suiza */}
      <path d="M174 36l40 16v34c0 28-17 50-40 60-23-10-40-32-40-60V52z" fill="url(#cv-b)" stroke="#f9e000" strokeWidth="3" />
      <MiniSuizaCrest cx={174} cy={80} scale={1.1} />
      <circle cx="174" cy="120" r="14" fill="#16a34a" stroke="#fff" strokeWidth="2" />
      <path d="M167 120l4.5 4.5 9-9.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* 7. Mis Expedientes: portafolio ciudadano con progreso en 4 hitos y Cargo CUT */
export function MisExpedientesIllustration({ className = 'h-40 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} role="img" aria-label="Portafolio de expedientes ciudadanos con seguimiento de 4 pasos">
      <Defs id="me" />
      <ellipse cx="120" cy="174" rx="102" ry="8" fill="#031636" opacity="0.4" />

      {/* Carpeta principal */}
      <rect x="34" y="42" width="166" height="118" rx="14" fill="url(#me-w)" stroke="#bfd7fa" />
      <path d="M34 42h64l12-14h78a12 12 0 0 1 12 12v18H34z" fill="url(#me-b)" />
      <text x="72" y="46" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fef08a" fontFamily="system-ui">MIS TRÁMITES</text>
      <MiniSuizaCrest cx={176} cy={44} scale={0.68} />

      {/* Barra de 4 pasos */}
      <line x1="58" y1="84" x2="176" y2="84" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      <line x1="58" y1="84" x2="140" y2="84" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
      {[58, 97, 136, 175].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy="84" r="10" fill={i < 3 ? '#16a34a' : '#0072bc'} />
          <text x={x} y="88" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fff" fontFamily="system-ui">{i + 1}</text>
        </g>
      ))}

      {/* Tarjeta cargo descargable */}
      <rect x="52" y="108" width="130" height="36" rx="8" fill="#eaf2ff" stroke="#93c5fd" />
      <text x="64" y="124" fontSize="8.5" fontWeight="800" fill="#042454" fontFamily="ui-monospace, monospace">CARGO CUT · EXP-2026</text>
      <text x="64" y="136" fontSize="7.5" fontWeight="600" fill="#475569" fontFamily="system-ui">Ciudadano Verificado · Pucallpa</text>
      <circle cx="164" cy="126" r="10" fill="url(#me-g)" />
      <path d="M164 121v9m0 0l-3.5-3.5m3.5 3.5l3.5-3.5" stroke="#042454" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* 8. Casilla Electrónica: buzón oficial LPAG, sobre con cédula y campana de avisos */
export function CasillaIllustration({ className = 'h-40 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} role="img" aria-label="Casilla electrónica oficial LPAG con sobre de notificación y campana de alerta">
      <Defs id="cs" />
      <ellipse cx="120" cy="174" rx="102" ry="8" fill="#031636" opacity="0.4" />

      {/* Sobre oficial */}
      <rect x="34" y="54" width="152" height="102" rx="12" fill="url(#cs-w)" stroke="#93c5fd" />
      <path d="M34 62l76 52 76-52" fill="none" stroke="#0072bc" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="34" y="54" width="152" height="6" rx="3" fill="url(#cs-b)" />

      {/* Cédula asomando del sobre */}
      <rect x="52" y="24" width="116" height="58" rx="8" fill="#ffffff" stroke="#bfd7fa" />
      <rect x="64" y="34" width="66" height="5.5" rx="2.5" fill="#042454" />
      <rect x="64" y="46" width="84" height="4.5" rx="2" fill="#94a3b8" />
      <MiniSuizaCrest cx={148} cy={42} scale={0.75} />

      {/* Sello Acuse Legal */}
      <rect x="64" y="124" width="92" height="20" rx="6" fill="#042454" />
      <text x="110" y="137" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#fef08a" fontFamily="ui-monospace, monospace">ACUSE LPAG · ART. 20</text>

      {/* Campana de notificación */}
      <circle cx="192" cy="52" r="24" fill="url(#cs-g)" />
      <path d="M192 38a9 9 0 0 0-9 9v6l-3 4h24l-3-4v-6a9 9 0 0 0-9-9zm-3 22a3 3 0 0 0 6 0" fill="#042454" />
      <circle cx="208" cy="36" r="10" fill="url(#cs-m)" stroke="#fff" strokeWidth="2" />
      <text x="208" y="39.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff" fontFamily="system-ui">1</text>
    </svg>
  );
}
