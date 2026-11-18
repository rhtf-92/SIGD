# CP-GERIC-008 — Preparación controlada de datos TUPA Suiza 2026

**Estado:** extracción literal terminada; staging **LISTO PARA REVISIÓN DE HOMOLOGACIÓN**, sin publicación.
**Base:** `B_GERIC` en `4e06e512fe08d01712bc0b6feb33e95ca28c1b10`.
**Alcance:** archivos nuevos y aislados; no modifica servicios TramiCore, migraciones, baseline, runner, RutaDoc, reportes, frontend, configuración ni lockfiles.

## 1. Fuente y límite de evidencia

La fuente oficial se verificó en `C:\Users\Geric\Desktop\WorkSpace\tupa2026\TUPA_2026_IESTP_Suiza.pdf`. Tiene 321 617 bytes, seis páginas y SHA-256 `377DD8E14B8806F2030B5374120AB9B4FE17640BB98086E10C1A9A4431A33622`, que coincide exactamente con el valor documentado en `CP-GERIC-006:7`.

La inspección textual y visual confirmó el título de metadatos `TUPA 2026 - IESTP SUIZA`, el encabezado `IESTP SUIZA - TUPA 2026` y la institución `INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"`. El PDF declara DRE Ucayali, Pucallpa y enero de 2026; no se convirtió esa fecha en una vigencia contractual.

El único PDF presente es `SIGD_prompts_equipo_acoplamiento_TUPA.pdf`, con 125 311 bytes y SHA-256 `20D8B4C70054B8EE1B1E192106A897CC67F33A748A1D90B42A14021F7CB8AE25`. Su nombre y hash no coinciden con la fuente oficial documentada, por lo que no se utilizó para extraer conceptos TUPA y permaneció intacto.

Controles aplicados:

- Entradas oficiales extraídas: **72 filas físicas**: 10, 10, 8, 16, 21 y 7 por página.
- No se inventaron códigos, montos, requisitos, plazos, rubros, autoridades ni vigencias.
- No existe ninguna fila marcada `APROBADO`.
- Las 72 filas están en `PENDIENTE_VALIDACION` con `referenciaAprobacion: null`.
- `codigoExterno`, `vigenciaDesde` y `vigenciaHasta` quedaron en `null` porque el PDF no muestra esos datos como campos de las filas.
- `hashVerificado` se marcó `true` únicamente después de recomputar el SHA-256 y validar visualmente la identidad del documento.
- El resumen `TOTAL PROCESO TITULACIÓN S/. 917.50` no se convirtió en entrada independiente porque es un total de sección, no una fila con concepto propio.

## 2. Esquema físico rector

`backend/migraciones/08_sigd_tupa_acoplamiento.sql:6-40` define `sigd_doc.tupa_registro_version`:

| Columna | Tipo | Nulabilidad/default | Regla |
|---|---|---|---|
| `registro_version_id` | `UUID` | `NOT NULL`, `gen_random_uuid()` | PK |
| `documento_sha256` | `CHAR(64)` | `NOT NULL` | Hexadecimal minúsculo de 64 caracteres |
| `fuente_nombre` | `TEXT` | `NOT NULL` | No vacío |
| `pagina` | `INTEGER` | `NOT NULL` | Mayor que cero |
| `referencia_fila` | `TEXT` | `NOT NULL` | No vacía |
| `revision` | `INTEGER` | `NOT NULL DEFAULT 1` | Mayor que cero |
| `codigo_externo` | `TEXT` | `NULL` | Solo literal de fuente |
| `denominacion_original` | `TEXT` | `NOT NULL` | No vacía |
| `monto_original` | `TEXT` | `NULL` | Se conserva como texto |
| `requisitos_original` | `JSONB` | `NULL` | Contenido literal estructurado cuando exista |
| `referencia_normativa_original` | `TEXT` | `NULL` | Sin inferencia |
| `version_fuente` | `TEXT` | `NULL` | Sin inferencia |
| `vigencia_desde` | `DATE` | `NULL` | — |
| `vigencia_hasta` | `DATE` | `NULL` | Requiere inicio y no puede ser anterior |
| `estado_validacion` | `TEXT` | `NOT NULL DEFAULT 'PENDIENTE_VALIDACION'` | `PENDIENTE_VALIDACION`, `APROBADO`, `RECHAZADO` |
| `referencia_aprobacion` | `TEXT` | `NULL` | Obligatoria y no vacía cuando está `APROBADO` |
| `registrado_en` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Asignado por BD |

La restricción `uq_tupa_registro_procedencia` cubre `(documento_sha256, pagina, referencia_fila, revision)`. Los triggers de `08:69-85` rechazan `UPDATE`, `DELETE` y `TRUNCATE`: el registro es WORM. El staging no incluye `registro_version_id` ni `registrado_en`, porque la base los genera.

## 3. Inventario y homologación

La transcripción se realizó fila por fila desde la fuente oficial. La distribución actual es:

| Clasificación | Cantidad transcrita |
|---|---:|
| `PROCEDIMIENTO_DOCUMENTARIO` | 22 |
| `SERVICIO_ACADEMICO` | 22 |
| `PAGO_DERECHO` | 3 |
| `BIEN_SERVICIO` | 24 |
| `OTRO` | 0 |
| `REQUIERE_DECISION` | 1 |

La homologación interna quedó distribuida así: 21 `LISTO_PARA_REVISION`, 19 `REQUIERE_DECISION` y 32 `NO_APLICA_SIGD`. La candidatura de radicación es independiente: 22 `CANDIDATO`, 16 `REQUIERE_DECISION` y 34 `NO_CANDIDATO`. Estas etiquetas son criterios para revisión, no decisiones institucionales.

Las 19 filas con decisión pendiente incluyen prácticas iniciales/intermedias/finales, experiencias formativas, examen de idiomas, seis alquileres o autorizaciones de la página 2, dos inconsistencias literales de la página 3, dos evaluaciones del proceso de titulación y cuatro filas de la página 6. El staging conserva la explicación exacta en `observacionClasificacion`.

El documento se titula TUPA 2026, pero la subsección `VENTA DE BIENES` de la página 2 declara literalmente: `Precios Vigentes para el año 2024, tomando como base precios del mercado.` Esta contradicción temporal no fue corregida ni reinterpretada y requiere validación institucional antes de publicar bienes o precios.

`requisitosOriginal` conserva las líneas de la columna fuente `DESCRIPCIÓN`. Esto no declara que cada línea sea jurídicamente un requisito: el PDF no contiene una columna separada llamada `REQUISITOS`.

## 4. Staging

El archivo `backend/src/tools/tupa/staging/tupa-suiza-2026.staging.json` contiene los metadatos verificados y las 72 entradas. Cada entrada mapea los campos físicos, salvo estos campos auxiliares de revisión, que el importador no persiste:

- `textoOriginal`;
- `clasificacion`;
- `candidatoRadicacion`;
- `estadoHomologacion`;
- `observacionClasificacion`.

El estado de carga por defecto y único permitido por la herramienta es `PENDIENTE_VALIDACION`. `PENDIENTE` no es válido porque contradice el `CHECK` SQL.

## 5. Validador

`backend/src/tools/tupa/validate-staging.mjs` comprueba:

- estructura JSON y versión del formato;
- campos obligatorios y valores `null` explícitos;
- SHA-256 minúsculo compatible con SQL;
- página y revisión positivas;
- denominación, fuente, referencia y texto original no vacíos;
- JSON finito y sin ciclos para requisitos;
- fechas y orden de vigencia;
- estados SQL y estados de homologación permitidos;
- referencia obligatoria para `APROBADO`;
- duplicados según la clave física de procedencia;
- consistencia de nombre y hash entre fuente y entradas.

## 6. Importador controlado

`backend/src/tools/tupa/import-staging.mjs` y `import-staging-cli.mjs` son herramientas manuales aisladas:

- el modo predeterminado es `DRY_RUN` y no abre conexión;
- `--apply` es explícito y exige `DATABASE_URL`;
- rechaza una fuente cuyo hash no esté verificado;
- rechaza toda entrada `APROBADO`, incluso si tiene referencia;
- utiliza una sola transacción y ejecuta `ROLLBACK` ante cualquier error;
- usa `ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING`;
- no forma parte de `migrate.ts` ni del arranque del backend.

Validación segura:

```text
cd backend
node src/tools/tupa/import-staging-cli.mjs
```

La escritura futura requeriría autorización separada, fuente verificada y una base descartable:

```text
node src/tools/tupa/import-staging-cli.mjs --apply
```

Ese segundo comando no fue ejecutado en esta etapa.

## 7. Separación entre staging, importación y publicación

1. **Staging:** transcripción y clasificación, sin base de datos.
2. **Importación:** crea únicamente filas `PENDIENTE_VALIDACION` mediante comando manual.
3. **Revisión:** institución/profesor contrasta fuente, alcance y clasificación.
4. **Aprobación:** requiere acto o referencia verificable y un procedimiento independiente todavía no implementado.
5. **Publicación:** Christian debe servir únicamente `estado_validacion = 'APROBADO'`.

Por tanto, importar nunca equivale a homologar o publicar.

## 8. Pruebas y evidencia

Se utilizó `node:test` porque las dependencias locales de Vitest no están instaladas y no se autorizó instalarlas. Comando:

```text
node --test tests/unit/tools/tupa-staging.test.mjs
```

Casos: fuente válida, hash inválido, página inválida, denominación vacía, JSON malformado, duplicado, aprobación sin referencia, monto textual intacto, campos `null`, dry-run sin consultas, fuente no verificada, bloqueo de `APROBADO`, transacción/idempotencia y rollback inducido.

Resultado local verificado el 2026-10-17: **18/18 PASS, 0 FAIL, 0 SKIP**. También se ejecutó el comando de dry-run con `entradasValidas: 72`, `insertadas: 0` y `omitidas: 0`; no se abrió conexión ni se escribió en base de datos.

Evidencia TDD: antes de adaptar las clasificaciones y poblar el staging, la suite quedó en RED (6 PASS, 12 FAIL) por las reglas nuevas y la fuente todavía vacía. Después de la implementación, el mismo objetivo quedó en GREEN. La cobertura integrada de `validate-staging.mjs` e `import-staging.mjs` fue 88.21 % de líneas, 54.35 % de ramas y 100 % de funciones; la cobertura de ramas queda como mejora no bloqueante de la herramienta aislada.

## 9. Rollback operativo

- Dry-run: no hay escrituras que revertir.
- Apply: el importador usa `BEGIN`/`COMMIT`; un error ejecuta `ROLLBACK`.
- Después del commit no se borra ni actualiza una versión porque la tabla es WORM.
- Una corrección documental futura requiere una nueva `revision`, no alterar la fila previa.

## 10. Propiedad de archivos

| Archivo | Geric | Christian | Compartido | Riesgo |
|---|---|---|---|---|
| `backend/src/tools/tupa/*.mjs` | Sí | No | No | Bajo; herramienta aislada |
| `backend/src/tools/tupa/staging/*.json` | Sí | No | No | Bajo; no publicable |
| `backend/tests/unit/tools/tupa-staging.test.mjs` | Sí | No | No | Bajo; suite aislada |
| `docs/cambios_prototipo/GERIC/CP-GERIC-008-*` | Sí | No | No | Bajo; documentación propia |
| `backend/src/domains/tramicore/*` | No | Sí | No se modificó | Protegido |
| `backend/migraciones/08_sigd_tupa_acoplamiento.sql` | Referencia | No debe editarse | No se modificó | Protegido |

Resultado: cero archivos funcionales compartidos con Christian.

## 11. Próxima revisión de homologación

Antes de cualquier carga o publicación, Geric/profesor debe:

1. revisar las 72 transcripciones contra las seis páginas;
2. resolver primero las 19 filas `REQUIERE_DECISION`;
3. confirmar cuáles de los 22 candidatos realmente generan expediente SIGD;
4. validar las discrepancias literales de montos y denominaciones sin alterar la fuente;
5. documentar la referencia de aprobación institucional;
6. mantener la importación en `PENDIENTE_VALIDACION`;
7. ejecutar una carga autorizada solo en base descartable antes de considerar producción.
