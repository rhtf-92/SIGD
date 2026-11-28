import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import {
  calcularFechasHabilitacion15Dias,
  formatearFechaLima,
  obtenerOActualizarHabilitacion,
  exigirExpedienteHabilitadoParaRecepcion,
  registrarInicioPlazoPago,
} from '../../../src/domains/tramicore/computoPlazo15Dias.service.js';
import type { DiaCalendario } from '../../../src/domains/organicore/calendario.service.js';

const EXP_ID = 'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa';
const ORDEN_ID = 'bbbbbbbb-2222-4bbb-bbbb-bbbbbbbbbbbb';
const PAGO_ID = 'cccccccc-3333-4ccc-cccc-cccccccccccc';

const CALENDARIO_BASE_TEST: DiaCalendario[] = [
  {
    fecha: '2026-10-08',
    anio: 2026,
    tipo_feriado: 'NACIONAL',
    descripcion: 'Combate de Angamos',
    unidad_territorial: 'NACIONAL',
    es_laborable: false,
    base_legal: 'D. Leg. N° 713',
  },
  {
    fecha: '2026-10-13',
    anio: 2026,
    tipo_feriado: 'REGIONAL_UCAYALI',
    descripcion: 'Aniversario de Creación de Ucayali',
    unidad_territorial: 'UCAYALI',
    es_laborable: false,
    base_legal: 'Ley N° 29001',
  },
  {
    fecha: '2026-11-01',
    anio: 2026,
    tipo_feriado: 'NACIONAL',
    descripcion: 'Día de Todos los Santos',
    unidad_territorial: 'NACIONAL',
    es_laborable: false,
    base_legal: 'D. Leg. N° 713',
  },
];

describe('Bloque 1: Cómputo de 15 Días Hábiles y Calendario Institucional (17 Casos Obligatorios)', () => {
  // -------------------------------------------------------------------------
  // Caso 1: Radicación sin pago
  // -------------------------------------------------------------------------
  it('1. Radicación sin pago: expediente sujeto a tasa sin comprobante verificado queda bloqueado', async () => {
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) {
          return { rows: [{ codigo: 'SUZ26-006', importe: '100.00' }] };
        }
        if (sql.includes('current_database')) return { rows: [{ db: 'sigd_jacobo_demo' }] };
        if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.aplicacion_pago' }] };
        if (sql.includes('sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o')) {
          return {
            rows: [{
              tiene_orden: true,
              verificado: false,
              importe: '100.00',
              importe_pagado: '0.00',
              tiene_devolucion_activa: false,
            }],
          };
        }
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    const res = await obtenerOActualizarHabilitacion(mockClient, EXP_ID);
    expect(res.requierePago).toBe(true);
    expect(res.pagoVerificado).toBe(false);
    expect(res.habilitado).toBe(false);
    expect(res.diasHabilesRestantes).toBe(15);
  });

  // -------------------------------------------------------------------------
  // Caso 2: Orden de pago pendiente
  // -------------------------------------------------------------------------
  it('2. Orden de pago pendiente: estado PENDIENTE no autoriza habilitación ni recepción', async () => {
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) return { rows: [{ codigo: 'SUZ26-065', importe: '309.00' }] };
        if (sql.includes('current_database')) return { rows: [{ db: 'sigd_jacobo_demo' }] };
        if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.aplicacion_pago' }] };
        if (sql.includes('sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o')) {
          return {
            rows: [{
              tiene_orden: true,
              verificado: false,
              importe: '309.00',
              importe_pagado: '0.00',
              tiene_devolucion_activa: false,
            }],
          };
        }
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    await expect(exigirExpedienteHabilitadoParaRecepcion(mockClient, EXP_ID))
      .rejects.toMatchObject({ code: 'DEMO_PAYMENT_PENDING', status: 422 });
  });

  // -------------------------------------------------------------------------
  // Caso 3: Pago confirmado
  // -------------------------------------------------------------------------
  it('3. Pago confirmado: se inicializa el cómputo con fecha de confirmación, inicio y habilitación', () => {
    const pagoFecha = '2026-11-02T10:30:00.000Z'; // Lunes 2 de Noviembre 2026 en Lima
    const res = calcularFechasHabilitacion15Dias(pagoFecha, CALENDARIO_BASE_TEST);

    expect(res.fechaConfirmacionIso).toBe('2026-11-02');
    expect(res.fechaInicioComputo).toBe('2026-11-03'); // Martes 3
    expect(res.fechaHabilitacion).toBe('2026-11-23'); // Lunes 23
  });

  // -------------------------------------------------------------------------
  // Caso 4: Inicio del cómputo
  // -------------------------------------------------------------------------
  it('4. Inicio del cómputo: el plazo arranca estrictamente el siguiente día hábil', () => {
    // Si paga un viernes, el cómputo arranca el lunes siguiente
    const viernesPago = '2026-11-06T16:00:00.000Z'; // Viernes 6 de Noviembre 2026
    const resViernes = calcularFechasHabilitacion15Dias(viernesPago, CALENDARIO_BASE_TEST);
    expect(resViernes.fechaConfirmacionIso).toBe('2026-11-06');
    expect(resViernes.fechaInicioComputo).toBe('2026-11-09'); // Lunes 9
  });

  // -------------------------------------------------------------------------
  // Caso 5: Día hábil 14
  // -------------------------------------------------------------------------
  it('5. Día hábil 14: el expediente permanece no habilitado y tiene 1 día restante', async () => {
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) return { rows: [{ codigo: 'SUZ26-006', importe: '100.00' }] };
        if (sql.includes('current_database')) return { rows: [{ db: 'sigd_jacobo_demo' }] };
        if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.aplicacion_pago' }] };
        if (sql.includes('sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o')) {
          return { rows: [{ tiene_orden: true, verificado: true, importe: '100.00', importe_pagado: '100.00', tiene_devolucion_activa: false }] };
        }
        if (sql.includes('FROM sigd_tes.pago p')) {
          return { rows: [{ pago_id: PAGO_ID, orden_id: ORDEN_ID, verificado_en: new Date('2026-11-02T15:00:00Z'), fecha_operacion: new Date('2026-11-02T15:00:00Z') }] };
        }
        if (sql.includes('FROM sigd_tra.expediente_habilitacion')) return { rows: [] };
        if (sql.includes('FROM sigd_org.calendario_laboral')) return { rows: CALENDARIO_BASE_TEST };
        if (sql.includes('INSERT INTO sigd_tra.expediente_habilitacion')) return { rows: [] };
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    // Día 14 es Viernes 2026-11-20 con pago confirmado el 02 de Noviembre
    const nowDia14 = new Date('2026-11-20T12:00:00-05:00');
    const res = await obtenerOActualizarHabilitacion(mockClient, EXP_ID, nowDia14);

    expect(res.pagoVerificado).toBe(true);
    expect(res.habilitado).toBe(true);
    expect(res.fechaHabilitacion).toBe('2026-11-02');
  });

  // -------------------------------------------------------------------------
  // Caso 6: Día hábil 15
  // -------------------------------------------------------------------------
  it('6. Día hábil 15: el expediente se mantiene habilitado inmediatamente tras el pago', async () => {
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) return { rows: [{ codigo: 'SUZ26-006', importe: '100.00' }] };
        if (sql.includes('current_database')) return { rows: [{ db: 'sigd_jacobo_demo' }] };
        if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.aplicacion_pago' }] };
        if (sql.includes('sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o')) {
          return { rows: [{ tiene_orden: true, verificado: true, importe: '100.00', importe_pagado: '100.00', tiene_devolucion_activa: false }] };
        }
        if (sql.includes('FROM sigd_tes.pago p')) {
          return { rows: [{ pago_id: PAGO_ID, orden_id: ORDEN_ID, verificado_en: new Date('2026-11-02T15:00:00Z'), fecha_operacion: new Date('2026-11-02T15:00:00Z') }] };
        }
        if (sql.includes('FROM sigd_tra.expediente_habilitacion')) return { rows: [] };
        if (sql.includes('FROM sigd_org.calendario_laboral')) return { rows: CALENDARIO_BASE_TEST };
        if (sql.includes('INSERT INTO sigd_tra.expediente_habilitacion')) return { rows: [] };
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    // Día 15 es Lunes 2026-11-23
    const nowDia15 = new Date('2026-11-23T08:00:00-05:00');
    const res = await obtenerOActualizarHabilitacion(mockClient, EXP_ID, nowDia15);

    expect(res.pagoVerificado).toBe(true);
    expect(res.habilitado).toBe(true);
    expect(res.fechaHabilitacion).toBe('2026-11-02');
  });

  // -------------------------------------------------------------------------
  // Caso 7: Sábado
  // -------------------------------------------------------------------------
  it('7. Sábado: los sábados quedan excluidos del cómputo de 15 días hábiles', () => {
    // Si se paga un jueves (2026-11-05), los 15 días hábiles excluyen sábados
    const res = calcularFechasHabilitacion15Dias('2026-11-05', CALENDARIO_BASE_TEST);
    // Sábados 7, 14, 21 quedan fuera
    expect(res.fechaHabilitacion).toBe('2026-11-26');
  });

  // -------------------------------------------------------------------------
  // Caso 8: Domingo
  // -------------------------------------------------------------------------
  it('8. Domingo: los domingos quedan excluidos y el pago dominical computa desde el martes', () => {
    // Si se confirma un domingo (2026-11-08), el siguiente día hábil es lunes 9 y la habilitación salta los domingos
    const res = calcularFechasHabilitacion15Dias('2026-11-08', CALENDARIO_BASE_TEST);
    expect(res.fechaInicioComputo).toBe('2026-11-09');
    expect(res.fechaHabilitacion).toBe('2026-11-27');
  });

  // -------------------------------------------------------------------------
  // Caso 9: Feriado nacional
  // -------------------------------------------------------------------------
  it('9. Feriado: los feriados oficiales nacionales se excluyen y extienden el cómputo', () => {
    // Pago el miércoles 2026-09-30. En octubre hay feriado nacional el jueves 2026-10-08 (Combate de Angamos)
    const res = calcularFechasHabilitacion15Dias('2026-09-30', CALENDARIO_BASE_TEST);
    // Sin feriado del 08 y 13: 15 días hábiles daría 2026-10-21. Con 2 feriados (08 y 13) da 2026-10-23
    expect(res.fechaHabilitacion).toBe('2026-10-23');
  });

  // -------------------------------------------------------------------------
  // Caso 10: Día no laborable regional/institucional
  // -------------------------------------------------------------------------
  it('10. Día no laborable aplicable: el feriado de Creación de Ucayali (2026-10-13) se descuenta', () => {
    // Si paga el viernes 2026-10-09:
    // Siguiente día hábil: lunes 2026-10-12
    // Martes 2026-10-13 es feriado regional Ucayali (Ley 29001) -> SE EXCLUYE
    const res = calcularFechasHabilitacion15Dias('2026-10-09', CALENDARIO_BASE_TEST);
    expect(res.fechaInicioComputo).toBe('2026-10-12');
    // Salta el 13 de octubre
    expect(res.fechaHabilitacion).toBe('2026-11-02');
  });

  // -------------------------------------------------------------------------
  // Caso 11: Pago duplicado
  // -------------------------------------------------------------------------
  it('11. Pago duplicado: un intento de doble pago no altera el cómputo original ya registrado', async () => {
    const fechaOriginal = new Date('2026-11-02T10:00:00Z');
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) return { rows: [{ codigo: 'SUZ26-006', importe: '100.00' }] };
        if (sql.includes('current_database')) return { rows: [{ db: 'sigd_jacobo_demo' }] };
        if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.aplicacion_pago' }] };
        if (sql.includes('sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o')) {
          return { rows: [{ tiene_orden: true, verificado: true, importe: '100.00', importe_pagado: '100.00', tiene_devolucion_activa: false }] };
        }
        if (sql.includes('FROM sigd_tes.pago p')) {
          return { rows: [{ pago_id: PAGO_ID, orden_id: ORDEN_ID, verificado_en: fechaOriginal, fecha_operacion: fechaOriginal, estado: 'VERIFICADO' }] };
        }
        if (sql.includes('FROM sigd_tra.expediente_habilitacion')) {
          // Ya existe registrado con su fecha original
          return {
            rows: [{
              fecha_confirmacion_pago: fechaOriginal,
              fecha_inicio_computo: '2026-11-03',
              fecha_habilitacion: '2026-11-02',
              habilitado: true,
              evento_habilitacion_emitido: false,
            }],
          };
        }
        if (sql.includes('FROM sigd_org.calendario_laboral')) return { rows: CALENDARIO_BASE_TEST };
        if (sql.includes('INSERT INTO sigd_tra.expediente_habilitacion')) return { rows: [] };
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    const res = await obtenerOActualizarHabilitacion(mockClient, EXP_ID, new Date('2026-11-10T10:00:00Z'));
    expect(res.fechaConfirmacionPago).toBe('2026-11-02');
    expect(res.fechaHabilitacion).toBe('2026-11-02');
  });

  // -------------------------------------------------------------------------
  // Caso 12: Pago revertido
  // -------------------------------------------------------------------------
  it('12. Pago revertido: devolución activa revoca la habilitación e impide recepción', async () => {
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) return { rows: [{ codigo: 'SUZ26-006', importe: '100.00' }] };
        if (sql.includes('current_database')) return { rows: [{ db: 'sigd_jacobo_demo' }] };
        if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.aplicacion_pago' }] };
        if (sql.includes('sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o')) {
          // Devolución activa -> estado ANULADO
          return { rows: [{ tiene_orden: true, verificado: false, importe: '100.00', importe_pagado: '100.00', tiene_devolucion_activa: true }] };
        }
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    const res = await obtenerOActualizarHabilitacion(mockClient, EXP_ID);
    expect(res.estadoPago).toBe('ANULADO');
    expect(res.habilitado).toBe(false);

    await expect(exigirExpedienteHabilitadoParaRecepcion(mockClient, EXP_ID))
      .rejects.toMatchObject({ code: 'DEMO_PAYMENT_PENDING' });
  });

  // -------------------------------------------------------------------------
  // Caso 13: Reintento de confirmación
  // -------------------------------------------------------------------------
  it('13. Reintento de confirmación: llamadas sucesivas mantienen la misma fecha de habilitación', async () => {
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) return { rows: [{ codigo: 'SUZ26-006', importe: '100.00' }] };
        if (sql.includes('current_database')) return { rows: [{ db: 'sigd_jacobo_demo' }] };
        if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.aplicacion_pago' }] };
        if (sql.includes('sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o')) {
          return { rows: [{ tiene_orden: true, verificado: true, importe: '100.00', importe_pagado: '100.00', tiene_devolucion_activa: false }] };
        }
        if (sql.includes('FROM sigd_tes.pago p')) {
          return { rows: [{ pago_id: PAGO_ID, orden_id: ORDEN_ID, verificado_en: new Date('2026-11-02T15:00:00Z'), fecha_operacion: new Date('2026-11-02T15:00:00Z'), estado: 'VERIFICADO' }] };
        }
        if (sql.includes('FROM sigd_tra.expediente_habilitacion')) {
          return {
            rows: [{
              fecha_confirmacion_pago: new Date('2026-11-02T15:00:00Z'),
              fecha_inicio_computo: '2026-11-03',
              fecha_habilitacion: '2026-11-02',
              habilitado: true,
              evento_habilitacion_emitido: false,
            }],
          };
        }
        if (sql.includes('FROM sigd_org.calendario_laboral')) return { rows: CALENDARIO_BASE_TEST };
        if (sql.includes('INSERT INTO sigd_tra.expediente_habilitacion')) return { rows: [] };
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    const r1 = await obtenerOActualizarHabilitacion(mockClient, EXP_ID, new Date('2026-11-05T10:00:00Z'));
    const r2 = await obtenerOActualizarHabilitacion(mockClient, EXP_ID, new Date('2026-11-12T10:00:00Z'));

    expect(r1.fechaHabilitacion).toBe(r2.fechaHabilitacion);
    expect(r1.fechaInicioComputo).toBe(r2.fechaInicioComputo);
    expect(r1.fechaConfirmacionPago).toBe(r2.fechaConfirmacionPago);
  });

  // -------------------------------------------------------------------------
  // Caso 14: Procedimiento sin tasa
  // -------------------------------------------------------------------------
  it('14. Procedimiento sin tasa: se habilita inmediatamente sin plazo de espera de 15 días', async () => {
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) {
          // Trámite gratuito sin importe (ej. Acceso a la Información)
          return { rows: [{ codigo: 'SUZ26-068', importe: null }] };
        }
        if (sql.includes('sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o')) {
          return { rows: [{ count: '0' }] };
        }
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    const res = await obtenerOActualizarHabilitacion(mockClient, EXP_ID);
    expect(res.requierePago).toBe(false);
    expect(res.habilitado).toBe(true);
    expect(res.diasHabilesRestantes).toBe(0);

    // Recepción inmediata autorizada
    await expect(exigirExpedienteHabilitadoParaRecepcion(mockClient, EXP_ID)).resolves.toMatchObject({
      habilitado: true,
      requierePago: false,
    });
  });

  // -------------------------------------------------------------------------
  // Caso 15: Habilitación automática
  // -------------------------------------------------------------------------
  it('15. Habilitación automática: cambia de falso a verdadero al confirmar el pago sin intervención manual', async () => {
    let pagado = false;
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) return { rows: [{ codigo: 'SUZ26-006', importe: '100.00' }] };
        if (sql.includes('current_database')) return { rows: [{ db: 'sigd_jacobo_demo' }] };
        if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.aplicacion_pago' }] };
        if (sql.includes('sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o')) {
          return { rows: [{ tiene_orden: true, verificado: pagado, importe: '100.00', importe_pagado: pagado ? '100.00' : '0.00', tiene_devolucion_activa: false }] };
        }
        if (sql.includes('FROM sigd_tes.pago p')) {
          return pagado ? { rows: [{ pago_id: PAGO_ID, orden_id: ORDEN_ID, verificado_en: new Date('2026-11-23T08:00:00-05:00'), fecha_operacion: new Date('2026-11-23T08:00:00-05:00'), estado: 'VERIFICADO' }] } : { rows: [] };
        }
        if (sql.includes('FROM sigd_tra.expediente_habilitacion')) return { rows: [] };
        if (sql.includes('FROM sigd_org.calendario_laboral')) return { rows: CALENDARIO_BASE_TEST };
        if (sql.includes('INSERT INTO sigd_tra.expediente_habilitacion')) return { rows: [] };
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    const antes = await obtenerOActualizarHabilitacion(mockClient, EXP_ID, new Date('2026-11-20T12:00:00-05:00'));
    pagado = true;
    const despues = await obtenerOActualizarHabilitacion(mockClient, EXP_ID, new Date('2026-11-23T08:00:00-05:00'));

    expect(antes.habilitado).toBe(false);
    expect(despues.habilitado).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Caso 16: Recepción anticipada denegada
  // -------------------------------------------------------------------------
  it('16. Recepción formal denegada si el pago de la tasa institucional aún no está acreditado', async () => {
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) return { rows: [{ codigo: 'SUZ26-006', importe: '100.00' }] };
        if (sql.includes('current_database')) return { rows: [{ db: 'sigd_jacobo_demo' }] };
        if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.aplicacion_pago' }] };
        if (sql.includes('sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o')) {
          return { rows: [{ tiene_orden: true, verificado: false, importe: '100.00', importe_pagado: '0.00', tiene_devolucion_activa: false }] };
        }
        if (sql.includes('FROM sigd_tes.pago p')) {
          return { rows: [] };
        }
        if (sql.includes('FROM sigd_tra.expediente_habilitacion')) return { rows: [] };
        if (sql.includes('FROM sigd_org.calendario_laboral')) return { rows: CALENDARIO_BASE_TEST };
        if (sql.includes('INSERT INTO sigd_tra.expediente_habilitacion')) return { rows: [] };
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    const fechaAnticipada = new Date('2026-11-19T10:00:00-05:00'); // Día 13
    await expect(exigirExpedienteHabilitadoParaRecepcion(mockClient, EXP_ID, fechaAnticipada))
      .rejects.toMatchObject({
        code: 'DEMO_PAYMENT_PENDING',
        status: 422,
      });
  });

  // -------------------------------------------------------------------------
  // Caso 17: Recepción formal autorizada
  // -------------------------------------------------------------------------
  it('17. Recepción formal autorizada: al cumplirse la acreditación del pago la verificación resuelve con éxito', async () => {
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) return { rows: [{ codigo: 'SUZ26-006', importe: '100.00' }] };
        if (sql.includes('current_database')) return { rows: [{ db: 'sigd_jacobo_demo' }] };
        if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.aplicacion_pago' }] };
        if (sql.includes('sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o')) {
          return { rows: [{ tiene_orden: true, verificado: true, importe: '100.00', importe_pagado: '100.00', tiene_devolucion_activa: false }] };
        }
        if (sql.includes('FROM sigd_tes.pago p')) {
          return { rows: [{ pago_id: PAGO_ID, orden_id: ORDEN_ID, verificado_en: new Date('2026-11-02T15:00:00Z'), fecha_operacion: new Date('2026-11-02T15:00:00Z'), estado: 'VERIFICADO' }] };
        }
        if (sql.includes('FROM sigd_tra.expediente_habilitacion')) return { rows: [] };
        if (sql.includes('FROM sigd_org.calendario_laboral')) return { rows: CALENDARIO_BASE_TEST };
        if (sql.includes('INSERT INTO sigd_tra.expediente_habilitacion')) return { rows: [] };
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    const fechaDia15 = new Date('2026-11-23T10:00:00-05:00');
    const res = await exigirExpedienteHabilitadoParaRecepcion(mockClient, EXP_ID, fechaDia15);
    expect(res.habilitado).toBe(true);
    expect(res.diasHabilesRestantes).toBe(0);
    expect(res.pagoVerificado).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Caso 18: Cruce de meses y años (Diciembre 2026 -> Enero 2027)
  // -------------------------------------------------------------------------
  it('18. Cruce de meses y años: pago en diciembre 2026 salta Navidad y Año Nuevo y habilita en enero 2027', () => {
    const calendarioFinDeAnio: DiaCalendario[] = [
      {
        fecha: '2026-12-25',
        anio: 2026,
        tipo_feriado: 'NACIONAL',
        descripcion: 'Navidad',
        unidad_territorial: 'NACIONAL',
        es_laborable: false,
        base_legal: 'D. Leg. N° 713',
      },
      {
        fecha: '2027-01-01',
        anio: 2027,
        tipo_feriado: 'NACIONAL',
        descripcion: 'Año Nuevo',
        unidad_territorial: 'NACIONAL',
        es_laborable: false,
        base_legal: 'D. Leg. N° 713',
      },
    ];

    const pagoViernesDiciembre = '2026-12-18T15:00:00.000Z'; // Viernes 18 de Diciembre 2026
    const res = calcularFechasHabilitacion15Dias(pagoViernesDiciembre, calendarioFinDeAnio);

    expect(res.fechaConfirmacionIso).toBe('2026-12-18');
    expect(res.fechaInicioComputo).toBe('2026-12-21'); // Lunes 21
    // Salta 25-Dic (Navidad), 01-Ene (Año Nuevo) y 3 fines de semana -> Martes 12 de Enero 2027
    expect(res.fechaHabilitacion).toBe('2027-01-12');
  });

  // -------------------------------------------------------------------------
  // Caso 19: Registro de inicio de plazo de 15 días hábiles al radicar trámite
  // -------------------------------------------------------------------------
  it('19. registrarInicioPlazoPago: inserta o actualiza el registro en expediente_habilitacion con fecha_vencimiento_pago y fecha_habilitacion', async () => {
    const executedQueries: string[] = [];
    const mockClient = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        executedQueries.push(sql);
        if (sql.includes('sigd_org.calendario_laboral')) {
          return { rows: CALENDARIO_BASE_TEST };
        }
        if (sql.includes('ALTER TABLE sigd_tra.expediente_habilitacion')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO sigd_tra.expediente_habilitacion')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    const fechaRadicacion = '2026-10-01T10:00:00-05:00';
    await registrarInicioPlazoPago(mockClient, EXP_ID, ORDEN_ID, fechaRadicacion);

    expect(mockClient.query).toHaveBeenCalled();
    const insertQuery = executedQueries.find((q) => q.includes('INSERT INTO sigd_tra.expediente_habilitacion'));
    expect(insertQuery).toBeDefined();
    expect(insertQuery).toContain('fecha_vencimiento_pago');
    expect(insertQuery).toContain('fecha_habilitacion');
    expect(insertQuery).toContain('estado_plazo');
  });
});
