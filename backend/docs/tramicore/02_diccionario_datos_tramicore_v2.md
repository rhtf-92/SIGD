# 02 · Diccionario de datos v2.0 — TramiCore (CUT, Acumulación y Foliado Digital)

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Grupo:** Grupo 2 – "TramiCore"
**Autor:** Elmer Ramírez (B_RAMIREZ)
**Versión:** 2.0
**Fecha:** 30 de agosto de 2026

---

## 1. Entidad: tramite

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_tramite | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno | CONFIRMADO |
| codigo_tramite | VARCHAR(30) | | Sí | NULL | Código visible de trámite (formato institucional PENDIENTE, sin UNIQUE) | PENDIENTE |
| asunto | VARCHAR(500) | | No | — | Descripción del trámite | CONFIRMADO |
| estado | VARCHAR(30) | | No | 'REGISTRADO' | Estado del trámite (CHECK) | CONFIRMADO |
| fk_remitente | BIGINT | FK | No | — | Usuario registrado (Grupo 4) o solicitante externo identificado sin cuenta | CONFIRMADO |
| fk_destinatario | BIGINT | FK | Sí | NULL | Usuario/área destino (Grupo 3) | PENDIENTE |
| creado_en | TIMESTAMPTZ | | No | NOW() | Marca de tiempo | CONFIRMADO |
| actualizado_en | TIMESTAMPTZ | | Sí | NULL | Marca de tiempo | CONFIRMADO |

**Estados posibles:** `REGISTRADO`, `EN_TRAMITE`, `OBSERVADO`, `CERRADO`, `ANULADO`, `REABIERTO` `[CONFIRMADO]`

**Cambio v2:** `fk_tramite` en expediente ya NO es UNIQUE, permitiendo 1:N `[CONFIRMADO]`

---

## 2. Entidad: expediente

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_expediente | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno (tipo de clave PENDIENTE de contrato con RutaDoc, ver DEC-UUID) | PENDIENTE |
| codigo_expediente | VARCHAR(20) | UQ | No | — | CUT visible formato EXP-YYYY-XXXXXX | CONFIRMADO |
| fk_tramite | BIGINT | FK | No | — | Trámite asociado (1..N:1 sin UNIQUE) | CONFIRMADO |
| estado_expediente | VARCHAR(20) | | No | 'ACTIVO' | Estado: ACTIVO/ACUMULADO/ANULADO (PROPUESTO, taxonomía oficial PENDIENTE) | PROPUESTO |
| creado_en | TIMESTAMPTZ | | No | NOW() | Fecha de creación | CONFIRMADO |

**Cambio v2:** `fk_tramite` pierde restricción UNIQUE → un trámite puede generar múltiples expedientes `[CONFIRMADO]`

---

## 3. Entidad: expediente_acumulacion

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_acumulacion | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno | CONFIRMADO |
| id_expediente_principal | BIGINT | FK | No | — | Expediente principal (Art. 160 LPAG) | CONFIRMADO |
| id_expediente_accesorio | BIGINT | FK | No | — | Expediente accesorio a fusionar | CONFIRMADO |
| fecha_acumulacion | TIMESTAMPTZ | | No | NOW() | Fecha de la fusión jurídica | CONFIRMADO |
| acto_resolutivo | TEXT | | No | — | Justificación del acto resolutivo | CONFIRMADO |
| estado_acumulacion | VARCHAR(20) | | No | 'ACUMULADO' | `ACUMULADO` / `DESACUMULADO` | CONFIRMADO |
| fecha_desacumulacion | TIMESTAMPTZ | | Sí | NULL | Fecha de desacumulación | PROPUESTO |
| acto_resolutivo_desacumulacion | TEXT | | Sí | NULL | Justificación de desacumulación | PROPUESTO |
| creado_en | TIMESTAMPTZ | | No | NOW() | Marca de creación | CONFIRMADO |

**Restricciones:**
- Clave primaria: `id_acumulacion` (BIGINT IDENTITY)
- Dos FK independientes: `id_expediente_principal` y `id_expediente_accesorio` → `expediente(id_expediente)`
- Índice único parcial: `uq_acumulacion_vigente` solo para acumulaciones vigentes `[CONFIRMADO]`
- **CHECK:** `id_expediente_principal <> id_expediente_accesorio` `[CONFIRMADO]`

---

## 4. Entidad: expediente_documento_folio

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_folio | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno | CONFIRMADO |
| id_expediente | BIGINT | FK | No | — | Expediente al que pertenece | CONFIRMADO |
| id_documento | BIGINT | FK | No | — | Documento dentro del expediente (Grupo 5) | PENDIENTE |
| folio_inicio | INT | | No | — | Primer folio asignado al documento | CONFIRMADO |
| folio_fin | INT | | No | — | Último folio asignado al documento | CONFIRMADO |
| total_folios | INT | | No | — | Calculado: `folio_fin - folio_inicio + 1` | CONFIRMADO |
| creado_en | TIMESTAMPTZ | | No | NOW() | Marca de asignación | CONFIRMADO |

**Restricciones:**
- `CHECK (folio_fin >= folio_inicio)` `[CONFIRMADO]`
- `CHECK (total_folios = folio_fin - folio_inicio + 1)` `[CONFIRMADO]`
- Prohibición de solapamientos de folios entre documentos `[CONFIRMADO]`
- Prohibición de vacíos en la foliatura `[CONFIRMADO]`

---

## 5. Entidad: secuencia_anual_cut

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_secuencia | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno | CONFIRMADO |
| anio_fiscal | INT | UQ | No | — | Año fiscal (ej. 2026) | CONFIRMADO |
| secuencia | BIGINT | | No | — | Secuencia correlativa del año fiscal | CONFIRMADO |
| ultimo_cut_generado | VARCHAR(20) | | Sí | NULL | Último CUT emitido (formato `EXP-YYYY-XXXXXX`) | PROPUESTO |
| creado_en | TIMESTAMPTZ | | No | NOW() | Marca de creación | CONFIRMADO |

**Propósito:** Secuencia dedicada por año fiscal para generación atómica de CUT sin colisiones concurrentes `[CONFIRMADO]`

---

## 6. Entidad: asiento_registro

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_asiento | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno | CONFIRMADO |
| numero_registro | BIGINT | UQ | No | nextval('seq_asiento_numero_registro') | Correlativo visible (inmutable) | CONFIRMADO |
| fecha_ingreso | TIMESTAMPTZ | | No | NOW() | Fecha de ingreso | CONFIRMADO |
| canal_ingreso | VARCHAR(30) | | No | 'MESA_PRESENCIAL' | CHECK: MESA_PRESENCIAL / MESA_VIRTUAL | CONFIRMADO |
| asunto | VARCHAR(500) | | No | — | Asunto del asiento | CONFIRMADO |
| fk_expediente | BIGINT | FK | No | — | Expediente asociado | CONFIRMADO |
| fk_remitente | BIGINT | FK | No | — | Usuario (Grupo 4) | CONFIRMADO |
| fk_destinatario | BIGINT | FK | Sí | NULL | Destinatario (Grupo 3) | PENDIENTE |
| anulado | BOOLEAN | | No | false | Bandera de anulación lógica | CONFIRMADO |
| motivo_anulacion | TEXT | | Sí | NULL | Motivo de anulación | CONFIRMADO |

---

## 7. Reglas de numeración

| Regla | Descripción | Estado |
|-------|-------------|--------|
| Identificadores internos | Generados por PostgreSQL (`GENERATED ALWAYS AS IDENTITY`) | CONFIRMADO |
| CUT visible | Formato `EXP-YYYY-XXXXXX` vía `sigd_tra.generar_cut_expediente(p_anio INT)` | CONFIRMADO |
| Prohibición MAX()+1 | Se usa `nextval()` de secuencia por año fiscal | CONFIRMADO |
| Concurrencia CUT | Secuencias nativas garantizan unicidad atómica sin bloqueos muertos | CONFIRMADO |
| Numero_registro Libro | Secuencia separada `seq_asiento_numero_registro`, inmutable, no reutilizable | CONFIRMADO |
| Huecos en secuencia | Posibles ante ROLLBACK, aceptable para el Libro | CONFIRMADO |

---

## 8. Regla de anulación

- La anulación es **borrado lógico**: `anulado = true` + `motivo_anulacion` `[CONFIRMADO]`
- `NO DELETE`, no se reutiliza el `numero_registro` original `[CONFIRMADO]`
- El expediente pasa a estado `ANULADO` `[CONFIRMADO]`

---

## 9. Pendientes para validar

- [ ] Formato y longitud de `codigo_tramite` / `codigo_expediente` `[PENDIENTE]`
- [ ] Periodo de numeración del `numero_registro` (año/libro/sede/área) `[PENDIENTE]`
- [ ] ¿Trámite y expediente son 1 a 1 o 1:N? → **RESPUESTA: 1:N `[CONFIRMADO]`** `[CONFIRMADO]`
- [ ] Estados oficiales y operaciones tras cierre/anulación/archivamiento `[PENDIENTE]`
- [ ] Datos exactos del libro institucional de registro `[PENDIENTE]`
- [ ] Registro maestro de administrados externos sin credenciales (Grupo 4) `[PENDIENTE]`
- [ ] Formato oficial del CUT bajo R.S. N° 001-2017-PCM/SEGDI `[CONFIRMADO]`
- [ ] Procedimiento de acumulación/desacumulación bajo Art. 160 LPAG `[CONFIRMADO]`
- [ ] Reglas de foliatura bajo R.J. N° 073-2023-AGN/J `[CONFIRMADO]`
