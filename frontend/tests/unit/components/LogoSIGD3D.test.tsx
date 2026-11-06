import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AnimatedUniverseBackground from '../../../src/components/common/AnimatedUniverseBackground';
import LogoSIGD3D from '../../../src/components/common/LogoSIGD3D';

describe('LogoSIGD3D', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reutiliza el logo institucional y responde al puntero sin perder su identidad', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    render(<LogoSIGD3D variant="section" />);

    const stage = screen.getByLabelText('Identidad visual SIGD SUIZA');
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 160,
      width: 200,
      height: 160,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(stage, { clientX: 180, clientY: 24, pointerType: 'mouse' });

    expect(stage.style.getPropertyValue('--logo-ry')).toBe('4.80deg');
    expect(stage.style.getPropertyValue('--logo-rx')).toBe('3.50deg');
    expect(screen.getByAltText('Logotipo principal SIGD SUIZA')).toHaveAttribute(
      'src',
      expect.stringContaining('sigd-logo-3d.png'),
    );

    fireEvent.pointerLeave(stage);
    expect(stage.style.getPropertyValue('--logo-ry')).toBe('0deg');
    expect(stage.style.getPropertyValue('--logo-rx')).toBe('0deg');
  });

  it('respeta la preferencia de movimiento reducido', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    render(<LogoSIGD3D variant="home" />);

    const stage = screen.getByLabelText('Identidad visual SIGD SUIZA');
    fireEvent.pointerMove(stage, { clientX: 180, clientY: 24, pointerType: 'mouse' });

    expect(stage.style.getPropertyValue('--logo-rx')).toBe('0deg');
    expect(stage.style.getPropertyValue('--logo-ry')).toBe('0deg');
  });

  it('sustituye el círculo decorativo sin superponer ambos elementos', () => {
    const { container } = render(
      <AnimatedUniverseBackground orbReplacement={<LogoSIGD3D variant="ambient" />}>
        <p>Contenido</p>
      </AnimatedUniverseBackground>,
    );

    expect(container.querySelector('.sigd-universe-orb')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.sigd-universe-logo-slot')).toHaveLength(1);
    expect(screen.getAllByAltText('Logotipo principal SIGD SUIZA')).toHaveLength(1);

    const universe = container.querySelector<HTMLElement>('.sigd-universe-bg');
    expect(universe).not.toBeNull();
    vi.spyOn(universe!, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
      toJSON: () => ({}),
    });
    fireEvent.pointerMove(universe!, { clientX: 800, clientY: 160, pointerType: 'mouse' });
    expect(universe!.style.getPropertyValue('--universe-ry')).toBe('2.10deg');
    expect(universe!.style.getPropertyValue('--universe-rx')).toBe('1.80deg');
  });
});
