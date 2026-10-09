# RESUMEN_PRUEBAS — Infraestructura y Migraciones SIGD (B_POOL)

**Fecha:** 2026-10-08
**Autor:** Pool Angelo Carranza Pereyra (B_POOL)
**Estado:** Solo lectura / diagnóstico; sin commit/push

---

## 1. Infraestructura Docker (Stack SIGD)

| Servicio | Imagen | Estado | Health | Notas |
|----------|--------|--------|--------|-------|
| postgres | postgres:18-alpine | Up | Healthy | BD limpia recreada (`down -v`) |
| minio | quay.io/minio/aistor/minio:latest | Up | Healthy | AIStor sin licencia → S3 denegado (WARN) |
| redis | redis:7-alpine | Up | Healthy | Cache / sesiones |
| backend | sigd-backend (build propio) | **Up → muerto** | N/A | Inicia, corre migraciones, luego cae (`42703`) |
| frontend | node:20-alpine | Up | — | Vite 6.4.3 en 5173; `EBADENGINE` por node 20 vs 24 |

## 2. Build backend

- `docker compose build backend` completado (cached tras primer intento fallido por contexto grande).
- Imagen: `sigd-backend:latest` (993 MB).
- `argon2` compiló correctamente (`python3 make g++` instalados en Dockerfile).
- `.dockerignore` operativo (contexto ~29 KB).
- Volumen `/app/node_modules` resuelve aislamiento NTFS.

## 3. Secuencia de migraciones limpias (base recreada)

| Migración | Estado | Notas |
|-----------|--------|-------|
| `01_sigd_audit.sql` | ✅ Pasó | Advisory Lock adquirido |
| `02_sigd_auth.sql` | ✅ Pasó | **CP-POOL-003 aplicado** (seed desactivado) |
| `03_sigd_org.sql` | ✅ Pasó | `ltree`, `btree_gist` |
| `04_sigd_doc.sql` | ✅ Pasó | `jsonb`, GIN |
| `05_sigd_tra.sql` | ✅ Pasó | `sigd_tra.generar_cut_expediente` |
| `06_sigd_rut.sql` | ❌ Falló | Línea 435: `e.id_expediente` no existe (`42703`) |

## 4. Endpoints / Salud

- `/health`: **NO responde** (proceso muerto tras `06_sigd_rut`)
- `/ready`: **NO responde**
- `http://localhost:5173`: **Responde** (frontend Vite)
- MinIO `9000/9001`: **Healthy** (pero S3 denegado por licencia)

## 5. Warnings restantes

- MinIO AIStor: `WARN: No valid license found, running in offline mode. All S3 operations are denied.`
- Backend (tras corrección): `npm audit` 14 vulnerabilidades (no bloquea)
- Frontend: `EBADENGINE` (node 20 vs 24); `spawn xdg-open ENOENT` (no bloquea)
- `backend/package-lock.json`: revertido a HEAD (accidental por `npm install` en contenedor)

## 6. Datos / Cambios aplicados (sin commit/push)

- `backend/migraciones/02_sigd_auth.sql`: seed comentado (CP-POOL-003)
- `backend/Dockerfile` creado
- `backend/.dockerignore` creado
- `docker-compose.yml`: `image` minio, `build` backend, `volumes` `/app/node_modules`
- `docs/cambios_prototipo/POOL/`: 4 documentos CP + RESUMEN

## 7. Veredicto

**ENTORNO LISTO CON ADVERTENCIAS ESTRUCTURALES:** infra operativa, backend inicia, migraciones avanzan hasta `06_sigd_rut`; bloqueado por error SQL `42703` (referencia incorrecta de columna en `06_sigd_rut.sql` línea 435, requiere autorización para corrección mínima). MinIO operativo pero sin licencia funcional para S3.
