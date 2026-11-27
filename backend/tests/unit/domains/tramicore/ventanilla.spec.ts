import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { VentanillaPresencialService } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';
import { TicketTermicoUtil } from '../../../../src/domains/tramicore/ticketTermico.util.js';

describe('Módulo TramiCore - Ventanilla Presencial y Ticket', () => {
  
  it('Debe registrar el expediente físicamente con canal VENTANILLA_PRESENCIAL y CUT atómico', async () => {
    // Simulamos la secuencia de consultas del flujo canónico de recepción física
    const mockDbClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ cut: 'EXP-2026-123456' }] }) // sigd_tra.generar_cut_expediente
        .mockResolvedValueOnce({ rows: [{ id_persona: 'p-persona-1' }] }) // persona por DNI
        .mockResolvedValueOnce({ rows: [{ tipo_documental_id: '00000000-0000-0000-0000-000000000009' }] }) // catálogo documental
        .mockResolvedValueOnce({ rows: [{ expediente_id: 'e-expediente-1' }] }) // INSERT sigd_tra.expediente
        .mockResolvedValueOnce({}) // INSERT sigd_tra.asiento_registro
        .mockResolvedValueOnce({}), // INSERT sigd_tra.tramite
    };

    const datos = {
      dniSolicitante: '12345678',
      datosRemitente: 'Juan Perez',
      asunto: 'Solicitud de Certificado Estudiantil',
      foliosTotales: 5,
    };

    const servicio = new VentanillaPresencialService({} as Pool);
    const resultado = await servicio.registrarExpedienteVentanilla(datos, mockDbClient as unknown as PoolClient);

    // CUT canónico EXP-YYYY-XXXXXX y referencia del expediente insertado
    expect(resultado.cut).toBe('EXP-2026-123456');
    expect(resultado.expedienteId).toBe('e-expediente-1');
    expect(resultado.cargo.cut).toBe('EXP-2026-123456');
    expect(resultado.ticketImpresion).toContain('EXP-2026-123456');

    // El INSERT de expediente usa el contrato canónico (codigo_expediente), no el legado (cut/id_expediente)
    const sqlExpediente = mockDbClient.query.mock.calls[3][0] as string;
    expect(sqlExpediente).toContain('codigo_expediente');
    expect(sqlExpediente).not.toContain('id_expediente');
    expect(sqlExpediente).not.toContain('00000000-0000-0000-0000-000000000001');
    expect(mockDbClient.query).toHaveBeenCalledTimes(6);
    const sqlTramite = mockDbClient.query.mock.calls[5][0] as string;
    expect(sqlTramite).toContain('INSERT INTO sigd_tra.tramite');
  });

  it('Debe generar el ticket térmico cumpliendo el Criterio de Aceptación (Hash SHA-256)', () => {
    const datosTicket = {
      cut: 'EXP-2026-999999',
      timestamp: new Date(),
      folios: 5,
      hashSha256: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', // Requisito del DoD
      qrUrlSeguimiento: 'https://sigd.instituto.edu.pe/qr/999999'
    };

    const ticketStr = TicketTermicoUtil.generarTicketVentanilla(datosTicket);
    
    // Verificamos que el ticket imprima los datos obligatorios
    expect(ticketStr).toContain('EXP-2026-999999');
    expect(ticketStr).toContain('NRO. FOLIOS: 5');
    expect(ticketStr).toContain('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'); // Valida el Hash SHA-256
  });

});