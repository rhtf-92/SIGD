/**
 * Ilustración vectorial propia para el módulo "Consulta tu trámite".
 * Muestra un expediente con sello de validez, lupa de búsqueda y línea de
 * seguimiento por etapas. Paleta institucional (azul IESTP Suiza + dorado).
 */
export default function ConsultaCutIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 300"
      role="img"
      aria-label="Seguimiento de expediente: documento con sello oficial, lupa y etapas del trámite"
      className={className}
    >
      <defs>
        <linearGradient id="cc-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0edff" />
          <stop offset="1" stopColor="#f5f9ff" />
        </linearGradient>
        <linearGradient id="cc-doc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#eef4ff" />
        </linearGradient>
        <linearGradient id="cc-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b4f9e" />
          <stop offset="1" stopColor="#0a2f6b" />
        </linearGradient>
        <linearGradient id="cc-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <filter id="cc-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0a2f6b" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* Fondo circular */}
      <circle cx="160" cy="150" r="128" fill="url(#cc-bg)" />
      <circle cx="160" cy="150" r="128" fill="none" stroke="#bfd6fb" strokeWidth="1.5" strokeDasharray="4 6" />

      {/* Destellos decorativos */}
      <g fill="#fbbf24">
        <circle cx="60" cy="70" r="4" className="animate-pulse" />
        <circle cx="268" cy="96" r="3" className="animate-pulse" />
        <circle cx="258" cy="236" r="4" className="animate-pulse" />
      </g>
      <g fill="#60a5fa">
        <circle cx="48" cy="198" r="3" className="animate-pulse" />
        <circle cx="94" cy="262" r="2.5" className="animate-pulse" />
      </g>

      {/* Documento / expediente */}
      <g filter="url(#cc-shadow)">
        <rect x="88" y="52" width="148" height="190" rx="14" fill="url(#cc-doc)" stroke="#c7d9f5" />
        <path d="M206 52h16a14 14 0 0 1 14 14v16l-30-30z" fill="#dbe8ff" />
      </g>

      {/* Cabecera del documento */}
      <rect x="88" y="52" width="148" height="34" rx="14" fill="url(#cc-blue)" />
      <rect x="88" y="72" width="148" height="14" fill="url(#cc-blue)" />
      <circle cx="108" cy="69" r="8" fill="#ffffff" opacity="0.95" />
      <path d="M104 69l3 3 6-6" stroke="#0b4f9e" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="123" y="63" width="70" height="5" rx="2.5" fill="#ffffff" opacity="0.9" />
      <rect x="123" y="72" width="46" height="4" rx="2" fill="#93c5fd" />

      {/* Código CUT */}
      <rect x="102" y="98" width="120" height="22" rx="6" fill="#eaf2ff" stroke="#c7d9f5" />
      <text x="162" y="113" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10.5" fontWeight="700" fill="#0a2f6b">
        EXP-2026-000123
      </text>

      {/* Línea de seguimiento */}
      <g>
        <line x1="116" y1="140" x2="116" y2="214" stroke="#cfe0fb" strokeWidth="3" strokeLinecap="round" />
        <line x1="116" y1="140" x2="116" y2="186" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />

        <circle cx="116" cy="140" r="8" fill="#16a34a" />
        <path d="M112 140l3 3 5-5.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="132" y="135" width="72" height="5" rx="2.5" fill="#334155" opacity="0.8" />
        <rect x="132" y="144" width="48" height="4" rx="2" fill="#94a3b8" />

        <circle cx="116" cy="170" r="8" fill="#16a34a" />
        <path d="M112 170l3 3 5-5.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="132" y="165" width="64" height="5" rx="2.5" fill="#334155" opacity="0.8" />
        <rect x="132" y="174" width="54" height="4" rx="2" fill="#94a3b8" />

        <circle cx="116" cy="200" r="8" fill="#0b4f9e" />
        <circle cx="116" cy="200" r="13" fill="none" stroke="#0b4f9e" strokeWidth="1.5" opacity="0.35" className="animate-ping" style={{ transformOrigin: '116px 200px' }} />
        <circle cx="116" cy="200" r="3" fill="#fff" />
        <rect x="132" y="195" width="78" height="5" rx="2.5" fill="#0a2f6b" />
        <rect x="132" y="204" width="40" height="4" rx="2" fill="#60a5fa" />
      </g>

      {/* Sello oficial dorado */}
      <g transform="rotate(-14 214 218)">
        <circle cx="214" cy="218" r="22" fill="url(#cc-gold)" />
        <circle cx="214" cy="218" r="17" fill="none" stroke="#fff7d6" strokeWidth="1.5" strokeDasharray="2 3" />
        <path d="M205 218l6 6 11-12" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Lupa */}
      <g filter="url(#cc-shadow)">
        <circle cx="86" cy="196" r="30" fill="#ffffff" fillOpacity="0.55" stroke="url(#cc-blue)" strokeWidth="8" />
        <path d="M64 188a24 24 0 0 1 14-12" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.9" />
        <line x1="108" y1="218" x2="132" y2="244" stroke="url(#cc-blue)" strokeWidth="11" strokeLinecap="round" />
      </g>
    </svg>
  );
}
