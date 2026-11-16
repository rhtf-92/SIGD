# Auditoría integral TUPA 2026 y depuración de Mesa de Partes

Fecha: 31 de octubre de 2026. Rama: B_JACOBO. HEAD: `bf30d8a0c85e266a86381fb10bf3740a8451c032`.

## 1. Resultado y alcance

Se localizó y revisó el PDF completo, visualmente y mediante extracción de texto, página por página. La fuente está en `C:\Users\Liz\Downloads\TUPA_2026_IESTP_Suiza.pdf`. Tiene **6 páginas** y SHA-256 **377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622**: coincide exactamente con la fuente citada por `backend/carga_tupa_suiza_2026.sql`.

El documento tiene encabezados institucionales, tarifarios y descripciones breves. No contiene fichas completas por procedimiento ni una resolución de aprobación visible en sus seis páginas. La concordancia documental comprobada aquí no certifica por sí sola aprobación, vigencia jurídica ni exhaustividad administrativa. Las otras versiones encontradas en Downloads/Documents, denominadas CORREGIDO, TRANSCRIPCION y PARA_REVISION, no sustituyen a esta fuente.

**No son equivalentes:** filas del tarifario, conceptos informativos y procedimientos habilitados para radicación. Se identifican 72 filas principales de conceptos, excluyendo encabezados y el total de titulación; algunas agrupan varias prestaciones o tarifas. El TypeScript las desglosa en 75 registros internos: separa pichones hembra/macho y la fila compartida de boletas/síllabus/otros. CEPRETEC, a su vez, reúne seis conceptos de cobro en una sola fila. Por tanto, 75 no es un número oficial de procedimientos administrativos independientes.

PostgreSQL contiene **22 procedimientos, 19 vigentes y 3 inactivos**. Los 19 vigentes tienen **18 tarifas positivas verificadas contra la columna de importes del PDF**, ninguna tarifa cero y un caso ambiguo: Acceso a la Información Pública. No existe fundamento en este catálogo para afirmar «16 con costo y 3 gratuitos». Tampoco se puede convertir la ausencia de tarifa de SUZ26-068 en gratuidad.

Se depuraron exclusivamente componentes frontend relacionados con la presentación documental. No se modificaron backend, contratos, tarifas, requisitos ni registros. No se reiniciaron servicios, no se ejecutaron migraciones y no se enviaron solicitudes de pago o radicación.

## 2. Evidencia y método

- Git: ruta del repositorio confirmada, rama y HEAD registrados; cambios preexistentes conservados mediante ediciones puntuales. Sin commit, push, cambio de rama ni restauraciones.
- Búsqueda: repositorio y carpetas Desktop/SIGD, Downloads y Documents. Una carpeta de respaldos locales negó acceso; no fue necesario acceder a ella porque se encontró el PDF exacto en Downloads.
- La extracción inicial con Python falló porque no está instalado PyMuPDF. Se utilizó el `pdfjs-dist` ya instalado y el renderizador canvas existente; sin instalar dependencias.
- `scratch/auditar-pdf-tupa.mjs`: lectura del PDF, extracción de texto y renderizado de las seis páginas. Evidencias en `scratch/evidencias-auditoria-tupa/pagina-1.png` a `pagina-6.png`, sus textos y `paginas.json`. Todas las imágenes se inspeccionaron.
- `scratch/auditar-db-tupa-2026.cjs`: valida host local, puerto 5433, base `sigd_jacobo_demo` y `MIGRATE_ON_BOOT=false`; conecta con `default_transaction_read_only=on`, ejecuta `BEGIN READ ONLY` y finaliza con `ROLLBACK`. No consulta personas ni expedientes. Resultado en `postgresql.json`, identidad real `sigd_jacobo_demo`, `transaction_read_only=on`.
- El primer intento de conexión fue denegado por el sandbox (EPERM); la misma consulta de lectura se ejecutó después con aprobación de acceso al entorno. No fue un error del catálogo.
- Navegador Edge contra frontend 5178 y backend 3008; peticiones distintas de GET/HEAD/OPTIONS bloqueadas preventivamente. Se verificaron tres selecciones y 19 respuestas HTTP documentales; cero peticiones de escritura intentadas.

## 3. Revisión de las seis páginas

| Página | Contenido inspeccionado | Hallazgos |
|---|---|---|
| 1 | Proyectos productivos, prácticas, experiencias formativas, certificados, idiomas y CEPRETEC | 10 filas principales; CEPRETEC tiene seis subimportes; algunos cobros son por módulo. Encabezado UIT S/ 5,500.00. |
| 2 | Alquileres, venta ambulatoria, mangos y patos BB | 10 filas. Alimentación: columna S/ 1,000.00 frente a descripción contractual S/ 50.00 a 350.00. El subtítulo de bienes dice precios vigentes para 2024 pese al encabezado 2026. |
| 3 | Venta de aves, porcinos, vacunos y servicio de empadre | 8 filas. Variantes por sexo/uso/peso; patos adultos machos muestra 50.00 y 55.00 sin condición que resuelva la diferencia. No son automáticamente expedientes documentarios. |
| 4 | Proceso de titulación y dos servicios académicos adicionales | 16 filas, sin contar total. Certificado de estudios: S/ 124.00, 2.24% impreso, pago y comprobante. Total de titulación impreso S/ 917.50 coincide con suma de las 14 filas de ese bloque. |
| 5 | Matrículas, admisión, reingreso, constancias, convalidaciones, evaluaciones y traslados | 21 filas. FUT expresamente mencionado para Traslado Externo. Resoluciones y vacantes son actuaciones/condiciones; no se presume que deban ser adjuntadas por el ciudadano. |
| 6 | Biblioteca, información pública, boletas/síllabus/otros, titulación externa, exámenes y distintivos | 7 filas principales. Acceso: S/ 10.50 en monto y S/ 10.00 por hoja en concepto. Boletas, síllabus y otros comparten celda de S/ 10.50. |

## 4. Campos administrativos: qué dice realmente la fuente

Las siguientes reglas aplican a **cada fila del inventario** del apartado 11, salvo una indicación expresa en su descripción o unidad de cobro:

| Campo solicitado | Resultado documental |
|---|---|
| Denominación | Nombre de la fila del PDF; la matriz utiliza nombres normalizados para facilitar su correspondencia. La transcripción completa por página se conserva en el apartado 12. |
| Código oficial | No hay códigos SUZ26 en el PDF. Son referencias internas de correspondencia; no se presentan como códigos oficiales. |
| Unidad responsable | El encabezado general dice Dirección General de Educación Superior y Técnico Profesional. No asigna responsabilidad resolutiva individual a cada procedimiento. Las menciones a Tesorería, Secretaría Académica o Unidad Administrativa son actores/actuaciones según la fila. |
| Descripción | Textos de pago, emisión y actuaciones de cada fila, reproducidos en el inventario y transcripción. No hay una descripción procesal integral por procedimiento. |
| Costo | Importe de la columna MONTO, con variantes, unidades o contradicciones conservadas, sin inferir gratuidad. |
| Base legal | Encabezados: Ley 28693, principio de unidad de caja y Directiva de Tesorería; bloque de bienes/servicios: D.S. Nº 028-2007-ED. No se acredita base legal específica por trámite ni se certifica su vigencia legal. |
| Obligatoriedad | No existe una columna que distinga adjuntos obligatorios/opcionales. Una mención expresa de solicitud, contrato, ficha o comprobante no prueba por sí misma obligación de escanearlo en el sistema. Debe validarse institucionalmente esa traducción. |
| Documentos complementarios | Los mencionados expresamente en cada fila; no añadir DNI, fotografías, certificados ni FUT universal. |
| Anexos específicos | No se proporcionan formularios anexos numerados ni un catálogo de anexos por trámite. No equivale a una declaración oficial de que nunca se necesiten documentos complementarios. |
| Plazo | No se especifica un plazo individual de atención en las filas revisadas. |
| Silencio administrativo | No se especifica individualmente. Los valores PostgreSQL no constituyen evidencia oficial. |
| Observaciones | Unidades de cobro, actos internos y contradicciones se conservan como observaciones de auditoría, fuera de la interfaz ciudadana. |

## 5. Caso Certificado de Estudios Superiores (6 semestres)

Fuente directa: página 4, fila «Certificado de Estudios Superiores (6 Semestres)». Correspondencia interna: SUZ26-035, UUID `3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd`.

| Pregunta | Evidencia / conclusión |
|---|---|
| Costo | Columna MONTO: **S/ 124.00**. PostgreSQL/M10: 124.00, estado VALIDADA. Coinciden. |
| Porcentaje | PDF: **2.24% UIT**. Con UIT impresa 5,500, 124/5,500×100 = **2.2545%** (2.25% redondeado). Discrepancia en la propia fuente; no se recalcula ni cambia la tarifa. |
| Pago | Indica pago del derecho en Tesorería. El comprobante se gestiona en M10, sin convertirlo en una tercera clase documental. |
| Comprobante | Se menciona expresamente. La fuente no determina que deba adjuntarse escaneado a Mesa de Partes. |
| FUT / solicitud | No aparece en esta fila. El concepto FUT se cobra por separado en el mismo bloque, pero eso no permite asignarlo universalmente como requisito de todos los trámites. |
| DNI / otros documentos | No se enumeran en esta fila. La validación de identidad del sistema es un control de recepción independiente, no evidencia de un requisito TUPA de adjuntar DNI. |
| Certificado previo | El certificado es el resultado solicitado; no debe exigirse como documento de entrada solo por su denominación. |
| Anexos | No se especifican anexos particulares ni plantillas. |
| Plazo y silencio | No especificados. No mostrar 30 días ni POSITIVO como datos oficiales. |
| Base actual | Un requisito COMPROBANTE_PAGO con obligatorio=false. El endpoint documental lo excluye de los adjuntos de M3. Ningún FUT o anexo configurado para este procedimiento. |

**Pendiente institucional:** lista de documentos exigibles para expedir el certificado, su carácter obligatorio/opcional y si se requiere solicitud/FUT mediante el canal virtual. No se inventó esa lista ni se modificó PostgreSQL para imponerla.

## 6. Comparación PostgreSQL, SQL, backend y Tesorería

Tablas reales consultadas: `sigd_doc.tipo_tramite_tupa`, `sigd_doc.requisito`, `sigd_doc.tipo_documento_requisito`, `sigd_doc.tipo_documento` y `sigd_tes.tarifa`. El esquema inspeccionado no contiene una tabla independiente denominada catálogo de anexos: el servicio documental clasifica requisitos/tipos ANEXO.

- Los 19 códigos vigentes de PostgreSQL están presentes en el importador SQL y en el inventario TypeScript. Hay 56 conceptos informativos TypeScript fuera del catálogo vigente de radicación; su ausencia no demuestra 56 trámites administrativos faltantes. Incluyen venta de bienes, alquileres, cobros agrupados y prestaciones académicas que requieren evaluación institucional antes de habilitarse como expedientes.
- Los 18 importes validados de M10 coinciden con los montos del PDF y su carga SQL. No hay procedimiento vigente con importe cero documentado.
- `sigd_tes.tarifa` conserva la fuente y el importe versionado. `TesoreriaService.catalogo()` consulta tarifas VALIDADA en vigencia; M3 reutiliza ese catálogo mediante `obtenerDocumentacionTramite()`. React muestra el importe recibido; no se añadió un catálogo tarifario paralelo.
- Los 19 vigentes tienen plazo_dias=30 y silencio_administrativo=POSITIVO. El propio importador los documenta como valores técnicos exigidos por el esquema. No proceden de plazos o calificaciones por fila del PDF.
- La unidad orgánica y base legal de PostgreSQL reproducen encabezados generales. Su presencia en todas las filas no prueba competencia individual.
- Existen 20 registros de requisitos entre los 19 vigentes: 18 COMPROBANTE_PAGO y 2 FUT; todos obligatorio=false. SUZ26-066 tiene ambos; SUZ26-068 solo FUT. No hay anexos específicos configurados para los 19.
- SUZ26-050, 051 y 054 tienen un requisito COMPROBANTE_PAGO aunque su fila PDF menciona solo pago del derecho, sin expresar «comprobante». Es una interpretación añadida al catálogo, no una transcripción literal. No se corrigió durante esta auditoría.
- SUZ26-066 y 068 sí mencionan solicitud en FUT. PostgreSQL los tiene como no obligatorios; falta una decisión institucional que distinga exigencia de solicitud de obligación de adjuntar un escaneo. No se convirtió automáticamente el booleano en afirmación administrativa de opcionalidad.
- Vacante, Resolución Directoral/Secretaría Académica y otras actuaciones descritas no están modeladas como condiciones completas de admisibilidad. No deben convertirse sin análisis en documentos que el ciudadano ya deba poseer.
- El tipo técnico ANEXO permite clasificación de archivos; su existencia no constituye evidencia de anexos oficiales de un procedimiento.
- La recepción exige al menos un PDF y mantiene validación documental. Esa condición técnica se conserva; no se afirma que el PDF completo constituya un requisito TUPA adicional.

Servicios y rutas inspeccionados:

- `backend/src/domains/tramicore/tramites.controller.ts`: GET `/api/v1/tramites/tipos` y GET `/api/v1/tramites/tipos/:id/documentacion`.
- `backend/src/domains/tramicore/documentacionTramite.service.ts`: requisitos por UUID, exclusión de comprobantes M10, clasificación y validación de pertenencia/obligatoriedad.
- `backend/src/domains/tramicore/radicacionVirtual.service.ts`: validación documental antes de la persistencia del expediente y controles de identidad/almacenamiento.
- `backend/src/domains/tesoreria/tesoreria.service.ts`: catálogo tarifario y órdenes; importes obtenidos en backend.
- `frontend/src/data/tupaSuiza2026.ts` y `backend/carga_tupa_suiza_2026.sql`: fuentes secundarias contrastadas, no reemplazos del PDF.

## 7. Discrepancias de la fuente que requieren aclaración

1. SUZ26-068: columna S/ 10.50 y texto S/ 10.00 por hoja; no hay fórmula inequívoca. Mantener sin cobro habilitado hasta aclarar importe y unidad. No es gratuito.
2. Bienes (p. 2): encabezado precios 2024 en documento 2026. Confirmar vigencia para ese rubro.
3. Alimentación (p. 2): monto 1,000 frente a rango contractual 50–350. No elegir arbitrariamente.
4. Patos adultos machos (p. 3): 50 y 55 sin condición de aplicación.
5. Boletas/síllabus/otros (p. 6): celda compartida 10.50; no afirmar tres tarifas individuales aprobadas.
6. Varios porcentajes impresos no coinciden con el importe dividido entre la UIT impresa, incluso considerando redondeo ordinario. Ejemplos: Certificado 124/5,500 → 2.25% frente a 2.24%; Expedición 105 → 1.91% frente a 1.90%; Devolución de expediente 21 → 0.38% frente a 0.37%; Carnets 50 → 0.91% frente a 0.93%. El inventario conserva el porcentaje impreso; no lo usa para recalcular cobros.
7. Ausencia de plazos, silencio y listas de adjuntos: no se subsana publicando defaults o interpretaciones técnicas como si estuvieran aprobados.

## 8. Depuración pública implementada

Archivos modificados dentro del alcance:

- `frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx`: elimina párrafo de backend/75 conceptos, descripción cruda con auditoría, códigos internos visibles y atribución de la unidad del encabezado general como responsable. Conserva selector, UUID internos, navegación, carga y validaciones.
- `frontend/src/components/tramite/DocumentacionRequisitos.tsx`: conserva costo recibido, modalidad de pago y controles de carga; no muestra nota técnica, códigos de requisito ni códigos SUZ26. Cuando faltan registros, ofrece orientación en lugar de declarar que no hay requisitos. Cuando no hay anexos dice «No se indican anexos específicos», sin certificar ausencia absoluta. La ausencia de tarifa invita a consultar Tesorería. Retira únicamente el sufijo de auditoría conocido de los dos nombres FUT, también de sus etiquetas accesibles; no altera su identificador.
- `frontend/src/components/tramite/WizardSteps/StepConfirmacion.tsx`: elimina descripción de auditoría, referencia a UUID/backend y afirmación obsoleta sobre ausencia de API documental. Mantiene revalidación de catálogo y bloqueo ante error.
- Pruebas actualizadas: `DocumentacionRequisitos.test.tsx` y `TramiteWizard.test.tsx`. Se verifican ocultamiento de notas/defaults, selección, clasificación y controles existentes.

No se muestra plazo ni responsable individual porque la fuente no los confirma para cada fila. Se mantienen EXPEDIENTE y ANEXO exclusivamente. No se inventaron anexos, requisitos ni importes para llenar espacios de la interfaz.

## 9. Pruebas y límites de verificación

- Lectura real PostgreSQL: base demo y modo READ ONLY confirmados; 22 registros, 19 vigentes. Sin DML/DDL.
- HTTP real: 19/19 endpoints documentales respondieron 200; contenido en `scratch/evidencias-auditoria-tupa/http-documentacion.json`.
- Edge real: selecciones SUZ26-035, 066 y 068, costos 124.00/412.00/sin tarifa, ausencia de textos internos, exactamente dos clasificaciones. Cero peticiones de escritura intentadas; capturas y `navegador.json` en la misma carpeta.
- TypeScript frontend: `npm.cmd run typecheck`, aprobado.
- Pruebas de componentes: **3 archivos aprobados, 75 pruebas aprobadas y 1 omitida** (76 casos). Comando: `npm.cmd run test -- --run tests/unit/components/DocumentacionRequisitos.test.tsx tests/unit/components/StepDocumentosArchivos.test.tsx tests/unit/components/TramiteWizard.test.tsx`. La omitida es la consulta live opcional condicionada a variable de entorno; las 19 consultas reales se comprobaron separadamente. Durante la actualización se corrigieron expectativas de códigos/textos retirados y un selector de prueba ambiguo, sin modificar reglas de seguridad.
- ESLint: **no aprobado**. El comando global informó 28 errores y 5 advertencias en el árbol actual. La comprobación de los tres componentes modificados encuentra un error `react-hooks/set-state-in-effect` en `StepConfirmacion.tsx:141`, dentro del efecto de consulta preexistente que esta intervención no modificó. No se cambió el comportamiento de ese efecto para ampliar el alcance de una depuración de presentación. Los otros dos componentes no presentaron errores en esa comprobación. Esta limitación no se oculta ni se presenta como prueba aprobada.
- No se ejecutaron nuevas radicaciones, cargas MinIO, órdenes ni pagos: hacerlo contravendría las restricciones de esta auditoría. Las pruebas de componentes usan fixtures y servicios simulados; no se presentan como evidencia de persistencia integral.
- No se reinició frontend, backend ni infraestructura. No se ejecutó el importador SQL ni se modificó la configuración de demostración.
- Identidad del proceso activo comprobada con el lector existente `Get-SigdServer`: backend PID 17068 del directorio backend de este repositorio; conexión efectiva validada por el lector a `127.0.0.1:5433/sigd_jacobo_demo`, migraciones automáticas desactivadas y omisión demostrativa de pago conservada en true. Consulta de procesos únicamente, sin arranque ni reinicio.

## 10. Acciones recomendadas y pendientes

Prioridad alta: la institución debe aprobar una matriz de documentos de entrada por procedimiento, diferenciar documentos aportados de actuaciones internas, especificar obligatoriedad de escaneos y resolver SUZ26-068. Conservar las 18 tarifas contrastadas, sin alterar sus importes por los porcentajes inconsistentes.

Prioridad media: validar la resolución y versión institucional del tarifario localizado, unidades competentes, plazos y calificaciones individuales; decidir cuáles conceptos fuera de los 19 son realmente procedimientos radicables. Rectificar la interpretación de COMPROBANTE_PAGO en 050/051/054 y la exposición de datos técnicos desde herramientas administrativas en una fase autorizada de datos, sin cambios durante esta intervención.

Resultado: **auditoría documental de las seis páginas y comparación del catálogo ejecutadas; depuración frontend implementada y comprobada en navegador**. El catálogo no puede declararse administrativamente completo en requisitos, anexos, plazos y competencias con la información disponible. Eso queda documentado aquí, no expuesto al ciudadano como información oficial.


## 11. Inventario completo y matrices de correspondencia

Las referencias SUZ26 de esta tabla son **exclusivamente internas**, para relacionar filas con el prototipo. No son códigos oficiales del PDF. Denominaciones normalizadas contrastadas visualmente; texto literal y contexto completos en el apartado 12. Para cada fila: base legal, responsable, obligatoriedad de adjuntos, plazo, silencio y ausencia de anexos definidos se rigen por el apartado 4; no se completan con defaults.

| Referencia interna | Pág. | Concepto / denominación | Importe o variantes expresadas en el PDF | Documentos, descripción y condiciones expresas | Catálogo de radicación |
|---|---:|---|---|---|---|
| SUZ26-001 | 1 | Prácticas Iniciales | S/ 35.00 (0.64 % UIT vigente) | Pago; control en Área Académica; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-002 | 1 | Prácticas Intermedias | S/ 45.00 (0.82 % UIT vigente) | Pago; control en Área Académica; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-003 | 1 | Prácticas Finales | S/ 60.00 (1.09 % UIT vigente) | Pago; control en Área Académica; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-004 | 1 | Experiencias Formativas en Situaciones Reales de Trabajo (I, II, III y IV) — por cada módulo | S/ 46.50 (0.84 % UIT vigente) | Informe del Área Académica designando docentes supervisores; pago; comprobante. Por módulo. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-005 | 1 | Certificado Modular (I, II, III y IV) — por cada módulo | S/ 100.00 | Pago en Tesorería; emisión de B/V. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-006 | 1 | Certificado de Inglés | S/ 100.00 | Pago en Tesorería; emisión de B/V. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-007 | 1 | Centro de Idiomas — paquete básico de 4 meses para alumnos del IESTP Suiza | S/ 300.00 | Pago en Tesorería; emisión de B/V. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-008 | 1 | Centro de Idiomas — paquete básico de 4 meses para alumnos externos | S/ 350.00 | Pago en Tesorería; emisión de B/V. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-009 | 1 | Examen de Suficiencia de Inglés y/o Portugués | S/ 300.00 | Pago en Tesorería; emisión de B/V. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-010 | 1 | CEPRETEC 2026 | El cuadro muestra S/ 400.00, S/ 200.00, S/ 60.00, S/ 50.00, S/ 40.00 y S/ 10.00. | Pago en Tesorería; emisión de B/V. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-011 | 2 | Alquiler del Galpón Agrícola para la Crianza de Pollos (por campaña) | S/ 500.00. | Solicitud al Director; suscripción del contrato; pago según contrato; por campaña. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-012 | 2 | Alquiler de Retroproyector | S/ 100.00 | Pago en Tesorería. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-013 | 2 | Alquiler de Aulas — diario | S/ 150.00 | Solicitud al Director; proveído a Unidad Administrativa para autorización; pago; emisión de B/V. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-014 | 2 | Alquiler de la Cancha de Fútbol — diario | S/ 100.00 | Solicitud al Director; proveído a Unidad Administrativa para autorización; pago; emisión de B/V. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-015 | 2 | Alquiler de Ambientes para servicio de alimentación | S/ 1,000.00. | Solicitud al Director; contrato; pago según contrato; descripción S/ 50–350 frente a columna S/ 1,000. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-016 | 2 | Alquiler del Auditorio | S/ 300.00 | Solicitud al Director; proveído a Unidad Administrativa para autorización; pago; emisión de B/V. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-017 | 2 | Alquiler de Laboratorio de Cómputo a Terceros | S/ 20.00 | Por hora y por cada equipo; no se enumeran documentos de entrada. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-018 | 2 | Venta Ambulatoria Diaria | S/ 20.00 | Solicitud al Director; proveído a Unidad Administrativa para autorización; pago; emisión de B/V. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-019 | 2 | Venta de Mangos | S/ 15.00 | Pago; entrega del bien; papeleta de autorización de salida firmada por Unidad Administrativa, Proyectos Productivos y Abastecimiento/Patrimonio; supervisión de salida; boleta. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-020 | 2 | Venta de Patos BB | S/ 15.00 | Pago; entrega del bien; papeleta de autorización de salida firmada por Unidad Administrativa, Proyectos Productivos y Abastecimiento/Patrimonio; supervisión de salida; boleta. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-021 | 3 | Venta de Patos Pichones — hembras | S/ 30.00 | Pago; entrega del bien; papeleta de autorización de salida firmada por Unidad Administrativa, Proyectos Productivos y Abastecimiento/Patrimonio; supervisión de salida; boleta. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-022 | 3 | Venta de Patos Pichones — machos | S/ 40.00 | Pago; entrega del bien; papeleta de autorización de salida firmada por Unidad Administrativa, Proyectos Productivos y Abastecimiento/Patrimonio; supervisión de salida; boleta. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-023 | 3 | Venta de Pati Pollos | S/ 15.00 | Pago; entrega del bien; papeleta de autorización de salida firmada por Unidad Administrativa, Proyectos Productivos y Abastecimiento/Patrimonio; supervisión de salida; boleta. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-024 | 3 | Venta de Patos adultos hembras | S/ 40.00 | Pago; entrega del bien; papeleta de autorización de salida firmada por Unidad Administrativa, Proyectos Productivos y Abastecimiento/Patrimonio; supervisión de salida; boleta. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-025 | 3 | Venta de Patos adultos machos | El cuadro muestra S/ 50.00 y S/ 55.00. | Pago; entrega del bien; papeleta de autorización de salida firmada por Unidad Administrativa, Proyectos Productivos y Abastecimiento/Patrimonio; supervisión de salida; boleta. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-026 | 3 | Venta de Porcino para consumo — kg | S/ 20.00 | Pago; entrega del bien; papeleta de autorización de salida firmada por Unidad Administrativa, Proyectos Productivos y Abastecimiento/Patrimonio; supervisión de salida; boleta. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-027 | 3 | Venta de Porcino en Pie — kg | S/ 25.00 reproductor; S/ 15.00 carne, por kg | Emisión de B/V; reproductor S/ 25 y carne S/ 15 por kg. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-028 | 3 | Venta de Ganado Vacuno | S/ 20.00 carcasa sin pata/sin cabeza; S/ 15.00 en pie, por kg | Pago; entrega del bien; papeleta de autorización de salida firmada por Unidad Administrativa, Proyectos Productivos y Abastecimiento/Patrimonio; supervisión de salida; boleta. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-029 | 3 | Servicio de Empadre | S/ 50.00 | Ejecución del servicio; pago; B/V. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-030 | 4 | FUT — proceso de titulación | S/ 4.00 (0.07 % UIT vigente) | Pago en Tesorería: texto «3 FUT»; comprobante. No determina un FUT universal obligatorio para los demás conceptos. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-031 | 4 | Constancia de No Adeudar — para fines de titulación | S/ 16.50 (0.30 % UIT vigente) | Pago en Tesorería; comprobante de pago. | Vigente |
| SUZ26-032 | 4 | Trabajo de Aplicación Profesional (Examen Teórico Práctico) | S/ 57.00 (1.03 % UIT vigente) | Pago en Tesorería. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-033 | 4 | Examen de Suficiencia Profesional (Examen Teórico Práctico) | S/ 57.00 (1.03 % UIT vigente) | Pago en Tesorería. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-034 | 4 | Expedición de Título | S/ 105.00 (1.90 % UIT vigente) | Pago en Tesorería; comprobante de pago. | Vigente |
| SUZ26-035 | 4 | Certificado de Estudios Superiores (6 semestres) | S/ 124.00 (2.24 % UIT vigente) | Pago en Tesorería; comprobante de pago. | Vigente |
| SUZ26-036 | 4 | Visación de Certificado de Estudios Superiores | S/ 16.00 (0.29 % UIT vigente) | Pago en Tesorería; comprobante de pago. | Vigente |
| SUZ26-037 | 4 | Caligrafiado de Título | S/ 26.00 (0.47 % UIT vigente) | Pago en Tesorería; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-038 | 4 | Derecho de Formato de Título | S/ 42.00 (0.75 % UIT vigente) | Pago en Tesorería; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-039 | 4 | Inscripción de Título | S/ 120.00 | Pago en Tesorería; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-040 | 4 | Medallas — proceso de titulación | S/ 100.00 | Pago en Tesorería; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-041 | 4 | Protector de Título | S/ 100.00 | Pago en Tesorería. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-042 | 4 | Colación | S/ 100.00 | Pago en Tesorería. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-043 | 4 | Protector de Certificado Modular | S/ 50.00 | Pago en Tesorería. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-044 | 4 | Modificación de Datos del Título | S/ 269.00 (4.88 % UIT vigente) | Pago en Tesorería; comprobante de pago. | Vigente |
| SUZ26-045 | 4 | Derecho de duplicado de Título | S/ 309.00 (5.61 % UIT vigente) | Pago en Tesorería; comprobante de pago. | Vigente |
| SUZ26-046 | 5 | Matrículas | S/ 200.00 | Ficha de matrícula; pago de adeudos; pago del derecho de matrícula. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-047 | 5 | Admisión 2026 | S/ 250.00 | Pago en Tesorería. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-048 | 5 | Guías del postulante | S/ 50.00 | Pago en Tesorería. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-049 | 5 | Ingreso Admisión 2026 — titulados | S/ 500.00 | Pago en Tesorería. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-050 | 5 | Derecho de Reincorporación (Reingreso) | S/ 300.00 | Pago en Tesorería. | Vigente |
| SUZ26-051 | 5 | Constancia de Egresado | S/ 31.00 | Pago en Tesorería. | Vigente |
| SUZ26-052 | 5 | Certificado de Bachillerato | S/ 42.00 (0.75 % UIT vigente) | Pago en Tesorería; comprobante de pago. | Vigente |
| SUZ26-053 | 5 | Constancias — de título, estudios o matrícula | S/ 23.00 (0.41 % UIT vigente) | Pago en Tesorería; comprobante de pago. | Vigente |
| SUZ26-054 | 5 | Convalidación entre Planes de Estudios | S/ 46.50 (0.84 % UIT vigente) | Pago en Tesorería. | Vigente |
| SUZ26-055 | 5 | Convalidación por Unidades de Competencia | S/ 46.50 (0.84 % UIT vigente) | Pago en Tesorería; comprobante de pago. | Vigente |
| SUZ26-056 | 5 | Devolución de Expediente | S/ 21.00 (0.37 % UIT vigente) | Pago en Tesorería; comprobante de pago. | Vigente |
| SUZ26-057 | 5 | Evaluación Extraordinaria (A) | S/ 93.00 (1.68 % UIT vigente) | Pago en Tesorería; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-058 | 5 | Evaluación Extraordinaria (RM 069) | S/ 70.00 (1.27 % UIT vigente) | Pago en Tesorería; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-059 | 5 | Examen de Recuperación | S/ 70.00 (1.27 % UIT vigente) | Pago en Tesorería; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-060 | 5 | Examen de Cargo | S/ 70.00 (1.27 % UIT vigente) | Pago en Tesorería; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-061 | 5 | Repitencia de Unidad Didáctica | S/ 86.00 (1.56 % UIT vigente) | Pago en Tesorería; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-062 | 5 | Repitencia de Semestre | S/ 80.00 (1.45 % UIT vigente) | Pago en Tesorería; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-063 | 5 | Reserva de Matrícula — ingresantes | S/ 66.00 (1.20 % UIT vigente) | Pago; comprobante; Resolución Directoral–Secretaría Académica (actuación mencionada; no prueba obligación de adjuntarla previamente). | Vigente |
| SUZ26-064 | 5 | Licencia de Estudios — estudiantes antiguos | S/ 66.00 (1.20 % UIT vigente) | Pago; comprobante; Resolución Directoral–Secretaría Académica (actuación mencionada; no prueba obligación de adjuntarla previamente). | Vigente |
| SUZ26-065 | 5 | Traslado Interno | S/ 309.00 (5.61 % UIT vigente) | Vacante en carrera; Resolución Directoral–Secretaría Académica; pago y comprobante. | Vigente |
| SUZ26-066 | 5 | Traslado Externo | S/ 412.00 (7.48 % UIT vigente) | Solicitud en FUT al Director; vacante; Resolución Directoral–Secretaría Académica; pago y comprobante. | Vigente |
| SUZ26-067 | 6 | Demora Devolución Libro Biblioteca | S/ 10.00 (0.19 % UIT vigente; costo por día) | Informe de deudores de libros a Unidad Administrativa; derivación a Tesorería; pago y comprobante. Costo por día. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-068 | 6 | Acceso a la Información Pública | El cuadro muestra S/ 10.50 y también S/ 10.00 por cada hoja; consigna 0.19 % UIT vigente. | Solicitud a Dirección en FUT; pago; S/ 10.50 en columna y S/ 10.00 por hoja en concepto. | Vigente |
| SUZ26-069 | 6 | Búsqueda y Duplicados de Boletas (c/u) | S/ 10.50 en celda compartida; no importe individual confirmado | Fila compartida: pago; otros trámites administrativos; comprobante 0.19%; una celda de S/ 10.50 sin tarifas individuales separadas. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-070 | 6 | Síllabus (c/u) | S/ 10.50 en celda compartida; no importe individual confirmado | Fila compartida: pago; otros trámites administrativos; comprobante 0.19%; una celda de S/ 10.50 sin tarifas individuales separadas. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-071 | 6 | Otros Trámites | S/ 10.50 en celda compartida; no importe individual confirmado | Fila compartida: pago; otros trámites administrativos; comprobante 0.19%; una celda de S/ 10.50 sin tarifas individuales separadas. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-072 | 6 | Titulación de Otros Institutos Tecnológicos | S/ 515.00 (9.35 % UIT vigente) | Pago; comprobante; Resolución Directoral–Secretaría Académica (actuación mencionada; no prueba obligación de adjuntarla previamente). | Vigente |
| SUZ26-073 | 6 | Examen de Subsanación con Jurado | S/ 33.00 (0.60 % UIT vigente) | Pago; comprobante; Resolución Directoral–Secretaría Académica (actuación mencionada; no prueba obligación de adjuntarla previamente). | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-074 | 6 | Prueba de Suficiencia Académica | S/ 105.00 (1.90 % UIT vigente) | Pago en Tesorería; comprobante de pago. | No vigente en los 19; evaluar naturaleza del concepto |
| SUZ26-075 | 6 | Carnets, Insignia y Distintivos | S/ 50.00 (0.93 % UIT vigente) | Pago; emisión B/V; porcentaje impreso 0.93%. | No vigente en los 19; evaluar naturaleza del concepto |

### Matriz de tarifas y requisitos de los 19 procedimientos vigentes

Coincidencia económica: 18 importes positivos concordantes. No existen tres gratuitos demostrados. En todos los casos el plazo 30 y silencio POSITIVO de PostgreSQL carecen de confirmación individual en la fuente. No hay anexos específicos definidos en estas filas del PDF ni configurados en el endpoint.

| Referencia interna | Pág. | Importe PDF S/ | Tarifa PostgreSQL S/ | Requisitos PostgreSQL | Revisión de requisitos / anexos |
|---|---:|---|---|---|---|
| SUZ26-031 | 4 | 16.50 | 16.50 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-034 | 4 | 105.00 | 105.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-035 | 4 | 124.00 | 124.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-036 | 4 | 16.00 | 16.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-044 | 4 | 269.00 | 269.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-045 | 4 | 309.00 | 309.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-050 | 5 | 300.00 | 300.00 | COMPROBANTE_PAGO: obligatorio=false | Comprobante no mencionado en la fila PDF; agregado interpretativo. Sin anexos específicos. |
| SUZ26-051 | 5 | 31.00 | 31.00 | COMPROBANTE_PAGO: obligatorio=false | Comprobante no mencionado en la fila PDF; agregado interpretativo. Sin anexos específicos. |
| SUZ26-052 | 5 | 42.00 | 42.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-053 | 5 | 23.00 | 23.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-054 | 5 | 46.50 | 46.50 | COMPROBANTE_PAGO: obligatorio=false | Comprobante no mencionado en la fila PDF; agregado interpretativo. Sin anexos específicos. |
| SUZ26-055 | 5 | 46.50 | 46.50 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-056 | 5 | 21.00 | 21.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-063 | 5 | 66.00 | 66.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-064 | 5 | 66.00 | 66.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-065 | 5 | 309.00 | 309.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |
| SUZ26-066 | 5 | 412.00 | 412.00 | COMPROBANTE_PAGO: obligatorio=false; FUT: obligatorio=false | FUT expreso; obligatoriedad de escaneo sin precisar. Sin anexos específicos. |
| SUZ26-068 | 6 | 10.50 / 10.00 por hoja (ambiguo) | Sin tarifa validada | FUT: obligatorio=false | FUT expreso; obligatoriedad de escaneo sin precisar. Sin anexos específicos. |
| SUZ26-072 | 6 | 515.00 | 515.00 | COMPROBANTE_PAGO: obligatorio=false | Mención de pago/comprobante; no lista completa de adjuntos. Sin anexos específicos. |

### Conteo verificable por página

| Página | Filas principales del PDF | Registros internos TypeScript |
|---|---:|---:|
| 1 | 10 (CEPRETEC agrupa 6 conceptos) | 10 |
| 2 | 10 | 10 |
| 3 | 8 (pichones agrupa 2 variantes) | 9 |
| 4 | 16 (total de titulación excluido) | 16 |
| 5 | 21 | 21 |
| 6 | 7 (boletas/síllabus/otros en una fila) | 9 |
| Total | 72 | 75 |

## 12. Transcripción de control de las seis páginas

Extracción literal del PDF, ordenada por posición visual. Los separadores `|` representan columnas/líneas; la extracción puede intercalar subtítulos y montos en las filas compuestas. Las imágenes inspeccionadas resuelven esa disposición. No se usa esta transcripción como catálogo alternativo en React.

### Página 1

```text
DIRECCIÓN REGIONAL DE EDUCACIÓN DE UCAYALI
Unidad Orgánica: DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO
PROFESIONAL
Ministerio
PERÚ
de Educación
TUPA 2026 - UIT VIGENTE S/. 5,500.00
INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"
INSTITUTO DE EXCELENCIA
PROYECTOS PRODUCTIVOS | CTA. CTE.: 0512-039170 - BANCO DE LA NACIÓN
GESTIÓN DE RECURSOS PROPIOS Y ACTIVIDADES PRODUCTIVAS Y EMPRESARIALES DEL IESTP "SUIZA"
Base Legal: | Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.
RUBRO: VENTA DE SERVICIOS
CONCEPTO | DESCRIPCIÓN | MONTO S/.
Prácticas Iniciales | Pago del Derecho en Tesorería | S/ 35.00
Control en el Área Académica
Comprobante de Pago 0.64 % UIT Vigente
Prácticas Intermedias | Pago del Derecho en Tesorería | S/ 45.00
Control en el Área Académica
Comprobante de Pago 0.82 % UIT Vigente
Prácticas Finales | Pago del Derecho en Tesorería | S/ 60.00
Control en el Área Académica
Comprobante de Pago 1.09 % UIT Vigente
Experiencias Formativas en Situaciones | Informe del Área Académica designando los Docentes | S/ 46.50
responsables para las Supervisiones de Experiencias
Reales de Trabajo (I, II, III y IV)
Formativas en Situaciones Reales de Trabajo
Por cada Módulo
Pago del Derecho en Tesorería
Comprobante de Pago 0.84 % UIT Vigente
Certificado Modular (I, II, III y IV) | Pago en el Área de Tesorería | S/ 100.00
Por cada Módulo | Emisión de la B/V
Certificado de Inglés | Pago en el Área de Tesorería | S/ 100.00
Emisión de la B/V
Centro de Idiomas: | Pago en el Área de Tesorería | S/ 300.00
Inglés, Portugués, Japonés | Emisión de la B/V
Nivel Básico Paquete: 04 meses para Alumnos del
IESTP "SUIZA"
Centro de Idiomas: | Pago en el Área de Tesorería | S/ 350.00
Inglés, Portugués, Japonés | Emisión de la B/V
Nivel Básico Paquete: 04 meses para Alumnos
Externos del IESTP "SUIZA"
Examen de Suficiencia de Inglés y/o | Pago en el Área de Tesorería | S/ 300.00
Portugués | Emisión de la B/V
CEPRETEC 2026 | Pago en el Área de Tesorería | S/ 400.00
Emisión de la B/V
• Matrícula | S/ 400.00 | S/ 200.00
S/ 60.00
• Matrícula Último mes | S/ 200.00
S/ 50.00
• Matrícula Última Semana | S/ 60.00
S/ 40.00
• Solo Simulacro (C/U) | S/ 50.00 | S/ 10.00
• Venta de Guías | S/ 40.00
• Cambio de Carrera (Antes del I | S/
Simulacro) | 10.00
IESTP SUIZA - TUPA 2026 (UIT S/. 5,500.00) | Página 1 de 6
```

### Página 2

```text
RUBROS: VENTA DE BIENES Y OTROS SERVICIOS - D.S. Nº 028-2007-ED
VENTA DE SERVICIOS | Servicios de Maquicentro de acuerdo al mercado:
CATERPILLAR Y PETROLEROS
CONCEPTO | DESCRIPCIÓN | MONTO S/.
Alquiler del Galpón Agrícola Para la | Solicitud dirigida al Director del IESTP SUIZA. | S/ 500.00
Crianza de Pollos | Suscripción del Contrato.
(Por Campaña) | Pago en tesorería de acuerdo al Contrato
Precio por Campaña
Alquiler de Retroproyector | Pago en tesorería. | S/ 100.00
Alquiler de Aulas - Diario | Solicitud dirigida al Director del IESTP SUIZA | S/ 150.00
Proveído a la Unidad Administrativa para su Autorización
Pago en tesorería.
Emisión de B/V.
Alquiler de la Cancha de Fútbol - Diario | Solicitud dirigida al Director del IESTP SUIZA | S/ 100.00
Proveído a la Unidad Administrativa para su Autorización
Pago en tesorería.
Emisión de B/V.
Alquiler de Ambientes para servicio de | Solicitud dirigida al Director del IESTP SUIZA. | S/ 1,000.00
alimentación. | Suscripción del Contrato.
Pago en tesorería de acuerdo al Contrato
Precios de acuerdo al Contrato S/. 50.00 a S/. 350.00
Alquiler del Auditorio. | Solicitud dirigida al Director del IESTP SUIZA. | S/ 300.00
Proveído a la Unidad Administrativa para su Autorización
Pago en tesorería.
Emisión de B/V.
Alquiler de Laboratorio de Cómputo a | Por hora y por cada equipo | S/ 20.00
Terceros
Venta Ambulatoria Diaria | Solicitud dirigida al Director. | S/ 20.00
Proveído a la Unidad Administrativa para su Autorización.
Pago en Tesorería.
Emisión de la B/V
VENTA DE BIENES | Precios Vigentes para el año 2024, tomando como base precios del mercado.
Venta de Mangos (Ciento) | Pago en Tesorería | S/ 15.00
Entrega del bien en proyectos
Papeleta de Autorización de salida Firmada por la Unidad
Administrativa, Jefe (e) del Área de Proyectos Productivos y
Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.
Supervisión de salida del bien-vigilancia
Emisión de Boleta de Venta
Venta de Patos BB | Pago en Tesorería | S/ 15.00
Entrega del bien en Proyectos
Papeleta de Autorización de salida Firmada por la Unidad
Administrativa, Jefe (e) del Área de Proyectos Productivos y
Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.
Supervisión de salida del bien-vigilancia
Emisión de Boleta de Venta
IESTP SUIZA - TUPA 2026 (UIT S/. 5,500.00) | Página 2 de 6
```

### Página 3

```text
RUBROS: VENTA DE BIENES Y OTROS SERVICIOS - D.S. Nº 028-2007-ED
VENTA DE SERVICIOS | Servicios de Maquicentro de acuerdo al mercado:
CATERPILLAR Y PETROLEROS
CONCEPTO | DESCRIPCIÓN | MONTO S/.
Venta de Patos Pichones, de acuerdo al | Pago en Tesorería | S/ 30.00
Tamaño. | Entrega del bien en Proyectos | S/ 40.00
Papeleta de Autorización de salida Firmada por la Unidad
Administrativa, Jefe (e) del Área de Proyectos Productivos y
Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.
Supervisión de salida del bien-vigilancia
Emisión de Boleta de Venta
PICHONES HEMBRAS: | S/ 30.00
PICHONES MACHOS: | S/ 40.00
Venta de Pati Pollos | Pago en Tesorería | S/ 15.00
Entrega del bien en Proyectos
Papeleta de Autorización de salida Firmada por la Unidad
Administrativa, Jefe (e) del Área de Proyectos Productivos y
Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.
Supervisión de salida del bien-vigilancia
Emisión de Boleta de Venta
Venta de Patos adultos hembras | Pago en Tesorería | S/ 40.00
Entrega del bien en Proyectos
Papeleta de Autorización de salida Firmada por la Unidad
Administrativa, Jefe (e) del Área de Proyectos Productivos y
Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.
Supervisión de salida del bien-vigilancia
Emisión de Boleta de Venta
Venta de Patos adultos machos | Pago en Tesorería | S/ 50.00
Entrega del bien en Proyectos | S/ 55.00
Papeleta de Autorización de salida Firmada por la Unidad
Administrativa, Jefe (e) del Área de Proyectos Productivos y
Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.
Supervisión de salida del bien-vigilancia
Emisión de Boleta de Venta
Venta de Porcino para consumo Kg | Pago en Tesorería | S/ 20.00
Entrega del bien en Proyectos
Papeleta de Autorización de salida Firmada por la Unidad
Administrativa, Jefe (e) del Área de Proyectos Productivos y
Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.
Supervisión de salida del bien-vigilancia
Emisión de Boleta de Venta
Venta de Porcino en Pie Kg | Emisión de B/V. | S/ 25.00
REPRODUCTOR: | S/ 25.00 | S/ 15.00
CARNE: | S/ 15.00
Venta de Ganado Vacuno en pie Kg; EN | Pago en Tesorería | S/ 20.00
Entrega del bien en Proyectos | S/ 15.00
Papeleta de Autorización de salida Firmada por la Unidad
Administrativa, Jefe (e) del Área de Proyectos Productivos y
Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.
Supervisión de salida del bien-vigilancia
Emisión de B/V.
CARCASA (SIN PATA, SIN CABEZA) KG: | S/ 20.00
EN PIE: | S/ 15.00
Servicio de Empadre | Ejecución del Servicio | S/ 50.00
Pago en Tesorería
Emisión de B/V.
PUCALLPA, ENERO DE 2026.
IESTP SUIZA - TUPA 2026 (UIT S/. 5,500.00) | Página 3 de 6
```

### Página 4

```text
DIRECCIÓN REGIONAL DE EDUCACIÓN DE UCAYALI
Unidad Orgánica: DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO
PROFESIONAL
Ministerio
PERÚ
de Educación
TUPA 2026 - UIT VIGENTE S/. 5,500.00
INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"
INSTITUTO DE EXCELENCIA
INGRESOS PROPIOS - SERVICIOS ACADÉMICOS | CTA. CTE.: 0512-015263 - BANCO DE LA NACIÓN
Base Legal: | Ley 28693: Ley General del Sistema Nacional de Tesorería. • Principio de Unidad de Caja. • Directiva de Tesorería.
PROCESO DE TITULACIÓN
CONCEPTO | DESCRIPCIÓN | MONTO S/.
FUT | Pago del Derecho en Tesorería 3 FUT | S/ 4.00
Comprobante de Pago 0.07 % UIT Vigente
Constancia de No Adeudar | Pago del Derecho en Tesorería | S/ 16.50
(Para fines de Titulación) | Comprobante de Pago 0.30 % UIT Vigente
Trabajo de Aplicación Profesional | Pago del Derecho en Tesorería, | 1.03 % UIT Vigente | S/ 57.00
(Examen Teórico Práctico)
Examen de Suficiencia Profesional | Pago del Derecho en Tesorería, | 1.03 % UIT Vigente | S/ 57.00
(Examen Teórico Práctico)
Expedición de Título | Pago del Derecho en Tesorería | S/ 105.00
Comprobante de Pago 1.90 % UIT Vigente
Certificado de Estudios Superiores | Pago del Derecho en Tesorería | S/ 124.00
(6 Semestres) | Comprobante de Pago 2.24 % UIT Vigente
Visación de Certificado de Estudios | Pago del Derecho en Tesorería | S/ 16.00
Superiores | Comprobante de Pago 0.29 % UIT Vigente
Caligrafiado de Título | Pago del Derecho en Tesorería | S/ 26.00
Comprobante de Pago 0.47 % UIT Vigente
Derecho de Formato de Título | Pago del Derecho en Tesorería | S/ 42.00
Comprobante de Pago 0.75 % UIT Vigente
Inscripción de Título | Pago del Derecho en Tesorería | S/ 120.00
Comprobante de Pago
Medallas | Pago del Derecho en Tesorería | S/ 100.00
Comprobante de Pago
Protector de Título | Pago del Derecho en Tesorería | S/ 100.00
Colación | Pago del Derecho en Tesorería | S/ 100.00
Protector de Certificado Modular | Pago del Derecho en Tesorería | S/ 50.00
TOTAL PROCESO TITULACIÓN S/. | S/ 917.50
OTROS SERVICIOS ACADÉMICOS
CONCEPTO | DESCRIPCIÓN | MONTO S/.
Modificación de Datos del Título | Pago del Derecho en Tesorería | S/ 269.00
Comprobante de Pago 4.88 % UIT Vigente
Derecho de duplicado de Título. | Pago del Derecho en Tesorería | S/ 309.00
Comprobante de Pago 5.61 % UIT Vigente
IESTP SUIZA - TUPA 2026 (UIT S/. 5,500.00) | Página 4 de 6
```

### Página 5

```text
OTROS SERVICIOS ACADÉMICOS
CONCEPTO | DESCRIPCIÓN | MONTO S/.
Matrículas | Ficha de matrícula | S/ 200.00
Pago de adeudos en Tesorería
Pago de derecho de matrícula en tesorería
ADMISIÓN 2026 | Pago en el Área de Tesorería | S/ 250.00
Guías del postulante | Pago en el Área de Tesorería | S/ 50.00
Ingreso ADMISIÓN 2026 - Titulados | Pago en el Área de Tesorería | S/ 500.00
Derecho de Reincorporación | Pago en el Área de Tesorería | S/ 300.00
(Reingreso)
Constancia de Egresado | Pago del Derecho en Tesorería | S/ 31.00
Certificado de Bachillerato | Pago del Derecho en Tesorería | S/ 42.00
Comprobante de Pago 0.75 % UIT Vigente
Constancias | Pago del Derecho en Tesorería | S/ 23.00
(Otros: de Título, estudios, de Matrícula) | Comprobante de Pago 0.41 % UIT Vigente
Convalidación entre Planes de Estudios | Pago del Derecho en Tesorería, | 0.84% UIT Vigente | S/ 46.50
Convalidación por Unidades de | Pago del Derecho en Tesorería | S/ 46.50
Competencia | Comprobante de Pago 0.84 % UIT Vigente
Devolución de Expediente | Pago del Derecho en Tesorería | S/ 21.00
Comprobante de Pago 0.37 % UIT Vigente
Evaluación Extraordinaria (A) | Pago del Derecho en Tesorería | S/ 93.00
Comprobante de Pago 1.68 % UIT Vigente
Evaluación Extraordinaria | Pago del Derecho en Tesorería | S/ 70.00
(RM 069) | Comprobante de Pago 1.27 % UIT Vigente
Examen de Recuperación | Pago del Derecho en Tesorería | S/ 70.00
Comprobante de Pago 1.27 % UIT Vigente
Examen de Cargo | Pago del Derecho en Tesorería | S/ 70.00
Comprobante de Pago 1.27 % UIT Vigente
Repitencia de Unidad Didáctica | Pago del Derecho en Tesorería | S/ 86.00
Comprobante de Pago 1.56 % UIT Vigente
Repitencia de Semestre | Pago del Derecho en Tesorería | S/ 80.00
Comprobante de Pago 1.45 % UIT Vigente
Reserva de Matrícula - Ingresantes | Pago del Derecho en Tesorería | S/ 66.00
Resolución Directoral-Secretaría Académica
Comprobante de Pago 1.20 % UIT Vigente
Licencia de Estudios - Estudiantes | Pago del Derecho en Tesorería | S/ 66.00
Antiguos | Resolución Directoral-Secretaría - Académica
Comprobante de Pago 1.20 % UIT Vigente
Traslado Interno | Vacante en la Carrera | S/ 309.00
Resolución Directoral-Secretaría Académica
Pago del Derecho en Tesorería
Comprobante de Pago 5.61 % UIT Vigente
Traslado Externo | Solicitud en FUT dirigida al Director. | S/ 412.00
Vacante en la Carrera
Resolución Directoral-Secretaría - Académica
Pago del Derecho en Tesorería
Comprobante de Pago 7.48 % UIT Vigente
IESTP SUIZA - TUPA 2026 (UIT S/. 5,500.00) | Página 5 de 6
```

### Página 6

```text
OTROS SERVICIOS ACADÉMICOS
CONCEPTO | DESCRIPCIÓN | MONTO S/.
Demora Devolución Libro Biblioteca | Informe a la Unidad Administrativa de deudores de Libros | S/ 10.00
Unidad Administrativa deriva a Tesorería
Pago del Derecho en Tesorería
Comprobante de Pago 0.19 % UIT Vigente (Costo por día)
Acceso a la Información Pública. | Solicitud dirigida a Dirección en FUT | S/ 10.50
S/. 10.00 por C/Hoja | Pago del Derecho en Tesorería | 0.19 % de la UIT Vigente
Búsqueda y Duplicados de Boletas (C/U) | Pago del Derecho en Tesorería | S/ 10.50
Síllabus (C/U) | Otros Trámites Administrativos
Otros Trámites | Comprobante de Pago 0.19% UIT Vigente
Titulación de Otros Institutos | Pago del Derecho en Tesorería | S/ 515.00
Tecnológicos | Comprobante de Pago 9.35 % UIT Vigente
Resolución Directoral-Secretaría Académica
Examen de Subsanación con Jurado | Pago del Derecho en Tesorería | S/ 33.00
Comprobante de Pago 0.60 % UIT Vigente
Resolución Directoral-Secretaría Académica
Prueba de Suficiencia Académica | Pago del Derecho en Tesorería | S/ 105.00
Comprobante de Pago 1.90 % UIT Vigente
Carnets, Insignia y Distintivos | Pago en el Área de Tesorería | S/ 50.00
Emisión de la B/V
0.93 % UIT Vigente
PUCALLPA, ENERO 2026.
IESTP SUIZA - TUPA 2026 (UIT S/. 5,500.00) | Página 6 de 6
```
