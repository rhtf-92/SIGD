# CP-GERIC-009 — Homologación funcional propuesta del TUPA Suiza 2026

**Estado:** HOMOLOGACIÓN FUNCIONAL PROPUESTA — PENDIENTE APROBACIÓN

**Referencia de integración:** `B_GERIC` en `4e06e512fe08d01712bc0b6feb33e95ca28c1b10`

**Fuente de trabajo:** `backend/src/tools/tupa/staging/tupa-suiza-2026.staging.json`

**Alcance:** clasificación funcional de las 72 filas ya extraídas; no modifica el staging, no publica el catálogo y no inserta datos.

## 1. Criterio de homologación

Una fila se clasifica como:

- `RADICABLE_SIGD`: representa razonablemente una solicitud que puede iniciar expediente, recibir seguimiento y producir documento, constancia, certificado, inscripción, traslado, convalidación, acceso a información, resolución u otra atención administrativa documentable.
- `NO_RADICABLE_SIGD`: es un pago aislado, evaluación, actividad académica, alquiler, venta, bien o servicio sin resultado documentario independiente demostrado en la fuente.
- `REQUIERE_DECISION_INSTITUCIONAL`: la fila agrupa conceptos diferentes o no ofrece información suficiente para definir un único procedimiento sin decisión del IESTP Suiza.

La presencia de un monto no convierte una fila en procedimiento. Una solicitud mencionada como paso para adquirir o alquilar un bien tampoco transforma automáticamente esa operación comercial en trámite RutaDoc.

### 1.1 Lectura de monto y “DESCRIPCIÓN”

- `MONTO_SIMPLE`: un único monto inequívoco.
- `MONTO_COMPUESTO`: varios montos con categorías literales identificables.
- `MONTO_AMBIGUO`: montos contradictorios, múltiples sin etiqueta o incompatibles entre columnas.
- `SIN_MONTO`: la fuente no presenta monto.
- `REQUISITO_CLARO`: la fuente identifica expresamente una solicitud, vacante, ficha, informe u otro insumo exigible.
- `DESCRIPCION`: enumera pasos o actuaciones, sin poder afirmarse que todos sean requisitos del administrado.
- `CONDICION`: expresa pago, porcentaje, plazo operativo, categoría o condición económica.
- `AMBIGUO`: mezcla conceptos o presenta información incompatible.
- `SIN_DATO`: no existe texto en esa columna.

Estas etiquetas son de revisión interna y no reinterpretan el texto conservado en el staging.

## 2. Resultado numérico

| Decisión funcional | Cantidad |
|---|---:|
| `RADICABLE_SIGD` | 23 |
| `NO_RADICABLE_SIGD` | 48 |
| `REQUIERE_DECISION_INSTITUCIONAL` | 1 |
| **TOTAL** | **72** |

Comprobación: **23 + 48 + 1 = 72**.

## 3. Matriz completa de homologación

| Referencia | Pág. | Denominación literal | Clasificación original | Candidatura anterior | Decisión | Confianza | Monto | Texto “DESCRIPCIÓN” | Justificación funcional |
|---|---:|---|---|---|---|---|---|---|---|
| p1-fila-01 | 1 | Prácticas Iniciales | SERVICIO_ACADEMICO | REQUIERE_DECISION | NO_RADICABLE_SIGD | MEDIA | MONTO_SIMPLE | DESCRIPCION | Control académico y pago; no se identifica resultado documental independiente. |
| p1-fila-02 | 1 | Prácticas Intermedias | SERVICIO_ACADEMICO | REQUIERE_DECISION | NO_RADICABLE_SIGD | MEDIA | MONTO_SIMPLE | DESCRIPCION | Mismo tratamiento que prácticas iniciales; actividad académica, no trámite demostrado. |
| p1-fila-03 | 1 | Prácticas Finales | SERVICIO_ACADEMICO | REQUIERE_DECISION | NO_RADICABLE_SIGD | MEDIA | MONTO_SIMPLE | DESCRIPCION | Mismo tratamiento que las demás prácticas; no consta resultado documentario. |
| p1-fila-04 | 1 | Experiencias Formativas en Situaciones Reales de Trabajo (I, II, III y IV) Por cada Módulo | SERVICIO_ACADEMICO | REQUIERE_DECISION | NO_RADICABLE_SIGD | MEDIA | MONTO_SIMPLE | REQUISITO_CLARO | El informe organiza supervisión académica; no acredita procedimiento administrativo independiente. |
| p1-fila-05 | 1 | Certificado Modular (I, II, III y IV) Por cada Módulo | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Produce certificado por módulo. |
| p1-fila-06 | 1 | Certificado de Inglés | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Produce un certificado identificable. |
| p1-fila-07 | 1 | Centro de Idiomas: Inglés, Portugués, Japonés Nivel Básico Paquete: 04 meses para Alumnos del IESTP “SUIZA” | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Paquete formativo; no se describe solicitud documental. |
| p1-fila-08 | 1 | Centro de Idiomas: Inglés, Portugués, Japonés Nivel Básico Paquete: 04 meses para Alumnos Externos del IESTP “SUIZA” | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Servicio formativo para externos; no procedimiento documentario demostrado. |
| p1-fila-09 | 1 | Examen de Suficiencia de Inglés y/o Portugués | SERVICIO_ACADEMICO | REQUIERE_DECISION | NO_RADICABLE_SIGD | MEDIA | MONTO_SIMPLE | CONDICION | La fila describe evaluación y pago, no emisión documental. |
| p1-fila-10 | 1 | CEPRETEC 2026 | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_COMPUESTO | AMBIGUO | Agrupa seis conceptos económicos de preparación académica, no un trámite único. |
| p2-fila-01 | 2 | Alquiler del Galpón Agrícola Para la Crianza de Pollos (Por Campaña) | BIEN_SERVICIO | REQUIERE_DECISION | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | REQUISITO_CLARO | Es alquiler contractual; solicitud y contrato son pasos del servicio, no resultado RutaDoc. |
| p2-fila-02 | 2 | Alquiler de Retroproyector | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Alquiler de equipo. |
| p2-fila-03 | 2 | Alquiler de Aulas - Diario | BIEN_SERVICIO | REQUIERE_DECISION | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | REQUISITO_CLARO | Alquiler con solicitud y autorización interna; sigue siendo servicio. |
| p2-fila-04 | 2 | Alquiler de la Cancha de Fútbol - Diario | BIEN_SERVICIO | REQUIERE_DECISION | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | REQUISITO_CLARO | Alquiler de infraestructura, no procedimiento documentario. |
| p2-fila-05 | 2 | Alquiler de Ambientes para servicio de alimentación. | BIEN_SERVICIO | REQUIERE_DECISION | NO_RADICABLE_SIGD | ALTA | MONTO_AMBIGUO | REQUISITO_CLARO | Es alquiler; además S/1,000 contradice el rango S/50–350 de la descripción. |
| p2-fila-06 | 2 | Alquiler del Auditorio. | BIEN_SERVICIO | REQUIERE_DECISION | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | REQUISITO_CLARO | Alquiler sujeto a autorización, no resultado administrativo documental. |
| p2-fila-07 | 2 | Alquiler de Laboratorio de Cómputo a Terceros | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Servicio por hora y equipo. |
| p2-fila-08 | 2 | Venta Ambulatoria Diaria | BIEN_SERVICIO | REQUIERE_DECISION | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | REQUISITO_CLARO | Autorización accesoria para una actividad comercial; no produce trámite documental independiente. |
| p2-fila-09 | 2 | Venta de Mangos (Ciento) | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | DESCRIPCION | Venta y salida de un bien físico. |
| p2-fila-10 | 2 | Venta de Patos BB | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | DESCRIPCION | Venta y salida de un bien físico. |
| p3-fila-01 | 3 | Venta de Patos Pichones, de acuerdo al Tamaño. | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_COMPUESTO | DESCRIPCION | Bien físico con precios diferenciados. |
| p3-fila-02 | 3 | Venta de Pati Pollos | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | DESCRIPCION | Venta de bien físico. |
| p3-fila-03 | 3 | Venta de Patos adultos hembras | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | DESCRIPCION | Venta de bien físico. |
| p3-fila-04 | 3 | Venta de Patos adultos machos | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_AMBIGUO | DESCRIPCION | Los dos montos no están etiquetados, pero la operación sigue siendo venta física. |
| p3-fila-05 | 3 | Venta de Porcino para consumo Kg | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | DESCRIPCION | Venta de bien físico por kilogramo. |
| p3-fila-06 | 3 | Venta de Porcino en Pie Kg | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_COMPUESTO | DESCRIPCION | Venta con categorías reproductor/carne, no procedimiento. |
| p3-fila-07 | 3 | Venta de Ganado Vacuno en pie Kg; EN | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | MEDIA | MONTO_COMPUESTO | AMBIGUO | Denominación aparentemente truncada, pero la descripción confirma venta física por categoría. |
| p3-fila-08 | 3 | Servicio de Empadre | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | DESCRIPCION | Servicio productivo, no resultado documental. |
| p4-fila-01 | 4 | FUT | PAGO_DERECHO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Es pago por formatos; el FUT sirve a otros trámites, pero no constituye uno por sí mismo. |
| p4-fila-02 | 4 | Constancia de No Adeudar (Para fines de Titulación) | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Solicitud con resultado documental: constancia. |
| p4-fila-03 | 4 | Trabajo de Aplicación Profesional (Examen Teórico Práctico) | SERVICIO_ACADEMICO | REQUIERE_DECISION | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Evaluación componente de titulación; no crear trámite independiente. |
| p4-fila-04 | 4 | Examen de Suficiencia Profesional (Examen Teórico Práctico) | SERVICIO_ACADEMICO | REQUIERE_DECISION | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Evaluación componente de titulación; no crear trámite independiente. |
| p4-fila-05 | 4 | Expedición de Título | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Produce título oficial. |
| p4-fila-06 | 4 | Certificado de Estudios Superiores (6 Semestres) | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Produce certificado de estudios. |
| p4-fila-07 | 4 | Visación de Certificado de Estudios Superiores | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Produce actuación administrativa sobre certificado. |
| p4-fila-08 | 4 | Caligrafiado de Título | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Servicio material asociado al título. |
| p4-fila-09 | 4 | Derecho de Formato de Título | PAGO_DERECHO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Componente económico/material del proceso de título. |
| p4-fila-10 | 4 | Inscripción de Título | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Actuación administrativa registral. |
| p4-fila-11 | 4 | Medallas | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Bien físico asociado a titulación. |
| p4-fila-12 | 4 | Protector de Título | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Bien físico asociado a titulación. |
| p4-fila-13 | 4 | Colación | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Ceremonia/actividad asociada; no procedimiento documental independiente. |
| p4-fila-14 | 4 | Protector de Certificado Modular | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Bien físico. |
| p4-fila-15 | 4 | Modificación de Datos del Título | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Solicita modificar un documento oficial. |
| p4-fila-16 | 4 | Derecho de duplicado de Título. | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Produce duplicado de documento oficial. |
| p5-fila-01 | 5 | Matrículas | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | REQUISITO_CLARO | Proceso académico; ficha y pagos no demuestran expediente RutaDoc. |
| p5-fila-02 | 5 | ADMISIÓN 2026 | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Proceso de admisión; la fila solo consigna pago. |
| p5-fila-03 | 5 | Guías del postulante | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Entrega de bien/material. |
| p5-fila-04 | 5 | Ingreso ADMISIÓN 2026 - Titulados | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Modalidad de admisión; no se define trámite documental en la fila. |
| p5-fila-05 | 5 | Derecho de Reincorporación (Reingreso) | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Petición administrativa para recuperar condición de estudiante. |
| p5-fila-06 | 5 | Constancia de Egresado | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Produce constancia. |
| p5-fila-07 | 5 | Certificado de Bachillerato | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Produce certificado. |
| p5-fila-08 | 5 | Constancias (Otros: de Título, estudios, de Matrícula) | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Produce constancias, aunque la futura publicación deberá definir sus variantes. |
| p5-fila-09 | 5 | Convalidación entre Planes de Estudios | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Requiere evaluación y decisión administrativa documentable. |
| p5-fila-10 | 5 | Convalidación por Unidades de Competencia | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Requiere evaluación y decisión administrativa documentable. |
| p5-fila-11 | 5 | Devolución de Expediente | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Actuación directa sobre expediente. |
| p5-fila-12 | 5 | Evaluación Extraordinaria (A) | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Evaluación académica, no resultado documental independiente. |
| p5-fila-13 | 5 | Evaluación Extraordinaria (RM 069) | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Evaluación académica. |
| p5-fila-14 | 5 | Examen de Recuperación | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Evaluación académica. |
| p5-fila-15 | 5 | Examen de Cargo | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Evaluación académica. |
| p5-fila-16 | 5 | Repitencia de Unidad Didáctica | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Condición/servicio académico, no trámite documentario demostrado. |
| p5-fila-17 | 5 | Repitencia de Semestre | SERVICIO_ACADEMICO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Condición/servicio académico. |
| p5-fila-18 | 5 | Reserva de Matrícula - Ingresantes | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | REQUISITO_CLARO | Produce Resolución Directoral. |
| p5-fila-19 | 5 | Licencia de Estudios - Estudiantes Antiguos | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | REQUISITO_CLARO | Produce Resolución Directoral. |
| p5-fila-20 | 5 | Traslado Interno | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | REQUISITO_CLARO | Requiere vacante y produce resolución. |
| p5-fila-21 | 5 | Traslado Externo | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | REQUISITO_CLARO | Incluye solicitud FUT, vacante y resolución. |
| p6-fila-01 | 6 | Demora Devolución Libro Biblioteca | PAGO_DERECHO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | DESCRIPCION | Penalidad diaria, no solicitud administrativa. |
| p6-fila-02 | 6 | Acceso a la Información Pública. S/. 10.00 por C/Hoja | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_AMBIGUO | REQUISITO_CLARO | Solicitud FUT y respuesta documental; el monto debe conciliarse antes de publicar. |
| p6-fila-03 | 6 | Búsqueda y Duplicados de Boletas (C/U) Síllabus (C/U) Otros Trámites | REQUIERE_DECISION | REQUIERE_DECISION | REQUIERE_DECISION_INSTITUCIONAL | BAJA | MONTO_SIMPLE | AMBIGUO | Agrupa duplicados, sílabos y “otros”; no permite definir un único procedimiento ni variantes seguras. |
| p6-fila-04 | 6 | Titulación de Otros Institutos Tecnológicos | PROCEDIMIENTO_DOCUMENTARIO | CANDIDATO | RADICABLE_SIGD | ALTA | MONTO_SIMPLE | REQUISITO_CLARO | Procedimiento de titulación que produce Resolución Directoral. |
| p6-fila-05 | 6 | Examen de Subsanación con Jurado | SERVICIO_ACADEMICO | REQUIERE_DECISION | RADICABLE_SIGD | MEDIA | MONTO_SIMPLE | REQUISITO_CLARO | La Resolución Directoral justifica expediente y seguimiento, aunque el núcleo sea evaluación. |
| p6-fila-06 | 6 | Prueba de Suficiencia Académica | SERVICIO_ACADEMICO | REQUIERE_DECISION | NO_RADICABLE_SIGD | MEDIA | MONTO_SIMPLE | CONDICION | Solo se acredita prueba y pago; no documento o resolución resultante. |
| p6-fila-07 | 6 | Carnets, Insignia y Distintivos | BIEN_SERVICIO | NO_CANDIDATO | NO_RADICABLE_SIGD | ALTA | MONTO_SIMPLE | CONDICION | Entrega de bienes físicos. |

## 4. Resolución de las 19 filas anteriormente ambiguas

| Referencia | Denominación literal | Motivo de ambigüedad anterior | ¿Genera razonablemente expediente? | Decisión propuesta | Confianza | Pendiente institucional |
|---|---|---|---|---|---|---|
| p1-fila-01 | Prácticas Iniciales | Pago y control académico sin salida documental. | No demostrado | NO_RADICABLE_SIGD | MEDIA | Ninguno para clasificación; podría reconsiderarse si existe procedimiento institucional separado. |
| p1-fila-02 | Prácticas Intermedias | Igual estructura que prácticas iniciales. | No demostrado | NO_RADICABLE_SIGD | MEDIA | Igual criterio. |
| p1-fila-03 | Prácticas Finales | Igual estructura que prácticas iniciales. | No demostrado | NO_RADICABLE_SIGD | MEDIA | Igual criterio. |
| p1-fila-04 | Experiencias Formativas… por cada módulo | Hay informe y supervisión, pero no solicitud/resultante. | No demostrado | NO_RADICABLE_SIGD | MEDIA | Confirmar si el informe abre un expediente institucional separado. |
| p1-fila-09 | Examen de Suficiencia de Inglés y/o Portugués | Evaluación con pago, sin documento o resolución indicada. | No | NO_RADICABLE_SIGD | MEDIA | Ninguno salvo que exista resolución no descrita. |
| p2-fila-01 | Alquiler del Galpón Agrícola… | Solicitud y contrato podrían parecer flujo documental. | No como trámite TUPA | NO_RADICABLE_SIGD | ALTA | Gestionarlo fuera del catálogo radicable. |
| p2-fila-03 | Alquiler de Aulas - Diario | Solicitud y autorización interna. | No como trámite TUPA | NO_RADICABLE_SIGD | ALTA | Ninguno para clasificación. |
| p2-fila-04 | Alquiler de la Cancha de Fútbol - Diario | Solicitud y autorización interna. | No como trámite TUPA | NO_RADICABLE_SIGD | ALTA | Ninguno para clasificación. |
| p2-fila-05 | Alquiler de Ambientes para servicio de alimentación | Monto principal contradice rango contractual. | No como trámite TUPA | NO_RADICABLE_SIGD | ALTA | Conciliar S/1,000 frente a S/50–350 para uso financiero, no para RutaDoc. |
| p2-fila-06 | Alquiler del Auditorio | Solicitud y autorización interna. | No como trámite TUPA | NO_RADICABLE_SIGD | ALTA | Ninguno para clasificación. |
| p2-fila-08 | Venta Ambulatoria Diaria | Solicitud y autorización asociadas a actividad comercial. | No como procedimiento documental | NO_RADICABLE_SIGD | ALTA | Confirmar módulo administrativo distinto si se digitaliza. |
| p3-fila-04 | Venta de Patos adultos machos | Dos montos sin etiquetas. | No | NO_RADICABLE_SIGD | ALTA | Aclarar precios antes de cualquier catálogo comercial. |
| p3-fila-07 | Venta de Ganado Vacuno en pie Kg; EN | Denominación truncada. | No | NO_RADICABLE_SIGD | MEDIA | Corregir/confirmar literal institucional antes de publicación comercial. |
| p4-fila-03 | Trabajo de Aplicación Profesional (Examen Teórico Práctico) | Es componente de titulación. | No como trámite independiente | NO_RADICABLE_SIGD | ALTA | Debe asociarse al proceso de titulación, no duplicarlo. |
| p4-fila-04 | Examen de Suficiencia Profesional (Examen Teórico Práctico) | Es componente alternativo de titulación. | No como trámite independiente | NO_RADICABLE_SIGD | ALTA | Definir modalidad dentro de titulación. |
| p6-fila-02 | Acceso a la Información Pública… | Monto S/10 por hoja frente a S/10.50. | Sí | RADICABLE_SIGD | ALTA | Conciliar monto y unidad antes de publicación. |
| p6-fila-03 | Búsqueda y Duplicados de Boletas… Síllabus… Otros | Tres conceptos y un término abierto en una sola fila. | Sí para algunos, pero no como única definición | REQUIERE_DECISION_INSTITUCIONAL | BAJA | Decidir separación, nombres, alcance y si “otros” puede publicarse. |
| p6-fila-05 | Examen de Subsanación con Jurado | Es evaluación, pero la descripción incluye resolución. | Sí, por la resolución | RADICABLE_SIGD | MEDIA | Confirmar que la resolución corresponda al resultado del procedimiento. |
| p6-fila-06 | Prueba de Suficiencia Académica | Evaluación sin resolución ni salida documental indicada. | No demostrado | NO_RADICABLE_SIGD | MEDIA | Reconsiderar solo con evidencia de resolución o certificación. |

Resultado de las 19: **2 radicables, 16 no radicables y 1 pendiente institucional**.

## 5. Candidatos técnicos para publicación futura

Los 23 registros siguientes son candidatos técnicos; **ninguno está aprobado** y todos deben conservar `PENDIENTE_VALIDACION`:

1. `p1-fila-05` — Certificado Modular.
2. `p1-fila-06` — Certificado de Inglés.
3. `p4-fila-02` — Constancia de No Adeudar.
4. `p4-fila-05` — Expedición de Título.
5. `p4-fila-06` — Certificado de Estudios Superiores.
6. `p4-fila-07` — Visación de Certificado de Estudios Superiores.
7. `p4-fila-10` — Inscripción de Título.
8. `p4-fila-15` — Modificación de Datos del Título.
9. `p4-fila-16` — Duplicado de Título.
10. `p5-fila-05` — Reincorporación.
11. `p5-fila-06` — Constancia de Egresado.
12. `p5-fila-07` — Certificado de Bachillerato.
13. `p5-fila-08` — Otras constancias.
14. `p5-fila-09` — Convalidación entre Planes de Estudios.
15. `p5-fila-10` — Convalidación por Unidades de Competencia.
16. `p5-fila-11` — Devolución de Expediente.
17. `p5-fila-18` — Reserva de Matrícula.
18. `p5-fila-19` — Licencia de Estudios.
19. `p5-fila-20` — Traslado Interno.
20. `p5-fila-21` — Traslado Externo.
21. `p6-fila-02` — Acceso a la Información Pública.
22. `p6-fila-04` — Titulación de Otros Institutos Tecnológicos.
23. `p6-fila-05` — Examen de Subsanación con Jurado.

La publicación futura exige revisión institucional de denominación, unidad monetaria, requisitos reales, vigencia y relación entre componentes. La homologación funcional no cambia `estadoValidacion` ni `referenciaAprobacion`.

## 6. Tratamiento de titulación

Las filas de titulación no representan automáticamente trámites independientes:

| Fila | Papel propuesto |
|---|---|
| p4-fila-02 | Constancia previa radicable. |
| p4-fila-03 | Evaluación/modalidad del proceso; no trámite independiente. |
| p4-fila-04 | Evaluación/modalidad alternativa; no trámite independiente. |
| p4-fila-05 | Expedición de título radicable. |
| p4-fila-08 | Servicio material de caligrafiado. |
| p4-fila-09 | Derecho/formato asociado, no procedimiento. |
| p4-fila-10 | Inscripción de título radicable. |
| p4-fila-11 a p4-fila-14 | Bienes o actividad asociados, no procedimientos independientes. |
| p4-fila-15 | Modificación del título radicable. |
| p4-fila-16 | Duplicado del título radicable. |
| p6-fila-04 | Titulación proveniente de otros institutos, radicable y con resolución. |

No existe una fila física independiente para el total de titulación; el total impreso es resumen de sección y no se convierte en registro.

## 7. Acceso a información pública

`p6-fila-02` es funcionalmente radicable porque exige solicitud en FUT y debe producir una respuesta documental. Sin embargo, **no está listo para publicación económica**: la denominación consigna `S/. 10.00 por C/Hoja` y la columna de monto consigna `S/ 10.50`. La institución debe decidir cuál cifra y unidad son vigentes.

## 8. Montos ambiguos y conceptos combinados

| Fila | Problema |
|---|---|
| p2-fila-05 | S/1,000 en monto frente a rango S/50–350 en descripción. |
| p3-fila-04 | S/50 y S/55 sin categorías que expliquen la diferencia. |
| p6-fila-02 | S/10 por hoja frente a S/10.50. |

Montos compuestos pero interpretables: `p1-fila-10`, `p3-fila-01`, `p3-fila-06` y `p3-fila-07`. No se dividen automáticamente.

Conceptos combinados que requieren atención:

- `p1-fila-10`: CEPRETEC agrupa seis montos, pero permanece no radicable.
- `p5-fila-08`: agrupa varios tipos de constancia; es radicable, pero necesita variantes antes de publicación.
- `p6-fila-03`: mezcla duplicados de boletas, sílabos y “otros trámites”; requiere decisión institucional y posible separación.

## 9. Decisiones institucionales pendientes

1. Resolver la separación y denominación de `p6-fila-03`.
2. Conciliar los montos de `p2-fila-05`, `p3-fila-04` y `p6-fila-02`.
3. Confirmar que la Resolución Directoral de `p6-fila-05` sea producto del procedimiento.
4. Definir variantes publicables para certificados, constancias y convalidaciones agrupadas.
5. Confirmar requisitos legales; la columna “DESCRIPCIÓN” no se eleva automáticamente a contrato de requisitos.
6. Mantener todas las filas en `PENDIENTE_VALIDACION` hasta aprobación de Geric/profesor.

## 10. Límites de esta etapa

- No se modificó el staging funcional.
- No se cambió `estadoValidacion` ni `referenciaAprobacion`.
- No se insertó información en PostgreSQL.
- No se modificaron TramiCore, frontend, migraciones, baseline, RutaDoc ni reportes.
- La clasificación es una propuesta funcional para revisión; no es aprobación institucional ni publicación.
