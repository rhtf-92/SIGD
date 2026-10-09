# CP-POOL-003 — Corrección de seed inválido en migración de autenticación

**Clasificación:** Infraestructura / Integración de BD
**Estado:** Completado (solo desactivación; esquema intacto)
**Fecha:** 2026-10-08
**Autor:** Pool Angelo Carranza Pereyra (B_POOL)
**Etiqueta documento:** CP-POOL-003

---

## Objeto
Desactivar el INSERT de demostración que violaba la FK `notificacion_casilla_usuario_id_fkey`.

## Problema
`backend/migraciones/02_sigd_auth.sql` intentaba insertar:
```sql
INSERT INTO sigd_auth.notificacion_casilla (id, usuario_id, ...)
VALUES ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', ...)
```
`usuario_id` referenciaba `cuenta_usuario.id_usuario`, que no existía en la base limpia. Error PostgreSQL: `23503` (FK violation) al ejecutar `02_sigd_auth.sql`.

## Solución aplicada
Comentado únicamente el bloque `INSERT` de seed (líneas 205–219), preservando `CREATE TABLE`, índices, FK y autenticación. No se creó usuario artificial.

## Impacto funcional
**NO cambia esquema ni lógica de negocio.** Elimina únicamente datos semilla inconsistentes.

## Evidencia real
- `git diff -- backend/migraciones/02_sigd_auth.sql`: eliminación de INSERT; comentario `CP-POOL-003` agregado.
- `docker compose logs --tail=300 backend`: `migraciones DDL: 01_sigd_audit.sql` y `02_sigd_auth.sql` pasan sin error FK; luego `03_sigd_org.sql`, `04_sigd_doc.sql`, `05_sigd_tra.sql`, `06_sigd_rut.sql` avanzan.
- No `commit` / `push` realizado.

---
## Comandos de validación
```bash
git status -sb
docker compose up -d
docker compose logs --tail=300 backend
```

---
## Estado final
Migración `02_sigd_auth` pasa; esquema `sigd_auth.notificacion_casilla` intacto; FK preservada.
