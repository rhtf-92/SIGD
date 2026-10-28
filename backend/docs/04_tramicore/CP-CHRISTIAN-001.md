# CP-CHRISTIAN-001 — Backend TUPA versionado integrado selectivamente

- **Autor del aporte original:** Christian Jhoel Rodríguez Cari (`B_CHRISTIAN`)
- **Integrador y correcciones de integración:** Geric, en `B_GERIC`
- **Base de integración:** `3b134602ab5de8317b6f620c86feb93e7c64ada7`
- **Punta revisada de Christian:** `89218be8443da33b6ea0e4ff0e268e6e1d1bc351`
- **Fecha de validación:** 2026-10-18
- **Estado:** integrado selectivamente en el working tree; pendiente de revisión y commit

## 1. Alcance real

La integración incorpora el catálogo versionado de
`sigd_doc.tupa_registro_version`, el vínculo
`sigd_doc.expediente_tupa_vinculo` y su uso opcional desde la radicación
virtual y la ventanilla presencial. No se hizo merge ni cherry-pick completo de
`B_CHRISTIAN`.

Se conservaron estos contratos:

- `sigd_tra.expediente.expediente_id` continúa como UUID.
- `registroVersionId` es el identificador canónico del catálogo TUPA.
- `GET /api/v1/tramites/tupa` publica únicamente filas `APROBADO`.
- `GET /api/v1/tramites/tipos` conserva el catálogo legado.
- La radicación puede omitir `registroVersionId`; en ese caso no crea vínculo.
- Expediente, trámite, asiento y vínculo TUPA se escriben en una transacción.
- El detalle del expediente devuelve el contexto vinculado o `tupa: null`.

## 2. Archivos del aporte de Christian

| Archivo | Estado de integración |
|---|---|
| `backend/src/domains/tramicore/tupaVersionado.service.ts` | Integrado con ajuste de alias |
| `backend/src/domains/tramicore/radicacionVirtual.service.ts` | Integrado con corrección del CUT y extensión NodeNext |
| `backend/src/domains/tramicore/ventanillaPresencial.service.ts` | Integrado |
| `backend/src/domains/tramicore/tramites.controller.ts` | Integrado |
| `backend/src/domains/tramicore/tramites.schemas.ts` | Integrado |
| `backend/tests/unit/domains/tramicore/tupaVersionado.spec.ts` | Integrado y ajustado |
| `backend/tests/integration/domains/tramicore/tupa-versionado.test.ts` | Integrado y reforzado |
| `backend/vitest.tupa-christian.config.ts` | Integrado |
| `backend/docs/04_tramicore/CP-CHRISTIAN-001.md` | Actualizado durante la integración |

No se incorporaron los diagnósticos históricos de
`docs/cambios_prototipo/B_CHRISTIAN/`. Tampoco se copió el fixture de
Christian: se generó nuevamente desde el staging canónico local.

## 3. Fixture canónico corregido

Archivo generado:

`backend/tests/fixtures/tupa_staging_real_iestp_suiza_2026.sql`

Fuente única:

`backend/src/tools/tupa/staging/tupa-suiza-2026.staging.json`

El fixture conserva literalmente los 15 campos del staging que existen en
`sigd_doc.tupa_registro_version`: procedencia, página, referencia, revisión,
código externo, denominación, monto, requisitos, referencia normativa, versión,
vigencias, estado y referencia de aprobación. Los valores `null` se insertan
como `NULL`; no se completaron datos faltantes.

### 3.1. Procedencia

- PDF: `TUPA_2026_IESTP_Suiza.pdf`
- SHA-256 del PDF:
  `377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622`
- Referencia interna del prototipo:
  `VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1`
- SHA-256 de la proyección canónica persistible del staging:
  `213bd9c755b936362a7ed3ff473f3069c9aeca0b70c5feef1f7feed2f393bb5a`

La referencia interna documenta una selección académica del equipo; no
representa aprobación institucional del IESTP Suiza.

### 3.2. Resultado confirmado en PostgreSQL 18.6 descartable

| Página | Filas |
|---:|---:|
| 1 | 10 |
| 2 | 10 |
| 3 | 8 |
| 4 | 16 |
| 5 | 21 |
| 6 | 7 |
| **Total** | **72** |

| Estado | Filas |
|---|---:|
| `APROBADO` | 18 |
| `PENDIENTE_VALIDACION` | 54 |

Whitelist `APROBADO` confirmada:

`p1-fila-05`, `p1-fila-06`, `p4-fila-02`, `p4-fila-05`,
`p4-fila-06`, `p4-fila-07`, `p4-fila-10`, `p4-fila-15`,
`p5-fila-06`, `p5-fila-07`, `p5-fila-09`, `p5-fila-10`,
`p5-fila-11`, `p5-fila-18`, `p5-fila-19`, `p5-fila-20`,
`p5-fila-21` y `p6-fila-04`.

No existen las referencias ficticias `p5-fila-22`, `p6-fila-08`,
`p6-fila-09` ni `p6-fila-10`.

## 4. Correcciones realizadas al integrar

### 4.1. CUT único

El aporte generaba un CUT mediante `CutService`, pero insertaba
`codigo_expediente = NULL`. El trigger de la migración 05 generaba entonces
otro CUT. Se corrigió la inserción para persistir el mismo CUT en
`codigo_expediente` y `numero`.

La suite comprueba que el CUT devuelto por HTTP coincide exactamente con ambos
campos persistidos.

### 4.2. Importación NodeNext

El import de tipo desde `tramites.schemas.ts` se corrigió a
`tramites.schemas.js`, coherente con el resto de imports ESM/NodeNext.

### 4.3. Alias legacy

No existe consumidor actual de `id_tipo_tramite` en
`GET /api/v1/tramites/tupa`. El frontend vigente usa
`GET /api/v1/tramites/tipos` para el catálogo legado.

Por ello se eliminó del nuevo DTO:

```text
id_tipo_tramite = registroVersionId
```

El nombre habría confundido la clave del catálogo legado
`sigd_doc.tipo_tramite_tupa.tipo_tramite_id` con la versión TUPA
`sigd_doc.tupa_registro_version.registro_version_id`.

Se conservaron los alias de presentación `id`, `codigo` y `estado`; la
clave contractual del flujo nuevo sigue siendo `registroVersionId`.

## 5. Endpoints verificados

| Endpoint | Comportamiento validado |
|---|---|
| `GET /api/v1/tramites/tupa` | Devuelve exactamente 18 aprobados |
| `GET /api/v1/tramites/tipos` | Catálogo legado sigue disponible |
| `POST /api/v1/tramites/radicacion-virtual` | Acepta TUPA aprobado o flujo libre |
| `POST /api/v1/tramites/ventanilla-presencial` | Funciona con y sin TUPA |
| `GET /api/v1/tramites/expedientes/:expedienteId` | Devuelve detalle y contexto TUPA |
| `GET /api/v1/tramites/expedientes/:expedienteId/tupa` | Devuelve el vínculo o `tupa: null` |

También se conservan los aliases singulares de detalle y el alias existente de
radicación `POST /api/v1/tramite/radicacion`.

## 6. Validaciones y atomicidad

Las pruebas confirmaron:

- UUID inválido: HTTP 400.
- UUID inexistente: HTTP 404 RFC 7807 y sin expediente parcial.
- Versión `PENDIENTE_VALIDACION`: HTTP 409.
- Versión aprobada: expediente UUID, CUT y vínculo persistido.
- Flujo libre: expediente sin vínculo y detalle con `tupa: null`.
- Detalle TUPA: devuelve la misma `registroVersionId` radicada.
- Ventanilla TUPA: crea el vínculo físico esperado.
- Ventanilla libre: no crea vínculo.
- No hay conversión de UUID a número.

La base también revalida el estado aprobado mediante el trigger definido en la
migración 08.

## 7. Evidencia ejecutada durante esta integración

Entorno: contenedor backend existente y PostgreSQL
`18.6 on x86_64-pc-linux-musl`. La suite TUPA crea una base temporal distinta
de `sigd_prueba` y la elimina al finalizar.

| Validación | Resultado |
|---|---|
| Suite TUPA | **19/19 PASS** |
| Prueba unitaria `TupaVersionadoService` | **8/8 PASS** |
| Suite unitaria completa | **33 archivos PASS; 563 PASS; 2 SKIP; 0 FAIL** |
| `npm run typecheck` | **PASS**, exit code 0 |
| `npm run build` | **PASS**, exit code 0 |
| `git diff --check` | **PASS**, exit code 0 |

Los 19 casos TUPA incluyen seis controles del staging y trece controles
funcionales. El hash de proyección comprueba los 15 campos persistibles de las
72 filas, no solamente sus cantidades.

## 8. Límites no certificados

- El endpoint de radicación recibe metadatos de adjuntos, pero este cambio no
  certifica carga binaria ni persistencia S3.
- El cargo digital de radicación se genera en memoria; esta suite no certifica
  almacenamiento documental.
- El endpoint preexistente `GET /tramites/ventanilla/cargo/:cut` no forma parte
  de los 19 casos de esta integración.
- No se ejecutó una suite de carga ni una prueba E2E con frontend.
- No se modificaron migraciones, baseline, `migrate.ts`, RutaDoc, Auth,
  reportes, frontend, Docker ni lockfiles.
