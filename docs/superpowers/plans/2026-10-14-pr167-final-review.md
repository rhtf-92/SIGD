# PR #167 — cierre de revisión final

## Objetivo

Resolver las seis observaciones de revisión sin modificar migraciones históricas, RutaDoc, Reportes, `F_BARTRA` ni `main`, y actualizar únicamente `fix/leonardo-organicore-admin`.

## Restricciones globales

- La migración 15 no controla transacciones; `ejecutarMigraciones` mantiene la única transacción.
- Las pruebas de migración usan PostgreSQL real y el runner de producción.
- `s3.config.ts` recibe únicamente el cambio mínimo de política requerido.
- No se hace merge.

## Tarea 1 — Migración 15 y rollback real

1. Añadir una prueba de integración que ejecute la migración 15 mediante `ejecutarMigraciones` sobre PostgreSQL real.
2. Comprobar el cambio `VARCHAR(255) -> TEXT` y el registro del checksum.
3. Añadir una migración posterior deliberadamente fallida y comprobar rollback completo del tipo y del registro.
4. Ejecutar la prueba y observar el fallo por `BEGIN`/`COMMIT` internos.
5. Retirar `BEGIN` y `COMMIT` de la migración 15 y repetir hasta verde.

## Tarea 2 — Seguridad S3

1. Añadir casos que rechacen `EXAMPLE_S3_ACCESS_KEY` y `EXAMPLE_S3_SECRET_KEY` en producción.
2. Observar el fallo.
3. Ampliar mínimamente la lista de marcadores inseguros y repetir hasta verde.

## Tarea 3 — Refresh JWT concurrente

1. Hacer explícitas las dos condiciones independientes en la prueba PostgreSQL real: exactamente un HTTP 200 y exactamente un HTTP 401 para el mismo token.
2. Comprobar que la sesión consumida queda revocada y que sólo queda vigente la sesión rotada.

## Tarea 4 — Dependencia vulnerable

1. Registrar el fallo de `npm audit` para `source-map-js < 1.2.2`.
2. Actualizar el lockfile al parche compatible mínimo.
3. Ejecutar `npm audit --audit-level=high` y la validación completa del frontend.

## Tarea 5 — Verificación, revisión y entrega

1. Ejecutar typecheck, build y pruebas backend/frontend.
2. Ejecutar dos veces la suite PostgreSQL real para detectar dependencia de estado.
3. Revisar el diff completo contra `F_BARTRA` con un revisor independiente.
4. Corregir hallazgos importantes, confirmar checks, hacer commit y push al mismo PR #167.
5. Publicar en el PR las evidencias; no hacer merge.

## Enfoque de revisión

- Límites transaccionales y restauración de estado ante fallo DDL.
- Carrera real de dos refresh tokens idénticos.
- Marcadores de credenciales de ejemplo, mayúsculas/minúsculas y atribución de campo.
- Ausencia de cambios en migraciones históricas 02/06/07 y módulos ajenos.
