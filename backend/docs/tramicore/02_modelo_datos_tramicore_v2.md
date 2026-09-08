# 02 · Modelo de datos v2.0 — TramiCore (CUT, Acumulación y Foliado Digital)

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Grupo:** Grupo 2 – "TramiCore"
**Autor:** Elmer Ramírez (B_RAMIREZ) — integración de análisis de Riquelmer y modelado de Sandy
**Estado:** Definitivo — Fase 2 Levantamiento de Observaciones
**Fecha:** 30 de agosto de 2026
**Versión:** 2.0

---

## 1. Propósito

Modelo lógico actualizado que subsana las observaciones arquitectónicas del diagnóstico senior:

1. Reemplazo de la relación rígida 1:1 entre trámite y expediente → **1:N flexible**
2. Incorporación de generador seguro de **CUT** (Código Único de Trámite) bajo MGD-PCM
3. Modelado de **Acumulación de Expedientes conexos** (Art. 160 LPAG)
4. Modelado de **Foliado Digital Progresivo** conforme AGN

---

## 2. Modelo entidad–relación

**Archivo editable:** `backend/docs/tramicore/02_modelo_datos_gestion_documental_diagrama.drawio`
**Imagen exportada:** `backend/docs/tramicore/02_modelo_datos_gestion_documental_diagrama.png`

**Leyenda:**
- Línea azul sólida → Grupo 2 (PROPUESTO/CONFIRMADO)
- Línea gris punteada → PENDIENTE / referencia de otro grupo
- PK → clave primaria · FK → clave foránea · UQ → único

---

## 3. Entidades principales

### 3.1 Trámite (`tramite`)

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_tramite | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno | CONFIRMADO |
| codigo_tramite | VARCHAR(20) | UQ | No | — | Código visible de trámite | PROPUESTO |
| asunto | VARCHAR(500) | | No | — | Descripción del trámite | CONFIRMADO |
| estado | VARCHAR(30) | | No | 'REGISTRADO' | Estado del trámite (CHECK) | CONFIRMADO |
| fk_remitente | BIGINT | FK | No | — | Usuario/Grupo 4 o solicitante externo | CONFIRMADO |
| fk_destinatario | BIGINT | FK | Sí | NULL | Usuario/área destino (Grupo 3) | PROPUESTO |
| creado_en | TIMESTAMPTZ | | No | NOW() | Marca de creación | CONFIRMADO |
| actualizado_en | TIMESTAMPTZ | | Sí | NULL | Marca de actualización | CONFIRMADO |

**Estados:** `REGISTRADO`, `EN_TRAMITE`, `OBSERVADO`, `CERRADO`, `ANULADO`, `REABIERTO` `[CONFIRMADO]`

---

### 3.2 Expediente (`expediente`)

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_expediente | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno (UUID lógico) | CONFIRMADO |
| codigo_expediente | VARCHAR(50) | UQ | No | — | Código visible del expediente | CONFIRMADO |
| fk_tramite | BIGINT | FK | No | — | Trámite asociado (**sin UNIQUE → 1:N**) | CONFIRMADO |
| creado_en | TIMESTAMPTZ | | No | NOW() | Fecha de creación | CONFIRMADO |

**Cambio clave respecto a v1:** `fk_tramite` **pierde** la restricción `UNIQUE`, permitiendo que **un trámite genere múltiples expedientes** `[CONFIRMADO]`. Esto posibilita la separación flexible entre trámite y expediente.

---

### 3.3 Expediente Acumulado — Accesorio (`expediente_acumulacion`)

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_acumulacion | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno | CONFIRMADO |
| id_expediente_principal | BIGINT | PK,FK | No | — | Expediente principal (Art. 160 LPAG) | CONFIRMADO |
| id_expediente_accesorio | BIGINT | PK,FK | No | — | Expediente accesorio a fusionar | CONFIRMADO |
| fecha_acumulacion | TIMESTAMPTZ | | No | NOW() | Fecha de la fusión jurídica | CONFIRMADO |
| acto_resolutivo | TEXT | | No | — | Justificación del acto resolutivo | CONFIRMADO |
| estado_acumulacion | VARCHAR(20) | | No | 'ACUMULADO' | `ACUMULADO` / `DESACUMULADO` | CONFIRMADO |
| fecha_desacumulacion | TIMESTAMPTZ | | Sí | NULL | Fecha de desacumulación (si aplica) | PROPUESTO |
| acto_resolutivo_desacumulacion | TEXT | | Sí | NULL | Justificación de desacumulación | PROPUESTO |
| creado_en | TIMESTAMPTZ | | No | NOW() | Marca de creación | CONFIRMADO |

**Restricciones:**
- Clave foránea compuesta: `(id_expediente_principal, id_expediente_accesorio)`
- `CHECK (id_expediente_principal <> id_expediente_accesorio)` — no puede acumularse a sí mismo
- El expediente accesorio cambia a estado `ACUMULADO` y sus trámites y folios se fusionan en el principal `[CONFIRMADO]`
- Desacumulación requiere nuevo acto resolutivo `[CONFIRMADO]`

**Relación:** N:M entre expedientes (un expediente puede ser principal de varios accesorios y accesorio de varios principales)

---

### 3.4 Foliado Digital (`expediente_documento_folio`)

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_folio | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno | CONFIRMADO |
| id_expediente | BIGINT | FK | No | — | Expediente al que pertenece | CONFIRMADO |
| id_documento | BIGINT | FK | No | — | Documento dentro del expediente (Grupo 5) | CONFIRMADO |
| folio_inicio | INT | | No | — | Primer folio asignado al documento | CONFIRMADO |
| folio_fin | INT | | No | — | Último folio asignado al documento | CONFIRMADO |
| total_folios | INT | | No | — | Calculado: `folio_fin - folio_inicio + 1` | CONFIRMADO |
| creado_en | TIMESTAMPTZ | | No | NOW() | Marca de asignación | CONFIRMADO |

**Restricciones:**
- `CHECK (folio_fin >= folio_inicio)` — el rango debe ser válido `[CONFIRMADO]`
- `CHECK (total_folios = folio_fin - folio_inicio + 1)` — consistencia del rango `[CONFIRMADO]`
- **Prohibición de solapamientos:** Ningún folio puede estar asignado a dos documentos distintos `[CONFIRMADO]`
- **Prohibición de vacíos:** Los folios deben ser continuos sin saltos `[CONFIRMADO]`
- **Inmutabilidad:** `DELETE` prohibido sobre rangos ya emitidos `[CONFIRMADO]`
- Para todo documento subsiguiente: `folio_inicio = folio_fin_del_anterior + 1` `[CONFIRMADO]`

---

### 3.5 Secuencia Anual CUT (`secuencia_anual_cut`)

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_secuencia | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno | CONFIRMADO |
| anio_fiscal | INT | UQ | No | — | Año fiscal (ej. 2026) | CONFIRMADO |
| secuencia | BIGINT | | No | — | Secuencia correlativa del año | CONFIRMADO |
| ultimo_cut_generado | VARCHAR(20) | | Sí | NULL | Último CUT emitido (ej. EXP-2026-000104) | PROPUESTO |
| creado_en | TIMESTAMPTZ | | No | NOW() | Marca de creación | CONFIRMADO |

**Propósito:** Almacena el estado de la secuencia para cada año fiscal, permitiendo generar CUTs con formato `EXP-YYYY-XXXXXX` sin riesgo de colisiones concurrentes `[CONFIRMADO]`.

---

### 3.6 Asiento de Libro de Registro (`asiento_registro`) — Sin cambios

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_asiento | BIGINT | PK | No | GENERATED ALWAYS AS IDENTITY | ID técnico interno | CONFIRMADO |
| numero_registro | BIGINT | UQ | No | secuencia segura | Correlativo visible (inmutable) | CONFIRMADO |
| fecha_ingreso | TIMESTAMPTZ | | No | NOW() | Fecha de ingreso | CONFIRMADO |
| canal_ingreso | VARCHAR(30) | | No | 'MESA_PRESENCIAL' | CHECK: MESA_PRESENCIAL / MESA_VIRTUAL | CONFIRMADO |
| asunto | VARCHAR(500) | | No | — | Asunto del asiento | CONFIRMADO |
| fk_expediente | BIGINT | FK | No | — | Expediente asociado | CONFIRMADO |
| fk_remitente | BIGINT | FK | No | — | Usuario (Grupo 4) | CONFIRMADO |
| fk_destinatario | BIGINT | FK | Sí | NULL | Destinatario (Grupo 3) | PROPUESTO |
| anulado | BOOLEAN | | No | false | Bandera de anulación lógica | CONFIRMADO |
| motivo_anulacion | TEXT | | Sí | NULL | Motivo de anulación | CONFIRMADO |

**Inmutabilidad:** Los números del Libro General de Registros son estrictamente inmutables, correlativos y no reutilizables `[CONFIRMADO]`.

---

## 4. Relaciones y cardinalidades actualizadas

| Origen | Cardinalidad | Destino | Tipo | Estado |
|--------|--------------|---------|------|--------|
| tramite | 1 ─── 1..n | expediente | 1:N flexible | CONFIRMADO |
| expediente | 1 ─── n | asiento_registro | 1:N | CONFIRMADO |
| expediente | N:M | expediente (acumulación) | Art. 160 LPAG | CONFIRMADO |
| expediente | 1 ─── n | expediente_documento_folio | 1:N | CONFIRMADO |
| expediente | 1 ─── 1 | secuencia_anual_cut | N:1 (por año) | CONFIRMADO |
| persona | 1 ─── n | tramite | G2/Grupo 4 | PROPUESTO |
| persona | 1 ─── n | asiento_registro | G2/Grupo 4 | PROPUESTO |
| usuario/área | 1 ─── n | tramite | G3 | PROPUESTO |
| usuario/área | 1 ─── n | asiento_registro | G3 | PROPUESTO |

---

## 5. Reglas de numeración y generación de CUT

- **Identificadores internos:** Generados por PostgreSQL (`BIGINT GENERATED ALWAYS AS IDENTITY`) `[CONFIRMADO]`
- **CUT visible:** Formato `EXP-YYYY-XXXXXX` generado por función `sigd_tra.generar_cut_expediente(p_anio INT)` `[CONFIRMADO]`
- **Prohibición absoluta de MAX()+1:** Se usa `nextval()` de secuencia dedicada por año fiscal `[CONFIRMADO]`
- **Concurrencia:** Las secuencias de PostgreSQL garantizan unicidad atómica sin bloqueos muertos `[CONFIRMADO]`
- **Los correlativos del Libro:** Mediante secuencia separada, inmutables, no reutilizables `[CONFIRMADO]`

---

## 6. Regla de anulación

- La anulación es un **borrado lógico**: `anulado = true` + `motivo_anulacion` sobre el asiento `[CONFIRMADO]`
- `NO DELETE`, no se reutiliza el `numero_registro` original `[CONFIRMADO]`
- El expediente pasa a estado `ANULADO` y el evento se entrega a trazabilidad (Grupo 1) `[CONFIRMADO]`

---

## 7. Identificadores

| Identificador | Tipo | Inmutable | Observación |
|---------------|------|-----------|-------------|
| id_tramite (técnico) | BIGINT INTENTITY | Sí | Generado por PostgreSQL |
| id_expediente (técnico) | BIGINT GENERATED ALWAYS AS IDENTITY | Sí | Clave técnica interna |
| codigo_tramite (visible) | VARCHAR(20) | PENDIENTE | Formato por validar |
| codigo_expediente (visible) | VARCHAR(50) | PENDIENTE | Formato CUT o similar |
| numero_registro (visible) | BIGINT | Sí | Inmutable, correlativo del Libro |
| CUT (visible) | VARCHAR(20) | Sí | Formato `EXP-YYYY-XXXXXX` |

---

## 8. Contratos de integración

- **Grupo 4 — Personas/remitente:** referencia a `usuario` sin repetir datos personales `[CONFIRMADO]`
- **Grupo 3 — Áreas/destinatario:** referencia a `area`, marcada como PROPUESTO `[CONFIRMADO]`
- **Grupo 5 — Documentos/adjuntos:** referencia a `documento`, asignación de foliatura en `expediente_documento_folio` `[CONFIRMADO]`
- **Grupo 1 — Trazabilidad:** emite evento de creación de expediente con `id_expediente` (UUID) y CUT `[CONFIRMADO]`

---

## 9. Criterios de aceptación (checklist)

- [ ] Cada entidad tiene un propósito único y relaciones justificadas `[CONFIRMADO]`
- [ ] Trámite y expediente son conceptos diferenciados con cardinalidad 1:N `[CONFIRMADO]`
- [ ] Los códigos visibles NO se usan como claves primarias técnicas `[CONFIRMADO]`
- [ ] Los correlativos NO se generan con `MAX(...) + 1` `[CONFIRMADO]`
- [ ] La entidad `expediente_acumulacion` modela correctamente relación N:M `[CONFIRMADO]`
- [ ] La foliación electrónica registra rangos continuos y rechaza solapamientos `[CONFIRMADO]`
- [ ] Se mantiene la inmutabilidad y no reutilización de números en `asiento_registro` `[CONFIRMADO]`
- [ ] La anulación conserva el registro sin `DELETE` ni reuso del número `[CONFIRMADO]`
- [ ] El modelo evita duplicar usuarios, áreas, documentos y eventos de trazabilidad `[CONFIRMADO]`
