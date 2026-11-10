const LOGO_SRC = new URL(
  "../../assets/LOGOS ACTUALES/EDITADO 01 .jpg",
  import.meta.url,
).href;

interface Logo3DProps {
  size?: number;
  showRings?: boolean;
  className?: string;
  src?: string;
  alt?: string;
  estatico?: boolean;
}

/**
 * Emblema institucional en 3D.
 *
 * Se construye con CSS 3D (sin dependencias nuevas): anillos orbitales, halo
 * celeste y un núcleo de vidrio claro. La rotación y la flotación son
 * completamente automáticas; no reacciona al cursor.
 */
export default function Logo3D({
  size = 180,
  showRings = true,
  className = "",
  src = LOGO_SRC,
  alt = "Escudo institucional IESTP Público Suiza",
  estatico = false,
}: Logo3DProps) {
  return (
    <div
      className={`sigd-logo3d ${estatico ? "sigd-logo3d--estatico" : ""} ${className}`}
      style={{ width: size, height: size, perspective: `${size * 4}px` }}
      aria-hidden="true"
    >
      <div className="sigd-logo3d-scene">
        <div className="sigd-logo3d-float">
          <div className="sigd-logo3d-halo" />

          {showRings && (
            <>
              <div className="sigd-logo3d-ring-wrap" style={{ transform: "rotateX(72deg)" }}>
                <div
                  className="sigd-logo3d-ring"
                  style={{ animation: "sigd-orbit-z 13s linear infinite" }}
                />
              </div>
              <div className="sigd-logo3d-ring-wrap" style={{ transform: "rotateY(70deg)" }}>
                <div
                  className="sigd-logo3d-ring"
                  style={{ animation: "sigd-orbit-z 17s linear infinite reverse" }}
                />
              </div>
              <div
                className="sigd-logo3d-ring-wrap"
                style={{ transform: "rotateX(28deg) rotateY(28deg)" }}
              >
                <div
                  className="sigd-logo3d-ring sigd-logo3d-ring--neon"
                  style={{ animation: "sigd-orbit-z 9s linear infinite" }}
                />
              </div>
              <div
                className="sigd-logo3d-ring-wrap"
                style={{ transform: "rotateX(-18deg) rotateY(62deg)" }}
              >
                <div
                  className="sigd-logo3d-ring"
                  style={{ animation: "sigd-orbit-z 21s linear infinite reverse" }}
                />
              </div>
            </>
          )}

          <div className="sigd-logo3d-core">
            <img src={src} alt={alt} className="sigd-logo3d-image" draggable={false} />
            <span className="sigd-logo3d-sheen" />
          </div>

          <span className="sigd-logo3d-spark" style={{ top: "6%", left: "18%" }} />
          <span
            className="sigd-logo3d-spark"
            style={{ bottom: "12%", right: "10%", animationDelay: "1.4s" }}
          />
          <span
            className="sigd-logo3d-spark"
            style={{ top: "30%", right: "2%", animationDelay: "2.6s" }}
          />
          <span
            className="sigd-logo3d-spark"
            style={{ bottom: "20%", left: "6%", animationDelay: "0.7s" }}
          />
          <span
            className="sigd-logo3d-spark"
            style={{ top: "4%", right: "26%", animationDelay: "1.9s" }}
          />
        </div>
      </div>
    </div>
  );
}
