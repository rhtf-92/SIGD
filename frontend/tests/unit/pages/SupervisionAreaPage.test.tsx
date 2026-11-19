import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SupervisionAreaPage from '@/pages/expedientes/SupervisionAreaPage';
import * as evaluadoresApi from '@/api/evaluadoresApi';
import type { EvaluacionSupervisionItem, DocenteElegible } from '@/types/expediente';

vi.mock('@/api/evaluadoresApi', () => ({
  supervisarEvaluacionesArea: vi.fn(),
  listarDocentesElegibles: vi.fn(),
  reasignarMasivo: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    usuario: {
      id: 'usr-coord-1',
      nombreCompleto: 'Ing. Jacobo Reátegui',
      correo: 'coordinador@iestpsuiza.edu.pe',
      areaId: 'area-sistemas-uuid',
      contextoActivo: {
        rol: 'COORDINADOR_AREA',
        areaId: 'area-sistemas-uuid',
      },
    },
  }),
}));

const mockEvaluaciones: EvaluacionSupervisionItem[] = [
  {
    idAsignacion: 'asig-1',
    expedienteId: 'exp-1',
    codigoExpediente: 'CUT-2026-001',
    asunto: 'Titulación Profesional Computación',
    docenteNombre: 'Prof. Juan Pérez',
    docenteEmail: 'jperez@iestpsuiza.edu.pe',
    estadoEvaluacion: 'EN_EVALUACION',
    estadoExpediente: 'EN_REVISION',
    asignadoEn: '2026-10-15T10:00:00Z',
    diasTranscurridos: 3,
    resultadoEvaluacion: null,
  },
  {
    idAsignacion: 'asig-2',
    expedienteId: 'exp-2',
    codigoExpediente: 'CUT-2026-002',
    asunto: 'Certificado Modular Mecánica',
    docenteNombre: 'Prof. Mario Vargas',
    docenteEmail: 'mvargas@iestpsuiza.edu.pe',
    estadoEvaluacion: 'ASIGNADO',
    estadoExpediente: 'EN_REVISION',
    asignadoEn: '2026-10-10T10:00:00Z',
    diasTranscurridos: 8,
    resultadoEvaluacion: null,
  },
  {
    idAsignacion: 'asig-3',
    expedienteId: 'exp-3',
    codigoExpediente: 'CUT-2026-003',
    asunto: 'Convalidación Curricular',
    docenteNombre: 'Dra. María Santos',
    docenteEmail: 'msantos@iestpsuiza.edu.pe',
    estadoEvaluacion: 'CONCLUIDO',
    estadoExpediente: 'ATENDIDO',
    asignadoEn: '2026-10-01T10:00:00Z',
    diasTranscurridos: 1,
    resultadoEvaluacion: 'FAVORABLE',
  },
];

const mockDocentes: DocenteElegible[] = [
  {
    idUsuario: 'doc-nuevo-1',
    nombreCompleto: 'Prof. Roberto Gómez',
    correo: 'rgomez@iestpsuiza.edu.pe',
    rol: 'DOCENTE',
    areaId: 'area-sistemas-uuid',
  },
];

describe('SupervisionAreaPage — Interfaz de Supervisión y Reasignación Masiva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(evaluadoresApi.supervisarEvaluacionesArea).mockResolvedValue({
      ok: true,
      total: 3,
      evaluaciones: mockEvaluaciones,
    });
    vi.mocked(evaluadoresApi.listarDocentesElegibles).mockResolvedValue(mockDocentes);
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <SupervisionAreaPage />
      </MemoryRouter>,
    );
  }

  it('renderiza el panel de supervisión, métricas y evaluaciones de área', async () => {
    renderPage();

    expect(screen.getByText(/Panel de Supervisión de Evaluaciones de Área/i)).toBeInTheDocument();
    expect(screen.getByText('Cargando evaluaciones del área…')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('CUT-2026-001')).toBeInTheDocument();
      expect(screen.getByText('CUT-2026-002')).toBeInTheDocument();
      expect(screen.getByText('CUT-2026-003')).toBeInTheDocument();
    });

    expect(screen.getByText('Prof. Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Prof. Mario Vargas')).toBeInTheDocument();
    expect(screen.getByText('Dra. María Santos')).toBeInTheDocument();
  });

  it('permite seleccionar individualmente expedientes y muestra la barra de acciones flotante', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('CUT-2026-001')).toBeInTheDocument();
    });

    // Inicialmente no hay barra de acciones
    expect(screen.queryByLabelText(/Barra de acciones/i)).toBeNull();

    // Seleccionar primer expediente
    const chk1 = screen.getByLabelText('Seleccionar expediente CUT-2026-001');
    fireEvent.click(chk1);

    expect(chk1).toBeChecked();
    expect(screen.getByLabelText(/Barra de acciones/i)).toBeInTheDocument();
    expect(screen.getByText(/1 expediente\(s\) seleccionado\(s\)/i)).toBeInTheDocument();

    // Seleccionar segundo expediente
    const chk2 = screen.getByLabelText('Seleccionar expediente CUT-2026-002');
    fireEvent.click(chk2);

    expect(chk2).toBeChecked();
    expect(screen.getByText(/2 expediente\(s\) seleccionado\(s\)/i)).toBeInTheDocument();

    // Deseleccionar mediante botón 'Limpiar selección'
    fireEvent.click(screen.getByRole('button', { name: /Limpiar selección/i }));
    expect(screen.queryByLabelText(/Barra de acciones/i)).toBeNull();
    expect(chk1).not.toBeChecked();
    expect(chk2).not.toBeChecked();
  });

  it('permite seleccionar y deseleccionar todos los expedientes visibles con el checkbox maestro', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('CUT-2026-001')).toBeInTheDocument();
    });

    const chkMaestro = screen.getByLabelText(/Seleccionar todos los expedientes visibles/i);
    expect(chkMaestro).not.toBeChecked();

    // Seleccionar todos
    fireEvent.click(chkMaestro);
    expect(screen.getByText(/3 expediente\(s\) seleccionado\(s\)/i)).toBeInTheDocument();

    // Deseleccionar todos
    fireEvent.click(chkMaestro);
    expect(screen.queryByLabelText(/Barra de acciones/i)).toBeNull();
  });

  it('abre el modal de reasignación masiva con los expedientes seleccionados', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('CUT-2026-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Seleccionar expediente CUT-2026-001'));
    fireEvent.click(screen.getByLabelText('Seleccionar expediente CUT-2026-002'));

    const btnReasignar = screen.getByRole('button', { name: /Reasignar seleccionados \(2\)/i });
    fireEvent.click(btnReasignar);

    expect(screen.getByText(/Reasignación Masiva de Expedientes/i)).toBeInTheDocument();
    expect(screen.getByText(/2 expediente\(s\) seleccionado\(s\) para reasignar/i)).toBeInTheDocument();
  });

  it('permite la reasignación individual desde el botón de la fila', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('CUT-2026-001')).toBeInTheDocument();
    });

    const botonesReasignar = screen.getAllByRole('button', { name: /^Reasignar$/i });
    expect(botonesReasignar.length).toBe(3);

    // Click en reasignar de la primera fila
    fireEvent.click(botonesReasignar[0]);

    expect(screen.getByText(/Reasignación Masiva de Expedientes/i)).toBeInTheDocument();
    expect(screen.getByText(/1 expediente\(s\) seleccionado\(s\) para reasignar/i)).toBeInTheDocument();
    expect(screen.getAllByText('CUT-2026-001').length).toBeGreaterThanOrEqual(1);
  });

  it('actualiza reactivamente la bandeja y limpia la selección tras completar la reasignación', async () => {
    vi.mocked(evaluadoresApi.reasignarMasivo).mockResolvedValue({
      ok: true,
      mensaje: 'Reasignación completada',
      total: 1,
      exitosos: 1,
      fallidos: 0,
      resultados: [{ expedienteId: 'exp-1', ok: true }],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('CUT-2026-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Seleccionar expediente CUT-2026-001'));
    fireEvent.click(screen.getByRole('button', { name: /Reasignar seleccionados \(1\)/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Nuevo Docente Evaluador Elegible/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Justificación de Reasignación en Lote/i), {
      target: { value: 'Reasignación justificada para balance de carga lectiva.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Continuar a Confirmación/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar y Reasignar/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aceptar y Finalizar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Aceptar y Finalizar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Reasignación de evaluador\(es\) procesada exitosamente/i)).toBeInTheDocument();
    });

    // Verifica que se volvió a consultar la lista actualizada
    expect(evaluadoresApi.supervisarEvaluacionesArea).toHaveBeenCalledTimes(2);
    // Verifica que la selección quedó limpia
    expect(screen.queryByLabelText(/Barra de acciones/i)).toBeNull();
  });
});
