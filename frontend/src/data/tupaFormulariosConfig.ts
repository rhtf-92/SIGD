import {
  TUPA_SUIZA_2026_COMPLETO,
  type ItemTupaOficial,
} from './tupaSuiza2026CatalogoCompleto';
import type {
  TupaFormDefinition,
  TipoFormularioTupa,
  CampoEspecialConfig,
} from '../types/tupaFormulario.types';

function extraerPrecioNumerico(montoStr: string): number {
  if (!montoStr || montoStr.toLowerCase().includes('gratuito')) return 0.0;
  const match = montoStr.match(/S\/\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (match) {
    return parseFloat(match[1]);
  }
  const matchNum = montoStr.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (matchNum) {
    return parseFloat(matchNum[1]);
  }
  return 0.0;
}

function deducirUnidadCobro(denominacion: string, _monto: string): string {
  const d = denominacion.toLowerCase();
  if (d.includes('ciento')) return 'Ciento';
  if (d.includes('kilo') || d.includes('kg')) return 'Kilogramo';
  if (d.includes('hora')) return 'Hora';
  if (d.includes('día') || d.includes('dia')) return 'Día';
  if (d.includes('pato') || d.includes('porcino') || d.includes('cuy') || d.includes('lechón') || d.includes('pollo'))
    return 'Unidad';
  if (d.includes('vacuno') || d.includes('toro') || d.includes('vaca')) return 'Ejemplar';
  if (d.includes('alquiler')) return 'Jornada / Periodo';
  if (d.includes('por cada módulo') || d.includes('módulo')) return 'Módulo';
  if (d.includes('semestre')) return 'Semestre';
  return 'Trámite';
}

function deducirTipoFormulario(item: ItemTupaOficial): TipoFormularioTupa {
  if (item.categoria === 'BIEN_PRODUCTIVO') return 'VENTA_BIEN';
  if (item.categoria === 'ACTUACION_INTERNA') return 'ACTUACION_INTERNA';
  if (item.categoria === 'SERVICIO_ACADEMICO') return 'ACADEMICO';
  if (item.categoria === 'SERVICIO_COMERCIAL') {
    if (item.denominacion.toLowerCase().includes('alquiler')) return 'ALQUILER';
    return 'SERVICIO';
  }
  if (item.categoria === 'PROCEDIMIENTO_APROBADO' || item.categoria === 'PROCEDIMIENTO_PENDIENTE') {
    return 'DOCUMENTARIO';
  }
  return 'OTRO';
}

function generarCamposPorTipo(tipo: TipoFormularioTupa, item: ItemTupaOficial): CampoEspecialConfig[] {
  const unidad = deducirUnidadCobro(item.denominacion, item.monto);

  switch (tipo) {
    case 'VENTA_BIEN':
      return [
        {
          nombre: 'cantidad',
          etiqueta: `Cantidad solicitada (${unidad})`,
          tipo: 'number',
          obligatorio: true,
          valorPorDefecto: 1,
          ayuda: `Ingrese el número de ${unidad.toLowerCase()}s que desea adquirir.`,
        },
        {
          nombre: 'preferenciaRetiro',
          etiqueta: 'Preferencia de retiro (sujeta a confirmación)',
          tipo: 'text',
          obligatorio: false,
        },
        {
          nombre: 'telefonoContacto',
          etiqueta: 'Teléfono / WhatsApp de contacto',
          tipo: 'text',
          obligatorio: true,
          placeholder: 'Ej. 961123456',
        },
        {
          nombre: 'observacionesComerciales',
          etiqueta: 'Indicaciones o detalles de compra',
          tipo: 'textarea',
          obligatorio: false,
          placeholder: 'Indique fecha tentativa de retiro o especificaciones.',
        },
      ];

    case 'ALQUILER':
      return [
        {
          nombre: 'fechaEvento',
          etiqueta: 'Fecha programada del evento/uso',
          tipo: 'date',
          obligatorio: true,
        },
        {
          nombre: 'horaInicio',
          etiqueta: 'Hora de inicio estimada',
          tipo: 'text',
          obligatorio: true,
          placeholder: '08:00 AM',
        },
        {
          nombre: 'horaFin',
          etiqueta: 'Hora de finalización estimada',
          tipo: 'text',
          obligatorio: true,
          placeholder: '01:00 PM',
        },
        {
          nombre: 'cantidadPeriodos',
          etiqueta: `Cantidad de ${unidad}s`,
          tipo: 'number',
          obligatorio: true,
          valorPorDefecto: 1,
          ayuda: 'Cantidad de horas, días o módulos para cálculo de tarifa.',
        },
        {
          nombre: 'finalidadUso',
          etiqueta: 'Finalidad del evento o actividad',
          tipo: 'text',
          obligatorio: true,
          placeholder: 'Ej. Taller de capacitación, evento deportivo, conferencia',
        },
        {
          nombre: 'asistentesEstimados',
          etiqueta: 'Número aproximado de asistentes',
          tipo: 'number',
          obligatorio: true,
        },
        {
          nombre: 'observacionesUso',
          etiqueta: 'Requerimientos técnicos / observaciones',
          tipo: 'textarea',
          obligatorio: false,
          placeholder: 'Mobiliario, equipos multimedia, iluminación, etc.',
        },
      ];

    case 'ACADEMICO':
      return [
        {
          nombre: 'programaEstudios',
          etiqueta: 'Programa de Estudios (Carrera)',
          tipo: 'select',
          obligatorio: true,
          opciones: [
            'Desarrollo de Sistemas de Información',
            'Contabilidad',
            'Enfermería Técnica',
            'Mecánica Automotriz',
            'Electricidad Industrial',
            'Producción Agropecuaria',
            'Guía Oficial de Turismo',
            'Construcción Civil',
            'Postulante / Libre',
          ],
        },
        {
          nombre: 'periodoSemestre',
          etiqueta: 'Periodo Académico o Ciclo',
          tipo: 'text',
          obligatorio: true,
          placeholder: 'Ej. 2026-I / Ciclo IV',
        },
        {
          nombre: 'codigoEstudiante',
          etiqueta: 'Código de Matrícula / Postulante',
          tipo: 'text',
          obligatorio: false,
          placeholder: 'Ej. EST-2024-0192',
        },
        {
          nombre: 'numeroComprobante',
          etiqueta: 'N° Comprobante de Pago (Tesorería / Banco)',
          tipo: 'text',
          obligatorio: item.monto !== 'Gratuito' && item.monto !== '0',
          placeholder: 'Ej. OP-98765432',
        },
        {
          nombre: 'observacionesAcademicas',
          etiqueta: 'Observaciones / Justificación académica',
          tipo: 'textarea',
          obligatorio: false,
        },
      ];

    case 'DOCUMENTARIO':
      return [
        {
          nombre: 'programaEstudios',
          etiqueta: 'Programa de Estudios de procedencia',
          tipo: 'select',
          obligatorio: false,
          opciones: [
            'Desarrollo de Sistemas de Información',
            'Contabilidad',
            'Enfermería Técnica',
            'Mecánica Automotriz',
            'Electricidad Industrial',
            'Producción Agropecuaria',
            'Guía Oficial de Turismo',
            'Construcción Civil',
            'No Aplica (Trámite General)',
          ],
        },
        {
          nombre: 'anioEgreso',
          etiqueta: 'Año de Egreso / Promoción (si aplica)',
          tipo: 'text',
          obligatorio: false,
          placeholder: 'Ej. 2025',
        },
        {
          nombre: 'numeroComprobante',
          etiqueta: 'Número de Comprobante de Pago',
          tipo: 'text',
          obligatorio: item.monto !== 'Gratuito' && item.monto !== '0',
          placeholder: 'Ej. REC-2026-00452',
        },
        {
          nombre: 'asuntoPetitorio',
          etiqueta: 'Fundamento concreto de la solicitud',
          tipo: 'textarea',
          obligatorio: true,
          placeholder: 'Explique con claridad el petitorio formulado a la autoridad.',
        },
      ];

    case 'ACTUACION_INTERNA':
      return [
        {
          nombre: 'areaInterna',
          etiqueta: 'Área / Dependencia Solicitante',
          tipo: 'text',
          obligatorio: true,
        },
        {
          nombre: 'motivoInterno',
          etiqueta: 'Justificación administrativa interna',
          tipo: 'textarea',
          obligatorio: true,
        },
      ];

    case 'OTRO':
      return [
        { nombre: 'asunto', etiqueta: 'Asunto', tipo: 'text', obligatorio: true },
        { nombre: 'asuntoPetitorio', etiqueta: 'Petitorio', tipo: 'textarea', obligatorio: true },
        { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea', obligatorio: false },
      ];

    default:
      return [
        {
          nombre: 'detalleServicio',
          etiqueta: 'Detalle del servicio requerido',
          tipo: 'textarea',
          obligatorio: true,
        },
        {
          nombre: 'cantidad',
          etiqueta: 'Cantidad / Unidades',
          tipo: 'number',
          obligatorio: false,
          valorPorDefecto: 1,
        },
      ];
  }
}

/**
 * Catálogo completo indexado de las 72 entradas TUPA transformadas a definiciones de motor dinámico.
 */
export const TUPA_FORMULARIOS_CONFIG: readonly TupaFormDefinition[] = TUPA_SUIZA_2026_COMPLETO.map(
  (item): TupaFormDefinition => {
    const tipo = deducirTipoFormulario(item);
    const precio = extraerPrecioNumerico(item.monto);
    const unidadCobro = deducirUnidadCobro(item.denominacion, item.monto);
    const generaExpediente = item.admiteRadicacionSigd && item.categoria === 'PROCEDIMIENTO_APROBADO';
    const bloqueadoParaCiudadano = item.categoria === 'ACTUACION_INTERNA';

    let flujoDestino = 'MesaDePartesVirtual';
    if (tipo === 'VENTA_BIEN') flujoDestino = 'SolicitudComercialBienes';
    else if (tipo === 'ALQUILER') flujoDestino = 'ReservaEspacioAlquiler';
    else if (tipo === 'ACADEMICO') flujoDestino = 'ServicioAcademicoInstitucional';
    else if (tipo === 'ACTUACION_INTERNA') flujoDestino = 'DespachoInternoInstitucional';
    else if (tipo === 'SERVICIO') flujoDestino = 'SolicitudServicioInstitucional';

    return {
      codigoRef: item.codigo,
      denominacion: item.denominacion,
      categoria: item.categoria,
      tipoFormulario: tipo,
      campos: generarCamposPorTipo(tipo, item),
      requisitos: item.requisitos,
      monto: precio,
      montoTexto: item.monto,
      unidadCobro,
      generaExpediente,
      flujoDestino,
      plazo: item.plazo,
      unidadResponsable: item.unidadResponsable,
      baseLegal: item.baseLegal,
      bloqueadoParaCiudadano,
      observacion: item.observacion,
    };
  }
);

/**
 * Mapa de búsqueda rápida O(1) por código de referencia TUPA (ej. p1-fila-01).
 */
export const TUPA_FORMULARIOS_MAP: ReadonlyMap<string, TupaFormDefinition> = new Map(
  TUPA_FORMULARIOS_CONFIG.map((def) => [def.codigoRef, def])
);

/**
 * Obtiene la definición de formulario de un ítem TUPA por código.
 */
export function obtenerDefinicionTupa(codigoRef: string): TupaFormDefinition | undefined {
  return TUPA_FORMULARIOS_MAP.get(codigoRef);
}
