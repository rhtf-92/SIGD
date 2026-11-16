import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DocumentacionRequisitos } from '@/components/tramite/DocumentacionRequisitos';
import { validarAdjuntosRequisitos } from '@/services/documentacionTramiteService';
import type { DocumentacionTramite, RequisitoDocumental } from '@/types/documentacionTramite';
import type { ArchivoTramite } from '@/types/tramiteWizardState';
const r: RequisitoDocumental = { id: '22222222-2222-4222-8222-222222222222', codigo: 'FUT', nombre: 'Requisito fixture obligatorio', obligatorio: true, clasificacion: 'EXPEDIENTE', tipos: [{ id: '33333333-3333-4333-8333-333333333333', codigo: 'FUT', nombre: 'FUT', condicion: null }] };
const detalle: DocumentacionTramite = { id: '11111111-1111-4111-8111-111111111111', codigo: 'SUZ26-035', denominacion: 'Certificado', condicionFinanciera: 'SUJETO_PAGO', tarifa: { id: r.id, importe: '124.00', moneda: 'PEN', concepto: 'Certificado', fuente: 'Fixture documental' }, requisitos: [r], anexos: [], nota: 'Fixture, no requisito institucional real' };
const archivo: ArchivoTramite = { nombre: 'solicitud.pdf', peso: 100, hashSha256: 'a'.repeat(64), clasificacion: 'EXPEDIENTE', requisitoId: r.id };
describe('Requisitos y tarifa por procedimiento', () => {
  it('retira el sufijo de auditoría del FUT sin publicar su código ni inventar obligatoriedad', () => {
    render(<DocumentacionRequisitos detalle={{ ...detalle, requisitos: [{ ...r, nombre: 'Solicitud en FUT dirigida al Director (la fuente no establece obligatoriedad de adjuntarla)', obligatorio: false }] }} archivos={[]} disabled={false} adjuntar={vi.fn()} />);
    expect(screen.getByLabelText('Adjuntar PDF: Solicitud en FUT dirigida al Director')).toBeEnabled();
    expect(screen.queryByText(/la fuente no establece/)).not.toBeInTheDocument();
    expect(screen.getByText(/\(Opcional \/ Facultativo\)/i)).toBeInTheDocument();
  });
  it('muestra el importe recibido del backend sin valores arbitrarios', () => {
    render(<DocumentacionRequisitos detalle={detalle} archivos={[]} disabled={false} adjuntar={vi.fn()} />);
    expect(screen.getByText('Costo del trámite: S/ 124.00')).toBeInTheDocument();
    expect(screen.getByText(/No se indican anexos específicos/)).toBeInTheDocument();
    expect(screen.queryByText(detalle.nota)).not.toBeInTheDocument();
    expect(screen.queryByText(/SUZ26-035/)).not.toBeInTheDocument();
    expect(screen.getByText(/Pendiente de adjuntar/i)).toBeInTheDocument();
  });
  it('la carga individual informa el identificador y clasificación del requisito', () => {
    const adjuntar = vi.fn();
    render(<DocumentacionRequisitos detalle={detalle} archivos={[]} disabled={false} adjuntar={adjuntar} />);
    fireEvent.change(screen.getByLabelText('Adjuntar PDF: Requisito fixture obligatorio'), { target: { files: [new File(['%PDF'], 'solicitud.pdf', { type: 'application/pdf' })] } });
    expect(adjuntar).toHaveBeenCalledWith(expect.anything(), { clasificacion: 'EXPEDIENTE', requisitoId: r.id });
  });
  it('muestra tarifa gratuita y pendiente sin inventar importes', () => {
    const { rerender } = render(<DocumentacionRequisitos detalle={{ ...detalle, tarifa: { ...detalle.tarifa!, importe: '0.00' }, condicionFinanciera: 'GRATUITO' }} archivos={[]} disabled={false} adjuntar={vi.fn()} />);
    expect(screen.getByText('Costo del trámite: S/ 0.00')).toBeInTheDocument();
    rerender(<DocumentacionRequisitos detalle={{ ...detalle, tarifa: null, condicionFinanciera: 'PENDIENTE_VALIDACION' }} archivos={[]} disabled={false} adjuntar={vi.fn()} />);
    expect(screen.getByText(/Consulte el costo en Tesorería/)).toBeInTheDocument();
  });
  it('bloquea con el nombre exacto del obligatorio faltante', () => {
    expect(validarAdjuntosRequisitos(detalle, [{ ...archivo, requisitoId: undefined }])).toContain(r.nombre);
    expect(validarAdjuntosRequisitos(detalle, [archivo])).toBeNull();
  });
  it('no acepta asociaciones de un procedimiento anterior', () => {
    expect(validarAdjuntosRequisitos({ ...detalle, requisitos: [] }, [archivo])).toContain('Revise el requisito');
  });
  it('exige anexos obligatorios y acepta varios PDF asociados', () => {
    const anexo = { ...r, id: detalle.id, codigo: 'ANEXO', nombre: 'Anexo fixture', clasificacion: 'ANEXO' as const };
    const d = { ...detalle, anexos: [anexo] };
    expect(validarAdjuntosRequisitos(d, [archivo])).toContain('Anexo fixture');
    expect(validarAdjuntosRequisitos(d, [archivo, { ...archivo, requisitoId: anexo.id, clasificacion: 'ANEXO' }, { ...archivo, nombre: 'otro.pdf', requisitoId: anexo.id, clasificacion: 'ANEXO' }])).toBeNull();
  });
});
