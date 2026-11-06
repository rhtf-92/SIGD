import { useRef, type CSSProperties, type PointerEvent } from 'react';

import sigdLogoPrincipal from '../../assets/sigd-logo-3d.png';

type LogoSIGD3DVariant = 'login' | 'home' | 'section' | 'ambient';

type LogoStyle = CSSProperties & {
  '--logo-rx'?: string;
  '--logo-ry'?: string;
  '--logo-light-x'?: string;
  '--logo-light-y'?: string;
};

interface LogoSIGD3DProps {
  variant?: LogoSIGD3DVariant;
  className?: string;
  showHint?: boolean;
}

const initialStyle: LogoStyle = {
  '--logo-rx': '0deg',
  '--logo-ry': '0deg',
  '--logo-light-x': '50%',
  '--logo-light-y': '42%',
};

export default function LogoSIGD3D({
  variant = 'section',
  className = '',
  showHint = false,
}: LogoSIGD3DProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const isLogin = variant === 'login';

  function updatePerspective(event: PointerEvent<HTMLDivElement>) {
    if (
      isLogin
      || event.pointerType === 'touch'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

    stage.style.setProperty('--logo-ry', `${((x - 0.5) * 12).toFixed(2)}deg`);
    stage.style.setProperty('--logo-rx', `${((0.5 - y) * 10).toFixed(2)}deg`);
    stage.style.setProperty('--logo-light-x', `${(x * 100).toFixed(2)}%`);
    stage.style.setProperty('--logo-light-y', `${(y * 100).toFixed(2)}%`);
  }

  function resetPerspective() {
    const stage = stageRef.current;
    if (!stage || isLogin) return;
    stage.style.setProperty('--logo-rx', '0deg');
    stage.style.setProperty('--logo-ry', '0deg');
    stage.style.setProperty('--logo-light-x', '50%');
    stage.style.setProperty('--logo-light-y', '42%');
  }

  const classes = [
    'sigd-logo-3d',
    `sigd-logo-3d--${variant}`,
    isLogin ? 'sigd-auth__logo-stage' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={stageRef}
      className={classes}
      style={initialStyle}
      onPointerMove={updatePerspective}
      onPointerLeave={resetPerspective}
      aria-label="Identidad visual SIGD SUIZA"
    >
      <div
        className={isLogin
          ? 'sigd-auth__orbit sigd-auth__orbit--one'
          : 'sigd-logo-3d__orbit sigd-logo-3d__orbit--one'}
        aria-hidden="true"
      />
      <div
        className={isLogin
          ? 'sigd-auth__orbit sigd-auth__orbit--two'
          : 'sigd-logo-3d__orbit sigd-logo-3d__orbit--two'}
        aria-hidden="true"
      />
      <div
        className={isLogin ? 'sigd-auth__platform' : 'sigd-logo-3d__platform'}
        aria-hidden="true"
      />

      {isLogin ? (
        <img src={sigdLogoPrincipal} alt="Logotipo principal SIGD SUIZA" />
      ) : (
        <div className="sigd-logo-3d__model">
          <img
            className="sigd-logo-3d__image"
            src={sigdLogoPrincipal}
            alt="Logotipo principal SIGD SUIZA"
          />
        </div>
      )}

      {showHint ? <p>Mueve el cursor: el logo responde con profundidad 3D</p> : null}
    </div>
  );
}
