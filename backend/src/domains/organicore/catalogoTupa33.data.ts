export interface ConceptoTupaImportable {
  codigo: string;
  nombre: string;
  requisitos: string[];
  montoTexto?: string;
  dependencia?: string;
  autoridad?: string;
  plazo?: string;
}

// Transcripción operativa del TUPA institucional: los conceptos se versionan al importarse.
export const CONCEPTOS_TUPA_33: readonly ConceptoTupaImportable[] = [
  ['01','Certificado de estudios','Solicitud FUT|Constancia de No Adeudar|Una fotografía tamaño pasaporte|Derecho de trámite (recibo)','S/. 11.00 por semestre; S/. 2.00','Mesa de Partes / Secretaría Académica','Dirección General','05 días hábiles'],
  ['02','Convalidación de estudios interna y externa','Solicitud FUT|Certificados de Estudios Original|Recibo por Derecho de convalidación|Sílabo','S/. 25.00 por asignatura interna; S/. 30.00 externa','Mesa de Partes / Unidad Académica','Unidad Académica','Cronograma'],
  ['03','Constancia de aprobación de prácticas','Solicitud FUT|Recibo de pago por formato','S/. 3.00','Mesa de Partes / Secretaría Académica','Secretaría General','01 día hábil'],
  ['04','Carta de presentación','Solicitud FUT|Constancia de Aprobación de Prácticas|Pago por Formato (03 ejemplares)','S/. 3.00','Mesa de Partes','Unidad Académica','01 día'],
  ['05','Aprobación de borrador de informe de práctica profesional','Solicitud FUT|Un ejemplar - borrador|Recibo de pago por derecho|Revisión de informe y/o Monografía','S/. 20.00','Mesa de Partes / Jefe de Área Académica / Docentes','Jefe de Área Académica / Unidad Académica','07 días'],
  ['06','Calificación de informe de práctica','Solicitud FUT|Ficha de Evaluación del Informe|Recibo de pago','Gratuito','Área Académica / Docente','Jefe de Área Académica / Unidad Académica','02 días'],
  ['07','Convalidación de informes de prácticas empresariales','Solicitud FUT|Carpeta de práctica|Fichas de evaluación|Resolución Directoral|Recibo de Pago','S/. 150.00 por nivel','Área Académica','Dirección General','03 días'],
  ['08','Módulo I-A al VI-A / Módulo I-B al VI-B','Solicitud FUT|Fichas de evaluación|Resolución Directoral|Recibo de Pago','S/. 75.00 semestral; S/. 150.00 anual'],
  ['09','Derecho de titulación','Solicitud FUT|Certificados originales|Partida de nacimiento|Constancias de prácticas|Recibos de pago','Tasas según concepto de titulación','Mesa de Partes / Secretaría General',undefined,'15 días'],
  ['10','Constancia de no adeudar','Recibo de Pago','S/. 2.00','Administración / Biblioteca','Administración','01 día'],
  ['11','Constancia de egresado','Solicitud FUT|Recibo de Pago','S/. 5.00','Mesa de Partes / Secretaría Académica','Secretaría General','02 días'],
  ['12','Carné de estudiante','Recibo de Pago','S/. 10.00','Biblioteca'],
  ['13','Evaluación extraordinaria / subsanación de asignatura','Solicitud FUT|Recibo de Pago','S/. 35.00','Secretaría Académica','Secretaría General','02 días'],
  ['14','Pago al momento de matricularse','Solicitud FUT|Recibo de Pago|Requisito según concepto','Tasas según concepto','Secretaría Académica / Secretaría General','Dirección General','02 días'],
  ['15','Examen extraordinario de asignaturas y/o unidad didáctica','Solicitud FUT|Recibo de Pago','S/. 35.00 por asignatura / unidad didáctica','Mesa de Partes / Unidad Académica','Unidad Académica'],
  ['16','Traslado interno','Solicitud FUT|Derecho de Pago|Certificado de Estudios Originales','S/. 100.00','Mesa de Partes'],
  ['17','Traslado externo','Solicitud FUT|Constancia de Vacante|Recibo de Derecho de Pago','S/. 150.00','Mesa de Partes'],
  ['18','Record de notas','Solicitud FUT|Recibo de Pago por Semestre','S/. 3.00 c/s','Mesa de Partes / Secretaría Académica','Secretaría Académica','01 día'],
  ['19','Constancia de haber sustentado examen T/práctico','Solicitud FUT|Recibo de Pago','S/. 20.00','Secretaría Académica','Secretaría Académica','01 día'],
  ['20','Constancia de aprobación de examen teórico práctico antes del 2016','Solicitud|Recibo de Pago','S/. 30.00','Secretaría Académica','Secretaría Académica','01 día'],
  ['21','Aprobación del plan de proyecto, reparación, mantenimiento, implementación, producción, servicio e investigación','Solicitud FUT|Plan de Proyecto|Formato de Resolución|Recibo de Pago','Tasas vigentes según R.D. N.º 048','Área Académica','Dirección General / Unidad Académica','05 días'],
  ['22','Examen teórico práctico','Solicitud FUT|Derecho de Examen|Certificado de Estudios|Acta de Evaluación|Constancias','Tasas según concepto','Mesa de Partes','Unidad Académica'],
  ['23','Constancia de expedito','Formato de Expedito - Abastecimientos|Solicitud FUT','S/. 5.00','Abastecimientos / Áreas Académicas',undefined,'01 día'],
  ['24','Certificación por módulo semestral y anual','Solicitud FUT|Constancia de Aprobación de Módulo|Recibo de Pago','S/. 20.00','Secretaría Académica / Dirección General'],
  ['25','Certificados de estudios urgentes','Solicitud FUT|Constancia de No Adeudar|Fotografía|Derecho de trámite','S/. 15.00','Secretaría Académica',undefined,'01 día'],
  ['26','Actualización de matrícula - reentrante','Solicitud FUT|Record de Notas','S/. 50.00','Mesa de Partes','Dirección General'],
  ['27','Certificado de egresado','Solicitud FUT|Recibo de Pago','S/. 15.00','Dirección General','Dirección General','01 día'],
  ['28','Constancia de ingreso','Recibo de Pago','S/. 10.00','Secretaría Académica','Secretaría Académica','01 día'],
  ['29','Devolución de expediente - estudiantes semestre I','Recibo de Pago|Solicitud','S/. 10.00','Secretaría Académica','Secretaría Académica','01 día'],
  ['30','Autorización de titulación de otras instituciones','Solicitud|Constancia de Prácticas|Certificado de Estudios|Constancia de autorización|Recibo de Pago','S/. 50.00','Secretaría Académica','Dirección General','07 días'],
  ['31','Reserva de matrícula, ingreso y/o vacante','Solicitud|Constancia de Matrícula|Recibo de Pago','S/. 30.00','Secretaría Académica','Dirección General','15 días'],
  ['32','Traslado de matrícula externa a otras instituciones','Solicitud|Certificado de Estudios Superiores|Recibo de Pago','S/. 150.00','Secretaría Académica','Dirección General','07 días'],
  ['33','Traslado externo de otras instituciones','Solicitud|Certificado de Estudios Superiores|Recibo de Pago','S/. 150.00','Secretaría Académica','Dirección General','Cronograma'],
].map(([codigo, nombre, requisitos, montoTexto, dependencia, autoridad, plazo]) => ({ codigo: codigo ?? '', nombre: nombre ?? '', requisitos: (requisitos ?? '').split('|'), montoTexto, dependencia, autoridad, plazo }));
