interface SelloInstitucionalProps {
  className?: string;
  /** Texto alternativo; por defecto anuncia el emblema del SIGD. */
  etiqueta?: string;
}

/**
 * Emblema institucional del SIGD.
 *
 * Sobrio y monocromo: un aro de tinta con filete interior y un disco azul
 * institucional que encierra el símbolo del archivo (hoja con esquina
 * doblada). Un solo color, coherente con el resto del sistema.
 */
export default function SelloInstitucional({
  className = "h-11 w-11",
  etiqueta = "Sello institucional SIGD",
}: SelloInstitucionalProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={etiqueta}
    >
      {/* Aro exterior */}
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Filete interior */}
      <circle
        cx="32"
        cy="32"
        r="25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.45"
      />

      {/* Disco azul institucional */}
      <circle cx="32" cy="32" r="20" fill="#006EC7" />

      {/* Hoja archivada con esquina doblada */}
      <path
        d="M24 21.5h9.6L39 26.9V44a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 23 44V23a1.5 1.5 0 0 1 1-1.5Z"
        fill="#FFFFFF"
      />
      <path d="M33.6 21.5 39 26.9h-4.1a1.3 1.3 0 0 1-1.3-1.3Z" fill="#C9DCEA" />
      <g
        stroke="#006EC7"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.85"
      >
        <line x1="27" y1="31.5" x2="35" y2="31.5" />
        <line x1="27" y1="35.4" x2="35" y2="35.4" />
        <line x1="27" y1="39.3" x2="32" y2="39.3" />
      </g>
    </svg>
  );
}
