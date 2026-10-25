import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  GlassPanel,
  InfoCard,
  CapsuleBadge,
  InformationGlassPanel,
} from '../../../src/components/common/GlassPanel';
import { ShieldCheck, Scale } from 'lucide-react';

describe('GlassPanel & CapsuleBadge — Componentes visuales Liquid Glass', () => {
  it('renderiza GlassPanel con clases base translúcidas, reflejo especular y variantes correctas', () => {
    const { container } = render(
      <GlassPanel variant="aqua" className="test-panel">
        <p>Contenido del panel</p>
      </GlassPanel>
    );

    const panel = container.querySelector('.test-panel');
    expect(panel).toBeInTheDocument();
    expect(panel?.textContent).toBe('Contenido del panel');
    expect(panel?.className).toContain('backdrop-blur-md');
    expect(panel?.className).toContain('rounded-3xl');
  });

  it('renderiza CapsuleBadge en variantes public, role y approved con efecto cápsula', () => {
    render(
      <div>
        <CapsuleBadge variant="public" dot>Público</CapsuleBadge>
        <CapsuleBadge variant="role">Rol Directivo</CapsuleBadge>
        <CapsuleBadge variant="approved">Aprobado</CapsuleBadge>
      </div>
    );

    expect(screen.getByText('Público')).toBeInTheDocument();
    expect(screen.getByText('Rol Directivo')).toBeInTheDocument();
    expect(screen.getByText('Aprobado')).toBeInTheDocument();
  });

  it('renderiza InformationGlassPanel con icono, título, referencia legal y enlace CTA', () => {
    render(
      <MemoryRouter>
        <InformationGlassPanel
          icon={Scale}
          title="TUO de la Ley N° 27444"
          summary="Regula las garantías del debido procedimiento administrativo."
          legalReference="D.S. 006-2026-JUS"
          ctaText="Ver detalles"
          ctaHref="/transparencia/terminos"
          variant="legal"
        />
      </MemoryRouter>
    );

    expect(screen.getByText('TUO de la Ley N° 27444')).toBeInTheDocument();
    expect(screen.getByText(/Regula las garantías del debido procedimiento/)).toBeInTheDocument();
    expect(screen.getByText('D.S. 006-2026-JUS')).toBeInTheDocument();
    expect(screen.getByText('Ver detalles')).toBeInTheDocument();
  });

  it('renderiza InfoCard (compatibilidad)', () => {
    render(
      <MemoryRouter>
        <InfoCard
          icon={ShieldCheck}
          title="Principio de Confidencialidad"
          description="Los datos se encuentran protegidos conforme a ley."
          badge="Ley 29733"
          variant="emerald"
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Principio de Confidencialidad')).toBeInTheDocument();
    expect(screen.getByText('Los datos se encuentran protegidos conforme a ley.')).toBeInTheDocument();
    expect(screen.getByText('Ley 29733')).toBeInTheDocument();
  });
});
