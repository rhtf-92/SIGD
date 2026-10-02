import { describe, expect, it, vi } from 'vitest';
import { catalogoCcdInicialRutaDoc, clasificadorCcdPredeterminadoRutaDoc, ServicioCcdRutaDoc } from '../../../../src/domains/rutadoc/ccd.service.js';
import { ServicioFoliacionRutaDoc } from '../../../../src/domains/rutadoc/foliacion.service.js';
import { ServicioSlaRutaDoc } from '../../../../src/domains/rutadoc/sla.service.js';
import { CalendarioLaboralRutaDoc, calendarioLaboralPredeterminadoRutaDoc } from '../../../../src/domains/rutadoc/sla.calendario.js';
import { ServicioTrazabilidadRutaDoc } from '../../../../src/domains/rutadoc/trazabilidad.service.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import type { RepositorioTrazabilidadRutaDoc } from '../../../../src/domains/rutadoc/trazabilidad.types.js';
import type { RepositorioFoliacionRutaDoc } from '../../../../src/domains/rutadoc/foliacion.types.js';

const actor: ActorRutaDoc = { id: '7', roles: ['SUPER_ADMIN'], puedeVerExpediente: () => true };
function fechaTrasDiasHabiles(inicio: string, cantidad: number): string {
  let cursor = Date.parse(`${inicio}T00:00:00.000Z`);
  let contados = 0;
  while (contados < cantidad) {
    cursor += 86_400_000;
    const dia = new Date(cursor).getUTCDay();
    if (dia !== 0 && dia !== 6) contados++;
  }
  return new Date(cursor).toISOString().slice(0, 10);
}
const fila = (secuencia: string, fechaHora: string, tipoActuacion: 'NORMAL' | 'COMPENSATORIA' = 'NORMAL') => ({
  movimientoId: `m-${secuencia}`, secuencia, fechaHora, estadoAnterior: 'REGISTRADO' as const,
  evento: tipoActuacion === 'NORMAL' ? 'RECEPCION' : 'REVERSION_ADMINISTRATIVA',
  estadoNuevo: 'RECEPCIONADO' as const, usuarioOperadorId: '7', areaDestinoId: null,
  areaAnteriorId: null, remitente: null, destinatario: null, proveido: null, datosAsociados: {}, tipoActuacion,
});

describe('ServicioTrazabilidadRutaDoc', () => {
  it('devuelve 404 si el expediente no existe', async () => {
    const repositorio = { existeExpediente: vi.fn().mockResolvedValue(false), listar: vi.fn() } as unknown as RepositorioTrazabilidadRutaDoc;
    await expect(new ServicioTrazabilidadRutaDoc(repositorio).obtener('5', actor)).rejects.toMatchObject({ status: 404 });
    expect(repositorio.listar).not.toHaveBeenCalled();
  });
  it('devuelve timeline vacío para expediente existente sin movimientos', async () => {
    const repositorio: RepositorioTrazabilidadRutaDoc = { existeExpediente: async () => true, listar: async () => [] };
    await expect(new ServicioTrazabilidadRutaDoc(repositorio).obtener('5', actor)).resolves.toEqual({ expedienteId: '5', actuaciones: [] });
  });
  it('mantiene orden determinista, estado compensatorio y duración explícita', async () => {
    const repositorio: RepositorioTrazabilidadRutaDoc = { existeExpediente: async () => true,
      listar: async () => [fila('1', '2026-01-01T10:00:00.000Z'), fila('2', '2026-01-01T10:30:00.000Z', 'COMPENSATORIA')] };
    const result = await new ServicioTrazabilidadRutaDoc(repositorio).obtener('5', actor);
    expect(result.actuaciones.map((x) => x.secuencia)).toEqual(['1', '2']);
    expect(result.actuaciones[0]).toMatchObject({ tipoActuacion: 'NORMAL', duracionMs: 1_800_000, duracionMinutos: 30 });
    expect(result.actuaciones[1].duracionMs).toBeNull();
  });
  it('deniega la lectura si el actor autenticado carece de permiso', async () => {
    const repositorio: RepositorioTrazabilidadRutaDoc = { existeExpediente: async () => true, listar: async () => [] };
    await expect(new ServicioTrazabilidadRutaDoc(repositorio).obtener('5', { ...actor, puedeVerExpediente: () => false }))
      .rejects.toMatchObject({ status: 403 });
  });
});

describe('ServicioFoliacionRutaDoc', () => {
  const folios: RepositorioFoliacionRutaDoc = {
    existeExpediente: async () => true,
    listar: async () => [
      { idDocumento: '3', folioInicio: 1, folioFin: 15, cantidadFolios: 15 },
      { idDocumento: '4', folioInicio: 16, folioFin: 16, cantidadFolios: 1 },
    ],
  };
  it('devuelve 404 para expediente ausente', async () => {
    const repo = { existeExpediente: async () => false, listar: vi.fn() } as unknown as RepositorioFoliacionRutaDoc;
    await expect(new ServicioFoliacionRutaDoc(repo).obtener('9', actor)).rejects.toMatchObject({ status: 404 });
  });
  it('retorna vacío para expediente existente sin piezas', async () => {
    await expect(new ServicioFoliacionRutaDoc({ existeExpediente: async () => true, listar: async () => [] }).obtener('9', actor)).resolves.toEqual([]);
  });
  it('preserva folios ordenados, rangos continuos y formato de cuatro dígitos', async () => {
    const result = await new ServicioFoliacionRutaDoc(folios).obtener('9', actor);
    expect(result.map((x) => x.folioInicio)).toEqual([1, 16]);
    expect(result[0]).toMatchObject({ idDocumento: '3', cantidadFolios: 15, rango: 'F. 0001 a F. 0015' });
    expect(result[1].rango).toBe('F. 0016 a F. 0016');
  });
  it('incluye metadata disponible y deja checksum nulo sin contrato DocuCore', async () => {
    const conMetadata = new ServicioFoliacionRutaDoc(folios, { obtenerMetadataDocumento: async () => ({ checksumSha256: 'a'.repeat(64), nombre: 'resolucion.pdf', tipo: 'RESOLUCION' }) });
    expect((await conMetadata.obtener('9', actor))[0]).toMatchObject({ checksumSha256: 'a'.repeat(64), nombre: 'resolucion.pdf', tipo: 'RESOLUCION' });
    expect((await new ServicioFoliacionRutaDoc(folios).obtener('9', actor))[0].checksumSha256).toBeNull();
  });
  it('nunca fabrica SHA-256 cuando el adaptador predeterminado no tiene fuente válida', async () => {
    const resultado = await new ServicioFoliacionRutaDoc(folios).obtener('9', actor);
    expect(resultado.every((folio) => folio.checksumSha256 === null)).toBe(true);
  });
  it('no divulga folios cuando falta permiso', async () => {
    await expect(new ServicioFoliacionRutaDoc(folios).obtener('9', { ...actor, puedeVerExpediente: () => false }))
      .rejects.toMatchObject({ status: 403 });
  });
});

describe('ServicioCcdRutaDoc', () => {
  it('permite catálogo vacío', async () => {
    await expect(new ServicioCcdRutaDoc({ obtenerArbol: async () => [] }).obtenerArbol()).resolves.toEqual([]);
  });
  it('ordena series y nodos por código, conservando subseries jerárquicas', async () => {
    const catalogo = [
      { id: 'b', codigo: '02', nombre: 'Serie B', tipo: 'SERIE' as const, hijos: [] },
      { id: 'a', codigo: '01', nombre: 'Serie A', tipo: 'SERIE' as const, hijos: [
        { id: 'a2', codigo: '01.02', nombre: 'Subserie 2', tipo: 'SUBSERIE' as const, hijos: [] },
        { id: 'a1', codigo: '01.01', nombre: 'Subserie 1', tipo: 'SUBSERIE' as const, hijos: [] },
      ] },
    ];
    const arbol = await new ServicioCcdRutaDoc({ obtenerArbol: async () => catalogo }).obtenerArbol();
    expect(arbol.map((n) => n.codigo)).toEqual(['01', '02']);
    expect(arbol[0].hijos.map((n) => n.codigo)).toEqual(['01.01', '01.02']);
    expect(arbol[0].tipo).toBe('SERIE');
    expect(arbol[0].hijos.map((n) => n.tipo)).toEqual(['SUBSERIE', 'SUBSERIE']);
  });
  it('usa por defecto el seed RutaDoc con jerarquía y orden estables', async () => {
    const servicio = new ServicioCcdRutaDoc();
    const primera = await servicio.obtenerArbol();
    const segunda = await servicio.obtenerArbol();
    expect(primera).toEqual(segunda);
    expect(primera).toEqual(catalogoCcdInicialRutaDoc);
    expect(primera[0]).toMatchObject({ tipo: 'SERIE', codigo: 'DEMO-01', nombre: 'Serie de ejemplo (no oficial)' });
    expect(primera[0].hijos[0]).toMatchObject({ tipo: 'SUBSERIE', codigo: 'DEMO-01.01', nombre: 'Subserie de ejemplo (no oficial)' });
  });
  it('permite sustituir el catálogo predeterminado a través del port', async () => {
    const alternativa = [{ id: 'institucional', codigo: 'A', nombre: 'Catálogo alternativo', tipo: 'SERIE' as const, hijos: [] }];
    const servicio = new ServicioCcdRutaDoc({ obtenerArbol: async () => alternativa });
    expect(await servicio.obtenerArbol()).toEqual(alternativa);
    expect(clasificadorCcdPredeterminadoRutaDoc).toBeDefined();
  });
});

describe('ServicioSlaRutaDoc', () => {
  it('usa el calendario inyectado y rechaza expediente inexistente', async () => {
    const repo = { obtenerFechaInicio: async () => null };
    await expect(new ServicioSlaRutaDoc(repo as never, { obtenerDiasNoLaborables: async () => [] }).obtener('9'))
      .rejects.toMatchObject({ status: 404 });
  });
  it('usa el calendario RutaDoc predeterminado y respeta el fin de semana', async () => {
    const repo = { obtenerFechaInicio: async () => '2026-09-25' };
    const result = await new ServicioSlaRutaDoc(repo as never, undefined, () => '2026-09-28').obtener('9');
    expect(result.diasHabilesTranscurridos).toBe(1);
    expect(result.estado).toBe('VERDE');
    expect(calendarioLaboralPredeterminadoRutaDoc).toBeDefined();
  });
  it('mantiene día hábil 30 fuera de ROJO y activa ROJO desde día 31 con el default', async () => {
    const fechaInicio = '2026-01-05';
    const repo = { obtenerFechaInicio: async () => fechaInicio };
    const alDia30 = await new ServicioSlaRutaDoc(repo as never, undefined,
      () => fechaTrasDiasHabiles(fechaInicio, 30)).obtener('9');
    const alDia31 = await new ServicioSlaRutaDoc(repo as never, undefined,
      () => fechaTrasDiasHabiles(fechaInicio, 31)).obtener('9');
    expect(alDia30).toMatchObject({ diasHabilesTranscurridos: 30, estado: 'AMARILLO' });
    expect(alDia31).toMatchObject({ diasHabilesTranscurridos: 31, estado: 'ROJO' });
  });
  it('el calendario predeterminado configura las fechas regionales documentadas', async () => {
    await expect(calendarioLaboralPredeterminadoRutaDoc.obtenerDiasNoLaborables('2026-06-23', '2026-06-25'))
      .resolves.toContain('2026-06-24');
    await expect(calendarioLaboralPredeterminadoRutaDoc.obtenerDiasNoLaborables('2026-10-12', '2026-10-14'))
      .resolves.toContain('2026-10-13');
  });
  it('admite fechas extraordinarias y listas anuales sustituibles sin tocar el motor', async () => {
    const calendario = new CalendarioLaboralRutaDoc({ diasNoLaborables: ['2026-09-29'], fechasAnuales: [{ mes: 1, dia: 2 }] });
    await expect(calendario.obtenerDiasNoLaborables('2026-09-28', '2026-09-30')).resolves.toEqual(['2026-09-29']);
    await expect(calendario.obtenerDiasNoLaborables('2026-01-01', '2026-01-03')).resolves.toEqual(['2026-01-02']);
  });
  it('permite sustituir calendario predeterminado a través del port', async () => {
    const repo = { obtenerFechaInicio: async () => '2026-09-28' };
    const reemplazo = { obtenerDiasNoLaborables: async () => ['2026-09-29'] };
    const result = await new ServicioSlaRutaDoc(repo as never, reemplazo, () => '2026-09-30').obtener('9');
    expect(result.diasHabilesTranscurridos).toBe(1);
  });
});
