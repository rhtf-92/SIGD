/**
 * DATA & STATE MANAGEMENT - MÓDULO DE GESTIÓN DE EXPEDIENTES
 * Provee datos iniciales realistas con formato institucional peruano y persistencia en LocalStorage
 */

const STORAGE_KEY = 'SGD_EXPEDIENTES_DATA_V1';

const AREAS_INSTITUCIONALES = [
  { id: 'MESA_PARTES', nombre: 'Mesa de Partes', icon: 'inbox' },
  { id: 'GDU', nombre: 'Gerencia de Desarrollo Urbano', icon: 'building-2' },
  { id: 'SGOP', nombre: 'Subgerencia de Obras Privadas', icon: 'hard-hat' },
  { id: 'GAJ', nombre: 'Gerencia de Asesoría Jurídica', icon: 'scale' },
  { id: 'SG', nombre: 'Secretaría General', icon: 'landmark' },
  { id: 'GAT', nombre: 'Gerencia de Administración Tributaria', icon: 'badge-percent' },
  { id: 'SGCAT', nombre: 'Subgerencia de Catastro', icon: 'map' },
  { id: 'GSPMA', nombre: 'Gerencia de Servicios Públicos', icon: 'trees' }
];

const TIPOS_TRAMITE = [
  'Licencia de Edificación',
  'Certificado de Parámetros Urbanísticos',
  'Certificado de Zonificación y Vías',
  'Subsanación de Observaciones',
  'Solicitud de Acceso a la Información (Ley 27806)',
  'Recurso de Reconsideración / Apelación',
  'Inspección Técnica de Seguridad (ITSE)',
  'Prescripción de Deuda Tributaria',
  'Constancia de Posesión y Numeración'
];

const PERSONAL_POR_AREA = {
  'MESA_PARTES': ['Lic. Rosa Meléndez (Recepción)', 'Tec. Carlos Ramos (Ventanilla 1)'],
  'GDU': ['Arq. Fernando Alva (Gerente)', 'Ing. Patricia Benítez (Especialista Urbano)', 'Arq. Miguel Ángel Torres (Revisor)'],
  'SGOP': ['Ing. Roberto Cárdenas (Subgerente)', 'Arq. Lucía Fernández (Evaluadora)', 'Tec. Víctor Huamán'],
  'GAJ': ['Abog. Sandra Quispe (Gerente Legal)', 'Abog. Daniel Morales (Asesor I)'],
  'SG': ['Lic. Claudia Navarro (Secretaria General)', 'Tec. Jorge Salazar'],
  'GAT': ['Econ. Martín Guevara (Gerente)', 'CPC. Elena Ríos (Fiscalizadora)'],
  'SGCAT': ['Ing. Andrés Paredes (Catastrador)', 'Tec. Sofía Villanueva'],
  'GSPMA': ['Ing. Hugo Castillo (Gerente)', 'Lic. Marisol Vega']
};

const EXPEDIENTES_SEMILLA = [
  {
    id: 'EXP-2026-000124',
    tipoDocumento: 'Solicitud',
    tipoTramite: 'Licencia de Edificación',
    asunto: 'Solicitud de Licencia de Edificación Modalidad B - Obra Nueva Multifamiliar (5 pisos)',
    folios: 48,
    prioridad: 'Urgente',
    estado: 'Pendiente',
    areaActualId: 'SGOP',
    areaActualNombre: 'Subgerencia de Obras Privadas',
    tecnicoAsignado: 'Arq. Lucía Fernández (Evaluadora)',
    solicitante: {
      tipo: 'Persona Jurídica',
      tipoDoc: 'RUC',
      numDoc: '20601234567',
      nombre: 'INVERSIONES & CONSTRUCCIONES LOS ANDES S.A.C.',
      representante: 'Ing. Renato Tarazona Silva (Gerente General)',
      correo: 'rtarazona@inversioneslosandes.pe',
      telefono: '987-654-321',
      direccion: 'Av. Las Gardenias 840, Urb. El Trébol'
    },
    fechaIngreso: '2026-08-27T09:15:00',
    fechaLimite: '2026-09-10T17:00:00',
    diasPlazoTotal: 15,
    documentos: [
      { nombre: 'Formulario Único de Edificación (FUE)', size: '2.4 MB', fecha: '2026-08-27' },
      { nombre: 'Planos de Arquitectura y Estructuras (Firmados)', size: '18.5 MB', fecha: '2026-08-27' },
      { nombre: 'Certificado de Factibilidad de Servicios Sedapal/Luz', size: '1.8 MB', fecha: '2026-08-27' }
    ],
    observaciones: [],
    movimientos: [
      {
        id: 1,
        fecha: '2026-08-27T09:15:00',
        origen: 'Mesa de Partes',
        destino: 'Subgerencia de Obras Privadas',
        usuario: 'Lic. Rosa Meléndez',
        accion: 'Recepción y Registro Digital',
        proveido: 'Pase a SGOP para revisión técnica conforme a TUPA.',
        estadoResultante: 'Pendiente'
      }
    ]
  },
  {
    id: 'EXP-2026-000125',
    tipoDocumento: 'Oficio',
    tipoTramite: 'Certificado de Parámetros Urbanísticos',
    asunto: 'Expedición de Certificado de Parámetros Urbanísticos y Edificatorios para Lote 14 Mz B',
    folios: 12,
    prioridad: 'Normal',
    estado: 'En Proceso',
    areaActualId: 'GDU',
    areaActualNombre: 'Gerencia de Desarrollo Urbano',
    tecnicoAsignado: 'Arq. Miguel Ángel Torres (Revisor)',
    solicitante: {
      tipo: 'Persona Natural',
      tipoDoc: 'DNI',
      numDoc: '45892134',
      nombre: 'JUAN CARLOS RIVERA MONTOYA',
      representante: '',
      correo: 'jc.rivera.m@gmail.com',
      telefono: '992-114-558',
      direccion: 'Jr. Los Cedros 245'
    },
    fechaIngreso: '2026-08-25T11:30:00',
    fechaLimite: '2026-09-02T17:00:00',
    diasPlazoTotal: 7,
    documentos: [
      { nombre: 'Copia Literal de Dominio Sunarp', size: '1.1 MB', fecha: '2026-08-25' },
      { nombre: 'Croquis de Ubicación Georreferenciada', size: '3.2 MB', fecha: '2026-08-25' }
    ],
    observaciones: [],
    movimientos: [
      {
        id: 1,
        fecha: '2026-08-25T11:30:00',
        origen: 'Mesa de Partes',
        destino: 'Gerencia de Desarrollo Urbano',
        usuario: 'Tec. Carlos Ramos',
        accion: 'Ingreso Virtual',
        proveido: 'Atención prioritaria según TUPA.',
        estadoResultante: 'Pendiente'
      },
      {
        id: 2,
        fecha: '2026-08-26T08:45:00',
        origen: 'Gerencia de Desarrollo Urbano',
        destino: 'Gerencia de Desarrollo Urbano',
        usuario: 'Arq. Fernando Alva',
        accion: 'Asignación a Especialista',
        proveido: 'Asignado a Arq. Torres para emisión de informe técnico.',
        estadoResultante: 'En Proceso'
      }
    ]
  },
  {
    id: 'EXP-2026-000118',
    tipoDocumento: 'Solicitud',
    tipoTramite: 'Inspección Técnica de Seguridad (ITSE)',
    asunto: 'Inspección Técnica de Seguridad en Edificaciones ITSE Posterior para Galería Comercial',
    folios: 34,
    prioridad: 'Muy Urgente',
    estado: 'Observado',
    areaActualId: 'SGOP',
    areaActualNombre: 'Subgerencia de Obras Privadas',
    tecnicoAsignado: 'Ing. Roberto Cárdenas (Subgerente)',
    solicitante: {
      tipo: 'Persona Jurídica',
      tipoDoc: 'RUC',
      numDoc: '20498765432',
      nombre: 'CORPORACIÓN COMERCIAL DEL PACÍFICO E.I.R.L.',
      representante: 'Mariela Rojas Castro',
      correo: 'administracion@ccpacifico.com',
      telefono: '978-451-223',
      direccion: 'Av. Primavera 1540'
    },
    fechaIngreso: '2026-08-20T10:00:00',
    fechaLimite: '2026-08-29T17:00:00',
    diasPlazoTotal: 8,
    documentos: [
      { nombre: 'Memoria Descriptiva de Seguridad y Evacuación', size: '4.5 MB', fecha: '2026-08-20' },
      { nombre: 'Planos de Señalización y Rutas de Escape', size: '9.1 MB', fecha: '2026-08-20' },
      { nombre: 'Acta de Observación Técnica ITSE N° 045-2026', size: '850 KB', fecha: '2026-08-24' }
    ],
    observaciones: [
      {
        id: 1,
        fecha: '2026-08-24T15:20:00',
        area: 'Subgerencia de Obras Privadas',
        inspector: 'Ing. Roberto Cárdenas',
        motivo: 'Falta de Certificado de Operatividad de Luces de Emergencia y Pozo a Tierra',
        detalle: 'Se constató que los extintores se encuentran con fecha de recarga vencida y falta constancia de pozo a tierra vigente firmada por ingeniero colegiado habilitado.',
        plazoSubsanacionDias: 3,
        notificadoAlAdministrado: true
      }
    ],
    movimientos: [
      {
        id: 1,
        fecha: '2026-08-20T10:00:00',
        origen: 'Mesa de Partes',
        destino: 'Subgerencia de Obras Privadas',
        usuario: 'Lic. Rosa Meléndez',
        accion: 'Ingreso Ordinario',
        proveido: 'Programar inspección de campo.',
        estadoResultante: 'Pendiente'
      },
      {
        id: 2,
        fecha: '2026-08-21T09:30:00',
        origen: 'Subgerencia de Obras Privadas',
        destino: 'Subgerencia de Obras Privadas',
        usuario: 'Ing. Roberto Cárdenas',
        accion: 'Evaluación Técnica',
        proveido: 'En inspección in situ.',
        estadoResultante: 'En Proceso'
      },
      {
        id: 3,
        fecha: '2026-08-24T15:20:00',
        origen: 'Subgerencia de Obras Privadas',
        destino: 'Subgerencia de Obras Privadas',
        usuario: 'Ing. Roberto Cárdenas',
        accion: 'Emisión de Acta de Observación',
        proveido: 'Expediente observado. Plazo de 3 días para subsanar.',
        estadoResultante: 'Observado'
      }
    ]
  },
  {
    id: 'EXP-2026-000109',
    tipoDocumento: 'Carta',
    tipoTramite: 'Recurso de Reconsideración / Apelación',
    asunto: 'Recurso de Apelación contra Resolución Subgerencial N° 112-2026-SGOP sobre demolición',
    folios: 65,
    prioridad: 'Urgente',
    estado: 'Derivado',
    areaActualId: 'GAJ',
    areaActualNombre: 'Gerencia de Asesoría Jurídica',
    tecnicoAsignado: 'Abog. Daniel Morales (Asesor I)',
    solicitante: {
      tipo: 'Persona Natural',
      tipoDoc: 'DNI',
      numDoc: '10748596',
      nombre: 'ESTEBAN VALLEJOS ZAVALETA',
      representante: 'Dr. Guillermo Barreda (Abogado Patrocinante)',
      correo: 'esteban.vallejos@yahoo.com',
      telefono: '998-332-110',
      direccion: 'Calle Los Pinos 320'
    },
    fechaIngreso: '2026-08-18T14:10:00',
    fechaLimite: '2026-09-08T17:00:00',
    diasPlazoTotal: 20,
    documentos: [
      { nombre: 'Escrito de Apelación Fundamentado', size: '1.9 MB', fecha: '2026-08-18' },
      { nombre: 'Copia Resolución SGOP N° 112-2026', size: '920 KB', fecha: '2026-08-18' },
      { nombre: 'Informe Pericial de Parte', size: '14.2 MB', fecha: '2026-08-18' }
    ],
    observaciones: [],
    movimientos: [
      {
        id: 1,
        fecha: '2026-08-18T14:10:00',
        origen: 'Mesa de Partes',
        destino: 'Secretaría General',
        usuario: 'Tec. Carlos Ramos',
        accion: 'Recepción Recurso Impugnativo',
        proveido: 'Elevar a Secretaría General.',
        estadoResultante: 'Pendiente'
      },
      {
        id: 2,
        fecha: '2026-08-19T10:00:00',
        origen: 'Secretaría General',
        destino: 'Gerencia de Asesoría Jurídica',
        usuario: 'Lic. Claudia Navarro',
        accion: 'Derivación para Opinión Legal',
        proveido: 'Proveído N° 088-2026: Pase a GAJ para emisión de Dictamen Legal en 15 días.',
        estadoResultante: 'Derivado'
      }
    ]
  },
  {
    id: 'EXP-2026-000095',
    tipoDocumento: 'Solicitud',
    tipoTramite: 'Certificado de Zonificación y Vías',
    asunto: 'Certificado de Zonificación y Compatibilidad de Uso para local de Farmacia',
    folios: 18,
    prioridad: 'Normal',
    estado: 'Notificado',
    areaActualId: 'GDU',
    areaActualNombre: 'Gerencia de Desarrollo Urbano',
    tecnicoAsignado: 'Ing. Patricia Benítez (Especialista Urbano)',
    solicitante: {
      tipo: 'Persona Jurídica',
      tipoDoc: 'RUC',
      numDoc: '20109988776',
      nombre: 'BOTICAS & SALUD INTEGRAL S.A.C.',
      representante: 'Q.F. Lucía Barrenechea',
      correo: 'tramites@boticasysalud.com.pe',
      telefono: '945-887-123',
      direccion: 'Av. Grau 120'
    },
    fechaIngreso: '2026-08-10T08:30:00',
    fechaLimite: '2026-08-25T17:00:00',
    diasPlazoTotal: 10,
    documentos: [
      { nombre: 'Certificado de Compatibilidad de Uso N° 055-2026-GDU', size: '1.2 MB', fecha: '2026-08-24' },
      { nombre: 'Cédula de Notificación Electrónica N° 1024', size: '320 KB', fecha: '2026-08-25' }
    ],
    observaciones: [],
    movimientos: [
      {
        id: 1,
        fecha: '2026-08-10T08:30:00',
        origen: 'Mesa de Partes',
        destino: 'Gerencia de Desarrollo Urbano',
        usuario: 'Lic. Rosa Meléndez',
        accion: 'Ingreso',
        proveido: 'Pase a GDU.',
        estadoResultante: 'Pendiente'
      },
      {
        id: 2,
        fecha: '2026-08-12T11:00:00',
        origen: 'Gerencia de Desarrollo Urbano',
        destino: 'Gerencia de Desarrollo Urbano',
        usuario: 'Ing. Patricia Benítez',
        accion: 'Evaluación Técnica Favorable',
        proveido: 'Emisión de Certificado conforme a Plano de Zonificación.',
        estadoResultante: 'En Proceso'
      },
      {
        id: 3,
        fecha: '2026-08-25T16:00:00',
        origen: 'Gerencia de Desarrollo Urbano',
        destino: 'Mesa de Partes',
        usuario: 'Lic. Claudia Navarro',
        accion: 'Notificación Digital al Administrado',
        proveido: 'Notificado vía casilla electrónica con Cédula N° 1024.',
        estadoResultante: 'Notificado'
      }
    ]
  },
  {
    id: 'EXP-2026-000082',
    tipoDocumento: 'Informe',
    tipoTramite: 'Prescripción de Deuda Tributaria',
    asunto: 'Solicitud de Declaración de Prescripción de Impuesto Predial y Arbitrios (Años 2018-2020)',
    folios: 28,
    prioridad: 'Normal',
    estado: 'Archivado',
    areaActualId: 'GAT',
    areaActualNombre: 'Gerencia de Administración Tributaria',
    tecnicoAsignado: 'Econ. Martín Guevara (Gerente)',
    solicitante: {
      tipo: 'Persona Natural',
      tipoDoc: 'DNI',
      numDoc: '08523614',
      nombre: 'MARIO HUGO PAREDES SALAZAR',
      representante: '',
      correo: 'mario.paredes@hotmail.com',
      telefono: '991-234-876',
      direccion: 'Urb. Los Álamos Mz D Lote 4'
    },
    fechaIngreso: '2026-07-28T09:00:00',
    fechaLimite: '2026-08-15T17:00:00',
    diasPlazoTotal: 15,
    documentos: [
      { nombre: 'Resolución Gerencial N° 240-2026-GAT (Declara Fundada Prescripción)', size: '1.4 MB', fecha: '2026-08-14' },
      { nombre: 'Hoja de Liquidación Tributaria Final', size: '580 KB', fecha: '2026-08-14' },
      { nombre: 'Constancia de Archivo Definitivo Legajo 2026-A', size: '210 KB', fecha: '2026-08-18' }
    ],
    observaciones: [],
    movimientos: [
      {
        id: 1,
        fecha: '2026-07-28T09:00:00',
        origen: 'Mesa de Partes',
        destino: 'Gerencia de Administración Tributaria',
        usuario: 'Tec. Carlos Ramos',
        accion: 'Ingreso',
        proveido: 'Pase a GAT para verificación de interrupción de plazos.',
        estadoResultante: 'Pendiente'
      },
      {
        id: 2,
        fecha: '2026-08-14T15:00:00',
        origen: 'Gerencia de Administración Tributaria',
        destino: 'Gerencia de Administración Tributaria',
        usuario: 'Econ. Martín Guevara',
        accion: 'Emisión de Resolución',
        proveido: 'Res. N° 240-2026-GAT emitida y notificada.',
        estadoResultante: 'Notificado'
      },
      {
        id: 3,
        fecha: '2026-08-18T10:30:00',
        origen: 'Gerencia de Administración Tributaria',
        destino: 'Archivo Central',
        usuario: 'CPC. Elena Ríos',
        accion: 'Cierre y Custodia',
        proveido: 'Trámite concluido favorablemente. Se remite al Archivo Pasivo.',
        estadoResultante: 'Archivado'
      }
    ]
  },
  {
    id: 'EXP-2026-000129',
    tipoDocumento: 'Solicitud',
    tipoTramite: 'Solicitud de Acceso a la Información (Ley 27806)',
    asunto: 'Copia digital de actas de sesiones de concejo municipal del mes de julio 2026',
    folios: 4,
    prioridad: 'Muy Urgente',
    estado: 'Pendiente',
    areaActualId: 'SG',
    areaActualNombre: 'Secretaría General',
    tecnicoAsignado: 'Lic. Claudia Navarro (Secretaria General)',
    solicitante: {
      tipo: 'Persona Natural',
      tipoDoc: 'DNI',
      numDoc: '72341908',
      nombre: 'ANDREA BEATRIZ CONDORI QUISPE',
      representante: '',
      correo: 'andrea.condori.q@gmail.com',
      telefono: '965-432-881',
      direccion: 'Av. El Sol 542'
    },
    fechaIngreso: '2026-08-28T08:10:00',
    fechaLimite: '2026-09-04T17:00:00',
    diasPlazoTotal: 5,
    documentos: [
      { nombre: 'Formato Solicitud Transparencia y Acceso', size: '420 KB', fecha: '2026-08-28' }
    ],
    observaciones: [],
    movimientos: [
      {
        id: 1,
        fecha: '2026-08-28T08:10:00',
        origen: 'Mesa de Partes',
        destino: 'Secretaría General',
        usuario: 'Lic. Rosa Meléndez',
        accion: 'Ingreso Portal de Transparencia',
        proveido: 'Plazo perentorio de Ley 27806 (5 días hábiles).',
        estadoResultante: 'Pendiente'
      }
    ]
  },
  {
    id: 'EXP-2026-000115',
    tipoDocumento: 'Solicitud',
    tipoTramite: 'Constancia de Posesión y Numeración',
    asunto: 'Asignación de Certificado de Numeración Fincas y Domicilio Fiscal Mz C Lote 12',
    folios: 16,
    prioridad: 'Normal',
    estado: 'En Proceso',
    areaActualId: 'SGCAT',
    areaActualNombre: 'Subgerencia de Catastro',
    tecnicoAsignado: 'Ing. Andrés Paredes (Catastrador)',
    solicitante: {
      tipo: 'Persona Natural',
      tipoDoc: 'DNI',
      numDoc: '41982355',
      nombre: 'RODOLFO SANCHEZ CARRANZA',
      representante: '',
      correo: 'rodolfo_sanchez@outlook.com',
      telefono: '984-112-990',
      direccion: 'Pasaje Santa Rosa 115'
    },
    fechaIngreso: '2026-08-22T10:45:00',
    fechaLimite: '2026-09-05T17:00:00',
    diasPlazoTotal: 10,
    documentos: [
      { nombre: 'Plano Perimétrico Visado', size: '5.6 MB', fecha: '2026-08-22' },
      { nombre: 'Recibo de Pago por Derecho de Trámite', size: '350 KB', fecha: '2026-08-22' }
    ],
    observaciones: [],
    movimientos: [
      {
        id: 1,
        fecha: '2026-08-22T10:45:00',
        origen: 'Mesa de Partes',
        destino: 'Subgerencia de Catastro',
        usuario: 'Tec. Carlos Ramos',
        accion: 'Recepción',
        proveido: 'Revisión de planos y verificación cartográfica.',
        estadoResultante: 'Pendiente'
      },
      {
        id: 2,
        fecha: '2026-08-24T09:10:00',
        origen: 'Subgerencia de Catastro',
        destino: 'Subgerencia de Catastro',
        usuario: 'Ing. Andrés Paredes',
        accion: 'Revisión en GIS',
        proveido: 'Generando numeración correlativa.',
        estadoResultante: 'En Proceso'
      }
    ]
  },
  {
    id: 'EXP-2026-000102',
    tipoDocumento: 'Solicitud',
    tipoTramite: 'Subsanación de Observaciones',
    asunto: 'Subsanación de observaciones técnicas a Proyecto Comercial Plaza Norte',
    folios: 52,
    prioridad: 'Urgente',
    estado: 'En Proceso',
    areaActualId: 'GDU',
    areaActualNombre: 'Gerencia de Desarrollo Urbano',
    tecnicoAsignado: 'Arq. Fernando Alva (Gerente)',
    solicitante: {
      tipo: 'Persona Jurídica',
      tipoDoc: 'RUC',
      numDoc: '20556677889',
      nombre: 'DESARROLLOS URBANOS DEL PERÚ S.A.',
      representante: 'Arq. Javier Belmont Prado',
      correo: 'jbelmont@desarrollosurbanos.pe',
      telefono: '998-774-125',
      direccion: 'Av. El Ejército 910'
    },
    fechaIngreso: '2026-08-16T14:30:00',
    fechaLimite: '2026-08-30T17:00:00',
    diasPlazoTotal: 10,
    documentos: [
      { nombre: 'Informe de Levantamiento de Observaciones', size: '3.1 MB', fecha: '2026-08-16' },
      { nombre: 'Planos Modificados Versión 2.0', size: '24.8 MB', fecha: '2026-08-16' }
    ],
    observaciones: [],
    movimientos: [
      {
        id: 1,
        fecha: '2026-08-16T14:30:00',
        origen: 'Mesa de Partes',
        destino: 'Gerencia de Desarrollo Urbano',
        usuario: 'Lic. Rosa Meléndez',
        accion: 'Reingreso de Subsanación',
        proveido: 'Verificar cumplimiento de observaciones.',
        estadoResultante: 'En Proceso'
      }
    ]
  },
  {
    id: 'EXP-2026-000073',
    tipoDocumento: 'Solicitud',
    tipoTramite: 'Licencia de Edificación',
    asunto: 'Licencia de Demolición Total de Inmueble Antiguo de 2 niveles',
    folios: 22,
    prioridad: 'Normal',
    estado: 'Observado',
    areaActualId: 'SGOP',
    areaActualNombre: 'Subgerencia de Obras Privadas',
    tecnicoAsignado: 'Arq. Lucía Fernández (Evaluadora)',
    solicitante: {
      tipo: 'Persona Natural',
      tipoDoc: 'DNI',
      numDoc: '09876543',
      nombre: 'BEATRIZ ELENA ZÚÑIGA CORTEZ',
      representante: '',
      correo: 'beatriz.zuniga@gmail.com',
      telefono: '963-852-741',
      direccion: 'Jr. Bolognesi 345'
    },
    fechaIngreso: '2026-08-05T12:00:00',
    fechaLimite: '2026-08-20T17:00:00',
    diasPlazoTotal: 15,
    documentos: [
      { nombre: 'Plan de Manejo de Residuos de Demolición', size: '2.1 MB', fecha: '2026-08-05' },
      { nombre: 'Póliza CAR de Responsabilidad Civil', size: '1.7 MB', fecha: '2026-08-05' }
    ],
    observaciones: [
      {
        id: 1,
        fecha: '2026-08-12T16:40:00',
        area: 'Subgerencia de Obras Privadas',
        inspector: 'Arq. Lucía Fernández',
        motivo: 'Falta de autorización de colindantes y plan de mitigación acústica',
        detalle: 'El inmueble colinda con predio declarado patrimonio local. Se requiere informe de evaluación estructural de muros medianeros.',
        plazoSubsanacionDias: 10,
        notificadoAlAdministrado: true
      }
    ],
    movimientos: [
      {
        id: 1,
        fecha: '2026-08-05T12:00:00',
        origen: 'Mesa de Partes',
        destino: 'Subgerencia de Obras Privadas',
        usuario: 'Tec. Carlos Ramos',
        accion: 'Recepción',
        proveido: 'Pase a SGOP.',
        estadoResultante: 'Pendiente'
      },
      {
        id: 2,
        fecha: '2026-08-12T16:40:00',
        origen: 'Subgerencia de Obras Privadas',
        destino: 'Subgerencia de Obras Privadas',
        usuario: 'Arq. Lucía Fernández',
        accion: 'Observación Técnica',
        proveido: 'Emitida observación sobre predio colindante.',
        estadoResultante: 'Observado'
      }
    ]
  }
];

class ExpedientesDB {
  static getExpedientes() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        this.saveExpedientes(EXPEDIENTES_SEMILLA);
        return EXPEDIENTES_SEMILLA;
      }
      return JSON.parse(data);
    } catch (e) {
      console.warn('Error leyendo localStorage, usando datos semilla:', e);
      return EXPEDIENTES_SEMILLA;
    }
  }

  static saveExpedientes(expedientes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expedientes));
    } catch (e) {
      console.error('Error guardando en localStorage:', e);
    }
  }

  static getById(id) {
    const list = this.getExpedientes();
    return list.find(e => e.id === id) || null;
  }

  static update(updatedExpediente) {
    const list = this.getExpedientes();
    const index = list.findIndex(e => e.id === updatedExpediente.id);
    if (index !== -1) {
      list[index] = updatedExpediente;
      this.saveExpedientes(list);
      return true;
    }
    return false;
  }

  static add(newExpediente) {
    const list = this.getExpedientes();
    list.unshift(newExpediente);
    this.saveExpedientes(list);
    return newExpediente;
  }

  static resetToDefault() {
    this.saveExpedientes(EXPEDIENTES_SEMILLA);
    return EXPEDIENTES_SEMILLA;
  }

  static generateNextCode(year = 2026) {
    const list = this.getExpedientes();
    const prefix = `EXP-${year}-`;
    const codes = list
      .map(e => e.id)
      .filter(id => id.startsWith(prefix))
      .map(id => parseInt(id.replace(prefix, ''), 10))
      .filter(n => !isNaN(n));

    const max = codes.length > 0 ? Math.max(...codes) : 100;
    const nextNum = (max + 1).toString().padStart(6, '0');
    return `${prefix}${nextNum}`;
  }
}

window.ExpedientesDB = ExpedientesDB;
window.AREAS_INSTITUCIONALES = AREAS_INSTITUCIONALES;
window.TIPOS_TRAMITE = TIPOS_TRAMITE;
window.PERSONAL_POR_AREA = PERSONAL_POR_AREA;
