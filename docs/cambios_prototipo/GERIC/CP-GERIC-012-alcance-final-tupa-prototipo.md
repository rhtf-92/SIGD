# CP-GERIC-012 — Alcance final TUPA para prototipo académico

**Estado:** ALCANCE TUPA DEL PROTOTIPO CERRADO — LISTO PARA IMPLEMENTACIÓN CONTROLADA

**Referencia:** `B_GERIC` en `4e06e512fe08d01712bc0b6feb33e95ca28c1b10`

**Decisión vigente:** VALIDACIÓN TÉCNICA Y FUNCIONAL DEL EQUIPO PARA PROTOTIPO ACADÉMICO.

Esta decisión no constituye aprobación institucional del IESTP Suiza. Define únicamente qué entradas utilizará la demostración académica y cómo deben acoplarse a la arquitectura existente.

## 1. Restricciones de arquitectura

La integración debe ser compatible, aditiva y trazable. No autoriza:

- eliminar archivos provenientes de `main`;
- renombrar dominios o rutas existentes;
- reemplazar módulos por una arquitectura paralela;
- modificar las migraciones históricas 01–08;
- modificar `BASELINE_2026_V1.sql`;
- modificar `backend/src/db/migrate.ts`;
- rehacer Auth, TramiCore, RutaDoc o reportes;
- cambiar la estructura general del frontend;
- sustituir contratos vigentes por nombres o tipos nuevos;
- introducir catálogos Pasco/mock, UUID fijos o selección por índice en el flujo productivo.

El punto de acoplamiento físico ya existe en `08_sigd_tupa_acoplamiento.sql`: `sigd_doc.tupa_registro_version` conserva la procedencia y `sigd_doc.expediente_tupa_vinculo` enlaza una versión aprobada con `sigd_tra.expediente.expediente_id UUID`.

## 2. Verificación del catálogo final

Las 18 referencias siguientes existen una sola vez en el staging, conservan su denominación literal y permanecen en `PENDIENTE_VALIDACION` con `referenciaAprobacion: null`.

| Referencia | Pág. | Denominación literal | Monto literal |
|---|---:|---|---|
| p1-fila-05 | 1 | Certificado Modular (I, II, III y IV) Por cada Módulo | S/ 100.00 |
| p1-fila-06 | 1 | Certificado de Inglés | S/ 100.00 |
| p4-fila-02 | 4 | Constancia de No Adeudar (Para fines de Titulación) | S/ 16.50 |
| p4-fila-05 | 4 | Expedición de Título | S/ 105.00 |
| p4-fila-06 | 4 | Certificado de Estudios Superiores (6 Semestres) | S/ 124.00 |
| p4-fila-07 | 4 | Visación de Certificado de Estudios Superiores | S/ 16.00 |
| p4-fila-10 | 4 | Inscripción de Título | S/ 120.00 |
| p4-fila-15 | 4 | Modificación de Datos del Título | S/ 269.00 |
| p5-fila-06 | 5 | Constancia de Egresado | S/ 31.00 |
| p5-fila-07 | 5 | Certificado de Bachillerato | S/ 42.00 |
| p5-fila-09 | 5 | Convalidación entre Planes de Estudios | S/ 46.50 |
| p5-fila-10 | 5 | Convalidación por Unidades de Competencia | S/ 46.50 |
| p5-fila-11 | 5 | Devolución de Expediente | S/ 21.00 |
| p5-fila-18 | 5 | Reserva de Matrícula - Ingresantes | S/ 66.00 |
| p5-fila-19 | 5 | Licencia de Estudios - Estudiantes Antiguos | S/ 66.00 |
| p5-fila-20 | 5 | Traslado Interno | S/ 309.00 |
| p5-fila-21 | 5 | Traslado Externo | S/ 412.00 |
| p6-fila-04 | 6 | Titulación de Otros Institutos Tecnológicos | S/ 515.00 |

No se generan códigos, UUID, requisitos, autoridades, plazos ni equivalencias adicionales.

## 3. Exclusiones

### 3.1 Seis entradas del universo evaluado

| Referencia | Denominación literal | Causa exacta de exclusión |
|---|---|---|
| p4-fila-16 | Derecho de duplicado de Título. | Puede representar el componente económico y no un procedimiento autónomo. |
| p5-fila-05 | Derecho de Reincorporación (Reingreso) | Puede representar el componente económico y no el procedimiento canónico. |
| p5-fila-08 | Constancias (Otros: de Título, estudios, de Matrícula) | Agrupa variantes sin definición segura de separación. |
| p6-fila-02 | Acceso a la Información Pública. S/. 10.00 por C/Hoja | Contradicción entre S/10 por hoja y monto S/10.50. |
| p6-fila-03 | Búsqueda y Duplicados de Boletas (C/U) Síllabus (C/U) Otros Trámites | Agrupa productos distintos y un concepto abierto; no se separa manualmente. |
| p6-fila-05 | Examen de Subsanación con Jurado | No está confirmado que la Resolución Directoral sea el resultado del procedimiento. |

### 3.2 Otras 48 entradas

Las 48 filas homologadas como `NO_RADICABLE_SIGD` permanecen fuera del catálogo porque corresponden a pagos aislados, evaluaciones sin resultado documental demostrado, matrícula/admisión, alquileres, ventas, bienes o servicios. No se eliminan del staging: conservan la trazabilidad de la fuente.

Comprobación total: **18 incluidas + 6 excluidas + 48 no radicables = 72**.

## 4. Referencia interna de validación

Referencia propuesta para una fase posterior:

`VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1`

Significado exclusivo:

> Selección técnica y funcional del equipo para fines del prototipo académico.

No fue emitida por el IESTP Suiza, no equivale a resolución o acto institucional y no debe presentarse como homologación oficial.

## 5. Cambio controlado futuro del staging

Esta fase no ejecuta cambios. La modificación futura propuesta afecta solo las 18 referencias de la sección 2:

```json
{
  "estadoValidacion": "APROBADO",
  "referenciaAprobacion": "VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1"
}
```

Las otras 54 filas deben conservar:

```json
{
  "estadoValidacion": "PENDIENTE_VALIDACION",
  "referenciaAprobacion": null
}
```

### Compatibilidad técnica de la referencia

El esquema vigente permite técnicamente la referencia propuesta porque:

- `referencia_aprobacion` es `TEXT NULL`, sin límite de longitud adicional;
- `estado_validacion` admite `PENDIENTE_VALIDACION`, `APROBADO` y `RECHAZADO`;
- `chk_tupa_aprobacion` exige una referencia no nula y no vacía cuando el estado sea `APROBADO`;
- la referencia propuesta es no vacía y no contradice esa restricción.

La tabla es WORM: los triggers impiden `UPDATE` y `DELETE`. Por ello, el cambio futuro debe realizarse en el staging **antes de la primera importación**. Si alguna entrada pendiente ya estuviera insertada en una base, no debe actualizarse: correspondería crear una nueva revisión mediante inserción, preservando el registro anterior.

## 6. Estado real de los puntos de extensión

| Punto | Archivo existente | Estado actual comprobado | Cambio aditivo posterior | Responsable |
|---|---|---|---|---|
| Registro versionado | `backend/migraciones/08_sigd_tupa_acoplamiento.sql` | Crea `tupa_registro_version`, vínculo, FK, índices y reglas WORM. | Ninguno en la migración; cargar mediante herramienta explícita después de ajustar el staging. | Geric |
| Preparación/importación | `backend/src/tools/tupa/staging/tupa-suiza-2026.staging.json`, `import-staging*.mjs` | Staging de 72 filas e importador manual con dry-run. | Cambiar solo 18 estados/referencias, validar y ejecutar únicamente con autorización posterior. | Geric |
| API de catálogo | `backend/src/domains/tramicore/tramites.controller.ts` | `GET /api/v1/tramites/tipos` y `/tramites/tupa` consultan el catálogo legado `tipo_tramite_tupa`. | Agregar lectura de versiones aprobadas sin eliminar rutas ni cambiar la respuesta legado; preferir ruta o versión aditiva acordada. | Christian |
| Contrato de radicación | `backend/src/domains/tramicore/tramites.schemas.ts` | El contrato actual recibe `idTipoTramiteTupa` legado. | Admitir opcionalmente `registroVersionId` UUID sin romper solicitudes existentes. | Christian |
| Radicación virtual | `backend/src/domains/tramicore/radicacionVirtual.service.ts` | Usa transacción y crea `expediente_id` UUID; valida el catálogo legado. | Validar versión aprobada e insertar `expediente_tupa_vinculo` dentro de la misma transacción cuando se reciba `registroVersionId`. | Christian |
| Ventanilla presencial | `backend/src/domains/tramicore/ventanillaPresencial.service.ts` | Crea expediente UUID dentro de transacción. | Insertar vínculo opcional en esa misma transacción, preservando el flujo sin TUPA. | Christian |
| Selector virtual | `frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx` | Mantiene un catálogo TUPA local. | Consumir la API aprobada mediante servicio/hook aditivo y usar `registroVersionId`, sin selección por índice. | Ricardo |
| Selector presencial | `frontend/src/pages/tramite/VentanillaPresencialPage.tsx` | Importa `tupaPasco2026.ts`. | Sustituir la dependencia activa por API; conservar archivos existentes como legado/test si `main` los contiene. | Ricardo |
| Detalle backend | `backend/src/domains/rutadoc/rutadoc.repository.ts`, `rutadoc.types.ts` | Obtiene expediente UUID y estado RutaDoc, sin contexto TUPA. | Añadir lectura opcional del vínculo y versión, sin alterar FSM, movimientos o SLA. | Jhasy |
| Detalle frontend | `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx` | Presenta detalle y trazabilidad sin contexto TUPA. | Mostrar bloque de solo lectura cuando el backend entregue vínculo; no duplicar selector. | Jhasy |
| RutaDoc | `backend/src/domains/rutadoc/rutadoc.router.ts` y servicios existentes | Gestiona expediente, trazabilidad, foliación y SLA por UUID. | Ningún reemplazo; solo consume el mismo expediente vinculado. | Jhasy / Geric |
| QA | `backend/tests/`, pruebas frontend/E2E existentes | No existe todavía certificación integral de este flujo. | Cubrir catálogo, radicación, vínculo, detalle, aislamiento entre expedientes y regresión sin TUPA. | Valentin |

## 7. Flujo de integración

```text
sigd_doc.tupa_registro_version
  → API TUPA existente/adaptada de forma aditiva
  → selector frontend por registroVersionId UUID
  → radicación virtual o presencial existente
  → sigd_tra.expediente.expediente_id UUID
  → sigd_doc.expediente_tupa_vinculo
  → detalle de expediente con contexto TUPA de solo lectura
  → RutaDoc existente sobre el mismo expediente UUID
```

### Regla transaccional

Cuando se use TUPA, la creación del expediente y la inserción del vínculo deben compartir la transacción ya existente. Un fallo del vínculo debe revertir la radicación; no se insertarán vínculos manualmente para “reparar” una demo.

### Flujo sin TUPA

`registroVersionId` será opcional para preservar los flujos previos. Si no se proporciona, la radicación debe comportarse exactamente como antes y no crear vínculo TUPA.

## 8. Responsabilidades

| Responsable | Alcance |
|---|---|
| Christian | API de catálogo aprobado, contrato opcional, radicación transaccional y vínculo. |
| Ricardo | Selector/formulario que consuma API real sin Pasco/mock ni UUID fijo. |
| Jhasy | Lectura opcional del contexto TUPA en detalle y trazabilidad, sin alterar RutaDoc. |
| Geric | Datos, versión, referencia interna, importación controlada e integración final. |
| Valentin | QA E2E del flujo completo y de las reglas de no regresión. |

## 9. Reglas de no regresión

1. El flujo sin TUPA sigue funcionando.
2. TUPA no reemplaza `sigd_tra.expediente`.
3. TUPA no reemplaza RutaDoc ni escribe una FSM paralela.
4. No se crea otro módulo o esquema para duplicar la migración 08.
5. El vínculo se registra únicamente mediante `expediente_tupa_vinculo`.
6. `expediente_id` continúa siendo UUID canónico y opaco.
7. No existen fallback UUID, UUID fijos ni selección por posición de arreglo.
8. Ninguna ruta productiva usa el catálogo Pasco/mock.
9. Solo se exponen versiones con estado permitido para la demo y referencia interna trazable.
10. Dos expedientes distintos conservan vínculos independientes y no mezclan contexto TUPA.
11. El detalle TUPA es de solo lectura; los cambios se versionan, no se actualizan por sobrescritura.
12. Ningún requisito, plazo, autoridad, código o monto se infiere fuera de la fuente y decisión documentada.

## 10. Archivos previstos para una fase posterior

### Datos e importación

- `backend/src/tools/tupa/staging/tupa-suiza-2026.staging.json` — cambiar exactamente 18 estados y referencias.
- Herramientas existentes `validate-staging.mjs` e `import-staging*.mjs` — solo modificar si una prueba demuestra una necesidad; preferentemente reutilizarlas sin cambios.

### Backend de Christian

- `backend/src/domains/tramicore/tramites.controller.ts`.
- `backend/src/domains/tramicore/tramites.schemas.ts`.
- `backend/src/domains/tramicore/radicacionVirtual.service.ts`.
- `backend/src/domains/tramicore/ventanillaPresencial.service.ts`.
- Pruebas unitarias/integración correspondientes.

### Frontend de Ricardo

- `frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx`.
- `frontend/src/pages/tramite/VentanillaPresencialPage.tsx`.
- Servicio/hook/tipos TUPA aditivos si no existe un equivalente reutilizable.
- Pruebas del selector y payload UUID.

### Lectura de Jhasy

- `backend/src/domains/rutadoc/rutadoc.repository.ts` y `rutadoc.types.ts`, únicamente para contexto opcional de lectura.
- `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx` o componente hijo aditivo.
- Pruebas de detalle e independencia entre expedientes.

## 11. Archivos y áreas que no deben modificarse

- `backend/migraciones/01_*` a `08_*`.
- `backend/baselines/BASELINE_2026_V1.sql`.
- `backend/src/db/migrate.ts`.
- dominios y contratos de Auth ajenos al acoplamiento.
- `backend/src/domains/rutadoc/rutadoc.fsm.ts`.
- `backend/src/domains/rutadoc/rutadoc.service.ts`.
- `backend/src/domains/rutadoc/rutadoc.lock.ts`.
- DDL, triggers y contratos actuales de RutaDoc.
- servicios y consultas de reportes.
- estructura de rutas/layouts del frontend.
- archivos provenientes de `main` mediante eliminación o reemplazo total.

Las extensiones de lectura de detalle deben ser opcionales y no alterar reglas de dominio RutaDoc.

## 12. Criterios mínimos de la implementación controlada

La futura certificación debe demostrar:

1. API devuelve exactamente las 18 versiones autorizadas para prototipo.
2. Selector conserva UUID de `registroVersionId`, no índice ni código inventado.
3. Radicación crea expediente UUID y vínculo en una sola transacción.
4. Un procedimiento inexistente o pendiente es rechazado mediante RFC 7807.
5. Fallo del vínculo revierte la radicación completa.
6. Detalle devuelve el mismo contexto TUPA seleccionado.
7. Dos expedientes con procedimientos distintos no mezclan datos.
8. Flujo sin TUPA continúa funcionando.
9. Rutas protegidas conservan 401/403.
10. No se modifica migración, baseline, RutaDoc, reportes ni arquitectura general.

## 13. Estado al cerrar esta fase

- Staging sin cambios: 72 `PENDIENTE_VALIDACION`, 0 `APROBADO` y 72 referencias nulas.
- Base de datos no consultada ni modificada.
- No se ejecutó importador ni `--apply`.
- No se modificaron archivos funcionales de Christian, Ricardo o Jhasy.
- No se realizó commit ni push.
