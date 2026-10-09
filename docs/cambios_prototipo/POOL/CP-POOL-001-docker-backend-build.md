# CP-POOL-001 — Exclusión de archivos innecesarios en build context

**Clasificación:** Infraestructura / Integración de BD
**Estado:** Completado (solo lectura de configuración; sin impacto funcional)
**Fecha:** 2026-10-08
**Autor:** Pool Angelo Carranza Pereyra (B_POOL)

---

## Objeto
Eliminar del contexto Docker los archivos innecesarios para reducir y acelerar el build del backend (`sigd-backend`).

## Problema
El directorio `backend/` contenía `node_modules` (~93.21 MB), generando un contexto de ~100.4 MB que provocaba timeout en `docker compose build backend`.

## Solución aplicada
Creación de `backend/.dockerignore` con exclusiones: `node_modules`, `dist`, `.git`, `.gitignore`, `.env`, `*.log`, `coverage`.

## Evidencia real
- `docker build --no-cache`: contexto pasado de ~100 MB a ~29 KB (`transferring context: 28.95kB 0.1s`)
- `git status`: `?? backend/.dockerignore`
- No se modificó `package.json`, `package-lock.json` ni código fuente.

## Estado final
Build pasa en segundos; imagen `sigd-backend:latest` creada (993 MB); `argon2` compilado correctamente.

---
## Comandos ejecutados (reproducibles)
```bash
docker compose build backend
docker images sigd-backend
git status -sb
```
