# CP-GERIC-010 — Propuesta de aprobación controlada del TUPA Suiza 2026

**Estado:** PROPUESTA DE APROBACIÓN LISTA — PENDIENTE DECISIÓN HUMANA

**Referencia:** `B_GERIC` en `4e06e512fe08d01712bc0b6feb33e95ca28c1b10`

**Alcance:** revisión de los 23 registros homologados funcionalmente como `RADICABLE_SIGD`. No publica, no inserta en base de datos y no cambia `estadoValidacion` ni `referenciaAprobacion`.

## 1. Aclaración inequívoca de hashes

| Archivo | SHA-256 | Función |
|---|---|---|
| `C:\Users\Geric\Desktop\WorkSpace\tupa2026\TUPA_2026_IESTP_Suiza.pdf` | `377DD8E14B8806F2030B5374120AB9B4FE17640BB98086E10C1A9A4431A33622` | **HASH DE FUENTE OFICIAL**. Identifica el PDF institucional del cual se extrajeron las filas. |
| `backend/src/tools/tupa/staging/tupa-suiza-2026.staging.json` | `828F2814B97AAF1FAB427B41DBA90EF92BD690AE47D2F81C32AA6D4D65159DE5` | **HASH DEL STAGING**. Identifica la versión física actual del JSON de preparación; puede cambiar si el archivo se modifica legítimamente. |

El hash del staging no sustituye al hash de procedencia guardado dentro de cada entrada. El valor `documentoSha256` de las 72 entradas continúa siendo el hash del PDF oficial, en minúsculas por la restricción SQL.

## 2. Revisión exacta de los 23 radicables

| Referencia | Pág. | Denominación literal | Monto original | Motivo de radicación | Confianza | Observación pendiente |
|---|---:|---|---|---|---|---|
| p1-fila-05 | 1 | Certificado Modular (I, II, III y IV) Por cada Módulo | S/ 100.00 | Produce certificado por módulo. | ALTA | Definir si será un procedimiento parametrizado o variantes por módulo. |
| p1-fila-06 | 1 | Certificado de Inglés | S/ 100.00 | Produce certificado identificable. | ALTA | Confirmar requisitos reales; la fuente solo consigna pago y boleta/venta. |
| p4-fila-02 | 4 | Constancia de No Adeudar (Para fines de Titulación) | S/ 16.50 | Produce constancia previa a titulación. | ALTA | Confirmar si se ofrece independientemente o solo dentro de titulación. |
| p4-fila-05 | 4 | Expedición de Título | S/ 105.00 | Produce título oficial. | ALTA | Coordinar con los demás componentes del proceso de titulación. |
| p4-fila-06 | 4 | Certificado de Estudios Superiores (6 Semestres) | S/ 124.00 | Produce certificado de estudios. | ALTA | La fuente no enumera requisitos documentales. |
| p4-fila-07 | 4 | Visación de Certificado de Estudios Superiores | S/ 16.00 | Produce actuación administrativa sobre un certificado. | ALTA | La fuente no enumera documento a presentar ni autoridad. |
| p4-fila-10 | 4 | Inscripción de Título | S/ 120.00 | Actuación registral asociada al título. | ALTA | Confirmar relación y orden con expedición de título. |
| p4-fila-15 | 4 | Modificación de Datos del Título | S/ 269.00 | Modifica un documento oficial. | ALTA | Confirmar requisitos y tipos de dato modificables. |
| p4-fila-16 | 4 | Derecho de duplicado de Título. | S/ 309.00 | El resultado esperado es un duplicado del título. | ALTA | La denominación dice “Derecho”; confirmar que la fila representa el trámite y no solo el pago. |
| p5-fila-05 | 5 | Derecho de Reincorporación (Reingreso) | S/ 300.00 | Petición para recuperar condición de estudiante. | ALTA | La denominación dice “Derecho”; confirmar el procedimiento canónico de reincorporación. |
| p5-fila-06 | 5 | Constancia de Egresado | S/ 31.00 | Produce constancia. | ALTA | Confirmar requisitos institucionales. |
| p5-fila-07 | 5 | Certificado de Bachillerato | S/ 42.00 | Produce certificado. | ALTA | Confirmar requisitos institucionales. |
| p5-fila-08 | 5 | Constancias (Otros: de Título, estudios, de Matrícula) | S/ 23.00 | Produce documentos de constancia. | ALTA | Definir si son variantes o procedimientos separados; no publicar como categoría abierta. |
| p5-fila-09 | 5 | Convalidación entre Planes de Estudios | S/ 46.50 | Requiere evaluación y decisión administrativa. | ALTA | Confirmar requisitos y resultado documental. |
| p5-fila-10 | 5 | Convalidación por Unidades de Competencia | S/ 46.50 | Requiere evaluación y decisión administrativa. | ALTA | Confirmar requisitos y resultado documental. |
| p5-fila-11 | 5 | Devolución de Expediente | S/ 21.00 | Actuación directa sobre un expediente. | ALTA | Definir expediente elegible, solicitante y constancia de entrega. |
| p5-fila-18 | 5 | Reserva de Matrícula - Ingresantes | S/ 66.00 | Produce Resolución Directoral. | ALTA | Separar pago, resolución y requisitos del administrado. |
| p5-fila-19 | 5 | Licencia de Estudios - Estudiantes Antiguos | S/ 66.00 | Produce Resolución Directoral. | ALTA | Separar pago, resolución y requisitos del administrado. |
| p5-fila-20 | 5 | Traslado Interno | S/ 309.00 | Requiere vacante y produce resolución. | ALTA | Confirmar cómo se acredita la vacante. |
| p5-fila-21 | 5 | Traslado Externo | S/ 412.00 | Incluye solicitud FUT, vacante y resolución. | ALTA | Confirmar documentos del instituto de origen. |
| p6-fila-02 | 6 | Acceso a la Información Pública. S/. 10.00 por C/Hoja | S/ 10.50 | Solicitud FUT con respuesta documental. | ALTA | Resolver S/10 por hoja frente a S/10.50 antes de aprobar. |
| p6-fila-04 | 6 | Titulación de Otros Institutos Tecnológicos | S/ 515.00 | Procedimiento de titulación con Resolución Directoral. | ALTA | Confirmar alcance, requisitos y resultado exacto. |
| p6-fila-05 | 6 | Examen de Subsanación con Jurado | S/ 33.00 | La fuente menciona Resolución Directoral y permite seguimiento. | MEDIA | Confirmar que la resolución sea el resultado de este procedimiento. |

## 3. Procedimiento frente a pago o componente

| Referencia | Clasificación propuesta | Explicación |
|---|---|---|
| p1-fila-05 | REQUIERE_AGRUPACION | Un registro fuente cubre módulos I, II, III y IV; no duplicar sin decisión. |
| p1-fila-06 | PROCEDIMIENTO_PRINCIPAL | La salida es un certificado de inglés. |
| p4-fila-02 | COMPONENTE_ASOCIADO | Constancia independiente, pero declarada para fines de titulación. |
| p4-fila-05 | PROCEDIMIENTO_PRINCIPAL | Expedición de título es el resultado documental principal. |
| p4-fila-06 | PROCEDIMIENTO_PRINCIPAL | Certificado de estudios como producto documental propio. |
| p4-fila-07 | PROCEDIMIENTO_PRINCIPAL | Visación es actuación administrativa diferenciada. |
| p4-fila-10 | COMPONENTE_ASOCIADO | Inscripción pertenece al flujo de título y requiere orden institucional. |
| p4-fila-15 | PROCEDIMIENTO_PRINCIPAL | Modificación posterior de documento emitido. |
| p4-fila-16 | COMPONENTE_ASOCIADO | La fila está formulada como derecho económico del duplicado. |
| p5-fila-05 | COMPONENTE_ASOCIADO | La fila está formulada como derecho económico de reincorporación. |
| p5-fila-06 | PROCEDIMIENTO_PRINCIPAL | Constancia de egresado con resultado propio. |
| p5-fila-07 | PROCEDIMIENTO_PRINCIPAL | Certificado de bachillerato con resultado propio. |
| p5-fila-08 | REQUIERE_AGRUPACION | Agrupa constancias de título, estudios y matrícula. |
| p5-fila-09 | PROCEDIMIENTO_PRINCIPAL | Convalidación entre planes como decisión administrativa. |
| p5-fila-10 | PROCEDIMIENTO_PRINCIPAL | Convalidación por competencia como decisión administrativa. |
| p5-fila-11 | PROCEDIMIENTO_PRINCIPAL | Devolución de un expediente existente. |
| p5-fila-18 | PROCEDIMIENTO_PRINCIPAL | Reserva de matrícula con resolución. |
| p5-fila-19 | PROCEDIMIENTO_PRINCIPAL | Licencia de estudios con resolución. |
| p5-fila-20 | PROCEDIMIENTO_PRINCIPAL | Traslado interno con resolución. |
| p5-fila-21 | PROCEDIMIENTO_PRINCIPAL | Traslado externo con solicitud y resolución. |
| p6-fila-02 | PROCEDIMIENTO_PRINCIPAL | Acceso a información con petición y respuesta. |
| p6-fila-04 | PROCEDIMIENTO_PRINCIPAL | Titulación proveniente de otro instituto. |
| p6-fila-05 | COMPONENTE_ASOCIADO | Examen académico cuya resolución asociada debe confirmarse. |

No se crea un procedimiento adicional por el porcentaje de UIT, comprobante de pago, formato, caligrafiado, medalla, protector o ceremonia.

## 4. Mapa controlado de titulación

### 4.1 Titulación regular del IESTP Suiza

`PROCESO: Titulación regular`

→ componentes previos o modalidades:

- `p4-fila-02`: constancia de no adeudar.
- `p4-fila-03`: Trabajo de Aplicación Profesional; evaluación, no procedimiento independiente.
- `p4-fila-04`: Examen de Suficiencia Profesional; modalidad alternativa, no procedimiento independiente.
- `p4-fila-08`: caligrafiado; servicio material.
- `p4-fila-09`: derecho de formato; componente económico.
- `p4-fila-11` a `p4-fila-14`: medalla, protectores y colación; bienes/actividad asociados.

→ resultados documentales y actuaciones:

- `p4-fila-05`: expedición de título.
- `p4-fila-10`: inscripción de título.

### 4.2 Documentos relacionados

- `p4-fila-06`: certificado de estudios superiores.
- `p4-fila-07`: visación del certificado.
- `p4-fila-15`: modificación de datos del título.
- `p4-fila-16`: duplicado del título; la fila fuente expresa el derecho económico.

### 4.3 Titulación de otros institutos

`p6-fila-04` constituye un proceso diferenciado. La fuente menciona Resolución Directoral, pero no permite inferir requisitos ni afirmar que el producto exacto sea el título sin validación institucional.

## 5. Caso institucional p6-fila-03

Texto literal de denominación: **“Búsqueda y Duplicados de Boletas (C/U) Síllabus (C/U) Otros Trámites”**.

| Opción | Ventaja | Riesgo | Fidelidad documental | Impacto en frontend/API |
|---|---|---|---|---|
| A. Mantener un procedimiento agrupado | Replica una sola fila y un solo monto fuente. | “Otros trámites” es abierto; mezcla productos distintos y dificulta validación. | Alta en forma, baja en precisión funcional. | Un selector ambiguo y respuesta sin tipo documental claro. |
| B. Separar en varios procedimientos | Permite boletas y sílabos como solicitudes diferenciadas. | La fuente no proporciona códigos, montos diferenciados ni límites para “otros”; separarlos sin acto sería inferencia. | Media/baja sin documento complementario. | Requiere varias entradas/versiones y reglas de monto aprobadas. |
| C. Mantener bloqueado | Evita inventar catálogo, requisitos o precios. | La funcionalidad no estará disponible hasta decisión. | Máxima con la evidencia disponible. | La API debe omitirla y el frontend no debe ofrecerla. |

La opción técnicamente más segura es **C**, pero la decisión definitiva corresponde a Geric/profesor o a un acto institucional verificable.

## 6. Montos ambiguos

| Fila | Texto literal relevante | Monto original | Contradicción | Decisión segura |
|---|---|---|---|---|
| p2-fila-05 | “Precios de acuerdo al Contrato S/. 50.00 a S/. 350.00” | S/ 1,000.00 | Rango descriptivo frente a monto de columna. | `DECISION_INSTITUCIONAL`; no publicarlo. La fila es además no radicable. |
| p3-fila-04 | “Venta de Patos adultos machos” | S/ 50.00 S/ 55.00 | Dos valores sin categoría. | `DECISION_INSTITUCIONAL`; no corregir ni elegir. La fila es no radicable. |
| p6-fila-02 | “Acceso a la Información Pública. S/. 10.00 por C/Hoja” | S/ 10.50 | Denominación y columna de monto no coinciden. | `DECISION_INSTITUCIONAL`; mantener `NO_APROBABLE_AUN`. |

Los montos compuestos de CEPRETEC, pichones, porcino y ganado tienen más de un valor, pero incluyen categorías o pertenecen a filas no radicables; no se convierten en procedimientos.

## 7. Requisitos frente a descripción

La lista `requisitosOriginal` proviene de la columna “DESCRIPCIÓN”. No debe publicarse íntegramente bajo la etiqueta “requisitos”.

| Referencias | Clasificación del campo completo | Tratamiento futuro |
|---|---|---|
| p1-fila-05, p1-fila-06, p4-fila-02, p4-fila-05, p4-fila-06, p4-fila-07, p4-fila-10, p4-fila-15, p4-fila-16, p5-fila-05, p5-fila-06, p5-fila-07, p5-fila-08, p5-fila-09, p5-fila-10, p5-fila-11 | CONDICION | Mostrar como descripción/condición económica. No afirmar requisitos legales. |
| p5-fila-18, p5-fila-19 | AMBIGUO | Mezcla pago y resolución. La resolución es resultado/actuación, no requisito del solicitante. |
| p5-fila-20 | AMBIGUO | La vacante es condición; la resolución es resultado; pago y comprobante son condiciones económicas. |
| p5-fila-21 | AMBIGUO | FUT y vacante pueden ser requisitos; resolución es resultado; pago es condición. Requiere separación aprobada. |
| p6-fila-02 | AMBIGUO | Solicitud FUT puede ser requisito; pago es condición y el monto está controvertido. |
| p6-fila-04, p6-fila-05 | AMBIGUO | Mezcla pago con Resolución Directoral; no define documentos entregados por el solicitante. |

Para un DTO futuro:

- `requisitos`: solo elementos confirmados como aportados o cumplidos por el administrado.
- `descripcion`: pasos informativos, contexto y observaciones de la fuente.
- `condiciones`: pagos, porcentajes, vacante u otras condiciones aprobadas.
- `resultadoDocumental`: certificado, constancia, título, visación, inscripción o resolución cuando esté confirmado.

Hasta la decisión humana, es seguro exponer el texto original como `descripcionFuente`, no como lista contractual de requisitos.

## 8. Propuesta de aprobación de los 23

Toda aprobación requiere un documento institucional real. “APROBABLE” significa que la fila es coherente para ser considerada por la autoridad, no que ya esté aprobada.

| Referencia | Decisión propuesta | ¿Puede pasar a APROBADO ahora? | Bloqueo pendiente | Referencia de aprobación requerida |
|---|---|---|---|---|
| p1-fila-05 | APROBABLE_CON_OBSERVACION | No | Definir tratamiento de cuatro módulos. | Documento institucional que apruebe denominación, variantes y condiciones. |
| p1-fila-06 | APROBABLE | No | Falta acto humano y requisitos confirmados. | Documento institucional verificable de homologación. |
| p4-fila-02 | APROBABLE_CON_OBSERVACION | No | Definir independencia respecto a titulación. | Documento institucional que apruebe su alcance. |
| p4-fila-05 | APROBABLE | No | Falta acto humano y articulación del proceso. | Documento institucional verificable de homologación. |
| p4-fila-06 | APROBABLE | No | Falta acto humano y requisitos confirmados. | Documento institucional verificable de homologación. |
| p4-fila-07 | APROBABLE | No | Falta acto humano y requisitos confirmados. | Documento institucional verificable de homologación. |
| p4-fila-10 | APROBABLE_CON_OBSERVACION | No | Orden y relación con expedición de título. | Documento institucional que apruebe el flujo. |
| p4-fila-15 | APROBABLE | No | Falta acto humano y requisitos confirmados. | Documento institucional verificable de homologación. |
| p4-fila-16 | APROBABLE_CON_OBSERVACION | No | Confirmar que no sea solo un pago asociado. | Documento institucional que apruebe el trámite de duplicado. |
| p5-fila-05 | APROBABLE_CON_OBSERVACION | No | Confirmar que no sea solo el derecho económico. | Documento institucional que apruebe reincorporación y monto. |
| p5-fila-06 | APROBABLE | No | Falta acto humano y requisitos confirmados. | Documento institucional verificable de homologación. |
| p5-fila-07 | APROBABLE | No | Falta acto humano y requisitos confirmados. | Documento institucional verificable de homologación. |
| p5-fila-08 | NO_APROBABLE_AUN | No | Separar o parametrizar tipos de constancia. | Acto que defina variantes, denominaciones y condiciones. |
| p5-fila-09 | APROBABLE | No | Falta acto humano y requisitos confirmados. | Documento institucional verificable de homologación. |
| p5-fila-10 | APROBABLE | No | Falta acto humano y requisitos confirmados. | Documento institucional verificable de homologación. |
| p5-fila-11 | APROBABLE | No | Falta acto humano y reglas sobre expediente. | Documento institucional verificable de homologación. |
| p5-fila-18 | APROBABLE | No | Separar requisitos, pago y resultado en el contrato. | Documento institucional verificable de homologación. |
| p5-fila-19 | APROBABLE | No | Separar requisitos, pago y resultado en el contrato. | Documento institucional verificable de homologación. |
| p5-fila-20 | APROBABLE | No | Confirmar acreditación de vacante y requisitos. | Documento institucional verificable de homologación. |
| p5-fila-21 | APROBABLE | No | Confirmar documentos de origen y vacante. | Documento institucional verificable de homologación. |
| p6-fila-02 | NO_APROBABLE_AUN | No | Conciliar monto y unidad de cobro. | Acto institucional que defina tarifa y unidad vigentes. |
| p6-fila-04 | APROBABLE | No | Confirmar requisitos y resultado exacto. | Documento institucional verificable de homologación. |
| p6-fila-05 | NO_APROBABLE_AUN | No | Confirmar vínculo entre examen y resolución. | Acto institucional que confirme alcance y resultado. |

Resultado propuesto:

| Estado | Cantidad |
|---|---:|
| `APROBABLE` | 15 |
| `APROBABLE_CON_OBSERVACION` | 5 |
| `NO_APROBABLE_AUN` | 3 |
| **TOTAL** | **23** |

## 9. Significado de referencia_aprobacion

`referencia_aprobacion` debe identificar un acto real, verificable y trazable que autorice la versión del registro. Puede ser:

- número y fecha de un acta interna de homologación;
- referencia a validación formal firmada por responsables designados;
- número de resolución u otro acto institucional competente.

Formato conceptual recomendado, sin asignarlo todavía:

`<tipo-documento>:<numero-o-identificador>:<fecha>:<emisor>`

No debe contener textos genéricos como `APROBADO POR GERIC`, nombres sin evidencia, números simulados ni la referencia de este documento técnico. Mientras no exista acto formal, debe permanecer `null`.

## 10. Vista propuesta del catálogo futuro

No se generan UUID manualmente. `registroVersionId` será el UUID asignado por PostgreSQL al registro ya importado y aprobado.

| Campo futuro | Fuente y regla |
|---|---|
| `registroVersionId` | UUID generado por la base; nunca inventado por staging o frontend. |
| `denominacion` | `denominacionOriginal`, sin reescritura silenciosa. |
| `montoOriginal` | Texto literal; no convertir a número cuando sea compuesto o ambiguo. |
| `descripcionFuente` | Texto de `requisitosOriginal` presentado como descripción mientras no se homologue. |
| `requisitos` | Solo subconjunto aprobado expresamente como requisito del administrado. |
| `condiciones` | Pagos, vacantes y demás condiciones aprobadas. |
| `resultadoDocumental` | Resultado confirmado por acto institucional. |
| `fuenteNombre` | `TUPA_2026_IESTP_Suiza.pdf`. |
| `documentoSha256` | Hash del PDF oficial, no hash del JSON de staging. |
| `versionFuente` | `TUPA 2026`. |
| `estado` | Solo publicable cuando el registro físico sea `APROBADO` con referencia válida. |

Los 15 `APROBABLE` y 5 `APROBABLE_CON_OBSERVACION` son candidatos para una decisión humana futura. Los 3 `NO_APROBABLE_AUN` y `p6-fila-03` deben permanecer fuera del catálogo público.

## 11. Contrato de integración para Christian

1. La API pública debe filtrar exclusivamente `estado_validacion = 'APROBADO'`.
2. No debe convertir una propuesta `APROBABLE` en aprobación automática.
3. Debe devolver `registro_version_id` generado por la base, denominación literal, monto literal, fuente, hash de fuente, versión y campos homologados.
4. `requisitos_original` no debe renombrarse directamente como requisitos legales; hasta homologación puede exponerse como descripción de fuente.
5. `p6-fila-03` debe permanecer bloqueada y omitida mientras no exista decisión sobre separación.
6. `p5-fila-08`, `p6-fila-02` y `p6-fila-05` no son publicables con la evidencia actual.
7. No debe inferir códigos, plazos, autoridades, rubros, requisitos, montos corregidos ni equivalencias.
8. El hash de procedencia es el del PDF oficial; el hash del staging sirve solo para control del archivo de preparación.

## 12. Contrato visual para Ricardo

Cuando la API entregue un registro aprobado, el frontend puede mostrar:

- denominación literal;
- monto literal, sin recalcularlo;
- descripción de fuente;
- requisitos únicamente cuando estén homologados;
- fuente y versión;
- resultado documental cuando esté confirmado.

No debe mostrar como definitivo:

- un monto marcado ambiguo;
- texto de “DESCRIPCIÓN” como requisitos legales sin clasificación aprobada;
- entradas `PENDIENTE_VALIDACION`, `RECHAZADO` o sin referencia de aprobación;
- `p6-fila-03` ni las tres filas `NO_APROBABLE_AUN`;
- códigos, plazos, autoridades o UUID inventados;
- datos Pasco/mock como fallback del catálogo Suiza.

Si no existen registros `APROBADO`, la interfaz debe mostrar catálogo no disponible o pendiente de publicación, no sustituirlo silenciosamente por mocks.

## 13. Decisiones humanas pendientes

1. Emitir o identificar el acto válido de aprobación; hasta entonces `referenciaAprobacion` sigue `null`.
2. Resolver variantes de certificados modulares y constancias agrupadas.
3. Determinar la estructura canónica de titulación sin duplicar pagos/componentes.
4. Conciliar el monto de acceso a información pública.
5. Confirmar el vínculo entre examen de subsanación y Resolución Directoral.
6. Resolver `p6-fila-03` mediante una de las tres opciones documentadas.
7. Homologar requisitos del administrado separándolos de pagos, pasos internos y resultados.

## 14. Garantías de esta etapa

- Las 72 entradas permanecen en `PENDIENTE_VALIDACION`.
- Existen 0 entradas `APROBADO`.
- Las 72 referencias de aprobación permanecen en `null`.
- No se ejecutó importación ni escritura en base de datos.
- No se modificaron TramiCore, frontend, migraciones, baseline, `migrate.ts`, RutaDoc ni reportes.
- Este documento no constituye aprobación institucional.
