--
-- PostgreSQL database dump
--

\restrict KMjL3Lg0TH2IJOyz3RTgw0MiKfsfEy1mCwGdlluJ6RW2QphzZYTPtCZ1Pn5o8ir

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
-- The source trigger sigd_org.fn_area_set_path resolves public.ltree by search_path.
SET search_path = public, pg_catalog;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: sigd_migraciones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sigd_migraciones (id, nombre_script, checksum_sha256, ejecutado_en) FROM stdin;
1	01_sigd_audit.sql	5de9a148b7807f7c24819c006139b203a8289f6a8e3c08c3350d2fbb05bdffdb	2026-10-08 19:20:05.78014+00
2	02_sigd_auth.sql	7c809dc8bed72d2e6d6ec73ea8ddf32ad5c2cbcb2eec0a6732836296d2a8ec57	2026-10-08 19:20:05.78014+00
3	03_sigd_org.sql	affa2f349edcfe27d40c82344df551feff614d91d61632fe028910806540ccef	2026-10-08 19:20:05.78014+00
4	04_sigd_doc.sql	1501bb7699bb0ab42a35ea6d68fbb0d216222e352a441ad30489b8ceab502c6d	2026-10-08 19:20:05.78014+00
5	05_sigd_tra.sql	7605846267dfda2b1b013051f57ff026d9132988bd4eb299c325ff175e186168	2026-10-08 19:20:05.78014+00
6	06_sigd_rut.sql	6858b764f495be91104a1989f97fedbc6e8de2825ff2af1c792cbd018c8dccda	2026-10-08 19:20:05.78014+00
7	07_sigd_reportes.sql	8ba30347c4e42225320ea2d82e2566f449acb6d0a92f69b42507ededf7864d99	2026-10-08 19:20:05.78014+00
8	08_sigd_tra_folio_function.sql	c1936faf1b2b22e14ad1d7a307f9e8c8ead0d539c1d24f94a6c24ceef6032ea5	2026-10-08 19:28:17.730487+00
9	09_sigd_rut_actor_uuid.sql	d67d71041ad6653778f072d31a50b161f9373371f1ca105ac64cb25559373caf	2026-10-08 19:33:20.59158+00
10	10_sigd_virtual.sql	37475180526e06b45c25fcbc01131fdd6146a54bbf5dadd7bfcd52c3b5128b07	2026-10-08 21:37:20.753692+00
11	11_sigd_mgd_contract.sql	34e9280622ad8060b563ab3990044e021a2ec9838f8575683e5db3d01b33a8ea	2026-10-08 21:37:20.753692+00
12	12_sigd_autoregistro.sql	587b45eb6f27321467bcb1a5665aee85425a17e79e4f2644a1e5f70a97389471	2026-10-08 23:10:22.837691+00
13	13_sigd_documentos_identidad.sql	5de4e5551fb5f806e006528d98986971b60a3ae42e55615baeaa1d94968f93b3	2026-10-08 23:12:24.270157+00
14	14_sigd_workflow_academico.sql	f83db9ea0581001c1369a83df4316458934c5971f54d1cef2eec3f8f6684ad13	2026-10-09 21:36:58.44112+00
15	08_sigd_auth_bloqueo_cuentas.sql	aebbc23ca7567273b46b41c1ceeb836b79c92b7d7460c4e6c8a97bd8f9e578db	2026-10-18 12:35:58.395447+00
\.


--
-- Data for Name: provincia_ubigeo; Type: TABLE DATA; Schema: sigd_auth; Owner: -
--

COPY sigd_auth.provincia_ubigeo (codigo, nombre) FROM stdin;
2501	Coronel Portillo
2502	Atalaya
2503	Padre Abad
2504	Purús
\.


--
-- Data for Name: distrito_ubigeo; Type: TABLE DATA; Schema: sigd_auth; Owner: -
--

COPY sigd_auth.distrito_ubigeo (codigo, provincia_codigo, nombre) FROM stdin;
250101	2501	Callería
250102	2501	Campoverde
250103	2501	Iparía
250104	2501	Masisea
250105	2501	Yarinacocha
250106	2501	Nueva Requena
250107	2501	Manantay
250201	2502	Raymondi
250202	2502	Sepahua
250203	2502	Tahuania
250204	2502	Yurúa
250301	2503	Padre Abad
250302	2503	Irazola
250303	2503	Curimaná
250304	2503	Neshuya
250305	2503	Alexander von Humboldt
250401	2504	Purús
\.


--
-- Data for Name: tipos_documento; Type: TABLE DATA; Schema: sigd_auth; Owner: -
--

COPY sigd_auth.tipos_documento (id_tipo_documento, codigo, descripcion, requiere_ruc, largo, vigente) FROM stdin;
1	DNI	Documento Nacional de Identidad	f	8	t
2	RUC	Registro Unico de Contribuyentes	t	11	t
\.


--
-- Data for Name: tipo_documento; Type: TABLE DATA; Schema: sigd_doc; Owner: -
--

COPY sigd_doc.tipo_documento (tipo_documental_id, codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente) FROM stdin;
10000000-0000-4000-8000-000000000001	SOLICITUD	Solicitud PDF	pdf	application/pdf	25	f	t
\.


--
-- Data for Name: tipo_tramite_tupa; Type: TABLE DATA; Schema: sigd_doc; Owner: -
--

COPY sigd_doc.tipo_tramite_tupa (tipo_tramite_id, codigo, denominacion, descripcion, unidad_organica, plazo_dias, silencio_administrativo, base_legal, vigente) FROM stdin;
00000000-0000-0000-0000-000000000001	TUPA-01	Emisión de Certificado de Estudios Oficial	Expedición de certificado oficial de estudios técnicos	Secretaría Académica	7	POSITIVO	RVM N° 277-2019-MINEDU	t
00000000-0000-0000-0000-000000000002	TUPA-02	Expedición de Título Profesional Técnico	Tramitación de título a nombre de la Nación	Dirección General	30	NEGATIVO	Ley N° 30512	t
00000000-0000-0000-0000-000000000003	TUPA-03	Convalidación de Créditos y Prácticas Pre-Profesionales	Convalidación de módulos formativos y EFSRT	Jefatura de Unidad Académica	15	POSITIVO	RVM N° 277-2019-MINEDU	t
\.


--
-- Data for Name: workflow_academico; Type: TABLE DATA; Schema: sigd_doc; Owner: -
--

COPY sigd_doc.workflow_academico (id_tramite, workflow, version, actualizado_en) FROM stdin;
413	{"cut": "EXP-2026-000413", "estado": "EN_TRAMITE", "etapas": [{"orden": 1, "codigo": "ETAPA-01", "idEtapa": 1, "requisitos": [{"cumplido": true, "descripcion": "Créditos del plan de estudios aprobados al 100%", "idRequisito": 101, "fechaCumplimiento": "2026-08-28T15:00:00.000Z"}, {"cumplido": true, "descripcion": "Constancia de egreso emitida por Secretaría Académica", "idRequisito": 102, "fechaCumplimiento": "2026-09-01T14:30:00.000Z"}], "descripcion": "Declaratoria de expedito y constancia de egreso.", "fechaInicio": "2026-09-05T17:00:00.000Z", "nombreEtapa": "Expedito", "plazoSlaDias": 5, "rolResponsable": "responsable", "unidadOrganica": "Secretaría Académica"}, {"orden": 2, "codigo": "ETAPA-02", "idEtapa": 2, "requisitos": [{"cumplido": false, "descripcion": "Acreditación de EFSRT / Prácticas Preprofesionales (384 horas)", "idRequisito": 201}, {"cumplido": false, "descripcion": "Conformidad técnica de malla curricular y notas aprobatorias", "idRequisito": 202}, {"cumplido": false, "descripcion": "No adeudo de libros, materiales o instrumentos de taller", "idRequisito": 203}], "descripcion": "Acreditación de experiencias formativas en situaciones reales de trabajo.", "nombreEtapa": "Prácticas Preprofesionales (EFSRT)", "plazoSlaDias": 5, "rolResponsable": "responsable", "unidadOrganica": "Coordinación de la Carrera DSI"}, {"orden": 3, "codigo": "ETAPA-03", "idEtapa": 3, "requisitos": [{"cumplido": false, "descripcion": "Resolución de designación de jurado evaluador", "idRequisito": 301}, {"cumplido": false, "descripcion": "Acta de examen profesional firmada por el jurado", "idRequisito": 302}, {"cumplido": false, "descripcion": "Dictamen favorable del jurado con nota mayor o igual a 13", "idRequisito": 303}], "descripcion": "Designación de jurado, sustentación y dictamen favorable.", "nombreEtapa": "Jurado y Sustentación", "plazoSlaDias": 10, "rolResponsable": "operador", "unidadOrganica": "Secretaría Académica / Jurado Evaluador"}, {"orden": 4, "codigo": "ETAPA-04", "idEtapa": 4, "requisitos": [{"cumplido": false, "descripcion": "Borrador RD con bloques Visto / Considerando / Se Resuelve", "idRequisito": 401}, {"cumplido": false, "descripcion": "Dictamen favorable conjunto de las áreas precedentes", "idRequisito": 402}], "descripcion": "Proyección y emisión del acto resolutivo institucional.", "nombreEtapa": "Emisión de Resolución", "plazoSlaDias": 5, "rolResponsable": "admin", "unidadOrganica": "Dirección General"}, {"orden": 5, "codigo": "ETAPA-05", "idEtapa": 5, "requisitos": [{"cumplido": false, "descripcion": "Firma digital PAdES-BES con sellado de tiempo TSA", "idRequisito": 501}, {"cumplido": false, "descripcion": "Estampa de Código de Verificación Digital (CVD) y QR", "idRequisito": 502}, {"cumplido": false, "descripcion": "Asiento en el Libro Oficial y registro del título ante MinEdu", "idRequisito": 503}], "descripcion": "Firma PAdES-BES, CVD, asiento oficial y registro ante MinEdu.", "nombreEtapa": "Registro MinEdu, Diploma y Asiento", "plazoSlaDias": 5, "rolResponsable": "admin", "unidadOrganica": "Dirección General"}], "programa": "Desarrollo de Sistemas de Información (DSI)", "idTramite": 413, "solicitante": {"nombres": "Lucía Fernanda", "apellidos": "Torres Vega", "idPersona": 2952, "numeroDocumento": "47120358", "correoElectronico": "ltorres@alumno.institutosuiza.edu.pe"}, "etapaActualId": 1, "fechaRegistro": "2026-09-05T16:05:00.000Z", "nombreTramite": "Expedición de Certificado de Estudios", "fechaLimiteSla": "2026-10-16T22:00:00.000Z", "slaDiasTotales": 30, "codigoProcedimiento": "PROC-ACA-01"}	1	2026-10-09 21:36:58.44112+00
414	{"cut": "EXP-2026-000414", "estado": "REGISTRADO", "etapas": [{"orden": 1, "codigo": "ETAPA-01", "idEtapa": 1, "requisitos": [{"cumplido": true, "descripcion": "Créditos del plan de estudios aprobados al 100%", "idRequisito": 101, "fechaCumplimiento": "2026-08-28T15:00:00.000Z"}, {"cumplido": true, "descripcion": "Constancia de egreso emitida por Secretaría Académica", "idRequisito": 102, "fechaCumplimiento": "2026-09-01T14:30:00.000Z"}], "descripcion": "Declaratoria de expedito y constancia de egreso.", "fechaInicio": "2026-09-05T17:00:00.000Z", "nombreEtapa": "Expedito", "plazoSlaDias": 5, "rolResponsable": "responsable", "unidadOrganica": "Secretaría Académica"}, {"orden": 2, "codigo": "ETAPA-02", "idEtapa": 2, "requisitos": [{"cumplido": false, "descripcion": "Acreditación de EFSRT / Prácticas Preprofesionales (384 horas)", "idRequisito": 201}, {"cumplido": false, "descripcion": "Conformidad técnica de malla curricular y notas aprobatorias", "idRequisito": 202}, {"cumplido": false, "descripcion": "No adeudo de libros, materiales o instrumentos de taller", "idRequisito": 203}], "descripcion": "Acreditación de experiencias formativas en situaciones reales de trabajo.", "nombreEtapa": "Prácticas Preprofesionales (EFSRT)", "plazoSlaDias": 5, "rolResponsable": "responsable", "unidadOrganica": "Coordinación de la Carrera DSI"}, {"orden": 3, "codigo": "ETAPA-03", "idEtapa": 3, "requisitos": [{"cumplido": false, "descripcion": "Resolución de designación de jurado evaluador", "idRequisito": 301}, {"cumplido": false, "descripcion": "Acta de examen profesional firmada por el jurado", "idRequisito": 302}, {"cumplido": false, "descripcion": "Dictamen favorable del jurado con nota mayor o igual a 13", "idRequisito": 303}], "descripcion": "Designación de jurado, sustentación y dictamen favorable.", "nombreEtapa": "Jurado y Sustentación", "plazoSlaDias": 10, "rolResponsable": "operador", "unidadOrganica": "Secretaría Académica / Jurado Evaluador"}, {"orden": 4, "codigo": "ETAPA-04", "idEtapa": 4, "requisitos": [{"cumplido": false, "descripcion": "Borrador RD con bloques Visto / Considerando / Se Resuelve", "idRequisito": 401}, {"cumplido": false, "descripcion": "Dictamen favorable conjunto de las áreas precedentes", "idRequisito": 402}], "descripcion": "Proyección y emisión del acto resolutivo institucional.", "nombreEtapa": "Emisión de Resolución", "plazoSlaDias": 5, "rolResponsable": "admin", "unidadOrganica": "Dirección General"}, {"orden": 5, "codigo": "ETAPA-05", "idEtapa": 5, "requisitos": [{"cumplido": false, "descripcion": "Firma digital PAdES-BES con sellado de tiempo TSA", "idRequisito": 501}, {"cumplido": false, "descripcion": "Estampa de Código de Verificación Digital (CVD) y QR", "idRequisito": 502}, {"cumplido": false, "descripcion": "Asiento en el Libro Oficial y registro del título ante MinEdu", "idRequisito": 503}], "descripcion": "Firma PAdES-BES, CVD, asiento oficial y registro ante MinEdu.", "nombreEtapa": "Registro MinEdu, Diploma y Asiento", "plazoSlaDias": 5, "rolResponsable": "admin", "unidadOrganica": "Dirección General"}], "programa": "Contabilidad", "idTramite": 414, "solicitante": {"nombres": "Miguel Ángel", "apellidos": "Ríos Paredes", "idPersona": 2963, "numeroDocumento": "48931027", "correoElectronico": "mrios@alumno.institutosuiza.edu.pe"}, "etapaActualId": 1, "fechaRegistro": "2026-09-05T16:05:00.000Z", "nombreTramite": "Convalidación de Estudios Previos", "fechaLimiteSla": "2026-10-16T22:00:00.000Z", "slaDiasTotales": 30, "codigoProcedimiento": "PROC-ACA-01"}	1	2026-10-09 21:36:58.44112+00
415	{"cut": "EXP-2026-000415", "estado": "EN_REVISION", "etapas": [{"orden": 1, "codigo": "ETAPA-01", "idEtapa": 1, "requisitos": [{"cumplido": true, "descripcion": "Créditos del plan de estudios aprobados al 100%", "idRequisito": 101, "fechaCumplimiento": "2026-08-28T15:00:00.000Z"}, {"cumplido": true, "descripcion": "Constancia de egreso emitida por Secretaría Académica", "idRequisito": 102, "fechaCumplimiento": "2026-09-01T14:30:00.000Z"}], "descripcion": "Declaratoria de expedito y constancia de egreso.", "fechaInicio": "2026-09-05T17:00:00.000Z", "nombreEtapa": "Expedito", "plazoSlaDias": 5, "rolResponsable": "responsable", "unidadOrganica": "Secretaría Académica"}, {"orden": 2, "codigo": "ETAPA-02", "idEtapa": 2, "requisitos": [{"cumplido": false, "descripcion": "Acreditación de EFSRT / Prácticas Preprofesionales (384 horas)", "idRequisito": 201}, {"cumplido": false, "descripcion": "Conformidad técnica de malla curricular y notas aprobatorias", "idRequisito": 202}, {"cumplido": false, "descripcion": "No adeudo de libros, materiales o instrumentos de taller", "idRequisito": 203}], "descripcion": "Acreditación de experiencias formativas en situaciones reales de trabajo.", "nombreEtapa": "Prácticas Preprofesionales (EFSRT)", "plazoSlaDias": 5, "rolResponsable": "responsable", "unidadOrganica": "Coordinación de la Carrera DSI"}, {"orden": 3, "codigo": "ETAPA-03", "idEtapa": 3, "requisitos": [{"cumplido": false, "descripcion": "Resolución de designación de jurado evaluador", "idRequisito": 301}, {"cumplido": false, "descripcion": "Acta de examen profesional firmada por el jurado", "idRequisito": 302}, {"cumplido": false, "descripcion": "Dictamen favorable del jurado con nota mayor o igual a 13", "idRequisito": 303}], "descripcion": "Designación de jurado, sustentación y dictamen favorable.", "nombreEtapa": "Jurado y Sustentación", "plazoSlaDias": 10, "rolResponsable": "operador", "unidadOrganica": "Secretaría Académica / Jurado Evaluador"}, {"orden": 4, "codigo": "ETAPA-04", "idEtapa": 4, "requisitos": [{"cumplido": false, "descripcion": "Borrador RD con bloques Visto / Considerando / Se Resuelve", "idRequisito": 401}, {"cumplido": false, "descripcion": "Dictamen favorable conjunto de las áreas precedentes", "idRequisito": 402}], "descripcion": "Proyección y emisión del acto resolutivo institucional.", "nombreEtapa": "Emisión de Resolución", "plazoSlaDias": 5, "rolResponsable": "admin", "unidadOrganica": "Dirección General"}, {"orden": 5, "codigo": "ETAPA-05", "idEtapa": 5, "requisitos": [{"cumplido": false, "descripcion": "Firma digital PAdES-BES con sellado de tiempo TSA", "idRequisito": 501}, {"cumplido": false, "descripcion": "Estampa de Código de Verificación Digital (CVD) y QR", "idRequisito": 502}, {"cumplido": false, "descripcion": "Asiento en el Libro Oficial y registro del título ante MinEdu", "idRequisito": 503}], "descripcion": "Firma PAdES-BES, CVD, asiento oficial y registro ante MinEdu.", "nombreEtapa": "Registro MinEdu, Diploma y Asiento", "plazoSlaDias": 5, "rolResponsable": "admin", "unidadOrganica": "Dirección General"}], "programa": "Enfermería Técnica", "idTramite": 415, "solicitante": {"nombres": "Rosa Amelia", "apellidos": "García López", "idPersona": 2974, "numeroDocumento": "50219436", "correoElectronico": "rgarcia@alumno.institutosuiza.edu.pe"}, "etapaActualId": 2, "fechaRegistro": "2026-09-05T16:05:00.000Z", "nombreTramite": "Emisión de Grado de Bachiller Técnico", "fechaLimiteSla": "2026-10-16T22:00:00.000Z", "slaDiasTotales": 30, "codigoProcedimiento": "PROC-ACA-01"}	1	2026-10-09 21:36:58.44112+00
412	{"cut": "EXP-2026-000412", "estado": "EN_REVISION", "etapas": [{"orden": 1, "codigo": "ETAPA-01", "idEtapa": 1, "fechaFin": "2026-10-09T21:58:36.732Z", "requisitos": [{"cumplido": true, "descripcion": "Créditos del plan de estudios aprobados al 100%", "idRequisito": 101, "fechaCumplimiento": "2026-08-28T15:00:00.000Z"}, {"cumplido": true, "descripcion": "Constancia de egreso emitida por Secretaría Académica", "idRequisito": 102, "fechaCumplimiento": "2026-09-01T14:30:00.000Z"}], "descripcion": "Declaratoria de expedito y constancia de egreso.", "fechaInicio": "2026-09-05T17:00:00.000Z", "nombreEtapa": "Expedito", "plazoSlaDias": 5, "rolResponsable": "responsable", "unidadOrganica": "Secretaría Académica"}, {"orden": 2, "codigo": "ETAPA-02", "idEtapa": 2, "requisitos": [{"cumplido": false, "descripcion": "Acreditación de EFSRT / Prácticas Preprofesionales (384 horas)", "idRequisito": 201}, {"cumplido": false, "descripcion": "Conformidad técnica de malla curricular y notas aprobatorias", "idRequisito": 202}, {"cumplido": false, "descripcion": "No adeudo de libros, materiales o instrumentos de taller", "idRequisito": 203}], "descripcion": "Acreditación de experiencias formativas en situaciones reales de trabajo.", "fechaInicio": "2026-10-09T21:58:36.732Z", "nombreEtapa": "Prácticas Preprofesionales (EFSRT)", "plazoSlaDias": 5, "rolResponsable": "responsable", "unidadOrganica": "Coordinación de la Carrera DSI"}, {"orden": 3, "codigo": "ETAPA-03", "idEtapa": 3, "requisitos": [{"cumplido": false, "descripcion": "Resolución de designación de jurado evaluador", "idRequisito": 301}, {"cumplido": false, "descripcion": "Acta de examen profesional firmada por el jurado", "idRequisito": 302}, {"cumplido": false, "descripcion": "Dictamen favorable del jurado con nota mayor o igual a 13", "idRequisito": 303}], "descripcion": "Designación de jurado, sustentación y dictamen favorable.", "nombreEtapa": "Jurado y Sustentación", "plazoSlaDias": 10, "rolResponsable": "operador", "unidadOrganica": "Secretaría Académica / Jurado Evaluador"}, {"orden": 4, "codigo": "ETAPA-04", "idEtapa": 4, "requisitos": [{"cumplido": false, "descripcion": "Borrador RD con bloques Visto / Considerando / Se Resuelve", "idRequisito": 401}, {"cumplido": false, "descripcion": "Dictamen favorable conjunto de las áreas precedentes", "idRequisito": 402}], "descripcion": "Proyección y emisión del acto resolutivo institucional.", "nombreEtapa": "Emisión de Resolución", "plazoSlaDias": 5, "rolResponsable": "admin", "unidadOrganica": "Dirección General"}, {"orden": 5, "codigo": "ETAPA-05", "idEtapa": 5, "requisitos": [{"cumplido": false, "descripcion": "Firma digital PAdES-BES con sellado de tiempo TSA", "idRequisito": 501}, {"cumplido": false, "descripcion": "Estampa de Código de Verificación Digital (CVD) y QR", "idRequisito": 502}, {"cumplido": false, "descripcion": "Asiento en el Libro Oficial y registro del título ante MinEdu", "idRequisito": 503}], "descripcion": "Firma PAdES-BES, CVD, asiento oficial y registro ante MinEdu.", "nombreEtapa": "Registro MinEdu, Diploma y Asiento", "plazoSlaDias": 5, "rolResponsable": "admin", "unidadOrganica": "Dirección General"}], "programa": "Desarrollo de Sistemas de Información (DSI)", "idTramite": 412, "solicitante": {"nombres": "Carlos Eduardo", "apellidos": "Mendoza Ríos", "idPersona": 2941, "numeroDocumento": "45217893", "correoElectronico": "cmendoza@alumno.institutosuiza.edu.pe"}, "etapaActualId": 2, "fechaRegistro": "2026-09-05T16:05:00.000Z", "nombreTramite": "Solicitud de Título Profesional Técnico", "fechaLimiteSla": "2026-10-16T22:00:00.000Z", "slaDiasTotales": 30, "codigoProcedimiento": "PROC-ACA-01"}	10	2026-10-09 22:01:45.72318+00
\.


--
-- Data for Name: area; Type: TABLE DATA; Schema: sigd_org; Owner: -
--

COPY sigd_org.area (area_id, codigo, nombre, area_padre_id, path, nivel, vigente, creado_en) FROM stdin;
c18c49fa-ee35-4d67-8ac5-31d5f3121738	DEMO-LOCAL	Mesa de demostracion local	\N	a.DEMO-LOCAL	1	t	2026-10-08 21:37:23.012498+00
\.


--
-- Data for Name: calendario_laboral; Type: TABLE DATA; Schema: sigd_org; Owner: -
--

COPY sigd_org.calendario_laboral (id_calendario, fecha, tipo_feriado, descripcion, unidad_territorial, es_laborable, base_legal, registrado_por, activo, creado_en, actualizado_en) FROM stdin;
c6eaa940-05b1-4039-bfcb-a7516541ec54	2026-06-24	REGIONAL_UCAYALI	Fiesta Patronal de San Juan Bautista	REGIONAL_UCAYALI	f	Ley N° 29001	\N	t	2026-10-08 19:20:05.78014+00	2026-10-08 19:20:05.78014+00
3d4bd070-0a7d-49b4-9afc-6604fe75568e	2026-10-13	REGIONAL_UCAYALI	Aniversario de Creación de Ucayali	REGIONAL_UCAYALI	f	Ley N° 29001	\N	t	2026-10-08 19:20:05.78014+00	2026-10-08 19:20:05.78014+00
\.


--
-- Data for Name: cargo; Type: TABLE DATA; Schema: sigd_org; Owner: -
--

COPY sigd_org.cargo (cargo_id, codigo, nombre, descripcion, vigente) FROM stdin;
\.


--
-- Data for Name: permiso_sistema; Type: TABLE DATA; Schema: sigd_org; Owner: -
--

COPY sigd_org.permiso_sistema (permiso_id, codigo, nombre, ambito) FROM stdin;
b3495d5f-7412-4f14-a3dc-239baa026f72	EXPEDIENTE_LEER	Leer expedientes	GLOBAL
ab8eebdc-ca7b-4159-a4a7-98ef3e60c91c	EXPEDIENTE_DERIVAR	Derivar expedientes	AREA
eb9fbce9-b98b-4db4-9c1d-d11975830d06	EXPEDIENTE_RESOLVER	Resolver expedientes	AREA
45c6652c-94d5-4853-b575-611385a22b15	FIRMA_FIRMAR	Firmar documentos oficiales	GLOBAL
dfdc948e-78a3-4574-8517-2bc9af050571	ADMIN_USUARIOS	Administrar usuarios y roles	GLOBAL
3f6d55be-d1e1-4e37-b9c8-9d7c478f87e6	REPORTE_LEER	Consultar reportes MGD	GLOBAL
\.


--
-- Data for Name: rol_sistema; Type: TABLE DATA; Schema: sigd_org; Owner: -
--

COPY sigd_org.rol_sistema (rol_id, codigo, nombre, descripcion, vigente) FROM stdin;
64319feb-d39b-4c77-bb46-39579c6ff3d5	ADMINISTRADOR	Administrador del Sistema	Administración técnica total de la plataforma SIGD	t
c38220ca-87a7-4966-8e02-83db89e4ed43	DIRECTOR	Director	Emisión de resoluciones directorales y firma digital	t
d565b395-a8cd-44e6-b954-a587fc24910c	SECRETARIO	Secretario Académico	Proyección y preparación de resoluciones y expedientes de titulación	t
a223a680-3c5b-4ae0-8936-3a8b22c04ced	ESPECIALISTA	Especialista	Análisis técnico y emisión de dictámenes	t
7c10786e-b874-46e6-9639-5dbf08795a0c	MESA_PARTES	Mesa de Partes	Recepción, radicación y registro de documentos	t
9e54cfee-810f-418e-adc9-66cf05d1e2bb	CIUDADANO	Ciudadano	Acceso restringido a la Casilla Electrónica del administrado	t
\.


--
-- Data for Name: rol_permiso; Type: TABLE DATA; Schema: sigd_org; Owner: -
--

COPY sigd_org.rol_permiso (rol_id, permiso_id) FROM stdin;
c38220ca-87a7-4966-8e02-83db89e4ed43	b3495d5f-7412-4f14-a3dc-239baa026f72
c38220ca-87a7-4966-8e02-83db89e4ed43	3f6d55be-d1e1-4e37-b9c8-9d7c478f87e6
\.


--
-- Data for Name: accion_compensatoria; Type: TABLE DATA; Schema: sigd_rut; Owner: -
--

COPY sigd_rut.accion_compensatoria (codigo) FROM stdin;
REVERSION_ADMINISTRATIVA
\.


--
-- Data for Name: accion_tramite; Type: TABLE DATA; Schema: sigd_rut; Owner: -
--

COPY sigd_rut.accion_tramite (codigo) FROM stdin;
RECEPCION
INICIAR_CALIFICACION
INICIAR_REVISION
DERIVACION
OBSERVACION
CORRECCION
ENVIAR_A_FIRMA
FIRMA
CIERRE
\.


--
-- Data for Name: contador_pestana_local; Type: TABLE DATA; Schema: sigd_rut; Owner: -
--

COPY sigd_rut.contador_pestana_local (pestana, cantidad) FROM stdin;
EN_TRAMITE	0
DERIVADOS	0
POR_FIRMAR	0
ATENDIDOS	0
ARCHIVADOS	0
PENDIENTES	3
\.


--
-- Data for Name: estado_tramite; Type: TABLE DATA; Schema: sigd_rut; Owner: -
--

COPY sigd_rut.estado_tramite (codigo, es_terminal) FROM stdin;
REGISTRADO	f
RECEPCIONADO	f
EN_CALIFICACION	f
DERIVADO	f
EN_REVISION	f
OBSERVADO	f
SUBSANADO	f
EN_FIRMA	f
RESUELTO	f
ARCHIVADO	t
\.


--
-- Data for Name: transicion_estado_tramite; Type: TABLE DATA; Schema: sigd_rut; Owner: -
--

COPY sigd_rut.transicion_estado_tramite (estado_anterior, evento, estado_nuevo) FROM stdin;
REGISTRADO	RECEPCION	RECEPCIONADO
RECEPCIONADO	INICIAR_CALIFICACION	EN_CALIFICACION
EN_CALIFICACION	INICIAR_REVISION	EN_REVISION
EN_CALIFICACION	DERIVACION	DERIVADO
EN_CALIFICACION	OBSERVACION	OBSERVADO
DERIVADO	RECEPCION	EN_REVISION
EN_REVISION	DERIVACION	DERIVADO
EN_REVISION	OBSERVACION	OBSERVADO
EN_REVISION	ENVIAR_A_FIRMA	EN_FIRMA
OBSERVADO	CORRECCION	SUBSANADO
SUBSANADO	INICIAR_REVISION	EN_REVISION
EN_FIRMA	FIRMA	RESUELTO
RESUELTO	CIERRE	ARCHIVADO
\.


--
-- Name: sigd_migraciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sigd_migraciones_id_seq', 15, true);


--
-- Name: tipos_documento_id_tipo_documento_seq; Type: SEQUENCE SET; Schema: sigd_auth; Owner: -
--

SELECT pg_catalog.setval('sigd_auth.tipos_documento_id_tipo_documento_seq', 2, true);


--
-- PostgreSQL database dump complete
--

\unrestrict KMjL3Lg0TH2IJOyz3RTgw0MiKfsfEy1mCwGdlluJ6RW2QphzZYTPtCZ1Pn5o8ir
