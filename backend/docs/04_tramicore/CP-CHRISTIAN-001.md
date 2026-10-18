# CP-CHRISTIAN-001 · Implementación Backend TUPA Versionado
## B_CHRISTIAN — Aporte de integración TramiCore ↔ Catálogo TUPA 2026

**Proyecto:** SIGD — Grupo 2 "TramiCore"
**Autor:** Christian (B_CHRISTIAN)
**Revisado contra:** B_GERIC (rama de integración)
**Fecha de corrección:** 2026-10-18
**Estado:** LISTO PARA REVISIÓN DE GERIC

---

## 1. Resumen del Aporte

B_CHRISTIAN integra el catálogo TUPA versionado de Geric al flujo de radicación
de TramiCore. La implementación cubre:

- Publicación de catálogo filtrado: solo `APROBADO`, nunca `PENDIENTE_VALIDACION` ni `RECHAZADO`.
- Radicación con vínculo TUPA atómico (`sigd_doc.expediente_tupa_vinculo`).
- Flujo libre preservado: `registroVersionId` ausente o `null` omite el vínculo.
- Validación de vigencia en el momento de la radicación.
- Detalle de expediente con `tupa: null` cuando no hay vínculo.
- Errores RFC 7807 (`application/problem+json`) para todos los rechazos.
- UUID string canónico en todo el contrato HTTP (sin conversión a entero).

---

## 2. Arquitectura — Lo que NO se tocó

| Elemento | Estado |
|----------|--------|
| `sigd_doc.tupa_registro_version` | Sin cambios — tabla de Geric |
| `sigd_doc.expediente_tupa_vinculo` | Sin cambios — tabla de Geric |
| Migraciones (`01_sigd_audit` … `08_sigd_tupa_acoplamiento`) | Sin cambios |
| Baseline (`baselines/`) | Sin cambios |
| `migrate.ts` / `migrate-cli.ts` | Sin cambios |
| RutaDoc | Sin cambios |
| Frontend | Sin cambios |
| Infraestructura (Docker, CI) | Sin cambios |

---

## 3. Datos del Staging Real (Geric)

> [!IMPORTANT]
> Los datos siguientes son del **staging REAL preparado por Geric**, no ejemplos inventados.

| Campo | Valor |
|-------|-------|
| Archivo PDF fuente | `TUPA-IESTP-SUIZA-2026.pdf` |
| SHA-256 del PDF | `377DD8E14B8806F2030B5374120AB9B4FE17640BB98086E10C1A9A4431A33622` |
| `referencia_aprobacion` | `VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1` |
| Total de entradas en staging | 72 |
| Estado APROBADO | 18 |
| Estado PENDIENTE_VALIDACION | 54 |

### 3.1. Whitelist exacta APROBADO (18 entradas)

Las siguientes `referencia_fila` fueron validadas y aprobadas por Geric:

| Página | Fila aprobada |
|--------|--------------|
| 1 | `p1-fila-05` |
| 1 | `p1-fila-06` |
| 4 | `p4-fila-02` |
| 4 | `p4-fila-05` |
| 4 | `p4-fila-06` |
| 4 | `p4-fila-07` |
| 4 | `p4-fila-10` |
| 4 | `p4-fila-15` |
| 5 | `p5-fila-06` |
| 5 | `p5-fila-07` |
| 5 | `p5-fila-09` |
| 5 | `p5-fila-10` |
| 5 | `p5-fila-11` |
| 5 | `p5-fila-18` |
| 5 | `p5-fila-19` |
| 5 | `p5-fila-20` |
| 5 | `p5-fila-21` |
| 6 | `p6-fila-04` |

---

## 4. Archivos Modificados / Creados por B_CHRISTIAN

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `backend/src/domains/tramicore/tupaVersionado.service.ts` | Creado | Servicio de catálogo y vínculo TUPA |
| `backend/src/domains/tramicore/tramites.controller.ts` | Modificado | Endpoints TUPA (`GET /tupa`, detalle, contexto) |
| `backend/src/domains/tramicore/tramites.schemas.ts` | Modificado | Esquema Zod con `registroVersionId` |
| `backend/src/domains/tramicore/radicacionVirtual.service.ts` | Modificado | Inserción atómica de `expediente_tupa_vinculo` |
| `backend/tests/integration/domains/tramicore/tupa-versionado.test.ts` | **Corregido** | Reemplazado: usa fixture real de Geric (72 entradas) |
| `backend/tests/fixtures/tupa_staging_real_iestp_suiza_2026.sql` | **Nuevo** | Fixture SQL derivado del staging real de Geric |
| `backend/tests/unit/domains/tramicore/tupaVersionado.spec.ts` | Creado | Pruebas unitarias aisladas (mock) |
| `backend/vitest.tupa-christian.config.ts` | Creado | Config vitest para suite de integración |
| `backend/docs/04_tramicore/CP-CHRISTIAN-001.md` | **Nuevo** | Este documento |

---

## 5. Decisión sobre Aliases Legacy (`id`, `id_tipo_tramite`, `codigo`, `estado`)

### 5.1. Aliases presentes en el DTO de catálogo

El `DtoRegistroTupaVersionado` expone:

```typescript
id: string;              // = registroVersionId
id_tipo_tramite: string; // = registroVersionId
codigo: string | null;   // = codigoExterno
estado: 'APROBADO';      // = estadoValidacion
```

### 5.2. Análisis de necesidad

| Alias | Valor | Justificación de mantener | Riesgo semántico |
|-------|-------|--------------------------|-----------------|
| `id` | = `registroVersionId` | Frontend legacy puede usar `item.id` como clave de selección UI | Bajo — `id` es convención amplia |
| `id_tipo_tramite` | = `registroVersionId` | **ALTO RIESGO**: nombre sugiere `sigd_doc.tipo_tramite_tupa.tipo_tramite_id` (BIGINT del catálogo legacy), pero el valor es un UUID de `tupa_registro_version`. Confunde el identificador de versión con el del catálogo legacy. | Alto — semánticamente engañoso |
| `codigo` | = `codigoExterno` | Campo de conveniencia; `codigoExterno` ya está expuesto | Bajo |
| `estado` | = `estadoValidacion` | Duplicado de `estadoValidacion`; ambos siempre `'APROBADO'` en el catálogo | Bajo |

### 5.3. Decisión

> [!IMPORTANT]
> **`id_tipo_tramite` NO debería exponerse** a menos que exista un consumidor real documentado que dependa de ese campo.

El alias `id_tipo_tramite = registroVersionId` es semánticamente engañoso porque:
- `tipo_tramite` hace referencia al catálogo legado `sigd_doc.tipo_tramite_tupa`
- Su clave primaria es `tipo_tramite_id` (BIGINT generado)
- El valor que se expone aquí es un UUID de `tupa_registro_version`, una entidad diferente

**Recomendación para Geric:** si ningún cliente activo del catálogo TUPA consume `id_tipo_tramite`, eliminarlo del DTO para evitar confusión. Si existe un frontend que lo usa como selector, documentar el consumidor y mantenerlo con advertencia.

**Decisión conservadora aplicada en B_CHRISTIAN:** se mantiene `id_tipo_tramite` en el DTO hasta que Geric confirme si hay consumidor real, pero se documenta el riesgo aquí para que la revisión lo evalúe.

---

## 6. Corrección de Fixtures Sintéticos

### 6.1. ¿Qué había antes?

La versión anterior de la prueba creaba 18 filas inventadas en el `beforeAll`:

```typescript
// EJEMPLO SINTÉTICO — NO CORRESPONDE AL CATÁLOGO REAL DEL IESTP SUIZA
// Este código FUE ELIMINADO y reemplazado por el fixture real de Geric.
for (let i = 1; i <= 18; i++) {
  await testPool.query(`INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, ...
    codigo_externo, denominacion_original, ...
    estado_validacion, referencia_aprobacion
  ) VALUES (
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', -- INVENTADO
    'TUPA-IESTP-SUIZA-2026.pdf',
    $2, $3,
    'TUPA-2026-001',        -- CÓDIGO INVENTADO
    'Procedimiento N° 1...',-- DENOMINACIÓN INVENTADA
    ...
    'APROBADO', 'RD N° 045-2026-GR-UCAYALI-DRE' -- RESOLUCIÓN INVENTADA
  )`);
}
```

> [!WARNING]
> Los valores `TUPA-2026-001`, `RD N° 045-2026-GR-UCAYALI-DRE`, el hash `e3b0c442...`,
> y los montos calculados (`i * 12.5`) son **COMPLETAMENTE SINTÉTICOS** y **no corresponden**
> al catálogo real del IESTP "Suiza".

### 6.2. ¿Qué hay ahora?

El `beforeAll` ahora:
1. Aplica el esquema canónico (6 migraciones)
2. Carga `tests/fixtures/tupa_staging_real_iestp_suiza_2026.sql` (72 filas reales de Geric)
3. **Verifica en BD** que haya exactamente 18 APROBADO + 54 PENDIENTE_VALIDACION
4. Obtiene los UUIDs reales de las 18 versiones APROBADAS desde la BD

No se inventan códigos, montos, resoluciones ni páginas.

---

## 7. Endpoints Expuestos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/tramites/tupa` | Catálogo versionado — solo APROBADO |
| `GET` | `/api/v1/tramites/tipos` | Catálogo legado (`tipo_tramite_tupa`) — compatibilidad |
| `POST` | `/api/v1/tramites/radicacion-virtual` | Radicación con/sin TUPA |
| `POST` | `/api/v1/tramites/ventanilla-presencial` | Radicación física con/sin TUPA |
| `GET` | `/api/v1/tramites/expedientes/:id` | Detalle + contexto TUPA |
| `GET` | `/api/v1/tramites/expedientes/:id/tupa` | Contexto TUPA del expediente |

---

## 8. Invariantes Preservados

| Invariante | Mecanismo |
|------------|-----------|
| Solo `APROBADO` en catálogo | `WHERE estado_validacion = 'APROBADO'` en `listarAprobados()` |
| Atomicidad del vínculo | `BEGIN … COMMIT / ROLLBACK` en `RadicacionVirtualService.radicar()` |
| Flujo libre intacto | `registroVersionId` ausente/null omite `insertarVinculoTupa()` |
| `tupa: null` en detalle sin vínculo | `obtenerContextoExpediente()` retorna `{ tupa: null }` |
| UUID string (no número) | Zod `.uuid()` + regex en servicio + `::text` en queries |
| RFC 7807 en errores | `NotFoundError`, `ConflictError`, `ValidationError` |
| Trigger TUPA inmutable | Trigger `tr_tupa_registro_inmutable` en la BD (DDL de Geric) |
| Trigger vínculo validador | Trigger `tr_tupa_vinculo_validar` — revalida APROBADO en BD |

---

## 9. Ejemplo de DTO (Distinguido de Datos Reales)

> [!NOTE]
> Los valores de ejemplo a continuación son **EJEMPLOS DE DTO** para ilustrar la estructura
> del contrato HTTP. **NO SON DATOS REALES** del IESTP Suiza ni del staging de Geric.

```json
// EJEMPLO DE DTO — NO ES DATO REAL DEL IESTP SUIZA
{
  "registroVersionId": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
  "codigoExterno": null,
  "codigo": null,
  "denominacion": "Procedimiento administrativo - Página N, fila N",
  "monto": null,
  "requisitos": null,
  "fuente": {
    "nombre": "TUPA-IESTP-SUIZA-2026.pdf",
    "documentoSha256": "377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622",
    "pagina": 4,
    "referenciaFila": "p4-fila-02"
  },
  "pagina": 4,
  "revision": 1,
  "vigencia": { "desde": "2026-01-01", "hasta": "2026-12-31" },
  "vigenciaDesde": "2026-01-01",
  "vigenciaHasta": "2026-12-31",
  "version": {
    "etiqueta": "VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1",
    "revision": 1,
    "vigenciaDesde": "2026-01-01",
    "vigenciaHasta": "2026-12-31"
  },
  "estadoValidacion": "APROBADO",
  "estado": "APROBADO",
  "referenciaAprobacion": "VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1",
  "id": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
  "id_tipo_tramite": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
}
```

Los siguientes valores aparecen en documentación anterior y son **EJEMPLOS SINTÉTICOS NO REALES**:

| Valor sintético anterior | Por qué es incorrecto |
|--------------------------|----------------------|
| `TUPA-2026-001` | Código inventado — no existe en el catálogo real |
| `RD N° 045-2026-GR-UCAYALI-DRE` | Resolución inventada — no corresponde al IESTP Suiza |
| `página 14` | Página inventada |
| `e3b0c44298fc1c...` | Hash SHA-256 del string vacío — no corresponde al PDF real |
| `(i * 12.5).toFixed(2)` | Montos calculados matemáticamente — no son tarifas reales |

---

## 10. Conclusión

> **APORTE B_CHRISTIAN VALIDADO CON CATÁLOGO TUPA REAL — LISTO PARA REVISIÓN DE GERIC**

La prueba de integración ahora:
- Carga las **72 entradas reales** del staging de Geric (no fixtures sintéticos)
- Verifica en BD el conteo exacto **18 APROBADO + 54 PENDIENTE_VALIDACION**
- Confirma que los UUIDs retornados por `GET /api/v1/tramites/tupa` pertenecen a la **whitelist real**
- Radica usando una **versión real APROBADA** y verifica el vínculo en `expediente_tupa_vinculo`
- Consulta el detalle y confirma que devuelve la **misma versión real** radicada

La implementación no modifica migraciones, baseline, migrate.ts, RutaDoc ni frontend.
