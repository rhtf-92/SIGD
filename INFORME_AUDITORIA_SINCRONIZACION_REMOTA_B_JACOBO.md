# INFORME DE AUDITORÍA FORENSE DE SINCRONIZACIÓN GIT
## VERIFICACIÓN DE COMMITS LOCALES VS. REPOSITORIO REMOTO
### RAMA EXCLUSIVA: `B_JACOBO` | OPERACIÓN DE SOLO LECTURA

---

**Fecha y Hora de Auditoría:** 18 de Noviembre de 2026 — 13:45:00 -05:00  
**Proyecto:** SIGD RENATO — Sistema Integral de Gestión Documentaria  
**Institución:** IESTP Suiza — Pucallpa, Ucayali  
**Auditor:** Arquitecto de Software Senior / Especialista Forense Git  
**Alcance:** Exclusivo rama `B_JACOBO` (Solo Lectura)

---

## 1. REPOSITORIO LOCAL VERIFICADO

- **Directorio raíz verificado:** `C:/Users/Liz/Desktop/SIGD/SIGD`
- **Estado de Git:** Repositorio Git válido e íntegro.
- **Rama local activa:** `B_JACOBO` (Verificación estricta: Coincidente. No se realizaron cambios de rama).
- **HEAD local actual:**  
  `3bcf996388632b20fce18bf7d8b82aae14cb34fc` (Commit 20 — TSK-DEV-05.2)
- **Estado del Working Tree:**
  - Archivos en Staging (`staged`): **0 archivos** (Área de preparación limpia).
  - Archivos rastreados con cambios sin staged: **3 archivos** (Exclusivos de remediación normativa TSK-DEV-05.3, protegidos sin tocar).
  - Archivos nuevos no rastreados (`untracked`): **137 archivos** (Incluye 2 archivos de TSK-DEV-05.3 y 135 elementos históricos preservados).

---

## 2. RAMA LOCAL

- **Nombre de la rama:** `B_JACOBO`
- **Configuración de seguimiento (Upstream):** `refs/remotes/origin/B_JACOBO`
- **Comportamiento configurado:**
  - `branch.B_JACOBO.remote` = `origin`
  - `branch.B_JACOBO.merge` = `refs/heads/B_JACOBO`

---

## 3. IDENTIFICACIÓN Y SANITIZACIÓN DEL REPOSITORIO REMOTO

- **Nombre del remoto principal:** `origin`
- **Fetch URL:** `https://github.com/rhtf-92/SIGD.git` *(Sanitizado: sin tokens, contraseñas ni credenciales embebidas)*
- **Push URL:** `https://github.com/rhtf-92/SIGD.git` *(Sanitizado)*
- **Protocolo:** HTTPS estándar sobre GitHub.

---

## 4. RAMA REMOTA COMPROBADA

- **Referencia remota inspeccionada:** `refs/heads/B_JACOBO`
- **Existencia remota:** Confirmada mediante consulta directa `git ls-remote origin refs/heads/B_JACOBO`.
- **Descarga de referencia de lectura:** Ejecutada mediante `git fetch --no-tags origin refs/heads/B_JACOBO` sin modificar el working tree, sin alterar ramas locales ni aplicar merges/rebases.

---

## 5. COMPARACIÓN DE HEADS Y ESTADO DE DIVERGENCIA

| Métrica | Hash SHA-1 | Descripción / Mensaje | Fecha |
|---|---|---|---|
| **HEAD Local** | `3bcf996388632b20fce18bf7d8b82aae14cb34fc` | `fix(security): desacoplar s3Key de contratos REST y consolidar abstraccion de storage (TSK-DEV-05.2)` | 2026-11-18 11:33:19 -0500 |
| **HEAD Remoto (FETCH_HEAD)** | `bf30d8a0c85e266a86381fb10bf3740a8451c032` | `chore(sigd): guardar avance del prototipo y TUPA Suiza 2026` | 2026-10-17 23:23:55 -0500 |

### Análisis de Topología Git (`git rev-list --left-right --count HEAD...FETCH_HEAD`)
- **Commits locales por encima del remoto (Ahead):** `20`
- **Commits remotos por encima del local (Behind):** `0`
- **Ancestro Común (`merge-base`):** `bf30d8a0c85e266a86381fb10bf3740a8451c032` (El HEAD remoto es ancestro directo del HEAD local).
- **Divergencia:** **0% de divergencia.** La rama remota no ha recibido commits ajenos ni bifurcaciones. La relación es lineal y 100% elegible para avance rápido (*Fast-Forward*).

---

## 6. COMMITS LOCALES PENDIENTES DE SUBIR (AHEAD 20)

Existen exactamente **20 commits consolidados localmente** que **NO están subidos a GitHub**:

| # | Hash Corto | Hash Completo | Autor | Fecha | Mensaje |
|---|---|---|---|---|---|
| **20** | `3bcf996` | `3bcf996388632b20fce18bf7d8b82aae14cb34fc` | REDBLACK-OL | 2026-11-18 11:33 | `fix(security): desacoplar s3Key de contratos REST y consolidar abstraccion de storage (TSK-DEV-05.2)` |
| **19** | `c27c8c0` | `c27c8c02a28285a04efdc4f888e6544271e6053a` | REDBLACK-OL | 2026-11-18 10:55 | `feat(rutadoc): implementar despacho resolutivo y reconciliacion del expediente` |
| **18** | `b9e9d6a` | `b9e9d6a873c97b3767e1c3a75cbff5f62b963e61` | REDBLACK-OL | 2026-11-18 08:58 | `feat(rutadoc): completar interfaz de acumulacion, desacumulacion y desglose documental` |
| **17** | `19efde1` | `19efde1adec80ae07720ca191887b4503aebe58f` | REDBLACK-OL | 2026-11-18 08:12 | `feat(rutadoc): implementar acumulacion, desacumulacion y desglose documental con foliacion inmutable` |
| **16** | `d346d4f` | `d346d4f7b2573cb684005b0d668cdc696e901f4f` | REDBLACK-OL | 2026-11-18 00:35 | `feat(rutadoc): implement observaciones subsanaciones rondas preclusion and sla suspension` |
| **15** | `4490f87` | `4490f872789f7870ed570f32adfc75939e2c7d42` | REDBLACK-OL | 2026-11-17 23:07 | `test(rutadoc): add isolated gestor apoyo E2E integration harness` |
| **14** | `f3b65c9` | `f3b65c98a2f9f1457b8d9282dbcaccdbcb131bb3` | REDBLACK-OL | 2026-11-17 12:08 | `feat(frontend): desacoplar autorizaciones rbac en recepcion, digitalizacion y derivacion` |
| **13** | `4862e7e` | `4862e7e6ada2e07d56960552834fb2cc9cdf5b0e` | REDBLACK-OL | 2026-11-17 10:32 | `fix(rutadoc): exigir EXPEDIENTE_RECEPCIONAR y blindar fail-closed en recepcion [HAL-B03-07]` |
| **12** | `c10c01b` | `c10c01b6b71f79ea8599adb6347b96efebf6abfc` | REDBLACK-OL | 2026-11-17 09:25 | `feat(rutadoc): exigir autorizacion explicita EXPEDIENTE_ADJUNTAR en digitalizacion [HAL-B03-03]` |
| **11** | `d69f23d` | `d69f23d87a6452a9bd2b321fb3a461e275789e50` | REDBLACK-OL | 2026-11-17 08:18 | `fix(rbac): endurecer tipado estricto en ProtectedRoute [HAL-F09-10]` |
| **10** | `da8a660` | `da8a660d49833d3754acd0626811d78b935944ae` | REDBLACK-OL | 2026-11-17 07:49 | `refactor(types): unificar interfaz EvaluacionSupervisionItem en expediente.ts [HAL-F09-11]` |
| **9** | `5534e61` | `5534e612335d5801b5bd395eddcc26206842ad65` | REDBLACK-OL | 2026-11-17 01:24 | `refactor(auth): desacoplar roles institucionales y capacidades delegadas [B-02]` |
| **8** | `d59f65e` | `d59f65e48b2c985b34dbb533a81eb0e21efb188b` | REDBLACK-OL | 2026-11-16 23:50 | `feat(evaluadores): implementar interfaz de reasignacion masiva [B-01]` |
| **7** | `02ca4bc` | `02ca4bc9881f1fba716de573c156429882ecef07` | REDBLACK-OL | 2026-11-16 22:13 | `test(db): actualiza conteo de migraciones activas a 26 incluyendo migracion 28` |
| **6** | `65d45b0` | `65d45b05f8ae2bcf2ec89bcef6c0461d3b564d8a` | REDBLACK-OL | 2026-11-16 21:26 | `fix(rbac): elimina definitivamente ESPECIALISTA y preserva historial WORM` |
| **5** | `54d64e7` | `54d64e739bd1bd361334039096d17a13091e1ee0` | REDBLACK-OL | 2026-11-16 20:36 | `feat(tramicore): implementar catalogo tupa suiza 2026 dinamico desde postgresql y desacoplar frontend [HAL-04]` |
| **4** | `817a78b` | `817a78b463f810ab8a1a8c864e202577010c8194` | REDBLACK-OL | 2026-11-16 16:54 | `chore(sigd): consolida depuracion historica y residuos tecnicos` |
| **3** | `c1c9e1d` | `c1c9e1df15820016c86cf7c6d1d756b25fd9312d` | REDBLACK-OL | 2026-11-16 16:01 | `docs(sigd): consolida documentación técnica institucional` |
| **2** | `1f459d1` | `1f459d1acd7000c7b585600f8a0cddae81b848ef` | REDBLACK-OL | 2026-11-16 15:29 | `feat(sigd): integra nucleo fullstack y flujo funcional` |
| **1** | `87e34b5` | `87e34b519d334acd0c27e350fcc484422769b0f4` | REDBLACK-OL | 2026-11-16 14:35 | `feat(db): canoniza migraciones y valida runner` |

---

## 7. COMMITS REMOTOS PENDIENTES DE DESCARGAR (BEHIND 0)

- **Total:** `0 commits`.
- No existe ningún commit en GitHub que no esté integrado localmente.

---

## 8. VERIFICACIÓN OBLIGATORIA INDIVIDUAL DE LOS COMMITS 17 AL 20

Se realizó la verificación formal de ancestría frente al HEAD remoto (`git merge-base --is-ancestor <commit> FETCH_HEAD`):

| Commit | Hash Corto | Hash Completo | Descripción | ¿Existe en el remoto? | Estado Forense |
|---|---|---|---|---|---|
| **Commit 17** | `19efde1` | `19efde1adec80ae07720ca191887b4503aebe58f` | Acumulación, desacumulación y desglose con foliación inmutable | **NO** (Código salida: 1) | **LOCAL ONLY** |
| **Commit 18** | `b9e9d6a` | `b9e9d6a873c97b3767e1c3a75cbff5f62b963e61` | Interfaz UI de acumulación, desacumulación y desglose | **NO** (Código salida: 1) | **LOCAL ONLY** |
| **Commit 19** | `c27c8c0` | `c27c8c02a28285a04efdc4f888e6544271e6053a` | Despacho resolutivo y reconciliación de expediente (TSK-DEV-05.1) | **NO** (Código salida: 1) | **LOCAL ONLY** |
| **Commit 20** | `3bcf996` | `3bcf996388632b20fce18bf7d8b82aae14cb34fc` | Desacoplamiento s3Key y abstracción de Storage (TSK-DEV-05.2) | **NO** (Código salida: 1) | **LOCAL ONLY** |

**Conclusión Forense:** Ninguno de los commits 17, 18, 19 ni 20 ha llegado a GitHub. Permanecen confinados al entorno local.

---

## 9. CONFIRMACIÓN DE PRESENCIA DE BACKEND, FRONTEND E INFRAESTRUCTURA EN EL REMOTO

Se inspeccionó el árbol de objetos de `FETCH_HEAD` (`git ls-tree`):

### A. Estado en el Repositorio Remoto (`FETCH_HEAD` en `bf30d8a`, 17-Oct-2026)
- **Backend:** Presente únicamente en su versión embrionaria de octubre de 2026.
  - Dominios existentes: `corelink`, `docucore`, `identicore`, `organicore`, `rutadoc`, `tramicore`.
  - **Faltan dominios:** `plataforma` y `tesoreria` **NO existen** en el remoto.
  - **Migraciones de base de datos:** Solo existen las migraciones `01_sigd_audit.sql` hasta `07_sigd_reportes.sql` (7 migraciones). Las 21 migraciones posteriores (`08` a la `30`, incluyendo la migración 30 de desglose) **NO existen** en el remoto.
- **Frontend:** Presente únicamente en su versión embrionaria de octubre de 2026.
  - Faltan componentes clave: `DespachoResolutivoSeccion.tsx`, `AcumulacionModal.tsx`, `DesacumulacionModal.tsx`, `DesgloseModal.tsx`, `VisorPdfExpediente.tsx`, `UbigeoSelectorNacional.tsx`, entre otros.
- **Infraestructura:**
  - `docker-compose.yml`, `backend/Dockerfile.sigd`, `frontend/Dockerfile.sigd` existen en el remoto, pero carecen de las optimizaciones, variables de entorno y compatibilidad con las migraciones 08–30.

### B. Impacto para los Compañeros de Equipo
> [!WARNING]
> Si los compañeros descargan la rama `B_JACOBO` desde GitHub en este momento:
> - Descargarán un prototipo obsoleto de fecha 17 de octubre de 2026.
> - **NO** tendrán el sistema SIGD RENATO consolidado.
> - Les faltarán más de **709 archivos modificados/creados**, **104,061 inserciones de código**, 21 migraciones SQL y toda la lógica de los Bloques 3, 4 y 5 (5.1 y 5.2).

---

## 10. ESTADO DE DOCKER Y CONFIGURACIONES VERSIONADAS

- En local, Docker Compose y los Dockerfiles están listos para orquestar PostgreSQL 15, MinIO S3 y los servicios de backend/frontend.
- En el remoto, las configuraciones son preliminares y no están alineadas a la arquitectura de Storage desacoplada implementada en el Commit 20 (`TSK-DEV-05.2`).

---

## 11. IDENTIFICACIÓN Y CLASIFICACIÓN DE ELEMENTOS LOCALES NO PUBLICADOS

### Clasificación A: Commits locales consolidados pendientes de publicar
- **Cantidad:** 20 commits lineales.
- **Volumen de código:** 709 archivos afectados (`+104,061` inserciones / `-43,194` supresiones).
- **Estado:** Consolidados e inmutables en el historial Git local, listos para Fast-Forward.

### Clasificación B: Modificaciones rastreadas todavía sin commit (TSK-DEV-05.3)
Trabajo en curso de remediación normativa (Notificación oficial, Casilla Electrónica y acuse LPAG):
1. `backend/src/domains/identicore/casilla.router.ts` (+584 líneas / -78 líneas)
2. `frontend/src/components/casilla/NotificacionDetailModal.tsx` (+86 líneas / -8 líneas)
3. `frontend/src/types/casilla.ts` (+8 líneas)
- **Estado:** Modificados sin staging. **Intactos y preservados sin alteración.**

### Clasificación C: Archivos nuevos no rastreados vinculados a TSK-DEV-05.3
1. `backend/src/domains/identicore/casillaAcusePdf.service.ts`
2. `backend/tests/integration/casilla-notificacion-lpag.spec.ts`
- **Estado:** No rastreados en Git. **Intactos y preservados.**

### Clasificación D: Archivos ignorados por `.gitignore`
Exactamente 21 patrones/archivos protegidos:
- Credenciales y entornos: `backend/.env`, `backend/.env.test`, `frontend/.env.local`.
- Dependencias y compilados: `node_modules/`, `backend/dist/`, `frontend/dist/`, `frontend/.vitest/`.
- Scripts temporales y logs de prueba: `scratch/`, `scripts/pruebas/`, `test-results/`.
- **Estado:** Correctamente blindados contra filtración de secretos.

### Clasificación E: Archivos históricos preservados (135 elementos)
Elementos de soporte técnico y bitácora institucional que deben permanecer fuera del control de versiones principal:
- **Dumps y checksums forenses:** `backups/*.dump`, `backups/*.sha256` (6 archivos).
- **Informes de auditoría y remediación:** 49 informes técnicos en `docs/` (`INFORME_AF-*.md`, `INFORME_*.md`, `PLAN_*.md`, etc.).
- **Bitácoras históricas de prototipo:** 52 documentos en `docs/cambios_prototipo/B_JACOBO/`.
- **Migraciones v2 y scripts down:** `backend/migraciones_v2/` (7 archivos), `backend/migraciones_reversion/` (2 archivos), `backend/migraciones/pendientes/` (4 archivos).
- **Scripts de control de entorno:** `iniciar-demo.ps1`, `detener-demo.ps1`, `scripts/*.ps1`.
- **Estado:** Preservados intactos localmente.

---

## 12. DICTAMEN DE SINCRONIZACIÓN

# **DICTAMEN B: Existen commits locales pendientes de publicar.**

### Diagnóstico Técnico Detallado:
1. **La rama `B_JACOBO` en GitHub está DESACTUALIZADA por 20 commits.**
2. **Ninguno de los avances consolidados recientes (Commits 1 al 20, incluyendo TSK-DEV-05.1 y TSK-DEV-05.2) ha sido subido a GitHub.**
3. **No existe divergencia (`behind 0`).** El remoto no tiene commits nuevos ni conflictos. La rama local es un avance puramente lineal (*Fast-Forward*).
4. **Tus compañeros de equipo NO PUEDEN descargar tu versión completa en este momento.** Si hacen `git pull origin B_JACOBO`, obtendrán el código de hace un mes.

---

## 13. PLAN DE ACCIÓN POSTERIOR (CUANDO EL USUARIO LO AUTORICE)

Para que los compañeros puedan clonar y descargar la versión completa y consolidada del SIGD RENATO sin afectar el trabajo en curso de TSK-DEV-05.3:

1. **Mantener aislados los cambios en curso de TSK-DEV-05.3:** No ejecutar `git add .` indiscriminado; no incluir los archivos de Casilla/Acuse ni los 135 archivos históricos.
2. **Publicar el historial consolidado (Commits 1 al 20):**
   Dado que el working tree tiene archivos modificados sin staging, un simple comando de publicación de rama:
   ```bash
   git push origin B_JACOBO
   ```
   subirá de manera segura y limpia exactamente los 20 commits consolidados hasta el Commit 20 (`3bcf996`), sin tocar los archivos modificados locales ni incluir los untracked.
3. **Verificar remotamente:** Confirmar que el HEAD de `origin/B_JACOBO` se sitúe en `3bcf996388632b20fce18bf7d8b82aae14cb34fc`.

---

**FIN DE LA AUDITORÍA FORENSE — ESTADO: PARADA OBLIGATORIA RIGUROSA.**  
*(No se ejecutó push, pull, commit, merge, rebase ni modificación de código).*
