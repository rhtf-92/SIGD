/**
 * Ilustración vectorial propia para el módulo "Consulta tu trámite".
 * Integra el engranaje tecnológico, aro carmesí-magenta y dorado del IESTP "Suiza"
 * de Pucallpa sobre un expediente con seguimiento CUT en vivo y lupa.
 */
export default function ConsultaCutIllustration({ className = '' }: { className?: string }) {
  const gearAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <svg
      viewBox="0 0 320 300"
      role="img"
      aria-label='Seguimiento de expediente del IESTP "Suiza" de Pucallpa con código CUT, etapas y lupa'
      className={className}
    >
      <defs>
        <linearGradient id="cc-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dbeafe" />
          <stop offset="1" stopColor="#f8fafc" />
        </linearGradient>
        <linearGradient id="cc-doc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#eef4ff" />
        </linearGradient>
        <linearGradient id="cc-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0072bc" />
          <stop offset="1" stopColor="#042454" />
        </linearGradient>
        <linearGradient id="cc-magenta" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f43f8e" />
          <stop offset="1" stopColor="#e6007e" />
        </linearGradient>
        <linearGradient id="cc-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde047" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <filter id="cc-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#042454" floodOpacity="0.2" />
        </filter>
      </defs>

      {/* Fondo circular */}
      <circle cx="160" cy="150" r="128" fill="url(#cc-bg)" />
      <circle cx="160" cy="150" r="128" fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="4 6" />
      <circle cx="160" cy="150" r="112" fill="none" stroke="#e6007e" strokeOpacity="0.18" strokeWidth="1.5" />

      {/* Destellos */}
      <g fill="#f9e000">
        <circle cx="58" cy="72" r="4" className="animate-pulse" />
        <circle cx="268" cy="96" r="3.5" className="animate-pulse" />
        <circle cx="256" cy="238" r="4" className="animate-pulse" />
      </g>
      <g fill="#e6007e">
        <circle cx="48" cy="198" r="3" className="animate-pulse" />
        <circle cx="240" cy="54" r="2.5" className="animate-pulse" />
      </g>

      {/* Documento / expediente */}
      <g filter="url(#cc-shadow)">
        <rect x="86" y="48" width="152" height="196" rx="14" fill="url(#cc-doc)" stroke="#bfd7fa" />
        <path d="M208 48h16a14 14 0 0 1 14 14v16l-30-30z" fill="#dbeafe" />
      </g>

      {/* Cabecera azul Suiza con engranaje mini */}
      <rect x="86" y="48" width="152" height="36" rx="14" fill="url(#cc-blue)" />
      <rect x="86" y="70" width="152" height="14" fill="url(#cc-blue)" />
      <rect x="86" y="83" width="152" height="2.5" fill="url(#cc-magenta)" />

      {/* Escudo engranaje mini */}
      <g transform="translate(108, 66) scale(0.85)">
        <g fill="#ffffff">
          {gearAngles.map((a) => (
            <rect key={a} x="-2.2" y="-13" width="4.4" height="5" rx="1" transform={`rotate(${a})`} />
          ))}
          <circle cx="0" cy="0" r="10" />
        </g>
        <circle cx="0" cy="0" r="7.5" fill="#042454" />
        <circle cx="0" cy="0" r="6" fill="none" stroke="#e6007e" strokeWidth="1.4" />
        <path d="M0 -4.5c1.6 1.8 2.2 3.4 0 5.2-2.2-1.8-1.6-3.4 0-5.2z" fill="#f9e000" />
      </g>
      <text x="170" y="69.5" textAnchor="middle" fontFamily="system-ui" fontSize="9.5" fontWeight="900" fill="#fef08a">
        IESTP SUIZA · PUCALLPA
      </text>

      {/* Código CUT */}
      <rect x="100" y="96" width="124" height="24" rx="7" fill="#eaf2ff" stroke="#0072bc" />
      <text x="162" y="112" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="800" fill="#042454">
        EXP-2026-000123
      </text>

      {/* Línea de seguimiento 3 etapas */}
      <g>
        <line x1="116" y1="140" x2="116" y2="214" stroke="#cfe0fb" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="116" y1="140" x2="116" y2="186" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" />

        <circle cx="116" cy="140" r="8" fill="#16a34a" />
        <path d="M112 140l3 3 5-5.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="132" y="135" width="76" height="5" rx="2.5" fill="#042454" opacity="0.85" />
        <rect x="132" y="144" width="50" height="4" rx="2" fill="#94a3b8" />

        <circle cx="116" cy="170" r="8" fill="#16a34a" />
        <path d="M112 170l3 3 5-5.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="132" y="165" width="66" height="5" rx="2.5" fill="#042454" opacity="0.85" />
        <rect x="132" y="174" width="56" height="4" rx="2" fill="#94a3b8" />

        <circle cx="116" cy="200" r="8" fill="#0072bc" />
        <circle cx="116" cy="200" r="13" fill="none" stroke="#e6007e" strokeWidth="1.8" opacity="0.5" className="animate-ping" style={{ transformOrigin: '116px 200px' }} />
        <circle cx="116" cy="200" r="3" fill="#f9e000" />
        <rect x="132" y="195" width="80" height="5" rx="2.5" fill="#0072bc" />
        <rect x="132" y="204" width="44" height="4" rx="2" fill="#60a5fa" />
      </g>

      {/* Sello oficial dorado */}
      <g transform="rotate(-14 218 220)">
        <circle cx="218" cy="220" r="22" fill="url(#cc-gold)" stroke="#e6007e" strokeWidth="2" />
        <circle cx="218" cy="220" r="16" fill="none" stroke="#fff7d6" strokeWidth="1.5" strokeDasharray="2 3" />
        <path d="M209 220l6 6 11-12" stroke="#042454" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Lupa institucional */}
      <g filter="url(#cc-shadow)">
        <circle cx="84" cy="198" r="30" fill="#ffffff" fillOpacity="0.65" stroke="url(#cc-blue)" strokeWidth="8" />
        <path d="M62 190a24 24 0 0 1 14-12" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.9" />
        <line x1="106" y1="220" x2="132" y2="246" stroke="url(#cc-magenta)" strokeWidth="11" strokeLinecap="round" />
      </g>
    </svg>
  );
}
