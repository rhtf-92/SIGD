# CP-POOL-002 — Aislamiento del volumen /app/node_modules

**Clasificación:** Infraestructura / Integración de BD
**Estado:** Completado
**Fecha:** 2026-10-08
**Autor:** Pool Angelo Carranza Pereyra (B_POOL)

---

## Objeto
Evitar que el volumen montado desde Windows (`./backend:/app`) sobrescriba `node_modules` con permisos NTFS rotos (`cross-env: Permission denied`).

## Problema
Windows NTFS no preserva bits `+x` de Linux en `node_modules/.bin/`; al montar `./backend:/app`, `cross-env` y `argon2` perdían ejecutabilidad y el backend caía.

## Solución aplicada
En `docker-compose.yml` servicio `backend`:
```yaml
volumes:
  - ./backend:/app
  - /app/node_modules
```
El volumen anónimo `/app/node_modules` restaura la copia de la imagen (permisos Linux intactos) sin alterar código fuente.

## Evidencia real
- `docker compose ps`: `sigd_backend` `Up` tras corrección.
- `docker compose logs --tail=200 backend`: `npm install` pasa sin error de `cross-env`; `npm audit` muestra 14 vulnerabilidades pero no bloquea arranque.
- `git diff`: cambio solo en `docker-compose.yml` (línea de volúmenes).

## Estado final
Backend inicia sin errores de permisos; migraciones automáticas comienzan (`01_sigd_audit`).

---
## Comandos ejecutados
```bash
docker compose up -d --build backend
docker compose ps
docker compose logs --tail=200 backend
```
