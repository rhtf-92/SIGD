# 02 · Modelo de datos — Gestión Documental (SIGD)

Autor: Ramírez (B_RAMIREZ)
Estado: Borrador / propuesta sujeta a validación institucional

> Este documento presenta el modelo lógico preliminar para **trámite, expediente y
> asiento del libro de registro**. Es una propuesta técnica del grupo y NO fija
> decisiones institucionales oficiales.

---

## 1. Propósito

Representar, de forma coherente y verificable, cómo el sistema registrará:

- Lo que una persona desea tramitar (**trámite**).
- La agrupación de su documentación (**expediente**).
- La constancia de su ingreso (**asiento del libro de registro**).

El modelo distingue los **identificadores técnicos internos** de los **códigos
visibles** (código de trámite/expediente, número de registro), que aún están
pendientes de validación institucional.

---

## 2. Modelo entidad–relación

> Diagrama elaborado en Diagrams.net/DrawSQL. Conservar aquí el enlace o ruta al
> archivo editable (`.drawio`, `.drawsql`, etc.) y una captura/imagen.

**Archivo editable:** (ruta o enlace)
**Imagen del diagrama:** (insertar imagen)

```
[ En esta sección pega el modelo visual o la descripción legible del diagrama ]
```

---

## 3. Entidades principales

### 3.1 Trámite (tramite)
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id_tramite (PK) | BIGINT / UUID | Identificador técnico interno |
| codigo_tramite | VARCHAR | Código visible — PENDIENTE de formato oficial |
| asunto | TEXT | Descripción del trámite |
| estado | ENUM/CHECK | Registrado, en proceso, cerrado, anulado... |
| ... | | |

### 3.2 Expediente (expediente)
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id_expediente (PK) | BIGINT / UUID | Identificador técnico interno |
| codigo_expediente | VARCHAR | Código visible — PENDIENTE |
| fk_tramite | FK | Relación con trámite |
| ... | | |

### 3.3 Asiento de libro de registro (asiento_registro)
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id_asiento (PK) | BIGINT | Identificador técnico interno |
| numero_registro | BIGINT | Número correlativo visible — estrategia segura, NO MAX+1 |
| fecha_ingreso | TIMESTAMPTZ | Fecha y hora de ingreso |
| fk_expediente | FK | Relación con expediente |
| ... | | |

---

## 4. Relaciones y cardinalidades

| Origen | Cardinalidad | Destino |
|--------|--------------|---------|
| tramite | 1 ─── 1 | expediente |
| expediente | 1 ─── 1..n | asiento_registro |
| remitente | 1 ─── n | tramite |
| destinatario | 1 ─── n | tramite |
| ... | | |

> Las cardinalidades entre trámite, expediente y registro están marcadas como
> PROPUESTO hasta validar con el profesor.

---

## 5. Identificadores

| Identificador | Tipo | Inmutable | Observación |
|---------------|------|-----------|-------------|
| id_tramite (técnico) | interno | Sí | Generado por PostgreSQL |
| codigo_tramite (visible) | código | PENDIENTE | Formato por validar |
| numero_registro (visible) | correlativo | PENDIENTE | Estrategia segura |

---

## 6. Contratos de integración (sin duplicar entidades)

- **Grupo 4 — Usuarios/remitente:** referencia a `usuario`, sin repetir datos personales.
- **Grupo 3 — Áreas/destinatario:** referencia a `area`, marcada pendiente si la regla no está confirmada.
- **Grupo 5 — Documentos/adjuntos:** referencia a `documento`, sin rediseñar.
- **Grupo 1 — Trazabilidad:** entrega de expediente, referenciando eventos sin duplicar.

---

## 7. Criterios de aceptación (checklist)

- [ ] Cada entidad tiene un propósito único y relaciones justificadas.
- [ ] Trámite, expediente y asiento tienen propósitos diferenciados y cardinalidades justificadas.
- [ ] Los códigos visibles NO se usan como claves primarias técnicas.
- [ ] Los correlativos NO se generan con `MAX(...) + 1`.
- [ ] El modelo evita duplicar usuarios, áreas, documentos y eventos de trazabilidad.
