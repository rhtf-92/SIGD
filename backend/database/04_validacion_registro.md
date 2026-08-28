### 2. Entidad: expediente

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|---|---|---|---|---|---|---|
| `id_expediente` | BIGINT | PK | No | autogen | ID técnico interno | PROPUESTO |
| `codigo_expediente` | VARCHAR(20) | | No | | Código visible de expediente | PENDIENTE |
| `fk_tramite` | BIGINT | FK | No | | Trámite asociado | PROPUESTO |
| `creado_en` | TIMESTAMPTZ | | No | now() | Fecha de creación | PROPUESTO |

---

### 3. Entidad: asiento_registro

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|---|---|---|---|---|---|---|
| `id_asiento` | BIGINT | PK | No | autogen | ID técnico interno | PROPUESTO |
| `numero_registro` | BIGINT | UNIQUE | No | secuencia segura | Correlativo visible | PENDIENTE |
| `fecha_ingreso` | TIMESTAMPTZ | | No | now() | Fecha de ingreso | PROPUESTO |
| `canal_ingreso` | VARCHAR(30) | | Sí | | Mesa de partes, web, etc. | PROPUESTO |
| `asunto` | TEXT | | Sí | | Asunto del asiento | PROPUESTO |
| `fk_expediente` | BIGINT | FK | No | | Expediente asociado | PROPUESTO |
| `fk_remitente` | BIGINT | FK | No | | Remitente | PROPUESTO |