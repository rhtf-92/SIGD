INFORME DE DIAGNÓSTICO — G6-02 (solo lectura)

Diagnóstico completado. Estado final: sin ningún cambio en el working tree, sin merge/rebase/cherry-pick/commit/push.

1. Rama y SHA
Rama actual: B_CHRISTIAN ✔ (exacta)
HEAD local: 839b12a64f39d93baa770535ec10d9f3092b31e6 (“diagnostico completado”)
Remoto: B_CHRISTIAN...origin/B_CHRISTIAN (sin divergencia declarada)
Commit técnico de Geric: 4e06e512... existe (tipo commit); contiene 2 commits: feat(tupa): add UUID-compatible baseline and integration y docs(tupa): define Grupo 6 coupling plan.
2. Estado Git inicial y final
Inicial: working tree limpio, sin cambios locales, sincronizado con origin.
Final: idéntico al inicial. No se ejecutó restore/reset/clean/checkout/stash. La fetch actualizó referencias remotas de otras ramas (sin tocar el árbol).
3. Diferencias B_CHRISTIAN ↔ 4e06e512 (sin modificar el árbol)

41 archivos, +5104/−525. Resumen por categoría:

Grupo	Archivos
Añadidos por Geric	backend/baselines/BASELINE_2026_V1.sql (1001 líneas), 08_sigd_tupa_acoplamiento.sql, Dockerfile.demo, docker-compose.demo.yml, vitest.{baseline-geric,rutadoc-uuid,tupa-geric}.config.ts, tests nuevos (baseline-2026.test.ts, uuid-contrato.test.ts, tupa-acoplamiento.test.ts, reportes-uuid.test.ts, fixture), docs CP-GERIC-001..007 y RESUMEN_PRUEBAS
Modificados (yo no los toqué; diferencia vs Geric)	backend/src/db/migrate.ts (155 ±), reportes.service.ts (251 ±), 9 archivos de domains/rutadoc/, query/reversion.test.ts, lecturas-http.spec.ts, query.spec.ts, backend/package-lock.json, frontend/package-lock.json (950 ±), docs/.../B_CHRISTIAN/INFORME_DIAGNOSTICO_DOCKERIZACION_EJECUCION.md (D — eliminado en el SHA de Geric)

⚠ Alerta: backend/migraciones/02_sigd_auth.sql M en el commit de Geric: comenta el INSERT de semilla de notificacion_casilla. Es una migración histórica 01–07 editada, lo que rompe el checksum del runner y contraviene la regla «01–07 no se editan bajo ninguna tarea»

Commits (left-right): 839b12a solo en B_CHRISTIAN (<); 4e06e51, 9fe7893, b46c270, 0bae92f solo en el SHA de Geric (>). Ramas divergentes por 4/1 commits.

4. Archivos propios vs compartidos (si yo — G6-02 en B_CHRISTIAN — implementara)

Propios/candidatos (nuevos, bajo backend/src/domains/ y backend/tests/): adaptadores en rutadoc/ y tramicore/, pruebas de contrato.

Compartidos que ya difieren del contrato publicado (requieren autorización explícita de Geric para tocar o para aceptar su versión):

backend/src/db/migrate.ts — Geric lo modificó (perfil BASELINE_2026_V1); compartido.
backend/migraciones/02_sigd_auth.sql — violación de contrato en el commit de Geric; también rompe el checksum de sigd_migraciones en bases donde 02 ya se aplicó con los bytes originales.
reportes.service.ts (dominio reportes, no es zona Cari sin autorización).
backend/package-lock.json / frontend/package-lock.json — manifiestos compartidos.
app.ts, routers globales y envoltura JSON: no difieren entre HEAD y 4e06e512 (sin conflicto ahí).
5. Conflictos esperados
02_sigd_auth.sql: si se integra 4e06e512, el checksum del ledger diverge en bases ya instaladas; el runner fallará por discrepancia de SHA-256. Requiere decisión de Geric (revertir la edición y resolver la FK de la semilla de forma aditiva).
migrate.ts / BASELINE_2026_V1: base de un perfil que B_CHRISTIAN no tiene; cualquier adaptador mío debe convivir con ambos mundos o esperar el baseline aprobado.
Cursor v1→v2: Geric cambió el cursor a v2 con UUID y rechaza v1 decimal con 400. B_CHRISTIAN está en v1 BIGINT (rutadoc.cursor.ts:5). Integrar rompe clientes que tengan cursores v1 guardados (incompatibilidad deliberada, documentada en CP-GERIC-007 §17).
reportes.service.ts y lockfiles: zonas ajenas; si implemento, no las toco.
6. Contrato que se conservará (verificado en HEAD actual)
Endpoint	DTO clave	Fuente física	Consumidor
GET /api/v1/tramites/tipos y /tramites/tupa	id, id_tipo_tramite, codigo, denominacion, plazo_dias_habiles, calificacion, base_legal, vigente	sigd_doc.tipo_tramite_tupa (vigente=TRUE)	Catálogo frontend (Ricardo)
POST /tramites/radicacion-virtual	expedienteId, cut, anioFiscal, diferidoPorCorte, cargoDigital…	RadicacionVirtualService	Mesa de partes
POST /tramites/ventanilla-presencial	schema DNI 8 dígitos, areaDestinoId/tipoDocumentalId UUID opcional	VentanillaPresencialService	Ventanilla
GET /tramites/consulta-publica/:cut	por CUT (codigo_expediente), nunca por UUID	sigd_tra	Público
GET /tramites/ventanilla/cargo/:cut	ticket térmico	asiento_registro	Impresión
GET /api/v1/expedientes (+ ?cursor)	id_expediente (UUID string), cut, estado, contadores	sigd_tra.expediente + proyección	Bandeja (Jhasy)
GET /expedientes/:id, /:id/trazabilidad, /:id/foliacion, /:id/sla-status	detalle con solicitanteId, folios, SLA	05/06+baseline	Detalle/SLA
POST /expedientes/:id/revertir-actuacion	reversion + compensación folios	historial	FSM 10 estados

Reglas no negociables verificadas: UUID canónico como string (sin parseInt/Number/cast BIGINT↔UUID; los ::bigint de movimiento/secuencia son legítimos), rutas y envolturas JSON intactas, errores RFC 7807 vía ValidationError/NotFoundError, permisos por actor (actorProvider, 401/403), cursor opaco con huella de filtros, 400/404 diferenciados.

7. Pruebas propuestas (criterios)
Prueba	PASS	FAIL	BLOCKED
Contrato catálogo TUPA (campos, orden, vigentes)	filas y tipos exactos	campo/filtro alterado	sin fuente homologada → PENDING institucional
UUID inválido/ajeno → 400/404 RFC 7807	problema con invalidParams	mensaje o status distinto	—
Cursor v1 rechazado con 400 (decisión Geric)	400 + guía	acepta v1	—
CUT ≠ UUID: consulta por CUT nunca compara con expediente_id	aislamiento	mezcla	—
Permiso por endpoint (sin actor → 401; recurso ajeno → 403)	—	—	BLOCKED: IdentiCore no integrado
Regresión de rutas y envolturas actuales	cliente antiguo intacto	cambio de JSON	—
Suite existente (npx vitest por config Geric)	614 PASS reportados en §17 del CP-007	—	npm ci/typecheck en Windows host falló antes por argon2/módulos ausentes → PENDING de entorno

Limitaciones conocidas, sin maquillaje: 9 pruebas omitidas (outbox/cut: requieren TEST_DATABASE_URL/URL de outbox) — PENDING; 06/07 históricas — FAIL conocidas (no ejecutables; baseline las omite deliberadamente); sigd_demo no certificada — BLOCKED, no se tocó; TUPA institucional sin homologar — PENDING (decisión Geric/institución); servicios externos sin validar — PENDING. Responsable de desbloqueo: Geric (y Pool para entorno/ioredis).

8. Riesgos y bloqueos
Edición de 02_sigd_auth.sql en el commit de Geric: riesgo de checksum/ledger y de contracto “migraciones históricas no se editan”. Elevar a Geric.
Cursor v2: ruptura de clientes con cursores v1 (decisión ya tomada por Geric; documentarla al consumidor Jhasy).
Typecheck/npm ci dependen de entorno (Windows sin toolchain C++ para argon2); usar contenedor Linux desechable.
No hay responsable para reconciliar reportes SQL (vacío señalado en CP-EQUIPO-001 §3).
9. Cambios que requieren autorización de Geric
Aceptar o revertir la edición de backend/migraciones/02_sigd_auth.sql (recomiendo tratarla aparte, aditiva).
Aceptar migrate.ts + baseline (compartido) como precondición de mis adaptadores.
Cualquier edición futura de reportes.service.ts o lockfiles.
10. Confirmación

No hubo merge, rebase, cherry-pick, commit ni push. No se ejecutó ningún comando prohibido. No se abrió .env ni DATABASE_URL. El working tree está exactamente como al inicio (git status --short vacío).

Detengo aquí: solo diagnóstico. Espero autorización específica de Geric antes de implementar o integrar nada.