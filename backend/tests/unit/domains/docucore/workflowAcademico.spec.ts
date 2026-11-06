import { describe, expect, it } from 'vitest';
import {
  aplicarTransicion,
  type WorkflowAcademico,
} from '../../../../src/domains/docucore/workflowAcademico.router.js';

function workflow(estado: WorkflowAcademico['estado'] = 'EN_TRAMITE'): WorkflowAcademico {
  return {
    idTramite: 412,
    cut: 'EXP-2026-000412',
    estado,
    etapaActualId: 1,
    etapas: [
      { idEtapa: 1, requisitos: [{ idRequisito: 101, descripcion: 'Constancia', cumplido: true }] },
      { idEtapa: 2, requisitos: [{ idRequisito: 201, descripcion: 'Acta', cumplido: false }] },
    ],
  };
}

describe('FSM académica persistente', () => {
  it('toma el trámite en revisión y avanza solo con requisitos completos', () => {
    const actual = aplicarTransicion(workflow(), { transicion: 'tomar_revision' });
    expect(actual.estado).toBe('EN_REVISION');
    const avanzado = aplicarTransicion(actual, { transicion: 'aprobar_etapa' });
    expect(avanzado).toMatchObject({ estado: 'EN_TRAMITE', etapaActualId: 2 });
    expect(avanzado.etapas[0].fechaFin).toBeTruthy();
    expect(avanzado.etapas[1].fechaInicio).toBeTruthy();
  });

  it('bloquea la aprobación cuando existe un requisito pendiente', () => {
    const actual = workflow('EN_REVISION');
    actual.etapaActualId = 2;
    expect(() => aplicarTransicion(actual, { transicion: 'aprobar_etapa' }))
      .toThrow(/requisito/);
  });

  it('persiste el ciclo observado → subsanado → en revisión', () => {
    const observado = aplicarTransicion(workflow('EN_REVISION'), {
      transicion: 'observar',
      observacion: 'Falta completar la evidencia académica.',
    });
    expect(observado.estado).toBe('OBSERVADO');
    const subsanado = aplicarTransicion(observado, { transicion: 'subsanar' });
    expect(subsanado.estado).toBe('SUBSANADO');
    const reanudado = aplicarTransicion(subsanado, { transicion: 'reanudar' });
    expect(reanudado.estado).toBe('EN_REVISION');
    expect(reanudado.etapas[0].observacion).toBeUndefined();
  });

  it('marca requisitos y genera hash SHA-256/CVD al firmar', () => {
    const actual = workflow('EN_REVISION');
    actual.etapaActualId = 2;
    aplicarTransicion(actual, {
      transicion: 'marcar_requisito', etapaId: 2, requisitoId: 201, cumplido: true,
    });
    aplicarTransicion(actual, { transicion: 'aprobar_etapa' });
    expect(actual.estado).toBe('PARA_FIRMA');
    aplicarTransicion(actual, { transicion: 'firmar' });
    expect(actual.estado).toBe('RESUELTO');
    expect(actual.certificado?.hashSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(actual.certificado?.cvd).toMatch(/^CVD-\d{4}-TIT-/);
  });

  it('rechaza transiciones fuera del estado permitido', () => {
    expect(() => aplicarTransicion(workflow('REGISTRADO'), { transicion: 'tomar_revision' }))
      .toThrow(/EN_TRAMITE/);
  });
});
