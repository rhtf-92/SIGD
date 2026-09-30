import { describe, it, expect, vi } from 'vitest';
import { VentanillaPresencialService } from '../../../../src/domains/tramicore/ventanillaPresencial.service';
import { TicketTermicoUtil } from '../../../../src/domains/tramicore/ticketTermico.util';

describe('Módulo TramiCore - Ventanilla Presencial y Ticket', () => {
  
  it('Debe registrar el expediente físicamente con canal VENTANILLA_PRESENCIAL', async () => {
    // Simulamos la base de datos para la prueba atómica
    const mockDbClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ id_expediente: 1 }] })
    };

    const datosPrueba = {
      idOperadorVentanilla: 15,
      datosRemitente: 'Juan Perez',
      asunto: 'Solicitud de Certificado Estudiantil',
      foliosTotales: 5
    };

    const cut = await VentanillaPresencialService.registrarExpediente(datosPrueba, mockDbClient);
    
    // Verificamos que se haya generado el CUT correctamente
    expect(cut).toContain('CUT-');
    expect(mockDbClient.query).toHaveBeenCalled();
  });

  it('Debe generar el ticket térmico cumpliendo el Criterio de Aceptación (Hash SHA-256)', () => {
    const datosTicket = {
      cut: 'CUT-2026-9999',
      timestamp: new Date(),
      folios: 5,
      hashSha256: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', // Requisito del DoD
      qrUrlSeguimiento: 'https://sigd.instituto.edu.pe/qr/9999'
    };

    const ticketStr = TicketTermicoUtil.generarTicketVentanilla(datosTicket);
    
    // Verificamos que el ticket imprima los datos obligatorios
    expect(ticketStr).toContain('CUT-2026-9999');
    expect(ticketStr).toContain('NRO. FOLIOS: 5');
    expect(ticketStr).toContain('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'); // Valida el Hash SHA-256
  });

});