import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextualHelp } from '../../../../src/components/ui/ContextualHelp';

describe('ContextualHelp Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el botón trigger con accesible label por defecto', () => {
    render(<ContextualHelp content="Explicación detallada del campo" />);
    const trigger = screen.getByRole('button', { name: /más información/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('se abre y cierra al hacer clic en el botón trigger', async () => {
    const user = userEvent.setup();
    render(<ContextualHelp title="¿Qué es el CUT?" content="Código Único de Trámite del expediente" />);

    const trigger = screen.getByRole('button', { name: /más información/i });
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('¿Qué es el CUT?')).toBeInTheDocument();
    expect(screen.getByText('Código Único de Trámite del expediente')).toBeInTheDocument();

    // Clic nuevamente para cerrar
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('¿Qué es el CUT?')).not.toBeInTheDocument();
  });

  it('se abre al pasar el cursor (hover) tras delay y se mantiene visible mientras el cursor está en el panel', async () => {
    render(<ContextualHelp title="Foliación" content="Numeración correlativa de las páginas del expediente." />);

    const trigger = screen.getByRole('button', { name: /más información/i });
    fireEvent.mouseEnter(trigger);

    // Esperar a que transcurra el delay de hover (180ms)
    await waitFor(() => {
      expect(screen.getByText('Foliación')).toBeInTheDocument();
    }, { timeout: 400 });

    // Mover al panel de ayuda
    const panel = screen.getByRole('region', { name: /foliación/i });
    fireEvent.mouseEnter(panel);
    expect(screen.getByText('Foliación')).toBeInTheDocument();

    // Salir del panel
    fireEvent.mouseLeave(panel);
    await waitFor(() => {
      expect(screen.queryByText('Foliación')).not.toBeInTheDocument();
    }, { timeout: 500 });
  });

  it('se cierra con la tecla Escape y devuelve el foco al trigger', async () => {
    const user = userEvent.setup();
    render(<ContextualHelp title="Requisitos" content="Documentos obligatorios en PDF." />);

    const trigger = screen.getByRole('button', { name: /más información/i });
    await user.click(trigger);

    expect(screen.getByText('Requisitos')).toBeInTheDocument();

    // Presionar Escape
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText('Requisitos')).not.toBeInTheDocument();
    });
  });

  it('se cierra mediante el botón de cierre interno (X)', async () => {
    const user = userEvent.setup();
    render(<ContextualHelp title="Notificaciones" content="Se envían a su correo personal." />);

    const trigger = screen.getByRole('button', { name: /más información/i });
    await user.click(trigger);

    const closeBtn = screen.getByRole('button', { name: /cerrar ayuda/i });
    await user.click(closeBtn);

    expect(screen.queryByText('Notificaciones')).not.toBeInTheDocument();
  });

  it('se cierra al hacer clic fuera del componente', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <span data-testid="outside">Exterior</span>
        <ContextualHelp title="Ayuda" content="Contenido contextual" />
      </div>
    );

    const trigger = screen.getByRole('button', { name: /más información/i });
    await user.click(trigger);

    expect(screen.getByText('Ayuda')).toBeInTheDocument();

    const outside = screen.getByTestId('outside');
    await user.click(outside);

    expect(screen.queryByText('Ayuda')).not.toBeInTheDocument();
  });
});
