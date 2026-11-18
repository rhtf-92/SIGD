-- SIGD Suiza 2026: carga EXCLUSIVAMENTE DE DATOS, posterior al esquema original.
-- No forma parte del directorio de migraciones ni modifica sus checksums.
-- Fuente: TUPA_2026_IESTP_Suiza.pdf, 6 paginas.
-- SHA-256: 377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622
-- Conceptos radicables contrastados: paginas 4, 5 y 6; codigos SUZ26 internos.
-- UUID copiados de la configuracion de desarrollo verificada, no generados/arbitrarios.
-- Plazo 30 / silencio POSITIVO: defaults tecnicos exigidos por el esquema,
-- NO valores institucionales confirmados. Se conservan advertencias en descripcion.
-- FUT y Comprobante de Pago: menciones documentales; obligatorio=false.
-- No se agregan requisitos a SUZ26-050/051/054 ni se resuelve por inferencia SUZ26-066.
-- Aplicar con psql -X -v ON_ERROR_STOP=1 -f backend/carga_tupa_suiza_2026.sql
-- Solo en una base de desarrollo/pruebas autorizada, con respaldo previo.
-- Cualquier discrepancia de UUID, datos o relacion aborta TODA la transaccion.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE sigd_doc.tipo_tramite_tupa, sigd_doc.tipo_documento,
           sigd_doc.requisito, sigd_doc.tipo_documento_requisito
  IN SHARE ROW EXCLUSIVE MODE;

DO $carga_suiza$
DECLARE
  datos CONSTANT jsonb := $datos_suiza$
{
  "tipo_tramite_tupa": [
    {
      "tipo_tramite_id": "0a802b72-04f3-4229-ba26-107cdd6804eb",
      "codigo": "SUZ26-065",
      "denominacion": "Traslado Interno",
      "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica vacante en la carrera, Resolución Directoral — Secretaría Académica, pago del derecho en Tesorería y comprobante de pago.\nDerecho de pago: S/ 309.00 (5.61 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 5.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "1c39704c-1b93-4dfd-a064-76145939028e",
      "codigo": "SUZ26-054",
      "denominacion": "Convalidación entre Planes de Estudios",
      "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería.\nDerecho de pago: S/ 46.50 (0.84 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 5.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "22ba2fef-d601-4cf4-b83d-d26f57660668",
      "codigo": "SUZ26-064",
      "denominacion": "Licencia de Estudios — estudiantes antiguos",
      "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica Resolución Directoral — Secretaría Académica y pago del derecho en Tesorería; comprobante de pago.\nDerecho de pago: S/ 66.00 (1.20 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 5.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd",
      "codigo": "SUZ26-035",
      "denominacion": "Certificado de Estudios Superiores (6 semestres)",
      "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.\nDerecho de pago: S/ 124.00 (2.24 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 4.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "36186535-00c2-43f2-b0cc-f657886ad8b5",
      "codigo": "SUZ26-068",
      "denominacion": "Acceso a la Información Pública",
      "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica solicitud dirigida a Dirección en FUT y pago del derecho en Tesorería; la relación entre las tarifas requiere aclaración.\nDerecho de pago: El cuadro muestra S/ 10.50 y también S/ 10.00 por cada hoja; consigna 0.19 % UIT vigente.\nSe conservan los importes y la referencia porcentual tal como aparecen, sin determinar su correspondencia.\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 6.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "3f865752-76a2-4922-b37b-3ba72d53ad35",
      "codigo": "SUZ26-056",
      "denominacion": "Devolución de Expediente",
      "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.\nDerecho de pago: S/ 21.00 (0.37 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 5.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "4b1e596b-80fb-4178-a4af-d4cf2e8dee9b",
      "codigo": "SUZ26-036",
      "denominacion": "Visación de Certificado de Estudios Superiores",
      "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.\nDerecho de pago: S/ 16.00 (0.29 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 4.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "5fc07beb-8d3e-458d-af3e-1e040928f711",
      "codigo": "SUZ26-051",
      "denominacion": "Constancia de Egresado",
      "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería.\nDerecho de pago: S/ 31.00\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 5.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "61c51d0b-36cb-4c5f-baa1-0052f56845d2",
      "codigo": "SUZ26-031",
      "denominacion": "Constancia de No Adeudar — para fines de titulación",
      "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.\nDerecho de pago: S/ 16.50 (0.30 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 4.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "65950f60-be67-42c7-8a76-8bb0698f7868",
      "codigo": "SUZ26-050",
      "denominacion": "Derecho de Reincorporación (Reingreso)",
      "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago en el Área de Tesorería.\nDerecho de pago: S/ 300.00\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 5.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "6c15cb58-e78f-4b00-b709-bd008ab98d47",
      "codigo": "SUZ26-066",
      "denominacion": "Traslado Externo",
      "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica solicitud en FUT dirigida al Director, vacante en la carrera, Resolución Directoral — Secretaría Académica, pago del derecho en Tesorería y comprobante de pago.\nDerecho de pago: S/ 412.00 (7.48 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 5.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "79a17912-883e-40dc-8a67-53f9669c6c01",
      "codigo": "SUZ26-052",
      "denominacion": "Certificado de Bachillerato",
      "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.\nDerecho de pago: S/ 42.00 (0.75 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 5.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "7cf2ffc4-a9c2-483f-8ac9-ac33702e1be4",
      "codigo": "SUZ26-044",
      "denominacion": "Modificación de Datos del Título",
      "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.\nDerecho de pago: S/ 269.00 (4.88 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 4.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "98b9f51d-a883-4723-a508-9a758c23c941",
      "codigo": "SUZ26-055",
      "denominacion": "Convalidación por Unidades de Competencia",
      "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.\nDerecho de pago: S/ 46.50 (0.84 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 5.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "a778cedf-c565-4d07-b74d-012550d110c2",
      "codigo": "SUZ26-034",
      "denominacion": "Expedición de Título",
      "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.\nDerecho de pago: S/ 105.00 (1.90 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 4.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "a9ff2ceb-aac8-4f31-aa9f-959231940e4d",
      "codigo": "SUZ26-045",
      "denominacion": "Derecho de duplicado de Título",
      "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.\nDerecho de pago: S/ 309.00 (5.61 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 4.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "db2b68bc-3e46-4d75-a955-4724a45def31",
      "codigo": "SUZ26-063",
      "denominacion": "Reserva de Matrícula — ingresantes",
      "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica Resolución Directoral — Secretaría Académica y pago del derecho en Tesorería; comprobante de pago.\nDerecho de pago: S/ 66.00 (1.20 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 5.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "e91295e9-ff9f-4fb0-8692-309f0366ce49",
      "codigo": "SUZ26-072",
      "denominacion": "Titulación de Otros Institutos Tecnológicos",
      "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica pago del derecho en Tesorería, comprobante de pago y Resolución Directoral — Secretaría Académica.\nDerecho de pago: S/ 515.00 (9.35 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 6.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    },
    {
      "tipo_tramite_id": "f0e1b3a9-db4a-402b-ae4c-4d8cb558afd6",
      "codigo": "SUZ26-053",
      "denominacion": "Constancias — de título, estudios o matrícula",
      "descripcion": "Rubro: Otros Servicios Académicos. El PDF enumera constancias de título, estudios y matrícula; pago del derecho en Tesorería y comprobante de pago.\nDerecho de pago: S/ 23.00 (0.41 % UIT vigente)\nCódigo técnico interno del prototipo; no figura en el PDF.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 5.\nPlazo de atención: no especificado en la fuente.\nSilencio administrativo: no especificado en la fuente.\nEstado administrativo: pendiente de validación institucional.\nLos valores almacenados en plazo_dias y silencio_administrativo son defaults técnicos obligatorios del esquema; no constituyen valores administrativos oficiales.\nLa unidad orgánica y la base legal corresponden al encabezado general del documento.",
      "unidad_organica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
      "plazo_dias": 30,
      "silencio_administrativo": "POSITIVO",
      "base_legal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
      "vigente": true
    }
  ],
  "tipo_documento": [
    {
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "codigo": "COMPROBANTE_PAGO",
      "nombre": "Comprobante de Pago",
      "extension": "pdf",
      "mime_type": "application/pdf",
      "tamano_maximo_mb": 25,
      "exige_firma": false,
      "vigente": true
    },
    {
      "tipo_documental_id": "dc156983-a824-418a-835e-5a7e104c9ca5",
      "codigo": "FUT",
      "nombre": "FUT",
      "extension": "pdf",
      "mime_type": "application/pdf",
      "tamano_maximo_mb": 25,
      "exige_firma": false,
      "vigente": true
    }
  ],
  "requisito": [
    {
      "requisito_id": "27531e8c-6877-4586-a4e5-85f426a13c32",
      "tipo_tramite_id": "a9ff2ceb-aac8-4f31-aa9f-959231940e4d",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "5b07aba6-fc08-47a7-8a83-06ba64e50d60",
      "tipo_tramite_id": "f0e1b3a9-db4a-402b-ae4c-4d8cb558afd6",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "694dc8b4-6e4d-438e-bea4-b7b36060875a",
      "tipo_tramite_id": "6c15cb58-e78f-4b00-b709-bd008ab98d47",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "6ef08626-1d96-49fe-a378-05536aed826e",
      "tipo_tramite_id": "db2b68bc-3e46-4d75-a955-4724a45def31",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "8470e215-fece-4644-9f0c-bce7b140f687",
      "tipo_tramite_id": "a778cedf-c565-4d07-b74d-012550d110c2",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "89a298d0-1b39-4677-92d5-8605d009768b",
      "tipo_tramite_id": "61c51d0b-36cb-4c5f-baa1-0052f56845d2",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "a536ea58-f88c-479b-bcbf-8695d8f5c5b5",
      "tipo_tramite_id": "98b9f51d-a883-4723-a508-9a758c23c941",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "a7a45eaa-a2e1-4a10-8dd3-15901990e0e5",
      "tipo_tramite_id": "22ba2fef-d601-4cf4-b83d-d26f57660668",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "b378885f-0588-432d-ac6d-ece91b8369fb",
      "tipo_tramite_id": "4b1e596b-80fb-4178-a4af-d4cf2e8dee9b",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "bd4febdd-d0c8-4235-9b78-a62815f968d6",
      "tipo_tramite_id": "3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "c7d0f6be-f19a-4140-9cf3-6f1985e08d4f",
      "tipo_tramite_id": "e91295e9-ff9f-4fb0-8692-309f0366ce49",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "ce69a00a-25ff-4c88-ae31-523430d72069",
      "tipo_tramite_id": "7cf2ffc4-a9c2-483f-8ac9-ac33702e1be4",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "d5e091d3-5c9a-4484-99e0-a03a6377cc1e",
      "tipo_tramite_id": "6c15cb58-e78f-4b00-b709-bd008ab98d47",
      "codigo": "FUT",
      "denominacion": "Solicitud en FUT dirigida al Director (la fuente no establece obligatoriedad de adjuntarla)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "d64fe2ff-0a6c-4666-97f1-098fd3e360df",
      "tipo_tramite_id": "3f865752-76a2-4922-b37b-3ba72d53ad35",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "d8ac567c-1011-4794-883f-88089a7675d0",
      "tipo_tramite_id": "0a802b72-04f3-4229-ba26-107cdd6804eb",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "dad8f187-7f28-4090-ae42-1d5e3124a6e1",
      "tipo_tramite_id": "36186535-00c2-43f2-b0cc-f657886ad8b5",
      "codigo": "FUT",
      "denominacion": "Solicitud dirigida a Dirección en FUT (la fuente no establece obligatoriedad de adjuntarla)",
      "obligatorio": false,
      "orden": 0
    },
    {
      "requisito_id": "ddda0703-9a29-4952-a0a5-a92cda5f8630",
      "tipo_tramite_id": "79a17912-883e-40dc-8a67-53f9669c6c01",
      "codigo": "COMPROBANTE_PAGO",
      "denominacion": "Comprobante de Pago (mención documental; la fuente no establece obligatoriedad de adjuntarlo)",
      "obligatorio": false,
      "orden": 0
    }
  ],
  "tipo_documento_requisito": [
    {
      "id_relacion": "05c399fa-6f1e-4443-9a6c-afe7eb34d01a",
      "requisito_id": "a7a45eaa-a2e1-4a10-8dd3-15901990e0e5",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "1b254916-5a74-47ad-a383-8a442d527bba",
      "requisito_id": "27531e8c-6877-4586-a4e5-85f426a13c32",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "1f32e229-eb15-4a19-83b9-8d82216263fb",
      "requisito_id": "ce69a00a-25ff-4c88-ae31-523430d72069",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "3994120e-7fc4-4701-9f1a-b4a0e352b9e3",
      "requisito_id": "d8ac567c-1011-4794-883f-88089a7675d0",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "3ea58f7b-65b2-408e-aeda-9bf9a5b762ba",
      "requisito_id": "694dc8b4-6e4d-438e-bea4-b7b36060875a",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "43577390-7ec1-499a-b53d-7fc1fbbfe476",
      "requisito_id": "bd4febdd-d0c8-4235-9b78-a62815f968d6",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "5cc34e3e-2019-4735-830c-cd36700ac649",
      "requisito_id": "d64fe2ff-0a6c-4666-97f1-098fd3e360df",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "63892af3-6562-4e27-a086-605544edc323",
      "requisito_id": "a536ea58-f88c-479b-bcbf-8695d8f5c5b5",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "71e85b72-a658-4252-af66-c4be92554caa",
      "requisito_id": "ddda0703-9a29-4952-a0a5-a92cda5f8630",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "76022db5-b2af-4a4d-9b98-dcb41100ff75",
      "requisito_id": "6ef08626-1d96-49fe-a378-05536aed826e",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "892113b2-711f-44a8-ad53-54bd8ba17565",
      "requisito_id": "dad8f187-7f28-4090-ae42-1d5e3124a6e1",
      "tipo_documental_id": "dc156983-a824-418a-835e-5a7e104c9ca5",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "aa27e318-abf3-4227-851b-d4f6069461e3",
      "requisito_id": "d5e091d3-5c9a-4484-99e0-a03a6377cc1e",
      "tipo_documental_id": "dc156983-a824-418a-835e-5a7e104c9ca5",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "ad175756-c7bd-4c76-9b05-2801ca91e62e",
      "requisito_id": "5b07aba6-fc08-47a7-8a83-06ba64e50d60",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "bb430fae-4cf3-4857-832a-b788d738e8c8",
      "requisito_id": "b378885f-0588-432d-ac6d-ece91b8369fb",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "d0cfdc57-6c2d-47d8-904a-7d824331b822",
      "requisito_id": "8470e215-fece-4644-9f0c-bce7b140f687",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "fb9a9f17-84d2-49ea-860b-f7846463bb95",
      "requisito_id": "89a298d0-1b39-4677-92d5-8605d009768b",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    },
    {
      "id_relacion": "fedbcfb8-382b-4447-ba44-9cf9f2c1417f",
      "requisito_id": "c7d0f6be-f19a-4140-9cf3-6f1985e08d4f",
      "tipo_documental_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "condicion_json_pointer": null
    }
  ]
}
$datos_suiza$::jsonb;
  fila jsonb;
  existente jsonb;
BEGIN
  IF current_database() NOT IN ('sigd_prueba', 'sigd_migraciones_test')
     AND current_database() !~ '^sigd_suiza_repro_[0-9]+$' THEN
    RAISE EXCEPTION 'Destino no autorizado para esta carga de desarrollo: %', current_database();
  END IF;
  IF (SELECT count(*) FROM sigd_doc.tipo_tramite_tupa
       WHERE (codigo, tipo_tramite_id) IN (
         ('TUPA-01', '00000000-0000-0000-0000-000000000001'::uuid),
         ('TUPA-02', '00000000-0000-0000-0000-000000000002'::uuid),
         ('TUPA-03', '00000000-0000-0000-0000-000000000003'::uuid))) <> 3 THEN
    RAISE EXCEPTION 'Falta la semilla original o sus identificadores difieren. No se sobrescribe.';
  END IF;

  -- Prevalidar TODAS las filas antes de cualquier INSERT/UPDATE.

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'tipo_tramite_tupa') LOOP
    FOR existente IN
      SELECT to_jsonb(t) FROM sigd_doc.tipo_tramite_tupa t
       WHERE t.tipo_tramite_id = (fila->>'tipo_tramite_id')::uuid
          OR (t.codigo = (fila->>'codigo'))
    LOOP
      IF existente IS DISTINCT FROM fila THEN
        RAISE EXCEPTION 'Conflicto en tipo_tramite_tupa: %. Se requiere revision; no se cambia UUID ni dato existente.', fila->>'tipo_tramite_id';
      END IF;
    END LOOP;
  END LOOP;

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'tipo_documento') LOOP
    FOR existente IN
      SELECT to_jsonb(t) FROM sigd_doc.tipo_documento t
       WHERE t.tipo_documental_id = (fila->>'tipo_documental_id')::uuid
          OR (t.codigo = (fila->>'codigo'))
    LOOP
      IF existente IS DISTINCT FROM fila THEN
        RAISE EXCEPTION 'Conflicto en tipo_documento: %. Se requiere revision; no se cambia UUID ni dato existente.', fila->>'tipo_documental_id';
      END IF;
    END LOOP;
  END LOOP;

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'requisito') LOOP
    FOR existente IN
      SELECT to_jsonb(t) FROM sigd_doc.requisito t
       WHERE t.requisito_id = (fila->>'requisito_id')::uuid
          OR (t.tipo_tramite_id = (fila->>'tipo_tramite_id')::uuid AND t.codigo = (fila->>'codigo'))
    LOOP
      IF existente IS DISTINCT FROM fila THEN
        RAISE EXCEPTION 'Conflicto en requisito: %. Se requiere revision; no se cambia UUID ni dato existente.', fila->>'requisito_id';
      END IF;
    END LOOP;
  END LOOP;

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'tipo_documento_requisito') LOOP
    FOR existente IN
      SELECT to_jsonb(t) FROM sigd_doc.tipo_documento_requisito t
       WHERE t.id_relacion = (fila->>'id_relacion')::uuid
          OR (t.requisito_id = (fila->>'requisito_id')::uuid AND t.tipo_documental_id = (fila->>'tipo_documental_id')::uuid)
    LOOP
      IF existente IS DISTINCT FROM fila THEN
        RAISE EXCEPTION 'Conflicto en tipo_documento_requisito: %. Se requiere revision; no se cambia UUID ni dato existente.', fila->>'id_relacion';
      END IF;
    END LOOP;
  END LOOP;

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'tipo_tramite_tupa') LOOP
    INSERT INTO sigd_doc.tipo_tramite_tupa
      SELECT (jsonb_populate_record(NULL::sigd_doc.tipo_tramite_tupa, fila)).*
    ON CONFLICT DO NOTHING;
  END LOOP;

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'tipo_documento') LOOP
    INSERT INTO sigd_doc.tipo_documento
      SELECT (jsonb_populate_record(NULL::sigd_doc.tipo_documento, fila)).*
    ON CONFLICT DO NOTHING;
  END LOOP;

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'requisito') LOOP
    INSERT INTO sigd_doc.requisito
      SELECT (jsonb_populate_record(NULL::sigd_doc.requisito, fila)).*
    ON CONFLICT DO NOTHING;
  END LOOP;

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'tipo_documento_requisito') LOOP
    INSERT INTO sigd_doc.tipo_documento_requisito
      SELECT (jsonb_populate_record(NULL::sigd_doc.tipo_documento_requisito, fila)).*
    ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE sigd_doc.tipo_tramite_tupa SET vigente = FALSE
   WHERE vigente = TRUE AND (codigo, tipo_tramite_id) IN (
     ('TUPA-01', '00000000-0000-0000-0000-000000000001'::uuid),
     ('TUPA-02', '00000000-0000-0000-0000-000000000002'::uuid),
     ('TUPA-03', '00000000-0000-0000-0000-000000000003'::uuid));

  -- Verificar contenido y cardinalidad antes de COMMIT.

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'tipo_tramite_tupa') LOOP
    SELECT to_jsonb(t) INTO existente FROM sigd_doc.tipo_tramite_tupa t
     WHERE t.tipo_tramite_id = (fila->>'tipo_tramite_id')::uuid;
    IF existente IS DISTINCT FROM fila THEN
      RAISE EXCEPTION 'Verificacion final fallida en tipo_tramite_tupa: %', fila->>'tipo_tramite_id';
    END IF;
  END LOOP;

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'tipo_documento') LOOP
    SELECT to_jsonb(t) INTO existente FROM sigd_doc.tipo_documento t
     WHERE t.tipo_documental_id = (fila->>'tipo_documental_id')::uuid;
    IF existente IS DISTINCT FROM fila THEN
      RAISE EXCEPTION 'Verificacion final fallida en tipo_documento: %', fila->>'tipo_documental_id';
    END IF;
  END LOOP;

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'requisito') LOOP
    SELECT to_jsonb(t) INTO existente FROM sigd_doc.requisito t
     WHERE t.requisito_id = (fila->>'requisito_id')::uuid;
    IF existente IS DISTINCT FROM fila THEN
      RAISE EXCEPTION 'Verificacion final fallida en requisito: %', fila->>'requisito_id';
    END IF;
  END LOOP;

  FOR fila IN SELECT value FROM jsonb_array_elements(datos->'tipo_documento_requisito') LOOP
    SELECT to_jsonb(t) INTO existente FROM sigd_doc.tipo_documento_requisito t
     WHERE t.id_relacion = (fila->>'id_relacion')::uuid;
    IF existente IS DISTINCT FROM fila THEN
      RAISE EXCEPTION 'Verificacion final fallida en tipo_documento_requisito: %', fila->>'id_relacion';
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM sigd_doc.tipo_tramite_tupa WHERE vigente AND codigo LIKE 'SUZ26-%') <> 19
     OR EXISTS (SELECT 1 FROM sigd_doc.tipo_tramite_tupa WHERE vigente AND codigo NOT LIKE 'SUZ26-%') THEN
    RAISE EXCEPTION 'El catalogo vigente no coincide con los 19 procedimientos previstos; no se desactivan otros registros.';
  END IF;
  IF (SELECT count(*) FROM sigd_doc.requisito r
       JOIN sigd_doc.tipo_tramite_tupa t USING (tipo_tramite_id)
       WHERE t.codigo IN (SELECT value->>'codigo' FROM jsonb_array_elements(datos->'tipo_tramite_tupa'))) <> 17
     OR (SELECT count(*) FROM sigd_doc.tipo_documento_requisito dr
          JOIN sigd_doc.requisito r USING (requisito_id)
          JOIN sigd_doc.tipo_tramite_tupa t USING (tipo_tramite_id)
          WHERE t.codigo IN (SELECT value->>'codigo' FROM jsonb_array_elements(datos->'tipo_tramite_tupa'))) <> 17 THEN
    RAISE EXCEPTION 'La configuracion documental contiene relaciones adicionales no verificadas.';
  END IF;
END;
$carga_suiza$;

SELECT count(*) AS procedimientos_suiza_vigentes
  FROM sigd_doc.tipo_tramite_tupa WHERE vigente AND codigo LIKE 'SUZ26-%';
SELECT codigo, vigente FROM sigd_doc.tipo_tramite_tupa
 WHERE codigo IN ('TUPA-01','TUPA-02','TUPA-03') ORDER BY codigo;
COMMIT;
