import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReasignarMasivoModal from '@/components/expedientes/ReasignarMasivoModal';
import * as evaluadoresApi from '@/api/evaluadoresApi';
import type { DocenteElegible, ReasignacionMasivaResultado } from '@/types/expediente';

vi.mock('@/api/evaluadoresApi', () => ({
  listarDocentesElegibles: vi.fn(),
  reasignarMasivo: vi.fn(),
}));

const mockDocentes: DocenteElegible[] = [
  {
    idUsuario: 'doc-uuid-1',
    nombreCompleto: 'Prof. Carlos Mendoza',
    correo: 'cmendoza@iestpsuiza.edu.pe',
    rol: 'DOCENTE',
    areaId: 'area-sistemas-uuid',
  },
  {
    idUsuario: 'doc-uuid-2',
    nombreCompleto: 'Dra. Elena Ramos',
    correo: 'eramos@iestpsuiza.edu.pe',
    rol: 'DOCENTE',
    areaId: 'area-sistemas-uuid',
  },
];

const mockExpedientes = [
  { idExpediente: 'exp-uuid-1', cut: 'EXP-2026-001', asunto: 'Trámite de Titulación' },
  { idExpediente: 'exp-uuid-2', cut: 'EXP-2026-002', asunto: 'Convalidación de Asignatura' },
];

describe('ReasignarMasivoModal — Componente de Reasignación en Lote', () => {
  const onExitoMock = vi.fn();
  const onCerrarMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(evaluadoresApi.listarDocentesElegibles).mockResolvedValue(mockDocentes);
  });

  it('renderiza la lista de expedientes seleccionados y carga docentes elegibles', async () => {
    render(
      <ReasignarMasivoModal
        expedientes={mockExpedientes}
        areaId="area-sistemas-uuid"
        onExito={onExitoMock}
        onCerrar={onCerrarMock}
      />,
    );

    expect(screen.getByText(/Reasignación Masiva de Expedientes/i)).toBeInTheDocument();
    expect(screen.getByText(/2 expediente\(s\) seleccionado\(s\) para reasignar/i)).toBeInTheDocument();
    expect(screen.getByText('EXP-2026-001')).toBeInTheDocument();
    expect(screen.getByText('EXP-2026-002')).toBeInTheDocument();

    await waitFor(() => {
      expect(evaluadoresApi.listarDocentesElegibles).toHaveBeenCalledWith('area-sistemas-uuid');
    });

    const select = screen.getByLabelText(/Nuevo Docente Evaluador Elegible/i) as HTMLSelectElement;
    expect(select.value).toBe('doc-uuid-1');
  });

  it('exige una justificación de al menos 10 caracteres tras trim() antes de continuar', async () => {
    render(
      <ReasignarMasivoModal
        expedientes={mockExpedientes}
        areaId="area-sistemas-uuid"
        onExito={onExitoMock}
        onCerrar={onCerrarMock}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Nuevo Docente Evaluador Elegible/i)).toBeInTheDocument();
    });

    const justificacionInput = screen.getByLabelText(/Justificación de Reasignación en Lote/i);
    fireEvent.change(justificacionInput, { target: { value: '   corto   ' } });

    const btnContinuar = screen.getByRole('button', { name: /Continuar a Confirmación/i });
    fireEvent.click(btnContinuar);

    expect(
      screen.getByText(/La justificación de reasignación debe tener al menos 10 caracteres conforme a normativa/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Confirmación de Reasignación en Lote/i)).toBeNull();
  });

  it('solicita confirmación explícita antes de enviar la solicitud al backend', async () => {
    render(
      <ReasignarMasivoModal
        expedientes={mockExpedientes}
        areaId="area-sistemas-uuid"
        onExito={onExitoMock}
        onCerrar={onCerrarMock}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Nuevo Docente Evaluador Elegible/i)).toBeInTheDocument();
    });

    const justificacionInput = screen.getByLabelText(/Justificación de Reasignación en Lote/i);
    fireEvent.change(justificacionInput, {
      target: { value: 'Reasignación formal aprobada por el Consejo Académico de Área.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Continuar a Confirmación/i }));

    expect(screen.getByText(/Confirmación de Reasignación en Lote/i)).toBeInTheDocument();
    expect(screen.getByText(/Prof\. Carlos Mendoza/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar y Reasignar/i })).toBeInTheDocument();

    // Permite volver y editar sin perder datos
    fireEvent.click(screen.getByRole('button', { name: /Volver y Modificar/i }));
    expect(screen.queryByText(/Confirmación de Reasignación en Lote/i)).toBeNull();
    expect(screen.getByLabelText(/Justificación de Reasignación en Lote/i)).toHaveValue(
      'Reasignación formal aprobada por el Consejo Académico de Área.',
    );
  });

  it('ejecuta la reasignación masiva con el contrato exacto del backend y previene doble envío', async () => {
    const mockResultado: ReasignacionMasivaResultado = {
      ok: true,
      mensaje: 'Reasignación masiva procesada: 2 exitosos, 0 rechazados.',
      total: 2,
      exitosos: 2,
      fallidos: 0,
      resultados: [
        { expedienteId: 'exp-uuid-1', ok: true, idAsignacion: 'asig-1' },
        { expedienteId: 'exp-uuid-2', ok: true, idAsignacion: 'asig-2' },
      ],
    };

    vi.mocked(evaluadoresApi.reasignarMasivo).mockResolvedValue(mockResultado);

    render(
      <ReasignarMasivoModal
        expedientes={mockExpedientes}
        areaId="area-sistemas-uuid"
        onExito={onExitoMock}
        onCerrar={onCerrarMock}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Nuevo Docente Evaluador Elegible/i)).toBeInTheDocument();
    });

    const justificacionInput = screen.getByLabelText(/Justificación de Reasignación en Lote/i);
    fireEvent.change(justificacionInput, {
      target: { value: 'Reasignación obligatoria por cumplimiento de plazos institucionales.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Continuar a Confirmación/i }));

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar y Reasignar/i });
    fireEvent.click(btnConfirmar);

    expect(evaluadoresApi.reasignarMasivo).toHaveBeenCalledWith({
      expedienteIds: ['exp-uuid-1', 'exp-uuid-2'],
      idNuevoDocente: 'doc-uuid-1',
      motivoAsignacion: 'Redistribución de expedientes para evaluación académica',
      justificacionReasignacion: 'Reasignación obligatoria por cumplimiento de plazos institucionales.',
      observaciones: null,
    });

    await waitFor(() => {
      expect(screen.getByText(/2 exitosos/i)).toBeInTheDocument();
      expect(screen.getByText(/Reasignación masiva procesada/i)).toBeInTheDocument();
    });
  });

  it('maneja errores del backend sin perder el estado ni cerrar el modal', async () => {
    vi.mocked(evaluadoresApi.reasignarMasivo).mockRejectedValue(
      new Error('El docente seleccionado supera la carga lectiva permitida.'),
    );

    render(
      <ReasignarMasivoModal
        expedientes={mockExpedientes}
        areaId="area-sistemas-uuid"
        onExito={onExitoMock}
        onCerrar={onCerrarMock}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Nuevo Docente Evaluador Elegible/i)).toBeInTheDocument();
    });

    const justificacionInput = screen.getByLabelText(/Justificación de Reasignación en Lote/i);
    fireEvent.change(justificacionInput, {
      target: { value: 'Reasignación de prueba para caso de error de concurrencia.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Continuar a Confirmación/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar y Reasignar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'El docente seleccionado supera la carga lectiva permitida.',
      );
    });

    expect(onCerrarMock).not.toHaveBeenCalled();
    expect(onExitoMock).not.toHaveBeenCalled();
  });
});
