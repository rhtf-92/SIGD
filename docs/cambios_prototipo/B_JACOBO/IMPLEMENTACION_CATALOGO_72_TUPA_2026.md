# Implementación del catálogo TUPA 2026 en Mesa de Partes

> Actualización posterior: el catálogo ya tiene 72 UUID persistidos y se verificaron 72 radicaciones individuales reales de demostración. El estado y la matriz vigentes se documentan en [SELECTOR_72_TUPA_RADICACION.md](./SELECTOR_72_TUPA_RADICACION.md). El texto siguiente conserva el alcance y los resultados de la fase inicial; sus límites de catálogo consultivo y 19 registros han sido superados por la migración 14.

Fecha: 31 de octubre de 2026  
Rama: `B_JACOBO`  
HEAD de inicio: `bf30d8a0c85e266a86381fb10bf3740a8451c032`

## Estado ejecutivo

Se incorporó en el paso 2 de Mesa de Partes un catálogo de consulta con **72 filas principales** del TUPA de Suiza, buscador por nombre/referencia interna, filtro por rubro y detalle de tarifa/fuente. La UI consulta el endpoint público `GET /api/v1/tramites/catalogo-tupa-2026`. Las variantes que el PDF presenta en filas compartidas se agrupan para respetar el conteo documental: SUZ26-021/022 (pichones) y SUZ26-069/070/071 (fila compartida). La fila CEPRETEC permanece agrupada con sus variantes de precio.

Solo los conceptos cuyo código coincide con un procedimiento vigente en PostgreSQL pueden pasar desde la ficha de catálogo al formulario de radicación. Los demás 53 se pueden localizar y seleccionar para consulta, pero no se convierten en expedientes, órdenes de pago o aprobaciones sin configuración institucional y backend. Esta distinción evita habilitar como trámites formales ventas de bienes, alquileres, servicios o conceptos agrupados por inferencia.

**No está cerrado el flujo integral solicitado.** La base de datos y el endpoint operativo de radicación conservan 19 procedimientos. No se ejecutaron migraciones ni se modificaron datos. El orden actual M3/M10 todavía permite/solicita orden antes de radicar y su validación financiera bloquea ciertos procedimientos; no se reorquestó a «radicación → CUT → orden» en esta entrega. No se reiniciaron servicios.

## Protección del repositorio

- Repositorio: `C:\Users\Liz\Desktop\SIGD\SIGD`.
- Rama: `B_JACOBO`.
- HEAD: `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
- El árbol ya presentaba cientos de modificaciones locales y archivos sin seguimiento antes de esta tarea. Se conservaron; no hubo checkout, restore, clean, commit ni push.
- No hubo escrituras PostgreSQL, migraciones, pagos, expedientes ni cambios Docker.

## Catálogo, procedencia y códigos

Fuente TUPA Suiza previamente verificada por lectura visual y extracción de sus seis páginas: `C:\Users\Liz\Downloads\TUPA_2026_IESTP_Suiza.pdf`, SHA-256 `377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622`. El informe de auditoría fuente es [AUDITORIA_INTEGRAL_TUPA_2026.md](./AUDITORIA_INTEGRAL_TUPA_2026.md), que conserva la transcripción por página, los importes, variantes y las 75 claves internas previas.

El documento fuente no imprime códigos `SUZ26-xxx`; los números que aparecen en interfaz son identificadores internos de correspondencia, no códigos oficiales. El catálogo UI conserva texto de tarifa literal y notas de variantes, sin recalcular importes ni importar tarifas comparativas. Los conceptos con importes compartidos o unidad/precio ambiguos siguen indicados como ambiguos; SUZ26-068 no se convierte en una tarifa numérica individual porque la fuente muestra S/ 10.50 y S/ 10 por hoja sin resolver su relación.

Las 72 entradas visibles son filas principales, no necesariamente 72 procedimientos administrativos radicables. La fuente incluye bienes, alquileres, servicios y cobros académicos. La descomposición de la transcripción anterior en 75 claves se redujo a 72 filas visuales mediante los dos agrupamientos descritos.

## Investigación comparativa TUPA/ROF

Se utilizaron como **referencias de contraste, no como reglas Suiza**:

1. [TUPA 2023 del IESTP María Rosario Araoz Pinto](https://cdn.www.gob.pe/uploads/document/file/4087849/TEXTO%20%C3%9ANICO%20DE%20PROCEDIMIENTO%20ADMINISTRATIVO%20%28TUPA%29.pdf): declara sus requisitos, plazos, unidades de inicio y autoridades; contiene comparables de admisión, matrícula, traslado, convalidación, certificados y servicios académicos. Es otra institución y otra versión; sus importes y requisitos no se copian al SIGD Suiza.
2. [TUPA 2023 del Gobierno Regional de Cajamarca, sector Educación](https://cdn.www.gob.pe/uploads/document/file/6227825/5484401-tupa-completo.pdf): contiene procedimientos de educación superior y de instituciones educativas (entre ellos traslado, convalidación y certificados). Es un comparador por procedimiento, no autoridad normativa para Suiza.
3. [Publicación del ROF 2026 de la DRE Cajamarca](https://www.gob.pe/institucion/regioncajamarca-dre/informes-publicaciones/7676565-reglamento-de-organizacion-y-funciones-rof): confirma la publicación del instrumento y su fecha, pero la descarga del PDF dio HTTP 403 durante esta revisión; no se atribuyen funciones específicas no leídas.
4. [ROF 2012 de la DRE Cajamarca](https://www.educacioncajamarca.gob.pe/media/portal/MNBTP/html/ROF_DRE_CAJAMARCA_2012.pdf): fuente histórica para entender estructura general de la DRE; por su antigüedad no se usa para asignar responsables actuales ni para configurar Suiza.

No se usaron MPA, MPP, MAPRO, RIT ni precios de otras instituciones como fuente para el catálogo Suiza. La investigación no sustenta requisitos individuales para los 72 renglones: las equivalencias encontradas se limitan a trámites académicos comparables; para ventas, alquileres, productos agropecuarios y cobros sin equivalente se registra “sin referencia suficiente”. Ningún requisito de comparación se ha marcado obligatorio en el producto.

### Matriz de aplicabilidad de la evidencia comparativa

La matriz individual de las 72 filas principales, con importe textual, página y estado de evidencia, está en [MATRIZ_REQUISITOS_COMPARATIVOS_TUPA_ROF_2026.md](./MATRIZ_REQUISITOS_COMPARATIVOS_TUPA_ROF_2026.md). No inventa requisitos por fila: distingue la falta de fichas de Suiza y las analogías comparativas.

| Referencias internas Suiza | Tipo de concepto según el TUPA | Comparador público encontrado | Uso permitido en este momento |
|---|---|---|---|
| SUZ26-001–010, 030–066, 072–075 | Prácticas/experiencias formativas, matrícula, admisión, certificaciones, titulación, constancias, traslados, convalidaciones, evaluaciones y documentos académicos | TUPA IESTP MRAP 2023; TUPA sector Educación Cajamarca 2023 | Identificar campos y preguntas de confirmación institucional. Los requisitos observados son ejemplos comparativos, no requisitos de Suiza. Validar caso por caso y por vigencia.
| SUZ26-011–018 | Alquileres y venta/uso de espacios o equipos | No se acreditó equivalencia suficiente en las fuentes revisadas | No proponer lista documental ni responsable individual.
| SUZ26-019–029 | Venta de productos/bienes y servicios de producción | No se acreditó equivalencia suficiente | No convertir autorización de salida, comprobantes o condiciones de entrega en adjuntos del expediente automáticamente.
| SUZ26-067 | Demora/devolución de libro de biblioteca | No se encontró equivalencia suficiente en las fuentes TUPA comparativas consultadas | No inventar documento ni automatizar cálculo/cobro.
| SUZ26-068 | Acceso a información pública | TUPA comparativo solo sirve para reconocer que existe la clase de solicitud; no resuelve la tarifa Suiza | Mantener importe/unidad como ambiguos; no generar orden hasta aclaración oficial.
| SUZ26-069–071 | Boletas, síllabus y otros conceptos en una fila compartida | TUPA comparativo contiene copias/constancias académicas, no la misma agrupación ni tarifa | No asignar el monto compartido a cada prestación de forma independiente.

**Distribución orgánica:** los TUPA comparativos identifican unidades de recepción y autoridades para su entidad; el ROF 2026 del comparador no fue descargable en esta ejecución. No se propone un responsable individual del IESTP Suiza. El PDF Suiza menciona actores para algunas líneas (p. ej., Tesorería, Unidad Administrativa, Área/Secretaría Académica), pero no asigna una unidad resolutiva por fila. Pendiente ROF/organigrama y validación formal de Suiza.

## Requisitos y anexos

- La ficha del formulario consulta los requisitos existentes desde el endpoint documental por UUID para los procedimientos configurados. Esta fuente PostgreSQL sigue limitada al catálogo actual de 19.
- El TUPA Suiza no detalla requisitos documentales individuales completos para todas las líneas; menciones como “pago en Tesorería”, “emisión de B/V”, autorización o resolución no se transformaron automáticamente en requisitos adjuntables.
- En los conceptos sin ficha backend, la interfaz muestra un aviso de configuración institucional pendiente. No declara que carezcan de requisitos ni crea anexos genéricos.
- Se mantiene la clasificación documental de M3 con solo `EXPEDIENTE` y `ANEXO`.
- El archivo PDF requerido por la UI es una exigencia técnica de recepción; no se presenta como requisito oficial TUPA por ese solo hecho.

## Cambios realizados

- `backend/scripts/exportar-catalogo-tupa-2026.ts` y `backend/src/domains/tramicore/catalogoTupa2026.ts`: generación/versionado de las 72 filas que sirve el endpoint de consulta.
- `backend/src/domains/tramicore/tramites.controller.ts`: GET público de consulta `GET /tramites/catalogo-tupa-2026`; no crea registros ni órdenes.
- `frontend/src/data/catalogoTupaMesaPartes.ts`: proyección de referencia de 75 claves internas a 72 filas principales para comprobar agrupaciones.
- `frontend/src/components/tramite/CatalogoTupaCompleto.tsx`: consulta el endpoint, filtra por texto/rubro, muestra costo/fuente y enlaza solo a códigos radicables existentes.
- `frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx`: integración del catálogo de consulta con el selector operativo existente.
- `backend/src/domains/tramicore/pdfFoliacion.ts`: análisis real del PDF y rechazo de archivos dañados, cifrados, vacíos o superiores al límite de 5,000 páginas.
- `backend/src/domains/tramicore/radicacionVirtual.service.ts`: lee cada objeto desde storage, verifica hash/tamaño/MIME, calcula páginas con `pdf-lib` en backend y utiliza el total real para folios, cargo y respuesta. El valor `totalFolios` recibido del cliente ya no determina la foliación. Los documentos se analizan secuencialmente para limitar memoria.
- Pruebas nuevas: `frontend/tests/unit/components/CatalogoTupaCompleto.test.tsx`, `backend/tests/unit/domains/tramicore/pdf-foliacion.spec.ts` y `backend/tests/unit/domains/tramicore/catalogo-tupa-2026.spec.ts`.

No hubo cambios en PostgreSQL ni en MinIO, y no se probaron operaciones persistentes. La integración M10 continúa vinculada a los procedimientos existentes; el catálogo informativo nuevo no crea órdenes financieras.

## Verificaciones ejecutadas

| Prueba | Resultado |
|---|---|
| Frontend `npm run typecheck` | Aprobado. |
| Backend `npm run typecheck` | Aprobado. |
| Frontend, catálogo + documentos + requisitos | 3 archivos, 16 pruebas aprobadas. El primer intento dentro del sandbox se bloqueó al cargar Vite; se repitió fuera del sandbox y pasó. |
| Backend, catálogo + PDF foliación + validación documental | 3 archivos, 19 pruebas aprobadas (incluye GET HTTP del catálogo). |
| Backend `npm run build` | Aprobado. |
| Frontend `npm run build` | Aprobado fuera del sandbox. Vite reportó advertencias de anotaciones `@__PURE__`, import mixto de `api/client.ts` y chunk mayor a 500 KB. |
| PostgreSQL/MinIO E2E, orden, efectivo, CUT y cargo | No ejecutado; no se modificaron ni se generaron datos persistentes. |
| Navegador 5178 / backend 3008 | No comprobado en esta tarea; no se reiniciaron servicios. |

## Brechas y acción necesaria

1. **Fuente backend / PostgreSQL:** el endpoint sirve un catálogo versionado embebido en código backend; no consulta PostgreSQL. Es una fuente de lectura de servidor para la UI, pero todavía no es un catálogo persistido/administrable en PostgreSQL ni una fuente tarifaria M10. No habilita órdenes para los 53 conceptos no configurados.
2. **Modelo/DB:** no se creó migración. Hace falta diseñar una estructura aditiva de conceptos TUPA, variantes/unidades y versionado histórico, relacionando los 19 UUID existentes sin cambiar sus claves o datos.
3. **Procedimiento versus servicio/bien:** la institución debe aprobar cuáles de los 72 producen expediente y CUT, cuáles se atienden por plataforma académica, contrato/venta u otro canal, y qué se puede iniciar desde Mesa de Partes.
4. **Requisitos, anexos y responsables:** solicitar fichas oficiales individuales, formatos aprobados, ROF/organigrama vigente de Suiza y acto aprobatorio/vigencia del TUPA. Validar todo requisito antes de marcarlo obligatorio.
5. **Pago después de radicación:** el backend actual valida pago/orden dentro de la transacción previa al CUT. Cambiar a radicación→CUT→orden requiere rediseñar idempotencia/consistencia M3-M10 y pruebas E2E. No se alteró ese flujo, por lo que el criterio de pago posterior todavía no está satisfecho.
6. **Prueba institucional:** ejecutar, con autorización, una prueba controlada que persista en `sigd_jacobo_demo`, almacene PDF en MinIO, compruebe folios derivados y vincule orden tras CUT cuando la orquestación esté lista.

## Clasificación de resultados

- **IMPLEMENTADO Y VERIFICADO:** endpoint de lectura backend con 72 filas; explorador UI que lo consulta; búsqueda/rubro; agrupación; enlace a procedimientos formales existentes; conteo PDF desde el objeto almacenado en pruebas unitarias; typechecks, pruebas focalizadas y builds.
- **IMPLEMENTADO, PERO NO VERIFICADO:** integración del catálogo UI en navegador real con backend activo.
- **PENDIENTE:** catálogo/versionado en PostgreSQL y enlace tarifario M10; requisitos y responsables institucionalmente confirmados; órdenes posteriores al CUT; prueba integral persistente de radicación y M10.
- **BLOQUEADO:** habilitar como radicables y cobrables los conceptos no configurados, hasta que la institución defina modalidad, requisitos, responsables y tarifa aplicable/variantes ambiguas.
