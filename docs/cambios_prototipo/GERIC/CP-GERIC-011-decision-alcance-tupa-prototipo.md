# CP-GERIC-011 — Decisión de alcance TUPA para prototipo académico

**Estado:** VALIDACIÓN TÉCNICA Y FUNCIONAL DEL EQUIPO PARA PROTOTIPO ACADÉMICO

**Referencia:** `B_GERIC` en `4e06e512fe08d01712bc0b6feb33e95ca28c1b10`

**Naturaleza:** propuesta interna del proyecto académico. No constituye aprobación institucional del IESTP Suiza, no publica registros y no modifica el staging.

## 1. Diferencia entre los dos niveles de aprobación

### Aprobación para prototipo

Decisión interna del equipo para permitir que una entrada se use en una demostración académica, identificada visualmente como prototipo. No certifica tarifa, vigencia, requisitos ni aprobación institucional.

### Aprobación institucional

Acto emitido o validado por la autoridad competente del IESTP Suiza. Es el único que podría confirmar oficialmente denominaciones, tarifas, requisitos, vigencias, autoridades y publicación real.

Una aprobación académica no debe presentarse en API o interfaz como homologación institucional.

## 2. Resultado de alcance

| Decisión de prototipo | Cantidad |
|---|---:|
| `INCLUIR_EN_PROTOTIPO` | 18 |
| `EXCLUIR_DEL_PROTOTIPO` | 6 |
| **TOTAL EVALUADO** | **24** |

El universo de 24 incluye los 23 radicables revisados y `p6-fila-03`, que continúa bloqueada. Las otras 48 filas homologadas como `NO_RADICABLE_SIGD` permanecen fuera del selector de procedimientos.

## 3. Los 15 APROBABLE

| Referencia | Denominación literal | Pág. | Monto literal | Resultado documental esperado | Riesgo para demo | Propuesta |
|---|---|---:|---|---|---|---|
| p1-fila-06 | Certificado de Inglés | 1 | S/ 100.00 | Certificado de inglés | Requisitos no homologados | INCLUIR_EN_PROTOTIPO |
| p4-fila-05 | Expedición de Título | 4 | S/ 105.00 | Título expedido | No representar componentes asociados como trámites duplicados | INCLUIR_EN_PROTOTIPO |
| p4-fila-06 | Certificado de Estudios Superiores (6 Semestres) | 4 | S/ 124.00 | Certificado de estudios | Requisitos no homologados | INCLUIR_EN_PROTOTIPO |
| p4-fila-07 | Visación de Certificado de Estudios Superiores | 4 | S/ 16.00 | Certificado visado | Documento a presentar no definido | INCLUIR_EN_PROTOTIPO |
| p4-fila-15 | Modificación de Datos del Título | 4 | S/ 269.00 | Título modificado | Tipos de modificación no definidos | INCLUIR_EN_PROTOTIPO |
| p5-fila-06 | Constancia de Egresado | 5 | S/ 31.00 | Constancia de egresado | Requisitos no homologados | INCLUIR_EN_PROTOTIPO |
| p5-fila-07 | Certificado de Bachillerato | 5 | S/ 42.00 | Certificado de bachillerato | Requisitos no homologados | INCLUIR_EN_PROTOTIPO |
| p5-fila-09 | Convalidación entre Planes de Estudios | 5 | S/ 46.50 | Decisión de convalidación | Resultado exacto no descrito | INCLUIR_EN_PROTOTIPO |
| p5-fila-10 | Convalidación por Unidades de Competencia | 5 | S/ 46.50 | Decisión de convalidación | Resultado exacto no descrito | INCLUIR_EN_PROTOTIPO |
| p5-fila-11 | Devolución de Expediente | 5 | S/ 21.00 | Expediente devuelto o constancia de devolución | Reglas del expediente no definidas | INCLUIR_EN_PROTOTIPO |
| p5-fila-18 | Reserva de Matrícula - Ingresantes | 5 | S/ 66.00 | Resolución Directoral | Separar pago, actuación y resultado | INCLUIR_EN_PROTOTIPO |
| p5-fila-19 | Licencia de Estudios - Estudiantes Antiguos | 5 | S/ 66.00 | Resolución Directoral | Separar pago, actuación y resultado | INCLUIR_EN_PROTOTIPO |
| p5-fila-20 | Traslado Interno | 5 | S/ 309.00 | Resolución de traslado interno | Acreditación de vacante no homologada | INCLUIR_EN_PROTOTIPO |
| p5-fila-21 | Traslado Externo | 5 | S/ 412.00 | Resolución de traslado externo | Documentos de origen no homologados | INCLUIR_EN_PROTOTIPO |
| p6-fila-04 | Titulación de Otros Institutos Tecnológicos | 6 | S/ 515.00 | Resolución Directoral; resultado final por confirmar | Alcance y requisitos no definidos | INCLUIR_EN_PROTOTIPO |

Estas entradas pueden mostrarse en la demo solo con su texto y monto literales, fuente visible y una indicación expresa de “prototipo académico”. Sus riesgos no deben convertirse en requisitos inventados.

## 4. Los 5 APROBABLE_CON_OBSERVACION

| Referencia | Denominación literal | Observación exacta | Riesgo | ¿Puede mostrarse sin inducir error? | Propuesta |
|---|---|---|---|---|---|
| p1-fila-05 | Certificado Modular (I, II, III y IV) Por cada Módulo | Una fila cubre cuatro módulos y el monto es “por cada módulo”. | Crear cuatro procedimientos o un monto total inexistente. | Sí, como una sola entrada literal sin generar variantes. | INCLUIR_EN_PROTOTIPO |
| p4-fila-02 | Constancia de No Adeudar (Para fines de Titulación) | Está vinculada a titulación, aunque tiene resultado documental propio. | Presentarla como trámite completamente independiente del proceso. | Sí, indicando “para fines de titulación”. | INCLUIR_EN_PROTOTIPO |
| p4-fila-10 | Inscripción de Título | Forma parte del flujo de título. | Confundir inscripción con expedición o duplicarla. | Sí, conservando la denominación y sin inventar orden obligatorio. | INCLUIR_EN_PROTOTIPO |
| p4-fila-16 | Derecho de duplicado de Título. | La fuente puede estar describiendo el derecho económico y no todo el procedimiento. | Presentar un pago como procedimiento autónomo. | No; el equipo resolvió excluirlo temporalmente. | EXCLUIR_DEL_PROTOTIPO |
| p5-fila-05 | Derecho de Reincorporación (Reingreso) | La fuente usa “Derecho” y solo describe pago. | Confundir el derecho económico con el procedimiento de reincorporación. | No; el equipo resolvió excluirlo temporalmente. | EXCLUIR_DEL_PROTOTIPO |

No se infieren variantes, requisitos ni relaciones adicionales para resolver estas observaciones.

## 5. Los 3 NO_APROBABLE_AUN

| Referencia | Denominación | Bloqueo | Propuesta temporal |
|---|---|---|---|
| p5-fila-08 | Constancias (Otros: de Título, estudios, de Matrícula) | Agrupa varias constancias y no define variantes seguras. | EXCLUIR_DEL_PROTOTIPO |
| p6-fila-02 | Acceso a la Información Pública. S/. 10.00 por C/Hoja | S/10 por hoja contradice el monto S/10.50. | EXCLUIR_DEL_PROTOTIPO |
| p6-fila-05 | Examen de Subsanación con Jurado | No se confirmó que la Resolución Directoral sea el resultado del examen. | EXCLUIR_DEL_PROTOTIPO |

Las tres continúan siendo funcionalmente relevantes, pero no deben aparecer en la demo hasta resolver su bloqueo.

## 6. Caso p6-fila-03

`p6-fila-03` — **“Búsqueda y Duplicados de Boletas (C/U) Síllabus (C/U) Otros Trámites”** — se mantiene en `EXCLUIR_DEL_PROTOTIPO`.

La fila mezcla productos distintos y un concepto abierto. No se separan boletas, sílabos u “otros” porque la fuente no proporciona códigos, requisitos o montos independientes. Solo una decisión institucional o fuente complementaria permitiría modelarlos sin inferencia.

## 7. Catálogo de alcance propuesto

| Referencia | Denominación literal | Inclusión | Observación de demo | Fuente | Pág. |
|---|---|---|---|---|---:|
| p1-fila-05 | Certificado Modular (I, II, III y IV) Por cada Módulo | INCLUIR_EN_PROTOTIPO | Una entrada literal; no crear cuatro variantes. | TUPA 2026 IESTP Suiza | 1 |
| p1-fila-06 | Certificado de Inglés | INCLUIR_EN_PROTOTIPO | Requisitos no homologados. | TUPA 2026 IESTP Suiza | 1 |
| p4-fila-02 | Constancia de No Adeudar (Para fines de Titulación) | INCLUIR_EN_PROTOTIPO | Mostrar vínculo literal con titulación. | TUPA 2026 IESTP Suiza | 4 |
| p4-fila-05 | Expedición de Título | INCLUIR_EN_PROTOTIPO | No duplicar componentes económicos. | TUPA 2026 IESTP Suiza | 4 |
| p4-fila-06 | Certificado de Estudios Superiores (6 Semestres) | INCLUIR_EN_PROTOTIPO | Requisitos no homologados. | TUPA 2026 IESTP Suiza | 4 |
| p4-fila-07 | Visación de Certificado de Estudios Superiores | INCLUIR_EN_PROTOTIPO | Documento presentado no definido. | TUPA 2026 IESTP Suiza | 4 |
| p4-fila-10 | Inscripción de Título | INCLUIR_EN_PROTOTIPO | Diferenciar de expedición. | TUPA 2026 IESTP Suiza | 4 |
| p4-fila-15 | Modificación de Datos del Título | INCLUIR_EN_PROTOTIPO | Tipos de modificación no definidos. | TUPA 2026 IESTP Suiza | 4 |
| p4-fila-16 | Derecho de duplicado de Título. | EXCLUIR_DEL_PROTOTIPO | Puede representar solo un derecho económico. | TUPA 2026 IESTP Suiza | 4 |
| p5-fila-05 | Derecho de Reincorporación (Reingreso) | EXCLUIR_DEL_PROTOTIPO | Puede representar solo un derecho económico. | TUPA 2026 IESTP Suiza | 5 |
| p5-fila-06 | Constancia de Egresado | INCLUIR_EN_PROTOTIPO | Requisitos no homologados. | TUPA 2026 IESTP Suiza | 5 |
| p5-fila-07 | Certificado de Bachillerato | INCLUIR_EN_PROTOTIPO | Requisitos no homologados. | TUPA 2026 IESTP Suiza | 5 |
| p5-fila-08 | Constancias (Otros: de Título, estudios, de Matrícula) | EXCLUIR_DEL_PROTOTIPO | Necesita variantes aprobadas. | TUPA 2026 IESTP Suiza | 5 |
| p5-fila-09 | Convalidación entre Planes de Estudios | INCLUIR_EN_PROTOTIPO | Resultado exacto no descrito. | TUPA 2026 IESTP Suiza | 5 |
| p5-fila-10 | Convalidación por Unidades de Competencia | INCLUIR_EN_PROTOTIPO | Resultado exacto no descrito. | TUPA 2026 IESTP Suiza | 5 |
| p5-fila-11 | Devolución de Expediente | INCLUIR_EN_PROTOTIPO | Reglas del expediente no definidas. | TUPA 2026 IESTP Suiza | 5 |
| p5-fila-18 | Reserva de Matrícula - Ingresantes | INCLUIR_EN_PROTOTIPO | Resolución como resultado; no requisito. | TUPA 2026 IESTP Suiza | 5 |
| p5-fila-19 | Licencia de Estudios - Estudiantes Antiguos | INCLUIR_EN_PROTOTIPO | Resolución como resultado; no requisito. | TUPA 2026 IESTP Suiza | 5 |
| p5-fila-20 | Traslado Interno | INCLUIR_EN_PROTOTIPO | Vacante pendiente de homologación. | TUPA 2026 IESTP Suiza | 5 |
| p5-fila-21 | Traslado Externo | INCLUIR_EN_PROTOTIPO | Solicitud y vacante no homologadas. | TUPA 2026 IESTP Suiza | 5 |
| p6-fila-02 | Acceso a la Información Pública. S/. 10.00 por C/Hoja | EXCLUIR_DEL_PROTOTIPO | Monto contradictorio. | TUPA 2026 IESTP Suiza | 6 |
| p6-fila-03 | Búsqueda y Duplicados de Boletas (C/U) Síllabus (C/U) Otros Trámites | EXCLUIR_DEL_PROTOTIPO | No separar sin fuente complementaria. | TUPA 2026 IESTP Suiza | 6 |
| p6-fila-04 | Titulación de Otros Institutos Tecnológicos | INCLUIR_EN_PROTOTIPO | Resultado exacto por confirmar. | TUPA 2026 IESTP Suiza | 6 |
| p6-fila-05 | Examen de Subsanación con Jurado | EXCLUIR_DEL_PROTOTIPO | Relación con resolución no confirmada. | TUPA 2026 IESTP Suiza | 6 |

Comprobación del catálogo: **18 incluidas + 6 excluidas = 24**.

## 8. Referencia futura de decisión académica

Formato conceptual propuesto:

`VALIDACION_ACADEMICA_PROTOTIPO:<AAAA-MM-DD>:<identificador-documental>:<responsable>`

No se asigna ningún valor en esta etapa. Una referencia futura debe apuntar a una decisión real y conservada del equipo. Solo documentaría el alcance académico de la demo y **no equivaldría a aprobación institucional del IESTP Suiza**.

## 9. Propuesta de cambio de estado, no ejecutada

Las 18 entradas `INCLUIR_EN_PROTOTIPO` podrán evaluarse en una etapa posterior y separada para un cambio controlado de estado respaldado por la validación técnica y funcional del equipo.

Deben permanecer `PENDIENTE_VALIDACION`:

- las 6 entradas `EXCLUIR_DEL_PROTOTIPO`;
- las 48 entradas `NO_RADICABLE_SIGD`;
- cualquier fila sin referencia académica real.

Advertencia: el esquema físico solo usa `APROBADO`; no distingue aprobación académica de institucional. Antes de cambiar estados debe acordarse cómo la API y la interfaz rotularán inequívocamente el catálogo como prototipo, para no presentar una aprobación académica como institucional.

## 10. Impacto para Christian

Después de un cambio de estado controlado, la API de demo podrá exponer únicamente las 18 referencias `INCLUIR_EN_PROTOTIPO`.

Christian no debe:

- exponer las 4 excluidas;
- exponer entradas todavía `PENDIENTE_VALIDACION`;
- inferir requisitos, códigos, plazos, autoridades o resultados;
- modificar montos literales;
- confundir aprobación académica con institucional;
- habilitar las 48 entradas no radicables en el selector de trámites.

## 11. Impacto para Ricardo

El selector del prototipo debe contener únicamente las 18 entradas incluidas cuando la API las entregue como autorizadas para demo.

No deben aparecer:

- p5-fila-08;
- p6-fila-02;
- p6-fila-03;
- p6-fila-05;
- las 48 entradas no radicables;
- datos Pasco, mocks o fallbacks presentados como TUPA Suiza.

La interfaz debe mostrar “catálogo de prototipo académico” y conservar denominación, monto, fuente y versión literales. Los requisitos solo se mostrarán cuando estén homologados; mientras tanto pueden presentarse como descripción de fuente.

## 12. Límites y decisiones pendientes

1. `p4-fila-16` y `p5-fila-05` quedan excluidas temporalmente por decisión técnica del equipo.
2. Las seis entradas excluidas requieren aclaración o fuente complementaria antes de reconsiderarse.
3. La referencia académica permanece sin asignar.
4. No existe aprobación institucional.
5. No se ejecutó cambio de estado, importación ni publicación.
6. El staging continúa intacto con 72 entradas `PENDIENTE_VALIDACION`.
