import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import CvdVerificationResult from '@/components/validador/CvdVerificationResult';

it('muestra solamente evidencia CVD persistida cuando no existen metadatos del documento', () => {
  render(<CvdVerificationResult resultado={{
    esValido: true,
    cvd: 'CVD-2026-RD-000412-892F',
    documento: null,
    selloTiempoTsa: '2026-10-24T13:00:00Z',
    mensajeSeguridad: 'Existe un registro de firma digital vigente para este CVD en SIGD.',
    evidencia: { firmante: 'Firmante Persistido', hashSha256: 'a'.repeat(64), fechaSelloTsa: '2026-10-24T13:00:00Z' },
  }} />);
  expect(screen.getByText('Firmante Persistido')).toBeInTheDocument();
  expect(screen.getByText('a'.repeat(64))).toBeInTheDocument();
  expect(screen.queryByText(/RD N.°/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Descargar copia auténtica/i })).not.toBeInTheDocument();
});
