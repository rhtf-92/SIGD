# CP-GERIC-003 — Sincronización controlada del lockfile frontend

## Bloqueo original

`npm ci` con Node `24.19.0` informó que `frontend/package.json` y `frontend/package-lock.json` no estaban sincronizados. El primer faltante reportado fue `eslint@10.12.0`. No se halló evidencia de corrupción del lockfile por Alpine: el problema de `node_modules` Windows/Linux y la falta de entradas en el lockfile son distintos.

## Evidencia de antes y después

SHA-256 del contenido Git `HEAD` original:

| Archivo | SHA-256 original en `HEAD` |
| --- | --- |
| `frontend/package.json` | `fa2b2d7b063ebc79ff64a9f046f4711fa9e0e4c1b36bdbd375776be0139e378d` |
| `frontend/package-lock.json` | `ab0239738bc7b8708583a24bb7f9bf56f337c766998a8702f340b2ebdd414a80` |

SHA-256 de archivos actuales en disco: `package.json` = `06d33fdfa3a698c758ce187329a57cfebd94b01fe792ca0881a4dce7273d7caa`; `package-lock.json` = `38ce68d10ebdc0aa53f6d6a29eab6e5e3f0b538e68c7de899c9f71a20ab5cf15`. El hash de trabajo de `package.json` difiere del blob Git por finales de línea; su contenido normalizado/JSON es idéntico a `HEAD` y `git status` no lo marca modificado.

`lock_head.json` y `pkg_head.json` eran exportaciones temporales UTF-16LE: tras decodificar y normalizar finales de línea, coincidían con los blobs originales de `HEAD`. Se conservaron sus hashes de origen en la tabla anterior y se excluyeron del commit.

## Regeneración y validación

El lockfile se regeneró dentro de Node 24.19, montando `package.json` de solo lectura. Comando equivalente reproducible desde la raíz, con el código en contenedor y sin instalar dependencias en Windows:

```powershell
docker run --rm -v "${PWD}/frontend:/app" -v "${PWD}/frontend/package.json:/app/package.json:ro" -w /app node:24.19.0-alpine npm install --package-lock-only --ignore-scripts --no-audit --no-fund
```

Diff verificado: **947 líneas añadidas, 3 eliminadas**, **71 entradas nuevas**, ninguna entrada eliminada; incluye `node_modules/eslint` versión `10.12.0`. El objeto raíz `packages[""]` del lockfile permanece igual, por lo que no se alteraron versiones directas declaradas. El lockfile incorpora metadatos `resolved`, `integrity` y dependencias transitivas de esas entradas.

La validación posterior con `npm ci` en `node:24.19.0-alpine`, usando `/app/node_modules` en volumen Docker, terminó **PASS**; el frontend arrancó con Vite `6.4.3` y sirvió `http://localhost:5173/`. El host no recibió `node_modules`. `frontend/package.json` no se modificó; solo se sincronizó `frontend/package-lock.json`.
