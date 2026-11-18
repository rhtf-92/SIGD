import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/* Banner de módulo reutilizable (estilo institucional IESTP "Suiza")  */
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
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a2f6b] via-[#0b4f9e] to-[#1473d6] text-white shadow-md">
      <div className="pointer-events-none absolute -right-12 -top-16 h-60 w-60 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute left-1/3 -bottom-20 h-44 w-44 rounded-full bg-amber-300/10" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-1.5 w-full bg-gradient-to-r from-amber-300 via-amber-400 to-transparent" />

      <div className="relative flex flex-col gap-4 px-6 py-6 sm:px-9 sm:py-8 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            {eyebrow}
          </span>
          <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-xs text-blue-100 sm:text-sm">{subtitle}</p>}
          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="flex justify-center shrink-0">{illustration}</div>
      </div>

      {footer && <div className="relative border-t border-white/15 bg-black/10 px-6 py-3 sm:px-9">{footer}</div>}
    </section>
  );
}

const Defs = ({ id }: { id: string }) => (
  <defs>
    <linearGradient id={`${id}-w`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="1" stopColor="#dbe9ff" />
    </linearGradient>
    <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#fde68a" />
      <stop offset="1" stopColor="#f59e0b" />
    </linearGradient>
    <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#3b8bea" />
      <stop offset="1" stopColor="#0a2f6b" />
    </linearGradient>
  </defs>
);

/* Ventanilla presencial: mostrador con atención al ciudadano y ticket QR */
export function VentanillaIllustration({ className = 'h-40 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} role="img" aria-label="Mostrador de ventanilla con ticket y código QR">
      <Defs id="vp" />
      <ellipse cx="120" cy="172" rx="104" ry="9" fill="#04204d" opacity="0.35" />
      {/* Ventanilla */}
      <rect x="28" y="26" width="150" height="110" rx="12" fill="#eaf3ff" opacity="0.95" />
      <rect x="38" y="36" width="130" height="78" rx="8" fill="#b9d6fb" />
      <rect x="38" y="36" width="130" height="78" rx="8" fill="url(#vp-b)" opacity="0.25" />
      {/* Funcionario */}
      <circle cx="103" cy="66" r="14" fill="#fcd9b6" />
      <path d="M78 114c0-16 11-27 25-27s25 11 25 27z" fill="#0a2f6b" />
      <path d="M98 88l5 12 5-12" fill="#fff" />
      <path d="M90 60c2-12 24-14 27 0-8-5-18-5-27 0z" fill="#3a2a1a" />
      {/* Mostrador */}
      <rect x="20" y="114" width="166" height="24" rx="6" fill="url(#vp-g)" />
      <rect x="20" y="114" width="166" height="6" rx="3" fill="#fff" opacity="0.5" />
      <rect x="28" y="138" width="150" height="26" rx="5" fill="#0a2f6b" />
      {/* Sello */}
      <rect x="44" y="100" width="22" height="14" rx="3" fill="#dc2626" />
      <rect x="51" y="92" width="8" height="9" rx="2" fill="#7f1d1d" />
      {/* Ticket con QR */}
      <g transform="rotate(8 190 112)">
        <rect x="160" y="64" width="62" height="86" rx="8" fill="url(#vp-w)" stroke="#c7d9f5" />
        <rect x="168" y="72" width="46" height="6" rx="3" fill="#0b4f9e" />
        <rect x="168" y="82" width="30" height="4" rx="2" fill="#94a3b8" />
        <g fill="#0a2f6b">
          <rect x="172" y="94" width="14" height="14" rx="2" />
          <rect x="190" y="94" width="14" height="14" rx="2" />
          <rect x="172" y="112" width="14" height="14" rx="2" />
          <rect x="190" y="112" width="6" height="6" />
          <rect x="198" y="120" width="6" height="6" />
          <rect x="190" y="120" width="6" height="6" />
        </g>
        <g fill="#fff">
          <rect x="175" y="97" width="8" height="8" rx="1" />
          <rect x="193" y="97" width="8" height="8" rx="1" />
          <rect x="175" y="115" width="8" height="8" rx="1" />
        </g>
        <rect x="168" y="134" width="46" height="5" rx="2.5" fill="url(#vp-g)" />
      </g>
      <circle cx="30" cy="22" r="4" fill="#fbbf24" className="animate-pulse" />
      <circle cx="218" cy="34" r="3" fill="#93c5fd" className="animate-pulse" />
    </svg>
  );
}

/* Bandeja de expedientes: bandeja con carpetas y flecha de derivación */
export function BandejaIllustration({ className = 'h-40 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} role="img" aria-label="Bandeja con expedientes y derivación a áreas">
      <Defs id="bj" />
      <ellipse cx="116" cy="172" rx="100" ry="9" fill="#04204d" opacity="0.35" />
      {/* Carpetas */}
      <g>
        <rect x="52" y="34" width="100" height="74" rx="8" fill="#fcd34d" />
        <rect x="52" y="34" width="38" height="12" rx="6" fill="#f59e0b" />
        <rect x="66" y="48" width="100" height="74" rx="8" fill="#93c5fd" />
        <rect x="66" y="48" width="38" height="12" rx="6" fill="#60a5fa" />
        <rect x="80" y="62" width="100" height="74" rx="8" fill="url(#bj-w)" stroke="#c7d9f5" />
        <rect x="80" y="62" width="38" height="12" rx="6" fill="#3b8bea" />
        <rect x="94" y="84" width="60" height="6" rx="3" fill="#0b4f9e" />
        <rect x="94" y="96" width="44" height="5" rx="2.5" fill="#94a3b8" />
        <rect x="94" y="107" width="52" height="5" rx="2.5" fill="#cbd5e1" />
      </g>
      {/* Bandeja */}
      <path d="M36 128h128l16 34a8 8 0 0 1-7 12H27a8 8 0 0 1-7-12z" fill="url(#bj-b)" />
      <path d="M44 138h112" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
      {/* Derivación */}
      <g>
        <circle cx="200" cy="64" r="24" fill="url(#bj-g)" />
        <path d="M188 64h22m0 0l-8-8m8 8l-8 8" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
      {/* Contador */}
      <g>
        <circle cx="168" cy="40" r="11" fill="#ef4444" />
        <text x="168" y="44.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="system-ui">3</text>
      </g>
      <circle cx="26" cy="40" r="3.5" fill="#fbbf24" className="animate-pulse" />
      <circle cx="224" cy="120" r="3" fill="#93c5fd" className="animate-pulse" />
    </svg>
  );
}

/* Catálogo TUPA: libro de procedimientos con etiquetas de costo y plazo */
export function CatalogoIllustration({ className = 'h-40 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} role="img" aria-label="Catálogo de procedimientos con costos y plazos">
      <Defs id="ct" />
      <ellipse cx="118" cy="174" rx="102" ry="9" fill="#04204d" opacity="0.35" />
      {/* Libro abierto */}
      <path d="M118 52C98 38 62 38 36 46v110c26-8 62-8 82 6z" fill="url(#ct-w)" stroke="#c7d9f5" />
      <path d="M118 52c20-14 56-14 82-6v110c-26-8-62-8-82 6z" fill="#f4f8ff" stroke="#c7d9f5" />
      <path d="M118 52v110" stroke="#9dbfee" strokeWidth="2" />
      {/* Líneas página izquierda */}
      <g fill="#0b4f9e">
        <rect x="50" y="62" width="52" height="6" rx="3" />
      </g>
      <g fill="#cbd5e1">
        <rect x="50" y="76" width="56" height="5" rx="2.5" />
        <rect x="50" y="88" width="46" height="5" rx="2.5" />
        <rect x="50" y="100" width="52" height="5" rx="2.5" />
        <rect x="50" y="112" width="38" height="5" rx="2.5" />
      </g>
      {/* Checks página derecha */}
      <g>
        <circle cx="140" cy="70" r="7" fill="#16a34a" />
        <path d="M136.5 70l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="152" y="66" width="34" height="5" rx="2.5" fill="#64748b" />
        <circle cx="140" cy="94" r="7" fill="#16a34a" />
        <path d="M136.5 94l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="152" y="90" width="28" height="5" rx="2.5" fill="#64748b" />
        <circle cx="140" cy="118" r="7" fill="#0b4f9e" />
        <circle cx="140" cy="118" r="2.5" fill="#fff" />
        <rect x="152" y="114" width="32" height="5" rx="2.5" fill="#64748b" />
      </g>
      {/* Etiqueta de costo */}
      <g transform="rotate(-10 190 40)">
        <path d="M168 24h40l14 16-14 16h-40z" fill="url(#ct-g)" />
        <circle cx="176" cy="40" r="3" fill="#fff" />
        <text x="196" y="45" textAnchor="middle" fontSize="13" fontWeight="800" fill="#7c2d12" fontFamily="system-ui">S/</text>
      </g>
      {/* Reloj de plazo */}
      <g>
        <circle cx="44" cy="142" r="20" fill="url(#ct-b)" />
        <circle cx="44" cy="142" r="15" fill="#fff" />
        <path d="M44 132v10l7 5" stroke="#0a2f6b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
      <circle cx="222" cy="100" r="3.5" fill="#fbbf24" className="animate-pulse" />
      <circle cx="20" cy="70" r="3" fill="#93c5fd" className="animate-pulse" />
    </svg>
  );
}
