# CP-GERIC-013 — Activación controlada del catálogo TUPA

## 1. Alcance y significado

Esta etapa activa en el staging únicamente 18 entradas seleccionadas por el equipo para el prototipo académico. El valor `APROBADO` y la referencia interna documentan esta selección técnica y funcional; no representan aprobación, resolución ni homologación institucional del IESTP Suiza.

Referencia interna:

`VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1`

## 2. Fuente y procedencia

- Fuente: `TUPA_2026_IESTP_Suiza.pdf`.
- SHA-256 de la fuente oficial: `377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622`.
- SHA-256 físico del staging después de la activación: `e8ead3255eaab3e7779a1e9e895b8f8b5b87e9e094066bfa414681a0df3c9613`.
- Total: 72 entradas.
- `APROBADO`: 18.
- `PENDIENTE_VALIDACION`: 54.

El hash físico del staging no sustituye el hash de la fuente. Las 72 entradas conservan `documentoSha256` con el hash del PDF oficial.

## 3. Entradas activadas

| Referencia | Página | Denominación literal |
|---|---:|---|
| p1-fila-05 | 1 | Certificado Modular (I, II, III y IV) Por cada Módulo |
| p1-fila-06 | 1 | Certificado de Inglés |
| p4-fila-02 | 4 | Constancia de No Adeudar (Para fines de Titulación) |
| p4-fila-05 | 4 | Expedición de Título |
| p4-fila-06 | 4 | Certificado de Estudios Superiores (6 Semestres) |
| p4-fila-07 | 4 | Visación de Certificado de Estudios Superiores |
| p4-fila-10 | 4 | Inscripción de Título |
| p4-fila-15 | 4 | Modificación de Datos del Título |
| p5-fila-06 | 5 | Constancia de Egresado |
| p5-fila-07 | 5 | Certificado de Bachillerato |
| p5-fila-09 | 5 | Convalidación entre Planes de Estudios |
| p5-fila-10 | 5 | Convalidación por Unidades de Competencia |
| p5-fila-11 | 5 | Devolución de Expediente |
| p5-fila-18 | 5 | Reserva de Matrícula - Ingresantes |
| p5-fila-19 | 5 | Licencia de Estudios - Estudiantes Antiguos |
| p5-fila-20 | 5 | Traslado Interno |
| p5-fila-21 | 5 | Traslado Externo |
| p6-fila-04 | 6 | Titulación de Otros Institutos Tecnológicos |

Solo se modificaron `estadoValidacion` y `referenciaAprobacion` en estas 18 entradas. Las denominaciones, páginas, códigos, montos, requisitos, texto original, revisión, vigencias, clasificación y procedencia permanecen sin cambios.

## 4. Entradas que permanecen pendientes

Las otras 54 entradas conservan:

```json
{
  "estadoValidacion": "PENDIENTE_VALIDACION",
  "referenciaAprobacion": null
}
```

Esto incluye expresamente `p4-fila-16`, `p5-fila-05`, `p5-fila-08`, `p6-fila-02`, `p6-fila-03` y `p6-fila-05`.

## 5. Validaciones ejecutadas

### Validador

El validador `backend/src/tools/tupa/validate-staging.mjs` confirmó:

- 72 entradas válidas y 72 referencias de procedencia únicas;
- 18 aprobadas, todas con la referencia interna exacta;
- 54 pendientes, todas con referencia nula;
- hash de fuente válido y coincidente en todas las entradas;
- páginas y revisiones válidas;
- cero errores de validación.

### Pruebas unitarias

Comando:

`node --test backend/tests/unit/tools/tupa-staging.test.mjs`

Resultado: **19 PASS, 0 FAIL, 0 SKIP**.

Las pruebas comprueban la whitelist exacta, las seis exclusiones, las denominaciones y páginas literales, el hash documental, referencias de aprobación, dry-run sin consultas, estados inválidos, bloqueo de `APROBADO` en modo apply, transacción, idempotencia y rollback.

### Dry-run

Comando:

`node backend/src/tools/tupa/import-staging-cli.mjs --dry-run`

Resultado:

- modo: `DRY_RUN`;
- entradas válidas: 72;
- aprobadas: 18, según el validador previo;
- pendientes: 54, según el validador previo;
- inválidas: 0;
- duplicadas: 0;
- insertadas: 0;
- consultas o conexiones a base de datos: 0.

## 6. Política actual del importador

El dry-run acepta y valida las 18 entradas `APROBADO` porque no escribe ni abre conexión. En modo apply, `backend/src/tools/tupa/import-staging.mjs` bloquea el lote si encuentra cualquier entrada `APROBADO` mediante el error `IMPORTACION_BLOQUEADA: esta herramienta no inserta registros APROBADO.`

La política se conserva sin cambios en esta fase. Por tanto, el catálogo está preparado pero todavía no puede cargarse con `--apply`.

## 7. Cambio mínimo futuro para una prueba aislada

Antes de probar en PostgreSQL descartable se requiere un permiso explícito, cerrado por defecto, que:

1. solo se habilite junto con `--apply` mediante una opción inequívoca para prototipo;
2. acepte `APROBADO` únicamente con la referencia `VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1`;
3. compruebe la whitelist exacta de 18 referencias;
4. mantenga bloqueada cualquier otra entrada aprobada;
5. conserve transacción, rollback e idempotencia;
6. se ejecute únicamente contra una base PostgreSQL temporal y descartable.

Este cambio no fue implementado en la presente etapa.

## 8. Control arquitectónico

Esta activación modifica únicamente:

- el staging TUPA;
- las pruebas unitarias de la herramienta TUPA;
- esta documentación.

No se modificaron migraciones, baseline, `migrate.ts`, TramiCore, RutaDoc, Auth, reportes, frontend, Docker ni lockfiles. No se eliminó ni reemplazó ningún archivo proveniente de `main`.

## 9. Estado final

El catálogo TUPA del prototipo queda preparado documental y estáticamente. No se conectó a una base de datos, no se ejecutó `--apply`, no se importaron registros y no se realizó commit ni push.
