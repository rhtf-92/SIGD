import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

const PARTICULAS = [
  [4, 16, 1, 0], [11, 68, 2, 1.4], [18, 35, 1, 2.7], [26, 81, 1.5, 0.8],
  [34, 12, 1, 3.3], [42, 53, 2, 1.9], [49, 88, 1, 0.4], [58, 22, 1.5, 2.2],
  [64, 71, 1, 3.7], [72, 42, 2, 1.1], [79, 84, 1.5, 2.9], [86, 17, 1, 0.6],
  [92, 58, 2, 2.5], [97, 31, 1, 1.7], [7, 92, 1.5, 3.1], [53, 6, 1, 1.3],
] as const;

type UniverseStyle = CSSProperties & {
  "--universe-x"?: string;
  "--universe-y"?: string;
  "--universe-rx"?: string;
  "--universe-ry"?: string;
};

interface AnimatedUniverseBackgroundProps {
  children?: ReactNode;
  compact?: boolean;
  orbReplacement?: ReactNode;
}

export default function AnimatedUniverseBackground({
  children,
  compact = false,
  orbReplacement,
}: AnimatedUniverseBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    rootRef.current.style.setProperty("--universe-x", `${(x * 100).toFixed(2)}%`);
    rootRef.current.style.setProperty("--universe-y", `${(y * 100).toFixed(2)}%`);
    rootRef.current.style.setProperty("--universe-ry", `${((x - 0.5) * 7).toFixed(2)}deg`);
    rootRef.current.style.setProperty("--universe-rx", `${((0.5 - y) * 6).toFixed(2)}deg`);
  }

  function resetPointer() {
    const root = rootRef.current;
    if (!root) return;
    root.style.setProperty("--universe-x", "50%");
    root.style.setProperty("--universe-y", "30%");
    root.style.setProperty("--universe-rx", "0deg");
    root.style.setProperty("--universe-ry", "0deg");
  }

  const style: UniverseStyle = {
    "--universe-x": "50%",
    "--universe-y": "30%",
    "--universe-rx": "0deg",
    "--universe-ry": "0deg",
  };

  return (
    <div
      ref={rootRef}
      className={`sigd-universe-bg${compact ? " sigd-universe-bg--compact" : ""}`}
      style={style}
      onPointerMove={onPointerMove}
      onPointerLeave={resetPointer}
    >
      <div className="sigd-universe-grid" aria-hidden="true" />
      <div className="sigd-universe-pointer" aria-hidden="true" />
      <div className="sigd-universe-particles" aria-hidden="true">
        {PARTICULAS.map(([left, top, size, delay]) => (
          <span
            key={`${left}-${top}`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>
      {orbReplacement ? (
        <div className="sigd-universe-logo-slot">{orbReplacement}</div>
      ) : (
        <div className="sigd-universe-orb" aria-hidden="true">
          <span className="sigd-universe-ring sigd-universe-ring--one" />
          <span className="sigd-universe-ring sigd-universe-ring--two" />
          <span className="sigd-universe-ring sigd-universe-ring--three" />
          <span className="sigd-universe-sphere" />
        </div>
      )}
      <div className="sigd-universe-waves" aria-hidden="true"><span /><span /><span /></div>
      <div className="sigd-universe-content">{children}</div>
    </div>
  );
}
